/* ============================================================
   STORAGE.JS - Estado global y persistencia Supabase
   ============================================================ */

const DB = {
  gastos: [],
  ingresos: [],
  presupuesto: 20000,
  catsExtras: [],
  ciclos: [],
  categories: [],
  currentUser: null,
  currentCycle: null,
  settings: null,
  isReady: false,

  async load() {
    this.ensureClient();

    const user = await this.fetchOrCreateUser();
    const settings = await this.fetchSettings(user.id);
    const categories = await this.fetchCategories(user.id);
    const currentCycle = await this.fetchOrCreateOpenCycle(user.id, settings.default_budget);
    const transactions = await this.fetchTransactions(user.id, currentCycle.id);
    const closedCycles = await this.fetchClosedCycles(user.id);

    this.currentUser = user;
    this.settings = settings;
    this.categories = categories;
    this.currentCycle = currentCycle;
    this.presupuesto = Number(currentCycle.base_budget || settings.default_budget || 20000);
    this.catsExtras = this.computeExtraCategories(categories);
    this.gastos = transactions
      .filter(t => t.type === 'expense')
      .map(t => this.mapTransactionToApp(t, 'gasto'));
    this.ingresos = transactions
      .filter(t => t.type === 'income')
      .map(t => this.mapTransactionToApp(t, 'ingreso'));
    this.ciclos = closedCycles.map(c => this.mapCycleToApp(c));
    this.isReady = true;
    return this;
  },

  async refresh() {
    return this.load();
  },

  async syncAfterMutation() {
    await this.refresh();
    await this.recalcCurrentCycleTotals();
    await this.refresh();
  },

  ensureClient() {
    const missingUrl = !SUPABASE_URL || SUPABASE_URL === 'TU_PROJECT_URL';
    const missingKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'TU_ANON_KEY';
    if (!window.sb || missingUrl || missingKey) {
      throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-client.js antes de usar la app.');
    }
  },

  assertReady() {
    if (!this.isReady || !this.currentUser || !this.currentCycle) {
      throw new Error('La base de datos todavia no termina de cargar.');
    }
  },

  async fetchOrCreateUser() {
    const email = APP_USER_EMAIL?.trim();
    if (!email) throw new Error('APP_USER_EMAIL no esta configurado en js/supabase-client.js.');

    const { data, error } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const fallbackName = email.split('@')[0] || 'Finanzas PRO';
    const { data: created, error: insertError } = await sb
      .from('users')
      .insert({ name: fallbackName, email })
      .select()
      .single();

    if (insertError) {
      throw new Error(`No se pudo resolver el usuario base (${email}). ${insertError.message}`);
    }

    return created;
  },

  async fetchSettings(userId) {
    const { data, error } = await sb
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const payload = {
      user_id: userId,
      currency_code: 'MXN',
      locale: 'es-MX',
      default_budget: 20000,
    };

    const { data: created, error: insertError } = await sb
      .from('app_settings')
      .insert(payload)
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  },

  async fetchCategories(userId) {
    const { data, error } = await sb
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async fetchOrCreateOpenCycle(userId, defaultBudget) {
    const { data, error } = await sb
      .from('financial_cycles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const payload = {
      user_id: userId,
      label: mesAnioLabel(hoyISO()),
      start_date: hoyISO(),
      status: 'open',
      base_budget: Number(defaultBudget || 20000),
      total_income: 0,
      total_expense: 0,
      balance: Number(defaultBudget || 20000),
      income_count: 0,
      expense_count: 0,
    };

    const { data: created, error: insertError } = await sb
      .from('financial_cycles')
      .insert(payload)
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  },

  async fetchTransactions(userId, cycleId) {
    const { data, error } = await sb
      .from('transactions')
      .select('id, user_id, cycle_id, category_id, type, concept, amount, transaction_date, notes, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .eq('cycle_id', cycleId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async fetchClosedCycles(userId) {
    const { data, error } = await sb
      .from('financial_cycles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  computeExtraCategories(categories) {
    const baseSet = new Set(CATS_BASE.map(c => c.val.toLowerCase()));
    return categories
      .map(c => c.name)
      .filter(name => !baseSet.has(String(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  },

  mapTransactionToApp(row, tipo) {
    const category = this.categories.find(c => c.id === row.category_id);
    return {
      id: row.id,
      tipo,
      concepto: row.concept,
      monto: Number(row.amount || 0),
      categoria: category?.name || (tipo === 'gasto' ? 'Sin categoria' : 'Ingreso'),
      fecha: row.transaction_date,
      categoryId: row.category_id,
      cycleId: row.cycle_id,
      notes: row.notes || '',
    };
  },

  mapCycleToApp(row) {
    return {
      id: row.id,
      fechaInicio: row.start_date,
      fechaCierre: row.end_date || row.closed_at?.slice(0, 10) || row.start_date,
      presupuesto: Number(row.base_budget || 0),
      totalIngresos: Number(row.total_income || 0),
      totalGastos: Number(row.total_expense || 0),
      balance: Number(row.balance || 0),
      numGastos: Number(row.expense_count || 0),
      numIngresos: Number(row.income_count || 0),
      label: row.label || mesAnioLabel(row.start_date),
    };
  },

  async getOrCreateCategoryId(name) {
    this.assertReady();
    const clean = String(name || '').trim();
    if (!clean) return null;

    const existing = this.categories.find(c => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;

    const payload = {
      user_id: this.currentUser.id,
      name: clean,
      is_system: false,
      is_active: true,
    };

    const { data, error } = await sb
      .from('categories')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    this.categories.push(data);
    this.catsExtras = this.computeExtraCategories(this.categories);
    return data.id;
  },

  async recalcCurrentCycleTotals() {
    this.assertReady();
    const totalIngresos = sum(this.ingresos, 'monto');
    const totalGastos = sum(this.gastos, 'monto');
    const payload = {
      total_income: totalIngresos,
      total_expense: totalGastos,
      balance: Number(this.presupuesto) + totalIngresos - totalGastos,
      income_count: this.ingresos.length,
      expense_count: this.gastos.length,
    };

    const { error } = await sb
      .from('financial_cycles')
      .update(payload)
      .eq('id', this.currentCycle.id);

    if (error) throw error;
  },

  async addGasto(g) {
    this.assertReady();
    const categoryId = await this.getOrCreateCategoryId(g.categoria);
    const payload = {
      user_id: this.currentUser.id,
      cycle_id: this.currentCycle.id,
      category_id: categoryId,
      type: 'expense',
      concept: g.concepto,
      amount: Number(g.monto),
      transaction_date: g.fecha || hoyISO(),
      notes: g.notes || null,
    };

    const { error } = await sb.from('transactions').insert(payload);
    if (error) throw error;
    await this.syncAfterMutation();
  },

  async delGasto(id) {
    this.assertReady();
    const { error } = await sb
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('type', 'expense');

    if (error) throw error;
    await this.syncAfterMutation();
  },

  async editGasto(id, data) {
    this.assertReady();
    const categoryId = await this.getOrCreateCategoryId(data.categoria);
    const payload = {
      concept: data.concepto,
      amount: Number(data.monto),
      transaction_date: data.fecha || hoyISO(),
      category_id: categoryId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('type', 'expense');

    if (error) throw error;
    await this.syncAfterMutation();
  },

  async addIngreso(i) {
    this.assertReady();
    const payload = {
      user_id: this.currentUser.id,
      cycle_id: this.currentCycle.id,
      category_id: null,
      type: 'income',
      concept: i.concepto,
      amount: Number(i.monto),
      transaction_date: i.fecha || hoyISO(),
      notes: i.notes || null,
    };

    const { error } = await sb.from('transactions').insert(payload);
    if (error) throw error;
    await this.syncAfterMutation();
  },

  async delIngreso(id) {
    this.assertReady();
    const { error } = await sb
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('type', 'income');

    if (error) throw error;
    await this.syncAfterMutation();
  },

  async editIngreso(id, data) {
    this.assertReady();
    const payload = {
      concept: data.concepto,
      amount: Number(data.monto),
      transaction_date: data.fecha || hoyISO(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('type', 'income');

    if (error) throw error;
    await this.syncAfterMutation();
  },

  async setPresupuesto(v) {
    this.assertReady();

    const cycleUpdate = sb
      .from('financial_cycles')
      .update({ base_budget: Number(v) })
      .eq('id', this.currentCycle.id);

    const settingsUpsert = sb
      .from('app_settings')
      .upsert({
        user_id: this.currentUser.id,
        currency_code: this.settings?.currency_code || 'MXN',
        locale: this.settings?.locale || 'es-MX',
        default_budget: Number(v),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    const [{ error: cycleError }, { error: settingsError }] = await Promise.all([cycleUpdate, settingsUpsert]);
    if (cycleError) throw cycleError;
    if (settingsError) throw settingsError;

    await this.syncAfterMutation();
  },

  async addCat(c) {
    await this.getOrCreateCategoryId(c);
  },

  async cerrarCiclo() {
    this.assertReady();

    const totalG = sum(this.gastos, 'monto');
    const totalI = sum(this.ingresos, 'monto');
    const balance = Number(this.presupuesto) + totalI - totalG;
    const cierre = hoyISO();

    const updatePayload = {
      label: this.currentCycle.label || mesAnioLabel(cierre),
      end_date: cierre,
      status: 'closed',
      total_income: totalI,
      total_expense: totalG,
      balance,
      income_count: this.ingresos.length,
      expense_count: this.gastos.length,
      closed_at: new Date().toISOString(),
    };

    const { error: closeError } = await sb
      .from('financial_cycles')
      .update(updatePayload)
      .eq('id', this.currentCycle.id);

    if (closeError) throw closeError;

    const nextCyclePayload = {
      user_id: this.currentUser.id,
      label: mesAnioLabel(cierre),
      start_date: cierre,
      status: 'open',
      base_budget: Number(this.presupuesto),
      total_income: 0,
      total_expense: 0,
      balance: Number(this.presupuesto),
      income_count: 0,
      expense_count: 0,
    };

    const { error: createError } = await sb
      .from('financial_cycles')
      .insert(nextCyclePayload);

    if (createError) throw createError;

    await this.refresh();
  },

  async reiniciar() {
    await this.refresh();
  },

  gastosF(filtro) {
    return filtrar(this.gastos, filtro);
  },

  ingresosF(filtro) {
    return filtrar(this.ingresos, filtro);
  },
};

/* ============================================================
   FILTRADO POR TIEMPO
   ============================================================ */
function filtrar(lista, { tiempo, fecha }) {
  const ref = fecha || hoyISO();
  return lista.filter(r => {
    const f = r.fecha || hoyISO();
    if (tiempo === 'dia') return f === ref;
    if (tiempo === 'semana') return mismaSemanaDe(f, ref);
    if (tiempo === 'mes') return f.slice(0, 7) === ref.slice(0, 7);
    if (tiempo === 'anual') return f.slice(0, 4) === ref.slice(0, 4);
    return true;
  });
}

function mismaSemanaDe(iso, ref) {
  const lunes = dt => {
    const d = new Date(dt + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  };
  return lunes(iso) === lunes(ref);
}

/* ============================================================
   UTILS FECHA
   ============================================================ */
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatFechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y.slice(2)}`;
}

function formatFechaLinda(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const ms = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d} ${ms[parseInt(m, 10) - 1]} ${y}`;
}

function mesAnioLabel(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const ms = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${ms[parseInt(m, 10) - 1]} ${y}`;
}

function formatMoney(n) {
  if (isNaN(n) || n === undefined) return '$0';
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escHTML(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sum(arr, key) {
  return arr.reduce((acc, x) => acc + Number(x[key] || 0), 0);
}

/* ============================================================
   CATEGORIAS
   ============================================================ */
const CATS_BASE = [
  { val: 'Comida', label: '🍽️ Comida' },
  { val: 'Bebidas', label: '🥤 Bebidas' },
  { val: 'Alcohol', label: '🍺 Alcohol' },
  { val: 'Fiesta', label: '🎉 Fiesta' },
  { val: 'Transporte', label: '🚌 Transporte' },
  { val: 'Gasolina-Moto', label: '⛽ Gasolina Moto' },
  { val: 'Gasolina-Carro', label: '⛽ Gasolina Carro' },
];

function cargarCategorias(selectId, selected) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const extras = [...DB.catsExtras].sort((a, b) => a.localeCompare(b));
  const opts = [
    ...CATS_BASE,
    ...extras.map(e => ({ val: e, label: e })),
    { val: 'Otros', label: '➕ Otros' },
  ];

  sel.innerHTML = opts.map(o =>
    `<option value="${escHTML(o.val)}" ${o.val === selected ? 'selected' : ''}>${escHTML(o.label)}</option>`
  ).join('');
}
