import { categoriasDePlato, codigoMozoVisible } from './platoBuscador';

const RANK_SIN_CODIGO = 10000;
const RANK_NO_NUMERICO = 1000;

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
  if (ca !== cb) return ca.localeCompare(cb, 'es', { numeric: true });
  return String((a && a.nombre) || '').localeCompare(String((b && b.nombre) || ''), 'es');
}

export function infoCategoriaPorNombre(categoriasInfo, nombre) {
  const key = String(nombre || '').trim().toLowerCase();
  if (!key) return { nombre: nombre || '', codigoMozo: '', ordenPorTipo: {}, ocultoEnTipos: [] };
  const hit = (categoriasInfo || []).find((c) => String((c && c.nombre) || '').trim().toLowerCase() === key);
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
  const cmp = codigoMozoVisible(a).localeCompare(codigoMozoVisible(b), 'es', {
    numeric: true,
    sensitivity: 'base',
  });
  if (cmp) return cmp;
  return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
}

export function ordenarPlatosPorCategoriaYCodigo(platos, categoriasInfo, slugTipo) {
  if (!Array.isArray(platos)) return [];
  return [...platos].sort((a, b) => cmpPlatosCategoriaYCodigo(a, b, categoriasInfo, slugTipo));
}
