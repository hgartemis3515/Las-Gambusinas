const ESTADOS_RESERVA_VIGENTE = ['pendiente_aprobar', 'pendiente', 'activa'];

export function idEntidad(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'object') {
    if (v._id != null) return String(v._id);
    if (v.$oid) return String(v.$oid);
    if (typeof v.toString === 'function') {
      const s = v.toString();
      if (/^[a-f0-9]{24}$/i.test(s)) return s;
    }
  }
  return String(v);
}

export function clavesPermiso(permisos) {
  if (!Array.isArray(permisos)) return [];
  return permisos
    .map((p) => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object' && p.permitido !== false) {
        return p.permiso || p.id || '';
      }
      return '';
    })
    .filter(Boolean);
}

/** Crear reservas: permiso explícito, admin/supervisor, o rol mozo (sesión vieja / mapa incompleto). */
export function usuarioPuedeCrearReservas(user) {
  const rol = String(user?.rol || '').toLowerCase();
  if (rol === 'admin' || rol === 'supervisor') return true;
  const keys = clavesPermiso(user?.permisos);
  if (keys.includes('crear-reservas-mozos')) return true;
  return ['mozos', 'capitanmozos', 'cajero'].includes(rol);
}

export function mismaMesaReserva(reserva, mesa) {
  const rid = idEntidad(reserva?.mesa);
  const mid = idEntidad(mesa?._id || mesa);
  return !!(rid && mid && rid === mid);
}

export function reservaEsDeMozo(reserva, mozoId) {
  const yo = idEntidad(mozoId);
  if (!yo || !reserva) return false;
  return idEntidad(reserva.mozo) === yo || idEntidad(reserva.creadoPor) === yo;
}

/** Comanda del ciclo actual del mozo (populate o id suelto). */
export function comandaEsDeMozo(comanda, mozoId) {
  const yo = idEntidad(mozoId);
  if (!yo || !comanda) return false;
  return idEntidad(comanda.mozos) === yo || idEntidad(comanda.mozo) === yo;
}

function ordenarReservasVigentes(arr) {
  const prio = { activa: 3, pendiente: 2, pendiente_aprobar: 1 };
  return [...arr].sort((a, b) => {
    const pe = (prio[String(b.estado || '').toLowerCase()] || 0)
      - (prio[String(a.estado || '').toLowerCase()] || 0);
    if (pe !== 0) return pe;
    return new Date(a.fechaReserva || a.createdAt || 0) - new Date(b.fechaReserva || b.createdAt || 0);
  });
}

/** Con varias reservas en la misma mesa, prioriza la del mozo actual. */
export function elegirReservaDeMesa(reservas, mesa, mozoId) {
  const vigentes = (reservas || []).filter((r) =>
    mismaMesaReserva(r, mesa)
    && ESTADOS_RESERVA_VIGENTE.includes(String(r.estado || '').toLowerCase())
  );
  if (vigentes.length === 0) return null;
  const mias = vigentes.filter((r) => reservaEsDeMozo(r, mozoId));
  if (mias.length) return ordenarReservasVigentes(mias)[0];
  return ordenarReservasVigentes(vigentes)[0];
}

export function elegirReservaEspera(reservas, mesa, mozoId) {
  const deMesa = (reservas || []).filter((r) =>
    mismaMesaReserva(r, mesa)
    && String(r.estado || '').toLowerCase() === 'pendiente_aprobar'
  );
  if (deMesa.length === 0) return null;
  const mias = deMesa.filter((r) => reservaEsDeMozo(r, mozoId));
  return (mias.length ? mias : deMesa)[0];
}

/** Tras crear comanda, la mesa de reserva puede seguir reservado / pendiente_aprobar. */
export function estadoMesaConfirmadoTrasCrearComanda(estado, esDeReserva) {
  const st = String(estado || '').toLowerCase();
  if (esDeReserva) {
    return st === 'pedido' || st === 'reservado' || st === 'pendiente_aprobar';
  }
  return st === 'pedido';
}

export function estadoMesaLocalTrasCrearComanda(estadoServidor, esDeReserva, estadoAnterior) {
  if (esDeReserva) {
    const st = String(estadoServidor || estadoAnterior || 'reservado').toLowerCase();
    if (st === 'pedido' || st === 'reservado' || st === 'pendiente_aprobar') return st;
    return 'reservado';
  }
  return 'pedido';
}
