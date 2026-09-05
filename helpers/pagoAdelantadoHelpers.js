/**
 * Helpers para clasificar comandas por tipo de servicio y habilitación
 * de botones Pagar / Pago Adelantado en ComandaDetalleScreen.
 *
 * Compartido entre App Mozos y Backend (misma lógica).
 */

/**
 * Clasifica una comanda según los tipos de servicio de sus platos activos.
 * @param {Array} platosActivos - Platos no eliminados/anulados de la comanda
 * @returns {'solo_mesa'|'solo_para_llevar'|'mixta'}
 */
export function clasificarComandaPorTipoServicio(platosActivos) {
  if (!platosActivos || platosActivos.length === 0) return 'solo_mesa';
  const tieneMesa = platosActivos.some(p => (p.tipoServicio || 'mesa') === 'mesa');
  const tieneLlevar = platosActivos.some(p => p.tipoServicio === 'para_llevar');
  if (tieneMesa && tieneLlevar) return 'mixta';
  if (tieneLlevar) return 'solo_para_llevar';
  return 'solo_mesa';
}

/**
 * Determina si un plato es elegible para Pago Adelantado (PPA).
 * Reglas:
 * - ✅ tipoServicio 'para_llevar' en estado 'pedido' sin TPA aprobado
 * - ✅ tipoServicio 'mesa' en estado 'pedido' o 'en_espera' (cobro anticipado opcional)
 * - ❌ Ya incluido en TPA pendiente_aprobacion o aprobado
 * - ❌ Estados recoger, entregado, pagado
 * - ❌ Eliminado o anulado
 */
export function esPlatoElegibleParaPPA(plato) {
  if (!plato) return false;
  if (plato.eliminado || plato.anulado) return false;
  const estado = (plato.estado || '').toLowerCase();
  if (['recoger', 'entregado', 'pagado'].includes(estado)) return false;
  // Ya en TPA pendiente o aprobado
  if (plato.pagoAdelantado) {
    if (plato.pagoAdelantado.cobrado === true) return false;
    const et = plato.pagoAdelantado.estadoTicket;
    if (et === 'pendiente_aprobacion' || et === 'aprobado') return false;
  }
  return true;
}

/**
 * Filtra los platos elegibles para PPA de una lista.
 */
export function obtenerPlatosElegiblesPPA(platos) {
  if (!platos || platos.length === 0) return [];
  return platos.filter(esPlatoElegibleParaPPA);
}

/**
 * Calcula las reglas de habilitación de botones en ComandaDetalleScreen.
 * @param {Array} todosLosPlatos - Todos los platos de la comanda (incluyendo eliminados)
 * @returns {Object} Reglas de habilitación
 */
/** Plato ya cobrado por PPA (ticket pendiente o aprobado). */
export function platoCobradoViaPPA(plato) {
  if (!plato?.pagoAdelantado) return false;
  if (plato.pagoAdelantado.cobrado === true) return true;
  const et = plato.pagoAdelantado.estadoTicket;
  return et === 'pendiente_aprobacion' || et === 'aprobado';
}

export function platoCerradoParaLiberar(plato) {
  const e = (plato?.estado || '').toLowerCase();
  return e === 'salio' || e === 'entregado' || e === 'pagado';
}

/**
 * Tras entregar, se puede cerrar el ciclo PPA y liberar la mesa:
 * - comanda 100% para llevar con todos entregados/pagados, o
 * - todos los platos activos cobrados vía PPA y ya entregados/pagados.
 */
export function puedeLiberarMesaTrasPPA(todosLosPlatos) {
  const activos = (todosLosPlatos || []).filter(p => !p.eliminado && !p.anulado);
  if (activos.length === 0) return false;
  if (!activos.every(platoCerradoParaLiberar)) return false;
  const composicion = clasificarComandaPorTipoServicio(activos);
  if (composicion === 'solo_para_llevar') return true;
  if (activos.every(platoCobradoViaPPA)) return true;
  // Visita 100% cobrada por PPA aunque algún subdoc haya perdido el flag
  return activos.some(platoCobradoViaPPA) && activos.every(platoCerradoParaLiberar);
}

