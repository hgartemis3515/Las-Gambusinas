import { gruposGuarnicion, grupoSeleccionFija, resolverPlatoConGrupos, resumenMarcasGuarnicion } from './platoGuarniciones';
import { grupoEsVariantePlato, grupoAnexaNombre, gruposVarianteDePlato, gruposAnexarNombreDePlato } from './variantePlato';
import { platoRequiereNumeroSerie } from './numeroSeriePlato';

export function tipoServicioLinea(t) {
  if (t === 'para_llevar' || t === 'extra_llevar') return t;
  return 'mesa';
}

/** Id de catálogo: en líneas de comanda `plato` es el plato; `_id` puede ser el subdocumento. */
export function idCatalogoBuscador(lineaOPlato) {
  if (!lineaOPlato) return '';
  const nested = lineaOPlato.plato;
  if (nested && typeof nested === 'object') {
    const id = nested._id || nested.id;
    if (id) return String(id);
  }
  if (nested && typeof nested !== 'object') return String(nested);
  if (lineaOPlato.platoId) return String(lineaOPlato.platoId);
  return String(lineaOPlato._id || lineaOPlato.id || '');
}

export function grupoEsGuarnicionMozo(grupo) {
  return !grupoEsVariantePlato(grupo) && !grupoAnexaNombre(grupo);
}

/** Código que ve el mozo: codigoMozo si hay; si no, el de cocina. */
export function codigoMozoVisible(plato) {
  const m = String(plato?.codigoMozo || '').trim().toUpperCase();
  if (m) return m;
  return String(plato?.codigo || '').trim().toUpperCase();
}

export function categoriasDePlato(p) {
  if (!p) return [];
  const arr = Array.isArray(p.categorias) ? p.categorias.map((c) => String(c || '').trim()).filter(Boolean) : [];
  const seen = new Set();
  const out = [];
  arr.forEach((c) => {
    const k = c.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  });
  const legacy = String(p.categoria || p.cat || '').trim();
  if (legacy && !seen.has(legacy.toLowerCase())) out.unshift(legacy);
  return out.length ? out : [];
}

export function platoEsDeCategoria(p, cat) {
  const target = String(cat || '').trim().toLowerCase();
  if (!target) return true;
  return categoriasDePlato(p).some((c) => c.toLowerCase() === target);
}

/** Guarnición que el mozo elige (no MIX, no variación de nombre, no fijo). */
export function platoMuestraBotonG(plato) {
  return gruposGuarnicion(plato).some((g) => grupoEsGuarnicionMozo(g) && !grupoSeleccionFija(g));
}

export function platoMuestraBotonV(plato) {
  return gruposAnexarNombreDePlato(plato).length > 0;
}

