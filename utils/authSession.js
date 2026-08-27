import AsyncStorage from '@react-native-async-storage/async-storage';

/** Claves de sesión (no incluye apiConfig: la URL del servidor debe sobrevivir al logout). */
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

export async function clearAuthSession() {
  await AsyncStorage.multiRemove(SESSION_LOGOUT_KEYS);
}

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
