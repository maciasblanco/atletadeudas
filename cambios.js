/* ============================================================
   cambios.js — Actualizar la versión del Service Worker
   ============================================================ */

module.exports = {
  descripcion: 'Cambiar la versión del caché de la PWA para forzar actualización',
  operaciones: [
    {
      tipo: 'reemplazar',
      archivo: 'sw.js',
      buscar: `const CACHE = 'atletadeudas-v15';`,
      reemplazo: `const CACHE = 'atletadeudas-v16';`
    }
  ]
};