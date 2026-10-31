/* ============================================================
   schema.js — Creación de tablas y valores por defecto
   ============================================================ */
import { state } from './state.js';
import { getConfig, setConfig } from './db.js';

export function crearSchema() {
  state.db.run(`CREATE TABLE IF NOT EXISTS representantes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identificacion TEXT UNIQUE NOT NULL,
    nombre TEXT, apellido TEXT, telefono TEXT, email TEXT, parentesco TEXT,
    creado_en TEXT DEFAULT (datetime('now'))
  );`);

  state.db.run(`CREATE TABLE IF NOT EXISTS atletas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identificacion TEXT UNIQUE NOT NULL,
    p_nombre TEXT, s_nombre TEXT, p_apellido TEXT, s_apellido TEXT,
    fn TEXT, categoria TEXT, escuela TEXT, cell TEXT, telf_emergencia1 TEXT,
    representante_id INTEGER,
    clave TEXT,
    deuda REAL DEFAULT 0, activo INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(representante_id) REFERENCES representantes(id)
  );`);

  state.db.run(`CREATE TABLE IF NOT EXISTS metodos_pago(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    activo INTEGER DEFAULT 1
  );`);

  state.db.run(`CREATE TABLE IF NOT EXISTS pagos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atleta_id INTEGER NOT NULL,
    metodo_pago_id INTEGER,
    fecha TEXT NOT NULL,
    fecha_quincena TEXT,
    numero_quincena INTEGER,
    monto REAL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    monto_bs_original REAL DEFAULT 0,
    tasa REAL DEFAULT 0,
    referencia TEXT, banco_origen TEXT, telefono_origen TEXT, observacion TEXT,
    estado TEXT DEFAULT 'pagado',
    pendiente_subir INTEGER DEFAULT 1,
    creado_en TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(atleta_id) REFERENCES atletas(id),
    FOREIGN KEY(metodo_pago_id) REFERENCES metodos_pago(id)
  );`);

  state.db.run(`CREATE TABLE IF NOT EXISTS cargos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atleta_id INTEGER NOT NULL,
    concepto TEXT, monto REAL DEFAULT 0, fecha TEXT,
    creado_en TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(atleta_id) REFERENCES atletas(id)
  );`);

  state.db.run(`CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT);`);

  try {
    const cols = state.db.exec("PRAGMA table_info(atletas)");
    const nombres = cols.length ? cols[0].values.map(v => v[1]) : [];
    if (nombres.length && !nombres.includes('clave')) {
      state.db.run('ALTER TABLE atletas ADD COLUMN clave TEXT');
    }
  } catch (e) { /* noop */ }

  const metodos = [
    ['EFECTIVO', 'Efectivo'], ['PAGO_MOVIL', 'Pago Móvil'],
    ['TRANSFERENCIA', 'Transferencia'], ['ZELLE', 'Zelle'], ['OTRO', 'Otro']
  ];
  for (const [codigo, nombre] of metodos) {
    state.db.run(`INSERT OR IGNORE INTO metodos_pago(codigo,nombre,activo) VALUES(?,?,1)`, [codigo, nombre]);
  }

  const defaults = {
    monto_semanal: '5', monto_periodo: '20', monto_quincena: '5',
    moneda: 'USD',
    clave_admin: 'admin123', clave_generica: '123456',
    cedula_admin: '',                       // NUEVO: vacío = solo se valida clave
    tasa_dolar: '36.50',
    tasa_bcv_fecha: '', tasa_bcv_actualizado: '',
    fecha_corte_quincena: '2026-09-29',
    numero_quincena_inicial: '1',
    schema_version: String(state.SCHEMA_VER),
    github_usuario: 'maciasblanco',
    github_repo: 'atletadeudas',
    github_ruta: 'datos/atletas.json',
    github_rama: 'main',
    github_token: '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', // token_ignore_11AGILBTI0JF7a7ECxUKIO_FwuG3MFkYvt1YASN5XZaibvwXtrbmenzrc0KgFkJ8pBF375T5M7RGU18ARi'
  };
  for (const [k, v] of Object.entries(defaults)) {
    const actual = getConfig(k);
    if (actual === null || actual === '') {
      setConfig(k, v);
    }
  }

  state.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_ref
          ON pagos(atleta_id, metodo_pago_id, IFNULL(referencia,''), fecha)`);

  console.log('✅ Esquema v2 listo (schema_version=4, corte=2026-09-29)');
}