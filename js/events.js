/* ============================================================
   events.js — Conexión de los botones y eventos del DOM
   ============================================================ */
import { state } from './state.js';
import { $, hoyISO, wirePasswordToggles } from './utils.js';
import { mostrarVista } from './ui-shared.js';
import { renderPagos, registrarPago, limpiarFormPago, actualizarNumeroQuincena, renderResumenPagoAdmin, actualizarCoberturaPago, refrescarAdmin } from './ui-admin-pagos.js';
import { limpiarFormAtleta, guardarAtleta } from './ui-admin-atletas.js';

export function wireEvents(){
  const on = (id, fn) => { const el = $(id); if(el) el.onclick = fn; };
  const onEvent = (id, evt, fn) => { const el = $(id); if(el) el.addEventListener(evt, fn); };

  // 1. Botones de ojo (mostrar/ocultar claves)
  wirePasswordToggles();

  // 2. Botones de Login (unificados: misma cédula + misma clave)
  on('btn-login-atleta', () => window.loginAtleta());
  on('btn-login-admin', () => window.loginAdmin());

  // 3. Logout
  on('btn-logout-atleta', ()=>{ state.usuarioActual=null; window.usuarioActual=null; mostrarVista('view-login'); });
  on('btn-logout-admin', ()=>{ state.usuarioActual=null; window.usuarioActual=null; mostrarVista('view-login'); });

  // 4. Reportar aporte / Ver pagos
  on('btn-ver-pagos', ()=> $('atleta-pagos-card').classList.toggle('hidden'));
  on('btn-reportar-aporte', () => window.reportarAporteAtleta());

  // 5. Pestañas del Admin
  document.querySelectorAll('#admin-tabs button').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#admin-tabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      ['atletas','pagos','config'].forEach(t=>{
        const tabEl = $('tab-'+t);
        if(tabEl) tabEl.classList.toggle('hidden', t!==b.dataset.tab);
      });
      if(b.dataset.tab === 'pagos') window.renderPagosPendientes();
    };
  });

  // 6. Formulario Atleta
  const formGuardarAtleta = $('form-atleta');
  if(formGuardarAtleta) formGuardarAtleta.onsubmit = (e)=>{ e.preventDefault(); guardarAtleta(); };
  on('btn-limpiar-atleta', limpiarFormAtleta);

  const buscarAtleta = $('buscar-atleta');
  if(buscarAtleta) buscarAtleta.oninput = () => window.renderAtletas();

  // 7. Formulario Pago
  const formPago = $('form-pago');
  if(formPago) formPago.onsubmit = (e)=>{ e.preventDefault(); registrarPago(); };
  on('btn-limpiar-pago', limpiarFormPago);

  onEvent('fecha_quincena', 'change', ()=>{
    actualizarNumeroQuincena();
    actualizarCoberturaPago();
  });
  onEvent('monto', 'input', actualizarCoberturaPago);
  onEvent('pago_atleta', 'change', renderResumenPagoAdmin);

  // 8. Calcular categoría y edad automáticamente
  onEvent('fn', 'change', (e) => {
    const fecha = e.target.value;
    const selectCat = $('categoria');
    if (fecha && selectCat) {
      const catCalculada = window.calcularCategoriaPorEdad(fecha);
      const edad = window.calcularEdad(fecha);
      for (let i = 0; i < selectCat.options.length; i++) {
        selectCat.options[i].text = selectCat.options[i].text.replace(/\s*\(\d+\s*años\)/, '');
      }
      selectCat.value = catCalculada;
      if (selectCat.value === catCalculada) {
        const selectedOption = selectCat.options[selectCat.selectedIndex];
        selectedOption.text = `${catCalculada} (${edad} años)`;
      }
    }
  });

  // 9. Configuración (incluye cédula admin opcional)
  on('btn-guardar-config', ()=>{
    window.setConfig('monto_quincena', $('c-monto-quincena').value);
    window.setConfig('tasa_dolar', $('c-tasa-dolar').value);
    window.setConfig('clave_admin', $('c-clave-admin').value);
    window.setConfig('cedula_admin', $('c-cedula-admin').value.trim());
    window.setConfig('fecha_corte_quincena', $('c-fecha-corte').value);
    window.guardarBDEnIDB();
    window.showMsg($('config-msg'),'ok','Configuración guardada.');
    refrescarAdmin();
  });

  on('btn-tasa-bcv', ()=> window.actualizarTasaBCV(false));

  // 10. GitHub
  on('btn-guardar-gh', ()=>{
    window.setConfig('github_usuario', $('c-gh-user').value.trim());
    window.setConfig('github_repo', $('c-gh-repo').value.trim());
    window.setConfig('github_ruta', $('c-gh-ruta').value.trim()||'datos/atletas.json');
    window.setConfig('github_rama', $('c-gh-rama').value.trim()||'main');
    window.setConfig('github_token', $('c-gh-token').value.trim());
    window.guardarBDEnIDB();
    window.showMsg($('gh-msg'),'ok','GitHub guardado.');
  });

  on('btn-subir-gh', async ()=>{
    window.showMsg($('gh-msg'),'info','Subiendo…');
    const r = await window.subirAGitHub();
    if(r.ok) window.showMsg($('gh-msg'),'ok',`Subido OK (${r.nAtletas} atletas, ${r.nPagos} pagos).`);
    else window.showMsg($('gh-msg'),'err', r.error);
    refrescarAdmin();
  });

  on('btn-bajar-gh', async ()=>{
    window.showMsg($('gh-msg'),'info','Sincronizando…');
    const r = await window.sincronizarDesdeGitHub();
    if(r.ok){
      window.showMsg($('gh-msg'),'ok',`OK. Nuevos: ${r.nuevos}, Actualizados: ${r.actualizados}, Pagos nuevos: ${r.pagosNuevos}`);
      refrescarAdmin();
    } else {
      window.showMsg($('gh-msg'),'err', r.error);
    }
  });

  // 11. Botón circular "Actualizar sistema" (login)
  on('btn-sync-login', async ()=>{
    const btn = $('btn-sync-login');
    if(btn) btn.classList.add('syncing');
    window.showMsg($('sync-login-msg'),'info','Actualizando…');
    const r = await window.sincronizarDesdeGitHub();
    if(btn) btn.classList.remove('syncing');
    if(r.ok) window.showMsg($('sync-login-msg'),'ok',`OK. Nuevos: ${r.nuevos}, Actualizados: ${r.actualizados}`);
    else window.showMsg($('sync-login-msg'),'err', r.error);
  });

  // 12. Botón circular "Actualizar sistema" (atleta)
  on('btn-sync-atleta', async ()=>{
    const btn = $('btn-sync-atleta');
    if(btn) btn.classList.add('syncing');
    window.showMsg($('sync-atleta-msg'),'info','Actualizando…');
    const r = await window.sincronizarDesdeGitHub();
    if(btn) btn.classList.remove('syncing');
    if(r.ok){
        window.showMsg($('sync-atleta-msg'),'ok','Sincronizado.');
        window.renderVistaAtleta();
    } else {
        window.showMsg($('sync-atleta-msg'),'err', r.error);
    }
  });

  // Herramientas
  on('btn-recalcular-categorias', () => window.recalcularCategoriasDesdeFN());

  on('btn-respaldar', ()=>{
    const data = state.db.export();
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
    state.db = new state.SQL.Database(buf);
    window.crearSchema();
    await window.guardarBDEnIDB();
    window.showMsg($('backup-msg'),'ok','Respaldo restaurado.');
    refrescarAdmin();
  };
}