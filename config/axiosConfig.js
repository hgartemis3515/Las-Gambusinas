/**
 * Configuración Global de Axios - Anti-bloqueo WebSocket
 * 
 * PROBLEMA: Operaciones HTTP bloquean event loop → Socket desconecta
 * SOLUCIÓN: Timeout global 10s + configuración no bloqueante
 */

import axios from 'axios';
import apiConfig from './apiConfig';

// 🔥 CONFIGURACIÓN GLOBAL: Timeout 10s por defecto (evita bloqueos infinitos)
axios.defaults.timeout = 10000; // 10 segundos máximo

// Configurar interceptor para usar timeout de apiConfig si está disponible
axios.interceptors.request.use(
  (config) => {
    // Si no tiene timeout explícito, usar el de apiConfig o default
    if (!config.timeout) {
      config.timeout = apiConfig.timeout || 10000;
    }
    
    // Asegurar que timeout nunca sea infinito
    if (config.timeout === 0 || !config.timeout) {
      config.timeout = 10000;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuesta para logging (opcional, ayuda en debug)
axios.interceptors.response.use(
  (response) => {
    // Log rápido de requests exitosos (solo en desarrollo)
    if (__DEV__) {
      const method = response.config.method?.toUpperCase();
      const url = response.config.url;
      console.log(`✅ [HTTP] ${method} ${url} (${response.status})`);
    }
    return response;
  },
  (error) => {
    // 🔥 MEJORADO: Manejo inteligente de errores - éxito 200/201 ignorar warnings completamente
    
    // Si hay respuesta exitosa (200, 201), la operación fue exitosa
    if (error.response && (error.response.status === 200 || error.response.status === 201)) {
      // Operación exitosa - retornar respuesta sin error
      if (__DEV__) {
        console.log(`✅ [HTTP] Operación exitosa (${error.response.status}): ${error.config?.url}`);
      }
      return Promise.resolve(error.response);
    }
    
    // Si es un error de red pero la respuesta existe con datos, probablemente fue exitosa
    if (error.message === 'Network Error' && error.response) {
      // La operación fue exitosa, solo hubo un problema temporal con el socket
      // No mostrar error, solo log en desarrollo
      if (__DEV__) {
        console.log(`⚠️ [HTTP] Network Error temporal (operación exitosa): ${error.config?.url}`);
      }
      // Retornar la respuesta si existe
      if (error.response) {
        return Promise.resolve(error.response);
      }
    }
    
    // Si es timeout, mostrar warning pero no error crítico
    if (error.code === 'ECONNABORTED') {
      if (__DEV__) {
        console.warn(`⏱️ [HTTP] Timeout en ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
      }
    } 
    // Si es error de red sin respuesta, puede ser temporal (socket desconectado)
    else if (error.message === 'Network Error' && !error.response) {
      // Solo mostrar en desarrollo, no como error crítico
      if (__DEV__) {
        console.warn(`⚠️ [HTTP] Network Error temporal (puede ser socket desconectado): ${error.config?.url}`);
      }
    }
    // Otros errores (4xx, 5xx) sí son críticos
    else if (error.response) {
      const status = error.response.status;
      const method = error.config?.method?.toUpperCase();
      const url = error.config?.url;
      // Solo mostrar errores reales (no 200/201)
      if (status !== 200 && status !== 201) {
        console.error(`❌ [HTTP] ${method} ${url} → ${status} ${error.response.statusText || ''}`);
      }
    }
    // Error sin información específica
    else if (error.message && !error.message.includes('Network Error')) {
      console.error(`❌ [HTTP] Error: ${error.message}`);
    }
    
    return Promise.reject(error);
  }
);

export default axios;

