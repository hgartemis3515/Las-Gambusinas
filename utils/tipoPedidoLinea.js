/**
 * Tipo de menú elegido en el selector de Mozos al agregar el plato.
 * Snapshot independiente de `plato.tipos` del catálogo.
 */

export function slugTipoPedido(valor) {
  if (valor == null || valor === '') return null;
  const s = String(valor).toLowerCase().trim();
  return s || null;
}

export function mismoTipoPedido(a, b) {
  return String(slugTipoPedido(a) || '') === String(slugTipoPedido(b) || '');
}
