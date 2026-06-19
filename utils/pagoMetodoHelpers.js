/**
 * Helpers de método de pago, moneda y vuelto — App Mozos.
 * Comparte valores normalizados con el backend (efectivo, digital, tarjeta).
 */

export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'digital', label: 'YAPE/PLIN' },
  { value: 'tarjeta', label: 'CRÉDITO/DÉBITO' },
];

export const METODO_PAGO_LABELS = {
  efectivo: 'Efectivo',
  digital: 'YAPE/PLIN',
  tarjeta: 'CRÉDITO/DÉBITO',
};

export const MONEDAS = {
  PEN: { code: 'PEN', label: 'Soles (PEN)', simbolo: 'S/.' },
  USD: { code: 'USD', label: 'Dólares (USD)', simbolo: '$' },
};

export const MONEDA_DEFAULT = 'PEN';

/**
 * Devuelve el símbolo de moneda para un código dado.
 * @param {'PEN'|'USD'} moneda
 * @returns {string}
 */
export function simboloMoneda(moneda) {
  return MONEDAS[moneda]?.simbolo || 'S/.';
}

/**
 * Etiqueta legible de método de pago.
 * @param {string} metodo
 * @returns {string}
 */
export function labelMetodoPago(metodo) {
  return METODO_PAGO_LABELS[metodo] || metodo || 'Efectivo';
}

/**
 * Normaliza un string numérico (acepta coma o punto decimal) a Number.
 * @param {string} str
 * @returns {number}
 */
export function parseMonto(str) {
  if (str == null || str === '') return 0;
  const normalized = String(str).replace(',', '.').replace(/[^0-9.]/g, '');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Calcula el vuelto en la moneda visible.
 * @param {number} totalEnMoneda
 * @param {number} montoRecibido
 * @returns {number}
 */
export function calcularVueltoPreview(totalEnMoneda, montoRecibido) {
  const total = Number(totalEnMoneda) || 0;
  const recibido = Number(montoRecibido) || 0;
  return Math.max(0, Math.round((recibido - total) * 100) / 100);
}

/**
 * Convierte un total en PEN a la moneda seleccionada usando el tipo de cambio.
 * @param {number} totalPen
 * @param {'PEN'|'USD'} moneda
 * @param {number|null} tipoCambioUsd  PEN por 1 USD
 * @returns {number}
 */
export function convertirMoneda(totalPen, moneda, tipoCambioUsd) {
  if (moneda === 'USD') {
    if (!tipoCambioUsd || tipoCambioUsd <= 0) return null;
    return Math.round((Number(totalPen) / tipoCambioUsd) * 100) / 100;
  }
  return Number(totalPen) || 0;
}

/**
 * Formatea un monto con símbolo de moneda y N decimales.
 * @param {number} monto
 * @param {'PEN'|'USD'} moneda
 * @param {number} decimales
 * @returns {string}
 */
export function formatearMontoConMoneda(monto, moneda, decimales = 2) {
  const simbolo = simboloMoneda(moneda);
  const num = Number(monto) || 0;
  return `${simbolo} ${num.toFixed(decimales)}`;
}

/**
 * ¿El método requiere capturar monto recibido / vuelto?
 */
export function requiereEfectivo(metodo) {
  return metodo === 'efectivo';
}

/**
 * Valida que el monto recibido sea suficiente para el total.
 * @returns {{ ok: boolean, mensaje?: string }}
 */
export function validarEfectivo(totalEnMoneda, montoRecibido) {
  const total = Number(totalEnMoneda) || 0;
  const recibido = Number(montoRecibido) || 0;
  if (recibido < total) {
    return {
      ok: false,
      mensaje: 'El monto recibido no puede ser menor al total',
    };
  }
  return { ok: true };
}
