# Sistema de Logging - Las Gambusinas

## Descripción

Sistema de logging para capturar y guardar errores, advertencias e información importante de la aplicación móvil.

## Ubicación de los Logs

Los logs se guardan en: `FileSystem.documentDirectory/logs/`

- **Archivos de error**: `error-YYYY-MM-DD.log`
- **Archivos de información**: `info-YYYY-MM-DD.log`
- **Archivos de advertencia**: `warn-YYYY-MM-DD.log`

## Uso

### Importar el logger

```javascript
import logger from '../utils/logger';
```

### Registrar un error

```javascript
try {
  // código que puede fallar
} catch (error) {
  await logger.error(error, {
    action: 'nombre_de_la_accion',
    datosAdicionales: 'información relevante'
  });
}
```

### Registrar información

```javascript
await logger.info('Mensaje informativo', { datos: 'información adicional' });
```

### Registrar advertencia

```javascript
await logger.warn('Mensaje de advertencia', { datos: 'información adicional' });
```

### Obtener lista de logs

```javascript
const logs = await logger.getLogs();
console.log('Archivos de log:', logs);
```

### Leer un log específico

```javascript
const contenido = await logger.readLog('error-2024-12-15.log');
console.log(contenido);
```

### Limpiar todos los logs

```javascript
await logger.clearLogs();
```

### Obtener ruta del directorio

```javascript
const ruta = logger.getLogsDirectory();
console.log('Logs en:', ruta);
```

## Características

- ✅ Crea automáticamente el directorio de logs si no existe
- ✅ Guarda logs por fecha (un archivo por día)
- ✅ Limpia automáticamente logs antiguos (mantiene los últimos 10 archivos)
- ✅ Fallback a AsyncStorage si no se puede escribir en archivo
- ✅ Formato JSON estructurado para fácil lectura
- ✅ Incluye timestamp, stack trace, y contexto adicional

## Formato de los Logs

Los logs se guardan en formato JSON con la siguiente estructura:

```json
{
  "timestamp": "2024-12-15 14:30:25",
  "error": {
    "message": "Request failed with status code 400",
    "name": "AxiosError",
    "stack": "..."
  },
  "axiosError": {
    "status": 400,
    "statusText": "Bad Request",
    "data": { "message": "..." },
    "url": "http://...",
    "method": "delete"
  },
  "context": {
    "action": "eliminar_comanda",
    "comandaId": "...",
    "mesaNum": 5
  }
}
```

## Notas

- Los logs se acumulan en el mismo archivo durante el día
- Se separan con una línea de 80 caracteres de "="
- El sistema limpia automáticamente logs antiguos (10% de probabilidad en cada escritura)
- Si falla la escritura en archivo, intenta guardar en AsyncStorage como fallback

