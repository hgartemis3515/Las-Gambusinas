import {
  preseleccionComplementosDePlato,
  mismasGuarniciones,
  expandirLineaComplementos,
  guarnicionesElegidas,
} from './platoGuarniciones';
import {
  grupoEsVariantePlato,
  grupoAnexaNombre,
  gruposVarianteDePlato,
  grupoOpCantidadesDePlato,
  saboresPorUnidadDePlato,
  expandirSlotsOp,
  chunkSlotsOp,
} from './variantePlato';

export function claveGrupoNombre(v) {
  return String(v || '').trim().toLowerCase();
}

export function cloneUnidadEstado(u) {
  return {
    selecciones: JSON.parse(JSON.stringify(u?.selecciones || {})),
    variaciones: JSON.parse(JSON.stringify(u?.variaciones || {})),
    ordenSabores: [...(u?.ordenSabores || [])],
  };
}

export function hashUnidadEstado(u) {
  return JSON.stringify({
    s: u?.selecciones || {},
    v: u?.variaciones || {},
    o: u?.ordenSabores || [],
  });
}

export function estadoDesdeComplementos(comps, grupoOpNombre) {
  const selecciones = {};
  const variaciones = {};
  const ordenSabores = [];
  const claveOp = claveGrupoNombre(grupoOpNombre);
  (Array.isArray(comps) ? comps : []).forEach((comp) => {
    const grupoKey = String(comp.grupo || '').trim();
    const opcion = String(comp.opcion || '').trim();
    if (!grupoKey || !opcion) return;
    const q = Math.max(0, Number(comp.cantidad) || 0);
    if (q <= 0) return;
    if (!selecciones[grupoKey]) selecciones[grupoKey] = {};
    selecciones[grupoKey][opcion] = (selecciones[grupoKey][opcion] || 0) + q;
    const variacion = String(comp.variacion || '').trim();
    if (variacion) {
      if (!variaciones[grupoKey]) variaciones[grupoKey] = {};
      variaciones[grupoKey][opcion] = variacion;
    }
    if (claveOp && claveGrupoNombre(grupoKey) === claveOp) {
      for (let i = 0; i < q; i += 1) ordenSabores.push(opcion);
    }
  });
  return { selecciones, variaciones, ordenSabores };
}

function grupoEsNombreCocina(grupo) {
  return grupoEsVariantePlato(grupo) || grupoAnexaNombre(grupo);
}

function extrasYGuarniciones(plato, fuente) {
  const skip = new Set(
    (plato?.complementos || [])
      .filter(grupoEsNombreCocina)
      .map((g) => claveGrupoNombre(g.grupo))
  );
  const garnishes = [];
  const extras = [];
  (Array.isArray(fuente) ? fuente : []).forEach((c) => {
    if (!c) return;
    if (skip.has(claveGrupoNombre(c.grupo))) extras.push({ ...c });
    else garnishes.push({ ...c });
  });
  return { garnishes, extras };
}

function guarnicionesPorUnidad(garnishes, n) {
  if (n <= 1) return garnishes.map((c) => ({ ...c }));
  const divisible = garnishes.length > 0 && garnishes.every((c) => {
    const q = Math.max(0, Number(c.cantidad) || 0);
    return q === 0 || q % n === 0;
  });
  if (!divisible) return garnishes.map((c) => ({ ...c }));
  return garnishes
    .map((c) => ({
      ...c,
      cantidad: Math.max(0, Math.round((Number(c.cantidad) || 0) / n)),
    }))
    .filter((c) => (Number(c.cantidad) || 0) > 0);
}

function mixPorUnidad(mixComps, n) {
  const slots = expandirSlotsOp(mixComps);
  if (n <= 1) {
    return [slots.map((s) => ({ ...s, cantidad: 1 }))];
  }
  if (!slots.length) return Array.from({ length: n }, () => []);
  if (slots.length === 1) {
    return Array.from({ length: n }, () => [{ ...slots[0], cantidad: 1 }]);
  }
  return Array.from({ length: n }, (_, i) => (
    slots[i] ? [{ ...slots[i], cantidad: 1 }] : []
  ));
}

function opPorUnidad(opComps, n, nSab) {
  const sab = Math.max(1, Number(nSab) || 1);
  const slots = expandirSlotsOp(opComps);
  if (!slots.length) return Array.from({ length: n }, () => []);
  if (slots.length === sab) {
    return Array.from({ length: n }, () => slots.map((s) => ({ ...s, cantidad: 1 })));
  }
  const chunks = chunkSlotsOp(slots, sab);
  return Array.from({ length: n }, (_, i) => (
    (chunks[i] || chunks[0] || []).map((s) => ({ ...s, cantidad: 1 }))
  ));
}

