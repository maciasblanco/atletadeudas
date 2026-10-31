/* ============================================================
   cambios.js — Ignorar backups en git y limpiar los ya subidos
   ============================================================ */

module.exports = {
  descripcion: 'Agregar .gitignore para backups y borrar backups existentes del repo',
  operaciones: [

    /* 1) Crear/actualizar .gitignore */
    {
      tipo: 'sobrescribir',
      archivo: '.gitignore',
      contenido: `# Backups generados por aplicar.js
backup_*/
backup_*
*.sqlite
*.db
*.sqlite3

# Node
node_modules/
npm-debug.log*

# Sistema
.DS_Store
Thumbs.db
`
    },

    /* 2) Borrar los archivos de backup locales del working tree
          (no toca el historial de git, solo los archivos actuales) */
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-10-50/js__ui-admin-atletas.js'
    },
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-10-50/js__ui-admin-pagos.js'
    },
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-10-50/js__schema.js'
    },
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-10-50/app.js'
    },
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-13-33/js__schema.js'
    },
    {
      tipo: 'borrar',
      archivo: 'backup_2026-10-31T20-13-33/app.js'
    }
  ]
};