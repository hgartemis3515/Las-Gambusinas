import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../context/ThemeContext";
import { useSocket } from "../../../context/SocketContext";
import { themeLight } from "../../../constants/theme";
import SettingsModal from "../../../Components/SettingsModal";
import {
  getPushNotificationsPrefEnabled,
  setPushNotificationsPrefEnabled,
  registerPushAfterLogin,
  isExpoGoPushLimited,
} from "../../../services/pushNotifications";

const CONFIG_CACHE_KEY = "@lasgambusinas_config";

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

  useEffect(() => {
    loadUserData();
    loadVistaPreference();
    loadPushPref();
  }, []);

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

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) setUserInfo(JSON.parse(user));
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

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

  const menuItems = [
    {
      id: 1,
      title: "Mi Perfil",
      icon: "account-circle",
      color: theme.colors.primary,
      onPress: () => {
        Haptics.selectionAsync();
        navigateToStack("Profile");
      },
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
  ];

  const expoPushLimited = isExpoGoPushLimited();

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.profileContainer}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.userName}>{userInfo?.name || "Usuario"}</Text>
            <Text style={styles.userRole}>{userInfo?.rol || "Mozo"}</Text>
          </View>
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
            <Text style={styles.menuItemText}>Configuración del servidor</Text>
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
              name={connected ? "wifi" : "wifi-off"}
              size={24}
              color={connected ? theme.colors.secondary : theme.colors.warning}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>WebSocket /mozos</Text>
              <Text style={styles.infoSubtitle}>
                {connected ? "Conectado" : "Desconectado"}
                {connectionStatus ? ` · ${connectionStatus}` : ""}
                {reconnectAttempts > 0 ? ` · reintentos ${reconnectAttempts}` : ""}
              </Text>
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
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
      ...theme.shadows.medium,
    },
    userName: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text.white,
      marginBottom: theme.spacing.xs,
    },
    userRole: {
      fontSize: 16,
      color: theme.colors.text.white,
      opacity: 0.9,
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
