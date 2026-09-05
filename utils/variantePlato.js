/**
 * Variante MIX: un grupo de complementos es el nombre del plato en cocina
 * (TÉ / CAFÉ), no una guarnición. 3 TÉ + 2 CAFÉ = 5 MIX, cada uno con las
 * demás guarniciones.
 */

function claveGrupo(v) {
  return String(v || '').trim().toLowerCase();
}

export function grupoEsVariantePlato(grupo) {
  return !!(grupo && grupo.esVariantePlato === true);
}

export function gruposVarianteDePlato(plato) {
  return (plato?.complementos || []).filter(grupoEsVariantePlato);
}

export function nombreCocinaDeOpcion(grupo, opcionNombre) {
  const key = claveGrupo(opcionNombre);
  const op = (grupo?.opciones || []).find((o) => claveGrupo(o?.nombre) === key);
  const corto = String(op?.pronombre || '').trim();
  if (corto) return corto.slice(0, 40);
  return String(opcionNombre || '').trim().slice(0, 40);
}

export function partirLineaPorVariante(plato, complementosSeleccionados, cantidadPlatos) {
  const n = Math.max(1, Number(cantidadPlatos) || 1);
  const gruposVar = gruposVarianteDePlato(plato);
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
    const nombre = nombreCocinaDeOpcion(grupo, v.opcion);
    return {
      complementos: [...garnishes, { ...v, cantidad: 1, pronombre: nombre }],
      cantidad: cant,
      nombreCocinaPedido: nombre,
      variantePlato: {
        grupo: String(v.grupo || grupo?.grupo || '').trim(),
        opcion: String(v.opcion || '').trim(),
        pronombre: nombre,
      },
    };
  };

  if (!vars.length) {
    return [{ complementos: comps, cantidad: n, nombreCocinaPedido: '', variantePlato: null }];
  }
  if (vars.length === 1) return [una(vars[0], n)];
  return vars.map((v) => una(v, Math.max(1, Number(v.cantidad) || 1)));
}

export function mismaVariantePlato(a, b) {
  const va = a?.variantePlato?.opcion || a?.nombreCocinaPedido || '';
  const vb = b?.variantePlato?.opcion || b?.nombreCocinaPedido || '';
  return String(va).trim().toLowerCase() === String(vb).trim().toLowerCase();
}
