import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
// 🔥 Usar axios configurado globalmente (timeout 10s, anti-bloqueo)
import axios from "../../../config/axiosConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET, COMANDA_API, DISHES_API, AREAS_API, MESAS_API_UPDATE, apiConfig } from "../../../apiConfig";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { colors } from "../../../constants/colors";
import logger from "../../../utils/logger";
import { useSocket } from "../../../context/SocketContext";
// Animaciones Premium 60fps
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  withTranslateX,
  runOnJS,
  SlideInRight,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { MotiPressable } from 'moti';
import * as Haptics from 'expo-haptics';
import { slideInRightDelay, springConfig } from "../../../constants/animations";
import { LinearGradient } from 'expo-linear-gradient';
import { filtrarComandasActivas } from '../../../utils/comandaHelpers';
import { verificarYActualizarEstadoComanda, verificarComandasEnLote, invalidarCacheComandasVerificadas } from '../../../utils/verificarEstadoComanda';

// Componente de Loading con Verificaciones Paso a Paso
const LoadingVerificacionEliminar = ({ visible, mensaje, pasos = [] }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      fadeAnim.value = withTiming(1, { duration: 300 });
    } else {
      fadeAnim.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  if (!visible) return null;

  const getPasoIcono = (status) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'progress':
        return '🔄';
      case 'error':
        return '⚠️';
      default:
        return '⏳';
    }
  };

  const getPasoColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10B981'; // verde
      case 'progress':
        return '#3B82F6'; // azul
      case 'error':
        return '#EF4444'; // rojo
      default:
        return '#9CA3AF'; // gris
    }
  };

  return (
    <Animated.View style={[{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
    }, fadeStyle]}>
      <View style={{
        backgroundColor: theme.colors?.surface || '#FFFFFF',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        minWidth: 320,
        maxWidth: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      }}>
        <ActivityIndicator size="large" color={theme.colors?.primary || "#C41E3A"} style={{ marginBottom: 20 }} />
        
        <Text style={{
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors?.text?.primary || '#333333',
          textAlign: 'center',
          marginBottom: 20,
        }}>
          {mensaje || "Procesando..."}
        </Text>

        {pasos.length > 0 && (
          <View style={{ width: '100%', marginTop: 10 }}>
            {pasos.map((paso, index) => (
              <View key={paso.id || index} style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
                paddingVertical: 4,
              }}>
                <Text style={{
                  fontSize: 18,
                  marginRight: 12,
                  color: getPasoColor(paso.status),
                }}>
                  {getPasoIcono(paso.status)}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: paso.status === 'progress' ? theme.colors?.primary : theme.colors?.text?.secondary || '#666666',
                  flex: 1,
                }}>
                  {paso.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

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

// Componente Mesa Animada Premium 60fps con sincronización WebSocket
const MesaAnimada = React.memo(({ 
  mesa, 
  estado, 
  estadoColor, 
  mozo, 
  isSelected, 
  mesaSize, 
  zoomLevel,
  theme, 
  styles,
  onPress,
  index 
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const flashOpacity = useSharedValue(1);
  const prevEstadoRef = useRef(estado);
  
  // Animación según estado + transición cuando cambia (sincronización WebSocket)
  useEffect(() => {
    const estadoLower = estado?.toLowerCase() || "libre";
    const estadoAnterior = prevEstadoRef.current?.toLowerCase() || "";
    const cambioEstado = estadoLower !== estadoAnterior;
    
    // Si cambió el estado (evento WebSocket), animar transición
    if (cambioEstado && estadoAnterior) {
      // Flash de transición cuando cambia el estado
      flashOpacity.value = withSequence(
        withTiming(0.5, { duration: 150 }),
        withTiming(1, { duration: 150 })
      );
      
      // Haptic feedback cuando cambia estado
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Silenciar errores de haptic
      }
      
      console.log(`🎨 [ANIMACION] Mesa ${mesa.nummesa} cambió de "${estadoAnterior}" a "${estadoLower}"`);
    }
    
    // Actualizar referencia del estado anterior
    prevEstadoRef.current = estado;
    
    // Resetear animaciones anteriores
    translateX.value = withTiming(0, { duration: 200 });
    
    if (estadoLower === "libre") {
      // Pulse infinito permanente para mesas libres
      pulseScale.value = withRepeat(
        withTiming(1.02, { duration: 1500 }),
        -1,
        true
      );
    } else if (estadoLower === "pedido") {
      // Pulse sutil para mesas con pedido (sin movimiento horizontal)
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      );
      translateX.value = 0; // Sin movimiento horizontal
    } else if (estadoLower === "preparado") {
      // Bounce continuo para preparado
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      translateX.value = 0; // Sin movimiento horizontal
    } else if (estadoLower === "pagado") {
      // Fade out sutil para mesas pagadas
      pulseScale.value = withTiming(0.95, { duration: 500 });
      opacity.value = withTiming(0.7, { duration: 500 });
    } else {
      // Para otros estados, sin animación
      pulseScale.value = 1;
      translateX.value = 0;
      opacity.value = 1;
    }
  }, [estado, mesa.nummesa]);

  // Función helper para haptic seguro
  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Silenciar errores de haptic
    }
  };

  // Gesture para tap con haptic
  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(1.05, springConfig);
      runOnJS(triggerHaptic)();
    })
    .onEnd(() => {
      scale.value = withSpring(1, springConfig, () => {
        runOnJS(onPress)(mesa);
      });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, springConfig);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulseScale.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value * flashOpacity.value,
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderWidth: isSelected ? 3 : 1,
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        entering={slideInRightDelay(index)}
        style={[
          styles.mesaCard,
          {
            width: mesaSize,
            height: mesaSize,
            backgroundColor: estadoColor, // Color se actualiza automáticamente cuando cambia estado (WebSocket)
            borderColor: isSelected ? theme.colors.secondary : "transparent",
          },
          animatedStyle, // Incluye opacity y flashOpacity para transiciones suaves
          borderAnimatedStyle,
        ]}
      >
        <Text style={[styles.mesaNumber, { fontSize: mesaSize * 0.25 }]}>M{mesa.nummesa}</Text>
        {/* Mostrar mozo solo si zoom level >= 1 (small) */}
        {zoomLevel >= 1 && (
          <Text style={[styles.mesaMozo, { fontSize: mesaSize * 0.15 }]}>
            {mozo !== "N/A" ? mozo.split(' ')[0] : ""}
          </Text>
        )}
        {/* Mostrar icono solo si zoom level >= 0 (extraSmall) */}
        {zoomLevel >= 0 && (
          <MaterialCommunityIcons 
            name="circle" 
            size={Math.max(6, mesaSize * 0.1)} 
            color={theme.colors.text.white} 
            style={styles.mesaIcon}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const InicioScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { width, height } = useWindowDimensions();
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [comandaEditando, setComandaEditando] = useState(null);
  const [modalOpcionesMesaVisible, setModalOpcionesMesaVisible] = useState(false);
  const [mesaOpciones, setMesaOpciones] = useState(null);
  const [comandasOpciones, setComandasOpciones] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [horaActual, setHoraActual] = useState(moment().tz("America/Lima"));
  const [adaptMobile, setAdaptMobile] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [eliminandoUltimaComanda, setEliminandoUltimaComanda] = useState(false);
  const [mensajeCargaEliminacion, setMensajeCargaEliminacion] = useState("");
  const [eliminandoTodasComandas, setEliminandoTodasComandas] = useState(false);
  const [mensajeCargaEliminacionTodas, setMensajeCargaEliminacionTodas] = useState("");
  const [verificandoComandas, setVerificandoComandas] = useState(false);
  const [mensajeCargaVerificacion, setMensajeCargaVerificacion] = useState("");
  const [eliminandoPlatos, setEliminandoPlatos] = useState(false);
  const [mensajeCargaEliminacionPlatos, setMensajeCargaEliminacionPlatos] = useState("");
  const [mesaZoomLevel, setMesaZoomLevel] = useState(2); // 0-4: extraSmall, small, medium, large, extraLarge
  
  // Refs y estado para scroll de tabs áreas
  const tabsScrollViewRef = useRef(null);
  const tabPositionsRef = useRef({}); // { "areaId": xPosition }
  // Ref para leer params sin provocar re-ejecución de useFocusEffect (anti-loop)
  const routeParamsRef = useRef(route.params);
  routeParamsRef.current = route.params;
  // Ref para ejecutar flujo post-pago solo una vez por navegación
  const postPagoHandledRef = useRef(false);
  // Ref para Liberar Mesa en Alert post-pago (evita dep en handleLiberarMesa que cambia cada render)
  const handleLiberarMesaRef = useRef(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  // 🔥 FUNCIÓN CRÍTICA: Verificar y cargar todas las comandas y platos antes de permitir pago
  const verificarYRecargarComandas = async (mesa, comandasActuales) => {
    if (!mesa) {
      Alert.alert("Error", "No hay información de mesa");
      return null;
    }

    setVerificandoComandas(true);
    setMensajeCargaVerificacion("🔍 Verificando comandas y platos...");
    
    try {
      const mesaId = mesa._id;
      const mesaNum = mesa.nummesa;
      
      console.log("🔍 [INICIO] Verificando comandas y platos de la mesa antes de pagar...");
      console.log(`📋 Comandas del cache (comandasActuales): ${comandasActuales?.length || 0}`);
      
      // ESTRATEGIA MEJORADA: Usar cache primero, luego verificar con servidor
      // 1. Intentar usar cache de verificaciones anteriores (si es reciente, < 30 segundos)
      // 2. Si hay comandas en cache (comandasActuales), usarlas como base
      // 3. Obtener comandas del servidor para actualizar datos
      // 4. Combinar ambas fuentes, priorizando comandas más recientes
      
      // Intentar usar cache de verificaciones anteriores
      let comandasCacheVerificadas = null;
      try {
        const cacheKey = `comandas_verificadas_mesa_${mesaNum}`;
        const cacheData = await AsyncStorage.getItem(cacheKey);
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          const CACHE_MAX_AGE = 30000; // 30 segundos
          
          if (cacheAge < CACHE_MAX_AGE && parsed.comandas && parsed.comandas.length > 0) {
            comandasCacheVerificadas = parsed.comandas;
            console.log(`✅ [INICIO] Usando cache de verificaciones anteriores (${Math.round(cacheAge / 1000)}s de antigüedad)`);
          } else {
            console.log(`⚠️ [INICIO] Cache expirado o inválido (${Math.round(cacheAge / 1000)}s de antigüedad)`);
          }
        }
      } catch (error) {
        console.warn("⚠️ [INICIO] Error leyendo cache de verificaciones:", error);
      }
      
      let comandasCache = [];
      if (comandasActuales && Array.isArray(comandasActuales) && comandasActuales.length > 0) {
        // Usar comandas del cache como base
        comandasCache = comandasActuales;
        console.log(`✅ [INICIO] Usando ${comandasCache.length} comanda(s) del cache (comandasActuales) como base`);
        
        // Log de comandas del cache
        comandasCache.forEach((c, idx) => {
          const clienteId = c.cliente?._id || c.cliente;
          const tieneCliente = clienteId ? 'Sí' : 'No';
          const fechaCreacion = c.createdAt ? moment(c.createdAt).tz("America/Lima").format('HH:mm:ss') : 'N/A';
          console.log(`   Cache ${idx + 1}: Comanda #${c.comandaNumber} - Cliente: ${tieneCliente} - ${c.platos?.length || 0} plato(s) - Creada: ${fechaCreacion}`);
        });
      }
      
      // Si tenemos cache de verificaciones reciente, podemos usarlo como base adicional
      if (comandasCacheVerificadas && comandasCacheVerificadas.length > 0) {
        // Combinar con comandas del cache actual
        const cacheMap = new Map();
        comandasCache.forEach(c => {
          const id = c._id?.toString();
          if (id) cacheMap.set(id, c);
        });
        comandasCacheVerificadas.forEach(c => {
          const id = c._id?.toString();
          if (id && !cacheMap.has(id)) {
            cacheMap.set(id, c);
          }
        });
        comandasCache = Array.from(cacheMap.values());
        console.log(`✅ [INICIO] Cache combinado: ${comandasCache.length} comanda(s)`);
      }
      
      setMensajeCargaVerificacion("📡 Obteniendo comandas del servidor...");
    
      // Obtener todas las comandas del día del servidor
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
      const response = await axios.get(comandasURL, { timeout: 10000 });
      
      // Filtrar comandas de esta mesa (solo las que NO están pagadas)
      const comandasMesaServidor = response.data.filter(c => {
        const comandaMesaNum = c.mesas?.nummesa;
        const comandaMesaId = c.mesas?._id || c.mesas;
        const coincideMesa = (comandaMesaNum === mesaNum) || 
               (comandaMesaId && comandaMesaId.toString() === mesaId.toString());
        const status = c.status?.toLowerCase();
        // Solo incluir comandas no pagadas
        return coincideMesa && status !== "pagado" && status !== "completado";
      });
      
      console.log(`✅ [INICIO] ${comandasMesaServidor.length} comanda(s) encontrada(s) en el servidor (no pagadas)`);
      
      // COMBINAR: Cache + Servidor, eliminando duplicados
      // Priorizar datos del servidor (más actualizados) pero mantener todas las comandas
      const comandasMap = new Map();
      
      // Primero agregar comandas del cache (para mantener las que pueden no estar en el servidor aún)
      comandasCache.forEach(c => {
        const comandaId = c._id?.toString();
        if (comandaId) {
          comandasMap.set(comandaId, c);
        }
      });
      
      // Luego actualizar/agregar comandas del servidor (datos más frescos)
      comandasMesaServidor.forEach(c => {
        const comandaId = c._id?.toString();
        if (comandaId) {
          // Actualizar con datos del servidor (más recientes)
          comandasMap.set(comandaId, c);
        }
      });
      
      // Convertir Map a Array
      const comandasMesa = Array.from(comandasMap.values());
      
      // Ordenar por fecha de creación descendente (más recientes primero)
      comandasMesa.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Fallback: usar comandaNumber
        return (b.comandaNumber || 0) - (a.comandaNumber || 0);
      });
      
      console.log(`✅ [INICIO] ${comandasMesa.length} comanda(s) combinada(s) (cache + servidor, sin duplicados)`);
      
      // Log detallado de comandas combinadas
      comandasMesa.forEach((c, idx) => {
        const clienteId = c.cliente?._id || c.cliente;
        const tieneCliente = clienteId ? 'Sí' : 'No';
        const fechaCreacion = c.createdAt ? moment(c.createdAt).tz("America/Lima").format('HH:mm:ss') : 'N/A';
        console.log(`   ${idx + 1}. Comanda #${c.comandaNumber} - Status: ${c.status} - Cliente: ${tieneCliente} - ${c.platos?.length || 0} plato(s) - Creada: ${fechaCreacion}`);
      });
      
      if (comandasMesa.length === 0) {
        Alert.alert("Error", "No se encontraron comandas para esta mesa");
        setVerificandoComandas(false);
        return null;
      }
      
      // Guardar en cache las comandas verificadas para esta mesa (para futuras referencias)
      try {
        const cacheKey = `comandas_verificadas_mesa_${mesaNum}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          mesaNum,
          mesaId,
          comandas: comandasMesa,
          timestamp: Date.now()
        }));
        console.log(`💾 [INICIO] Comandas guardadas en cache para mesa ${mesaNum}`);
      } catch (error) {
        console.warn("⚠️ [INICIO] Error guardando comandas en cache:", error);
        // No es crítico, continuar
      }
      
      // Verificar que todas las comandas tengan platos populados
      setMensajeCargaVerificacion(`🍽️ Verificando ${comandasMesa.length} comanda(s) y sus platos...`);
      
      let todasComandasCompletas = true;
      const comandasIncompletas = [];
      
      for (const comanda of comandasMesa) {
        if (!comanda.platos || comanda.platos.length === 0) {
          todasComandasCompletas = false;
          comandasIncompletas.push(comanda.comandaNumber || comanda._id);
          console.warn(`⚠️ [INICIO] Comanda ${comanda.comandaNumber || comanda._id} sin platos`);
          continue;
        }
        
        // Verificar que cada plato tenga nombre y precio
        const platosIncompletos = comanda.platos.filter((platoItem, index) => {
          const plato = platoItem.plato || platoItem;
          const tieneNombre = plato.nombre && plato.nombre.trim() !== '';
          const tienePrecio = plato.precio && plato.precio > 0;
          
          if (!tieneNombre || !tienePrecio) {
            console.warn(`⚠️ [INICIO] Plato ${index} en comanda ${comanda.comandaNumber || comanda._id} incompleto:`, {
              tieneNombre,
              tienePrecio,
              nombre: plato.nombre,
              precio: plato.precio
            });
            return true;
          }
          return false;
        });
        
        if (platosIncompletos.length > 0) {
          todasComandasCompletas = false;
          comandasIncompletas.push(comanda.comandaNumber || comanda._id);
        }
      }
      
      if (!todasComandasCompletas) {
        console.warn(`⚠️ [INICIO] Comandas incompletas detectadas: ${comandasIncompletas.join(', ')}`);
        setMensajeCargaVerificacion("🔧 Corrigiendo platos faltantes...");
        
        // Obtener todos los platos del servidor para corregir
        let platosDisponibles = [];
        try {
          const platosURL = apiConfig.isConfigured 
            ? apiConfig.getEndpoint('/platos')
            : DISHES_API;
          const platosResponse = await axios.get(platosURL, { timeout: 5000 });
          platosDisponibles = platosResponse.data || [];
          console.log(`✅ [INICIO] ${platosDisponibles.length} plato(s) obtenido(s) para corrección`);
        } catch (error) {
          console.error("⚠️ [INICIO] Error obteniendo platos:", error);
        }
        
        // Corregir platos en cada comanda
        const comandasCorregidas = comandasMesa.map((comanda) => {
          if (comanda.platos && Array.isArray(comanda.platos)) {
            const platosCorregidos = comanda.platos.map((platoItem) => {
              const plato = platoItem.plato || platoItem;
              
              // Si el plato no tiene nombre o precio, intentar obtenerlo del servidor
              if (!plato.nombre || !plato.precio || plato.precio === 0) {
                // Intentar encontrar el plato usando platoId numérico
                if (platoItem.platoId && platosDisponibles.length > 0) {
                  const platoEncontrado = platosDisponibles.find(p => p.id === platoItem.platoId);
                  if (platoEncontrado) {
                    return {
                      ...platoItem,
                      plato: {
                        ...plato,
                        nombre: platoEncontrado.nombre,
                        precio: platoEncontrado.precio || 0,
                        _id: platoEncontrado._id,
                        id: platoEncontrado.id
                      }
                    };
                  }
                }
                
                // Si no se encontró por ID numérico, intentar por ObjectId
                if (plato._id && platosDisponibles.length > 0) {
                  const platoIdStr = plato._id.toString ? plato._id.toString() : plato._id;
                  const platoEncontrado = platosDisponibles.find(p => {
                    const pIdStr = p._id?.toString ? p._id.toString() : p._id;
                    return pIdStr === platoIdStr;
                  });
                  if (platoEncontrado) {
                    return {
                      ...platoItem,
                      plato: {
                        ...plato,
                        nombre: platoEncontrado.nombre,
                        precio: platoEncontrado.precio || 0,
                        _id: platoEncontrado._id,
                        id: platoEncontrado.id
                      }
                    };
                  }
                }
              }
              
              return platoItem;
            });
            
            return { ...comanda, platos: platosCorregidos };
          }
          
          return comanda;
        });
        
        // Verificar nuevamente después de la corrección
        let todasCompletasDespues = true;
        for (const comanda of comandasCorregidas) {
          if (!comanda.platos || comanda.platos.length === 0) {
            todasCompletasDespues = false;
            break;
          }
          
          const platosIncompletos = comanda.platos.filter((platoItem) => {
            const plato = platoItem.plato || platoItem;
            return !plato.nombre || !plato.precio || plato.precio === 0;
          });
          
          if (platosIncompletos.length > 0) {
            todasCompletasDespues = false;
            break;
          }
        }
        
        if (!todasCompletasDespues) {
          Alert.alert(
            "Error de Sincronización",
            "No se pudieron cargar todos los platos correctamente. Por favor, intente nuevamente o sincronice manualmente.",
            [{ text: "OK" }]
          );
          setVerificandoComandas(false);
          return null;
        }
        
        // Retornar comandas corregidas
        console.log(`✅ [INICIO] Comandas corregidas y actualizadas`);
        
        // Actualizar cache con comandas corregidas
        try {
          const cacheKey = `comandas_verificadas_mesa_${mesaNum}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            mesaNum,
            mesaId,
            comandas: comandasCorregidas,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn("⚠️ [INICIO] Error actualizando cache:", error);
        }
        
        setMensajeCargaVerificacion("✅ Verificación completada");
        await new Promise(resolve => setTimeout(resolve, 500));
        setVerificandoComandas(false);
        return comandasCorregidas;
      } else {
        // Todas las comandas están completas
        console.log(`✅ [INICIO] Todas las comandas están completas`);
        
        // Actualizar cache con comandas verificadas
        try {
          const cacheKey = `comandas_verificadas_mesa_${mesaNum}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            mesaNum,
            mesaId,
            comandas: comandasMesa,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn("⚠️ [INICIO] Error actualizando cache:", error);
        }
        
        setMensajeCargaVerificacion("✅ Verificación completada");
        await new Promise(resolve => setTimeout(resolve, 500));
        setVerificandoComandas(false);
        return comandasMesa;
      }
    } catch (error) {
      console.error("❌ [INICIO] Error verificando comandas:", error);
      Alert.alert("Error", "No se pudo verificar las comandas. Por favor, intente nuevamente.");
      setVerificandoComandas(false);
      return null;
    }
  };

  // Detectar si es móvil
  const isMobile = width < 400 || adaptMobile;
  
  // Calcular tamaño de mesa basado en zoom level
  const getMesaSizeFromZoom = useCallback((zoomLevel, isMobileDevice) => {
    const baseSizes = {
      0: 60,  // extraSmall
      1: 80,  // small
      2: 100, // medium (default)
      3: 130, // large
      4: 160  // extraLarge
    };
    const mobileSizes = {
      0: 50,  // extraSmall
      1: 65,  // small
      2: 70,  // medium (default)
      3: 90,  // large
      4: 110  // extraLarge
    };
    
    const sizes = isMobileDevice ? mobileSizes : baseSizes;
    return sizes[zoomLevel] || sizes[2]; // Default a medium si nivel inválido
  }, []);
  
  const mesaSize = getMesaSizeFromZoom(mesaZoomLevel, isMobile);
  const canvasWidth = isMobile ? "95%" : "90%";
  const barraWidth = isMobile ? "20%" : "25%";
  const fontSize = isMobile ? 14 : 16;
  // Tamaño de fuente más pequeño para el sidebar, adaptable a celular/tablet
  const isTablet = width >= 600; // Tablets generalmente tienen ancho >= 600px
  const fontSizeSidebar = isMobile ? (isTablet ? 12 : 11) : 13; // Más pequeño que fontSize general
  const iconSizeSidebar = fontSizeSidebar + 5; // Iconos ligeramente más grandes que el texto

  const styles = InicioScreenStyles(theme, isMobile, mesaSize, canvasWidth, barraWidth, fontSize, fontSizeSidebar, iconSizeSidebar);

  // Cargar preferencia de zoom desde AsyncStorage
  useEffect(() => {
    const loadZoomPreference = async () => {
      try {
        const savedZoom = await AsyncStorage.getItem('mesaZoomPreference');
        if (savedZoom !== null) {
          const zoomLevel = parseInt(savedZoom, 10);
          if (zoomLevel >= 0 && zoomLevel <= 4) {
            setMesaZoomLevel(zoomLevel);
          }
        }
      } catch (error) {
        console.error('Error cargando preferencia de zoom:', error);
      }
    };
    loadZoomPreference();
  }, []);

  // Guardar preferencia de zoom cuando cambia
  useEffect(() => {
    const saveZoomPreference = async () => {
      try {
        await AsyncStorage.setItem('mesaZoomPreference', mesaZoomLevel.toString());
      } catch (error) {
        console.error('Error guardando preferencia de zoom:', error);
      }
    };
    saveZoomPreference();
  }, [mesaZoomLevel]);

  // Funciones para manejar zoom
  const handleZoomOut = useCallback(() => {
    if (mesaZoomLevel > 0) {
      setMesaZoomLevel(prev => prev - 1);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Silenciar errores de haptic
      }
    }
  }, [mesaZoomLevel]);

  const handleZoomIn = useCallback(() => {
    if (mesaZoomLevel < 4) {
      setMesaZoomLevel(prev => prev + 1);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Silenciar errores de haptic
      }
    }
  }, [mesaZoomLevel]);

  // Obtener nombre del nivel de zoom
  const getZoomLevelName = useCallback((level) => {
    const names = ['Muy Pequeño', 'Pequeño', 'Mediano', 'Grande', 'Muy Grande'];
    return names[level] || 'Mediano';
  }, []);

  // Cargar configuración de adaptación móvil
  useEffect(() => {
    loadConfig();
    loadUserData();
    obtenerAreas();
  }, []);

  // Obtener socket del contexto global (mantiene conexión activa en todas las pantallas)
  const { subscribeToEvents, joinMesa, leaveMesa, connected: socketConnected } = useSocket();

  // Callbacks para eventos WebSocket
  const handleMesaActualizada = useCallback(async (mesa) => {
    console.log('📥 [MOZOS] Mesa actualizada vía WebSocket:', mesa.nummesa, 'Estado:', mesa.estado);
    
    // Actualizar estado local (esto disparará re-render y animaciones)
    setMesas(prev => {
      const index = prev.findIndex(m => {
        const mId = m._id?.toString ? m._id.toString() : m._id;
        const mesaId = mesa._id?.toString ? mesa._id.toString() : mesa._id;
        return mId === mesaId || m.nummesa === mesa.nummesa;
      });
      if (index !== -1) {
        const nuevas = [...prev];
        const mesaAnterior = nuevas[index];
        const estadoAnterior = mesaAnterior.estado;
        const nuevoEstado = mesa.estado;
        
        // CRÍTICO: Usar el estado del servidor directamente (es la fuente de verdad)
        nuevas[index] = { ...mesaAnterior, ...mesa, estado: nuevoEstado };
        
        // Log del cambio para debugging de animaciones
        if (estadoAnterior !== nuevoEstado) {
          console.log(`🎨 [ANIMACION] Mesa ${mesa.nummesa} cambiará animación: "${estadoAnterior}" → "${nuevoEstado}"`);
        }
        
        // Re-ordenar después de actualizar para mantener orden numérico
        return ordenarMesasPorNumero(nuevas);
      }
      // Si no se encuentra la mesa, agregarla y ordenar
      const nuevasConMesa = [...prev, mesa];
      return ordenarMesasPorNumero(nuevasConMesa);
    });
    
    // Actualizar AsyncStorage
    try {
      const mesasKey = 'mesas';
      const mesasStorage = await AsyncStorage.getItem(mesasKey);
      if (mesasStorage) {
        const mesasArray = JSON.parse(mesasStorage);
        const index = mesasArray.findIndex(m => {
          const mId = m._id?.toString ? m._id.toString() : m._id;
          const mesaId = mesa._id?.toString ? mesa._id.toString() : mesa._id;
          return mId === mesaId || m.nummesa === mesa.nummesa;
        });
        if (index !== -1) {
          mesasArray[index] = { ...mesasArray[index], ...mesa, estado: mesa.estado };
        } else {
          mesasArray.push(mesa);
        }
        await AsyncStorage.setItem(mesasKey, JSON.stringify(mesasArray));
      }
    } catch (error) {
      console.error('⚠️ Error actualizando AsyncStorage:', error);
    }
  }, [ordenarMesasPorNumero]);

  const handleComandaActualizada = useCallback(async (comanda) => {
    console.log('📥 [MOZOS] Comanda actualizada vía WebSocket:', comanda._id, 'Status:', comanda.status);
    
    // Actualizar la comanda en el estado local (usar datos del servidor directamente)
    setComandas(prev => {
      const index = prev.findIndex(c => c._id === comanda._id);
      if (index !== -1) {
        const nuevas = [...prev];
        nuevas[index] = comanda; // Usar comanda completa del servidor
        return nuevas;
      } else {
        // Si no existe, agregarla
        return [comanda, ...prev];
      }
    });
    
    // Actualizar AsyncStorage con la comanda actualizada
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasKey = `comandas_${currentDate}`;
      const comandasStorage = await AsyncStorage.getItem(comandasKey);
      if (comandasStorage) {
        const comandasArray = JSON.parse(comandasStorage);
        const index = comandasArray.findIndex(c => c._id === comanda._id);
        if (index !== -1) {
          comandasArray[index] = comanda;
        } else {
          comandasArray.push(comanda);
        }
        await AsyncStorage.setItem(comandasKey, JSON.stringify(comandasArray));
      }
    } catch (error) {
      console.error('⚠️ Error actualizando AsyncStorage:', error);
    }
    
    // NO hacer polling - el backend ya emite mesa-actualizada si es necesario
    // Confiar en el backend como fuente única de verdad
  }, []);

  const handleNuevaComanda = useCallback(async (comanda) => {
    console.log('📥 [MOZOS] Nueva comanda vía WebSocket:', comanda.comandaNumber);
    
    // Actualizar estado local
    setComandas(prev => {
      const existe = prev.find(c => c._id === comanda._id);
      if (existe) {
        return prev.map(c => c._id === comanda._id ? comanda : c);
      } else {
        return [comanda, ...prev];
      }
    });
    
    // Actualizar AsyncStorage
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasKey = `comandas_${currentDate}`;
      const comandasStorage = await AsyncStorage.getItem(comandasKey);
      const comandasArray = comandasStorage ? JSON.parse(comandasStorage) : [];
      const existe = comandasArray.find(c => c._id === comanda._id);
      if (existe) {
        const index = comandasArray.findIndex(c => c._id === comanda._id);
        comandasArray[index] = comanda;
      } else {
        comandasArray.unshift(comanda);
      }
      await AsyncStorage.setItem(comandasKey, JSON.stringify(comandasArray));
    } catch (error) {
      console.error('⚠️ Error actualizando AsyncStorage:', error);
    }
    
    // Actualizar mesa si viene en el evento (el backend ya calculó el estado)
    if (comanda.mesas) {
      handleMesaActualizada(comanda.mesas);
    }
  }, [handleMesaActualizada, ordenarMesasPorNumero]);

  // 🔥 ESTÁNDAR INDUSTRIA: Unirse a rooms de todas las mesas activas
  useEffect(() => {
    if (socketConnected && mesas.length > 0) {
      // Unirse a rooms de todas las mesas que tienen comandas activas
      mesas.forEach(mesa => {
        const mesaId = mesa._id?.toString ? mesa._id.toString() : mesa._id;
        if (mesaId) {
          joinMesa(mesaId);
        }
      });
      console.log(`📌 [MOZOS] Unido a ${mesas.length} room(s) de mesa(s)`);
    }
  }, [socketConnected, mesas, joinMesa]);

  // Flujo post-pago: useEffect aislado para evitar loop (no usar useFocusEffect + route.params aquí)
  const mostrarMensajePago = route.params?.mostrarMensajePago === true;
  const postPagoMesaId = route.params?.mesaId;
  useEffect(() => {
    if (!mostrarMensajePago || !postPagoMesaId) {
      postPagoHandledRef.current = false;
      return;
    }
    if (postPagoHandledRef.current) return;
    postPagoHandledRef.current = true;

    const params = route.params || {};
    const mesaPagada = params.mesaPagada || {};
    const boucherFromParams = params.boucher;
    const nummesa = mesaPagada.nummesa ?? "?";

    let cancelled = false;
    joinMesa(postPagoMesaId);
    (async () => {
      try {
        await Promise.all([obtenerMesas(), obtenerComandasHoy()]);
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 450));
      } catch (e) {
        if (!cancelled) console.warn("⚠️ [Inicio] Error refresh post-pago:", e?.message);
      }
      if (cancelled) return;
      navigation.setParams({
        mostrarMensajePago: false,
        mesaId: undefined,
        mesaPagada: undefined,
        boucher: undefined,
        refresh: undefined
      });
      Alert.alert(
        "✅ Pago confirmado",
        `Mesa ${nummesa} pagada (verde). Opciones:`,
        [
          {
            text: "📄 Imprimir Boucher",
            onPress: () => {
              if (boucherFromParams) {
                navigation.navigate("Pagos", { boucher: boucherFromParams });
              } else {
                AsyncStorage.getItem("ultimoBoucher").then((s) => {
                  const b = s ? JSON.parse(s) : null;
                  if (b) navigation.navigate("Pagos", { boucher: b });
                  else Alert.alert("Error", "No hay boucher disponible para imprimir.");
                });
              }
            }
          },
          {
            text: "🔄 Liberar Mesa",
            onPress: () => {
              const mesaMin = { _id: mesaPagada._id, nummesa: mesaPagada.nummesa };
              if (mesaMin._id && handleLiberarMesaRef.current) handleLiberarMesaRef.current(mesaMin);
              else if (!mesaMin._id) Alert.alert("Error", "No se pudo obtener la mesa para liberar.");
            }
          },
          { text: "Continuar", style: "cancel" }
        ]
      );
    })();
    return () => { cancelled = true; };
  }, [mostrarMensajePago, postPagoMesaId, joinMesa, obtenerMesas, obtenerComandasHoy, navigation]);

  // Suscribirse a eventos WebSocket y cargar datos cuando la pantalla está enfocada (sin deps que cambien cada render)
  useFocusEffect(
    useCallback(() => {
      subscribeToEvents({
        onMesaActualizada: handleMesaActualizada,
        onComandaActualizada: handleComandaActualizada,
        onNuevaComanda: handleNuevaComanda
      });
      // Refresh solo si no viene del flujo post-pago (ese useEffect ya hace el refresh)
      if (!routeParamsRef.current?.mostrarMensajePago) {
        obtenerMesas();
        obtenerComandasHoy();
      }
      return () => {
        subscribeToEvents({
          onMesaActualizada: null,
          onComandaActualizada: null,
          onNuevaComanda: null
        });
      };
    }, [subscribeToEvents, handleMesaActualizada, handleComandaActualizada, handleNuevaComanda, obtenerMesas, obtenerComandasHoy])
  );

  // Actualizar hora cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraActual(moment().tz("America/Lima"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const config = await AsyncStorage.getItem("adaptMobile");
      if (config !== null) {
        setAdaptMobile(JSON.parse(config));
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  const saveConfig = async (value) => {
    try {
      await AsyncStorage.setItem("adaptMobile", JSON.stringify(value));
      setAdaptMobile(value);
    } catch (error) {
      console.error("Error guardando configuración:", error);
    }
  };

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        setUserInfo(parsed);
      }
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  // Función para ordenar mesas numéricamente
  const ordenarMesasPorNumero = useCallback((mesas) => {
    if (!mesas || mesas.length === 0) return mesas;
    
    return [...mesas].sort((a, b) => {
      // Extraer número de mesa
      const getNumeroMesa = (mesa) => {
        // Si tiene campo nummesa tipo Number, usarlo directamente
        if (typeof mesa.nummesa === 'number') {
          return mesa.nummesa;
        }
        // Si es string, intentar extraer número
        if (typeof mesa.nummesa === 'string') {
          const match = mesa.nummesa.match(/\d+/);
          if (match) {
            return parseInt(match[0], 10);
          }
        }
        // Si tiene campo nombre, intentar extraer número
        if (mesa.nombre) {
          const match = mesa.nombre.match(/\d+/);
          if (match) {
            return parseInt(match[0], 10);
          }
        }
        // Si no se puede extraer número válido, retornar Infinity para ponerlo al final
        return Infinity;
      };
      
      const numA = getNumeroMesa(a);
      const numB = getNumeroMesa(b);
      
      // Si ambos tienen números válidos, comparar numéricamente
      if (numA !== Infinity && numB !== Infinity) {
        if (numA !== numB) {
          return numA - numB;
        }
        // Si números iguales, ordenar por ID o fecha creación
        return (a._id || '').localeCompare(b._id || '');
      }
      
      // Si uno no tiene número válido, ponerlo al final
      if (numA === Infinity && numB !== Infinity) return 1;
      if (numA !== Infinity && numB === Infinity) return -1;
      
      // Si ambos no tienen número, ordenar alfabéticamente por nombre
      const nombreA = (a.nombre || a.nummesa || '').toString();
      const nombreB = (b.nombre || b.nummesa || '').toString();
      return nombreA.localeCompare(nombreB);
    });
  }, []);

  const obtenerMesas = useCallback(async () => {
    try {
      const mesasURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/mesas')
        : SELECTABLE_API_GET;
      const response = await axios.get(mesasURL, { timeout: 5000 });
      // Aplicar ordenamiento numérico después de recibir datos
      const mesasOrdenadas = ordenarMesasPorNumero(response.data);
      setMesas(mesasOrdenadas);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  }, [ordenarMesasPorNumero]);

  const obtenerComandasHoy = useCallback(async () => {
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
      const response = await axios.get(comandasURL, { timeout: 5000 });
      setComandas(response.data);
      // Corrección automática de status: comandas con todos los platos entregados → status recoger (workaround backend).
      verificarComandasEnLote(response.data || [], axios).catch(() => {});
    } catch (error) {
      console.error("Error al obtener las comandas de hoy:", error.message);
    }
  }, []);

  const obtenerPlatos = async () => {
    try {
      const platosURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/platos')
        : DISHES_API;
      const response = await axios.get(platosURL, { timeout: 5000 });
      setPlatos(response.data);
    } catch (error) {
      console.error("Error cargando platos:", error);
    }
  };

  const obtenerAreas = useCallback(async () => {
    try {
      const areasURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/areas')
        : AREAS_API;
      const response = await axios.get(areasURL, { timeout: 5000 });
      const areasActivas = response.data.filter(area => area.isActive !== false);
      
      // Console logs para debugging
      console.log('[ZONAS] Response backend:', response.data);
      console.log('[ZONAS] Total áreas recibidas:', response.data.length);
      console.log('[ZONAS] Áreas activas:', areasActivas.length);
      console.log('[ZONAS] Nombres áreas activas:', areasActivas.map(a => a.nombre));
      
      setAreas(areasActivas);
    } catch (error) {
      console.error("Error al obtener las áreas:", error.message);
    }
  }, []);

  // Función de sincronización manual (fallback cuando WebSocket falla)
  const sincronizarManual = useCallback(async () => {
    try {
      console.log('🔄 Sincronizando manualmente...');
      invalidarCacheComandasVerificadas();
      await Promise.all([
        obtenerMesas(),
        obtenerComandasHoy()
      ]);
      console.log('✅ Sincronización manual completada');
      Alert.alert('✅ Sincronización', 'Datos actualizados correctamente');
    } catch (error) {
      console.error('❌ Error en sincronización manual:', error);
      Alert.alert('❌ Error', 'No se pudo sincronizar los datos. Intente nuevamente.');
    }
  }, [obtenerMesas, obtenerComandasHoy]);

  // 🔥 FALLBACK POLLING: Solo si WebSocket desconectado (eliminado si Socket OK)
  // El polling solo se activa cuando Socket está desconectado
  useEffect(() => {
    if (!socketConnected) {
      console.log('⚠️ [MOZOS] WebSocket desconectado, activando polling de fallback cada 30s');
      const pollingInterval = setInterval(() => {
        console.log('🔄 [POLLING FALLBACK] Sincronizando datos...');
        obtenerMesas();
        obtenerComandasHoy();
      }, 30000); // 30 segundos (menos frecuente que antes)

      return () => {
        clearInterval(pollingInterval);
        console.log('🛑 [MOZOS] Polling de fallback detenido');
      };
    } else {
      console.log('✅ [MOZOS] WebSocket conectado, polling desactivado');
    }
  }, [socketConnected, obtenerMesas, obtenerComandasHoy]);

  // Obtener comandas de la mesa: solo activas (sin boucher, no pagadas, no eliminadas)
  // Mesa liberada = solo servicio actual; misma lógica que ComandaDetalleScreen
  const getTodasComandasPorMesa = (mesaNum) => {
    const porMesa = comandas.filter(
      (c) => c.mesas?.nummesa === mesaNum && c.IsActive !== false
    );
    return filtrarComandasActivas(porMesa);
  };

  // Obtener solo comandas activas de la mesa (fuente única: filtrarComandasActivas)
  const getComandasPorMesa = (mesaNum) => {
    return getTodasComandasPorMesa(mesaNum);
  };

  const getEstadoMesa = (mesa) => {
    // Prioridad: si el backend marcó la mesa como "pagado", mostrarla verde aunque no haya comandas activas
    if (mesa.estado && (mesa.estado.toLowerCase() === "pagado" || mesa.estado.toLowerCase() === "pagando")) {
      return mesa.estado.charAt(0).toUpperCase() + mesa.estado.slice(1).toLowerCase();
    }

    // Fuente única: comandas activas de la mesa. Si no hay comandas activas, la mesa está libre.
    const comandasMesa = getComandasPorMesa(mesa.nummesa);
    if (comandasMesa.length === 0) return "Libre";

    // Si la mesa tiene estado definido, usarlo (prioridad al estado de la mesa)
    // PERO verificar que el estado sea consistente con las comandas actuales
    if (mesa.estado) {
      const estadoLower = mesa.estado.toLowerCase();
      
      if (comandasMesa.length > 0) {
        // Verificar si hay comandas realmente preparadas (todos los platos en "recoger") o listas para pagar (entregado)
        const hayComandasPreparadas = comandasMesa.some(c => {
          if (!c.platos || c.platos.length === 0) return false;
          const activos = c.platos.filter(p => p.eliminado !== true);
          return activos.length > 0 && activos.every(p => (p.estado || '').toLowerCase() === "recoger");
        });
        const hayComandasEntregadas = comandasMesa.some(c => {
          const status = (c.status || '').toLowerCase();
          if (status === 'entregado') return true;
          if (!c.platos || c.platos.length === 0) return false;
          const activos = c.platos.filter(p => p.eliminado !== true);
          return activos.length > 0 && activos.every(p => (p.estado || '').toLowerCase() === 'entregado');
        });

        // Si la mesa dice "preparado" pero no hay comandas preparadas ni entregadas, recalcular
        if (estadoLower === "preparado" && !hayComandasPreparadas && !hayComandasEntregadas) {
          console.log(`⚠️ Mesa ${mesa.nummesa} tiene estado "preparado" pero no hay comandas preparadas/entregadas - Recalculando estado`);
          const hayComandasActivas = comandasMesa.some(c => {
            const status = (c.status || '').toLowerCase();
            return status === 'en_espera' || status === 'recoger' || status === 'entregado';
          });
          if (hayComandasActivas) {
            return "Pedido";
          } else {
            return "Libre";
          }
        }
        // Si hay comandas entregadas (listas para pagar), mantener Preparado para que la mesa siga accesible
        if (hayComandasEntregadas) {
          return "Preparado";
        }
      }
      
      return estadoLower.charAt(0).toUpperCase() + estadoLower.slice(1);
    }
    
    // Sin estado en mesa o ya validado: determinar por comandas activas (comandasMesa ya calculado arriba, length > 0)
    // Verificar si hay comandas con todos los platos en "recoger"
    const hayPreparadas = comandasMesa.some(c => {
      if (!c.platos || c.platos.length === 0) return false;
      const activos = c.platos.filter(p => p.eliminado !== true);
      return activos.length > 0 && activos.every(p => (p.estado || '').toLowerCase() === "recoger");
    });
    // Verificar si hay comandas listas para pagar (status entregado o todos los platos entregados)
    const hayEntregadas = comandasMesa.some(c => {
      const status = (c.status || '').toLowerCase();
      if (status === 'entregado') return true;
      if (!c.platos || c.platos.length === 0) return false;
      const activos = c.platos.filter(p => p.eliminado !== true);
      return activos.length > 0 && activos.every(p => (p.estado || '').toLowerCase() === 'entregado');
    });

    if (hayPreparadas || hayEntregadas) return "Preparado";
    return "Pedido";
  };

  const getMozoMesa = (mesa) => {
    // Si la mesa está libre, no mostrar mozo
    if (mesa.estado?.toLowerCase() === "libre") {
      return "N/A";
    }
    
    // PRIORIDAD: Primero buscar comandas activas (no pagadas)
    const comandasActivas = getComandasPorMesa(mesa.nummesa);
    if (comandasActivas.length > 0) {
      // Ordenar comandas activas por fecha de creación descendente (más reciente primero)
      const comandasOrdenadas = [...comandasActivas].sort((a, b) => {
        // Priorizar createdAt si está disponible
        if (a.createdAt && b.createdAt) {
          const fechaA = new Date(a.createdAt).getTime();
          const fechaB = new Date(b.createdAt).getTime();
          return fechaB - fechaA; // Descendente (más reciente primero)
        }
        // Fallback: usar comandaNumber
        const numA = a.comandaNumber || 0;
        const numB = b.comandaNumber || 0;
        return numB - numA; // Descendente (mayor número = más reciente)
      });
      
      // Tomar la comanda activa más reciente
      const comandaMasReciente = comandasOrdenadas[0];
      if (comandaMasReciente?.mozos?.name) {
        return comandaMasReciente.mozos.name;
      }
    }
    
    // Si no hay comandas activas, buscar en todas las comandas (incluyendo pagadas)
    // Esto es solo para casos donde la mesa tiene estado pero no comandas activas
    const todasComandasMesa = getTodasComandasPorMesa(mesa.nummesa);
    if (todasComandasMesa.length > 0) {
      // Ordenar comandas por fecha de creación descendente (más reciente primero)
      const comandasOrdenadas = [...todasComandasMesa].sort((a, b) => {
        // Priorizar createdAt si está disponible
        if (a.createdAt && b.createdAt) {
          const fechaA = new Date(a.createdAt).getTime();
          const fechaB = new Date(b.createdAt).getTime();
          return fechaB - fechaA; // Descendente (más reciente primero)
        }
        // Fallback: usar comandaNumber
        const numA = a.comandaNumber || 0;
        const numB = b.comandaNumber || 0;
        return numB - numA; // Descendente (mayor número = más reciente)
      });
      
      // Tomar la comanda más reciente
      const comandaMasReciente = comandasOrdenadas[0];
      return comandaMasReciente.mozos?.name || "N/A";
    }
    
    return "N/A";
  };

  const getEstadoColor = (estado) => {
    const estadoLower = estado?.toLowerCase() || "libre";
    switch (estadoLower) {
      case "libre":
        return theme.colors.mesaEstado.libre || "#9E9E9E"; // Gris
      case "esperando":
        return theme.colors.mesaEstado.esperando || "#FFC107"; // Amarillo
      case "pedido":
        return theme.colors.mesaEstado.pedido || "#2196F3"; // Azul
      case "preparado":
        return theme.colors.mesaEstado.preparado || "#FFC107"; // Amarillo
      case "pagado":
        return theme.colors.mesaEstado.pagado || "#4CAF50"; // Verde
      case "pagando":
        return theme.colors.mesaEstado.pagando || "#00C851"; // Verde
      case "reservado":
        return theme.colors.mesaEstado.reservado || "#9C27B0"; // Morado
      default:
        return theme.colors.mesaEstado.libre || "#9E9E9E";
    }
  };

  const handleSelectMesa = async (mesa) => {
    const estado = getEstadoMesa(mesa);
    setMesaSeleccionada(mesa);
    
    if (estado === "Libre") {
      // Solo seleccionar la mesa, no navegar automáticamente
      // El usuario puede usar la barra derecha para navegar
    } else if (estado === "Pedido" || estado?.toLowerCase() === "pedido") {
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      const comandasActivas = comandasMesa.filter(c => 
        c.status?.toLowerCase() !== "pagado" && 
        c.status?.toLowerCase() !== "completado"
      );
      
      const comandaActiva = comandasActivas[0] || comandasMesa[0];

      if (comandaActiva) {
        const mozoComandaId = comandaActiva.mozos?._id || comandaActiva.mozos;
        const mozoActualId = userInfo?._id;
        
        if (mozoComandaId && mozoActualId && mozoComandaId.toString() !== mozoActualId.toString()) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede editarla.",
            [{ text: "OK" }]
          );
          return;
        }

        // Navegar al nuevo screen de detalle de comanda
        navigation.navigate('ComandaDetalle', {
          mesa: mesa,
          comandas: comandasActivas.length > 0 ? comandasActivas : [comandaActiva],
          onRefresh: () => {
            // Callback para refrescar datos cuando se vuelva
            obtenerMesas();
            obtenerComandasHoy();
          }
        });
      }
    } else if (estado === "Preparado" || estado?.toLowerCase() === "preparado") {
      // Obtener TODAS las comandas activas de la mesa (no solo las preparadas)
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      
      // Ordenar comandas por fecha de creación (más recientes primero)
      const comandasOrdenadas = [...comandasMesa].sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Fallback: usar comandaNumber
        return (b.comandaNumber || 0) - (a.comandaNumber || 0);
      });
      
      console.log(`🔍 Mesa ${mesa.nummesa} - Preparado: ${comandasOrdenadas.length} comanda(s) activa(s)`);
      comandasOrdenadas.forEach((c, idx) => {
        const clienteId = c.cliente?._id || c.cliente;
        const tieneCliente = clienteId ? 'Sí' : 'No';
        console.log(`   ${idx + 1}. Comanda #${c.comandaNumber} - Status: ${c.status} - Cliente: ${tieneCliente} - ${c.platos?.length || 0} plato(s)`);
      });
      
      const comandaPreparada = comandasOrdenadas.find(c => 
        c.status?.toLowerCase() === "recoger" || 
        (c.platos && c.platos.some(p => p.estado === "recoger"))
      );
      
      // Obtener el mozo de la primera comanda (más reciente) para validar
      const primeraComanda = comandasOrdenadas[0];
      if (!primeraComanda) {
        Alert.alert("Error", "No se encontraron comandas para esta mesa");
        return;
      }
      
      const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
      const mozoActualId = userInfo?._id;
      const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();

      // Mostrar modal si hay comandas activas (preparadas o no)
      if (comandasOrdenadas.length > 0) {
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado 'Preparado'.",
            [{ text: "OK" }]
          );
          return;
        }

        // Si es el mismo mozo, navegar al screen de detalle de comanda
        navigation.navigate('ComandaDetalle', {
          mesa: mesa,
          comandas: comandasOrdenadas,
          onRefresh: () => {
            // Callback para refrescar datos cuando se vuelva
            obtenerMesas();
            obtenerComandasHoy();
          }
        });
        console.log(`✅ Navegando a ComandaDetalle con ${comandasOrdenadas.length} comanda(s) activa(s)`);
      }
    } else if (estado === "Pagado" || estado?.toLowerCase() === "pagado") {
      // Mesa en estado Pagado - mostrar opciones de Imprimir Boucher y Liberar
      const todasComandasMesa = getTodasComandasPorMesa(mesa.nummesa);
      // Obtener todas las comandas pagadas de la mesa
      const comandasPagadas = todasComandasMesa.filter(c => 
        c.status?.toLowerCase() === "pagado" || c.status?.toLowerCase() === "completado"
      );
      
      // Validar que sea el mismo mozo que creó la comanda
      if (comandasPagadas.length > 0) {
        const primeraComanda = comandasPagadas[0];
        const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
        const mozoActualId = userInfo?._id;
        const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();
        
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado 'Pagado'.",
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Filtrar comandas por cliente: si hay comandas con cliente, solo mostrar las del mismo cliente
      let comandasParaBoucher = comandasPagadas;
      if (comandasPagadas.length > 0) {
        // Obtener el cliente de la primera comanda pagada que tenga cliente
        const primeraComandaConCliente = comandasPagadas.find(c => c.cliente?._id || c.cliente);
        if (primeraComandaConCliente) {
          const clienteId = primeraComandaConCliente.cliente?._id || primeraComandaConCliente.cliente;
          if (clienteId) {
            // Filtrar solo las comandas del mismo cliente
            comandasParaBoucher = comandasPagadas.filter(c => {
              const comandaClienteId = c.cliente?._id || c.cliente;
              return comandaClienteId && comandaClienteId.toString() === clienteId.toString();
            });
            console.log(`🔍 Filtrando comandas por cliente: ${comandasParaBoucher.length} de ${comandasPagadas.length} comandas pertenecen al mismo cliente`);
          }
        }
      }
      
      Alert.alert(
        `Mesa ${mesa.nummesa} - Pagado`,
        `La mesa ha sido pagada.${comandasParaBoucher.length !== comandasPagadas.length ? `\n\nSe mostrarán ${comandasParaBoucher.length} comanda(s) del cliente.` : ''}\n\n¿Qué deseas hacer?`,
        [
          {
            text: "📄 Imprimir Boucher",
            onPress: async () => {
              try {
                // Verificar que la mesa esté en estado "pagado"
                if (mesa.estado?.toLowerCase() !== "pagado") {
                  Alert.alert(
                    "Error",
                    "Solo se puede imprimir el boucher de mesas que están en estado 'Pagado'.",
                    [{ text: "OK" }]
                  );
                  return;
                }

                console.log(`🔍 Obteniendo boucher de la mesa ${mesa.nummesa} (ID: ${mesa._id})`);
                
                // Llamar al nuevo endpoint para obtener el boucher de la mesa
                const boucherURL = apiConfig.isConfigured 
                  ? apiConfig.getEndpoint(`/boucher/by-mesa/${mesa._id}`)
                  : `http://192.168.18.11:3000/api/boucher/by-mesa/${mesa._id}`;
                
                const boucherResponse = await axios.get(boucherURL, { timeout: 10000 });
                const boucher = boucherResponse.data;
                
                console.log("✅ Boucher obtenido:", {
                  voucherId: boucher.voucherId,
                  boucherNumber: boucher.boucherNumber,
                  total: boucher.total
                });
                
                // Guardar boucher en AsyncStorage para que PagosScreen lo use
                await AsyncStorage.setItem("boucherParaImprimir", JSON.stringify(boucher));
                await AsyncStorage.setItem("mesaPago", JSON.stringify(mesa));
                
                // Navegar a PagosScreen con el boucher
                navigation.navigate("Pagos", { boucher });
              } catch (error) {
                console.error("❌ Error obteniendo boucher:", error);
                
                if (error.response?.status === 404) {
                  Alert.alert(
                    "Boucher no encontrado",
                    "No se encontró ningún boucher pagado para esta mesa. Verifica que se haya realizado el pago correctamente.",
                    [{ text: "OK" }]
                  );
                } else {
                  Alert.alert(
                    "Error",
                    "No se pudo obtener el boucher. Por favor, intente nuevamente.",
                    [{ text: "OK" }]
                  );
                }
              }
            }
          },
          {
            text: "🔄 Liberar",
            onPress: () => handleLiberarMesa(mesa)
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } else {
      // Otros estados (Esperando, Reservado, etc.) - validar que sea el mismo mozo
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      
      if (comandasMesa.length > 0) {
        const primeraComanda = comandasMesa[0];
        const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
        const mozoActualId = userInfo?._id;
        const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();
        
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            `Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado '${estado}'.`,
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Si es el mismo mozo o no hay comandas, mostrar información
      Alert.alert(
        `Mesa ${mesa.nummesa}`,
        `Estado: ${estado}\nMozo: ${getMozoMesa(mesa)}`,
        [{ text: "OK" }]
      );
    }
  };

  const handleEditarComanda = async (comanda) => {
    await obtenerPlatos();
    
    const platosEditados = comanda.platos.map((p, index) => {
      let platoData = null;
      const platoId = p.plato?._id || p.plato;
      
      if (p.plato && typeof p.plato === 'object' && p.plato.nombre) {
        platoData = p.plato;
      } else if (platoId) {
        platoData = platos.find(pl => pl._id === platoId || pl._id === platoId.toString());
      }
      
      return {
        plato: platoId,
        platoId: platoData?.id || p.platoId || null,
        estado: p.estado || "en_espera",
        cantidad: comanda.cantidades?.[index] || 1,
        nombre: platoData?.nombre || "Plato desconocido",
        precio: platoData?.precio || 0,
      };
    });

    // Guardar platos originales para comparar después
    setPlatosOriginales(comanda.platos || []);

    setComandaEditando({
      ...comanda,
      platosEditados,
      mesaSeleccionada: comanda.mesas,
      observacionesEditadas: comanda.observaciones || "",
    });
    setModalEditVisible(true);
  };

  // Estados para modal de confirmación de eliminación de platos
  const [modalConfirmarEliminacionVisible, setModalConfirmarEliminacionVisible] = useState(false);
  const [platosAEliminar, setPlatosAEliminar] = useState([]);
  const [platosAgregados, setPlatosAgregados] = useState([]); // Nuevo estado para platos agregados
  const [motivoEliminacion, setMotivoEliminacion] = useState("");
  const [platosOriginales, setPlatosOriginales] = useState([]);
  
  // Estados para modales de eliminación de comandas
  const [modalEliminarUltimaVisible, setModalEliminarUltimaVisible] = useState(false);
  const [modalEliminarTodasVisible, setModalEliminarTodasVisible] = useState(false);
  const [comandaAEliminar, setComandaAEliminar] = useState(null);
  const [comandasAEliminar, setComandasAEliminar] = useState([]);
  const [motivoEliminacionComanda, setMotivoEliminacionComanda] = useState("");
  
  // Estados para modal de eliminar platos de comanda
  const [modalEliminarPlatosVisible, setModalEliminarPlatosVisible] = useState(false);
  const [comandaEliminarPlatos, setComandaEliminarPlatos] = useState(null);
  const [platosSeleccionadosEliminar, setPlatosSeleccionadosEliminar] = useState([]);
  const [motivoEliminarPlatos, setMotivoEliminarPlatos] = useState("");
  
  // Estados para loading con verificaciones paso a paso
  const [loadingEliminarPlatos, setLoadingEliminarPlatos] = useState(false);
  const [mensajeLoadingEliminar, setMensajeLoadingEliminar] = useState("");
  const [pasosEliminar, setPasosEliminar] = useState([
    { id: 1, label: "Eliminando platos", status: "pending" },
    { id: 2, label: "Verificando ID comanda", status: "pending" },
    { id: 3, label: "Sincronizando datos", status: "pending" },
    { id: 4, label: "Actualizando mesa", status: "pending" }
  ]);
  
  // Helper para actualizar pasos
  const actualizarPaso = useCallback((pasoId, status) => {
    setPasosEliminar(prev => prev.map(p => 
      p.id === pasoId ? { ...p, status } : p
    ));
  }, []);
  
  // Helper para delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleGuardarEdicion = async () => {
    if (!comandaEditando) return;

    try {
      if (!comandaEditando.platosEditados || comandaEditando.platosEditados.length === 0) {
        Alert.alert("Error", "Debe haber al menos un plato en la comanda");
        return;
      }

      // Comparar platos originales con editados para detectar eliminaciones
      const platosOriginalesIds = new Set(
        platosOriginales.map(p => {
          const platoId = p.plato?._id || p.plato || p._id;
          return platoId?.toString();
        }).filter(id => id) // Filtrar valores nulos/undefined
      );

      const platosEditadosIds = new Set(
        comandaEditando.platosEditados.map(p => {
          const platoId = p.plato?._id || p.plato;
          return platoId?.toString();
        }).filter(id => id) // Filtrar valores nulos/undefined
      );

      // Encontrar platos eliminados
      const platosEliminados = platosOriginales.filter(p => {
        const platoId = (p.plato?._id || p.plato || p._id)?.toString();
        return platoId && !platosEditadosIds.has(platoId);
      });

      // Encontrar platos agregados (nuevos)
      const platosAgregadosNuevos = comandaEditando.platosEditados.filter(p => {
        const platoId = (p.plato?._id || p.plato)?.toString();
        // Asegurar que el platoId existe y no está en los originales
        if (!platoId) {
          console.warn('⚠️ Plato sin ID encontrado en platosEditados:', p);
          return false;
        }
        const esNuevo = !platosOriginalesIds.has(platoId);
        if (esNuevo) {
          console.log(`✅ Plato nuevo detectado: ${p.nombre || 'Sin nombre'} (ID: ${platoId})`);
        }
        return esNuevo;
      });
      
      console.log(`📊 Detección de cambios: ${platosAgregadosNuevos.length} platos agregados, ${platosEliminados.length} platos eliminados`);

      // Si hay platos eliminados O agregados, mostrar modal de confirmación
      if (platosEliminados.length > 0 || platosAgregadosNuevos.length > 0) {
        setPlatosAEliminar(platosEliminados);
        setPlatosAgregados(platosAgregadosNuevos); // Guardar platos agregados
        setModalConfirmarEliminacionVisible(true);
        return; // No continuar hasta que se confirme
      }

      // Si no hay platos eliminados, guardar directamente
      await guardarEdicionSinEliminaciones();
    } catch (error) {
      console.error("Error al verificar cambios:", error);
      Alert.alert("Error", "No se pudo verificar los cambios");
    }
  };

  const guardarEdicionSinEliminaciones = async () => {
    if (!comandaEditando) return;

    try {
      const platosData = comandaEditando.platosEditados.map(p => {
        const platoCompleto = platos.find(pl => pl._id === p.plato || pl._id === p.plato?.toString());
        return {
          plato: p.plato,
          platoId: platoCompleto?.id || p.platoId || null,
          estado: p.estado || "en_espera"
        };
      });

      const cantidades = comandaEditando.platosEditados.map(p => p.cantidad || 1);

      const updateData = {
        mesas: comandaEditando.mesaSeleccionada._id,
        platos: platosData,
        cantidades: cantidades,
        observaciones: comandaEditando.observacionesEditadas || "",
      };

      const comandaUpdateURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaEditando._id}`
        : `${COMANDA_API}/${comandaEditando._id}`;
      await axios.put(comandaUpdateURL, updateData, { timeout: 5000 });
      
      Alert.alert("✅", "Comanda actualizada exitosamente");
      setModalEditVisible(false);
      setComandaEditando(null);
      setTipoPlatoFiltro(null);
      setSearchPlato("");
      setCategoriaFiltro(null);
      obtenerComandasHoy();
      obtenerMesas();
    } catch (error) {
      console.error("Error actualizando comanda:", error);
      Alert.alert("Error", error.response?.data?.message || "No se pudo actualizar la comanda");
    }
  };

  const handleConfirmarEliminacionPlatos = async () => {
    console.log('🔴 handleConfirmarEliminacionPlatos llamado');
    
    if (!motivoEliminacion || motivoEliminacion.trim() === "") {
      Alert.alert("Error", "Por favor, indique el motivo de la edición");
      return;
    }

    if (!comandaEditando) {
      console.error('❌ No hay comanda editando');
      Alert.alert("Error", "No hay comanda para editar");
      return;
    }

    console.log('📋 Comanda a editar:', comandaEditando._id);
    console.log('🗑️ Platos a eliminar:', platosAEliminar.length);
    console.log('➕ Platos a agregar:', platosAgregados.length);
    console.log('📝 Motivo de edición:', motivoEliminacion);

    try {
      // Obtener usuario actual
      const user = await AsyncStorage.getItem("user");
      const userInfo = user ? JSON.parse(user) : null;
      const usuarioId = userInfo?._id || null;
      console.log('👤 Usuario ID:', usuarioId);

      // Preparar platos eliminados para el endpoint
      const platosEliminadosData = platosAEliminar.map(p => {
        const platoId = p.plato?._id || p.plato || p._id;
        const platoNumId = p.platoId || p.plato?.id;
        return {
          platoId: platoNumId || platoId,
          plato: platoId
        };
      });

      // Identificar platos originales que permanecen (no eliminados)
      const platosOriginalesIds = new Set(
        platosOriginales.map(p => {
          const platoId = p.plato?._id || p.plato || p._id;
          return platoId?.toString();
        })
      );

      const platosEliminadosIds = new Set(
        platosEliminadosData.map(p => {
          const platoId = p.plato?._id || p.plato;
          return platoId?.toString();
        })
      );

      // Separar platos en: originales que permanecen vs nuevos agregados
      const platosOriginalesQuePermanecen = comandaEditando.platosEditados.filter(p => {
        const platoId = (p.plato?._id || p.plato)?.toString();
        return platoId && platosOriginalesIds.has(platoId) && !platosEliminadosIds.has(platoId);
      });

      const platosNuevosAgregados = comandaEditando.platosEditados.filter(p => {
        const platoId = (p.plato?._id || p.plato)?.toString();
        return !platosOriginalesIds.has(platoId);
      });

      console.log('📊 Análisis de platos:');
      console.log(`   - Originales que permanecen: ${platosOriginalesQuePermanecen.length}`);
      console.log(`   - Nuevos agregados: ${platosNuevosAgregados.length}`);
      console.log(`   - Eliminados: ${platosEliminadosData.length}`);

      // Preparar SOLO los platos nuevos agregados (no los originales que permanecen)
      const platosNuevosData = platosNuevosAgregados.map((p, index) => {
        // CRÍTICO: Usar el platoId que ya está guardado cuando se agregó el plato
        // Solo buscar en el array si no existe platoId (para platos originales)
        let platoIdFinal = p.platoId;
        let platoIdValidado = p.plato;
        
        // Asegurar que tenemos el _id del plato (puede ser ObjectId o string)
        if (!platoIdValidado) {
          console.error(`❌ Error: Plato nuevo sin _id en índice ${index}:`, p);
          return null;
        }
        
        // Si no hay platoId guardado, buscar en el array de platos
        if (!platoIdFinal && p.plato) {
          const platoCompleto = platos.find(pl => {
            const platoIdStr = pl._id?.toString();
            const pPlatoStr = p.plato?.toString();
            return platoIdStr === pPlatoStr || pl._id === p.plato;
          });
          
          if (platoCompleto) {
            platoIdFinal = platoCompleto.id || null;
            platoIdValidado = platoCompleto._id;
            console.log(`✅ Plato encontrado por _id: ${platoCompleto.nombre} (id numérico: ${platoIdFinal})`);
          } else {
            console.warn(`⚠️ No se encontró plato con _id: ${p.plato} en el array de platos disponibles`);
          }
        } else if (p.plato) {
          // Validar que el plato existe y coincide con el nombre guardado
          const platoValidado = platos.find(pl => {
            const platoIdStr = pl._id?.toString();
            const pPlatoStr = p.plato?.toString();
            const coincideId = platoIdStr === pPlatoStr || pl._id === p.plato;
            // Validación adicional: el nombre debe coincidir
            const coincideNombre = pl.nombre === p.nombre;
            return coincideId && coincideNombre;
          });
          
          // Si encontramos el plato validado, usar su ID numérico
          if (platoValidado) {
            platoIdFinal = platoValidado.id || platoIdFinal;
            platoIdValidado = platoValidado._id;
            console.log(`✅ Plato validado: ${platoValidado.nombre} (id numérico: ${platoIdFinal})`);
          } else {
            // Si no encontramos el plato validado, buscar solo por ID
            const platoPorId = platos.find(pl => {
              const platoIdStr = pl._id?.toString();
              const pPlatoStr = p.plato?.toString();
              return platoIdStr === pPlatoStr || pl._id === p.plato;
            });
            if (platoPorId) {
              platoIdFinal = platoPorId.id || platoIdFinal;
              platoIdValidado = platoPorId._id;
              console.log(`✅ Plato encontrado solo por ID: ${platoPorId.nombre} (id numérico: ${platoIdFinal})`);
            } else {
              console.warn(`⚠️ No se pudo validar plato: ${p.nombre} (ID: ${p.plato})`);
            }
          }
        }
        
        // Asegurar que tenemos al menos el _id del plato
        if (!platoIdValidado) {
          console.error(`❌ Error crítico: No se pudo obtener _id del plato en índice ${index}:`, p);
          return null;
        }
        
        console.log(`🍽️ [${index}] Preparando plato: nombre="${p.nombre}", platoId guardado=${p.platoId}, platoId final=${platoIdFinal}, plato _id=${platoIdValidado}`);
        
        return {
          plato: platoIdValidado,
          platoId: platoIdFinal || p.platoId || null,
          estado: p.estado || "en_espera",
          cantidad: p.cantidad || 1
        };
      }).filter(p => p !== null); // Filtrar platos nulos (errores)

      // Usar el endpoint de edición con auditoría (una sola llamada, más rápido y confiable)
      const comandaEditURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaEditando._id}/editar-platos`
        : `${COMANDA_API}/${comandaEditando._id}/editar-platos`;
      
      console.log('📤 Llamando endpoint de edición:', comandaEditURL);
      console.log('📋 Platos nuevos:', platosNuevosData.length);
      console.log('🗑️ Platos eliminados:', platosEliminadosData.length);
      
      const response = await axios.put(
        comandaEditURL,
        {
          platosNuevos: platosNuevosData,
          platosEliminados: platosEliminadosData,
          motivo: motivoEliminacion.trim(),
          usuarioId: usuarioId
        },
        { timeout: 30000 } // Aumentar timeout a 30 segundos para operaciones más complejas
      );
      
      console.log('✅ Edición completada:', response.data);

      console.log('✅ Proceso completado, cerrando modales');
      const mensajeExito = platosAgregados.length > 0 && platosAEliminar.length > 0
        ? `Comanda modificada exitosamente:\n- ${platosAgregados.length} plato(s) agregado(s)\n- ${platosAEliminar.length} plato(s) eliminado(s)`
        : platosAgregados.length > 0
        ? `Comanda modificada exitosamente:\n- ${platosAgregados.length} plato(s) agregado(s)`
        : `Comanda modificada exitosamente:\n- ${platosAEliminar.length} plato(s) eliminado(s)`;
      Alert.alert("✅", mensajeExito);
      setModalConfirmarEliminacionVisible(false);
      setModalEditVisible(false);
      setComandaEditando(null);
      setPlatosAEliminar([]);
      setPlatosAgregados([]); // Limpiar platos agregados
      setMotivoEliminacion("");
      setTipoPlatoFiltro(null);
      setSearchPlato("");
      setCategoriaFiltro(null);
      obtenerComandasHoy();
      obtenerMesas();
    } catch (error) {
      console.error("❌ Error al eliminar platos:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error message:", error.message);
      Alert.alert(
        "Error", 
        error.response?.data?.message || error.message || "No se pudieron eliminar los platos"
      );
    }
  };

  const handleRemoverPlato = (index) => {
    if (!comandaEditando) return;
    
    // Eliminar plato del array local (se confirmará al guardar con el modal existente)
    const nuevosPlatos = [...comandaEditando.platosEditados];
    nuevosPlatos.splice(index, 1);
    setComandaEditando({
      ...comandaEditando,
      platosEditados: nuevosPlatos,
    });
  };

  const handleCambiarCantidad = (index, delta) => {
    if (!comandaEditando) return;
    const nuevosPlatos = [...comandaEditando.platosEditados];
    const nuevaCantidad = Math.max(1, (nuevosPlatos[index].cantidad || 1) + delta);
    nuevosPlatos[index].cantidad = nuevaCantidad;
    setComandaEditando({
      ...comandaEditando,
      platosEditados: nuevosPlatos,
    });
  };

  const calcularTotal = () => {
    if (!comandaEditando) return 0;
    return comandaEditando.platosEditados.reduce((total, p) => {
      return total + (p.precio || 0) * (p.cantidad || 1);
    }, 0);
  };

  const handleAgregarPlato = (plato) => {
    if (!comandaEditando) return;
    
    // Verificar si el plato ya existe en la comanda
    const platoExistente = comandaEditando.platosEditados.find(
      p => {
        const pPlatoStr = p.plato?.toString();
        const platoIdStr = plato._id?.toString();
        return pPlatoStr === platoIdStr || p.plato === plato._id;
      }
    );
    
    if (platoExistente) {
      // Si ya existe, aumentar la cantidad
      const index = comandaEditando.platosEditados.indexOf(platoExistente);
      handleCambiarCantidad(index, 1);
      Alert.alert("✅", `Cantidad de ${plato.nombre} aumentada`);
    } else {
      // Si no existe, agregarlo
      // CRÍTICO: Guardar tanto _id como id numérico para evitar problemas de búsqueda
      const nuevoPlato = {
        plato: plato._id,
        platoId: plato.id || null, // ID numérico del plato (importante para el backend)
        estado: "en_espera",
        cantidad: 1,
        nombre: plato.nombre,
        precio: plato.precio,
      };

      console.log(`➕ Agregando plato: nombre="${plato.nombre}", _id=${plato._id}, id=${plato.id}`);

      setComandaEditando({
        ...comandaEditando,
        platosEditados: [...comandaEditando.platosEditados, nuevoPlato],
      });
      Alert.alert("✅", `${plato.nombre} agregado`);
    }
  };

  const categorias = tipoPlatoFiltro
    ? [...new Set(platos.filter(p => p.tipo === tipoPlatoFiltro).map(p => p.categoria))].filter(Boolean)
    : [];
  
  const platosFiltrados = platos.filter(p => {
    const matchTipo = !tipoPlatoFiltro || p.tipo === tipoPlatoFiltro;
    const matchSearch = !searchPlato || p.nombre.toLowerCase().includes(searchPlato.toLowerCase());
    const matchCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return matchTipo && matchSearch && matchCategoria;
  });

  const getCategoriaIcon = (categoria) => {
    if (categoria?.includes("Carnes") || categoria?.includes("CARNE")) return "🥩";
    if (categoria?.includes("Pescado") || categoria?.includes("PESCADO")) return "🐟";
    if (categoria?.includes("Entrada") || categoria?.includes("ENTRADA")) return "🥗";
    if (categoria?.includes("Bebida") || categoria?.includes("JUGOS") || categoria?.includes("Gaseosa")) return "🥤";
    return "🍽️";
  };

  const handleLiberarMesa = async (mesa) => {
    Alert.alert(
      "🔄 Liberar Mesa",
      `¿Estás seguro de que deseas liberar la mesa ${mesa.nummesa}?\n\nLa mesa volverá a estado "Libre" y estará disponible para otros mozos.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Liberar",
          onPress: async () => {
            try {
              if (!mesa || !mesa._id) {
                Alert.alert("Error", "No se pudo obtener la información de la mesa");
                return;
              }

              // Extraer el ID de la mesa de forma segura
              let mesaId = mesa._id;
              if (mesaId && typeof mesaId === 'object') {
                mesaId = mesaId.toString();
              }

              console.log("🔄 Liberando mesa:", mesaId);
              
              // Actualizar mesa a "libre"
              const mesaUpdateURL = apiConfig.isConfigured 
                ? `${apiConfig.getEndpoint('/mesas')}/${mesaId}/estado`
                : `${MESAS_API_UPDATE}/${mesaId}/estado`;
              await axios.put(
                mesaUpdateURL,
                { estado: "libre" },
                { timeout: 5000 }
              );
              
              console.log("✅ Mesa liberada:", mesa.nummesa);
              try {
                await AsyncStorage.multiRemove(["ultimoBoucher", "mesaPagada"]);
              } catch (e) { /* ignorar */ }
              Alert.alert("✅", `Mesa ${mesa.nummesa} liberada exitosamente.\n\nLa mesa está ahora disponible para otros mozos.`);
              // Actualizar datos
              obtenerComandasHoy();
              obtenerMesas();
            } catch (error) {
              console.error("❌ Error liberando mesa:", error);
              await logger.error(error, {
                action: 'liberar_mesa',
                mesaId: mesa?._id,
                mesaNum: mesa?.nummesa,
                timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
              });
              
              const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
              Alert.alert("Error", `No se pudo liberar la mesa.\n\n${errorMsg}`);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    handleLiberarMesaRef.current = handleLiberarMesa;
  }, [handleLiberarMesa]);

  // Función para abrir modal de eliminar todas las comandas
  const handleEliminarTodasComandasMesa = async (mesa, comandasMesa) => {
    if (!comandasMesa || comandasMesa.length === 0) {
      Alert.alert("Error", "No hay comandas para eliminar");
      return;
    }

    // Guardar comandas y abrir modal
    setComandasAEliminar(comandasMesa);
    setMotivoEliminacionComanda("");
    setModalEliminarTodasVisible(true);
  };

  // Handler para abrir modal de eliminar platos de comanda
  const handleAbrirEliminarPlatos = async (mesa, comandasMesa) => {
    if (!comandasMesa || comandasMesa.length === 0) {
      Alert.alert("Error", "No hay comandas activas en esta mesa");
      return;
    }

    // Obtener la comanda activa más reciente
    const comandaActiva = comandasMesa[0];
    
    if (!comandaActiva) {
      Alert.alert("Error", "No se encontró una comanda activa");
      return;
    }

    // Verificar que la comanda tenga platos
    if (!comandaActiva.platos || comandaActiva.platos.length === 0) {
      Alert.alert("Error", "La comanda no tiene platos");
      return;
    }

    // Determinar el estado de la mesa para filtrar platos correctamente
    const estadoMesa = mesa?.estado?.toLowerCase() || "";
    const estadoComanda = comandaActiva.status?.toLowerCase() || "";
    
    // Si la mesa está en "recoger" o la comanda tiene estado "recoger", filtrar platos "recoger"
    // Si está en "preparado", filtrar platos "entregado"
    const estadoPlatoFiltrar = (estadoMesa === "recoger" || estadoComanda === "recoger") ? "recoger" : "entregado";
    
    // Filtrar platos según el estado de la mesa/comanda
    const platosFiltrados = comandaActiva.platos.filter((platoItem, index) => {
      const estado = platoItem.estado?.toLowerCase() || "";
      return estado === estadoPlatoFiltrar && !platoItem.eliminado;
    });

    if (platosFiltrados.length === 0) {
      const mensaje = estadoPlatoFiltrar === "recoger" 
        ? "No hay platos en estado 'recoger' para eliminar en esta comanda"
        : "No hay platos entregados para eliminar en esta comanda";
      Alert.alert("Info", mensaje);
      return;
    }

    // Guardar comanda con información del estado para el modal
    setComandaEliminarPlatos({
      ...comandaActiva,
      estadoFiltro: estadoPlatoFiltrar,
      estadoMesa: estadoMesa
    });
    setPlatosSeleccionadosEliminar([]);
    setMotivoEliminarPlatos("");
    setModalEliminarPlatosVisible(true);
  };

  // Handler para confirmar eliminación de platos
  const handleConfirmarEliminarPlatos = async () => {
    if (!comandaEliminarPlatos) {
      Alert.alert("Error", "No hay comanda seleccionada");
      return;
    }

    if (platosSeleccionadosEliminar.length === 0) {
      Alert.alert("Error", "Por favor, selecciona al menos un plato para eliminar");
      return;
    }

    if (!motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5) {
      Alert.alert("Error", "Por favor, indique el motivo de la eliminación (mínimo 5 caracteres)");
      return;
    }

    // FIX #3: Verificar si se seleccionaron TODOS los platos disponibles
    const estadoFiltro = comandaEliminarPlatos?.estadoFiltro || "entregado";
    const platosDisponibles = comandaEliminarPlatos.platos.filter((p, i) => {
      const estado = p.estado?.toLowerCase() || "";
      return estado === estadoFiltro && !p.eliminado;
    });
    const totalPlatosDisponibles = platosDisponibles.length;
    const totalSeleccionados = platosSeleccionadosEliminar.length;

    // Si se seleccionaron todos los platos, eliminar la comanda completa
    if (totalSeleccionados === totalPlatosDisponibles && totalPlatosDisponibles > 0) {
      Alert.alert(
        "⚠️ Eliminar Comanda Completa",
        `Has seleccionado todos los platos (${totalSeleccionados}). Esto eliminará la comanda completa. ¿Deseas continuar?`,
        [
          {
            text: "Cancelar",
            style: "cancel"
          },
          {
            text: "Eliminar Comanda",
            style: "destructive",
            onPress: async () => {
              try {
                setModalEliminarPlatosVisible(false);
                
                // Obtener la mesa desde comandaEliminarPlatos
                const mesa = comandaEliminarPlatos.mesas || mesaOpciones;
                const comandasMesa = [comandaEliminarPlatos];
                
                // Llamar a la función existente para eliminar última comanda
                await handleEliminarUltimaComanda(mesa, comandasMesa);
                
                // Limpiar estados
                setComandaEliminarPlatos(null);
                setPlatosSeleccionadosEliminar([]);
                setMotivoEliminarPlatos("");
              } catch (error) {
                console.error('❌ Error eliminando comanda completa:', error);
                Alert.alert("Error", "No se pudo eliminar la comanda. Por favor, intenta nuevamente.");
              }
            }
          }
        ]
      );
      return;
    }

    // Eliminar con loading paso a paso y verificaciones
    try {
      // Cerrar modal inmediatamente
      setModalEliminarPlatosVisible(false);
      
      // Preparar índices de platos a eliminar
      const platosAEliminar = platosSeleccionadosEliminar.map(index => parseInt(index));
      const comandaId = comandaEliminarPlatos._id?.toString() || comandaEliminarPlatos._id;
      const usuarioId = userInfo?._id || userInfo?.id;
      
      // 🔥 CRÍTICO: Guardar ID antes de cualquier operación
      const comandaIdAntes = comandaId;
      console.log(`[ELIMINAR PLATOS] ID antes de eliminar: ${comandaIdAntes?.slice(-6)}`);
      
      // Resetear pasos
      setPasosEliminar([
        { id: 1, label: "Eliminando platos", status: "pending" },
        { id: 2, label: "Verificando ID comanda", status: "pending" },
        { id: 3, label: "Sincronizando datos", status: "pending" },
        { id: 4, label: "Actualizando mesa", status: "pending" }
      ]);
      
      // Mostrar loading con verificaciones
      setLoadingEliminarPlatos(true);
      setMensajeLoadingEliminar("Eliminando platos seleccionados...");
      actualizarPaso(1, "progress");
      
      const eliminarURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/eliminar-platos`
        : `${COMANDA_API}/${comandaId}/eliminar-platos`;
      
      console.log('🗑️ Eliminando platos de comanda:', {
        comandaId: comandaIdAntes?.slice(-6),
        platosAEliminar,
        motivo: motivoEliminarPlatos.trim(),
        usuarioId
      });
      
      // PASO 1: Eliminar platos backend
      const response = await axios.put(
        eliminarURL,
        {
          platosAEliminar: platosAEliminar,
          motivo: motivoEliminarPlatos.trim(),
          mozoId: usuarioId
        },
        { timeout: 15000 }
      );
      
      console.log('✅ Platos eliminados exitosamente:', response.data);
      console.log(`✅ [ELIMINAR PLATOS] Platos restantes: ${response.data.platosRestantes || response.data.comanda?.platos?.length || 0}`);
      actualizarPaso(1, "completed");
      await delay(300);
      
      // PASO 2: Verificar ID NO cambió
      actualizarPaso(2, "progress");
      setMensajeLoadingEliminar("Verificando integridad de la comanda...");
      
      const comandaIdDespues = response.data.comanda?._id?.toString() || response.data.comanda?._id;
      console.log(`[ELIMINAR PLATOS] ID después de eliminar: ${comandaIdDespues?.slice(-6)}`);
      console.log(`[ELIMINAR PLATOS] ID verificado en backend: ${response.data.idVerificado}`);
      
      if (comandaIdAntes !== comandaIdDespues) {
        actualizarPaso(2, "error");
        setMensajeLoadingEliminar("⚠️ Error: ID de comanda cambió");
        await delay(2000);
        setLoadingEliminarPlatos(false);
        
        Alert.alert(
          "Error Crítico",
          `ID de comanda cambió después de eliminar platos.\n\nAntes: ${comandaIdAntes?.slice(-6)}\nDespués: ${comandaIdDespues?.slice(-6)}\n\nContacta soporte técnico.`,
          [{ text: "OK" }]
        );
        return;
      }
      
      actualizarPaso(2, "completed");
      await delay(300);
      
      // Verificar si la comanda fue eliminada completamente
      const comandaEliminadaCompleta = response.data.comandaEliminadaCompleta === true || 
                                       response.data.comanda?.eliminada === true ||
                                       (response.data.platosRestantes !== undefined && response.data.platosRestantes === 0);
      
      // 🔥 CRÍTICO: Verificar que los platos fueron REMOVIDOS (no solo marcados)
      const platosRestantes = response.data.platosRestantes || response.data.comanda?.platos?.length || 0;
      console.log(`✅ [ELIMINAR PLATOS] Platos removidos correctamente. Restantes: ${platosRestantes}`);
      
      if (comandaEliminadaCompleta) {
        console.log(`⚠️ [ELIMINAR PLATOS] Comanda ${comandaIdAntes?.slice(-6)} eliminada completamente (sin platos)`);
        // Remover del estado local
        let comandasActualizadas = comandas.filter(c => {
          const cId = c._id?.toString ? c._id.toString() : c._id;
          return cId !== comandaIdAntes;
        });
        setComandas(comandasActualizadas);
      } else {
        // Actualizar comanda en estado local con platos removidos
        // La comanda ahora tiene menos platos (removidos del array)
        console.log(`✅ [ELIMINAR PLATOS] Comanda actualizada con ${platosRestantes} plato(s) restante(s)`);
      }
      
      // PASO 3: Sincronizar datos backend
      actualizarPaso(3, "progress");
      setMensajeLoadingEliminar("Sincronizando datos con servidor...");
      
      await obtenerMesas();
      await obtenerComandasHoy();
      
      actualizarPaso(3, "completed");
      await delay(300);
      
      // PASO 4: Actualizar estado mesa
      actualizarPaso(4, "progress");
      setMensajeLoadingEliminar("Actualizando estado de mesa...");
      
      const mesa = comandaEliminarPlatos.mesas || mesaOpciones;
      if (mesa?._id) {
        // Verificar estado mesa (similar a handleEliminarComanda)
        try {
          await obtenerMesas();
          console.log("✅ [ELIMINAR PLATOS] Estado de mesa actualizado");
        } catch (error) {
          console.warn("⚠️ Error actualizando estado de mesa:", error);
        }
      }
      
      // Verificar comanda actualizada
      const comandaActualizada = comandas.find(c => {
        const cId = c._id?.toString ? c._id.toString() : c._id;
        return cId === comandaIdAntes;
      });
      
      if (!comandaActualizada && comandaEliminadaCompleta) {
        console.log('[ELIMINAR PLATOS] Comanda eliminada completa OK');
      } else if (!comandaActualizada) {
        console.warn('[ELIMINAR PLATOS] Comanda no encontrada después de sincronización');
      }
      
      actualizarPaso(4, "completed");
      await delay(300);
      
      // Success
      setMensajeLoadingEliminar("✓ Platos eliminados correctamente");
      await delay(1000);
      setLoadingEliminarPlatos(false);
      
      // Limpiar estados
      setComandaEliminarPlatos(null);
      setPlatosSeleccionadosEliminar([]);
      setMotivoEliminarPlatos("");
      
      // Alert éxito
      Alert.alert(
        "✅ Éxito",
        `${platosAEliminar.length} plato(s) eliminado(s) exitosamente${comandaEliminadaCompleta ? '\n\nComanda eliminada completa (sin platos)' : ''}`,
        [{ text: "OK" }]
      );
      
    } catch (error) {
      setLoadingEliminarPlatos(false);
      setMensajeLoadingEliminar("");
      
      // Marcar pasos con error
      pasosEliminar.forEach(p => {
        if (p.status === "progress") {
          actualizarPaso(p.id, "error");
        }
      });
      
      console.error('❌ Error eliminando platos:', error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "No se pudieron eliminar los platos. Por favor, intenta nuevamente.",
        [{ text: "OK" }]
      );
    }
  };

  // Función para confirmar eliminación de todas las comandas (desde modal)
  const handleConfirmarEliminarTodas = async () => {
    if (!motivoEliminacionComanda || motivoEliminacionComanda.trim() === "") {
      Alert.alert("Error", "Por favor, indique el motivo de la eliminación");
      return;
    }

    if (!comandasAEliminar || comandasAEliminar.length === 0) {
      Alert.alert("Error", "No hay comandas para eliminar");
      return;
    }

    // Obtener mesa desde la primera comanda
    const mesa = comandasAEliminar[0]?.mesas || mesaOpciones;

    try {
      // Cerrar modal
      setModalEliminarTodasVisible(false);
      
      // Activar overlay de carga
      setEliminandoTodasComandas(true);
      setMensajeCargaEliminacionTodas("Eliminando comandas...");
      
      console.log(`🗑️ Eliminando todas las comandas de la mesa ${mesa?.nummesa}...`);
      console.log(`📋 Comandas a eliminar: ${comandasAEliminar.length}`);
      console.log(`📝 Motivo: ${motivoEliminacionComanda}`);
      
      // ✅ LLAMAR AL ENDPOINT CON MOTIVO (nuevo endpoint backend)
      let mesaId = mesa?._id;
      if (mesaId && typeof mesaId === 'object') {
        mesaId = mesaId.toString();
      }
      
      const deleteURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/mesa/${mesaId}/todas`
        : `${COMANDA_API}/mesa/${mesaId}/todas`;
      
      await axios.delete(deleteURL, { 
        data: { motivo: motivoEliminacionComanda.trim() },
        timeout: 15000 
      });
      
      console.log("✅ Todas las comandas eliminadas del servidor con auditoría");
      
      // Si todas las comandas se eliminaron exitosamente, actualizar mesa a estado "libre"
      if (mesa && mesaId) {
        try {
          setMensajeCargaEliminacionTodas("Actualizando estado de la mesa...");
          
          const mesaNum = mesa.nummesa;
          console.log(`🔄 Actualizando mesa ${mesaNum} a estado "libre"...`);
          
          const mesaUpdateURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/mesas')}/${mesaId}/estado`
            : `${MESAS_API_UPDATE}/${mesaId}/estado`;
          
          await axios.put(
            mesaUpdateURL,
            { estado: "libre" },
            { timeout: 5000 }
          );
          
          console.log(`✅ Mesa ${mesaNum} actualizada a estado "libre"`);
          
          // Verificar que la mesa se haya actualizado correctamente
          setMensajeCargaEliminacionTodas("Verificando estado de la mesa...");
          
          let mesaVerificada = false;
          let intentos = 0;
          const maxIntentos = 10;
          
          while (!mesaVerificada && intentos < maxIntentos) {
            try {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const mesasURL = apiConfig.isConfigured 
                ? apiConfig.getEndpoint('/mesas')
                : SELECTABLE_API_GET;
              const mesasResponse = await axios.get(mesasURL, { timeout: 5000 });
              
              const mesaEncontrada = mesasResponse.data.find(m => {
                const mId = m._id?.toString ? m._id.toString() : m._id;
                const mesaIdStr = mesaId?.toString ? mesaId.toString() : mesaId;
                return mId === mesaIdStr || m.nummesa === mesaNum;
              });
              
              if (mesaEncontrada) {
                const estadoMesaVerificado = (mesaEncontrada.estado || '').toLowerCase();
                console.log(`🔄 Intento ${intentos + 1}/${maxIntentos}: Mesa ${mesaNum} en estado "${estadoMesaVerificado}"`);
                
                if (estadoMesaVerificado === 'libre') {
                  mesaVerificada = true;
                  console.log(`✅ Mesa ${mesaNum} confirmada en estado "libre"`);
                  break;
                }
              }
              
              intentos++;
            } catch (error) {
              console.error(`⚠️ Error verificando mesa (intento ${intentos + 1}):`, error);
              intentos++;
            }
          }
          
          if (!mesaVerificada) {
            console.warn(`⚠️ No se pudo verificar el estado de la mesa después de ${maxIntentos} intentos`);
          }
          
        } catch (error) {
          console.error(`❌ Error actualizando estado de la mesa:`, error);
        }
      }
      
      setMensajeCargaEliminacionTodas("Actualizando datos...");
      
      // Actualizar comandas y mesas desde el servidor
      await obtenerComandasHoy();
      await obtenerMesas();
      
      // Ocultar overlay
      setEliminandoTodasComandas(false);
      
      // Limpiar estado
      setComandasAEliminar([]);
      setMotivoEliminacionComanda("");
      
      Alert.alert(
        "✅ Éxito",
        `Todas las comandas de la mesa ${mesa?.nummesa} han sido eliminadas.\n\nLa mesa ahora está libre y disponible para otro mozo.`
      );
    } catch (error) {
      console.error("❌ Error eliminando comandas de la mesa:", error);
      
      // Ocultar overlay en caso de error
      setEliminandoTodasComandas(false);
      
      const errorMessage = error.response?.data?.message || error.message || "No se pudieron eliminar las comandas. Por favor, intenta nuevamente.";
      Alert.alert("Error", errorMessage);
    }
  };

  // Función antigua (mantener para compatibilidad pero no usar)
  const handleEliminarTodasComandasMesaOld = async (mesa, comandasMesa) => {
    Alert.alert(
      "⚠️ Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar todas las comandas de la mesa ${mesa?.nummesa || 'N/A'}?\n\nEsta acción eliminará ${comandasMesa.length} comanda(s) y la mesa quedará libre para que otro mozo pueda servir.\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            // Activar overlay de carga
            setEliminandoTodasComandas(true);
            setMensajeCargaEliminacionTodas("Eliminando comandas...");
            
            try {
              console.log(`🗑️ Eliminando todas las comandas de la mesa ${mesa.nummesa}...`);
              console.log(`📋 Comandas a eliminar: ${comandasMesa.length}`);
              
              // Eliminar todas las comandas de la mesa
              setMensajeCargaEliminacionTodas(`Eliminando ${comandasMesa.length} comanda(s)...`);
              
              const eliminaciones = comandasMesa.map(async (comanda, index) => {
                try {
                  let comandaId = comanda._id;
                  
                  // Si _id es un objeto (puede pasar con populate), extraer el string
                  if (comandaId && typeof comandaId === 'object') {
                    comandaId = comandaId.toString();
                  }
                  
                  if (comandaId) {
                    console.log(`  - Eliminando comanda #${comanda.comandaNumber || comandaId.slice(-4)}`);
                    setMensajeCargaEliminacionTodas(`Eliminando comanda ${index + 1}/${comandasMesa.length}...`);
                    
                    const deleteURL = apiConfig.isConfigured 
                      ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}`
                      : `${COMANDA_API}/${comandaId}`;
                    await axios.delete(deleteURL, { timeout: 5000 });
                    return { success: true, comandaId };
                  } else {
                    console.warn(`  - ⚠️ No se pudo obtener ID de comanda:`, comanda);
                    return { success: false, comandaId: null };
                  }
                } catch (error) {
                  console.error(`  - ❌ Error eliminando comanda:`, error.message);
                  return { success: false, error: error.message };
                }
              });
              
              const resultados = await Promise.all(eliminaciones);
              const exitosas = resultados.filter(r => r.success).length;
              const fallidas = resultados.filter(r => !r.success).length;
              
              console.log(`✅ Eliminación completada: ${exitosas} exitosas, ${fallidas} fallidas`);
              
              // Si todas las comandas se eliminaron exitosamente, actualizar mesa a estado "libre"
              if (fallidas === 0 && mesa && mesa._id) {
                try {
                  // Extraer el ID de la mesa de forma segura
                  let mesaId = mesa._id;
                  if (mesaId && typeof mesaId === 'object') {
                    mesaId = mesaId.toString();
                  }
                  
                  const mesaNum = mesa.nummesa;
                  
                  setMensajeCargaEliminacionTodas("Actualizando estado de la mesa...");
                  console.log(`🔄 Actualizando mesa ${mesaNum} a estado "libre"...`);
                  
                  // Actualizar mesa a "libre"
                  const mesaUpdateURL = apiConfig.isConfigured 
                    ? `${apiConfig.getEndpoint('/mesas')}/${mesaId}/estado`
                    : `${MESAS_API_UPDATE}/${mesaId}/estado`;
                  
                  await axios.put(
                    mesaUpdateURL,
                    { estado: "libre" },
                    { timeout: 5000 }
                  );
                  
                  console.log(`✅ Mesa ${mesaNum} actualizada a estado "libre"`);
                  
                  // Verificar que la mesa se haya actualizado correctamente
                  setMensajeCargaEliminacionTodas("Verificando estado de la mesa...");
                  
                  let mesaVerificada = false;
                  let intentos = 0;
                  const maxIntentos = 10; // Máximo 10 intentos (5 segundos)
                  
                  while (!mesaVerificada && intentos < maxIntentos) {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms entre intentos
                      
                      const mesasURL = apiConfig.isConfigured 
                        ? apiConfig.getEndpoint('/mesas')
                        : SELECTABLE_API_GET;
                      const mesasResponse = await axios.get(mesasURL, { timeout: 5000 });
                      
                      const mesaEncontrada = mesasResponse.data.find(m => {
                        const mId = m._id?.toString ? m._id.toString() : m._id;
                        const mesaIdStr = mesaId?.toString ? mesaId.toString() : mesaId;
                        return mId === mesaIdStr || m.nummesa === mesaNum;
                      });
                      
                      if (mesaEncontrada) {
                        const estadoMesaVerificado = (mesaEncontrada.estado || '').toLowerCase();
                        console.log(`🔄 Intento ${intentos + 1}/${maxIntentos}: Mesa ${mesaNum} en estado "${estadoMesaVerificado}"`);
                        
                        if (estadoMesaVerificado === 'libre') {
                          mesaVerificada = true;
                          console.log(`✅ Mesa ${mesaNum} confirmada en estado "libre"`);
                          break;
                        }
                      }
                      
                      intentos++;
                    } catch (error) {
                      console.error(`⚠️ Error verificando mesa (intento ${intentos + 1}):`, error);
                      intentos++;
                    }
                  }
                  
                  if (!mesaVerificada) {
                    console.warn(`⚠️ No se pudo verificar el estado de la mesa después de ${maxIntentos} intentos`);
                    // Continuar de todas formas, el backend debería haber actualizado la mesa
                  }
                  
                } catch (error) {
                  console.error(`❌ Error actualizando estado de la mesa:`, error);
                  // No mostrar error al usuario, solo loguear
                  // La mesa se actualizará cuando se recarguen los datos
                }
              }
              
              setMensajeCargaEliminacionTodas("Actualizando datos...");
              
              // Actualizar comandas y mesas desde el servidor
              await obtenerComandasHoy();
              await obtenerMesas();
              
              // Ocultar overlay
              setEliminandoTodasComandas(false);
              
              if (fallidas === 0) {
                Alert.alert(
                  "✅ Éxito",
                  `Todas las comandas de la mesa ${mesa.nummesa} han sido eliminadas.\n\nLa mesa ahora está libre y disponible para otro mozo.`
                );
              } else if (exitosas > 0) {
                Alert.alert(
                  "⚠️ Parcial",
                  `Se eliminaron ${exitosas} de ${comandasMesa.length} comandas.\n\n${fallidas} comanda(s) no se pudieron eliminar.`
                );
              } else {
                Alert.alert(
                  "❌ Error",
                  "No se pudieron eliminar las comandas. Por favor, intenta nuevamente."
                );
              }
            } catch (error) {
              console.error("❌ Error eliminando comandas de la mesa:", error);
              await logger.error(error, {
                action: 'eliminar_todas_comandas_mesa',
                mesaId: mesa?._id,
                mesaNum: mesa?.nummesa,
                comandasCount: comandasMesa.length,
                timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
              });
              
              // Ocultar overlay en caso de error
              setEliminandoTodasComandas(false);
              
              Alert.alert(
                "Error",
                error.response?.data?.message || "No se pudieron eliminar las comandas. Por favor, intenta nuevamente."
              );
            }
          }
        }
      ]
    );
  };

  // Componente de Overlay para carga de eliminación
  const OverlayEliminacion = ({ mensaje }) => {
    const rotateAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);
    const fadeAnim = useSharedValue(0);

    useEffect(() => {
      // Fade in inicial
      fadeAnim.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });

      // Rotación continua
      rotateAnim.value = 0;
      rotateAnim.value = withRepeat(
        withTiming(360, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Pulso continuo
      pulseAnim.value = 1;
      pulseAnim.value = withRepeat(
        withTiming(1.2, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );

      return () => {
        rotateAnim.value = 0;
        pulseAnim.value = 1;
        fadeAnim.value = 0;
      };
    }, []);

    const rotateStyle = useAnimatedStyle(() => {
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

    return (
      <Animated.View style={[{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }, fadeStyle]}>
        <View style={{
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
        }}>
          <Animated.View style={[pulseStyle, { marginBottom: 20 }]}>
            <Animated.View style={rotateStyle}>
              <MaterialCommunityIcons 
                name="delete-outline" 
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
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors?.text?.primary || '#333333',
            textAlign: 'center',
            marginBottom: 8,
          }}>{mensaje}</Text>
          <Text style={{
            fontSize: 14,
            color: theme.colors?.text?.secondary || '#666666',
            textAlign: 'center',
          }}>Por favor espera...</Text>
        </View>
      </Animated.View>
    );
  };

  // Función para abrir modal de eliminar última comanda
  const handleEliminarUltimaComanda = async (mesa, comandasMesa) => {
    if (!comandasMesa || comandasMesa.length === 0) {
      Alert.alert("Error", "No hay comandas para eliminar");
      return;
    }

    // Encontrar la última comanda (la más reciente)
    const comandasOrdenadas = [...comandasMesa].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const fechaA = new Date(a.createdAt).getTime();
        const fechaB = new Date(b.createdAt).getTime();
        return fechaB - fechaA;
      }
      const numA = a.comandaNumber || 0;
      const numB = b.comandaNumber || 0;
      return numB - numA;
    });

    const ultimaComanda = comandasOrdenadas[0];

    if (!ultimaComanda) {
      Alert.alert("Error", "No se pudo encontrar la última comanda");
      return;
    }

    // Guardar comanda y abrir modal
    setComandaAEliminar(ultimaComanda);
    setMotivoEliminacionComanda("");
    setModalEliminarUltimaVisible(true);
  };

  // Función para confirmar eliminación de última comanda (desde modal)
  const handleConfirmarEliminarUltima = async () => {
    if (!motivoEliminacionComanda || motivoEliminacionComanda.trim() === "") {
      Alert.alert("Error", "Por favor, indique el motivo de la eliminación");
      return;
    }

    if (!comandaAEliminar) {
      Alert.alert("Error", "No hay comanda para eliminar");
      return;
    }

    try {
      // Extraer el ID de forma segura
      let comandaId = comandaAEliminar._id;
      if (comandaId && typeof comandaId === 'object') {
        comandaId = comandaId.toString();
      }
      
      if (!comandaId) {
        Alert.alert("Error", "No se pudo obtener el ID de la comanda");
        return;
      }
      
      // Cerrar modal
      setModalEliminarUltimaVisible(false);
      
      // Activar pantalla de carga
      setEliminandoUltimaComanda(true);
      setMensajeCargaEliminacion("Eliminando última comanda...");
      
      // Determinar si es eliminación individual o última comanda
      const esEliminacionIndividual = comandaAEliminar.esEliminacionIndividual;
      
      console.log("🗑️ Eliminando comanda con auditoría:");
      console.log("  - ID:", comandaId);
      console.log("  - Comanda #:", comandaAEliminar.comandaNumber);
      console.log("  - Motivo:", motivoEliminacionComanda);
      console.log("  - Tipo:", esEliminacionIndividual ? "Individual" : "Última comanda");
      
      // ✅ LLAMAR AL ENDPOINT CORRECTO CON MOTIVO
      const deleteURL = esEliminacionIndividual
        ? (apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/individual`
            : `${COMANDA_API}/${comandaId}/individual`)
        : (apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}/ultima`
            : `${COMANDA_API}/${comandaId}/ultima`);
      
      // Paso 1: Eliminar comanda
      setMensajeCargaEliminacion("Eliminando comanda...");
      const deleteResponse = await axios.delete(deleteURL, { 
        data: { motivo: motivoEliminacionComanda.trim() },
        timeout: 10000 
      });
      
      console.log("✅ Comanda eliminada del servidor con auditoría");
      
      // Paso 2: Verificar que la comanda se eliminó (IsActive = false)
      setMensajeCargaEliminacion("Verificando eliminación de comanda...");
      let comandaEliminada = false;
      let intentosEliminacion = 0;
      const maxIntentosEliminacion = 10; // 5 segundos máximo
      
      while (!comandaEliminada && intentosEliminacion < maxIntentosEliminacion) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms entre intentos
          
          const comandaCheckURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}`
            : `${COMANDA_API}/${comandaId}`;
          
          const comandaResponse = await axios.get(comandaCheckURL, { timeout: 5000 });
          const comanda = comandaResponse.data;
          
          if (comanda && (comanda.IsActive === false || comanda.eliminada === true)) {
            comandaEliminada = true;
            console.log("✅ Comanda verificada como eliminada (IsActive = false)");
          } else {
            intentosEliminacion++;
            console.log(`⏳ Esperando verificación de eliminación... (${intentosEliminacion}/${maxIntentosEliminacion})`);
          }
        } catch (error) {
          // Si la comanda no se encuentra (404), significa que fue eliminada
          if (error.response?.status === 404) {
            comandaEliminada = true;
            console.log("✅ Comanda verificada como eliminada (404 - no encontrada)");
          } else {
            intentosEliminacion++;
            console.warn(`⚠️ Error verificando eliminación (intento ${intentosEliminacion}):`, error.message);
          }
        }
      }
      
      if (!comandaEliminada) {
        throw new Error("No se pudo verificar que la comanda fue eliminada");
      }
      
      // Paso 3: Verificar que se registró en auditoría
      setMensajeCargaEliminacion("Verificando registro en auditoría...");
      let auditoriaRegistrada = false;
      let intentosAuditoria = 0;
      const maxIntentosAuditoria = 10; // 5 segundos máximo
      
      const accionEsperada = esEliminacionIndividual 
        ? 'ELIMINAR_COMANDA_INDIVIDUAL' 
        : 'ELIMINAR_ULTIMA_COMANDA';
      
      while (!auditoriaRegistrada && intentosAuditoria < maxIntentosAuditoria) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms entre intentos
          
          const auditoriaURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/auditoria')}/comandas?entidadId=${comandaId}&accion=${accionEsperada}&limit=1`
            : `${COMANDA_API.replace('/comanda', '/auditoria')}/comandas?entidadId=${comandaId}&accion=${accionEsperada}&limit=1`;
          
          const auditoriaResponse = await axios.get(auditoriaURL, { timeout: 5000 });
          
          if (auditoriaResponse.data && auditoriaResponse.data.auditorias && auditoriaResponse.data.auditorias.length > 0) {
            const auditoria = auditoriaResponse.data.auditorias[0];
            if (auditoria.accion === accionEsperada && auditoria.motivo === motivoEliminacionComanda.trim()) {
              auditoriaRegistrada = true;
              console.log("✅ Auditoría verificada y registrada correctamente");
            } else {
              intentosAuditoria++;
              console.log(`⏳ Esperando verificación de auditoría... (${intentosAuditoria}/${maxIntentosAuditoria})`);
            }
          } else {
            intentosAuditoria++;
            console.log(`⏳ Esperando registro de auditoría... (${intentosAuditoria}/${maxIntentosAuditoria})`);
          }
        } catch (error) {
          intentosAuditoria++;
          console.warn(`⚠️ Error verificando auditoría (intento ${intentosAuditoria}):`, error.message);
        }
      }
      
      if (!auditoriaRegistrada) {
        console.warn("⚠️ No se pudo verificar el registro en auditoría, pero la eliminación fue exitosa");
      }
      
      // Paso 4: Verificar que desapareció de la app de cocina
      setMensajeCargaEliminacion("Verificando eliminación en app de cocina...");
      let desaparecioDeCocina = false;
      let intentosCocina = 0;
      const maxIntentosCocina = 10; // 5 segundos máximo
      
      const fechaActual = moment().tz("America/Lima").format("YYYY-MM-DD");
      
      while (!desaparecioDeCocina && intentosCocina < maxIntentosCocina) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms entre intentos
          
          const fechastatusURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/comanda')}/fechastatus/${fechaActual}`
            : `${COMANDA_API}/fechastatus/${fechaActual}`;
          
          const cocinaResponse = await axios.get(fechastatusURL, { timeout: 5000 });
          const comandasCocina = cocinaResponse.data || [];
          
          // Verificar que la comanda NO está en la lista (debe estar filtrada por IsActive = true)
          const comandaEnCocina = comandasCocina.find(c => {
            const cId = c._id?.toString ? c._id.toString() : c._id;
            return cId === comandaId;
          });
          
          if (!comandaEnCocina) {
            desaparecioDeCocina = true;
            console.log("✅ Comanda verificada como eliminada de la app de cocina");
          } else {
            intentosCocina++;
            console.log(`⏳ Esperando eliminación en app de cocina... (${intentosCocina}/${maxIntentosCocina})`);
          }
        } catch (error) {
          intentosCocina++;
          console.warn(`⚠️ Error verificando app de cocina (intento ${intentosCocina}):`, error.message);
        }
      }
      
      if (!desaparecioDeCocina) {
        console.warn("⚠️ No se pudo verificar que desapareció de la app de cocina, pero la eliminación fue exitosa");
      }
      
      // Paso 5: Actualizar datos locales
      setMensajeCargaEliminacion("Actualizando datos...");
      
      // Actualizaciones en segundo plano
      await Promise.all([
        obtenerComandasHoy().catch(err => {
          console.warn("⚠️ Error actualizando comandas (no crítico):", err.message);
        }),
        obtenerMesas().catch(err => {
          console.warn("⚠️ Error actualizando mesas (no crítico):", err.message);
        })
      ]);
      
      console.log("✅ Datos actualizados");
      
      // Cerrar pantalla de carga
      setEliminandoUltimaComanda(false);
      setMensajeCargaEliminacion("");
      
      // Cerrar modal de opciones si está abierto
      setModalOpcionesMesaVisible(false);
      
      // Limpiar estado
      setComandaAEliminar(null);
      setMotivoEliminacionComanda("");
      
      // Mostrar mensaje de éxito (sin Alert, solo en consola y cerrar modal)
      console.log("✅ Comanda eliminada exitosamente con todas las verificaciones completadas");
    } catch (error) {
      setEliminandoUltimaComanda(false);
      setMensajeCargaEliminacion("");
      
      const isNetworkError = error.code === 'ECONNABORTED' || 
                             error.code === 'ECONNREFUSED' ||
                             error.message?.includes('Network Error') ||
                             (!error.response && !error.request);
      
      if (isNetworkError && !error.response) {
        console.warn("⚠️ Error de red durante eliminación:", error.message);
        Alert.alert(
          "⚠️ Advertencia",
          "Hubo un problema de conexión durante la eliminación. Por favor, verifica si la comanda fue eliminada correctamente."
        );
      } else {
        console.error("❌ Error eliminando última comanda:", error);
        
        let errorMessage = "No se pudo eliminar la comanda";
        
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          
          if (status === 400) {
            errorMessage = data?.message || `Solicitud inválida (400)`;
          } else if (status === 404) {
            errorMessage = "Comanda no encontrada";
          } else if (status === 500) {
            errorMessage = "Error del servidor al eliminar la comanda";
          } else {
            errorMessage = data?.message || `Error ${status}: No se pudo eliminar la comanda`;
          }
        } else if (error.request) {
          errorMessage = "No se recibió respuesta del servidor. Verifica tu conexión.";
        } else {
          errorMessage = error.message || "Error desconocido al eliminar la comanda";
        }
        
        Alert.alert("Error", errorMessage);
      }
    }
  };

  // Función antigua (mantener para compatibilidad pero no usar)
  const handleEliminarUltimaComandaOld = async (mesa, comandasMesa) => {
    if (!comandasMesa || comandasMesa.length === 0) {
      Alert.alert("Error", "No hay comandas para eliminar");
      return;
    }

    const comandasOrdenadas = [...comandasMesa].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const fechaA = new Date(a.createdAt).getTime();
        const fechaB = new Date(b.createdAt).getTime();
        return fechaB - fechaA;
      }
      const numA = a.comandaNumber || 0;
      const numB = b.comandaNumber || 0;
      return numB - numA;
    });

    const ultimaComanda = comandasOrdenadas[0];

    if (!ultimaComanda) {
      Alert.alert("Error", "No se pudo encontrar la última comanda");
      return;
    }

    Alert.alert(
      "⚠️ Eliminar Última Comanda",
      `¿Estás seguro de que deseas eliminar la última comanda #${ultimaComanda.comandaNumber || ultimaComanda._id?.slice(-4) || 'N/A'} de la mesa ${mesa?.nummesa || 'N/A'}?\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Extraer el ID de forma segura
              let comandaId = ultimaComanda._id;
              
              // Si _id es un objeto (puede pasar con populate), extraer el string
              if (comandaId && typeof comandaId === 'object') {
                comandaId = comandaId.toString();
              }
              
              if (!comandaId) {
                Alert.alert("Error", "No se pudo obtener el ID de la comanda");
                return;
              }
              
              // Activar pantalla de carga
              setEliminandoUltimaComanda(true);
              setMensajeCargaEliminacion("Eliminando última comanda...");
              
              console.log("🗑️ Eliminando última comanda:");
              console.log("  - ID:", comandaId);
              console.log("  - Comanda #:", ultimaComanda.comandaNumber);
              console.log("  - Mesa:", mesa.nummesa);
              
              // Eliminar la comanda
              setMensajeCargaEliminacion("Eliminando comanda del servidor...");
              const deleteURL = apiConfig.isConfigured 
                ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}`
                : `${COMANDA_API}/${comandaId}`;
              await axios.delete(deleteURL, { timeout: 10000 });
              console.log("✅ Última comanda eliminada del servidor");
              
              // ✅ Cerrar pantalla de carga INMEDIATAMENTE después de eliminación exitosa
              setEliminandoUltimaComanda(false);
              setMensajeCargaEliminacion("");
              
              // Cerrar modal
              setModalOpcionesMesaVisible(false);
              
              // ✅ Actualizaciones en segundo plano (sin bloquear ni mostrar errores)
              // Hacer las actualizaciones sin mostrar loading ni errores al usuario
              Promise.all([
                // Actualizar comandas (sin bloquear si falla)
                obtenerComandasHoy().catch(err => {
                  console.warn("⚠️ Error actualizando comandas (no crítico):", err.message);
                }),
                // Actualizar mesas (sin bloquear si falla)
                obtenerMesas().catch(err => {
                  console.warn("⚠️ Error actualizando mesas (no crítico):", err.message);
                })
              ]).then(() => {
                console.log("✅ Datos actualizados en segundo plano");
              }).catch(() => {
                // Ignorar errores - ya mostramos éxito al usuario
                console.warn("⚠️ Algunas actualizaciones fallaron, pero la eliminación fue exitosa");
              });
              
              // ✅ Mostrar éxito inmediatamente (sin esperar verificaciones)
              Alert.alert(
                "✅ Éxito", 
                `Última comanda eliminada exitosamente de la mesa ${mesa.nummesa}.`
              );
            } catch (error) {
              // ✅ SIEMPRE cerrar pantalla de carga en caso de error
              setEliminandoUltimaComanda(false);
              setMensajeCargaEliminacion("");
              
              // ✅ Solo mostrar error si es un error REAL de eliminación (no de verificación)
              // Si el error es de red pero la eliminación ya se procesó, no mostrar error
              const isNetworkError = error.code === 'ECONNABORTED' || 
                                     error.code === 'ECONNREFUSED' ||
                                     error.message?.includes('Network Error') ||
                                     (!error.response && !error.request);
              
              // Si es error de red pero tenemos respuesta del servidor, la eliminación probablemente funcionó
              if (isNetworkError && !error.response) {
                console.warn("⚠️ Error de red durante eliminación, pero puede haber funcionado:", error.message);
                // Verificar si la eliminación realmente falló o solo fue un error de red en verificación
                // Por ahora, asumimos que si no hay response, puede ser un error de red temporal
                Alert.alert(
                  "⚠️ Advertencia",
                  "Hubo un problema de conexión durante la eliminación. Por favor, verifica si la comanda fue eliminada correctamente."
                );
              } else {
                // Error real del servidor
                console.error("❌ Error eliminando última comanda:", error);
                
                let errorMessage = "No se pudo eliminar la comanda";
                
                if (error.response) {
                  const status = error.response.status;
                  const data = error.response.data;
                  
                  if (status === 400) {
                    errorMessage = data?.message || `Solicitud inválida (400)`;
                  } else if (status === 404) {
                    errorMessage = "Comanda no encontrada";
                  } else if (status === 500) {
                    errorMessage = "Error del servidor al eliminar la comanda";
                  } else {
                    errorMessage = data?.message || `Error ${status}: No se pudo eliminar la comanda`;
                  }
                } else if (error.request) {
                  errorMessage = "No se recibió respuesta del servidor. Verifica tu conexión.";
                } else {
                  errorMessage = error.message || "Error desconocido al eliminar la comanda";
                }
                
                Alert.alert("Error", errorMessage);
              }
            }
          }
        }
      ]
    );
  };

  const handleEliminarComanda = async (comanda, mesa) => {
    // Si la comanda está en estado "pedido" (en_espera), usar modal con auditoría
    const estadoComanda = comanda.status?.toLowerCase();
    if (estadoComanda === 'pedido' || estadoComanda === 'en_espera' || estadoComanda === 'en espera') {
      // Guardar comanda y abrir modal (usar el mismo modal pero con endpoint diferente)
      // Marcar que es eliminación individual (no última comanda)
      setComandaAEliminar({ ...comanda, esEliminacionIndividual: true });
      setMotivoEliminacionComanda("");
      setModalEliminarUltimaVisible(true);
      return;
    }
    
    // Para otros estados, usar Alert simple (compatibilidad)
    Alert.alert(
      "⚠️ Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar la comanda #${comanda.comandaNumber || comanda._id?.slice(-4) || 'N/A'} de la mesa ${mesa?.nummesa || 'N/A'}?\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Validar que tenemos el ID de la comanda
              if (!comanda) {
                Alert.alert("Error", "No se pudo obtener la comanda");
                await logger.error(new Error("Comanda no disponible"), {
                  action: 'eliminar_comanda',
                  comanda: comanda,
                  mesa: mesa
                });
                return;
              }

              // Extraer el ID de forma segura
              let comandaId = comanda._id;
              
              // Si _id es un objeto (puede pasar con populate), extraer el string
              if (comandaId && typeof comandaId === 'object') {
                comandaId = comandaId.toString();
              }
              
              if (!comandaId) {
                Alert.alert("Error", "No se pudo obtener el ID de la comanda");
                await logger.error(new Error("ID de comanda no disponible"), {
                  action: 'eliminar_comanda',
                  comanda: JSON.stringify(comanda),
                  mesa: mesa
                });
                return;
              }
              
              const deleteURL = apiConfig.isConfigured 
                ? `${apiConfig.getEndpoint('/comanda')}/${comandaId}`
                : `${COMANDA_API}/${comandaId}`;
              console.log("🗑️ Eliminando comanda:");
              console.log("  - ID:", comandaId);
              console.log("  - Tipo:", typeof comandaId);
              console.log("  - URL:", deleteURL);
              console.log("  - Comanda completa:", JSON.stringify(comanda, null, 2));
              
              // Eliminar la comanda
              const deleteResponse = await axios.delete(deleteURL, { timeout: 5000 });
              console.log("✅ Comanda eliminada");
              
              // Actualizar comandas localmente (remover la eliminada del estado)
              let comandasActualizadas = comandas.filter(c => {
                const cId = c._id?.toString ? c._id.toString() : c._id;
                const comandaIdStr = comandaId?.toString ? comandaId.toString() : comandaId;
                return cId !== comandaIdStr;
              });
              
              // Actualizar el estado inmediatamente
              setComandas(comandasActualizadas);
              
              // Verificar si hay más comandas activas en la mesa (usando estado local actualizado)
              // IMPORTANTE: Incluir comandas en estado "entregado" que aún no están pagadas
              const comandasMesaRestantes = comandasActualizadas.filter(c => {
                return c.mesas?.nummesa === mesa.nummesa &&
                       c.IsActive !== false && 
                       c.status?.toLowerCase() !== "pagado" && 
                       c.status?.toLowerCase() !== "completado";
              });
              
              const hayComandasActivas = comandasMesaRestantes.length > 0;
              
              // El backend ya maneja la actualización del estado de la mesa automáticamente
              // cuando se elimina una comanda, considerando todas las comandas activas
              // (incluyendo las que están en estado "entregado" pero no pagadas)
              // Por lo tanto, no necesitamos actualizar manualmente la mesa aquí
              if (hayComandasActivas) {
                console.log(`ℹ️ Mesa ${mesa.nummesa} aún tiene ${comandasMesaRestantes.length} comanda(s) activa(s) - El backend manejará el estado de la mesa`);
              } else {
                console.log(`ℹ️ No hay comandas activas en la mesa ${mesa.nummesa} - El backend actualizará la mesa a "libre"`);
              }
              
              Alert.alert("✅", "Comanda eliminada exitosamente.");
              
              // Cerrar modal si está abierto
              setModalEditVisible(false);
              setComandaEditando(null);
              setTipoPlatoFiltro(null);
              setSearchPlato("");
              setCategoriaFiltro(null);
              
              // IMPORTANTE: Actualizar mesas inmediatamente después de eliminar la comanda
              // para que el estado de la mesa se sincronice en todas las pantallas (especialmente OrdenesScreen)
              try {
                await obtenerMesas();
                console.log("✅ Mesas actualizadas después de eliminar comanda");
              } catch (error) {
                console.error("⚠️ Error al actualizar mesas después de eliminar comanda:", error);
              }
              
              // Actualizar comandas desde el servidor (con debounce para evitar múltiples peticiones)
              // Solo si no hay más eliminaciones en proceso
              setTimeout(async () => {
                try {
                  await obtenerComandasHoy();
                } catch (error) {
                  // Silenciar errores de red durante actualizaciones rápidas
                  console.log("ℹ️ Actualización de comandas diferida debido a operaciones en curso");
                }
              }, 300);
            } catch (error) {
              // Guardar error en log
              await logger.error(error, {
                action: 'eliminar_comanda',
                comandaId: comanda?._id,
                comandaNumber: comanda?.comandaNumber,
                mesaId: mesa?._id,
                mesaNum: mesa?.nummesa,
                url: apiConfig.isConfigured 
                  ? `${apiConfig.getEndpoint('/comanda')}/${comanda?._id}`
                  : `${COMANDA_API}/${comanda?._id}`,
                timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
              });
              
              console.error("❌ Error eliminando comanda:", error);
              console.error("Error completo:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText,
                comandaId: comanda?._id,
                comanda: comanda
              });
              
              let errorMessage = "No se pudo eliminar la comanda";
              
              if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 400) {
                  errorMessage = data?.message || `Solicitud inválida (400). ID: ${comanda?._id}`;
                } else if (status === 404) {
                  errorMessage = "Comanda no encontrada";
                } else if (status === 500) {
                  errorMessage = "Error del servidor al eliminar la comanda";
                } else {
                  errorMessage = data?.message || `Error ${status}: No se pudo eliminar la comanda`;
                }
              } else if (error.request) {
                errorMessage = "No se recibió respuesta del servidor. Verifica tu conexión.";
              } else {
                errorMessage = error.message || "Error desconocido al eliminar la comanda";
              }
              
              Alert.alert("Error", errorMessage);
            }
          }
        }
      ]
    );
  };

  // Obtener mesas por área/sección (mantiene ordenamiento numérico)
  const getMesasPorArea = useCallback((areaId) => {
    let mesasFiltradas;
    if (areaId === "All") {
      mesasFiltradas = mesas;
    } else {
      mesasFiltradas = mesas.filter(mesa => {
        const mesaAreaId = mesa.area?._id || mesa.area;
        return mesaAreaId === areaId;
      });
    }
    // Aplicar ordenamiento numérico a las mesas filtradas
    return ordenarMesasPorNumero(mesasFiltradas);
  }, [mesas, ordenarMesasPorNumero]);

  // Obtener TODAS las áreas activas (no solo las que tienen mesas)
  // Esto permite mostrar áreas vacías como "Don" y "JUGOS"
  const areasConMesas = useMemo(() => {
    // Mostrar todas las áreas activas, no solo las que tienen mesas
    const todasLasAreas = areas;
    
    console.log('[TABS] Total áreas disponibles:', todasLasAreas.length);
    console.log('[TABS] Nombres áreas:', todasLasAreas.map(a => a.nombre));
    console.log('[TABS] Renderizando tabs para:', todasLasAreas.length, 'áreas');
    
    return todasLasAreas;
  }, [areas]);

  // Función para scroll automático al seleccionar tab
  const scrollToTab = useCallback((areaId) => {
    if (!tabsScrollViewRef.current) return;
    
    const position = tabPositionsRef.current[areaId || 'default'];
    if (position !== undefined) {
      // Calcular posición para centrar el tab
      const scrollPosition = Math.max(0, position - (containerWidth / 2) + 60); // 60 es aproximadamente la mitad del ancho de un tab
      
      tabsScrollViewRef.current.scrollTo({
        x: scrollPosition,
        animated: true,
      });
    }
  }, [containerWidth]);

  // Handler para cambio de sección activa con scroll automático
  const handleSeccionActivaChange = useCallback((newSeccionId) => {
    setSeccionActiva(newSeccionId);
    // Scroll automático después de un pequeño delay para permitir render
    setTimeout(() => {
      scrollToTab(newSeccionId);
    }, 100);
    
    // Haptic feedback
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Silenciar errores de haptic
    }
  }, [scrollToTab]);

  // Handler para scroll events - actualizar gradientes
  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollX = contentOffset.x;
    const currentContentWidth = contentSize.width;
    const currentContainerWidth = layoutMeasurement.width;
    
    setScrollX(currentScrollX);
    setContentWidth(currentContentWidth);
    setContainerWidth(currentContainerWidth);
    
    // Mostrar/ocultar gradientes según posición
    setShowLeftGradient(currentScrollX > 10);
    setShowRightGradient(currentScrollX < (currentContentWidth - currentContainerWidth - 10));
  }, []);

  // Efecto para actualizar gradientes cuando cambia contenido
  useEffect(() => {
    if (contentWidth > 0 && containerWidth > 0) {
      setShowLeftGradient(scrollX > 10);
      setShowRightGradient(scrollX < (contentWidth - containerWidth - 10));
    }
  }, [scrollX, contentWidth, containerWidth]);

  // Animación hint inicial para sugerir scroll (solo primera vez)
  useEffect(() => {
    if (tabsScrollViewRef.current && contentWidth > containerWidth && scrollX === 0) {
      // Esperar un momento para que el layout se estabilice
      const timer = setTimeout(() => {
        if (tabsScrollViewRef.current && contentWidth > containerWidth) {
          // Scroll suave hacia la derecha y volver
          tabsScrollViewRef.current.scrollTo({ x: 30, animated: true });
          setTimeout(() => {
            if (tabsScrollViewRef.current) {
              tabsScrollViewRef.current.scrollTo({ x: 0, animated: true });
            }
          }, 600);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [contentWidth, containerWidth, scrollX]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.profileButton}>
          <MaterialCommunityIcons name="account-circle" size={32} color={theme.colors.text.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LAS GAMBUSINAS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            onPress={sincronizarManual}
            style={{ padding: 4 }}
          >
            <MaterialCommunityIcons name="sync" size={24} color={theme.colors.text.white} />
          </TouchableOpacity>
          <Text style={styles.headerTime}>{horaActual.format("HH:mm:ss")}</Text>
        </View>
      </View>

      {/* Barra de Tabs de Áreas - Fila 1: Tabs Scrollables */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsScrollContainer}>
          {/* Gradiente izquierdo */}
          {showLeftGradient && (
            <LinearGradient
              colors={[theme.colors.surface, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scrollGradientLeft}
              pointerEvents="none"
            />
          )}
          
          <ScrollView 
            ref={tabsScrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
            style={styles.tabsScrollView}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            <TouchableOpacity
              style={[
                styles.tabButton,
                seccionActiva === null && styles.tabButtonActive
              ]}
              onPress={() => handleSeccionActivaChange(null)}
              onLayout={(event) => {
                const { x } = event.nativeEvent.layout;
                tabPositionsRef.current['default'] = x;
              }}
            >
              <Text style={[
                styles.tabButtonText,
                seccionActiva === null && styles.tabButtonTextActive
              ]}>
                Default
              </Text>
            </TouchableOpacity>
            {areasConMesas.map((area) => (
              <TouchableOpacity
                key={area._id}
                style={[
                  styles.tabButton,
                  seccionActiva === area._id && styles.tabButtonActive
                ]}
                onPress={() => handleSeccionActivaChange(seccionActiva === area._id ? null : area._id)}
                onLayout={(event) => {
                  const { x } = event.nativeEvent.layout;
                  tabPositionsRef.current[area._id] = x;
                }}
              >
                <Text style={[
                  styles.tabButtonText,
                  seccionActiva === area._id && styles.tabButtonTextActive
                ]}>
                  {seccionActiva === area._id ? "☆ " : ""}{area.nombre.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Gradiente derecho */}
          {showRightGradient && (
            <LinearGradient
              colors={['transparent', theme.colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scrollGradientRight}
              pointerEvents="none"
            />
          )}
        </View>
      </View>

      {/* Contenido Principal */}
      <View style={styles.mainContent}>
        {/* Canvas de Mesas */}
        <View style={[styles.canvas, { width: canvasWidth }]}>
          <ScrollView 
            style={styles.canvasScroll}
            contentContainerStyle={styles.canvasContent}
          >
            {seccionActiva ? (
              getMesasPorArea(seccionActiva).map((mesa, index) => {
                const estado = getEstadoMesa(mesa);
                const estadoColor = getEstadoColor(estado);
                const mozo = getMozoMesa(mesa);
                const isSelected = mesaSeleccionada?._id === mesa._id;

                return (
                  <MesaAnimada
                    key={`${mesa._id}-${estado}`} // Key incluye estado para forzar re-render cuando cambia
                    mesa={mesa}
                    estado={estado}
                    estadoColor={estadoColor}
                    mozo={mozo}
                    isSelected={isSelected}
                    mesaSize={mesaSize}
                    zoomLevel={mesaZoomLevel}
                    theme={theme}
                    styles={styles}
                    onPress={handleSelectMesa}
                    index={index}
                  />
                );
              })
            ) : (
              mesas.map((mesa, index) => {
                const estado = getEstadoMesa(mesa);
                const estadoColor = getEstadoColor(estado);
                const mozo = getMozoMesa(mesa);
                const isSelected = mesaSeleccionada?._id === mesa._id;

                return (
                  <MesaAnimada
                    key={`${mesa._id}-${estado}`} // Key incluye estado para forzar re-render cuando cambia
                    mesa={mesa}
                    estado={estado}
                    estadoColor={estadoColor}
                    mozo={mozo}
                    isSelected={isSelected}
                    mesaSize={mesaSize}
                    zoomLevel={mesaZoomLevel}
                    theme={theme}
                    styles={styles}
                    onPress={handleSelectMesa}
                    index={index}
                  />
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Barra Vertical Derecha */}
        <View style={[styles.barraDerecha, { width: barraWidth }]}>
          <ScrollView style={styles.barraScroll} showsVerticalScrollIndicator={false}>
            {/* Funciones */}
            {/* ============================================ */}
            {/* SECCIÓN ZOOM - NUEVA                        */}
            {/* ============================================ */}
            <View style={styles.zoomSection}>
              {/* Título sección */}
              <Text style={styles.zoomSectionTitle}>
                🔍 Tamaño
              </Text>
              
              {/* Botón aumentar zoom */}
              <TouchableOpacity 
                style={[
                  styles.zoomButton,
                  mesaZoomLevel >= 4 && styles.zoomButtonDisabled
                ]}
                onPress={handleZoomIn}
                disabled={mesaZoomLevel >= 4}
              >
                <Text style={styles.zoomButtonText}>+</Text>
              </TouchableOpacity>
              
              {/* Indicador nivel zoom */}
              <View style={styles.zoomIndicatorContainer}>
                {Array.from({ length: 5 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.zoomDot,
                      i <= mesaZoomLevel 
                        ? styles.zoomDotActive 
                        : styles.zoomDotInactive
                    ]}
                  />
                ))}
              </View>
              
              {/* Botón reducir zoom */}
              <TouchableOpacity 
                style={[
                  styles.zoomButton,
                  mesaZoomLevel <= 0 && styles.zoomButtonDisabled
                ]}
                onPress={handleZoomOut}
                disabled={mesaZoomLevel <= 0}
              >
                <Text style={styles.zoomButtonText}>−</Text>
              </TouchableOpacity>
            </View>

            {/* Separador visual */}
            <View style={styles.sectionDivider} />

            {/* ============================================ */}
            {/* ACCIONES CONSERVADAS                        */}
            {/* ============================================ */}
            <TouchableOpacity
              style={styles.barraItem}
              onPress={async () => {
                // Si hay una mesa seleccionada, guardarla y navegar
                if (mesaSeleccionada) {
                  try {
                    await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaSeleccionada));
                    navigation.navigate("Ordenes");
                  } catch (error) {
                    console.error("Error guardando mesa seleccionada:", error);
                    navigation.navigate("Ordenes");
                  }
                } else {
                  // Si no hay mesa seleccionada, navegar normalmente
                  navigation.navigate("Ordenes");
                }
              }}
            >
              <View style={styles.barraItemContent}>
                <MaterialCommunityIcons name="plus-circle" size={iconSizeSidebar || 16} color={theme.colors.text.primary} />
                <Text style={styles.barraItemText}>NUEVA ORDEN</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                obtenerMesas();
                obtenerComandasHoy();
                Alert.alert("Recargar", "Datos actualizados");
              }}
            >
              <View style={styles.barraItemContent}>
                <MaterialCommunityIcons name="refresh" size={iconSizeSidebar || 16} color={theme.colors.text.primary} />
                <Text style={styles.barraItemText}>Recargar</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Juntar Mesas", "Selecciona las mesas a juntar");
              }}
            >
              <View style={styles.barraItemContent}>
                <MaterialCommunityIcons name="link-variant" size={iconSizeSidebar || 16} color={theme.colors.text.primary} />
                <Text style={styles.barraItemText}>Juntar Mesas</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Reservar", "Crear una reserva");
              }}
            >
              <View style={styles.barraItemContent}>
                <MaterialCommunityIcons name="calendar" size={iconSizeSidebar || 16} color={theme.colors.text.primary} />
                <Text style={styles.barraItemText}>Reservar</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Agregar Mesa", "Agregar una nueva mesa");
              }}
            >
              <View style={styles.barraItemContent}>
                <MaterialCommunityIcons name="table-plus" size={iconSizeSidebar || 16} color={theme.colors.text.primary} />
                <Text style={styles.barraItemText}>Agregar Mesa</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Separar Mesas", "Separar mesas juntas");
              }}
            >
              <Text style={styles.barraItemText}>✂️ Separar Mesas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Quitar Mesa", "Eliminar una mesa");
              }}
            >
              <Text style={styles.barraItemText}>➖ Quitar Mesa</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Modal de Edición de Comanda */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEditVisible}
        onRequestClose={() => {
          setModalEditVisible(false);
          setComandaEditando(null);
          setTipoPlatoFiltro(null);
          setSearchPlato("");
          setCategoriaFiltro(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Editar Comanda #{comandaEditando?.comandaNumber || comandaEditando?._id.slice(-4)}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEditVisible(false);
                setComandaEditando(null);
                setTipoPlatoFiltro(null);
                setSearchPlato("");
                setCategoriaFiltro(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Mesa: {comandaEditando?.mesaSeleccionada?.nummesa || "N/A"}</Text>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Platos:</Text>
                {comandaEditando?.platosEditados?.map((plato, index) => (
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
                        <MaterialCommunityIcons 
                          name="delete" 
                          size={20} 
                          color={theme.colors.primary} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Agregar Platos */}
              <View style={styles.editSection}>
                <TouchableOpacity
                  style={styles.addPlatoButton}
                  onPress={async () => {
                    await obtenerPlatos();
                    setTipoPlatoFiltro(null);
                    setSearchPlato("");
                    setCategoriaFiltro(null);
                    // Mostrar selector de tipo
                    Alert.alert(
                      "Agregar Plato",
                      "Selecciona el tipo de menú:",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Desayuno",
                          onPress: () => setTipoPlatoFiltro("platos-desayuno"),
                        },
                        {
                          text: "Carta Normal",
                          onPress: () => setTipoPlatoFiltro("carta-normal"),
                        },
                      ]
                    );
                  }}
                >
                  <MaterialCommunityIcons name="plus-circle" size={20} color={theme.colors.text.white} />
                  <Text style={styles.addPlatoButtonText}> Agregar Plato</Text>
                </TouchableOpacity>

                {tipoPlatoFiltro && (
                  <>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar plato..."
                      placeholderTextColor={theme.colors.text.light}
                      value={searchPlato}
                      onChangeText={setSearchPlato}
                    />
                    <ScrollView 
                      horizontal 
                      style={styles.categoriasContainer} 
                      showsHorizontalScrollIndicator={false}
                    >
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
                            {getCategoriaIcon(cat)} {cat.split("(")[0].trim()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.platosListContainer}>
                      {platosFiltrados.length === 0 ? (
                        <View style={styles.emptyPlatosContainer}>
                          <Text style={styles.emptyPlatosText}>No hay platos disponibles</Text>
                        </View>
                      ) : (
                        <ScrollView 
                          style={styles.platosScrollView}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {platosFiltrados.map((plato) => {
                            const cantidadEnComanda = comandaEditando?.platosEditados?.find(
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
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </>
                )}
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Observaciones:</Text>
                <TextInput
                  style={styles.observacionesInput}
                  placeholder="Sin observaciones..."
                  placeholderTextColor={theme.colors.text.light}
                  value={comandaEditando?.observacionesEditadas || ""}
                  onChangeText={(text) =>
                    setComandaEditando({
                      ...comandaEditando,
                      observacionesEditadas: text,
                    })
                  }
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.editSection}>
                <Text style={styles.totalText}>TOTAL: S/. {calcularTotal().toFixed(2)}</Text>
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
                  setModalEditVisible(false);
                  setComandaEditando(null);
                  setTipoPlatoFiltro(null);
                  setSearchPlato("");
                  setCategoriaFiltro(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Eliminación de Platos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalConfirmarEliminacionVisible}
        onRequestClose={() => {
          setModalConfirmarEliminacionVisible(false);
          setMotivoEliminacion("");
          setPlatosAEliminar([]);
          setPlatosAgregados([]);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📝 Modificación de Comanda</Text>
              <TouchableOpacity onPress={() => {
                setModalConfirmarEliminacionVisible(false);
                setMotivoEliminacion("");
                setPlatosAEliminar([]);
                setPlatosAgregados([]);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {/* Sección de platos eliminados */}
              {platosAEliminar.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: '#DC2626', fontWeight: 'bold', marginBottom: 10 }]}>
                    ⚠️ Platos a eliminar:
                  </Text>
                  
                  {platosAEliminar.map((plato, index) => {
                    const platoObj = plato.plato || plato;
                    // Buscar la cantidad en platosEditados o en cantidades originales
                    const platoEnEditados = comandaEditando?.platosEditados?.find(p => {
                      const pId = (p.plato?._id || p.plato)?.toString();
                      const platoId = (platoObj?._id || platoObj || plato._id)?.toString();
                      return pId === platoId;
                    });
                    const cantidad = platoEnEditados?.cantidad || comandaEditando?.cantidades?.[comandaEditando?.platos?.indexOf(plato)] || 1;
                    const nombre = platoObj?.nombre || "Plato desconocido";
                    
                    return (
                      <View key={`eliminar-${index}`} style={[styles.platoEditItem, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                        <View style={styles.platoEditInfo}>
                          <Text style={[styles.platoEditNombre, { color: '#DC2626', textDecorationLine: 'line-through' }]}>
                            {nombre}
                          </Text>
                          <Text style={[styles.platoEditPrecio, { color: '#DC2626' }]}>
                            x{cantidad}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#DC2626" />
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Sección de platos agregados */}
              {platosAgregados.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: theme.colors.success || '#10B981', fontWeight: 'bold', marginBottom: 10 }]}>
                    ✅ Platos agregados:
                  </Text>
                  
                  {platosAgregados.map((plato, index) => {
                    const cantidad = plato.cantidad || 1;
                    const nombre = plato.nombre || "Plato desconocido";
                    const precio = plato.precio || 0;
                    
                    return (
                      <View key={`agregar-${index}`} style={[styles.platoEditItem, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1 }]}>
                        <View style={styles.platoEditInfo}>
                          <Text style={[styles.platoEditNombre, { color: '#059669' }]}>
                            {nombre}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.platoEditPrecio, { color: '#059669' }]}>
                              x{cantidad}
                            </Text>
                            <Text style={[styles.platoEditPrecio, { color: '#059669', fontSize: 12 }]}>
                              S/. {precio.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { marginBottom: 10 }]}>
                  Por favor, indique el motivo de la edición: *
                </Text>
                <TextInput
                  style={[styles.observacionesInput, { 
                    borderColor: !motivoEliminacion || motivoEliminacion.trim() === "" ? '#DC2626' : theme.colors.primary,
                    borderWidth: 2,
                    minHeight: 100
                  }]}
                  placeholder="Ej: Cliente solicitó cambio, agregar plato adicional, corregir pedido..."
                  placeholderTextColor={theme.colors.text.light}
                  value={motivoEliminacion}
                  onChangeText={setMotivoEliminacion}
                  multiline
                  numberOfLines={4}
                />
                {(!motivoEliminacion || motivoEliminacion.trim() === "") && (
                  <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 5 }}>
                    * El motivo de la edición es obligatorio
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.saveButton, { 
                  backgroundColor: !motivoEliminacion || motivoEliminacion.trim() === "" ? '#9CA3AF' : '#DC2626',
                  opacity: !motivoEliminacion || motivoEliminacion.trim() === "" ? 0.5 : 1
                }]}
                onPress={async () => {
                  try {
                    console.log('✅ Botón Confirmar Edición presionado');
                    console.log('📝 Motivo:', motivoEliminacion);
                    console.log('🗑️ Platos a eliminar:', platosAEliminar.length);
                    console.log('➕ Platos a agregar:', platosAgregados.length);
                    console.log('📋 Comanda:', comandaEditando?._id);
                    
                    if (!motivoEliminacion || motivoEliminacion.trim() === "") {
                      Alert.alert("Error", "Por favor, indique el motivo de la edición");
                      return;
                    }
                    
                    await handleConfirmarEliminacionPlatos();
                  } catch (error) {
                    console.error('❌ Error en onPress del botón:', error);
                    Alert.alert("Error", "Ocurrió un error al procesar la edición: " + error.message);
                  }
                }}
                disabled={!motivoEliminacion || motivoEliminacion.trim() === ""}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.text.white} />
                <Text style={styles.saveButtonText}> Confirmar Edición</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalConfirmarEliminacionVisible(false);
                  setMotivoEliminacion("");
                  setPlatosAEliminar([]);
                  setPlatosAgregados([]);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Eliminar Última Comanda */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEliminarUltimaVisible}
        onRequestClose={() => {
          setModalEliminarUltimaVisible(false);
          setMotivoEliminacionComanda("");
          setComandaAEliminar(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { backgroundColor: colors.danger, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, marginBottom: 0 }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.white, flex: 1 }]}>
                🗑️ Eliminar Última Comanda #{comandaAEliminar?.comandaNumber || comandaAEliminar?._id?.slice(-4) || 'N/A'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEliminarUltimaVisible(false);
                setMotivoEliminacionComanda("");
                setComandaAEliminar(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.white} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {/* Lista de platos a eliminar */}
              {comandaAEliminar?.platos && comandaAEliminar.platos.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: colors.danger, fontWeight: 'bold', marginBottom: 10 }]}>
                    ⚠️ Platos a eliminar:
                  </Text>
                  
                  {comandaAEliminar.platos.map((platoItem, index) => {
                    const plato = platoItem.plato || platoItem;
                    const cantidad = comandaAEliminar.cantidades?.[index] || 1;
                    const precio = plato?.precio || platoItem.precio || 0;
                    const subtotal = precio * cantidad;
                    const nombre = plato?.nombre || "Plato desconocido";
                    
                    // Solo mostrar platos no eliminados
                    if (platoItem.eliminado) {
                      return null;
                    }
                    
                    return (
                      <View key={`plato-${index}`} style={[styles.platoEditItem, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                        <View style={styles.platoEditInfo}>
                          <Text style={[styles.platoEditNombre, { color: colors.danger }]}>
                            {nombre}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.platoEditPrecio, { color: colors.danger }]}>
                              x{cantidad}
                            </Text>
                            <Text style={[styles.platoEditPrecio, { color: colors.danger, fontSize: 14 }]}>
                              S/. {subtotal.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        <MaterialCommunityIcons name="close-circle" size={24} color={colors.danger} />
                      </View>
                    );
                  })}
                  
                  {/* Total */}
                  <View style={{ marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 2, borderTopColor: colors.danger }}>
                    <Text style={[styles.totalText, { color: colors.danger, fontSize: 22 }]}>
                      TOTAL: S/. {(() => {
                        let total = 0;
                        comandaAEliminar.platos.forEach((platoItem, index) => {
                          if (!platoItem.eliminado) {
                            const plato = platoItem.plato || platoItem;
                            const cantidad = comandaAEliminar.cantidades?.[index] || 1;
                            const precio = plato?.precio || platoItem.precio || 0;
                            total += precio * cantidad;
                          }
                        });
                        return total.toFixed(2);
                      })()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Input motivo */}
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { marginBottom: 10 }]}>
                  Motivo de eliminación: *
                </Text>
                <TextInput
                  style={[styles.observacionesInput, { 
                    borderColor: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? colors.danger : theme.colors.primary,
                    borderWidth: 2,
                    minHeight: 100
                  }]}
                  placeholder="Ej: Cliente canceló pedido, error en comanda, cambio de mesa..."
                  placeholderTextColor={theme.colors.text.light}
                  value={motivoEliminacionComanda}
                  onChangeText={setMotivoEliminacionComanda}
                  multiline
                  numberOfLines={4}
                />
                {(!motivoEliminacionComanda || motivoEliminacionComanda.trim() === "") && (
                  <Text style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>
                    * El motivo de eliminación es obligatorio
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.saveButton, { 
                  backgroundColor: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? '#9CA3AF' : colors.danger,
                  opacity: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? 0.5 : 1
                }]}
                onPress={handleConfirmarEliminarUltima}
                disabled={!motivoEliminacionComanda || motivoEliminacionComanda.trim() === ""}
              >
                <MaterialCommunityIcons name="delete" size={20} color={theme.colors.text.white} />
                <Text style={styles.saveButtonText}> Eliminar Última</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalEliminarUltimaVisible(false);
                  setMotivoEliminacionComanda("");
                  setComandaAEliminar(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Eliminar Todas las Comandas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEliminarTodasVisible}
        onRequestClose={() => {
          setModalEliminarTodasVisible(false);
          setMotivoEliminacionComanda("");
          setComandasAEliminar([]);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { backgroundColor: colors.danger, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, marginBottom: 0 }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.white, flex: 1 }]}>
                🗑️ Eliminar TODAS las Comandas ({comandasAEliminar?.length || 0})
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEliminarTodasVisible(false);
                setMotivoEliminacionComanda("");
                setComandasAEliminar([]);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.white} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {/* Lista de comandas a eliminar */}
              {comandasAEliminar && comandasAEliminar.length > 0 && (
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: colors.danger, fontWeight: 'bold', marginBottom: 10 }]}>
                    ⚠️ Comandas a eliminar:
                  </Text>
                  
                  {comandasAEliminar.map((comanda, comandaIndex) => {
                    // Calcular total de esta comanda
                    let totalComanda = 0;
                    const platosComanda = comanda.platos || [];
                    
                    platosComanda.forEach((platoItem, index) => {
                      if (!platoItem.eliminado) {
                        const plato = platoItem.plato || platoItem;
                        const cantidad = comanda.cantidades?.[index] || 1;
                        const precio = plato?.precio || platoItem.precio || 0;
                        totalComanda += precio * cantidad;
                      }
                    });
                    
                    return (
                      <View key={`comanda-${comandaIndex}`} style={{ marginBottom: theme.spacing.md }}>
                        <Text style={[styles.editLabel, { color: colors.danger, fontSize: 14, marginBottom: 8 }]}>
                          Comanda #{comanda.comandaNumber || comanda._id?.slice(-4) || comandaIndex + 1}:
                        </Text>
                        
                        {platosComanda.map((platoItem, index) => {
                          if (platoItem.eliminado) return null;
                          
                          const plato = platoItem.plato || platoItem;
                          const cantidad = comanda.cantidades?.[index] || 1;
                          const precio = plato?.precio || platoItem.precio || 0;
                          const subtotal = precio * cantidad;
                          const nombre = plato?.nombre || "Plato desconocido";
                          
                          return (
                            <View key={`${comandaIndex}-${index}`} style={[styles.platoEditItem, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, marginBottom: theme.spacing.xs }]}>
                              <View style={styles.platoEditInfo}>
                                <Text style={[styles.platoEditNombre, { color: colors.danger, fontSize: 14 }]}>
                                  {nombre}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={[styles.platoEditPrecio, { color: colors.danger, fontSize: 12 }]}>
                                    x{cantidad}
                                  </Text>
                                  <Text style={[styles.platoEditPrecio, { color: colors.danger, fontSize: 12 }]}>
                                    S/. {subtotal.toFixed(2)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                        
                        <View style={{ marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: '#FCA5A5' }}>
                          <Text style={[styles.platoEditPrecio, { color: colors.danger, fontSize: 14, textAlign: 'right' }]}>
                            Subtotal: S/. {totalComanda.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  
                  {/* Total General */}
                  <View style={{ marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 2, borderTopColor: colors.danger }}>
                    <Text style={[styles.totalText, { color: colors.danger, fontSize: 24, fontWeight: 'bold' }]}>
                      TOTAL GENERAL: S/. {(() => {
                        let totalGeneral = 0;
                        comandasAEliminar.forEach(comanda => {
                          const platosComanda = comanda.platos || [];
                          platosComanda.forEach((platoItem, index) => {
                            if (!platoItem.eliminado) {
                              const plato = platoItem.plato || platoItem;
                              const cantidad = comanda.cantidades?.[index] || 1;
                              const precio = plato?.precio || platoItem.precio || 0;
                              totalGeneral += precio * cantidad;
                            }
                          });
                        });
                        return totalGeneral.toFixed(2);
                      })()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Input motivo */}
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { marginBottom: 10 }]}>
                  Motivo de eliminación de todas las comandas: *
                </Text>
                <TextInput
                  style={[styles.observacionesInput, { 
                    borderColor: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? colors.danger : theme.colors.primary,
                    borderWidth: 2,
                    minHeight: 100
                  }]}
                  placeholder="Ej: Cliente canceló todo el pedido, error en todas las comandas, cambio de mesa..."
                  placeholderTextColor={theme.colors.text.light}
                  value={motivoEliminacionComanda}
                  onChangeText={setMotivoEliminacionComanda}
                  multiline
                  numberOfLines={4}
                />
                {(!motivoEliminacionComanda || motivoEliminacionComanda.trim() === "") && (
                  <Text style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>
                    * El motivo de eliminación es obligatorio
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.saveButton, { 
                  backgroundColor: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? '#9CA3AF' : colors.danger,
                  opacity: !motivoEliminacionComanda || motivoEliminacionComanda.trim() === "" ? 0.5 : 1
                }]}
                onPress={handleConfirmarEliminarTodas}
                disabled={!motivoEliminacionComanda || motivoEliminacionComanda.trim() === ""}
              >
                <MaterialCommunityIcons name="delete-sweep" size={20} color={theme.colors.text.white} />
                <Text style={styles.saveButtonText}> Eliminar Todo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalEliminarTodasVisible(false);
                  setMotivoEliminacionComanda("");
                  setComandasAEliminar([]);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Opciones de Mesa (Preparado) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalOpcionesMesaVisible}
        onRequestClose={() => setModalOpcionesMesaVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalOpcionesContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Mesa {mesaOpciones?.nummesa || 'N/A'} - {mesaOpciones?.estado === 'recoger' ? 'Recoger' : 'Preparado'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpcionesMesaVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalOpcionesMessage}>
              {mesaOpciones?.estado === 'recoger' 
                ? 'El pedido está listo para recoger. ¿Qué deseas hacer?'
                : 'El pedido está listo. ¿Qué deseas hacer?'}
            </Text>

            <View style={styles.modalOpcionesButtons}>
              <TouchableOpacity
                style={[styles.modalOpcionesButton, styles.modalOpcionesButtonPrimary]}
                onPress={async () => {
                  setModalOpcionesMesaVisible(false);
                  // Guardar la mesa seleccionada para crear nueva comanda
                  await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaOpciones));
                  navigation.navigate("Ordenes");
                }}
              >
                <MaterialCommunityIcons name="plus-circle" size={24} color={theme.colors.text.white} />
                <Text style={styles.modalOpcionesButtonText}>Nueva Comanda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalOpcionesButton, 
                  styles.modalOpcionesButtonPrimary,
                  verificandoComandas && { opacity: 0.5 }
                ]}
                onPress={async () => {
                  if (verificandoComandas) {
                    return; // Prevenir múltiples clics
                  }

                  if (mesaOpciones.estado !== 'preparado') {
                    Alert.alert('Error', 'Solo mesas preparadas pueden pagarse');
                    return;
                  }

                  setModalOpcionesMesaVisible(false);
                  setVerificandoComandas(true);
                  
                  try {
                    // Corrección preventiva: asegurar status recoger en comandas con todos los platos entregados antes de pedir comandas-para-pagar.
                    if (comandasOpciones?.length) {
                      await Promise.all(comandasOpciones.map((c) => verificarYActualizarEstadoComanda(c, axios)));
                    }
                    // ← NUEVO ENDPOINT - datos limpios del backend
                    const baseURL = apiConfig.isConfigured 
                      ? apiConfig.getEndpoint('/comanda')
                      : COMANDA_API;
                    const comandasURL = `${baseURL}/comandas-para-pagar/${mesaOpciones._id}`;
                    
                    console.log('🔍 [PAGAR] Llamando endpoint:', comandasURL);
                    console.log('🔍 [PAGAR] Mesa ID:', mesaOpciones._id);
                    
                    const response = await axios.get(comandasURL, { timeout: 10000 });
                    
                    console.log('✅ [PAGAR] Respuesta recibida:', {
                      comandas: response.data.comandas?.length || 0,
                      total: response.data.totalPendiente,
                      mesa: response.data.mesa,
                      primeraComanda: response.data.comandas?.[0]?._id,
                      platosPrimeraComanda: response.data.comandas?.[0]?.platos?.length || 0
                    });
                    
                    if (!response.data.comandas || response.data.comandas.length === 0) {
                      Alert.alert('Nada pendiente', 'No hay comandas listas para pagar en esta mesa');
                      setVerificandoComandas(false);
                      return;
                    }

                    // Validar que las comandas tengan platos
                    const comandasConPlatos = response.data.comandas.filter(c => c.platos && c.platos.length > 0);
                    if (comandasConPlatos.length === 0) {
                      console.warn("⚠️ [PAGAR] Las comandas recibidas no tienen platos");
                      Alert.alert('Error', 'Las comandas no tienen platos. Por favor, verifica en el servidor.');
                      setVerificandoComandas(false);
                      return;
                    }

                    console.log('📤 [PAGAR] Navegando a PagosScreen con datos:', {
                      mesa: response.data.mesa?.nummesa,
                      cantidadComandas: response.data.comandas.length,
                      totalPendiente: response.data.totalPendiente,
                      primeraComanda: response.data.comandas[0]?._id,
                      platosPrimeraComanda: response.data.comandas[0]?.platos?.length || 0,
                      detallePlatos: response.data.comandas[0]?.platos?.map((p, i) => ({
                        index: i,
                        nombre: p.plato?.nombre || 'Sin nombre',
                        precio: p.plato?.precio || p.precio || 0,
                        cantidad: response.data.comandas[0]?.cantidades?.[i] || 1
                      })) || []
                    });

                    // PASAR DATOS LIMPIOS a PagosScreen vía route.params
                    // IMPORTANTE: Para Tab Navigator, usar navigate con parámetros
                    const paramsParaPagos = {
                      mesa: response.data.mesa,
                      comandasParaPagar: response.data.comandas,
                      totalPendiente: response.data.totalPendiente
                    };
                    
                    console.log('📋 [PAGAR] Parámetros a pasar:', {
                      tieneMesa: !!paramsParaPagos.mesa,
                      cantidadComandas: paramsParaPagos.comandasParaPagar?.length || 0,
                      total: paramsParaPagos.totalPendiente,
                      estructuraComandas: paramsParaPagos.comandasParaPagar?.map(c => ({
                        _id: c._id?.slice(-6),
                        comandaNumber: c.comandaNumber,
                        platos: c.platos?.length || 0,
                        platosDetalle: c.platos?.map(p => ({
                          nombre: p.plato?.nombre || 'Sin nombre',
                          precio: p.plato?.precio || p.precio || 0
                        })) || []
                      })) || []
                    });
                    
                    navigation.navigate('Pagos', paramsParaPagos);
                  } catch (error) {
                    logger.error('Error cargando comandas para pagar:', error);
                    Alert.alert('Error', error.response?.data?.message || 'No se pudieron cargar las comandas');
                  } finally {
                    setVerificandoComandas(false);
                  }
                }}
                disabled={verificandoComandas}
              >
                <MaterialCommunityIcons name="cash" size={24} color={theme.colors.text.white} />
                <Text style={styles.modalOpcionesButtonText}>Pagar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOpcionesButton, styles.modalOpcionesButtonDanger]}
                onPress={() => {
                  setModalOpcionesMesaVisible(false);
                  handleEliminarUltimaComanda(mesaOpciones, comandasOpciones);
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={24} color={theme.colors.text.white} />
                <Text style={styles.modalOpcionesButtonText}>Eliminar la Última Comanda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOpcionesButton, styles.modalOpcionesButtonDanger]}
                onPress={() => {
                  setModalOpcionesMesaVisible(false);
                  handleAbrirEliminarPlatos(mesaOpciones, comandasOpciones);
                }}
              >
                <MaterialCommunityIcons name="delete-circle-outline" size={24} color={theme.colors.text.white} />
                <Text style={styles.modalOpcionesButtonText}>Eliminar plato Comanda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOpcionesButton, styles.modalOpcionesButtonDanger]}
                onPress={() => {
                  setModalOpcionesMesaVisible(false);
                  handleEliminarTodasComandasMesa(mesaOpciones, comandasOpciones);
                }}
              >
                <MaterialCommunityIcons name="delete" size={24} color={theme.colors.text.white} />
                <Text style={styles.modalOpcionesButtonText}>Eliminar Todas las Comandas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Eliminar Platos de Comanda */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEliminarPlatosVisible}
        onRequestClose={() => {
          setModalEliminarPlatosVisible(false);
          setMotivoEliminarPlatos("");
          setPlatosSeleccionadosEliminar([]);
          setComandaEliminarPlatos(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { backgroundColor: colors.danger, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, marginBottom: 0 }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.white, flex: 1 }]}>
                🗑️ Eliminar platos Comanda #{comandaEliminarPlatos?.comandaNumber || comandaEliminarPlatos?._id?.slice(-4) || 'N/A'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEliminarPlatosVisible(false);
                setMotivoEliminarPlatos("");
                setPlatosSeleccionadosEliminar([]);
                setComandaEliminarPlatos(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.white} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {/* Título de la mesa */}
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { fontSize: 16, fontWeight: 'bold', marginBottom: 10 }]}>
                  Mesa {comandaEliminarPlatos?.mesas?.nummesa || 'N/A'} - {comandaEliminarPlatos?.estadoMesa === 'recoger' ? 'Estado Recoger' : 'Comanda activa'}
                </Text>
              </View>

              {/* Lista de platos según estado */}
              {comandaEliminarPlatos?.platos && (() => {
                const estadoFiltro = comandaEliminarPlatos?.estadoFiltro || "entregado";
                const esRecoger = estadoFiltro === "recoger";
                
                return (
                  <View style={styles.editSection}>
                    <Text style={[styles.editLabel, { color: colors.danger, fontWeight: 'bold', marginBottom: 10 }]}>
                      {esRecoger 
                        ? "Platos en estado recoger (selecciona los que deseas eliminar):"
                        : "Platos entregados (selecciona los que deseas eliminar):"}
                    </Text>
                    
                    {comandaEliminarPlatos.platos.map((platoItem, index) => {
                      const plato = platoItem.plato || platoItem;
                      const cantidad = comandaEliminarPlatos.cantidades?.[index] || 1;
                      const precio = plato?.precio || platoItem.precio || 0;
                      const subtotal = precio * cantidad;
                      const nombre = plato?.nombre || "Plato desconocido";
                      const estado = platoItem.estado?.toLowerCase() || "";
                      
                      // Filtrar según el estado (recoger o entregado)
                      if (estado !== estadoFiltro || platoItem.eliminado) {
                        return null;
                      }

                    const isSelected = platosSeleccionadosEliminar.includes(index.toString());

                    return (
                      <TouchableOpacity
                        key={`plato-${index}`}
                        style={[
                          styles.platoEditItem,
                          {
                            backgroundColor: isSelected ? '#FEF2F2' : '#FFFFFF',
                            borderColor: isSelected ? colors.danger : '#E0E0E0',
                            borderWidth: isSelected ? 2 : 1,
                            marginBottom: 8
                          }
                        ]}
                        onPress={() => {
                          const indexStr = index.toString();
                          if (isSelected) {
                            setPlatosSeleccionadosEliminar(prev => prev.filter(i => i !== indexStr));
                          } else {
                            setPlatosSeleccionadosEliminar(prev => [...prev, indexStr]);
                          }
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[
                            {
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              borderWidth: 2,
                              borderColor: isSelected ? colors.danger : '#9CA3AF',
                              backgroundColor: isSelected ? colors.danger : 'transparent',
                              marginRight: 12,
                              justifyContent: 'center',
                              alignItems: 'center'
                            }
                          ]}>
                            {isSelected && (
                              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                            )}
                          </View>
                          <View style={styles.platoEditInfo}>
                            <Text 
                              style={[styles.platoEditNombre, { color: colors.danger }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {nombre} x{cantidad}
                            </Text>
                            <Text style={[styles.platoEditPrecio, { color: colors.danger, marginLeft: 8 }]}>
                              ✓ {esRecoger ? 'recoger' : 'entregado'} - S/. {subtotal.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  
                  {comandaEliminarPlatos.platos.filter((p, i) => {
                    const estado = p.estado?.toLowerCase() || "";
                    return estado === estadoFiltro && !p.eliminado;
                  }).length === 0 && (
                    <Text style={{ color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: 20 }}>
                      {esRecoger 
                        ? "No hay platos en estado 'recoger' disponibles para eliminar"
                        : "No hay platos entregados disponibles para eliminar"}
                    </Text>
                  )}
                  </View>
                );
              })()}

              {/* Texto obligatorio rojo */}
              <View style={styles.editSection}>
                <Text style={[styles.editLabel, { color: colors.danger, fontWeight: 'bold', marginBottom: 10 }]}>
                  Por favor, indique el motivo de la eliminación de platos *
                </Text>
                <TextInput
                  style={[styles.observacionesInput, { 
                    borderColor: !motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5 ? colors.danger : theme.colors.primary,
                    borderWidth: 2,
                    minHeight: 100
                  }]}
                  placeholder="Ej: Cliente no quiso, plato mal preparado, error en pedido..."
                  placeholderTextColor={theme.colors.text.light}
                  value={motivoEliminarPlatos}
                  onChangeText={setMotivoEliminarPlatos}
                  multiline
                  numberOfLines={4}
                />
                {(!motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5) && (
                  <Text style={{ color: colors.danger, fontSize: 12, marginTop: 5 }}>
                    * El motivo es obligatorio (mínimo 5 caracteres)
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.saveButton, { 
                  backgroundColor: !motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5 || platosSeleccionadosEliminar.length === 0 ? '#9CA3AF' : colors.danger,
                  opacity: !motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5 || platosSeleccionadosEliminar.length === 0 ? 0.5 : 1
                }]}
                onPress={handleConfirmarEliminarPlatos}
                disabled={!motivoEliminarPlatos || motivoEliminarPlatos.trim().length < 5 || platosSeleccionadosEliminar.length === 0}
              >
                <MaterialCommunityIcons name="delete-circle" size={20} color={theme.colors.text.white} />
                <Text style={styles.saveButtonText}> ELIMINAR PLATOS SELECCIONADOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalEliminarPlatosVisible(false);
                  setMotivoEliminarPlatos("");
                  setPlatosSeleccionadosEliminar([]);
                  setComandaEliminarPlatos(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Overlay de Carga para Eliminación de Última Comanda */}
      {eliminandoUltimaComanda && (
        <OverlayEliminacion mensaje={mensajeCargaEliminacion} />
      )}

      {/* Overlay de Carga para Eliminación de Todas las Comandas */}
      {eliminandoTodasComandas && (
        <OverlayEliminacion mensaje={mensajeCargaEliminacionTodas} />
      )}

      {/* Overlay de Carga para Verificación de Comandas antes de Pagar */}
      {verificandoComandas && (
        <AnimatedOverlay mensaje={mensajeCargaVerificacion} />
      )}

      {/* Overlay de Carga para Eliminación de Platos de Comanda */}
      {/* Loading con verificaciones paso a paso para eliminar platos */}
      <LoadingVerificacionEliminar
        visible={loadingEliminarPlatos}
        mensaje={mensajeLoadingEliminar}
        pasos={pasosEliminar}
      />
      
      {/* Overlay antiguo (mantener para compatibilidad) */}
      {eliminandoPlatos && (
        <OverlayEliminacion mensaje={mensajeCargaEliminacionPlatos} />
      )}


    </SafeAreaView>
  );
};


const InicioScreenStyles = (theme, isMobile, mesaSize, canvasWidth, barraWidth, fontSize, fontSizeSidebar, iconSizeSidebar) => StyleSheet.create({
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
    ...theme.shadows.medium,
  },
  profileButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.white,
    letterSpacing: 1,
  },
  headerTime: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  canvas: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContent: {
    padding: theme.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  mesaCard: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.medium,
  },
  mesaNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginBottom: 4,
  },
  mesaMozo: {
    fontSize: 10,
    color: theme.colors.text.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  mesaIcon: {
    marginTop: 4,
  },
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
    flexDirection: "column",
  },
  tabsScrollContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  tabsScrollView: {
    flex: 1,
  },
  tabsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  scrollGradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 1,
  },
  scrollGradientRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 1,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.small,
  },
  zoomButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  zoomIndicator: {
    minWidth: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  zoomDot: {
    color: theme.colors.border,
    fontSize: fontSize * 0.6,
  },
  zoomDotActive: {
    color: theme.colors.primary,
    fontSize: fontSize * 0.6,
  },
  tabButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    minWidth: 80,
    maxWidth: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    ...theme.shadows.small,
  },
  tabButtonText: {
    fontSize: fontSize,
    fontWeight: "600",
    color: theme.colors.text.secondary,
  },
  tabButtonTextActive: {
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  // ============================================
  // ESTILOS SECCIÓN ZOOM
  // ============================================
  zoomSection: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 8,
  },
  zoomSectionTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  zoomButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  zoomButtonDisabled: {
    backgroundColor: "#666",
    opacity: 0.5,
  },
  zoomButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.text.white,
  },
  zoomIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    marginBottom: 6,
    gap: 4,
  },
  zoomDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoomDotActive: {
    backgroundColor: theme.colors.text.white,
    opacity: 1,
  },
  zoomDotInactive: {
    backgroundColor: theme.colors.text.white,
    opacity: 0.2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  barraDerecha: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.medium,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  barraScroll: {
    flex: 1,
  },
  barraItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  barraItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  barraItemText: {
    fontSize: fontSizeSidebar || 11,
    color: theme.colors.text.primary,
    fontWeight: "500",
    flex: 1,
  },
  barraItemSalir: {
    marginTop: "auto",
  },
  barraItemTextSalir: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: "95%",
    maxWidth: 500,
    maxHeight: "90vh",
    minHeight: 400,
    padding: theme.spacing.lg,
    ...theme.shadows.large,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
    flex: 1,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.md,
  },
  editSection: {
    marginBottom: theme.spacing.md,
  },
  editLabel: {
    fontSize: Math.max(14, Math.min(16, fontSize * 0.85)),
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  platoEditItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    minHeight: 52, // Touch-safe height
  },
  platoEditInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
    flex: 1,
  },
  platoEditNombre: {
    fontSize: Math.max(14, Math.min(16, fontSize * 0.85)),
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
    numberOfLines: 1,
    ellipsizeMode: "tail",
  },
  platoEditPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoEditActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  cantidadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cantidadButtonText: {
    color: theme.colors.text.white,
    fontSize: 18,
    fontWeight: "700",
  },
  cantidadText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "center",
    color: theme.colors.text.primary,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  observacionesInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.primary,
    textAlign: "center",
  },
  addPlatoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addPlatoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  categoriasContainer: {
    marginBottom: theme.spacing.md,
  },
  categoriaChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  categoriaChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  categoriaChipTextActive: {
    color: theme.colors.text.white,
  },
  platosListContainer: {
    height: 250,
    marginBottom: theme.spacing.md,
  },
  platosScrollView: {
    flex: 1,
  },
  platoSelectItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  platoSelectInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  platoSelectNombre: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoSelectPrecio: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  cantidadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    marginLeft: theme.spacing.sm,
  },
  cantidadBadgeText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyPlatosContainer: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  emptyPlatosText: {
    fontSize: 16,
    color: theme.colors.text.light,
    fontStyle: "italic",
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52, // Touch-safe height for S24 FE
    minWidth: 120,
  },
  saveButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: Math.max(14, Math.min(16, fontSize * 0.9)),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
  },
  modalOpcionesContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: "85%",
    maxWidth: 400,
    padding: theme.spacing.lg,
    ...theme.shadows.large,
  },
  modalOpcionesMessage: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  modalOpcionesButtons: {
    gap: theme.spacing.md,
  },
  modalOpcionesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.small,
  },
  modalOpcionesButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalOpcionesButtonDanger: {
    backgroundColor: theme.colors.error || "#DC3545",
  },
  modalOpcionesButtonCancel: {
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  modalOpcionesButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  modalOpcionesButtonTextCancel: {
    color: theme.colors.text.primary,
  },
});

export default InicioScreen;


