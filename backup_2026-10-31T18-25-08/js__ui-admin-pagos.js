/* ============================================================
   ui-admin-pagos.js — Pagos, configuración y admin
   ============================================================ */
import { state } from './state.js';
import { one, all, getConfig, setConfig, guardarBDEnIDB } from './db.js';
import { hoyISO, fmt, normalizarCedula, showMsg, hideMsg, avisar, confirmar, resetPassToggle } from './utils.js';
import { calcularNumeroQuincena, fechaQuincenaActual, quincenaActualNumero, estadoQuincenaAtleta, calcularMoraAtleta, resumenDeudaAtleta } from './quincenas.js';
import { mostrarVista } from './ui-shared.js';

/* ============================================================
   LOGIN ADMIN (unificado: lee del mismo formulario del atleta)
   ============================================================ */
export function loginAdmin(){
  const msg = document.getElementById('login-msg');
  hideMsg(msg);

  const ced = normalizarCedula(document.getElementById('login-cedula').value);
  const clave = document.getElementById('login-clave').value.trim();

  if(!clave) return showMsg(msg,'err','Ingrese la clave de administrador.');

  // Si hay cédula admin configurada, se exige también
  const cedulaAdmin = getConfig('cedula_admin', '');
  if(cedulaAdmin && ced !== normalizarCedula(cedulaAdmin)){
    return showMsg(msg,'err','Cédula de administrador incorrecta.');
  }

  if(clave !== getConfig('clave_admin','admin123')){
    return showMsg(msg,'err','Clave admin incorrecta.');
  }

  state.usuarioActual = {rol:'admin'};
  window.usuarioActual = state.usuarioActual;
  mostrarVista('view-admin');
  refrescarAdmin();
  if (typeof window.actualizarTasaBCV === 'function') {
    window.actualizarTasaBCV(true);
  }
}

/* ============================================================
   REFRESCAR PANEL ADMIN
   ============================================================ */
export function refrescarAdmin(){
  // Cargar tablas
  if (typeof window.renderAtletas === 'function') window.renderAtletas();
  renderPagos();
  
  // Cargar selects
  const selMetodos = document.getElementById('metodo_pago_id');
  if(selMetodos){
    const rows = all(`SELECT id, nombre FROM metodos_pago WHERE activo=1 ORDER BY nombre`);
    selMetodos.innerHTML = '<option value="">— Seleccione —</option>' +
      rows.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('');
  }

  const selAtletas = document.getElementById('pago_atleta');
  if(selAtletas){
    const rows = all(`SELECT id, identificacion, p_nombre, p_apellido FROM atletas WHERE activo=1 ORDER BY p_apellido, p_nombre`);
    selAtletas.innerHTML = '<option value="">— Seleccione —</option>' +
      rows.map(r=>`<option value="${r.id}">${r.p_apellido||''} ${r.p_nombre||''} (${r.identificacion})</option>`).join('');
  }

  // Cargar inputs de config
  document.getElementById('c-monto-quincena').value = getConfig('monto_quincena','5');
  document.getElementById('c-tasa-dolar').value = getConfig('tasa_dolar','36.50');
  document.getElementById('c-clave-admin').value = getConfig('clave_admin','admin123');
  document.getElementById('c-cedula-admin').value = getConfig('cedula_admin',''); // NUEVO
  document.getElementById('c-fecha-corte').value = getConfig('fecha_corte_quincena','2026-09-29');
  document.getElementById('c-gh-user').value = getConfig('github_usuario','');
  document.getElementById('c-gh-repo').value = getConfig('github_repo','');
  document.getElementById('c-gh-ruta').value = getConfig('github_ruta','datos/atletas.json');
  document.getElementById('c-gh-rama').value = getConfig('github_rama','main');
  document.getElementById('c-gh-token').value = getConfig('github_token','');
  
  const t = document.getElementById('tasa'); 
  if(t) t.value = getConfig('tasa_dolar','36.50');
  
  const fq = document.getElementById('fecha_quincena');
  if(fq && !fq.value) fq.value = fechaQuincenaActual();
  actualizarNumeroQuincena();

  resetPassToggle('c-clave-admin');
  resetPassToggle('c-gh-token');

  const info = document.getElementById('tasa-bcv-info');
  if(info){
    const f = getConfig('tasa_bcv_fecha','');
    const act = getConfig('tasa_bcv_actualizado','');
    info.textContent = f
      ? `BCV: ${fmt(getConfig('tasa_dolar','36.50'))} Bs/$ · Vigencia: ${f} · Actualizado: ${act ? new Date(act).toLocaleString('es-VE') : '—'}`
      : '';
  }

  // Panel de diagnóstico
  const nA = all('SELECT COUNT(*) AS n FROM atletas')[0]?.n || 0;
  const nP = all('SELECT COUNT(*) AS n FROM pagos')[0]?.n || 0;
  const pend = all('SELECT COUNT(*) AS n FROM pagos WHERE pendiente_subir=1')[0]?.n || 0;
  const nPendVerif = all(`SELECT COUNT(*) AS n FROM pagos WHERE estado='pendiente'`)[0]?.n || 0;
  const qAct = quincenaActualNumero();
  const moras = all('SELECT id FROM atletas WHERE activo=1').map(a=>calcularMoraAtleta(a.id));
  const enMora = moras.filter(m=>m.estado==='mora').length;
  const morosos = moras.filter(m=>m.estado==='no_practica').length;
  
  const diag = document.getElementById('diag');
  if(diag) {
    diag.textContent =
      `Atletas: ${nA} · Pagos: ${nP} (${pend} pend. subir, ${nPendVerif} por verificar) · ` +
      `schema_version: ${getConfig('schema_version','?')} · tasa_dolar: ${getConfig('tasa_dolar','?')} · ` +
      `monto_quincena: ${getConfig('monto_quincena','?')} USD · ` +
      `corte: ${getConfig('fecha_corte_quincena','?')} · ` +
      `quincena actual: ${qAct} · en mora: ${enMora} · NO practican: ${morosos}`;
  }
}

