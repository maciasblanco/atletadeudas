/* ============================================================
   quincenas.js — Lógica de fechas, moras y deudas
   ============================================================ */
import { one, all, getConfig } from './db.js';
import { hoyISO, fmt } from './utils.js';

export function obtenerQuincenasDelMes(anio, mes) {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return [15, Math.min(30, ultimoDia)]; 
}

export function calcularNumeroQuincena(fechaQ){
  const corte = getConfig('fecha_corte_quincena','2026-09-29'); 
  if(!fechaQ || fechaQ < corte) return null;

  const [anioC, mesC, diaC] = corte.split('-').map(Number);
  const [anioF, mesF, diaF] = fechaQ.split('-').map(Number);

  let contador = 0;
  let anio = anioC;
  let mes = mesC - 1; 

  while (true) {
    const quincenas = obtenerQuincenasDelMes(anio, mes);
    for (const qDia of quincenas) {
      const fechaQStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(qDia).padStart(2,'0')}`;
      if (fechaQStr >= corte && fechaQStr <= fechaQ) {
        contador++;
      }
    }
    if (anio === anioF && mes === (mesF - 1)) break;
    mes++;
    if (mes > 11) { mes = 0; anio++; }
  }
  return contador > 0 ? contador : null;
}

export function quincenaActualNumero(){
  const hoy = hoyISO();
  const corte = getConfig('fecha_corte_quincena', '2026-09-29'); 
  if(hoy < corte) return 0;

  const [anioC, mesC, diaC] = corte.split('-').map(Number);
  const [anioH, mesH, diaH] = hoy.split('-').map(Number);

  let contador = 0;
  let anio = anioC;
  let mes = mesC - 1;

  while (true) {
    const quincenas = obtenerQuincenasDelMes(anio, mes);
    for (const qDia of quincenas) {
      const fechaQStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(qDia).padStart(2,'0')}`;
      if (fechaQStr >= corte && fechaQStr <= hoy) {
        contador++;
      }
    }
    if (anio === anioH && mes === (mesH - 1)) break;
    mes++;
    if (mes > 11) { mes = 0; anio++; }
  }
  return contador;
}

export function fechaQuincenaActual(){
  const hoy = hoyISO();
  const corte = getConfig('fecha_corte_quincena', '2026-09-29'); 
  if(hoy < corte) return corte;

  const [anio, mes] = hoy.split('-').map(Number);
  const quincenas = obtenerQuincenasDelMes(anio, mes - 1);
  for (let i = quincenas.length - 1; i >= 0; i--) {
    const fechaQ = `${anio}-${String(mes).padStart(2,'0')}-${String(quincenas[i]).padStart(2,'0')}`;
    if (fechaQ <= hoy) return fechaQ;
  }

  let mp = mes - 1, ap = anio;
  if (mp < 1) { mp = 12; ap--; }
  const qp = obtenerQuincenasDelMes(ap, mp - 1);
  const ultimo = qp[qp.length - 1];
  const fechaPrev = `${ap}-${String(mp).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`;
  return fechaPrev < corte ? corte : fechaPrev;
}

export function calcularMoraAtleta(atletaId){
  const qActual = quincenaActualNumero();
  if(qActual <= 0){
    return { quincena_actual:0, pagadas:0, debidas:0, estado:'sin_inicio' };
  }
  const r = one(
    `SELECT COUNT(DISTINCT numero_quincena) AS n
       FROM pagos
      WHERE atleta_id = ?
        AND estado = 'pagado'
        AND numero_quincena BETWEEN 1 AND ?`,
    [atletaId, qActual]
  );
  const pagadas = r?.n || 0;
  const debidas = Math.max(0, qActual - pagadas);
  let estado = 'ok';
  if(debidas >= 3) estado = 'no_practica';
  else if(debidas > 0) estado = 'mora';
  return { quincena_actual:qActual, pagadas, debidas, estado };
}

export function badgeMoraHTML(m, totalBs){
  if(m.estado === 'sin_inicio'){
    return `<span class="badge" style="background:#1e2a45;color:#9aa7c7">Sin iniciar</span>`;
  }
  if(m.estado === 'ok'){
    return `<span class="badge ok">✅ Al día</span>`;
  }
  const extra = (totalBs != null && totalBs > 0) ? ` · ${fmt(totalBs)} Bs` : '';
  if(m.estado === 'mora'){
    return `<span class="badge warn">⚠️ Mora: ${m.debidas}${extra}</span>`;
  }
  return `<span class="badge err">🚫 NO PRACTICA (${m.debidas})${extra}</span>`;
}

export function calcularDeudaAtleta(atletaId){
  const m = calcularMoraAtleta(atletaId);
  const montoPeriodo = Number(getConfig('monto_periodo','20')) || 20;
  const montoSemanal = Number(getConfig('monto_semanal','5')) || 5;
  const montoQuincenaUSD = Number(getConfig('monto_quincena', montoPeriodo/4 || montoSemanal*2)) || 5;
  const tasa = Number(getConfig('tasa_dolar','36.50')) || 36.50;
  const debidas = Math.max(0, m.debidas || 0);
  const totalUSD = debidas * montoQuincenaUSD;
  const totalBs  = totalUSD * tasa;
  return {
    ...m,
    monto_quincena_usd: montoQuincenaUSD,
    tasa,
    total_usd: totalUSD,
    total_bs: totalBs
  };
}

export function estadoQuincenaAtleta(atletaId, numeroQuincena){
  if(!numeroQuincena) return { tipo:'invalida' };

  const pagada = one(
    `SELECT id, monto, fecha FROM pagos
      WHERE atleta_id=? AND estado='pagado' AND numero_quincena=?`,
    [atletaId, numeroQuincena]
  );
  if(pagada) return { tipo:'pagada', pago_id:pagada.id, monto:pagada.monto, fecha:pagada.fecha };

  const pend = one(
    `SELECT id FROM pagos
      WHERE atleta_id=? AND estado='pendiente' AND numero_quincena=?`,
    [atletaId, numeroQuincena]
  );
  if(pend) return { tipo:'pendiente', pago_id:pend.id };

  const qActual = quincenaActualNumero();
  if(numeroQuincena > qActual) return { tipo:'futura' };
  return { tipo:'debida' };
}

export function resumenDeudaAtleta(atletaId){
  const d = calcularDeudaAtleta(atletaId);
  const qActual = quincenaActualNumero();
  const pagadasNums = new Set(
    all(`SELECT numero_quincena FROM pagos
          WHERE atleta_id=? AND estado='pagado'
            AND numero_quincena BETWEEN 1 AND ?`, [atletaId, qActual])
      .map(r => Number(r.numero_quincena))
  );
  const pendientesNums = new Set(
    all(`SELECT numero_quincena FROM pagos
          WHERE atleta_id=? AND estado='pendiente'
            AND numero_quincena BETWEEN 1 AND ?`, [atletaId, qActual])
      .map(r => Number(r.numero_quincena))
  );
  const debidasNums = [];
  for(let i=1; i<=qActual; i++){
    if(!pagadasNums.has(i) && !pendientesNums.has(i)) debidasNums.push(i);
  }
  return {
    ...d,
    quincena_actual: qActual,
    pagadas_nums: [...pagadasNums].sort((a,b)=>a-b),
    pendientes_nums: [...pendientesNums].sort((a,b)=>a-b),
    debidas_nums: debidasNums
  };
}