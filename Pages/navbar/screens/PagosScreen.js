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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import axios from "axios";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight, textIconos } from "../../../constants/theme";
import { colors } from "../../../constants/colors";
import { COMANDA_API, MESAS_API_UPDATE, COMANDASEARCH_API_GET, BOUCHER_API, CLIENTES_API, SELECTABLE_API_GET, DISHES_API, apiConfig } from "../../../apiConfig";
import ModalClientes from "../../../Components/ModalClientes";
import IconoBoton from "../../../Components/IconoBoton";
import { useWindowDimensions } from "react-native";
import { useSocket } from "../../../context/SocketContext";
import logger from "../../../utils/logger";
import configuracionService from "../../../services/configuracionService";
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
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Procesando pago...");
  const [boucherData, setBoucherData] = useState(boucherFromParams || null);
  const [configMoneda, setConfigMoneda] = useState(null);

  // Obtener socket del contexto
  const { subscribeToEvents, connected: socketConnected } = useSocket();
  
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
  }, []);

  // ❌ DESHABILITADO: No actualizar comandas desde WebSocket en PagosScreen
  // Backend = única fuente de verdad. Solo usar route.params
  // Los handlers de WebSocket pueden mezclar comandas antiguas con nuevas
  const handleComandaActualizada = React.useCallback((comanda) => {
    console.log('📥 [PAGOS] Comanda actualizada vía WebSocket (ignorada en PagosScreen):', comanda._id, 'Status:', comanda.status);
    // NO actualizar estado local - usar solo route.params del backend
    // Si se necesita actualizar, recargar desde InicioScreen con nuevo endpoint
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
      // Si viene boucher desde "Imprimir Boucher", usar esos datos
      console.log("✅ Boucher recibido desde navegación (Imprimir Boucher)");
      setBoucherData(currentBoucher);
      // Limpiar comandas cuando se recibe boucher
      setComandas([]);
      if (currentBoucher.mesa) {
        const mesa = typeof currentBoucher.mesa === 'object' ? currentBoucher.mesa : { _id: currentBoucher.mesa, nummesa: currentBoucher.numMesa };
        setMesa(mesa);
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
  }, [route.params]); // ✅ Dependencia: route.params completo para detectar cualquier cambio

  // ✅ Suscribirse a eventos Socket cuando la pantalla está enfocada (solo para actualizaciones en tiempo real)
  // También recargar datos si vienen nuevos params al enfocar la pantalla
  useFocusEffect(
    React.useCallback(() => {
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
      } else if (currentBoucher) {
        console.log("🔄 [PAGOS] Actualizando boucher desde route.params al enfocar");
        setBoucherData(currentBoucher);
        // Limpiar comandas cuando se recibe boucher
        setComandas([]);
      } else if (!currentBoucher && !currentComandas) {
        // Si no hay datos, limpiar estado
        console.log("🔄 [PAGOS] No hay datos en params - LIMPIANDO estado");
        setComandas([]);
        setMesa(null);
        setTotal(0);
      }

      // Suscribirse a eventos
      subscribeToEvents({
        onComandaActualizada: handleComandaActualizada,
        onNuevaComanda: handleNuevaComanda
      });

      // Cleanup: desuscribirse
      return () => {
        subscribeToEvents({
          onComandaActualizada: null,
          onNuevaComanda: null
        });
      };
    }, [handleComandaActualizada, handleNuevaComanda, subscribeToEvents, route.params])
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

  useEffect(() => {
    totalAnim.value = withTiming(totalCalculado, {
      duration: 800,
      easing: Easing.inOut(Easing.ease),
    });
  }, [totalCalculado]);

  const animatedTotalStyle = useAnimatedStyle(() => ({
    opacity: totalAnim.value > 0 || infoDescuentos.descuentos.length > 0 ? 1 : 0.5,
  }));

  /**
   * Genera el HTML del boucher para el PDF
   * @param {Object|null} boucher - Datos del boucher del backend (opcional, si viene de "Imprimir Boucher")
   */
  const generarHTMLBoucher = (boucher = null) => {
    // Si hay boucher del backend, usar esos datos; si no, usar datos locales
    const usarBoucherBackend = boucher && boucher.platos && boucher.platos.length > 0;
    
    // Usar configuración del sistema o del boucher
    const simboloMoneda = boucher?.configuracionIGV?.simboloMoneda || configMoneda?.simboloMoneda || 'S/.';
    const decimales = configMoneda?.decimales ?? 2;
    const nombreImpuesto = boucher?.configuracionIGV?.nombreImpuesto || configMoneda?.nombreImpuestoPrincipal || 'IGV';
    const igvPorcentaje = boucher?.configuracionIGV?.igvPorcentaje || configMoneda?.igvPorcentaje || 18;
    
    const fechaActual = boucher?.fechaPagoString || moment().tz("America/Lima").format("DD/MM/YYYY HH:mm:ss");
    const primeraComanda = usarBoucherBackend ? null : comandas[0];
    const fecha = usarBoucherBackend 
      ? moment(boucher.fechaPago || boucher.createdAt).tz("America/Lima")
      : moment(primeraComanda?.createdAt || primeraComanda?.fecha).tz("America/Lima");
    const fechaFormateada = fecha.format("DD/MM/YYYY HH:mm:ss");
    
    // Obtener voucherId y boucherNumber del boucher o de los datos locales
    const voucherId = boucher?.voucherId || boucherData?.voucherId || "N/A";
    const boucherNumber = boucher?.boucherNumber || boucherData?.boucherNumber || "N/A";

    let itemsHTML = "";
    
    if (usarBoucherBackend) {
      // Usar platos del boucher del backend
      boucher.platos.forEach((platoItem) => {
        const cantidad = platoItem.cantidad || 1;
        const precio = platoItem.precio || 0;
        const subtotal = platoItem.subtotal || (precio * cantidad);
        const comandaNum = platoItem.comandaNumber || "";
        
        // Generar HTML de complementos si existen
        const complementos = platoItem.complementosSeleccionados || [];
        const complementosHTML = complementos.length > 0
          ? `<br/><span style="font-size: 10px; color: #666; font-style: italic;">${
              complementos.map(c =>
                `· ${Array.isArray(c.opcion) ? c.opcion.join(', ') : c.opcion}`
              ).join('<br/>')
            }</span>`
          : '';
        
        itemsHTML += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cantidad}x</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">
              ${platoItem.nombre || "Plato"} ${comandaNum ? `(C#${comandaNum})` : ''}
              ${complementosHTML}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${simboloMoneda} ${precio.toFixed(decimales)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${simboloMoneda} ${subtotal.toFixed(decimales)}</td>
          </tr>
        `;
      });
    } else {
      // Usar platos de las comandas locales
      comandas.forEach((comanda, comandaIndex) => {
        if (comanda.platos) {
          comanda.platos.forEach((platoItem, index) => {
            const plato = platoItem.plato || platoItem;
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = plato.precio || 0;
            const subtotal = precio * cantidad;
            const comandaNum = comanda.comandaNumber || comanda._id.slice(-6);
            
            // Generar HTML de complementos si existen
            const complementos = platoItem.complementosSeleccionados || [];
            const complementosHTML = complementos.length > 0
              ? `<br/><span style="font-size: 10px; color: #666; font-style: italic;">${
                  complementos.map(c =>
                    `· ${Array.isArray(c.opcion) ? c.opcion.join(', ') : c.opcion}`
                  ).join('<br/>')
                }</span>`
              : '';
            
            itemsHTML += `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cantidad}x</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">
                  ${plato.nombre || "Plato"} ${comandas.length > 1 ? `(C#${comandaNum})` : ''}
                  ${complementosHTML}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${simboloMoneda} ${precio.toFixed(decimales)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${simboloMoneda} ${subtotal.toFixed(decimales)}</td>
              </tr>
            `;
          });
        }
      });
    }
    
    // Calcular totales: usar del boucher si está disponible, si no calcular localmente
    // 🔥 NUEVO: Soporte para descuentos
    const descuentosComandas = usarBoucherBackend 
      ? (boucher.descuentos || []) 
      : comandas.filter(c => c.descuento > 0).map(c => ({
          comandaNumber: c.comandaNumber,
          porcentaje: c.descuento,
          motivo: c.motivoDescuento,
          monto: c.montoDescuento || 0
        }));
    
    const montoTotalDescuento = usarBoucherBackend 
      ? (boucher.montoDescuento || 0)
      : comandas.reduce((sum, c) => sum + (c.montoDescuento || 0), 0);
    
    // 🔥 FIX: Usar subtotalOriginal (pre-descuento) para voucher, no total post-descuento
    const subtotalFinal = boucher?.subtotal || subtotalOriginal || total;
    const igvFinal = boucher?.igv || (subtotalFinal * (igvPorcentaje / 100));
    const totalSinDescuento = boucher?.totalSinDescuento || (subtotalFinal + igvFinal);

    // 🔥 FIX: Usar totalConDescuento solo si hay descuento real (montoDescuento > 0)
    const tieneDescuentoBoucher = (boucher?.montoDescuento || 0) > 0 || (boucher?.descuentos?.length || 0) > 0;
    const totalFinal = tieneDescuentoBoucher && boucher?.totalConDescuento != null
      ? boucher.totalConDescuento
      : (boucher?.total != null ? boucher.total : Math.max(0, totalSinDescuento - montoTotalDescuento));
    
    // Obtener comandas numbers del boucher o de las comandas locales
    const comandasNumbers = boucher?.comandasNumbers || comandas.map(c => c.comandaNumber || c._id.slice(-6));
    const comandasNumbersStr = comandasNumbers.map(n => `#${n}`).join(', ');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-size: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .header h1 {
              margin: 5px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .info {
              margin: 10px 0;
              line-height: 1.6;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th {
              background-color: #f0f0f0;
              padding: 8px;
              text-align: left;
              font-weight: bold;
              border-bottom: 2px solid #000;
            }
            .total {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px solid #000;
              text-align: right;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            .observaciones {
              margin-top: 10px;
              padding: 8px;
              background-color: #f9f9f9;
              border-radius: 4px;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LAS GAMBUSINAS</h1>
            <p>Restaurante</p>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span><strong>Voucher ID:</strong></span>
              <span style="font-weight: bold; font-size: 14px;">${voucherId}</span>
            </div>
            <div class="info-row">
              <span><strong>Boucher #:</strong></span>
              <span>${boucherNumber}</span>
            </div>
            <div class="info-row">
              <span><strong>Comanda(s):</strong></span>
              <span>${comandasNumbersStr}</span>
            </div>
            <div class="info-row">
              <span><strong>Mesa:</strong></span>
              <span>${mesa?.nombreCombinado || boucher?.numMesa || mesa?.nummesa || comandas[0]?.mesas?.nummesa || "N/A"}</span>
            </div>
            <div class="info-row">
              <span><strong>Mozo:</strong></span>
              <span>${boucher?.nombreMozo || comandas[0]?.mozos?.name || "N/A"}</span>
            </div>
            <div class="info-row">
              <span><strong>Fecha Pedido:</strong></span>
              <span>${fechaFormateada}</span>
            </div>
            <div class="info-row">
              <span><strong>Fecha Pago:</strong></span>
              <span>${fechaActual}</span>
            </div>
            ${(boucher?.cliente?.nombre || clienteSeleccionado?.nombre) ? `
            <div class="info-row">
              <span><strong>Cliente:</strong></span>
              <span>${boucher?.cliente?.nombre || clienteSeleccionado?.nombre || 'N/A'}</span>
            </div>
            ` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Cant.</th>
                <th style="width: 45%;">Plato</th>
                <th style="width: 20%; text-align: right;">Precio</th>
                <th style="width: 20%; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          ${(boucher?.observaciones || comandas.some(c => c.observaciones)) ? `
            <div class="observaciones">
              <strong>Observaciones:</strong><br/>
              ${boucher?.observaciones || comandas.filter(c => c.observaciones).map(c => `C#${c.comandaNumber || c._id.slice(-6)}: ${c.observaciones}`).join('<br/>')}
            </div>
          ` : ""}

          <div class="total">
            <div class="total-row">
              <span>SUBTOTAL:</span>
              <span>${simboloMoneda} ${subtotalFinal.toFixed(decimales)}</span>
            </div>
            <div class="total-row">
              <span>${nombreImpuesto} (${igvPorcentaje}%):</span>
              <span>${simboloMoneda} ${igvFinal.toFixed(decimales)}</span>
            </div>
            ${descuentosComandas.length > 0 ? `
            <div class="total-row" style="color: #EF4444;">
              <span>DESCUENTO ${descuentosComandas.length === 1 ? `(${descuentosComandas[0].porcentaje}%)` : ''}:</span>
              <span>-${simboloMoneda} ${montoTotalDescuento.toFixed(decimales)}</span>
            </div>
            ${descuentosComandas.length > 1 ? `
            <div style="font-size: 10px; color: #666; margin-top: -5px; margin-bottom: 5px;">
              ${descuentosComandas.map(d => `C#${d.comandaNumber}: ${d.porcentaje}% - ${d.motivo}`).join('<br>')}
            </div>
            ` : `
            <div style="font-size: 10px; color: #666; margin-top: -5px; margin-bottom: 5px;">
              ${descuentosComandas[0]?.motivo || ''}
            </div>
            `}
            ` : ''}
            <div class="total-row" style="font-size: 16px; margin-top: 10px;">
              <span>TOTAL:</span>
              <span>${simboloMoneda} ${totalFinal.toFixed(decimales)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Gracias por su visita</p>
            <p>${fechaActual}</p>
          </div>
        </body>
      </html>
    `;

    return html;
  };

  /**
   * Genera el PDF del boucher
   * @param {Object|null} boucher - Datos del boucher del backend (opcional, si viene de "Imprimir Boucher")
   */
  const generarPDF = async (boucher = null) => {
    // Si hay boucher del backend, usarlo directamente; si no, verificar comandas locales
    if (!boucher) {
      // Verificar que haya comandas antes de generar el PDF
      if (!comandas || comandas.length === 0) {
        // No mostrar alerta, simplemente no hacer nada
        return;
      }

      // Verificar que las comandas tengan platos
      const comandasConPlatos = comandas.filter(c => c.platos && c.platos.length > 0);
      if (comandasConPlatos.length === 0) {
        // No mostrar alerta, simplemente no hacer nada
        return;
      }
    }

    try {
      setIsGenerating(true);
      const html = generarHTMLBoucher(boucher || boucherData);
      
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      Alert.alert(
        "✅ PDF Generado",
        "¿Qué deseas hacer?",
        [
          {
            text: "Imprimir",
            onPress: async () => {
              try {
                await Print.printAsync({ uri });
              } catch (error) {
                console.error("Error imprimiendo:", error);
                Alert.alert("Error", "No se pudo imprimir el documento");
              }
            }
          },
          {
            text: "Compartir",
            onPress: async () => {
              try {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                } else {
                  Alert.alert("Error", "La función de compartir no está disponible");
                }
              } catch (error) {
                console.error("Error compartiendo:", error);
                Alert.alert("Error", "No se pudo compartir el documento");
              }
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      console.error("Error generando PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF");
    } finally {
      setIsGenerating(false);
    }
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
        "Esta mesa ya ha sido pagada. Solo puedes generar el boucher.",
        [
          {
            text: "Generar Boucher",
            onPress: async () => {
              await generarPDF();
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
  const validarComandasParaPago = async (comandasIds, mesaId) => {
    try {
      setMensajeCarga("Obteniendo comandas frescas del servidor...");
      
      // 🔥 CRÍTICO: Obtener comandas FRESCAS del backend por fecha y filtrar por mesa
      // Esto asegura que tenemos el estado más reciente después de eliminar platos
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
      
      // Obtener todas las comandas del día y filtrar por mesa
      const mesaIdStr = mesaId?.toString() || mesaId;
      const comandasResponse = await axios.get(comandasURL, { timeout: 10000 });
      
      const todasLasComandas = Array.isArray(comandasResponse.data) 
        ? comandasResponse.data 
        : (comandasResponse.data?.comandas || []);
      
      // Filtrar comandas de esta mesa que NO estén pagadas
      const comandasBackend = todasLasComandas.filter(c => {
        const comandaMesaId = c.mesas?._id?.toString() || c.mesas?.toString() || c.mesas;
        const comandaMesaNum = c.mesas?.nummesa;
        const coincideMesa = comandaMesaId === mesaIdStr || 
                            (comandaMesaNum && comandaMesaNum.toString() === mesaIdStr);
        const noPagada = c.status?.toLowerCase() !== 'pagado' && c.status?.toLowerCase() !== 'completado';
        return coincideMesa && noPagada;
      });
      
      console.log(`✅ [VALIDACIÓN] Obtenidas ${comandasBackend.length} comanda(s) fresca(s) del backend para mesa ${mesaIdStr?.slice(-6)}`);
      
      if (comandasIds.length > 0) {
        console.log(`🔍 [VALIDACIÓN] Validando ${comandasIds.length} ID(s) específico(s):`, comandasIds.map(id => id?.slice(-6)));
      } else {
        console.log(`🔍 [VALIDACIÓN] Obteniendo todas las comandas válidas de la mesa (sin filtrar por IDs)`);
      }
      
      // Filtrar comandas válidas (no eliminadas, no pagadas, con platos válidos)
      const comandasValidas = comandasBackend.filter(c => {
        const comandaMesaId = c.mesas?._id?.toString() || c.mesas?.toString() || c.mesas;
        const mesaIdStr = mesaId?.toString() || mesaId;
        
        // Validaciones críticas:
        const noEliminada = c.eliminada !== true; // Comanda no eliminada completamente
        const noPagada = c.status?.toLowerCase() !== 'pagado';
        const mismaMesa = comandaMesaId === mesaIdStr;
        const tienePlatos = c.platos && c.platos.length > 0;
        // 🔥 CORREGIDO: El sistema usa SOFT DELETE (eliminado=true, anulado=true)
        // Los platos anulados desde cocina tienen eliminado=true y anulado=true
        // Deben filtrarse para que no cuenten en el pago
        const platosActivos = c.platos?.filter(p => p.eliminado !== true && p.anulado !== true) || [];
        const tienePlatosNoEliminados = platosActivos.length > 0;
        
        const esValida = noEliminada && noPagada && mismaMesa && tienePlatos && tienePlatosNoEliminados;
        
        if (!esValida) {
          const razon = !noEliminada ? 'eliminada' : 
                       !noPagada ? 'ya pagada' : 
                       !mismaMesa ? 'mesa diferente' : 
                       !tienePlatos ? 'sin platos' : 
                       !tienePlatosNoEliminados ? 'sin platos válidos' : 'desconocida';
          console.warn(`⚠️ [VALIDACIÓN] Comanda #${c.comandaNumber || c._id?.slice(-6)} inválida: ${razon}`);
        }
        
        return esValida;
      });
      
      // Filtrar comandas inválidas para logging
      const comandasInvalidas = comandasBackend.filter(c => {
        const comandaMesaId = c.mesas?._id?.toString() || c.mesas?.toString() || c.mesas;
        const mesaIdStr = mesaId?.toString() || mesaId;
        
        const noEliminada = c.eliminada !== true;
        const noPagada = c.status?.toLowerCase() !== 'pagado';
        const mismaMesa = comandaMesaId === mesaIdStr;
        const tienePlatos = c.platos && c.platos.length > 0;
        // 🔥 CORREGIDO: El sistema usa SOFT DELETE (eliminado=true, anulado=true)
        // Los platos anulados desde cocina tienen eliminado=true y anulado=true
        const platosActivos = c.platos?.filter(p => p.eliminado !== true && p.anulado !== true) || [];
        const tienePlatosNoEliminados = platosActivos.length > 0;
        
        return !(noEliminada && noPagada && mismaMesa && tienePlatos && tienePlatosNoEliminados);
      });
      
      // Verificar si los IDs originales están en las comandas válidas (solo si se pasaron IDs)
      const comandasIdsValidas = comandasValidas.map(c => {
        const id = c._id?.toString() || c._id;
        return id;
      });
      
      // 🔥 CRÍTICO: Inicializar idsNoEncontrados fuera del bloque if
      let idsNoEncontrados = [];
      
      if (comandasIds.length > 0) {
        // Se pasaron IDs específicos, verificar si están en las válidas
        idsNoEncontrados = comandasIds.filter(id => {
          const idStr = id?.toString() || id;
          return !comandasIdsValidas.includes(idStr);
        });
        
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
      
      // Verificar si todas las comandas solicitadas están en las válidas
      const todasValidas = comandasIds.length > 0 ? comandasIds.every(id => {
        const idStr = id?.toString() || id;
        return comandasIdsValidas.includes(idStr);
      }) : true; // Si no se pasaron IDs, considerar todas válidas
      
      return {
        validas: comandasValidas,
        invalidas: comandasInvalidas,
        todasValidas: comandasIds.length > 0 ? (todasValidas && comandasValidas.length === comandasIds.length) : true,
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
  const procesarPagoConCliente = async (cliente) => {
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

    // ✅ Activar loading DESPUÉS de validaciones
    setProcesandoPago(true);
    setMensajeCarga("Procesando pago...");
    
    try {
      console.log("💳 [PAGO] Iniciando procesamiento:", {
        cliente: cliente.nombre || cliente._id,
        clienteId: cliente._id?.slice(-6),
        cantidadComandas: comandasFinales.length,
        mesa: mesaFinal.nummesa,
        total: totalFinal
      });
      
      console.log("📋 [PAGO] Comandas para pagar (SOLO del backend):", comandasFinales.map(c => ({
        _id: c._id?.slice(-6),
        comandaNumber: c.comandaNumber,
        status: c.status
      })));

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
      
      // 🔥 CRÍTICO: Obtener comandas FRESCAS del backend ANTES de extraer IDs
      // Esto asegura que usamos el estado más reciente después de eliminar platos
      console.log("🔄 [PAGO] Obteniendo comandas frescas del backend (ignorando route.params si es necesario)...");
      setMensajeCarga("Obteniendo comandas actualizadas del servidor...");
      
      // Obtener TODAS las comandas válidas de la mesa desde el backend (ignorar route.params)
      const validacion = await validarComandasParaPago([], mesaIdFinal);
      
      if (validacion.validas.length === 0) {
        // No hay comandas válidas en el backend
        let mensaje = "No hay comandas válidas para pagar en esta mesa.";
        
        if (validacion.invalidas.length > 0) {
          const razones = validacion.invalidas.map(c => {
            if (c.eliminada === true) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} eliminada`;
            if (c.status?.toLowerCase() === 'pagado') return `Comanda #${c.comandaNumber || c._id?.slice(-6)} ya pagada`;
            if (!c.platos || c.platos.length === 0) return `Comanda #${c.comandaNumber || c._id?.slice(-6)} sin platos`;
            return `Comanda #${c.comandaNumber || c._id?.slice(-6)} inválida`;
          });
          mensaje += `\n\nComandas encontradas pero inválidas:\n${razones.join('\n')}`;
        }
        
        // Comparar con route.params para informar al usuario
        const comandasIdsDeParams = comandasFinales.map(c => {
          let comandaId = c._id;
          if (comandaId && typeof comandaId === 'object') {
            comandaId = comandaId.toString();
          }
          return comandaId;
        });
        
        if (comandasIdsDeParams.length > 0) {
          console.warn(`⚠️ [PAGO] IDs de route.params que ya no son válidos:`, comandasIdsDeParams.map(id => id?.slice(-6)));
          mensaje += `\n\nNota: Las comandas que intentaste pagar ya no están disponibles (posiblemente eliminadas después de eliminar platos).`;
        }
        
        setProcesandoPago(false);
        Alert.alert("Error", mensaje);
        return;
      }
      
      // 🔥 USAR SOLO las comandas válidas del backend (ignorar route.params si hay discrepancias)
      const comandasIdsFinales = validacion.validas.map(c => {
        const id = c._id?.toString() || c._id;
        return id;
      });
      
      // Comparar con route.params para logging
      const comandasIdsDeParams = comandasFinales.map(c => {
        let comandaId = c._id;
        if (comandaId && typeof comandaId === 'object') {
          comandaId = comandaId.toString();
        }
        return comandaId;
      });
      
      const idsDiferentes = comandasIdsDeParams.filter(id => !comandasIdsFinales.includes(id));
      if (idsDiferentes.length > 0) {
        console.warn(`⚠️ [PAGO] IDs de route.params que ya no son válidos (usando comandas frescas del backend):`, idsDiferentes.map(id => id?.slice(-6)));
        console.log(`✅ [PAGO] Usando ${comandasIdsFinales.length} comanda(s) válida(s) del backend en lugar de ${comandasIdsDeParams.length} de route.params`);
        
        // Informar al usuario si hay diferencias significativas
        if (comandasIdsFinales.length < comandasIdsDeParams.length) {
          const comandasEliminadas = comandasIdsDeParams.length - comandasIdsFinales.length;
          Alert.alert(
            "⚠️ Comandas actualizadas",
            `${comandasEliminadas} comanda(s) ya no está(n) disponible(s) (posiblemente eliminadas). Procesando ${comandasIdsFinales.length} comanda(s) válida(s).`,
            [{ text: "Continuar", onPress: () => {} }]
          );
        }
      } else {
        console.log(`✅ [PAGO] IDs de route.params coinciden con comandas válidas del backend`);
      }
      
      const boucherData = {
        mesaId: mesaIdFinal,
        mozoId: mozoId,
        clienteId: cliente._id,
        comandasIds: comandasIdsFinales, // Solo comandas válidas
        observaciones: comandasFinales.map(c => c.observaciones).filter(o => o).join("; ") || ""
      };
      
      console.log("📤 [PAGO] Enviando al backend:", {
        mesaId: mesaIdFinal,
        cantidadComandas: boucherData.comandasIds.length,
        comandasIds: boucherData.comandasIds.map(id => id?.slice(-6))
      });

      setMensajeCarga("Creando boucher y procesando pago...");
      
      // ✅ POST con timeout y manejo de errores específico
      let boucherCreado;
      try {
        const boucherResponse = await axios.post(boucherURL, boucherData, { 
          timeout: 15000, // Aumentado a 15s para conexiones lentas
          validateStatus: (status) => status < 500 // No lanzar error para 4xx
        });
        
        // Verificar si hay error en la respuesta
        if (boucherResponse.status >= 400) {
          const errorMsg = boucherResponse.data?.message || `Error ${boucherResponse.status}: ${boucherResponse.statusText}`;
          throw new Error(errorMsg);
        }
        
        boucherCreado = boucherResponse.data;
        
        if (!boucherCreado || !boucherCreado._id) {
          throw new Error("El backend no retornó un boucher válido");
        }
        
        console.log("✅ [PAGO] Boucher creado exitosamente:", {
          boucherId: boucherCreado._id?.slice(-6),
          boucherNumber: boucherCreado.boucherNumber,
          voucherId: boucherCreado.voucherId
        });
      } catch (postError) {
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
                const comandasFrescas = await validarComandasParaPago([], mesaIdFinal);
                if (comandasFrescas.validas.length > 0) {
                  // Usar las comandas válidas encontradas
                  const comandasIdsValidas = comandasFrescas.validas.map(c => {
                    const id = c._id?.toString() || c._id;
                    return id;
                  });
                  
                  // Actualizar boucherData con solo comandas válidas
                  boucherData.comandasIds = comandasIdsValidas;
                  
                  // Retry automático con comandas válidas
                  setMensajeCarga("Reintentando con comandas válidas del servidor...");
                  const retryResponse = await axios.post(boucherURL, boucherData, { 
                    timeout: 15000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (retryResponse.status >= 400) {
                    throw new Error(retryResponse.data?.message || `Error ${retryResponse.status}`);
                  }
                  
                  boucherCreado = retryResponse.data;
                  
                  if (!boucherCreado || !boucherCreado._id) {
                    throw new Error("El backend no retornó un boucher válido");
                  }
                  
                  console.log("✅ [PAGO] Boucher creado después de retry con comandas frescas:", {
                    boucherId: boucherCreado._id?.slice(-6),
                    boucherNumber: boucherCreado.boucherNumber
                  });
                  
                  // Continuar con el flujo normal
                  return; // Salir del catch para continuar con el flujo de éxito
                }
              } catch (retryError) {
                console.error("❌ [PAGO] Error en retry con comandas frescas:", retryError);
                // Continuar con el manejo de error original
              }
            }
            
            if (comandasValidasDelError.length > 0) {
              // Hay comandas válidas, retry automático
              console.log(`🔄 [PAGO] Retry automático con ${comandasValidasDelError.length} comanda(s) válida(s)`);
              
              // Extraer IDs de comandas válidas
              const comandasIdsValidas = comandasValidasDelError.map(c => {
                const id = c._id?.toString() || c._id || c;
                return id;
              });
              
              // Actualizar boucherData con solo comandas válidas
              boucherData.comandasIds = comandasIdsValidas;
              
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
                
                boucherCreado = retryResponse.data;
                
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
            } else {
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
          
          if (status === 404) {
            throw new Error("Mesa o comandas no encontradas. Por favor, recarga la pantalla.");
          } else if (status === 400) {
            // Mejorar mensaje de error 400 con detalles del backend
            const backendError = errorData.error || errorData.message || errorMsg;
            const detalles = errorData.details ? `\n\nDetalles: ${JSON.stringify(errorData.details)}` : '';
            throw new Error(`Datos inválidos: ${backendError}${detalles}`);
          } else if (status === 500) {
            throw new Error("Error en el servidor. Por favor, intenta nuevamente o contacta al administrador.");
          } else {
            throw new Error(`Error ${status}: ${errorMsg}`);
          }
        }
        throw postError; // Re-lanzar si no es un error conocido
      }
      
      // 🔥 Si llegamos aquí, el boucher se creó exitosamente (ya sea en el primer intento o en el retry)
      // Continuar con el flujo de éxito
      // NOTA: Si el retry fue exitoso, boucherCreado ya está asignado y no se lanzó error

      // Guardar boucher en estado local
      if (boucherCreado && boucherCreado._id) {
        setBoucherData(boucherCreado);
      } else {
        throw new Error("No se pudo crear el boucher. Por favor, intenta nuevamente.");
      }

      // ✅ MEJORADO: Actualizar estado de la mesa con verificación activa y reintentos
      let mesaVerificadaComoPagada = false;
      
      if (mesaFinal && mesaIdFinal) {
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
        
        const MAX_REINTENTOS = 3;
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
          
          // Pequeña pausa para dar tiempo al backend a procesar
          await new Promise(resolve => setTimeout(resolve, 500));
          
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

      // Generar PDF con el boucher creado
      setMensajeCarga("Generando voucher...");
      try {
        await generarPDF(boucherCreado);
        console.log("✅ [PAGO] PDF generado exitosamente");
      } catch (pdfError) {
        console.error("⚠️ [PAGO] Error generando PDF (continuando de todas formas):", pdfError);
        // No bloquear el flujo si falla la generación del PDF
      }

      // ✅ Guardar boucher y mesa para InicioScreen (mensaje post-pago, imprimir, liberar)
      const mesaIdStr = mesaFinal._id?.toString?.() || mesaFinal._id;
      const mesaPagadaPayload = { _id: mesaFinal._id, nummesa: mesaFinal.nummesa };
      try {
        await AsyncStorage.setItem("ultimoBoucher", JSON.stringify(boucherCreado));
        await AsyncStorage.setItem("mesaPagada", JSON.stringify(mesaPagadaPayload));
      } catch (e) {
        console.warn("⚠️ [PAGO] No se pudo guardar ultimoBoucher/mesaPagada:", e?.message);
      }

      // ✅ Cerrar overlay de carga ANTES del Alert
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");

      // ✅ Construir mensaje según estado de verificación
      const estadoMesaMsg = mesaVerificadaComoPagada 
        ? `La mesa ${mesaFinal.nummesa} está en estado 'Pagado' (verificado).`
        : `⚠️ La mesa ${mesaFinal.nummesa} podría tardar unos segundos en actualizarse.`;

      // ✅ Mostrar alerta de éxito y navegar a Inicio con params para refresh + mensaje verde
      Alert.alert(
        "✅ Pago Exitoso",
        `Pago procesado y voucher generado.\n\nCliente: ${cliente.nombre || "Invitado"}\nVoucher ID: ${boucherCreado.voucherId}\n\n${estadoMesaMsg}\n\nSerás redirigido al inicio.`,
        [
          {
            text: "OK",
            onPress: () => {
              setComandas([]);
              setMesa(null);
              setClienteSeleccionado(null);
              setBoucherData(null);
              navigation.navigate("Inicio", {
                refresh: true,
                mesaId: mesaIdStr,
                mostrarMensajePago: true,
                mesaPagada: mesaPagadaPayload,
                boucher: boucherCreado,
              });
            }
          }
        ]
      );
      
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
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
          <Text style={styles.sectionTitle}>Platos</Text>
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
                              · {Array.isArray(comp.opcion) ? comp.opcion.join(', ') : comp.opcion}
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
          ) : (
            // Mostrar platos de las comandas - usar route.params directamente si comandas está vacío
            (() => {
              // Leer route.params directamente para asegurar datos actualizados
              const paramsParaRender = route.params || {};
              const comandasDeParamsParaRender = paramsParaRender.comandasParaPagar || [];
              const comandasParaMostrar = comandas.length > 0 ? comandas : comandasDeParamsParaRender;
              
              console.log("📋 [PAGOS] Renderizando platos:", {
                usandoComandas: comandas.length > 0,
                usandoComandasParaPagar: comandas.length === 0 && comandasDeParamsParaRender.length > 0,
                cantidadComandas: comandasParaMostrar.length,
                primeraComandaPlatos: comandasParaMostrar[0]?.platos?.length || 0,
                primeraComandaId: comandasParaMostrar[0]?._id?.slice(-6) || 'N/A',
                platosDetalle: comandasParaMostrar[0]?.platos?.map((p, i) => ({
                  index: i,
                  nombre: p.plato?.nombre || p.nombre || 'Sin nombre',
                  precio: p.plato?.precio || p.precio || 0,
                  tienePlato: !!p.plato,
                  tieneNombre: !!(p.plato?.nombre || p.nombre)
                })) || []
              });
              
              if (comandasParaMostrar.length === 0) {
                return (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.text.secondary }}>
                      No hay platos para mostrar
                    </Text>
                  </View>
                );
              }
              
              // Verificar que haya al menos una comanda con platos
              const comandasConPlatos = comandasParaMostrar.filter(c => 
                c.platos && Array.isArray(c.platos) && c.platos.length > 0
              );
              
              if (comandasConPlatos.length === 0) {
                return (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.text.secondary }}>
                      Las comandas no tienen platos disponibles
                    </Text>
                  </View>
                );
              }
              
              return comandasParaMostrar.map((comanda, comandaIndex) => {
                // Verificar que la comanda tenga platos
                if (!comanda.platos || !Array.isArray(comanda.platos) || comanda.platos.length === 0) {
                  return null;
                }
                
                return (
                  <View key={comanda._id || comandaIndex}>
                    {comandasParaMostrar.length > 1 && (
                      <Text style={styles.comandaHeader}>
                        Comanda #{comanda.comandaNumber || comanda._id?.slice(-6) || comandaIndex + 1}
                      </Text>
                    )}
                    {comanda.platos.map((platoItem, index) => {
                      // Manejar diferentes estructuras de platoItem
                      const plato = platoItem.plato || platoItem;
                      const cantidad = comanda.cantidades?.[index] || platoItem.cantidad || 1;
                      const precio = plato?.precio || platoItem.precio || 0;
                      const nombre = plato?.nombre || platoItem.nombre || "Plato";
                      const subtotal = precio * cantidad;
                      
                      // 🔥 CORREGIDO: Solo mostrar platos no eliminados NI anulados
                      // Los platos anulados desde cocina tienen eliminado=true Y anulado=true
                      if (platoItem.eliminado || platoItem.anulado) {
                        return null;
                      }
                      
                      return (
                        <View key={`${comandaIndex}-${index}`} style={styles.platoItem}>
                          <View style={styles.platoInfo}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.platoNombre}>{nombre}</Text>
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
                                      · {Array.isArray(comp.opcion) ? comp.opcion.join(', ') : comp.opcion}
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
                    })}
                  </View>
                );
              }).filter(Boolean); // Filtrar nulls
            })()
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
                // 🔥 FIX: Usar subtotalOriginal (pre-descuento) para mostrar siempre el subtotal real
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
                // 🔥 FIX: Usar subtotalOriginal (pre-descuento) para IGV correcto
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
                // 🔥 FIX: Calcular total final usando subtotalOriginal y restando descuento
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
            generarPDF(boucherData || boucherFromParams);
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
                <MaterialCommunityIcons name="file-pdf-box" size={28 * escala} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                  Generar Boucher
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Solo mostrar botón "Pagar" si la mesa no está ya pagada */}
        {mesa?.estado?.toLowerCase() !== "pagado" && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handlePagar();
            }}
            disabled={isGenerating}
            activeOpacity={0.8}
            style={{ flex: 1, opacity: isGenerating ? 0.5 : 1 }}
          >
            <View style={[styles.buttonNew, { minHeight: 60 * escala, backgroundColor: colors.success }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * escala }}>
                <MaterialCommunityIcons name="cash-multiple" size={28 * escala} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                  Confirmar Pago
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

