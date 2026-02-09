/**
 * Funciones de utilidad para gestión de comandas
 * Extraídas de InicioScreen para reutilización
 */

/**
 * Filtra platos según estados permitidos
 * @param {Array} comandas - Array de comandas
 * @param {Array} estadosPermitidos - Estados permitidos (ej: ['pedido', 'recoger'])
 * @returns {Array} Array de platos filtrados con información de comanda
 */
export const filtrarPlatosPorEstado = (comandas, estadosPermitidos) => {
  const platos = [];
  
  comandas.forEach(comanda => {
    if (!comanda.platos || !Array.isArray(comanda.platos)) return;
    
    comanda.platos.forEach((platoItem, index) => {
      const estado = platoItem.estado || 'pedido';
      const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
      
      if (estadosPermitidos.includes(estadoNormalizado) && !platoItem.eliminado) {
        const cantidad = comanda.cantidades?.[index] || 1;
        platos.push({
          platoId: platoItem.platoId || platoItem.plato?._id || platoItem.plato,
          plato: platoItem.plato || { nombre: 'Plato desconocido', precio: 0 },
          cantidad: cantidad,
          estado: estadoNormalizado,
          precio: platoItem.plato?.precio || 0,
          comandaId: comanda._id,
          comandaNumber: comanda.comandaNumber,
          index: index,
          eliminado: false
        });
      }
    });
  });
  
  return platos;
};

/**
 * Separa platos en editables y no editables según su estado
 * @param {Array} comandas - Array de comandas
 * @returns {Object} { editables: [], noEditables: [] }
 */
export const separarPlatosEditables = (comandas) => {
  const editables = [];
  const noEditables = [];
  
  comandas.forEach(comanda => {
    if (!comanda.platos || !Array.isArray(comanda.platos)) return;
    
    comanda.platos.forEach((platoItem, index) => {
      const cantidad = comanda.cantidades?.[index] || 1;
      const estado = platoItem.estado || 'pedido';
      const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
      
      if (platoItem.eliminado) return;
      
      const platoObj = {
        plato: platoItem.plato?._id || platoItem.plato,
        platoId: platoItem.platoId || platoItem.plato?._id,
        estado: estadoNormalizado,
        cantidad: cantidad,
        nombre: platoItem.plato?.nombre || 'Plato desconocido',
        precio: platoItem.plato?.precio || 0,
        index: index,
        comandaId: comanda._id
      };
      
      if (estadoNormalizado === 'pedido' || estadoNormalizado === 'recoger') {
        editables.push(platoObj);
      } else {
        noEditables.push(platoObj);
      }
    });
  });
  
  return { editables, noEditables };
};

/**
 * Valida que no se eliminen todos los platos de una comanda
 * @param {Array} platosActuales - Platos actuales de la comanda
 * @param {Array} platosAEliminar - Platos que se quieren eliminar
 * @returns {Object} { valido: boolean, mensaje: string }
 */
export const validarEliminacionCompleta = (platosActuales, platosAEliminar) => {
  const platosRestantes = platosActuales.length - platosAEliminar.length;
  
  if (platosRestantes <= 0) {
    return {
      valido: false,
      mensaje: 'No puedes eliminar todos los platos. Debe quedar al menos uno. Si deseas cancelar la comanda completa, usa "Eliminar Comanda".'
    };
  }
  
  return { valido: true, mensaje: '' };
};

/**
 * Calcula totales de una lista de platos
 * @param {Array} platos - Array de platos con precio y cantidad
 * @returns {Object} { subtotal, igv, total }
 */
export const calcularTotales = (platos) => {
  const subtotal = platos.reduce((sum, p) => {
    return sum + ((p.precio || 0) * (p.cantidad || 1));
  }, 0);
  
  const igv = subtotal * 0.18;
  const total = subtotal + igv;
  
  return {
    subtotal: subtotal.toFixed(2),
    igv: igv.toFixed(2),
    total: total.toFixed(2)
  };
};

/**
 * Detecta si hay platos en estado "recoger" en la selección
 * @param {Array} platosSeleccionados - Platos seleccionados
 * @returns {boolean}
 */
export const detectarPlatosPreparados = (platosSeleccionados) => {
  return platosSeleccionados.some(p => p.estado === 'recoger');
};

/**
 * Obtiene el estado de una mesa basado en sus comandas
 * @param {Object} mesa - Objeto mesa
 * @param {Array} comandas - Array de comandas de la mesa
 * @returns {string} Estado de la mesa
 */
export const obtenerEstadoMesa = (mesa, comandas) => {
  if (!comandas || comandas.length === 0) {
    return mesa?.estado || 'libre';
  }
  
  // Verificar estados de platos individuales
  const todosLosPlatos = [];
  comandas.forEach(c => {
    if (c.platos && Array.isArray(c.platos)) {
      c.platos.forEach((p, idx) => {
        if (!p.eliminado) {
          todosLosPlatos.push({
            estado: p.estado || 'pedido',
            cantidad: c.cantidades?.[idx] || 1
          });
        }
      });
    }
  });
  
  if (todosLosPlatos.length === 0) {
    return 'libre';
  }
  
  // Determinar estado según prioridad: recoger > pedido > entregado > pagado
  const hayRecoger = todosLosPlatos.some(p => p.estado === 'recoger');
  const hayPedido = todosLosPlatos.some(p => p.estado === 'pedido' || p.estado === 'en_espera');
  const todosEntregados = todosLosPlatos.every(p => p.estado === 'entregado');
  const todosPagados = todosLosPlatos.every(p => p.estado === 'pagado');
  
  if (todosPagados) return 'pagado';
  if (todosEntregados) return 'entregado';
  if (hayRecoger) return 'preparado';
  if (hayPedido) return 'pedido';
  
  return mesa?.estado || 'libre';
};

