/**
 * Configuración de API - Sistema Dinámico
 * Compatible con código existente, ahora usa configuración dinámica
 * 
 * Las constantes ahora se generan dinámicamente desde apiConfig singleton
 * para permitir configuración desde UI sin recompilar
 */

import apiConfig from './config/apiConfig';

// Función helper para obtener endpoint completo
const getEndpoint = (path) => {
  try {
    if (apiConfig.isConfigured && apiConfig.baseURL) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${apiConfig.baseURL}${cleanPath}`;
    }
  } catch (error) {
    console.warn('[apiConfig] Error obteniendo endpoint dinámico:', error);
  }
  
  // Fallback a valores por defecto si no está configurado
  const defaultBase = 'http://192.168.18.11:3000/api';
  return `${defaultBase}${path.startsWith('/') ? path : `/${path}`}`;
};

// Función helper para obtener endpoint dinámico (se actualiza en tiempo real)
const getDynamicEndpoint = (path) => {
  return getEndpoint(path);
};

// Exportar constantes como strings (compatibilidad total con código existente)
// NOTA: Estas se evalúan al momento de importar el módulo
// Si cambias la configuración después, estas constantes NO se actualizarán automáticamente
// Para valores dinámicos que se actualicen en tiempo real, usar:
// - apiConfig.getEndpoint('/path') directamente
// - Las funciones helper getLoginAuthAPI(), etc.
export const LOGIN_AUTH_API = getEndpoint('/mozos/auth');
export const COMANDA_API = getEndpoint('/comanda');
export const DISHES_API = getEndpoint('/platos');
export const COMANDASEARCH_API_GET = getEndpoint('/comanda');
export const SELECTABLE_API_GET = getEndpoint('/mesas');
export const MESAS_API_UPDATE = getEndpoint('/mesas');
export const COMANDA_API_SEARCH_BY_DATE = getEndpoint('/comanda/fecha');
export const AREAS_API = getEndpoint('/areas');
export const BOUCHER_API = getEndpoint('/boucher');
export const CLIENTES_API = getEndpoint('/clientes');

// Funciones helper para obtener endpoints dinámicos (se actualizan en tiempo real)
// Usar estas cuando necesites valores que se actualicen después de cambiar la configuración
export const getLoginAuthAPI = () => getDynamicEndpoint('/mozos/auth');
export const getComandaAPI = () => getDynamicEndpoint('/comanda');
export const getDishesAPI = () => getDynamicEndpoint('/platos');
export const getComandaSearchAPI = () => getDynamicEndpoint('/comanda');
export const getSelectableAPI = () => getDynamicEndpoint('/mesas');
export const getMesasAPIUpdate = () => getDynamicEndpoint('/mesas');
export const getComandaSearchByDateAPI = () => getDynamicEndpoint('/comanda/fecha');
export const getAreasAPI = () => getDynamicEndpoint('/areas');
export const getBoucherAPI = () => getDynamicEndpoint('/boucher');
export const getClientesAPI = () => getDynamicEndpoint('/clientes');

// Exportar apiConfig para uso directo
export { default as apiConfig } from './config/apiConfig';

// Función helper para obtener la URL base del servidor (sin /api)
// Útil para Socket.io
export const getServerBaseURL = () => {
  if (apiConfig.isConfigured && apiConfig.baseURL) {
    try {
      const url = new URL(apiConfig.baseURL);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.warn('[apiConfig] Error parseando URL:', error);
    }
  }
  return 'http://192.168.18.11:3000';
};

// Función helper para obtener WebSocket URL
export const getWebSocketURL = () => {
  if (apiConfig.isConfigured && apiConfig.wsURL) {
    return apiConfig.wsURL;
  }
  return 'http://192.168.18.11:3000';
};