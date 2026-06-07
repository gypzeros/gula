// Configuración de Firebase (proyecto: gularestaurante-c45ff)
// Compartido entre pedidos.html y admin.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXy5Sj3T1H-XdWuQZUW9CqIyvw1W9XzpE",
  authDomain: "gularestaurante-c45ff.firebaseapp.com",
  projectId: "gularestaurante-c45ff",
  storageBucket: "gularestaurante-c45ff.firebasestorage.app",
  messagingSenderId: "399237409228",
  appId: "1:399237409228:web:adaa7afdc3a41151df9569",
  measurementId: "G-CKNGG9DM7S",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Re-export helpers para no tener que importar desde gstatic en cada archivo
export {
  doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where, orderBy,
  updateDoc, serverTimestamp, Timestamp, runTransaction,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
};
