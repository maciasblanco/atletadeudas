/* ============================================================
   db.js — Manejo de SQLite e IndexedDB
   ============================================================ */
import { state } from './state.js';

/* ---------- IndexedDB ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(state.IDB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(state.IDB_STORE)) {
        r.result.createObjectStore(state.IDB_STORE);
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function idbGet(key) {
  const idb = await idbOpen();
  return new Promise((res, rej) => {
    const tx = idb.transaction(state.IDB_STORE, 'readonly');
    const rq = tx.objectStore(state.IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function idbSet(key, val) {
  const idb = await idbOpen();
  return new Promise((res, rej) => {
    const tx = idb.transaction(state.IDB_STORE, 'readwrite');
    const rq = tx.objectStore(state.IDB_STORE).put(val, key);
    rq.onsuccess = () => res();
    rq.onerror = () => rej(rq.error);
  });
}

/* ---------- Helpers de SQLite ---------- */
export function one(sql, params = []) {
  const r = state.db.exec(sql, params);
  if (!r.length || !r[0].values.length) return null;
  const cols = r[0].columns;
  return Object.fromEntries(cols.map((c, i) => [c, r[0].values[0][i]]));
}

export function all(sql, params = []) {
  const r = state.db.exec(sql, params);
  if (!r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
}

export function getConfig(clave, def = null) {
  const r = one('SELECT valor FROM config WHERE clave=?', [clave]);
  return r ? r.valor : def;
}

export function setConfig(clave, valor) {
  state.db.run('INSERT INTO config(clave,valor) VALUES(?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor',
    [clave, String(valor)]);
}

export async function guardarBDEnIDB() {
  if (!state.db) return;
  const data = state.db.export();
  await idbSet(state.IDB_KEY, data);
}