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
 * En modo oscuro: usa colores SATURADOS y VIVOS (no pastel)
 * En modo claro: usa colores pastel tradicionales
 * @param {string} estado - Estado del plato
 * @param {boolean} isDark - Si está en modo oscuro
 * @param {boolean} esEditable - Si el plato es editable
 * @returns {Object} Colores adaptados
 */
export const obtenerColoresEstadoAdaptados = (estado, isDark = false, esEditable = true) => {
  const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
  
  // ============================================
  // MODO CLARO - Colores pastel con texto oscuro
  // ============================================
  if (!isDark) {
    const coloresClaro = {
      pedido: {
        backgroundColor: '#DBEAFE', // Celeste pastel
        textColor: '#1E40AF', // Azul oscuro
        borderColor: '#93C5FD', // Azul claro
        badgeColor: '#3B82F6', // Azul medio
        badgeTextColor: '#FFFFFF', // Blanco
        textoEstado: 'PEDIDO',
        priceColor: '#10B981', // Verde
      },
      recoger: {
        backgroundColor: '#FEF3C7', // Amarillo pastel
        textColor: '#92400E', // Marrón oscuro
        borderColor: '#FCD34D', // Amarillo claro
        badgeColor: '#F59E0B', // Naranja
        badgeTextColor: '#FFFFFF', // Blanco
        textoEstado: 'RECOGER',
        priceColor: '#10B981', // Verde
      },
      entregado: {
        backgroundColor: '#D1FAE5', // Verde pastel
        textColor: '#065F46', // Verde oscuro
        borderColor: '#6EE7B7', // Verde claro
        badgeColor: '#10B981', // Verde
        badgeTextColor: '#FFFFFF', // Blanco
        textoEstado: 'ENTREGADO',
        priceColor: '#10B981', // Verde
      },
      pagado: {
        backgroundColor: '#F3F4F6', // Gris claro
        textColor: '#374151', // Gris oscuro
        borderColor: '#D1D5DB', // Gris medio
        badgeColor: '#6B7280', // Gris
        badgeTextColor: '#FFFFFF', // Blanco
        textoEstado: 'PAGADO',
        priceColor: '#6B7280', // Gris
      },
    };
    
    const colores = coloresClaro[estadoNormalizado] || coloresClaro.pedido;
    
    // Si no es editable, aplicar opacity global al card
    if (!esEditable) {
      return {
        ...colores,
        opacity: 0.6, // Opacity global para indicar no editable
      };
    }
    
    return colores;
  }
  
  // ============================================
  // MODO OSCURO - Colores SATURADOS con texto blanco
  // ============================================
  const coloresOscuro = {
    pedido: {
      backgroundColor: '#1E40AF', // Azul saturado intenso
      textColor: '#FFFFFF', // Blanco puro para máximo contraste
      borderColor: '#3B82F6', // Azul brillante para borde
      badgeColor: '#60A5FA', // Azul brillante
      badgeTextColor: '#1E3A8A', // Azul muy oscuro para contraste
      textoEstado: 'PEDIDO',
      priceColor: '#6EE7B7', // Verde claro brillante
    },
    recoger: {
      backgroundColor: '#D97706', // Naranja saturado vibrante
      textColor: '#FFFFFF', // Blanco puro
      borderColor: '#F59E0B', // Naranja brillante
      badgeColor: '#FBBF24', // Amarillo brillante
      badgeTextColor: '#78350F', // Marrón oscuro para contraste
      textoEstado: 'RECOGER',
      priceColor: '#6EE7B7', // Verde claro brillante
    },
    entregado: {
      backgroundColor: '#047857', // Verde esmeralda saturado
      textColor: '#FFFFFF', // Blanco puro
      borderColor: '#10B981', // Verde brillante
      badgeColor: '#34D399', // Verde brillante
      badgeTextColor: '#064E3B', // Verde muy oscuro para contraste
      textoEstado: 'ENTREGADO',
      priceColor: '#6EE7B7', // Verde claro brillante
    },
    pagado: {
      backgroundColor: '#4B5563', // Gris medio saturado
      textColor: '#F9FAFB', // Casi blanco
      borderColor: '#6B7280', // Gris medio
      badgeColor: '#9CA3AF', // Gris claro
      badgeTextColor: '#1F2937', // Gris muy oscuro
      textoEstado: 'PAGADO',
      priceColor: '#9CA3AF', // Gris claro
    },
  };
  
  const colores = coloresOscuro[estadoNormalizado] || coloresOscuro.pedido;
  
  // Si no es editable, aplicar opacity global al card
  if (!esEditable) {
    return {
      ...colores,
      opacity: 0.5, // Opacity global para indicar no editable
    };
  }
  
  return colores;
};

