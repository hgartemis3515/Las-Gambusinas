import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Login from './Pages/Login/Login';
import Navbar from './Pages/navbar/navbar';

const Stack = createStackNavigator();


export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouterName="Login">
        <Stack.Screen
        name="Login"
        component={Login}
        options={{ headerShown: false }}
        />
        <Stack.Screen
        name="Navbar"
        component={Navbar}
        options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
