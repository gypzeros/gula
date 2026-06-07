// Lógica del panel admin: login, edición de ajustes, gestión de pedidos

import { formatEUR, MENU, CATEGORIES } from "./menu-data.js";
import {
  listenSettings, updateSettings, ensureSettingsExist,
  listenOrdersForDay, updateOrderStatus,
  adminSignIn, adminSignOut, onAdminAuthChange,
} from "./order-store.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ─── Auth ──────────────────────────────────────────────────────
onAdminAuthChange(async (user) => {
  $("#loading").classList.add("is-hidden");
  if (user) {
    $("#loginView").style.display = "none";
    $("#dashView").style.display = "block";
    $("#userEmail").textContent = user.email;
    await ensureSettingsExist();
    startListening();
  } else {
    $("#loginView").style.display = "grid";
    $("#dashView").style.display = "none";
  }
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#loginBtn");
  const err = $("#loginError");
  err.textContent = "";
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    await adminSignIn($("#loginEmail").value.trim(), $("#loginPassword").value);
  } catch (e) {
    const msg = {
      "auth/invalid-credential": "Email o contraseña incorrectos.",
      "auth/user-not-found":     "Ese usuario no existe.",
      "auth/wrong-password":     "Contraseña incorrecta.",
      "auth/too-many-requests":  "Demasiados intentos. Espera unos minutos.",
    }[e.code] || "Error al iniciar sesión. Inténtalo de nuevo.";
    err.textContent = msg;
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

$("#signOutBtn").addEventListener("click", async () => {
  await adminSignOut();
});


// ─── Settings ──────────────────────────────────────────────────
let currentSettings = { enabled: true, prepMinutes: 30, pausedMessage: "" };
let settingsApplying = false;     // evita bucles entre snapshot ↔ UI

function applySettingsUI(s) {
  if (settingsApplying) return;
  settingsApplying = true;
  currentSettings = s;

  const toggle = $("#enabledToggle");
  toggle.classList.toggle("is-on", s.enabled);
  toggle.classList.toggle("is-off", !s.enabled);
  $("#enabledState").textContent = s.enabled ? "Activo" : "Cerrado";

  $("#prepSlider").value = s.prepMinutes;
  $("#prepValue").textContent = s.prepMinutes;
  $("#prepSlider").style.setProperty("--pct", `${((s.prepMinutes - 10) / (120 - 10)) * 100}%`);

  if (document.activeElement !== $("#pausedMessage")) {
    $("#pausedMessage").value = s.pausedMessage || "";
  }
  if (document.activeElement !== $("#openFromInput")) {
    $("#openFromInput").value = s.openFrom || "13:30";
  }
  if (document.activeElement !== $("#openToInput")) {
    $("#openToInput").value = s.openTo || "23:30";
  }

  // Badge con número de platos agotados
  const disabledCount = Array.isArray(s.disabledDishes) ? s.disabledDishes.length : 0;
  const badge = $("#disabledBadge");
  badge.textContent = disabledCount;
  if (disabledCount > 0) badge.removeAttribute("hidden");
  else badge.setAttribute("hidden", "");

  // Si el modal está abierto, repintar los toggles
  if ($("#dishesModal").classList.contains("is-open")) renderDishesModalBody();

  settingsApplying = false;
}

// Guardar horario con debounce
let hoursDebounce;
const persistHours = () => {
  clearTimeout(hoursDebounce);
  hoursDebounce = setTimeout(async () => {
    await updateSettings({
      openFrom: $("#openFromInput").value || "13:30",
      openTo:   $("#openToInput").value   || "23:30",
    });
  }, 400);
};
$("#openFromInput").addEventListener("change", persistHours);
$("#openToInput").addEventListener("change", persistHours);

// Toggle
$("#enabledSwitch").addEventListener("click", async () => {
  const newVal = !currentSettings.enabled;
  $("#enabledToggle").classList.toggle("is-on", newVal);
  $("#enabledToggle").classList.toggle("is-off", !newVal);
  $("#enabledState").textContent = newVal ? "Activo" : "Cerrado";
  await updateSettings({ enabled: newVal });
});

// Slider de tiempo de preparación
$("#prepSlider").addEventListener("input", (e) => {
  const v = parseInt(e.target.value);
  $("#prepValue").textContent = v;
  $("#prepSlider").style.setProperty("--pct", `${((v - 10) / (120 - 10)) * 100}%`);
});
let sliderDebounce;
$("#prepSlider").addEventListener("change", async (e) => {
  clearTimeout(sliderDebounce);
  sliderDebounce = setTimeout(async () => {
    await updateSettings({ prepMinutes: parseInt(e.target.value) });
  }, 200);
});

// Mensaje
$("#saveMessageBtn").addEventListener("click", async () => {
  const btn = $("#saveMessageBtn");
  btn.classList.add("is-saving");
  btn.textContent = "Guardando…";
  await updateSettings({ pausedMessage: $("#pausedMessage").value.trim() });
  setTimeout(() => {
    btn.classList.remove("is-saving");
    btn.textContent = "Guardado ✓";
    setTimeout(() => { btn.textContent = "Guardar mensaje"; }, 1400);
  }, 200);
});


// ─── Orders ────────────────────────────────────────────────────
let allOrders = [];
let filterMode = "active";          // active | all | ready | picked_up
let currentDate = startOfDay(new Date());
let unsubscribeOrders = null;

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatDateLabel(date) {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === today.getTime())     return "Hoy";
  if (date.getTime() === yesterday.getTime()) return "Ayer";
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function switchDate(newDate) {
  currentDate = startOfDay(newDate);
  $("#dateLabel").textContent = formatDateLabel(currentDate);
  $("#dateInput").value = toDateInputValue(currentDate);

  const today = startOfDay(new Date());
  $("#dateNext").disabled = currentDate.getTime() >= today.getTime();

  // Cancela el listener anterior antes de suscribirse al nuevo día
  if (unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders = listenOrdersForDay(currentDate, (orders) => {
    allOrders = orders;
    renderOrders();
  });
}

// Navegación con flechas + apertura del calendario nativo
$("#datePrev").addEventListener("click", () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() - 1);
  switchDate(d);
});
$("#dateNext").addEventListener("click", () => {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + 1);
  const today = startOfDay(new Date());
  if (d.getTime() <= today.getTime()) switchDate(d);
});
$("#dateButton").addEventListener("click", () => {
  try { $("#dateInput").showPicker(); }
  catch { $("#dateInput").click(); }
});
$("#dateInput").addEventListener("change", (e) => {
  if (!e.target.value) return;
  switchDate(new Date(e.target.value));
});

