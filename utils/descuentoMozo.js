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

/** Peso para prorratear (igual que comandas.html aplicarDescuentoGrupo). */
export function pesoBrutoComanda(c) {
  const sin = Number(c?.totalSinDescuento) || 0;
  if (sin > 0) return sin;
  return Math.max(
    0,
    (Number(c?.totalCalculado) || Number(c?.precioTotal) || 0) + (Number(c?.montoDescuento) || 0)
  );
}

export function brutoGrupoComandas(comandas) {
  return Number((comandas || []).reduce((s, c) => s + brutoParaDescuento(c), 0).toFixed(2));
}

export function montoDescuentoGrupo(comandas) {
  return Number((comandas || []).reduce((s, c) => s + (Number(c?.montoDescuento) || 0), 0).toFixed(2));
}

export function repartirCentesimos(pesos, montoTotal) {
  const vals = (pesos || []).map((p) => Math.max(0, Number(p) || 0));
  const cents = Math.round((Number(montoTotal) || 0) * 100);
  if (!vals.length || cents <= 0) return vals.map(() => 0);
  const totalPesos = vals.reduce((s, p) => s + p, 0);
  if (totalPesos <= 0) return vals.map(() => 0);
  const raw = vals.map((p) => (p / totalPesos) * cents);
  const floors = raw.map((x) => Math.floor(x + 1e-9));
  let resto = cents - floors.reduce((s, x) => s + x, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < resto; k++) floors[order[k % order.length].i] += 1;
  return floors.map((c) => c / 100);
}

export function montosDescuentoPorComanda(comandas, monto) {
  const list = comandas || [];
  const pesos = list.map(pesoBrutoComanda);
  const total = pesos.reduce((s, p) => s + p, 0);
  const m = Math.min(Math.max(0, Number(monto) || 0), total);
  if (!(m > 0) || !(total > 0)) return list.map(() => 0);
  return repartirCentesimos(pesos, m);
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

export function motivoDescuentoEsValido(motivo) {
  return String(motivo || '').trim().length >= 2;
}

export function comandaTieneDescuentoMozo(c) {
  if (!c) return false;
  return Number(c.descuento) > 0
    || Number(c.montoDescuento) > 0
    || Number(c.descuentoMontoFijo) > 0;
}
