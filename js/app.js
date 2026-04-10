/* ============================================================
   APP.JS — Controlador principal
   ============================================================ */

/* ======================================
   ESTADO UI
   ====================================== */
let modoGrafica   = 'general';
let filtroTiempo  = 'mes';
let vistaActual   = 'principal';

// modos eliminar/editar (gastos)
let modoEliminarMov = false;
let modoEditarMov   = false;
let editGastoId     = null;

// modos eliminar/editar (ingresos)
let modoEliminarIng = false;
let modoEditarIng   = false;
let editIngresoId   = null;

/* ======================================
   INIT
   ====================================== */
document.addEventListener('DOMContentLoaded', () => {
  const hoy = hoyISO();
  document.getElementById('fecha-hoy').textContent = formatFechaLinda(hoy);
  setFechaInputs(hoy);
  cargarCategorias('g-categoria');
  actualizarUI();
  renderHistorial();
  cerrarModalesAlClickFuera();
});

function setFechaInputs(hoy) {
  ['g-fecha','i-fecha','fecha-filtro'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = hoy;
  });
}

/* ======================================
   VISTAS
   ====================================== */
function mostrarVista(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');

  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-view="${id}"]`)?.classList.add('active');

  vistaActual = id;

  if (id === 'analisis-vista') renderAnalisis();
  if (id === 'historial-vista') renderHistorial();
  if (id === 'registros-vista') renderRegistros();
  if (id === 'ingresos-vista')  renderIngresosVista();

  // cerrar sidebar móvil
  document.getElementById('sidebar')?.classList.remove('open');
}

/* ======================================
   SIDEBAR MÓVIL
   ====================================== */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

/* ======================================
   CAMBIAR MODO GRÁFICA
   ====================================== */
function cambiarModo(m) {
  modoGrafica = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active-mode'));
  document.querySelector(`.mode-btn[data-mode="${m}"]`)?.classList.add('active-mode');
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active-pill'));
  document.querySelector(`.pill[data-mode="${m}"]`)?.classList.add('active-pill');
  document.getElementById('chart-title').textContent =
    m === 'capital' ? 'Capital' : m === 'general' ? 'General' : 'Categorías';
  actualizarUI();
}

/* ======================================
   CAMBIAR TIEMPO
   ====================================== */
function cambiarTiempo(t) {
  filtroTiempo = t;
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active-time'));
  document.querySelector(`.time-btn[data-time="${t}"]`)?.classList.add('active-time');

  const wrap = document.getElementById('date-picker-wrap');
  if (t === 'dia') wrap?.classList.remove('hidden');
  else             wrap?.classList.add('hidden');

  actualizarUI();
}

/* ======================================
   OBTENER FILTRO ACTIVO
   ====================================== */
function getFiltro() {
  return {
    tiempo: filtroTiempo,
    fecha:  document.getElementById('fecha-filtro')?.value || hoyISO()
  };
}

/* ======================================
   ACTUALIZAR UI COMPLETO
   ====================================== */
function actualizarUI() {
  const f = getFiltro();
  const gastosF   = DB.gastosF(f);
  const ingresosF = DB.ingresosF(f);

  const totalG = sum(gastosF,   'monto');
  const totalI = sum(ingresosF, 'monto');
  const disponible = DB.presupuesto + sum(DB.ingresos, 'monto') - sum(DB.gastos, 'monto');
  const acumulado  = DB.presupuesto + sum(DB.ingresos, 'monto');

  // Tarjetas
  setEl('c-presupuesto', formatMoney(DB.presupuesto));
  setEl('c-disponible',  formatMoney(disponible));
  setEl('c-gastos',      formatMoney(totalG));
  setEl('c-ingresos',    formatMoney(totalI));
  setEl('c-acumulado',   formatMoney(acumulado));

  const ultIng = [...DB.ingresos].sort((a,b) => b.id - a.id)[0];
  setEl('c-ultimo-ingreso', ultIng ? `Último: ${formatMoney(ultIng.monto)}` : '—');

  // Barra acumulado
  const barBase  = DB.presupuesto / Math.max(acumulado,1) * 100;
  const barExtra = sum(DB.ingresos,'monto') / Math.max(acumulado,1) * 100;
  setStyle('acum-base',  `width:${barBase}%`);
  setStyle('acum-extra', `width:${barExtra}%`);

  // Progress
  const pct = DB.presupuesto > 0
    ? Math.min((sum(DB.gastos,'monto') / DB.presupuesto) * 100, 100)
    : 0;
  setEl('prog-pct', pct.toFixed(1) + '%');
  setEl('prog-limite', `Límite: ${formatMoney(DB.presupuesto)}`);

  const fill = document.getElementById('prog-fill');
  if (fill) {
    fill.style.width = pct + '%';
    fill.style.background =
      pct >= 100 ? 'var(--red)' :
      pct >= 80  ? '#ef4444'    :
      pct >= 50  ? 'var(--orange)' :
      pct >= 20  ? 'var(--yellow)' : 'var(--green)';
  }

  // Alerta
  renderAlerta(pct);

  // Movimientos
  renderMovimientos(gastosF);

  // Gráfica
  renderGraficaPrincipal(modoGrafica, gastosF, ingresosF);

  // Si estás en ingresos, actualizar también
  if (vistaActual === 'ingresos-vista') renderIngresosVista();
}

/* ======================================
   ALERTA
   ====================================== */
function renderAlerta(pct) {
  const banner = document.getElementById('alerta-banner');
  if (!banner) return;
  banner.className = 'alerta-banner';

  if (pct >= 100) {
    banner.textContent = '🚨 ¡Presupuesto agotado!';
    banner.classList.add('alerta-100');
    banner.classList.remove('hidden');
  } else if (pct >= 80) {
    banner.textContent = `⚠️ Riesgo: ${pct.toFixed(0)}% gastado`;
    banner.classList.add('alerta-80');
    banner.classList.remove('hidden');
  } else if (pct >= 50) {
    banner.textContent = `⚡ Advertencia: ${pct.toFixed(0)}% gastado`;
    banner.classList.add('alerta-50');
    banner.classList.remove('hidden');
  } else if (pct >= 20) {
    banner.textContent = `💡 ${pct.toFixed(0)}% del presupuesto gastado`;
    banner.classList.add('alerta-20');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ======================================
   MOVIMIENTOS (lista gastos)
   ====================================== */
function renderMovimientos(gastosF) {
  const lista = document.getElementById('lista-movs');
  const empty = document.getElementById('movs-empty');
  if (!lista) return;
  lista.innerHTML = '';

  const ordenados = [...gastosF].sort((a,b) => b.id - a.id);

  if (ordenados.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  ordenados.forEach(g => {
    const li = crearItemMov(g, modoEliminarMov, modoEditarMov, () => {
      if (modoEliminarMov) pedirEliminarGasto(g.id, g.concepto);
      else if (modoEditarMov) abrirEditarGasto(g.id);
    });
    lista.appendChild(li);
  });
}

function crearItemMov(r, esEliminar, esEditar, onClick) {
  const li = document.createElement('li');
  li.className = 'movimiento-item';
  if (esEliminar) li.classList.add('modo-eliminar');
  if (esEditar)   li.classList.add('modo-editar');

  const monto = r.tipo === 'ingreso'
    ? `<span class="mov-monto ingreso">+${formatMoney(r.monto)}</span>`
    : `<span class="mov-monto gasto">-${formatMoney(r.monto)}</span>`;

  const accion = esEliminar ? '🗑️' : esEditar ? '✏️' : '';

  li.innerHTML = `
    <span class="mov-fecha">${formatFechaCorta(r.fecha)}</span>
    <span class="mov-name">${escHTML(r.concepto)}</span>
    <span class="mov-cat">${escHTML(r.categoria || '—')}</span>
    ${monto}
    <span class="mov-action"><span>${accion}</span></span>
  `;
  li.onclick = onClick;
  return li;
}

/* ======================================
   TOGGLES MODO MOV
   ====================================== */
function toggleModoEliminar() {
  modoEliminarMov = !modoEliminarMov;
  if (modoEliminarMov) modoEditarMov = false;
  syncToggleBtns('btn-eliminar-mov', 'btn-editar-mov', modoEliminarMov, false);
  actualizarUI();
}

function toggleModoEditar() {
  modoEditarMov = !modoEditarMov;
  if (modoEditarMov) modoEliminarMov = false;
  syncToggleBtns('btn-eliminar-mov', 'btn-editar-mov', false, modoEditarMov);
  actualizarUI();
}

function syncToggleBtns(elId, edId, elActive, edActive) {
  document.getElementById(elId)?.classList.toggle('active-toggle', elActive);
  document.getElementById(edId)?.classList.toggle('active-toggle', edActive);
}

/* ======================================
   AGREGAR GASTO
   ====================================== */
function agregarGasto() {
  const concepto  = val('g-concepto');
  const monto     = parseFloat(val('g-monto'));
  const fecha     = val('g-fecha') || hoyISO();
  let   categoria = val('g-categoria');
  const nueva     = val('g-nueva').trim();

  if (!concepto) { shake(document.getElementById('g-concepto')); return; }
  if (isNaN(monto) || monto <= 0) { shake(document.getElementById('g-monto')); return; }

  if (categoria === 'Otros') {
    if (!nueva) { shake(document.getElementById('g-nueva')); return; }
    categoria = nueva;
    DB.addCat(nueva);
  }

  DB.addGasto({ id: Date.now(), tipo:'gasto', concepto, monto, categoria, fecha });
  clearGastoForm();
  cargarCategorias('g-categoria');
  actualizarUI();
}

function clearGastoForm() {
  ['g-concepto','g-monto','g-nueva'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('g-fecha').value = hoyISO();
  document.getElementById('g-nueva-grp')?.classList.add('hidden');
}

function checkCatGasto() {
  const sel = val('g-categoria');
  document.getElementById('g-nueva-grp')?.classList.toggle('hidden', sel !== 'Otros');
}

/* ======================================
   EDITAR GASTO
   ====================================== */
function abrirEditarGasto(id) {
  const g = DB.gastos.find(x => x.id === id);
  if (!g) return;
  editGastoId = id;
  document.getElementById('eg-fecha').value    = g.fecha    || hoyISO();
  document.getElementById('eg-concepto').value = g.concepto || '';
  document.getElementById('eg-monto').value    = g.monto    || 0;
  cargarCategorias('eg-categoria', g.categoria);
  abrirModal('modal-editar-gasto');
}

function guardarEdicionGasto() {
  const g = DB.gastos.find(x => x.id === editGastoId);
  if (!g) return;
  const monto = parseFloat(val('eg-monto'));
  if (isNaN(monto) || monto <= 0) return;
  DB.editGasto(editGastoId, {
    fecha:     val('eg-fecha') || hoyISO(),
    concepto:  val('eg-concepto').trim() || g.concepto,
    monto,
    categoria: val('eg-categoria'),
  });
  cerrarModal('modal-editar-gasto');
  actualizarUI();
}

/* ======================================
   ELIMINAR GASTO
   ====================================== */
function pedirEliminarGasto(id, concepto) {
  mostrarConfirmar(
    '⚠️ Eliminar Gasto',
    `¿Deseas eliminar "${concepto}"?`,
    () => { DB.delGasto(id); cerrarModal('modal-confirmar'); actualizarUI(); }
  );
}

/* ======================================
   AGREGAR INGRESO
   ====================================== */
function abrirModalIngreso() {
  document.getElementById('i-fecha').value    = hoyISO();
  document.getElementById('i-concepto').value = '';
  document.getElementById('i-monto').value    = '';
  abrirModal('modal-ingreso');
}

function agregarIngreso() {
  const concepto = val('i-concepto').trim();
  const monto    = parseFloat(val('i-monto'));
  const fecha    = val('i-fecha') || hoyISO();
  if (!concepto) { shake(document.getElementById('i-concepto')); return; }
  if (isNaN(monto) || monto <= 0) { shake(document.getElementById('i-monto')); return; }

  DB.addIngreso({ id: Date.now(), tipo:'ingreso', concepto, monto, fecha });
  cerrarModal('modal-ingreso');
  actualizarUI();
}

/* ======================================
   VISTA INGRESOS
   ====================================== */
function renderIngresosVista() {
  const f = getFiltro();
  const ingF = DB.ingresosF(f);
  const totalAll = sum(DB.ingresos, 'monto');
  const totalPer = sum(ingF, 'monto');
  const ult = [...DB.ingresos].sort((a,b) => b.id - a.id)[0];

  setEl('ing-total', formatMoney(totalAll));
  setEl('ing-periodo', formatMoney(totalPer));
  setEl('ing-ultimo-monto',   ult ? formatMoney(ult.monto)  : '$0');
  setEl('ing-ultimo-concepto',ult ? ult.concepto : '—');

  const lista = document.getElementById('lista-ingresos');
  const empty = document.getElementById('ing-empty');
  if (!lista) return;
  lista.innerHTML = '';

  const ordenados = [...DB.ingresos].sort((a,b) => b.id - a.id);

  if (ordenados.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  ordenados.forEach(i => {
    const li = crearItemMov({ ...i, tipo:'ingreso', categoria: 'Ingreso' }, modoEliminarIng, modoEditarIng, () => {
      if (modoEliminarIng) pedirEliminarIngreso(i.id, i.concepto);
      else if (modoEditarIng) abrirEditarIngreso(i.id);
    });
    lista.appendChild(li);
  });
}

/* ======================================
   TOGGLES MODO INGRESOS
   ====================================== */
function toggleModoEliminarIng() {
  modoEliminarIng = !modoEliminarIng;
  if (modoEliminarIng) modoEditarIng = false;
  syncToggleBtns('btn-eliminar-ing', 'btn-editar-ing', modoEliminarIng, false);
  renderIngresosVista();
}

function toggleModoEditarIng() {
  modoEditarIng = !modoEditarIng;
  if (modoEditarIng) modoEliminarIng = false;
  syncToggleBtns('btn-eliminar-ing', 'btn-editar-ing', false, modoEditarIng);
  renderIngresosVista();
}

/* ======================================
   EDITAR INGRESO
   ====================================== */
function abrirEditarIngreso(id) {
  const i = DB.ingresos.find(x => x.id === id);
  if (!i) return;
  editIngresoId = id;
  document.getElementById('ei-fecha').value    = i.fecha    || hoyISO();
  document.getElementById('ei-concepto').value = i.concepto || '';
  document.getElementById('ei-monto').value    = i.monto    || 0;
  abrirModal('modal-editar-ingreso');
}

function guardarEdicionIngreso() {
  const monto = parseFloat(val('ei-monto'));
  if (isNaN(monto) || monto <= 0) return;
  DB.editIngreso(editIngresoId, {
    fecha:    val('ei-fecha') || hoyISO(),
    concepto: val('ei-concepto').trim(),
    monto,
  });
  cerrarModal('modal-editar-ingreso');
  actualizarUI();
}

/* ======================================
   ELIMINAR INGRESO (doble confirmación)
   ====================================== */
function pedirEliminarIngreso(id, concepto) {
  mostrarConfirmar(
    '⚠️ Eliminar Ingreso',
    `¿Deseas eliminar el ingreso "${concepto}"?`,
    () => {
      cerrarModal('modal-confirmar');
      mostrarConfirmar(
        '🚨 Segunda confirmación',
        '¿Estás completamente seguro? Esto afectará tu disponible.',
        () => {
          DB.delIngreso(id);
          cerrarModal('modal-confirmar');
          actualizarUI();
        }
      );
    }
  );
}

/* ======================================
   PRESUPUESTO
   ====================================== */
function editarPresupuesto() {
  document.getElementById('p-nuevo').value = DB.presupuesto;
  abrirModal('modal-presupuesto');
}

function guardarPresupuesto() {
  const v = parseFloat(val('p-nuevo'));
  if (isNaN(v) || v <= 0) return;
  DB.setPresupuesto(v);
  cerrarModal('modal-presupuesto');
  actualizarUI();
}

/* ======================================
   REGISTROS COMPLETOS
   ====================================== */
function renderRegistros() {
  const lista    = document.getElementById('lista-registros');
  if (!lista) return;
  const buscar   = (val('buscar-reg') || '').toLowerCase();
  const tipoFil  = val('filtro-tipo-reg') || 'todos';
  const tiempoFil= val('filtro-tiempo-reg') || 'todos';
  const hoy      = hoyISO();

  const todos = [
    ...DB.gastos.map(g   => ({ ...g, _tipo:'gasto' })),
    ...DB.ingresos.map(i => ({ ...i, _tipo:'ingreso', categoria:'—' }))
  ].sort((a,b) => b.id - a.id);

  const filtrados = todos.filter(r => {
    const matchTipo   = tipoFil  === 'todos' || r._tipo === tipoFil;
    const matchBuscar = !buscar  || r.concepto.toLowerCase().includes(buscar) || (r.categoria||'').toLowerCase().includes(buscar);
    const matchTiempo = tiempoFil === 'todos' || filtrar([r], { tiempo: tiempoFil, fecha: hoy }).length > 0;
    return matchTipo && matchBuscar && matchTiempo;
  });

  lista.innerHTML = '';
  filtrados.forEach(r => {
    const li = document.createElement('li');
    li.className = 'movimiento-item';
    li.style.gridTemplateColumns = '100px 1fr 130px 90px 110px';
    const signo = r._tipo === 'ingreso' ? '+' : '-';
    const color = r._tipo === 'ingreso' ? 'var(--green)' : 'var(--red)';
    li.innerHTML = `
      <span class="mov-fecha">${formatFechaCorta(r.fecha)}</span>
      <span class="mov-name">${escHTML(r.concepto)}</span>
      <span class="mov-cat">${escHTML(r.categoria)}</span>
      <span class="mov-cat" style="color:${color}">${r._tipo === 'ingreso' ? '📈' : '📉'} ${r._tipo}</span>
      <span class="mov-monto ${r._tipo}">${signo}${formatMoney(r.monto)}</span>
    `;
    lista.appendChild(li);
  });
}

/* ======================================
   ANÁLISIS
   ====================================== */
function renderAnalisis() {
  const f = getFiltro();
  const gastosF = DB.gastosF(f);
  renderGraficaComparativa();
  renderGraficaTendencia();
  renderGraficaCapital();
  renderLimiteGasto(gastosF);
}

/* ======================================
   MODALES HELPERS
   ====================================== */
function abrirModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function cerrarModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function mostrarConfirmar(titulo, mensaje, onSi) {
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-msg').textContent   = mensaje;
  const btn = document.getElementById('confirm-ok');
  btn.onclick = onSi;
  abrirModal('modal-confirmar');
}

function cerrarModalesAlClickFuera() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

/* ======================================
   DOM UTILS
   ====================================== */
function val(id) {
  return document.getElementById(id)?.value || '';
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStyle(id, style) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('style', style);
}

function shake(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'shake .35s ease';
  setTimeout(() => el.style.animation = '', 400);
}
