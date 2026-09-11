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

export function prioridadCategoriaEnTipo(cat, slugTipo) {
  const slug = String(slugTipo || '').trim();
  const n = Number(mapaOrdenPorTipo(cat)[slug]);
  if (slug && Number.isFinite(n)) return n;
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

function rankPlatoCategoria(plato, categoriasInfo, slugTipo) {
  const cats = categoriasDePlato(plato);
  let best = RANK_SIN_CODIGO + 1;
  let any = false;
  for (const n of cats) {
    const info = infoCategoriaPorNombre(categoriasInfo, n);
    if (!categoriaVisibleEnTipo(info, slugTipo)) continue;
    any = true;
    const r = prioridadCategoriaEnTipo(info, slugTipo);
    if (r < best) best = r;
  }
  return any ? best : RANK_SIN_CODIGO + 1;
}

export function platoVisibleEnCarta(plato, categoriasInfo, slugTipo) {
  if (!slugTipo) return true;
  const cats = categoriasDePlato(plato);
  if (!cats.length) return true;
  return cats.some((n) => categoriaVisibleEnTipo(infoCategoriaPorNombre(categoriasInfo, n), slugTipo));
}

export function cmpPlatosCategoriaYCodigo(a, b, categoriasInfo, slugTipo) {
  const ra = rankPlatoCategoria(a, categoriasInfo, slugTipo);
  const rb = rankPlatoCategoria(b, categoriasInfo, slugTipo);
  if (ra !== rb) return ra - rb;
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
