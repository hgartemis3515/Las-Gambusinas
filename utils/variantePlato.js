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

  if (!vars.length) {
    return [{ complementos: comps, cantidad: n, nombreCocinaPedido: '', variantePlato: null }];
  }
  if (vars.length === 1) {
    const grupo = resolver(vars[0]);
    const q = Math.max(1, Number(vars[0].cantidad) || 1);
    const cant = grupoAnexaNombre(grupo) ? n : Math.max(n, q);
    return [una(vars[0], cant)];
  }
  return vars.map((v) => una(v, Math.max(1, Number(v.cantidad) || 1)));
}

export function mismaVariantePlato(a, b) {
  const va = a?.variantePlato?.opcion || a?.nombreCocinaPedido || '';
  const vb = b?.variantePlato?.opcion || b?.nombreCocinaPedido || '';
  return String(va).trim().toLowerCase() === String(vb).trim().toLowerCase();
}
