// Generador de plantillas HTML para los 4 emails que manda la function.
// Mismo lenguaje visual que la web: paleta ink/paper/gold/claret + Cormorant
// Garamond + Noto Serif JP. Todo inline porque Outlook ignora <style>.

const fmtEUR = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const escapeHtml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const pad2 = (n) => String(n).padStart(2, "0");

function toDate(v) {
  if (!v) return new Date();
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(v);
}

function formatOrderDate(d) {
  const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months   = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function itemsTable(items) {
  return items.map((it) => `
    <tr>
      <td style="padding:8px 0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:16px; color:#0f0c0a; border-bottom:1px solid rgba(176,122,54,.18);">
        <span style="color:#b07a36; font-weight:500; padding-right:6px;">${it.qty}×</span> ${escapeHtml(it.name)}
      </td>
      <td align="right" style="padding:8px 0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:16px; color:#0f0c0a; border-bottom:1px solid rgba(176,122,54,.18); white-space:nowrap;">
        ${fmtEUR(it.price * it.qty)}
      </td>
    </tr>
  `).join("");
}

// ─── Shell común (header oscuro + body crema + footer oscuro) ─
function shell({ kanji, label, headline, headlineHuge, dateLine, bodyHtml }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>Gula Restaurante</title>
</head>
<body style="margin:0; padding:0; background:#0f0c0a; -webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f0c0a;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%;">
        <!-- HEAD oscuro -->
        <tr>
          <td align="center" style="padding:36px 40px 28px; background:#14110e; border:1px solid rgba(176,122,54,.22); border-bottom:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="padding-right:10px;" valign="middle">
                  <span style="display:inline-block;width:22px;height:22px;background:#b07a36;border-radius:50%;"></span>
                </td>
                <td valign="middle" style="font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:22px; color:#ece2cf;">
                  Gula <span style="color:#8a7e6c; font-style:normal; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.32em; text-transform:uppercase; padding-left:8px;">Restaurante</span>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 6px; font-family:'Noto Serif JP','Hiragino Mincho ProN',serif; font-size:11px; letter-spacing:.36em; color:#b07a36;">
              ${kanji} · ${label}
            </p>
            <p style="margin:6px 0 4px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:500; font-size:${headlineHuge ? "72px" : "30px"}; line-height:1.1; color:#e2b576; letter-spacing:.02em;">
              ${headline}
            </p>
            ${dateLine ? `<p style="margin:14px 0 0; font-family:Arial,sans-serif; font-size:11px; letter-spacing:.3em; color:#8a7e6c; text-transform:uppercase;">${dateLine}</p>` : ""}
          </td>
        </tr>
        <!-- BODY crema -->
        <tr>
          <td style="padding:32px 40px 28px; background:#ece2cf; color:#0f0c0a; border-left:1px solid rgba(176,122,54,.22); border-right:1px solid rgba(176,122,54,.22);">
            ${bodyHtml}
          </td>
        </tr>
        <!-- FOOTER oscuro -->
        <tr>
          <td align="center" style="padding:24px 40px 32px; background:#14110e; color:#8a7e6c; border:1px solid rgba(176,122,54,.22); border-top:0;">
            <p style="margin:0 0 8px; font-family:'Noto Serif JP',serif; font-size:14px; color:#b07a36; letter-spacing:.12em;">味噌 ・ 大豆 ・ 米</p>
            <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:15px; color:#d8cdb6;">De Japón al corazón de Andalucía.</p>
            <p style="margin:18px 0 0; font-family:Arial,sans-serif; font-size:11px; letter-spacing:.18em; color:#8a7e6c; line-height:1.7;">
              C. Rafael Leña Caballero, bloque 2 · 14940 Cabra (Córdoba)<br>
              <a href="tel:+34667099828" style="color:#b07a36; text-decoration:none;">667 09 98 28</a> &nbsp;·&nbsp;
              <a href="https://gularestaurante.es" style="color:#b07a36; text-decoration:none;">gularestaurante.es</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Bloques reutilizables ────────────────────────────────────
function pickupBlock(o) {
  const pickup = toDate(o.pickupTime);
  const hhmm = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  const mins = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60000));
  const label = o.scheduled ? "Recogida programada" : `Lo antes posible · en unos ${mins} minutos`;
  return `
    <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">受取 · Recogida</p>
    <p style="margin:0 0 6px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:500; font-size:32px; color:#0f0c0a; line-height:1; letter-spacing:.01em;">${hhmm}</p>
    <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:15px; color:#5a4f3e;">${label}</p>
  `;
}

