import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getFallbackApiBase, getFallbackServerOrigin } from './envDefaults';

/**
 * Sistema de Configuración Dinámica de API - Patrón Singleton
 * Inspirado en Square POS, Toast POS, Lightspeed Restaurant
 * 
 * Características:
 * - Configuración persistente en AsyncStorage
 * - Validación estricta de URLs
 * - Test de conexión antes de guardar
 * - Modo demo fallback
 * - Instancia única (Singleton)
 */
class ApiConfig {
  static instance = null;

  constructor() {
    if (ApiConfig.instance) {
      return ApiConfig.instance;
    }

    // Configuración por defecto
    this.baseURL = null;
    this.wsURL = null;
    this.apiVersion = 'v1';
    this.timeout = 10000;
    this.isConfigured = false;
    this.lastTestResult = null;
    this.lastTestTime = null;

    // Inicializar desde AsyncStorage
    this.init();

    ApiConfig.instance = this;
  }

  /**
   * Inicializar configuración desde AsyncStorage
   */
  async init() {
    try {
      const configJson = await AsyncStorage.getItem('apiConfig');
      if (configJson) {
        const config = JSON.parse(configJson);
        this.baseURL = config.baseURL;
        this.wsURL = config.wsURL;
        this.apiVersion = config.apiVersion || 'v1';
        this.timeout = config.timeout || 10000;
        this.isConfigured = !!this.baseURL && this.validateURL(this.baseURL);
        
        if (this.isConfigured) {
          console.log('✅ [ApiConfig] Configuración cargada desde AsyncStorage:', this.baseURL);
        } else {
          console.warn('⚠️ [ApiConfig] Configuración inválida, usando modo demo');
          this.setDemoConfig();
        }
      } else {
        // Si no hay configuración guardada, usar valores por defecto del apiConfig.js original
        // Esto permite compatibilidad con el código existente
        console.log('ℹ️ [ApiConfig] No hay configuración guardada, usando valores por defecto');
        this.setDefaultConfig();
      }
    } catch (error) {
      console.error('❌ [ApiConfig] Error al cargar configuración:', error);
      this.setDemoConfig();
    }
  }

  /**
   * Configuración por defecto (compatibilidad con código existente)
   */
  setDefaultConfig() {
    this.baseURL = getFallbackApiBase();
    this.wsURL = getFallbackServerOrigin();
    this.apiVersion = 'v1';
    this.timeout = 10000;
    this.isConfigured = true;
  }

  /**
   * Configuración demo (fallback)
   */
  setDemoConfig() {
    this.baseURL = 'https://demo.lasgambusinas.com/api';
    this.wsURL = 'wss://demo.lasgambusinas.com';
    this.apiVersion = 'v1';
    this.timeout = 10000;
    this.isConfigured = true;
    console.log('📦 [ApiConfig] Modo demo activado');
  }

  /**
   * Establecer nueva configuración
   * @param {Object} config - { baseURL, apiVersion?, timeout?, wsURL? }
   * @returns {boolean} - true si se guardó correctamente
   */
  async setConfig(config) {
    try {
      // Validar URL
      if (!this.validateURL(config.baseURL)) {
        throw new Error('URL de API inválida. Debe ser una URL válida que termine en /api o contenga /api');
      }

      this.baseURL = config.baseURL.trim();
      this.wsURL = config.wsURL || this.generateWsURL(config.baseURL);
      this.apiVersion = config.apiVersion || 'v1';
      this.timeout = config.timeout || 10000;
      this.isConfigured = true;

      // Guardar en AsyncStorage
      const configToSave = {
        baseURL: this.baseURL,
        wsURL: this.wsURL,
        apiVersion: this.apiVersion,
        timeout: this.timeout
      };

      await AsyncStorage.setItem('apiConfig', JSON.stringify(configToSave));
      console.log('✅ [ApiConfig] Configuración guardada:', this.baseURL);

      return true;
    } catch (error) {
      console.error('❌ [ApiConfig] Error al guardar configuración:', error);
      throw error;
    }
  }

  /**
   * Generar WebSocket URL desde baseURL
   */
  generateWsURL(baseURL) {
    try {
      const url = new URL(baseURL);
      // Convertir http -> ws, https -> wss
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}`;
    } catch (error) {
      // Si falla, intentar reemplazo simple
      return baseURL.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
    }
  }

  /**
   * Validar URL
   */
  validateURL(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      // Debe ser http o https
      if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
      // Debe tener hostname
      if (!urlObj.hostname) return false;
      // Debe terminar en /api o contener /api
      if (!url.includes('/api')) return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test de conexión al servidor
   * @param {string} testBaseURL - URL base opcional para test (si no se proporciona, usa this.baseURL)
   * @returns {Promise<{success: boolean, message: string, latency?: number}>}
   */
  async testConnection(testBaseURL = null) {
    const urlToTest = testBaseURL || this.baseURL;
    
    if (!urlToTest) {
      return {
        success: false,
        message: 'API no configurada'
      };
    }

    // Validar URL primero
    if (!this.validateURL(urlToTest)) {
      return {
        success: false,
        message: 'URL inválida. Debe ser una URL válida que contenga /api'
      };
    }

    try {
      const startTime = Date.now();
      
      // Intentar hacer un ping al endpoint de mozos (endpoint simple que siempre existe)
      const testURL = `${urlToTest}/mozos`;
      const response = await axios.get(testURL, {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Aceptar cualquier status < 500 como éxito
      });

      const latency = Date.now() - startTime;
      this.lastTestResult = { success: true, latency };
      this.lastTestTime = new Date();

      return {
        success: true,
        message: `Conexión exitosa (${latency}ms)`,
        latency
      };
    } catch (error) {
      this.lastTestResult = { success: false, error: error.message };
      this.lastTestTime = new Date();

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Servidor no accesible. Verifica la URL y que el servidor esté corriendo.'
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          message: 'Servidor no encontrado. Verifica la URL.'
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Timeout. El servidor no responde.'
        };
      } else {
        return {
          success: false,
          message: error.message || 'Error de conexión'
        };
      }
    }
  }

  /**
   * Obtener headers estándar
   */
  get headers() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Api-Version': this.apiVersion,
    };
  }

  /**
   * Obtener instancia de axios configurada
   */
  get axiosInstance() {
    if (!this.isConfigured || !this.baseURL) {
      throw new Error('API no configurada. Por favor, configura el servidor en Ajustes.');
    }

    return axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: this.headers
    });
  }

  /**
   * Obtener URL completa para un endpoint
   */
  getEndpoint(path) {
    if (!this.isConfigured || !this.baseURL) {
      throw new Error('API no configurada');
    }
    
    // Asegurar que path empiece con /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }

  /**
   * Resetear configuración
   */
  async reset() {
    await AsyncStorage.removeItem('apiConfig');
    this.baseURL = null;
    this.wsURL = null;
    this.isConfigured = false;
    this.lastTestResult = null;
    this.lastTestTime = null;
    this.setDefaultConfig();
    console.log('🔄 [ApiConfig] Configuración reseteada');
  }

  /**
   * Obtener información de configuración actual
   */
  getInfo() {
    return {
      baseURL: this.baseURL,
      wsURL: this.wsURL,
      apiVersion: this.apiVersion,
      timeout: this.timeout,
      isConfigured: this.isConfigured,
      lastTestResult: this.lastTestResult,
      lastTestTime: this.lastTestTime
    };
  }
}

// Exportar instancia única (Singleton)
const apiConfig = new ApiConfig();

export default apiConfig;

