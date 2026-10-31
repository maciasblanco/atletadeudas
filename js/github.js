/* ============================================================
   github.js — Sincronización con GitHub
   ============================================================ */
import { state } from './state.js';
import { all, one, getConfig, setConfig, guardarBDEnIDB } from './db.js';
import { normalizarCedula } from './utils.js';

export function construirRawURL() {
  const u = getConfig('github_usuario') || 'maciasblanco';
  const r = getConfig('github_repo') || 'atletadeudas';
  const rama = getConfig('github_rama') || 'main';
  const ruta = getConfig('github_ruta') || 'datos/atletas.json';
  
  state.GH_RAW = `https://raw.githubusercontent.com/${u}/${r}/${rama}/${ruta}`;
  return state.GH_RAW;
}

export async function subirAGitHub() {
  const usuario = getConfig('github_usuario', '');
  const repo = getConfig('github_repo', '');
  const ruta = getConfig('github_ruta', 'datos/atletas.json');
  const rama = getConfig('github_rama', 'main');
  const token = getConfig('github_token', '');
  
  if (!usuario || !repo || !token) return { ok: false, error: 'Falta configurar usuario, repo o token.' };

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
    actualizado: new Date().toISOString(),
    atletas: atletas.map(a => ({
      cedula: String(a.identificacion || ''),
      nombre: a.p_nombre || '', apellido: a.p_apellido || '',
      fn: a.fn || '',
      deuda: Number(a.deuda) || 0,
      activo: (a.activo == null ? 1 : (Number(a.activo) || 0)),
      categoria: a.categoria || '', escuela: a.escuela || '',
      representante: {
        cedula: a.rep_id || '', nombre: a.rep_nombre || '', apellido: a.rep_apellido || '',
        telefono: a.rep_tel || '', email: a.rep_email || '', parentesco: a.rep_parentesco || ''
      }
    })),
    pagos: pagos.map(p => ({
      cedula: String(p.atleta_ci || ''),
      fecha: p.fecha, fecha_quincena: p.fecha_quincena,
      numero_quincena: p.numero_quincena,
      monto: Number(p.monto) || 0, moneda: p.moneda || 'USD',
      monto_bs: Number(p.monto_bs_original) || 0, tasa: Number(p.tasa) || 0,
      metodo_pago: p.metodo_nombre || 'Otro',
      referencia: p.referencia || '', banco_origen: p.banco_origen || '',
      telefono_origen: p.telefono_origen || '', estado: p.estado || 'pagado'
    }))
  };

  const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  const apiBase = `https://api.github.com/repos/${usuario}/${repo}/contents/${ruta}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let sha = null;
  try {
    const r = await fetch(`${apiBase}?ref=${encodeURIComponent(rama)}&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (r.status === 200) { sha = (await r.json()).sha; }
    else if (r.status !== 404) { return { ok: false, error: `GET ${r.status}: ${(await r.text()).slice(0, 180)}` }; }
  } catch (e) { return { ok: false, error: 'Error red SHA: ' + e.message }; }

  const body = { message: `Actualizar atletas.json (${new Date().toISOString()})`, content: contentB64, branch: rama };
  if (sha) body.sha = sha;

  try {
    const r = await fetch(apiBase, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return { ok: false, error: `PUT ${r.status}: ${(await r.text()).slice(0, 240)}` };
    const j = await r.json();

    const ids = pagos.map(p => p.id).filter(Boolean);
    if (ids.length) {
      state.db.run(`UPDATE pagos SET pendiente_subir=0 WHERE id IN (${ids.join(',')})`);
    }
    guardarBDEnIDB();
    return { ok: true, sha: j.content?.sha, nAtletas: payload.atletas.length, nPagos: payload.pagos.length };
  } catch (e) {
    return { ok: false, error: 'Error red PUT: ' + e.message };
  }
}

