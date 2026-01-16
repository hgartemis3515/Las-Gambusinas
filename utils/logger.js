import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-timezone';

// Intentar usar el directorio del proyecto si está disponible, sino usar documentDirectory
const LOGS_DIR = `${FileSystem.documentDirectory}logs/`;
const PROJECT_LOGS_DIR = './logs/'; // Carpeta en el proyecto
const MAX_LOG_FILES = 10; // Mantener solo los últimos 10 archivos de log

// Asegurar que el directorio de logs existe
const ensureLogsDirectory = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOGS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOGS_DIR, { intermediates: true });
      console.log('📁 Directorio de logs creado:', LOGS_DIR);
    }
  } catch (error) {
    console.error('❌ Error creando directorio de logs:', error);
  }
};

// Limpiar logs antiguos (mantener solo los últimos N archivos)
const cleanOldLogs = async () => {
  try {
    const files = await FileSystem.readDirectoryAsync(LOGS_DIR);
    const logFiles = files
      .filter(file => file.startsWith('error-') && file.endsWith('.log'))
      .sort()
      .reverse(); // Más recientes primero
    
    // Eliminar archivos antiguos si hay más del límite
    if (logFiles.length > MAX_LOG_FILES) {
      const filesToDelete = logFiles.slice(MAX_LOG_FILES);
      for (const file of filesToDelete) {
        await FileSystem.deleteAsync(`${LOGS_DIR}${file}`, { idempotent: true });
        console.log(`🗑️ Log antiguo eliminado: ${file}`);
      }
    }
  } catch (error) {
    console.error('❌ Error limpiando logs antiguos:', error);
  }
};

// Formatear error para logging
const formatError = (error, context = {}) => {
  const timestamp = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
  
  const errorInfo = {
    timestamp,
    error: {
      message: error?.message || 'Error desconocido',
      name: error?.name || 'Error',
      stack: error?.stack || 'No stack trace disponible',
    },
    axiosError: error?.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      url: error.config?.url,
      method: error.config?.method,
    } : null,
    context,
  };
  
  return JSON.stringify(errorInfo, null, 2);
};

// Escribir log a archivo
const writeLogToFile = async (logContent, logType = 'error') => {
  try {
    await ensureLogsDirectory();
    
    const timestamp = moment().tz("America/Lima").format("YYYY-MM-DD");
    const filename = `${logType}-${timestamp}.log`;
    const filepath = `${LOGS_DIR}${filename}`;
    
    // Leer archivo existente si existe
    let existingContent = '';
    try {
      const fileInfo = await FileSystem.getInfoAsync(filepath);
      if (fileInfo.exists) {
        existingContent = await FileSystem.readAsStringAsync(filepath);
      }
    } catch (readError) {
      console.warn('⚠️ No se pudo leer archivo de log existente:', readError);
    }
    
    // Agregar nuevo log al contenido existente
    const separator = '\n' + '='.repeat(80) + '\n';
    const newContent = existingContent 
      ? existingContent + separator + logContent 
      : logContent;
    
    // Escribir archivo
    await FileSystem.writeAsStringAsync(filepath, newContent);
    console.log(`📝 Log guardado en: ${filepath}`);
    console.log(`📁 Los logs se guardan en el dispositivo. Para exportarlos, usa logger.exportLogs()`);
    
    // Limpiar logs antiguos periódicamente
    if (Math.random() < 0.1) { // 10% de probabilidad para no hacerlo siempre
      await cleanOldLogs();
    }
    
    return filepath;
  } catch (error) {
    console.error('❌ Error escribiendo log a archivo:', error);
    // Fallback: intentar guardar en AsyncStorage como último recurso
    try {
      const logKey = `error_log_${Date.now()}`;
      await AsyncStorage.setItem(logKey, logContent);
      console.log('📝 Log guardado en AsyncStorage como fallback');
    } catch (fallbackError) {
      console.error('❌ Error en fallback de logging:', fallbackError);
    }
  }
};

// Logger principal
export const logger = {
  // Log de error
  error: async (error, context = {}) => {
    const logContent = formatError(error, context);
    
    // Siempre mostrar en consola
    console.error('❌ ERROR:', error);
    if (Object.keys(context).length > 0) {
      console.error('📋 Contexto:', context);
    }
    
    // Guardar en archivo
    await writeLogToFile(logContent, 'error');
  },
  
  // Log de información
  info: async (message, data = {}) => {
    const timestamp = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
    const logContent = JSON.stringify({
      timestamp,
      level: 'INFO',
      message,
      data,
    }, null, 2);
    
    console.log('ℹ️ INFO:', message, data);
    await writeLogToFile(logContent, 'info');
  },
  
  // Log de advertencia
  warn: async (message, data = {}) => {
    const timestamp = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
    const logContent = JSON.stringify({
      timestamp,
      level: 'WARN',
      message,
      data,
    }, null, 2);
    
    console.warn('⚠️ WARN:', message, data);
    await writeLogToFile(logContent, 'warn');
  },
  
  // Obtener todos los logs
  getLogs: async () => {
    try {
      await ensureLogsDirectory();
      const files = await FileSystem.readDirectoryAsync(LOGS_DIR);
      return files.filter(file => file.endsWith('.log')).sort().reverse();
    } catch (error) {
      console.error('❌ Error obteniendo lista de logs:', error);
      return [];
    }
  },
  
  // Leer un archivo de log específico
  readLog: async (filename) => {
    try {
      const filepath = `${LOGS_DIR}${filename}`;
      const content = await FileSystem.readAsStringAsync(filepath);
      return content;
    } catch (error) {
      console.error('❌ Error leyendo log:', error);
      return null;
    }
  },
  
  // Limpiar todos los logs
  clearLogs: async () => {
    try {
      await ensureLogsDirectory();
      const files = await FileSystem.readDirectoryAsync(LOGS_DIR);
      for (const file of files) {
        await FileSystem.deleteAsync(`${LOGS_DIR}${file}`, { idempotent: true });
      }
      console.log('🗑️ Todos los logs eliminados');
    } catch (error) {
      console.error('❌ Error limpiando logs:', error);
    }
  },
  
  // Obtener ruta del directorio de logs
  getLogsDirectory: () => LOGS_DIR,
  
  // Exportar logs (para compartir o copiar)
  exportLogs: async () => {
    try {
      await ensureLogsDirectory();
      const files = await FileSystem.readDirectoryAsync(LOGS_DIR);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      const allLogs = [];
      for (const file of logFiles) {
        const content = await FileSystem.readAsStringAsync(`${LOGS_DIR}${file}`);
        allLogs.push({ filename: file, content });
      }
      
      return allLogs;
    } catch (error) {
      console.error('❌ Error exportando logs:', error);
      return [];
    }
  },
};

export default logger;

