export const OMITIR_CONFIRMACION_PAGO_KEY = '@lasgambusinas_omitir_confirmacion_pago';

/** Por defecto se muestra el Alert de Confirmar Pago. */
let omitirConfirmacionPago = false;

export function setOmitirConfirmacionPagoCache(valor) {
  omitirConfirmacionPago = valor === true;
}

export function getOmitirConfirmacionPagoCache() {
  return omitirConfirmacionPago;
}

export function parseOmitirConfirmacionPago(raw) {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return false;
}
