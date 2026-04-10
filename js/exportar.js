/* ============================================================
   EXPORTAR.JS — Exportación CSV
   ============================================================ */

function abrirModalExportar() {
  abrirModal('modal-exportar');
}

/* ============================================================
   EXPORTAR
   ============================================================ */
function exportar(tipo) {
  let csv = '';
  const sep = ',';
  const nl  = '\n';

  switch (tipo) {

    case 'gastos': {
      csv = ['Fecha','Concepto','Categoría','Monto','Tipo'].join(sep) + nl;
      const sorted = [...DB.gastos].sort((a,b) => (a.fecha||'') < (b.fecha||'') ? -1 : 1);
      sorted.forEach(g => {
        csv += [
          g.fecha || '',
          csvCell(g.concepto),
          csvCell(g.categoria),
          g.monto,
          'Gasto'
        ].join(sep) + nl;
      });
      descargar(csv, 'gastos.csv');
      break;
    }

    case 'ingresos': {
      csv = ['Fecha','Concepto','Monto','Tipo'].join(sep) + nl;
      const sorted = [...DB.ingresos].sort((a,b) => (a.fecha||'') < (b.fecha||'') ? -1 : 1);
      sorted.forEach(i => {
        csv += [
          i.fecha || '',
          csvCell(i.concepto),
          i.monto,
          'Ingreso'
        ].join(sep) + nl;
      });
      descargar(csv, 'ingresos.csv');
      break;
    }

    case 'todos': {
      csv = ['Fecha','Concepto','Categoría','Monto','Tipo'].join(sep) + nl;
      const todos = [
        ...DB.gastos.map(g => ({ ...g, _tipo: 'Gasto' })),
        ...DB.ingresos.map(i => ({ ...i, categoria: '—', _tipo: 'Ingreso' }))
      ].sort((a,b) => (a.fecha||'') < (b.fecha||'') ? -1 : 1);
      todos.forEach(r => {
        csv += [
          r.fecha || '',
          csvCell(r.concepto),
          csvCell(r.categoria || '—'),
          r.monto,
          r._tipo
        ].join(sep) + nl;
      });
      descargar(csv, 'movimientos.csv');
      break;
    }

    case 'categorias': {
      csv = ['Categoría','Total Gastos','% del Total'].join(sep) + nl;
      const cats = {};
      DB.gastos.forEach(g => { cats[g.categoria] = (cats[g.categoria]||0) + g.monto; });
      const totalG = sum(DB.gastos, 'monto');
      Object.entries(cats)
        .sort((a,b) => b[1]-a[1])
        .forEach(([cat, tot]) => {
          const pct = totalG > 0 ? ((tot/totalG)*100).toFixed(2) : '0.00';
          csv += [csvCell(cat), tot, pct + '%'].join(sep) + nl;
        });
      descargar(csv, 'categorias.csv');
      break;
    }

    case 'resumen': {
      csv = ['Mes','Presupuesto','Ingresos','Gastos','Balance'].join(sep) + nl;

      // Ciclos cerrados
      DB.ciclos.forEach(c => {
        csv += [
          csvCell(c.label || mesAnioLabel(c.fechaInicio)),
          c.presupuesto,
          c.totalIngresos,
          c.totalGastos,
          c.balance
        ].join(sep) + nl;
      });

      // Mes actual
      const totalI = sum(DB.ingresos, 'monto');
      const totalG = sum(DB.gastos,   'monto');
      csv += [
        csvCell('Actual - ' + mesAnioLabel(hoyISO())),
        DB.presupuesto,
        totalI,
        totalG,
        DB.presupuesto + totalI - totalG
      ].join(sep) + nl;

      descargar(csv, 'resumen_mensual.csv');
      break;
    }
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function csvCell(val) {
  const s = String(val || '');
  // escape commas and quotes
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function descargar(contenido, nombre) {
  const BOM  = '\uFEFF'; // UTF-8 BOM para Excel
  const blob = new Blob([BOM + contenido], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
