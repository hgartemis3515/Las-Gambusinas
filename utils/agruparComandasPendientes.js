/**
 * Misma regla que comandas.html processGrouping:
 * pedidoId (primario) o clienteId+mesa (histórico). Dashboard y canceladas: individuales.
 * Un solo ítem en el grupo se muestra como individual.
 */

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeId(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object') val = val._id ?? val.id ?? val;
  const s = String(val).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  return s;
}

function formatGrupoComandasLabel(comandas) {
  const nums = [...new Set(
    (comandas || [])
      .map((c) => c.comandaNumber ?? c.numComanda)
      .filter((n) => n != null && n !== '')
      .map((n) => Number(n))
      .filter((n) => !Number.isNaN(n))
  )].sort((a, b) => a - b);
  if (nums.length === 0) return '—';
  return nums.map((n) => `#${n}`).join('+');
}

const PRIORIDAD_ESTADO = {
  pendiente_aprobar: 6,
  en_espera: 5,
  recoger: 4,
  salio: 4,
  entregado: 3,
  pagado: 2,
  completado: 1,
  cancelado: 0,
};

function estadoMasCritico(comandas) {
  let estado = comandas[0]?.status || comandas[0]?.estado || 'en_espera';
  let max = -1;
  for (const c of comandas) {
    const e = String(c.status || c.estado || 'en_espera').toLowerCase();
    const p = PRIORIDAD_ESTADO[e] ?? 0;
    if (p > max) {
      max = p;
      estado = e;
    }
  }
  return estado;
}

function tsCreated(c) {
  const t = new Date(c?.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function filaDesdeComandas(comandas, key) {
  const first = comandas[0];
  const esGrupo = comandas.length > 1;
  return {
    ...first,
    tipo: esGrupo ? 'grupo' : 'individual',
    id: esGrupo ? key : String(first._id),
    _id: first._id,
    comandaLabel: formatGrupoComandasLabel(comandas),
    pendienteCobro: round2(comandas.reduce((s, c) => s + (Number(c.pendienteCobro) || 0), 0)),
    status: estadoMasCritico(comandas),
    platos: comandas.flatMap((c) => c.platos || []),
    mesaEstado: first.mesaEstado,
    createdAt: new Date(Math.max(...comandas.map(tsCreated))).toISOString(),
  };
}

function agruparComandasPendientes(comandas = []) {
  const gruposPedido = new Map();
  const gruposCliente = new Map();
  const individuales = [];

  for (const c of comandas) {
    const estado = String(c.status || c.estado || '').toLowerCase();
    if (estado === 'cancelado') {
      individuales.push(c);
      continue;
    }
    const origenDashboard = (c.origenCreacion || '') === 'dashboard' || !!c.createdByDashboard;
    if (origenDashboard) {
      individuales.push(c);
      continue;
    }

    const pedidoId = normalizeId(c.pedidoId ?? c.pedido);
    const clienteId = normalizeId(c.clienteId ?? c.cliente?._id ?? c.cliente);
    const mesaNum = c.mesaNumero ?? c.mesaNum ?? (typeof c.mesa === 'number' ? c.mesa : null);

    if (pedidoId) {
      const key = `pedido_${pedidoId}`;
      if (!gruposPedido.has(key)) gruposPedido.set(key, []);
      gruposPedido.get(key).push(c);
    } else if (clienteId) {
      const key = `cliente_${clienteId}_${mesaNum}`;
      if (!gruposCliente.has(key)) gruposCliente.set(key, []);
      gruposCliente.get(key).push(c);
    } else {
      individuales.push(c);
    }
  }

  const filas = [];
  const volcar = (map) => {
    for (const [key, lista] of map) {
      if (lista.length > 1) filas.push(filaDesdeComandas(lista, key));
      else individuales.push(lista[0]);
    }
  };
  volcar(gruposPedido);
  volcar(gruposCliente);

  for (const c of individuales) {
    filas.push(filaDesdeComandas([c], String(c._id)));
  }

  return filas.sort((a, b) => tsCreated(b) - tsCreated(a));
}

module.exports = {
  formatGrupoComandasLabel,
  agruparComandasPendientes,
};

