/* ============================================================
   AtletaDeudas — Lógica de la aplicación (app.js)
   ============================================================ */

const IDB_NAME  = 'atletadeudas';
const IDB_STORE = 'kv';
const IDB_KEY   = 'sqlite_db';
const SCHEMA_VER = 4;

let db = null;
let SQL = null;
let usuarioActual = null;
let GH_RAW = '';
let tasaBCVFecha = '';

/* ============================================================
   DETECCIÓN DE PUPPETEER (para no colgar PWABuilder)
   ============================================================ */
const ES_PUPPETEER = navigator.webdriver === true;

function avisar(msg){
  if(ES_PUPPETEER){
    console.log('[PWA/avisar]', msg);
  } else {
    alert(msg);
  }
}
function confirmar(msg){
  if(ES_PUPPETEER){
    console.log('[PWA/confirmar]', msg, '→ auto: true');
    return true;
  }
  return confirm(msg);
}

/* ---------- Utilidades ---------- */
const $ = (id)=>document.getElementById(id);
const hoyISO = ()=> new Date().toISOString().slice(0,10);
const nowISO = ()=> new Date().toISOString();
const fmt = (n)=> (Number(n)||0).toFixed(2);

function normalizarCedula(s){
  return String(s||'').trim().replace(/[.\s]/g,'');
}
function addDias(iso, n){
  const d = new Date(iso+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
function diasEntre(aISO, bISO){
  const a = new Date(aISO+'T00:00:00Z');
  const b = new Date(bISO+'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/* ============================================================
   NUEVA LÓGICA DE QUINCENAS: 15 Y 30 (O ÚLTIMO DÍA DEL MES)
   ============================================================ */
function obtenerQuincenasDelMes(anio, mes) {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return [15, Math.min(30, ultimoDia)]; 
}

function calcularNumeroQuincena(fechaQ){
  const corte = getConfig('fecha_corte_quincena','2026-09-29'); 
  if(!fechaQ || fechaQ < corte) return null;

  const [anioC, mesC, diaC] = corte.split('-').map(Number);
  const [anioF, mesF, diaF] = fechaQ.split('-').map(Number);

  let contador = 0;
  let anio = anioC;
  let mes = mesC - 1; 

  while (true) {
    const quincenas = obtenerQuincenasDelMes(anio, mes);
    for (const qDia of quincenas) {
      const fechaQStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(qDia).padStart(2,'0')}`;
      if (fechaQStr >= corte && fechaQStr <= fechaQ) {
        contador++;
      }
    }
    if (anio === anioF && mes === (mesF - 1)) break;
    mes++;
    if (mes > 11) { mes = 0; anio++; }
  }
  return contador > 0 ? contador : null;
}

function quincenaActualNumero(){
  const hoy = hoyISO();
  const corte = getConfig('fecha_corte_quincena', '2026-09-29'); 
  if(hoy < corte) return 0;

  const [anioC, mesC, diaC] = corte.split('-').map(Number);
  const [anioH, mesH, diaH] = hoy.split('-').map(Number);

  let contador = 0;
  let anio = anioC;
  let mes = mesC - 1;

  while (true) {
    const quincenas = obtenerQuincenasDelMes(anio, mes);
    for (const qDia of quincenas) {
      const fechaQStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(qDia).padStart(2,'0')}`;
      if (fechaQStr >= corte && fechaQStr <= hoy) {
        contador++;
      }
    }
    if (anio === anioH && mes === (mesH - 1)) break;
    mes++;
    if (mes > 11) { mes = 0; anio++; }
  }
  return contador;
}

function fechaQuincenaActual(){
  const hoy = hoyISO();
  const corte = getConfig('fecha_corte_quincena', '2026-09-29'); 
  if(hoy < corte) return corte;

  const [anio, mes] = hoy.split('-').map(Number);
  const quincenas = obtenerQuincenasDelMes(anio, mes - 1);
  for (let i = quincenas.length - 1; i >= 0; i--) {
    const fechaQ = `${anio}-${String(mes).padStart(2,'0')}-${String(quincenas[i]).padStart(2,'0')}`;
    if (fechaQ <= hoy) return fechaQ;
  }

  let mp = mes - 1, ap = anio;
  if (mp < 1) { mp = 12; ap--; }
  const qp = obtenerQuincenasDelMes(ap, mp - 1);
  const ultimo = qp[qp.length - 1];
  const fechaPrev = `${ap}-${String(mp).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`;
  return fechaPrev < corte ? corte : fechaPrev;
}

function showMsg(el, tipo, texto){ if(!el) return; el.className='msg show '+tipo; el.textContent=texto; }
function hideMsg(el){ if(el){ el.className='msg'; el.textContent=''; } }

/* ============================================================
   Mostrar / Ocultar contraseñas (botón ojo)
   ============================================================ */
function wirePasswordToggles(){
  document.querySelectorAll('button[data-toggle-pass]').forEach(btn => {
    if(btn.dataset.passWired === '1') return;
    btn.dataset.passWired = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = $(btn.dataset.togglePass);
      if(!input) return;

      const mostrando = input.type === 'text';
      input.type = mostrando ? 'password' : 'text';
      btn.textContent = mostrando ? '👁' : '🙈';
      btn.setAttribute('aria-label', mostrando ? 'Mostrar clave' : 'Ocultar clave');
      try { input.focus({ preventScroll: true }); } catch(_) { input.focus(); }
    });
  });
}

/* Resetea un toggle de contraseña a su estado oculto */
function resetPassToggle(inputId){
  const input = $(inputId);
  if(input) input.type = 'password';
  const btn = document.querySelector(`button[data-toggle-pass="${inputId}"]`);
  if(btn){
    btn.textContent = '👁';
    btn.setAttribute('aria-label', 'Mostrar clave');
  }
}

/* ============================================================
   TASA BCV AUTOMÁTICA
   ============================================================ */
async function obtenerTasaBCV(){
  try{
    const res = await fetch('https://datos.cromstudio.com.ve/tasa', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const tasa = Number(data?.tasas?.USD);
    if(!tasa || tasa <= 0) throw new Error('Tasa USD inválida en la respuesta');
    return {
      ok: true,
      tasa,
      fecha: data.fecha_valor || '',
      actualizado: data.actualizado_el || ''
    };
  }catch(e){
    console.warn('No se pudo obtener tasa BCV:', e.message);
    return { ok:false, error: e.message };
  }
}

async function actualizarTasaBCV(silencioso = false){
  const msgEl = $('config-msg');
  if(!silencioso) showMsg(msgEl, 'info', 'Consultando BCV…');
  const r = await obtenerTasaBCV();
  if(r.ok){
    setConfig('tasa_dolar', r.tasa);
    setConfig('tasa_bcv_fecha', r.fecha);
    setConfig('tasa_bcv_actualizado', r.actualizado);
    tasaBCVFecha = r.fecha;
    const inp = $('c-tasa-dolar');
    if(inp) inp.value = r.tasa;
    const t = $('tasa');
    if(t) t.value = r.tasa;
    const info = $('tasa-bcv-info');
    if(info) info.textContent = `BCV: ${fmt(r.tasa)} Bs/$ · Vigencia: ${r.fecha || '—'} · Actualizado: ${r.actualizado ? new Date(r.actualizado).toLocaleString('es-VE') : '—'}`;
    guardarBDEnIDB();
    if(!silencioso){
      showMsg(msgEl, 'ok', `✅ Tasa BCV actualizada: ${fmt(r.tasa)} Bs/$ (${r.fecha})`);
      refrescarAdmin();
    }
    return true;
  } else {
    if(!silencioso) showMsg(msgEl, 'err', '❌ No se pudo obtener la tasa BCV: ' + r.error);
    return false;
  }
}

/* ---------- IndexedDB ---------- */
function idbOpen(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = ()=>{ if(!r.result.objectStoreNames.contains(IDB_STORE)) r.result.createObjectStore(IDB_STORE); };
    r.onsuccess = ()=>res(r.result);
    r.onerror   = ()=>rej(r.error);
  });
}
async function idbGet(key){
  const idb = await idbOpen();
  return new Promise((res,rej)=>{
    const tx = idb.transaction(IDB_STORE,'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = ()=>res(rq.result);
    rq.onerror   = ()=>rej(rq.error);
  });
}
async function idbSet(key,val){
  const idb = await idbOpen();
  return new Promise((res,rej)=>{
    const tx = idb.transaction(IDB_STORE,'readwrite');
    const rq = tx.objectStore(IDB_STORE).put(val,key);
    rq.onsuccess = ()=>res();
    rq.onerror   = ()=>rej(rq.error);
  });
}

/* ---------- SQL helpers ---------- */
function one(sql, params=[]){
  const r = db.exec(sql, params);
  if(!r.length || !r[0].values.length) return null;
  const cols = r[0].columns;
  return Object.fromEntries(cols.map((c,i)=>[c, r[0].values[0][i]]));
}
function all(sql, params=[]){
  const r = db.exec(sql, params);
  if(!r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(v=>Object.fromEntries(cols.map((c,i)=>[c, v[i]])));
}
function getConfig(clave, def=null){
  const r = one('SELECT valor FROM config WHERE clave=?', [clave]);
  return r ? r.valor : def;
}
function setConfig(clave, valor){
  db.run('INSERT INTO config(clave,valor) VALUES(?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor',
      [clave, String(valor)]);
}

async function guardarBDEnIDB(){
  if(!db) return;
  const data = db.export();
  await idbSet(IDB_KEY, data);
}

/* ============================================================
   Cálculo de Categoría y Edad — Reglas FVV (Venezuela)
   ------------------------------------------------------------
   SEMILLAS    : 2015 en adelante
   MINI        : 2013 - 2014
   INFANTIL    : 2011 - 2012
   PRE-JUVENIL : 2009 - 2010
   JUVENIL     : 2007 - 2008
   MAYOR       : 2006 y anteriores
   (En Venezuela NO existe la categoría "Cadete")
   ============================================================ */
function calcularCategoriaPorEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";

  const anioNacimiento = parseInt(String(fechaNacimiento).split('-')[0], 10);
  if (!anioNacimiento || isNaN(anioNacimiento)) return "";

  if (anioNacimiento >= 2015) return "SEMILLAS";
  if (anioNacimiento >= 2013) return "MINI";        // 2013 - 2014
  if (anioNacimiento >= 2011) return "INFANTIL";    // 2011 - 2012
  if (anioNacimiento >= 2009) return "PRE-JUVENIL"; // 2009 - 2010
  if (anioNacimiento >= 2007) return "JUVENIL";     // 2007 - 2008
  return "MAYOR";                                   // 2006 y anteriores
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const hoy = new Date();
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return edad;
}

/* ============================================================
   crearSchema() v2
   ============================================================ */
function crearSchema(){
  db.run(`CREATE TABLE IF NOT EXISTS representantes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identificacion TEXT UNIQUE NOT NULL,
    nombre TEXT, apellido TEXT, telefono TEXT, email TEXT, parentesco TEXT,
    creado_en TEXT DEFAULT (datetime('now'))
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS atletas(
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
  db.run(`CREATE TABLE IF NOT EXISTS metodos_pago(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    activo INTEGER DEFAULT 1
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS pagos(
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
  db.run(`CREATE TABLE IF NOT EXISTS cargos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atleta_id INTEGER NOT NULL,
    concepto TEXT, monto REAL DEFAULT 0, fecha TEXT,
    creado_en TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(atleta_id) REFERENCES atletas(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT);`);

  try{
    const cols = db.exec("PRAGMA table_info(atletas)");
    const nombres = cols.length ? cols[0].values.map(v=>v[1]) : [];
    if(nombres.length && !nombres.includes('clave')){
      db.run('ALTER TABLE atletas ADD COLUMN clave TEXT');
    }
  }catch(e){ /* noop */ }

  const metodos = [
    ['EFECTIVO','Efectivo'],['PAGO_MOVIL','Pago Móvil'],
    ['TRANSFERENCIA','Transferencia'],['ZELLE','Zelle'],['OTRO','Otro']
  ];
  for(const [codigo,nombre] of metodos){
    db.run(`INSERT OR IGNORE INTO metodos_pago(codigo,nombre,activo) VALUES(?,?,1)`, [codigo,nombre]);
  }

  const defaults = {
    monto_semanal:'5', monto_periodo:'20', monto_quincena:'5',
    moneda:'USD',
    clave_admin:'admin123', clave_generica:'123456',
    tasa_dolar:'36.50',
    tasa_bcv_fecha:'', tasa_bcv_actualizado:'',
    fecha_corte_quincena:'2026-09-29',
    numero_quincena_inicial:'1',
    schema_version:String(SCHEMA_VER),
    github_usuario:'maciasblanco', 
    github_repo:'atletadeudas', 
    github_ruta:'datos/atletas.json',
    github_rama:'main', 
    github_token:'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' 
  };
  for(const [k,v] of Object.entries(defaults)){
    const actual = getConfig(k);
    if((actual === null || actual === '') && k !== 'github_token'){
      setConfig(k,v);
    }
  }

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_ref
          ON pagos(atleta_id, metodo_pago_id, IFNULL(referencia,''), fecha)`);

  console.log('✅ Esquema v2 listo (schema_version=4, corte=2026-09-29)');
}

/* ============================================================
   Mora y deuda
   ============================================================ */
function calcularMoraAtleta(atletaId){
  const qActual = quincenaActualNumero();
  if(qActual <= 0){
    return { quincena_actual:0, pagadas:0, debidas:0, estado:'sin_inicio' };
  }
  const r = one(
    `SELECT COUNT(DISTINCT numero_quincena) AS n
       FROM pagos
      WHERE atleta_id = ?
        AND estado = 'pagado'
        AND numero_quincena BETWEEN 1 AND ?`,
    [atletaId, qActual]
  );
  const pagadas = r?.n || 0;
  const debidas = Math.max(0, qActual - pagadas);
  let estado = 'ok';
  if(debidas >= 3) estado = 'no_practica';
  else if(debidas > 0) estado = 'mora';
  return { quincena_actual:qActual, pagadas, debidas, estado };
}

function badgeMoraHTML(m, totalBs){
  if(m.estado === 'sin_inicio'){
    return `<span class="badge" style="background:#1e2a45;color:#9aa7c7">Sin iniciar</span>`;
  }
  if(m.estado === 'ok'){
    return `<span class="badge ok">✅ Al día</span>`;
  }
  const extra = (totalBs != null && totalBs > 0) ? ` · ${fmt(totalBs)} Bs` : '';
  if(m.estado === 'mora'){
    return `<span class="badge warn">⚠️ Mora: ${m.debidas}${extra}</span>`;
  }
  return `<span class="badge err">🚫 NO PRACTICA (${m.debidas})${extra}</span>`;
}

function calcularDeudaAtleta(atletaId){
  const m = calcularMoraAtleta(atletaId);
  const montoPeriodo = Number(getConfig('monto_periodo','20')) || 20;
  const montoSemanal = Number(getConfig('monto_semanal','5')) || 5;
  const montoQuincenaUSD = Number(getConfig('monto_quincena', montoPeriodo/4 || montoSemanal*2)) || 5;
  const tasa = Number(getConfig('tasa_dolar','36.50')) || 36.50;
  const debidas = Math.max(0, m.debidas || 0);
  const totalUSD = debidas * montoQuincenaUSD;
  const totalBs  = totalUSD * tasa;
  return {
    ...m,
    monto_quincena_usd: montoQuincenaUSD,
    tasa,
    total_usd: totalUSD,
    total_bs: totalBs
  };
}

function estadoQuincenaAtleta(atletaId, numeroQuincena){
  if(!numeroQuincena) return { tipo:'invalida' };

  const pagada = one(
    `SELECT id, monto, fecha FROM pagos
      WHERE atleta_id=? AND estado='pagado' AND numero_quincena=?`,
    [atletaId, numeroQuincena]
  );
  if(pagada) return { tipo:'pagada', pago_id:pagada.id, monto:pagada.monto, fecha:pagada.fecha };

  const pend = one(
    `SELECT id FROM pagos
      WHERE atleta_id=? AND estado='pendiente' AND numero_quincena=?`,
    [atletaId, numeroQuincena]
  );
  if(pend) return { tipo:'pendiente', pago_id:pend.id };

  const qActual = quincenaActualNumero();
  if(numeroQuincena > qActual) return { tipo:'futura' };
  return { tipo:'debida' };
}

function resumenDeudaAtleta(atletaId){
  const d = calcularDeudaAtleta(atletaId);
  const qActual = quincenaActualNumero();
  const pagadasNums = new Set(
    all(`SELECT numero_quincena FROM pagos
          WHERE atleta_id=? AND estado='pagado'
            AND numero_quincena BETWEEN 1 AND ?`, [atletaId, qActual])
      .map(r => Number(r.numero_quincena))
  );
  const pendientesNums = new Set(
    all(`SELECT numero_quincena FROM pagos
          WHERE atleta_id=? AND estado='pendiente'
            AND numero_quincena BETWEEN 1 AND ?`, [atletaId, qActual])
      .map(r => Number(r.numero_quincena))
  );
  const debidasNums = [];
  for(let i=1; i<=qActual; i++){
    if(!pagadasNums.has(i) && !pendientesNums.has(i)) debidasNums.push(i);
  }
  return {
    ...d,
    quincena_actual: qActual,
    pagadas_nums: [...pagadasNums].sort((a,b)=>a-b),
    pendientes_nums: [...pendientesNums].sort((a,b)=>a-b),
    debidas_nums: debidasNums
  };
}

/* ============================================================
   Render
   ============================================================ */
function mostrarVista(id){
  ['view-loading','view-login','view-atleta','view-admin'].forEach(v=>{
    const el = $(v); if(el) el.classList.toggle('hidden', v!==id);
  });
}

function cargarMetodosEnSelect(){
  const sel = $('metodo_pago_id'); if(!sel) return;
  const rows = all(`SELECT id, nombre FROM metodos_pago WHERE activo=1 ORDER BY nombre`);
  sel.innerHTML = '<option value="">— Seleccione —</option>' +
    rows.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('');
}

function cargarAtletasEnSelectPago(){
  const sel = $('pago_atleta'); if(!sel) return;
  const rows = all(`SELECT id, identificacion, p_nombre, p_apellido
                    FROM atletas WHERE activo=1 ORDER BY p_apellido, p_nombre`);
  sel.innerHTML = '<option value="">— Seleccione —</option>' +
    rows.map(r=>`<option value="${r.id}">${r.p_apellido||''} ${r.p_nombre||''} (${r.identificacion})</option>`).join('');
}

function cargarMetodosEnSelectAtleta(){
  const sel = $('ra-metodo'); if(!sel) return;
  const rows = all(`SELECT id, nombre FROM metodos_pago WHERE activo=1 ORDER BY nombre`);
  sel.innerHTML = '<option value="">— Seleccione —</option>' +
    rows.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('');
}

function renderAtletas(){
  const tb = $('atletas-tbody'); if(!tb) return;
  const filtro = ($('buscar-atleta')?.value||'').trim().toLowerCase();
  let rows = all(`
    SELECT a.id, a.identificacion, a.p_nombre, a.s_nombre, a.p_apellido, a.s_apellido,
           a.categoria, a.deuda, a.fn,
           r.nombre AS rep_nombre, r.apellido AS rep_apellido, r.telefono AS rep_tel
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id
     ORDER BY a.p_apellido, a.p_nombre`);
  if(filtro){
    rows = rows.filter(a=>{
      const nom = `${a.p_nombre||''} ${a.s_nombre||''} ${a.p_apellido||''} ${a.s_apellido||''}`.toLowerCase();
      const rep = `${a.rep_nombre||''} ${a.rep_apellido||''}`.toLowerCase();
      return (a.identificacion||'').toLowerCase().includes(filtro)
          || nom.includes(filtro)
          || rep.includes(filtro);
    });
  }
  tb.innerHTML = rows.map(a=>{
    const nombre = [a.p_nombre,a.s_nombre,a.p_apellido,a.s_apellido].filter(Boolean).join(' ');
    const rep = [a.rep_nombre,a.rep_apellido].filter(Boolean).join(' ') +
                (a.rep_tel ? ` · ${a.rep_tel}` : '');
    const m = calcularMoraAtleta(a.id);
    const d = calcularDeudaAtleta(a.id);

    const deudaMostrar = d.total_bs;

    const filaClase = (m.estado === 'no_practica') ? 'fila-no-practica' : '';
    return `<tr class="${filaClase}">
      <td>${a.identificacion||''}</td>
      <td>${nombre}</td>
      <td>${rep||'—'}</td>
      <td>${a.categoria||'—'}</td>
      <td style="color:#fbbf24">${fmt(deudaMostrar)} Bs</td>
      <td>${badgeMoraHTML(m, deudaMostrar)}</td>
      <td class="acciones">
        <button data-id="${a.id}" data-acc="edit">✏️</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="muted center">Sin atletas.</td></tr>`;

  tb.querySelectorAll('button[data-acc="edit"]').forEach(b=>{
    b.onclick = ()=>editarAtleta(Number(b.dataset.id));
  });
}

function renderPagos(){
  const tb = $('pagos-tbody'); if(!tb) return;
  const rows = all(`
    SELECT p.id, p.fecha, p.fecha_quincena, p.numero_quincena, p.monto, p.estado,
           a.identificacion, a.p_nombre, a.p_apellido,
           m.nombre AS metodo
      FROM pagos p
      JOIN atletas a ON a.id = p.atleta_id
      LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
     ORDER BY p.fecha DESC, p.id DESC
     LIMIT 100`);
  tb.innerHTML = rows.map(p=>{
    const nombre = `${p.p_apellido||''} ${p.p_nombre||''}`.trim() || p.identificacion;
    const badgeClase = p.estado==='pagado' ? 'ok' : (p.estado==='pendiente' ? 'warn' : 'err');
    return `<tr>
      <td>${p.fecha||''}</td>
      <td>${nombre}</td>
      <td>${p.fecha_quincena||''}${p.numero_quincena?` (#${p.numero_quincena})`:''}</td>
      <td>${p.metodo||'—'}</td>
      <td>${fmt(p.monto)}</td>
      <td><span class="badge ${badgeClase}">${p.estado||''}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="muted center">Sin pagos.</td></tr>`;

  renderPagosPendientes();
}

function renderPagosPendientes(){
  const cont = $('lista-pagos-pendientes');
  if(!cont) return;
  try{
    const rows = all(`
      SELECT p.id, p.monto, p.fecha, p.fecha_quincena, p.referencia, p.numero_quincena,
             p.observacion,
             a.identificacion AS atleta_cedula, a.p_nombre, a.p_apellido,
             m.nombre AS metodo
        FROM pagos p
        JOIN atletas a ON a.id = p.atleta_id
        LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
       WHERE p.estado = 'pendiente'
       ORDER BY p.fecha DESC, p.id DESC`);

    if(rows.length === 0){
      cont.innerHTML = `<p class="muted small">No hay pagos pendientes por verificar. ✅</p>`;
      return;
    }

    cont.innerHTML = `
      <div class="tabla-scroll">
        <table>
          <thead><tr>
            <th>Fecha</th><th>Atleta</th><th>Monto</th><th>Método</th>
            <th>Ref.</th><th>Quincena</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${rows.map(p=>{
              const nombre = `${p.p_apellido||''} ${p.p_nombre||''}`.trim() || p.atleta_cedula;
              return `<tr>
                <td>${p.fecha||''}</td>
                <td>${nombre}<br><span class="muted small">${p.atleta_cedula||''}</span></td>
                <td style="color:#22c55e;font-weight:600">${fmt(p.monto)}</td>
                <td>${p.metodo||'—'}</td>
                <td>${p.referencia||'—'}</td>
                <td class="center">${p.numero_quincena?('#'+p.numero_quincena):'—'}</td>
                <td class="acciones">
                  <button class="ok" data-acc="aprobar" data-id="${p.id}">✅ Aprobar</button>
                  <button class="err" data-acc="rechazar" data-id="${p.id}">❌ Rechazar</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    cont.querySelectorAll('button[data-acc="aprobar"]').forEach(b=>{
      b.onclick = ()=>aprobarPago(Number(b.dataset.id));
    });
    cont.querySelectorAll('button[data-acc="rechazar"]').forEach(b=>{
      b.onclick = ()=>rechazarPago(Number(b.dataset.id));
    });
  }catch(e){
    console.error('Error renderPagosPendientes:', e);
    cont.innerHTML = `<p class="msg err show">Error al cargar pendientes: ${e.message}</p>`;
  }
}

function renderResumenPagoAdmin(){
  const cont = $('pago-resumen-atleta');
  const texto = $('pago-resumen-texto');
  if(!cont || !texto) return;

  const atletaId = Number($('pago_atleta').value);
  if(!atletaId){
    cont.style.display = 'none';
    const cob = $('pago-cobertura');
    if(cob) cob.style.display = 'none';
    return;
  }

  const r = resumenDeudaAtleta(atletaId);
  const listaDebidas = r.debidas_nums.length ? r.debidas_nums.map(n=>`#${n}`).join(', ') : '—';
  const listaPend = r.pendientes_nums.length ? r.pendientes_nums.map(n=>`#${n}`).join(', ') : '—';
  const listaPag = r.pagadas_nums.length ? r.pagadas_nums.map(n=>`#${n}`).join(', ') : '—';

  texto.innerHTML = `
    <div><strong>Quincena actual:</strong> #${r.quincena_actual}</div>
    <div><strong>Quincenas debidas:</strong> ${r.debidas} ${r.debidas ? `(${listaDebidas})` : ''}</div>
    <div><strong>Quincenas en revisión:</strong> ${r.pendientes_nums.length ? listaPend : 'ninguna'}</div>
    <div><strong>Quincenas pagadas:</strong> ${r.pagadas_nums.length ? listaPag : 'ninguna'}</div>
    <div><strong>Total adeudado:</strong>
      <span style="color:#fbbf24;font-weight:700">${fmt(r.total_bs)} Bs</span>
      <span class="muted small">(≈ ${fmt(r.total_usd)} USD · tasa ${fmt(r.tasa)})</span>
    </div>
    <div class="muted small">Monto por quincena: ${fmt(r.monto_quincena_usd)} USD</div>
  `;
  cont.style.display = 'block';
  actualizarCoberturaPago();
}

function actualizarCoberturaPago(){
  const cobertura = $('pago-cobertura');
  if(!cobertura) return;

  const atletaId = Number($('pago_atleta').value);
  const fq = $('fecha_quincena').value;
  if(!atletaId || !fq){ cobertura.style.display = 'none'; return; }

  const numQ = calcularNumeroQuincena(fq);
  if(!numQ){
    cobertura.style.display = 'block';
    cobertura.style.background = '#3a0f10';
    cobertura.style.borderColor = '#6a1415';
    cobertura.style.color = '#ffb3b3';
    cobertura.textContent = '⚠️ La fecha de quincena es anterior al corte, no corresponde a ninguna quincena.';
    return;
  }

  const est = estadoQuincenaAtleta(atletaId, numQ);
  cobertura.style.display = 'block';

  if(est.tipo === 'pagada'){
    cobertura.style.background = '#3a0f10';
    cobertura.style.borderColor = '#6a1415';
    cobertura.style.color = '#ffb3b3';
    cobertura.textContent = `⚠️ La quincena #${numQ} ya está PAGADA (pago #${est.pago_id}, ${fmt(est.monto)} USD el ${est.fecha}). Este pago no bajará la mora porque no suma una quincena nueva.`;
  } else if(est.tipo === 'pendiente'){
    cobertura.style.background = '#422006';
    cobertura.style.borderColor = '#854d0e';
    cobertura.style.color = '#fbbf24';
    cobertura.textContent = `⏳ La quincena #${numQ} ya tiene un aporte PENDIENTE de verificación (pago #${est.pago_id}). Si registrás otro, quedará duplicado hasta que el admin resuelva.`;
  } else if(est.tipo === 'futura'){
    cobertura.style.background = '#0c1c3a';
    cobertura.style.borderColor = '#1e3a72';
    cobertura.style.color = '#b9cdff';
    cobertura.textContent = `ℹ️ La quincena #${numQ} es FUTURA (la actual es #${quincenaActualNumero()}). Se registrará como adelanto; no bajará la mora actual.`;
  } else {
    cobertura.style.background = '#062e22';
    cobertura.style.borderColor = '#0d5138';
    cobertura.style.color = '#8ff0c7';
    cobertura.textContent = `✅ Este pago cubre la quincena #${numQ} (estaba debida). Al aprobarse, la mora bajará 1.`;
  }

  const monto = Number($('monto')?.value) || 0;
  const mq = Number(getConfig('monto_quincena','5')) || 5;
  if(monto > 0 && monto % mq === 0 && monto / mq > 1){
    cobertura.textContent += ` 💡 El monto (${fmt(monto)} USD) equivale a ${monto/mq} quincenas, pero esta app registra 1 quincena por pago. Si querés cubrir varias, registrá un pago por cada una.`;
  }
}

function renderResumenAtleta(){
  const cont = $('ra-resumen');
  if(!cont || !usuarioActual || !usuarioActual.id) return;

  const r = resumenDeudaAtleta(usuarioActual.id);
  const listaDebidas = r.debidas_nums.length ? r.debidas_nums.map(n=>`#${n}`).join(', ') : '—';
  const listaPend = r.pendientes_nums.length ? r.pendientes_nums.map(n=>`#${n}`).join(', ') : '—';

  if(r.debidas === 0 && r.pendientes_nums.length === 0){
    cont.innerHTML = `<div style="color:#10b981;font-weight:600">✅ Estás al día. No tenés quincenas debidas.</div>`;
    return;
  }

  cont.innerHTML = `
    <div><strong>Quincena actual:</strong> #${r.quincena_actual}</div>
    <div><strong>Quincenas debidas:</strong> ${r.debidas} ${r.debidas ? `(${listaDebidas})` : ''}</div>
    ${r.pendientes_nums.length ? `<div><strong>En revisión:</strong> ${listaPend}</div>` : ''}
    <div><strong>Total adeudado:</strong>
      <span style="color:#fbbf24;font-weight:700">${fmt(r.total_bs)} Bs</span>
      <span class="muted small">(≈ ${fmt(r.total_usd)} USD)</span>
    </div>
    <div class="muted small">Monto por quincena: ${fmt(r.monto_quincena_usd)} USD · Tasa ${fmt(r.tasa)} Bs/$</div>
  `;
}

/* ============================================================
   Formulario atleta
   ============================================================ */
function limpiarFormAtleta(){
  ['atleta_id','identificacion','p_nombre','s_nombre','p_apellido','s_apellido',
   'fn','cell','telf_emergencia1','clave_atleta','rep_identificacion','rep_nombre',
   'rep_apellido','rep_telefono','rep_email'].forEach(id=>{
     const el=$(id); if(el) el.value='';
   });
  const cat=$('categoria'); if(cat) cat.value='';
  const esc=$('escuela'); if(esc) esc.value='Club Aves Voladoras';
  const par=$('rep_parentesco'); if(par) par.value='';

  // Restaurar el texto original de las categorías borrando la edad
  const selectCat = $('categoria');
  if (selectCat) {
    for (let i = 0; i < selectCat.options.length; i++) {
      selectCat.options[i].text = selectCat.options[i].text.replace(/\s*\(\d+\s*años\)/, '');
    }
  }

  // Resetear el toggle de la clave del atleta a "oculto"
  resetPassToggle('clave_atleta');
}

function editarAtleta(id){
  const a = one(`
    SELECT a.*, r.identificacion AS rep_id, r.nombre AS rep_nombre, r.apellido AS rep_apellido,
           r.telefono AS rep_tel, r.email AS rep_email, r.parentesco AS rep_parentesco
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id
     WHERE a.id=?`, [id]);
  if(!a) return;
  $('atleta_id').value = a.id;
  $('identificacion').value = a.identificacion||'';
  $('p_nombre').value = a.p_nombre||'';
  $('s_nombre').value = a.s_nombre||'';
  $('p_apellido').value = a.p_apellido||'';
  $('s_apellido').value = a.s_apellido||'';
  $('fn').value = a.fn||'';
  $('categoria').value = a.categoria||'';
  $('escuela').value = a.escuela||'Club Aves Voladoras';
  $('cell').value = a.cell||'';
  $('telf_emergencia1').value = a.telf_emergencia1||'';
  $('clave_atleta').value = a.clave||'';
  $('rep_identificacion').value = a.rep_id||'';
  $('rep_nombre').value = a.rep_nombre||'';
  $('rep_apellido').value = a.rep_apellido||'';
  $('rep_telefono').value = a.rep_tel||'';
  $('rep_email').value = a.rep_email||'';
  $('rep_parentesco').value = a.rep_parentesco||'';

  // Al cargar un atleta, la clave debe quedar oculta por defecto
  resetPassToggle('clave_atleta');

  window.scrollTo({top:0,behavior:'smooth'});
}

function clavePorDefecto(ident){
  const s = normalizarCedula(ident).replace(/-/g,'');
  return s.slice(-4) || s;
}

function guardarAtleta(){
  const msg = $('atleta-form-msg');
  hideMsg(msg);
  const ident = normalizarCedula($('identificacion').value);
  const pNom = $('p_nombre').value.trim();
  const pApe = $('p_apellido').value.trim();
  const repId = normalizarCedula($('rep_identificacion').value);
  const repNom = $('rep_nombre').value.trim();
  const repApe = $('rep_apellido').value.trim();
  if(!ident || !pNom || !pApe || !repId || !repNom || !repApe){
    return showMsg(msg,'err','Complete los campos obligatorios (*).');
  }

  const idEdit = $('atleta_id').value ? Number($('atleta_id').value) : null;

  if(!idEdit){
    const existe = one('SELECT id FROM atletas WHERE identificacion=?', [ident]);
    if(existe){
      return showMsg(msg,'err','Ya existe un atleta con esa cédula.');
    }
  } else {
    const otro = one('SELECT id FROM atletas WHERE identificacion=? AND id<>?', [ident, idEdit]);
    if(otro){
      return showMsg(msg,'err','Otra atleta ya usa esa cédula.');
    }
  }

  try{
    db.run(`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(identificacion) DO UPDATE SET
              nombre=excluded.nombre, apellido=excluded.apellido,
              telefono=excluded.telefono, email=excluded.email, parentesco=excluded.parentesco`,
      [repId, repNom, repApe,
       $('rep_telefono').value.trim(), $('rep_email').value.trim(), $('rep_parentesco').value]);

    const rep = one('SELECT id FROM representantes WHERE identificacion=?', [repId]);
    if(!rep || !rep.id){
      return showMsg(msg,'err','No se pudo guardar el representante.');
    }

    const claveInput = $('clave_atleta').value.trim();
    const clave = claveInput || clavePorDefecto(ident);

    // Si la categoria tiene texto de edad, lo limpiamos antes de guardar
    let catLimpia = $('categoria').value;
    catLimpia = catLimpia.replace(/\s*\(\d+\s*años\)/, '');

    if(idEdit){
      db.run(`UPDATE atletas SET identificacion=?, p_nombre=?, s_nombre=?, p_apellido=?, s_apellido=?,
              fn=?, categoria=?, escuela=?, cell=?, telf_emergencia1=?, representante_id=?, clave=?
              WHERE id=?`,
        [ident, pNom, $('s_nombre').value.trim(), pApe, $('s_apellido').value.trim(),
         $('fn').value||null, catLimpia, $('escuela').value.trim(),
         $('cell').value.trim(), $('telf_emergencia1').value.trim(), rep.id, clave, idEdit]);
    } else {
      db.run(`INSERT INTO atletas(identificacion,p_nombre,s_nombre,p_apellido,s_apellido,
              fn,categoria,escuela,cell,telf_emergencia1,representante_id,clave,deuda,activo)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
        [ident, pNom, $('s_nombre').value.trim(), pApe, $('s_apellido').value.trim(),
         $('fn').value||null, catLimpia, $('escuela').value.trim(),
         $('cell').value.trim(), $('telf_emergencia1').value.trim(), rep.id, clave]);
    }
    guardarBDEnIDB();
    renderAtletas(); cargarAtletasEnSelectPago();
    limpiarFormAtleta();
    showMsg(msg,'ok','Atleta guardado.');

    subirAGitHub().catch(err=>console.warn('Sync post-atleta:', err));

  }catch(e){
    showMsg(msg,'err','Error al guardar: '+e.message);
  }
}

/* ============================================================
   Formulario pago (admin)
   ============================================================ */
function limpiarFormPago(){
  ['monto','monto_bs','referencia','banco_origen','telefono_origen','observacion'].forEach(id=>{
    const el=$(id); if(el) el.value='';
  });
  $('fecha').value = hoyISO();
  $('fecha_quincena').value = fechaQuincenaActual();
  $('numero_quincena').value = '';
  $('estado').value = 'pagado';
  $('metodo_pago_id').value = '';
  $('pago_atleta').value = '';
  const t = $('tasa'); if(t) t.value = getConfig('tasa_dolar','36.50');
  actualizarNumeroQuincena();

  const r = $('pago-resumen-atleta'); if(r) r.style.display = 'none';
  const c = $('pago-cobertura'); if(c) c.style.display = 'none';
}

function actualizarNumeroQuincena(){
  const fq = $('fecha_quincena').value;
  const n = calcularNumeroQuincena(fq);
  $('numero_quincena').value = n || '';
}

function registrarPago(){
  const msg = $('pago-msg');
  hideMsg(msg);
  const atletaId = Number($('pago_atleta').value);
  const metodoId = Number($('metodo_pago_id').value);
  const fecha = $('fecha').value;
  const fechaQ = $('fecha_quincena').value;
  const monto = Number($('monto').value);
  const estado = $('estado').value;

  if(!atletaId || !metodoId || !fecha || !fechaQ || !monto){
    return showMsg(msg,'err','Complete atleta, método, fechas y monto.');
  }

  const corte = getConfig('fecha_corte_quincena','2026-09-29'); 
  if(fechaQ < corte){
    return showMsg(msg,'err',`La fecha de quincena no puede ser anterior al corte (${corte}).`);
  }
  const numQ = calcularNumeroQuincena(fechaQ);
  if(!numQ){
    return showMsg(msg,'err','No se pudo calcular el número de quincena.');
  }

  const ref = $('referencia').value.trim();
  const dup = one(`SELECT id FROM pagos WHERE atleta_id=? AND metodo_pago_id=?
                   AND IFNULL(referencia,'')=? AND fecha=?`,
                  [atletaId, metodoId, ref, fecha]);
  if(dup){
    return showMsg(msg,'err','Ya existe un pago igual (atleta + método + ref + fecha).');
  }

  try{
    db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
            monto,moneda,monto_bs_original,tasa,referencia,banco_origen,telefono_origen,
            observacion,estado,pendiente_subir)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [atletaId, metodoId, fecha, fechaQ, numQ, monto, 'USD',
       Number($('monto_bs').value)||0, Number($('tasa').value)||0,
       ref, $('banco_origen').value.trim(), $('telefono_origen').value.trim(),
       $('observacion').value.trim(), estado]);

    if(estado==='pagado'){
      const montoQuincena = Number(getConfig('monto_quincena','5')) || 5;
      const cantQuincenas = Math.floor(monto / montoQuincena);

      const r = resumenDeudaAtleta(atletaId);
      const quincenasDebidas = r.debidas_nums;

      let restantes = cantQuincenas - 1;
      for (let i = 1; i < quincenasDebidas.length && restantes > 0; i++) {
        db.run(`INSERT INTO pagos(atleta_id, monto, fecha, numero_quincena, estado, pendiente_subir)
                VALUES(?, 0, date('now'), ?, 'pagado', 1)`, [atletaId, quincenasDebidas[i]]);
        restantes--;
      }

      db.run(`UPDATE atletas SET deuda = MAX(0, deuda - ?) WHERE id=?`, [monto, atletaId]);
    }

    guardarBDEnIDB();
    renderPagos(); renderAtletas();
    limpiarFormPago();

    if(estado === 'pagado'){
      const cant = Math.floor(monto / (Number(getConfig('monto_quincena','5')) || 5));
      showMsg(msg,'ok',`Pago registrado. Se saldaron ${cant > 0 ? cant : 1} quincena(s).`);
    } else {
      showMsg(msg,'ok',`Pago registrado (Pendiente de verificación).`);
    }
    
    subirAGitHub().catch(err=>console.warn('Sync post-pago-admin:', err));

  }catch(e){
    showMsg(msg,'err','Error al registrar: '+e.message);
  }
}

/* ============================================================
   Reportar aporte (Atleta)
   ============================================================ */
function reportarAporteAtleta(){
  const msg = $('ra-msg');
  hideMsg(msg);
  if(!usuarioActual || !usuarioActual.id){
    return showMsg(msg,'err','Sesión no detectada. Volvé a iniciar sesión.');
  }
  const monto = Number($('ra-monto').value);
  const metodoId = Number($('ra-metodo').value);
  const referencia = ($('ra-referencia').value||'').trim();
  const nota = ($('ra-nota').value||'').trim();

  if(!monto || monto <= 0) return showMsg(msg,'err','Ingresá un monto válido.');
  if(!metodoId)            return showMsg(msg,'err','Seleccioná un método de pago.');

  const fecha = hoyISO();
  const fechaQ = fechaQuincenaActual();
  const numQ = calcularNumeroQuincena(fechaQ);

  const dup = one(`SELECT id FROM pagos WHERE atleta_id=? AND metodo_pago_id=?
                   AND IFNULL(referencia,'')=? AND fecha=?`,
                  [usuarioActual.id, metodoId, referencia, fecha]);
  if(dup){
    return showMsg(msg,'err','Ya reportaste un aporte con esa referencia hoy.');
  }

  try{
    db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
            monto,moneda,monto_bs_original,tasa,referencia,observacion,estado,pendiente_subir)
            VALUES(?,?,?,?,?,?,?,?,?,?,?, 'pendiente', 1)`,
      [usuarioActual.id, metodoId, fecha, fechaQ, numQ,
       monto, 'USD', 0, Number(getConfig('tasa_dolar','36.50'))||0,
       referencia, nota]);

    guardarBDEnIDB();

    $('ra-monto').value = '';
    $('ra-metodo').value = '';
    $('ra-referencia').value = '';
    $('ra-nota').value = '';

    showMsg(msg,'ok','✅ Aporte enviado. Queda pendiente de verificación del administrador.');
    renderVistaAtleta();

    subirAGitHub().catch(err=>console.warn('Sync post-aporte:', err));
  }catch(e){
    showMsg(msg,'err','Error al guardar el aporte: '+e.message);
  }
}

/* ============================================================
   Aprobar / Rechazar (Admin)
   ============================================================ */
function aprobarPago(pagoId){
  if(!confirmar('¿Confirmas que el aporte fue recibido? Se descontarán todas las quincenas que cubra este monto.')) return;
  try{
    const p = one(`SELECT id, atleta_id, monto FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    if(!p){
      avisar('El pago no existe o ya fue procesado.');
      return;
    }

    const montoQuincena = Number(getConfig('monto_quincena','5')) || 5;
    const cantQuincenas = Math.floor(Number(p.monto) / montoQuincena);

    const r = resumenDeudaAtleta(p.atleta_id);
    const quincenasDebidas = r.debidas_nums;

    if (quincenasDebidas.length > 0) {
      db.run(`UPDATE pagos SET estado='pagado', numero_quincena=? WHERE id=?`, [quincenasDebidas[0], pagoId]);
    } else {
      db.run(`UPDATE pagos SET estado='pagado' WHERE id=?`, [pagoId]);
    }

    let restantes = cantQuincenas - 1;
    for (let i = 1; i < quincenasDebidas.length && restantes > 0; i++) {
      db.run(`INSERT INTO pagos(atleta_id, monto, fecha, numero_quincena, estado, pendiente_subir)
              VALUES(?, 0, date('now'), ?, 'pagado', 1)`, [p.atleta_id, quincenasDebidas[i]]);
      restantes--;
    }

    db.run(`UPDATE atletas SET deuda = MAX(0, deuda - ?) WHERE id=?`, [Number(p.monto)||0, p.atleta_id]);

    guardarBDEnIDB();

    renderPagosPendientes();
    renderPagos();
    renderAtletas();
    if(usuarioActual && usuarioActual.rol === 'admin') refrescarAdmin();

    avisar(`✅ Pago aprobado. Cubrió ${cantQuincenas > 0 ? cantQuincenas : 1} quincena(s). La mora fue actualizada.`);

    subirAGitHub().catch(err=>console.warn('Sync post-aprobación:', err));
  }catch(e){
    console.error('Error aprobando pago:', e);
    avisar('❌ Error al aprobar: '+e.message);
  }
}

function rechazarPago(pagoId){
  if(!confirmar('¿Rechazar y eliminar este aporte? Esta acción no se puede deshacer.')) return;
  try{
    const p = one(`SELECT id FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    if(!p){
      avisar('El pago no existe o ya fue procesado.');
      return;
    }
    db.run(`DELETE FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    guardarBDEnIDB();

    renderPagosPendientes();
    renderPagos();
    renderAtletas();
    if(usuarioActual && usuarioActual.rol === 'admin') refrescarAdmin();
    avisar('❌ Aporte rechazado y eliminado.');

    subirAGitHub().catch(err=>console.warn('Sync post-rechazo:', err));
  }catch(e){
    console.error('Error rechazando pago:', e);
    avisar('❌ Error al rechazar: '+e.message);
  }
}

/* ============================================================
   Recalcular categorías masivamente desde Fecha de Nacimiento
   ============================================================ */
async function recalcularCategoriasDesdeFN(){
  const msg = $('recalc-msg');
  hideMsg(msg);

  const atletas = all(`SELECT id, identificacion, p_nombre, p_apellido, fn, categoria
                       FROM atletas WHERE activo=1 ORDER BY p_apellido, p_nombre`);

  if(atletas.length === 0){
    return showMsg(msg,'err','No hay atletas activos para procesar.');
  }

  const sinFN = [];
  const cambios = [];
  for(const a of atletas){
    if(!a.fn){
      sinFN.push(a);
      continue;
    }
    const catNueva = calcularCategoriaPorEdad(a.fn);
    if(!catNueva) continue;
    const catActual = (a.categoria || '').trim();
    if(catActual !== catNueva){
      cambios.push({ atleta: a, catNueva, catActual });
    }
  }

  if(cambios.length === 0 && sinFN.length === 0){
    return showMsg(msg,'ok','✅ Todos los atletas ya tienen la categoría correcta según su fecha de nacimiento.');
  }

  const resumenPrevio =
    `Se van a actualizar ${cambios.length} atleta(s).\n` +
    `Sin fecha de nacimiento (no se tocan): ${sinFN.length}\n\n` +
    (cambios.length ? `Ejemplos:\n` + cambios.slice(0,5).map(c =>
      `· ${c.atleta.p_apellido||''} ${c.atleta.p_nombre||''} (${c.atleta.identificacion}): ${c.catActual||'(vacía)'} → ${c.catNueva}`
    ).join('\n') : '') +
    `\n\n¿Continuar?`;

  if(!confirmar(resumenPrevio)) {
    return showMsg(msg,'info','Operación cancelada. No se cambió nada.');
  }

  let actualizados = 0;
  try{
    for(const c of cambios){
      db.run(`UPDATE atletas SET categoria=? WHERE id=?`, [c.catNueva, c.atleta.id]);
      actualizados++;
    }

    await guardarBDEnIDB();
    renderAtletas();
    refrescarAdmin();

    let texto = `✅ Categorías recalculadas: ${actualizados} atleta(s) actualizado(s).`;
    if(sinFN.length){
      texto += ` ⚠️ ${sinFN.length} atleta(s) sin fecha de nacimiento (revisalos manualmente): ` +
        sinFN.slice(0,8).map(a => `${a.p_apellido||''} ${a.p_nombre||''} (${a.identificacion})`).join(', ') +
        (sinFN.length > 8 ? '…' : '');
    }
    showMsg(msg, sinFN.length ? 'info' : 'ok', texto);

    if(actualizados > 0){
      const r = await subirAGitHub();
      if(r.ok) console.log('Sync post-recalcular: OK');
      else console.warn('Sync post-recalcular falló:', r.error);
    }
  }catch(e){
    showMsg(msg,'err','Error al recalcular: '+e.message);
  }
}

/* ============================================================
   GitHub — sync v2
   ============================================================ */
function construirRawURL(){
  const u = getConfig('github_usuario') || 'maciasblanco';
  const r = getConfig('github_repo') || 'atletadeudas';
  const rama = getConfig('github_rama') || 'main';
  const ruta = getConfig('github_ruta') || 'datos/atletas.json';
  
  GH_RAW = `https://raw.githubusercontent.com/${u}/${r}/${rama}/${ruta}`;
  return GH_RAW;
}

async function subirAGitHub(){
  const usuario = getConfig('github_usuario','');
  const repo    = getConfig('github_repo','');
  const ruta    = getConfig('github_ruta','datos/atletas.json');
  const rama    = getConfig('github_rama','main');
  const token   = getConfig('github_token','');
  if(!usuario || !repo || !token) return {ok:false, error:'Falta configurar usuario, repo o token.'};

  const atletas = all(`
    SELECT a.*, r.identificacion AS rep_id, r.nombre AS rep_nombre, r.apellido AS rep_apellido,
           r.telefono AS rep_tel, r.email AS rep_email, r.parentesco AS rep_parentesco
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id`);
  const pagos = all(`
    SELECT p.*, a.identificacion AS atleta_ci, m.nombre AS metodo_nombre
      FROM pagos p
      JOIN atletas a ON a.id=p.atleta_id
      LEFT JOIN metodos_pago m ON m.id=p.metodo_pago_id
     ORDER BY p.fecha ASC`);

  const payload = {
    version: 2,
    actualizado: nowISO(),
    atletas: atletas.map(a=>({
      cedula: String(a.identificacion||''),
      nombre: a.p_nombre||'', apellido: a.p_apellido||'',
      fn: a.fn || '',
      deuda: Number(a.deuda)||0,
      activo: (a.activo == null ? 1 : (Number(a.activo) || 0)),
      categoria: a.categoria||'', escuela: a.escuela||'',
      representante: {
        cedula: a.rep_id||'', nombre: a.rep_nombre||'', apellido: a.rep_apellido||'',
        telefono: a.rep_tel||'', email: a.rep_email||'', parentesco: a.rep_parentesco||''
      }
    })),
    pagos: pagos.map(p=>({
      cedula: String(p.atleta_ci||''),
      fecha: p.fecha, fecha_quincena: p.fecha_quincena,
      numero_quincena: p.numero_quincena,
      monto: Number(p.monto)||0, moneda: p.moneda||'USD',
      monto_bs: Number(p.monto_bs_original)||0, tasa: Number(p.tasa)||0,
      metodo_pago: p.metodo_nombre||'Otro',
      referencia: p.referencia||'', banco_origen: p.banco_origen||'',
      telefono_origen: p.telefono_origen||'', estado: p.estado||'pagado'
    }))
  };

  const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));
  const apiBase = `https://api.github.com/repos/${usuario}/${repo}/contents/${ruta}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let sha = null;
  try{
    const r = await fetch(`${apiBase}?ref=${encodeURIComponent(rama)}&t=${Date.now()}`, {headers, cache:'no-store'});
    if(r.status===200){ sha = (await r.json()).sha; }
    else if(r.status!==404){ return {ok:false, error:`GET ${r.status}: ${(await r.text()).slice(0,180)}`}; }
  }catch(e){ return {ok:false, error:'Error red SHA: '+e.message}; }

  const body = { message:`Actualizar atletas.json (${new Date().toISOString()})`,
                 content: contentB64, branch: rama };
  if(sha) body.sha = sha;

  try{
    const r = await fetch(apiBase, {method:'PUT',
      headers:{...headers,'Content-Type':'application/json'},
      body: JSON.stringify(body)});
    if(!r.ok) return {ok:false, error:`PUT ${r.status}: ${(await r.text()).slice(0,240)}`};
    const j = await r.json();

    const ids = pagos.map(p=>p.id).filter(Boolean);
    if(ids.length){
      db.run(`UPDATE pagos SET pendiente_subir=0 WHERE id IN (${ids.join(',')})`);
    }
    guardarBDEnIDB();
    return {ok:true, sha:j.content?.sha,
            nAtletas:payload.atletas.length, nPagos:payload.pagos.length};
  }catch(e){
    return {ok:false, error:'Error red PUT: '+e.message};
  }
}

async function sincronizarDesdeGitHub(){
  if(!getConfig('github_usuario')) setConfig('github_usuario', 'maciasblanco');
  if(!getConfig('github_repo')) setConfig('github_repo', 'atletadeudas');
  if(!getConfig('github_ruta')) setConfig('github_ruta', 'datos/atletas.json');
  if(!getConfig('github_rama')) setConfig('github_rama', 'main');

  construirRawURL();
  if(!GH_RAW) return {ok:false, error:'Falta configurar usuario/repo.'};
  
  let json;
  try{
    const r = await fetch(`${GH_RAW}?t=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) return {ok:false, error:`HTTP ${r.status} al leer JSON (${GH_RAW})`};
    json = await r.json();
  }catch(e){ return {ok:false, error:'Error red al leer GitHub: ' + e.message}; }
  if(!json || !Array.isArray(json.atletas)) return {ok:false, error:'JSON inválido.'};

  let nuevos=0, actualizados=0, pagosNuevos=0;

  for(const a of json.atletas){
    if(!a || a.cedula==null) continue;
    const ced = normalizarCedula(a.cedula);
    const rep = a.representante || {};
    let repId = null;
    if(rep.cedula){
      const repCed = normalizarCedula(rep.cedula);
      db.run(`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(identificacion) DO UPDATE SET
                nombre=excluded.nombre, apellido=excluded.apellido, telefono=excluded.telefono,
                email=excluded.email, parentesco=excluded.parentesco`,
        [repCed, rep.nombre||'', rep.apellido||'', rep.telefono||'',
         rep.email||'', rep.parentesco||'']);
      const r = one('SELECT id FROM representantes WHERE identificacion=?', [repCed]);
      repId = r?.id || null;
    }
    const existente = one('SELECT id FROM atletas WHERE identificacion=?', [ced]);
    const activoVal = (a.activo == null ? 1 : (Number(a.activo) || 0));
    if(existente){
      db.run(`UPDATE atletas SET p_nombre=?, p_apellido=?, categoria=?, escuela=?, fn=?,
              representante_id=?, deuda=?, activo=? WHERE id=?`,
        [a.nombre||'', a.apellido||'', a.categoria||'', a.escuela||'', a.fn||null,
         repId, Number(a.deuda)||0, activoVal, existente.id]);
      actualizados++;
    } else {
      const clave = clavePorDefecto(ced);
      db.run(`INSERT INTO atletas(identificacion,p_nombre,p_apellido,categoria,escuela,fn,
              representante_id,clave,deuda,activo) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [ced, a.nombre||'', a.apellido||'', a.categoria||'', a.escuela||'', a.fn||null,
         repId, clave, Number(a.deuda)||0, activoVal]);
      nuevos++;
    }
  }

  if(Array.isArray(json.pagos)){
    for(const p of json.pagos){
      if(!p || p.cedula==null) continue;
      const at = one('SELECT id FROM atletas WHERE identificacion=?', [normalizarCedula(p.cedula)]);
      if(!at) continue;
      const metodo = one('SELECT id FROM metodos_pago WHERE nombre=? OR codigo=?',
                        [String(p.metodo_pago||''), String(p.metodo_pago||'').toUpperCase()]);

      const fecha = p.fecha || p.fecha_quincena;
      if(!fecha) continue;

      const ref = p.referencia!=null ? String(p.referencia) : '';

      const existeLocal = one(`SELECT id, estado FROM pagos
                               WHERE atleta_id=? AND metodo_pago_id=?
                               AND IFNULL(referencia,'')=? AND fecha=?`,
                              [at.id, metodo?.id||null, ref, fecha]);

      if(existeLocal){
        const estadoRemoto = p.estado || 'pagado';
        if(existeLocal.estado === 'pendiente' && estadoRemoto === 'pagado'){
          db.run(`UPDATE pagos SET estado='pagado', pendiente_subir=0 WHERE id=?`, [existeLocal.id]);
        }
        continue;
      }

      db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
              monto,moneda,monto_bs_original,tasa,referencia,banco_origen,telefono_origen,estado,pendiente_subir)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [at.id, metodo?.id||null, fecha, p.fecha_quincena||null, p.numero_quincena||null,
         Number(p.monto)||0, p.moneda||'USD', Number(p.monto_bs)||0, Number(p.tasa)||0,
         ref, p.banco_origen||'', p.telefono_origen||'', p.estado||'pagado']);
      pagosNuevos++;
    }
  }

  guardarBDEnIDB();
  return {ok:true, nuevos, actualizados, pagosNuevos, actualizado: json.actualizado||''};
}

/* ============================================================
   Login / vista atleta
   ============================================================ */
function renderVistaAtleta(){
  if(!usuarioActual || !usuarioActual.id) return;
  const a = one(`SELECT a.*, r.nombre AS rep_nombre, r.apellido AS rep_apellido, r.telefono AS rep_tel
                 FROM atletas a LEFT JOIN representantes r ON r.id=a.representante_id
                 WHERE a.id=?`, [usuarioActual.id]);
  if(!a) return;
  $('atleta-nombre').textContent = `${a.p_nombre||''} ${a.p_apellido||''}`.trim() || '—';
  $('atleta-cedula').textContent = a.identificacion||'—';

  const d = calcularDeudaAtleta(a.id);
  const deudaBs = $('atleta-deuda-bs');
  if(deudaBs){
    deudaBs.textContent = `${fmt(d.total_bs)} Bs`;
    deudaBs.style.color = d.total_bs > 0 ? '#fbbf24' : '#10b981';
  }
  const deudaUsd = $('atleta-deuda-usd');
  if(deudaUsd){
    deudaUsd.textContent = d.total_usd > 0
      ? `≈ ${fmt(d.total_usd)} USD (tasa ${fmt(d.tasa)} Bs/$)`
      : 'Sin deuda pendiente';
  }
  const deudaDet = $('atleta-deuda-detalle');
  if(deudaDet){
    deudaDet.textContent = d.debidas > 0
      ? `${d.debidas} quincena${d.debidas===1?'':'s'} × ${fmt(d.monto_quincena_usd)} USD = ${fmt(d.total_bs)} Bs`
      : `Al día`;
  }

  const m = calcularMoraAtleta(a.id);
  const elEstado = $('atleta-estado');
  if(m.estado === 'no_practica'){
    elEstado.textContent = '🚫 NO PUEDE PRACTICAR';
    elEstado.style.color = '#ef4444';
    elEstado.style.fontSize = '16px';
  } else if(m.estado === 'mora'){
    elEstado.textContent = `⚠️ Mora: ${m.debidas} quincena${m.debidas===1?'':'s'}`;
    elEstado.style.color = '#f59e0b';
    elEstado.style.fontSize = '18px';
  } else if(m.estado === 'ok'){
    elEstado.textContent = '✅ Al día';
    elEstado.style.color = '#10b981';
    elEstado.style.fontSize = '20px';
  } else {
    elEstado.textContent = 'Sin iniciar';
    elEstado.style.color = '#9aa7c7';
    elEstado.style.fontSize = '18px';
  }

  const pend = all(`SELECT monto FROM pagos
                    WHERE atleta_id=? AND estado='pendiente'`, [a.id]);
  const avisoAnterior = $('atleta-pend-aviso');
  if(avisoAnterior) avisoAnterior.remove();
  if(pend.length){
    const totalPend = pend.reduce((s,r)=>s+(Number(r.monto)||0), 0);
    const div = document.createElement('div');
    div.id = 'atleta-pend-aviso';
    div.className = 'aviso-pendiente';
    div.innerHTML = `⏳ Tenés <strong>${pend.length}</strong> aporte(s) en revisión por
                     <strong>${fmt(totalPend)}</strong>. La mora se actualizará al ser aprobados.`;
    const cardResumen = deudaBs?.closest('.card');
    if(cardResumen) cardResumen.appendChild(div);
  }

  const pagos = all(`SELECT p.fecha, p.monto, p.referencia, p.numero_quincena, p.estado
                     FROM pagos p WHERE p.atleta_id=? ORDER BY p.fecha DESC, p.id DESC LIMIT 50`,
                    [a.id]);
  $('atleta-pagos-tbody').innerHTML = pagos.map(p=>{
    const badgeClase = p.estado==='pagado' ? 'ok' : (p.estado==='pendiente' ? 'warn' : 'err');
    return `<tr>
      <td>${p.fecha||''}</td>
      <td>${fmt(p.monto)}</td>
      <td>${p.referencia||''}</td>
      <td>${p.numero_quincena?`#${p.numero_quincena}`:''}</td>
      <td><span class="badge ${badgeClase}">${p.estado||''}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="muted center">Sin pagos.</td></tr>`;

  renderResumenAtleta();
  cargarMetodosEnSelectAtleta();
}

function loginAtleta(){
  const msg = $('login-msg');
  hideMsg(msg);
  const ced = normalizarCedula($('login-cedula').value);
  const clave = $('login-clave').value.trim();
  if(!ced || !clave) return showMsg(msg,'err','Ingrese cédula y clave.');
  const a = one('SELECT * FROM atletas WHERE identificacion=? AND activo=1', [ced]);
  if(!a) return showMsg(msg,'err','Atleta no encontrado.');
  const claveEsperada = a.clave || clavePorDefecto(a.identificacion);
  if(clave !== claveEsperada){
    return showMsg(msg,'err','Clave incorrecta.');
  }
  usuarioActual = a;
  mostrarVista('view-atleta');
  renderVistaAtleta();
}

function loginAdmin(){
  const msg = $('login-msg');
  hideMsg(msg);
  const clave = $('login-clave').value;
  if(clave !== getConfig('clave_admin','admin123')){
    return showMsg(msg,'err','Clave admin incorrecta.');
  }
  usuarioActual = {rol:'admin'};
  mostrarVista('view-admin');
  refrescarAdmin();
  actualizarTasaBCV(true);
}

function refrescarAdmin(){
  renderAtletas();
  renderPagos();
  cargarMetodosEnSelect();
  cargarAtletasEnSelectPago();
  $('c-monto-quincena').value = getConfig('monto_quincena','5');
  $('c-tasa-dolar').value = getConfig('tasa_dolar','36.50');
  $('c-clave-admin').value = getConfig('clave_admin','admin123');
  $('c-fecha-corte').value = getConfig('fecha_corte_quincena','2026-09-29'); 
  $('c-gh-user').value = getConfig('github_usuario','');
  $('c-gh-repo').value = getConfig('github_repo','');
  $('c-gh-ruta').value = getConfig('github_ruta','datos/atletas.json');
  $('c-gh-rama').value = getConfig('github_rama','main');
  $('c-gh-token').value = getConfig('github_token','');
  const t = $('tasa'); if(t) t.value = getConfig('tasa_dolar','36.50');
  const fq = $('fecha_quincena');
  if(fq && !fq.value) fq.value = fechaQuincenaActual();
  actualizarNumeroQuincena();

  // Resetear toggles de claves sensibles a "oculto"
  resetPassToggle('c-clave-admin');
  resetPassToggle('c-gh-token');

  const info = $('tasa-bcv-info');
  if(info){
    const f = getConfig('tasa_bcv_fecha','');
    const act = getConfig('tasa_bcv_actualizado','');
    info.textContent = f
      ? `BCV: ${fmt(getConfig('tasa_dolar','36.50'))} Bs/$ · Vigencia: ${f} · Actualizado: ${act ? new Date(act).toLocaleString('es-VE') : '—'}`
      : '';
  }

  const nA = all('SELECT COUNT(*) AS n FROM atletas')[0]?.n || 0;
  const nP = all('SELECT COUNT(*) AS n FROM pagos')[0]?.n || 0;
  const pend = all('SELECT COUNT(*) AS n FROM pagos WHERE pendiente_subir=1')[0]?.n || 0;
  const nPendVerif = all(`SELECT COUNT(*) AS n FROM pagos WHERE estado='pendiente'`)[0]?.n || 0;
  const qAct = quincenaActualNumero();
  const moras = all('SELECT id FROM atletas WHERE activo=1').map(a=>calcularMoraAtleta(a.id));
  const enMora = moras.filter(m=>m.estado==='mora').length;
  const morosos = moras.filter(m=>m.estado==='no_practica').length;
  $('diag').textContent =
    `Atletas: ${nA} · Pagos: ${nP} (${pend} pend. subir, ${nPendVerif} por verificar) · ` +
    `schema_version: ${getConfig('schema_version','?')} · tasa_dolar: ${getConfig('tasa_dolar','?')} · ` +
    `monto_quincena: ${getConfig('monto_quincena','?')} USD · ` +
    `corte: ${getConfig('fecha_corte_quincena','?')} · ` +
    `quincena actual: ${qAct} · en mora: ${enMora} · NO practican: ${morosos}`;
}

/* ============================================================
   Eventos
   ============================================================ */
function wireEvents(){
  const on = (id, fn) => { const el = $(id); if(el) el.onclick = fn; };
  const onEvent = (id, evt, fn) => { const el = $(id); if(el) el.addEventListener(evt, fn); };

  // Botones de ojo (mostrar/ocultar claves)
  wirePasswordToggles();

  on('btn-login-atleta', loginAtleta);
  on('btn-login-admin', loginAdmin);
  on('btn-logout-atleta', ()=>{ usuarioActual=null; mostrarVista('view-login'); });
  on('btn-logout-admin', ()=>{ usuarioActual=null; mostrarVista('view-login'); });
  on('btn-ver-pagos', ()=> $('atleta-pagos-card').classList.toggle('hidden'));

  on('btn-reportar-aporte', reportarAporteAtleta);

  document.querySelectorAll('#admin-tabs button').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#admin-tabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      ['atletas','pagos','config'].forEach(t=>{
        const tabEl = $('tab-'+t);
        if(tabEl) tabEl.classList.toggle('hidden', t!==b.dataset.tab);
      });
      if(b.dataset.tab === 'pagos') renderPagosPendientes();
    };
  });

  const formAtleta = $('form-atleta'); 
  if(formAtleta) formAtleta.onsubmit = (e)=>{ e.preventDefault(); guardarAtleta(); };
  
  on('btn-limpiar-atleta', limpiarFormAtleta);
  
  const buscarAtleta = $('buscar-atleta');
  if(buscarAtleta) buscarAtleta.oninput = renderAtletas;

  const formPago = $('form-pago');
  if(formPago) formPago.onsubmit = (e)=>{ e.preventDefault(); registrarPago(); };
  
  on('btn-limpiar-pago', limpiarFormPago);
  
  onEvent('fecha_quincena', 'change', ()=>{
    actualizarNumeroQuincena();
    actualizarCoberturaPago();
  });
  onEvent('monto', 'input', actualizarCoberturaPago);
  onEvent('pago_atleta', 'change', renderResumenPagoAdmin);

  // EVENTO PARA CALCULAR CATEGORÍA Y EDAD AUTOMÁTICAMENTE
  onEvent('fn', 'change', (e) => {
    const fecha = e.target.value;
    const selectCat = $('categoria');
    
    if (fecha && selectCat) {
      const catCalculada = calcularCategoriaPorEdad(fecha);
      const edad = calcularEdad(fecha);
      
      // Limpiar textos con edad de todas las opciones
      for (let i = 0; i < selectCat.options.length; i++) {
        const opt = selectCat.options[i];
        opt.text = opt.text.replace(/\s*\(\d+\s*años\)/, ''); 
      }
      
      selectCat.value = catCalculada;
      
      // Si la categoría calculada existe en el select, le agregamos la edad
      if (selectCat.value === catCalculada) {
        const selectedOption = selectCat.options[selectCat.selectedIndex];
        selectedOption.text = `${catCalculada} (${edad} años)`;
      }
    }
  });

  on('btn-guardar-config', ()=>{
    setConfig('monto_quincena', $('c-monto-quincena').value);
    setConfig('tasa_dolar', $('c-tasa-dolar').value);
    setConfig('clave_admin', $('c-clave-admin').value);
    setConfig('fecha_corte_quincena', $('c-fecha-corte').value);
    guardarBDEnIDB();
    showMsg($('config-msg'),'ok','Configuración guardada.');
    refrescarAdmin();
  });

  on('btn-tasa-bcv', ()=> actualizarTasaBCV(false));

  on('btn-guardar-gh', ()=>{
    setConfig('github_usuario', $('c-gh-user').value.trim());
    setConfig('github_repo', $('c-gh-repo').value.trim());
    setConfig('github_ruta', $('c-gh-ruta').value.trim()||'datos/atletas.json');
    setConfig('github_rama', $('c-gh-rama').value.trim()||'main');
    setConfig('github_token', $('c-gh-token').value.trim());
    guardarBDEnIDB();
    showMsg($('gh-msg'),'ok','GitHub guardado.');
  });
  on('btn-subir-gh', async ()=>{
    showMsg($('gh-msg'),'info','Subiendo…');
    const r = await subirAGitHub();
    if(r.ok) showMsg($('gh-msg'),'ok',`Subido OK (${r.nAtletas} atletas, ${r.nPagos} pagos).`);
    else showMsg($('gh-msg'),'err', r.error);
    refrescarAdmin();
  });
  on('btn-bajar-gh', async ()=>{
    showMsg($('gh-msg'),'info','Sincronizando…');
    const r = await sincronizarDesdeGitHub();
    if(r.ok){
      showMsg($('gh-msg'),'ok',`OK. Nuevos: ${r.nuevos}, Actualizados: ${r.actualizados}, Pagos nuevos: ${r.pagosNuevos}`);
      refrescarAdmin();
    } else showMsg($('gh-msg'),'err', r.error);
  });

  // RECALCULAR CATEGORÍAS MASIVAMENTE
  on('btn-recalcular-categorias', recalcularCategoriasDesdeFN);

  on('btn-sync-login', async ()=>{
    showMsg($('sync-login-msg'),'info','Sincronizando…');
    const r = await sincronizarDesdeGitHub();
    if(r.ok) showMsg($('sync-login-msg'),'ok',`OK. Nuevos: ${r.nuevos}, Actualizados: ${r.actualizados}`);
    else showMsg($('sync-login-msg'),'err', r.error);
  });
  on('btn-sync-atleta', async ()=>{
    showMsg($('sync-atleta-msg'),'info','Sincronizando…');
    const r = await sincronizarDesdeGitHub();
    if(r.ok){ showMsg($('sync-atleta-msg'),'ok','Sincronizado.'); renderVistaAtleta(); }
    else showMsg($('sync-atleta-msg'),'err', r.error);
  });

  on('btn-respaldar', ()=>{
    const data = db.export();
    const blob = new Blob([data], {type:'application/octet-stream'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atletadeudas_${hoyISO()}.sqlite`;
    a.click();
  });
  on('btn-restaurar', ()=> { const f = $('file-restaurar'); if(f) f.click(); });
  
  const fileRest = $('file-restaurar');
  if(fileRest) fileRest.onchange = async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    db = new SQL.Database(buf);
    crearSchema();
    await guardarBDEnIDB();
    showMsg($('backup-msg'),'ok','Respaldo restaurado.');
    refrescarAdmin();
  };
}

/* Init */
async function init(){
  try{
    await new Promise(r => setTimeout(r, 800));

    SQL = await initSqlJs({ locateFile:f=>`https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${f}` });
    const bytes = await idbGet(IDB_KEY);
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    crearSchema();
    await guardarBDEnIDB();

    wireEvents();
    limpiarFormAtleta();
    limpiarFormPago();
    mostrarVista('view-login');

    actualizarTasaBCV(true)
      .then(()=>{
        if(usuarioActual && usuarioActual.rol === 'admin') refrescarAdmin();
        else if(usuarioActual && usuarioActual.id) renderVistaAtleta();
      })
      .catch(err=>console.warn('Tasa BCV inicial:', err));

    if(!bytes){ 
       console.log('Primera vez en este dispositivo. Sincronizando automáticamente...');
       
       if(!getConfig('github_usuario')) setConfig('github_usuario', 'maciasblanco');
       if(!getConfig('github_repo')) setConfig('github_repo', 'atletadeudas');
       if(!getConfig('github_ruta')) setConfig('github_ruta', 'datos/atletas.json');
       
       await guardarBDEnIDB(); 
       
       setTimeout(async () => {
           const loadMsg = document.createElement('div');
           loadMsg.id = 'load-alert';
           loadMsg.style.position = 'fixed';
           loadMsg.style.top = '20px';
           loadMsg.style.left = '50%';
           loadMsg.style.transform = 'translateX(-50%)';
           loadMsg.style.zIndex = '9999';
           loadMsg.style.textAlign = 'center';
           loadMsg.style.background = '#0c1c3a';
           loadMsg.style.color = '#b9cdff';
           loadMsg.style.border = '1px solid #1e3a72';
           loadMsg.style.padding = '12px 24px';
           loadMsg.style.borderRadius = '10px';
           loadMsg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
           loadMsg.style.fontSize = '14px';
           loadMsg.style.fontWeight = 'bold';
           loadMsg.style.display = 'flex';
           loadMsg.style.alignItems = 'center';
           loadMsg.style.gap = '10px';
           
           loadMsg.innerHTML = `
             <div style="width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
             <div>⏳ Descargando datos por primera vez...<br><span style="font-size:12px;font-weight:normal;color:#9aa7c7">Por favor, espera un momento.</span></div>
           `;
           document.body.appendChild(loadMsg);

           const r = await sincronizarDesdeGitHub();
           
           loadMsg.remove();

           if(r.ok) {
               avisar(`✅ ¡Datos cargados satisfactoriamente!\n\n` + 
                     `Atletas nuevos: ${r.nuevos}\n` +
                     `Atletas actualizados: ${r.actualizados}\n` +
                     `Pagos nuevos: ${r.pagosNuevos}`);
               refrescarAdmin();
           } else {
               avisar(`⚠️ La aplicación se abrió, pero no se pudo conectar con GitHub automáticamente.\n\nError: ${r.error}\n\nPor favor, revisa tu conexión a internet.`);
           }
       }, 500); 
    }
  }catch(e){
    console.error(e);
    document.body.innerHTML = '<div class="card"><h1>Error</h1><p class="muted">'+e.message+'</p></div>';
  }
}

window.addEventListener('load', init);