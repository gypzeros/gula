// Lógica del cliente: render del menú, carrito, modal de checkout y creación de pedido en Firestore

import { MENU, CATEGORIES, MENU_BY_ID, formatEUR } from "./menu-data.js";
import { listenSettings, createOrder, ensureSettingsExist } from "./order-store.js";

// ─── Estado en memoria ─────────────────────────────────────────
const cart = new Map();     // id → qty
let settings = { enabled: true, prepMinutes: 30, pausedMessage: "" };

// ─── DOM helpers ───────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ─── Render menú ──────────────────────────────────────────────
function renderMenu() {
  const menuEl = $("#menu");
  menuEl.innerHTML = "";
  for (const cat of CATEGORIES) {
    const dishes = MENU.filter((d) => d.cat === cat.key);
    const section = document.createElement("section");
    section.className = "section";
    section.id = `cat-${cat.key}`;
    section.innerHTML = `
      <div class="section__head">
        <span class="section__num">${cat.kanji[0]}</span>
        <h2 class="section__name">${cat.label}</h2>
        <span class="section__jp">${cat.kanji}</span>
      </div>
      <div class="dishes">
        ${dishes.map(renderDish).join("")}
      </div>
    `;
    menuEl.appendChild(section);
  }
}

function renderDish(d) {
  return `
    <article class="dish" data-dish="${d.id}">
      <img class="dish__photo" src="${d.photo}" alt="${d.name}" loading="lazy" />
      <div class="dish__body">
        <h3 class="dish__name">${d.name}</h3>
        <p class="dish__desc">${d.desc}</p>
        <div class="dish__meta">
          ${d.pieces ? `<span>${d.pieces}</span>` : ""}
          <span class="dish__price">${formatEUR(d.price)}</span>
        </div>
      </div>
      <div class="dish__qty">
        <div class="qty" data-qty="${d.id}" style="display:none;">
          <button class="qty__btn" data-action="dec" aria-label="Quitar uno">−</button>
          <span class="qty__count">0</span>
          <button class="qty__btn" data-action="inc" aria-label="Añadir uno">+</button>
        </div>
        <button class="qty__add" data-action="add" data-dish="${d.id}">Añadir</button>
      </div>
    </article>
  `;
}

// ─── Carrito ──────────────────────────────────────────────────
function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  updateCartUI();
}
function setQty(id, qty) {
  if (qty <= 0) cart.delete(id);
  else cart.set(id, qty);
  updateCartUI();
}

function updateCartUI() {
  const totalQty = [...cart.values()].reduce((a, b) => a + b, 0);
  const total = [...cart.entries()].reduce((sum, [id, q]) => sum + MENU_BY_ID[id].price * q, 0);

  // ── barra flotante (móvil) ──────────────────────────────
  $("#cartCount").textContent = totalQty;
  $("#cartTotal").textContent = formatEUR(total);
  $("#cartBar").classList.toggle("is-visible", totalQty > 0 && settings.enabled);

  // ── sidebar lateral (desktop) ───────────────────────────
  const sideCount = $("#cartSideCount");
  const sideEmpty = $("#cartSideEmpty");
  const sideList  = $("#cartSideList");
  const sideFooter = $("#cartSideFooter");
  const sideTotal  = $("#cartSideTotal");
  const sideCta    = $("#openCheckoutSide");

  if (sideCount) {
    sideCount.textContent = `${totalQty} plato${totalQty === 1 ? "" : "s"}`;

    if (cart.size === 0) {
      sideEmpty.style.display = "block";
      sideList.innerHTML = "";
      sideFooter.style.display = "none";
    } else {
      sideEmpty.style.display = "none";
      sideList.innerHTML = [...cart.entries()].map(([id, q]) => {
        const d = MENU_BY_ID[id];
        return `
          <li class="cart-side__item" data-dish="${id}">
            <div class="cart-side__item-row">
              <span class="cart-side__item-name">${d.name}</span>
              <span class="cart-side__item-line">${formatEUR(d.price * q)}</span>
            </div>
            <div class="cart-side__item-actions">
              <button data-action="dec" aria-label="Quitar uno">−</button>
              <span>${q}</span>
              <button data-action="inc" aria-label="Añadir uno">+</button>
              <button class="cart-side__item-remove" data-action="remove" aria-label="Eliminar del pedido" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </li>
        `;
      }).join("");
      sideFooter.style.display = "block";
      sideTotal.textContent = formatEUR(total);
      sideCta.disabled = !settings.enabled;
    }
  }

  // ── refresca cada dish (botón añadir / contador) ────────
  $$(".dish").forEach((el) => {
    const id = el.dataset.dish;
    const qty = cart.get(id) || 0;
    el.classList.toggle("is-in-cart", qty > 0);
    const qtyEl = el.querySelector(".qty");
    const addEl = el.querySelector(".qty__add");
    const dec = el.querySelector('[data-action="dec"]');
    if (qty > 0) {
      qtyEl.style.display = "flex";
      addEl.style.display = "none";
      qtyEl.querySelector(".qty__count").textContent = qty;
      dec.disabled = false;
    } else {
      qtyEl.style.display = "none";
      addEl.style.display = "inline-block";
    }
  });
}

