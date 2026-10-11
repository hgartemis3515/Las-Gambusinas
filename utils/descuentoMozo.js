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

/** Peso del bruto. El descuento de grupo cae en la comanda de mayor valor. */
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

function montosEnLaMayor(pesos, monto) {
  const vals = (pesos || []).map((p) => Math.max(0, Math.round((Number(p) || 0) * 100)));
  const out = vals.map(() => 0);
  let resto = Math.max(0, Math.round((Number(monto) || 0) * 100));
  const tope = vals.reduce((s, c) => s + c, 0);
  if (resto > tope) resto = tope;
  const order = vals.map((cents, i) => ({ i, cents })).sort((a, b) => b.cents - a.cents || a.i - b.i);
  for (const item of order) {
    if (resto <= 0 || item.cents <= 0) continue;
    const toma = Math.min(item.cents, resto);
    out[item.i] = toma / 100;
    resto -= toma;
  }
  return out;
}

export function montosDescuentoPorComanda(comandas, monto) {
  const list = comandas || [];
  const pesos = list.map(pesoBrutoComanda);
  const total = pesos.reduce((s, p) => s + p, 0);
  const m = Math.min(Math.max(0, Number(monto) || 0), total);
  if (!(m > 0) || !(total > 0)) return list.map(() => 0);
  return montosEnLaMayor(pesos, m);
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
