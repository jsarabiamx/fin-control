/* ============================================================
   CHARTS.JS — Todas las gráficas (Chart.js)
   ============================================================ */

const PALETTE = [
  '#5b6ef5','#0ec97d','#f04060','#f5a623','#3b82f6',
  '#a855f7','#ec4899','#14b8a6','#f97316','#84cc16',
  '#06b6d4','#8b5cf6','#d946ef','#22c55e','#eab308',
  '#fb923c','#38bdf8','#c084fc'
];

const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ============================================================
   DONUT PRINCIPAL (principal view)
   ============================================================ */
function renderGraficaPrincipal(modo, gastosF, ingresosF) {
  destroyChart('principal');

  const totalGastos   = sum(gastosF,   'monto');
  const totalIngresos = sum(ingresosF, 'monto');
  const disponible    = Math.max(DB.presupuesto + totalIngresos - totalGastos, 0);

  let labels, valores, colors, centerVal, centerLabel;

  if (modo === 'capital') {
    labels      = ['Presupuesto base', 'Ingresos extra'];
    valores     = [DB.presupuesto, totalIngresos];
    colors      = ['#5b6ef5', '#0ec97d'];
    centerVal   = formatMoney(DB.presupuesto + totalIngresos);
    centerLabel = 'Acumulado';
  } else if (modo === 'general') {
    labels      = ['Disponible', 'Gastos'];
    valores     = [disponible, totalGastos];
    colors      = ['#3b82f6', '#f04060'];
    centerVal   = formatMoney(disponible);
    centerLabel = 'Disponible';
  } else {
    const cats  = {};
    gastosF.forEach(g => { cats[g.categoria] = (cats[g.categoria]||0) + g.monto; });
    labels      = Object.keys(cats);
    valores     = Object.values(cats);
    colors      = labels.map((_,i) => PALETTE[i % PALETTE.length]);
    centerVal   = formatMoney(totalGastos);
    centerLabel = 'Gastos';
  }

  if (valores.every(v => v === 0)) {
    labels = ['Sin datos']; valores = [1]; colors = ['#253247'];
  }

  const ctx = document.getElementById('grafica-principal');
  if (!ctx) return;

  charts['principal'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 7,
      }]
    },
    options: {
      cutout: '72%',
      animation: { animateRotate: true, duration: 500 },
      plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
  });

  // center text
  const dcV = document.getElementById('dc-value');
  const dcL = document.getElementById('dc-label');
  if (dcV) dcV.textContent = centerVal;
  if (dcL) dcL.textContent = centerLabel;

  // leyenda
  renderLeyenda('leyenda-principal', labels, valores, colors);
}

/* ============================================================
   LEYENDA
   ============================================================ */
function renderLeyenda(containerId, labels, valores, colors) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = '';
  const total = valores.reduce((a,b) => a+b, 0);

  labels.forEach((lbl, i) => {
    if (lbl === 'Sin datos') return;
    const pct = total > 0 ? ((valores[i]/total)*100).toFixed(1) : '0.0';
    const div = document.createElement('div');
    div.className = 'ley-item';
    div.innerHTML = `
      <div class="ley-dot" style="background:${colors[i]}"></div>
      <div class="ley-body">
        <span class="ley-name">${escHTML(lbl)}</span>
        <span class="ley-val">${formatMoney(valores[i])} · ${pct}%</span>
      </div>
    `;
    cont.appendChild(div);
  });
}

/* ============================================================
   COMPARATIVA MENSUAL (análisis)
   ============================================================ */
function renderGraficaComparativa() {
  destroyChart('comparativa');

  const hoy      = hoyISO();
  const mesActual = hoy.slice(0,7);
  const prev      = new Date(hoy + 'T00:00:00');
  prev.setMonth(prev.getMonth() - 1);
  const mesAnterior = prev.toISOString().slice(0,7);

  const gastosMes = sum(filtrar(DB.gastos, { tiempo: 'mes', fecha: hoy }), 'monto');
  const gastosPrev= sum(filtrar(DB.gastos, { tiempo: 'mes', fecha: mesAnterior + '-01' }), 'monto');

  const labels  = [mesAnioLabel(mesAnterior + '-01'), mesAnioLabel(mesActual + '-01')];
  const valores = [gastosPrev, gastosMes];
  const colors  = ['#5b6ef5', gastosMes > gastosPrev ? '#f04060' : '#0ec97d'];

  const ctx = document.getElementById('grafica-comparativa');
  if (!ctx) return;

  charts['comparativa'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 5,
      }]
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { duration: 600 }
    }
  });

  // info comparativa
  const cont = document.getElementById('comparativa-info');
  if (!cont) return;
  const diff = gastosMes - gastosPrev;
  const pct  = gastosPrev > 0 ? ((Math.abs(diff)/gastosPrev)*100).toFixed(1) : '—';
  const color = diff > 0 ? 'var(--red)' : 'var(--green)';
  const icono = diff > 0 ? '📈 +' : '📉 ';

  cont.innerHTML = `
    <div class="comp-row"><span>${labels[0]}</span><span>${formatMoney(gastosPrev)}</span></div>
    <div class="comp-row"><span>${labels[1]}</span><span>${formatMoney(gastosMes)}</span></div>
    <div class="comp-row" style="margin-top:6px;border-top:1px solid var(--border);padding-top:8px">
      <span>Diferencia</span>
      <span style="color:${color}">${icono}${formatMoney(Math.abs(diff))} (${pct}%)</span>
    </div>
  `;
}

