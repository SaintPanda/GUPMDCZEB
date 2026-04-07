// ═══════════════════════════════════════════════════════════
//  firebase.js  —  Firebase init + all Firestore CRUD
// ═══════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc,
  getDocs, setDoc, deleteDoc, onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAWp5hUEci0s2fkgDopVCgFrDnIA7-veuI",
  authDomain:        "gupmdczeb.firebaseapp.com",
  projectId:         "gupmdczeb",
  storageBucket:     "gupmdczeb.firebasestorage.app",
  messagingSenderId: "857129519260",
  appId:             "1:857129519260:web:2240f464c9b1e48da18559"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = 'nodes';   // Firestore collection name

// ── In-memory node store (synced from Firestore) ──────────
export let nodes = [];

// ── Callbacks registered by app.js ───────────────────────
let onDataChange = () => {};
export function onNodes(cb) { onDataChange = cb; }

// ── Start real-time listener ──────────────────────────────
export function startSync() {
  return onSnapshot(collection(db, COL), snap => {
    nodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ensure arrays exist
    nodes.forEach(n => {
      if (!Array.isArray(n.children))  n.children  = [];
      if (!Array.isArray(n.keywords))  n.keywords  = [];
    });
    onDataChange(nodes);
  }, err => {
    console.error('Firestore sync error:', err);
  });
}

// ── Seed default data if Firestore is empty ───────────────
export async function seedIfEmpty() {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return;

  const defaults = [
    { id:'root', name:'Головна',    content:'<p>Центральний вузол системи знань. Подвійний клік для занурення.</p>', image:'', color:'#c0c0be', parentId:null,   children:['n1','n2','n3','n4'], keywords:[] },
    { id:'n1',   name:'Ідеї',       content:'<p>Місце для ваших ідей та концепцій.</p>',                             image:'', color:'#cacac8', parentId:'root', children:['n1a','n1b'],          keywords:[] },
    { id:'n2',   name:'Проєкти',    content:'<p>Поточні та заплановані проєкти.</p>',                                image:'', color:'#c4c4c2', parentId:'root', children:['n2a','n2b'],          keywords:[] },
    { id:'n3',   name:'Натхнення',  content:'<p>Джерела натхнення та референси.</p>',                               image:'', color:'#bebebe', parentId:'root', children:['n3a'],               keywords:[] },
    { id:'n4',   name:'Архів',      content:'<p>Архівні матеріали та нотатки.</p>',                                 image:'', color:'#b8b8b6', parentId:'root', children:[],                    keywords:[] },
    { id:'n1a',  name:'Концепт А',  content:'<p>Деталі концепту.</p>',                                              image:'', color:'#d0d0ce', parentId:'n1',   children:[],                    keywords:[] },
    { id:'n1b',  name:'Концепт Б',  content:'<p>Другий концепт.</p>',                                               image:'', color:'#ccccca', parentId:'n1',   children:[],                    keywords:[] },
    { id:'n2a',  name:'Проєкт X',   content:'<p>Деталі проєкту X.</p>',                                             image:'', color:'#c8c8c6', parentId:'n2',   children:[],                    keywords:[] },
    { id:'n2b',  name:'Проєкт Y',   content:'<p>Деталі проєкту Y.</p>',                                             image:'', color:'#c4c4c2', parentId:'n2',   children:[],                    keywords:[] },
    { id:'n3a',  name:'Референс 1', content:'<p>Перший референс.</p>',                                              image:'', color:'#c0c0be', parentId:'n3',   children:[],                    keywords:[] },
  ];

  const batch = writeBatch(db);
  defaults.forEach(n => {
    const { id, ...data } = n;
    batch.set(doc(db, COL, id), data);
  });
  await batch.commit();
}

// ── CRUD helpers ──────────────────────────────────────────

/** Save (create or update) a single node */
export async function saveNode(node) {
  const { id, ...data } = node;
  await setDoc(doc(db, COL, id), data);
  showSaved();
}

/** Save multiple nodes atomically (e.g. when adding child updates parent) */
export async function saveNodes(nodeArr) {
  const batch = writeBatch(db);
  nodeArr.forEach(n => {
    const { id, ...data } = n;
    batch.set(doc(db, COL, id), data);
  });
  await batch.commit();
  showSaved();
}

/** Delete a node (caller must also delete children recursively) */
export async function deleteNodeDoc(id) {
  await deleteDoc(doc(db, COL, id));
}

/** Delete multiple nodes atomically */
export async function deleteNodes(ids) {
  const batch = writeBatch(db);
  ids.forEach(id => batch.delete(doc(db, COL, id)));
  await batch.commit();
  showSaved();
}

// ── Save flash indicator ──────────────────────────────────
let saveTimer = null;
function showSaved() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.textContent = '✓ збережено';
  el.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