/**
 * N recetas (una por plato). Guarniciones se copian por unidad;
 * OP/MIX se reparte a N1…Nn para poder editar solo N5.
 */
export function complementosPorUnidadDesdeLinea(plato, iniciales, nPlatos) {
  const n = Math.max(1, Math.min(99, Number(nPlatos) || 1));
  const defs = preseleccionComplementosDePlato(plato);
  const fuente = Array.isArray(iniciales) ? iniciales : defs;
  const { garnishes, extras } = extrasYGuarniciones(plato, fuente);
  const garnUnit = guarnicionesPorUnidad(garnishes, n);
  const grupoOp = grupoOpCantidadesDePlato(plato);
  const gruposMix = gruposVarianteDePlato(plato);

  if (grupoOp) {
    const claveOp = claveGrupoNombre(grupoOp.grupo);
    const opComps = extras.filter((c) => claveGrupoNombre(c.grupo) === claveOp);
    const otros = extras.filter((c) => claveGrupoNombre(c.grupo) !== claveOp);
    const chunks = opPorUnidad(opComps, n, saboresPorUnidadDePlato(plato));
    return Array.from({ length: n }, (_, i) => [
      ...garnUnit.map((c) => ({ ...c })),
      ...otros.map((c) => ({ ...c })),
      ...(chunks[i] || []),
    ]);
  }

  if (gruposMix.length) {
    const mixKeys = new Set(gruposMix.map((g) => claveGrupoNombre(g.grupo)));
    const mixComps = extras.filter((c) => mixKeys.has(claveGrupoNombre(c.grupo)));
    const otros = extras.filter((c) => !mixKeys.has(claveGrupoNombre(c.grupo)));
    const mixUnits = mixPorUnidad(mixComps, n);
    return Array.from({ length: n }, (_, i) => [
      ...garnUnit.map((c) => ({ ...c })),
      ...otros.map((c) => ({ ...c })),
      ...(mixUnits[i] || []),
    ]);
  }

  return Array.from({ length: n }, () => [
    ...garnUnit.map((c) => ({ ...c })),
    ...extras.map((c) => ({ ...c })),
  ]);
}

export function hidratarUnidadesEstado(plato, iniciales, nPlatos) {
  const grupoOp = grupoOpCantidadesDePlato(plato);
  return complementosPorUnidadDesdeLinea(plato, iniciales, nPlatos)
    .map((comps) => estadoDesdeComplementos(comps, grupoOp?.grupo));
}

export function cantidadDeLinea(linea, cantidadesMap) {
  if (!linea) return 1;
  const id = linea.instanceId || linea._id;
  const fromMap = cantidadesMap && id != null ? cantidadesMap[id] : null;
  const n = Number(fromMap != null ? fromMap : linea.cantidad);
  return Math.max(1, Math.min(99, Number.isFinite(n) ? n : 1));
}

/** Una receta N por cada unidad ya pedida (varias líneas del mismo plato). */
export function hidratarUnidadesDesdeLineas(plato, lineas, cantidadesMap) {
  const list = (Array.isArray(lineas) ? lineas : []).filter(Boolean);
  if (!list.length) return hidratarUnidadesEstado(plato, null, 1);
  const out = [];
  list.forEach((linea) => {
    const n = cantidadDeLinea(linea, cantidadesMap);
    out.push(...hidratarUnidadesEstado(plato, guarnicionesElegidas(linea), n));
  });
  return out.length ? out : hidratarUnidadesEstado(plato, null, 1);
}

export function fusionarUnidadesComplementos(plato, unidadesComps) {
  const named = (Array.isArray(unidadesComps) ? unidadesComps : []).map((comps) => {
    const parts = expandirLineaComplementos(plato, comps, 1);
    return parts[0] || {
      complementos: comps || [],
      cantidad: 1,
      nombreCocinaPedido: '',
      variantePlato: null,
    };
  });
  const merged = [];
  named.forEach((p) => {
    const last = merged[merged.length - 1];
    const sameName = String(last?.nombreCocinaPedido || '') === String(p.nombreCocinaPedido || '');
    if (last && sameName && mismasGuarniciones(last.complementos, p.complementos)) {
      last.cantidad += 1;
      return;
    }
    merged.push({
      complementos: (p.complementos || []).map((c) => ({ ...c })),
      cantidad: 1,
      nombreCocinaPedido: p.nombreCocinaPedido || '',
      variantePlato: p.variantePlato || null,
    });
  });
  return merged.length
    ? merged
    : [{ complementos: [], cantidad: 1, nombreCocinaPedido: '', variantePlato: null }];
}
