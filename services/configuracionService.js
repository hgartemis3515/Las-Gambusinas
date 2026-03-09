/**
 * Servicio de Configuración - App Mozos Las Gambusinas
 * 
 * Gestiona la configuración del sistema con caché en AsyncStorage
 * Centraliza los cálculos de IGV y formateo de moneda
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { apiConfig } from '../apiConfig';

const CONFIG_CACHE_KEY = '@lasgambusinas_config';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cachedConfig = null;
let lastFetchTime = 0;

/**
 * Obtiene la configuración del sistema desde el backend
 * Utiliza caché para evitar múltiples llamadas
 * 
 * @param {boolean} forceRefresh - Forzar recarga desde el servidor
 * @returns {Promise<Object>} Configuración del sistema
 */
export const obtenerConfiguracion = async (forceRefresh = false) => {
    try {
        const now = Date.now();
        
        // Usar caché en memoria si está disponible y no expiró
        if (!forceRefresh && cachedConfig && (now - lastFetchTime) < CONFIG_CACHE_TTL) {
            return cachedConfig;
        }
        
        // Intentar obtener de AsyncStorage primero
        if (!forceRefresh) {
            const cachedData = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.timestamp && (now - parsed.timestamp) < CONFIG_CACHE_TTL) {
                    cachedConfig = parsed.config;
                    lastFetchTime = parsed.timestamp;
                    return cachedConfig;
                }
            }
        }
        
        // Obtener del servidor
        const url = apiConfig.isConfigured 
            ? apiConfig.getEndpoint('/configuracion')
            : `${apiConfig.baseURL || 'http://192.168.18.11:3000/api'}/configuracion`;
        
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data && response.data.success && response.data.configuracion) {
            const config = response.data.configuracion;
            
            // Guardar en caché
            cachedConfig = config;
            lastFetchTime = now;
            
            await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
                config,
                timestamp: now
            }));
            
            console.log('✅ Configuración cargada desde servidor:', {
                moneda: config.moneda,
                igvPorcentaje: config.igvPorcentaje,
                preciosIncluyenIGV: config.preciosIncluyenIGV
            });
            
            return config;
        }
        
        throw new Error('Respuesta inválida del servidor');
    } catch (error) {
        console.error('Error al obtener configuración:', error.message);
        
        // Intentar usar caché aunque esté expirado
        if (cachedConfig) {
            console.log('⚠️ Usando configuración en caché (error de red)');
            return cachedConfig;
        }
        
        // Retornar configuración por defecto
        return getConfiguracionPorDefecto();
    }
};

/**
 * Obtiene solo la configuración de moneda y precios
 * Útil para cálculos rápidos
 */
export const obtenerConfigMoneda = async () => {
    const config = await obtenerConfiguracion();
    
    return {
        moneda: config.moneda || 'PEN',
        simboloMoneda: config.simboloMoneda || 'S/.',
        decimales: config.decimales ?? 2,
        posicionSimbolo: config.posicionSimbolo || 'antes',
        igvPorcentaje: config.igvPorcentaje ?? 18,
        preciosIncluyenIGV: config.preciosIncluyenIGV || false,
        nombreImpuestoPrincipal: config.nombreImpuestoPrincipal || 'IGV',
        politicaRedondeo: config.politicaRedondeo || 'total',
        redondearA: config.redondearA || 0.01
    };
};

/**
 * Configuración por defecto (fallback)
 */
export const getConfiguracionPorDefecto = () => ({
    moneda: 'PEN',
    simboloMoneda: 'S/.',
    decimales: 2,
    posicionSimbolo: 'antes',
    igvPorcentaje: 18,
    preciosIncluyenIGV: false,
    nombreImpuestoPrincipal: 'IGV',
    politicaRedondeo: 'total',
    redondearA: 0.01,
    zonaHoraria: 'America/Lima',
    datosFiscales: {
        nombreComercial: 'Las Gambusinas',
        razonSocial: '',
        ruc: '',
        direccionFiscal: '',
        telefono: '',
        email: ''
    },
    metodosPago: {
        efectivo: { activo: true },
        tarjeta: { activo: true },
        yape: { activo: true },
        plin: { activo: true },
        transferencia: { activo: false }
    }
});

