/* ============================================================
   cambios.js — Limpieza total de caché y actualización forzada
   ============================================================ */

module.exports = {
  descripcion: 'Forzar actualizacion a v17 y limpiar cache vieja',
  operaciones: [
    {
      tipo: 'reemplazar',
      archivo: 'sw.js',
      buscar: `const CACHE = 'atletadeudas-v16';`,
      reemplazo: `const CACHE = 'atletadeudas-v17';`
    }
  ]
};