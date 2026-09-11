import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { getFallbackApiBase } from "../../../config/envDefaults";
import { useTheme } from "../../../context/ThemeContext";
import { useBotonCantidadPlato } from "../../../context/BotonCantidadPlatoContext";
import { useBotonesMenuOrden } from "../../../context/BotonesMenuOrdenContext";
import { useDensidadOrdenes } from "../../../context/DensidadOrdenesContext";
import { useOrdenesAcciones } from "../../../context/OrdenesAccionesContext";
import { lerpDensidad, COMPACTO_DEFAULT } from "../../../utils/densidadOrdenes";
import { resolverSlugMenuPorHora } from "../../../utils/horaTipoMenu";
import { clampAccionesEscala, ACCIONES_ESCALA_DEFAULT } from "../../../utils/ordenesAccionesPrefs";
import { themeLight } from "../../../constants/theme";
import { useOrientation } from "../../../hooks/useOrientation";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import moment from "moment-timezone";
import debounce from "lodash.debounce";
import * as Haptics from "expo-haptics";
// Componente de modal de complementos
import ModalComplementos from "../../../Components/ModalComplementos";
import MenuPlatosSheet from "../../../Components/MenuPlatosSheet";
import BotonEnviarOrden from "../../../Components/BotonEnviarOrden";
import { resolverPlatoConGrupos, guarnicionesElegidas, cantidadGuarnicionEfectiva, mismasGuarniciones, preseleccionComplementosDePlato, platoEditableEnOrdenes, resolverPartesComplementos } from "../../../utils/platoGuarniciones";
import { hidratarUnidadesDesdeLineas, cantidadDeLinea } from "../../../utils/unidadesComplemento";
import { platoRequiereNumeroSerie, numeroSerieEsValido, normalizarNumeroSerie } from "../../../utils/numeroSeriePlato";
import { mismaVariantePlato, esSeleccionVariantePlato, nombreVisibleConVariante } from "../../../utils/variantePlato";
import { platoRequiereModalAlSumar, platoRequiereModalOp, ultimaLineaDelPlato, lineasDelPlatoEnCarrito, platoCoincideBusqueda, ordenarPlatosPorCodigoBusqueda, expandirFilasBuscadorPlatos, categoriasDePlato, platoEsDeCategoria } from "../../../utils/platoBuscador";
import { ordenarCategoriasMozo, ordenarPlatosPorCategoriaYCodigo, platoVisibleEnCarta, cmpPlatosCategoriaYCodigo } from "../../../utils/ordenCategoriaMozo";
import { calcularPrecioUnitarioConComplementos, textoOpcionComplemento, camposSnapshotComplemento } from "../../../utils/precioComplementos";
// Hook catálogo de tipos de plato (dinámico desde backend)
import useTiposPlato from "../../../hooks/useTiposPlato";
import configuracionService from "../../../services/configuracionService";
import { reservaEsDeMozo, estadoMesaConfirmadoTrasCrearComanda, estadoMesaLocalTrasCrearComanda } from "../../../utils/reservasMozo";
import { colorEstadoMesa, etiquetaEstadoMesa } from "../../../utils/estadoMesaMozo";
import { avisarPlatoAgregado } from "../../../utils/avisoPlatoAgregado";
import { slugTipoPedido, mismoTipoPedido } from "../../../utils/tipoPedidoLinea";
import { esSeleccionSinMesa, SELECCION_SIN_MESA, COLOR_PARA_LLEVAR } from "../../../utils/sinMesaOrden";
import { esLlevarColor, etiquetaLlevarMozo, TIPO_EXTRA_LLEVAR, TIPO_PARA_LLEVAR, TIPO_MESA } from "../../../utils/tipoServicio";
import {
  CAT_FAVORITOS,
  loadFavoritosLocal,
  saveFavoritosLocal,
  normalizeFavoritoIds,
} from "../../../helpers/platosFavoritosMozo";
// Animaciones Premium 60fps
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

