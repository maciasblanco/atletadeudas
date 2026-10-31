/* ============================================================
   ui-admin-atletas.js — Tabla y Formulario de Atletas
   ============================================================ */
import { state } from './state.js';
import { one, all, getConfig, setConfig, guardarBDEnIDB } from './db.js';
import { hoyISO, fmt, normalizarCedula, showMsg, hideMsg, avisar, confirmar, resetPassToggle } from './utils.js';
import { calcularMoraAtleta, calcularDeudaAtleta } from './quincenas.js';
import { calcularCategoriaPorEdad } from './categorias.js';

export async function eliminarAtleta(id){
  if(!confirmar('¿Desactivar este atleta? Dejará de aparecer en la lista, pero sus pagos se conservarán.')) return;
  state.db.run('UPDATE atletas SET activo=0 WHERE id=?', [id]);
  await guardarBDEnIDB();
  renderAtletas();
  if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();

  const msg = document.getElementById('atleta-form-msg');
  if(typeof window.subirAGitHub === 'function') {
    if(msg) window.showMsg(msg, 'info', 'Sincronizando cambio con GitHub...');
    const res = await window.subirAGitHub();
    if(msg){
      if(res.ok) window.showMsg(msg, 'ok', '✅ Atleta desactivado y actualizado en GitHub.');
      else window.showMsg(msg, 'err', '⚠️ Desactivado localmente, pero falló GitHub.');
    }
  }
}

export function renderAtletas(){
  const tb = document.getElementById('atletas-tbody'); 
  if(!tb) return;
  const filtro = (document.getElementById('buscar-atleta')?.value||'').trim().toLowerCase();
  
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
    
    let badge = '';
    if(m.estado === 'sin_inicio'){
      badge = `<span class="badge" style="background:#1e2a45;color:#9aa7c7">Sin iniciar</span>`;
    } else if(m.estado === 'ok'){
      badge = `<span class="badge ok">✅ Al día</span>`;
    } else {
      const extra = (deudaMostrar > 0) ? ` · ${fmt(deudaMostrar)} Bs` : '';
      if(m.estado === 'mora'){
        badge = `<span class="badge warn">⚠️ Mora: ${m.debidas}${extra}</span>`;
      } else {
        badge = `<span class="badge err">🚫 NO PRACTICA (${m.debidas})${extra}</span>`;
      }
    }

    return `<tr class="${filaClase}">
      <td>${a.identificacion||''}</td>
      <td>${nombre}</td>
      <td>${rep||'—'}</td>
      <td>${a.categoria||'—'}</td>
      <td style="color:#fbbf24">${fmt(deudaMostrar)} Bs</td>
      <td>${badge}</td>
      <td class="acciones">
        <button data-id="${a.id}" data-acc="edit">✏️</button>
        <button class="err" data-id="${a.id}" data-acc="delete">🗑️</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="muted center">Sin atletas.</td></tr>`;

  tb.querySelectorAll('button[data-acc="edit"]').forEach(b=>{
    b.onclick = ()=>editarAtleta(Number(b.dataset.id));
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
      selectCat.options[i].text = selectCat.options[i].text.replace(/\s*\(\d+\s*años\)/, '');
    }
  }
  resetPassToggle('clave_atleta');
}

export function editarAtleta(id){
  const a = one(`
    SELECT a.*, r.identificacion AS rep_id, r.nombre AS rep_nombre, r.apellido AS rep_apellido,
           r.telefono AS rep_tel, r.email AS rep_email, r.parentesco AS rep_parentesco
      FROM atletas a
      LEFT JOIN representantes r ON r.id = a.representante_id
     WHERE a.id=?`, [id]);
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
    state.db.run(`INSERT INTO representantes(identificacion,nombre,apellido,telefono,email,parentesco)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(identificacion) DO UPDATE SET
              nombre=excluded.nombre, apellido=excluded.apellido,
              telefono=excluded.telefono, email=excluded.email, parentesco=excluded.parentesco`,
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
    catLimpia = catLimpia.replace(/\s*\(\d+\s*años\)/, '');

    if(idEdit){
      state.db.run(`UPDATE atletas SET identificacion=?, p_nombre=?, s_nombre=?, p_apellido=?, s_apellido=?,
              fn=?, categoria=?, escuela=?, cell=?, telf_emergencia1=?, representante_id=?, clave=?
              WHERE id=?`,
        [ident, pNom, document.getElementById('s_nombre').value.trim(), pApe, document.getElementById('s_apellido').value.trim(),
         document.getElementById('fn').value||null, catLimpia, document.getElementById('escuela').value.trim(),
         document.getElementById('cell').value.trim(), document.getElementById('telf_emergencia1').value.trim(), rep.id, clave, idEdit]);
    } else {
      state.db.run(`INSERT INTO atletas(identificacion,p_nombre,s_nombre,p_apellido,s_apellido,
              fn,categoria,escuela,cell,telf_emergencia1,representante_id,clave,deuda,activo)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,1)`,
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

// --- PARCHE: Evento para botón eliminar atleta ---
const _origRenderAtletas = renderAtletas;
renderAtletas = function(){
  _origRenderAtletas();
  const tb = document.getElementById('atletas-tbody');
  if(!tb) return;
  tb.querySelectorAll('button[data-acc="delete"]').forEach(b=>{
    b.onclick = async ()=> {
      const id = Number(b.dataset.id);
      if(confirmar('¿Desactivar este atleta? Dejará de aparecer en la lista, pero sus pagos se conservarán.')){
        state.db.run('UPDATE atletas SET activo=0 WHERE id=?', [id]);
        await guardarBDEnIDB();
        renderAtletas();
        if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
        
        const msg = document.getElementById('atleta-form-msg');
        if(typeof window.subirAGitHub === 'function') {
          if(msg) showMsg(msg, 'info', 'Sincronizando borrado con GitHub...');
          const res = await window.subirAGitHub();
          if(res.ok) {
            if(msg) showMsg(msg, 'ok', '✅ Atleta eliminado y actualizado en GitHub.');
          } else {
            if(msg) showMsg(msg, 'err', '⚠️ Eliminado localmente, pero falló en GitHub. Revisa internet.');
          }
        }
      }
    };
  });
};