/* ============================================================
   state.js — Estado global compartido
   ============================================================ */

export const state = {
  db: null,
  SQL: null,
  usuarioActual: null,
  GH_RAW: '',
  tasaBCVFecha: '',
  SCHEMA_VER: 4,
  IDB_NAME: 'atletadeudas',
  IDB_STORE: 'kv',
  IDB_KEY: 'sqlite_db'
};
