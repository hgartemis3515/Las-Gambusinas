/** Patch liviano de comandas desde socket: solo estados, sin I/O ni inserts basura. */

export function mismoId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function extraerComandaDeEventoSocket(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.comanda && (data.comanda._id || data.comanda.id)) return data.comanda;
  if (data._id && (Array.isArray(data.platos) || data.status)) return data;
  return null;
}

function idsPlato(p) {
  if (!p) return [];
  return [p._id, p.platoId, p.plato?._id, p.plato].filter(Boolean).map(String);
}

function estadosPlatosIguales(a, b) {
  const pa = a || [];
  const pb = b || [];
  if (pa.length !== pb.length) return false;
  for (let i = 0; i < pa.length; i += 1) {
    if (String(pa[i]?.estado || '') !== String(pb[i]?.estado || '')) return false;
  }
  return true;
}

function mergePlatosEstados(actuales, incoming) {
  const src = incoming || [];
  const estadoPorId = new Map();
  src.forEach((n) => {
    if (n?.estado == null) return;
    idsPlato(n).forEach((id) => estadoPorId.set(id, n.estado));
  });
  return (actuales || []).map((p, i) => {
    for (const id of idsPlato(p)) {
      if (estadoPorId.has(id)) {
        const est = estadoPorId.get(id);
        return est === p.estado ? p : { ...p, estado: est };
      }
    }
    const n = src[i];
    const est = n?.estado;
    if (est == null || est === p.estado) return p;
    return { ...p, estado: est };
  });
}

function itemsEstadoDesdeEvento(data) {
  const items = [];
  if (data.platoId && data.nuevoEstado) {
    items.push({ nuevoEstado: data.nuevoEstado, estadoAnterior: data.estadoAnterior });
  }
  if (Array.isArray(data.platos)) {
    data.platos.forEach((p) => {
      if (p?.nuevoEstado) {
        items.push({ nuevoEstado: p.nuevoEstado, estadoAnterior: p.estadoAnterior });
      }
    });
  }
  return items;
}

function patchPlatosHaciaSalio(platos, nuevoEstado) {
  if (String(nuevoEstado || '').toLowerCase() !== 'salio') {
    return { platos, changed: false };
  }
  const elegible = new Set(['pedido', 'en_espera', 'recoger']);
  const i = (platos || []).findIndex((p) => elegible.has(String(p?.estado || '').toLowerCase()));
  if (i === -1) return { platos, changed: false };
  const next = platos.slice();
  next[i] = { ...next[i], estado: 'salio' };
  return { platos: next, changed: true };
}

function patchPlatosPorEstadoAnterior(platos, items) {
  if (!items.length) return { platos, changed: false };
  const next = (platos || []).slice();
  let changed = false;
  for (const item of items) {
    const prevSt = item.estadoAnterior != null ? String(item.estadoAnterior) : '';
    if (!prevSt || item.nuevoEstado == null) continue;
    const i = next.findIndex((p) => String(p?.estado || '') === prevSt);
    if (i === -1 || next[i].estado === item.nuevoEstado) continue;
    next[i] = { ...next[i], estado: item.nuevoEstado };
    changed = true;
  }
  return { platos: changed ? next : platos, changed };
}

function patchPlatosPorIndice(platos, incoming) {
  if (!Array.isArray(incoming) || !incoming.length) return { platos, changed: false };
  if (!Array.isArray(platos) || platos.length !== incoming.length) return { platos, changed: false };
  let changed = false;
  const next = platos.map((p, i) => {
    const est = incoming[i]?.nuevoEstado || incoming[i]?.estado;
    if (!est || est === p.estado) return p;
    changed = true;
    return { ...p, estado: est };
  });
  return { platos: changed ? next : platos, changed };
}

function patchPlatosPorId(platos, cambios) {
  if (!cambios || cambios.size === 0) return { platos, changed: false };
  let changed = false;
  const next = (platos || []).map((p) => {
    for (const id of idsPlato(p)) {
      const st = cambios.get(id);
      if (st != null && st !== p.estado) {
        changed = true;
        return { ...p, estado: st };
      }
    }
    return p;
  });
  return { platos: changed ? next : platos, changed };
}