$$(".filter").forEach((b) => {
  b.addEventListener("click", () => {
    filterMode = b.dataset.filter;
    $$(".filter").forEach((x) => x.classList.toggle("is-active", x === b));
    renderOrders();
  });
});

function startListening() {
  listenSettings(applySettingsUI);
  switchDate(new Date());           // por defecto, hoy
}

function renderOrders() {
  let list = allOrders;
  if (filterMode === "active") {
    list = allOrders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "ready");
  } else if (filterMode === "ready") {
    list = allOrders.filter((o) => o.status === "ready");
  } else if (filterMode === "picked_up") {
    list = allOrders.filter((o) => o.status === "picked_up");
  }

  $("#ordersCount").textContent = `${list.length} pedido${list.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    const dayLabel = formatDateLabel(currentDate).toLowerCase();
    let msg;
    if (filterMode === "active") msg = `No hay pedidos en curso ${dayLabel === "hoy" ? "ahora mismo" : dayLabel}.`;
    else if (filterMode === "ready") msg = `No hay pedidos listos ${dayLabel === "hoy" ? "ahora mismo" : dayLabel}.`;
    else if (filterMode === "picked_up") msg = `No hay pedidos recogidos ${dayLabel === "hoy" ? "todavía" : dayLabel}.`;
    else msg = `No hay pedidos ${dayLabel === "hoy" ? "todavía hoy" : "este día"}.`;
    $("#ordersList").innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }

  $("#ordersList").innerHTML = list.map(renderOrder).join("");

  // Eventos para los botones de cambio de estado
  $$('[data-status-action]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.orderId;
      const next = btn.dataset.statusAction;
      btn.disabled = true;
      await updateOrderStatus(orderId, next);

      // Al CONFIRMAR el pedido (pending → preparing): avisar al cliente.
      // TODO: cuando esté configurado Twilio, esto se moverá a una Cloud
      // Function que dispara el SMS de forma automática (sin intervención).
      // Mientras tanto: abrimos WhatsApp con el mensaje prefab y el admin
      // solo tiene que pulsar enviar.
      if (next === "preparing") {
        const order = allOrders.find((o) => o.id === orderId);
        if (order) openWhatsAppConfirmation(order);
      }
    });
  });
}

// ─── Mensajes para el cliente vía WhatsApp ────────────────────
function buildPhoneE164(raw) {
  // Limpia el teléfono dejando solo dígitos para wa.me
  return raw.replace(/[^\d]/g, "");
}

function openWhatsAppConfirmation(o) {
  const phone = buildPhoneE164(o.customer.phone);
  const pickup = o.pickupTime?.toDate ? o.pickupTime.toDate() : new Date(o.pickupTime);
  const pickupStr = `${String(pickup.getHours()).padStart(2,"0")}:${String(pickup.getMinutes()).padStart(2,"0")}`;
  const minsLeft = Math.max(1, Math.round((pickup.getTime() - Date.now()) / 60_000));
  const when = o.scheduled
    ? `Te lo tenemos listo a las ${pickupStr}`
    : `Te lo tenemos listo en unos ${minsLeft} minutos`;
  const text = `Hola ${o.customer.name}, hemos confirmado tu pedido ${o.number} en Gula 🍣\n\n${when}. Te avisaremos cuando esté listo para recoger.`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

function renderOrder(o) {
  const pickup = o.pickupTime?.toDate ? o.pickupTime.toDate() : new Date(o.pickupTime);
  const created = o.createdAt?.toDate ? o.createdAt.toDate() : null;
  const pickupStr = pickup ? `${String(pickup.getHours()).padStart(2,"0")}:${String(pickup.getMinutes()).padStart(2,"0")}` : "—";
  const createdStr = created ? `${String(created.getHours()).padStart(2,"0")}:${String(created.getMinutes()).padStart(2,"0")}` : null;
  const minsToPickup = pickup ? Math.round((pickup.getTime() - Date.now()) / 60000) : null;

  const itemsHtml = o.items.map((it) => `
    <span class="order__item"><span class="q">${it.qty}×</span> ${it.name}</span>
  `).join("");

  const actions = nextActions(o);

  return `
    <article class="order is-${o.status}">
      <div class="order__top">
        <span class="order__number">${o.number}</span>
        ${createdStr ? `<span class="order__created">creado a las ${createdStr}</span>` : ""}
        <span class="order__name">${o.customer.name}</span>
        <span class="order__phone"><a href="tel:${o.customer.phone}">${o.customer.phone}</a></span>
        <div class="order__time">
          <small>${o.scheduled ? "Recogida programada" : "Lo antes posible"}</small>
          <strong>${pickupStr}</strong>
          <small>${minsToPickup !== null ? (minsToPickup >= 0 ? `en ${minsToPickup} min` : `hace ${-minsToPickup} min`) : ""}</small>
        </div>
      </div>
      <div class="order__items">${itemsHtml}</div>
      ${o.notes ? `<div class="order__notes">📝 ${o.notes}</div>` : ""}
      <div class="order__bottom">
        <span class="order__total">${formatEUR(o.total)}</span>
        <div class="order__actions">${actions}</div>
      </div>
    </article>
  `;
}

function nextActions(o) {
  const wa = `https://wa.me/${o.customer.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Hola ${o.customer.name}, tu pedido ${o.number} de Gula ya está listo para recoger 🍣`)}`;
  switch (o.status) {
    case "pending":
      return `
        <button class="action-btn action-btn--primary" data-status-action="preparing" data-order-id="${o.id}">Confirmar y avisar</button>
        <button class="action-btn action-btn--danger" data-status-action="cancelled" data-order-id="${o.id}">Cancelar</button>
      `;
    case "preparing":
      return `
        <button class="action-btn action-btn--primary" data-status-action="ready" data-order-id="${o.id}">Marcar como listo</button>
      `;
    case "ready":
      return `
        <a class="action-btn action-btn--ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp aviso</a>
        <button class="action-btn action-btn--primary" data-status-action="picked_up" data-order-id="${o.id}">Recogido</button>
      `;
    case "picked_up":
      return `<span style="font-size:.7rem;color:var(--paper-mute);letter-spacing:.26em;text-transform:uppercase">✓ Recogido</span>`;
    case "cancelled":
      return `<span style="font-size:.7rem;color:var(--claret);letter-spacing:.26em;text-transform:uppercase">✕ Cancelado</span>`;
    default:
      return "";
  }
}

