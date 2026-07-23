import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { createMaterialBottomTabNavigator } from "@react-navigation/material-bottom-tabs";
import { useNavigationState, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavBar from "../../Components/BottomNavBar";
import InicioScreen from "./screens/InicioScreen";
import OrdenesScreen from "./screens/OrdenesScreen";
import PagosScreen from "./screens/PagosScreen";
import MasScreen from "./screens/MasScreen";
// PLAN OBLIGAR_ORDEN_ASIGNACION_KDS_SUPERVISOR: Panel de Gestión como tab
import PanelGestionScreen from "../PanelGestion/PanelGestionScreen";
import { useTheme } from "../../context/ThemeContext";
import { useSocket } from "../../context/SocketContext";
import SocketStatus from "../../Components/SocketStatus";

const Tab = createMaterialBottomTabNavigator();

const PERMISO_PANEL = "ver-panel-gestion-mozos";

// Componente interno que usa el contexto
const NavbarContent = () => {
  const route = useRoute();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeRoute, setActiveRoute] = useState("Inicio");
  const [showPanel, setShowPanel] = useState(false);
  const [permisoListo, setPermisoListo] = useState(false);
  const { isDarkMode } = useTheme();
  const { connected, connectionStatus, reconnectAttempts } = useSocket();

  // Color rojo según dark mode (igual que en BottomNavBar)
  const navBgColor = isDarkMode ? "#A11228" : "#C41E3A";

  // Leer permiso de Panel de Gestión (admin / roles)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        const user = raw ? JSON.parse(raw) : null;
        const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
        const tiene =
          user?.rol === "admin" || permisos.includes(PERMISO_PANEL);
        setShowPanel(!!tiene);
        if (tiene) setActiveRoute("Panel");
      } catch (_) {
        setShowPanel(false);
      } finally {
        setPermisoListo(true);
      }
    })();
  }, []);

  // Obtener el estado del tab navigator desde el navigation state global
  const navigationState = useNavigationState((state) => {
    // Buscar el estado del tab navigator dentro del stack
    const navbarRoute = state?.routes?.find((r) => r.name === "Navbar");
    return navbarRoute?.state || null;
  });

  // Actualizar el índice / ruta activa cuando cambie el estado
  useEffect(() => {
    if (navigationState?.index !== undefined) {
      setCurrentIndex(navigationState.index);
      const r = navigationState.routes?.[navigationState.index];
      if (r?.name) setActiveRoute(r.name);
    }
  }, [navigationState]);

  // Esperar a saber si hay Panel para montar el Tab.Navigator con el initialRoute correcto
  if (!permisoListo) {
    return <View style={{ flex: 1, backgroundColor: navBgColor }} />;
  }

  // Admin con permiso: primer tab = Panel. Resto: Inicio.
  const initialTab =
    route?.params?.initialTab === "Panel" && showPanel
      ? "Panel"
      : showPanel
        ? "Panel"
        : "Inicio";

  return (
    <View style={{ flex: 1 }}>
      {/* Indicador de estado WebSocket - SIEMPRE VISIBLE en todas las pantallas */}
      <SocketStatus
        isConnected={connected}
        connectionStatus={connectionStatus}
        reconnectAttempts={reconnectAttempts}
      />

      {/* Screens encima */}
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          key={showPanel ? "tabs-with-panel" : "tabs-no-panel"}
          initialRouteName={initialTab}
          barStyle={{
            display: "none",
            height: 0,
            width: 0,
            opacity: 0,
            position: "absolute",
            elevation: 0,
            shadowOpacity: 0,
          }}
          labeled={false}
          activeColor="#C41E3A"
          inactiveColor="#AAAAAA"
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              display: "none",
              height: 0,
              opacity: 0,
              position: "absolute",
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        >
          {/* Panel a la izquierda de Inicio (solo con permiso) */}
          {showPanel && (
            <Tab.Screen name="Panel" component={PanelGestionScreen} />
          )}
          <Tab.Screen name="Inicio" component={InicioScreen} />
          <Tab.Screen name="Ordenes" component={OrdenesScreen} />
          <Tab.Screen name="Pagos" component={PagosScreen} />
          <Tab.Screen name="Mas" component={MasScreen} />
        </Tab.Navigator>
      </View>

      {/* Contenedor con fondo rojo para evitar espacios negros */}
      <View style={{ backgroundColor: navBgColor }}>
        <BottomNavBar
          activeIndex={currentIndex}
          activeRoute={activeRoute}
          showPanel={showPanel}
        />
      </View>
    </View>
  );
};

// Componente wrapper — usa el SocketProvider de App.js (NO anidar otro)
const Navbar = () => {
  return <NavbarContent />;
};

export default Navbar;
