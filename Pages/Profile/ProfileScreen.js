import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "../../config/axiosConfig";
import { apiConfig } from "../../apiConfig";
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userJson, token] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("authToken"),
      ]);
      const local = userJson ? JSON.parse(userJson) : null;
      if (!local?._id) {
        setProfile(null);
        setError("No hay sesión de usuario.");
        setLoading(false);
        return;
      }

      if (!token || !apiConfig.isConfigured) {
        setProfile({ ...local, _fuente: "local" });
        setLoading(false);
        return;
      }

      const url = apiConfig.getEndpoint(`/mozos/${local._id}`);
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile({ ...data, _fuente: "servidor" });
    } catch (e) {
      const userJson = await AsyncStorage.getItem("user");
      const local = userJson ? JSON.parse(userJson) : null;
      if (local) {
        setProfile({ ...local, _fuente: "local" });
        setError(
          e?.response?.status === 403 || e?.response?.status === 401
            ? "Sin permiso para ver el perfil completo en el servidor."
            : "No se pudo sincronizar con el servidor. Mostrando datos locales."
        );
      } else {
        setError(e?.message || "Error al cargar el perfil.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const styles = buildStyles(theme);

  const rows = profile
    ? [
        { label: "Nombre", value: profile.name || profile.nombre || "—" },
        { label: "Rol", value: profile.rol || "—" },
        { label: "DNI", value: String(profile.DNI ?? profile.dni ?? "—") },
        {
          label: "Teléfono",
          value: profile.phoneNumber != null ? String(profile.phoneNumber) : "—",
        },
        { label: "Email", value: profile.email || "—" },
        { label: "Fuente", value: profile._fuente === "servidor" ? "Servidor" : "Dispositivo" },
      ]
    : [];

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
        <Text style={styles.headerTitle}>Mi perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {error ? (
            <View style={styles.banner}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.warning}
                style={styles.bannerIcon}
              />
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </ScrollView>
      )}
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
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: theme.spacing.lg },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    bannerIcon: { marginRight: theme.spacing.sm, marginTop: 2 },
    bannerText: {
      flex: 1,
      color: theme.colors.text.secondary,
      fontSize: 14,
    },
    row: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.small,
    },
    rowLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    rowValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
  });

export default ProfileScreen;
