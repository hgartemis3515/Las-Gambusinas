import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
// 🔥 Usar axios configurado globalmente (timeout 10s, anti-bloqueo)
import axios from "../../../config/axiosConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COMANDA_API, SELECTABLE_API_GET, DISHES_API, MESAS_API_UPDATE, AREAS_API, COMANDASEARCH_API_GET, apiConfig } from "../../../apiConfig";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { useOrientation } from "../../../hooks/useOrientation";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import moment from "moment-timezone";
// Animaciones Premium 60fps
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

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
              name="food" 
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

const OrdenesScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const orientation = useOrientation();
  const styles = OrdenesScreenStyles(theme, orientation);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [modalMesasVisible, setModalMesasVisible] = useState(false);
  const [modalPlatosVisible, setModalPlatosVisible] = useState(false);
  const [platos, setPlatos] = useState([]);
  const [selectedPlatos, setSelectedPlatos] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [areas, setAreas] = useState([]);
  const [filtroAreaMesa, setFiltroAreaMesa] = useState("All"); // Filtro para el modal de mesas
  const [mostrarOverlayCarga, setMostrarOverlayCarga] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Creando comanda...");

  useEffect(() => {
    loadUserData();
    loadPlatosData();
    loadSelectedPlatos();
    obtenerAreas();
  }, []);

  // Recargar mesa y usuario cuando se enfoca la pantalla (por si viene desde InicioScreen con mesa seleccionada)
  useFocusEffect(
    useCallback(() => {
      loadMesaData();
      loadUserData(); // Recargar usuario para asegurar que esté actualizado
      
      // 🔥 CRÍTICO: Resetear estado de envío cuando la pantalla se enfoca
      // Esto previene que el botón quede en "Enviando..." si el usuario navega y vuelve
      setIsSendingComanda(false);
      setMostrarOverlayCarga(false);
    }, [])
  );

  const obtenerAreas = async () => {
    try {
      const areasURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/areas')
        : AREAS_API;
      const response = await axios.get(areasURL, { timeout: 5000 });
      setAreas(response.data.filter(area => area.isActive !== false));
    } catch (error) {
      console.error("Error al obtener las áreas:", error.message);
    }
  };

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        console.log("👤 Usuario cargado desde AsyncStorage:", {
          _id: parsed._id,
          name: parsed.name,
          datosCompletos: parsed
        });
        setUserInfo(parsed);
      } else {
        console.warn("⚠️ No se encontró usuario en AsyncStorage");
      }
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  const loadMesaData = async () => {
    try {
      const mesaData = await AsyncStorage.getItem("mesaSeleccionada");
      if (mesaData) {
        const parsed = JSON.parse(mesaData);
        setSelectedMesa(parsed);
      }
    } catch (error) {
      console.error("Error cargando mesa:", error);
    }
  };

  const loadPlatosData = async () => {
    try {
      const platosURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/platos')
        : DISHES_API;
      const response = await axios.get(platosURL, { timeout: 5000 });
      setPlatos(response.data);
    } catch (error) {
      console.error("Error cargando platos:", error);
      Alert.alert("Error", "No se pudieron cargar los platos");
    }
  };

  const loadSelectedPlatos = async () => {
    try {
      const stored = await AsyncStorage.getItem("selectedPlates");
      const storedCantidades = await AsyncStorage.getItem("cantidadesComanda");
      const storedObs = await AsyncStorage.getItem("additionalDetails");
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setSelectedPlatos(parsed);
      }
      
      if (storedCantidades) {
        const parsed = JSON.parse(storedCantidades);
        const cantidadesObj = {};
        parsed.forEach((cant, index) => {
          if (stored) {
            const platos = JSON.parse(stored);
            if (platos[index]) {
              cantidadesObj[platos[index]._id] = cant;
            }
          }
        });
        setCantidades(cantidadesObj);
      }
      
      if (storedObs) {
        setObservaciones(storedObs);
      }
    } catch (error) {
      console.error("Error cargando platos seleccionados:", error);
    }
  };

  const fetchMesas = async () => {
    try {
      const mesasURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/mesas')
        : SELECTABLE_API_GET;
      const response = await axios.get(mesasURL, { timeout: 5000 });
      setMesas(response.data);
    } catch (error) {
      console.error("Error obteniendo mesas:", error);
      Alert.alert("Error", "No se pudieron cargar las mesas");
    }
  };

  const handleSelectMesa = async (mesa) => {
    try {
      const mesaData = {
        _id: mesa._id,
        nummesa: mesa.nummesa
      };
      await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaData));
      setSelectedMesa(mesaData);
      setModalMesasVisible(false);
      Alert.alert("✅", `Mesa ${mesa.nummesa} seleccionada`);
    } catch (error) {
      console.error("Error seleccionando mesa:", error);
    }
  };

  const handleAddPlato = (plato) => {
    const exists = selectedPlatos.find(p => p._id === plato._id);
    if (exists) {
      const newCant = (cantidades[plato._id] || 1) + 1;
      setCantidades({ ...cantidades, [plato._id]: newCant });
    } else {
      setSelectedPlatos([...selectedPlatos, plato]);
      setCantidades({ ...cantidades, [plato._id]: 1 });
    }
  };

  const handleRemovePlato = (platoId) => {
    const newPlatos = selectedPlatos.filter(p => p._id !== platoId);
    setSelectedPlatos(newPlatos);
    const newCantidades = { ...cantidades };
    delete newCantidades[platoId];
    setCantidades(newCantidades);
  };

  const handleUpdateCantidad = (platoId, delta) => {
    const current = cantidades[platoId] || 1;
    const newCant = Math.max(1, current + delta);
    setCantidades({ ...cantidades, [platoId]: newCant });
  };

  const calcularSubtotal = () => {
    let total = 0;
    selectedPlatos.forEach(plato => {
      const cantidad = cantidades[plato._id] || 1;
      total += plato.precio * cantidad;
    });
    return total.toFixed(2);
  };

  // 🔥 Función para verificar si la comanda se creó en el backend
  const verificarComandaEnBackend = async (mesaId, mozoId, comandaNumber = null) => {
    try {
      setMensajeCarga("Verificando comanda en el servidor...");
      
      // Obtener comandas del día actual
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const comandasURL = apiConfig.isConfigured 
        ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
        : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
      
      const response = await axios.get(comandasURL, { timeout: 8000 });
      const comandas = response.data || [];
      
      // Filtrar comandas recientes (últimos 2 minutos) de esta mesa y mozo
      const ahora = moment().tz("America/Lima");
      const comandasRecientes = comandas.filter(c => {
        const comandaMesaId = c.mesas?._id?.toString() || c.mesas?.toString() || c.mesas;
        const comandaMozoId = c.mozos?._id?.toString() || c.mozos?.toString() || c.mozos;
        const fechaCreacion = moment(c.fechaCreacion || c.createdAt).tz("America/Lima");
        const minutosDiferencia = ahora.diff(fechaCreacion, 'minutes');
        
        const coincideMesa = comandaMesaId === mesaId?.toString();
        const coincideMozo = comandaMozoId === mozoId?.toString();
        const esReciente = minutosDiferencia <= 2; // Últimos 2 minutos
        const coincideNumero = comandaNumber ? c.comandaNumber === comandaNumber : true;
        
        return coincideMesa && coincideMozo && esReciente && coincideNumero;
      });
      
      if (comandasRecientes.length > 0) {
        const comandaEncontrada = comandasRecientes[0];
        console.log(`✅ [VERIFICACIÓN] Comanda encontrada en backend: #${comandaEncontrada.comandaNumber}`);
        return { success: true, comanda: comandaEncontrada };
      }
      
      console.log(`⚠️ [VERIFICACIÓN] No se encontró comanda reciente en backend`);
      return { success: false };
    } catch (error) {
      console.error("❌ [VERIFICACIÓN] Error verificando comanda en backend:", error);
      return { success: false, error };
    }
  };

  const handleEnviarComanda = async () => {
    try {
      setIsSendingComanda(true);

      if (!userInfo || !userInfo._id) {
        Alert.alert("Error", "No hay usuario logueado");
        setIsSendingComanda(false);
        return;
      }

      if (!selectedMesa || !selectedMesa._id) {
        Alert.alert("Error", "Por favor selecciona una mesa");
        setIsSendingComanda(false);
        return;
      }

      if (selectedPlatos.length === 0) {
        Alert.alert("Error", "Agrega al menos un plato");
        setIsSendingComanda(false);
        return;
      }

      // IMPORTANTE: Obtener el estado actualizado de la mesa desde el servidor
      // para evitar problemas cuando se elimina una comanda y la mesa cambia a "libre"
      let mesaActualizada = selectedMesa;
      try {
        const mesasURL = apiConfig.isConfigured 
          ? apiConfig.getEndpoint('/mesas')
          : SELECTABLE_API_GET;
        const mesasResponse = await axios.get(mesasURL, { timeout: 5000 });
        const mesaEncontrada = mesasResponse.data.find(m => m._id === selectedMesa._id);
        if (mesaEncontrada) {
          mesaActualizada = mesaEncontrada;
          // Actualizar selectedMesa con el estado más reciente
          setSelectedMesa(mesaActualizada);
          console.log(`✅ Estado actualizado de la mesa ${mesaActualizada.nummesa}: ${mesaActualizada.estado}`);
        } else {
          console.warn(`⚠️ No se encontró la mesa ${selectedMesa._id} en el servidor`);
        }
      } catch (error) {
        console.error("⚠️ Error al obtener estado actualizado de la mesa:", error);
        // Continuar con el estado local si falla la petición
      }
      
      // Validar estado de la mesa antes de crear la comanda (usando estado actualizado)
      const estadoMesa = (mesaActualizada.estado || 'libre').toLowerCase();
      
      // Si la mesa NO está libre, verificar que sea el mismo mozo que creó la comanda
      if (estadoMesa !== 'libre') {
        if (estadoMesa === 'reservado') {
          Alert.alert(
            "Mesa Reservada",
            "Esta mesa está reservada. Solo un administrador puede liberarla.",
            [{ text: "OK" }]
          );
          setIsSendingComanda(false);
          return;
        }
        
        // Para otros estados (pedido, preparado, pagado, esperando), verificar que sea el mismo mozo
        try {
          // Obtener comandas de la mesa para verificar el mozo
          const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
          const comandasURL = apiConfig.isConfigured 
            ? `${apiConfig.getEndpoint('/comanda')}/fecha/${currentDate}`
            : `${COMANDASEARCH_API_GET}/fecha/${currentDate}`;
          
          const response = await axios.get(comandasURL, { 
            timeout: 10000, // Aumentado de 5000 a 10000ms para conexiones lentas
            validateStatus: (status) => status < 500 // Aceptar errores 4xx sin lanzar excepción
          });
          
          const comandasMesa = response.data?.filter ? response.data.filter(
            (c) => c.mesas?.nummesa === mesaActualizada.nummesa && 
                   c.status?.toLowerCase() !== "pagado" && 
                   c.status?.toLowerCase() !== "completado"
          ) : [];
          
          if (comandasMesa.length > 0) {
            const primeraComanda = comandasMesa[0];
            const mozoComandaId = primeraComanda.mozos?._id || primeraComanda.mozos;
            const mozoActualId = userInfo._id;
            
            if (mozoComandaId && mozoActualId && mozoComandaId.toString() !== mozoActualId.toString()) {
              Alert.alert(
                "Acceso Denegado",
                `Solo el mozo que creó la comanda original puede agregar más comandas a esta mesa cuando está en estado '${estadoMesa}'.`,
                [{ text: "OK" }]
              );
              setIsSendingComanda(false);
              return;
            }
            // Si es el mismo mozo, permitir crear nueva comanda
            // Si la mesa está en "preparado", se creará la nueva comanda y la mesa pasará a "pedido"
            if (estadoMesa === 'preparado') {
              console.log(`✅ Creando nueva comanda en mesa ${mesaActualizada.nummesa} (estado: preparado) - Mismo mozo`);
            }
          } else {
            // Si no hay comandas activas pero la mesa está en "preparado", permitir crear comanda
            // (puede ser un estado inconsistente o la comanda ya fue pagada)
            if (estadoMesa === 'preparado') {
              console.log(`✅ Creando nueva comanda en mesa ${mesaActualizada.nummesa} (estado: preparado) - Sin comandas activas`);
              // Permitir continuar con la creación de la comanda
            } else {
              // Para otros estados sin comandas activas, rechazar
              Alert.alert(
                "Mesa No Disponible",
                `La mesa está en estado "${estadoMesa}". Solo se pueden crear comandas en mesas libres o cuando eres el mozo que creó la comanda original.`,
                [{ text: "OK" }]
              );
              setIsSendingComanda(false);
              return;
            }
          }
        } catch (error) {
          // Manejo mejorado de errores de red
          const isNetworkError = error.code === 'ECONNABORTED' || 
                                 error.message?.includes('Network Error') ||
                                 error.message?.includes('timeout') ||
                                 !error.response;
          
          if (isNetworkError) {
            console.warn("⚠️ Error de red al verificar comandas:", error.message);
            
            // Si la mesa está en "preparado", permitir crear comanda aunque falle la verificación
            // (el backend validará y actualizará el estado correctamente)
            if (estadoMesa === 'preparado') {
              console.log(`⚠️ [ORDENES] Error de red, pero permitiendo crear comanda en mesa ${mesaActualizada.nummesa} (estado: preparado)`);
              // Continuar con la creación de la comanda - NO retornar aquí
            } else {
              // Para otros estados, mostrar error pero más informativo
              Alert.alert(
                "Error de Conexión",
                `No se pudo verificar las comandas de la mesa debido a un error de red. Por favor, verifica tu conexión e intenta nuevamente.\n\nEstado de la mesa: ${estadoMesa}`,
                [{ text: "OK" }]
              );
              setIsSendingComanda(false);
              return;
            }
          } else {
            // Error del servidor (no de red)
            console.error("Error verificando comandas de la mesa:", error);
            Alert.alert(
              "Error del Servidor",
              `No se pudo verificar las comandas de la mesa. Error: ${error.response?.data?.message || error.message}`,
              [{ text: "OK" }]
            );
            setIsSendingComanda(false);
            return;
          }
        }
      }

      const platosData = selectedPlatos.map(plato => ({
        plato: plato._id,
        platoId: plato.id || null,
        estado: "en_espera"
      }));

      const cantidadesArray = selectedPlatos.map(plato => cantidades[plato._id] || 1);

      // Verificar y loggear el userInfo antes de crear la comanda
      console.log("👤 UserInfo antes de crear comanda:", {
        _id: userInfo._id,
        name: userInfo.name,
        userInfoCompleto: userInfo
      });
      
      if (!userInfo._id) {
        Alert.alert("Error", "No se pudo obtener el ID del usuario. Por favor, cierra sesión y vuelve a iniciar.");
        setIsSendingComanda(false);
        return;
      }

      const comandaData = {
        mozos: userInfo._id,
        mesas: mesaActualizada._id,
        platos: platosData,
        cantidades: cantidadesArray,
        observaciones: observaciones || "",
        status: "en_espera",
        IsActive: true
      };

      console.log("📤 Datos de comanda a enviar:", {
        mozos: comandaData.mozos,
        mesas: comandaData.mesas,
        numMesa: selectedMesa.nummesa,
        platosCount: comandaData.platos.length
      });

      // Mostrar overlay de carga
      setMostrarOverlayCarga(true);
      setMensajeCarga("Creando comanda...");
      
      const comandaURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/comanda')
        : COMANDA_API;
      
      // 🔥 MEJORADO: Intentar POST y manejar respuesta inteligentemente
      let response;
      let comandaNumber = null;
      let comandaCreada = null;
      
      try {
        response = await axios.post(comandaURL, comandaData, { timeout: 10000 });
        
        // Extraer datos de la respuesta
        comandaNumber = response.data?.comanda?.comandaNumber || response.data?.comandaNumber || null;
        comandaCreada = response.data?.comanda || response.data;
        
        // Verificar que la comanda se creó correctamente
        if (!comandaCreada || !comandaCreada._id) {
          // Si no hay comanda en la respuesta, verificar en backend
          console.warn("⚠️ No se encontró comanda en respuesta, verificando en backend...");
          const verificacion = await verificarComandaEnBackend(
            mesaActualizada._id,
            userInfo._id,
            comandaNumber
          );
          
          if (verificacion.success) {
            comandaCreada = verificacion.comanda;
            comandaNumber = verificacion.comanda.comandaNumber;
            console.log(`✅ Comanda verificada en backend: #${comandaNumber}`);
          } else {
            setMostrarOverlayCarga(false);
            Alert.alert("Error", "No se pudo crear la comanda correctamente");
            setIsSendingComanda(false);
            return;
          }
        }
      } catch (postError) {
        // 🔥 MEJORADO: Si hay error en POST, verificar si la comanda se creó de todas formas
        console.warn("⚠️ Error en POST comanda, verificando si se creó:", postError.message);
        
        // Intentar extraer datos del error si existen
        if (postError.response?.data) {
          comandaNumber = postError.response.data?.comanda?.comandaNumber || postError.response.data?.comandaNumber;
          comandaCreada = postError.response.data?.comanda || postError.response.data;
        }
        
        // Si no hay datos en el error, verificar en backend
        if (!comandaCreada || !comandaCreada._id) {
          setMensajeCarga("Verificando si la comanda se creó...");
          const verificacion = await verificarComandaEnBackend(
            mesaActualizada._id,
            userInfo._id,
            comandaNumber
          );
          
          if (verificacion.success) {
            comandaCreada = verificacion.comanda;
            comandaNumber = verificacion.comanda.comandaNumber;
            console.log(`✅ Comanda encontrada en backend después de error: #${comandaNumber}`);
            // Continuar con el flujo normal (no lanzar error)
          } else {
            // Realmente falló, lanzar el error para que se maneje en el catch externo
            throw postError;
          }
        } else {
          // Hay datos en el error, la comanda se creó exitosamente
          console.log(`✅ Comanda creada exitosamente (datos en error response): #${comandaNumber}`);
        }
      }
      
      // Si llegamos aquí, la comanda se creó exitosamente
      if (!comandaNumber) {
        comandaNumber = comandaCreada?.comandaNumber || "N/A";
      }
      
      setMensajeCarga(`¡Comanda #${comandaNumber} creada!`);
      console.log(`✅ Comanda #${comandaNumber} creada correctamente`);
      
      // Verificar que la mesa esté en estado "pedido" en el servidor (opcional, no bloqueante)
      setMensajeCarga("Verificando estado de la mesa...");
      const mesaId = mesaActualizada._id;
      const mesaNum = mesaActualizada.nummesa;
      
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
            
            if (estadoMesaVerificado === 'pedido') {
              mesaVerificada = true;
              console.log(`✅ Mesa ${mesaNum} confirmada en estado "pedido"`);
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
      
      // Actualizar estado local de la mesa
      try {
        if (mesaActualizada) {
          const mesaActualizadaLocal = { ...mesaActualizada, estado: 'pedido' };
          setSelectedMesa(mesaActualizadaLocal);
        }
        
        setMesas(prev => {
          const index = prev.findIndex(m => m._id === mesaActualizada._id);
          if (index !== -1) {
            const nuevas = [...prev];
            nuevas[index] = { ...nuevas[index], estado: 'pedido' };
            return nuevas;
          }
          return prev;
        });
      } catch (error) {
        console.error("⚠️ Error actualizando estado local de mesa:", error);
      }
      
      setMensajeCarga(`¡Comanda #${comandaNumber} enviada!`);
      
      // Limpiar datos locales
      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("selectedPlatesIds");
      await AsyncStorage.removeItem("cantidadesComanda");
      await AsyncStorage.removeItem("additionalDetails");
      
      setSelectedMesa(null);
      setSelectedPlatos([]);
      setCantidades({});
      setObservaciones("");
      
      // Esperar un momento antes de navegar para que el usuario vea el mensaje de éxito
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 🔥 CRÍTICO: Resetear estado ANTES de navegar
      setIsSendingComanda(false);
      setMostrarOverlayCarga(false);
      
      // Navegar a Inicio
      navigation.navigate("Inicio");
    } catch (error) {
      // 🔥 MEJORADO: Verificación exhaustiva antes de mostrar cualquier error
      console.warn("⚠️ Error capturado, verificando si comanda se creó:", error.message);
      
      // Última verificación: buscar comanda en backend
      setMensajeCarga("Verificando última vez...");
      const verificacionFinal = await verificarComandaEnBackend(
        mesaActualizada._id,
        userInfo._id
      );
      
      if (verificacionFinal.success) {
        // ¡La comanda SÍ se creó! Continuar con éxito silencioso
        console.log(`✅ Comanda encontrada en verificación final: #${verificacionFinal.comanda.comandaNumber}`);
        comandaCreada = verificacionFinal.comanda;
        comandaNumber = verificacionFinal.comanda.comandaNumber;
        
        // Continuar con el flujo de éxito (no mostrar error)
        // Esto ejecutará el código después del try/catch que maneja el éxito
        setMensajeCarga(`¡Comanda #${comandaNumber} enviada!`);
        
        // Limpiar datos locales
        await AsyncStorage.removeItem("mesaSeleccionada");
        await AsyncStorage.removeItem("selectedPlates");
        await AsyncStorage.removeItem("selectedPlatesIds");
        await AsyncStorage.removeItem("cantidadesComanda");
        await AsyncStorage.removeItem("additionalDetails");
        
        setSelectedMesa(null);
        setSelectedPlatos([]);
        setCantidades({});
        setObservaciones("");
        
        // Esperar un momento antes de navegar
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 🔥 CRÍTICO: Resetear estado ANTES de navegar
        setIsSendingComanda(false);
        setMostrarOverlayCarga(false);
        
        // Navegar a Inicio
        navigation.navigate("Inicio");
        return; // Salir sin mostrar error
      }
      
      // Si llegamos aquí, realmente falló - mostrar error apropiado
      console.error("❌ Error real enviando comanda (verificación falló):", error);
      setMostrarOverlayCarga(false);
      
      // Manejar errores HTTP específicos
      if (error.response?.status === 409) {
        Alert.alert(
          "Mesa Ocupada",
          error.response?.data?.message || "La mesa está ocupada con una comanda existente.",
          [{ text: "OK" }]
        );
      } else if (error.response?.status === 400) {
        Alert.alert(
          "Error de Validación",
          error.response?.data?.message || "Los datos proporcionados no son válidos.",
          [{ text: "OK" }]
        );
      } else {
        // Error genérico - solo mostrar si realmente no se pudo crear
        Alert.alert(
          "Error",
          error.response?.data?.message || "No se pudo crear la comanda. Por favor, intenta nuevamente.",
          [{ text: "OK" }]
        );
      }
      
      setIsSendingComanda(false);
    } finally {
      // 🔥 GARANTÍA: Siempre resetear estado, incluso si hay errores inesperados
      // Esto asegura que el botón nunca quede bloqueado
      setIsSendingComanda(false);
      setMostrarOverlayCarga(false);
    }
  };

  const saveToAsyncStorage = async () => {
    try {
      await AsyncStorage.setItem("selectedPlates", JSON.stringify(selectedPlatos));
      const selectedPlatesIds = selectedPlatos.map(p => p._id);
      await AsyncStorage.setItem("selectedPlatesIds", JSON.stringify(selectedPlatesIds));
      await AsyncStorage.setItem("cantidadesComanda", JSON.stringify(
        selectedPlatos.map(p => cantidades[p._id] || 1)
      ));
      await AsyncStorage.setItem("additionalDetails", observaciones);
    } catch (error) {
      console.error("Error guardando en AsyncStorage:", error);
    }
  };

  useEffect(() => {
    saveToAsyncStorage();
  }, [selectedPlatos, cantidades, observaciones]);

  useEffect(() => {
    if (modalMesasVisible) {
      fetchMesas();
    }
  }, [modalMesasVisible]);

  const tipoNormalizado = (t) => (t || '').trim().toLowerCase();
  const categorias = tipoPlatoFiltro
    ? [...new Set(platos.filter(p => tipoNormalizado(p.tipo) === tipoNormalizado(tipoPlatoFiltro)).map(p => p.categoria))].filter(Boolean)
    : [];
  
  const platosFiltrados = platos.filter(p => {
    const matchTipo = !tipoPlatoFiltro || tipoNormalizado(p.tipo) === tipoNormalizado(tipoPlatoFiltro);
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

  // Función para obtener el color según el estado de la mesa
  const getEstadoColor = (estado) => {
    const estadoLower = estado?.toLowerCase() || "libre";
    switch (estadoLower) {
      case "libre":
        return theme.colors.mesaEstado.libre;
      case "esperando":
        return theme.colors.mesaEstado.esperando;
      case "pedido":
        return theme.colors.mesaEstado.pedido;
      case "preparado":
        return theme.colors.mesaEstado.preparado;
      case "pagando":
        return theme.colors.mesaEstado.pagando;
      case "reservado":
        return theme.colors.mesaEstado.reservado;
      default:
        return theme.colors.mesaEstado.libre;
    }
  };

  // Obtener el estado de la mesa (si no tiene estado, asumir "Libre")
  const getMesaEstado = (mesa) => {
    return mesa.estado || "Libre";
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={orientation.isLandscape ? styles.scrollViewContentLandscape : null}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="notebook-edit" size={orientation.isLandscape ? 28 : 32} color={theme.colors.text.white} />
          <Text style={styles.headerTitle}>NUEVA ORDEN</Text>
        </View>

        {/* Selección de Mesa */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Mesa</Text>
          <TouchableOpacity
            style={styles.mesaCard}
            onPress={() => {
              fetchMesas();
              setModalMesasVisible(true);
            }}
          >
            <View style={styles.mesaCardContent}>
              <MaterialCommunityIcons 
                name={selectedMesa ? "table-check" : "table-plus"} 
                size={24} 
                color={selectedMesa ? theme.colors.secondary : theme.colors.text.secondary} 
              />
              <Text style={[styles.mesaCardText, selectedMesa && styles.mesaCardTextSelected]}>
                {selectedMesa ? `Mesa ${selectedMesa.nummesa}` : "Seleccionar Mesa"}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Platos Seleccionados */}
        <View style={[styles.section, orientation.isLandscape && styles.sectionLandscape]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Platos Seleccionados
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedPlatos.length}</Text>
            </View>
          </View>
          {selectedPlatos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.colors.text.light} />
              <Text style={styles.emptyText}>No hay platos seleccionados</Text>
            </View>
          ) : (
            selectedPlatos.map((plato) => {
              const cantidad = cantidades[plato._id] || 1;
              const subtotal = plato.precio * cantidad;
              return (
                <View key={plato._id} style={styles.platoItem}>
                  <View style={styles.platoInfo}>
                    <Text style={styles.platoNombre}>{plato.nombre}</Text>
                    <View style={styles.platoDetails}>
                      <Text style={styles.platoCantidad}>x{cantidad}</Text>
                      <Text style={styles.platoPrecio}>S/. {subtotal.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.platoActions}>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, -1)}
                    >
                      <MaterialCommunityIcons name="minus" size={16} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    <Text style={styles.cantidadText}>{cantidad}</Text>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, 1)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlato(plato._id)}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Observaciones y Total - Layout adaptado para horizontal */}
        {orientation.isLandscape ? (
          <View style={styles.horizontalLayout}>
            <View style={[styles.section, styles.sectionLandscape, { flex: 1 }]}>
              <Text style={styles.sectionLabel}>Observaciones</Text>
              <TextInput
                style={styles.observacionesInput}
                placeholder="Ej: Sin ají, sin cebolla..."
                placeholderTextColor={theme.colors.text.light}
                value={observaciones}
                onChangeText={setObservaciones}
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={[styles.totalSection, styles.totalSectionLandscape]}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalText}>S/. {calcularSubtotal()}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Observaciones</Text>
              <TextInput
                style={styles.observacionesInput}
                placeholder="Ej: Sin ají, sin cebolla..."
                placeholderTextColor={theme.colors.text.light}
                value={observaciones}
                onChangeText={setObservaciones}
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalText}>S/. {calcularSubtotal()}</Text>
            </View>
          </>
        )}

        {/* Botones */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              loadPlatosData();
              setTipoPlatoFiltro(null);
              setCategoriaFiltro(null);
              setSearchPlato("");
              setModalPlatosVisible(true);
            }}
          >
            <MaterialCommunityIcons name="plus-circle" size={24} color={theme.colors.text.white} />
            <Text style={styles.addButtonText}>Agregar Plato</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, isSendingComanda && styles.sendButtonDisabled]}
            onPress={handleEnviarComanda}
            disabled={isSendingComanda}
          >
            <MaterialCommunityIcons name="send" size={24} color={theme.colors.text.white} />
            <Text style={styles.sendButtonText}>
              {isSendingComanda ? "Enviando..." : "Enviar Orden"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Mesas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalMesasVisible}
        onRequestClose={() => setModalMesasVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Mesa</Text>
              <TouchableOpacity onPress={() => setModalMesasVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Filtro por Área en Modal */}
            <View style={styles.modalAreaFilterContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.modalAreaFilterScroll}
                contentContainerStyle={styles.modalAreaFilterContent}
              >
                <TouchableOpacity
                  style={[styles.modalAreaFilterButton, filtroAreaMesa === "All" && styles.modalAreaFilterButtonActive]}
                  onPress={() => setFiltroAreaMesa("All")}
                >
                  <Text style={[styles.modalAreaFilterButtonText, filtroAreaMesa === "All" && styles.modalAreaFilterButtonTextActive]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {areas.map((area) => (
                  <TouchableOpacity
                    key={area._id}
                    style={[styles.modalAreaFilterButton, filtroAreaMesa === area._id && styles.modalAreaFilterButtonActive]}
                    onPress={() => setFiltroAreaMesa(area._id)}
                  >
                    <Text style={[styles.modalAreaFilterButtonText, filtroAreaMesa === area._id && styles.modalAreaFilterButtonTextActive]}>
                      {area.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.mesasGrid}>
                {mesas
                  .filter(mesa => {
                    if (filtroAreaMesa === "All") return true;
                    const mesaAreaId = mesa.area?._id || mesa.area;
                    return mesaAreaId === filtroAreaMesa;
                  })
                  .map((mesa) => {
                    const estado = getMesaEstado(mesa);
                    const estadoColor = getEstadoColor(estado);
                    const isSelected = selectedMesa?._id === mesa._id;
                    const mesaArea = typeof mesa.area === 'object' 
                      ? mesa.area.nombre 
                      : areas.find(a => a._id === mesa.area)?.nombre || 'Sin área';
                    
                    return (
                      <TouchableOpacity
                        key={mesa._id}
                        style={[
                          styles.mesaCardModal,
                          { backgroundColor: estadoColor },
                          isSelected && styles.mesaCardSelected
                        ]}
                        onPress={() => handleSelectMesa(mesa)}
                      >
                        <MaterialCommunityIcons 
                          name="table-picnic" 
                          size={32} 
                          color={theme.colors.text.white} 
                        />
                        <Text style={styles.mesaCardTextModal}>
                          {mesa.nummesa}
                        </Text>
                        <Text style={styles.mesaCardAreaModal}>{mesaArea}</Text>
                        <Text style={styles.mesaCardEstadoModal}>{estado}</Text>
                        {isSelected && (
                          <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.text.white} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Platos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalPlatosVisible}
        onRequestClose={() => {
          setModalPlatosVisible(false);
          setTipoPlatoFiltro(null);
          setCategoriaFiltro(null);
          setSearchPlato("");
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menú</Text>
              <TouchableOpacity onPress={() => {
                setModalPlatosVisible(false);
                setTipoPlatoFiltro(null);
                setCategoriaFiltro(null);
                setSearchPlato("");
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {!tipoPlatoFiltro ? (
              <View style={styles.tipoSelectorContainer}>
                <Text style={styles.tipoSelectorTitle}>Selecciona el tipo de menú</Text>
                <View style={styles.tipoButtonsContainer}>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => setTipoPlatoFiltro("platos-desayuno")}
                  >
                    <MaterialCommunityIcons name="coffee" size={48} color={theme.colors.text.white} />
                    <Text style={styles.tipoButtonText}>DESAYUNO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => setTipoPlatoFiltro("plato-carta normal")}
                  >
                    <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.colors.text.white} />
                    <Text style={styles.tipoButtonText}>CARTA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.changeTipoButton}
                  onPress={() => {
                    setTipoPlatoFiltro(null);
                    setCategoriaFiltro(null);
                    setSearchPlato("");
                  }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text.white} />
                  <Text style={styles.changeTipoButtonText}>
                    {tipoPlatoFiltro === "platos-desayuno" ? "Desayuno" : "Carta Normal"}
                  </Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar plato..."
                  placeholderTextColor={theme.colors.text.light}
                  value={searchPlato}
                  onChangeText={setSearchPlato}
                />
                
                <ScrollView horizontal style={styles.categoriasContainer} showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.categoriaChip, !categoriaFiltro && styles.categoriaChipActive]}
                    onPress={() => setCategoriaFiltro(null)}
                  >
                    <Text style={[styles.categoriaChipText, !categoriaFiltro && styles.categoriaChipTextActive]}>Todos</Text>
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

                <ScrollView style={styles.modalScrollView}>
                  {platosFiltrados.length === 0 ? (
                    <View style={styles.emptyPlatosContainer}>
                      <Text style={styles.emptyPlatosText}>
                        No hay platos disponibles
                      </Text>
                    </View>
                  ) : (
                    platosFiltrados.map((plato) => {
                      const cantidad = cantidades[plato._id] || 0;
                      return (
                        <View key={plato._id} style={styles.platoModalItem}>
                          <View style={styles.platoModalInfo}>
                            <Text style={styles.platoModalNombre}>{plato.nombre}</Text>
                            <Text style={styles.platoModalPrecio}>S/. {plato.precio.toFixed(2)}</Text>
                          </View>
                          <View style={styles.platoModalActions}>
                            <TouchableOpacity
                              style={styles.cantidadButtonSmall}
                              onPress={() => {
                                if (cantidad > 0) {
                                  handleUpdateCantidad(plato._id, -1);
                                }
                              }}
                            >
                              <MaterialCommunityIcons name="minus" size={14} color={theme.colors.text.white} />
                            </TouchableOpacity>
                            <Text style={styles.cantidadTextSmall}>{cantidad || 0}</Text>
                            <TouchableOpacity
                              style={styles.cantidadButtonSmall}
                              onPress={() => handleUpdateCantidad(plato._id, 1)}
                            >
                              <MaterialCommunityIcons name="plus" size={14} color={theme.colors.text.white} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.addPlatoButton}
                              onPress={() => {
                                handleAddPlato(plato);
                                Alert.alert("✅", `${plato.nombre} agregado`);
                              }}
                            >
                              <Text style={styles.addPlatoButtonText}>Agregar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Overlay de Carga Animado */}
      {mostrarOverlayCarga && (
        <AnimatedOverlay mensaje={mensajeCarga} />
      )}
    </SafeAreaView>
  );
};

const OrdenesScreenStyles = (theme, orientation) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContentLandscape: {
    paddingBottom: 0,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: orientation.isLandscape ? theme.spacing.md : theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    ...theme.shadows.medium,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.white,
    letterSpacing: 0.5,
  },
  section: {
    padding: orientation.isLandscape ? theme.spacing.md : theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionLandscape: {
    borderBottomWidth: 0,
    marginBottom: theme.spacing.sm,
  },
  horizontalLayout: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: "700",
  },
  mesaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  mesaCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  mesaCardText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontWeight: "500",
  },
  mesaCardTextSelected: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.text.light,
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
    fontSize: 14,
  },
  platoItem: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  platoInfo: {
    marginBottom: theme.spacing.sm,
  },
  platoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  platoDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  platoCantidad: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  platoPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoActions: {
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
  cantidadButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  cantidadTextSmall: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
    color: theme.colors.text.primary,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  observacionesInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalSection: {
    backgroundColor: theme.colors.primary,
    padding: orientation.isLandscape ? theme.spacing.md : theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: orientation.isLandscape ? 0 : theme.spacing.lg,
    marginVertical: orientation.isLandscape ? 0 : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  totalSectionLandscape: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 100,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  totalText: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  buttonsContainer: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  addButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: "90%",
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
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  mesaCardModal: {
    width: orientation.isLandscape ? "18%" : "30%",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.colors.surface,
    minHeight: orientation.isLandscape ? 90 : 100,
    ...theme.shadows.medium,
  },
  mesaCardSelected: {
    borderColor: theme.colors.text.white,
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  mesaCardTextModal: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginTop: theme.spacing.xs,
  },
  mesaCardEstadoModal: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.text.white,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },
  mesaCardAreaModal: {
    fontSize: 9,
    fontWeight: "500",
    color: theme.colors.text.white,
    marginTop: 2,
    opacity: 0.8,
  },
  modalAreaFilterContainer: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalAreaFilterScroll: {
    maxHeight: 50,
  },
  modalAreaFilterContent: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  modalAreaFilterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 70,
  },
  modalAreaFilterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalAreaFilterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
  modalAreaFilterButtonTextActive: {
    color: theme.colors.text.white,
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
  platoModalItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  platoModalInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  platoModalNombre: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoModalPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  addPlatoButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addPlatoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 12,
  },
  tipoSelectorContainer: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  tipoSelectorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: theme.spacing.xl,
    color: theme.colors.text.primary,
    textAlign: "center",
  },
  tipoButtonsContainer: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    width: "100%",
  },
  tipoButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    ...theme.shadows.medium,
  },
  tipoButtonText: {
    color: theme.colors.text.white,
    fontSize: 16,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  changeTipoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.warning,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  changeTipoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
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
});

export default OrdenesScreen;

