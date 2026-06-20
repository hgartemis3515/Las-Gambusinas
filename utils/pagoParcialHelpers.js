/**
 * Helpers para pagos parciales en PagosScreen.
 */

/** Clave estable para un plato cobrable. */
export function platoSelectionKey(comandaId, platoIndex, platoSubdocId) {
  const cid = comandaId?.toString?.() || String(comandaId);
  if (platoSubdocId) return `${cid}:${platoSubdocId}`;
  return `${cid}:${platoIndex}`;
}

/** Platos elegibles: entregados, no eliminados/anulados/pagados. */
export function listarPlatosPagables(comandas) {
  const items = [];
  (comandas || []).forEach((comanda) => {
    const comandaId = comanda._id?.toString?.() || comanda._id;
    (comanda.platos || []).forEach((platoItem, index) => {
      if (platoItem.eliminado || platoItem.anulado) return;
      const estado = (platoItem.estado || '').toLowerCase();
      if (estado !== 'entregado') return;
      const plato = platoItem.plato || platoItem;
      const cantidad = comanda.cantidades?.[index] || platoItem.cantidad || 1;
      const precio = plato?.precio || platoItem.precio || 0;
      items.push({
        key: platoSelectionKey(comandaId, index, platoItem._id),
        comandaId,
        comandaNumber: comanda.comandaNumber,
        platoIndex: index,
        platoSubdocId: platoItem._id?.toString?.() || null,
        platoItem,
        nombre: plato?.nombre || platoItem.nombre || 'Plato',
        cantidad,
        precio,
        subtotal: precio * cantidad,
        complementosSeleccionados: platoItem.complementosSeleccionados || [],
        notaEspecial: platoItem.notaEspecial || '',
        yaPagado: false,
      });
    });
  });
  return items;
}

/** Lista para UI de Pagos: entregados (seleccionables) + pagados (solo lectura con check).
 *  Si esPagoAdelantado=true, también incluye platos en pedido/en_espera (elegibles para PPA). */
export function listarPlatosEnPantallaPago(comandas, esPagoAdelantado = false) {
  const items = [];
  (comandas || []).forEach((comanda) => {
    const comandaId = comanda._id?.toString?.() || comanda._id;
    (comanda.platos || []).forEach((platoItem, index) => {
      if (platoItem.eliminado || platoItem.anulado) return;
      const estado = (platoItem.estado || '').toLowerCase();
      // Platos pagados siempre se muestran
      if (estado === 'pagado') {
        // OK, se muestra como ya pagado
      } else if (estado === 'entregado') {
        // OK, se muestra como entregado seleccionable
      } else if (estado === 'pendiente' || estado === 'pendiente_aprobar') {
        // OK, platos pendientes de aprobación (esperando cocina) siempre se muestran
      } else if (estado === 'pedido') {
        // OK, platos en pedido (cocina aprobó, entraron al KDS) se muestran para reimprimir comanda
      } else if (esPagoAdelantado && (estado === 'en_espera')) {
        // OK, en modo PPA se muestran platos en espera
      } else if (esPagoAdelantado && platoItem.pagoAdelantado?.estadoTicket === 'pendiente_aprobacion') {
        // OK, platos con TPA pendiente aún se muestran en PPA
      } else {
        return; // No mostrar este estado
      }
      const plato = platoItem.plato || platoItem;
      const cantidad = comanda.cantidades?.[index] || platoItem.cantidad || 1;
      const precio = plato?.precio || platoItem.precio || 0;
      items.push({
        key: platoSelectionKey(comandaId, index, platoItem._id),
        comandaId,
        comandaNumber: comanda.comandaNumber,
        platoIndex: index,
        platoSubdocId: platoItem._id?.toString?.() || null,
        platoItem,
        nombre: plato?.nombre || platoItem.nombre || 'Plato',
        cantidad,
        precio,
        subtotal: precio * cantidad,
        complementosSeleccionados: platoItem.complementosSeleccionados || [],
        notaEspecial: platoItem.notaEspecial || '',
        tipoServicio: platoItem.tipoServicio || 'mesa',
        yaPagado: estado === 'pagado',
      });
    });
  });
  return items;
}

/** Construye payload platosSeleccionados para POST /boucher. */
export function buildPlatosSeleccionadosPayload(selectedKeys, pagables) {
  const set = new Set(selectedKeys);
  return pagables
    .filter((p) => set.has(p.key))
    .map((p) => ({
      comandaId: p.comandaId,
      platoIndex: p.platoIndex,
      platoSubdocId: p.platoSubdocId,
      cantidad: p.cantidad,
    }));
}

/** Extrae boucher y resumen de la respuesta del backend (compat legacy). */
export function parseBoucherResponse(data) {
  if (!data) return { boucher: null, resumen: null };
  if (data.boucher?._id) {
    return { boucher: data.boucher, resumen: data.resumen || null };
  }
  if (data._id) {
    return { boucher: data, resumen: data.resumen || null };
  }
  return { boucher: null, resumen: null };
}

/**
 * Calcula subtotal de platos seleccionados (precio * cantidad, sin IGV).
 */
export function calcularSubtotalSeleccion(selectedKeys, pagables) {
  const set = new Set(selectedKeys);
  return pagables.filter((p) => set.has(p.key)).reduce((s, p) => s + p.subtotal, 0);
}

/**
 * Preview de totales alineado con calculosPrecios del backend.
 */
export function calcularTotalesPreview(subtotalPlatos, configMoneda) {
  const igvPct = configMoneda?.igvPorcentaje ?? 18;
  const incluyeIGV = configMoneda?.preciosIncluyenIGV ?? false;
  const decs = configMoneda?.decimales ?? 2;

  if (incluyeIGV) {
    const total = subtotalPlatos;
    const subtotalSinIGV = total / (1 + igvPct / 100);
    const igv = total - subtotalSinIGV;
    return {
      subtotal: Number(subtotalSinIGV.toFixed(decs)),
      igv: Number(igv.toFixed(decs)),
      total: Number(total.toFixed(decs)),
    };
  }
  const igv = subtotalPlatos * (igvPct / 100);
  const total = subtotalPlatos + igv;
  return {
    subtotal: Number(subtotalPlatos.toFixed(decs)),
    igv: Number(igv.toFixed(decs)),
    total: Number(total.toFixed(decs)),
  };
}

/** Toggle seleccionar todos los pagables. */
export function toggleSeleccionarTodos(selectedKeys, pagables) {
  const allKeys = pagables.map((p) => p.key);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  if (allSelected) return [];
  return allKeys;
}
