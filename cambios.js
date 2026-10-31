module.exports = {
  descripcion: 'Reconstruir tabla de pagos para asegurar boton de eliminar',
  operaciones: [
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: "export function renderPagos(){",
      reemplazo: `export function renderPagos(){
  const tablaPagos = document.getElementById('tabla-pagos');
  if(tablaPagos){
    const tr = tablaPagos.querySelector('thead tr');
    if(tr && tr.children.length === 6){
      const thAcciones = document.createElement('th');
      thAcciones.textContent = 'Acciones';
      tr.appendChild(thAcciones);
    }
  }`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: `<td><span class="badge \${badgeClase}">\${p.estado||''}</span></td>`,
      reemplazo: `<td><span class="badge \${badgeClase}">\${p.estado||''}</span></td>
      <td class="acciones"><button class="err" data-id="\${p.id}" onclick="window.eliminarPago(\${p.id})" title="Eliminar pago">🗑️</button></td>`
    },
    {
      tipo: 'reemplazar',
      archivo: 'js/ui-admin-pagos.js',
      buscar: `}).join('') || \`<tr><td colspan="6" class="muted center">Sin pagos.</td></tr>\`;`,
      reemplazo: `}).join('') || \`<tr><td colspan="7" class="muted center">Sin pagos.</td></tr>\`;`
    }
  ]
};