import { categoriasDePlato, codigoMozoVisible } from './platoBuscador';

const RANK_SIN_CODIGO = 10000;
const RANK_NO_NUMERICO = 1000;

// localeCompare(opciones) crea un Collator en cada llamada. En un sort de toda
// la carta eso son miles de instancias y en una Tab A11 se va a segundos.
let collatorEs = null;
function cmpTexto(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa === sb) return 0;
  try {
    if (!collatorEs) collatorEs = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    return collatorEs.compare(sa, sb);
  } catch (_) {
    return sa < sb ? -1 : 1;
  }
}

const mapasCategoria = new WeakMap();

function mapaCategorias(categoriasInfo) {
  if (!Array.isArray(categoriasInfo)) return null;
  const prev = mapasCategoria.get(categoriasInfo);
  if (prev) return prev;
  const map = new Map();
  for (let i = 0; i < categoriasInfo.length; i++) {
    const c = categoriasInfo[i];
    const key = String((c && c.nombre) || '').trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, c);
  }
  mapasCategoria.set(categoriasInfo, map);
  return map;
}

export function codigoCategoriaRank(codigoMozo) {
  const s = String(codigoMozo || '').trim().toUpperCase();
  if (!s) return RANK_SIN_CODIGO;
  if (/^\d+$/.test(s)) return Number(s);
  return RANK_NO_NUMERICO + s.charCodeAt(0);
}

function mapaOrdenPorTipo(cat) {
  const map = (cat && cat.ordenPorTipo) || {};
  return map && typeof map === 'object' ? map : {};
}

