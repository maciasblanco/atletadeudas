/* ============================================================
   bcv.js — Conexión con la tasa oficial del BCV
   ============================================================ */
import { state } from './state.js';
import { setConfig } from './db.js';
import { fmt, showMsg } from './utils.js';

export async function obtenerTasaBCV() {
  try {
    const res = await fetch('https://datos.cromstudio.com.ve/tasa', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const tasa = Number(data?.tasas?.USD);
    if (!tasa || tasa <= 0) throw new Error('Tasa USD inválida en la respuesta');
    return {
      ok: true,
      tasa,
      fecha: data.fecha_valor || '',
      actualizado: data.actualizado_el || ''
    };
  } catch (e) {
    console.warn('No se pudo obtener tasa BCV:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function actualizarTasaBCV(silencioso = false) {
  const msgEl = document.getElementById('config-msg');
  if (!silencioso && msgEl) showMsg(msgEl, 'info', 'Consultando BCV…');
  
  const r = await obtenerTasaBCV();
  
  if (r.ok) {
    setConfig('tasa_dolar', r.tasa);
    setConfig('tasa_bcv_fecha', r.fecha);
    setConfig('tasa_bcv_actualizado', r.actualizado);
    window.tasaBCVFecha = r.fecha;
    state.tasaBCVFecha = r.fecha;
    
    const inp = document.getElementById('c-tasa-dolar');
    if (inp) inp.value = r.tasa;
    
    const t = document.getElementById('tasa');
    if (t) t.value = r.tasa;
    
    const info = document.getElementById('tasa-bcv-info');
    if (info) info.textContent = `BCV: ${fmt(r.tasa)} Bs/$ · Vigencia: ${r.fecha || '—'} · Actualizado: ${r.actualizado ? new Date(r.actualizado).toLocaleString('es-VE') : '—'}`;
    
    if (typeof window.guardarBDEnIDB === 'function') await window.guardarBDEnIDB();
    
    if (!silencioso && msgEl) {
      showMsg(msgEl, 'ok', `✅ Tasa BCV actualizada: ${fmt(r.tasa)} Bs/$ (${r.fecha})`);
      if (typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
    }
    return true;
  } else {
    if (!silencioso && msgEl) showMsg(msgEl, 'err', '❌ No se pudo obtener la tasa BCV: ' + r.error);
    return false;
  }
}