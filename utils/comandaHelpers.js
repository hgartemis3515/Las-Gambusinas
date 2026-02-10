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

/**
 * Obtiene colores por estado del plato
 * @param {string} estado - Estado del plato ('pedido', 'recoger', 'entregado', 'pagado')
 * @param {boolean} isDark - Si está en modo oscuro
 * @returns {Object} Objeto con colores adaptados
 */
export const obtenerColoresPorEstado = (estado, isDark = false) => {
  const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
  
  const coloresBase = {
    pedido: {
      backgroundColor: '#DBEAFE',
      textColor: '#1E40AF',
      borderColor: '#3B82F6',
      badgeColor: '#3B82F6',
      badgeTextColor: '#FFFFFF',
      textoEstado: 'PEDIDO'
    },
    recoger: {
      backgroundColor: '#FEF3C7',
      textColor: '#92400E',
      borderColor: '#F59E0B',
      badgeColor: '#F59E0B',
      badgeTextColor: '#FFFFFF',
      textoEstado: 'RECOGER'
    },
    entregado: {
      backgroundColor: '#D1FAE5',
      textColor: '#065F46',
      borderColor: '#10B981',
      badgeColor: '#10B981',
      badgeTextColor: '#FFFFFF',
      textoEstado: 'ENTREGADO'
    },
    pagado: {
      backgroundColor: '#F3F4F6',
      textColor: '#374151',
      borderColor: '#6B7280',
      badgeColor: '#6B7280',
      badgeTextColor: '#FFFFFF',
      textoEstado: 'PAGADO'
    }
  };
  
  const colores = coloresBase[estadoNormalizado] || coloresBase.pedido;
  
  // Ajustar para modo oscuro
  if (isDark) {
    // Convertir hex a rgba con opacidad
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    return {
      ...colores,
      backgroundColor: hexToRgba(colores.backgroundColor, 0.3), // 30% opacidad en modo oscuro
      textColor: '#FFFFFF', // Texto blanco para mejor contraste
      borderColor: hexToRgba(colores.borderColor, 0.6), // Borde con 60% opacidad
    };
  }
  
  // Convertir hex a rgba con opacidad para modo claro
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  return {
    ...colores,
    backgroundColor: hexToRgba(colores.backgroundColor, 0.8), // 80% opacidad en modo claro
  };
};

/**
 * Obtiene colores de estado adaptados según el tema
 * @param {string} estado - Estado del plato
 * @param {boolean} isDark - Si está en modo oscuro
 * @param {boolean} esEditable - Si el plato es editable
 * @returns {Object} Colores adaptados
 */
export const obtenerColoresEstadoAdaptados = (estado, isDark = false, esEditable = true) => {
  const colores = obtenerColoresPorEstado(estado, isDark);
  
  // Si no es editable, reducir más la opacidad
  if (!esEditable) {
    // Extraer valores RGB del rgba
    const rgbaMatch = colores.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      const r = rgbaMatch[1];
      const g = rgbaMatch[2];
      const b = rgbaMatch[3];
      const newAlpha = isDark ? 0.2 : 0.4; // Menos opacidad para no editables
      return {
        ...colores,
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${newAlpha})`,
      };
    }
  }
  
  return colores;
};

