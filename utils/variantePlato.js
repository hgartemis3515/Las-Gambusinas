/**
 * Variante MIX: un grupo de complementos es el nombre del plato en cocina
 * (TÉ / CAFÉ), no una guarnición. 3 TÉ + 2 CAFÉ = 5 MIX, cada uno con las
 * demás guarniciones.
 *
 * Variación de nombre (`anexarVarianteAlNombre`): la opción se anexa
 * (Pollo leña + Pierna → Pollo leña Pierna).
 */

const MAX_NOMBRE_COCINA_PEDIDO = 80;

function claveGrupo(v) {
  return String(v || '').trim().toLowerCase();
}

export function grupoEsVariantePlato(grupo) {
  return !!(grupo && grupo.esVariantePlato === true);
}

export function grupoAnexaNombre(grupo) {
  return !!(grupo && grupo.anexarVarianteAlNombre === true && !grupoEsVariantePlato(grupo));
}

function grupoDefineNombreCocina(grupo) {
  return grupoEsVariantePlato(grupo) || grupoAnexaNombre(grupo);
}

export function grupoVarianteSumaDeshabilitada(grupo) {
  return grupoEsVariantePlato(grupo) && grupo?.deshabilitarSumaVariante === true;
}

export function platoVarianteSumaDeshabilitada(plato) {
  return gruposVarianteDePlato(plato).some(grupoVarianteSumaDeshabilitada);
}

export function gruposVarianteDePlato(plato) {
  return (plato?.complementos || []).filter(grupoEsVariantePlato);
}

export function gruposAnexarNombreDePlato(plato) {
  return (plato?.complementos || []).filter(grupoAnexaNombre);
}

/** OP con cantidades: sabores de pachamanca (van de a N por unidad, no se reparte como MIX). */
export function grupoOpCantidades(grupo) {
  return grupoAnexaNombre(grupo) && grupo?.modoSeleccion === 'cantidades';
}

export function platoOpCantidades(plato) {
  return gruposAnexarNombreDePlato(plato).some(grupoOpCantidades);
}

export function grupoOpCantidadesDePlato(plato) {
  return gruposAnexarNombreDePlato(plato).find(grupoOpCantidades) || null;
}

function enteroEnRango(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < min || i > max) return null;
  return i;
}

/** Sabores por pachamanca: campo del grupo, o “3 sabores” en el nombre, o mín. del grupo. */
export function saboresPorUnidadDePlato(plato) {
  const g = grupoOpCantidadesDePlato(plato);
  const fromField = enteroEnRango(g?.saboresPorUnidad, 1, 8);
  if (fromField && fromField >= 2) return fromField;
  const textos = [
    plato?.nombreCocina,
    plato?.nombre,
    plato?.nombreCocinaPedido,
    plato?.plato?.nombreCocina,
    plato?.plato?.nombre,
    g?.grupo,
  ];
  for (const t of textos) {
    const m = String(t || '').match(/(\d+)\s*sabou?res?\b/i);
    if (m) {
      const n = enteroEnRango(m[1], 1, 8);
      if (n) return n;
    }
  }
  const fromMin = enteroEnRango(g?.minUnidadesGrupo, 2, 8);
  if (fromMin) return fromMin;
  return fromField || 1;
}

export function expandirSlotsOp(vars) {
  const slots = [];
  (Array.isArray(vars) ? vars : []).forEach((v) => {
    const q = Math.max(0, Math.min(99, Number(v?.cantidad) || 0));
    for (let i = 0; i < q; i += 1) slots.push({ ...v, cantidad: 1 });
  });
  return slots;
}

export function chunkSlotsOp(slots, nSab) {
  const n = Math.max(1, Number(nSab) || 1);
  const out = [];
  for (let i = 0; i < slots.length; i += n) out.push(slots.slice(i, i + n));
  return out;
}

export function textoComboSabores(slots, grupo) {
  return (slots || [])
    .map((v) => nombreCocinaDeOpcion(grupo, v?.opcion))
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' - ');
}

export function previewCombosOp(orden, nSab, nPachamancas) {
  const sab = Math.max(1, Number(nSab) || 1);
  const n = Math.max(1, Number(nPachamancas) || 1);
  const list = Array.isArray(orden) ? orden : [];
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const slice = list.slice(i * sab, i * sab + sab);
    const faltan = Math.max(0, sab - slice.length);
    rows.push({
      index: i + 1,
      sabores: slice,
      completo: faltan === 0,
      faltan,
    });
  }
  return rows;
}

function gruposNombreCocinaDePlato(plato) {
  return (plato?.complementos || []).filter(grupoDefineNombreCocina);
}

export function esSeleccionVariantePlato(comp, plato) {
  const g = claveGrupo(comp?.grupo);
  if (!g) return false;
  if (plato?.variantePlato?.grupo && claveGrupo(plato.variantePlato.grupo) === g) return true;
  return gruposNombreCocinaDePlato(plato).some((x) => claveGrupo(x.grupo) === g);
}

export function nombreCocinaDeOpcion(grupo, opcionNombre) {
  const key = claveGrupo(opcionNombre);
  const op = (grupo?.opciones || []).find((o) => claveGrupo(o?.nombre) === key);
  const corto = String(op?.pronombre || '').trim();
  if (corto) return corto.slice(0, 40);
  return String(opcionNombre || '').trim().slice(0, 40);
}

function anexarSufijoNombre(base, extra) {
  const b = String(base || '').trim();
  const e = String(extra || '').trim();
  if (!e) return b.slice(0, MAX_NOMBRE_COCINA_PEDIDO);
  if (!b) return e.slice(0, MAX_NOMBRE_COCINA_PEDIDO);
  const bLow = b.toLowerCase();
  const eLow = e.toLowerCase();
  if (bLow === eLow || bLow.endsWith(` ${eLow}`)) return b.slice(0, MAX_NOMBRE_COCINA_PEDIDO);
  return `${b} ${e}`.trim().slice(0, MAX_NOMBRE_COCINA_PEDIDO);
}