function precioLineaPlato(plato) {
  return Number(plato?.precioUnitario ?? plato?.precio ?? plato?.plato?.precio) || 0;
}

function netoPlatosActivos(platos) {
  return (platos || [])
    .filter((p) => !p?.eliminado && !p?.anulado)
    .reduce((s, p) => s + precioLineaPlato(p) * (Number(p.cantidad) || 1), 0);
}

/** Plato 0 + extras 0 → no hay cobro. Un adicional con precio (> 0) sí cobra. */
export function esCostoCeroPlatos(todosLosPlatos) {
  const activos = (todosLosPlatos || []).filter((p) => !p?.eliminado && !p?.anulado);
  if (activos.length === 0) return false;
  return netoPlatosActivos(activos) <= 0.009;
}

/** Liberar sin caja: todo entregado/pagado y total 0. */
export function puedeLiberarComandaCostoCero(todosLosPlatos) {
  if (!esCostoCeroPlatos(todosLosPlatos)) return false;
  const activos = (todosLosPlatos || []).filter((p) => !p?.eliminado && !p?.anulado);
  return activos.every((p) => {
    const e = String(p.estado || '').toLowerCase();
    return e === 'entregado' || e === 'pagado';
  });
}

export function getReglasBotonesComandaDetalle(todosLosPlatos) {
  if (!todosLosPlatos || todosLosPlatos.length === 0) {
    return {
      composicion: 'solo_mesa',
      mostrarPagar: false,
      mostrarPagoAdelantado: false,
      pagarDisabled: true,
      pagoAdelantadoDisabled: true,
      esCostoCero: false,
    };
  }

  const platosActivos = todosLosPlatos.filter(p => !p.eliminado && !p.anulado);
  const composicion = clasificarComandaPorTipoServicio(platosActivos);
  const platosElegibles = obtenerPlatosElegiblesPPA(platosActivos);

  // Pagar: solo si composición NO es solo_para_llevar Y todos están entregados/pagados
  const todosEntregadosOPagados = todosLosPlatos.length > 0
    && todosLosPlatos.every(p => {
      const e = (p.estado || '').toLowerCase();
      return e === 'entregado' || e === 'pagado';
    });

  const costoCero = esCostoCeroPlatos(todosLosPlatos);
  const mostrarPagar = composicion !== 'solo_para_llevar' && !costoCero;
  const pagarDisabled = !todosEntregadosOPagados || costoCero;

  // Pago Adelantado: si hay al menos un plato elegible
  const mostrarPagoAdelantado = platosElegibles.length > 0 && !costoCero;
  const pagoAdelantadoDisabled = platosElegibles.length === 0 || costoCero;

  return {
    composicion,
    mostrarPagar,
    mostrarPagoAdelantado,
    pagarDisabled,
    pagoAdelantadoDisabled,
    platosElegibles,
    esCostoCero: costoCero,
  };
}

/**
 * Construye el payload de platos seleccionados para el endpoint de PPA.
 * @param {Array} platosSeleccionados - Platos elegibles seleccionados por el mozo
 * @param {Array} comandas - Comandas de la mesa
 * @returns {Array} Payload para POST /pago-adelantado
 */
export function buildPlatosPayloadPPA(platosSeleccionados, comandas) {
  return platosSeleccionados.map(plato => {
    const comanda = comandas.find(c =>
      c.platos?.some(p => p._id?.toString() === plato._id?.toString())
    );
    return {
      comandaId: comanda?._id?.toString() || '',
      platoLineaId: plato._id?.toString() || '',
      platoId: plato.platoId || (plato.plato?.id) || null,
      cantidad: plato.cantidad || 1,
    };
  });
}