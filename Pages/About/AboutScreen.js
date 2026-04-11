import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import axios from "../../config/axiosConfig";
import { apiConfig, getWebSocketURL } from "../../apiConfig";
import { useSocket } from "../../context/SocketContext";
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";

function getHealthCheckUrl() {
  try {
    const baseURL = apiConfig.baseURL;
    if (!baseURL) return null;
    const root = baseURL.replace(/\/api\/?$/i, "");
    return `${root}/health`;
  } catch {
    return null;
  }
}

const AboutScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { connected, connectionStatus, reconnectAttempts, authError } = useSocket();
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthText, setHealthText] = useState(null);

  const appVersion =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    "—";

  const styles = buildStyles(theme);

  const runHealthCheck = useCallback(async () => {
    const url = getHealthCheckUrl();
    if (!url) {
      setHealthText("Configura primero la URL del servidor.");
      return;
    }
    setHealthLoading(true);
    setHealthText(null);
    try {
      const { data, status } = await axios.get(url, {
        timeout: 8000,
        validateStatus: () => true,
      });
      if (status >= 200 && status < 300) {
        setHealthText(typeof data === "object" ? JSON.stringify(data, null, 2).slice(0, 800) : String(data));
      } else {
        setHealthText(`HTTP ${status}`);
      }
    } catch (e) {
      setHealthText(e?.message || "Error de red");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setHealthText(null);
    }, [])
  );

  const wsUrl = getWebSocketURL();
  const apiBase = apiConfig.baseURL || "No configurada";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Acerca de</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>App</Text>
          <Text style={styles.value}>Las Gambusinas — Mozos</Text>
          <Text style={styles.label}>Versión</Text>
          <Text style={styles.value}>{appVersion}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>URL API</Text>
          <Text style={styles.valueSmall} selectable>
            {apiBase}
          </Text>
          <Text style={[styles.label, styles.mt]}>WebSocket (mozos)</Text>
          <Text style={styles.valueSmall} selectable>
            {wsUrl}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Socket.io /mozos</Text>
          <Text style={styles.value}>
            {connected ? "Conectado" : "Desconectado"} — {connectionStatus || "—"}
          </Text>
          {reconnectAttempts > 0 ? (
            <Text style={styles.hint}>Reintentos: {reconnectAttempts}</Text>
          ) : null}
          {authError ? (
            <Text style={styles.warn} selectable>
              Auth: {typeof authError === "string" ? authError : JSON.stringify(authError)}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.button} onPress={runHealthCheck} disabled={healthLoading}>
          {healthLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="heart-pulse" size={20} color="#fff" style={styles.btnIcon} />
              <Text style={styles.buttonText}>Probar GET /health</Text>
            </>
          )}
        </TouchableOpacity>

        {healthText ? (
          <View style={styles.healthBox}>
            <Text style={styles.healthText} selectable>
              {healthText}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const buildStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 48 },
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small,
    },
    label: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    mt: { marginTop: theme.spacing.sm },
    value: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    valueSmall: {
      fontSize: 13,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    hint: { fontSize: 12, color: theme.colors.text.secondary, marginTop: 4 },
    warn: { fontSize: 12, color: theme.colors.warning, marginTop: 8 },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    btnIcon: { marginRight: theme.spacing.sm },
    buttonText: { color: theme.colors.text.white, fontWeight: "700", fontSize: 16 },
    healthBox: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    healthText: {
      fontSize: 12,
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
      color: theme.colors.text.secondary,
    },
  });

export default AboutScreen;
