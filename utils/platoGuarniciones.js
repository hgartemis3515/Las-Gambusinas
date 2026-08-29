import { getNombreOpcion } from './precioComplementos';

/**
 * Combos / guarniciones: un plato con grupos de complementos no puede
 * incrementarse a ciegas; cada unidad debe pasar por ModalComplementos.
 */

export function gruposGuarnicion(plato) {
  const grupos = plato?.complementos;
  return Array.isArray(grupos) ? grupos : [];
}

export function guarnicionesElegidas(plato) {
  const elegidos = plato?.complementosElegidos || plato?.complementosSeleccionados;
  return Array.isArray(elegidos) ? elegidos : [];
}

/** True si el plato es combo (definición de grupos, guarniciones ya elegidas, o catálogo). */
export function platoRequiereGuarniciones(plato, catalogo) {
  if (!plato) return false;
  if (gruposGuarnicion(plato).length > 0 || guarnicionesElegidas(plato).length > 0) return true;
  if (catalogo) return gruposGuarnicion(resolverPlatoConGrupos(plato, catalogo)).length > 0;
  return false;
}

export function idCatalogoPlato(plato) {
  if (!plato) return '';
  const raw = plato._id || plato.plato || plato.platoId;
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '');
  return raw ? String(raw) : '';
}

/** Guarniciones se guardan por unidad de plato: 1 zarza × 3 platos = 3 zarzas. */
export function cantidadGuarnicionEfectiva(comp, plato) {
  const porUnidad = Math.max(1, Number(comp?.cantidad) || 1);
  const nPlatos = Math.max(1, Number(plato?.cantidad) || 1);
  return porUnidad * nPlatos;
}

function claveGuarnicion(comp) {
  const grupo = String(comp?.grupo || '').trim().toLowerCase();
  const raw = Array.isArray(comp?.opcion) ? comp.opcion.join(',') : (comp?.opcion || comp?.nombre || '');
  const opcion = String(raw).trim().toLowerCase();
  const cant = Math.max(1, Number(comp?.cantidad) || 1);
  return `${grupo}|${opcion}|${cant}`;
}

/** True si dos snapshots son la misma receta (grupo + opción + cantidad por unidad). */
export function mismasGuarniciones(a, b) {
  const ca = (Array.isArray(a) ? a : []).filter((c) => c && !c.eliminado);
  const cb = (Array.isArray(b) ? b : []).filter((c) => c && !c.eliminado);
  if (ca.length !== cb.length) return false;
  const sa = ca.map(claveGuarnicion).sort();
  const sb = cb.map(claveGuarnicion).sort();
  return sa.every((k, i) => k === sb[i]);
}

/** Textos de total: 1 zarza × 3 platos → "Zarza criolla ×3". */
export function textosGuarnicionesTotales(comps, nPlatos) {
  const n = Math.max(1, Number(nPlatos) || 1);
  return (Array.isArray(comps) ? comps : [])
    .filter((c) => c && (c.opcion || c.nombre))
    .map((c) => {
      const opcion = Array.isArray(c.opcion) ? c.opcion.join(', ') : String(c.opcion || c.nombre || '').trim();
      const total = cantidadGuarnicionEfectiva(c, { cantidad: n });
      return total > 1 ? `${opcion} ×${total}` : opcion;
    })
    .filter(Boolean);
}

/**
 * Recupera los grupos del catálogo si la línea del carrito no los trae.
 * Sin grupos el modal de guarniciones no puede abrirse.
 */
export function resolverPlatoConGrupos(plato, catalogo = []) {
  if (!plato) return plato;
  if (gruposGuarnicion(plato).length > 0) return plato;

  const id = idCatalogoPlato(plato);
  if (!id) return plato;

  const found = (catalogo || []).find((p) => {
    const pid = idCatalogoPlato(p);
    return pid && pid === id;
  });
  if (found && gruposGuarnicion(found).length > 0) {
    return { ...found, ...plato, _id: found._id, complementos: found.complementos };
  }
  return plato;
}

/**
 * Guarniciones marcadas en platos.html para Órdenes.
 * El mozo las ve ya seleccionadas (con cantidad si el grupo es por cantidades).
 */
export function preseleccionComplementosDePlato(plato) {
  const out = [];
  for (const grupo of gruposGuarnicion(plato)) {
    const grupoNombre = String(grupo?.grupo || '').trim();
    if (!grupoNombre) continue;
    const modoCant = grupo.modoSeleccion === 'cantidades';
    const maxGrupoRaw = Number(grupo.maxUnidadesGrupo);
    const maxGrupo = Number.isFinite(maxGrupoRaw) && maxGrupoRaw > 0 ? maxGrupoRaw : null;
    const maxOpRaw = Number(grupo.maxUnidadesPorOpcion);
    const maxOp = Number.isFinite(maxOpRaw) && maxOpRaw > 0 ? maxOpRaw : null;
    const soloUna = !grupo.seleccionMultiple && !modoCant;
    let unidadesGrupo = 0;
    for (const op of (grupo.opciones || [])) {
      const nombre = getNombreOpcion(op);
      if (!nombre) continue;
      if (!op || typeof op !== 'object' || op.preseleccionada !== true) continue;
      let cant = modoCant ? Number(op.cantidadPreseleccion) : 1;
      if (!Number.isFinite(cant) || cant < 1) cant = 1;
      cant = Math.floor(cant);
      if (maxOp != null && cant > maxOp) cant = maxOp;
      if (maxGrupo != null && unidadesGrupo + cant > maxGrupo) cant = maxGrupo - unidadesGrupo;
      if (cant < 1) break;
      const precio = Number(op.precio);
      out.push({
        grupo: grupoNombre,
        opcion: nombre,
        cantidad: cant,
        precio: Number.isFinite(precio) && precio > 0 ? precio : 0,
      });
      unidadesGrupo += cant;
      if (soloUna) break;
      if (maxGrupo != null && unidadesGrupo >= maxGrupo) break;
    }
  }
  return out;
}
