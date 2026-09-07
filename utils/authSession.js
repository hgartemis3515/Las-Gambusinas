import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigationRef';
import { isJwtExpired } from './jwtExpiry';

/** Claves de sesión (no incluye apiConfig ni el último nombre de login). */
export const SESSION_LOGOUT_KEYS = [
  'user',
  'authToken',
  'mesaSeleccionada',
  'reservaActiva',
  'selectedPlates',
  'selectedPlatesIds',
  'cantidadesComanda',
  'additionalDetails',
  'vistaInicio',
  '@lasgambusinas_config',
  'ultimoBoucher',
  'boucherParaImprimir',
  'mesaPago',
  'mesaPagada',
];

export const LAST_LOGIN_NOMBRE_KEY = 'lastLoginNombre';
export const LAST_REMEMBER_ME_KEY = 'lastRememberMe';

const sessionClearedListeners = new Set();
let logoutInFlight = false;

export function subscribeSessionCleared(fn) {
  sessionClearedListeners.add(fn);
  return () => sessionClearedListeners.delete(fn);
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove(SESSION_LOGOUT_KEYS);
}

export async function saveLastLoginNombre(nombre) {
  const n = String(nombre || '').trim();
  if (!n) return;
  await AsyncStorage.setItem(LAST_LOGIN_NOMBRE_KEY, n);
}

export async function getLastLoginNombre() {
  try {
    return (await AsyncStorage.getItem(LAST_LOGIN_NOMBRE_KEY)) || '';
  } catch {
    return '';
  }
}

export async function clearLastLoginNombre() {
  await AsyncStorage.removeItem(LAST_LOGIN_NOMBRE_KEY);
}

/** Token inválido/vencido: limpia sesión y vuelve al login (deja el nombre guardado). */
export async function logoutForInvalidToken() {
  if (logoutInFlight) return;
  logoutInFlight = true;
  try {
    const routeName = navigationRef.isReady()
      ? navigationRef.getCurrentRoute()?.name
      : null;
    await clearAuthSession();
    sessionClearedListeners.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    if (navigationRef.isReady() && routeName && routeName !== 'Login') {
      Alert.alert('Sesión expirada', 'Vuelve a ingresar con tu DNI.');
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  } catch (e) {
    console.warn('[AUTH] logoutForInvalidToken:', e?.message || e);
  } finally {
    setTimeout(() => { logoutInFlight = false; }, 1500);
  }
}

export { isJwtExpired };

/** host + puerto, para saber si cambió de servidor/IP. */
export function getServerIdentity(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url.trim());
    const host = (u.hostname || '').toLowerCase();
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return `${u.protocol}//${host}:${port}`;
  } catch {
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }
}

export function isSameServer(urlA, urlB) {
  const a = getServerIdentity(urlA);
  const b = getServerIdentity(urlB);
  if (!a || !b) return false;
  return a === b;
}
