'use strict';

function idCarta(p) {
  if (!p) return '';
  if (p._id != null) return String(p._id);
  if (p.id != null) return String(p.id);
  return '';
}

function platoActivoCarta(p) {
  if (!p || p.isActive === false) return false;
  if (typeof p.stock === 'number' && p.stock < 0) return false;
  return true;
}

function cmpOrdenCarta(a, b) {
  const oa = Number(a && a.orden);
  const ob = Number(b && b.orden);
  const fa = Number.isFinite(oa) ? oa : 0;
  const fb = Number.isFinite(ob) ? ob : 0;
  if (fa !== fb) return fa - fb;
  return (Number(a && a.id) || 0) - (Number(b && b.id) || 0);
}

function applyMenuEvent(platos, event) {
  const list = Array.isArray(platos) ? platos.slice() : [];
  const op = String((event && event.op) || 'upsert').toLowerCase();
  if (op === 'invalidate') {
    return { platos: list, invalidate: true };
  }
  if (op === 'orden') {
    const items = Array.isArray(event && event.items) ? event.items : [];
    const map = new Map(items.map((i) => [idCarta(i), Number(i.orden)]));
    const next = list.map((p) => {
      const id = idCarta(p);
      if (!map.has(id)) return p;
      const orden = map.get(id);
      if (!Number.isFinite(orden) || p.orden === orden) return p;
      return Object.assign({}, p, { orden: orden });
    });
    next.sort(cmpOrdenCarta);
    return { platos: next, invalidate: false };
  }
  if (op === 'delete') {
    const id = idCarta(event && event.plato);
    if (!id) return { platos: list, invalidate: false };
    return { platos: list.filter((p) => idCarta(p) !== id), invalidate: false };
  }
  const carta = event && event.plato;
  const id = idCarta(carta);
  if (!id) return { platos: list, invalidate: false };
  if (!platoActivoCarta(carta)) {
    return { platos: list.filter((p) => idCarta(p) !== id), invalidate: false };
  }
  const idx = list.findIndex((p) => idCarta(p) === id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = Object.assign({}, list[idx], carta, { _id: list[idx]._id || carta._id });
    return { platos: next, invalidate: false };
  }
  const next = list.concat([carta]);
  next.sort(cmpOrdenCarta);
  return { platos: next, invalidate: false };
}

function applyMenuEventBatch(platos, events) {
  let acc = Array.isArray(platos) ? platos : [];
  const batch = Array.isArray(events) ? events : [];
  for (let i = 0; i < batch.length; i++) {
    const r = applyMenuEvent(acc, batch[i]);
    if (r.invalidate) return { platos: acc, invalidate: true };
    acc = r.platos;
  }
  return { platos: acc, invalidate: false };
}

module.exports = {
  idCarta,
  platoActivoCarta,
  applyMenuEvent,
  applyMenuEventBatch,
};
