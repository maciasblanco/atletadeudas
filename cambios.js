/* ============================================================
   cambios.js — Sobrescribir archivos para corregir borrado y JSON
   ============================================================ */

module.exports = {
  descripcion: 'Sobrescribir github.js y ui-admin-atletas.js para asegurar la correccion',
  operaciones: [
    {
      tipo: 'sobrescribir',
      archivo: 'js/github.js',
      contenido: `/* ============================================================
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
  
  state.GH_RAW = \`https://raw.githubusercontent.com/\${u}/\${r}/\${rama}/\${ruta}\`;
  return state.GH_RAW;
}

export async function subirAGitHub() {
  const usuario = getConfig('github_usuario', '');
  const repo = getConfig('github_repo', '');
  const ruta = getConfig('github_ruta', 'datos/atletas.json');
  const rama = getConfig('github_rama', 'main');
  const token = getConfig('github_token', '');
  
  if (!usuario || !repo || !token) return { ok: false, error: 'Falta configurar usuario, repo o token.' };

  const atletas = all(\`
    SELECT a.*, r.identificacion AS rep_id, r.nombre AS rep_nombre, r.apellido AS rep_apellido,
           r.telefono AS rep_tel, r.email AS rep_email, r.parentesco AS rep_parentesco
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id\`);
  const pagos = all(\`
    SELECT p.*, a.identificacion AS atleta_ci, m.nombre AS metodo_nombre
      FROM pagos p
      JOIN atletas a ON a.id=p.atleta_id
      LEFT JOIN metodos_pago m ON m.id=p.metodo_pago_id
     ORDER BY p.fecha ASC\`);
  const asistencias = all(\`
    SELECT asis.fecha, a.identificacion AS atleta_ci, asis.estado
      FROM asistencias asis
      JOIN atletas a ON a.id = asis.atleta_id
     ORDER BY asis.fecha ASC\`);

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
    })),
    asistencias: asistencias.map(asis => ({
      cedula: String(asis.atleta_ci || ''),
      fecha: asis.fecha,
      estado: asis.estado || 'presente'
    }))
  };

  const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  const apiBase = \`https://api.github.com/repos/\${usuario}/\${repo}/contents/\${ruta}\`;
  const headers = {
    'Authorization': \`Bearer \${token}\`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let sha = null;
  try {
    const r = await fetch(\`\${apiBase}?ref=\${encodeURIComponent(rama)}&t=\${Date.now()}\`, { headers, cache: 'no-store' });
    if (r.status === 200) { sha = (await r.json()).sha; }
    else if (r.status !== 404) { return { ok: false, error: \`GET \${r.status}: \${(await r.text()).slice(0, 180)}\` }; }
  } catch (e) { return { ok: false, error: 'Error red SHA: ' + e.message }; }

  const body = { message: \`Actualizar atletas.json (\${new Date().toISOString()})\`, content: contentB64, branch: rama };
  if (sha) body.sha = sha;

  try {
    const r = await fetch(apiBase, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return { ok: false, error: \`PUT \${r.status}: \${(await r.text()).slice(0, 240)}\` };
    const j = await r.json();

    const ids = pagos.map(p => p.id).filter(Boolean);
    if (ids.length) {
      state.db.run(\`UPDATE pagos SET pendiente_subir=0 WHERE id IN (\${ids.join(',')})\`);
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
    const r = await fetch(\`\${state.GH_RAW}?t=\${Date.now()}\`, { cache: 'no-store' });
    if (!r.ok) return { ok: false, error: \`HTTP \${r.status} al leer JSON (\${state.GH_RAW})\` };
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
      state.db.run(\`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(identificacion) DO UPDATE SET
                nombre=excluded.nombre, apellido=excluded.apellido, telefono=excluded.telefono,
                email=excluded.email, parentesco=excluded.parentesco\`,
        [repCed, rep.nombre || '', rep.apellido || '', rep.telefono || '', rep.email || '', rep.parentesco || '']);
      const r = one('SELECT id FROM representantes WHERE identificacion=?', [repCed]);
      repId = r?.id || null;
    }
    const existente = one('SELECT id FROM atletas WHERE identificacion=?', [ced]);
    const activoVal = (a.activo == null ? 1 : (Number(a.activo) || 0));
    if (existente) {
      state.db.run(\`UPDATE atletas SET p_nombre=?, p_apellido=?, categoria=?, escuela=?, fn=?,
              representante_id=?, deuda=?, activo=? WHERE id=?\`,
        [a.nombre || '', a.apellido || '', a.categoria || '', a.escuela || '', a.fn || null,
         repId, Number(a.deuda) || 0, activoVal, existente.id]);
      actualizados++;
    } else {
      const s = normalizarCedula(ced).replace(/-/g, '');
      const clave = s.slice(-4) || s;
      
      state.db.run(\`INSERT INTO atletas(identificacion,p_nombre,p_apellido,categoria,escuela,fn,
              representante_id,clave,deuda,activo) VALUES(?,?,?,?,?,?,?,?,?,?)\`,
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
      const existeLocal = one(\`SELECT id, estado FROM pagos WHERE atleta_id=? AND metodo_pago_id=? AND IFNULL(referencia,'')=? AND fecha=?\`, [at.id, metodo?.id || null, ref, fecha]);

      if (existeLocal) {
        const estadoRemoto = p.estado || 'pagado';
        if (existeLocal.estado === 'pendiente' && estadoRemoto === 'pagado') {
          state.db.run(\`UPDATE pagos SET estado='pagado', pendiente_subir=0 WHERE id=?\`, [existeLocal.id]);
        }
        continue;
      }

      state.db.run(\`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
              monto,moneda,monto_bs_original,tasa,referencia,banco_origen,telefono_origen,estado,pendiente_subir)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0)\`,
        [at.id, metodo?.id || null, fecha, p.fecha_quincena || null, p.numero_quincena || null,
         Number(p.monto) || 0, p.moneda || 'USD', Number(p.monto_bs) || 0, Number(p.tasa) || 0,
         ref, p.banco_origen || '', p.telefono_origen || '', p.estado || 'pagado']);
      pagosNuevos++;
    }
  }

  if (Array.isArray(json.asistencias)) {
    for (const asis of json.asistencias) {
      if (!asis || asis.cedula == null || !asis.fecha) continue;
      const at = one('SELECT id FROM atletas WHERE identificacion=?', [normalizarCedula(asis.cedula)]);
      if (!at) continue;
      
      state.db.run(\`INSERT OR REPLACE INTO asistencias(atleta_id, fecha, estado) VALUES(?, ?, ?)\`, 
        [at.id, asis.fecha, asis.estado || 'presente']);
    }
  }

  guardarBDEnIDB();
  return { ok: true, nuevos, actualizados, pagosNuevos, actualizado: json.actualizado || '' };
}
`
    },
    {
      tipo: 'sobrescribir',
      archivo: 'js/ui-admin-atletas.js',
      contenido: `/* ============================================================
   ui-admin-atletas.js — Tabla y Formulario de Atletas
   ============================================================ */
import { state } from './state.js';
import { one, all, getConfig, setConfig, guardarBDEnIDB } from './db.js';
import { hoyISO, fmt, normalizarCedula, showMsg, hideMsg, avisar, confirmar, resetPassToggle } from './utils.js';
import { calcularMoraAtleta, calcularDeudaAtleta } from './quincenas.js';
import { calcularCategoriaPorEdad } from './categorias.js';

export function renderAtletas(){
  const tb = document.getElementById('atletas-tbody'); 
  if(!tb) return;
  const filtro = (document.getElementById('buscar-atleta')?.value||'').trim().toLowerCase();
  
  let rows = all(\`
    SELECT a.id, a.identificacion, a.p_nombre, a.s_nombre, a.p_apellido, a.s_apellido,
           a.categoria, a.deuda, a.fn,
           r.nombre AS rep_nombre, r.apellido AS rep_apellido, r.telefono AS rep_tel
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id
     WHERE a.activo = 1
     ORDER BY a.p_apellido, a.p_nombre\`);
     
  if(filtro){
    rows = rows.filter(a=>{
      const nom = \`\${a.p_nombre||''} \${a.s_nombre||''} \${a.p_apellido||''} \${a.s_apellido||''}\`.toLowerCase();
      const rep = \`\${a.rep_nombre||''} \${a.rep_apellido||''}\`.toLowerCase();
      return (a.identificacion||'').toLowerCase().includes(filtro)
          || nom.includes(filtro)
          || rep.includes(filtro);
    });
  }
  
  tb.innerHTML = rows.map(a=>{
    const nombre = [a.p_nombre,a.s_nombre,a.p_apellido,a.s_apellido].filter(Boolean).join(' ');
    const rep = [a.rep_nombre,a.rep_apellido].filter(Boolean).join(' ') +
                (a.rep_tel ? \` · \${a.rep_tel}\` : '');
    const m = calcularMoraAtleta(a.id);
    const d = calcularDeudaAtleta(a.id);
    const deudaMostrar = d.total_bs;
    const filaClase = (m.estado === 'no_practica') ? 'fila-no-practica' : '';
    
    let badge = '';
    if(m.estado === 'sin_inicio'){
      badge = \`<span class="badge" style="background:#1e2a45;color:#9aa7c7">Sin iniciar</span>\`;
    } else if(m.estado === 'ok'){
      badge = \`<span class="badge ok">✅ Al día</span>\`;
    } else {
      const extra = (deudaMostrar > 0) ? \` · \${fmt(deudaMostrar)} Bs\` : '';
      if(m.estado === 'mora'){
        badge = \`<span class="badge warn">⚠️ Mora: \${m.debidas}\${extra}</span>\`;
      } else {
        badge = \`<span class="badge err">🚫 NO PRACTICA (\${m.debidas})\${extra}</span>\`;
      }
    }

    return \`<tr class="\${filaClase}">
      <td>\${a.identificacion||''}</td>
      <td>\${nombre}</td>
      <td>\${rep||'—'}</td>
      <td>\${a.categoria||'—'}</td>
      <td style="color:#fbbf24">\${fmt(deudaMostrar)} Bs</td>
      <td>\${badge}</td>
      <td class="acciones">
        <button data-id="\${a.id}" data-acc="edit">✏️</button>
        <button class="err" data-id="\${a.id}" data-acc="delete">🗑️</button>
      </td>
    </tr>\`;
  }).join('') || \`<tr><td colspan="7" class="muted center">Sin atletas.</td></tr>\`;

  tb.querySelectorAll('button[data-acc="edit"]').forEach(b=>{
    b.onclick = ()=>editarAtleta(Number(b.dataset.id));
  });

  tb.querySelectorAll('button[data-acc="delete"]').forEach(b=>{
    b.onclick = async ()=> {
      const id = Number(b.dataset.id);
      if(confirmar('¿Desactivar este atleta? Dejará de aparecer en la lista.')){
        state.db.run('UPDATE atletas SET activo=0 WHERE id=?', [id]);
        await guardarBDEnIDB();
        renderAtletas();
        
        const msg = document.getElementById('atleta-form-msg');
        if(typeof window.subirAGitHub === 'function') {
          if(msg) showMsg(msg, 'info', 'Sincronizando borrado con GitHub...');
          const res = await window.subirAGitHub();
          if(res.ok) {
            if(msg) showMsg(msg, 'ok', '✅ Atleta eliminado y actualizado en GitHub.');
          } else {
            if(msg) showMsg(msg, 'err', '⚠️ Eliminado localmente, pero falló en GitHub.');
          }
        }
      }
    };
  });
}

export function limpiarFormAtleta(){
  ['atleta_id','identificacion','p_nombre','s_nombre','p_apellido','s_apellido',
   'fn','cell','telf_emergencia1','clave_atleta','rep_identificacion','rep_nombre',
   'rep_apellido','rep_telefono','rep_email'].forEach(id=>{
     const el=document.getElementById(id); if(el) el.value='';
   });
  const cat=document.getElementById('categoria'); if(cat) cat.value='';
  const esc=document.getElementById('escuela'); if(esc) esc.value='Club Aves Voladoras';
  const par=document.getElementById('rep_parentesco'); if(par) par.value='';

  const selectCat = document.getElementById('categoria');
  if (selectCat) {
    for (let i = 0; i < selectCat.options.length; i++) {
      selectCat.options[i].text = selectCat.options[i].text.replace(/\\s*\\(\\d+\\s*años\\)/, '');
    }
  }
  resetPassToggle('clave_atleta');
}

export function editarAtleta(id){
  const a = one(\`
    SELECT a.*, r.identificacion AS rep_id, r.nombre AS rep_nombre, r.apellido AS rep_apellido,
           r.telefono AS rep_tel, r.email AS rep_email, r.parentesco AS rep_parentesco
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id
     WHERE a.id=?\`, [id]);
  if(!a) return;
  
  document.getElementById('atleta_id').value = a.id;
  document.getElementById('identificacion').value = a.identificacion||'';
  document.getElementById('p_nombre').value = a.p_nombre||'';
  document.getElementById('s_nombre').value = a.s_nombre||'';
  document.getElementById('p_apellido').value = a.p_apellido||'';
  document.getElementById('s_apellido').value = a.s_apellido||'';
  document.getElementById('fn').value = a.fn||'';
  document.getElementById('categoria').value = a.categoria||'';
  document.getElementById('escuela').value = a.escuela||'Club Aves Voladoras';
  document.getElementById('cell').value = a.cell||'';
  document.getElementById('telf_emergencia1').value = a.telf_emergencia1||'';
  document.getElementById('clave_atleta').value = a.clave||'';
  document.getElementById('rep_identificacion').value = a.rep_id||'';
  document.getElementById('rep_nombre').value = a.rep_nombre||'';
  document.getElementById('rep_apellido').value = a.rep_apellido||'';
  document.getElementById('rep_telefono').value = a.rep_tel||'';
  document.getElementById('rep_email').value = a.rep_email||'';
  document.getElementById('rep_parentesco').value = a.rep_parentesco||'';

  resetPassToggle('clave_atleta');
  window.scrollTo({top:0,behavior:'smooth'});
}

export function guardarAtleta(){
  const msg = document.getElementById('atleta-form-msg');
  hideMsg(msg);
  const ident = normalizarCedula(document.getElementById('identificacion').value);
  const pNom = document.getElementById('p_nombre').value.trim();
  const pApe = document.getElementById('p_apellido').value.trim();
  const repId = normalizarCedula(document.getElementById('rep_identificacion').value);
  const repNom = document.getElementById('rep_nombre').value.trim();
  const repApe = document.getElementById('rep_apellido').value.trim();
  if(!ident || !pNom || !pApe || !repId || !repNom || !repApe){
    return showMsg(msg,'err','Complete los campos obligatorios (*).');
  }

  const idEdit = document.getElementById('atleta_id').value ? Number(document.getElementById('atleta_id').value) : null;

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
    state.db.run(\`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(identificacion) DO UPDATE SET
              nombre=excluded.nombre, apellido=excluded.apellido,
              telefono=excluded.telefono, email=excluded.email, parentesco=excluded.parentesco\`,
      [repId, repNom, repApe,
       document.getElementById('rep_telefono').value.trim(), document.getElementById('rep_email').value.trim(), document.getElementById('rep_parentesco').value]);

    const rep = one('SELECT id FROM representantes WHERE identificacion=?', [repId]);
    if(!rep || !rep.id){
      return showMsg(msg,'err','No se pudo guardar el representante.');
    }

    const claveInput = document.getElementById('clave_atleta').value.trim();
    const s = normalizarCedula(ident).replace(/-/g,'');
    const clave = claveInput || (s.slice(-4) || s);

    let catLimpia = document.getElementById('categoria').value;
    catLimpia = catLimpia.replace(/\\s*\\(\\d+\\s*años\\)/, '');

    if(idEdit){
      state.db.run(\`UPDATE atletas SET identificacion=?, p_nombre=?, s_nombre=?, p_apellido=?, s_apellido=?,
              fn=?, categoria=?, escuela=?, cell=?, telf_emergencia1=?, representante_id=?, clave=?
              WHERE id=?\`,
        [ident, pNom, document.getElementById('s_nombre').value.trim(), pApe, document.getElementById('s_apellido').value.trim(),
         document.getElementById('fn').value||null, catLimpia, document.getElementById('escuela').value.trim(),
         document.getElementById('cell').value.trim(), document.getElementById('telf_emergencia1').value.trim(), rep.id, clave, idEdit]);
    } else {
      state.db.run(\`INSERT INTO atletas(identificacion,p_nombre,s_nombre,p_apellido,s_apellido,
              fn,categoria,escuela,cell,telf_emergencia1,representante_id,clave,deuda,activo)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,1)\`,
        [ident, pNom, document.getElementById('s_nombre').value.trim(), pApe, document.getElementById('s_apellido').value.trim(),
         document.getElementById('fn').value||null, catLimpia, document.getElementById('escuela').value.trim(),
         document.getElementById('cell').value.trim(), document.getElementById('telf_emergencia1').value.trim(), rep.id, clave]);
    }
    guardarBDEnIDB();
    renderAtletas();
    if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
    limpiarFormAtleta();
    showMsg(msg,'ok','Atleta guardado.');

    if (typeof window.subirAGitHub === 'function') window.subirAGitHub().catch(err=>console.warn('Sync post-atleta:', err));

  }catch(e){
    showMsg(msg,'err','Error al guardar: '+e.message);
  }
}
`
    }
  ]
};