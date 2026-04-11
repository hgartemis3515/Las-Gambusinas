import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../context/ThemeContext";
import { useSocket } from "../../../context/SocketContext";
import { themeLight } from "../../../constants/theme";
import SettingsModal from "../../../Components/SettingsModal";
import axios from "../../../config/axiosConfig";
import { apiConfig } from "../../../apiConfig";
import {
  getPushNotificationsPrefEnabled,
  setPushNotificationsPrefEnabled,
  registerPushAfterLogin,
  isExpoGoPushLimited,
} from "../../../services/pushNotifications";

const CONFIG_CACHE_KEY = "@lasgambusinas_config";

/** Etiqueta de rol legible para personal de sala */
function formatRolLabel(rol) {
  if (!rol) return "Personal";
  const map = {
    mozos: "Mozo / Sala",
    capitanMozos: "Capitán de mozos",
    admin: "Administrador",
    supervisor: "Supervisor",
    cocinero: "Cocina",
    cajero: "Caja",
  };
  return map[rol] || rol;
}

/** Texto amigable para el estado del socket (sin jerga técnica) */
function liveSyncSubtitle(connected, connectionStatus, reconnectAttempts) {
  if (connected) {
    return "Las mesas y comandas se actualizan al instante.";
  }
  const parts = ["Sin conexión en vivo con el local."];
  if (connectionStatus) parts.push(connectionStatus);
  if (reconnectAttempts > 0) {
    parts.push(`Reintentando (${reconnectAttempts})…`);
  } else {
    parts.push("Comprueba WiFi o el servidor.");
  }
  return parts.join(" ");
}

const LOGOUT_STORAGE_KEYS = [
  "user",
  "authToken",
  "mesaSeleccionada",
  "reservaActiva",
  "selectedPlates",
  "selectedPlatesIds",
  "cantidadesComanda",
  "additionalDetails",
  "vistaInicio",
  CONFIG_CACHE_KEY,
  "ultimoBoucher",
  "boucherParaImprimir",
  "mesaPago",
  "mesaPagada",
];

const MasScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const isDarkMode = themeContext?.isDarkMode || false;
  const toggleTheme = themeContext?.toggleTheme || (() => {});
  const { connected, connectionStatus, reconnectAttempts } = useSocket();

  const [userInfo, setUserInfo] = useState(null);
  const [vistaInicio, setVistaInicio] = useState("tarjetas");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [serverOk, setServerOk] = useState(null);
  const [serverLatencyMs, setServerLatencyMs] = useState(null);
  const syncInFlight = useRef(false);

  const styles = useMemo(() => MasScreenStyles(theme), [theme]);

  const appVersion =
    Constants.expoConfig?.version || Constants.nativeAppVersion || "—";

  const navigateToStack = useCallback(
    (routeName) => {
      const parent = navigation.getParent?.();
      if (parent?.navigate) parent.navigate(routeName);
      else navigation.navigate(routeName);
    },
    [navigation]
  );

  const openProfile = useCallback(() => {
    Haptics.selectionAsync();
    navigateToStack("Profile");
  }, [navigateToStack]);

  useEffect(() => {
    loadVistaPreference();
    loadPushPref();
  }, []);

  const checkServerReachable = useCallback(async () => {
    try {
      if (!apiConfig.isConfigured || !apiConfig.baseURL) {
        setServerOk(false);
        setServerLatencyMs(null);
        return;
      }
      const result = await apiConfig.testConnection();
      setServerOk(!!result.success);
      setServerLatencyMs(result.latency != null ? result.latency : null);
    } catch {
      setServerOk(false);
      setServerLatencyMs(null);
    }
  }, []);

  const syncProfileFromServer = useCallback(async () => {
    if (syncInFlight.current) return;
    const [userJson, token] = await Promise.all([
      AsyncStorage.getItem("user"),
      AsyncStorage.getItem("authToken"),
    ]);
    const local = userJson ? JSON.parse(userJson) : null;
    const id = local?._id;
    if (!id || !token || !apiConfig.isConfigured) return;

    syncInFlight.current = true;
    setProfileSyncing(true);
    try {
      const url = apiConfig.getEndpoint(`/mozos/${id}`);
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      if (!data || typeof data !== "object") return;

      const prev = local || {};
      const next = {
        ...prev,
        _id: data._id || prev._id,
        name: data.name != null && String(data.name).trim() ? data.name : prev.name,
        rol: data.rol != null ? data.rol : prev.rol,
      };
      if (Array.isArray(data.permisosEfectivos) && data.permisosEfectivos.length > 0) {
        next.permisos = data.permisosEfectivos;
      }
      if (data.fotoUrl !== undefined && data.fotoUrl !== null) {
        next.fotoUrl = data.fotoUrl;
      }
      await AsyncStorage.setItem("user", JSON.stringify(next));
      setUserInfo(next);
    } catch {
      // Silencioso: ya hay datos locales; el usuario puede abrir perfil para ver errores
    } finally {
      setProfileSyncing(false);
      syncInFlight.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      checkServerReachable();
      syncProfileFromServer();
    }, [loadUserData, checkServerReachable, syncProfileFromServer])
  );

  const loadPushPref = async () => {
    try {
      const v = await getPushNotificationsPrefEnabled();
      setPushEnabled(v);
    } catch (e) {
      console.warn("MasScreen push pref:", e);
    }
  };

  const loadVistaPreference = async () => {
    try {
      const saved = await AsyncStorage.getItem("vistaInicio");
      if (saved) setVistaInicio(saved);
    } catch (error) {
      console.error("Error cargando preferencia de vista:", error);
    }
  };

  const setVistaInicioMode = async (useMapa) => {
    const nuevaVista = useMapa ? "mapa" : "tarjetas";
    if (nuevaVista === vistaInicio) return;
    setVistaInicio(nuevaVista);
    try {
      await AsyncStorage.setItem("vistaInicio", nuevaVista);
    } catch (error) {
      console.error("Error guardando preferencia de vista:", error);
    }
  };

  const loadUserData = useCallback(async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) setUserInfo(JSON.parse(user));
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  }, []);

  const onTogglePush = async (value) => {
    setPushEnabled(value);
    await setPushNotificationsPrefEnabled(value);
    if (value && userInfo?._id) {
      registerPushAfterLogin(userInfo._id).catch(() => {});
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que deseas cerrar sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar Sesión",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(LOGOUT_STORAGE_KEYS);
              navigation.replace("Login");
            } catch (error) {
              console.error("Error cerrando sesión:", error);
            }
          },
        },
      ]
    );
  };

  const menuItems = useMemo(
    () => [
    {
      id: 1,
      title: "Mi Perfil",
      icon: "account-circle",
      color: theme.colors.primary,
      onPress: openProfile,
    },
    {
      id: 3,
      title: "Ayuda y Soporte",
      icon: "help-circle",
      color: theme.colors.accent,
      onPress: () => {
        Haptics.selectionAsync();
        navigateToStack("Help");
      },
    },
    {
      id: 4,
      title: "Acerca de",
      icon: "information",
      color: theme.colors.warning,
      onPress: () => {
        Haptics.selectionAsync();
        navigateToStack("About");
      },
    },
    ],
    [navigateToStack, openProfile, theme.colors.accent, theme.colors.primary, theme.colors.warning]
  );

  const expoPushLimited = isExpoGoPushLimited();

  const liveSyncDetail = liveSyncSubtitle(connected, connectionStatus, reconnectAttempts);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.profileContainer}
            onPress={openProfile}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            accessibilityHint="Abre tu ficha para ver y editar datos"
          >
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                {userInfo?.fotoUrl && String(userInfo.fotoUrl).trim() ? (
                  <Image
                    source={{ uri: String(userInfo.fotoUrl).trim() }}
                    style={styles.avatarImage}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <MaterialCommunityIcons name="account" size={48} color={theme.colors.primary} />
                )}
              </View>
              {profileSyncing ? (
                <View style={styles.headerSyncBadge} accessibilityLabel="Actualizando datos del perfil">
                  <ActivityIndicator size="small" color={theme.colors.text.white} />
                </View>
              ) : null}
            </View>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {userInfo?.name || "Usuario"}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.colors.text.white}
                style={styles.userNameChevron}
              />
            </View>
            <Text style={styles.userRole}>{formatRolLabel(userInfo?.rol)}</Text>
            <Text style={styles.profileHint}>Toca para ver o editar tu perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opciones</Text>
          {menuItems.map((item, index) => (
            <MotiView
              key={item.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 320, delay: index * 55 }}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color + "20" }]}>
                  <MaterialCommunityIcons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.menuItemText}>{item.title}</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.light} />
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.text.secondary + "20" }]}>
              <MaterialCommunityIcons
                name={isDarkMode ? "weather-night" : "weather-sunny"}
                size={24}
                color={theme.colors.text.secondary}
              />
            </View>
            <View style={styles.themeToggleContainer}>
              <Text style={styles.menuItemText}>Modo Oscuro</Text>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: "#767577", true: theme.colors.primary }}
                thumbColor={isDarkMode ? theme.colors.text.white : "#f4f3f4"}
                accessibilityLabel="Modo oscuro"
                accessibilityHint="Activa o desactiva el tema oscuro de la aplicación"
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setVistaInicioMode(vistaInicio !== "mapa")}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.primary + "20" }]}>
              <MaterialCommunityIcons
                name={vistaInicio === "mapa" ? "map-marker-radius" : "view-grid"}
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.themeToggleContainer}>
              <Text style={styles.menuItemText}>Vista de Inicio</Text>
              <View style={styles.vistaSwitchRow}>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.colors.text.secondary,
                    marginRight: 8,
                  }}
                >
                  {vistaInicio === "mapa" ? "Mapa" : "Tarjetas"}
                </Text>
                <Switch
                  value={vistaInicio === "mapa"}
                  onValueChange={(v) => setVistaInicioMode(v)}
                  trackColor={{ false: "#767577", true: theme.colors.primary }}
                  thumbColor={vistaInicio === "mapa" ? theme.colors.text.white : "#f4f3f4"}
                  accessibilityLabel="Vista de inicio: mapa o tarjetas"
                  accessibilityHint="Activa para mostrar el mapa de mesas al abrir la app"
                />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              Haptics.selectionAsync();
              setSettingsOpen(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.accent + "20" }]}>
              <MaterialCommunityIcons name="server-network" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.serverRowText}>
              <Text style={styles.serverMenuTitle}>Configuración del servidor</Text>
              <Text style={styles.serverStatusLine} numberOfLines={1}>
                {serverOk === null
                  ? "Comprobando…"
                  : serverOk
                    ? serverLatencyMs != null
                      ? `En línea · ${serverLatencyMs} ms`
                      : "En línea"
                    : "Sin respuesta del servidor"}
              </Text>
            </View>
            <View style={styles.serverDotWrap} accessibilityLabel={serverOk ? "Servidor en línea" : "Servidor sin respuesta"}>
              <View
                style={[
                  styles.serverDot,
                  {
                    backgroundColor:
                      serverOk === null
                        ? theme.colors.text.light
                        : serverOk
                          ? theme.colors.secondary
                          : theme.colors.warning,
                  },
                ]}
              />
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.light} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.warning + "20" }]}>
              <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.warning} />
            </View>
            <View style={styles.themeToggleContainer}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.menuItemText}>Notificaciones push</Text>
                {expoPushLimited ? (
                  <Text style={styles.pushHint}>Limitado en Expo Go (usa build nativo)</Text>
                ) : null}
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={onTogglePush}
                trackColor={{ false: "#767577", true: theme.colors.primary }}
                thumbColor={pushEnabled ? theme.colors.text.white : "#f4f3f4"}
                accessibilityLabel="Notificaciones push"
                accessibilityHint="Activa o desactiva avisos en este dispositivo"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Versión de la App</Text>
              <Text style={styles.infoSubtitle}>{appVersion}</Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons
              name={connected ? "sync" : "cloud-off-outline"}
              size={24}
              color={connected ? theme.colors.secondary : theme.colors.warning}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Sincronización en vivo</Text>
              <Text style={styles.infoSubtitle}>{liveSyncDetail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              handleLogout();
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="logout" size={24} color={theme.colors.text.white} />
            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const MasScreenStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      borderBottomLeftRadius: theme.borderRadius.xl,
      borderBottomRightRadius: theme.borderRadius.xl,
      ...theme.shadows.medium,
    },
    profileContainer: {
      alignItems: "center",
    },
    avatarRow: {
      position: "relative",
      marginBottom: theme.spacing.md,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      ...theme.shadows.medium,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    headerSyncBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    userNameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: "100%",
      paddingHorizontal: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    userName: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text.white,
      flexShrink: 1,
      textAlign: "center",
    },
    userNameChevron: {
      marginLeft: 4,
      opacity: 0.95,
    },
    userRole: {
      fontSize: 16,
      color: theme.colors.text.white,
      opacity: 0.9,
    },
    profileHint: {
      fontSize: 12,
      color: theme.colors.text.white,
      opacity: 0.75,
      marginTop: theme.spacing.sm,
    },
    serverRowText: {
      flex: 1,
      marginRight: theme.spacing.sm,
      minWidth: 0,
    },
    serverMenuTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    serverStatusLine: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    serverDotWrap: {
      justifyContent: "center",
      marginRight: theme.spacing.xs,
    },
    serverDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    section: {
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.small,
    },
    menuIconContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    themeToggleContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    vistaSwitchRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    pushHint: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.small,
    },
    infoContent: {
      marginLeft: theme.spacing.md,
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    infoSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    logoutSection: {
      padding: theme.spacing.lg,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      ...theme.shadows.medium,
    },
    logoutButtonText: {
      marginLeft: theme.spacing.sm,
      color: theme.colors.text.white,
      fontSize: 18,
      fontWeight: "700",
    },
  });

export default MasScreen;
