# 🔌 Sincronización Socket.io Completa - App Mozos

**Fecha:** Enero 2025  
**Versión:** 2.0

---

## 📋 Resumen de Implementación

Este documento describe la implementación completa de sincronización en tiempo real usando Socket.io en la app de mozos React Native.

---

## ✅ 1. SocketProvider Integrado en App.js

### Cambios Realizados

- **Integrado:** `SocketProvider` en `App.js` para mantener conexión global
- **Mantenido:** Socket activo en todas las pantallas

### Código

```javascript
<SocketProvider>
  <NavigationContainer>
    {/* Pantallas */}
  </NavigationContainer>
</SocketProvider>
```

---

## ✅ 2. InicioScreen - Sincronización Completa

### Cambios Realizados

- **Simplificado:** `handleComandaActualizada` - usa datos del servidor directamente
- **Mejorado:** `handleMesaActualizada` - actualiza AsyncStorage automáticamente
- **Mejorado:** `handleNuevaComanda` - actualiza AsyncStorage automáticamente
- **Optimizado:** Polling solo cuando Socket desconectado (30s en lugar de 15s)

### Eventos Escuchados

- ✅ `mesa-actualizada` - Actualiza estado de mesa y AsyncStorage
- ✅ `comanda-actualizada` - Actualiza comanda y AsyncStorage
- ✅ `nueva-comanda` - Agrega comanda y actualiza AsyncStorage
- ✅ `comanda-revertida` - Maneja reversiones correctamente

### Actualización de AsyncStorage

```javascript
// Automático en cada evento
await AsyncStorage.setItem('mesas', JSON.stringify(mesasArray));
await AsyncStorage.setItem(`comandas_${fecha}`, JSON.stringify(comandasArray));
```

---

## ✅ 3. PagosScreen - Sincronización de Totales

### Cambios Realizados

- **Integrado:** `useSocket` hook
- **Agregado:** Handlers para `comanda-actualizada` y `nueva-comanda`
- **Mejorado:** Totales se recalculan automáticamente cuando llegan eventos

### Eventos Escuchados

- ✅ `comanda-actualizada` - Actualiza comanda y recalcula total
- ✅ `nueva-comanda` - Agrega comanda si es de la misma mesa

### Recalculación Automática

```javascript
useEffect(() => {
  if (comandas.length > 0) {
    calcularTotal(); // Se ejecuta automáticamente cuando cambian comandas
  }
}, [comandas]);
```

---

## ✅ 4. Backend Events.js Mejorado

### Cambios Realizados

- **Agregado:** Validación de namespaces (seguridad)
- **Agregado:** Validación de parámetros (mesaId, fecha)
- **Mejorado:** Logging con contadores de conexiones
- **Mejorado:** Validación antes de emitir eventos

### Validaciones Implementadas

```javascript
// Validar namespace
if (socket.nsp.name !== '/mozos') {
  logger.warn('Intento de conexión a namespace incorrecto');
  socket.disconnect();
  return;
}

// Validar parámetros
if (!mesaId) {
  logger.warn('Intento de join-mesa sin mesaId');
  return;
}
```

### Logging Mejorado

```javascript
logger.info('Evento emitido', {
  comandaNumber: comanda.comandaNumber,
  mozosConnected: mozosNamespace?.sockets?.size || 0,
  cocinaConnected: cocinaNamespace?.sockets?.size || 0
});
```

---

## ✅ 5. Polling Optimizado

### Cambios Realizados

- **Eliminado:** Polling permanente
- **Mantenido:** Polling solo como fallback cuando Socket desconectado
- **Optimizado:** Intervalo aumentado a 30s (menos carga)

### Comportamiento

```javascript
// Solo activar polling si Socket desconectado
if (!socketConnected) {
  // Polling cada 30s
} else {
  // Polling desactivado - usar Socket
}
```

---

## ✅ 6. Sistema de Queue Offline

### Cambios Realizados

- **Creado:** `utils/offlineQueue.js` - Sistema de queue para eventos offline
- **Implementado:** Almacenamiento en AsyncStorage
- **Implementado:** Procesamiento automático al reconectar

### Características

- Máximo 100 eventos en queue
- Procesamiento en orden (FIFO)
- Limpieza automática después de procesar

### Uso

```javascript
import offlineQueue from '../utils/offlineQueue';

// Agregar evento cuando está offline
if (!socketConnected) {
  await offlineQueue.addEvent('comanda-actualizada', comanda);
}

// Procesar queue al reconectar
if (socketConnected && wasDisconnected) {
  await offlineQueue.processQueue(handlers);
}
```

---

## ✅ 7. Tests Unitarios Socket

### Tests Implementados

