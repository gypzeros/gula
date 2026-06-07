// Capa de datos: envuelve Firestore + Auth.
// Modelo:
//   settings/main   → { enabled: bool, prepMinutes: number, pausedMessage: string }
//   orders/{id}     → { number, customer:{name,phone}, items:[…], total,
//                       pickupTime, scheduled, status, createdAt, notes }
//   counters/orders → { value: number }   (para generar números legibles G-001…)

import {
  db, auth,
  doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where, orderBy,
  updateDoc, serverTimestamp, Timestamp, runTransaction,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "./firebase-config.js";

const SETTINGS_REF = doc(db, "settings", "main");
const COUNTER_REF  = doc(db, "counters", "orders");
const ORDERS_REF   = collection(db, "orders");


// ─── Settings ───────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  enabled: true,
  prepMinutes: 30,
  pausedMessage: "Ahora estamos muy ocupados y no es posible realizar pedidos para recoger. Vuelve a probar más tarde.",
  openFrom: "13:30",
  openTo:   "23:30",
};

export async function ensureSettingsExist() {
  const snap = await getDoc(SETTINGS_REF);
  if (!snap.exists()) {
    await setDoc(SETTINGS_REF, { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
  }
}

export function listenSettings(cb) {
  return onSnapshot(SETTINGS_REF, (snap) => {
    cb(snap.exists() ? snap.data() : DEFAULT_SETTINGS);
  });
}

export async function updateSettings(patch) {
  await setDoc(SETTINGS_REF, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}


// ─── Order numbering ────────────────────────────────────────────
async function nextOrderNumber() {
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER_REF);
    const current = snap.exists() ? (snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(COUNTER_REF, { value: next }, { merge: true });
    return next;
  });
}

const formatOrderNumber = (n) => `G-${String(n).padStart(3, "0")}`;


// ─── Orders (cliente) ───────────────────────────────────────────
export async function createOrder({ customer, items, total, pickupTime, scheduled, notes }) {
  const number = await nextOrderNumber();
  const payload = {
    number: formatOrderNumber(number),
    customer,
    items,
    total,
    pickupTime: Timestamp.fromDate(pickupTime),
    scheduled,
    notes: notes || "",
    status: "pending",
    createdAt: serverTimestamp(),
    // La Cloud Function escribe timestamps al mandar cada email:
    // mailSent.customerReceived / customerConfirmed / customerReady / adminNew
    mailSent: {},
  };
  const ref = await addDoc(ORDERS_REF, payload);
  return { id: ref.id, ...payload };
}


// ─── Orders (admin) ─────────────────────────────────────────────
export function listenTodayOrders(cb) {
  return listenOrdersForDay(new Date(), cb);
}

// Escucha pedidos de un día concreto (de las 00:00 a las 23:59:59).
// Devuelve la función para cancelar la suscripción.
export function listenOrdersForDay(date, cb) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const q = query(
    ORDERS_REF,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(orders);
  });
}

export async function updateOrderStatus(orderId, status) {
  const ref = doc(db, "orders", orderId);
  const patch = { status };
  if (status === "ready") patch.readyAt = serverTimestamp();
  if (status === "picked_up") patch.pickedUpAt = serverTimestamp();
  await updateDoc(ref, patch);
}


// ─── Auth (admin) ───────────────────────────────────────────────
export async function adminSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function adminSignOut() {
  return await signOut(auth);
}

export function onAdminAuthChange(cb) {
  return onAuthStateChanged(auth, (user) => cb(user));
}
