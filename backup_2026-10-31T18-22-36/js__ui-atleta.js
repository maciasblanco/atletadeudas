/* ============================================================
   ui-atleta.js — Lógica de la interfaz del atleta
   ============================================================ */
import { state } from './state.js';
import { one, all, getConfig, setConfig, guardarBDEnIDB } from './db.js';
import { hoyISO, fmt, normalizarCedula, showMsg, hideMsg } from './utils.js';
import { calcularDeudaAtleta, calcularMoraAtleta, resumenDeudaAtleta, fechaQuincenaActual, calcularNumeroQuincena } from './quincenas.js';
import { mostrarVista } from './ui-shared.js';

export function loginAtleta(){
  const msg = document.getElementById('login-msg');
  hideMsg(msg);
  const ced = normalizarCedula(document.getElementById('login-cedula').value);
  const clave = document.getElementById('login-clave').value.trim();
  if(!ced || !clave) return showMsg(msg,'err','Ingrese cédula y clave.');
  const a = one('SELECT * FROM atletas WHERE identificacion=? AND activo=1', [ced]);
  if(!a) return showMsg(msg,'err','Atleta no encontrado.');
  
  const clavePorDefecto = (ident) => {
    const s = normalizarCedula(ident).replace(/-/g,'');
    return s.slice(-4) || s;
  };
  const claveEsperada = a.clave || clavePorDefecto(a.identificacion);
  if(clave !== claveEsperada){
    return showMsg(msg,'err','Clave incorrecta.');
  }
  state.usuarioActual = a;
  window.usuarioActual = a; 
  mostrarVista('view-atleta');
  renderVistaAtleta();
}

export function renderVistaAtleta(){
  if(!state.usuarioActual || !state.usuarioActual.id) return;
  const a = one(`SELECT a.*, r.nombre AS rep_nombre, r.apellido AS rep_apellido, r.telefono AS rep_tel
                 FROM atletas a LEFT JOIN representantes r ON r.id=a.representante_id
                 WHERE a.id=?`, [state.usuarioActual.id]);
  if(!a) return;
  
  document.getElementById('atleta-nombre').textContent = `${a.p_nombre||''} ${a.p_apellido||''}`.trim() || '—';
  document.getElementById('atleta-cedula').textContent = a.identificacion||'—';

  const d = calcularDeudaAtleta(a.id);
  const deudaBs = document.getElementById('atleta-deuda-bs');
  if(deudaBs){
    deudaBs.textContent = `${fmt(d.total_bs)} Bs`;
    deudaBs.style.color = d.total_bs > 0 ? '#fbbf24' : '#10b981';
  }
  const deudaUsd = document.getElementById('atleta-deuda-usd');
  if(deudaUsd){
    deudaUsd.textContent = d.total_usd > 0
      ? `≈ ${fmt(d.total_usd)} USD (tasa ${fmt(d.tasa)} Bs/$)`
      : 'Sin deuda pendiente';
  }
  const deudaDet = document.getElementById('atleta-deuda-detalle');
  if(deudaDet){
    deudaDet.textContent = d.debidas > 0
      ? `${d.debidas} quincena${d.debidas===1?'':'s'} × ${fmt(d.monto_quincena_usd)} USD = ${fmt(d.total_bs)} Bs`
      : `Al día`;
  }

  const m = calcularMoraAtleta(a.id);
  const elEstado = document.getElementById('atleta-estado');
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

  const pend = all(`SELECT monto FROM pagos WHERE atleta_id=? AND estado='pendiente'`, [a.id]);
  const avisoAnterior = document.getElementById('atleta-pend-aviso');
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
                     FROM pagos p WHERE p.atleta_id=? ORDER BY p.fecha DESC, p.id DESC LIMIT 50`, [a.id]);
  document.getElementById('atleta-pagos-tbody').innerHTML = pagos.map(p=>{
    const badgeClase = p.estado==='pagado' ? 'ok' : (p.estado==='pendiente' ? 'warn' : 'err');
    return `<tr>
      <td>${p.fecha||''}</td>
      <td>${fmt(p.monto)}</td>
      <td>${p.referencia||''}</td>
      <td>${p.numero_quincena?`#${p.numero_quincena}`:''}</td>
      <td><span class="badge ${badgeClase}">${p.estado||''}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="muted center">Sin pagos.</td></tr>`;

  // Render del resumen interno
  const cont = document.getElementById('ra-resumen');
  if(cont && state.usuarioActual && state.usuarioActual.id){
    const r = resumenDeudaAtleta(state.usuarioActual.id);
    const listaDebidas = r.debidas_nums.length ? r.debidas_nums.map(n=>`#${n}`).join(', ') : '—';
    const listaPend = r.pendientes_nums.length ? r.pendientes_nums.map(n=>`#${n}`).join(', ') : '—';
    if(r.debidas === 0 && r.pendientes_nums.length === 0){
      cont.innerHTML = `<div style="color:#10b981;font-weight:600">✅ Estás al día. No tenés quincenas debidas.</div>`;
    } else {
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
  }

  // Cargar métodos en el select
  const sel = document.getElementById('ra-metodo');
  if(sel){
    const rows = all(`SELECT id, nombre FROM metodos_pago WHERE activo=1 ORDER BY nombre`);
    sel.innerHTML = '<option value="">— Seleccione —</option>' +
      rows.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('');
  }
}

export function reportarAporteAtleta(){
  const msg = document.getElementById('ra-msg');
  hideMsg(msg);
  if(!state.usuarioActual || !state.usuarioActual.id){
    return showMsg(msg,'err','Sesión no detectada. Volvé a iniciar sesión.');
  }
  const monto = Number(document.getElementById('ra-monto').value);
  const metodoId = Number(document.getElementById('ra-metodo').value);
  const referencia = (document.getElementById('ra-referencia').value||'').trim();
  const nota = (document.getElementById('ra-nota').value||'').trim();

  if(!monto || monto <= 0) return showMsg(msg,'err','Ingresá un monto válido.');
  if(!metodoId)            return showMsg(msg,'err','Seleccioná un método de pago.');

  const fecha = hoyISO();
  const fechaQ = fechaQuincenaActual();
  const numQ = calcularNumeroQuincena(fechaQ);

  const dup = one(`SELECT id FROM pagos WHERE atleta_id=? AND metodo_pago_id=?
                   AND IFNULL(referencia,'')=? AND fecha=?`,
                  [state.usuarioActual.id, metodoId, referencia, fecha]);
  if(dup){
    return showMsg(msg,'err','Ya reportaste un aporte con esa referencia hoy.');
  }

  try{
    state.db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
            monto,moneda,monto_bs_original,tasa,referencia,observacion,estado,pendiente_subir)
            VALUES(?,?,?,?,?,?,?,?,?,?,?, 'pendiente', 1)`,
      [state.usuarioActual.id, metodoId, fecha, fechaQ, numQ,
       monto, 'USD', 0, Number(getConfig('tasa_dolar','36.50'))||0,
       referencia, nota]);

    guardarBDEnIDB();

    document.getElementById('ra-monto').value = '';
    document.getElementById('ra-metodo').value = '';
    document.getElementById('ra-referencia').value = '';
    document.getElementById('ra-nota').value = '';

    showMsg(msg,'ok','✅ Aporte enviado. Queda pendiente de verificación del administrador.');
    renderVistaAtleta();

    if (typeof window.subirAGitHub === 'function') {
      window.subirAGitHub().catch(err=>console.warn('Sync post-aporte:', err));
    }
  }catch(e){
    showMsg(msg,'err','Error al guardar el aporte: '+e.message);
  }
}