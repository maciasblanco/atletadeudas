/* ============================================================
   cambios.js — Reparar conexión de eventos de Asistencia
   ============================================================ */

module.exports = {
  descripcion: 'Conectar los botones de la pestaña Asistencia en events.js',
  operaciones: [
    {
      tipo: 'reemplazar',
      archivo: 'js/events.js',
      buscar: `  // Herramientas`,
      reemplazo: `  // 13. Asistencia
  on('btn-cargar-asistencia', () => window.renderAsistenciaTab());
  onEvent('asistencia-fecha', 'change', () => window.renderAsistenciaTab());
  onEvent('buscar-asistencia', 'input', () => window.renderAsistenciaTab());

  // Herramientas`
    }
  ]
};