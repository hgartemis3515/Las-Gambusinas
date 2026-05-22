import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import apiConfig from '../config/apiConfig';

const PUSH_TOKEN_KEY = 'pushToken';
export const PUSH_NOTIFICATIONS_PREF_KEY = 'mozos_push_notifications_enabled';

// --- Sub-preferencias de notificaciones ---
export const PUSH_PREF_PLATO_LISTO = 'mozos_push_plato_listo';
export const PUSH_PREF_COMANDA_LISTA = 'mozos_push_comanda_lista';
export const PUSH_PREF_SONIDO = 'mozos_push_sonido';
export const PUSH_PREF_VIBRACION = 'mozos_push_vibracion';

/** Preferencia global: push habilitado/deshabilitado */
export async function getPushNotificationsPrefEnabled() {
  const v = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_PREF_KEY);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushNotificationsPrefEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_NOTIFICATIONS_PREF_KEY, enabled ? 'true' : 'false');
}

/** Preferencia: notificar cuando un plato cambia a "recoger" */
export async function getPushPlatoListoEnabled() {
  const v = await AsyncStorage.getItem(PUSH_PREF_PLATO_LISTO);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushPlatoListoEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_PREF_PLATO_LISTO, enabled ? 'true' : 'false');
}

/** Preferencia: notificar cuando una comanda entera cambia a "recoger" */
export async function getPushComandaListaEnabled() {
  const v = await AsyncStorage.getItem(PUSH_PREF_COMANDA_LISTA);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushComandaListaEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_PREF_COMANDA_LISTA, enabled ? 'true' : 'false');
}

/** Preferencia: sonido en notificaciones */
export async function getPushSonidoEnabled() {
  const v = await AsyncStorage.getItem(PUSH_PREF_SONIDO);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushSonidoEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_PREF_SONIDO, enabled ? 'true' : 'false');
}

/** Preferencia: vibración en notificaciones */
export async function getPushVibracionEnabled() {
  const v = await AsyncStorage.getItem(PUSH_PREF_VIBRACION);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushVibracionEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_PREF_VIBRACION, enabled ? 'true' : 'false');
}

const CHANNEL_DEFAULT = 'default';
const CHANNEL_PLATO_LISTO = 'plato-listo';

const isExpoGo = Constants.appOwnership === 'expo';

if (isExpoGo) {
  console.log('[push] Ejecutando en Expo Go - push notifications remotas no disponibles (SDK 53+)');
}

export function isExpoGoPushLimited() {
  return isExpoGo;
}

