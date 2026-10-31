/* ============================================================
   cambios.js — Receta de cambios a aplicar
   Cada vez que quieras aplicar cambios, reemplaza este contenido
   por el bloque que te entregue el asistente.
   ============================================================ */

/* ============================================================
   cambios.js — Receta de cambios a aplicar
   ============================================================ */

module.exports = {
  descripcion: 'Botón Actualizar sistema: fondo verde claro, ícono circular azul oscuro',
  operaciones: [
    {
      tipo: 'agregarAlFinal',
      archivo: 'styles.css',
      contenido: `

/* ============================================================
   Ajuste visual del botón circular "Actualizar sistema"
   - Fondo verde claro
   - Ícono (flecha) azul oscuro
   ============================================================ */
.btn-sync-circle {
  background: #86efac !important;      /* verde claro */
  color: #0b1e4a !important;           /* azul oscuro */
  border: 1px solid #4ade80 !important;
}

.btn-sync-circle:hover {
  background: #4ade80 !important;      /* verde un poco más intenso al pasar el mouse */
}

.btn-sync-circle .sync-icon {
  color: #0b1e4a !important;           /* flecha azul oscuro */
}
`
    }
  ]
};