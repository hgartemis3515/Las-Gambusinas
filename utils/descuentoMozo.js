import { clavesPermiso } from './reservasMozo';

export const MOTIVO_DESCUENTO_DEFAULT = 'Descuento';

export function usuarioPuedeAplicarDescuentos(user) {
  const rol = String(user?.rol || '').toLowerCase();
  if (rol === 'admin' || rol === 'supervisor') return true;
  return clavesPermiso(user?.permisos).includes('aplicar-descuentos');
}

export function brutoParaDescuento(c) {
  if (!c) return 0;
  const sin = Number(c.totalSinDescuento) || 0;
  const md = Number(c.montoDescuento) || 0;
  const tc = Number(c.totalCalculado);
  const pt = Number(c.precioTotal) || 0;
  const brutoGuardado = sin > 0 ? sin : ((Number.isFinite(tc) ? tc : 0) + md);
  if (brutoGuardado > 0) return Number(brutoGuardado.toFixed(2));
  if (pt > 0) return Number(pt.toFixed(2));
  return 0;
}

export function clampMontoDescuento(monto, bruto) {
  const b = Math.max(0, Number(bruto) || 0);
  const m = Number(String(monto ?? '').replace(',', '.')) || 0;
  if (!(m > 0) || !(b > 0)) return 0;
  return Number(Math.min(m, b).toFixed(2));
}

export function motivoDescuentoFinal(motivo) {
  const t = String(motivo || '').trim();
  return t || MOTIVO_DESCUENTO_DEFAULT;
}

export function comandaTieneDescuentoMozo(c) {
  if (!c) return false;
  return Number(c.descuento) > 0
    || Number(c.montoDescuento) > 0
    || Number(c.descuentoMontoFijo) > 0;
}
