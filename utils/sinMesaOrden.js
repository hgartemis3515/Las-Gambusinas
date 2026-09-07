/** Pedido para llevar sin ocupar mesa física. */

export const COLOR_PARA_LLEVAR = '#8B5CF6';

export const SELECCION_SIN_MESA = { sinMesa: true, nummesa: 'Sin mesa' };

export function esSeleccionSinMesa(mesa) {
  if (!mesa || typeof mesa !== 'object') return false;
  if (mesa.sinMesa === true) return true;
  if (mesa._id == null && (mesa.nummesa === 'Sin mesa' || mesa.nummesa === 'SIN_MESA')) return true;
  return false;
}

export function esFilaComandaSinMesa(item) {
  if (!item) return false;
  if (item.esSinMesa === true || item.sinMesa === true) return true;
  if (item.mesaId) return false;
  return item.mesaNumero == null || item.mesaNumero === '';
}
