import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "../../../config/axiosConfig";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight, textIconos } from "../../../constants/theme";
import { colors } from "../../../constants/colors";
import { COMANDA_API, MESAS_API_UPDATE, COMANDASEARCH_API_GET, BOUCHER_API, CLIENTES_API, SELECTABLE_API_GET, DISHES_API, apiConfig } from "../../../apiConfig";
import ModalClientes from "../../../Components/ModalClientes";
import ModalRegistrarPropina from "./ModalRegistrarPropina";
import ModalPagoExitoso from "./ModalPagoExitoso";
import IconoBoton from "../../../Components/IconoBoton";
import { useWindowDimensions } from "react-native";
import { useSocket } from "../../../context/SocketContext";
import logger from "../../../utils/logger";
import configuracionService from "../../../services/configuracionService";
import { filtrarComandasActivas } from "../../../utils/comandaHelpers";
import { mostrarOpcionesBoucher } from "../../../services/boucherPrint";
import {
  listarPlatosPagables,
  listarPlatosEnPantallaPago,
  buildPlatosSeleccionadosPayload,
  parseBoucherResponse,
  calcularSubtotalSeleccion,
  calcularTotalesPreview,
  toggleSeleccionarTodos,
} from "../../../utils/pagoParcialHelpers";
// Animaciones Premium 60fps
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/** Comandas listas para cobrar (misma mesa, no pagada, platos no anulados). */
function filtrarComandasPagablesParaPago(comandasBackend, mesaIdStr, mesaNummesa) {
  const idMesa = mesaIdStr != null ? String(mesaIdStr) : '';
  return comandasBackend.filter((c) => {
    const comandaMesaId = c.mesas?._id ?? c.mesas;
    const coincideMesa =
      (idMesa && comandaMesaId != null && String(comandaMesaId) === idMesa) ||
      (mesaNummesa != null &&
        c.mesas?.nummesa != null &&
        String(c.mesas.nummesa) === String(mesaNummesa));
    const noEliminada = c.eliminada !== true;
    const noPagada =
      c.status?.toLowerCase() !== 'pagado' && c.status?.toLowerCase() !== 'completado';
    const tienePlatos = c.platos && c.platos.length > 0;
    const platosActivos =
      c.platos?.filter((p) => p.eliminado !== true && p.anulado !== true) || [];
    return (
      coincideMesa &&
      noEliminada &&
      noPagada &&
      tienePlatos &&
      platosActivos.length > 0
    );
  });
}

/** Comandas del ciclo actual con platos entregados + ya pagados (pagos parciales). */
async function fetchComandasCicloParaPagos(mesaId) {
  if (!mesaId) return [];
  const comandaBase = apiConfig.isConfigured
    ? apiConfig.getEndpoint('/comanda')
    : COMANDASEARCH_API_GET;
  const urls = [
    `${comandaBase}/mesa/${mesaId}/para-pagos`,
    `${comandaBase}/comandas-para-pagar/${mesaId}?incluirPagados=1`,
  ];
  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });
      if (res.status === 404) continue;
      if (res.status >= 400) break;
      if (res.data?.success && Array.isArray(res.data.comandas)) {
        return res.data.comandas;
      }
      if (Array.isArray(res.data?.comandas)) {
        return res.data.comandas;
      }
    } catch (e) {
      if (e.response?.status === 404) continue;
      if (__DEV__) console.warn('[PAGOS] comandas ciclo pago:', url, e?.message);
    }
  }
  return [];
}

/** Fuente alineada con ComandaDetalle: ciclo actual + fallback por fecha. */
async function fetchComandasBackendParaMesa(mesaId, mesaNummesa) {
  const mesaIdStr = mesaId != null ? String(mesaId) : '';
  let comandasBackend = await fetchComandasCicloParaPagos(mesaIdStr);
  if (comandasBackend.length > 0) {
    return comandasBackend;
  }

  const comandaBase = apiConfig.isConfigured
    ? apiConfig.getEndpoint('/comanda')
    : COMANDASEARCH_API_GET;

  if (mesaIdStr) {
    try {
      const resActivas = await axios.get(`${comandaBase}/mesa/${mesaIdStr}/activas`, {
        timeout: 10000,
      });
      if (resActivas.data?.success && Array.isArray(resActivas.data.comandas)) {
        comandasBackend = resActivas.data.comandas;
      }
    } catch (e) {
      if (__DEV__) console.warn('[PAGOS] GET /mesa/activas:', e?.message);
    }
  }

  if (comandasBackend.length === 0) {
    const currentDate = moment().tz('America/Lima').format('YYYY-MM-DD');
    const res = await axios.get(`${comandaBase}/fecha/${currentDate}`, { timeout: 10000 });
    const todas = Array.isArray(res.data) ? res.data : res.data?.comandas || [];
    comandasBackend = todas.filter((c) => {
      const mid = c.mesas?._id ?? c.mesas;
      const coincideId = mesaIdStr && mid != null && String(mid) === mesaIdStr;
      const coincideNum =
        mesaNummesa != null &&
        c.mesas?.nummesa != null &&
        String(c.mesas.nummesa) === String(mesaNummesa);
      const noPagada =
        c.status?.toLowerCase() !== 'pagado' && c.status?.toLowerCase() !== 'completado';
      return (coincideId || coincideNum) && noPagada;
    });
  }

  return filtrarComandasActivas(comandasBackend);
}

/** Snapshot para Inicio tras pago: incluye etiqueta de mesa y grupo (evita tarjeta verde sin nombre). */
function buildMesaPagadaNavPayload(mesaObj) {
  if (!mesaObj?._id) return undefined;
  return {
    _id: mesaObj._id,
    nummesa: mesaObj.nummesa,
    nombre: mesaObj.nombre,
    nombreCombinado: mesaObj.nombreCombinado,
    area: mesaObj.area,
    mesasUnidas: mesaObj.mesasUnidas,
    esMesaPrincipal: mesaObj.esMesaPrincipal,
    mesaPrincipalId: mesaObj.mesaPrincipalId,
    estado: "pagado",
  };
}

// Componente de Overlay de Carga Animado
const AnimatedOverlay = ({ mensaje }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const rotateAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(1);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    // Fade in inicial
    fadeAnim.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });

    // Rotación continua usando withRepeat
    // Iniciar desde 0 y rotar hasta 360, luego repetir desde 0
    rotateAnim.value = 0;
    rotateAnim.value = withRepeat(
      withTiming(360, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1, // Repetir infinitamente
      false // No revertir, volver a empezar desde 0
    );

    // Pulso continuo usando withRepeat
    pulseAnim.value = 1;
    pulseAnim.value = withRepeat(
      withTiming(1.2, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Repetir infinitamente
      true // Revertir (hace el efecto de pulso: 1 -> 1.2 -> 1 -> 1.2...)
    );

    // Cleanup: resetear valores cuando el componente se desmonte
    return () => {
      rotateAnim.value = 0;
      pulseAnim.value = 1;
      fadeAnim.value = 0;
    };
  }, []);

  const rotateStyle = useAnimatedStyle(() => {
    // Asegurar que el valor esté en el rango 0-360
    const rotation = rotateAnim.value % 360;
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const overlayStyles = {
    overlayContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    },
    overlayContent: {
      backgroundColor: theme.colors?.surface || '#FFFFFF',
      borderRadius: 20,
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 280,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    overlayText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors?.text?.primary || '#333333',
      textAlign: 'center',
      marginBottom: 8,
    },
    overlaySubtext: {
      fontSize: 14,
      color: theme.colors?.text?.secondary || '#666666',
      textAlign: 'center',
    },
  };

  return (
    <Animated.View style={[overlayStyles.overlayContainer, fadeStyle]}>
      <View style={overlayStyles.overlayContent}>
        <Animated.View style={[pulseStyle, { marginBottom: 20 }]}>
          <Animated.View style={rotateStyle}>
            <MaterialCommunityIcons 
              name="cash-multiple" 
              size={80} 
              color={theme.colors?.primary || "#C41E3A"} 
            />
          </Animated.View>
        </Animated.View>
        <ActivityIndicator 
          size="large" 
          color={theme.colors?.primary || "#C41E3A"} 
          style={{ marginBottom: 16 }}
        />
        <Text style={overlayStyles.overlayText}>{mensaje}</Text>
        <Text style={overlayStyles.overlaySubtext}>Por favor espera...</Text>
      </View>
    </Animated.View>
  );
};

const PagosScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = PagosScreenStyles(theme);
  const { width } = useWindowDimensions();
  const escala = width < 390 ? 0.9 : 1;
  
  // ✅ NUEVO FLUJO: Usar SOLO route.params - Backend = FUENTE ÚNICA DE VERDAD
  // IMPORTANTE: Leer route.params directamente en cada render para Tab Navigator
  const routeParams = route.params || {};
  const { mesa: mesaParam, comandasParaPagar, totalPendiente: _totalPendiente, boucher: boucherFromParams } = routeParams;
  
  const [comandas, setComandas] = useState([]);
  const [mesa, setMesa] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalClienteVisible, setModalClienteVisible] = useState(false);
  const [modalPropinaVisible, setModalPropinaVisible] = useState(false);
  const [modalPagoExitosoVisible, setModalPagoExitosoVisible] = useState(false);
  const [clientePagoExitoso, setClientePagoExitoso] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Procesando pago...");
  const [boucherData, setBoucherData] = useState(boucherFromParams || null);
  const [configMoneda, setConfigMoneda] = useState(null);
  const [plantillaVoucher, setPlantillaVoucher] = useState(null);
  /** Claves de platos seleccionados para pago parcial (ver pagoParcialHelpers). */
  const [platosSeleccionadosPago, setPlatosSeleccionadosPago] = useState([]);
  const [totalRestante, setTotalRestante] = useState(null);
  const [totalAcumuladoPagado, setTotalAcumuladoPagado] = useState(0);
  const [hayPendienteTrasPago, setHayPendienteTrasPago] = useState(false);
  /** Bouchers individuales de cada pago parcial (para imprimir por separado). */
  const [bouchersParciales, setBouchersParciales] = useState([]);
  const pedidoIdCicloRef = React.useRef(null);

  // Obtener socket del contexto
  const { subscribeToEvents, connected: socketConnected } = useSocket();
  
  const cargarPlantillaVoucher = React.useCallback(async () => {
    try {
      const baseURL = apiConfig.isConfigured
        ? apiConfig.getEndpoint('/configuracion/voucher-plantilla')
        : `${apiConfig.getDefaultBaseURL?.() || 'http://localhost:3000/api'}/configuracion/voucher-plantilla`;

      const authHeaders = await configuracionService.getMozoAuthHeaders();
      const response = await axios.get(baseURL, { timeout: 5000, headers: authHeaders });
      if (response.data?.success && response.data.plantilla) {
        setPlantillaVoucher(response.data.plantilla);
        console.log('✅ Plantilla de voucher cargada:', {
          tieneLogo: !!response.data.plantilla.logo,
          nombre: response.data.plantilla.restaurante?.nombre
        });
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar plantilla de voucher, usando valores por defecto:', error.message);
    }
  }, []);

  // Cargar configuración al iniciar
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const config = await configuracionService.obtenerConfigMoneda();
        setConfigMoneda(config);
        console.log('✅ Configuración de moneda cargada en PagosScreen:', {
          igv: config.igvPorcentaje,
          incluyeIGV: config.preciosIncluyenIGV,
          simbolo: config.simboloMoneda
        });
      } catch (error) {
        console.error('Error al cargar configuración de moneda:', error);
      }
    };
    cargarConfiguracion();
    cargarPlantillaVoucher();
  }, [cargarPlantillaVoucher]);

  /** Headers JWT mozos (mismo token que login /admin/mozos/auth). */
  const getHeadersAuth = React.useCallback(async () => {
    return configuracionService.getMozoAuthHeaders();
  }, []);

  /** Boucher unificado: une todos los pagos parciales de la mesa (GET /boucher/by-mesa). */
  const cargarBoucherConsolidadoMesa = React.useCallback(async (mesaId) => {
    if (!mesaId) return null;
    try {
      const headers = await getHeadersAuth();
      if (!headers.Authorization) return null;
      const boucherURL = apiConfig.isConfigured
        ? apiConfig.getEndpoint(`/boucher/by-mesa/${mesaId}`)
        : `${BOUCHER_API}/by-mesa/${mesaId}`;
      const res = await axios.get(boucherURL, { timeout: 10000, headers });
      const consolidado = res.data;
      if (Array.isArray(consolidado?.bouchersParciales)) {
        setBouchersParciales(consolidado.bouchersParciales);
      } else {
        setBouchersParciales([]);
      }
      return consolidado;
    } catch (e) {
      if (__DEV__) console.warn('[PAGOS] No se pudo cargar boucher consolidado:', e?.message);
      return null;
    }
  }, [getHeadersAuth]);

  /** Lista vouchers de pagos parciales del pedido/ciclo actual (reemplaza lista, no acumula). */
  const cargarBouchersParcialesMesa = React.useCallback(async (mesaId, comandaIds = []) => {
    if (!mesaId) return [];
    try {
      const headers = await getHeadersAuth();
      if (!headers.Authorization) return [];
      const ids = (comandaIds || []).filter(Boolean).map((id) => String(id));
      const qs = ids.length ? `?comandaIds=${ids.join(',')}` : '';
      const comandaBase = apiConfig.isConfigured
        ? apiConfig.getEndpoint('/comanda')
        : COMANDASEARCH_API_GET;
      const urls = [
        `${comandaBase}/mesa/${mesaId}/bouchers-parciales${qs}`,
        apiConfig.isConfigured
          ? apiConfig.getEndpoint(`/boucher/mesa/${mesaId}/parciales${qs}`)
          : `${BOUCHER_API}/mesa/${mesaId}/parciales${qs}`,
      ];
      for (const url of urls) {
        try {
          const res = await axios.get(url, {
            timeout: 10000,
            headers,
            validateStatus: (status) => status < 500,
          });
          if (res.status === 404) continue;
          if (res.status >= 400) break;
          const pedidoId = res.data?.pedidoId ? String(res.data.pedidoId) : null;
          if (pedidoId) {
            pedidoIdCicloRef.current = pedidoId;
          }
          let lista = res.data?.bouchers || [];
          if (pedidoId) {
            lista = lista.filter((b) => {
              const bp = b.pedido?._id || b.pedido;
              return !bp || String(bp) === pedidoId;
            });
          }
          setBouchersParciales(lista);
          return lista;
        } catch (inner) {
          if (inner.response?.status === 404) continue;
        }
      }
      setBouchersParciales([]);
      return [];
    } catch (e) {
      if (__DEV__ && e.response?.status !== 404) {
        console.warn('[PAGOS] vouchers parciales:', e?.message);
      }
      setBouchersParciales([]);
      return [];
    }
  }, [getHeadersAuth]);

  // ❌ DESHABILITADO: No actualizar comandas desde WebSocket en PagosScreen
  // Backend = única fuente de verdad. Solo usar route.params
  // Los handlers de WebSocket pueden mezclar comandas antiguas con nuevas
  // y causar loops infinitos de re-suscripción si tienen dependencias.
  // El refresco de vouchers parciales se hace al enfocar la pantalla y tras cada pago.
  const handleComandaActualizada = React.useCallback((comanda) => {
    console.log('📥 [PAGOS] Comanda actualizada vía WebSocket (ignorada en PagosScreen):', comanda._id, 'Status:', comanda.status);
  }, []);

  // ❌ DESHABILITADO: No agregar comandas desde WebSocket en PagosScreen
  // Backend = única fuente de verdad. Solo usar route.params
  const handleNuevaComanda = React.useCallback((comanda) => {
    console.log('📥 [PAGOS] Nueva comanda vía WebSocket (ignorada en PagosScreen):', comanda.comandaNumber);
    // NO agregar al estado local - usar solo route.params del backend
    // Si se necesita actualizar, recargar desde InicioScreen con nuevo endpoint
  }, []);

  // ✅ INICIALIZACIÓN: Usar datos de route.params directamente - Backend = FUENTE ÚNICA DE VERDAD
  // IMPORTANTE: Re-ejecutar cuando cambien los params (navegación desde InicioScreen)
  // Leer route.params directamente en cada ejecución para Tab Navigator
  // ❌ NUNCA agregar comandas desde WebSocket o caché - solo route.params
  useEffect(() => {
    // Leer params directamente del route en cada ejecución
    const currentParams = route.params || {};
    const currentMesa = currentParams.mesa;
    const currentComandas = currentParams.comandasParaPagar;
    const currentTotal = currentParams.totalPendiente;
    const currentBoucher = currentParams.boucher;
    
    console.log("🔄 [PAGOS] useEffect ejecutado - route.params:", {
      tieneBoucher: !!currentBoucher,
      tieneComandas: !!currentComandas,
      cantidadComandas: currentComandas?.length || 0,
      tieneMesa: !!currentMesa,
      total: currentTotal,
      routeParamsKeys: Object.keys(currentParams)
    });

    if (currentBoucher) {
      console.log("✅ Boucher recibido desde navegación (Imprimir Boucher) — recargando del servidor");
      setBoucherData(null);
      setBouchersParciales([]);
      setComandas([]);
      pedidoIdCicloRef.current = null;

      const mesaObj = currentBoucher.mesa
        ? typeof currentBoucher.mesa === 'object'
          ? currentBoucher.mesa
          : { _id: currentBoucher.mesa, nummesa: currentBoucher.numMesa }
        : null;
      if (mesaObj) {
        setMesa(mesaObj);
      }
      const mesaIdConsolidar = mesaObj?._id || currentBoucher.mesa;
      if (mesaIdConsolidar) {
        (async () => {
          const consolidado = await cargarBoucherConsolidadoMesa(mesaIdConsolidar);
          if (consolidado) {
            setBoucherData(consolidado);
          } else {
            setBoucherData(currentBoucher);
          }
          await cargarBouchersParcialesMesa(mesaIdConsolidar);
        })();
      } else {
        setBoucherData(currentBoucher);
      }
      if (currentBoucher.cliente) {
        const cliente = typeof currentBoucher.cliente === 'object' ? currentBoucher.cliente : { _id: currentBoucher.cliente };
        setClienteSeleccionado(cliente);
      }
    } else if (currentComandas && currentMesa && currentComandas.length > 0) {
      // ✅ Si vienen datos limpios desde InicioScreen, LIMPIAR estado anterior y usar SOLO estos datos
      console.log("✅ Datos limpios recibidos desde InicioScreen (LIMPIANDO estado anterior):", {
        comandas: currentComandas.length,
        mesa: currentMesa.nummesa,
        total: currentTotal,
        primeraComanda: currentComandas[0]?._id,
        platosPrimeraComanda: currentComandas[0]?.platos?.length || 0,
        platosDetalle: currentComandas[0]?.platos?.map((p, i) => ({
          index: i,
          nombre: p.plato?.nombre || 'Sin nombre',
          precio: p.plato?.precio || p.precio || 0,
          cantidad: currentComandas[0]?.cantidades?.[i] || 1
        })) || []
      });
      
      // Validar que las comandas tengan platos
      const comandasConPlatos = currentComandas.filter(c => c.platos && c.platos.length > 0);
      if (comandasConPlatos.length === 0) {
        console.warn("⚠️ [PAGOS] Las comandas recibidas no tienen platos");
        console.warn("⚠️ [PAGOS] Detalle de comandas:", currentComandas.map(c => ({
          _id: c._id,
          comandaNumber: c.comandaNumber,
          tienePlatos: !!c.platos,
          cantidadPlatos: c.platos?.length || 0
        })));
      } else {
        console.log("✅ [PAGOS] Comandas con platos:", comandasConPlatos.length);
      }
      
      // ✅ LIMPIAR estado anterior y usar SOLO los datos del backend (route.params)
      // Crear nuevos objetos/arrays para forzar actualización completa
      setComandas([...currentComandas]); // SOLO estas comandas del backend
      setMesa({ ...currentMesa }); // SOLO esta mesa del backend
      setTotal(currentTotal || 0); // SOLO este total del backend
      setBoucherData(null); // Limpiar boucher anterior si existe
      setClienteSeleccionado(null); // Limpiar cliente anterior
      setBouchersParciales([]); // Limpiar vouchers de visitas anteriores
      pedidoIdCicloRef.current = null;
      
      console.log("✅ [PAGOS] Estado LIMPIADO y actualizado SOLO con datos del backend:", {
        comandasEnEstado: currentComandas.length,
        mesaEnEstado: currentMesa.nummesa,
        totalEnEstado: currentTotal,
        idsComandas: currentComandas.map(c => c._id?.slice(-6))
      });
    } else {
      // Si no hay datos en params, limpiar estado
      if (!currentBoucher) {
        console.warn("⚠️ [PAGOS] No se recibieron datos válidos en route.params - LIMPIANDO estado", {
          tieneComandas: !!currentComandas,
          tieneMesa: !!currentMesa,
          cantidadComandas: currentComandas?.length || 0
        });
        // Limpiar estado si no hay datos válidos
        setComandas([]);
        setMesa(null);
        setTotal(0);
      }
    }
  }, [route.params, cargarBoucherConsolidadoMesa]); // ✅ Dependencia: route.params completo para detectar cualquier cambio

  // Cargar vouchers parciales solo si ya hubo cobros parciales o la mesa está pagada
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || cancelled) return;

      const mesaEstado = (mesa?.estado || mesaParam?.estado || '').toLowerCase();
      const yaHuboCobros =
        totalAcumuladoPagado > 0 ||
        hayPendienteTrasPago ||
        mesaEstado === 'pagado' ||
        bouchersParciales.length > 0;
      if (!yaHuboCobros) return;

      const mesaId =
        mesa?._id ||
        mesaParam?._id ||
        boucherData?.mesa?._id ||
        boucherData?.mesa ||
        boucherFromParams?.mesa?._id ||
        boucherFromParams?.mesa;
      if (!mesaId) return;

      const comandasFuente =
        comandas?.length > 0 ? comandas : route.params?.comandasParaPagar || [];
      const comandaIds = comandasFuente.map((c) => c._id).filter(Boolean);
      await cargarBouchersParcialesMesa(mesaId, comandaIds);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    mesa?._id,
    mesa?.estado,
    mesaParam?._id,
    mesaParam?.estado,
    comandas,
    boucherData?.mesa,
    boucherFromParams?.mesa,
    cargarBouchersParcialesMesa,
    route.params?.comandasParaPagar,
    totalAcumuladoPagado,
    hayPendienteTrasPago,
    bouchersParciales.length,
  ]);

  const mostrarVouchersParciales = bouchersParciales.length > 0;
  const simboloMoneda = configMoneda?.simboloMoneda || 'S/.';
  const decimalesMoneda = configMoneda?.decimales ?? 2;

  const formatearFechaVoucher = (b) =>
    b?.fechaPagoString ||
    (b?.fechaPago
      ? moment(b.fechaPago).tz('America/Lima').format('DD/MM/YYYY HH:mm')
      : '—');

  // ✅ Suscribirse a eventos Socket cuando la pantalla está enfocada (solo para actualizaciones en tiempo real)
  // También recargar datos si vienen nuevos params al enfocar la pantalla
  useFocusEffect(
    React.useCallback(() => {
      // Plantilla puede cambiar en el admin mientras el mozo usa la app: refrescar al entrar a Pagos
      cargarPlantillaVoucher();

      // Leer params directamente del route al enfocar
      const currentParams = route.params || {};
      const currentMesa = currentParams.mesa;
      const currentComandas = currentParams.comandasParaPagar;
      const currentTotal = currentParams.totalPendiente;
      const currentBoucher = currentParams.boucher;
      
      console.log("🔍 [PAGOS] Pantalla enfocada - route.params:", {
        tieneBoucher: !!currentBoucher,
        tieneComandas: !!currentComandas,
        cantidadComandas: currentComandas?.length || 0,
        tieneMesa: !!currentMesa,
        total: currentTotal
      });

      // ✅ Si hay nuevos datos en params al enfocar, LIMPIAR estado anterior y usar SOLO estos datos
      if (currentComandas && currentMesa && currentComandas.length > 0) {
        console.log("🔄 [PAGOS] Actualizando datos desde route.params al enfocar (LIMPIANDO estado anterior)");
        console.log("📋 [PAGOS] Comandas recibidas:", currentComandas.map(c => ({
          _id: c._id?.slice(-6),
          comandaNumber: c.comandaNumber,
          platos: c.platos?.length || 0
        })));
        
        // ✅ LIMPIAR estado anterior y usar SOLO los datos del backend
        setComandas([...currentComandas]); // SOLO estas comandas
        setMesa({ ...currentMesa }); // SOLO esta mesa
        setTotal(currentTotal || 0); // SOLO este total
        setBoucherData(null); // Limpiar boucher anterior
        setClienteSeleccionado(null); // Limpiar cliente anterior
        setBouchersParciales([]);
        pedidoIdCicloRef.current = null;
      } else if (currentBoucher) {
        console.log("🔄 [PAGOS] Recargando boucher del ciclo actual al enfocar");
        setBoucherData(null);
        setBouchersParciales([]);
        setComandas([]);
        const mesaB = currentParams.mesa || currentBoucher.mesa;
        const mesaObj = mesaB
          ? typeof mesaB === 'object'
            ? mesaB
            : { _id: mesaB, nummesa: currentBoucher.numMesa }
          : null;
        if (mesaObj) setMesa(mesaObj);
        const mesaIdB = mesaObj?._id || (typeof mesaB === 'string' ? mesaB : currentBoucher.mesa);
        if (mesaIdB) {
          cargarBoucherConsolidadoMesa(mesaIdB).then((consolidado) => {
            setBoucherData(consolidado || currentBoucher);
          });
          cargarBouchersParcialesMesa(mesaIdB);
        } else {
          setBoucherData(currentBoucher);
        }
      } else if (!currentBoucher && !currentComandas) {
        // Si no hay datos, limpiar estado
        console.log("🔄 [PAGOS] No hay datos en params - LIMPIANDO estado");
        setComandas([]);
        setMesa(null);
        setTotal(0);
      }

      const mesaIdFocus =
        currentMesa?._id ||
        currentParams.mesa?._id ||
        currentBoucher?.mesa?._id ||
        currentBoucher?.mesa;
      if (mesaIdFocus) {
        AsyncStorage.getItem('authToken').then((token) => {
          if (!token) return;
          const esImprimirBoucher = !!currentBoucher;
          const yaHuboCobros =
            esImprimirBoucher ||
            totalAcumuladoPagado > 0 ||
            hayPendienteTrasPago ||
            (currentMesa?.estado || currentParams.mesa?.estado || '').toLowerCase() === 'pagado' ||
            bouchersParciales.length > 0;
          if (!yaHuboCobros) return;
          const comandaIds = (currentComandas || []).map((c) => c._id).filter(Boolean);
          cargarBouchersParcialesMesa(mesaIdFocus, comandaIds);
        });
      }

      let syncCancelled = false;
      if (currentMesa?._id && !currentBoucher && currentComandas?.length > 0) {
        (async () => {
          try {
            const backend = await fetchComandasBackendParaMesa(
              currentMesa._id,
              currentMesa.nummesa
            );
            if (syncCancelled) return;
            const validas = filtrarComandasPagablesParaPago(
              backend,
              String(currentMesa._id),
              currentMesa.nummesa
            );
            if (validas.length > 0) {
              console.log(
                `🔄 [PAGOS] Sincronización automática al enfocar: ${validas.length} comanda(s) desde servidor`
              );
              setComandas(validas);
              setMesa({ ...currentMesa });
            }
          } catch (e) {
            if (__DEV__) console.warn("[PAGOS] Sync al enfocar:", e?.message);
          }
        })();
      }

      subscribeToEvents({
        onComandaActualizada: handleComandaActualizada,
        onNuevaComanda: handleNuevaComanda
      });

      return () => {
        syncCancelled = true;
        subscribeToEvents({
          onComandaActualizada: null,
          onNuevaComanda: null
        });
      };
    }, [cargarPlantillaVoucher, cargarBouchersParcialesMesa, handleComandaActualizada, handleNuevaComanda, subscribeToEvents, route.params])
  );

  useEffect(() => {
    // Calcular total cuando cambien las comandas o route.params
    // Leer route.params directamente
    const paramsParaCalcular = route.params || {};
    const comandasDeParamsParaCalcular = paramsParaCalcular.comandasParaPagar || [];
    const totalPendienteDeParams = paramsParaCalcular.totalPendiente || 0;
    const comandasParaCalcular = comandas.length > 0 ? comandas : comandasDeParamsParaCalcular;
    if (comandasParaCalcular.length > 0) {
      calcularTotal(comandasParaCalcular);
    } else if (totalPendienteDeParams) {
      // Si hay totalPendiente de route.params, usarlo
      setTotal(totalPendienteDeParams);
    } else {
      setTotal(0);
    }
  }, [comandas, route.params]); // ✅ Dependencia: route.params para detectar cambios

  const calcularTotal = (comandasACalcular = comandas) => {
    if (!comandasACalcular || comandasACalcular.length === 0) {
      // Si no hay comandas pero hay totalPendiente en route.params, usarlo
      const paramsParaTotal = route.params || {};
      const totalPendienteDeParams = paramsParaTotal.totalPendiente || 0;
      if (totalPendienteDeParams) {
        setTotal(totalPendienteDeParams);
      } else {
        setTotal(0);
      }
      return;
    }

    let totalCalculado = 0;
    // Acumular total de todas las comandas
    // 🔥 FIX: Usar totalCalculado de la comanda si tiene descuento aplicado
    // IMPORTANTE: totalCalculado puede ser 0 (descuento 100%), no usar como booleano
    comandasACalcular.forEach((comanda) => {
      if (comanda.descuento > 0 && comanda.totalCalculado != null) {
        totalCalculado += comanda.totalCalculado;
      } else if (comanda.platos) {
        // Sin descuento: calcular normalmente
        comanda.platos.forEach((platoItem, index) => {
          // 🔥 CORREGIDO: Solo contar platos no eliminados NI anulados
          // Los platos anulados desde cocina tienen eliminado=true Y anulado=true
          if (!platoItem.eliminado && !platoItem.anulado) {
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = platoItem.plato?.precio || platoItem.precio || 0;
            totalCalculado += precio * cantidad;
          }
        });
      }
    });
    setTotal(totalCalculado);
  };

  // Contador animado para el total
  const totalAnim = useSharedValue(0);
  const totalCalculado = useMemo(() => {
    // Leer route.params directamente
    const paramsParaCalcular = route.params || {};
    const comandasDeParamsParaCalcular = paramsParaCalcular.comandasParaPagar || [];
    const totalPendienteDeParams = paramsParaCalcular.totalPendiente || 0;
    const comandasParaCalcular = comandas.length > 0 ? comandas : comandasDeParamsParaCalcular;
    if (!comandasParaCalcular || comandasParaCalcular.length === 0) {
      return totalPendienteDeParams || 0;
    }
    let total = 0;
    // 🔥 FIX: Usar totalCalculado de la comanda si tiene descuento aplicado
    // IMPORTANTE: totalCalculado puede ser 0 (descuento 100%), no usar como booleano
    comandasParaCalcular.forEach((comanda) => {
      if (comanda.descuento > 0 && comanda.totalCalculado != null) {
        total += comanda.totalCalculado;
      } else if (comanda.platos) {
        // Sin descuento: calcular normalmente
        comanda.platos.forEach((platoItem, index) => {
          // 🔥 CORREGIDO: Solo contar platos no eliminados NI anulados
          // Los platos anulados desde cocina tienen eliminado=true Y anulado=true
          if (!platoItem.eliminado && !platoItem.anulado) {
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = platoItem.plato?.precio || platoItem.precio || 0;
            total += precio * cantidad;
          }
        });
      }
    });
    // FIX: No usar || con total porque 0 es falsy (descuento 100%)
    return total > 0 ? total : (totalPendienteDeParams > 0 ? totalPendienteDeParams : total);
  }, [comandas, route.params]); // ✅ Dependencia: route.params para detectar cambios
  
  // 🔥 NUEVO: Calcular información de descuentos
  const infoDescuentos = useMemo(() => {
    const paramsParaDesc = route.params || {};
    const comandasDeParamsParaDesc = paramsParaDesc.comandasParaPagar || [];
    const comandasParaDesc = comandas.length > 0 ? comandas : comandasDeParamsParaDesc;
    
    const descuentos = [];
    let ahorroTotal = 0;
    
    comandasParaDesc.forEach((comanda) => {
      if (comanda.descuento > 0) {
        // 🔥 CORREGIDO: Usar montoDescuento del backend si está disponible
        // Si no, calcular basándose en totalSinDescuento y totalCalculado
        let montoAhorro = comanda.montoDescuento;
        
        if (!montoAhorro || montoAhorro === 0) {
          // Si no hay montoDescuento, calcularlo
          const totalSinDesc = comanda.totalSinDescuento || (comanda.precioTotal * 1.18);
          const totalConDesc = comanda.totalCalculado != null ? comanda.totalCalculado : totalSinDesc;
          montoAhorro = totalSinDesc - totalConDesc;
        }
        
        descuentos.push({
          comandaNumber: comanda.comandaNumber,
          porcentaje: comanda.descuento,
          motivo: comanda.motivoDescuento,
          montoAhorro: montoAhorro
        });
        ahorroTotal += montoAhorro;
      }
    });
    
    return { descuentos, ahorroTotal };
  }, [comandas, route.params]);

  // 🔥 FIX: Subtotal ORIGINAL (pre-descuento) para display correcto de Subtotal/IGV
  const subtotalOriginal = useMemo(() => {
    const paramsParaCalc = route.params || {};
    const comandasDeParams = paramsParaCalc.comandasParaPagar || [];
    const comandasParaCalc = comandas.length > 0 ? comandas : comandasDeParams;
    if (!comandasParaCalc || comandasParaCalc.length === 0) return 0;
    let sub = 0;
    comandasParaCalc.forEach((comanda) => {
      if (comanda.platos) {
        comanda.platos.forEach((platoItem, index) => {
          if (!platoItem.eliminado && !platoItem.anulado) {
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = platoItem.plato?.precio || platoItem.precio || 0;
            sub += precio * cantidad;
          }
        });
      }
    });
    return sub;
  }, [comandas, route.params]);

  const platosEnPantalla = useMemo(() => {
    const paramsParaCalc = route.params || {};
    const comandasDeParams = paramsParaCalc.comandasParaPagar || [];
    const comandasParaCalc = comandas.length > 0 ? comandas : comandasDeParams;
    return listarPlatosEnPantallaPago(comandasParaCalc);
  }, [comandas, route.params]);

  const platosPagables = useMemo(
    () => platosEnPantalla.filter((p) => !p.yaPagado),
    [platosEnPantalla]
  );

  const todosPlatosPagablesSeleccionados = useMemo(() => {
    if (platosPagables.length === 0) return false;
    return platosPagables.every((p) => platosSeleccionadosPago.includes(p.key));
  }, [platosPagables, platosSeleccionadosPago]);

  const totalesPagoActual = useMemo(() => {
    const sub = calcularSubtotalSeleccion(platosSeleccionadosPago, platosPagables);
    return calcularTotalesPreview(sub, configMoneda);
  }, [platosSeleccionadosPago, platosPagables, configMoneda]);

  // Inicializar selección: todos los platos pagables al cargar comandas
  useEffect(() => {
    if (boucherData || boucherFromParams) return;
    if (platosPagables.length === 0) {
      setPlatosSeleccionadosPago([]);
      return;
    }
    setPlatosSeleccionadosPago(platosPagables.map((p) => p.key));
  }, [platosPagables, boucherData, boucherFromParams]);

  useEffect(() => {
    totalAnim.value = withTiming(totalCalculado, {
      duration: 800,
      easing: Easing.inOut(Easing.ease),
    });
  }, [totalCalculado]);

  const animatedTotalStyle = useAnimatedStyle(() => ({
    opacity: totalAnim.value > 0 || infoDescuentos.descuentos.length > 0 ? 1 : 0.5,
  }));

  // ==========================================
  // PLANTILLA DE VOUCHER - Adaptado del Backend Admin
  // ==========================================
  
  // Configuración por defecto de la plantilla
  const PLANTILLA_DEFAULT = {
    logo: '',
    restaurante: { 
      nombre: 'LAS GAMBUSINAS', 
      eslogan: '* Comidas Típicas y Parrilla *', 
      ruc: '20123456789', 
      direccion: 'Calle Principal 123, Lima', 
      telefono: '01-1234567' 
    },
    encabezado: { 
      tipoComprobante: 'BOLETA DE VENTA ELECTRONICA', 
      serie: 'B001', 
      correlativo: '' // Se generará dinámicamente
    },
    bloques: { 
      mostrarEncabezado: true, 
      mostrarDatosPedido: true, 
      mostrarDetalleProductos: true, 
      mostrarTotales: true, 
      mostrarDatosCliente: true, 
      mostrarAgradecimiento: true 
    },
    campos: { 
      mostrarIGV: true, 
      mostrarRC: false, 
      mostrarICBPER: false, 
      mostrarPropina: false, 
      mostrarBloquePromo: false, 
      mostrarQR: false 
    },
    promo: { 
      titulo: 'CALIFICA Y GANA', 
      mensaje: 'Escanéa el código QR y participa por grandes premios', 
      qrTamano: 70 
    },
    visibilidad: { 
      nombre: true, eslogan: true, ruc: true, direccion: true, telefono: true, 
      voucherId: true, numeroVoucher: true, fechaPedido: true, fechaPago: true, 
      tipo: true, local: true, caja: true, mesero: true, mesa: true, 
      observacion: true, cliente: true, dniCliente: true, totales: true 
    },
    espaciado: { lineHeight: 16, tamanoFuente: 11, espacioDivider: 8 },
    mensajes: { 
      agradecimiento: 'Gracias por ser parte de Nuestra Familia', 
      urlConsulta: 'https://www.lasgambusinas.com/consulta' 
    },
    etiquetas: { 
      voucherId: 'Voucher ID', 
      numeroVoucher: 'Nro. Voucher', 
      fechaPedido: 'Fecha Pedido', 
      fechaPago: 'Fecha Pago', 
      mesero: 'Mesero', 
      mesa: 'Mesa', 
      total: 'TOTAL', 
      cliente: 'Cliente', 
      observaciones: 'Observaciones' 
    }
  };

  const construirOptsBoucher = (boucher = null) => ({
    boucher: boucher || boucherData,
    comandas,
    mesa,
    plantilla: plantillaVoucher || PLANTILLA_DEFAULT,
    configMoneda,
    clienteSeleccionado,
    subtotalOriginal,
    total,
    etiquetasDefault: PLANTILLA_DEFAULT.etiquetas,
  });

  const generarBoucher = async (boucher = null) => {
    const opts = construirOptsBoucher(boucher);
    return mostrarOpcionesBoucher(opts, {
      onStart: () => setIsGenerating(true),
      onEnd: () => setIsGenerating(false),
    });
  };


  // ✅ SIMPLIFICADO: Usar datos limpios de route.params - Backend ya validó todo
  const handlePagar = async () => {
    if (!comandas || comandas.length === 0 || !mesa) {
      Alert.alert("Error", "No hay información de comandas o mesa");
      return;
    }

    // Verificar si la mesa ya está en estado "pagado"
    const mesaYaPagada = mesa.estado?.toLowerCase() === "pagado";
    
    if (mesaYaPagada) {
      // Si ya está pagada, solo generar el boucher
      Alert.alert(
        "Mesa ya Pagada",
        "Esta mesa ya ha sido pagada. Solo puedes imprimir el boucher.",
        [
          {
            text: "Generar Boucher",
            onPress: async () => {
              await generarBoucher();
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
      return;
    }

    // ✅ Datos ya vienen limpios del backend - Abrir modal de cliente directamente
    setModalClienteVisible(true);
  };


  // ✅ NUEVO FLUJO: Usar endpoint POST /boucher con comandasIds - Backend valida y procesa todo
  // ✅ IMPORTANTE: Usar SOLO comandas de route.params (backend = única fuente de verdad)
  // 🔥 Función para validar comandas antes de enviar al backend
  // MEJORADO: Obtener comandas FRESCAS del backend por mesa (no por IDs)
  const validarComandasParaPago = async (comandasIds, mesaId, mesaNummesa) => {
    try {
      setMensajeCarga("Obteniendo comandas frescas del servidor...");

      const mesaIdStr = mesaId != null ? String(mesaId) : "";
      const comandasBackend = await fetchComandasBackendParaMesa(mesaId, mesaNummesa);

      console.log(
        `✅ [VALIDACIÓN] Obtenidas ${comandasBackend.length} comanda(s) fresca(s) del backend para mesa ${mesaIdStr ? mesaIdStr.slice(-6) : mesaNummesa}`
      );

      if (comandasIds.length > 0) {
        console.log(
          `🔍 [VALIDACIÓN] Validando ${comandasIds.length} ID(s) específico(s):`,
          comandasIds.map((id) => id?.toString?.().slice(-6))
        );
      } else {
        console.log(`🔍 [VALIDACIÓN] Obteniendo todas las comandas válidas de la mesa (sin filtrar por IDs)`);
      }

      const comandasValidas = filtrarComandasPagablesParaPago(comandasBackend, mesaIdStr, mesaNummesa);

      comandasBackend.forEach((c) => {
        const ok = comandasValidas.some((v) => String(v._id) === String(c._id));
        if (!ok) {
          const comandaMesaId = c.mesas?._id ?? c.mesas;
          const coincideMesa =
            (mesaIdStr && comandaMesaId != null && String(comandaMesaId) === mesaIdStr) ||
            (mesaNummesa != null &&
              c.mesas?.nummesa != null &&
              String(c.mesas.nummesa) === String(mesaNummesa));
          const noEliminada = c.eliminada !== true;
          const noPagada = c.status?.toLowerCase() !== 'pagado' && c.status?.toLowerCase() !== 'completado';
          const tienePlatos = c.platos && c.platos.length > 0;
          const platosActivos = c.platos?.filter((p) => p.eliminado !== true && p.anulado !== true) || [];
          const razon = !coincideMesa
            ? 'mesa diferente'
            : !noEliminada
              ? 'eliminada'
              : !noPagada
                ? 'ya pagada'
                : !tienePlatos
                  ? 'sin platos'
                  : platosActivos.length === 0
                    ? 'sin platos válidos'
                    : 'desconocida';
          console.warn(`⚠️ [VALIDACIÓN] Comanda #${c.comandaNumber || c._id?.toString?.().slice(-6)} inválida: ${razon}`);
        }
      });

      const idsValidasSet = new Set(comandasValidas.map((c) => String(c._id)));
      const comandasInvalidas = comandasBackend.filter((c) => !idsValidasSet.has(String(c._id)));
      
      const comandasIdsValidasSet = new Set(
        comandasValidas.map((c) => String(c._id))
      );

      let idsNoEncontrados = [];

      if (comandasIds.length > 0) {
        idsNoEncontrados = comandasIds.filter(
          (id) => !comandasIdsValidasSet.has(String(id))
        );
        
        if (idsNoEncontrados.length > 0) {
          console.warn(`⚠️ [VALIDACIÓN] ${idsNoEncontrados.length} ID(s) de comanda(s) no encontrado(s) o inválido(s) en backend:`, idsNoEncontrados.map(id => id?.slice(-6)));
          console.warn(`⚠️ [VALIDACIÓN] Posibles razones: comanda eliminada, ya pagada, o sin platos válidos`);
        }
      } else {
        // No se pasaron IDs, obtener todas las comandas válidas de la mesa
        console.log(`✅ [VALIDACIÓN] Obteniendo todas las comandas válidas de la mesa (sin filtrar por IDs específicos)`);
      }
      
      console.log(`✅ [VALIDACIÓN] ${comandasValidas.length} comanda(s) válida(s), ${comandasInvalidas.length} inválida(s)`);
      
      if (comandasInvalidas.length > 0) {
        const razones = comandasInvalidas.map(c => {
          if (c.eliminada === true) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} eliminada`;
          const status = c.status?.toLowerCase();
          // 🔥 CORREGIDO: Verificar platos activos (no eliminados ni anulados)
          const platosActivos = c.platos?.filter(p => p.eliminado !== true && p.anulado !== true) || [];
          const tienePlatosValidos = platosActivos.length > 0;
          if (status === 'pagado') return `Comanda #${c.comandaNumber || c._id?.slice(-6)} ya pagada`;
          if (!tienePlatosValidos) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} sin platos válidos`;
          return `Comanda #${c.comandaNumber || c._id?.slice(-6)} inválida`;
        });
        console.warn(`⚠️ [VALIDACIÓN] Comandas inválidas:`, razones);
      }
      
      const todasValidas =
        comandasIds.length > 0
          ? comandasIds.every((id) => comandasIdsValidasSet.has(String(id)))
          : true;
      
      return {
        validas: comandasValidas,
        invalidas: comandasInvalidas,
        todasValidas:
        comandasIds.length > 0
          ? todasValidas && comandasValidas.length === comandasIds.length
          : true,
        idsNoEncontrados: idsNoEncontrados
      };
    } catch (error) {
      console.error("❌ [VALIDACIÓN] Error validando comandas:", error);
      // Si falla la validación, continuar de todas formas (backend validará)
      return {
        validas: [],
        invalidas: [],
        todasValidas: false,
        error: error.message
      };
    }
  };

  // ✅ MEJORADO: try/catch/finally para evitar loading infinito
  const procesarPagoConCliente = async (cliente, omitirConfirmacionParcial = false) => {
    // ✅ Validaciones ANTES de activar loading
    if (!cliente || !cliente._id) {
      Alert.alert("Error", "No se pudo obtener la información del cliente. Por favor, intenta nuevamente.");
      return;
    }

    // ✅ Leer comandas SOLO de route.params (backend = única fuente de verdad)
    const paramsParaPago = route.params || {};
    const comandasParaPagar = paramsParaPago.comandasParaPagar || [];
    const mesaParaPago = paramsParaPago.mesa || mesa;
    // FIX: No usar || con totalPendiente porque 0 es válido (descuento 100%)
    const totalPendienteParams = paramsParaPago.totalPendiente != null ? paramsParaPago.totalPendiente : 0;

    // Si no hay comandas en params, usar estado local (fallback)
    const comandasFinales = comandasParaPagar.length > 0 ? comandasParaPagar : comandas;
    const mesaFinal = mesaParaPago || mesa;
    const totalFinal = totalPendienteParams > 0 ? totalPendienteParams : total;

    // FIX: Verificar si hay descuento aplicado (permite total=0 con descuento 100%)
    const tieneDescuento = comandasFinales.some(c => c.descuento > 0);

    // ✅ Validaciones antes de procesar
    if (comandasFinales.length === 0) {
      Alert.alert("Error", "No hay comandas para pagar. Por favor, verifica que la mesa tenga comandas listas.");
      return;
    }

    if (!mesaFinal || !mesaFinal._id) {
      Alert.alert("Error", "No se pudo obtener la información de la mesa. Por favor, intenta nuevamente.");
      return;
    }

    // FIX: Permitir total=0 cuando hay descuento 100% aplicado
    if (totalFinal < 0 || (totalFinal === 0 && !tieneDescuento)) {
      Alert.alert("Error", "El total a pagar debe ser mayor a cero. Por favor, verifica las comandas.");
      return;
    }

    // Validar selección de platos para pago parcial
    if (platosPagables.length > 0 && platosSeleccionadosPago.length === 0) {
      Alert.alert(
        "Sin selección",
        "Selecciona al menos un plato para confirmar el pago."
      );
      return;
    }

    // Confirmación adicional cuando el pago es parcial (selección < 100% de platos pagables)
    const esSeleccionParcial = platosPagables.length > 0 &&
      platosSeleccionadosPago.length > 0 &&
      platosSeleccionadosPago.length < platosPagables.length;
    if (esSeleccionParcial && !omitirConfirmacionParcial) {
      Alert.alert(
        "Pago parcial",
        `Cobrarás solo ${platosSeleccionadosPago.length} de ${platosPagables.length} plato(s) pendiente(s).\n\nEl resto quedará pendiente para un pago posterior. ¿Continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sí, cobrar parcial",
            onPress: () => procesarPagoConCliente(cliente, true),
          },
        ]
      );
      return;
    }

    // ✅ Activar loading DESPUÉS de validaciones
    setProcesandoPago(true);
    setMensajeCarga("Procesando pago...");
    
    try {
      const platosPayload = buildPlatosSeleccionadosPayload(
        platosSeleccionadosPago,
        platosPagables
      );

      if (platosPayload.length === 0) {
        setProcesandoPago(false);
        Alert.alert(
          "Error",
          "No hay platos válidos seleccionados. Recarga la pantalla e intenta de nuevo."
        );
        return;
      }

      console.log("💳 [PAGO] Iniciando procesamiento parcial:", {
        cliente: cliente.nombre || cliente._id,
        platosSeleccionados: platosPayload.length,
        mesa: mesaFinal.nummesa,
        totalPreview: totalesPagoActual.total,
      });

      // Obtener mozoId del contexto o de las comandas
      const mozoId = comandasFinales[0]?.mozos?._id || comandasFinales[0]?.mozos;
      if (!mozoId) {
        throw new Error("No se pudo obtener el ID del mozo. Verifica que las comandas tengan un mozo asignado.");
      }

      // ✅ USAR ENDPOINT POST /boucher con comandasIds - Backend valida y procesa todo
      const boucherURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/boucher')
        : BOUCHER_API;
      
      // Extraer IDs de mesa de forma segura
      let mesaIdFinal = mesaFinal._id;
      if (mesaIdFinal && typeof mesaIdFinal === 'object') {
        mesaIdFinal = mesaIdFinal.toString();
      }
      
      const boucherData = {
        mesaId: mesaIdFinal,
        mozoId: mozoId,
        clienteId: cliente._id,
        platosSeleccionados: platosPayload,
        observaciones:
          comandasFinales.map((c) => c.observaciones).filter(Boolean).join("; ") || "",
      };
      
      console.log("📤 [PAGO] Enviando al backend (parcial):", {
        mesaId: mesaIdFinal,
        platos: platosPayload.length,
      });

      setMensajeCarga("Creando boucher y procesando pago...");
      
      // ✅ POST con timeout y manejo de errores específico
      let boucherCreado;
      let resumenPago = null;
      try {
        const headers = await getHeadersAuth();
        const boucherResponse = await axios.post(boucherURL, boucherData, { 
          timeout: 15000,
          headers,
          validateStatus: (status) => status < 500 // No lanzar error para 4xx
        });
        
        // Verificar si hay error en la respuesta
        if (boucherResponse.status >= 400) {
          const errorMsg = boucherResponse.data?.message || `Error ${boucherResponse.status}: ${boucherResponse.statusText}`;
          throw new Error(errorMsg);
        }
        
        boucherCreado = parseBoucherResponse(boucherResponse.data).boucher;
        resumenPago = parseBoucherResponse(boucherResponse.data).resumen;
        
        if (!boucherCreado || !boucherCreado._id) {
          throw new Error("El backend no retornó un boucher válido");
        }
        
        console.log("✅ [PAGO] Boucher creado exitosamente:", {
          boucherId: boucherCreado._id?.slice(-6),
          boucherNumber: boucherCreado.boucherNumber,
          voucherId: boucherCreado.voucherId,
          parcial: boucherCreado.esPagoParcial,
          pendiente: resumenPago?.totalPendiente,
        });
      } catch (postError) {
        let boucherRecoveredInCatch = false;
        // 🔥 MEJORADO: Manejo inteligente de errores con retry automático
        if (postError.code === 'ECONNABORTED' || postError.message?.includes('timeout')) {
          throw new Error("Tiempo de espera agotado. Verifica tu conexión e intenta nuevamente.");
        }
        if (postError.code === 'ECONNREFUSED' || postError.message?.includes('Network Error')) {
          throw new Error("No se pudo conectar con el servidor. Verifica que el backend esté funcionando.");
        }
        if (postError.response) {
          // Error del backend (4xx, 5xx)
          const status = postError.response.status;
          const errorData = postError.response.data || {};
          const errorMsg = errorData.message || postError.message;
          
          // 🔥 Manejo especial de error 422/400 con comandas inválidas
          if (status === 422 || (status === 400 && (errorMsg?.includes('no son válidas') || errorMsg?.includes('no válida')))) {
            // Intentar extraer IDs de comandas inválidas del mensaje de error
            const idsInvalidosEnMensaje = errorMsg.match(/[a-f0-9]{24}/g) || [];
            console.warn(`⚠️ [PAGO] IDs de comandas inválidas detectados en mensaje:`, idsInvalidosEnMensaje);
            
            // Intentar extraer comandas válidas del error
            const comandasValidasDelError = errorData.comandasValidas || errorData.validas || [];
            const comandasInvalidasDelError = errorData.comandasInvalidas || errorData.invalidas || [];
            
            // Si no hay comandas válidas en el error, intentar obtenerlas del backend
            if (comandasValidasDelError.length === 0 && idsInvalidosEnMensaje.length > 0) {
              console.log(`🔄 [PAGO] Obteniendo comandas válidas del backend después de error...`);
              try {
                // Obtener comandas frescas de la mesa
                const comandasFrescas = await validarComandasParaPago(
                  [],
                  mesaIdFinal,
                  mesaFinal?.nummesa
                );
                if (comandasFrescas.validas.length > 0) {
                  // Usar las comandas válidas encontradas
                  const comandasIdsValidas = comandasFrescas.validas.map(c => {
                    const id = c._id?.toString() || c._id;
                    return id;
                  });
                  
                  // Actualizar boucherData con solo comandas válidas
                  boucherData.platosSeleccionados = buildPlatosSeleccionadosPayload(
                    platosSeleccionadosPago,
                    listarPlatosPagables(comandasFrescas.validas)
                  );
                  
                  // Retry automático con comandas válidas
                  setMensajeCarga("Reintentando con comandas válidas del servidor...");
                  const retryResponse = await axios.post(boucherURL, boucherData, { 
                    timeout: 15000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (retryResponse.status >= 400) {
                    throw new Error(retryResponse.data?.message || `Error ${retryResponse.status}`);
                  }
                  
                  const parsedRetry = parseBoucherResponse(retryResponse.data);
                  boucherCreado = parsedRetry.boucher;
                  resumenPago = parsedRetry.resumen;
                  
                  if (!boucherCreado || !boucherCreado._id) {
                    throw new Error("El backend no retornó un boucher válido");
                  }
                  
                  console.log("✅ [PAGO] Boucher creado después de retry con comandas frescas:", {
                    boucherId: boucherCreado._id?.slice(-6),
                    boucherNumber: boucherCreado.boucherNumber
                  });
                  
                  boucherRecoveredInCatch = true;
                }
              } catch (retryError) {
                console.error("❌ [PAGO] Error en retry con comandas frescas:", retryError);
                // Continuar con el manejo de error original
              }
            }
            
            if (!boucherRecoveredInCatch && comandasValidasDelError.length > 0) {
              // Hay comandas válidas, retry automático
              console.log(`🔄 [PAGO] Retry automático con ${comandasValidasDelError.length} comanda(s) válida(s)`);
              
              boucherData.platosSeleccionados = buildPlatosSeleccionadosPayload(
                listarPlatosPagables(comandasValidasDelError).map((p) => p.key),
                listarPlatosPagables(comandasValidasDelError)
              );
              
              // Retry automático
              try {
                setMensajeCarga("Reintentando con comandas válidas...");
                const retryResponse = await axios.post(boucherURL, boucherData, { 
                  timeout: 15000,
                  validateStatus: (status) => status < 500
                });
                
                if (retryResponse.status >= 400) {
                  throw new Error(retryResponse.data?.message || `Error ${retryResponse.status}`);
                }
                
                const parsedRetry2 = parseBoucherResponse(retryResponse.data);
                boucherCreado = parsedRetry2.boucher;
                resumenPago = parsedRetry2.resumen;
                
                if (!boucherCreado || !boucherCreado._id) {
                  throw new Error("El backend no retornó un boucher válido");
                }
                
                // Mostrar mensaje informativo
                if (comandasInvalidasDelError.length > 0) {
                  Alert.alert(
                    "⚠️ Algunas comandas ya pagadas",
                    `${comandasInvalidasDelError.length} comanda(s) ya estaban pagada(s). Se procesó el pago de ${comandasValidasDelError.length} comanda(s) válida(s).`,
                    [{ text: "OK" }]
                  );
                }
                
                console.log("✅ [PAGO] Boucher creado después de retry:", {
                  boucherId: boucherCreado._id?.slice(-6),
                  boucherNumber: boucherCreado.boucherNumber
                });
                
                // Mostrar mensaje informativo (no bloqueante)
                if (comandasInvalidasDelError.length > 0) {
                  // Mostrar alerta de forma no bloqueante
                  setTimeout(() => {
                    Alert.alert(
                      "⚠️ Algunas comandas ya pagadas",
                      `${comandasInvalidasDelError.length} comanda(s) ya estaban pagada(s). Se procesó el pago de ${comandasValidasDelError.length} comanda(s) válida(s).`,
                      [{ text: "OK" }]
                    );
                  }, 100);
                }
                
                // Continuar con el flujo normal (no lanzar error, continuar después del catch)
                // El código después del catch se ejecutará normalmente
              } catch (retryError) {
                // Si el retry también falla, mostrar error
                throw new Error(`No se pudo procesar el pago: ${retryError.message || errorMsg}`);
              }
            } else if (!boucherRecoveredInCatch) {
              // No hay comandas válidas - construir mensaje detallado
              let mensajeError = "No hay comandas válidas para pagar.";
              
              if (idsInvalidosEnMensaje.length > 0) {
                mensajeError += `\n\nComanda(s) inválida(s) detectada(s): ${idsInvalidosEnMensaje.map(id => id.slice(-6)).join(', ')}`;
                mensajeError += `\n\nPosibles razones:`;
                mensajeError += `\n- Comanda(s) eliminada(s) completamente`;
                mensajeError += `\n- Comanda(s) ya pagada(s)`;
                mensajeError += `\n- Comanda(s) sin platos válidos`;
                mensajeError += `\n\nPor favor, verifica las comandas en la pantalla de inicio.`;
              } else if (comandasInvalidasDelError.length > 0) {
                const detalles = comandasInvalidasDelError.map(c => {
                  if (c.eliminada === true) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} eliminada`;
                  if (c.status?.toLowerCase() === 'pagado') return `Comanda #${c.comandaNumber || c._id?.slice(-6)} ya pagada`;
                  if (!c.platos || c.platos.length === 0) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} sin platos`;
                  return `Comanda #${c.comandaNumber || c._id?.slice(-6)} inválida`;
                }).join('\n');
                mensajeError += `\n\n${detalles}`;
              }
              
              throw new Error(mensajeError);
            }
          }
          
          if (!(boucherCreado && boucherCreado._id)) {
            if (status === 404) {
              throw new Error("Mesa o comandas no encontradas. Por favor, recarga la pantalla.");
            } else if (status === 400) {
              const backendError = errorData.error || errorData.message || errorMsg;
              const detalles = errorData.details ? `\n\nDetalles: ${JSON.stringify(errorData.details)}` : '';
              throw new Error(`Datos inválidos: ${backendError}${detalles}`);
            } else if (status === 500) {
              throw new Error("Error en el servidor. Por favor, intenta nuevamente o contacta al administrador.");
            } else {
              throw new Error(`Error ${status}: ${errorMsg}`);
            }
          }
        }
        if (!(boucherCreado && boucherCreado._id)) {
          throw postError;
        }
      }
      
      // 🔥 Si llegamos aquí, el boucher se creó exitosamente (ya sea en el primer intento o en el retry)
      // Continuar con el flujo de éxito
      // NOTA: Si el retry fue exitoso, boucherCreado ya está asignado y no se lanzó error

      // Guardar boucher en estado local
      let boucherParaUI = boucherCreado;
      if (boucherCreado && boucherCreado._id) {
        setBoucherData(boucherCreado);
      } else {
        throw new Error("No se pudo crear el boucher. Por favor, intenta nuevamente.");
      }

      const mesaCompletamentePagadaEarly = resumenPago?.mesaPagadaCompletamente === true;
      if (mesaCompletamentePagadaEarly && mesaIdFinal) {
        const consolidado = await cargarBoucherConsolidadoMesa(mesaIdFinal);
        if (consolidado?.platos?.length) {
          boucherParaUI = consolidado;
          setBoucherData(consolidado);
        }
      }

      if (mesaIdFinal) {
        await cargarBouchersParcialesMesa(mesaIdFinal);
      }

      if (resumenPago) {
        setTotalRestante(resumenPago.totalPendiente ?? 0);
        setHayPendienteTrasPago(!resumenPago.mesaPagadaCompletamente);
        if (!resumenPago.mesaPagadaCompletamente && mesaIdFinal) {
          try {
            const comandasCiclo = await fetchComandasCicloParaPagos(mesaIdFinal);
            if (comandasCiclo.length > 0) {
              setComandas(comandasCiclo);
            } else if (resumenPago.comandas?.length) {
              setComandas(resumenPago.comandas);
            }
          } catch {
            if (resumenPago.comandas?.length) {
              setComandas(resumenPago.comandas);
            }
          }
          setTotal(resumenPago.totalPendiente ?? 0);
          setPlatosSeleccionadosPago([]);
        }
        setTotalAcumuladoPagado((prev) => prev + (Number(boucherCreado.total) || 0));
      }

      // Actualizar mesa a "pagado" solo si el backend confirma mesa 100% cobrada
      const mesaCompletamentePagada = resumenPago?.mesaPagadaCompletamente === true;

      let mesaVerificadaComoPagada = false;
      
      if (mesaFinal && mesaIdFinal && mesaCompletamentePagada) {
        setMensajeCarga("Confirmando pago...");
        
        const mesaUpdateURL = apiConfig.isConfigured 
          ? `${apiConfig.getEndpoint('/mesas')}/${mesaIdFinal}/estado`
          : `${MESAS_API_UPDATE}/${mesaIdFinal}/estado`;
        
        // Usar endpoint /mesas (GET individual por :id usa campo mesasId personalizado, no _id)
        const mesaGetURL = apiConfig.isConfigured 
          ? apiConfig.getEndpoint('/mesas')
          : MESAS_API_UPDATE;
        
        // Función helper para verificar el estado de la mesa vía GET directo al backend
        // IMPORTANTE: GET /mesas/:id busca por campo "mesasId" personalizado, no por "_id" de MongoDB
        // Por eso usamos GET /mesas y filtramos por _id
        const verificarEstadoMesa = async () => {
          try {
            const response = await axios.get(mesaGetURL, { 
              timeout: 5000,
              // Headers para evitar caché
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            // El endpoint devuelve un array de mesas
            const mesas = response.data;
            const mesaIdStr = mesaIdFinal?.toString();
            
            // Buscar la mesa por _id
            const mesaEncontrada = mesas.find(m => 
              m._id?.toString() === mesaIdStr || m._id === mesaIdFinal
            );
            
            if (!mesaEncontrada) {
              console.warn(`⚠️ [VERIFICACIÓN] Mesa ${mesaIdStr?.slice(-6)} no encontrada en la lista`);
              return false;
            }
            
            const estadoActual = mesaEncontrada.estado?.toLowerCase();
            console.log(`🔍 [VERIFICACIÓN] Estado actual de mesa ${mesaFinal.nummesa}: "${estadoActual}"`);
            return estadoActual === 'pagado';
          } catch (error) {
            console.error(`❌ [VERIFICACIÓN] Error obteniendo estado de mesa:`, error.message);
            return false;
          }
        };
        
        // Función helper para actualizar el estado de la mesa
        const actualizarEstadoMesa = async () => {
          try {
            await axios.put(
              mesaUpdateURL,
              { estado: "pagado" },
              { timeout: 5000 }
            );
            return true;
          } catch (error) {
            console.error(`❌ [ACTUALIZACIÓN] Error actualizando mesa:`, error.message);
            return false;
          }
        };
        
        const MAX_REINTENTOS = 5;
        const DELAY_REINTENTO = 1000; // 1 segundo entre reintentos
        
        for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
          console.log(`🔄 [MESA] Intento ${intento}/${MAX_REINTENTOS} - Actualizando mesa ${mesaFinal.nummesa} a "pagado"...`);
          
          // Actualizar mensaje del overlay
          if (intento === 1) {
            setMensajeCarga("Confirmando pago...");
          } else {
            setMensajeCarga(`Confirmando pago (intento ${intento}/${MAX_REINTENTOS})...`);
          }
          
          // 1. Intentar actualizar el estado
          const actualizacionExitosa = await actualizarEstadoMesa();
          
          if (!actualizacionExitosa) {
            console.warn(`⚠️ [MESA] Falló la actualización en intento ${intento}`);
            if (intento < MAX_REINTENTOS) {
              // Esperar antes de reintentar
              await new Promise(resolve => setTimeout(resolve, DELAY_REINTENTO));
            }
            continue;
          }
          
          // 2. Verificar que el estado realmente cambió (GET directo al backend)
          setMensajeCarga("Verificando estado de mesa...");
          console.log(`🔍 [MESA] Verificando estado de mesa ${mesaFinal.nummesa}...`);
          
          // Pausa para dar tiempo al backend (latencia / réplicas)
          await new Promise(resolve => setTimeout(resolve, 800));
          
          const estadoVerificado = await verificarEstadoMesa();
          
          if (estadoVerificado) {
            mesaVerificadaComoPagada = true;
            console.log(`✅ [MESA] Mesa ${mesaFinal.nummesa} verificada como "pagado"`);
            setMensajeCarga("¡Pago confirmado!");
            // Actualizar estado local de la mesa
            setMesa(prev => prev ? { ...prev, estado: "pagado" } : null);
            break;
          } else {
            console.warn(`⚠️ [MESA] Verificación falló en intento ${intento} - Estado no es "pagado"`);
            if (intento < MAX_REINTENTOS) {
              console.log(`🔄 [MESA] Reintentando en ${DELAY_REINTENTO}ms...`);
              await new Promise(resolve => setTimeout(resolve, DELAY_REINTENTO));
            }
          }
        }
        
        // Si después de todos los reintentos no se verificó, mostrar advertencia pero continuar
        if (!mesaVerificadaComoPagada) {
          console.warn(`⚠️ [MESA] No se pudo verificar el estado "pagado" después de ${MAX_REINTENTOS} intentos`);
          // Continuar de todas formas para no bloquear al mozo
          setMensajeCarga("¡Pago procesado!");
        }
      }

      // ✅ Guardar boucher y mesa para InicioScreen (mensaje post-pago, imprimir, liberar)
      const mesaIdStr = mesaFinal._id?.toString?.() || mesaFinal._id;
      const mesaPagadaPayload = buildMesaPagadaNavPayload(mesaFinal);
      try {
        await AsyncStorage.setItem("ultimoBoucher", JSON.stringify(boucherCreado));
        await AsyncStorage.setItem("mesaPagada", JSON.stringify(mesaPagadaPayload));
      } catch (e) {
        console.warn("⚠️ [PAGO] No se pudo guardar ultimoBoucher/mesaPagada:", e?.message);
      }

      // Cerrar overlay de carga antes del modal post-pago
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");

      // ✅ Construir mensaje según estado de verificación
      const estadoMesaMsg = mesaVerificadaComoPagada 
        ? `La mesa ${mesaFinal.nummesa} está en estado 'Pagado' (verificado).`
        : `⚠️ La mesa ${mesaFinal.nummesa} podría tardar unos segundos en actualizarse.`;

      // Mostrar modal de pago exitoso con opciones
      const irAlInicio = () => {
        setComandas([]);
        setMesa(null);
        setClienteSeleccionado(null);
        setBoucherData(null);
        setModalPagoExitosoVisible(false);
        navigation.navigate("Inicio", {
          refresh: true,
          mesaId: mesaIdStr,
          mostrarMensajePago: true,
          mesaPagada: mesaPagadaPayload || buildMesaPagadaNavPayload(mesaFinal),
          boucher: boucherParaUI,
        });
      };

      // Guardar datos para el modal y abrirlo
      setClientePagoExitoso(cliente);
      setBoucherData(boucherCreado);
      setModalPagoExitosoVisible(true);
      
    } catch (error) {
      // ✅ SIEMPRE resetear loading en caso de error
      console.error("❌ [PAGO] Error procesando pago:", {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      // Loggear error completo (con manejo seguro)
      try {
        if (logger && typeof logger.error === 'function') {
          await logger.error(error, {
            action: 'procesar_pago_con_cliente',
            clienteId: cliente?._id,
            mesaId: mesaFinal?._id,
            cantidadComandas: comandasFinales.length,
            timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
          });
        } else {
          // Fallback si logger no está disponible
          console.error("❌ [PAGO] Logger no disponible, usando console.error");
        }
      } catch (logError) {
        // No mostrar error si falla el logging (evitar loop infinito)
        console.warn("⚠️ [PAGO] Error en logger (ignorado):", logError.message);
      }
      
      // ✅ Resetear loading
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");
      
      // ✅ Mostrar mensaje de error específico
      const errorMessage = error.message || error.response?.data?.message || "No se pudo procesar el pago. Por favor, intenta nuevamente.";
      Alert.alert("❌ Error al Procesar Pago", errorMessage);
    } finally {
      // ✅ GARANTIZAR que el loading siempre se resetee (doble seguridad)
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");
    }
  };

  const handleClienteSeleccionado = (cliente) => {
    // ✅ Validar cliente antes de continuar
    if (!cliente || !cliente._id) {
      Alert.alert("Error", "No se pudo obtener la información del cliente. Por favor, intenta nuevamente.");
      return;
    }

    // ✅ Cerrar modal inmediatamente
    setModalClienteVisible(false);
    
    // ✅ Calcular total correctamente (usar route.params si está disponible)
    const paramsParaTotal = route.params || {};
    // FIX: No usar || porque 0 es válido (descuento 100%)
    const totalParaMostrar = (paramsParaTotal.totalPendiente != null ? paramsParaTotal.totalPendiente : null) ?? total ?? 0;
    
    // Usar configuración de moneda para el cálculo
    const igvPorcentaje = configMoneda?.igvPorcentaje || 18;
    const decimales = configMoneda?.decimales ?? 2;
    const simbolo = configMoneda?.simboloMoneda || 'S/.';
    const incluyeIGV = configMoneda?.preciosIncluyenIGV || false;
    
    let totalFinal;
    if (incluyeIGV) {
      // Los precios ya incluyen IGV - el total es el precio tal cual
      totalFinal = totalParaMostrar;
    } else {
      // Los precios NO incluyen IGV - sumar IGV
      totalFinal = totalParaMostrar * (1 + igvPorcentaje / 100);
    }
    
    const totalFormateado = totalFinal.toFixed(decimales);
    
    // ✅ Mostrar confirmación antes de procesar el pago
    Alert.alert(
      "Confirmar Pago",
      `¿Deseas continuar con el pago para el cliente ${cliente.nombre || "Invitado"}?\n\nTotal: ${simbolo} ${totalFormateado}`,
      [
        {
          text: "NO",
          style: "cancel",
          onPress: () => {
            setClienteSeleccionado(null);
          }
        },
        {
          text: "SÍ",
          onPress: () => {
            // ✅ Guardar cliente seleccionado y procesar
            setClienteSeleccionado(cliente);
            // Procesar el pago con el cliente seleccionado
            procesarPagoConCliente(cliente);
          }
        }
      ]
    );
  };

  // Si no hay comandas ni boucher, mostrar pantalla vacía
  // Pero si hay boucher (viene de "Imprimir Boucher"), mostrar la pantalla con el boucher
  // IMPORTANTE: Leer route.params DIRECTAMENTE aquí para Tab Navigator (puede que el estado aún no se haya actualizado)
  const paramsActuales = route.params || {};
  const comandasDeParams = paramsActuales.comandasParaPagar || [];
  const mesaDeParams = paramsActuales.mesa;
  const boucherDeParams = paramsActuales.boucher;
  
  const tieneDatos = (comandas && comandas.length > 0) || 
                     (comandasDeParams && comandasDeParams.length > 0) ||
                     boucherData || 
                     boucherFromParams || 
                     boucherDeParams;
  
  // Log para debugging
  console.log("🔍 [PAGOS] Verificando tieneDatos:", {
    comandasEstado: comandas?.length || 0,
    comandasParams: comandasDeParams?.length || 0,
    tieneBoucherData: !!boucherData,
    tieneBoucherFromParams: !!boucherFromParams,
    tieneBoucherDeParams: !!boucherDeParams,
    tieneDatos: tieneDatos,
    routeParamsKeys: Object.keys(paramsActuales),
    primeraComandaParams: comandasDeParams?.[0]?._id?.slice(-6) || 'N/A'
  });
  
  if (!tieneDatos) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("Inicio")}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PAGO</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="receipt" size={64} color={theme.colors.text.light} />
          <Text style={styles.emptyText}>No hay comandas seleccionadas</Text>
          <Text style={styles.emptySubtext}>
            Selecciona una mesa en estado "Preparado" y elige "Pagar"
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { marginTop: 20, backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate("Inicio")}
          >
            <Text style={styles.backButtonText}>Ir a Inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Inicio")}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PAGO</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Banner de progreso de pagos (visible cuando hay cobros parciales o restante) */}
      {!boucherData && !boucherFromParams && (totalAcumuladoPagado > 0 || (totalRestante != null && totalRestante > 0)) && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: (theme.colors?.surface || '#FFFFFF'),
          borderBottomWidth: 1,
          borderBottomColor: (theme.colors?.border || 'rgba(0,0,0,0.08)'),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <MaterialCommunityIcons
              name="cash-check"
              size={18}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={{ fontSize: 13, color: theme.colors?.text?.primary || '#333', fontWeight: '600' }}>
              Pagado: {configMoneda?.simboloMoneda || 'S/.'} {Number(totalAcumuladoPagado || 0).toFixed(configMoneda?.decimales ?? 2)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons
              name="cash-clock"
              size={18}
              color={(totalRestante != null && totalRestante > 0) ? '#EF4444' : '#16a34a'}
              style={{ marginRight: 6 }}
            />
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: (totalRestante != null && totalRestante > 0) ? '#EF4444' : '#16a34a',
            }}>
              Restante: {configMoneda?.simboloMoneda || 'S/.'} {Number(totalRestante || 0).toFixed(configMoneda?.decimales ?? 2)}
            </Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {mostrarVouchersParciales && (
          <View style={styles.parcialesCard}>
            <View style={styles.parcialesHeader}>
              <MaterialCommunityIcons
                name="file-multiple"
                size={22}
                color={colors.primary}
              />
              <Text style={styles.parcialesTitle}>Vouchers por pago parcial</Text>
            </View>
            <Text style={styles.parcialesSubtitle}>
              Cada cobro generó su propio voucher. Imprime el que necesites con los platos de ese pago.
            </Text>
            {bouchersParciales.map((b, idx) => {
              const totalV = Number(b.total) || 0;
              const platosNombres = (b.platos || [])
                .map((p) => p.nombre || p.plato?.nombre || 'Plato')
                .slice(0, 4);
              const masPlatos = (b.platos?.length || 0) > 4;
              return (
                <View key={b._id || `parcial-${idx}`} style={styles.parcialItem}>
                  <View style={styles.parcialItemBody}>
                    <View style={styles.parcialItemTop}>
                      <Text style={styles.parcialVoucherId}>{b.voucherId || '—'}</Text>
                      <Text style={styles.parcialNumero}>#{b.boucherNumber ?? idx + 1}</Text>
                    </View>
                    <Text style={styles.parcialMeta}>
                      {b.platos?.length || 0} plato(s) · {simboloMoneda}{' '}
                      {totalV.toFixed(decimalesMoneda)}
                    </Text>
                    <Text style={styles.parcialFecha}>{formatearFechaVoucher(b)}</Text>
                    {platosNombres.length > 0 && (
                      <Text style={styles.parcialPlatos} numberOfLines={2}>
                        {platosNombres.join(' · ')}
                        {masPlatos ? '…' : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.parcialPrintBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      generarBoucher(b);
                    }}
                    disabled={isGenerating}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="printer" size={20} color="#FFFFFF" />
                    <Text style={styles.parcialPrintText}>Imprimir</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.infoCard}>
          {(boucherData || boucherFromParams)?.esConsolidado && (
            <Text style={styles.infoConsolidadoLabel}>Resumen consolidado del pago</Text>
          )}
          {(boucherData || boucherFromParams) && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Voucher ID:</Text>
                <Text style={[styles.infoValue, { fontWeight: 'bold', fontSize: 16 }]}>
                  {(boucherData || boucherFromParams)?.voucherId || "N/A"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Boucher #:</Text>
                <Text style={styles.infoValue}>
                  {(boucherData || boucherFromParams)?.boucherNumber || "N/A"}
                </Text>
              </View>
            </>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Comanda(s):</Text>
            <Text style={styles.infoValue}>
              {(boucherData || boucherFromParams)?.comandasNumbers?.map(n => `#${n}`).join(', ') || 
               (() => {
                 // Leer route.params directamente
                 const paramsParaInfo = route.params || {};
                 const comandasDeParamsParaInfo = paramsParaInfo.comandasParaPagar || [];
                 const comandasParaMostrar = comandas.length > 0 ? comandas : comandasDeParamsParaInfo;
                 return comandasParaMostrar.map(c => `#${c.comandaNumber || c._id?.slice(-6) || 'N/A'}`).join(', ') || 'N/A';
               })()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mesa:</Text>
            <Text style={styles.infoValue}>
              {mesa?.nombreCombinado || 
               (boucherData || boucherFromParams)?.numMesa || 
               mesa?.nummesa || 
               mesaParam?.nummesa ||
               (() => {
                 // Leer route.params directamente
                 const paramsParaMesa = route.params || {};
                 const comandasDeParamsParaMesa = paramsParaMesa.comandasParaPagar || [];
                 const comandasParaMostrar = comandas.length > 0 ? comandas : comandasDeParamsParaMesa;
                 return comandasParaMostrar[0]?.mesas?.nombreCombinado || comandasParaMostrar[0]?.mesas?.nummesa || paramsParaMesa.mesa?.nummesa || "N/A";
               })()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mozo:</Text>
            <Text style={styles.infoValue}>
              {(boucherData || boucherFromParams)?.nombreMozo || 
               (() => {
                 // Leer route.params directamente
                 const paramsParaMozo = route.params || {};
                 const comandasDeParamsParaMozo = paramsParaMozo.comandasParaPagar || [];
                 const comandasParaMostrar = comandas.length > 0 ? comandas : comandasDeParamsParaMozo;
                 return comandasParaMostrar[0]?.mozos?.name || "N/A";
               })()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoValue}>
              {(boucherData || boucherFromParams)?.fechaPagoString || 
               moment(comandas[0]?.createdAt || comandas[0]?.fecha).tz("America/Lima").format("DD/MM/YYYY HH:mm")}
            </Text>
          </View>
          {((boucherData || boucherFromParams)?.cliente?.nombre || clienteSeleccionado?.nombre) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cliente:</Text>
              <Text style={styles.infoValue}>
                {(boucherData || boucherFromParams)?.cliente?.nombre || clienteSeleccionado?.nombre || "N/A"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.platosCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Platos</Text>
            {!boucherData && !boucherFromParams && platosPagables.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setPlatosSeleccionadosPago(
                    toggleSeleccionarTodos(platosSeleccionadosPago, platosPagables)
                  );
                }}
                style={{ paddingVertical: 6, paddingHorizontal: 10 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                  {todosPlatosPagablesSeleccionados ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {!boucherData && !boucherFromParams && totalRestante != null && totalRestante > 0 && (
            <Text style={{ fontSize: 13, color: theme.colors?.text?.secondary, marginBottom: 8 }}>
              Restante por cobrar: {configMoneda?.simboloMoneda || 'S/.'}{' '}
              {Number(totalRestante).toFixed(configMoneda?.decimales ?? 2)}
            </Text>
          )}
          {(boucherData || boucherFromParams)?.platos ? (
            // Mostrar platos del boucher del backend
            (boucherData || boucherFromParams).platos.map((platoItem, index) => {
              const cantidad = platoItem.cantidad || 1;
              const precio = platoItem.precio || 0;
              const subtotal = platoItem.subtotal || (precio * cantidad);
              const comandaNum = platoItem.comandaNumber;
              
              return (
                <View key={index} style={styles.platoItem}>
                  <View style={styles.platoInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.platoNombre}>{platoItem.nombre || "Plato"}</Text>
                      {platoItem.complementosSeleccionados && platoItem.complementosSeleccionados.length > 0 && (
                        <View style={{ marginTop: 2 }}>
                          {platoItem.complementosSeleccionados.map((comp, ci) => (
                            <Text
                              key={ci}
                              style={{
                                fontSize: 11,
                                color: theme.colors?.text?.secondary || '#6B7280',
                                fontStyle: 'italic',
                                lineHeight: 16,
                              }}
                            >
                              · {Array.isArray(comp.opcion) ? comp.opcion.join(', ') : comp.opcion} x{comp.cantidad || 1}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                    <Text style={styles.platoCantidad}>x{cantidad}</Text>
                  </View>
                  <Text style={styles.platoSubtotal}>{configMoneda?.simboloMoneda || 'S/.'} {subtotal.toFixed(configMoneda?.decimales ?? 2)}</Text>
                </View>
              );
            })
          ) : platosEnPantalla.length > 0 ? (
            platosEnPantalla.map((item) => {
              const seleccionado = platosSeleccionadosPago.includes(item.key);
              const yaPagado = item.yaPagado === true;
              const fila = (
                <>
                  <MaterialCommunityIcons
                    name={
                      yaPagado
                        ? 'checkbox-marked-circle'
                        : seleccionado
                          ? 'checkbox-marked'
                          : 'checkbox-blank-outline'
                    }
                    size={22}
                    color={
                      yaPagado
                        ? '#16a34a'
                        : seleccionado
                          ? colors.primary
                          : theme.colors?.text?.secondary
                    }
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.platoInfo}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.platoNombre,
                            yaPagado && { color: theme.colors?.text?.secondary },
                          ]}
                        >
                          {item.nombre}
                          {yaPagado ? '  · Pagado' : ''}
                        </Text>
                        {item.comandaNumber != null && (
                          <Text style={{ fontSize: 11, color: theme.colors?.text?.secondary }}>
                            Comanda #{item.comandaNumber}
                          </Text>
                        )}
                        {item.complementosSeleccionados?.length > 0 && (
                          <View style={{ marginTop: 2 }}>
                            {item.complementosSeleccionados.map((comp, ci) => (
                              <Text
                                key={ci}
                                style={{
                                  fontSize: 11,
                                  color: theme.colors?.text?.secondary || '#6B7280',
                                  fontStyle: 'italic',
                                }}
                              >
                                · {Array.isArray(comp.opcion) ? comp.opcion.join(', ') : comp.opcion} x
                                {comp.cantidad || 1}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={styles.platoCantidad}>x{item.cantidad}</Text>
                    </View>
                    <Text style={styles.platoSubtotal}>
                      {configMoneda?.simboloMoneda || 'S/.'}{' '}
                      {item.subtotal.toFixed(configMoneda?.decimales ?? 2)}
                    </Text>
                  </View>
                </>
              );

              if (yaPagado) {
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.platoItem,
                      { opacity: 0.85, backgroundColor: '#16a34a14' },
                    ]}
                  >
                    {fila}
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.platoItem,
                    seleccionado && { backgroundColor: (theme.colors?.primary || colors.primary) + '12' },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPlatosSeleccionadosPago((prev) =>
                      prev.includes(item.key)
                        ? prev.filter((k) => k !== item.key)
                        : [...prev, item.key]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  {fila}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.colors?.text?.secondary || '#6B7280' }}>
                No hay platos entregados pendientes de pago
              </Text>
            </View>
          )}
        </View>

        {(() => {
          // Leer route.params directamente
          const paramsParaObservaciones = route.params || {};
          const comandasDeParamsParaObservaciones = paramsParaObservaciones.comandasParaPagar || [];
          const comandasParaObservaciones = comandas.length > 0 ? comandas : comandasDeParamsParaObservaciones;
          const tieneObservaciones = (boucherData || boucherFromParams)?.observaciones || 
                                    comandasParaObservaciones.some(c => c.observaciones);
          
          if (!tieneObservaciones) return null;
          
          return (
            <View style={styles.observacionesCard}>
              <Text style={styles.sectionTitle}>Observaciones</Text>
              {(boucherData || boucherFromParams)?.observaciones ? (
                <Text style={styles.observacionesText}>
                  {(boucherData || boucherFromParams).observaciones}
                </Text>
              ) : (
                comandasParaObservaciones.filter(c => c.observaciones).map((c, idx) => (
                  <Text key={idx} style={styles.observacionesText}>
                    C#{c.comandaNumber || c._id?.slice(-6) || idx + 1}: {c.observaciones}
                  </Text>
                ))
              )}
            </View>
          );
        })()}

        <Animated.View style={[styles.totalCard, animatedTotalStyle]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>
              {configMoneda?.simboloMoneda || 'S/.'} {(() => {
                if (boucherData || boucherFromParams) {
                  return ((boucherData || boucherFromParams)?.subtotal || 0).toFixed(configMoneda?.decimales ?? 2);
                }
                if (platosSeleccionadosPago.length > 0) {
                  return totalesPagoActual.subtotal.toFixed(configMoneda?.decimales ?? 2);
                }
                const base = subtotalOriginal > 0 ? subtotalOriginal : (total || 0);
                const igvPct = configMoneda?.igvPorcentaje || 18;
                const incluyeIGV = configMoneda?.preciosIncluyenIGV || false;
                const decs = configMoneda?.decimales ?? 2;

                if (incluyeIGV) {
                  const subtotalSinIGV = base / (1 + igvPct / 100);
                  return subtotalSinIGV.toFixed(decs);
                } else {
                  return base.toFixed(decs);
                }
              })()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{configMoneda?.nombreImpuestoPrincipal || 'IGV'} ({configMoneda?.igvPorcentaje || 18}%):</Text>
            <Text style={styles.totalValue}>
              {configMoneda?.simboloMoneda || 'S/.'} {(() => {
                if (boucherData || boucherFromParams) {
                  return ((boucherData || boucherFromParams)?.igv || 0).toFixed(configMoneda?.decimales ?? 2);
                }
                if (platosSeleccionadosPago.length > 0) {
                  return totalesPagoActual.igv.toFixed(configMoneda?.decimales ?? 2);
                }
                const base = subtotalOriginal > 0 ? subtotalOriginal : (total || 0);
                const igvPct = configMoneda?.igvPorcentaje || 18;
                const incluyeIGV = configMoneda?.preciosIncluyenIGV || false;
                const decs = configMoneda?.decimales ?? 2;

                if (incluyeIGV) {
                  const igv = base * (igvPct / 100) / (1 + igvPct / 100);
                  return igv.toFixed(decs);
                } else {
                  const igv = base * igvPct / 100;
                  return igv.toFixed(decs);
                }
              })()}
            </Text>
          </View>
          {/* 🔥 FIX: Mostrar información de descuentos si aplica */}
          {infoDescuentos.descuentos.length > 0 && (
            <View style={styles.totalRow}>
              <View style={{ flexDirection: 'column', flex: 1 }}>
                <Text style={[styles.totalLabel, { color: '#EF4444' }]}>
                  DESCUENTO:
                </Text>
                {infoDescuentos.descuentos.map((desc, idx) => (
                  <Text key={idx} style={{ fontSize: 11, color: theme.colors?.text?.secondary || '#6B7280' }}>
                    C#{desc.comandaNumber}: {desc.porcentaje}% - {desc.motivo}
                  </Text>
                ))}
              </View>
              <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                - {configMoneda?.simboloMoneda || 'S/.'} {infoDescuentos.ahorroTotal.toFixed(configMoneda?.decimales ?? 2)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>TOTAL:</Text>
            <Text style={styles.totalValueFinal}>
              {configMoneda?.simboloMoneda || 'S/.'} {(() => {
                if (boucherData || boucherFromParams) {
                  const boucher = boucherData || boucherFromParams;
                  // FIX: Usar totalConDescuento solo si hay descuento real
                  const bDescuento = (boucher?.montoDescuento || 0) > 0 || (boucher?.descuentos?.length || 0) > 0;
                  const bTotal = bDescuento && boucher?.totalConDescuento != null ? boucher.totalConDescuento : (boucher?.total || 0);
                  return bTotal.toFixed(configMoneda?.decimales ?? 2);
                }
                if (platosSeleccionadosPago.length > 0) {
                  return totalesPagoActual.total.toFixed(configMoneda?.decimales ?? 2);
                }
                const base = subtotalOriginal > 0 ? subtotalOriginal : (total || 0);
                const igvPct = configMoneda?.igvPorcentaje || 18;
                const incluyeIGV = configMoneda?.preciosIncluyenIGV || false;
                const decs = configMoneda?.decimales ?? 2;

                let totalFinal;
                if (incluyeIGV) {
                  totalFinal = base;
                } else {
                  totalFinal = base * (1 + igvPct / 100);
                }

                // Restar el descuento del total
                if (infoDescuentos.ahorroTotal > 0) {
                  totalFinal = totalFinal - infoDescuentos.ahorroTotal;
                }

                return Math.max(0, totalFinal).toFixed(decs);
              })()}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.buttonsContainer, { paddingHorizontal: 20 * escala, gap: 16 * escala }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            generarBoucher(boucherData || boucherFromParams);
          }}
          disabled={isGenerating}
          activeOpacity={0.8}
          style={{ flex: 1 }}
        >
          <View style={[styles.buttonNew, { minHeight: 60 * escala, backgroundColor: colors.info }]}>
            {isGenerating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * escala }}>
                <MaterialCommunityIcons name="file-document-outline" size={28 * escala} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                  Generar Boucher
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Botón "Pagar": solo si la mesa no está pagada Y hay platos cobrables pendientes Y no hay boucher consolidado */}
        {mesa?.estado?.toLowerCase() !== "pagado" && platosPagables.length > 0 && !(boucherData || boucherFromParams) && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handlePagar();
            }}
            disabled={isGenerating || procesandoPago || platosSeleccionadosPago.length === 0}
            activeOpacity={0.8}
            style={{ flex: 1, opacity: isGenerating || procesandoPago || platosSeleccionadosPago.length === 0 ? 0.5 : 1 }}
          >
            <View style={[styles.buttonNew, { minHeight: 60 * escala, backgroundColor: colors.success }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * escala }}>
                <MaterialCommunityIcons name="cash-multiple" size={28 * escala} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                  Confirmar Pago{platosSeleccionadosPago.length > 0 ? ` (${platosSeleccionadosPago.length})` : ''}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Botón Registrar Propina: cuando hay boucher y la mesa está pagada o todos los platos están pagados */}
        {(boucherData || boucherFromParams) && (mesa?.estado?.toLowerCase() === "pagado" || platosPagables.length === 0) && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setModalPropinaVisible(true);
            }}
            activeOpacity={0.8}
            style={{ flex: 1 }}
          >
            <View style={[styles.buttonNew, { minHeight: 60 * escala, backgroundColor: "#4ade80" }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * escala }}>
                <MaterialCommunityIcons name="cash-plus" size={28 * escala} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                  Registrar Propina
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Clientes */}
      <ModalClientes
        visible={modalClienteVisible}
        onClose={() => setModalClienteVisible(false)}
        onClienteSeleccionado={handleClienteSeleccionado}
      />

      {/* Modal de Propinas */}
      <ModalRegistrarPropina
        visible={modalPropinaVisible}
        onClose={() => setModalPropinaVisible(false)}
        boucherData={boucherData || boucherFromParams}
        mesaData={mesa}
        mozoData={
          (boucherData || boucherFromParams)?.mozo
            ? {
                _id: typeof (boucherData || boucherFromParams).mozo === 'object'
                  ? (boucherData || boucherFromParams).mozo._id
                  : (boucherData || boucherFromParams).mozo
              }
            : comandas[0]?.mozos
        }
        onPropinaRegistrada={() => {
          setComandas([]);
          setMesa(null);
          setClienteSeleccionado(null);
          setBoucherData(null);
          setModalPagoExitosoVisible(false);
          navigation.navigate("Inicio", {
            refresh: true,
            mesaId: mesa?._id?.toString?.() || mesa?._id,
            mostrarMensajePago: true,
            mesaPagada: buildMesaPagadaNavPayload(mesa),
            boucher: boucherData || boucherFromParams,
          });
        }}
      />

      {/* Modal de Pago Exitoso */}
      <ModalPagoExitoso
        visible={modalPagoExitosoVisible}
        onClose={() => {
          setModalPagoExitosoVisible(false);
          if (hayPendienteTrasPago || (totalRestante != null && totalRestante > 0)) {
            setBoucherData(null);
            setClienteSeleccionado(null);
          }
        }}
        boucherData={boucherData || boucherFromParams}
        mesaData={mesa}
        clienteData={clientePagoExitoso}
        onImprimir={() => generarBoucher(boucherData || boucherFromParams)}
        onRegistrarPropina={() => {
          setModalPagoExitosoVisible(false);
          setModalPropinaVisible(true);
        }}
        onIrAlInicio={() => {
          setComandas([]);
          setMesa(null);
          setClienteSeleccionado(null);
          setBoucherData(null);
          setModalPagoExitosoVisible(false);
          navigation.navigate("Inicio", {
            refresh: true,
            mesaId: mesa?._id?.toString?.() || mesa?._id,
            mostrarMensajePago: true,
            mesaPagada: buildMesaPagadaNavPayload(mesa),
            boucher: boucherData || boucherFromParams,
          });
        }}
      />

      {/* Overlay de Carga Animado - Procesando Pago */}
      {procesandoPago && (
        <AnimatedOverlay mensaje={mensajeCarga} />
      )}
    </SafeAreaView>
  );
};

const PagosScreenStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.md,
    ...theme.shadows.medium,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.light,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  infoConsolidadoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  parcialesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '33',
    ...theme.shadows.medium,
  },
  parcialesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  parcialesTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  parcialesSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  parcialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border || '#E5E7EB',
  },
  parcialItemBody: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  parcialItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  parcialVoucherId: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  },
  parcialNumero: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  parcialMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  parcialFecha: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  parcialPlatos: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  parcialPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    minWidth: 96,
    justifyContent: 'center',
  },
  parcialPrintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: "700",
  },
  platosCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  comandaHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  platoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  platoInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  platoNombre: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: "600",
    flex: 1,
  },
  platoCantidad: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  platoSubtotal: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  observacionesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  observacionesText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontStyle: "italic",
  },
  totalCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  totalRowFinal: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 2,
    borderTopColor: theme.colors.text.white,
  },
  totalLabel: {
    fontSize: 16,
    color: theme.colors.text.white,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 16,
    color: theme.colors.text.white,
    fontWeight: "600",
  },
  totalLabelFinal: {
    fontSize: 20,
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  totalValueFinal: {
    fontSize: 20,
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  buttonsContainer: {
    flexDirection: "row",
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    justifyContent: 'space-around',
  },
  buttonNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.medium,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'visible',
    minHeight: 52,
    marginHorizontal: theme.spacing.xs,
    ...theme.shadows.medium,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.accent,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 8,
    flexShrink: 0,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});

export default PagosScreen;