/** Frase de búsqueda: sin tildes y con ñ → n. `chicharron` queda igual que Chicharrón. */
export function textoBusqueda(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Cadena ya plegada del plato. No lee `_busca` para poder recalcularla. */
export function cadenaBusquedaPlato(plato) {
  if (!plato) return '';
  const partes = [
    plato.nombre,
    plato.nombreMostrado,
    ...(Array.isArray(plato.nombresSincronizados) ? plato.nombresSincronizados : []),
    resumenMarcasGuarnicion(plato),
    codigoMozoVisible(plato),
    plato.codigo,
  ];
  return textoBusqueda(partes.filter((x) => x != null && String(x).trim()).join(' '));
}

export function asegurarBusquedaPlato(plato) {
  if (!plato) return plato;
  const next = cadenaBusquedaPlato(plato);
  if (plato._busca !== next) plato._busca = next;
  return plato;
}

function palabrasBusqueda(termino) {
  return textoBusqueda(termino).split(/\s+/).filter(Boolean);
}

/** Coincide nombre, alias, guarnición o código, ignorando tildes y eñe. */
export function platoCoincideBusqueda(plato, termino) {
  const palabras = palabrasBusqueda(termino);
  if (!palabras.length) return true;
  const blob = plato?._busca || cadenaBusquedaPlato(plato);
  return palabras.every((w) => blob.includes(w));
}

/** 80 código exacto … 20 alias. 0 si no entra. */
export function puntajeBusquedaPlato(plato, termino) {
  const palabras = palabrasBusqueda(termino);
  if (!palabras.length || !plato) return 0;
  const q = palabras.join(' ');
  const nombre = textoBusqueda(plato.nombreMostrado || plato.nombre || '');
  const cm = textoBusqueda(codigoMozoVisible(plato));
  const ck = textoBusqueda(plato.codigo || '');
  const blob = plato._busca || cadenaBusquedaPlato(plato);
  if (palabras.length === 1) {
    const w = palabras[0];
    if (cm && cm === w) return 80;
    if (ck && ck === w) return 70;
    if (cm && cm.startsWith(w)) return 60;
    if (ck && ck.startsWith(w)) return 50;
    if (nombre.startsWith(w)) return 40;
    if (nombre.includes(w)) return 30;
    if (blob.includes(w)) return 20;
    return 0;
  }
  if (palabras.every((w) => nombre.includes(w))) return 25;
  if (q && palabras.every((w) => blob.includes(w))) return 15;
  return 0;
}

/** Una fila por nombre sincronizado: mismo plato, distinto rótulo en el buscador. */
export function expandirFilasBuscadorPlatos(platos) {
  const out = [];
  (Array.isArray(platos) ? platos : []).forEach((p) => {
    if (!p) return;
    out.push(p);
    const extras = Array.isArray(p.nombresSincronizados) ? p.nombresSincronizados : [];
    extras.forEach((alias, i) => {
      const n = String(alias || '').trim();
      if (!n) return;
      if (n.toLowerCase() === String(p.nombre || '').trim().toLowerCase()) return;
      out.push({
        ...p,
        nombreMostrado: n,
        _filaBuscadorKey: `${p._id}-alias-${i}`,
        _esAliasNombre: true,
      });
    });
  });
  return out;
}

/** Orden de carta (admin ↑↓): menor `orden` primero. */
export function ordenarPlatosMenu(platos) {
  if (!Array.isArray(platos)) return [];
  return [...platos].sort((a, b) => {
    const oa = Number(a?.orden);
    const ob = Number(b?.orden);
    const fa = Number.isFinite(oa) ? oa : Number.MAX_SAFE_INTEGER;
    const fb = Number.isFinite(ob) ? ob : Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    const ia = Number(a?.id) || 0;
    const ib = Number(b?.id) || 0;
    if (ia !== ib) return ia - ib;
    return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
  });
}

/** Prioriza código exacto y, después, el nombre que empieza por lo escrito (sin tildes). */
export function ordenarPlatosPorCodigoBusqueda(platos, termino, cmpTie) {
  const q = textoBusqueda(termino);
  if (!q || !Array.isArray(platos)) return platos;
  const score = (p) => puntajeBusquedaPlato(p, termino);
  return [...platos].sort((a, b) => {
    const d = score(b) - score(a);
    if (d) return d;
    if (typeof cmpTie === 'function') return cmpTie(a, b);
    const oa = Number(a?.orden);
    const ob = Number(b?.orden);
    const fa = Number.isFinite(oa) ? oa : Number.MAX_SAFE_INTEGER;
    const fb = Number.isFinite(ob) ? ob : Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    return 0;
  });
}

/** MIX o número de serie: el + del buscador sigue abriendo el modal. OP va en modal aparte. */
export function platoRequiereModalAlSumar(plato, catalogo) {
  const p = catalogo ? resolverPlatoConGrupos(plato, catalogo) : plato;
  if (!p) return false;
  if (gruposVarianteDePlato(p).length > 0) return true;
  return platoRequiereNumeroSerie(p);
}

/** Variación OP: modal aparte; la cantidad de sabores sigue a la cantidad elegida. */
export function platoRequiereModalOp(plato, catalogo) {
  const p = catalogo ? resolverPlatoConGrupos(plato, catalogo) : plato;
  if (!p) return false;
  return gruposAnexarNombreDePlato(p).length > 0;
}

export function grupoVisibleEnFoco(grupo, focoModo) {
  if (!focoModo) return true;
  if (!grupo) return false;
  if (focoModo === 'guarniciones') return grupoEsGuarnicionMozo(grupo);
  if (focoModo === 'anexarNombre') return grupoAnexaNombre(grupo);
  return true;
}

export function lineasDelPlatoEnCarrito(lineas, catalogoPlato, tipoServicio, opts = {}) {
  const cat = idCatalogoBuscador(catalogoPlato);
  if (!cat) return [];
  const sameCat = (lineas || []).filter((p) => idCatalogoBuscador(p) === cat);
  if (tipoServicio == null) return sameCat;
  const wanted = tipoServicioLinea(tipoServicio);
  const sameTipo = sameCat.filter((p) => tipoServicioLinea(p.tipoServicio) === wanted);
  if (opts.exacto) return sameTipo;
  return sameTipo.length ? sameTipo : sameCat;
}

export function ultimaLineaDelPlato(lineas, catalogoPlato, tipoServicio, opts = {}) {
  const list = lineasDelPlatoEnCarrito(lineas, catalogoPlato, tipoServicio, opts);
  return list.length ? list[list.length - 1] : null;
}

export function cantidadTotalDelPlato(lineas, catalogoPlato, cantidadesMap, tipoServicio) {
  return lineasDelPlatoEnCarrito(lineas, catalogoPlato, tipoServicio, { exacto: tipoServicio != null }).reduce((sum, p) => {
    const id = p.instanceId || p._id;
    const fromMap = cantidadesMap && id != null ? cantidadesMap[id] : null;
    return sum + Math.max(1, Number(fromMap != null ? fromMap : p.cantidad) || 1);
  }, 0);
}
