/**
 * Ciclo de comandas por mesa (app mozos).
 *
 * /para-pagos solo incluye comandas con platos entregado|pagado|pendiente o PPA.
 * Tras "solicitar pago", una comanda nueva (platos en pedido) vive en /activas.
 * Si el cliente corta en la primera ruta no vacía, esa comanda desaparece del detalle.
 */

function debeFusionarRutasCiclo(estadoMesa) {
  const st = String(estadoMesa || '').toLowerCase();
  return st === 'pendiente_aprobar' || st === 'pendiente_pago';
}

function idComanda(c) {
  if (!c) return '';
  if (c._id == null) return '';
  return String(c._id);
}

function stampComanda(c) {
  const t = new Date(c?.updatedAt || c?.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function mergeComandasPorId() {
  const map = new Map();
  const lists = Array.prototype.slice.call(arguments);
  for (let i = 0; i < lists.length; i += 1) {
    const list = lists[i];
    if (!Array.isArray(list)) continue;
    for (let j = 0; j < list.length; j += 1) {
      const c = list[j];
      const id = idComanda(c);
      if (!id) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, c);
        continue;
      }
      const prevN = (prev.platos || []).length;
      const nextN = (c.platos || []).length;
      if (nextN > prevN || (nextN === prevN && stampComanda(c) >= stampComanda(prev))) {
        map.set(id, c);
      }
    }
  }
  return Array.from(map.values());
}

function extraerBatch(data) {
  if (!data || data.success === false) return [];
  const lista = data.comandas;
  if (!Array.isArray(lista) || lista.length === 0) return [];
  return lista;
}

/**
 * @param {Array<{ ruta: string, data?: object }>} respuestas
 * @param {string} estadoMesa
 * @returns {{ comandas: object[], pedidoId: string|null }}
 */
function reducirRespuestasCicloMesa(respuestas, estadoMesa) {
  const fusionar = debeFusionarRutasCiclo(estadoMesa);
  const batches = [];
  let pedidoId = null;
  const items = Array.isArray(respuestas) ? respuestas : [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] || {};
    const ruta = item.ruta;
    const data = item.data;
    if (data && data.pedidoId) pedidoId = data.pedidoId;
    const batch = extraerBatch(data);
    if (!batch.length) continue;
    if (ruta === 'pagadas' && batches.length) continue;
    batches.push(batch);
    if (!fusionar) break;
  }
  return {
    comandas: mergeComandasPorId.apply(null, batches),
    pedidoId,
  };
}

module.exports = {
  __esModule: true,
  debeFusionarRutasCiclo,
  mergeComandasPorId,
  reducirRespuestasCicloMesa,
};