function aplicarPatchGranular(cur, data) {
  const cambios = new Map();
  if (data.platoId && data.nuevoEstado) {
    cambios.set(String(data.platoId), data.nuevoEstado);
  }
  if (Array.isArray(data.platos)) {
    data.platos.forEach((p) => {
      if (p?.platoId && p.nuevoEstado) cambios.set(String(p.platoId), p.nuevoEstado);
    });
  }
  let { platos, changed } = patchPlatosPorId(cur.platos, cambios);
  if (!changed) {
    const fallback = patchPlatosPorEstadoAnterior(cur.platos, itemsEstadoDesdeEvento(data));
    platos = fallback.platos;
    changed = fallback.changed;
  }
  if (!changed) {
    const zip = patchPlatosPorIndice(cur.platos, data.platos);
    platos = zip.platos;
    changed = zip.changed;
  }
  if (!changed) {
    const destino = data.nuevoEstado
      || data.platos?.find((p) => p?.nuevoEstado)?.nuevoEstado;
    const salio = patchPlatosHaciaSalio(cur.platos, destino);
    platos = salio.platos;
    changed = salio.changed;
  }
  return { platos, changed };
}

/**
 * Actualiza status/estado de platos si cambió. No inserta stubs.
 * Nueva comanda completa: usar upsertNuevaComandaLiviano.
 */
export function aplicarEventoComandaLiviano(prev, data) {
  if (!Array.isArray(prev) || !data || typeof data !== 'object') return prev;
  if (String(data._id) === 'refresh') return prev;

  const full = extraerComandaDeEventoSocket(data);
  const comandaId = data.comandaId || full?._id;
  const idx = comandaId ? prev.findIndex((c) => mismoId(c._id, comandaId)) : -1;
  if (idx === -1) return prev;
  const cur = prev[idx];

  const granular = aplicarPatchGranular(cur, data);
  if (granular.changed) {
    const next = prev.slice();
    next[idx] = {
      ...cur,
      platos: granular.platos,
      status: full?.status != null ? full.status : cur.status,
    };
    return next;
  }

  if (full?._id && Array.isArray(full.platos)) {
    const incoming = full.platos.filter((p) => !p?.eliminado && !p?.anulado);
    if (cur.status === full.status && estadosPlatosIguales(cur.platos, incoming)) return prev;
    const next = prev.slice();
    next[idx] = {
      ...cur,
      status: full.status != null ? full.status : cur.status,
      platos: mergePlatosEstados(cur.platos, incoming),
    };
    return next;
  }

  return prev;
}

export function upsertNuevaComandaLiviano(prev, comanda) {
  if (!Array.isArray(prev) || !comanda?._id) return prev;
  const idx = prev.findIndex((c) => mismoId(c._id, comanda._id));
  if (idx === -1) return [comanda, ...prev];
  const cur = prev[idx];
  if (cur.status === comanda.status && estadosPlatosIguales(cur.platos, comanda.platos)) return prev;
  const next = prev.slice();
  next[idx] = comanda;
  return next;
}

export function eventoTocaCobroPendientes(data) {
  if (!data) return false;
  if (data.tipo === 'plato-entregado' || data.tipo === 'plato-anulado' || data.tipo === 'comanda-anulada') {
    return true;
  }
  const st = String(
    extraerComandaDeEventoSocket(data)?.status || data.nuevoEstado || data.status || ''
  ).toLowerCase();
  if (st === 'entregado' || st === 'pagado' || st === 'cancelado') return true;
  if (Array.isArray(data.platos) && data.platos.some((p) => {
    const e = String(p?.nuevoEstado || p?.estado || '').toLowerCase();
    return e === 'entregado' || e === 'pagado';
  })) return true;
  return false;
}

export function eventoTocaAlertaSalio(data) {
  if (!data) return false;
  const estados = [
    data.nuevoEstado,
    extraerComandaDeEventoSocket(data)?.status,
  ];
  if (Array.isArray(data.platos)) {
    data.platos.forEach((p) => estados.push(p?.nuevoEstado || p?.estado));
  }
  const full = extraerComandaDeEventoSocket(data);
  if (Array.isArray(full?.platos)) {
    full.platos.forEach((p) => estados.push(p?.nuevoEstado || p?.estado));
  }
  return estados.some((e) => {
    const st = String(e || '').toLowerCase();
    return st === 'salio' || st === 'recoger';
  });
}
