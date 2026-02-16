import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, RefreshControl, ActivityIndicator, Modal, TextInput,
  Dimensions, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import axios from '../config/axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-timezone';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Componentes
import BadgeEstadoPlato from '../Components/BadgeEstadoPlato';
import FilaPlatoCompacta from '../Components/FilaPlatoCompacta';
import HeaderComandaDetalle from '../Components/HeaderComandaDetalle';

// Contextos y configuración
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { themeLight } from '../constants/theme';
import { COMANDASEARCH_API_GET, COMANDA_API, DISHES_API, apiConfig } from '../apiConfig';
import { separarPlatosEditables, filtrarPlatosPorEstado, detectarPlatosPreparados, validarEliminacionCompleta, obtenerColoresEstadoAdaptados, filtrarComandasActivas } from '../utils/comandaHelpers';
import { verificarYActualizarEstadoComanda, verificarComandasEnLote, invalidarCacheComandasVerificadas } from '../utils/verificarEstadoComanda';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Función para obtener estilos por estado
const obtenerEstilosPorEstado = (estado) => {
  const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
  
  const estilos = {
    pedido: {
      fondo: '#DBEAFE',
      borde: '#3B82F6',
      badgeFondo: '#3B82F6',
      badgeTexto: '#FFFFFF',
      textoEstado: 'PEDIDO'
    },
    recoger: {
      fondo: '#FEF3C7',
      borde: '#F59E0B',
      badgeFondo: '#F59E0B',
      badgeTexto: '#FFFFFF',
      textoEstado: 'RECOGER'
    },
    entregado: {
      fondo: '#D1FAE5',
      borde: '#10B981',
      badgeFondo: '#10B981',
      badgeTexto: '#FFFFFF',
      textoEstado: 'ENTREGADO'
    },
    pagado: {
      fondo: '#F3F4F6',
      borde: '#6B7280',
      badgeFondo: '#6B7280',
      badgeTexto: '#FFFFFF',
      textoEstado: 'PAGADO'
    }
  };
  
  return estilos[estadoNormalizado] || estilos.pedido;
};