/**
 * Calcula los totales de un boucher usando la configuración
 * 
 * @param {number} subtotalPlatos - Suma de precio * cantidad
 * @param {Object} config - Configuración de moneda (opcional)
 * @returns {Object} Totales calculados
 */
export const calcularTotales = (subtotalPlatos, config = null) => {
    // Usar valores por defecto si no hay configuración
    const cfg = config || {
        igvPorcentaje: 18,
        preciosIncluyenIGV: false,
        decimales: 2,
        politicaRedondeo: 'total'
    };
    
    const igvFactor = (cfg.igvPorcentaje || 18) / 100;
    let subtotalSinIGV, subtotalConIGV, igv, total;
    
    if (cfg.preciosIncluyenIGV) {
        // Los precios YA incluyen IGV
        subtotalConIGV = subtotalPlatos;
        // Fórmula para extraer IGV: IGV = Precio * (tasa / (1 + tasa))
        igv = subtotalConIGV * (igvFactor / (1 + igvFactor));
        subtotalSinIGV = subtotalConIGV - igv;
        total = subtotalConIGV;
    } else {
        // Los precios NO incluyen IGV (modo clásico)
        subtotalSinIGV = subtotalPlatos;
        igv = subtotalSinIGV * igvFactor;
        total = subtotalSinIGV + igv;
        subtotalConIGV = total;
    }
    
    // Función de redondeo
    const redondear = (valor) => {
        const factor = Math.pow(10, cfg.decimales || 2);
        return Math.round(valor * factor) / factor;
    };
    
    return {
        subtotalSinIGV: redondear(subtotalSinIGV),
        subtotalConIGV: redondear(subtotalConIGV),
        igv: redondear(igv),
        total: redondear(total),
        igvPorcentaje: cfg.igvPorcentaje || 18,
        preciosIncluyenIGV: cfg.preciosIncluyenIGV || false,
        nombreImpuesto: cfg.nombreImpuestoPrincipal || 'IGV'
    };
};

/**
 * Formatea un monto según la configuración
 * 
 * @param {number} monto - Monto a formatear
 * @param {Object} config - Configuración de moneda (opcional)
 * @returns {string} Monto formateado
 */
export const formatearMonto = (monto, config = null) => {
    const cfg = config || {
        simboloMoneda: 'S/.',
        decimales: 2,
        posicionSimbolo: 'antes'
    };
    
    const montoNum = Number(monto) || 0;
    const decimales = cfg.decimales ?? 2;
    const montoFormateado = montoNum.toFixed(decimales);
    
    return cfg.posicionSimbolo === 'despues'
        ? `${montoFormateado} ${cfg.simboloMoneda || 'S/.'}`
        : `${cfg.simboloMoneda || 'S/.'} ${montoFormateado}`;
};

/**
 * Formatea un monto de forma asíncrona usando la configuración del sistema
 */
export const formatearMontoAsync = async (monto) => {
    try {
        const config = await obtenerConfigMoneda();
        return formatearMonto(monto, config);
    } catch (error) {
        return `S/. ${Number(monto || 0).toFixed(2)}`;
    }
};

/**
 * Invalida el caché de configuración
 */
export const invalidarCache = async () => {
    cachedConfig = null;
    lastFetchTime = 0;
    await AsyncStorage.removeItem(CONFIG_CACHE_KEY);
    console.log('🗑️ Caché de configuración invalidado');
};

export default {
    obtenerConfiguracion,
    obtenerConfigMoneda,
    getConfiguracionPorDefecto,
    calcularTotales,
    formatearMonto,
    formatearMontoAsync,
    invalidarCache
};
