import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { createMaterialBottomTabNavigator } from "@react-navigation/material-bottom-tabs";
import { useNavigationState } from "@react-navigation/native";
import BottomNavBar from "../../Components/BottomNavBar";
import InicioScreen from "./screens/InicioScreen";
import OrdenesScreen from "./screens/OrdenesScreen";
import PagosScreen from "./screens/PagosScreen";
import MasScreen from "./screens/MasScreen";
import { useTheme } from "../../context/ThemeContext";

const Tab = createMaterialBottomTabNavigator();

const Navbar = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { isDarkMode } = useTheme();
  
  // Color rojo según dark mode (igual que en BottomNavBar)
  const navBgColor = isDarkMode ? "#A11228" : "#C41E3A";

  // Obtener el estado del tab navigator desde el navigation state global
  const navigationState = useNavigationState((state) => {
    // Buscar el estado del tab navigator dentro del stack
    const navbarRoute = state?.routes?.find((r) => r.name === "Navbar");
    return navbarRoute?.state || null;
  });

  // Actualizar el índice cuando cambie el estado
  useEffect(() => {
    if (navigationState?.index !== undefined) {
      setCurrentIndex(navigationState.index);
    }
  }, [navigationState]);

  return (
    <View style={{ flex: 1 }}>
      {/* Screens encima */}
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          initialRouteName="Inicio"
          barStyle={{ 
            display: "none", 
            height: 0, 
            width: 0,
            opacity: 0,
            position: 'absolute',
            elevation: 0,
            shadowOpacity: 0,
          }}
          labeled={false}
          activeColor="#C41E3A"
          inactiveColor="#AAAAAA"
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              display: 'none',
              height: 0,
              opacity: 0,
              position: 'absolute',
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        >
          <Tab.Screen name="Inicio" component={InicioScreen} />
          <Tab.Screen name="Ordenes" component={OrdenesScreen} />
          <Tab.Screen name="Pagos" component={PagosScreen} />
          <Tab.Screen name="Mas" component={MasScreen} />
        </Tab.Navigator>
      </View>
      
      {/* Contenedor con fondo rojo para evitar espacios negros */}
      <View style={{ backgroundColor: navBgColor }}>
        {/* Custom Bottom NavBar - zIndex: 1 detrás del contenido */}
        <BottomNavBar activeIndex={currentIndex} />
      </View>
    </View>
  );
};

export default Navbar;
