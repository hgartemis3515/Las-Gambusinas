/** Espera entre salió de cocina y entrega automática. 0 = al instante. Default 15. */
export function minutosEntregaAutomaticaDesdeConfig(config) {
  const n = Number(config?.mozos?.entregaAutomaticaMinutos);
  if (!Number.isFinite(n) || n < 0) return 15;
  return Math.min(180, Math.floor(n));
}

/** Instantes ISO, Date, epoch ms/s, o {$date}. NaN si no se puede leer. */
export function parseTiempoMs(value) {
  if (value == null || value === '') return NaN;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return NaN;
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'object') {
    if (value.$date != null) return parseTiempoMs(value.$date);
    if (typeof value.toDate === 'function') {
      try {
        return parseTiempoMs(value.toDate());
      } catch (_) {
        return NaN;
      }
    }
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/** true si hay que anclar el countdown a "ahora" (falta salio o la marca está en el futuro). */
export function tiempoSalioRequiereAncla(plato, now = Date.now()) {
  const raw = parseTiempoMs(plato?.tiempos?.salio);
  if (!Number.isFinite(raw)) return true;
  return raw > now + 2000;
}

/**
 * Countdown salió → entregado. Solo `tiempos.salio` (no recoger/pedido).
 * Nunca supera los minutos configurados (evita 77:00 por TZ).
 * Si la marca falta o está en el futuro, devuelve el total; el caller ancla un start.
 */
export function msRestantesEntregaAutomatica(plato, minutos, now = Date.now()) {
  const mins = Number(minutos);
  if (!Number.isFinite(mins) || mins <= 0) return 0;
  const duration = Math.min(180, Math.floor(mins)) * 60 * 1000;
  const raw = parseTiempoMs(plato?.tiempos?.salio);
  if (!Number.isFinite(raw) || raw > now + 2000) return duration;
  return Math.max(0, Math.min(duration, raw + duration - now));
}

export function formatearCountdownEntrega(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
