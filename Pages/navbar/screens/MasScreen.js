import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";

const MasScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const isDarkMode = themeContext?.isDarkMode || false;
  const toggleTheme = themeContext?.toggleTheme || (() => {});
  const [userInfo, setUserInfo] = useState(null);
  const styles = MasScreenStyles(theme);

  useEffect(() => {
    loadUserData();
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
              await AsyncStorage.removeItem("user");
              await AsyncStorage.removeItem("mesaSeleccionada");
              await AsyncStorage.removeItem("selectedPlates");
              await AsyncStorage.removeItem("selectedPlatesIds");
              await AsyncStorage.removeItem("cantidadesComanda");
              await AsyncStorage.removeItem("additionalDetails");
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
      onPress: () => Alert.alert("Perfil", `Usuario: ${userInfo?.name || "N/A"}`),
    },
    {
      id: 3,
      title: "Ayuda y Soporte",
      icon: "help-circle",
      color: theme.colors.accent,
      onPress: () => Alert.alert("Ayuda", "Para soporte, contacta al administrador"),
    },
    {
      id: 4,
      title: "Acerca de",
      icon: "information",
      color: theme.colors.warning,
      onPress: () => Alert.alert("Acerca de", "Las Gambusinas\nSistema POS v1.0"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileContainer}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.userName}>{userInfo?.name || "Usuario"}</Text>
            <Text style={styles.userRole}>Mozo</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opciones</Text>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
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
          ))}
        </View>

        {/* Configuración */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
          >
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
                trackColor={{ false: '#767577', true: theme.colors.primary }}
                thumbColor={isDarkMode ? theme.colors.text.white : '#f4f3f4'}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Versión de la App</Text>
              <Text style={styles.infoSubtitle}>v1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
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

const MasScreenStyles = (theme) => StyleSheet.create({
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
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
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
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  logoutButtonText: {
    color: theme.colors.text.white,
    fontSize: 18,
    fontWeight: "700",
  },
});

export default MasScreen;
