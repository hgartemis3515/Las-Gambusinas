import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import apiConfig from '../config/apiConfig';

const PUSH_TOKEN_KEY = 'pushToken';
export const PUSH_NOTIFICATIONS_PREF_KEY = 'mozos_push_notifications_enabled';

// --- Sub-preferencias de notificaciones ---
export const PUSH_PREF_PLATO_LISTO = 'mozos_push_plato_listo';
export const PUSH_PREF_PLATO_SALIO = 'mozos_push_plato_salio';
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

/** SALIO: Preferencia: notificar cuando un plato cambia a "salio" (salió de cocina) */
export async function getPushPlatoSalioEnabled() {
  const v = await AsyncStorage.getItem(PUSH_PREF_PLATO_SALIO);
  if (v === null) return true;
  return v === 'true';
}

export async function setPushPlatoSalioEnabled(enabled) {
  await AsyncStorage.setItem(PUSH_PREF_PLATO_SALIO, enabled ? 'true' : 'false');
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
const CHANNEL_PLATO_LISTO = 'plato-listo-heads-up';
const CHANNEL_PLATO_SALIO = 'plato-salio-heads-up';

const isExpoGo = isRunningInExpoGo();

/**
 * En Expo Go Android (SDK 53+) el import de expo-notifications ejecuta
 * addPushTokenListener y lanza. No cargar el módulo ahí.
 */
function getNotifications() {
  if (isExpoGo || Platform.OS === 'web') return null;
  return require('expo-notifications');
}

if (isExpoGo) {
  console.log('[push] Expo Go: sin expo-notifications (push remoto no soportado)');
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

/** Siempre local: Honor/Huawei a menudo no entrega FCM; el socket cubre primer plano y segundo plano con JS vivo. */
export async function shouldUseLocalPlatoListoPush() {
  return true;
}

export function buildPlatoListoMessage(nombrePlato, mesaNumero, comandaNumber) {
  const nombre = nombrePlato || 'Un plato';
  const mesa = mesaNumero != null && mesaNumero !== '' ? mesaNumero : '?';
  const num = comandaNumber != null && comandaNumber !== '' ? `#${comandaNumber}` : null;
  if (num) return `${nombre} listo para recoger. Comanda ${num}. Mesa ${mesa}`;
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
  const ok = await shouldNotifyMozoAsignado({ comanda: data.comanda, mozoId: data.mozoId });
  if (!ok) return;

  const comandaId = data.comandaId?.toString?.() || data.comandaId;
  const platoId = data.platoId?.toString?.() || data.platoId;

  const mesaNumero =
    data.mesaNumero ?? data.comanda?.mesas?.nummesa ?? data.comanda?.mesas?.numero ?? null;
  const comandaNumber =
    data.comandaNumber ?? data.comanda?.comandaNumber ?? null;
  const nombrePlato =
    data.platoNombre ||
    findNombrePlatoEnComanda(data.comanda, platoId) ||
    'Un plato';

  const title = comandaNumber != null ? `🍽️ Plato listo · #${comandaNumber}` : '🍽️ Plato Listo';
  await showLocalPush(
    title,
    buildPlatoListoMessage(nombrePlato, mesaNumero, comandaNumber),
    {
      mesaId: data.mesaId,
      mesaNumero,
      mozoId: data.mozoId,
      platoId,
      platoNombre: nombrePlato,
      type: 'plato-listo',
      comandaId,
      comandaNumber,
    },
    CHANNEL_PLATO_LISTO,
    'plato',
    { comanda: data.comanda, mozoId: data.mozoId }
  );
}

/** SALIO: mensaje de notificación cuando el plato sale de cocina */
export function buildPlatoSalioMessage(nombrePlato, mesaNumero) {
  const nombre = nombrePlato || 'Un plato';
  const mesa = mesaNumero != null && mesaNumero !== '' ? mesaNumero : '?';
  return `${nombre} salió de cocina. Mesa ${mesa}`;
}

/**
 * SALIO: Punto único de notificación local cuando un plato sale de cocina (recoger → salio).
 * Diferenciado del "plato listo": indica al mozo que ya puede entregar al comensal.
 */
export async function notifyPlatoSalioLocal(data) {
  if (!(await getPushPlatoSalioEnabled())) return;

  const ok = await shouldNotifyMozoAsignado({ comanda: data.comanda, mozoId: data.mozoId });
  if (!ok) return;

  const comandaId = data.comandaId?.toString?.() || data.comandaId;
  const platoId = data.platoId?.toString?.() || data.platoId;

  const mesaNumero =
    data.mesaNumero ?? data.comanda?.mesas?.nummesa ?? data.comanda?.mesas?.numero ?? null;
  const nombrePlato =
    data.platoNombre ||
    findNombrePlatoEnComanda(data.comanda, platoId) ||
    'Un plato';

  await showLocalPush(
    '🚶 Plato Salió de Cocina',
    buildPlatoSalioMessage(nombrePlato, mesaNumero),
    {
      mesaId: data.mesaId,
      mesaNumero,
      mozoId: data.mozoId,
      platoId,
      platoNombre: nombrePlato,
      type: 'plato-salio',
      comandaId,
    },
    CHANNEL_PLATO_SALIO,
    'plato-salio',
    { comanda: data.comanda, mozoId: data.mozoId }
  );
}

export function configureNotificationBehavior() {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      let shouldPlaySound = true;
      try {
        shouldPlaySound = await getPushSonidoEnabled();
      } catch (_) { /* default on */ }
      return {
        shouldShowAlert: true,
        shouldPlaySound,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

async function ensureAndroidChannels() {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    const channelOpts = {
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      sound: 'default',
      showBadge: true,
      enableLights: true,
      lightColor: '#C41E3A',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC,
    };
    await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
      name: 'General',
      description: 'Avisos generales de Gambusinas Mozos',
      ...channelOpts,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_PLATO_LISTO, {
      name: 'Platos listos',
      description: 'Cuando un plato está listo para recoger',
      ...channelOpts,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_PLATO_SALIO, {
      name: 'Platos salieron de cocina',
      description: 'Cuando un plato sale de cocina para entregar',
      ...channelOpts,
    });
  } catch (e) {
    console.warn('[push] Error creando canales de notificación:', e?.message);
  }
}

export async function getNotificationPermissionStatus() {
  const Notifications = getNotifications();
  if (!Notifications) return { granted: false, status: 'undetermined' };
  try {
    const { status, granted } = await Notifications.getPermissionsAsync();
    return { granted: granted || status === 'granted', status };
  } catch {
    return { granted: false, status: 'undetermined' };
  }
}

async function requestNativeNotificationPermissions() {
  const Notifications = getNotifications();
  if (!Notifications) return { status: 'undetermined', granted: false };
  if (Platform.OS === 'ios') {
    return Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }
  return Notifications.requestPermissionsAsync();
}

export async function registerForExpoPushAsync() {
  const Notifications = getNotifications();
  if (!Notifications) {
    if (isExpoGo) console.log('[push] Saltando registro de push token en Expo Go (SDK 53+)');
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
    const { status } = await requestNativeNotificationPermissions();
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
  const Notifications = getNotifications();
  if (!Notifications) {
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
  const Notifications = getNotifications();
  if (!Notifications) return;

  if (data?.comandaId && data?.platoId && (type === 'plato' || type === 'plato-salio')) {
    const prefix = type === 'plato-salio' ? 'plato-salio' : 'plato';
    const key = `${prefix}-${data.comandaId}-${data.platoId}`;
    const now = Date.now();
    if (recentLocalPush.get(key) && now - recentLocalPush.get(key) < LOCAL_DEDUPE_MS) return;
    recentLocalPush.set(key, now);
  }

  const { comanda, mozoId } = options;
  if (type !== 'test') {
    const allowed = await shouldNotifyMozoAsignado({ comanda, mozoId: mozoId || data?.mozoId });
    if (!allowed) return;
  }

  if (type === 'plato') {
    const enabled = await getPushPlatoListoEnabled();
    if (!enabled) return;
  } else if (type === 'plato-salio') {
    const enabled = await getPushPlatoSalioEnabled();
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
        channelId: Platform.OS === 'android' ? channelId : undefined,
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: 'timeSensitive',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[push] Error mostrando notificación local:', e?.message);
  }
}

export async function sendTestLocalNotification() {
  if (!getNotifications()) return;
  await ensureAndroidChannels();
  await showLocalPush(
    '🔔 Prueba de notificación',
    'Si ves esto, los avisos del sistema están activos en este teléfono.',
    { type: 'test' },
    CHANNEL_DEFAULT,
    'test'
  );
}

export function getOemPushHints() {
  const mfg = `${Device.manufacturer || ''} ${Device.brand || ''}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(mfg)) {
    return 'Xiaomi/Redmi/POCO: activa notificaciones, inicio automático y “Sin restricciones” de batería para Gambusinas.';
  }
  if (/honor|huawei/.test(mfg)) {
    return 'Honor/Huawei: permite notificaciones, inicio en segundo plano y protege la app en Recientes para que no la cierre el sistema.';
  }
  if (/oppo|realme|oneplus/.test(mfg)) {
    return 'OPPO/Realme: activa notificaciones y desactiva la optimización de batería para esta app.';
  }
  if (/vivo/.test(mfg)) {
    return 'Vivo: activa notificaciones y permite el autostart / alta prioridad en segundo plano.';
  }
  if (/samsung/.test(mfg)) {
    return 'Samsung: en Ajustes → Batería, no pongas la app en “Reposo profundo”.';
  }
  if (Platform.OS === 'ios') {
    return 'iPhone: permite Alertas, Sonido y Distintivos. Si las denegaste, actívalas en Ajustes → Notificaciones → appmozo.';
  }
  return 'Permite notificaciones y desactiva la optimización de batería para esta app si los avisos no llegan con la pantalla bloqueada.';
}

async function tryStartIntent(action, extras = {}) {
  const IntentLauncher = await import('expo-intent-launcher');
  await IntentLauncher.startActivityAsync(action, extras);
}

export async function openAppNotificationSettings() {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
    return;
  }
  if (Platform.OS !== 'android') return;
  const pkg = Constants.expoConfig?.android?.package || 'com.carlos121.appmozo';
  try {
    await tryStartIntent('android.settings.APP_NOTIFICATION_SETTINGS', {
      extra: {
        'android.provider.extra.APP_PACKAGE': pkg,
        app_package: pkg,
        app_uid: 0,
      },
    });
  } catch {
    await openAppDetailsSettings();
  }
}

export async function openAppDetailsSettings() {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
    return;
  }
  if (Platform.OS !== 'android') return;
  const pkg = Constants.expoConfig?.android?.package || 'com.carlos121.appmozo';
  const IntentLauncher = await import('expo-intent-launcher');
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS,
    { data: `package:${pkg}` }
  );
}

export async function openBatteryOptimizationSettings() {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
    return;
  }
  if (Platform.OS !== 'android') return;
  try {
    await tryStartIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch (e) {
    console.warn('[push] No se pudo abrir ajustes de batería:', e?.message);
    await openAppDetailsSettings();
  }
}

export async function openAutostartSettingsIfAvailable() {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  const pkg = Constants.expoConfig?.android?.package || 'com.carlos121.appmozo';
  const mfg = `${Device.manufacturer || ''} ${Device.brand || ''}`.toLowerCase();
  const IntentLauncher = await import('expo-intent-launcher');
  const attempts = [];
  if (/xiaomi|redmi|poco/.test(mfg)) {
    attempts.push({
      action: 'android.intent.action.MAIN',
      className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
      packageName: 'com.miui.securitycenter',
    });
  }
  if (/honor|huawei/.test(mfg)) {
    attempts.push({
      action: 'android.intent.action.MAIN',
      className: 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity',
      packageName: 'com.huawei.systemmanager',
    });
    attempts.push({
      action: 'android.intent.action.MAIN',
      className: 'com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity',
      packageName: 'com.hihonor.systemmanager',
    });
  }
  for (const spec of attempts) {
    try {
      await IntentLauncher.startActivityAsync(spec.action, {
        className: spec.className,
        packageName: spec.packageName,
      });
      return;
    } catch (_) { /* probar siguiente */ }
  }
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ACTION_APPLICATION_DETAILS_SETTINGS,
    { data: `package:${pkg}` }
  );
}