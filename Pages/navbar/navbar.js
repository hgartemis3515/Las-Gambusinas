import React from "react";
import { createMaterialBottomTabNavigator } from '@react-navigation/material-bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";
import InicioScreen from "./screens/InicioScreen";
import OrdenesScreen from "./screens/OrdenesScreen";
import PagosScreen from "./screens/PagosScreen";
import MasScreen from "./screens/MasScreen";

const Tab = createMaterialBottomTabNavigator();

const Navbar = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  
  return (
      <Tab.Navigator
        initialRouteName="Inicio"
        activeColor={theme.colors.primary}
        inactiveColor={theme.colors.text.light}
        barStyle={{ backgroundColor: theme.colors.surface }}
      >
        <Tab.Screen 
          name="Inicio" 
          component={InicioScreen} 
          options={{ 
            tabBarLabel: 'Inicio', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="table-picnic" color={color} size={26} />
            ),
          }} 
        />
        <Tab.Screen 
          name="Ordenes" 
          component={OrdenesScreen} 
          options={{ 
            tabBarLabel: 'Ordenes', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="notebook-edit" color={color} size={26} />
            ),
          }} 
        />
        <Tab.Screen 
          name="Pagos" 
          component={PagosScreen} 
          options={{ 
            tabBarLabel: 'Pagos', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cash-multiple" color={color} size={26} />
            ),
          }} 
        />
        <Tab.Screen 
          name="Mas" 
          component={MasScreen} 
          options={{ 
            tabBarLabel: 'Más', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="dots-horizontal" color={color} size={26} />
            ),
          }} 
        />
      </Tab.Navigator>
  );
};

export default Navbar;
