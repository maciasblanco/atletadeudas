module.exports = {
  descripcion: 'Actualizar token de GitHub y quitarlo de la lista de exclusión',
  operaciones: [
    {
      tipo: 'reemplazar',
      archivo: 'js/schema.js',
      buscar: `github_token: 'github_pat_`,
      reemplazo: `github_token: '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', // token_ignore_`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/schema.js',
      buscar: `if ((actual === null || actual === '') && k !== 'github_token') {`,
      reemplazo: `if (actual === null || actual === '') {`
    }
  ]
};