// ════════════════════════════════════════════════════════════════════
//   Gula Restaurante · Cloud Function de notificaciones SMS (Twilio)
// ─────────────────────────────────────────────────────────────────────
//   Se dispara con CUALQUIER cambio en /orders/{orderId} y decide:
//
//     • Documento nuevo            → SMS "pedido recibido"
//     • status pending → preparing → SMS "pedido confirmado"
//     • status preparing → ready   → SMS "pedido listo para recoger"
//
//   Las credenciales viven en Google Secret Manager (no en el repo).
//   Para configurarlas:
//
//     firebase functions:secrets:set TWILIO_ACCOUNT_SID
//     firebase functions:secrets:set TWILIO_AUTH_TOKEN
//     firebase functions:secrets:set TWILIO_SENDER
//
//   Luego desplegar:
//
//     firebase deploy --only functions
//
// ════════════════════════════════════════════════════════════════════

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const Twilio = require("twilio");

admin.initializeApp();

// Región y memoria globales (más cerca de España, sobra con 256MB)
setGlobalOptions({ region: "europe-west1", memory: "256MiB", maxInstances: 5 });

// ─── Secrets ──────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN  = defineSecret("TWILIO_AUTH_TOKEN");
// "GULA" (alfanumérico) o "+34..." (número Twilio)
const TWILIO_SENDER      = defineSecret("TWILIO_SENDER");

// ─── Trigger principal ────────────────────────────────────────
exports.onOrderWrite = onDocumentWritten(
  {
    document: "orders/{orderId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SENDER],
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after  = event.data?.after?.exists  ? event.data.after.data()  : null;

    // Borrado → nada que notificar
    if (!after) {
      logger.info("Order deleted, no SMS", { orderId: event.params.orderId });
      return;
    }

    const rawPhone = after.customer?.phone;
    const to = normalizeE164(rawPhone);
    if (!to) {
      logger.warn("Skipping SMS: invalid phone", { rawPhone, orderId: event.params.orderId });
      return;
    }

    const client = Twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
    const sender = TWILIO_SENDER.value();
    const ref = event.data.after.ref;

    // ─── 1) Pedido nuevo ───────────────────────────────────────
    if (!before) {
      // Idempotencia: si ya se mandó (por reintento del trigger), no duplicar
      if (after.smsSent?.received) {
        logger.info("Received SMS already sent, skip", { id: event.params.orderId });
        return;
      }
      const body = buildReceivedBody(after);
      const sid = await sendSMS(client, { from: sender, to, body });
      if (sid) {
        await ref.update({ "smsSent.received": admin.firestore.FieldValue.serverTimestamp() });
      }
      return;
    }

    // ─── 2) Admin confirma (pending → preparing) ───────────────
    if (before.status === "pending" && after.status === "preparing") {
      if (after.smsSent?.confirmed) {
        logger.info("Confirmed SMS already sent, skip", { id: event.params.orderId });
        return;
      }
      const body = buildConfirmedBody(after);
      const sid = await sendSMS(client, { from: sender, to, body });
      if (sid) {
        await ref.update({ "smsSent.confirmed": admin.firestore.FieldValue.serverTimestamp() });
      }
      return;
    }

    // ─── 3) Listo para recoger (preparing → ready) ─────────────
    if (before.status === "preparing" && after.status === "ready") {
      if (after.smsSent?.ready) {
        logger.info("Ready SMS already sent, skip", { id: event.params.orderId });
        return;
      }
      const body = buildReadyBody(after);
      const sid = await sendSMS(client, { from: sender, to, body });
      if (sid) {
        await ref.update({ "smsSent.ready": admin.firestore.FieldValue.serverTimestamp() });
      }
      return;
    }

    // Cualquier otro cambio (notes, picked_up, cancelled…) → no SMS
    logger.debug("No SMS for transition", {
      from: before.status, to: after.status, id: event.params.orderId,
    });
  }
);


// ─── Envío y reporte ──────────────────────────────────────────
async function sendSMS(client, { from, to, body }) {
  try {
    const msg = await client.messages.create({ from, to, body });
    logger.info("SMS enviado", { to, sid: msg.sid, status: msg.status });
    return msg.sid;
  } catch (err) {
    logger.error("SMS fallido", {
      to, code: err.code, message: err.message, moreInfo: err.moreInfo,
    });
    return null;
  }
}


// ─── Plantillas (cortas para gastar 1 segmento por SMS) ───────
function buildReceivedBody(o) {
  return `Gula: hemos recibido tu pedido ${o.number}. Lo confirmaremos en breve. Dudas: 667099828.`;
}

function buildConfirmedBody(o) {
  const pickup = toDate(o.pickupTime);
  const hhmm = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  if (o.scheduled) {
    return `Gula: pedido ${o.number} confirmado. Te lo tenemos listo a las ${hhmm}.`;
  }
  const mins = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60000));
  return `Gula: pedido ${o.number} confirmado. Te lo tenemos listo en unos ${mins} min.`;
}

function buildReadyBody(o) {
  return `Gula: tu pedido ${o.number} esta LISTO para recoger. Te esperamos en C/ Rafael Lena Caballero 2, Cabra.`;
}


// ─── Helpers ──────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }

function toDate(v) {
  if (!v) return new Date();
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(v);
}

// Convierte cualquier formato de móvil español a E.164: "+34666123456".
// Acepta: "+34666123456", "666 12 34 56", "0034 666 123 456", "666-123-456"…
function normalizeE164(phone) {
  if (!phone) return null;
  let s = String(phone).trim();

  // Si ya empieza por + lo respetamos (solo limpiamos espacios/guiones)
  if (s.startsWith("+")) {
    s = "+" + s.slice(1).replace(/\D/g, "");
    return s.length >= 10 ? s : null;
  }

  // 00 al inicio = prefijo internacional → reemplazar por +
  if (s.startsWith("00")) {
    s = "+" + s.slice(2).replace(/\D/g, "");
    return s.length >= 10 ? s : null;
  }

  const digits = s.replace(/\D/g, "");
  // 9 dígitos → móvil/fijo español sin prefijo
  if (digits.length === 9) return "+34" + digits;
  // 11 dígitos empezando por 34 → ya tienen el código
  if (digits.length === 11 && digits.startsWith("34")) return "+" + digits;

  return null;
}
