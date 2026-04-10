/* ============================================================
   STORAGE.JS — Estado global y persistencia localStorage
   ============================================================ */

const DB = {
  KEY_GASTOS:    'fp2_gastos',
  KEY_INGRESOS:  'fp2_ingresos',
  KEY_PRESUP:    'fp2_presupuesto',
  KEY_CATS:      'fp2_cats',
  KEY_CICLOS:    'fp2_ciclos',

  load() {
    this.gastos    = JSON.parse(localStorage.getItem(this.KEY_GASTOS))   || [];
    this.ingresos  = JSON.parse(localStorage.getItem(this.KEY_INGRESOS)) || [];
    this.presupuesto = parseFloat(localStorage.getItem(this.KEY_PRESUP)) || 20000;
    this.catsExtras= JSON.parse(localStorage.getItem(this.KEY_CATS))     || [];
    this.ciclos    = JSON.parse(localStorage.getItem(this.KEY_CICLOS))   || [];
  },

  save() {
    localStorage.setItem(this.KEY_GASTOS,   JSON.stringify(this.gastos));
    localStorage.setItem(this.KEY_INGRESOS, JSON.stringify(this.ingresos));
    localStorage.setItem(this.KEY_PRESUP,   this.presupuesto);
    localStorage.setItem(this.KEY_CATS,     JSON.stringify(this.catsExtras));
    localStorage.setItem(this.KEY_CICLOS,   JSON.stringify(this.ciclos));
  },

  /* --- GASTOS --- */
  addGasto(g)  { this.gastos.push(g);  this.save(); },
  delGasto(id) { this.gastos   = this.gastos.filter(x => x.id !== id); this.save(); },
  editGasto(id, data) {
    const i = this.gastos.findIndex(x => x.id === id);
    if (i >= 0) { this.gastos[i] = { ...this.gastos[i], ...data }; this.save(); }
  },

  /* --- INGRESOS --- */
  addIngreso(i)  { this.ingresos.push(i); this.save(); },
  delIngreso(id) { this.ingresos = this.ingresos.filter(x => x.id !== id); this.save(); },
  editIngreso(id, data) {
    const i = this.ingresos.findIndex(x => x.id === id);
    if (i >= 0) { this.ingresos[i] = { ...this.ingresos[i], ...data }; this.save(); }
  },

  /* --- PRESUPUESTO --- */
  setPresupuesto(v) { this.presupuesto = v; this.save(); },

  /* --- CATEGORÍAS --- */
  addCat(c) {
    if (!this.catsExtras.includes(c)) { this.catsExtras.push(c); this.save(); }
  },

  /* --- CICLOS --- */
  cerrarCiclo(ciclo) { this.ciclos.unshift(ciclo); this.save(); },

  /* --- RESET CICLO --- */
  reiniciar() {
    this.gastos   = [];
    this.ingresos = [];
    this.save();
  },

  /* --- TOTALES FILTRADOS --- */
  gastosF(filtro)   { return filtrar(this.gastos,   filtro); },
  ingresosF(filtro) { return filtrar(this.ingresos, filtro); },
};

/* ============================================================
   FILTRADO POR TIEMPO
   ============================================================ */
function filtrar(lista, { tiempo, fecha }) {
  const ref = fecha || hoyISO();
  return lista.filter(r => {
    const f = r.fecha || hoyISO();
    if (tiempo === 'dia')    return f === ref;
    if (tiempo === 'semana') return mismaSemanaDe(f, ref);
    if (tiempo === 'mes')    return f.slice(0,7) === ref.slice(0,7);
    if (tiempo === 'anual')  return f.slice(0,4) === ref.slice(0,4);
    return true;
  });
}

function mismaSemanaDe(iso, ref) {
  const lunes = dt => {
    const d = new Date(dt + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0,10);
  };
  return lunes(iso) === lunes(ref);
}

/* ============================================================
   UTILS FECHA
   ============================================================ */
function hoyISO() {
  return new Date().toISOString().slice(0,10);
}

function formatFechaCorta(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}-${m}-${y.slice(2)}`;
}

function formatFechaLinda(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  const ms = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d} ${ms[parseInt(m)-1]} ${y}`;
}

function mesAnioLabel(iso) {
  if (!iso) return '';
  const [y,m] = iso.split('-');
  const ms = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${ms[parseInt(m)-1]} ${y}`;
}

function formatMoney(n) {
  if (isNaN(n) || n === undefined) return '$0';
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escHTML(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sum(arr, key) {
  return arr.reduce((acc, x) => acc + (x[key] || 0), 0);
}

/* ============================================================
   CATEGORÍAS
   ============================================================ */
const CATS_BASE = [
  { val:'Comida',         label:'🍽️ Comida' },
  { val:'Bebidas',        label:'🥤 Bebidas' },
  { val:'Alcohol',        label:'🍺 Alcohol' },
  { val:'Fiesta',         label:'🎉 Fiesta' },
  { val:'Transporte',     label:'🚌 Transporte' },
  { val:'Gasolina-Moto',  label:'⛽ Gasolina Moto' },
  { val:'Gasolina-Carro', label:'⛽ Gasolina Carro' },
];

function cargarCategorias(selectId, selected) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const extras = [...DB.catsExtras].sort((a,b) => a.localeCompare(b));
  const opts = [
    ...CATS_BASE,
    ...extras.map(e => ({ val: e, label: e })),
    { val: 'Otros', label: '➕ Otros' }
  ];
  sel.innerHTML = opts.map(o =>
    `<option value="${escHTML(o.val)}" ${o.val === selected ? 'selected' : ''}>${escHTML(o.label)}</option>`
  ).join('');
}

/* init */
DB.load();
