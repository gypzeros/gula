// ════════════════════════════════════════════════════════════════════
//   Gula Restaurante · Cloud Function de notificaciones por email
// ─────────────────────────────────────────────────────────────────────
//   Trigger: cualquier cambio en /orders/{orderId}
//
//   Eventos que dispara emails:
//     • Documento nuevo            → email al cliente "recibido"
//                                  → email al admin    "nuevo pedido"
//     • status pending → preparing → email al cliente "confirmado"
//     • status preparing → ready   → email al cliente "listo para recoger"
//
//   Idempotente: no manda dos veces el mismo email aunque Firestore
//   reintente el trigger. Marca cada envío en /orders/{id}.mailSent.*
//
//   Credenciales en Google Secret Manager:
//
//     firebase functions:secrets:set MAIL_SMTP_HOST
//     firebase functions:secrets:set MAIL_SMTP_PORT
//     firebase functions:secrets:set MAIL_SMTP_USER
//     firebase functions:secrets:set MAIL_SMTP_PASS
//     firebase functions:secrets:set MAIL_FROM
//
// ════════════════════════════════════════════════════════════════════

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { renderEmail } = require("./templates");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", memory: "256MiB", maxInstances: 5 });

// ─── Secrets ──────────────────────────────────────────────────
const MAIL_SMTP_HOST = defineSecret("MAIL_SMTP_HOST");
const MAIL_SMTP_PORT = defineSecret("MAIL_SMTP_PORT");
const MAIL_SMTP_USER = defineSecret("MAIL_SMTP_USER");
const MAIL_SMTP_PASS = defineSecret("MAIL_SMTP_PASS");
const MAIL_FROM      = defineSecret("MAIL_FROM"); // ej: "Gula Restaurante <noreply@gularestaurante.es>"

const ALL_SECRETS = [MAIL_SMTP_HOST, MAIL_SMTP_PORT, MAIL_SMTP_USER, MAIL_SMTP_PASS, MAIL_FROM];

// ─── Trigger principal ────────────────────────────────────────
exports.onOrderWrite = onDocumentWritten(
  {
    document: "orders/{orderId}",
    secrets: ALL_SECRETS,
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after  = event.data?.after?.exists  ? event.data.after.data()  : null;
    if (!after) return;        // borrado: nada que avisar

    const ref = event.data.after.ref;
    const transporter = buildTransporter();

    // Lee email del admin desde settings/main (lo configuras en el panel)
    const settings = await admin.firestore().doc("settings/main").get();
    const adminEmail = settings.exists ? settings.data().notificationEmail : null;

    const customerEmail = after.customer?.email;

    // ─── 1) Pedido nuevo ───────────────────────────────────────
    if (!before) {
      // Cliente: "hemos recibido tu pedido"
      if (customerEmail && !after.mailSent?.customerReceived) {
        await sendAndMark(transporter, ref, "customerReceived", {
          to: customerEmail,
          subject: `Hemos recibido tu pedido ${after.number} · Gula Restaurante`,
          ...renderEmail("customerReceived", after),
        });
      }
      // Admin: "nuevo pedido entrando"
      if (adminEmail && !after.mailSent?.adminNew) {
        await sendAndMark(transporter, ref, "adminNew", {
          to: adminEmail,
          subject: `🍣 Nuevo pedido ${after.number} · ${after.customer.name}`,
          ...renderEmail("adminNew", after),
        });
      }
      return;
    }

    // ─── 2) Admin confirma (pending → preparing) ───────────────
    if (before.status === "pending" && after.status === "preparing") {
      if (customerEmail && !after.mailSent?.customerConfirmed) {
        await sendAndMark(transporter, ref, "customerConfirmed", {
          to: customerEmail,
          subject: `Tu pedido ${after.number} está confirmado`,
          ...renderEmail("customerConfirmed", after),
        });
      }
      return;
    }

    // ─── 3) Listo para recoger (preparing → ready) ─────────────
    if (before.status === "preparing" && after.status === "ready") {
      if (customerEmail && !after.mailSent?.customerReady) {
        await sendAndMark(transporter, ref, "customerReady", {
          to: customerEmail,
          subject: `Tu pedido ${after.number} está listo para recoger`,
          ...renderEmail("customerReady", after),
        });
      }
      return;
    }

    logger.debug("No email for transition", {
      from: before.status, to: after.status, id: event.params.orderId,
    });
  }
);


// ─── Envío + marca de idempotencia ────────────────────────────
async function sendAndMark(transporter, ref, key, { to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM.value(),
      to,
      subject,
      text,
      html,
    });
    logger.info("Email enviado", { key, to, messageId: info.messageId });
    await ref.update({
      [`mailSent.${key}`]: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error("Email fallido", { key, to, error: err.message });
  }
}


// ─── Transporter (lazy, una instancia por invocación) ─────────
function buildTransporter() {
  return nodemailer.createTransport({
    host: MAIL_SMTP_HOST.value(),
    port: parseInt(MAIL_SMTP_PORT.value(), 10),
    secure: parseInt(MAIL_SMTP_PORT.value(), 10) === 465,
    auth: {
      user: MAIL_SMTP_USER.value(),
      pass: MAIL_SMTP_PASS.value(),
    },
  });
}
