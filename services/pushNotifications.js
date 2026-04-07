import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import apiConfig from '../config/apiConfig';

const PUSH_TOKEN_KEY = 'pushToken';
const CHANNEL_DEFAULT = 'default';
const CHANNEL_PLATO_LISTO = 'plato-listo';

export function configureNotificationBehavior() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_PLATO_LISTO, {
    name: 'Platos listos',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Obtiene token Expo Push (requiere dev build / EAS; en Expo Go también funciona con limitaciones).
 * Necesita `extra.eas.projectId` en app.json.
 */
export async function registerForExpoPushAsync() {
  if (Platform.OS === 'web') return null;

  await ensureAndroidChannels();

  if (!Device.isDevice) {
    console.log('[push] No hay token en simulador');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[push] Falta extra.eas.projectId en app.json');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushTokenString = tokenData.data;
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushTokenString);
  return pushTokenString;
}

export async function syncPushTokenToBackend(mozoId) {
  if (!mozoId || !apiConfig.isConfigured) return;
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;

  try {
    const url = apiConfig.getEndpoint('/mozos/push-token');
    const authToken = await AsyncStorage.getItem('authToken');
    await axios.post(
      url,
      {
        mozoId,
        pushToken: token,
        platform: Platform.OS,
      },
      {
        timeout: 5000,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }
    );
  } catch (e) {
    // Silenciar: el endpoint puede no existir aún (404) o el backend puede estar offline.
    // Solo loguear en dev si no es 404.
    if (__DEV__ && e?.response?.status !== 404) {
      console.log('[push] syncPushTokenToBackend:', e?.message);
    }
  }
}

export async function registerPushAfterLogin(mozoId) {
  const token = await registerForExpoPushAsync();
  if (token) await syncPushTokenToBackend(mozoId);
}

export function subscribeToNotificationResponses(navigationRef) {
  if (Platform.OS === 'web') {
    return { remove: () => {} };
  }
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    if (data.mesaId && navigationRef?.isReady?.()) {
      navigationRef.navigate('ComandaDetalle', {
        mesa: { _id: data.mesaId, numero: data.mesaNumero },
      });
    }
  });
  return sub;
}

/**
 * Abre la ficha de la app en ajustes (Android) para ajustar batería / notificaciones.
 */
export async function openBatteryOptimizationSettings() {
  if (Platform.OS !== 'android') return;
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    const pkg =
      Constants.expoConfig?.android?.package || 'com.carlos121.appmozo';
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS,
      {
        data: `package:${pkg}`,
      }
    );
  } catch (e) {
    console.warn('[push] No se pudo abrir ajustes de batería:', e?.message);
  }
}