function itemsBlock(o) {
  return `
    <p style="margin:0 0 12px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">注文 · Pedido</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemsTable(o.items)}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px; border-top:2px solid #0f0c0a;">
      <tr>
        <td style="padding:14px 0 0; font-family:Arial,sans-serif; font-size:11px; letter-spacing:.32em; color:#5a4f3e; text-transform:uppercase;">Total</td>
        <td align="right" style="padding:14px 0 0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:500; font-size:26px; color:#0f0c0a;">${fmtEUR(o.total)}</td>
      </tr>
    </table>
  `;
}

function notesBlock(o) {
  if (!o.notes) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px; background:rgba(176,122,54,.08); border-left:3px solid #b07a36;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">備考 · Notas</p>
          <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:15px; color:#0f0c0a;">«${escapeHtml(o.notes)}»</p>
        </td>
      </tr>
    </table>
  `;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="border-top:1px solid rgba(176,122,54,.3); font-size:0; line-height:0;">&nbsp;</td></tr></table>`;
}

// ═══════════════════════════════════════════════════════════════
//    1. CLIENTE · "Hemos recibido tu pedido"
// ═══════════════════════════════════════════════════════════════
function renderCustomerReceived(o) {
  const body = `
    <p style="margin:0 0 16px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:20px; color:#0f0c0a; line-height:1.4;">
      Hola <strong style="font-weight:500;">${escapeHtml(o.customer.name)}</strong>,
    </p>
    <p style="margin:0 0 20px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:17px; color:#3d3528; line-height:1.5;">
      Hemos recibido tu pedido. Lo confirmaremos en breve por email y te avisaremos cuando esté listo para recoger. Cualquier duda llámanos al
      <a href="tel:+34667099828" style="color:#7a2a26; text-decoration:none; border-bottom:1px solid rgba(122,42,38,.4);">667 09 98 28</a>.
    </p>
    ${divider()}
    ${pickupBlock(o)}
    ${divider()}
    ${itemsBlock(o)}
    ${notesBlock(o)}
  `;
  return shell({
    kanji: "受付完了",
    label: "PEDIDO RECIBIDO",
    headline: o.number,
    headlineHuge: true,
    dateLine: formatOrderDate(toDate(o.createdAt) || new Date()),
    bodyHtml: body,
  });
}

// ═══════════════════════════════════════════════════════════════
//    2. CLIENTE · "Tu pedido está confirmado"
// ═══════════════════════════════════════════════════════════════
function renderCustomerConfirmed(o) {
  const pickup = toDate(o.pickupTime);
  const hhmm = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  const mins = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60000));

  const body = `
    <p style="margin:0 0 16px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:20px; color:#0f0c0a; line-height:1.4;">
      ¡Gracias <strong style="font-weight:500;">${escapeHtml(o.customer.name)}</strong>!
    </p>
    <p style="margin:0 0 20px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:17px; color:#3d3528; line-height:1.5;">
      Tu pedido <strong>${o.number}</strong> está en marcha. ${o.scheduled
        ? `Te lo tenemos listo a las <strong>${hhmm}</strong>.`
        : `Te lo tenemos listo en unos <strong>${mins} minutos</strong>.`
      } Te avisaremos por email cuando esté listo para recoger.
    </p>
    ${divider()}
    <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">📍 Dónde recogerlo</p>
    <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:17px; color:#0f0c0a; line-height:1.4;">
      C. Rafael Leña Caballero, bloque 2<br>14940 Cabra (Córdoba)
    </p>
  `;
  return shell({
    kanji: "確認済",
    label: "PEDIDO CONFIRMADO",
    headline: `${o.number}`,
    headlineHuge: true,
    bodyHtml: body,
  });
}

// ═══════════════════════════════════════════════════════════════
//    3. CLIENTE · "Está LISTO para recoger"
// ═══════════════════════════════════════════════════════════════
function renderCustomerReady(o) {
  const body = `
    <p style="margin:0 0 16px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:24px; color:#0f0c0a; line-height:1.3; text-align:center;">
      <strong style="font-weight:500;">${escapeHtml(o.customer.name)}</strong>,
    </p>
    <p style="margin:0 0 28px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:22px; color:#7a2a26; line-height:1.3; text-align:center;">
      tu pedido <strong>${o.number}</strong> está listo<br>para recoger.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px; background:rgba(176,122,54,.08); border:1px solid rgba(176,122,54,.25);">
      <tr>
        <td style="padding:18px 20px; text-align:center;">
          <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">店 · Establecimiento</p>
          <p style="margin:0; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:18px; color:#0f0c0a;">
            C. Rafael Leña Caballero, bloque 2<br>14940 Cabra (Córdoba)
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0; text-align:center; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:17px; color:#3d3528;">
      ¡Te esperamos!
    </p>
  `;
  return shell({
    kanji: "準備完了",
    label: "LISTO PARA RECOGER",
    headline: o.number,
    headlineHuge: true,
    bodyHtml: body,
  });
}

