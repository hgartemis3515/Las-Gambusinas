import { idEntidad } from './reservasMozo';

const ESTADOS_MESA_SOLO_DUENO = [
  'pedido',
  'preparado',
  'entregado',
  'pagado',
  'pagando',
  'pendiente_aprobar',
  'pendiente_pago',
  'reportado',
  'esperando',
];

export function mesaExigeDueno(estado) {
  return ESTADOS_MESA_SOLO_DUENO.includes(String(estado || '').toLowerCase());
}

function vigentes(comandas) {
  return (comandas || []).filter((c) => {
    if (!c || c.eliminada === true || c.IsActive === false) return false;
    const st = String(c.status || '').toLowerCase();
    return st !== 'cancelado' && st !== 'anulado';
  });
}

/** Dueño = comanda vigente más antigua (quien abrió la mesa). */
export function comandaDuena(comandas) {
  const list = vigentes(comandas);
  if (!list.length) return null;
  return list.slice().sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime() || 0;
    const tb = new Date(b.createdAt || 0).getTime() || 0;
    if (ta !== tb) return ta - tb;
    return (Number(a.comandaNumber) || 0) - (Number(b.comandaNumber) || 0);
  })[0];
}

export function mesaOcupadaPorOtroMozo(comandas, mozoId) {
  const duena = comandaDuena(comandas);
  if (!duena) return false;
  const dueno = idEntidad(duena.mozos) || idEntidad(duena.mozo);
  const yo = idEntidad(mozoId);
  if (!dueno || !yo) return false;
  return dueno !== yo;
}

export function mozoAsignadoEnComandas(comandas, mozoId) {
  const yo = idEntidad(mozoId);
  if (!yo) return false;
  return vigentes(comandas).some((c) => (idEntidad(c.mozos) || idEntidad(c.mozo)) === yo);
}

export function mensajeMesaOtroMozo(estado) {
  const etiqueta = String(estado || 'ocupada');
  return `Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado '${etiqueta}'.`;
}
