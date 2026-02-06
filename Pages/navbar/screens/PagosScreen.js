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
  const { mesa: mesaParam, comandasParaPagar, totalPendiente, boucher: boucherFromParams } = routeParams;
  
  const [comandas, setComandas] = useState([]);
  const [mesa, setMesa] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalClienteVisible, setModalClienteVisible] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Procesando pago...");
  const [boucherData, setBoucherData] = useState(boucherFromParams || null);

  // Obtener socket del contexto
  const { subscribeToEvents, connected: socketConnected } = useSocket();

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
    comandasACalcular.forEach((comanda) => {
      if (comanda.platos) {
        comanda.platos.forEach((platoItem, index) => {
          // Solo contar platos no eliminados
          if (!platoItem.eliminado) {
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
    comandasParaCalcular.forEach((comanda) => {
      if (comanda.platos) {
        comanda.platos.forEach((platoItem, index) => {
          // Solo contar platos no eliminados
          if (!platoItem.eliminado) {
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = platoItem.plato?.precio || platoItem.precio || 0;
            total += precio * cantidad;
          }
        });
      }
    });
    return total || totalPendienteDeParams || 0;
  }, [comandas, route.params]); // ✅ Dependencia: route.params para detectar cambios

  useEffect(() => {
    totalAnim.value = withTiming(totalCalculado, {
      duration: 800,
      easing: Easing.inOut(Easing.ease),
    });
  }, [totalCalculado]);

  const animatedTotalStyle = useAnimatedStyle(() => ({
    opacity: totalAnim.value > 0 ? 1 : 0.5,
  }));

  /**
   * Genera el HTML del boucher para el PDF
   * @param {Object|null} boucher - Datos del boucher del backend (opcional, si viene de "Imprimir Boucher")
   */
  const generarHTMLBoucher = (boucher = null) => {
    // Si hay boucher del backend, usar esos datos; si no, usar datos locales
    const usarBoucherBackend = boucher && boucher.platos && boucher.platos.length > 0;
    
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
        itemsHTML += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cantidad}x</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">${platoItem.nombre || "Plato"} ${comandaNum ? `(C#${comandaNum})` : ''}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${precio.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${subtotal.toFixed(2)}</td>
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
            itemsHTML += `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cantidad}x</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">${plato.nombre || "Plato"} ${comandas.length > 1 ? `(C#${comandaNum})` : ''}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${precio.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${subtotal.toFixed(2)}</td>
              </tr>
            `;
          });
        }
      });
    }
    
    // Calcular totales: usar del boucher si está disponible, si no calcular localmente
    const subtotalFinal = boucher?.subtotal || total;
    const igvFinal = boucher?.igv || (total * 0.18);
    const totalFinal = boucher?.total || (total * 1.18);
    
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
              <span>${boucher?.numMesa || mesa?.nummesa || comandas[0]?.mesas?.nummesa || "N/A"}</span>
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
              <span>S/. ${subtotalFinal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>IGV (18%):</span>
              <span>S/. ${igvFinal.toFixed(2)}</span>
            </div>
            <div class="total-row" style="font-size: 16px; margin-top: 10px;">
              <span>TOTAL:</span>
              <span>S/. ${totalFinal.toFixed(2)}</span>
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
  const procesarPagoConCliente = async (cliente) => {
    setProcesandoPago(true);
    setMensajeCarga("Procesando pago...");
    
    try {
      // ✅ Leer comandas SOLO de route.params (backend = única fuente de verdad)
      const paramsParaPago = route.params || {};
      const comandasParaPagar = paramsParaPago.comandasParaPagar || [];
      const mesaParaPago = paramsParaPago.mesa || mesa;
      
      // Si no hay comandas en params, usar estado local (fallback)
      const comandasFinales = comandasParaPagar.length > 0 ? comandasParaPagar : comandas;
      const mesaFinal = mesaParaPago || mesa;
      
      if (comandasFinales.length === 0) {
        throw new Error("No hay comandas para pagar");
      }
      
      if (!mesaFinal || !mesaFinal._id) {
        throw new Error("No se pudo obtener la información de la mesa");
      }
      
      console.log("💳 Procesando pago con cliente:", cliente.nombre || cliente._id);
      console.log("📋 Comandas para pagar (SOLO del backend):", comandasFinales.map(c => ({
        _id: c._id?.slice(-6),
        comandaNumber: c.comandaNumber,
        status: c.status
      })));

      // Obtener mozoId del contexto o de las comandas
      const mozoId = comandasFinales[0]?.mozos?._id || comandasFinales[0]?.mozos;
      if (!mozoId) {
        throw new Error("No se pudo obtener el ID del mozo");
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
        comandasIds: comandasFinales.map(c => {
          // Extraer ID de forma segura
          let comandaId = c._id;
          if (comandaId && typeof comandaId === 'object') {
            comandaId = comandaId.toString();
          }
          return comandaId;
        }), // ← EXACTAMENTE estas comandas del backend (route.params)
        observaciones: comandasFinales.map(c => c.observaciones).filter(o => o).join("; ") || ""
      };
      
      console.log("📤 [PAGO] Enviando al backend:", {
        mesaId: mesaIdFinal,
        cantidadComandas: boucherData.comandasIds.length,
        comandasIds: boucherData.comandasIds.map(id => id?.slice(-6))
      });

      setMensajeCarga("Creando boucher y procesando pago...");
      const boucherResponse = await axios.post(boucherURL, boucherData, { timeout: 10000 });
      const boucherCreado = boucherResponse.data;
      
      console.log("✅ Boucher creado:", boucherCreado.boucherNumber || boucherCreado._id);
      console.log("✅ VoucherId:", boucherCreado.voucherId);
      console.log("✅ Comandas marcadas como pagadas automáticamente por el backend");

      // Guardar boucher en estado local
      setBoucherData(boucherCreado);

      // Actualizar estado de la mesa a "pagado"
      if (mesaFinal && mesaIdFinal) {
        try {
          setMensajeCarga("Actualizando estado de la mesa...");
          
          console.log(`🔄 Actualizando mesa ${mesaFinal.nummesa} a estado "pagado"...`);
          
          // Actualizar mesa a "pagado"
          const mesaUpdateURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/mesas')}/${mesaIdFinal}/estado`
            : `${MESAS_API_UPDATE}/${mesaIdFinal}/estado`;
          
          await axios.put(
            mesaUpdateURL,
            { estado: "pagado" },
            { timeout: 5000 }
          );
          
          console.log(`✅ Mesa ${mesaFinal.nummesa} actualizada a estado "pagado"`);
          
          // Actualizar estado local de la mesa
          setMesa(prev => prev ? { ...prev, estado: "pagado" } : null);
        } catch (error) {
          console.error(`❌ Error actualizando estado de la mesa:`, error);
          // No bloquear el flujo si falla la actualización de la mesa
          // El backend debería haber actualizado la mesa automáticamente
        }
      }

      // Generar PDF con el boucher creado
      setMensajeCarga("Generando voucher...");
      await generarPDF(boucherCreado);

      // Cerrar overlay de carga
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");

      Alert.alert(
        "✅", 
        `Pago procesado y voucher generado.\n\nCliente: ${cliente.nombre}\nVoucher ID: ${boucherCreado.voucherId}\n\nLa mesa ahora está en estado 'Pagado'. Puedes liberarla desde la pantalla de Inicio.`
      );
      
      // Limpiar estado y volver a Inicio
      setComandas([]);
      setMesa(null);
      setClienteSeleccionado(null);
      navigation.navigate("Inicio");
    } catch (error) {
      console.error("❌ Error procesando pago:", error);
      setProcesandoPago(false);
      setMensajeCarga("Procesando pago...");
      
      const errorMessage = error.response?.data?.message || error.message || "No se pudo procesar el pago";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleClienteSeleccionado = (cliente) => {
    setClienteSeleccionado(cliente);
    setModalClienteVisible(false);
    
    // Mostrar confirmación antes de procesar el pago
    Alert.alert(
      "Confirmar Pago",
      `¿Deseas continuar con el pago para el cliente ${cliente.nombre || "Invitado"}?\n\nTotal: S/. ${(total * 1.18).toFixed(2)}`,
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
              {(boucherData || boucherFromParams)?.numMesa || 
               mesa?.nummesa || 
               mesaParam?.nummesa ||
               (() => {
                 // Leer route.params directamente
                 const paramsParaMesa = route.params || {};
                 const comandasDeParamsParaMesa = paramsParaMesa.comandasParaPagar || [];
                 const comandasParaMostrar = comandas.length > 0 ? comandas : comandasDeParamsParaMesa;
                 return comandasParaMostrar[0]?.mesas?.nummesa || paramsParaMesa.mesa?.nummesa || "N/A";
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
                    <Text style={styles.platoNombre}>{platoItem.nombre || "Plato"}</Text>
                    <Text style={styles.platoCantidad}>x{cantidad}</Text>
                  </View>
                  <Text style={styles.platoSubtotal}>S/. {subtotal.toFixed(2)}</Text>
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
                      
                      // Solo mostrar platos no eliminados
                      if (platoItem.eliminado) {
                        return null;
                      }
                      
                      return (
                        <View key={`${comandaIndex}-${index}`} style={styles.platoItem}>
                          <View style={styles.platoInfo}>
                            <Text style={styles.platoNombre}>{nombre}</Text>
                            <Text style={styles.platoCantidad}>x{cantidad}</Text>
                          </View>
                          <Text style={styles.platoSubtotal}>S/. {subtotal.toFixed(2)}</Text>
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
              S/. {(() => {
                if (boucherData || boucherFromParams) {
                  return ((boucherData || boucherFromParams)?.subtotal || 0).toFixed(2);
                }
                const subtotalFinal = total || totalPendiente || 0;
                return subtotalFinal.toFixed(2);
              })()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IGV (18%):</Text>
            <Text style={styles.totalValue}>
              S/. {(() => {
                if (boucherData || boucherFromParams) {
                  return ((boucherData || boucherFromParams)?.igv || 0).toFixed(2);
                }
                const subtotalFinal = total || totalPendiente || 0;
                return (subtotalFinal * 0.18).toFixed(2);
              })()}
            </Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>TOTAL:</Text>
            <Text style={styles.totalValueFinal}>
              S/. {(() => {
                if (boucherData || boucherFromParams) {
                  return ((boucherData || boucherFromParams)?.total || 0).toFixed(2);
                }
                const subtotalFinal = total || totalPendiente || 0;
                return (subtotalFinal * 1.18).toFixed(2);
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

