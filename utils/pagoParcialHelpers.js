/**
 * Helpers para pagos parciales en PagosScreen.
 */

/** Precio unitario de una línea de plato (soporta ref poblada o sin poblar). */
export function resolverPrecioLineaPlato(platoItem) {
  const platoRef = platoItem?.plato;
  if (platoRef && typeof platoRef === 'object' && platoRef.precio != null) {
    return Number(platoRef.precio) || 0;
  }
  if (platoItem?.precio != null) return Number(platoItem.precio) || 0;
  return 0;
}

/** Cantidad de una línea de plato. */
export function resolverCantidadLineaPlato(platoItem, comanda, index) {
  return comanda?.cantidades?.[index] || platoItem?.cantidad || 1;
}

/** Subtotal de una línea (precio × cantidad). */
export function resolverSubtotalLineaPlato(platoItem, comanda, index) {
  return resolverPrecioLineaPlato(platoItem) * resolverCantidadLineaPlato(platoItem, comanda, index);
}

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
      const plato = platoItem.plato && typeof platoItem.plato === 'object' ? platoItem.plato : platoItem;
      const cantidad = resolverCantidadLineaPlato(platoItem, comanda, index);
      const precio = resolverPrecioLineaPlato(platoItem);
      const subtotal = resolverSubtotalLineaPlato(platoItem, comanda, index);
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
        subtotal,
        complementosSeleccionados: platoItem.complementosSeleccionados || [],
        notaEspecial: platoItem.notaEspecial || '',
        yaPagado: false,
      });
    });
  });
  return items;
}

/** Lista para UI de Pagos: entregados (seleccionables) + pagados (solo lectura con check).
 *  Si esPagoAdelantado=true, también incluye platos en pedido/en_espera (elegibles para PPA).
 *
 *  ADAPTACIÓN PPA EN PARTES: los platos con pagoAdelantado (estadoTicket pendiente_aprobacion
 *  o aprobado) se muestran SIEMPRE (no solo en modo PPA) marcados con check de "ya pagado vía
 *  PPA", para que el mozo vea qué platos de la comanda ya fueron cobrados en partes por PPA
 *  aunque su estado de cocina siga en 'pedido'/'en_espera'. */
export function listarPlatosEnPantallaPago(comandas, esPagoAdelantado = false) {
  const items = [];
  (comandas || []).forEach((comanda) => {
    const comandaId = comanda._id?.toString?.() || comanda._id;
    (comanda.platos || []).forEach((platoItem, index) => {
      if (platoItem.eliminado || platoItem.anulado) return;
      const estado = (platoItem.estado || '').toLowerCase();
      const estadoTicketPPA = platoItem.pagoAdelantado?.estadoTicket;
      const tienePPA = estadoTicketPPA === 'pendiente_aprobacion' || estadoTicketPPA === 'aprobado';

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
      } else if (tienePPA) {
        // ADAPTACIÓN PPA EN PARTES: mostrar siempre (incluso en modo Pagar normal)
        // los platos ya cobrados vía PPA, para que aparezcan con check y el mozo sepa
        // que ya fueron pagados en partes. No son seleccionables.
      } else {
        return; // No mostrar este estado
      }
      const plato = platoItem.plato && typeof platoItem.plato === 'object' ? platoItem.plato : platoItem;
      const cantidad = resolverCantidadLineaPlato(platoItem, comanda, index);
      const precio = resolverPrecioLineaPlato(platoItem);
      const subtotal = resolverSubtotalLineaPlato(platoItem, comanda, index);
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
        subtotal,
        complementosSeleccionados: platoItem.complementosSeleccionados || [],
        notaEspecial: platoItem.notaEspecial || '',
        tipoServicio: platoItem.tipoServicio || 'mesa',
        // BUG_PAGOS_PARCIALES_APROBACION_COCINA (Fase 5) + ADAPTACIÓN PPA EN PARTES:
        // Un plato está "cobrado" si:
        //   - ya fue aprobado por cocina ('pagado')
        //   - está esperando aprobación de un pago normal ('pendiente')
        //   - fue cobrado vía PPA (pagoAdelantado.estadoTicket pendiente_aprobacion o aprobado)
        // En cualquiera de estos casos no debe ser re-seleccionable en PagosScreen.
        yaPagado:
          estado === 'pagado' ||
          estado === 'pendiente' ||
          tienePPA,
        // Estado para UI: distinguir "enviado a cocina" de "aprobado" / "vía PPA"
        estadoCobro:
          estado === 'pagado' ? 'aprobado'
          : estado === 'pendiente' ? 'enviado_cocina'
          : tienePPA ? (estadoTicketPPA === 'aprobado' ? 'ppa_aprobado' : 'ppa_pendiente')
          : null,
      });
    });
  });
  return items;
}

/** Suma subtotales de platos cobrables en pantalla (sin IGV). */
export function calcularSubtotalPlatosPagables(comandas, esPagoAdelantado = false) {
  return listarPlatosEnPantallaPago(comandas, esPagoAdelantado)
    .filter((p) => !p.yaPagado)
    .reduce((s, p) => s + (p.subtotal || 0), 0);
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
 * Usa platosEnPantalla (o cualquier lista con key/subtotal/yaPagado).
 * Excluye platos ya cobrados aunque sigan en selectedKeys por estado stale.
 */
export function calcularSubtotalSeleccion(selectedKeys, items) {
  if (!selectedKeys?.length || !items?.length) return 0;
  const set = new Set(selectedKeys);
  return items
    .filter((p) => set.has(p.key) && !p.yaPagado)
    .reduce((s, p) => s + (p.subtotal || 0), 0);
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