function nombrePedidoDeVariante(grupo, opcionNombre, plato) {
  const extra = nombreCocinaDeOpcion(grupo, opcionNombre);
  if (grupoAnexaNombre(grupo)) {
    const base = String(plato?.nombreCocina || plato?.nombre || '').trim();
    return anexarSufijoNombre(base, extra);
  }
  return extra.slice(0, MAX_NOMBRE_COCINA_PEDIDO);
}

/** Nombre en el carrito del mozo: MIX muestra "MIX · TÉ"; variación de nombre ya viene completa. */
export function nombreVisibleConVariante(nombreBase, plato) {
  const base = String(nombreBase || '').trim();
  const pedido = String(plato?.nombreCocinaPedido || '').trim();
  if (!pedido) return base;
  if (plato?.variantePlato?.anexaNombre === true) return pedido;
  return base ? `${base} · ${pedido}` : pedido;
}

export function partirLineaPorVariante(plato, complementosSeleccionados, cantidadPlatos) {
  const n = Math.max(1, Number(cantidadPlatos) || 1);
  const gruposVar = gruposNombreCocinaDePlato(plato);
  const comps = Array.isArray(complementosSeleccionados) ? complementosSeleccionados : [];
  if (!gruposVar.length) {
    return [{ complementos: comps, cantidad: n, nombreCocinaPedido: '', variantePlato: null }];
  }
  const keys = new Set(gruposVar.map((g) => claveGrupo(g.grupo)));
  const vars = comps.filter((c) => keys.has(claveGrupo(c.grupo)) && (Number(c.cantidad) || 1) > 0);
  const garnishes = comps.filter((c) => !keys.has(claveGrupo(c.grupo)));
  const resolver = (v) => gruposVar.find((g) => claveGrupo(g.grupo) === claveGrupo(v.grupo)) || gruposVar[0];

  const una = (v, cant) => {
    const grupo = resolver(v);
    const extra = nombreCocinaDeOpcion(grupo, v.opcion);
    const nombre = nombrePedidoDeVariante(grupo, v.opcion, plato);
    return {
      complementos: [...garnishes, { ...v, cantidad: 1, pronombre: extra }],
      cantidad: cant,
      nombreCocinaPedido: nombre,
      variantePlato: {
        grupo: String(v.grupo || grupo?.grupo || '').trim(),
        opcion: String(v.opcion || '').trim(),
        pronombre: extra,
        anexaNombre: grupoAnexaNombre(grupo),
      },
    };
  };

  const vacio = () => [{ complementos: comps, cantidad: n, nombreCocinaPedido: '', variantePlato: null }];

  const grupoOp = gruposVar.find(grupoOpCantidades);
  if (grupoOp) {
    const opVars = vars.filter((v) => claveGrupo(v.grupo) === claveGrupo(grupoOp.grupo));
    const slots = expandirSlotsOp(opVars);
    const nSab = saboresPorUnidadDePlato(plato);
    const unaCombo = (chunk, cant) => {
      const extra = textoComboSabores(chunk, grupoOp);
      const base = String(plato?.nombreCocina || plato?.nombre || '').trim();
      const nombre = anexarSufijoNombre(base, extra);
      const compsOp = chunk.map((v) => ({
        ...v,
        cantidad: 1,
        pronombre: nombreCocinaDeOpcion(grupoOp, v.opcion),
      }));
      return {
        complementos: [...garnishes, ...compsOp],
        cantidad: Math.max(1, Number(cant) || 1),
        nombreCocinaPedido: nombre,
        variantePlato: {
          grupo: String(grupoOp.grupo || '').trim(),
          opcion: extra,
          pronombre: extra,
          anexaNombre: true,
        },
      };
    };
    const mergeCombos = (partes) => {
      const merged = [];
      partes.forEach((p) => {
        const last = merged[merged.length - 1];
        const same = last
          && String(last.variantePlato?.opcion || '').toLowerCase()
            === String(p.variantePlato?.opcion || '').toLowerCase();
        if (same) last.cantidad += p.cantidad;
        else merged.push({ ...p });
      });
      return merged;
    };
    if (!slots.length) return vacio();
    if (nSab <= 1) {
      if (opVars.length === 1 && (Number(opVars[0].cantidad) || 1) === 1 && n > 1) {
        return [unaCombo(slots, n)];
      }
      return mergeCombos(opVars.map((v) => unaCombo([{ ...v, cantidad: 1 }], Math.max(1, Number(v.cantidad) || 1))));
    }
    if (slots.length % nSab !== 0) {
      return [unaCombo(slots, 1)];
    }
    const chunks = chunkSlotsOp(slots, nSab);
    if (chunks.length === 1) return [unaCombo(chunks[0], n)];
    return mergeCombos(chunks.map((ch) => unaCombo(ch, 1)));
  }

  if (!vars.length) return vacio();
  if (vars.length === 1) {
    const grupo = resolver(vars[0]);
    const q = Math.max(1, Number(vars[0].cantidad) || 1);
    return [una(vars[0], Math.max(n, q))];
  }
  return vars.map((v) => una(v, Math.max(1, Number(v.cantidad) || 1)));
}

export function mismaVariantePlato(a, b) {
  const va = a?.variantePlato?.opcion || a?.nombreCocinaPedido || '';
  const vb = b?.variantePlato?.opcion || b?.nombreCocinaPedido || '';
  return String(va).trim().toLowerCase() === String(vb).trim().toLowerCase();
}
