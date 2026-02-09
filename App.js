import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import Login from './Pages/Login/Login';
import Navbar from './Pages/navbar/navbar';
import ComandaDetalleScreen from './Pages/ComandaDetalleScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SocketProvider>
            <NavigationContainer>
              <Stack.Navigator 
                initialRouteName="Login"
                screenOptions={{
                  headerShown: false,
                }}
              >
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
                <Stack.Screen
                  name="ComandaDetalle"
                  component={ComandaDetalleScreen}
                  options={{
                    headerShown: false, // Header personalizado en el screen
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </SocketProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
