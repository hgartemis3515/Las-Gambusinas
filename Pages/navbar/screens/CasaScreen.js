import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET } from "../../../apiConfig";
import moment from "moment-timezone";
import { useOrientation } from "../../../hooks/useOrientation";

const CasaScreen = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const orientation = useOrientation();
  const styles = CasaScreenStyles(theme, orientation);
  const [userInfo, setUserInfo] = useState(null);
  const [comandas, setComandas] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const fetchData = async () => {
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      
      // Obtener comandas del día
      const comandasResponse = await axios.get(
        `${COMANDASEARCH_API_GET}/fecha/${currentDate}`,
        { timeout: 5000 }
      );
      
      // Filtrar solo las comandas del usuario
      let filtered = comandasResponse.data;
      if (userInfo && userInfo._id) {
        filtered = comandasResponse.data.filter(
          comanda => comanda.mozos?._id === userInfo._id || comanda.mozos?._id === userInfo.id
        );
      }
      setComandas(filtered);

      // Obtener mesas
      const mesasResponse = await axios.get(SELECTABLE_API_GET, { timeout: 5000 });
      setMesas(mesasResponse.data);
    } catch (error) {
      console.error("Error obteniendo datos:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };


  const totalComandas = comandas.length;
  const comandasPendientes = comandas.filter(
    (c) => c.status?.toLowerCase() !== "entregado" && c.status?.toLowerCase() !== "completado"
  ).length;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "entregado":
      case "completado":
        return theme.colors.secondary;
      case "preparando":
      case "prep":
        return theme.colors.warning;
      case "listo":
      case "recoger":
        return "#FFD500";
      default:
        return theme.colors.accent;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>¡Hola!</Text>
            <Text style={styles.userName}>{userInfo?.name || "Usuario"}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="account-circle" size={48} color={theme.colors.text.white} />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <MaterialCommunityIcons name="clipboard-text" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.statNumber}>{totalComandas}</Text>
            <Text style={styles.statLabel}>Comandas Hoy</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.colors.warning + '20' }]}>
              <MaterialCommunityIcons name="clock-outline" size={32} color={theme.colors.warning} />
            </View>
            <Text style={styles.statNumber}>{comandasPendientes}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          
          <View style={orientation.isLandscape ? styles.quickActionsHorizontal : styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="plus-circle" size={40} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Nueva Orden</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="table-search" size={40} color={theme.colors.accent} />
              <Text style={styles.quickActionText}>Ver Mesas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="clipboard-search" size={40} color={theme.colors.warning} />
              <Text style={styles.quickActionText}>Mis Comandas</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          {comandas.slice(0, 5).length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-text-off" size={48} color={theme.colors.text.light} />
              <Text style={styles.emptyText}>No hay comandas recientes</Text>
            </View>
          ) : (
            comandas.slice(0, 5).map((comanda) => (
              <View key={comanda._id} style={styles.activityCard}>
                <View style={styles.activityIcon}>
                  <MaterialCommunityIcons 
                    name="clipboard-text" 
                    size={24} 
                    color={theme.colors.primary} 
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    Comanda #{comanda.comandaNumber || comanda._id.slice(-4)}
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    Mesa {comanda.mesas?.nummesa || "N/A"} • {moment(comanda.createdAt || comanda.fecha).format("HH:mm")}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(comanda.status) }]}>
                  <Text style={styles.statusText}>{comanda.status || "Pendiente"}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const CasaScreenStyles = (theme, orientation) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: orientation.isLandscape ? theme.spacing.md : theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    ...theme.shadows.medium,
  },
  greeting: {
    fontSize: 18,
    color: theme.colors.text.white,
    opacity: 0.9,
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginTop: theme.spacing.xs,
  },
  headerIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
  },
  statsContainer: {
    flexDirection: orientation.isLandscape ? "row" : "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    flexWrap: orientation.isLandscape ? "wrap" : "nowrap",
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  statIconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: "600",
  },
  section: {
    padding: orientation.isLandscape ? theme.spacing.md : theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  mesasStatusContainer: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  mesaStatusCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
  },
  mesaStatusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  mesaStatusInfo: {
    flex: 1,
  },
  mesaStatusNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  mesaStatusLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  quickActionsHorizontal: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    justifyContent: "space-around",
  },
  quickActionCard: {
    width: orientation.isLandscape ? "30%" : "30%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: orientation.isLandscape ? 120 : 100,
    ...theme.shadows.small,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.light,
    marginTop: theme.spacing.md,
    fontStyle: "italic",
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: orientation.isLandscape ? theme.spacing.sm : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.small,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  activitySubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
});

export default CasaScreen;

