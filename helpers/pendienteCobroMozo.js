import { comandaEsDeMozo } from '../utils/reservasMozo';

/** Ticket/PPA aprobado o plato ya pagado: deja de contar en el pendiente del mozo. */
function platoYaCobradoOAprobado(plato) {
  if (!plato || plato.eliminado === true || plato.anulado === true) return true;
  const e = String(plato.estado || '').toLowerCase();
  if (e === 'pagado') return true;
  const et = String(plato.pagoAdelantado?.estadoTicket || '').toLowerCase();
  return et === 'aprobado';
}

function totalLineaPlato(plato) {
  return (Number(plato.precio) || 0) * (Number(plato.cantidad) || 1);
}

/**
 * Cobro aún pendiente de las comandas del mozo (hasta que cocina apruebe el ticket/PPA o fuerce el pago).
 * `cobrado` sin `estadoTicket: aprobado` sigue pendiente (PPA esperando cocina).
 */
export function calcularPendienteCobroComandas(comandas, mozoId) {
  if (!mozoId || !Array.isArray(comandas)) return 0;
  let total = 0;
  for (const c of comandas) {
    if (!comandaEsDeMozo(c, mozoId)) continue;
    if (c.eliminada === true || c.eliminado === true) continue;
    if (c.IsActive === false || c.isActive === false) continue;
    const st = String(c.status || '').toLowerCase();
    if (['pagado', 'completado', 'cancelado', 'anulado', 'cerrado'].includes(st)) continue;
    const platos = (c.platos || []).filter((p) => p.eliminado !== true && p.anulado !== true);
    if (!platos.length) continue;
    const sinCobrar = platos.filter((p) => !platoYaCobradoOAprobado(p));
    if (!sinCobrar.length) continue;
    if (sinCobrar.length === platos.length && c.totalCalculado != null) {
      total += Number(c.totalCalculado) || 0;
    } else {
      total += sinCobrar.reduce((s, p) => s + totalLineaPlato(p), 0);
    }
  }
  return Math.round(total * 100) / 100;
}

export function formatPendienteCobro(monto, simbolo = 'S/.') {
  const n = Number(monto);
  const val = Number.isFinite(n) ? n : 0;
  return `${simbolo} ${val.toFixed(2)}`;
}
