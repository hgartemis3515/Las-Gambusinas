import React from "react";
import { createMaterialBottomTabNavigator } from '@react-navigation/material-bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";
import CasaScreen from "./screens/CasaScreen";
import OrdenesScreen from "./screens/OrdenesScreen";
import CuarterScreen from "./screens/CuarterScreen";
import MasScreen from "./screens/MasScreen";

const Tab = createMaterialBottomTabNavigator();

const Navbar = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  
  return (
      <Tab.Navigator
        activeColor={theme.colors.primary}
        inactiveColor={theme.colors.text.light}
        barStyle={{ backgroundColor: theme.colors.surface }}
      >
        <Tab.Screen 
          name="Casa" 
          component={CasaScreen} 
          options={{ 
            tabBarLabel: 'Casa', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" color={color} size={26} />
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
          name="Mesas" 
          component={CuarterScreen} 
          options={{ 
            tabBarLabel: 'Mesas', 
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="table-picnic" color={color} size={26} />
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
