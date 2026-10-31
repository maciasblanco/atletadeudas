module.exports = {
  descripcion: 'Permitir al admin eliminar atletas y pagos (v2 con anclas seguras)',
  operaciones: [
    // 1. ELIMINAR ATLETA (ui-admin-atletas.js)
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-atletas.js',
      buscar: "export function renderAtletas(){",
      reemplazo: `export function eliminarAtleta(id){
  if(confirmar('¿Eliminar este atleta? Se borrarán sus datos y su historial de pagos. Esta acción no se puede deshacer.')){
    state.db.run('DELETE FROM pagos WHERE atleta_id=?', [id]);
    state.db.run('DELETE FROM atletas WHERE id=?', [id]);
    guardarBDEnIDB();
    renderAtletas();
    if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
    if(typeof window.subirAGitHub === 'function') window.subirAGitHub();
  }
}

export function renderAtletas(){`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-atletas.js',
      buscar: `<button data-id="\${a.id}" data-acc="edit">✏️</button>`,
      reemplazo: `<button data-id="\${a.id}" data-acc="edit">✏️</button>
        <button class="err" data-id="\${a.id}" data-acc="delete">🗑️</button>`
    },
    {
      tipo: 'agregarAlFinal',
      archivo: 'js/ui-admin-atletas.js',
      contenido: `
// --- PARCHE: Evento para botón eliminar atleta ---
const _origRenderAtletas = renderAtletas;
renderAtletas = function(){
  _origRenderAtletas();
  const tb = document.getElementById('atletas-tbody');
  if(!tb) return;
  tb.querySelectorAll('button[data-acc="delete"]').forEach(b=>{
    b.onclick = ()=> eliminarAtleta(Number(b.dataset.id));
  });
};`
    },

    // 2. ELIMINAR PAGO (ui-admin-pagos.js)
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: "export function renderPagos(){",
      reemplazo: `export function eliminarPago(id){
  if(confirmar('¿Eliminar este pago permanentemente? Esta acción no se puede deshacer.')){
    state.db.run('DELETE FROM pagos WHERE id=?', [id]);
    guardarBDEnIDB();
    renderPagos();
    if (typeof window.renderAtletas === 'function') window.renderAtletas();
    if(typeof window.refrescarAdmin === 'function') window.refrescarAdmin();
    if(typeof window.subirAGitHub === 'function') window.subirAGitHub();
  }
}

export function renderPagos(){`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: `<td><span class="badge \${badgeClase}">\${p.estado||''}</span></td>
    </tr>`,
      reemplazo: `<td><span class="badge \${badgeClase}">\${p.estado||''}</span></td>
      <td class="acciones"><button class="err" data-id="\${p.id}" data-acc="del-pago">🗑️</button></td>
    </tr>`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: `<th>Método</th><th>Monto</th><th>Estado</th>`,
      reemplazo: `<th>Método</th><th>Monto</th><th>Estado</th><th>Acciones</th>`
    },
    {
      tipo: 'agregarAlFinal',
      archivo: 'js/ui-admin-pagos.js',
      contenido: `
// --- PARCHE: Evento para botón eliminar pago ---
const _origRenderPagos = renderPagos;
renderPagos = function(){
  _origRenderPagos();
  const tb = document.getElementById('pagos-tbody');
  if(!tb) return;
  tb.querySelectorAll('button[data-acc="del-pago"]').forEach(b=>{
    b.onclick = ()=> eliminarPago(Number(b.dataset.id));
  });
};`
    }
  ]
};