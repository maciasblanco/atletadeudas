/* ============================================================
   app.js — El Jefe de la aplicación
   ============================================================ */
import { state } from './js/state.js';
import * as utils from './js/utils.js';
import * as db from './js/db.js';
import * as schema from './js/schema.js';
import * as categorias from './js/categorias.js';
import * as quincenas from './js/quincenas.js';
import * as bcv from './js/bcv.js';
import * as github from './js/github.js';
import * as uiShared from './js/ui-shared.js';
import * as uiAtleta from './js/ui-atleta.js';
import * as uiAdminAtletas from './js/ui-admin-atletas.js';
import * as uiAdminPagos from './js/ui-admin-pagos.js';
import { wireEvents } from './js/events.js';
import initSqlJs from 'https://esm.run/@webreflection/sql.js';

/* ============================================================
   1. Inyectamos TODO en window para que HTML y módulos se comuniquen
   ============================================================ */
Object.assign(window, utils);
Object.assign(window, db);
Object.assign(window, schema);
Object.assign(window, categorias);
Object.assign(window, quincenas);
Object.assign(window, bcv);
Object.assign(window, github);
Object.assign(window, uiShared);
Object.assign(window, uiAtleta);
Object.assign(window, uiAdminAtletas);
Object.assign(window, uiAdminPagos);

window.state = state;
window.tasaBCVFecha = state.tasaBCVFecha;
window.usuarioActual = state.usuarioActual;
window.GH_RAW = state.GH_RAW;
window.IDB_KEY = state.IDB_KEY;

/* ============================================================
   2. Función auxiliar: recalcular categorías desde fecha de nacimiento
   ============================================================ */
window.recalcularCategoriasDesdeFN = async function() {
  const atletas = window.all(
    `SELECT id, identificacion, p_nombre, p_apellido, fn, categoria
       FROM atletas
      WHERE activo=1
      ORDER BY p_apellido, p_nombre`
  );
  if(atletas.length === 0) return;

  let actualizados = 0;
  for(const a of atletas){
    if(!a.fn) continue;
    const catNueva = window.calcularCategoriaPorEdad(a.fn);
    if(catNueva && catNueva !== a.categoria){
      state.db.run(`UPDATE atletas SET categoria=? WHERE id=?`, [catNueva, a.id]);
      actualizados++;
    }
  }
  await window.guardarBDEnIDB();
  window.renderAtletas();
  window.refrescarAdmin();
  window.showMsg(
    document.getElementById('recalc-msg'),
    'ok',
    `✅ Categorías recalculadas: ${actualizados} atleta(s).`
  );
};

console.log('✅ Fase 5 lista: Interfaz y Eventos cargados.');

/* ============================================================
   3. Arranque de la aplicación
   ============================================================ */
window.addEventListener('load', async () => {
  try {
    // Delay defensivo para PWABuilder / Puppeteer (registro de SW + manifest)
    await new Promise(r => setTimeout(r, 500));

    console.log("⏳ Iniciando SQLite...");
    window.SQL = await initSqlJs({
      locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${f}`
    });

    const bytes = await window.idbGet(state.IDB_KEY);
    window.db = bytes ? new window.SQL.Database(bytes) : new window.SQL.Database();

    state.db = window.db;
    state.SQL = window.SQL;

    console.log("⏳ Creando esquema...");
    window.crearSchema();
    await window.guardarBDEnIDB();

    console.log("⏳ Mostrando interfaz...");

    // Ocultar carga, mostrar login
    const loading = document.getElementById('view-loading');
    if (loading) loading.classList.add('hidden');
    const loginView = document.getElementById('view-login');
    if (loginView) loginView.classList.remove('hidden');

    // Conectar eventos
    wireEvents();
    window.limpiarFormAtleta();
    window.limpiarFormPago();

    // Actualizar tasa BCV en segundo plano
    window.actualizarTasaBCV(true).catch(console.warn);

    console.log("✅ ¡Interfaz cargada con éxito!");

    // Sincronización automática en el primer arranque del dispositivo
    if (!bytes) {
      console.log('Primera vez en este dispositivo. Sincronizando automáticamente...');
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

        const r = await window.sincronizarDesdeGitHub();

        loadMsg.remove();

        if (r.ok) {
          window.avisar(
            `✅ ¡Datos cargados satisfactoriamente!\n\n` +
            `Atletas nuevos: ${r.nuevos}\n` +
            `Atletas actualizados: ${r.actualizados}\n` +
            `Pagos nuevos: ${r.pagosNuevos}`
          );
          window.refrescarAdmin();
        } else {
          window.avisar(
            `⚠️ La aplicación se abrió, pero no se pudo conectar con GitHub automáticamente.\n\n` +
            `Error: ${r.error}\n\nPor favor, revisa tu conexión a internet.`
          );
        }
      }, 500);
    }

  } catch (e) {
    console.error("❌ Error crítico en el arranque:", e);
    document.body.innerHTML = '<div class="card"><h1>Error</h1><p class="muted">' + e.message + '</p></div>';
  }
});