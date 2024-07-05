import React from "react";
import { createMaterialBottomTabNavigator } from '@react-navigation/material-bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SecondScreen from "./screens/SecondScreen";
import ThirdScreen from "./screens/ThridScreen";
import CuarterScreen from "./screens/CuarterScreen";


const Tab = createMaterialBottomTabNavigator();

const Navbar = () => {
  return (
      <Tab.Navigator>
        <Tab.Screen name="Second" component={SecondScreen} options={{ tabBarLabel: 'Pedido', tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="notebook-edit" color={color} size={28} style={{marginTop: -2}} />
          ),
        }} />
        <Tab.Screen name="Third" component={ThirdScreen} options={{ tabBarLabel: 'Buscar', tabBarIcon: ({ color }) => (
          <MaterialCommunityIcons name="clipboard-text-search" color={color} size={28} style={{marginTop: -2}}/>
        ),}} />
        <Tab.Screen name="Cuarter" component={CuarterScreen} options={{ tabBarLabel: 'Mesas', tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="table-picnic" color={color} size={28} style={{marginTop: -2}} />
          ),
        }} />
      </Tab.Navigator>
  );
};

export default Navbar;
