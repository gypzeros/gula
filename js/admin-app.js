// Lógica del panel admin: login, edición de ajustes, gestión de pedidos

import { formatEUR } from "./menu-data.js";
import {
  listenSettings, updateSettings, ensureSettingsExist,
  listenTodayOrders, updateOrderStatus,
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
let filterMode = "active";   // active | all | ready | picked_up

$$(".filter").forEach((b) => {
  b.addEventListener("click", () => {
    filterMode = b.dataset.filter;
    $$(".filter").forEach((x) => x.classList.toggle("is-active", x === b));
    renderOrders();
  });
});

function startListening() {
  listenSettings(applySettingsUI);
  listenTodayOrders((orders) => {
    allOrders = orders;
    renderOrders();
  });
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
    $("#ordersList").innerHTML = `<div class="empty">No hay pedidos ${filterMode === "active" ? "en curso" : ""} ahora mismo.</div>`;
    return;
  }

  $("#ordersList").innerHTML = list.map(renderOrder).join("");

  // Eventos para los botones
  $$('[data-status-action]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.orderId;
      const next = btn.dataset.statusAction;
      btn.disabled = true;
      await updateOrderStatus(orderId, next);
    });
  });
}

function renderOrder(o) {
  const pickup = o.pickupTime?.toDate ? o.pickupTime.toDate() : new Date(o.pickupTime);
  const created = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
  const pickupStr = pickup ? `${String(pickup.getHours()).padStart(2,"0")}:${String(pickup.getMinutes()).padStart(2,"0")}` : "—";
  const minsToPickup = pickup ? Math.round((pickup.getTime() - Date.now()) / 60000) : null;

  const itemsHtml = o.items.map((it) => `
    <span class="order__item"><span class="q">${it.qty}×</span> ${it.name}</span>
  `).join("");

  const actions = nextActions(o);

  return `
    <article class="order is-${o.status}">
      <div class="order__top">
        <span class="order__number">${o.number}</span>
        <span class="order__name">${o.customer.name}</span>
        <span class="order__phone"><a href="tel:${o.customer.phone}">${o.customer.phone}</a></span>
        <div class="order__time">
          <small>${o.scheduled ? "Programado" : "Lo antes posible"}</small>
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
        <button class="action-btn action-btn--primary" data-status-action="preparing" data-order-id="${o.id}">Empezar a preparar</button>
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