// Delegación de eventos sobre dishes y sidebar
document.addEventListener("click", (e) => {
  const action = e.target.dataset?.action;
  if (!action) return;
  const container = e.target.closest("[data-dish]");
  if (!container) return;
  const id = container.dataset.dish;
  const current = cart.get(id) || 0;
  if (action === "add" || action === "inc") setQty(id, current + 1);
  else if (action === "dec") setQty(id, current - 1);
  else if (action === "remove") setQty(id, 0);
});


// ─── Tabs (integradas en el nav) ──────────────────────────────
$$(".nav__tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = $(`#cat-${btn.dataset.tab}`);
    if (!target) return;
    const navH = document.querySelector(".nav")?.offsetHeight || 72;
    window.scrollTo({ top: target.offsetTop - navH - 12, behavior: "smooth" });
  });
});

// Auto-active tab según scroll
const sections = CATEGORIES.map((c) => ({ key: c.key, el: null }));
function refreshActiveTab() {
  const y = window.scrollY + 160;
  let current = "sushi";
  for (const s of sections) {
    if (!s.el) s.el = $(`#cat-${s.key}`);
    if (s.el && s.el.offsetTop <= y) current = s.key;
  }
  $$(".nav__tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === current));
}
window.addEventListener("scroll", refreshActiveTab, { passive: true });


// ─── Helpers horario ──────────────────────────────────────────
const DEFAULT_FROM = "13:30";
const DEFAULT_TO   = "23:30";

function getFrom(s) { return s.openFrom || DEFAULT_FROM; }
function getTo(s)   { return s.openTo   || DEFAULT_TO; }

// Convierte "HH:MM" a Date de hoy
function timeStringToToday(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function isWithinHours(s) {
  const now = new Date();
  return now >= timeStringToToday(getFrom(s)) && now <= timeStringToToday(getTo(s));
}

// Genera horas válidas para programar de 15 en 15 min
function generateTimeSlots(s) {
  const fromMs = timeStringToToday(getFrom(s)).getTime();
  const toMs   = timeStringToToday(getTo(s)).getTime();
  // La primera hora válida es: max(ahora + prep, openFrom) redondeado hacia arriba a 15 min
  let earliest = Date.now() + (s.prepMinutes || 30) * 60_000;
  if (earliest < fromMs) earliest = fromMs;
  const d = new Date(earliest);
  const rem = d.getMinutes() % 15;
  if (rem !== 0) d.setMinutes(d.getMinutes() + (15 - rem), 0, 0);
  let cursor = d.getTime();
  const slots = [];
  while (cursor <= toMs) {
    const dd = new Date(cursor);
    slots.push(`${String(dd.getHours()).padStart(2,"0")}:${String(dd.getMinutes()).padStart(2,"0")}`);
    cursor += 15 * 60_000;
  }
  return slots;
}

function refreshScheduledTimeSelect() {
  const sel = $("#scheduledTime");
  if (!sel) return;
  const slots = generateTimeSlots(settings);
  if (slots.length === 0) {
    sel.innerHTML = `<option disabled selected>Sin horas disponibles hoy</option>`;
    sel.disabled = true;
  } else {
    const previous = sel.value;
    sel.innerHTML = slots.map(t => `<option value="${t}">${t}</option>`).join("");
    sel.disabled = false;
    if (previous && slots.includes(previous)) sel.value = previous;
  }
}


// ─── Settings (status banner) ─────────────────────────────────
function applySettings(s) {
  settings = s;
  const card = $("#statusCard");
  const label = $("#statusLabel");
  const main  = $("#statusMain");
  const asapTime = $("#asapTime");

  const withinHours = isWithinHours(s);
  const isOpen = s.enabled && withinHours;

  // Marca el <body> para que el CSS oculte/muestre la carta
  document.body.classList.toggle("is-closed", !isOpen);

  if (isOpen) {
    card.classList.remove("is-closed");
    label.textContent = "Aceptando pedidos";
    main.innerHTML = `Tu pedido estará listo en unos <strong>${s.prepMinutes} min</strong> aproximadamente.`;
    if (asapTime) asapTime.textContent = `~ en ${s.prepMinutes} min`;
    $("#openCheckout").disabled = false;
  } else if (!s.enabled) {
    card.classList.add("is-closed");
    label.textContent = "Cerrado temporalmente";
    main.textContent = s.pausedMessage || "Ahora estamos muy ocupados y no es posible realizar pedidos para recoger.";
    $("#openCheckout").disabled = true;
  } else {
    // toggle ON pero fuera de horario
    card.classList.add("is-closed");
    label.textContent = "Fuera de horario";
    main.innerHTML = `Aceptamos pedidos hoy de <strong>${getFrom(s)}</strong> a <strong>${getTo(s)}</strong>.`;
    $("#openCheckout").disabled = true;
  }
  refreshScheduledTimeSelect();
  updateCartUI();
}

// Cada minuto recheckea por si pasamos a estar dentro/fuera de horario
setInterval(() => applySettings(settings), 60_000);


// ─── Modal de checkout ────────────────────────────────────────
function openCheckout() {
  if (!settings.enabled) return;
  if (cart.size === 0) return;
  renderSummary();
  $("#checkoutForm").style.display = "block";
  $("#confirmView").style.display = "none";
  $("#checkoutModal").classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  $("#checkoutModal").classList.remove("is-open");
  document.body.style.overflow = "";
}

function renderSummary() {
  const html = [...cart.entries()].map(([id, q]) => {
    const d = MENU_BY_ID[id];
    return `
      <div class="summary__row">
        <span class="qty">${q}×</span>
        <span class="name">${d.name}</span>
        <span class="price">${formatEUR(d.price * q)}</span>
      </div>
    `;
  }).join("");

  const total = [...cart.entries()].reduce((s, [id, q]) => s + MENU_BY_ID[id].price * q, 0);

  $("#orderSummary").innerHTML = html + `
    <div class="summary__total">
      <span class="label">Total</span>
      <span class="value">${formatEUR(total)}</span>
    </div>
  `;
}

$("#openCheckout").addEventListener("click", openCheckout);
$("#openCheckoutSide")?.addEventListener("click", openCheckout);
$$('[data-close-modal]').forEach((b) => b.addEventListener("click", closeCheckout));
$("#checkoutModal").addEventListener("click", (e) => {
  if (e.target.id === "checkoutModal") closeCheckout();
});


// ─── Time picker (asap vs scheduled) ──────────────────────────
let timeMode = "asap";
$$(".time-options__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    timeMode = btn.dataset.time;
    $$(".time-options__btn").forEach((b) => b.classList.toggle("is-active", b === btn));
    if (timeMode === "scheduled") {
      $("#scheduledTime").style.display = "block";
      refreshScheduledTimeSelect();
    } else {
      $("#scheduledTime").style.display = "none";
    }
  });
});