const ComandaDetalleScreen = ({ route, navigation }) => {
  // Recibir parámetros de navegación (clienteId / filterByCliente para filtrar por cliente)
  const { mesa, comandas: comandasIniciales, onRefresh, clienteId, filterByCliente } = route.params || {};
  
  // Hooks
  const { theme, isDarkMode } = useTheme();
  const isDark = isDarkMode; // Alias para compatibilidad
  const themeColors = theme || themeLight;
  const { socket, connected, connectionStatus, reconnectAttempts, joinMesa, leaveMesa } = useSocket();
  
  // FASE 4.1: Estado para indicador online-active cuando recibe actualizaciones
  const [localConnectionStatus, setLocalConnectionStatus] = React.useState(connectionStatus || 'desconectado');
  
  // Estados
  const [comandas, setComandasState] = useState(comandasIniciales || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  
  // Estados para todos los platos (ordenados)
  const [todosLosPlatos, setTodosLosPlatos] = useState([]);
  
  // Estados para modales
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);
  const [platosParaEliminar, setPlatosParaEliminar] = useState([]);
  const [platosSeleccionadosEliminar, setPlatosSeleccionadosEliminar] = useState([]);
  const [motivoEliminacion, setMotivoEliminacion] = useState('');
  
  const [modalEliminarComandaVisible, setModalEliminarComandaVisible] = useState(false);
  const [motivoEliminacionComanda, setMotivoEliminacionComanda] = useState('');
  const [platosEliminablesComanda, setPlatosEliminablesComanda] = useState([]);
  const [hayPlatosEnRecogerComanda, setHayPlatosEnRecogerComanda] = useState(false);
  
  // Estados para modal de edición
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [comandaEditando, setComandaEditando] = useState(null);
  const [platos, setPlatos] = useState([]);
  const [platosEditables, setPlatosEditables] = useState([]);
  const [platosNoEditables, setPlatosNoEditables] = useState([]);
  const [searchPlato, setSearchPlato] = useState('');
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  
  // Cargar usuario
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          setUserInfo(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Error cargando usuario:', error);
      }
    };
    loadUser();
  }, []);
  
  // Preparar todos los platos ordenados por prioridad (sin logs en bucle para evitar loops)
  const prepararPlatosOrdenados = useCallback(() => {
    const platos = [];

    comandas.forEach((comanda, comandaIndex) => {
      if (!comanda.platos || !Array.isArray(comanda.platos)) return;

      comanda.platos.forEach((platoItem, index) => {
        // Validar que el plato tiene la estructura correcta
        if (!platoItem.plato || typeof platoItem.plato !== 'object') return;

        const cantidad = comanda.cantidades?.[index] || 1;
        const estado = platoItem.estado || 'pedido';
        const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
        
        // Verificar si el plato está eliminado (solo excluir si explícitamente true)
        const platoEliminado = platoItem.eliminado === true;
        
        const platoObj = {
          platoId: platoItem.platoId || platoItem.plato?._id || platoItem.plato,
          plato: platoItem.plato || { nombre: 'Plato desconocido', precio: 0 },
          cantidad: cantidad,
          estado: estadoNormalizado,
          precio: platoItem.plato?.precio || 0,
          comandaId: comanda._id,
          comandaNumber: comanda.comandaNumber,
          eliminado: platoEliminado,
          index: index // Índice en la comanda original
        };
        
        if (!platoEliminado) platos.push(platoObj);
      });
    });

    const ordenPrioridad = { recoger: 1, pedido: 2, entregado: 3, pagado: 4 };
    platos.sort((a, b) => {
      const prioridadA = ordenPrioridad[a.estado] || 99;
      const prioridadB = ordenPrioridad[b.estado] || 99;
      return prioridadA - prioridadB;
    });

    setTodosLosPlatos(platos);
  }, [comandas]);
  
  useEffect(() => {
    prepararPlatosOrdenados();
  }, [comandas, prepararPlatosOrdenados]);
  
  // Refrescar comandas desde el servidor (estable para evitar loops; logs solo en error)
  const refrescarComandas = useCallback(async () => {
    if (!mesa?._id) return [];
    try {
      setRefreshing(true);

      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;

      const response = await axios.get(comandasURL, { timeout: 10000 });
      const todasLasComandas = response.data || [];

      const comandasMesa = todasLasComandas.filter(c => {
        const mesaId = c.mesas?._id || c.mesas;
        const coincideId = mesaId === mesa._id;
        const coincideNumero = c.mesas?.nummesa === mesa.nummesa;
        return coincideId || coincideNumero;
      });

      let comandasFinales = filtrarComandasActivas(comandasMesa);

      if ((filterByCliente || clienteId) && comandasFinales.length > 0 && clienteId) {
        const idStr = typeof clienteId === 'string' ? clienteId : clienteId?.toString?.() || '';
        comandasFinales = comandasFinales.filter(c => {
          const cid = c.cliente?._id ?? c.cliente;
          const cidStr = cid != null ? (typeof cid === 'string' ? cid : cid.toString?.() || '') : '';
          return cidStr === idStr;
        });
      }

      setComandasState(comandasFinales);

      // Corrección automática de status: si todas las comandas de la mesa tienen todos los platos entregados pero status distinto de recoger/entregado, actualizar en backend (workaround).
      verificarComandasEnLote(comandasFinales, axios).catch(() => {});

      // Ejecutar callback si existe
      if (onRefresh) {
        onRefresh();
      }

      return comandasFinales;
    } catch (error) {
      if (__DEV__) console.error('Error al refrescar comandas:', error?.message);
      Alert.alert('Error', 'No se pudieron actualizar las comandas.');
      return [];
    } finally {
      setRefreshing(false);
    }
  }, [mesa?._id, mesa?.nummesa, filterByCliente, clienteId]);

  // Marcar plato como entregado
  const handleMarcarPlatoEntregado = async (platoObj) => {
    if (platoObj.estado !== 'recoger' && platoObj.estado !== 'pedido') {
      Alert.alert(
        'Estado Inválido',
        'Solo se pueden marcar como entregados los platos que están listos para recoger.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    Alert.alert(
      'Confirmar Entrega',
      `¿Confirmas que entregaste "${platoObj.plato.nombre}" al cliente?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar Entrega',
          onPress: async () => {
            try {
              setLoading(true);
              
              const endpoint = apiConfig.isConfigured
                ? `${apiConfig.getEndpoint('/comanda')}/${platoObj.comandaId}/plato/${platoObj.platoId}/entregar`
                : `http://192.168.18.11:3000/api/comanda/${platoObj.comandaId}/plato/${platoObj.platoId}/entregar`;
              
              await axios.put(endpoint);
              await refrescarComandas();

              // Verificar si todos los platos de la comanda están entregados y corregir status a 'recoger' si aplica (workaround backend).
              verificarYActualizarEstadoComanda(platoObj.comandaId, axios).catch(() => {});
              
              Alert.alert('✓ Entrega Confirmada', `${platoObj.plato.nombre} marcado como entregado.`);
              
            } catch (error) {
              console.error('Error al marcar plato como entregado:', error);
              const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
              Alert.alert('Error', `No se pudo confirmar la entrega: ${errorMsg}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  // FASE 4: Integración WebSocket con manejo mejorado de rooms
  const mesaId = mesa?._id || null;

  // Refs para evitar loops: listeners leen estado actual sin estar en deps del effect
  const comandasRef = useRef(comandas);
  const refrescarComandasRef = useRef(refrescarComandas);
  const prevConnectedRef = useRef(connected);

  useEffect(() => {
    comandasRef.current = comandas;
  }, [comandas]);
  useEffect(() => {
    refrescarComandasRef.current = refrescarComandas;
  }, [refrescarComandas]);

  // Re-fetch SOLO al reconectar (transición desconectado → conectado), no en cada mount
  useEffect(() => {
    const wasDisconnected = !prevConnectedRef.current;
    if (connected && wasDisconnected) {
      refrescarComandasRef.current?.().catch(() => {});
    }
    prevConnectedRef.current = connected;
  }, [connected]);

  // FASE 4.1: Sincronizar estado de conexión local con el del contexto
  useEffect(() => {
    setLocalConnectionStatus(connectionStatus || 'desconectado');
  }, [connectionStatus]);

  // Effect único: join/leave room + listeners. Sin comandas/refrescarComandas en deps para evitar loop
  useEffect(() => {
    if (!socket || !connected || !mesaId) return;

    if (joinMesa) {
      joinMesa(mesaId);
    } else {
      socket.emit('join-mesa', mesaId);
    }

    // Listeners usan comandasRef.current y refrescarComandasRef.current (siempre actuales)
    socket.on('plato-actualizado', (data) => {
      setLocalConnectionStatus('online-active');
      setTimeout(() => setLocalConnectionStatus(connectionStatus || 'conectado'), 2000);

      const esNuestraMesa = data.mesaId && mesaId && (
        data.mesaId.toString() === mesaId.toString() || data.mesaId === mesaId
      );
      const comandasActuales = comandasRef.current;
      const comandaIndex = comandasActuales.findIndex(c => {
        const cId = c._id?.toString ? c._id.toString() : c._id;
        const dataComandaId = data.comandaId?.toString ? data.comandaId.toString() : data.comandaId;
        return cId === dataComandaId;
      });
      
      if (comandaIndex === -1 && !esNuestraMesa) return;

      if (comandaIndex !== -1 && data.platoId && data.nuevoEstado) {
        setComandasState(prev => {
          const nuevasComandas = [...prev];
          const comanda = nuevasComandas[comandaIndex];
          if (!comanda || !comanda.platos) {
            setTimeout(() => refrescarComandasRef.current?.(), 100);
            return prev;
          }
          const platoIdStr = data.platoId?.toString ? data.platoId.toString() : data.platoId;
          const platoIndex = comanda.platos.findIndex(p => {
            const pId = p.plato?._id?.toString ? p.plato._id.toString() : p.plato?.toString ? p.plato.toString() : p.platoId?.toString ? p.platoId.toString() : p.plato;
            return pId === platoIdStr;
          });
          if (platoIndex === -1) {
            setTimeout(() => refrescarComandasRef.current?.(), 100);
            return prev;
          }
          const nuevaComanda = { ...comanda };
          const nuevosPlatos = [...nuevaComanda.platos];
          const platoActualizado = { ...nuevosPlatos[platoIndex] };
          platoActualizado.estado = data.nuevoEstado;
          if (!platoActualizado.tiempos) platoActualizado.tiempos = {};
          platoActualizado.tiempos[data.nuevoEstado] = data.timestamp || new Date();
          nuevosPlatos[platoIndex] = platoActualizado;
          nuevaComanda.platos = nuevosPlatos;
          nuevasComandas[comandaIndex] = nuevaComanda;
          try {
            if (data.nuevoEstado === 'recoger') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_) {}
          if (data.nuevoEstado === 'recoger') {
            const nombrePlato = platoActualizado.plato?.nombre || platoActualizado.nombre || 'Un plato';
            Alert.alert('🍽️ Plato Listo', `${nombrePlato} está listo para recoger de cocina.`, [{ text: 'Entendido' }]);
          }
          return nuevasComandas;
        });
      } else {
        refrescarComandasRef.current?.();
      }
    });

    socket.on('plato-agregado', (data) => {
      const comandasActuales = comandasRef.current;
      const esNuestraComanda = comandasActuales.some(c => c._id === data.comandaId);
      if (esNuestraComanda || (data.mesaId && mesaId && (data.mesaId.toString() === mesaId.toString() || data.mesaId === mesaId))) {
        refrescarComandasRef.current?.();
      }
    });

    socket.on('plato-entregado', () => {
      refrescarComandasRef.current?.();
    });

    socket.on('comanda-actualizada', (data) => {
      if (data?.comandaId) invalidarCacheComandasVerificadas(data.comandaId);
      const comandasActuales = comandasRef.current;
      const esNuestraComanda = comandasActuales.some(c => c._id === data.comandaId);
      if (esNuestraComanda || (data.mesaId && mesaId && (data.mesaId.toString() === mesaId.toString() || data.mesaId === mesaId))) {
        refrescarComandasRef.current?.();
      }
    });

    socket.on('comanda-eliminada', (data) => {
      const comandasActuales = comandasRef.current;
      const esNuestraMesa = data.mesaId && mesaId && (data.mesaId.toString() === mesaId.toString() || data.mesaId === mesaId);
      const esNuestraComanda = data.comandaId && comandasActuales.some(c => (c._id || c._id?.toString()) === (data.comandaId?.toString?.() || data.comandaId));
      if (esNuestraMesa || esNuestraComanda) {
        refrescarComandasRef.current?.().then((actualizadas) => {
          if (Array.isArray(actualizadas) && actualizadas.length === 0) {
            if (onRefresh) onRefresh();
            if (navigation.canGoBack && navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Inicio');
          }
        });
      }
    });

    return () => {
      if (leaveMesa) leaveMesa(mesaId);
      else socket.emit('leave-mesa', mesaId);
      socket.off('plato-actualizado');
      socket.off('plato-agregado');
      socket.off('plato-entregado');
      socket.off('comanda-actualizada');
      socket.off('comanda-eliminada');
    };
  }, [socket, connected, mesaId, joinMesa, leaveMesa, connectionStatus, navigation, onRefresh]);

  useFocusEffect(
    useCallback(() => {
      refrescarComandas();
    }, [refrescarComandas])
  );
  
  // Calcular totales
  const calcularTotales = () => {
    let subtotal = 0;
    todosLosPlatos.forEach(plato => {
      subtotal += (plato.precio * plato.cantidad);
    });
    
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    return {
      subtotal: subtotal.toFixed(2),
      igv: igv.toFixed(2),
      total: total.toFixed(2)
    };
  };
  
  const totales = calcularTotales();
  
  // Validaciones para habilitación de botones
  const platosEnPedido = todosLosPlatos.filter(p => p.estado === 'pedido');
  const platosEnRecoger = todosLosPlatos.filter(p => p.estado === 'recoger');
  const platosEntregados = todosLosPlatos.filter(p => p.estado === 'entregado');
  const platosPagados = todosLosPlatos.filter(p => p.estado === 'pagado');
  
  const puedeEditar = platosEnPedido.length > 0;
  // IMPORTANTE: Solo se pueden eliminar platos en estado "Pedido"
  // Los platos en estado "Recoger" ya están listos y no deben eliminarse
  const puedeEliminarPlatos = platosEnPedido.length > 0;
  const puedeEliminarComanda = comandas.length > 0 && comandas[0].status !== 'pagado';
  const puedeNuevaComanda = mesa?.estado === 'pedido' || mesa?.estado === 'preparado' || mesa?.estado === 'recoger';
  const puedePagar = todosLosPlatos.length > 0 && todosLosPlatos.every(p => p.estado === 'entregado' || p.estado === 'pagado');
  
  // Obtener platos disponibles
  const obtenerPlatos = async () => {
    try {
      const platosURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/platos')
        : DISHES_API;
      const response = await axios.get(platosURL, { timeout: 5000 });
      setPlatos(response.data || []);
    } catch (error) {
      console.error('Error al obtener platos:', error);
    }
  };
  
  // Estados para edición
  const [platosEditados, setPlatosEditados] = useState([]);
  const [observacionesEditadas, setObservacionesEditadas] = useState('');
  
  // Funciones de edición
  const handleCambiarCantidad = (index, delta) => {
    const nuevosPlatos = [...platosEditados];
    const nuevaCantidad = Math.max(1, (nuevosPlatos[index].cantidad || 1) + delta);
    nuevosPlatos[index].cantidad = nuevaCantidad;
    setPlatosEditados(nuevosPlatos);
  };
  
  const handleRemoverPlato = (index) => {
    // REGLA DE NEGOCIO: Solo se pueden remover platos en estado "Pedido"
    // Los platos en estado "Recoger" ya están preparados y no deben eliminarse
    const platoARemover = platosEditados[index];
    
    if (!platoARemover) return;
    
    const estado = (platoARemover.estado || 'pedido').toLowerCase();
    const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
    
    if (estadoNormalizado === 'recoger') {
      Alert.alert(
        'No se puede eliminar',
        'No se pueden eliminar platos en estado Recoger desde edición. Los platos ya están preparados y listos para entrega. Solo puedes cambiar cantidades.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    // Solo permitir remover si está en estado "Pedido"
    if (estadoNormalizado !== 'pedido') {
      Alert.alert(
        'No se puede eliminar',
        'Solo se pueden eliminar platos en estado Pedido.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    const nuevosPlatos = [...platosEditados];
    nuevosPlatos.splice(index, 1);
    setPlatosEditados(nuevosPlatos);
  };
  
  const handleAgregarPlato = (plato) => {
    const platoExistente = platosEditados.find(
      p => {
        const pPlatoStr = p.plato?.toString();
        const platoIdStr = plato._id?.toString();
        return pPlatoStr === platoIdStr || p.plato === plato._id;
      }
    );
    
    if (platoExistente) {
      const index = platosEditados.indexOf(platoExistente);
      handleCambiarCantidad(index, 1);
    } else {
      setPlatosEditados([
        ...platosEditados,
        {
          plato: plato._id,
          platoId: plato.id || null,
          estado: 'pedido',
          cantidad: 1,
          nombre: plato.nombre,
          precio: plato.precio,
        }
      ]);
    }
  };
  
  const calcularTotalEdicion = () => {
    return platosEditados.reduce((total, p) => {
      return total + (p.precio || 0) * (p.cantidad || 1);
    }, 0);
  };
  
  // Función de normalización de tipos (igual que en OrdenesScreen)
  const tipoNormalizado = (t) => (t || '').trim().toLowerCase();
  
  // Filtrar platos para el modal de edición
  // Usa normalización para comparar tipos de manera flexible
  const platosFiltrados = platos.filter(p => {
    if (!tipoPlatoFiltro) return false;
    // Normalizar ambos tipos para comparación flexible
    if (tipoNormalizado(p.tipo) !== tipoNormalizado(tipoPlatoFiltro)) return false;
    // Verificar stock disponible
    const disponible = (p.stock == null || p.stock === undefined || Number(p.stock) > 0);
    if (!disponible) return false;
    // Filtrar por búsqueda
    if (searchPlato && !p.nombre.toLowerCase().includes(searchPlato.toLowerCase())) return false;
    // Filtrar por categoría
    if (categoriaFiltro && p.categoria !== categoriaFiltro) return false;
    return true;
  });
  
  const categorias = [...new Set(platos.filter(p => tipoNormalizado(p.tipo) === tipoNormalizado(tipoPlatoFiltro)).map(p => p.categoria))].filter(Boolean);
  
  // Guardar edición
  const handleGuardarEdicion = async () => {
    if (!comandaEditando || platosEditados.length === 0) {
      Alert.alert('Error', 'Debe haber al menos un plato en la comanda');
      return;
    }
    
    // VALIDACIÓN DE SEGURIDAD: Detectar si se removieron platos en estado "Recoger"
    // Comparar platos originales (editables) con platos actuales (editados)
    const platosOriginales = platosEditables || [];
    const platosRemovidos = platosOriginales.filter(original => {
      // Buscar si el plato original ya no está en platosEditados
      return !platosEditados.some(editado => {
        const originalId = original.plato?.toString() || original.platoId?.toString();
        const editadoId = editado.plato?.toString() || editado.platoId?.toString();
        return originalId === editadoId;
      });
    });
    
    // Verificar si algún plato removido estaba en estado "Recoger"
    const platosRecogerRemovidos = platosRemovidos.filter(p => {
      const estado = (p.estado || 'pedido').toLowerCase();
      const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
      return estadoNormalizado === 'recoger';
    });
    
    if (platosRecogerRemovidos.length > 0) {
      Alert.alert(
        'Error de validación',
        'No se pueden eliminar platos en estado Recoger desde edición. Los platos ya están preparados. Por favor, refresca la comanda y solo cambia cantidades.',
        [
          {
            text: 'Refrescar',
            onPress: async () => {
              await refrescarComandas();
              setModalEditarVisible(false);
            }
          }
        ]
      );
      return;
    }
    
    try {
      setLoading(true);
      
      const platosData = platosEditados.map(p => {
        const platoCompleto = platos.find(pl => pl._id === p.plato || pl._id === p.plato?.toString());
        return {
          plato: p.plato,
          platoId: platoCompleto?.id || p.platoId || null,
          estado: p.estado || 'pedido'
        };
      });
      
      const cantidades = platosEditados.map(p => p.cantidad || 1);
      
      const updateData = {
        mesas: mesa._id,
        platos: platosData,
        cantidades: cantidades,
        observaciones: observacionesEditadas || '',
      };
      
      const comandaUpdateURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaEditando._id}`
        : `${COMANDA_API}/${comandaEditando._id}`;
      
      await axios.put(comandaUpdateURL, updateData, { timeout: 5000 });
      
      Alert.alert('✅', 'Comanda actualizada exitosamente');
      setModalEditarVisible(false);
      setComandaEditando(null);
      setTipoPlatoFiltro(null);
      setSearchPlato('');
      setCategoriaFiltro(null);
      setPlatosEditados([]);
      setObservacionesEditadas('');
      
      await refrescarComandas();
      
    } catch (error) {
      console.error('Error actualizando comanda:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar la comanda');
    } finally {
      setLoading(false);
    }
  };
  
  // Funciones de acciones
  const handleEditarComanda = async () => {
    // NOTA: Los platos EDITABLES incluyen estados 'pedido' y 'recoger'
    // Esto permite editar platos que aún no han sido entregados
    // Ver separarPlatosEditables() en utils/comandaHelpers.js
    const { editables, noEditables } = separarPlatosEditables(comandas);
    
    if (editables.length === 0) {
      Alert.alert(
        'Sin Platos Editables',
        'No hay platos que puedan editarse. Los platos entregados no pueden modificarse.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    // Cargar todos los platos disponibles antes de abrir el modal
    // Esto permite que el selector de tipo funcione correctamente
    await obtenerPlatos();
    
    // Limpiar filtros al abrir modal
    setTipoPlatoFiltro(null);
    setSearchPlato('');
    setCategoriaFiltro(null);
    
    // Preparar platos editados (solo editables) con datos completos
    const platosEditadosPreparados = editables.map(e => {
      // Buscar el plato completo en la comanda original
      const comanda = comandas.find(c => c._id === e.comandaId);
      if (!comanda || !comanda.platos) return null;
      
      const platoItem = comanda.platos[e.index];
      if (!platoItem) return null;
      
      return {
        plato: e.plato,
        platoId: e.platoId,
        estado: e.estado,
        cantidad: e.cantidad,
        nombre: e.nombre,
        precio: e.precio,
        index: e.index,
        comandaId: e.comandaId
      };
    }).filter(p => p !== null);
    
    setPlatosEditables(editables);
    setPlatosNoEditables(noEditables);
    setPlatosEditados(platosEditadosPreparados);
    setObservacionesEditadas(comandas[0]?.observaciones || '');
    setComandaEditando(comandas[0]);
    setModalEditarVisible(true);
  };
  
  const handleEliminarPlatos = () => {
    // Usar función de utilidad para filtrar platos eliminables
    // IMPORTANTE: Solo se pueden eliminar platos en estado "Pedido"
    // Los platos en estado "Recoger" ya están listos para retiro/entrega y no deben eliminarse
    const platosEliminables = filtrarPlatosPorEstado(comandas, ['pedido']);
    
    if (platosEliminables.length === 0) {
      Alert.alert(
        'Sin Platos Eliminables',
        'No hay platos en estado Pedido para eliminar. Solo se pueden eliminar platos que aún no han sido preparados.'
      );
      return;
    }
    
    setPlatosParaEliminar(platosEliminables);
    setPlatosSeleccionadosEliminar([]);
    setModalEliminarVisible(true);
  };
  
  const toggleSeleccionarPlatoEliminar = (plato) => {
    setPlatosSeleccionadosEliminar(prev => {
      const existe = prev.find(p => p.platoId === plato.platoId && p.comandaId === plato.comandaId);
      if (existe) {
        return prev.filter(p => !(p.platoId === plato.platoId && p.comandaId === plato.comandaId));
      } else {
        return [...prev, plato];
      }
    });
  };
  
  const confirmarEliminacionPlatos = async () => {
    // Validar que no se eliminen todos los platos
    const validacion = validarEliminacionCompleta(todosLosPlatos, platosSeleccionadosEliminar);
    if (!validacion.valido) {
      Alert.alert('Error', validacion.mensaje);
      return;
    }
    
    // Detectar si hay platos preparados
    const hayPlatosPreparados = detectarPlatosPreparados(platosSeleccionadosEliminar);
    
    if (hayPlatosPreparados) {
      Alert.alert(
        '⚠️ Platos Preparados',
        'Estás a punto de eliminar platos que ya están listos en cocina. Estos platos se desperdiciarán. ¿Estás seguro de continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sí, eliminar',
            style: 'destructive',
            onPress: () => {
              // Continuar con la eliminación después de confirmar
              procederConEliminacion();
            }
          }
        ]
      );
      return;
    }
    
    // Si no hay platos preparados, proceder directamente
    procederConEliminacion();
  };
  
  const procederConEliminacion = async () => {
    if (!motivoEliminacion || motivoEliminacion.trim() === '') {
      Alert.alert('Error', 'Debes indicar un motivo para la eliminación (mínimo 5 caracteres).');
      return;
    }
    
    if (motivoEliminacion.trim().length < 5) {
      Alert.alert('Error', 'El motivo debe tener al menos 5 caracteres.');
      return;
    }
    
    if (platosSeleccionadosEliminar.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un plato para eliminar.');
      return;
    }
    
    if (!userInfo?._id) {
      Alert.alert('Error', 'No se pudo identificar al usuario. Por favor, inicia sesión nuevamente.');
      return;
    }
    
    if (!comandas || comandas.length === 0 || !comandas[0]._id) {
      Alert.alert('Error', 'No se encontró la comanda.');
      return;
    }
    
    try {
      setLoading(true);
      
      const platosPorComanda = {};
      platosSeleccionadosEliminar.forEach(plato => {
        if (!platosPorComanda[plato.comandaId]) {
          platosPorComanda[plato.comandaId] = [];
        }
        const comanda = comandas.find(c => c._id === plato.comandaId);
        if (comanda && comanda.platos) {
          const platoIndex = comanda.platos.findIndex((p, idx) => {
            const pId = p.platoId || p.plato?._id || p.plato;
            return pId?.toString() === plato.platoId?.toString() && !p.eliminado;
          });
          if (platoIndex !== -1) {
            platosPorComanda[plato.comandaId].push(platoIndex);
          }
        }
      });
      
      for (const [comandaId, indices] of Object.entries(platosPorComanda)) {
        if (indices.length === 0) continue;

        const endpoint = apiConfig.isConfigured
          ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/eliminar-platos`
          : `${COMANDA_API}/${comandaId}/eliminar-platos`;

        const dataAEnviar = {
          platosAEliminar: indices,
          motivo: motivoEliminacion.trim(),
          mozoId: userInfo._id,
          usuarioId: userInfo._id
        };

        console.log('🗑️ Eliminando platos:', {
          endpoint,
          comandaId: comandaId?.slice(-6),
          indices,
          motivo: motivoEliminacion.trim().substring(0, 20) + '...',
          mozoId: userInfo._id
        });

        await axios.put(endpoint, dataAEnviar, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      const comandasActualizadas = await refrescarComandas();
      const sinComandasActivas = Array.isArray(comandasActualizadas) && comandasActualizadas.length === 0;

      if (sinComandasActivas) {
        Alert.alert(
          '✓ Comanda cancelada',
          'Todos los platos fueron eliminados. La comanda ha sido cancelada.',
          [{ text: 'Entendido' }]
        );
        setModalEliminarVisible(false);
        setMotivoEliminacion('');
        setPlatosSeleccionadosEliminar([]);
        if (onRefresh) onRefresh();
        if (navigation.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Inicio');
        }
      } else {
        Alert.alert('✓ Platos Eliminados', 'Los platos fueron eliminados correctamente.');
        setModalEliminarVisible(false);
        setMotivoEliminacion('');
        setPlatosSeleccionadosEliminar([]);
      }
      
    } catch (error) {
      console.error('❌ Error completo al eliminar platos:', error);
      console.error('Error response:', error.response);
      console.error('Error request:', error.request);
      console.error('Error message:', error.message);
      
      let errorMsg = 'No se pudieron eliminar los platos.';
      
      if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        errorMsg = error.response.data?.message || error.response.data?.error || `Error del servidor (${error.response.status})`;
        Alert.alert('Error del Servidor', errorMsg);
      } else if (error.request) {
        // La petición fue hecha pero no se recibió respuesta
        console.error('Request hecho pero sin respuesta');
        Alert.alert(
          'Error de Conexión',
          'No se pudo conectar con el servidor. Verifica tu conexión a internet y que el servidor esté activo.'
        );
      } else {
        // Algo pasó al configurar la petición
        console.error('Error en configuración:', error.message);
        errorMsg = error.message || 'Error desconocido';
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleEliminarComanda = () => {
    if (!puedeEliminarComanda) {
      Alert.alert('Error', 'No se puede eliminar esta comanda.');
      return;
    }
    
    const comandaAEliminar = comandas[0];
    
    // REGLA DE NEGOCIO: Solo se pueden eliminar comandas con platos exclusivamente en estado "Pedido"
    // Los platos en estado "Recoger" o "Entregado" ya están preparados/entregados y NO deben eliminarse
    const platosEliminables = filtrarPlatosPorEstado(comandas, ['pedido']);
    
    // Detectar platos en estados que bloquean eliminación: Recoger, Entregado, Pagado
    const hayPlatosEnRecoger = todosLosPlatos.some(p => 
      p.estado === 'recoger' && !p.eliminado
    );
    const hayPlatosEntregados = todosLosPlatos.some(p => 
      (p.estado === 'entregado' || p.estado === 'pagado') && !p.eliminado
    );
    
    // Regla: No eliminar comandas con platos Recoger/Entregado (igual que Entregado existente)
    if (hayPlatosEnRecoger || hayPlatosEntregados) {
      Alert.alert(
        'No se puede eliminar esta comanda',
        'Contiene platos en estado Recoger o Entregado. Solo se pueden eliminar comandas con platos exclusivamente en estado Pedido.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    // Validar que haya al menos un plato en estado "Pedido"
    if (platosEliminables.length === 0) {
      Alert.alert(
        'No se puede eliminar esta comanda',
        'Todos los platos ya están en estado Recoger o posterior. Solo se pueden eliminar comandas con platos en estado Pedido.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    // Preparar datos para el modal
    setPlatosEliminablesComanda(platosEliminables);
    setHayPlatosEnRecogerComanda(false); // Ya no hay platos en recoger en eliminables
    
    Alert.alert(
      'Eliminar Comanda',
      '¿Estás seguro de eliminar esta comanda?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            setModalEliminarComandaVisible(true);
          }
        }
      ]
    );
  };
  
  const confirmarEliminacionComanda = async () => {
    if (!motivoEliminacionComanda || motivoEliminacionComanda.trim() === '') {
      Alert.alert('Error', 'Debes indicar un motivo para la eliminación.');
      return;
    }
    
    if (!userInfo?._id) {
      Alert.alert('Error', 'No se pudo identificar al usuario. Por favor, inicia sesión nuevamente.');
      return;
    }
    
    if (!comandas || comandas.length === 0 || !comandas[0]._id) {
      Alert.alert('Error', 'No se encontró la comanda a eliminar.');
      return;
    }
    
    // VALIDACIÓN DE SEGURIDAD: Re-verificar antes de enviar al backend
    // Por si algún plato cambió de estado vía Socket mientras el usuario completaba el formulario
    const platosEliminablesActualizados = filtrarPlatosPorEstado(comandas, ['pedido']);
    
    // Detectar si hay platos en estados que bloquean eliminación
    const hayPlatosEnRecogerActualizados = todosLosPlatos.some(p => 
      p.estado === 'recoger' && !p.eliminado
    );
    const hayPlatosEntregadosActualizados = todosLosPlatos.some(p => 
      (p.estado === 'entregado' || p.estado === 'pagado') && !p.eliminado
    );
    
    // Bloquear si no hay platos eliminables O si hay platos en Recoger/Entregado
    if (platosEliminablesActualizados.length === 0 || hayPlatosEnRecogerActualizados || hayPlatosEntregadosActualizados) {
      Alert.alert(
        'Error',
        'La comanda cambió. Contiene platos Recoger/Entregado. No se puede eliminar.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await refrescarComandas();
              setModalEliminarComandaVisible(false);
            }
          }
        ]
      );
      return;
    }
    
    try {
      setLoading(true);
      
      const comandaId = comandas[0]._id;
      const endpoint = apiConfig.isConfigured
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/eliminar`
        : `${COMANDA_API}/${comandaId}/eliminar`;
      
      const dataAEnviar = {
        motivo: motivoEliminacionComanda.trim(),
        usuarioId: userInfo._id,
        mozoId: userInfo._id
      };
      
      console.log('🗑️ Eliminando comanda:', {
        endpoint,
        comandaId: comandaId?.slice(-6),
        motivo: motivoEliminacionComanda.trim().substring(0, 20) + '...',
        usuarioId: userInfo._id
      });
      
      await axios.put(endpoint, dataAEnviar, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      Alert.alert('✓ Comanda Eliminada', 'La comanda fue eliminada correctamente.');
      setModalEliminarComandaVisible(false);
      setMotivoEliminacionComanda('');
      setPlatosEliminablesComanda([]);
      setHayPlatosEnRecogerComanda(false);
      
      // Refrescar lista de mesas para que la mesa pase a estado libre
      if (onRefresh) onRefresh();
      if (navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Inicio');
      }
      
    } catch (error) {
      console.error('❌ Error completo al eliminar comanda:', error);
      console.error('Error response:', error.response);
      console.error('Error request:', error.request);
      console.error('Error message:', error.message);
      
      let errorMsg = 'No se pudo eliminar la comanda.';
      
      if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        errorMsg = error.response.data?.message || error.response.data?.error || `Error del servidor (${error.response.status})`;
        Alert.alert('Error del Servidor', errorMsg);
      } else if (error.request) {
        // La petición fue hecha pero no se recibió respuesta
        console.error('Request hecho pero sin respuesta');
        Alert.alert(
          'Error de Conexión',
          'No se pudo conectar con el servidor. Verifica tu conexión a internet y que el servidor esté activo.'
        );
      } else {
        // Algo pasó al configurar la petición
        console.error('Error en configuración:', error.message);
        errorMsg = error.message || 'Error desconocido';
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleNuevaComanda = () => {
    if (!puedeNuevaComanda) {
      Alert.alert('Error', 'No se puede crear una nueva comanda en esta mesa en su estado actual.');
      return;
    }
    
    // Guardar contexto y navegar a OrdenesScreen
    AsyncStorage.setItem('mesaSeleccionada', JSON.stringify(mesa));
    navigation.navigate('Ordenes', {
      mesa: mesa,
      origen: 'ComandaDetalle'
    });
  };
  
  const handlePagar = async () => {
    if (!puedePagar) {
      const hayPlatosPendientes = todosLosPlatos.some(p => p.estado === 'pedido' || p.estado === 'recoger');
      if (hayPlatosPendientes) {
        Alert.alert(
          'Platos Pendientes',
          'Hay platos pendientes de entregar. Todos los platos deben estar entregados antes de pagar.',
          [{ text: 'Entendido' }]
        );
      }
      return;
    }
    
    try {
      // Corrección preventiva: asegurar que comandas con todos los platos entregados tengan status recoger/entregado antes de pedir comandas-para-pagar.
      if (comandas.length > 0) {
        await Promise.all(comandas.map((c) => verificarYActualizarEstadoComanda(c, axios)));
      }

      // Obtener comandas para pagar desde el backend
      const endpoint = apiConfig.isConfigured
        ? `${apiConfig.getEndpoint('/comanda')}/comandas-para-pagar/${mesa._id}`
        : `http://192.168.18.11:3000/api/comanda/comandas-para-pagar/${mesa._id}`;
      
      const response = await axios.get(endpoint);
      
      if (!response.data || !response.data.comandas || response.data.comandas.length === 0) {
        Alert.alert('Error', 'No hay comandas para pagar en esta mesa.');
        return;
      }
      
      // Navegar a PagosScreen
      navigation.navigate('Pagos', {
        mesa: response.data.mesa,
        comandasParaPagar: response.data.comandas,
        totalPendiente: response.data.totalPendiente,
        origen: 'ComandaDetalle'
      });
      
    } catch (error) {
      console.error('Error al obtener comandas para pagar:', error);
      Alert.alert('Error', 'No se pudieron obtener las comandas para pagar.');
    }
  };
  
  // Obtener información de la comanda principal
  const comandaPrincipal = comandas[0] || {};
  const mozoNombre = comandaPrincipal.mozos?.name || 'Desconocido';
  const fechaComanda = comandaPrincipal.createdAt 
    ? moment(comandaPrincipal.createdAt).tz("America/Lima").format("DD/MM/YYYY, h:mm:ss a")
    : 'Fecha no disponible';
  
  // Renderizar fila de plato
  const renderFilaPlato = ({ item: plato, index }) => {
    const estilos = obtenerEstilosPorEstado(plato.estado);
    return (
      <FilaPlatoCompacta
        plato={plato}
        estilos={estilos}
        onMarcarEntregado={handleMarcarPlatoEntregado}
      />
    );
  };
  
  // Separador entre filas
  const renderSeparador = () => null; // No mostrar separador, usar borde inferior
  
  // Key extractor
  const keyExtractor = (item, index) => `${item.comandaId}-${item.platoId}-${index}`;
  
  return (
        <View style={[styles.container, { backgroundColor: themeColors.colors?.background || themeColors.background || '#FFFFFF' }]}>
      {/* Header Personalizado - FASE 4.1: Con indicador online/offline */}
      <HeaderComandaDetalle
        mesa={mesa}
        comanda={comandaPrincipal}
        onSync={refrescarComandas}
        navigation={navigation}
        connectionStatus={localConnectionStatus}
        isConnected={connected}
        reconnectAttempts={reconnectAttempts}
      />
      
      {/* Layout de dos columnas */}
      <View style={styles.twoColumnLayout}>
        {/* Columna Izquierda: Tabla de Platos (70%) */}
        <View style={styles.leftColumn}>
          {todosLosPlatos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons 
                name="silverware-fork-knife" 
                size={48} 
                color={themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280'} 
              />
              <Text style={[styles.emptyText, { color: themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280' }]}>
                No hay platos en esta comanda
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={todosLosPlatos}
                renderItem={renderFilaPlato}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={renderSeparador}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={refrescarComandas} />
                }
                style={styles.platosList}
                contentContainerStyle={styles.platosListContent}
                getItemLayout={(data, index) => ({
                  length: 60,
                  offset: 60 * index,
                  index,
                })}
              />
              
              {/* Totales */}
              <View style={[
                styles.totalesContainer,
                {
                  backgroundColor: isDark ? '#FFFFFF' : (themeColors.colors?.card || themeColors.card || '#FFFFFF'), // Blanco en modo oscuro para que el texto negro se vea
                  borderColor: isDark ? '#E5E7EB' : (themeColors.colors?.border || themeColors.border || '#E5E7EB'),
                }
              ]}>
                <View style={[styles.totalRow]}>
                  <Text style={[
                    styles.totalLabel, 
                    { 
                      color: isDark ? '#000000' : (themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280')
                    }
                  ]}>
                    Subtotal:
                  </Text>
                  <Text style={[styles.totalValue, { color: '#059669' }]}>
                    S/. {totales.subtotal}
                  </Text>
                </View>
                <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
                  <Text style={[
                    styles.totalLabel, 
                    { 
                      color: isDark ? '#000000' : (themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280')
                    }
                  ]}>
                    IGV (18%):
                  </Text>
                  <Text style={[styles.totalValue, { color: '#059669' }]}>
                    S/. {totales.igv}
                  </Text>
                </View>
                <View style={[styles.totalRow, styles.totalRowFinal, { borderTopColor: isDark ? '#374151' : (themeColors.colors?.border || themeColors.border || '#E5E7EB') }]}>
                  <Text style={[styles.totalLabel, styles.totalLabelFinal, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                    TOTAL:
                  </Text>
                  <Text style={[styles.totalValue, styles.totalValueFinal, { color: '#059669' }]}>
                    S/. {totales.total}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
        
        {/* Columna Derecha: Opciones (30%) */}
        <View style={[
          styles.rightColumn,
          {
            backgroundColor: themeColors.colors?.background || themeColors.background || '#F9FAFB',
            borderRightColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
          }
        ]}>
          <ScrollView style={styles.optionsScrollView}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#3B82F6' }, // Azul intenso en ambos modos
                !puedeEditar && styles.actionButtonDisabled
              ]}
              onPress={handleEditarComanda}
              disabled={!puedeEditar}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Editar Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#EF4444' }, // Rojo intenso en ambos modos
                !puedeEliminarPlatos && styles.actionButtonDisabled
              ]}
              onPress={handleEliminarPlatos}
              disabled={!puedeEliminarPlatos}
            >
              <MaterialCommunityIcons name="delete" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Eliminar Platos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#EF4444' }, // Rojo intenso en ambos modos
                !puedeEliminarComanda && styles.actionButtonDisabled
              ]}
              onPress={handleEliminarComanda}
              disabled={!puedeEliminarComanda}
            >
              <MaterialCommunityIcons name="delete-forever" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Eliminar Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#10B981' }, // Verde intenso en ambos modos
                !puedeNuevaComanda && styles.actionButtonDisabled
              ]}
              onPress={handleNuevaComanda}
              disabled={!puedeNuevaComanda}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Nueva Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#059669' }, // Verde intenso en ambos modos
                !puedePagar && styles.actionButtonDisabled
              ]}
              onPress={handlePagar}
              disabled={!puedePagar}
            >
              <MaterialCommunityIcons name="cash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Pagar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: themeColors.colors?.text?.secondary || '#6B7280' }
              ]}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="close" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      
      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.colors.primary} />
          <Text style={styles.loadingText}>Procesando...</Text>
        </View>
      )}
      
      {/* Modal Eliminar Platos */}
      <Modal
        visible={modalEliminarVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalEliminarVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: isDark ? '#000000' : (themeColors.colors?.surface || themeColors.colors?.card || themeColors.card || '#FFFFFF'), // Negro puro en modo oscuro
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.5 : 0.25,
              shadowRadius: 8,
              elevation: 10,
            }
          ]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
              Eliminar Platos
            </Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#D1D5DB' : (themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280') }]}>
              Selecciona los platos a eliminar:
            </Text>
            
            <ScrollView style={styles.modalPlatosList}>
              {platosParaEliminar.map((plato, index) => {
                const seleccionado = platosSeleccionadosEliminar.some(
                  p => p.platoId === plato.platoId && p.comandaId === plato.comandaId
                );
                const estilos = obtenerEstilosPorEstado(plato.estado);
                
                return (
                    <TouchableOpacity
                      key={`${plato.comandaId}-${plato.platoId}-${index}`}
                      style={[
                        styles.modalPlatoItem,
                        {
                          // Fondo SATURADO directo según estado
                          backgroundColor: isDark
                            ? (plato.estado === 'pedido' 
                                ? '#1E40AF' // Azul saturado
                                : plato.estado === 'recoger'
                                ? '#D97706' // Naranja saturado
                                : plato.estado === 'entregado'
                                ? '#047857' // Verde saturado
                                : '#4B5563') // Gris para otros estados
                            : estilos.fondo, // En modo claro usar color pastel
                          borderColor: seleccionado ? '#EF4444' : (isDark 
                            ? (plato.estado === 'pedido' ? '#3B82F6' : 
                               plato.estado === 'recoger' ? '#F59E0B' : 
                               plato.estado === 'entregado' ? '#10B981' : '#6B7280')
                            : estilos.borde),
                          borderWidth: seleccionado ? 2 : 1,
                        },
                        seleccionado && {
                          backgroundColor: isDark 
                            ? 'rgba(239, 68, 68, 0.3)' // Rojo con opacity para selección
                            : '#FEF2F2',
                        }
                      ]}
                      onPress={() => toggleSeleccionarPlatoEliminar(plato)}
                    >
                    <MaterialCommunityIcons
                      name={seleccionado ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={seleccionado 
                        ? '#EF4444' // Rojo intenso en ambos modos
                        : (themeColors.colors?.border || themeColors.border || '#9CA3AF')
                      }
                    />
                    <View style={styles.modalPlatoInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[
                          styles.modalPlatoNombre, 
                          { 
                            color: isDark ? '#FFFFFF' : estilos.textColor || '#1F2937', // Blanco en modo oscuro
                            flex: 1,
                          }
                        ]}>
                          {plato.plato.nombre}
                        </Text>
                        <View style={[
                          styles.badgeEstado,
                          {
                            backgroundColor: isDark
                              ? (plato.estado === 'pedido' ? '#60A5FA' :
                                 plato.estado === 'recoger' ? '#FBBF24' :
                                 plato.estado === 'entregado' ? '#34D399' :
                                 '#9CA3AF')
                              : estilos.badgeFondo,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 8,
                          }
                        ]}>
                          <Text style={[
                            styles.badgeEstadoText,
                            { 
                              color: isDark
                                ? (plato.estado === 'pedido' ? '#1E3A8A' :
                                   plato.estado === 'recoger' ? '#78350F' :
                                   plato.estado === 'entregado' ? '#064E3B' :
                                   '#1F2937')
                                : estilos.badgeTexto
                            }
                          ]}>
                            {estilos.textoEstado}
                          </Text>
                        </View>
                      </View>
                      <Text style={[
                        styles.modalPlatoCantidad, 
                        { 
                          color: '#059669', // Verde intenso en ambos modos
                          marginTop: 4,
                        }
                      ]}>
                        x{plato.cantidad} - S/. {(plato.precio * plato.cantidad).toFixed(2)}
                      </Text>
                      {plato.estado === 'recoger' && (
                        <View style={{
                          marginTop: 6,
                          padding: 8,
                          borderRadius: 6,
                          backgroundColor: isDark ? 'rgba(251, 146, 60, 0.15)' : '#FEF3C7',
                          borderWidth: 1,
                          borderColor: isDark ? '#FB923C' : '#F59E0B',
                        }}>
                          <Text style={[
                            styles.modalPlatoAdvertencia, 
                            { 
                              color: isDark ? '#FED7AA' : '#92400E',
                              fontSize: 12,
                            }
                          ]}>
                            ⚠️ Plato preparado
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <TextInput
              style={[
                {
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  textAlignVertical: 'top',
                  marginBottom: 16,
                  minHeight: 80,
                  backgroundColor: isDark ? '#000000' : '#FFFFFF', // Negro puro en modo oscuro
                  borderColor: isDark ? '#4B5563' : '#D1D5DB', // Gris medio en modo oscuro para visibilidad
                  color: isDark ? '#FFFFFF' : '#111827', // Blanco en modo oscuro, gris muy oscuro en claro
                }
              ]}
              placeholder="Ej: Cliente cambió de opinión, error en el pedido, plato no disponible..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'} // Gris medio claro en oscuro, gris medio en claro
              value={motivoEliminacion}
              onChangeText={setMotivoEliminacion}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonCancel,
                  {
                    backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
                  }
                ]}
                onPress={() => {
                  setModalEliminarVisible(false);
                  setMotivoEliminacion('');
                  setPlatosSeleccionadosEliminar([]);
                }}
              >
                <Text style={[
                  styles.modalButtonText,
                  { color: isDark ? '#F9FAFB' : '#374151' }
                ]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonConfirm,
                  {
                    backgroundColor: '#EF4444', // Rojo intenso en ambos modos
                  }
                ]}
                onPress={confirmarEliminacionPlatos}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm, { color: '#FFFFFF' }]}>
                  Eliminar ({platosSeleccionadosEliminar.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal Editar Comanda */}
      <Modal
        visible={modalEditarVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setModalEditarVisible(false);
          setComandaEditando(null);
          setTipoPlatoFiltro(null);
          setSearchPlato('');
          setCategoriaFiltro(null);
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[
            styles.modalContentEditar, 
            { 
              backgroundColor: isDark ? '#000000' : (themeColors.colors?.surface || themeColors.colors?.card || themeColors.card || '#FFFFFF'), // Negro puro en modo oscuro
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.5 : 0.25,
              shadowRadius: 8,
              elevation: 10,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                Editar Comanda #{comandaEditando?.comandaNumber || 'N/A'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEditarVisible(false);
                setComandaEditando(null);
                setTipoPlatoFiltro(null);
                setSearchPlato('');
                setCategoriaFiltro(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937')} />
              </TouchableOpacity>
            </View>
            
            {/* Leyenda de colores */}
            <View style={[
              styles.leyendaColores,
              {
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
              }
            ]}>
              <Text style={[styles.leyendaText, { color: isDark ? '#D1D5DB' : (themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280') }]}>
                🔵 Celeste: Pedido | 🟡 Amarillo: Listo para recoger | 🟢 Verde: Entregado
              </Text>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                  Mesa: {mesa?.nummesa || 'N/A'}
                </Text>
              </View>
              
              {/* Platos Editables */}
              {platosEditables.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                    Platos Editables:
                  </Text>
                  {platosEditados.map((plato, index) => {
                    // Verificar si este plato es editable
                    const esEditable = platosEditables.some(e => {
                      const ePlatoId = e.plato?.toString() || e.platoId?.toString();
                      const pPlatoId = plato.plato?.toString() || plato.platoId?.toString();
                      return ePlatoId === pPlatoId;
                    });
                    
                    if (!esEditable) return null;
                    
                    // Obtener colores según estado
                    const coloresEstado = obtenerColoresEstadoAdaptados(plato.estado || 'pedido', isDark, true);
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.platoEditItem,
                          {
                            // Fondo SATURADO directo (sin overlay, sin opacity)
                            backgroundColor: coloresEstado.backgroundColor,
                            borderLeftWidth: 4,
                            borderLeftColor: coloresEstado.borderColor,
                            borderColor: coloresEstado.borderColor,
                            opacity: coloresEstado.opacity || 1, // Solo para no editables
                          }
                        ]}
                      >
                        <View style={styles.platoEditInfo}>
                          <View style={styles.platoEditNombreContainer}>
                            <Text style={[
                              styles.platoEditNombre, 
                              { 
                                color: coloresEstado.textColor // Color específico del estado
                              }
                            ]}>
                              {plato.nombre}
                            </Text>
                            <View style={[styles.badgeEstado, { backgroundColor: coloresEstado.badgeColor }]}>
                              <Text style={[styles.badgeEstadoText, { color: coloresEstado.badgeTextColor }]}>
                                {coloresEstado.textoEstado}
                              </Text>
                            </View>
                            {/* Badge indicando que platos en "Recoger" no son eliminables */}
                            {(plato.estado || 'pedido').toLowerCase() === 'recoger' && (
                              <View style={[styles.badgeEstado, { backgroundColor: '#9CA3AF', marginLeft: 6 }]}>
                                <Text style={[styles.badgeEstadoText, { color: '#FFFFFF' }]}>
                                  NO ELIMINABLE
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.platoEditPrecio, { color: coloresEstado.priceColor }]}>
                            S/. {((plato.precio || 0) * (plato.cantidad || 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.platoEditActions}>
                          <TouchableOpacity
                            style={[
                              styles.cantidadButton, 
                              { 
                                backgroundColor: isDark ? '#4B5563' : '#E5E7EB'
                              }
                            ]}
                            onPress={() => handleCambiarCantidad(index, -1)}
                          >
                            <Text style={[
                              styles.cantidadButtonText, 
                              { 
                                color: isDark ? '#F9FAFB' : '#374151'
                              }
                            ]}>-</Text>
                          </TouchableOpacity>
                          <Text style={[
                            styles.cantidadText, 
                            { 
                              color: coloresEstado.textColor // Color específico del estado
                            }
                          ]}>
                            {plato.cantidad || 1}
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.cantidadButton, 
                              { 
                                backgroundColor: isDark ? '#4B5563' : '#E5E7EB'
                              }
                            ]}
                            onPress={() => handleCambiarCantidad(index, 1)}
                          >
                            <Text style={[
                              styles.cantidadButtonText, 
                              { 
                                color: isDark ? '#F9FAFB' : '#374151'
                              }
                            ]}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.removeButton,
                              (plato.estado || 'pedido').toLowerCase() === 'recoger' && styles.removeButtonDisabled
                            ]}
                            onPress={() => handleRemoverPlato(index)}
                            disabled={(plato.estado || 'pedido').toLowerCase() === 'recoger'}
                          >
                            <MaterialCommunityIcons 
                              name={(plato.estado || 'pedido').toLowerCase() === 'recoger' ? "lock" : "delete"} 
                              size={20} 
                              color={(plato.estado || 'pedido').toLowerCase() === 'recoger' ? "#9CA3AF" : "#EF4444"} 
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              
              {/* Platos No Editables */}
              {platosNoEditables.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, styles.editLabelNoEditable, { color: '#10B981' }]}>
                    ✓ Platos entregados (no editables):
                  </Text>
                  {platosNoEditables.map((plato, index) => {
                    // Obtener colores según estado (no editable)
                    const coloresEstado = obtenerColoresEstadoAdaptados(plato.estado || 'entregado', isDark, false);
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.platoEditItem, 
                          styles.platoEditItemNoEditable,
                          {
                            // Fondo SATURADO directo (sin overlay)
                            backgroundColor: coloresEstado.backgroundColor,
                            borderLeftWidth: 4,
                            borderLeftColor: coloresEstado.borderColor,
                            borderColor: coloresEstado.borderColor,
                            opacity: coloresEstado.opacity || 0.6, // Opacity global para no editables
                          }
                        ]}
                      >
                        <View style={styles.platoEditInfo}>
                          <View style={styles.platoEditNombreContainer}>
                            <Text style={[
                              styles.platoEditNombre, 
                              styles.platoEditNombreNoEditable, 
                              { 
                                color: coloresEstado.textColor // Color específico del estado
                              }
                            ]}>
                              {plato.nombre}
                            </Text>
                            <View style={[styles.badgeEstado, { backgroundColor: coloresEstado.badgeColor }]}>
                              <Text style={[styles.badgeEstadoText, { color: coloresEstado.badgeTextColor }]}>
                                {coloresEstado.textoEstado}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.platoEditPrecio, { color: coloresEstado.priceColor }]}>
                            S/. {((plato.precio || 0) * (plato.cantidad || 1)).toFixed(2)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons 
                          name="lock" 
                          size={20} 
                          color={coloresEstado.textColor} 
                        />
                      </View>
                    );
                  })}
                </View>
              )}
              
              {/* Agregar Platos */}
              <View style={styles.editSection}>
                <TouchableOpacity
                  style={styles.addPlatoButton}
                  onPress={async () => {
                    await obtenerPlatos();
                    setTipoPlatoFiltro(null);
                    setSearchPlato('');
                    setCategoriaFiltro(null);
                    Alert.alert(
                      'Agregar Plato',
                      'Selecciona el tipo de menú:',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Desayuno',
                          onPress: () => setTipoPlatoFiltro('platos-desayuno'),
                        },
                        {
                          text: 'Carta Normal',
                          onPress: () => setTipoPlatoFiltro('plato-carta normal'),
                        },
                      ]
                    );
                  }}
                >
                  <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
                  <Text style={styles.addPlatoButtonText}> Agregar Plato</Text>
                </TouchableOpacity>
                
                {tipoPlatoFiltro && (
                  <>
                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          backgroundColor: themeColors.colors?.card || themeColors.card || '#F9FAFB',
                          borderColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
                          color: themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937',
                        }
                      ]}
                      placeholder="Buscar plato..."
                      placeholderTextColor={themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280'}
                      value={searchPlato}
                      onChangeText={setSearchPlato}
                    />
                    <ScrollView horizontal style={styles.categoriasContainer} showsHorizontalScrollIndicator={false}>
                      <TouchableOpacity
                        style={[
                          styles.categoriaChip, 
                          {
                            backgroundColor: !categoriaFiltro 
                              ? '#3B82F6' // Azul intenso en ambos modos
                              : (themeColors.colors?.card || themeColors.card || (isDark ? '#1F2937' : '#F9FAFB')),
                            borderColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
                          },
                          !categoriaFiltro && styles.categoriaChipActive
                        ]}
                        onPress={() => setCategoriaFiltro(null)}
                      >
                        <Text style={[
                          styles.categoriaChipText, 
                          {
                            color: !categoriaFiltro 
                              ? '#FFFFFF'
                              : (themeColors.colors?.text?.primary || themeColors.text?.primary || (isDark ? '#F9FAFB' : '#1F2937'))
                          }
                        ]}>
                          Todos
                        </Text>
                      </TouchableOpacity>
                      {categorias.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoriaChip, 
                            {
                              backgroundColor: categoriaFiltro === cat
                                ? '#3B82F6' // Azul intenso en ambos modos
                                : (themeColors.colors?.card || themeColors.card || (isDark ? '#1F2937' : '#F9FAFB')),
                              borderColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
                            },
                            categoriaFiltro === cat && styles.categoriaChipActive
                          ]}
                          onPress={() => setCategoriaFiltro(cat)}
                        >
                          <Text style={[
                            styles.categoriaChipText,
                            {
                              color: categoriaFiltro === cat
                                ? '#FFFFFF'
                                : (themeColors.colors?.text?.primary || themeColors.text?.primary || (isDark ? '#F9FAFB' : '#1F2937'))
                            }
                          ]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <ScrollView style={styles.platosScrollView} nestedScrollEnabled={true}>
                      {platosFiltrados.length === 0 ? (
                        <Text style={[
                          styles.emptyPlatosText,
                          { color: themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280' }
                        ]}>
                          {tipoPlatoFiltro 
                            ? `No hay platos disponibles en ${tipoPlatoFiltro === 'platos-desayuno' ? 'Desayuno' : 'Carta Normal'}`
                            : 'No hay platos disponibles'}
                        </Text>
                      ) : (
                        platosFiltrados.map((plato) => {
                          const cantidadEnComanda = platosEditados.find(
                            p => (p.plato === plato._id || p.plato?.toString() === plato._id?.toString())
                          )?.cantidad || 0;
                          
                          return (
                            <TouchableOpacity
                              key={plato._id}
                              style={[
                                styles.platoSelectItem,
                                {
                                  backgroundColor: themeColors.colors?.card || themeColors.card || (isDark ? '#1F2937' : '#F9FAFB'),
                                  borderColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
                                }
                              ]}
                              onPress={() => handleAgregarPlato(plato)}
                            >
                              <View style={styles.platoSelectInfo}>
                                <Text style={[
                                  styles.platoSelectNombre,
                                  { color: themeColors.colors?.text?.primary || themeColors.text?.primary || (isDark ? '#F9FAFB' : '#1F2937') }
                                ]}>
                                  {plato.nombre}
                                </Text>
                                <Text style={[
                                  styles.platoSelectPrecio,
                                  { color: '#059669' }
                                ]}>
                                  S/. {plato.precio.toFixed(2)}
                                </Text>
                              </View>
                              {cantidadEnComanda > 0 && (
                                <View style={[
                                  styles.cantidadBadge,
                                  { backgroundColor: '#3B82F6' } // Azul intenso en ambos modos
                                ]}>
                                  <Text style={[styles.cantidadBadgeText, { color: '#FFFFFF' }]}>
                                    x{cantidadEnComanda}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </>
                )}
              </View>
              
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                  Observaciones:
                </Text>
                <TextInput
                  style={[
                    {
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      fontSize: 14,
                      minHeight: 80,
                      textAlignVertical: 'top',
                      backgroundColor: isDark ? '#000000' : '#FFFFFF', // Negro puro en modo oscuro
                      borderColor: isDark ? '#4B5563' : '#D1D5DB', // Gris medio en modo oscuro para visibilidad
                      color: isDark ? '#FFFFFF' : '#111827', // Blanco en modo oscuro, gris muy oscuro en claro
                    }
                  ]}
                  placeholder="Sin observaciones..."
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'} // Gris medio claro en oscuro, gris medio en claro
                  value={observacionesEditadas}
                  onChangeText={setObservacionesEditadas}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.editSection}>
                <Text style={[styles.totalText, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
                  TOTAL: S/. {calcularTotalEdicion().toFixed(2)}
                </Text>
              </View>
            </ScrollView>
            
            <View style={[
              styles.modalButtons,
              {
                borderTopColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
              }
            ]}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: '#059669', // Verde intenso en ambos modos
                  }
                ]}
                onPress={handleGuardarEdicion}
              >
                <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
                <Text style={[styles.saveButtonText, { color: '#FFFFFF', marginLeft: 8 }]}>Guardar Cambios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
                  }
                ]}
                onPress={() => {
                  setModalEditarVisible(false);
                  setComandaEditando(null);
                  setTipoPlatoFiltro(null);
                  setSearchPlato('');
                  setCategoriaFiltro(null);
                  setPlatosEditados([]);
                  setObservacionesEditadas('');
                }}
              >
                <Text style={[
                  styles.cancelButtonText,
                  { color: isDark ? '#F9FAFB' : '#1F2937' }
                ]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal Eliminar Comanda */}
      <Modal
        visible={modalEliminarComandaVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalEliminarComandaVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: isDark ? '#000000' : (themeColors.colors?.surface || themeColors.colors?.card || themeColors.card || '#FFFFFF'), // Negro puro en modo oscuro
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.5 : 0.25,
              shadowRadius: 8,
              elevation: 10,
            }
          ]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937') }]}>
              Eliminar Comanda
            </Text>
            <Text style={[
              styles.modalSubtitle, 
              { 
                color: isDark ? '#FCA5A5' : '#DC2626',
                fontWeight: '500',
                marginBottom: 16,
              }
            ]}>
              Esta acción eliminará la comanda #{comandaPrincipal.comandaNumber || 'N/A'} permanentemente.
            </Text>
            
            {/* Advertencia si hay platos en recoger */}
            {hayPlatosEnRecogerComanda && (
              <View style={{
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                backgroundColor: isDark ? 'rgba(251, 146, 60, 0.15)' : '#FEF3C7',
                borderWidth: 1,
                borderColor: isDark ? '#FB923C' : '#F59E0B',
              }}>
                <Text style={{
                  color: isDark ? '#FED7AA' : '#92400E',
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  ⚠️ Algunos platos ya están preparados en cocina y se desperdiciarán
                </Text>
              </View>
            )}
            
            {/* Lista de platos a eliminar */}
            {platosEliminablesComanda.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[
                  styles.editLabel,
                  { 
                    color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937'),
                    marginBottom: 12,
                  }
                ]}>
                  ⚠️ Platos a eliminar:
                </Text>
                <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
                  {platosEliminablesComanda.map((plato, index) => {
                    const estilos = obtenerEstilosPorEstado(plato.estado);
                    return (
                      <View
                        key={`${plato.comandaId}-${plato.platoId}-${index}`}
                        style={[
                          styles.modalPlatoItem,
                          {
                            // Fondo SATURADO directo según estado
                            backgroundColor: isDark
                              ? (plato.estado === 'pedido' 
                                  ? '#1E40AF' // Azul saturado
                                  : plato.estado === 'recoger'
                                  ? '#D97706' // Naranja saturado
                                  : plato.estado === 'entregado'
                                  ? '#047857' // Verde saturado
                                  : '#4B5563') // Gris para otros estados
                              : estilos.fondo, // En modo claro usar color pastel
                            borderColor: isDark
                              ? (plato.estado === 'pedido' ? '#3B82F6' : 
                                 plato.estado === 'recoger' ? '#F59E0B' : 
                                 plato.estado === 'entregado' ? '#10B981' : '#6B7280')
                              : estilos.borde,
                            borderWidth: 1,
                            marginBottom: 8,
                          }
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={[
                              styles.modalPlatoNombre,
                              { 
                                color: isDark ? '#FFFFFF' : estilos.textColor || '#1F2937', // Blanco en modo oscuro
                                flex: 1,
                              }
                            ]}>
                              {plato.plato?.nombre || 'Plato desconocido'}
                            </Text>
                            <View style={[
                              styles.badgeEstado,
                              {
                                backgroundColor: isDark
                                  ? (plato.estado === 'pedido' ? '#60A5FA' :
                                     plato.estado === 'recoger' ? '#FBBF24' :
                                     plato.estado === 'entregado' ? '#34D399' :
                                     '#9CA3AF')
                                  : estilos.badgeFondo,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                marginLeft: 8,
                              }
                            ]}>
                              <Text style={[
                                styles.badgeEstadoText,
                                { 
                                  color: isDark
                                    ? (plato.estado === 'pedido' ? '#1E3A8A' :
                                       plato.estado === 'recoger' ? '#78350F' :
                                       plato.estado === 'entregado' ? '#064E3B' :
                                       '#1F2937')
                                    : estilos.badgeTexto
                                }
                              ]}>
                                {estilos.textoEstado}
                              </Text>
                            </View>
                          </View>
                          <Text style={[
                            styles.modalPlatoCantidad,
                            { 
                              color: '#059669', // Verde intenso en ambos modos
                            }
                          ]}>
                            x{plato.cantidad} - S/. {(plato.precio * plato.cantidad).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                
                {/* Totales */}
                <View style={{
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: themeColors.colors?.border || themeColors.border || '#E5E7EB',
                  marginTop: 8,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{
                      color: isDark ? '#D1D5DB' : (themeColors.colors?.text?.secondary || themeColors.text?.secondary || '#6B7280'),
                      fontSize: 14,
                    }}>
                      Subtotal:
                    </Text>
                    <Text style={{
                      color: isDark ? '#FCA5A5' : '#DC2626',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      S/. {platosEliminablesComanda.reduce((sum, p) => sum + (p.precio * p.cantidad), 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{
                      color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937'),
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}>
                      TOTAL GENERAL:
                    </Text>
                    <Text style={{
                      color: isDark ? '#FCA5A5' : '#DC2626',
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}>
                      S/. {platosEliminablesComanda.reduce((sum, p) => sum + (p.precio * p.cantidad), 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            <Text style={[
              styles.editLabel,
              { 
                color: isDark ? '#FFFFFF' : (themeColors.colors?.text?.primary || themeColors.text?.primary || '#1F2937'),
                marginBottom: 8,
                fontSize: 14,
              }
            ]}>
              Motivo de eliminación de todas las comandas: *
            </Text>
            <TextInput
              style={[
                {
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  textAlignVertical: 'top',
                  marginBottom: 16,
                  minHeight: 80,
                  backgroundColor: isDark ? '#000000' : '#FFFFFF', // Negro puro en modo oscuro
                  borderColor: isDark ? '#4B5563' : '#D1D5DB', // Gris medio en modo oscuro para visibilidad
                  color: isDark ? '#FFFFFF' : '#111827', // Blanco en modo oscuro, gris muy oscuro en claro
                }
              ]}
              placeholder="Ej: Cliente canceló todo el pedido, error en todas las comandas, cambio de mesa..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'} // Gris medio claro en oscuro, gris medio en claro
              value={motivoEliminacionComanda}
              onChangeText={setMotivoEliminacionComanda}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonCancel,
                  {
                    backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
                  }
                ]}
                onPress={() => {
                  setModalEliminarComandaVisible(false);
                  setMotivoEliminacionComanda('');
                  setPlatosEliminablesComanda([]);
                  setHayPlatosEnRecogerComanda(false);
                }}
              >
                <Text style={[
                  styles.modalButtonText,
                  { color: isDark ? '#F9FAFB' : '#374151' }
                ]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonConfirm,
                  {
                    backgroundColor: '#EF4444', // Rojo intenso en ambos modos
                  }
                ]}
                onPress={confirmarEliminacionComanda}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm, { color: '#FFFFFF' }]}>
                  Eliminar Comanda
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  twoColumnLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftColumn: {
    width: '70%',
    borderRightWidth: 1,
  },
  rightColumn: {
    width: '30%',
  },
  platosList: {
    flex: 1,
  },
  platosListContent: {
    paddingBottom: 0,
  },
  optionsScrollView: {
    flex: 1,
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  totalesContainer: {
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  totalRowFinal: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
  },
  totalLabel: {
    fontSize: 16,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonEdit: {
    // Se aplica dinámicamente según isDark
  },
  actionButtonDelete: {
    // Se aplica dinámicamente según isDark
  },
  actionButtonAdd: {
    // Se aplica dinámicamente según isDark
  },
  actionButtonPay: {
    // Se aplica dinámicamente según isDark
  },
  actionButtonCancel: {
    // Se aplica dinámicamente según isDark
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalPlatosList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  modalPlatoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    gap: 12,
  },
  modalPlatoItemSelected: {
    // Se aplica dinámicamente según isDark
  },
  modalPlatoInfo: {
    flex: 1,
  },
  modalPlatoNombre: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  modalPlatoCantidad: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalPlatoAdvertencia: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '500',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 16,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    // Se aplica dinámicamente según isDark
  },
  modalButtonConfirm: {
    // Se aplica dinámicamente según isDark
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    // Se aplica dinámicamente
  },
  // Estilos para modal de edición
  modalContentEditar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  leyendaColores: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  leyendaText: {
    fontSize: 11,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  editSection: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  editLabelNoEditable: {
    color: '#10B981',
  },
  platoEditItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  platoEditNombreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginRight: 8,
  },
  badgeEstado: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeEstadoText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  platoEditItemNoEditable: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  platoEditInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  platoEditNombre: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  platoEditNombreNoEditable: {
    color: '#6B7280',
  },
  platoEditPrecio: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  platoEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cantidadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantidadButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cantidadText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  addPlatoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981', // Verde
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  addPlatoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    fontSize: 14,
  },
  categoriasContainer: {
    marginBottom: 12,
    maxHeight: 50,
  },
  categoriaChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoriaChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoriaChipTextActive: {
    color: '#fff',
  },
  platosScrollView: {
    maxHeight: 200,
    marginBottom: 12,
  },
  platoSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  platoSelectInfo: {
    flex: 1,
  },
  platoSelectNombre: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  platoSelectPrecio: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  cantidadBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cantidadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  observacionesInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyPlatosText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    padding: 16,
  },
});

export default ComandaDetalleScreen;
