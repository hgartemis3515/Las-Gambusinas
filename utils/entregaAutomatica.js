/** Espera entre salió de cocina y entrega automática. 0 = al instante. Default 15. */
export function minutosEntregaAutomaticaDesdeConfig(config) {
  const n = Number(config?.mozos?.entregaAutomaticaMinutos);
  if (!Number.isFinite(n) || n < 0) return 15;
  return Math.min(180, Math.floor(n));
}

export function msRestantesEntregaAutomatica(plato, minutos) {
  if (!minutos || minutos <= 0) return 0;
  const t = plato?.tiempos?.salio || plato?.tiempos?.recoger;
  const start = t ? new Date(t).getTime() : Date.now();
  if (!Number.isFinite(start)) return minutos * 60 * 1000;
  return Math.max(0, start + minutos * 60 * 1000 - Date.now());
}

export function formatearCountdownEntrega(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
