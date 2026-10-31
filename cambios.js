module.exports = {
  descripcion: 'Corregir formato de moneda en tabla de pagos',
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
  }

  const tb = document.getElementById('pagos-tbody'); if(!tb) return;
  const rows = all(\`
    SELECT p.id, p.fecha, p.fecha_quincena, p.numero_quincena, p.monto, p.estado,
           a.identificacion, a.p_nombre, a.p_apellido,
           m.nombre AS metodo
      FROM pagos p
      JOIN atletas a ON a.id = p.atleta_id
      LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
     ORDER BY p.fecha DESC, p.id DESC
     LIMIT 100\`);
  
  tb.innerHTML = rows.map(p=>{
    const nombre = \`\${p.p_apellido||''} \${p.p_nombre||''}\`.trim() || p.identificacion;
    const badgeClase = p.estado==='pagado' ? 'ok' : (p.estado==='pendiente' ? 'warn' : 'err');
    const tasa = Number(getConfig('tasa_dolar','36.50')) || 36.50;
    const montoBs = (Number(p.monto) || 0) * tasa;
    const montoTexto = (Number(p.monto) > 0) ? \`\${fmtVE(montoBs)} Bs (\${fmtVE(p.monto)} USD)\` : '0,00 Bs (0,00 USD)';
    
    return \`<tr>
      <td>\${p.fecha||''}</td>
      <td>\${nombre}</td>
      <td>\${p.fecha_quincena||''}\${p.numero_quincena?\` (#\${p.numero_quincena})\`:''}</td>
      <td>\${p.metodo||'—'}</td>
      <td>\${montoTexto}</td>
      <td><span class="badge \${badgeClase}">\${p.estado||''}</span></td>
      <td class="acciones"><button class="err" data-id="\${p.id}" onclick="window.eliminarPago(\${p.id})" title="Eliminar pago">🗑️</button></td>
    </tr>\`;
  }).join('') || \`<tr><td colspan="7" class="muted center">Sin pagos.</td></tr>\`;

  renderPagosPendientes();
}

// --- FUNCIONES OCULTAS PARA MANTENER COMPATIBILIDAD ---
function renderPagosViejo(){`
    }
  ]
};