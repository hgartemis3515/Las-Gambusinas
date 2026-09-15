export const REDIRECCION_ENVIO_STORAGE_KEY = '@gambusinas/redireccion-envio-prefs';

export const REDIRECCION_ENVIO_OPCIONES = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'comanda', label: 'Comanda detalle' },
];

export const REDIRECCION_ENVIO_DEFAULT = 'pendientes';

export function parseRedireccionEnvioPref(raw) {
  let data = raw;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { data = JSON.parse(raw); } catch { data = null; }
  }
  if (typeof data === 'string') {
    const v = data.trim();
    return REDIRECCION_ENVIO_OPCIONES.some((o) => o.id === v) ? v : REDIRECCION_ENVIO_DEFAULT;
  }
  if (!data || typeof data !== 'object') return REDIRECCION_ENVIO_DEFAULT;
  const v = typeof data.destino === 'string' ? data.destino.trim() : '';
  return REDIRECCION_ENVIO_OPCIONES.some((o) => o.id === v) ? v : REDIRECCION_ENVIO_DEFAULT;
}