// Actualizar los "en X min" cada minuto sin tocar el DOM completo
setInterval(() => {
  if ($("#dashView").style.display === "block" && allOrders.length) renderOrders();
}, 60_000);


// ─── Modal: disponibilidad de platos ──────────────────────────
function getDisabledSet() {
  return new Set(Array.isArray(currentSettings.disabledDishes) ? currentSettings.disabledDishes : []);
}

function renderDishesModalBody() {
  const disabled = getDisabledSet();
  const body = $("#dishesModalBody");
  const groups = CATEGORIES.map((cat) => {
    const dishes = MENU.filter((d) => d.cat === cat.key);
    if (!dishes.length) return "";
    const rows = dishes.map((d) => {
      const isOff = disabled.has(d.id);
      const photo = d.photo
        ? `<img class="dish-row__photo" src="${d.photo}" alt="" loading="lazy" />`
        : `<span class="dish-row__photo" aria-hidden="true"></span>`;
      return `
        <div class="dish-row ${isOff ? "is-off" : "is-on"}" data-dish-id="${d.id}">
          ${photo}
          <div class="dish-row__info">
            <div class="dish-row__name">${d.name}</div>
            <div class="dish-row__meta">
              ${d.pieces ? `<span>${d.pieces}</span>` : ""}
              <span class="dish-row__price">${formatEUR(d.price)}</span>
            </div>
          </div>
          <div class="dish-row__switch" role="switch" aria-checked="${!isOff}" aria-label="Disponible"></div>
        </div>
      `;
    }).join("");
    return `
      <section class="dishes-modal__section">
        <div class="dishes-modal__section-title">
          <span class="kanji">${cat.kanji || ""}</span>
          <span class="name">${cat.label}</span>
        </div>
        ${rows}
      </section>
    `;
  }).join("");
  body.innerHTML = groups;

  // Contador al pie
  $("#disabledCount").textContent = disabled.size;
}

