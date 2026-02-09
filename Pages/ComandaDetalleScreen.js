import React, { useState, useEffect, useCallback } from 'react';
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

// Componentes
import BadgeEstadoPlato from '../Components/BadgeEstadoPlato';
import FilaPlatoCompacta from '../Components/FilaPlatoCompacta';
import HeaderComandaDetalle from '../Components/HeaderComandaDetalle';

// Contextos y configuración
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { themeLight } from '../constants/theme';
import { COMANDASEARCH_API_GET, COMANDA_API, DISHES_API, apiConfig } from '../apiConfig';
import { separarPlatosEditables, filtrarPlatosPorEstado, detectarPlatosPreparados, validarEliminacionCompleta } from '../utils/comandaHelpers';

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
  // Recibir parámetros de navegación
  const { mesa, comandas: comandasIniciales, onRefresh } = route.params || {};
  
  // Hooks
  const { theme } = useTheme();
  const themeColors = theme || themeLight;
  const { socket, connected } = useSocket();
  
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
  
  // Preparar todos los platos ordenados por prioridad
  const prepararPlatosOrdenados = useCallback(() => {
    const platos = [];
    
    comandas.forEach(comanda => {
      if (!comanda.platos || !Array.isArray(comanda.platos)) return;
      
      comanda.platos.forEach((platoItem, index) => {
        const cantidad = comanda.cantidades?.[index] || 1;
        const estado = platoItem.estado || 'pedido';
        const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
        
        const platoObj = {
          platoId: platoItem.platoId || platoItem.plato?._id || platoItem.plato,
          plato: platoItem.plato || { nombre: 'Plato desconocido', precio: 0 },
          cantidad: cantidad,
          estado: estadoNormalizado,
          precio: platoItem.plato?.precio || 0,
          comandaId: comanda._id,
          comandaNumber: comanda.comandaNumber,
          eliminado: platoItem.eliminado || false,
          index: index // Índice en la comanda original
        };
        
        if (!platoObj.eliminado) {
          platos.push(platoObj);
        }
      });
    });
    
    // Ordenar: recoger → pedido → entregado → pagado
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
  
  // Refrescar comandas desde el servidor
  const refrescarComandas = async () => {
    try {
      setRefreshing(true);
      
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
      
      const response = await axios.get(comandasURL, { timeout: 10000 });
      const todasLasComandas = response.data || [];
      
      // Filtrar comandas de esta mesa
      const comandasMesa = todasLasComandas.filter(c => {
        const mesaId = c.mesas?._id || c.mesas;
        return mesaId === mesa._id || c.mesas?.nummesa === mesa.nummesa;
      });
      
      setComandasState(comandasMesa);
      
      // Ejecutar callback si existe
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error al refrescar comandas:', error);
      Alert.alert('Error', 'No se pudieron actualizar las comandas.');
    } finally {
      setRefreshing(false);
    }
  };
  
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
  
  // Integración WebSocket
  useEffect(() => {
    if (socket && connected && mesa?._id) {
      socket.emit('join-mesa', mesa._id);
      
      socket.on('plato-actualizado', (data) => {
        const esNuestraComanda = comandas.some(c => c._id === data.comandaId);
        if (esNuestraComanda) {
          refrescarComandas();
          if (data.estadoNuevo === 'recoger') {
            Alert.alert(
              '🍽️ Plato Listo',
              `${data.platoNombre || 'Un plato'} está listo para recoger de cocina.`,
              [{ text: 'Entendido' }]
            );
          }
        }
      });
      
      socket.on('plato-entregado', () => refrescarComandas());
      socket.on('comanda-actualizada', () => refrescarComandas());
      
      return () => {
        socket.emit('leave-mesa', mesa._id);
        socket.off('plato-actualizado');
        socket.off('plato-entregado');
        socket.off('comanda-actualizada');
      };
    }
  }, [socket, connected, mesa?._id, comandas]);
  
  useFocusEffect(
    useCallback(() => {
      refrescarComandas();
    }, [])
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
  const puedeEliminarPlatos = platosEnPedido.length > 0 || platosEnRecoger.length > 0;
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
  
  // Filtrar platos para el modal de edición
  const platosFiltrados = platos.filter(p => {
    if (!tipoPlatoFiltro) return false;
    if (p.tipo !== tipoPlatoFiltro) return false;
    if (searchPlato && !p.nombre.toLowerCase().includes(searchPlato.toLowerCase())) return false;
    if (categoriaFiltro && p.categoria !== categoriaFiltro) return false;
    return true;
  });
  
  const categorias = [...new Set(platos.filter(p => p.tipo === tipoPlatoFiltro).map(p => p.categoria))];
  
  // Guardar edición
  const handleGuardarEdicion = async () => {
    if (!comandaEditando || platosEditados.length === 0) {
      Alert.alert('Error', 'Debe haber al menos un plato en la comanda');
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
    // Usar función de utilidad para separar platos
    const { editables, noEditables } = separarPlatosEditables(comandas);
    
    if (editables.length === 0) {
      Alert.alert(
        'Sin Platos Editables',
        'No hay platos que puedan editarse. Los platos entregados no pueden modificarse.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    await obtenerPlatos();
    
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
    const platosEliminables = filtrarPlatosPorEstado(comandas, ['pedido', 'recoger']);
    
    if (platosEliminables.length === 0) {
      Alert.alert(
        'Sin Platos Eliminables',
        'No hay platos que puedan eliminarse. Los platos entregados no pueden modificarse.'
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
    
    try {
      setLoading(true);
      
      // Obtener índices de platos a eliminar
      const indicesAEliminar = platosSeleccionadosEliminar.map(p => p.index);
      const comandaId = comandas[0]._id;
      
      const endpoint = apiConfig.isConfigured
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/eliminar-platos`
        : `${COMANDA_API}/${comandaId}/eliminar-platos`;
      
      await axios.put(endpoint, {
        platosAEliminar: indicesAEliminar,
        motivo: motivoEliminacion.trim(),
        mozoId: userInfo?._id
      });
      
      await refrescarComandas();
      Alert.alert('✓ Platos Eliminados', 'Los platos fueron eliminados correctamente.');
      setModalEliminarVisible(false);
      setMotivoEliminacion('');
      setPlatosSeleccionadosEliminar([]);
      
    } catch (error) {
      console.error('Error al eliminar platos:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      Alert.alert('Error', `No se pudieron eliminar los platos: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };
  
  const confirmarEliminacionPlatosOriginal = async () => {
    if (platosSeleccionadosEliminar.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un plato para eliminar.');
      return;
    }
    
    if (platosSeleccionadosEliminar.length >= todosLosPlatos.length) {
      Alert.alert('Error', 'No puedes eliminar todos los platos. Debe quedar al menos uno.');
      return;
    }
    
    if (!motivoEliminacion || motivoEliminacion.trim() === '') {
      Alert.alert('Error', 'Debes indicar un motivo para la eliminación.');
      return;
    }
    
    const hayPlatosPreparados = platosSeleccionadosEliminar.some(p => p.estado === 'recoger');
    
    Alert.alert(
      'Confirmar Eliminación',
      hayPlatosPreparados
        ? '⚠️ Algunos platos ya están preparados en cocina. ¿Estás seguro de eliminarlos?'
        : '¿Confirmas la eliminación de los platos seleccionados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
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
                  : `http://192.168.18.11:3000/api/comanda/${comandaId}/eliminar-platos`;
                
                await axios.put(endpoint, {
                  platosAEliminar: indices,
                  motivo: motivoEliminacion,
                  mozoId: userInfo?._id,
                  usuarioId: userInfo?._id
                });
              }
              
              await refrescarComandas();
              Alert.alert('✓ Platos Eliminados', 'Los platos fueron eliminados correctamente.');
              setModalEliminarVisible(false);
              setMotivoEliminacion('');
              setPlatosSeleccionadosEliminar([]);
              
            } catch (error) {
              console.error('Error al eliminar platos:', error);
              const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
              Alert.alert('Error', `No se pudieron eliminar los platos: ${errorMsg}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const handleEliminarComanda = () => {
    if (!puedeEliminarComanda) {
      Alert.alert('Error', 'No se puede eliminar esta comanda.');
      return;
    }
    
    const comandaAEliminar = comandas[0];
    const hayPlatosPreparados = todosLosPlatos.some(p => p.estado === 'recoger');
    const hayPlatosEntregados = todosLosPlatos.some(p => p.estado === 'entregado');
    
    if (hayPlatosEntregados) {
      Alert.alert(
        'No se puede eliminar',
        'Esta comanda tiene platos entregados. No se puede eliminar completamente.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    Alert.alert(
      'Eliminar Comanda',
      hayPlatosPreparados
        ? '⚠️ Hay platos preparados que se desperdiciarán. ¿Estás seguro de eliminar esta comanda?'
        : '¿Estás seguro de eliminar esta comanda?',
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
    
    try {
      setLoading(true);
      
      const comandaId = comandas[0]._id;
      const endpoint = apiConfig.isConfigured
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/eliminar`
        : `${COMANDA_API}/${comandaId}/eliminar`;
      
      await axios.put(endpoint, {
        motivo: motivoEliminacionComanda,
        usuarioId: userInfo?._id
      });
      
      Alert.alert('✓ Comanda Eliminada', 'La comanda fue eliminada correctamente.');
      setModalEliminarComandaVisible(false);
      setMotivoEliminacionComanda('');
      
      // Navegar de regreso
      if (onRefresh) onRefresh();
      navigation.goBack();
      
    } catch (error) {
      console.error('Error al eliminar comanda:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      Alert.alert('Error', `No se pudo eliminar la comanda: ${errorMsg}`);
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
    <View style={[styles.container, { backgroundColor: themeColors.colors.background }]}>
      {/* Header Personalizado */}
      <HeaderComandaDetalle
        mesa={mesa}
        comanda={comandaPrincipal}
        onSync={refrescarComandas}
        navigation={navigation}
      />
      
      {/* Layout de dos columnas */}
      <View style={styles.twoColumnLayout}>
        {/* Columna Izquierda: Tabla de Platos (70%) */}
        <View style={styles.leftColumn}>
          {todosLosPlatos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={themeColors.colors.text.light} />
              <Text style={styles.emptyText}>No hay platos en esta comanda</Text>
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
              <View style={styles.totalesContainer}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>S/. {totales.subtotal}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>IGV (18%):</Text>
                  <Text style={styles.totalValue}>S/. {totales.igv}</Text>
                </View>
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={[styles.totalLabel, styles.totalLabelFinal]}>TOTAL:</Text>
                  <Text style={[styles.totalValue, styles.totalValueFinal]}>S/. {totales.total}</Text>
                </View>
              </View>
            </>
          )}
        </View>
        
        {/* Columna Derecha: Opciones (30%) */}
        <View style={styles.rightColumn}>
          <ScrollView style={styles.optionsScrollView}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonEdit, !puedeEditar && styles.actionButtonDisabled]}
              onPress={handleEditarComanda}
              disabled={!puedeEditar}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Editar Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDelete, !puedeEliminarPlatos && styles.actionButtonDisabled]}
              onPress={handleEliminarPlatos}
              disabled={!puedeEliminarPlatos}
            >
              <MaterialCommunityIcons name="delete" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Eliminar Platos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDelete, !puedeEliminarComanda && styles.actionButtonDisabled]}
              onPress={handleEliminarComanda}
              disabled={!puedeEliminarComanda}
            >
              <MaterialCommunityIcons name="delete-forever" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Eliminar Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonAdd, !puedeNuevaComanda && styles.actionButtonDisabled]}
              onPress={handleNuevaComanda}
              disabled={!puedeNuevaComanda}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Nueva Comanda</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPay, !puedePagar && styles.actionButtonDisabled]}
              onPress={handlePagar}
              disabled={!puedePagar}
            >
              <MaterialCommunityIcons name="cash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Pagar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonCancel]}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eliminar Platos</Text>
            <Text style={styles.modalSubtitle}>Selecciona los platos a eliminar:</Text>
            
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
                      seleccionado && styles.modalPlatoItemSelected,
                      { backgroundColor: estilos.fondo, borderColor: estilos.borde }
                    ]}
                    onPress={() => toggleSeleccionarPlatoEliminar(plato)}
                  >
                    <MaterialCommunityIcons
                      name={seleccionado ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={seleccionado ? '#EF4444' : '#9CA3AF'}
                    />
                    <View style={styles.modalPlatoInfo}>
                      <Text style={styles.modalPlatoNombre}>{plato.plato.nombre}</Text>
                      <Text style={styles.modalPlatoCantidad}>x{plato.cantidad} - S/. {(plato.precio * plato.cantidad).toFixed(2)}</Text>
                      {plato.estado === 'recoger' && (
                        <Text style={styles.modalPlatoAdvertencia}>⚠️ Plato preparado</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo de eliminación (obligatorio)"
              value={motivoEliminacion}
              onChangeText={setMotivoEliminacion}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setModalEliminarVisible(false);
                  setMotivoEliminacion('');
                  setPlatosSeleccionadosEliminar([]);
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmarEliminacionPlatos}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentEditar}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Editar Comanda #{comandaEditando?.comandaNumber || 'N/A'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEditarVisible(false);
                setComandaEditando(null);
                setTipoPlatoFiltro(null);
                setSearchPlato('');
                setCategoriaFiltro(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Mesa: {mesa?.nummesa || 'N/A'}</Text>
              </View>
              
              {/* Platos Editables */}
              {platosEditables.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>Platos Editables:</Text>
                  {platosEditados.map((plato, index) => {
                    // Verificar si este plato es editable
                    const esEditable = platosEditables.some(e => {
                      const ePlatoId = e.plato?.toString() || e.platoId?.toString();
                      const pPlatoId = plato.plato?.toString() || plato.platoId?.toString();
                      return ePlatoId === pPlatoId;
                    });
                    
                    if (!esEditable) return null;
                    
                    return (
                      <View key={index} style={styles.platoEditItem}>
                        <View style={styles.platoEditInfo}>
                          <Text style={styles.platoEditNombre}>{plato.nombre}</Text>
                          <Text style={styles.platoEditPrecio}>
                            S/. {((plato.precio || 0) * (plato.cantidad || 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.platoEditActions}>
                          <TouchableOpacity
                            style={styles.cantidadButton}
                            onPress={() => handleCambiarCantidad(index, -1)}
                          >
                            <Text style={styles.cantidadButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.cantidadText}>{plato.cantidad || 1}</Text>
                          <TouchableOpacity
                            style={styles.cantidadButton}
                            onPress={() => handleCambiarCantidad(index, 1)}
                          >
                            <Text style={styles.cantidadButtonText}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoverPlato(index)}
                          >
                            <MaterialCommunityIcons name="delete" size={20} color={themeColors.colors.primary} />
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
                  <Text style={[styles.editLabel, styles.editLabelNoEditable]}>
                    ✓ Platos entregados (no editables):
                  </Text>
                  {platosNoEditables.map((plato, index) => (
                    <View key={index} style={[styles.platoEditItem, styles.platoEditItemNoEditable]}>
                      <View style={styles.platoEditInfo}>
                        <Text style={[styles.platoEditNombre, styles.platoEditNombreNoEditable]}>
                          {plato.nombre}
                        </Text>
                        <Text style={styles.platoEditPrecio}>
                          S/. {((plato.precio || 0) * (plato.cantidad || 1)).toFixed(2)}
                        </Text>
                      </View>
                      <BadgeEstadoPlato estado={plato.estado} />
                    </View>
                  ))}
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
                          onPress: () => setTipoPlatoFiltro('carta-normal'),
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
                      style={styles.searchInput}
                      placeholder="Buscar plato..."
                      placeholderTextColor={themeColors.colors.text.light}
                      value={searchPlato}
                      onChangeText={setSearchPlato}
                    />
                    <ScrollView horizontal style={styles.categoriasContainer} showsHorizontalScrollIndicator={false}>
                      <TouchableOpacity
                        style={[styles.categoriaChip, !categoriaFiltro && styles.categoriaChipActive]}
                        onPress={() => setCategoriaFiltro(null)}
                      >
                        <Text style={[styles.categoriaChipText, !categoriaFiltro && styles.categoriaChipTextActive]}>
                          Todos
                        </Text>
                      </TouchableOpacity>
                      {categorias.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.categoriaChip, categoriaFiltro === cat && styles.categoriaChipActive]}
                          onPress={() => setCategoriaFiltro(cat)}
                        >
                          <Text style={[styles.categoriaChipText, categoriaFiltro === cat && styles.categoriaChipTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <ScrollView style={styles.platosScrollView} nestedScrollEnabled={true}>
                      {platosFiltrados.length === 0 ? (
                        <Text style={styles.emptyPlatosText}>No hay platos disponibles</Text>
                      ) : (
                        platosFiltrados.map((plato) => {
                          const cantidadEnComanda = platosEditados.find(
                            p => (p.plato === plato._id || p.plato?.toString() === plato._id?.toString())
                          )?.cantidad || 0;
                          
                          return (
                            <TouchableOpacity
                              key={plato._id}
                              style={styles.platoSelectItem}
                              onPress={() => handleAgregarPlato(plato)}
                            >
                              <View style={styles.platoSelectInfo}>
                                <Text style={styles.platoSelectNombre}>{plato.nombre}</Text>
                                <Text style={styles.platoSelectPrecio}>S/. {plato.precio.toFixed(2)}</Text>
                              </View>
                              {cantidadEnComanda > 0 && (
                                <View style={styles.cantidadBadge}>
                                  <Text style={styles.cantidadBadgeText}>x{cantidadEnComanda}</Text>
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
                <Text style={styles.editLabel}>Observaciones:</Text>
                <TextInput
                  style={styles.observacionesInput}
                  placeholder="Sin observaciones..."
                  placeholderTextColor={themeColors.colors.text.light}
                  value={observacionesEditadas}
                  onChangeText={setObservacionesEditadas}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.editSection}>
                <Text style={styles.totalText}>TOTAL: S/. {calcularTotalEdicion().toFixed(2)}</Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleGuardarEdicion}
              >
                <Text style={styles.saveButtonText}>💾 Guardar Cambios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
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
                <Text style={styles.cancelButtonText}>Cancelar</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eliminar Comanda</Text>
            <Text style={styles.modalSubtitle}>
              Esta acción eliminará la comanda #{comandaPrincipal.comandaNumber || 'N/A'} permanentemente.
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo de eliminación (obligatorio)"
              value={motivoEliminacionComanda}
              onChangeText={setMotivoEliminacionComanda}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setModalEliminarComandaVisible(false);
                  setMotivoEliminacionComanda('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmarEliminacionComanda}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
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
    borderRightColor: '#E5E7EB',
  },
  rightColumn: {
    width: '30%',
    backgroundColor: '#F9FAFB',
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
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  totalesContainer: {
    margin: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  totalRowFinal: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
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
    backgroundColor: '#3B82F6',
  },
  actionButtonDelete: {
    backgroundColor: '#EF4444',
  },
  actionButtonAdd: {
    backgroundColor: '#10B981',
  },
  actionButtonPay: {
    backgroundColor: '#059669',
  },
  actionButtonCancel: {
    backgroundColor: '#6B7280',
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
    backgroundColor: '#fff',
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
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
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
    backgroundColor: '#E5E7EB',
  },
  modalButtonConfirm: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalButtonTextConfirm: {
    color: '#fff',
  },
  // Estilos para modal de edición
  modalContentEditar: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
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
    color: '#1F2937',
  },
  editLabelNoEditable: {
    color: '#10B981',
  },
  platoEditItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#1F2937',
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
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantidadButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cantidadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  addPlatoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#1F2937',
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
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#1F2937',
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
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#1F2937',
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
