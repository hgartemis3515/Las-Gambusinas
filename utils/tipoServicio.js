/** Tipo de servicio de cada línea de plato. No inventar otros valores. */
export const TIPO_MESA = 'mesa';
export const TIPO_PARA_LLEVAR = 'para_llevar';
export const TIPO_EXTRA_LLEVAR = 'extra_llevar';

export const COLOR_LLEVAR = '#8B5CF6';

export function esParaLlevar(tipo) {
  return tipo === TIPO_PARA_LLEVAR;
}

export function esExtraLlevar(tipo) {
  return tipo === TIPO_EXTRA_LLEVAR;
}

/** Color púrpura en Mozos (para llevar y extra llevar). */
export function esLlevarColor(tipo) {
  return tipo === TIPO_PARA_LLEVAR || tipo === TIPO_EXTRA_LLEVAR;
}

export function normalizarTipoServicioLinea(tipo) {
  if (tipo === TIPO_PARA_LLEVAR || tipo === TIPO_EXTRA_LLEVAR) return tipo;
  return TIPO_MESA;
}

export function etiquetaLlevarMozo(tipo) {
  if (tipo === TIPO_EXTRA_LLEVAR) return 'Extra llevar';
  if (tipo === TIPO_PARA_LLEVAR) return 'Para llevar';
  return '';
}
