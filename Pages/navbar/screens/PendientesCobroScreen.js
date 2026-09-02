import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "../../../config/axiosConfig";
import { apiConfig, COMANDASEARCH_API_GET } from "../../../apiConfig";
import { getFallbackApiBase } from "../../../config/envDefaults";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { useSocket } from "../../../context/SocketContext";
import { formatPendienteCobro } from "../../../helpers/pendienteCobroMozo";
import {
  acotarComandasAlCicloActual,
  aplicarPedidoSinVaciar,
  rutasComandasSegunEstadoMesa,
} from "../../../utils/comandaHelpers";

function urlPendienteCobro(mozoId) {
  const q = `pendiente-cobro?mozoId=${encodeURIComponent(mozoId)}`;
  return apiConfig.isConfigured
    ? `${apiConfig.getEndpoint("/aprobacion")}/${q}`
    : `${getFallbackApiBase()}/aprobacion/${q}`;
}

function comandaBaseUrl() {
  return apiConfig.isConfigured
    ? apiConfig.getEndpoint("/comanda")
    : COMANDASEARCH_API_GET;
}

async function fetchCicloMesa(mesa) {
  if (!mesa?._id) return [];
  const base = comandaBaseUrl();
  const rutas = rutasComandasSegunEstadoMesa(mesa.estado);
  let lista = [];
  let pedidoId = null;
  for (const ruta of rutas) {
    try {
      const res = await axios.get(`${base}/mesa/${mesa._id}/${ruta}`, { timeout: 10000 });
      if (res.data?.pedidoId) pedidoId = res.data.pedidoId;
      const batch = res.data?.comandas || [];
      if (batch.length > 0) {
        lista = batch;
        break;
      }
    } catch (_) {
      /* siguiente ruta */
    }
  }
  return acotarComandasAlCicloActual(aplicarPedidoSinVaciar(lista, pedidoId));
}

async function fetchComandaPorId(comandaId) {
  if (!comandaId) return null;
  try {
    const res = await axios.get(`${comandaBaseUrl()}/${comandaId}`, { timeout: 8000 });
    return res.data?._id ? res.data : null;
  } catch (_) {
    return null;
  }
}

function labelMesa(item) {
  if (item.mesaNombre) return String(item.mesaNombre);
  if (item.mesaNumero != null) return String(item.mesaNumero);
  return "—";
}

const PendientesCobroScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { subscribeToEvents, socket } = useSocket();

  const [comandas, setComandas] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abriendoId, setAbriendoId] = useState(null);

  const cargarRef = useRef(async () => {});
  const debounceRef = useRef(null);
  const mozoIdRef = useRef(null);

  const cargarLista = useCallback(async ({ silent } = {}) => {
    let id = mozoIdRef.current;
    if (!id) {
      try {
        const raw = await AsyncStorage.getItem("user");
        const parsed = raw ? JSON.parse(raw) : null;
        id = parsed?._id || parsed?.id || null;
        mozoIdRef.current = id;
      } catch (_) {
        id = null;
      }
    }
    if (!id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(urlPendienteCobro(id), { timeout: 8000 });
      if (res.data?.success) {
        setComandas(Array.isArray(res.data.comandas) ? res.data.comandas : []);
        setTotal(Number(res.data.total) || 0);
      }
    } catch (error) {
      console.warn("Pendientes de cobro no disponible:", error?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  cargarRef.current = cargarLista;

  const refetchDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      cargarRef.current?.({ silent: true });
    }, 350);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarRef.current?.();
      subscribeToEvents({
        onComandaActualizada: refetchDebounced,
        onNuevaComanda: refetchDebounced,
        onMesaActualizada: refetchDebounced,
        onReservaCambio: refetchDebounced,
      });
      const onPago = () => refetchDebounced();
      socket?.on("comanda-aprobada", onPago);
      socket?.on("ticket-ppa-creado", onPago);
      socket?.on("ticket-ppa-aprobado", onPago);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        subscribeToEvents({
          onComandaActualizada: null,
          onNuevaComanda: null,
          onMesaActualizada: null,
          onReservaCambio: null,
        });
        socket?.off("comanda-aprobada", onPago);
        socket?.off("ticket-ppa-creado", onPago);
        socket?.off("ticket-ppa-aprobado", onPago);
      };
    }, [subscribeToEvents, socket, refetchDebounced])
  );

  const abrirDetalle = useCallback(async (item) => {
    if (!item?._id || abriendoId) return;
    setAbriendoId(String(item._id));
    try {
      const mesa = {
        _id: item.mesaId || undefined,
        nummesa: item.mesaNumero,
        estado: item.mesaEstado || "pedido",
        nombreCombinado: item.mesaNombre || null,
      };
      let comandasMesa = await fetchCicloMesa(mesa);
      if (!comandasMesa.length) {
        const una = await fetchComandaPorId(item._id);
        if (una) {
          comandasMesa = [una];
          if (!mesa._id) {
            mesa._id = una.mesas?._id || una.mesas || undefined;
            mesa.nummesa = mesa.nummesa ?? una.mesas?.nummesa ?? una.mesaNumero;
            mesa.estado = una.mesas?.estado || mesa.estado;
          }
        }
      }
      if (!comandasMesa.length) {
        Alert.alert("Sin comanda", "No se pudo cargar el detalle de esta mesa.");
        return;
      }
      navigation.navigate("ComandaDetalle", { mesa, comandas: comandasMesa });
    } finally {
      setAbriendoId(null);
    }
  }, [abriendoId, navigation]);

  const styles = makeStyles(theme);

  const renderItem = ({ item }) => {
    const id = String(item._id);
    const busy = abriendoId === id;
    return (
      <View style={styles.row}>
        <Text style={[styles.cell, styles.colMesa]} numberOfLines={1}>{labelMesa(item)}</Text>
        <Text style={[styles.cell, styles.colComanda]} numberOfLines={1}>
          {item.comandaNumber != null ? `#${item.comandaNumber}` : "—"}
        </Text>
        <Text style={[styles.cell, styles.colTotal]} numberOfLines={1}>
          {formatPendienteCobro(item.pendienteCobro)}
        </Text>
        <TouchableOpacity
          style={styles.verBtn}
          onPress={() => abrirDetalle(item)}
          disabled={!!abriendoId}
          accessibilityRole="button"
          accessibilityLabel={`Ver comanda ${item.comandaNumber || ""}`}
        >
          {busy
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.verBtnText}>Ver</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pendientes</Text>
        <View style={styles.totalBox}>
          <Text style={styles.totalText} numberOfLines={1}>
            {formatPendienteCobro(total)}
          </Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colMesa]}>Mesa</Text>
        <Text style={[styles.th, styles.colComanda]}>Comanda</Text>
        <Text style={[styles.th, styles.colTotal]}>Total</Text>
        <View style={styles.colVer} />
      </View>

      {loading && comandas.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={comandas}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderItem}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                cargarLista({ silent: true });
              }}
              colors={[theme.colors.primary]}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <MaterialCommunityIcons name="cash-check" size={48} color={theme.colors.text?.secondary || "#888"} />
              <Text style={styles.emptyText}>No hay comandas pendientes de cobro</Text>
            </View>
          )}
          contentContainerStyle={comandas.length === 0 ? styles.emptyList : styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (theme) => StyleSheet.create({
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.white,
    letterSpacing: 0.5,
  },
  totalBox: {
    backgroundColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  totalText: {
    color: "#FF9500",
    fontWeight: "800",
    fontSize: 14,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border || "#333",
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text?.secondary || "#888",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border || "#333",
  },
  cell: {
    fontSize: 15,
    color: theme.colors.text?.primary || theme.colors.text?.white || "#111",
  },
  colMesa: { flex: 0.9 },
  colComanda: { flex: 1 },
  colTotal: { flex: 1.2, fontWeight: "700" },
  colVer: { width: 64 },
  verBtn: {
    width: 64,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  verBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  list: {
    paddingBottom: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.text?.secondary || "#888",
    textAlign: "center",
  },
});

export default PendientesCobroScreen;
