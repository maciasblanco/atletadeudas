module.exports = {
  descripcion: 'Forzar borrado logico en pagos usando reemplazo de funcion al final del archivo',
  operaciones: [
    {
      tipo: 'agregarAlFinal',
      archivo: 'js/ui-admin-pagos.js',
      contenido: `

// ============================================================
// PARCHE DEFINITIVO: Sobrescribir eliminación de pagos por anulación
// ============================================================
window.eliminarPago = async function(id){
  if(confirmar('¿Anular este pago? Ya no contará para la deuda, pero quedará registrado en el historial como anulado.')){
    state.db.run("UPDATE pagos SET estado='anulado' WHERE id=?", [id]);
    await guardarBDEnIDB();
    renderPagos();
    if (typeof window.renderAtletas === 'function') window.renderAtletas();
    if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
    
    // Forzar sincronización con GitHub
    if(typeof window.subirAGitHub === 'function') {
      const res = await window.subirAGitHub();
      if(res.ok) {
        window.showMsg(document.getElementById('pago-msg'), 'ok', '✅ Pago anulado y actualizado en GitHub.');
      } else {
        window.showMsg(document.getElementById('pago-msg'), 'err', '⚠️ Anulado localmente, pero falló en GitHub.');
      }
    }
  }
};
`
    }
  ]
};