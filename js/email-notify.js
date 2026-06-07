// Envía un email transaccional al admin cuando entra un pedido.
// Usa EmailJS — credenciales abajo. La plantilla está en email-template-pedido.html.

import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

const PUBLIC_KEY  = "3-ANCuX7ixCOcuB8M";
const SERVICE_ID  = "service_7fxffmg";
const TEMPLATE_ID = "template_pgxdiqa";

emailjs.init({ publicKey: PUBLIC_KEY });

// ─── Helpers de formato ───────────────────────────────────────
const fmtEUR = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const escapeHtml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function pad2(n) { return String(n).padStart(2, "0"); }

function buildItemsHtml(items) {
  return items.map((it) => `
    <tr>
      <td style="padding:8px 0; font-style:italic; font-size:16px; color:#0f0c0a; border-bottom:1px solid rgba(176,122,54,.18);">
        <span style="color:#b07a36; font-weight:500; padding-right:6px;">${it.qty}×</span> ${escapeHtml(it.name)}
      </td>
      <td align="right" style="padding:8px 0; font-style:italic; font-size:16px; color:#0f0c0a; border-bottom:1px solid rgba(176,122,54,.18); white-space:nowrap;">
        ${fmtEUR(it.price * it.qty)}
      </td>
    </tr>
  `).join("");
}

function buildNotesBlock(notes) {
  if (!notes) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px; background:rgba(176,122,54,.08); border-left:3px solid #b07a36;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px; font-family:Manrope,Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">備考 · Notas</p>
          <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:15px; color:#0f0c0a;">«${escapeHtml(notes)}»</p>
        </td>
      </tr>
    </table>
  `;
}

function formatOrderDate(d) {
  const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months   = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ─── Envío principal ──────────────────────────────────────────
// fire-and-forget: si EmailJS falla no rompemos el pedido, solo lo logueamos
export async function sendOrderNotification({ order, toEmail }) {
  if (!toEmail) return;     // sin destino configurado → no se manda nada

  const pickup = order.pickupTime?.toDate ? order.pickupTime.toDate() : order.pickupTime;
  const pickupHHMM = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  const minutes = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60_000));

  const params = {
    to_email: toEmail,
    order_number: order.number,
    customer_name: order.customer.name,
    customer_phone: order.customer.phone,
    customer_phone_link: order.customer.phone.replace(/[^\d]/g, ""),
    pickup_kind: order.scheduled ? "scheduled" : "asap",
    pickup_time: pickupHHMM,
    pickup_label: order.scheduled
      ? "Recogida programada"
      : `Lo antes posible · en unos ${minutes} minutos`,
    items_html: buildItemsHtml(order.items),
    notes_block: buildNotesBlock(order.notes),
    notes: order.notes || "",
    total: fmtEUR(order.total),
    order_date: formatOrderDate(new Date()),
    admin_url: "https://gularestaurante.es/admin.html",
  };

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, params);
    console.info("Email notification enviado a", toEmail);
  } catch (e) {
    console.warn("Email notification falló:", e);
  }
}
