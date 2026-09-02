import { comandaEsDeMozo } from '../utils/reservasMozo';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function idEntidad(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v._id) return String(v._id);
  return String(v);
}

function sumaPlatosActivos(comanda) {
  let s = 0;
  (comanda.platos || []).forEach((p, i) => {
    if (!p || p.eliminado === true || p.anulado === true) return;
    const cant = Number(p.cantidad ?? comanda.cantidades?.[i] ?? 1) || 1;
    const precio = Number(p.precioUnitario ?? p.precio ?? p.plato?.precio) || 0;
    s += precio * cant;
  });
  return round2(s);
}

function netoComanda(c) {
  const desc = Number(c.montoDescuento) || 0;
  const pct = Number(c.descuento) || 0;
  const calc = Number(c.totalCalculado);
  if (desc > 0 || pct > 0) {
    if (Number.isFinite(calc) && calc >= 0) return round2(Math.max(0, calc));
    const bruto = Number(c.totalSinDescuento) > 0 ? Number(c.totalSinDescuento) : sumaPlatosActivos(c);
    return round2(Math.max(0, bruto - desc));
  }
  if (Number.isFinite(calc) && calc > 0) return round2(calc);
  if (Number(c.totalSinDescuento) > 0) return round2(c.totalSinDescuento);
  return sumaPlatosActivos(c);
}

function platoCobradoEnCaja(plato) {
  if (!plato) return false;
  const e = String(plato.estado || '').toLowerCase();
  if (e === 'pagado') return true;
  if (plato.pagoAdelantado?.cobrado === true) return true;
  const et = String(plato.pagoAdelantado?.estadoTicket || '').toLowerCase();
  return et === 'aprobado';
}

function cobradoLineasNoReserva(comanda) {
  let s = 0;
  (comanda.platos || []).forEach((p, i) => {
    if (!p || p.eliminado === true || p.anulado === true) return;
    if (!platoCobradoEnCaja(p)) return;
    const cant = Number(p.cantidad ?? comanda.cantidades?.[i] ?? 1) || 1;
    const precio = Number(p.precioUnitario ?? p.precio ?? p.plato?.precio) || 0;
    s += precio * cant;
  });
  return round2(s);
}

function adelantoDeReserva(comanda, reservas) {
  const rid = idEntidad(comanda.origenReserva);
  const cid = idEntidad(comanda._id);
  const r = (reservas || []).find((x) => {
    if (rid && idEntidad(x._id) === rid) return true;
    return idEntidad(x.comandaGenerada) === cid;
  });
  return Number(r?.pagoAdelantado?.montoPagado) || 0;
}

function esReservaComanda(c) {
  return !!(c.origenReserva || c.origenCreacion === 'reserva' || c.programadaPorReserva === true);
}

/**
 * Cobro aún pendiente de las comandas del mozo.
 * Neto (con descuento) − seña de reserva − pagos/forzar ya cobrados.
 */
export function calcularPendienteCobroComandas(comandas, mozoId, reservas = []) {
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
    if (platos.every(platoCobradoEnCaja)) continue;

    const neto = netoComanda(c);
    const reserva = esReservaComanda(c);
    const adelanto = reserva ? adelantoDeReserva(c, reservas) : 0;

    const cobradoPlatos = reserva ? 0 : cobradoLineasNoReserva(c);
    total += round2(Math.max(0, neto - adelanto - cobradoPlatos));
  }
  return round2(total);
}

export function formatPendienteCobro(monto, simbolo = 'S/.') {
  const n = Number(monto);
  const val = Number.isFinite(n) ? n : 0;
  return `${simbolo} ${val.toFixed(2)}`;
}