- ✅ Validación de namespaces
- ✅ Generación de room names
- ✅ Estructura de datos de eventos

### Ejecutar Tests

```bash
npm test
```

---

## 📝 Archivos Modificados

### Nuevos Archivos

- ✅ `utils/offlineQueue.js` - Sistema de queue offline
- ✅ `tests/socket.events.test.js` - Tests unitarios
- ✅ `SOCKET_SYNC_IMPLEMENTADO.md` - Este documento

### Archivos Modificados

- ✅ `App.js` - Integrado SocketProvider
- ✅ `Pages/navbar/screens/InicioScreen.js` - Handlers mejorados, AsyncStorage automático
- ✅ `Pages/navbar/screens/PagosScreen.js` - Integrado Socket, handlers de eventos
- ✅ `hooks/useSocketMozos.js` - Mejorado manejo de errores
- ✅ `Backend-LasGambusinas/src/socket/events.js` - Validaciones, logging mejorado

---

## 🔄 Flujos de Sincronización

### Flujo 1: Mozo Crea Comanda

1. Mozo crea comanda (POST `/api/comanda`)
2. Backend emite `nueva-comanda` con datos completos populados
3. **InicioScreen** recibe evento:
   - Actualiza estado local de comandas
   - Actualiza AsyncStorage
   - Actualiza estado de mesa a "pedido"
4. **PagosScreen** (si está abierto):
   - Recibe `nueva-comanda`
   - Agrega comanda si es de la misma mesa
   - Recalcula total automáticamente

### Flujo 2: Cocina Actualiza Plato

1. Cocina actualiza plato (PUT `/api/comanda/:id/plato/:platoId/estado`)
2. Backend emite `plato-actualizado` y `comanda-actualizada`
3. **InicioScreen** recibe `comanda-actualizada`:
   - Actualiza comanda en estado local
   - Actualiza AsyncStorage
   - NO hace polling (confía en backend)
4. **PagosScreen** (si está abierto):
   - Recibe `comanda-actualizada`
   - Actualiza comanda
   - Recalcula total automáticamente

### Flujo 3: Pagar Comanda

1. Mozo paga comanda (PUT `/api/comanda/:id/status` con `pagado`)
2. Backend emite `comanda-actualizada` y `mesa-actualizada`
3. **InicioScreen** recibe eventos:
   - Actualiza comanda a "pagado"
   - Actualiza mesa (probablemente a "libre")
   - Actualiza AsyncStorage
4. **PagosScreen**:
   - Recibe `comanda-actualizada`
   - Actualiza comanda
   - Recalcula total (será 0 si todas pagadas)

### Flujo 4: Liberar Mesa

1. Sistema detecta que no hay comandas activas
2. Backend recalcula estado de mesa a "libre"
3. Backend emite `mesa-actualizada`
4. **InicioScreen** recibe evento:
   - Actualiza mesa a "libre"
   - Actualiza AsyncStorage

---

## 🧪 Testing

### Tests Implementados

```bash
npm test
```

### Tests de Socket

- ✅ Validación de namespaces
- ✅ Generación de room names
- ✅ Estructura de datos de eventos

---

## 📊 Mejoras de Rendimiento

### Antes vs Después

| Métrica | Antes | Después |
|---------|-------|---------|
| Polling activo | Siempre (15s) | Solo si Socket desconectado (30s) |
| Actualizaciones en tiempo real | No | Sí (Socket.io) |
| Sincronización AsyncStorage | Manual | Automática |
| Carga del servidor | Alta (polling constante) | Baja (solo eventos) |
| Latencia de actualizaciones | 15-30s | <1s (tiempo real) |

---

## ✅ Checklist de Implementación

- [x] SocketProvider integrado en App.js
- [x] InicioScreen usando Socket (handlers mejorados)
- [x] PagosScreen usando Socket (handlers agregados)
- [x] Polling eliminado cuando Socket OK
- [x] AsyncStorage actualizado automáticamente
- [x] Backend con validaciones de namespaces
- [x] Sistema de queue offline creado
- [x] Tests unitarios básicos
- [x] Logging mejorado en backend

---

## 🔧 Configuración

### No se Requieren Cambios

La implementación usa la configuración existente de Socket.io. El hook `useSocketMozos` ya tiene:

- Reconexión automática con backoff exponencial
- Manejo de errores
- Heartbeat para detectar desconexiones

---

## 📞 Soporte

Para problemas de sincronización:

1. Verificar logs en consola: `[MOZOS]` y `[PAGOS]`
2. Verificar estado de Socket: `socketConnected` en contexto
3. Revisar logs del backend: `logs/combined.log`
4. Verificar queue offline: `AsyncStorage.getItem('@socket_offline_queue')`

---

**Fin del Documento**


