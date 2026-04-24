/**
 * Valores por defecto de API / WebSocket.
 * Prioridad: variables EXPO_PUBLIC_* del .env (Expo las inyecta al bundlear).
 * Fallback: misma LAN que appcocina/backend en este proyecto.
 */

const FALLBACK_API_BASE = 'http://192.168.50.153:3000/api';

/**
 * @returns {string} URL base del API (debe incluir /api)
 */
export const getFallbackApiBase = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (fromEnv && fromEnv.includes('/api')) {
    return fromEnv.replace(/\/$/, '');
  }
  return FALLBACK_API_BASE;
};

/**
 * Origen del servidor para Socket.io (http(s)://host:puerto, sin path)
 * @returns {string}
 */
export const getFallbackServerOrigin = () => {
  const fromEnv = process.env.EXPO_PUBLIC_WS_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  try {
    const u = new URL(getFallbackApiBase());
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://192.168.50.153:3000';
  }
};