// Map slug -> MaterialCommunityIcons name (fallback por si el catálogo no trae icono)
function _iconForTipo(slug) {
  if (!slug) return null;
  if (slug === 'platos-desayuno') return 'coffee';
  if (slug === 'plato-carta normal' || slug === 'carta-normal') return 'silverware-fork-knife';
  if (slug === 'platos-cena') return 'moon-waning-crescent';
  if (slug === 'platos-almuerzo') return 'food-apple';
  if (slug === 'platos-bar') return 'glass-cocktail';
  return null;
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
    <Modal visible transparent animationType="fade" statusBarTranslucent>
    <Animated.View style={[{
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
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
    </Modal>
  );
};

const TIPO_SERVICIO_ORDENES_KEY = "tipoServicioOrdenes";

const persistTipoServicioOrdenes = (tipo) => {
  const v = tipo === "para_llevar" ? "para_llevar" : "mesa";
  AsyncStorage.setItem(TIPO_SERVICIO_ORDENES_KEY, v).catch(() => {});
  return v;
};

const irAComandaDetalleTrasEnvio = (navigation, { comanda, mesa, reserva, estadoMesa, agruparConMesa }) => {
  if (esSeleccionSinMesa(mesa) || !mesa?._id) {
    navigation.navigate("Pendientes");
    return;
  }
  const params = {
    mesa: { ...mesa, estado: estadoMesa || mesa.estado || "pedido" },
    ...(reserva ? { reserva } : {}),
  };
  // Extra llevar / nueva comanda desde Detalle: no reemplazar la lista con solo la nueva.
  if (!agruparConMesa && comanda?._id) {
    params.comandas = [comanda];
  }
  navigation.navigate("ComandaDetalle", params);
};

const OrdenesScreen = ({ route }) => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { estilo: estiloQty, iconSize: iconSizeQty } = useBotonCantidadPlato();
  const { cambiarVisible, estiloCambiar } = useBotonesMenuOrden();
  const { compacto } = useDensidadOrdenes();
  const {
    agregarColor,
    enviarColor: colorEnviarOrden,
    ubicacion: ubicacionAcciones,
    accionesEscala,
  } = useOrdenesAcciones();
  const orientation = useOrientation();
  const styles = OrdenesScreenStyles(theme, orientation, compacto, accionesEscala);
  const accionIconSize = Math.max(16, Math.round(24 * (clampAccionesEscala(accionesEscala) / 100)));
  
  // Obtener parámetros de navegación (mesa y reserva desde ComandaDetalle)
  const { mesa: mesaParam, reserva: reservaParam, modoExtraLlevar: modoExtraParam, origen: origenParam, abrirMenu: abrirMenuParam, tipoMenuHora: tipoMenuHoraParam } = route?.params || {};
  const modoExtraLlevar = modoExtraParam === true;
  const agruparConMesa = origenParam === 'ComandaDetalle' || modoExtraLlevar === true;
  
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
  const [categoriasInfo, setCategoriasInfo] = useState([]);
  const [favoritoIds, setFavoritoIds] = useState([]);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  // Catálogo dinámico de tipos de plato desde el backend
  const { tipos: tiposPlatoCatalogo, labelFor: labelForTipo, refresh: refreshTiposPlato } = useTiposPlato();
  // Tipo de servicio para los platos que se agreguen desde el modal de menú:
  // 'mesa' (default, Switch OFF) o 'para_llevar' (Switch ON).
  const [tipoServicioModal, setTipoServicioModal] = useState('mesa');
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [areas, setAreas] = useState([]);
  const [filtroAreaMesa, setFiltroAreaMesa] = useState("All"); // Filtro para el modal de mesas
  const [mostrarOverlayCarga, setMostrarOverlayCarga] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Creando comanda...");
  const [searchPlatoDebounced, setSearchPlatoDebounced] = useState("");
  const [reservaActiva, setReservaActiva] = useState(null); // Reserva activa para asociar a la comanda
  const [configMoneda, setConfigMoneda] = useState(null);

  // Estado para el modal de complementos
  const [platoParaComplementar, setPlatoParaComplementar] = useState(null); // Cuando no es null, el modal de complementos está abierto
  const [complementosInicialesModal, setComplementosInicialesModal] = useState(null);
  const [notaInicialModal, setNotaInicialModal] = useState("");
  const [editandoInstanceId, setEditandoInstanceId] = useState(null);
  const [focoComplementos, setFocoComplementos] = useState(null);
  const [ocultarSumarComplementos, setOcultarSumarComplementos] = useState(false);
  const [cantidadInicialModal, setCantidadInicialModal] = useState(1);
  const [unidadesInicialesModal, setUnidadesInicialesModal] = useState(null);
  const [editandoGrupoIds, setEditandoGrupoIds] = useState(null);
  const tipoServicioAlComplementarRef = useRef(null);
  const selectedPlatosRef = useRef([]);
  const cantidadesRef = useRef({});
  selectedPlatosRef.current = selectedPlatos;
  cantidadesRef.current = cantidades;
  // Overlay in-tree: complementos (Modal) se abre encima del menú sin cerrarlo
  const platosListScrollRef = useRef(null);
  const favoritosDirtyRef = useRef(false);
  const userInfoRef = useRef(null);

  // Debounce búsqueda 300ms para no re-filtrar en cada tecla
  const debouncedSetSearchRef = useRef(
    debounce((text) => setSearchPlatoDebounced(text), 300)
  ).current;
  useEffect(() => {
    debouncedSetSearchRef(searchPlato);
    return () => debouncedSetSearchRef.cancel?.();
  }, [searchPlato, debouncedSetSearchRef]);

  const persistFavoritosRemoteRef = useRef(
    debounce(async (mozoId, ids) => {
      if (!mozoId) return;
      try {
        const url = apiConfig.isConfigured
          ? `${apiConfig.getEndpoint("/mozos")}/${mozoId}`
          : `${getFallbackApiBase()}/mozos/${mozoId}`;
        await axios.put(url, { platosFavoritos: ids }, { timeout: 8000 });
        favoritosDirtyRef.current = false;
      } catch (e) {
        console.warn("No se pudieron guardar favoritos en el servidor:", e?.message);
      }
    }, 500)
  ).current;

  useEffect(() => {
    return () => persistFavoritosRemoteRef.cancel?.();
  }, [persistFavoritosRemoteRef]);

  useEffect(() => {
    userInfoRef.current = userInfo;
  }, [userInfo]);

  useEffect(() => {
    const mozoId = userInfo?._id;
    if (!mozoId) return;
    let cancelled = false;
    (async () => {
      const local = await loadFavoritosLocal(mozoId);
      if (!cancelled && local.length) setFavoritoIds(local);
      try {
        const url = apiConfig.isConfigured
          ? `${apiConfig.getEndpoint("/mozos")}/${mozoId}`
          : `${getFallbackApiBase()}/mozos/${mozoId}`;
        const res = await axios.get(url, { timeout: 8000 });
        const remoteRaw = res.data?.platosFavoritos;
        if (!cancelled && !favoritosDirtyRef.current && Array.isArray(remoteRaw)) {
          const remote = normalizeFavoritoIds(remoteRaw);
          setFavoritoIds(remote);
          saveFavoritosLocal(mozoId, remote);
        }
      } catch (_) {
        /* se queda la copia local */
      }
    })();
    return () => { cancelled = true; };
  }, [userInfo?._id]);

  const toggleFavorito = useCallback((plato) => {
    const id = String(plato?._id || "");
    if (!id) return;
    const mozoId = userInfoRef.current?._id;
    setFavoritoIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      favoritosDirtyRef.current = true;
      if (mozoId) {
        saveFavoritosLocal(mozoId, next);
        persistFavoritosRemoteRef(mozoId, next);
      }
      return next;
    });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  }, [persistFavoritosRemoteRef]);

  useEffect(() => {
    loadUserData();
    loadPlatosData();
    loadSelectedPlatos();
    obtenerAreas();
  }, []);

  // Manejar parámetros de navegación (mesa y reserva desde ComandaDetalle)
  useEffect(() => {
    if (mesaParam) {
      console.log("📋 Mesa recibida desde parámetros:", mesaParam);
      setSelectedMesa(mesaParam);
      // También guardar en AsyncStorage para persistencia
      AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaParam));
    }
    if (reservaParam) {
      console.log("📅 Reserva recibida desde parámetros:", reservaParam._id);
      setReservaActiva(reservaParam);
      AsyncStorage.setItem("reservaActiva", JSON.stringify(reservaParam));
    }
  }, [mesaParam, reservaParam]);

  useEffect(() => {
    if (!abrirMenuParam) return;
    let cancelled = false;
    (async () => {
      if (mesaParam) setSelectedMesa(mesaParam);
      loadPlatosData();
      let slug = tipoMenuHoraParam || null;
      if (!slug) {
        slug = await resolverSlugMenuPorHora(refreshTiposPlato, tiposPlatoCatalogo);
      }
      if (cancelled) return;
      setTipoPlatoFiltro(slug || null);
      setCategoriaFiltro(null);
      setSearchPlato("");
      if (esSeleccionSinMesa(mesaParam)) {
        setTipoServicioModal(persistTipoServicioOrdenes("para_llevar"));
      }
      setModalPlatosVisible(true);
      navigation.setParams({ abrirMenu: undefined, tipoMenuHora: undefined });
    })();
    return () => { cancelled = true; };
  }, [abrirMenuParam, mesaParam, tipoMenuHoraParam, navigation, refreshTiposPlato]);

  useEffect(() => {
    if (modoExtraLlevar) {
      setTipoServicioModal(TIPO_EXTRA_LLEVAR);
      setSelectedPlatos((prev) => prev.map((p) => ({ ...p, tipoServicio: TIPO_EXTRA_LLEVAR })));
      return;
    }
    setSelectedPlatos((prev) => {
      if (!prev.some((p) => p.tipoServicio === TIPO_EXTRA_LLEVAR)) return prev;
      return prev.map((p) => ({
        ...p,
        tipoServicio: p.tipoServicio === TIPO_EXTRA_LLEVAR ? TIPO_MESA : p.tipoServicio,
      }));
    });
    setTipoServicioModal((prev) => (prev === TIPO_EXTRA_LLEVAR ? TIPO_MESA : prev));
  }, [modoExtraLlevar]);

  // Recargar mesa y usuario cuando se enfoca la pantalla (por si viene desde InicioScreen con mesa seleccionada)
  useFocusEffect(
    useCallback(() => {
      loadMesaData();
      loadUserData(); // Recargar usuario para asegurar que esté actualizado
      
      // 🔥 CRÍTICO: Resetear estado de envío cuando la pantalla se enfoca
      // Esto previene que el botón quede en "Enviando..." si el usuario navega y vuelve
      setIsSendingComanda(false);
      setMostrarOverlayCarga(false);
      configuracionService.obtenerConfigMoneda(true).then(setConfigMoneda).catch(() => {});
    }, [])
  );

  useEffect(() => {
    configuracionService.obtenerConfigMoneda(true).then(setConfigMoneda).catch(() => {});
    return configuracionService.subscribeCambio(() => {
      configuracionService.obtenerConfigMoneda().then(setConfigMoneda).catch(() => {});
    });
  }, []);

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
      // Cargar reserva activa si existe
      const reservaData = await AsyncStorage.getItem("reservaActiva");
      if (reservaData) {
        const parsedReserva = JSON.parse(reservaData);
        setReservaActiva(parsedReserva);
        console.log("📅 Reserva activa cargada:", parsedReserva._id);
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
      try {
        const primary = apiConfig.isConfigured
          ? apiConfig.getEndpoint('/platos/categorias?ligero=1')
          : `${getFallbackApiBase()}/platos/categorias?ligero=1`;
        const catRes = await axios.get(primary, { timeout: 5000 });
        if (Array.isArray(catRes.data)) {
          setCategoriasInfo(catRes.data);
        } else {
          setCategoriasInfo([]);
        }
      } catch (e) {
        try {
          const fallback = apiConfig.isConfigured
            ? apiConfig.getEndpoint('/categorias-plato?ligero=1')
            : `${getFallbackApiBase()}/categorias-plato?ligero=1`;
          const catRes = await axios.get(fallback, { timeout: 5000 });
          setCategoriasInfo(Array.isArray(catRes.data) ? catRes.data : []);
        } catch (_) {
          setCategoriasInfo([]);
        }
      }
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
      const storedTipo = await AsyncStorage.getItem(TIPO_SERVICIO_ORDENES_KEY);
      if (storedTipo === "para_llevar" || storedTipo === "mesa") {
        setTipoServicioModal(storedTipo);
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
    } catch (error) {
      console.error("Error seleccionando mesa:", error);
    }
  };

  const handleSelectSinMesa = async () => {
    try {
      await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(SELECCION_SIN_MESA));
      setSelectedMesa(SELECCION_SIN_MESA);
      setTipoServicioModal(persistTipoServicioOrdenes("para_llevar"));
      setSelectedPlatos((prev) => prev.map((p) => ({ ...p, tipoServicio: "para_llevar" })));
      setModalMesasVisible(false);
    } catch (error) {
      console.error("Error seleccionando sin mesa:", error);
    }
  };

  const handleAddPlato = (plato, cantidadPlatos = 1) => {
    const n = Math.max(1, Math.min(99, Number(cantidadPlatos) || 1));
    if (!platoRequiereModalAlSumar(plato) && platoRequiereModalOp(plato)) {
      const ultima = ultimaLineaDelPlato(selectedPlatos, plato, tipoServicioMenuActual(), { exacto: true });
      if (ultima) {
        const id = ultima.instanceId || ultima._id;
        const current = cantidadDeLinea(ultima, cantidades);
        const newCant = Math.min(99, current + n);
        setCantidades({ ...cantidades, [id]: newCant });
        setSelectedPlatos(selectedPlatos.map((p) =>
          (p.instanceId || p._id) === id ? { ...p, cantidad: newCant } : p
        ));
        avisarPlatoAgregado(plato.nombreMostrado || plato.nombre, n);
        return;
      }
    }
    if (platoRequiereModalAlSumar(plato)) {
      setFocoComplementos(null);
      setOcultarSumarComplementos(false);
      setEditandoInstanceId(null);
      setEditandoGrupoIds(null);
      setUnidadesInicialesModal(null);
      tipoServicioAlComplementarRef.current = null;
      setComplementosInicialesModal(null);
      setNotaInicialModal("");
      setCantidadInicialModal(n);
      setPlatoParaComplementar(plato);
      return;
    }
    if (platoRequiereModalOp(plato)) {
      setFocoComplementos("anexarNombre");
      setOcultarSumarComplementos(true);
      setEditandoInstanceId(null);
      setEditandoGrupoIds(null);
      setUnidadesInicialesModal(null);
      tipoServicioAlComplementarRef.current = null;
      setComplementosInicialesModal(null);
      setNotaInicialModal("");
      setCantidadInicialModal(n);
      setPlatoParaComplementar(plato);
      return;
    }
    if (plato?.complementos?.length > 0) {
      const comps = preseleccionComplementosDePlato(plato);
      const afectan = plato.complementosAfectanPrecio !== false;
      const calc = calcularPrecioUnitarioConComplementos(
        plato.precio || 0,
        comps,
        { afectanPrecio: afectan }
      );
      agregarPlatoSinComplementos(plato, comps, "", calc.precioUnitario, calc.extraComplementos, n);
      return;
    }
    agregarPlatoSinComplementos(plato, [], "", null, null, n);
  };

  const handleAddPlatoFromMenu = (plato, cantidadPlatos = 1) => {
    handleAddPlato(plato, cantidadPlatos);
    if (!platoRequiereModalAlSumar(plato) && !platoRequiereModalOp(plato)) {
      avisarPlatoAgregado(plato.nombreMostrado || plato.nombre, Math.max(1, Number(cantidadPlatos) || 1));
    }
  };

  const tipoServicioMenuActual = () => {
    if (esSeleccionSinMesa(selectedMesa)) return TIPO_PARA_LLEVAR;
    if (modoExtraLlevar || tipoServicioModal === TIPO_EXTRA_LLEVAR) return TIPO_EXTRA_LLEVAR;
    if (tipoServicioModal === TIPO_PARA_LLEVAR) return TIPO_PARA_LLEVAR;
    return TIPO_MESA;
  };

  const handleDecrementPlatoFromMenu = (plato) => {
    const ultima = ultimaLineaDelPlato(selectedPlatos, plato, tipoServicioMenuActual(), { exacto: true });
    if (!ultima) return;
    const instanceId = ultima.instanceId || ultima._id;
    const currentCant = cantidades[instanceId] || ultima.cantidad || 1;
    if (currentCant > 1) {
      const newCant = currentCant - 1;
      setCantidades({ ...cantidades, [instanceId]: newCant });
      setSelectedPlatos(selectedPlatos.map((p) =>
        (p.instanceId || p._id) === instanceId ? { ...p, cantidad: newCant } : p
      ));
    } else {
      handleRemovePlato(instanceId);
    }
  };

  const abrirFocoDesdeBuscador = (plato, focoModo) => {
    const lineas = lineasDelPlatoEnCarrito(selectedPlatos, plato, tipoServicioMenuActual(), { exacto: true });
    if (!lineas.length && (platoRequiereModalAlSumar(plato) || platoRequiereModalOp(plato))) {
      handleAddPlato(plato);
      return;
    }
    setFocoComplementos(focoModo);
    setOcultarSumarComplementos(true);
    if (lineas.length) {
      const ids = lineas.map((p) => p.instanceId || p._id);
      const resuelto = resolverPlatoConGrupos(lineas[0], platos);
      const seed = hidratarUnidadesDesdeLineas(resuelto || lineas[0], lineas, cantidades);
      setEditandoInstanceId(ids[0]);
      setEditandoGrupoIds(ids);
      setUnidadesInicialesModal(seed);
      setCantidadInicialModal(Math.max(1, seed.length));
      abrirModalGuarniciones(lineas[0], {
        iniciales: guarnicionesElegidas(lineas[0]),
        nota: lineas[0].notaEspecial || "",
        tipoServicio: lineas[0].tipoServicio,
      });
      return;
    }
    setEditandoInstanceId(null);
    setEditandoGrupoIds(null);
    setUnidadesInicialesModal(null);
    tipoServicioAlComplementarRef.current = null;
    setComplementosInicialesModal(null);
    setNotaInicialModal("");
    setCantidadInicialModal(1);
    setPlatoParaComplementar(plato);
  };

  const cerrarModalComplementosYReabrirMenu = () => {
    setPlatoParaComplementar(null);
    setComplementosInicialesModal(null);
    setUnidadesInicialesModal(null);
    setNotaInicialModal("");
    setEditandoInstanceId(null);
    setEditandoGrupoIds(null);
    setFocoComplementos(null);
    setOcultarSumarComplementos(false);
    setCantidadInicialModal(1);
    tipoServicioAlComplementarRef.current = null;
  };

  const abrirModalGuarniciones = (platoLinea, { iniciales = null, nota = "", tipoServicio = null } = {}) => {
    const resuelto = resolverPlatoConGrupos(platoLinea, platos);
    if (!resuelto?.complementos?.length && !platoRequiereNumeroSerie(resuelto || platoLinea)) {
      Alert.alert(
        "Guarniciones",
        "No se pueden cargar las guarniciones de este combo. Agrégalo otra vez desde el menú."
      );
      return;
    }
    tipoServicioAlComplementarRef.current = tipoServicio || null;
    setComplementosInicialesModal(Array.isArray(iniciales) ? iniciales : null);
    setNotaInicialModal(nota || "");
    setPlatoParaComplementar({
      ...resuelto,
      numeroSerie: platoLinea.numeroSerie || resuelto.numeroSerie || "",
    });
  };

  const cerrarModalPlatos = useCallback(() => {
    setModalPlatosVisible(false);
    setTipoPlatoFiltro(null);
    setCategoriaFiltro(null);
    setSearchPlato("");
  }, []);

  // Función para agregar un plato sin complementos (comportamiento original)
  const agregarPlatoSinComplementos = (plato, complementosSeleccionados = [], notaEspecial = "", precioUnitarioV3 = null, extraComplementosV3 = null, cantidadPlatos = 1, tipoServicioOverride = null, metaVariante = null) => {
    const n = Math.max(1, Math.min(99, Number(cantidadPlatos) || 1));
    const tipoServicio = esSeleccionSinMesa(selectedMesa)
      ? TIPO_PARA_LLEVAR
      : (tipoServicioOverride
        || (modoExtraLlevar || tipoServicioModal === TIPO_EXTRA_LLEVAR
          ? TIPO_EXTRA_LLEVAR
          : (tipoServicioModal === TIPO_PARA_LLEVAR ? TIPO_PARA_LLEVAR : TIPO_MESA)));
    const instanceId = `${plato._id}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const complementosNormalizados = complementosSeleccionados.map(camposSnapshotComplemento);

    const platoConComplementos = {
      ...plato,
      instanceId,
      cantidad: n,
      complementosElegidos: complementosNormalizados,
      notaEspecial: notaEspecial,
      tipoServicio,
      tipoPedido: slugTipoPedido(tipoPlatoFiltro),
      ...(precioUnitarioV3 != null ? { precioUnitario: Number(precioUnitarioV3) } : {}),
      ...(extraComplementosV3 != null ? { extraComplementos: Number(extraComplementosV3) } : {}),
      ...(metaVariante?.nombreCocinaPedido ? { nombreCocinaPedido: metaVariante.nombreCocinaPedido } : {}),
      ...(metaVariante?.variantePlato ? { variantePlato: metaVariante.variantePlato } : {}),
      ...(metaVariante?.numeroSerie || plato.numeroSerie
        ? { numeroSerie: normalizarNumeroSerie(metaVariante?.numeroSerie || plato.numeroSerie) }
        : {}),
    };

    const coincideLinea = (p) => {
      if (p._id !== plato._id) return false;
      const pTipo = p.tipoServicio || 'mesa';
      if (pTipo !== tipoServicio) return false;
      if (!mismoTipoPedido(p.tipoPedido, tipoPlatoFiltro)) return false;
      if (!mismaVariantePlato(p, metaVariante || {})) return false;
      const serieA = normalizarNumeroSerie(p.numeroSerie);
      const serieB = normalizarNumeroSerie(metaVariante?.numeroSerie || '');
      if (serieA !== serieB) return false;
      const pComps = p.complementosElegidos || [];
      const newComps = complementosNormalizados || [];
      const pNota = (p.notaEspecial || "").trim();
      const newNota = notaEspecial.trim();
      if (pComps.length === 0 && newComps.length === 0 && pNota === newNota) return true;
      if (pComps.length !== newComps.length) return false;
      if (pNota !== newNota) return false;
      return mismasGuarniciones(pComps, newComps);
    };

    const prevPlatos = selectedPlatosRef.current;
    const prevCant = cantidadesRef.current;
    const existsWithSameComplements = prevPlatos.find(coincideLinea);

    let nextPlatos;
    let nextCant;
    if (existsWithSameComplements) {
      const id = existsWithSameComplements.instanceId || existsWithSameComplements._id;
      const newCant = Math.min(99, (prevCant[id] || existsWithSameComplements.cantidad || 1) + n);
      nextCant = { ...prevCant, [id]: newCant };
      nextPlatos = prevPlatos.map((p) =>
        (p.instanceId || p._id) === id ? { ...p, cantidad: newCant } : p
      );
    } else {
      nextPlatos = [...prevPlatos, platoConComplementos];
      nextCant = { ...prevCant, [instanceId]: n };
    }
    selectedPlatosRef.current = nextPlatos;
    cantidadesRef.current = nextCant;
    setSelectedPlatos(nextPlatos);
    setCantidades(nextCant);
  };

  const handleEditarGuarnicionesLinea = (platoLinea) => {
    const resuelto = resolverPlatoConGrupos(platoLinea, platos);
    if (!resuelto?.complementos?.length && !platoRequiereNumeroSerie(resuelto || platoLinea)) {
      Alert.alert(
        "Guarniciones",
        "No se pueden cargar las guarniciones de este combo. Agrégalo otra vez desde el menú."
      );
      return;
    }
    const id = platoLinea.instanceId || platoLinea._id;
    const n = cantidadDeLinea(platoLinea, cantidades);
    const seed = hidratarUnidadesDesdeLineas(resuelto || platoLinea, [platoLinea], cantidades);
    setFocoComplementos(null);
    setOcultarSumarComplementos(false);
    setEditandoInstanceId(id);
    setEditandoGrupoIds([id]);
    setUnidadesInicialesModal(seed);
    setCantidadInicialModal(n);
    abrirModalGuarniciones(platoLinea, {
      iniciales: platoLinea.complementosElegidos || [],
      nota: platoLinea.notaEspecial || "",
      tipoServicio: platoLinea.tipoServicio,
    });
  };

  const handleConfirmarComplementos = ({ complementosSeleccionados, notaEspecial, numeroSerie, _cantidadPlatos, _partes }) => {
    if (editandoInstanceId) {
      const linea = selectedPlatosRef.current.find(
        (p) => (p.instanceId || p._id) === editandoInstanceId
      );
      if (linea) {
        const n = Math.max(
          1,
          Math.min(
            99,
            Number(_cantidadPlatos)
              || cantidadesRef.current[editandoInstanceId]
              || linea.cantidad
              || 1
          )
        );
        const partes = resolverPartesComplementos(linea, complementosSeleccionados, n, _partes);
        const parte0 = partes[0] || { complementos: complementosSeleccionados, cantidad: n };
        const afectan = linea.complementosAfectanPrecio !== false;
        const calc0 = calcularPrecioUnitarioConComplementos(
          linea.precio || 0,
          parte0.complementos,
          { afectanPrecio: afectan }
        );
        const comps0 = (parte0.complementos || []).map(camposSnapshotComplemento);
        const serie = normalizarNumeroSerie(numeroSerie || linea.numeroSerie);
        const cant0 = Math.max(1, Number(parte0.cantidad) || 1);
        const idsGrupo = (editandoGrupoIds?.length ? editandoGrupoIds : [editandoInstanceId]).map(String);
        const idKeep = String(editandoInstanceId);
        const nextCant = { ...cantidadesRef.current };
        const nextPlatos = selectedPlatosRef.current.filter((p) => {
          const id = String(p.instanceId || p._id);
          if (idsGrupo.includes(id) && id !== idKeep) {
            delete nextCant[id];
            return false;
          }
          return true;
        }).map((p) => {
          if ((p.instanceId || p._id) !== editandoInstanceId) return p;
          return {
            ...p,
            cantidad: cant0,
            complementosElegidos: comps0,
            notaEspecial: notaEspecial || "",
            ...(calc0.precioUnitario != null ? { precioUnitario: Number(calc0.precioUnitario) } : {}),
            ...(calc0.extraComplementos != null ? { extraComplementos: Number(calc0.extraComplementos) } : {}),
            ...(parte0.nombreCocinaPedido ? { nombreCocinaPedido: parte0.nombreCocinaPedido } : {}),
            ...(parte0.variantePlato ? { variantePlato: parte0.variantePlato } : {}),
            ...(serie ? { numeroSerie: serie } : {}),
          };
        });
        selectedPlatosRef.current = nextPlatos;
        nextCant[editandoInstanceId] = cant0;
        cantidadesRef.current = nextCant;
        setSelectedPlatos(nextPlatos);
        setCantidades(cantidadesRef.current);
        partes.slice(1).forEach((parte) => {
          const calc = calcularPrecioUnitarioConComplementos(
            linea.precio || 0,
            parte.complementos,
            { afectanPrecio: afectan }
          );
          agregarPlatoSinComplementos(
            linea,
            parte.complementos,
            notaEspecial,
            calc.precioUnitario,
            calc.extraComplementos,
            parte.cantidad,
            linea.tipoServicio,
            {
              nombreCocinaPedido: parte.nombreCocinaPedido,
              variantePlato: parte.variantePlato,
              ...(serie ? { numeroSerie: serie } : {}),
            }
          );
        });
      }
      cerrarModalComplementosYReabrirMenu();
      return;
    }
    if (platoParaComplementar) {
      const nombre = platoParaComplementar.nombre;
      const n = Math.max(1, Math.min(99, Number(_cantidadPlatos) || 1));
      const partes = resolverPartesComplementos(platoParaComplementar, complementosSeleccionados, n, _partes);
      const afectan = platoParaComplementar.complementosAfectanPrecio !== false;
      const serie = normalizarNumeroSerie(numeroSerie);
      let totalUnidades = 0;
      partes.forEach((parte) => {
        const calc = calcularPrecioUnitarioConComplementos(
          platoParaComplementar.precio || 0,
          parte.complementos,
          { afectanPrecio: afectan }
        );
        agregarPlatoSinComplementos(
          platoParaComplementar,
          parte.complementos,
          notaEspecial,
          calc.precioUnitario,
          calc.extraComplementos,
          parte.cantidad,
          tipoServicioAlComplementarRef.current,
          {
            nombreCocinaPedido: parte.nombreCocinaPedido,
            variantePlato: parte.variantePlato,
            ...(serie ? { numeroSerie: serie } : {}),
          }
        );
        totalUnidades += parte.cantidad;
      });
      avisarPlatoAgregado(nombre, totalUnidades || n);
      cerrarModalComplementosYReabrirMenu();
    }
  };

  const handleRemovePlato = (platoInstanceId) => {
    // Buscar por instanceId (que puede ser el _id o el instanceId generado)
    const newPlatos = selectedPlatos.filter(p => (p.instanceId || p._id) !== platoInstanceId);
    setSelectedPlatos(newPlatos);
    const newCantidades = { ...cantidades };
    delete newCantidades[platoInstanceId];
    setCantidades(newCantidades);
  };

  const handleClearAllPlatos = () => {
    if (selectedPlatos.length === 0) return;
    Alert.alert(
      "Borrar todos los platos",
      "Se quitarán todos los platos de esta orden.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => {
            setSelectedPlatos([]);
            setCantidades({});
          },
        },
      ]
    );
  };

  const aplicarTipoServicioCarrito = (tipo) => {
    const next = tipo === TIPO_PARA_LLEVAR ? TIPO_PARA_LLEVAR : TIPO_MESA;
    persistTipoServicioOrdenes(next);
    setTipoServicioModal(next);
    setSelectedPlatos((prev) => prev.map((p) => ({ ...p, tipoServicio: next })));
  };

  const handleToggleTipoServicio = () => {
    if (esSeleccionSinMesa(selectedMesa) || modoExtraLlevar) return;
    const nextTipo = tipoServicioModal === TIPO_PARA_LLEVAR ? TIPO_MESA : TIPO_PARA_LLEVAR;
    aplicarTipoServicioCarrito(nextTipo);
  };

  const handleUpdateCantidad = (platoInstanceId, delta) => {
    const linea = selectedPlatos.find((p) => (p.instanceId || p._id) === platoInstanceId);
    if (!linea) return;

    const current = cantidades[platoInstanceId] || 1;
    const newCant = Math.max(1, current + delta);
    setCantidades({ ...cantidades, [platoInstanceId]: newCant });
    setSelectedPlatos(selectedPlatos.map((p) =>
      (p.instanceId || p._id) === platoInstanceId ? { ...p, cantidad: newCant } : p
    ));
  };

  const handleClonarPlato = (platoLinea) => {
    if (!platoRequiereModalAlSumar(platoLinea, platos)) {
      const id = platoLinea.instanceId || platoLinea._id;
      const current = cantidades[id] || 1;
      const newCant = current + 1;
      setCantidades({ ...cantidades, [id]: newCant });
      setSelectedPlatos(selectedPlatos.map((p) =>
        (p.instanceId || p._id) === id ? { ...p, cantidad: newCant } : p
      ));
      return;
    }
    setFocoComplementos(null);
    setOcultarSumarComplementos(false);
    setEditandoInstanceId(null);
    abrirModalGuarniciones(platoLinea, {
      iniciales: guarnicionesElegidas(platoLinea),
      nota: platoLinea.notaEspecial || "",
      tipoServicio: platoLinea.tipoServicio || "mesa",
    });
  };

  const calcularSubtotal = () => {
    let total = 0;
    selectedPlatos.forEach(plato => {
      const cantidad = cantidades[plato.instanceId || plato._id] || 1;
      // v3.0: usar precioUnitario (base + extras) si está disponible
      const precio = plato.precioUnitario != null ? Number(plato.precioUnitario) : Number(plato.precio || 0);
      total += precio * cantidad;
    });
    return total;
  };

  const subtotalPlatos = useMemo(() => calcularSubtotal(), [selectedPlatos, cantidades]);
  const totalesOrden = useMemo(
    () => configuracionService.calcularTotales(subtotalPlatos, configMoneda),
    [subtotalPlatos, configMoneda]
  );
  const simboloOrden = configMoneda?.simboloMoneda || 'S/.';
  const decimalesOrden = configMoneda?.decimales ?? 2;
  const igvPctOrden = configMoneda?.igvPorcentaje ?? 18;
  const nombreImpuestoOrden = configMoneda?.nombreImpuestoPrincipal || 'IGV';

  const renderTotalesOrden = (landscape) => (
    <View style={[styles.totalSection, landscape && styles.totalSectionLandscape]}>
      <View style={styles.totalBreakdown}>
        <View style={styles.totalBreakdownRow}>
          <Text style={styles.totalBreakdownLabel}>Subtotal</Text>
          <Text style={styles.totalBreakdownValue}>
            {simboloOrden} {Number(totalesOrden.subtotalSinIGV || 0).toFixed(decimalesOrden)}
          </Text>
        </View>
        <View style={styles.totalBreakdownRow}>
          <Text style={styles.totalBreakdownLabel}>{nombreImpuestoOrden} ({igvPctOrden}%)</Text>
          <Text style={styles.totalBreakdownValue}>
            {simboloOrden} {Number(totalesOrden.igv || 0).toFixed(decimalesOrden)}
          </Text>
        </View>
        <View style={styles.totalBreakdownRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalText}>
            {simboloOrden} {Number(totalesOrden.total || 0).toFixed(decimalesOrden)}
          </Text>
        </View>
      </View>
    </View>
  );

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
        
        const coincideMesa = mesaId
          ? comandaMesaId === mesaId?.toString()
          : !c.mesas;
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
    const esSinMesaOrden = esSeleccionSinMesa(selectedMesa);
    let mesaActualizada = selectedMesa;
    const platosEnvio = selectedPlatosRef.current;
    const cantidadesEnvio = cantidadesRef.current;
    try {
  setIsSendingComanda(true);

      if (!userInfo || !userInfo._id) {
        Alert.alert("Error", "No hay usuario logueado");
        setIsSendingComanda(false);
        return;
      }

      if (!esSinMesaOrden && (!selectedMesa || !selectedMesa._id)) {
        Alert.alert("Error", "Por favor selecciona una mesa o Sin mesa");
        setIsSendingComanda(false);
        return;
      }

      if (platosEnvio.length === 0) {
        Alert.alert("Error", "Agrega al menos un plato");
        setIsSendingComanda(false);
        return;
      }

      // IMPORTANTE: Obtener el estado actualizado de la mesa desde el servidor
      // para evitar problemas cuando se elimina una comanda y la mesa cambia a "libre"
      if (!esSinMesaOrden) {
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
      }
      
      // Validar estado de la mesa antes de crear la comanda (usando estado actualizado)
      if (!esSinMesaOrden) {
      const estadoMesa = (mesaActualizada.estado || 'libre').toLowerCase();
      
      // Si la mesa NO está libre, verificar que sea el mismo mozo que creó la comanda
      if (estadoMesa !== 'libre') {
        // Si la mesa está reservada, verificar si hay reserva activa y si el mozo está autorizado
        if (estadoMesa === 'reservado') {
          // Verificar si hay una reserva activa y si el mozo actual está autorizado
          try {
            const reservaURL = apiConfig.isConfigured 
              ? apiConfig.getEndpoint(`/reservas/mesa/${mesaActualizada._id}/activa`)
              : `${getFallbackApiBase()}/reservas/mesa/${mesaActualizada._id}/activa`;
            
            const reservaResponse = await axios.get(reservaURL, {
              timeout: 5000,
              params: userInfo._id ? { mozoId: userInfo._id } : undefined,
            });
            
            if (reservaResponse.data.tieneReservaActiva && reservaResponse.data.reserva) {
              const reserva = reservaResponse.data.reserva;
              const mozoActualId = userInfo._id;
              
              if (mozoActualId && !reservaEsDeMozo(reserva, mozoActualId)) {
                Alert.alert(
                  "Acceso Denegado",
                  `Esta mesa está reservada. Solo el mozo asignado puede atenderla.`,
                  [{ text: "OK" }]
                );
                setIsSendingComanda(false);
                return;
              }
              
              // Mozo autorizado o sin mozo asignado: permitir crear comanda
              console.log(`✅ Mozo autorizado para mesa reservada ${mesaActualizada.nummesa}`);
              // Guardar referencia a la reserva para asociarla a la comanda
              if (!reservaActiva) {
                setReservaActiva(reserva);
              }
              // IMPORTANTE: Continuar directamente a crear la comanda sin verificar comandas existentes
              // porque una mesa reservada puede no tener comandas previas y el mozo está autorizado
            } else {
              // No hay reserva activa, pero la mesa está en estado reservado
              // Permitir crear comanda (el backend corregirá el estado)
              console.log(`⚠️ Mesa ${mesaActualizada.nummesa} en estado 'reservado' sin reserva activa. Permitiendo crear comanda.`);
            }
          } catch (error) {
            console.error("Error al verificar reserva:", error);
            // Si hay error, permitir crear comanda (el backend validará)
            console.log(`⚠️ Error al verificar reserva, permitiendo crear comanda.`);
          }
          // IMPORTANTE: Saltar la validación de comandas existentes para mesas reservadas
          // El backend ya validará la autorización del mozo
        } else if (estadoMesa !== 'libre') {
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
              if (estadoMesa === 'preparado' || estadoMesa === 'entregado') {
                console.log(`✅ Creando nueva comanda en mesa ${mesaActualizada.nummesa} (estado: ${estadoMesa}) - Mismo mozo`);
              }
            } else {
              // Si no hay comandas activas pero la mesa está en "preparado", permitir crear comanda
              // (puede ser un estado inconsistente o la comanda ya fue pagada)
              if (estadoMesa === 'preparado' || estadoMesa === 'entregado' || estadoMesa === 'pagado' || estadoMesa === 'pedido') {
                console.log(`✅ Creando nueva comanda en mesa ${mesaActualizada.nummesa} (estado: ${estadoMesa}) - Sin comandas activas`);
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
              if (estadoMesa === 'preparado' || estadoMesa === 'entregado' || estadoMesa === 'pagado') {
                console.log(`⚠️ [ORDENES] Error de red, pero permitiendo crear comanda en mesa ${mesaActualizada.nummesa} (estado: ${estadoMesa})`);
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
      }
      }

      const tipoServicioEnvio = esSinMesaOrden
        ? TIPO_PARA_LLEVAR
        : (modoExtraLlevar || tipoServicioModal === TIPO_EXTRA_LLEVAR)
          ? TIPO_EXTRA_LLEVAR
          : (tipoServicioModal === TIPO_PARA_LLEVAR ? TIPO_PARA_LLEVAR : TIPO_MESA);

      const platosData = platosEnvio.map(plato => ({
        plato: plato._id,
        platoId: plato.id || null,
        estado: "pedido",
        tipoServicio: tipoServicioEnvio,
        tipoPedido: slugTipoPedido(plato.tipoPedido),
        complementosSeleccionados: plato.complementosElegidos || [],
        notaEspecial: plato.notaEspecial || "",
        nombreCocinaPedido: plato.nombreCocinaPedido || "",
        variantePlato: plato.variantePlato || undefined,
        ...(plato.numeroSerie ? { numeroSerie: normalizarNumeroSerie(plato.numeroSerie) } : {}),
      }));

      const cantidadesArray = platosEnvio.map(plato => cantidadesEnvio[plato.instanceId || plato._id] || 1);

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
        ...(esSinMesaOrden ? { sinMesa: true } : { mesas: mesaActualizada._id }),
        platos: platosData,
        cantidades: cantidadesArray,
        observaciones: observaciones || "",
        status: "en_espera",
        IsActive: true,
        ...(platosEnvio.map((p) => p.numeroSerie).find((s) => numeroSerieEsValido(s))
          ? { numeroSerie: normalizarNumeroSerie(platosEnvio.map((p) => p.numeroSerie).find((s) => numeroSerieEsValido(s))) }
          : {}),
        // Si hay reserva activa, incluirla
        ...(reservaActiva && { origenReserva: reservaActiva._id })
      };

      console.log("📤 Datos de comanda a enviar:", {
        mozos: comandaData.mozos,
        mesas: comandaData.mesas,
        numMesa: selectedMesa.nummesa,
        platosCount: comandaData.platos.length,
        origenReserva: comandaData.origenReserva || null
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
      
      // Verificar estado de mesa (pedido, o reservado si es extra sobre reserva)
      const esEnvioReserva = !!(reservaActiva || comandaData.origenReserva);
      let estadoLocal = estadoMesaLocalTrasCrearComanda(
        mesaActualizada?.estado,
        esEnvioReserva,
        mesaActualizada?.estado
      );
      if (!esSinMesaOrden && mesaActualizada?._id) {
      setMensajeCarga("Verificando estado de la mesa...");
      const mesaId = mesaActualizada._id;
      const mesaNum = mesaActualizada.nummesa;
      
      let mesaVerificada = false;
      let intentos = 0;
      const maxIntentos = 10; // Máximo 10 intentos (5 segundos)
      let estadoMesaServidor = mesaActualizada.estado;
      
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
            estadoMesaServidor = estadoMesaVerificado;
            console.log(`🔄 Intento ${intentos + 1}/${maxIntentos}: Mesa ${mesaNum} en estado "${estadoMesaVerificado}"`);
            
            if (estadoMesaConfirmadoTrasCrearComanda(estadoMesaVerificado, esEnvioReserva)) {
              mesaVerificada = true;
              console.log(`✅ Mesa ${mesaNum} confirmada en estado "${estadoMesaVerificado}"`);
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
      
      estadoLocal = estadoMesaLocalTrasCrearComanda(
        estadoMesaServidor,
        esEnvioReserva,
        mesaActualizada.estado
      );
      
      // Actualizar estado local de la mesa
      try {
        if (mesaActualizada) {
          const mesaActualizadaLocal = { ...mesaActualizada, estado: estadoLocal };
          setSelectedMesa(mesaActualizadaLocal);
        }
        
        setMesas(prev => {
          const index = prev.findIndex(m => m._id === mesaActualizada._id);
          if (index !== -1) {
            const nuevas = [...prev];
            nuevas[index] = { ...nuevas[index], estado: estadoLocal };
            return nuevas;
          }
          return prev;
        });
      } catch (error) {
        console.error("⚠️ Error actualizando estado local de mesa:", error);
      }
      }
      
      setMensajeCarga(`¡Comanda #${comandaNumber} enviada!`);

      const reservaParaNav = reservaActiva || reservaParam || null;
      const mesaParaNav = mesaActualizada
        ? { ...mesaActualizada, estado: estadoLocal }
        : mesaActualizada;
      const comandaParaNav = comandaCreada;
      const estadoParaNav = estadoLocal;
      
      // Limpiar datos locales
      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("reservaActiva"); // Limpiar reserva activa
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("selectedPlatesIds");
      await AsyncStorage.removeItem("cantidadesComanda");
      await AsyncStorage.removeItem("additionalDetails");
      
      setSelectedMesa(null);
      setReservaActiva(null); // Limpiar estado de reserva
      setSelectedPlatos([]);
      setCantidades({});
      setObservaciones("");
      
      // Esperar un momento antes de navegar para que el usuario vea el mensaje de éxito
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 🔥 CRÍTICO: Resetear estado ANTES de navegar
      setIsSendingComanda(false);
      setMostrarOverlayCarga(false);

      if (modoExtraLlevar) {
        navigation.setParams({ modoExtraLlevar: false });
      }
      irAComandaDetalleTrasEnvio(navigation, {
        comanda: comandaParaNav,
        mesa: mesaParaNav,
        reserva: reservaParaNav,
        estadoMesa: estadoParaNav,
        agruparConMesa,
      });
    } catch (error) {
      // 🔥 MEJORADO: Verificación exhaustiva antes de mostrar cualquier error
      console.warn("⚠️ Error capturado, verificando si comanda se creó:", error.message);
      
      // Última verificación: buscar comanda en backend
      setMensajeCarga("Verificando última vez...");
      const verificacionFinal = await verificarComandaEnBackend(
        mesaActualizada?._id,
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

        const reservaParaNav = reservaActiva || reservaParam || null;
        const estadoParaNav = estadoMesaLocalTrasCrearComanda(
          mesaActualizada?.estado,
          !!reservaParaNav,
          mesaActualizada?.estado
        );
        const mesaParaNav = mesaActualizada
          ? { ...mesaActualizada, estado: estadoParaNav }
          : mesaActualizada;
        const comandaParaNav = comandaCreada;
        
        // Limpiar datos locales
        await AsyncStorage.removeItem("mesaSeleccionada");
        await AsyncStorage.removeItem("reservaActiva"); // Limpiar reserva activa
        await AsyncStorage.removeItem("selectedPlates");
        await AsyncStorage.removeItem("selectedPlatesIds");
        await AsyncStorage.removeItem("cantidadesComanda");
        await AsyncStorage.removeItem("additionalDetails");
        
        setSelectedMesa(null);
        setReservaActiva(null); // Limpiar estado de reserva
        setSelectedPlatos([]);
        setCantidades({});
        setObservaciones("");
        
        // 🔥 CRÍTICO: Resetear estado ANTES de navegar
        setIsSendingComanda(false);
        setMostrarOverlayCarga(false);

        if (modoExtraLlevar) {
        navigation.setParams({ modoExtraLlevar: false });
      }
      irAComandaDetalleTrasEnvio(navigation, {
          comanda: comandaParaNav,
          mesa: mesaParaNav,
          reserva: reservaParaNav,
          estadoMesa: estadoParaNav,
          agruparConMesa,
        });
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

  // Devuelve true si el plato pertenece al tipo indicado, considerando
  // tanto el campo legacy `tipo` (string) como el array `tipos` (1 o más).
  const platoEsDeTipo = (p, slug) => {
    if (!slug) return true;
    const target = tipoNormalizado(slug);
    if (Array.isArray(p?.tipos) && p.tipos.length) {
      return p.tipos.some((t) => tipoNormalizado(t) === target);
    }
    return tipoNormalizado(p?.tipo) === target;
  };

  const categorias = useMemo(() => {
    if (!tipoPlatoFiltro) return [];
    const names = [...new Set(
      platos.filter((p) => platoEsDeTipo(p, tipoPlatoFiltro)).flatMap((p) => categoriasDePlato(p))
    )].filter(Boolean);
    return ordenarCategoriasMozo(names, categoriasInfo, tipoPlatoFiltro);
  }, [platos, tipoPlatoFiltro, categoriasInfo]);

  useEffect(() => {
    if (!categoriaFiltro || categoriaFiltro === CAT_FAVORITOS) return;
    if (!categorias.includes(categoriaFiltro)) setCategoriaFiltro(null);
  }, [categorias, categoriaFiltro]);

  // Platos disponibles (tipo + stock > 0)
  const platosPorTipoDisponibles = useMemo(
    () =>
      platos.filter((p) => {
        const matchTipo = !tipoPlatoFiltro || platoEsDeTipo(p, tipoPlatoFiltro);
        const disponible = (p.stock == null || p.stock === undefined || Number(p.stock) > 0);
        const visibleCarta = platoVisibleEnCarta(p, categoriasInfo, tipoPlatoFiltro);
        return matchTipo && disponible && visibleCarta;
      }),
    [platos, tipoPlatoFiltro, categoriasInfo]
  );

  // Búsqueda global: si hay texto, filtra por nombre en TODOS (ignora categoría). Si no hay texto, filtra por categoría.
  const platosFiltrados = useMemo(() => {
    const base = ordenarPlatosPorCategoriaYCodigo(platosPorTipoDisponibles, categoriasInfo, tipoPlatoFiltro);
    const search = (searchPlatoDebounced || "").trim();
    const conAlias = expandirFilasBuscadorPlatos(base);
    const cmpTie = (a, b) => cmpPlatosCategoriaYCodigo(a, b, categoriasInfo, tipoPlatoFiltro);
    if (search.length > 0) {
      const matched = conAlias.filter((p) => platoCoincideBusqueda(p, search));
      return ordenarPlatosPorCodigoBusqueda(matched, search, cmpTie);
    }
    if (!categoriaFiltro) return conAlias;
    if (categoriaFiltro === CAT_FAVORITOS) {
      return conAlias.filter((p) => favoritoIds.includes(String(p._id)));
    }
    return conAlias.filter((p) => platoEsDeCategoria(p, categoriaFiltro));
  }, [platosPorTipoDisponibles, searchPlatoDebounced, categoriaFiltro, favoritoIds, categoriasInfo, tipoPlatoFiltro]);

  // Al enfocar o escribir en búsqueda → categoría a "Todos" para búsqueda global
  const handleSearchFocus = useCallback(() => {
    setCategoriaFiltro(null);
  }, []);
  const handleSearchChangeText = useCallback((text) => {
    setSearchPlato(text);
    if ((text || "").trim().length > 0) setCategoriaFiltro(null);
  }, []);
  const handleClearSearch = useCallback(() => {
    setSearchPlato("");
    setSearchPlatoDebounced("");
  }, []);
  const handleCambiarPlato = useCallback((platoLinea) => {
    const instanceId = platoLinea?.instanceId || platoLinea?._id;
    if (instanceId) {
      setSelectedPlatos((prev) => prev.filter((p) => (p.instanceId || p._id) !== instanceId));
      setCantidades((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    }
    loadPlatosData();
    const catalogo = platos.find((p) => String(p._id) === String(platoLinea?._id));
    const slugLinea = slugTipoPedido(platoLinea?.tipoPedido);
    const slugCatalogo = (tiposPlatoCatalogo || []).find((t) => catalogo && platoEsDeTipo(catalogo, t.slug))?.slug;
    const slug = slugLinea
      || slugCatalogo
      || slugTipoPedido(catalogo?.tipo)
      || slugTipoPedido(catalogo?.tipos?.[0])
      || null;
    setTipoPlatoFiltro(slug);
    setCategoriaFiltro(null);
    setSearchPlato("");
    setSearchPlatoDebounced("");
    if (esSeleccionSinMesa(selectedMesa)) {
      setTipoServicioModal(persistTipoServicioOrdenes("para_llevar"));
    }
    setModalPlatosVisible(true);
  }, [platos, tiposPlatoCatalogo, selectedMesa]);
  // Al elegir categoría: si hay búsqueda activa, limpiar texto y aplicar categoría
  const handleCategorySelect = useCallback((cat) => {
    if ((searchPlato || "").trim().length > 0) {
      setSearchPlato("");
    }
    setCategoriaFiltro(cat === "Todos" || cat === null ? null : cat);
  }, [searchPlato]);

  const getCategoriaIcon = (categoria) => {
    if (categoria?.includes("Carnes") || categoria?.includes("CARNE")) return "🥩";
    if (categoria?.includes("Pescado") || categoria?.includes("PESCADO")) return "🐟";
    if (categoria?.includes("Entrada") || categoria?.includes("ENTRADA")) return "🥗";
    if (categoria?.includes("Bebida") || categoria?.includes("JUGOS") || categoria?.includes("Gaseosa")) return "🥤";
    return "🍽️";
  };

  const getEstadoColor = (estado) => colorEstadoMesa(estado, theme);

  const getMesaEstado = (mesa) => etiquetaEstadoMesa(mesa?.estado || "libre");

  const abrirMenuPlatos = async () => {
    loadPlatosData();
    const autoSlug = await resolverSlugMenuPorHora(refreshTiposPlato, tiposPlatoCatalogo);
    setTipoPlatoFiltro(autoSlug || null);
    setCategoriaFiltro(null);
    setSearchPlato("");
    if (esSeleccionSinMesa(selectedMesa)) {
      setTipoServicioModal(persistTipoServicioOrdenes("para_llevar"));
    }
    setModalPlatosVisible(true);
  };

  const botonesAccionOrden = (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: agregarColor }]}
        onPress={abrirMenuPlatos}
      >
        <MaterialCommunityIcons name="plus-circle" size={accionIconSize} color={theme.colors.text.white} />
        <Text style={styles.addButtonText}>Agregar Plato</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sendButton, { backgroundColor: colorEnviarOrden }, isSendingComanda && styles.sendButtonDisabled]}
        onPress={handleEnviarComanda}
        disabled={isSendingComanda}
      >
        <MaterialCommunityIcons name="send" size={accionIconSize} color={theme.colors.text.white} />
        <Text style={styles.sendButtonText}>
          {isSendingComanda ? "Enviando..." : "Enviar Orden"}
        </Text>
      </TouchableOpacity>
    </View>
  );
  const accionesArriba = ubicacionAcciones !== 'abajo';

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
                name={esSeleccionSinMesa(selectedMesa) ? "bag-personal" : (selectedMesa ? "table-check" : "table-plus")} 
                size={24} 
                color={esSeleccionSinMesa(selectedMesa) ? COLOR_PARA_LLEVAR : (selectedMesa ? theme.colors.secondary : theme.colors.text.secondary)} 
              />
              <Text style={[
                styles.mesaCardText,
                selectedMesa && styles.mesaCardTextSelected,
                esSeleccionSinMesa(selectedMesa) && { color: COLOR_PARA_LLEVAR },
              ]}>
                {esSeleccionSinMesa(selectedMesa)
                  ? "Sin mesa"
                  : selectedMesa
                    ? `Mesa ${selectedMesa.nummesa}`
                    : "Seleccionar Mesa"}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {accionesArriba ? botonesAccionOrden : null}

        {/* Platos Seleccionados */}
        <View style={[styles.section, orientation.isLandscape && styles.sectionLandscape]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>
                Platos Seleccionados
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{selectedPlatos.length}</Text>
              </View>
            </View>
            {selectedPlatos.length > 0 && (
              <View style={styles.sectionHeaderActions}>
                <BotonEnviarOrden onPress={handleEnviarComanda} disabled={isSendingComanda} />
                <TouchableOpacity
                  onPress={handleClearAllPlatos}
                  style={styles.clearAllButton}
                  accessibilityLabel="Borrar todos los platos"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {selectedPlatos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.colors.text.light} />
              <Text style={styles.emptyText}>No hay platos seleccionados</Text>
            </View>
          ) : (
            selectedPlatos.map((plato) => {
              const platoInstanceId = plato.instanceId || plato._id;
              const cantidad = cantidades[platoInstanceId] || 1;
              // v3.0: usar precioUnitario si está disponible
              const precioLinea = plato.precioUnitario != null ? Number(plato.precioUnitario) : Number(plato.precio || 0);
              const subtotal = precioLinea * cantidad;
              const guarnicionesVisibles = (plato.complementosElegidos || []).filter(
                (comp) => !esSeleccionVariantePlato(comp, plato)
              );
              const tieneComplementos = guarnicionesVisibles.length > 0;
              const tieneNota = plato.notaEspecial && plato.notaEspecial.trim().length > 0;
              const esLlevar = esLlevarColor(plato.tipoServicio);

              const muestraEditarFijos = platoEditableEnOrdenes(plato, platos);

              return (
                <View key={platoInstanceId} style={styles.platoItem}>
                  <View style={styles.platoItemTop}>
                  <View style={styles.platoInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={styles.platoNombre}>
                        {nombreVisibleConVariante(plato.nombre, plato)}
                      </Text>
                      {plato.numeroSerie ? (
                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.primary }}>
                          N/S {plato.numeroSerie}
                        </Text>
                      ) : null}
                      {esLlevar && (
                        <View style={styles.paraLlevarBadge}>
                          <MaterialCommunityIcons name="bag-personal" size={12} color="#fff" />
                          <Text style={styles.paraLlevarBadgeText}>{etiquetaLlevarMozo(plato.tipoServicio)}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Mostrar complementos si existen */}
                    {tieneComplementos && (
                      <View style={styles.complementosContainer}>
                        {guarnicionesVisibles.map((comp, idx) => {
                          // v2.0: Mostrar siempre la cantidad del complemento
                          const cantidadComp = cantidadGuarnicionEfectiva(comp, { cantidad });
                          
                          return (
                            <View key={idx} style={styles.complementoBadge}>
                              <MaterialCommunityIcons name="check" size={12} color={theme.colors.secondary} />
                              <Text style={styles.complementoText}>
                                {textoOpcionComplemento(comp)} x{cantidadComp}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    
                    {/* Mostrar nota especial si existe */}
                    {tieneNota && (
                      <View style={styles.notaEspecialContainer}>
                        <MaterialCommunityIcons name="note-text" size={14} color={theme.colors.warning} />
                        <Text style={styles.notaEspecialText}>{plato.notaEspecial}</Text>
                      </View>
                    )}
                    
                    <View style={styles.platoDetails}>
                      <Text style={styles.platoCantidad}>x{cantidad}</Text>
                      <Text style={styles.platoPrecio}>S/. {subtotal.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.platoCornerActions}>
                    {muestraEditarFijos && (
                      <TouchableOpacity
                        style={styles.editFijosButton}
                        onPress={() => handleEditarGuarnicionesLinea(plato)}
                        accessibilityLabel="Editar guarniciones o variaciones"
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlato(platoInstanceId)}
                      accessibilityLabel="Quitar plato"
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                  </View>
                  <View style={styles.platoActions}>
                    {cambiarVisible ? (
                      <TouchableOpacity
                        style={estiloCambiar}
                        onPress={() => handleCambiarPlato(plato)}
                        accessibilityLabel="Cambiar, abrir este plato en el menú"
                      >
                        <Text style={styles.cambiarPlatoBtnText}>Cambiar</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!modoExtraLlevar && !esSeleccionSinMesa(selectedMesa) && (
                    <TouchableOpacity
                      style={[
                        styles.tipoServicioLineaBtn,
                        esLlevar ? styles.tipoServicioLineaBtnLlevar : styles.tipoServicioLineaBtnMesa,
                      ]}
                      onPress={handleToggleTipoServicio}
                      accessibilityLabel={esLlevar ? 'Para llevar. Tocar para cambiar todos a mesa' : 'Mesa. Tocar para cambiar todos a para llevar'}
                    >
                      <MaterialCommunityIcons
                        name={esLlevar ? 'bag-personal' : 'table-chair'}
                        size={16}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.cantidadButton, estiloQty]}
                      onPress={() => handleUpdateCantidad(platoInstanceId, -1)}
                    >
                      <MaterialCommunityIcons name="minus" size={iconSizeQty} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    <Text style={styles.cantidadText}>{cantidad}</Text>
                    <TouchableOpacity
                      style={[styles.cantidadButton, estiloQty]}
                      onPress={() => handleUpdateCantidad(platoInstanceId, 1)}
                    >
                      <MaterialCommunityIcons name="plus" size={iconSizeQty} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    {platoRequiereModalAlSumar(plato, platos) && (
                      <TouchableOpacity
                        style={styles.cloneButton}
                        onPress={() => handleClonarPlato(plato)}
                        accessibilityLabel="Sumar plato MIX"
                      >
                        <MaterialCommunityIcons name="plus-box-multiple" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
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
            {renderTotalesOrden(true)}
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
            {renderTotalesOrden(false)}
          </>
        )}

        {accionesArriba ? null : botonesAccionOrden}
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

            <TouchableOpacity
              style={[
                styles.sinMesaOption,
                esSeleccionSinMesa(selectedMesa) && styles.sinMesaOptionSelected,
              ]}
              onPress={handleSelectSinMesa}
              accessibilityLabel="Sin mesa, pedido para llevar"
            >
              <MaterialCommunityIcons name="bag-personal" size={22} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sinMesaOptionTitle}>Sin mesa</Text>
                <Text style={styles.sinMesaOptionSub}>Solo platos para llevar</Text>
              </View>
              {esSeleccionSinMesa(selectedMesa) && (
                <MaterialCommunityIcons name="check-circle" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            
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

      {/* Overlay menú de platos (in-tree, no Modal nativo) */}
      <MenuPlatosSheet
        visible={modalPlatosVisible}
        onClose={cerrarModalPlatos}
        tiposPlatoCatalogo={tiposPlatoCatalogo}
        tipoPlatoFiltro={tipoPlatoFiltro}
        onSelectTipo={setTipoPlatoFiltro}
        onClearTipo={() => {
          setTipoPlatoFiltro(null);
          setCategoriaFiltro(null);
          setSearchPlato("");
        }}
        labelForTipo={labelForTipo}
        tipoServicioModal={tipoServicioModal}
        onTipoServicioChange={(v) => {
          if (esSeleccionSinMesa(selectedMesa) || modoExtraLlevar) return;
          aplicarTipoServicioCarrito(v);
        }}
        tipoServicioFijo={esSeleccionSinMesa(selectedMesa) || modoExtraLlevar}
        modoExtraLlevar={modoExtraLlevar}
        searchPlato={searchPlato}
        onSearchChange={handleSearchChangeText}
        onSearchFocus={handleSearchFocus}
        onClearSearch={handleClearSearch}
        categorias={categorias}
        categoriasInfo={categoriasInfo}
        categoriaFiltro={categoriaFiltro}
        onSelectCategoria={handleCategorySelect}
        platosFiltrados={platosFiltrados}
        selectedPlatos={selectedPlatos}
        cantidades={cantidades}
        onDecrementPlato={handleDecrementPlatoFromMenu}
        onAddPlato={handleAddPlatoFromMenu}
        onPressG={(p) => abrirFocoDesdeBuscador(p, 'guarniciones')}
        onPressV={(p) => abrirFocoDesdeBuscador(p, 'anexarNombre')}
        favoritoIds={favoritoIds}
        onToggleFavorito={toggleFavorito}
        listRef={platosListScrollRef}
        numeroMesa={
          esSeleccionSinMesa(selectedMesa)
            ? 'Sin mesa'
            : (selectedMesa?.nummesa != null ? `Mesa ${selectedMesa.nummesa}` : null)
        }
        onEnviarOrden={handleEnviarComanda}
        enviandoOrden={isSendingComanda}
      />

      {/* Overlay de Carga Animado */}
      {mostrarOverlayCarga && (
        <AnimatedOverlay mensaje={mensajeCarga} />
      )}

      {/* Modal de Complementos */}
      <ModalComplementos
        visible={platoParaComplementar !== null}
        plato={platoParaComplementar}
        onConfirm={handleConfirmarComplementos}
        onClose={cerrarModalComplementosYReabrirMenu}
        complementosIniciales={complementosInicialesModal}
        unidadesIniciales={unidadesInicialesModal}
        notaInicial={notaInicialModal}
        modoEdicion={!!editandoInstanceId}
        ocultarSumar={ocultarSumarComplementos}
        focoModo={focoComplementos}
        cantidadLinea={
          Math.max(
            1,
            Number(
              (unidadesInicialesModal && unidadesInicialesModal.length)
              || (editandoInstanceId
                ? (cantidades[editandoInstanceId]
                  ?? selectedPlatos.find((p) => (p.instanceId || p._id) === editandoInstanceId)?.cantidad)
                : cantidadInicialModal)
            ) || 1
          )
        }
        onEnviarOrden={handleEnviarComanda}
        enviandoOrden={isSendingComanda}
        numeroSerieInicial={
          (platoParaComplementar && platoParaComplementar.numeroSerie)
          || selectedPlatos.map((p) => p.numeroSerie).find((s) => numeroSerieEsValido(s))
          || ""
        }
      />
    </SafeAreaView>
  );
};

const OrdenesScreenStyles = (theme, orientation, compacto = COMPACTO_DEFAULT, accionesEscala = ACCIONES_ESCALA_DEFAULT) => {
  const sectionPad = orientation.isLandscape
    ? theme.spacing.md
    : lerpDensidad(theme.spacing.lg, 8, compacto);
  const headerMb = lerpDensidad(theme.spacing.md, 4, compacto);
  const buttonsPad = lerpDensidad(theme.spacing.lg, 8, compacto);
  const buttonsPadTop = lerpDensidad(theme.spacing.md, 2, compacto);
  const buttonsGap = lerpDensidad(theme.spacing.md, 6, compacto);
  const totalPad = orientation.isLandscape
    ? theme.spacing.md
    : lerpDensidad(theme.spacing.lg, 10, compacto);
  const totalMv = orientation.isLandscape ? 0 : lerpDensidad(theme.spacing.md, 4, compacto);
  const platoPad = lerpDensidad(theme.spacing.md, 8, compacto);
  const platoMb = lerpDensidad(theme.spacing.sm, 4, compacto);
  const obsMinH = lerpDensidad(80, 48, compacto);
  const btnPad = lerpDensidad(theme.spacing.md, 8, compacto);
  const tAcc = clampAccionesEscala(accionesEscala) / 100;
  const addPad = Math.round(btnPad * tAcc);
  const addFont = Math.max(12, Math.round(16 * tAcc));

  return StyleSheet.create({
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
    padding: sectionPad,
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
    marginBottom: headerMb,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearAllButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
    padding: platoPad,
    borderRadius: theme.borderRadius.md,
    marginBottom: platoMb,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  platoItemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  platoInfo: {
    flex: 1,
    marginBottom: theme.spacing.sm,
    paddingRight: theme.spacing.xs,
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
  complementosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  complementoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.secondary + "20",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  complementoText: {
    fontSize: 12,
    color: theme.colors.secondary,
    fontWeight: "500",
  },
  notaEspecialContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  notaEspecialText: {
    fontSize: 12,
    color: theme.colors.warning,
    fontStyle: "italic",
    flex: 1,
  },
  platoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  cambiarPlatoBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  platoCornerActions: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
  },
  editFijosButton: {
    padding: theme.spacing.xs,
  },
  tipoServicioLineaBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tipoServicioLineaBtnMesa: {
    backgroundColor: "#F59E0B",
  },
  tipoServicioLineaBtnLlevar: {
    backgroundColor: "#8B5CF6",
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
  cloneButton: {
    padding: theme.spacing.xs,
  },
  observacionesInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: obsMinH,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalSection: {
    backgroundColor: theme.colors.primary,
    padding: totalPad,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    marginHorizontal: orientation.isLandscape ? 0 : theme.spacing.lg,
    marginTop: totalMv,
    marginBottom: 0,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  totalSectionLandscape: {
    flex: 1,
    minHeight: 110,
  },
  totalBreakdown: {
    width: "100%",
  },
  totalBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2,
  },
  totalBreakdownLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text.white,
    opacity: 0.9,
  },
  totalBreakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  totalText: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  buttonsContainer: {
    flexDirection: "row",
    paddingHorizontal: buttonsPad,
    paddingTop: buttonsPadTop,
    paddingBottom: buttonsPad,
    gap: buttonsGap,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    padding: addPad,
    minHeight: Math.max(40, Math.round(48 * tAcc)),
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  addButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: addFont,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    padding: addPad,
    minHeight: Math.max(40, Math.round(48 * tAcc)),
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
    fontSize: addFont,
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
    flexGrow: 0,
    flexShrink: 0,
  },
  sinMesaOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLOR_PARA_LLEVAR,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: theme.spacing.md,
  },
  sinMesaOptionSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  sinMesaOptionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  sinMesaOptionSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
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
  searchInputWrapper: {
    position: "relative",
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    paddingRight: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  searchClearButton: {
    position: "absolute",
    right: theme.spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  categoriasContainer: {
    marginBottom: theme.spacing.md,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 40,
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
  platoModalNombreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    flex: 1,
  },
  tieneComplementosBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
  // ===== NUEVO: Toggle Mesa / Para llevar en el modal de menú =====
  tipoServicioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexGrow: 0,
    flexShrink: 0,
  },
  tipoServicioToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  tipoServicioLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.secondary,
  },
  tipoServicioLabelActive: {
    // El color se aplica inline según Mesa (amarillo) o Para llevar (púrpura)
    fontWeight: "700",
  },
  paraLlevarBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#8B5CF6', // Púrpura
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  paraLlevarBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  // ===== FIN NUEVO =====
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
};

export default OrdenesScreen;

