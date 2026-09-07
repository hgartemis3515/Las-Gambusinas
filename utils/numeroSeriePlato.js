/**
 * Número de serie (2–4 dígitos) al agregar un plato marcado en platos.html.
 */

export function normalizarNumeroSerie(v) {
  return String(v == null ? '' : v).replace(/\D/g, '').slice(0, 4);
}

export function numeroSerieEsValido(v) {
  return /^\d{2,4}$/.test(normalizarNumeroSerie(v));
}

export function platoRequiereNumeroSerie(plato, catalogo) {
  if (!plato) return false;
  if (plato.requiereNumeroSerie === true) return true;
  if (catalogo && catalogo.requiereNumeroSerie === true) return true;
  const cat = plato.plato;
  return !!(cat && typeof cat === 'object' && cat.requiereNumeroSerie === true);
}
