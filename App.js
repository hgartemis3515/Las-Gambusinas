import 'react-native-gesture-handler';
import './utils/registerGsapPlugins';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import Login from './Pages/Login/Login';
import Navbar from './Pages/navbar/navbar';
import ComandaDetalleScreen from './Pages/ComandaDetalleScreen';
import ProfileScreen from './Pages/Profile/ProfileScreen';
import HelpScreen from './Pages/Help/HelpScreen';
import AboutScreen from './Pages/About/AboutScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  configureNotificationBehavior,
  subscribeToNotificationResponses,
} from './services/pushNotifications';

if (Platform.OS !== 'web') {
  require('./tasks/backgroundFetchTask');
}

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function App() {
  useEffect(() => {
    configureNotificationBehavior();
    const sub = subscribeToNotificationResponses(navigationRef);
    if (Platform.OS !== 'web') {
      const { registerMozosBackgroundFetch } = require('./tasks/backgroundFetchTask');
      registerMozosBackgroundFetch().catch(() => {});
    }
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SocketProvider>
            <NavigationContainer ref={navigationRef}>
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
                <Stack.Screen
                  name="Profile"
                  component={ProfileScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Help"
                  component={HelpScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="About"
                  component={AboutScreen}
                  options={{ headerShown: false }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </SocketProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