export async function sincronizarDesdeGitHub() {
  if (!getConfig('github_usuario')) setConfig('github_usuario', 'maciasblanco');
  if (!getConfig('github_repo')) setConfig('github_repo', 'atletadeudas');
  if (!getConfig('github_ruta')) setConfig('github_ruta', 'datos/atletas.json');
  if (!getConfig('github_rama')) setConfig('github_rama', 'main');

  construirRawURL();
  if (!state.GH_RAW) return { ok: false, error: 'Falta configurar usuario/repo.' };
  
  let json;
  try {
    const r = await fetch(`${state.GH_RAW}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status} al leer JSON (${state.GH_RAW})` };
    json = await r.json();
  } catch (e) { return { ok: false, error: 'Error red al leer GitHub: ' + e.message }; }
  if (!json || !Array.isArray(json.atletas)) return { ok: false, error: 'JSON inválido.' };

  let nuevos = 0, actualizados = 0, pagosNuevos = 0;

  for (const a of json.atletas) {
    if (!a || a.cedula == null) continue;
    const ced = normalizarCedula(a.cedula);
    const rep = a.representante || {};
    let repId = null;
    if (rep.cedula) {
      const repCed = normalizarCedula(rep.cedula);
      state.db.run(`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(identificacion) DO UPDATE SET
                nombre=excluded.nombre, apellido=excluded.apellido, telefono=excluded.telefono,
                email=excluded.email, parentesco=excluded.parentesco`,
        [repCed, rep.nombre || '', rep.apellido || '', rep.telefono || '', rep.email || '', rep.parentesco || '']);
      const r = one('SELECT id FROM representantes WHERE identificacion=?', [repCed]);
      repId = r?.id || null;
    }
    const existente = one('SELECT id FROM atletas WHERE identificacion=?', [ced]);
    const activoVal = (a.activo == null ? 1 : (Number(a.activo) || 0));
    if (existente) {
      state.db.run(`UPDATE atletas SET p_nombre=?, p_apellido=?, categoria=?, escuela=?, fn=?,
              representante_id=?, deuda=?, activo=? WHERE id=?`,
        [a.nombre || '', a.apellido || '', a.categoria || '', a.escuela || '', a.fn || null,
         repId, Number(a.deuda) || 0, activoVal, existente.id]);
      actualizados++;
    } else {
      // Clave por defecto
      const s = normalizarCedula(ced).replace(/-/g, '');
      const clave = s.slice(-4) || s;
      
      state.db.run(`INSERT INTO atletas(identificacion,p_nombre,p_apellido,categoria,escuela,fn,
              representante_id,clave,deuda,activo) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [ced, a.nombre || '', a.apellido || '', a.categoria || '', a.escuela || '', a.fn || null,
         repId, clave, Number(a.deuda) || 0, activoVal]);
      nuevos++;
    }
  }

  if (Array.isArray(json.pagos)) {
    for (const p of json.pagos) {
      if (!p || p.cedula == null) continue;
      const at = one('SELECT id FROM atletas WHERE identificacion=?', [normalizarCedula(p.cedula)]);
      if (!at) continue;
      const metodo = one('SELECT id FROM metodos_pago WHERE nombre=? OR codigo=?', [String(p.metodo_pago || ''), String(p.metodo_pago || '').toUpperCase()]);

      const fecha = p.fecha || p.fecha_quincena;
      if (!fecha) continue;

      const ref = p.referencia != null ? String(p.referencia) : '';
      const existeLocal = one(`SELECT id, estado FROM pagos WHERE atleta_id=? AND metodo_pago_id=? AND IFNULL(referencia,'')=? AND fecha=?`, [at.id, metodo?.id || null, ref, fecha]);

      if (existeLocal) {
        const estadoRemoto = p.estado || 'pagado';
        if (existeLocal.estado === 'pendiente' && estadoRemoto === 'pagado') {
          state.db.run(`UPDATE pagos SET estado='pagado', pendiente_subir=0 WHERE id=?`, [existeLocal.id]);
        }
        continue;
      }

      state.db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
              monto,moneda,monto_bs_original,tasa,referencia,banco_origen,telefono_origen,estado,pendiente_subir)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [at.id, metodo?.id || null, fecha, p.fecha_quincena || null, p.numero_quincena || null,
         Number(p.monto) || 0, p.moneda || 'USD', Number(p.monto_bs) || 0, Number(p.tasa) || 0,
         ref, p.banco_origen || '', p.telefono_origen || '', p.estado || 'pagado']);
      pagosNuevos++;
    }
  }

  guardarBDEnIDB();
  return { ok: true, nuevos, actualizados, pagosNuevos, actualizado: json.actualizado || '' };
}