/* ============================================================
   UTILIDADES DE FORMULARIO PAGO
   ============================================================ */
export function actualizarNumeroQuincena(){
  const fq = document.getElementById('fecha_quincena').value;
  const n = calcularNumeroQuincena(fq);
  document.getElementById('numero_quincena').value = n || '';
}

export function limpiarFormPago(){
  ['monto','monto_bs','referencia','banco_origen','telefono_origen','observacion'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('fecha').value = hoyISO();
  document.getElementById('fecha_quincena').value = fechaQuincenaActual();
  document.getElementById('numero_quincena').value = '';
  document.getElementById('estado').value = 'pagado';
  document.getElementById('metodo_pago_id').value = '';
  document.getElementById('pago_atleta').value = '';
  const t = document.getElementById('tasa'); if(t) t.value = getConfig('tasa_dolar','36.50');
  actualizarNumeroQuincena();

  const r = document.getElementById('pago-resumen-atleta'); if(r) r.style.display = 'none';
  const c = document.getElementById('pago-cobertura'); if(c) c.style.display = 'none';
}

/* ============================================================
   RENDER DE PAGOS
   ============================================================ */
export function renderPagos(){
  const tb = document.getElementById('pagos-tbody'); if(!tb) return;
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

export function renderPagosPendientes(){
  const cont = document.getElementById('lista-pagos-pendientes');
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

/* ============================================================
   APROBAR / RECHAZAR
   ============================================================ */
export function aprobarPago(pagoId){
  if(!confirmar('¿Confirmas que el aporte fue recibido? Se descontarán todas las quincenas que cubra este monto.')) return;
  try{
    const p = one(`SELECT id, atleta_id, monto FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    if(!p){ avisar('El pago no existe o ya fue procesado.'); return; }

    const montoQuincena = Number(getConfig('monto_quincena','5')) || 5;
    const cantQuincenas = Math.floor(Number(p.monto) / montoQuincena);

    const r = resumenDeudaAtleta(p.atleta_id);
    const quincenasDebidas = r.debidas_nums;

    if (quincenasDebidas.length > 0) {
      state.db.run(`UPDATE pagos SET estado='pagado', numero_quincena=? WHERE id=?`, [quincenasDebidas[0], pagoId]);
    } else {
      state.db.run(`UPDATE pagos SET estado='pagado' WHERE id=?`, [pagoId]);
    }

    let restantes = cantQuincenas - 1;
    for (let i = 1; i < quincenasDebidas.length && restantes > 0; i++) {
      state.db.run(`INSERT INTO pagos(atleta_id, monto, fecha, numero_quincena, estado, pendiente_subir)
              VALUES(?, 0, date('now'), ?, 'pagado', 1)`, [p.atleta_id, quincenasDebidas[i]]);
      restantes--;
    }

    state.db.run(`UPDATE atletas SET deuda = MAX(0, deuda - ?) WHERE id=?`, [Number(p.monto)||0, p.atleta_id]);

    guardarBDEnIDB();
    renderPagosPendientes();
    renderPagos();
    if (typeof window.renderAtletas === 'function') window.renderAtletas();
    if(state.usuarioActual && state.usuarioActual.rol === 'admin') refrescarAdmin();

    avisar(`✅ Pago aprobado. Cubrió ${cantQuincenas > 0 ? cantQuincenas : 1} quincena(s). La mora fue actualizada.`);
    if (typeof window.subirAGitHub === 'function') window.subirAGitHub().catch(err=>console.warn('Sync post-aprobación:', err));
  }catch(e){
    console.error('Error aprobando pago:', e);
    avisar('❌ Error al aprobar: '+e.message);
  }
}

export function rechazarPago(pagoId){
  if(!confirmar('¿Rechazar y eliminar este aporte? Esta acción no se puede deshacer.')) return;
  try{
    const p = one(`SELECT id FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    if(!p){ avisar('El pago no existe o ya fue procesado.'); return; }
    state.db.run(`DELETE FROM pagos WHERE id=? AND estado='pendiente'`, [pagoId]);
    guardarBDEnIDB();
    renderPagosPendientes();
    renderPagos();
    if (typeof window.renderAtletas === 'function') window.renderAtletas();
    if(state.usuarioActual && state.usuarioActual.rol === 'admin') refrescarAdmin();
    avisar('❌ Aporte rechazado y eliminado.');
    if (typeof window.subirAGitHub === 'function') window.subirAGitHub().catch(err=>console.warn('Sync post-rechazo:', err));
  }catch(e){
    console.error('Error rechazando pago:', e);
    avisar('❌ Error al rechazar: '+e.message);
  }
}

/* ============================================================
   REGISTRAR PAGO MANUAL (admin)
   ============================================================ */
export function registrarPago(){
  const msg = document.getElementById('pago-msg');
  hideMsg(msg);
  const atletaId = Number(document.getElementById('pago_atleta').value);
  const metodoId = Number(document.getElementById('metodo_pago_id').value);
  const fecha = document.getElementById('fecha').value;
  const fechaQ = document.getElementById('fecha_quincena').value;
  const monto = Number(document.getElementById('monto').value);
  const estado = document.getElementById('estado').value;

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

  const ref = document.getElementById('referencia').value.trim();
  const dup = one(`SELECT id FROM pagos WHERE atleta_id=? AND metodo_pago_id=?
                   AND IFNULL(referencia,'')=? AND fecha=?`,
                  [atletaId, metodoId, ref, fecha]);
  if(dup){
    return showMsg(msg,'err','Ya existe un pago igual (atleta + método + ref + fecha).');
  }

  try{
    state.db.run(`INSERT INTO pagos(atleta_id,metodo_pago_id,fecha,fecha_quincena,numero_quincena,
            monto,moneda,monto_bs_original,tasa,referencia,banco_origen,telefono_origen,
            observacion,estado,pendiente_subir)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [atletaId, metodoId, fecha, fechaQ, numQ, monto, 'USD',
       Number(document.getElementById('monto_bs').value)||0, Number(document.getElementById('tasa').value)||0,
       ref, document.getElementById('banco_origen').value.trim(), document.getElementById('telefono_origen').value.trim(),
       document.getElementById('observacion').value.trim(), estado]);

    if(estado==='pagado'){
      const montoQuincena = Number(getConfig('monto_quincena','5')) || 5;
      const cantQuincenas = Math.floor(monto / montoQuincena);

      const r = resumenDeudaAtleta(atletaId);
      const quincenasDebidas = r.debidas_nums;

      let restantes = cantQuincenas - 1;
      for (let i = 1; i < quincenasDebidas.length && restantes > 0; i++) {
        state.db.run(`INSERT INTO pagos(atleta_id, monto, fecha, numero_quincena, estado, pendiente_subir)
                VALUES(?, 0, date('now'), ?, 'pagado', 1)`, [atletaId, quincenasDebidas[i]]);
        restantes--;
      }

      state.db.run(`UPDATE atletas SET deuda = MAX(0, deuda - ?) WHERE id=?`, [monto, atletaId]);
    }

    guardarBDEnIDB();
    renderPagos(); 
    if (typeof window.renderAtletas === 'function') window.renderAtletas();
    limpiarFormPago();

    if(estado === 'pagado'){
      const cant = Math.floor(monto / (Number(getConfig('monto_quincena','5')) || 5));
      showMsg(msg,'ok',`Pago registrado. Se saldaron ${cant > 0 ? cant : 1} quincena(s).`);
    } else {
      showMsg(msg,'ok',`Pago registrado (Pendiente de verificación).`);
    }
    
    if (typeof window.subirAGitHub === 'function') {
      window.subirAGitHub()
        .then(res => {
          if(res.ok) showMsg(msg, 'ok', '✅ Pago registrado y sincronizado en la nube.');
          else showMsg(msg, 'err', '⚠️ Guardado local, pero falló la subida a GitHub: ' + res.error);
        })
        .catch(err => console.warn('Sync post-pago-admin:', err));
    }

  }catch(e){
    showMsg(msg,'err','Error al registrar: '+e.message);
  }
}

/* ============================================================
   RESUMEN Y COBERTURA (al seleccionar atleta / quincena)
   ============================================================ */
export function renderResumenPagoAdmin(){
  const cont = document.getElementById('pago-resumen-atleta');
  const texto = document.getElementById('pago-resumen-texto');
  if(!cont || !texto) return;

  const atletaId = Number(document.getElementById('pago_atleta').value);
  if(!atletaId){
    cont.style.display = 'none';
    const cob = document.getElementById('pago-cobertura');
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

export function actualizarCoberturaPago(){
  const cobertura = document.getElementById('pago-cobertura');
  if(!cobertura) return;

  const atletaId = Number(document.getElementById('pago_atleta').value);
  const fq = document.getElementById('fecha_quincena').value;
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

  const monto = Number(document.getElementById('monto')?.value) || 0;
  const mq = Number(getConfig('monto_quincena','5')) || 5;
  if(monto > 0 && monto % mq === 0 && monto / mq > 1){
    cobertura.textContent += ` 💡 El monto (${fmt(monto)} USD) equivale a ${monto/mq} quincenas, pero esta app registra 1 quincena por pago. Si querés cubrir varias, registrá un pago por cada una.`;
  }
}