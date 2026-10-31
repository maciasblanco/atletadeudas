/* ============================================================
   utils.js — Utilidades generales
   ============================================================ */

export const $ = (id) => document.getElementById(id);
export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString();
export const fmt = (n) => (Number(n) || 0).toFixed(2);

export function normalizarCedula(s) {
  return String(s || '').trim().replace(/[.\s]/g, '');
}

export function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00Z');
  const b = new Date(bISO + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function showMsg(el, tipo, texto) {
  if (!el) return;
  el.className = 'msg show ' + tipo;
  el.textContent = texto;
}

export function hideMsg(el) {
  if (el) { el.className = 'msg'; el.textContent = ''; }
}

/* ---------- Detección de Puppeteer / PWA ---------- */
export const ES_PUPPETEER = navigator.webdriver === true;

export function avisar(msg) {
  if (ES_PUPPETEER) { console.log('[PWA/avisar]', msg); } else { alert(msg); }
}

export function confirmar(msg) {
  if (ES_PUPPETEER) { console.log('[PWA/confirmar]', msg, '→ auto: true'); return true; }
  return confirm(msg);
}

/* ---------- Mostrar / Ocultar contraseñas ---------- */
export function wirePasswordToggles() {
  document.querySelectorAll('button[data-toggle-pass]').forEach(btn => {
    if (btn.dataset.passWired === '1') return;
    btn.dataset.passWired = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const input = $(btn.dataset.togglePass);
      if (!input) return;
      const mostrando = input.type === 'text';
      input.type = mostrando ? 'password' : 'text';
      btn.textContent = mostrando ? '👁' : '🙈';
      btn.setAttribute('aria-label', mostrando ? 'Mostrar clave' : 'Ocultar clave');
      try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    });
  });
}

export function resetPassToggle(inputId) {
  const input = $(inputId);
  if (input) input.type = 'password';
  const btn = document.querySelector(`button[data-toggle-pass="${inputId}"]`);
  if (btn) { btn.textContent = '👁'; btn.setAttribute('aria-label', 'Mostrar clave'); }
}


/* --- Formato de moneda venezolano --- */
export const fmtVE = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};