function valorOrdenPorTipo(cat, slugTipo) {
  const slug = String(slugTipo || '').trim();
  if (!slug) return NaN;
  const map = mapaOrdenPorTipo(cat);
  const directo = Number(map[slug]);
  if (Number.isFinite(directo)) return directo;
  const slugL = slug.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (String(k || '').trim().toLowerCase() === slugL) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

export function prioridadCategoriaEnTipo(cat, slugTipo) {
  const n = valorOrdenPorTipo(cat, slugTipo);
  if (Number.isFinite(n)) return n;
  return codigoCategoriaRank(cat && cat.codigoMozo);
}

export function categoriaVisibleEnTipo(cat, slugTipo) {
  const slug = String(slugTipo || '').trim().toLowerCase();
  if (!slug) return true;
  const list = (cat && cat.ocultoEnTipos) || [];
  return !list.some((s) => String(s || '').trim().toLowerCase() === slug);
}

export function cmpCategoriasMozo(a, b, slugTipo) {
  const pa = prioridadCategoriaEnTipo(a, slugTipo);
  const pb = prioridadCategoriaEnTipo(b, slugTipo);
  if (pa !== pb) return pa - pb;
  const ca = String((a && a.codigoMozo) || '').toUpperCase();
  const cb = String((b && b.codigoMozo) || '').toUpperCase();
  if (ca !== cb) return cmpTexto(ca, cb);
  return cmpTexto(a && a.nombre, b && b.nombre);
}

export function infoCategoriaPorNombre(categoriasInfo, nombre) {
  const key = String(nombre || '').trim().toLowerCase();
  if (!key) return { nombre: nombre || '', codigoMozo: '', ordenPorTipo: {}, ocultoEnTipos: [] };
  const map = mapaCategorias(categoriasInfo);
  const hit = map ? map.get(key) : null;
  return hit || { nombre, codigoMozo: '', ordenPorTipo: {}, ocultoEnTipos: [] };
}

export function ordenarCategoriasMozo(nombres, categoriasInfo, slugTipo) {
  return [...(nombres || [])]
    .filter((n) => categoriaVisibleEnTipo(infoCategoriaPorNombre(categoriasInfo, n), slugTipo))
    .sort((a, b) => cmpCategoriasMozo(
      infoCategoriaPorNombre(categoriasInfo, a),
      infoCategoriaPorNombre(categoriasInfo, b),
      slugTipo
    ));
}

function mejorCategoriaPlato(plato, categoriasInfo, slugTipo) {
  const cats = categoriasDePlato(plato);
  let best = null;
  for (const n of cats) {
    const info = infoCategoriaPorNombre(categoriasInfo, n);
    if (!categoriaVisibleEnTipo(info, slugTipo)) continue;
    if (!best || cmpCategoriasMozo(info, best, slugTipo) < 0) best = info;
  }
  return best;
}

export function platoVisibleEnCarta(plato, categoriasInfo, slugTipo) {
  if (!slugTipo) return true;
  const cats = categoriasDePlato(plato);
  if (!cats.length) return true;
  return cats.some((n) => categoriaVisibleEnTipo(infoCategoriaPorNombre(categoriasInfo, n), slugTipo));
}

function cmpOrdenCampoPlato(a, b) {
  const oa = Number(a?.orden);
  const ob = Number(b?.orden);
  const fa = Number.isFinite(oa) ? oa : Number.MAX_SAFE_INTEGER;
  const fb = Number.isFinite(ob) ? ob : Number.MAX_SAFE_INTEGER;
  if (fa !== fb) return fa - fb;
  return 0;
}

export function cmpPlatosCategoriaYCodigo(a, b, categoriasInfo, slugTipo) {
  const ca = mejorCategoriaPlato(a, categoriasInfo, slugTipo);
  const cb = mejorCategoriaPlato(b, categoriasInfo, slugTipo);
  if (ca && cb) {
    const byCat = cmpCategoriasMozo(ca, cb, slugTipo);
    if (byCat) return byCat;
  } else if (ca && !cb) return -1;
  else if (!ca && cb) return 1;
  const byOrden = cmpOrdenCampoPlato(a, b);
  if (byOrden) return byOrden;
  const cmp = cmpTexto(codigoMozoVisible(a), codigoMozoVisible(b));
  if (cmp) return cmp;
  return cmpTexto(a?.nombre, b?.nombre);
}

function claveOrdenPlato(plato, categoriasInfo, slugTipo) {
  const cat = mejorCategoriaPlato(plato, categoriasInfo, slugTipo);
  const orden = Number(plato?.orden);
  return {
    pri: cat ? prioridadCategoriaEnTipo(cat, slugTipo) : Number.MAX_SAFE_INTEGER,
    code: cat ? String(cat.codigoMozo || '').toUpperCase() : '',
    catNombre: cat ? String(cat.nombre || '') : '',
    tiene: cat ? 1 : 0,
    orden: Number.isFinite(orden) ? orden : Number.MAX_SAFE_INTEGER,
    codigo: codigoMozoVisible(plato),
    nombre: String(plato?.nombre || ''),
  };
}

function cmpClavesPlato(a, b) {
  if (a.tiene !== b.tiene) return b.tiene - a.tiene;
  if (a.pri !== b.pri) return a.pri - b.pri;
  if (a.code !== b.code) {
    const c = cmpTexto(a.code, b.code);
    if (c) return c;
  }
  if (a.catNombre !== b.catNombre) {
    const c = cmpTexto(a.catNombre, b.catNombre);
    if (c) return c;
  }
  if (a.orden !== b.orden) return a.orden - b.orden;
  if (a.codigo !== b.codigo) {
    const c = cmpTexto(a.codigo, b.codigo);
    if (c) return c;
  }
  return cmpTexto(a.nombre, b.nombre);
}

export function ordenarPlatosPorCategoriaYCodigo(platos, categoriasInfo, slugTipo) {
  if (!Array.isArray(platos)) return [];
  if (platos.length < 2) return platos.slice();
  const rows = new Array(platos.length);
  for (let i = 0; i < platos.length; i++) {
    rows[i] = { p: platos[i], k: claveOrdenPlato(platos[i], categoriasInfo, slugTipo) };
  }
  rows.sort((a, b) => cmpClavesPlato(a.k, b.k));
  const out = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) out[i] = rows[i].p;
  return out;
}