// ─── Submit ───────────────────────────────────────────────────
$("#submitOrder").addEventListener("click", async () => {
  const name = $("#customerName").value.trim();
  const phone = $("#customerPhone").value.trim();
  const notes = $("#customerNotes").value.trim();

  if (!name || !phone) {
    alert("Por favor, escribe tu nombre y teléfono.");
    return;
  }
  if (!/^[\+\d\s\-]{9,}$/.test(phone)) {
    alert("El teléfono no parece válido. Pónlo con prefijo +34.");
    return;
  }

  let pickupTime;
  if (timeMode === "asap") {
    pickupTime = new Date(Date.now() + settings.prepMinutes * 60 * 1000);
    const toMs = timeStringToToday(getTo(settings)).getTime();
    if (pickupTime.getTime() > toMs) {
      alert("No queda tiempo para prepararlo antes del cierre. Programa para mañana o elige otra hora.");
      return;
    }
  } else {
    const v = $("#scheduledTime").value;
    if (!v) { alert("Elige una hora para recoger."); return; }
    const [hh, mm] = v.split(":").map(Number);
    pickupTime = new Date();
    pickupTime.setHours(hh, mm, 0, 0);
    if (pickupTime.getTime() < Date.now()) {
      alert("La hora elegida ya pasó. Elige otra.");
      return;
    }
    // Comprobación rápida — el select ya solo muestra horas válidas pero por si acaso
    const fromMs = timeStringToToday(getFrom(settings)).getTime();
    const toMs   = timeStringToToday(getTo(settings)).getTime();
    if (pickupTime.getTime() < fromMs || pickupTime.getTime() > toMs) {
      alert(`Solo aceptamos pedidos para recoger entre ${getFrom(settings)} y ${getTo(settings)}.`);
      return;
    }
  }

  const items = [...cart.entries()].map(([id, qty]) => {
    const d = MENU_BY_ID[id];
    return { id, name: d.name, price: d.price, qty };
  });
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);

  const btn = $("#submitOrder");
  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    const order = await createOrder({
      customer: { name, phone },
      items,
      total,
      pickupTime,
      scheduled: timeMode === "scheduled",
      notes,
    });
    showConfirmation(order);
    cart.clear();
    updateCartUI();
  } catch (err) {
    console.error(err);
    alert("Algo ha ido mal. Inténtalo de nuevo o llámanos al 667 09 98 28.");
    btn.disabled = false;
    btn.textContent = "Confirmar pedido";
  }
});

function showConfirmation(order) {
  $("#confirmName").textContent = order.customer.name;
  $("#confirmNumber").textContent = order.number;
  const t = order.pickupTime.toDate ? order.pickupTime.toDate() : order.pickupTime;
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  $("#confirmPickup").textContent = `a las ${hh}:${mm}`;
  $("#checkoutForm").style.display = "none";
  $("#confirmView").style.display = "block";
  // permite cerrar al hacer clic fuera o en la X
  $("#submitOrder").disabled = false;
  $("#submitOrder").textContent = "Confirmar pedido";
}


// ─── Init ─────────────────────────────────────────────────────
(async function init() {
  renderMenu();
  refreshActiveTab();
  await ensureSettingsExist();
  listenSettings((s) => {
    applySettings(s);
    $("#loading").classList.add("is-hidden");
  });
})();
