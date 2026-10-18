/** Caja tiene 1 hora para cobrar la reserva. Si no, se anula. */
export const MINUTOS_LIMITE_COBRO_RESERVA = 60;
export const MOTIVO_RESERVA_NO_COBRADA = 'Reserva no cobrada';
export const ETIQUETA_PENDIENTE_COBRO = 'Pendiente de Cobro';

export function fechaLimiteCobroDe(reserva) {
  if (!reserva) return null;
  if (reserva.fechaLimiteCobro) return new Date(reserva.fechaLimiteCobro).getTime();
  const base = reserva.creadoEn || reserva.createdAt;
  if (!base) return null;
  return new Date(base).getTime() + MINUTOS_LIMITE_COBRO_RESERVA * 60 * 1000;
}

export function msRestantesCobro(reserva, ahora = Date.now()) {
  const limite = typeof reserva === 'number' ? reserva : fechaLimiteCobroDe(reserva);
  if (!limite) return null;
  return Math.max(0, limite - ahora);
}

export function formatoCuentaRegresiva(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