export async function getCurrentMozoId() {
  try {
    const userRaw = await AsyncStorage.getItem('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    return user?._id?.toString() || null;
  } catch {
    return null;
  }
}

/** Solo el mozo asignado a la comanda debe recibir alertas de "listo para recoger" */
export async function shouldNotifyMozoAsignado({ comanda, mozoId } = {}) {
  const myId = await getCurrentMozoId();
  if (!myId) return true;
  const assigned = mozoId || comanda?.mozos?._id || comanda?.mozos;
  if (!assigned) return true;
  return assigned.toString() === myId;
}

/** Comanda lista en cocina: todos los platos activos en estado recoger */
export function isComandaListaEnCocina(comanda) {
  const activos = (comanda?.platos || []).filter(p => !p.eliminado && !p.anulado);
  if (activos.length === 0) return false;
  return activos.every(p => (p.estado || '').toLowerCase() === 'recoger');
}

const recentLocalPush = new Map();
const LOCAL_DEDUPE_MS = 10000;

/** Con token Expo registrado, la push remota del backend basta (evita duplicado) */
export async function shouldUseLocalPlatoListoPush() {
  if (isExpoGo) return true;
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  return !token;
}

export function buildPlatoListoMessage(nombrePlato, mesaNumero) {
  const nombre = nombrePlato || 'Un plato';
  const mesa = mesaNumero != null && mesaNumero !== '' ? mesaNumero : '?';
  return `${nombre} listo para recoger. Mesa ${mesa}`;
}

function findNombrePlatoEnComanda(comanda, platoId) {
  const target = platoId?.toString?.() || String(platoId);
  for (const p of comanda?.platos || []) {
    const subId = p._id?.toString?.();
    const catalogId = p.plato?._id?.toString?.() || p.plato?.toString?.();
    if ((subId && subId === target) || (catalogId && catalogId === target)) {
      return p.plato?.nombre || p.nombre || null;
    }
  }
  return null;
}

/**
 * Único punto de notificación local por plato listo (Expo Go / sin token remoto).
 */
export async function notifyPlatoListoLocal(data) {
  if (!(await shouldUseLocalPlatoListoPush())) return;

  const ok = await shouldNotifyMozoAsignado({ comanda: data.comanda, mozoId: data.mozoId });
  if (!ok) return;

  const comandaId = data.comandaId?.toString?.() || data.comandaId;
  const platoId = data.platoId?.toString?.() || data.platoId;
  const key = `plato-${comandaId}-${platoId}`;
  const now = Date.now();
  if (recentLocalPush.get(key) && now - recentLocalPush.get(key) < LOCAL_DEDUPE_MS) return;
  recentLocalPush.set(key, now);

  const mesaNumero =
    data.mesaNumero ?? data.comanda?.mesas?.nummesa ?? data.comanda?.mesas?.numero ?? null;
  const nombrePlato =
    data.platoNombre ||
    findNombrePlatoEnComanda(data.comanda, platoId) ||
    'Un plato';

  await showLocalPush(
    '🍽️ Plato Listo',
    buildPlatoListoMessage(nombrePlato, mesaNumero),
    {
      mesaId: data.mesaId,
      mesaNumero,
      mozoId: data.mozoId,
      platoId,
      platoNombre: nombrePlato,
      type: 'plato-listo',
      comandaId,
    },
    CHANNEL_PLATO_LISTO,
    'plato',
    { comanda: data.comanda, mozoId: data.mozoId }
  );
}

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
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_PLATO_LISTO, {
      name: 'Platos listos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (e) {
    console.warn('[push] Error creando canales de notificación:', e?.message);
  }
}

export async function registerForExpoPushAsync() {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) {
    console.log('[push] Saltando registro de push token en Expo Go (SDK 53+)');
    return null;
  }
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
      { mozoId, pushToken: token, platform: Platform.OS },
      { timeout: 5000, headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
    );
  } catch (e) {
    if (__DEV__ && e?.response?.status !== 404) {
      console.log('[push] syncPushTokenToBackend:', e?.message);
    }
  }
}

export async function registerPushAfterLogin(mozoId) {
  const allowed = await getPushNotificationsPrefEnabled();
  if (!allowed) return;
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
 * Muestra una notificación local del sistema.
 * Respeta preferencias de tipo, sonido y vibración.
 *
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 * @param {string} [channelId]
 * @param {'plato'|'comanda'} [type] - Filtra por preferencia de tipo
 */
export async function showLocalPush(title, body, data = {}, channelId = CHANNEL_PLATO_LISTO, type = 'plato', options = {}) {
  if (Platform.OS === 'web') return;

  if (type === 'plato' && data?.comandaId && data?.platoId) {
    const key = `plato-${data.comandaId}-${data.platoId}`;
    const now = Date.now();
    if (recentLocalPush.get(key) && now - recentLocalPush.get(key) < LOCAL_DEDUPE_MS) return;
    recentLocalPush.set(key, now);
  }

  const { comanda, mozoId } = options;
  const allowed = await shouldNotifyMozoAsignado({ comanda, mozoId: mozoId || data?.mozoId });
  if (!allowed) return;

  if (type === 'plato') {
    const enabled = await getPushPlatoListoEnabled();
    if (!enabled) return;
  } else if (type === 'comanda') {
    const enabled = await getPushComandaListaEnabled();
    if (!enabled) return;
  }

  const globalEnabled = await getPushNotificationsPrefEnabled();
  if (!globalEnabled) return;

  const shouldSound = await getPushSonidoEnabled();
  const shouldVibrate = await getPushVibracionEnabled();

  try {
    if (shouldVibrate) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    }

    await ensureAndroidChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: shouldSound ? 'default' : null,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[push] Error mostrando notificación local:', e?.message);
  }
}

export async function openBatteryOptimizationSettings() {
  if (Platform.OS !== 'android') return;
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    const pkg = Constants.expoConfig?.android?.package || 'com.carlos121.appmozo';
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS,
      { data: `package:${pkg}` }
    );
  } catch (e) {
    console.warn('[push] No se pudo abrir ajustes de batería:', e?.message);
  }
}