async function toggleDish(id) {
  const disabled = getDisabledSet();
  if (disabled.has(id)) disabled.delete(id);
  else disabled.add(id);
  // Optimistic UI: actualiza la fila inmediatamente
  const row = document.querySelector(`.dish-row[data-dish-id="${id}"]`);
  if (row) {
    const isOff = disabled.has(id);
    row.classList.toggle("is-off", isOff);
    row.classList.toggle("is-on", !isOff);
    row.querySelector(".dish-row__switch")?.setAttribute("aria-checked", String(!isOff));
  }
  $("#disabledCount").textContent = disabled.size;
  await updateSettings({ disabledDishes: Array.from(disabled) });
}

$("#openDishesBtn").addEventListener("click", () => {
  renderDishesModalBody();
  $("#dishesModal").classList.add("is-open");
  document.body.style.overflow = "hidden";
});
function closeDishesModal() {
  $("#dishesModal").classList.remove("is-open");
  document.body.style.overflow = "";
}
$("#closeDishesBtn").addEventListener("click", closeDishesModal);
$("#dishesModal").addEventListener("click", (e) => {
  if (e.target === $("#dishesModal")) closeDishesModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#dishesModal").classList.contains("is-open")) closeDishesModal();
});

// Delegación: tap en cualquier parte de la fila (o el switch) para alternar
$("#dishesModalBody").addEventListener("click", (e) => {
  const row = e.target.closest(".dish-row");
  if (!row) return;
  const id = row.dataset.dishId;
  if (id) toggleDish(id);
});

$("#allOnBtn").addEventListener("click", async () => {
  if (!getDisabledSet().size) return;
  await updateSettings({ disabledDishes: [] });
});
