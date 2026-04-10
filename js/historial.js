/* ============================================================
   HISTORIAL.JS — Ciclos financieros e historial
   ============================================================ */

/* ============================================================
   ABRIR MODAL CICLO
   ============================================================ */
function abrirModalCiclo() {
  const totalG = sum(DB.gastos,   'monto');
  const totalI = sum(DB.ingresos, 'monto');
  const balance = DB.presupuesto + totalI - totalG;

  const res = document.getElementById('ciclo-resumen');
  if (res) {
    res.innerHTML = `
      <div class="ciclo-stat"><span>Presupuesto</span><span>${formatMoney(DB.presupuesto)}</span></div>
      <div class="ciclo-stat"><span>Ingresos</span><span style="color:var(--green)">${formatMoney(totalI)}</span></div>
      <div class="ciclo-stat"><span>Gastos</span><span style="color:var(--red)">${formatMoney(totalG)}</span></div>
      <div class="ciclo-stat"><span>Balance</span><span style="color:${balance>=0?'var(--green)':'var(--red)'}">${formatMoney(balance)}</span></div>
    `;
  }
  abrirModal('modal-ciclo');
}

/* ============================================================
   CONFIRMAR CICLO - PASO 1
   ============================================================ */
function confirmarCiclo1() {
  cerrarModal('modal-ciclo');
  mostrarConfirmar(
    '⚠️ Cerrar Ciclo',
    '¿Deseas cerrar el ciclo actual? Se guardará el historial y se reiniciarán los movimientos.',
    confirmarCiclo2
  );
}

/* ============================================================
   CONFIRMAR CICLO - PASO 2 (segunda confirmación)
   ============================================================ */
function confirmarCiclo2() {
  cerrarModal('modal-confirmar');
  mostrarConfirmar(
    '🚨 Segunda Confirmación',
    'Esta acción NO se puede deshacer. ¿Estás completamente seguro de cerrar el ciclo?',
    ejecutarCierreCiclo
  );
}

/* ============================================================
   EJECUTAR CIERRE
   ============================================================ */
function ejecutarCierreCiclo() {
  cerrarModal('modal-confirmar');

  const hoy    = hoyISO();
  const totalG = sum(DB.gastos,   'monto');
  const totalI = sum(DB.ingresos, 'monto');
  const balance = DB.presupuesto + totalI - totalG;

  const ciclo = {
    id:           Date.now(),
    fechaInicio:  calcularFechaInicio(),
    fechaCierre:  hoy,
    presupuesto:  DB.presupuesto,
    totalIngresos: totalI,
    totalGastos:  totalG,
    balance,
    numGastos:    DB.gastos.length,
    numIngresos:  DB.ingresos.length,
    label:        mesAnioLabel(hoy),
    gastos:       [...DB.gastos],
    ingresos:     [...DB.ingresos],
  };

  DB.cerrarCiclo(ciclo);
  DB.reiniciar();
  actualizarUI();
  renderHistorial();

  mostrarVista('historial-vista');
}

function calcularFechaInicio() {
  const todos = [...DB.gastos, ...DB.ingresos];
  if (todos.length === 0) return hoyISO();
  return todos.map(r => r.fecha || hoyISO()).sort()[0];
}

/* ============================================================
   RENDER HISTORIAL
   ============================================================ */
function renderHistorial() {
  const cont  = document.getElementById('historial-ciclos');
  const empty = document.getElementById('historial-empty');
  if (!cont) return;

  cont.innerHTML = '';

  if (DB.ciclos.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  DB.ciclos.forEach(c => {
    const card = document.createElement('div');
    card.className = 'ciclo-card';

    const balClass = c.balance >= 0 ? 'pos' : 'neg';
    const ahorro   = c.balance >= 0
      ? `💰 Ahorro: ${formatMoney(c.balance)}`
      : `📉 Déficit: ${formatMoney(Math.abs(c.balance))}`;

    card.innerHTML = `
      <div class="ciclo-card-stat">
        <span class="cs-label">Período</span>
        <span class="cs-val" style="font-size:13px">${c.label || mesAnioLabel(c.fechaInicio)}</span>
      </div>
      <div class="ciclo-card-stat">
        <span class="cs-label">Presupuesto</span>
        <span class="cs-val">${formatMoney(c.presupuesto)}</span>
      </div>
      <div class="ciclo-card-stat">
        <span class="cs-label">Gastos (${c.numGastos || 0})</span>
        <span class="cs-val neg">${formatMoney(c.totalGastos)}</span>
      </div>
      <div class="ciclo-card-stat">
        <span class="cs-label">Ingresos</span>
        <span class="cs-val pos">${formatMoney(c.totalIngresos)}</span>
      </div>
      <div class="ciclo-card-stat">
        <span class="cs-label">Balance</span>
        <span class="cs-val ${balClass}">${formatMoney(c.balance)}</span>
      </div>
      <div class="ciclo-dates">
        ${formatFechaLinda(c.fechaInicio)}<br>→ ${formatFechaLinda(c.fechaCierre)}
      </div>
    `;

    cont.appendChild(card);
  });
}
