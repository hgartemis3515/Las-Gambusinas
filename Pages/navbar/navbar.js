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
        <Tab.Screen name="Second" component={SecondScreen} options={{ tabBarLabel: 'Pedido' }} />
        <Tab.Screen name="Third" component={ThirdScreen} options={{ tabBarLabel: 'Buscar'}} />
        <Tab.Screen name="Cuarter" component={CuarterScreen} options={{ tabBarLabel: 'Mesas'}} />
      </Tab.Navigator>
  );
};

export default Navbar;
