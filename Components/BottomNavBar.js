import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import TabNav from "./TabNav";
import { colors } from "../constants/colors";

const BottomNavBar = ({ activeIndex = 0, activeRoute = null, navigation: navProp, showPanel = false }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = navProp || useNavigation();
  const { isDarkMode } = useTheme();
  
  // Responsive compacto
  const tabSize = width < 390 ? 44 : 48;
  const navHeight = 60; // Compacto 60px fijo

  // Color rojo según dark mode
  const navBgColor = isDarkMode ? "#A11228" : "#C41E3A"; // Rojo oscuro en dark, rojo brillante en light

  // Configuración de tabs — Panel a la izquierda de Inicio (solo admin / permiso)
  const tabsConfig = [
    ...(showPanel
      ? [{ route: "Panel", icono: "📋", label: "Panel" }]
      : []),
    { route: "Inicio", icono: "🏠", label: "Inicio" },
    { route: "Ordenes", icono: "🍽️", label: "Órdenes" },
    { route: "Pagos", icono: "💰", label: "Pagos" },
    { route: "Chat", icono: "💬", label: "Chat", stackRoute: true },
    { route: "Mas", icono: "⚙️", label: "Más" },
  ];

  const handleTabPress = (routeName, isFocused, isStackRoute) => {
    if (isFocused || !navigation) return;
    if (isStackRoute) {
      // Chat vive en el Stack padre (App.js), no en el Tab navigator
      const parent = navigation.getParent?.();
      if (parent) parent.navigate(routeName);
      else navigation.navigate(routeName);
      return;
    }
    navigation.navigate(routeName);
  };

  return (
    <MotiView
      from={{ translateY: 100, opacity: 0 }}
      animate={{ translateY: 0, opacity: 1 }}
      transition={{
        type: "timing",
        duration: 400,
        delay: 300,
      }}
      style={[
        styles.container,
        {
          height: navHeight + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          backgroundColor: navBgColor,
          zIndex: 1, // BAJO - detrás del contenido
        },
      ]}
    >
      {/* Tabs container */}
      <View style={styles.tabsContainer}>
        {tabsConfig.map((tabConfig, index) => {
          // Preferir nombre de ruta (evita desfase por Chat fuera del Tab navigator)
          const isFocused = activeRoute
            ? activeRoute === tabConfig.route
            : activeIndex === index;

          return (
            <TabNav
              key={tabConfig.route}
              icono={tabConfig.icono}
              label={tabConfig.label}
              activeColor="#FFFFFF"
              inactiveColor="#FFFFFFCC"
              active={isFocused}
              onPress={() => handleTabPress(tabConfig.route, isFocused, tabConfig.stackRoute)}
              tabSize={tabSize}
            />
          );
        })}
      </View>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative", // NO absolute - integrado en layout
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden", // Asegura que las curvas se rellenen correctamente
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 16,
    gap: 0,
  },
});

export default BottomNavBar;