/* ============================================================
   TENDENCIA (línea por días/semanas del mes actual)
   ============================================================ */
function renderGraficaTendencia() {
  destroyChart('tendencia');

  const hoy      = hoyISO();
  const mesActual = hoy.slice(0,7);
  const gastosMes = DB.gastos.filter(g => (g.fecha||'').startsWith(mesActual));

  // agrupar por día
  const porDia = {};
  gastosMes.forEach(g => {
    const d = g.fecha || hoy;
    porDia[d] = (porDia[d]||0) + g.monto;
  });

  const dias   = Object.keys(porDia).sort();
  const labels = dias.map(d => formatFechaCorta(d));
  const data   = dias.map(d => porDia[d]);

  // acumulado
  let acc = 0;
  const dataAcc = data.map(v => { acc += v; return acc; });

  const ctx = document.getElementById('grafica-tendencia');
  if (!ctx) return;

  charts['tendencia'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Gasto diario',
          data,
          borderColor: '#5b6ef5',
          backgroundColor: 'rgba(91,110,245,.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#5b6ef5',
        },
        {
          label: 'Acumulado',
          data: dataAcc,
          borderColor: '#f04060',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#f04060',
          borderDash: [5,4],
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#5d7089', font: { family: 'DM Sans', size: 12 } } } },
      scales: {
        x: { ticks: { color: '#5d7089', font: { family: 'DM Mono', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#5d7089', callback: v => '$' + v.toLocaleString('es-MX'), font: { family: 'DM Mono', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

/* ============================================================
   CAPITAL HISTÓRICO (barras por ciclo)
   ============================================================ */
function renderGraficaCapital() {
  destroyChart('capital');

  const ctx = document.getElementById('grafica-capital');
  if (!ctx) return;

  const ciclos = [...DB.ciclos].reverse();
  const labels = ciclos.map(c => c.label || mesAnioLabel(c.fechaInicio));
  const balances = ciclos.map(c => c.balance);
  const colors   = balances.map(b => b >= 0 ? '#0ec97d' : '#f04060');

  // agregar ciclo actual
  const ingrActual = sum(DB.ingresos, 'monto');
  const gasActual  = sum(DB.gastos,   'monto');
  const balActual  = DB.presupuesto + ingrActual - gasActual;
  labels.push('Actual');
  balances.push(balActual);
  colors.push(balActual >= 0 ? '#5b6ef5' : '#f04060');

  charts['capital'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Balance',
        data: balances,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#5d7089', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#5d7089', callback: v => '$' + v.toLocaleString('es-MX'), font: { family: 'DM Mono', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

/* ============================================================
   LÍMITE DE GASTO (análisis)
   ============================================================ */
function renderLimiteGasto(gastosF) {
  const cont = document.getElementById('limite-info');
  if (!cont) return;

  const totalG = sum(gastosF, 'monto');
  const limite = DB.presupuesto;
  const restante = Math.max(limite - totalG, 0);
  const pct = limite > 0 ? Math.min((totalG/limite)*100, 100) : 0;
  const color = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--yellow)' : 'var(--green)';

  cont.innerHTML = `
    <div class="lim-row">
      <span class="lim-label">Presupuesto límite</span>
      <span class="lim-val">${formatMoney(limite)}</span>
    </div>
    <div class="lim-row">
      <span class="lim-label">Gastado</span>
      <span class="lim-val" style="color:${color}">${formatMoney(totalG)} (${pct.toFixed(1)}%)</span>
      <div class="lim-track"><div class="lim-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>
    <div class="lim-row">
      <span class="lim-label">Restante</span>
      <span class="lim-val" style="color:var(--green)">${formatMoney(restante)}</span>
    </div>
  `;
}
