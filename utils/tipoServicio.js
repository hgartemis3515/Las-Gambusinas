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

/** Texto del cuadro Tipo en el ticket de caja y de cocina. */
export function tipoCuadroTicket(lineas, { sinMesa = false } = {}) {
  const tipos = (lineas || [])
    .filter((p) => p && p.eliminado !== true && p.anulado !== true)
    .map((p) => String(p.tipoServicio || 'mesa').toLowerCase());
  const hayExtra = tipos.some((t) => t === TIPO_EXTRA_LLEVAR);
  const hayLlevar = tipos.some((t) => t === TIPO_PARA_LLEVAR);
  const hayMesa = tipos.some((t) => t !== TIPO_PARA_LLEVAR && t !== TIPO_EXTRA_LLEVAR);
  if (sinMesa || (tipos.length > 0 && hayLlevar && !hayMesa && !hayExtra)) return 'Para llevar';
  if (hayExtra) return 'Mesa extra llevar';
  return 'Para Mesa';
}