// ═══════════════════════════════════════════════════════════════
//    4. ADMIN · "Nuevo pedido entrando"
// ═══════════════════════════════════════════════════════════════
function renderAdminNew(o) {
  const body = `
    <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:10px; letter-spacing:.36em; color:#b07a36; text-transform:uppercase;">客 · Cliente</p>
    <p style="margin:0 0 4px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:28px; color:#0f0c0a; line-height:1.1;">${escapeHtml(o.customer.name)}</p>
    <p style="margin:0 0 4px; font-family:Arial,sans-serif; font-size:15px;">
      <a href="tel:${o.customer.phone.replace(/[^\d]/g, "")}" style="color:#7a2a26; text-decoration:none; border-bottom:1px solid rgba(122,42,38,.4);">${escapeHtml(o.customer.phone)}</a>
    </p>
    ${o.customer.email ? `<p style="margin:0; font-family:Arial,sans-serif; font-size:13px;"><a href="mailto:${escapeHtml(o.customer.email)}" style="color:#5a4f3e; text-decoration:none;">${escapeHtml(o.customer.email)}</a></p>` : ""}
    ${divider()}
    ${pickupBlock(o)}
    ${divider()}
    ${itemsBlock(o)}
    ${notesBlock(o)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
      <tr>
        <td align="center">
          <a href="https://gularestaurante.es/admin.html" style="display:inline-block; padding:14px 28px; background:#0f0c0a; color:#ece2cf; font-family:Arial,sans-serif; font-size:11px; letter-spacing:.36em; text-transform:uppercase; text-decoration:none; border:1px solid #b07a36;">Abrir el panel</a>
        </td>
      </tr>
    </table>
  `;
  return shell({
    kanji: "受注",
    label: "NUEVO PEDIDO",
    headline: o.number,
    headlineHuge: true,
    dateLine: formatOrderDate(toDate(o.createdAt) || new Date()),
    bodyHtml: body,
  });
}

// ─── Versiones en texto plano (para clientes sin HTML) ────────
function textCustomerReceived(o) {
  return `Hola ${o.customer.name},

Hemos recibido tu pedido ${o.number}. Lo confirmaremos en breve y te avisaremos cuando esté listo para recoger.

Dudas: 667 09 98 28
─────
Gula Restaurante
C. Rafael Leña Caballero, bloque 2 · Cabra
gularestaurante.es`;
}

function textCustomerConfirmed(o) {
  const pickup = toDate(o.pickupTime);
  const hhmm = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  const mins = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60000));
  const when = o.scheduled ? `a las ${hhmm}` : `en unos ${mins} minutos`;
  return `¡Gracias ${o.customer.name}!

Tu pedido ${o.number} está confirmado. Te lo tenemos listo ${when}.

C. Rafael Leña Caballero, bloque 2 · Cabra
─────
Gula Restaurante · 667 09 98 28`;
}

function textCustomerReady(o) {
  return `${o.customer.name}, tu pedido ${o.number} está LISTO para recoger en Gula.

C. Rafael Leña Caballero, bloque 2 · Cabra
¡Te esperamos!`;
}

function textAdminNew(o) {
  const itemsLines = o.items.map((it) => `  ${it.qty}× ${it.name} — ${fmtEUR(it.price * it.qty)}`).join("\n");
  const pickup = toDate(o.pickupTime);
  const hhmm = `${pad2(pickup.getHours())}:${pad2(pickup.getMinutes())}`;
  return `Nuevo pedido ${o.number}

Cliente: ${o.customer.name}
Tel:     ${o.customer.phone}
${o.customer.email ? `Email:   ${o.customer.email}\n` : ""}
Recogida: ${hhmm}${o.scheduled ? " (programado)" : " (asap)"}

Items:
${itemsLines}
TOTAL: ${fmtEUR(o.total)}
${o.notes ? `\nNotas: ${o.notes}\n` : ""}
Ver: https://gularestaurante.es/admin.html`;
}


// ─── Dispatcher ───────────────────────────────────────────────
function renderEmail(kind, order) {
  switch (kind) {
    case "customerReceived":  return { html: renderCustomerReceived(order),  text: textCustomerReceived(order) };
    case "customerConfirmed": return { html: renderCustomerConfirmed(order), text: textCustomerConfirmed(order) };
    case "customerReady":     return { html: renderCustomerReady(order),     text: textCustomerReady(order) };
    case "adminNew":          return { html: renderAdminNew(order),          text: textAdminNew(order) };
    default:                  throw new Error(`Plantilla desconocida: ${kind}`);
  }
}

module.exports = { renderEmail };
