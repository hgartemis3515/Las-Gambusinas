# Sistema de Notificaciones - App Mozos, App Cocina y Backend

**Versión:** 1.0  
**Última Actualización:** Abril 2026  
**Apps involucradas:** App Mozos, App Cocina, Backend Las Gambusinas

---

## Resumen Ejecutivo

Este documento describe el sistema completo de notificaciones en tiempo real que conecta la App de Mozos con la App de Cocina a través del Backend. Incluye eventos WebSocket, push notifications y el flujo de alertas para "Plato Listo" (segundo plato).

---

## 1. Arquitectura de Notificaciones

### 1.1 Namespaces Socket.io

| Namespace | App | Rooms | Autenticación |
|-----------|-----|-------|---------------|
| `/mozos` | App Mozos | `mesa-{mesaId}` | JWT (rol: mozos, admin, supervisor) |
| `/cocina` | App Cocina | `fecha-YYYY-MM-DD`, `cocinero-{id}`, `zona-{id}` | JWT (rol: cocinero, admin, supervisor) |
| `/admin` | Dashboard Admin | Broadcast | JWT (rol: admin, supervisor) |

### 1.2 Flujo General de Notificaciones

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  App Mozos  │◄────│   Backend    │────►│ App Cocina  │
│  (cliente)  │     │  (events.js) │     │   (KDS)     │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │                    │
       │                   ▼                    │
       │         ┌─────────────────┐            │
       │         │   Dashboard     │            │
       │         │   Admin (/admin)│            │
       │         └─────────────────┘            │
       │                                          │
       └──────────── Eventos Socket.io ──────────┘
```

---

## 2. Lista de Eventos Socket.io

### 2.1 Eventos hacia App Mozos (`/mozos`)

#### Eventos de Platos

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `plato-actualizado` | Backend → Mozos | Estado de plato cambiado | `{ comandaId, platoId, nuevoEstado, estadoAnterior, mesaId, timestamp }` |
| `plato-actualizado-batch` | Backend → Mozos | Múltiples platos actualizados | `[{ comandaId, platoId, nuevoEstado, ... }]` |
| `plato-anulado` | Backend → Mozos | Plato anulado por cocina | `{ comandaId, platoAnulado, comanda, auditoria, timestamp }` |
| `plato-entregado` | Mozos → Backend → Cocina | Mozo entregó plato al cliente | `{ comandaId, platoId, estadoAnterior }` |

#### Eventos de Comandas

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `nueva-comanda` | Backend → Mozos/Cocina | Nueva comanda creada | `{ comanda }` |
| `comanda-actualizada` | Backend → Mozos/Cocina | Comanda modificada | `{ comandaId, comanda, status }` |
| `comanda-eliminada` | Backend → Mozos/Cocina | Comanda eliminada | `{ comandaId }` |
| `comanda-revertida` | Backend → Mozos/Cocina | Comanda revertida | `{ comanda, mesa }` |
| `comanda-finalizada` | Backend → Mozos | Todos los platos listos | `{ comandaId, comanda }` |
| `comanda-anulada` | Backend → Mozos | Comanda anulada por cocina | `{ comandaId, comanda, totalAnulado, motivoGeneral }` |

#### Eventos de Mesas

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `mesa-actualizada` | Backend → Mozos/Cocina | Estado de mesa cambió | `{ mesaId, mesa }` |
| `mesas-juntadas` | Backend → Mozos | Mesas combinadas | `{ mesaPrincipal, mesasSecundarias, totalMesas, mozoId }` |
| `mesas-separadas` | Backend → Mozos | Mesas separadas | `{ mesaPrincipal, mesasSecundarias, totalMesasLiberadas, mozoId }` |
| `mapa-actualizado` | Backend → Mozos | Mapa de mesas modificado | `{ areaId, timestamp }` |
| `catalogo-mesas-areas-actualizado` | Backend → Mozos | Catálogo actualizado | `{ razon, timestamp }` |

### 2.2 Eventos hacia App Cocina (`/cocina`)

#### Eventos de Procesamiento

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `plato-procesando` | Backend → Cocina/Mozos | Cocinero tomó plato | `{ comandaId, platoId, cocinero: { cocineroId, nombre, alias }, timestamp }` |
| `plato-liberado` | Backend → Cocina/Mozos | Cocinero liberó plato | `{ comandaId, platoId, timestamp }` |
| `conflicto-procesamiento` | Backend → Cocina | Conflicto al tomar plato | `{ comandaId, platoId, cocineroActual, timestamp }` |

#### Eventos de Configuración

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `plato-menu-actualizado` | Backend → Cocina/Mozos/Admin | Plato del menú modificado | `{ plato }` |
| `config-cocinero-actualizada` | Backend → Cocina | Configuración de cocinero actualizada | `{ cocineroId, config }` |
| `zona-asignada` | Backend → Cocina | Zona asignada a cocinero | `{ zonaId, cocineroId }` |

### 2.3 Eventos hacia Dashboard Admin (`/admin`)

| Evento | Dirección | Descripción | Datos |
|--------|-----------|-------------|-------|
| `reportes:boucher-nuevo` | Backend → Admin | Nuevo boucher generado | `{ boucher }` |
| `reportes:comanda-nueva` | Backend → Admin | Nueva comanda creada | `{ comanda }` |
| `reportes:plato-listo` | Backend → Admin | Plato marcado como listo | `{ comandaId, platoId, nombre, precio, estado }` |
| `socket-status` | Backend → Todos | Estado de conexión (cada 30s) | `{ connected, socketId, timestamp }` |
| `roles-actualizados` | Backend → Admin | Cambios en roles/permisos | `{ timestamp }` |

---

## 3. Sistema de Push Notifications

### 3.1 Estado Actual

La App Mozos tiene implementado el registro de **Expo Push Tokens**, pero las push notifications remotas **no funcionan en Expo Go** (SDK 53+). Para usar push notifications reales, se requiere:

- **Development Build**: `npx expo run:android`
- **O EAS Build**: Build nativa con credenciales Firebase

### 3.2 Flujo de Registro de Push Token

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│  App Mozos  │                    │   Backend    │                    │   MongoDB   │
│   (Login)   │                    │ /api/mozos/  │                    │   (mozos)   │
└──────┬──────┘                    │  push-token  │                    └──────┬──────┘
       │                           └──────┬───────┘                           │
       │ 1. Login exitoso                 │                                   │
       │                                   │                                   │
       │ 2. registerForExpoPushAsync()    │                                   │
       │    → getExpoPushTokenAsync()     │                                   │
       │    → token: "ExponentPushToken..."                                   │
       │                                   │                                   │
       │ 3. POST /api/mozos/push-token    │                                   │
       │    { mozoId, pushToken, platform }                                   │
       │──────────────────────────────────►│                                   │
       │                                   │ 4. Actualizar mozo                │
       │                                   │    pushToken, pushPlatform        │
       │                                   │    pushTokenUpdatedAt             │
       │                                   │──────────────────────────────────►│
       │                                   │                                   │
       │                                   │ 5. Éxito                          │
       │◄──────────────────────────────────│                                   │
       │                                   │                                   │
```

### 3.3 Campos del Modelo `mozos`

```javascript
{
  pushToken: String,           // "ExponentPushToken[xxx]"
  pushPlatform: String,        // "android" | "ios"
  pushDeviceId: String,        // ID único del dispositivo
  pushTokenUpdatedAt: Date     // Última actualización del token
}
```

### 3.4 Endpoint de Push Token

**POST** `/api/mozos/push-token`

```json
{
  "mozoId": "69860821b6273b9647faf872",
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxx]",
  "platform": "android"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Push token actualizado"
}
```

---

## 4. Funcionalidad "Segundo Plato" (Plato Listo)

### 4.1 Descripción

Cuando un cocinero marca un plato como **listo** (estado `recoger`), el sistema debe **alertar al mozo** para que recoja el plato y lo entregue al cliente.

### 4.2 Flujo Completo

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│ App Cocina  │                    │   Backend    │                    │  App Mozos  │
│   (KDS)     │                    │  (events.js) │                    │  (mozo)     │
└──────┬──────┘                    └──────┬───────┘                    └──────┬──────┘
       │                                  │                                   │
       │ 1. Click "Finalizar Plato"       │                                   │
       │                                  │                                   │
       │ 2. PUT /api/comanda/:id/plato/:platoId/finalizar                  │
       │─────────────────────────────────►│                                   │
       │                                  │                                   │
       │                                  │ 3. Actualizar plato               │
       │                                  │    estado = 'recoger'             │
       │                                  │    tiempos.recoger = Date.now()   │
       │                                  │    procesadoPor = cocinero        │
       │                                  │                                   │
       │                                  │ 4. emitPlatoActualizado()         │
       │                                  │    → namespace /mozos             │
       │                                  │    → room: mesa-{mesaId}          │
       │                                  │──────────────────────────────────►│
       │                                  │                                   │
       │                                  │                                   │ 5. Recibir evento
       │                                  │                                   │    socket.on('plato-actualizado')
       │                                  │                                   │
       │                                  │                                   │ 6. ALERTA AL MOZO:
       │                                  │                                   │    - Vibración (Haptics)
       │                                  │                                   │    - Sonido "plato_listo.wav"
       │                                  │                                   │    - Toast: "🍽️ Plato Listo"
       │                                  │                                   │    - Badge en mesa
       │                                  │                                   │
       │                                  │ 7. emitReportePlatoListo()        │
       │                                  │    → namespace /admin             │
       │                                  │                                   │
       │ 8. Plato se mueve a PREPARADOS   │                                   │
       │◄─────────────────────────────────│                                   │
       │                                  │                                   │
       │                                  │                                   │ 9. Mozo va a cocina
       │                                  │                                   │    Recoge plato
       │                                  │                                   │
       │                                  │                                   │ 10. Click "Entregado"
       │                                  │                                   │
       │                                  │ 11. emitPlatoEntregado()          │
       │                                  │◄──────────────────────────────────│
       │                                  │                                   │
       │ 12. Plato marcado como entregado │                                   │
       │◄─────────────────────────────────│                                   │
       │                                  │                                   │
```

### 4.3 Eventos Involucrados

| Paso | Evento | Origen | Destino | Acción |
|------|--------|--------|---------|--------|
| 4 | `plato-actualizado` | Backend | App Mozos | Alertar mozo |
| 7 | `reportes:plato-listo` | Backend | Dashboard Admin | Actualizar métricas |
| 11 | `plato-entregado` | App Mozos | Backend → Cocina | Confirmar entrega |

### 4.4 Datos del Evento `plato-actualizado`

```javascript
// emitido por events.js
{
  comandaId: "67abc...",
  platoId: "0",
  nuevoEstado: "recoger",
  estadoAnterior: "en preparación",
  mesaId: "67def...",
  timestamp: "2026-04-07T12:30:45.123Z"
}
```

### 4.5 Handler en App Mozos

**Archivo:** `hooks/useSocketMozos.js`

```javascript
socket.on('plato-actualizado', (data) => {
  console.log('📥 Plato actualizado recibido:', data);
  
  if (data.nuevoEstado === 'recoger') {
    // ALERTA: Plato listo para recoger
    // 1. Vibración
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // 2. Sonido (si está configurado)
    // playSound('plato_listo');
    
    // 3. Toast visual
    showToast(`🍽️ ${data.platoNombre || 'Plato'} listo - Mesa ${data.mesaNumero}`);
    
    // 4. Badge en la mesa
    updateMesaBadge(data.mesaId, 'plato-listo');
  }
  
  // Actualizar estado local
  if (onComandaActualizada) {
    onComandaActualizada({
      tipo: 'plato-actualizado',
      ...data
    });
  }
});
```

### 4.6 Canales de Notificación Android

**Archivo:** `services/pushNotifications.js`

```javascript
// Canal para platos listos (prioridad máxima)
await Notifications.setNotificationChannelAsync('plato-listo', {
  name: 'Platos Listos',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 500, 200, 500],
  lightColor: '#4CAF50',
  sound: 'plato_listo.wav',
  enableVibrate: true,
});
```

---

## 5. Implementación de Alertas al Mozo

### 5.1 Métodos de Alerta

| Método | Prioridad | Requiere Build Nativa | Descripción |
|--------|-----------|----------------------|-------------|
| **Vibración (Haptics)** | Alta | No (Expo Go OK) | Vibración táctil inmediata |
| **Sonido local** | Alta | No (Expo Go OK) | Archivo `.wav` en assets |
| **Toast visual** | Media | No (Expo Go OK) | Overlay temporal en pantalla |
| **Push Notification** | Alta | **Sí (requiere build)** | Notificación del sistema |
| **Badge en mesa** | Media | No (Expo Go OK) | Indicador visual en la tarjeta |

### 5.2 Código de Implementación Actual

**App Mozos - `useSocketMozos.js`** ya tiene el listener:

```javascript:45-65:Las-Gambusinas/hooks/useSocketMozos.js
socket.on('plato-actualizado', (data) => {
  // FASE 4: Notificar cambio de estado para parpadeo del indicador
  if (onSocketStatus) {
    setConnectionStatus('online-active');
    onSocketStatus({ connected: true, status: 'online-active' });
    
    setTimeout(() => {
      setConnectionStatus('conectado');
      onSocketStatus({ connected: true, status: 'conectado' });
    }, 2000);
  }
  
  // Pasar el evento al handler
  if (onComandaActualizada) {
    onComandaActualizada({
      tipo: 'plato-actualizado-granular',
      ...data
    });
  }
});
```

### 5.3 Mejoras Recomendadas

1. **Añadir Haptics en el listener:**
   ```javascript
   import * as Haptics from 'expo-haptics';
   
   if (data.nuevoEstado === 'recoger') {
     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
   }
   ```

2. **Sonido de alerta:**
   - Añadir archivo `assets/sounds/plato_listo.wav`
   - Usar `expo-av` para reproducir

3. **Toast visual personalizado:**
   - Crear componente `PlatoListoToast.js`
   - Mostrar con animación de entrada/salida

---

## 6. Conversión a APK

### 6.1 Requisitos para Build Nativa

Para que las push notifications funcionen correctamente, se necesita:

| Requisito | Comando | Descripción |
|-----------|---------|-------------|
| **Development Build** | `npx expo run:android` | Build de desarrollo con depuración |
| **EAS Build** | `eas build --platform android` | Build de producción |
| **Firebase configurado** | `google-services.json` | Credenciales FCM para Android |
| **Proyecto EAS** | `eas.json` configurado | Configuración de builds |

### 6.2 Pasos para Crear APK

#### Opción A: Development Build (Recomendado para pruebas)

```bash
# 1. Instalar CLI de Expo
npm install -g expo-cli

# 2. Configurar proyecto EAS
eas build:configure

# 3. Crear development build
eas build --platform android --profile development

# 4. Instalar en dispositivo
eas build:run --platform android
```

#### Opción B: EAS Build (Producción)

```bash
# 1. Configurar eas.json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}

# 2. Crear APK
eas build --platform android --profile preview

# 3. Descargar APK desde dashboard de EAS
# https://expo.dev/accounts/[tu-cuenta]/projects/appmozo/builds
```

### 6.3 Configuración de Firebase (Push Notifications)

#### Paso 1: Crear proyecto en Firebase Console

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Crear nuevo proyecto "LasGambusinas"
3. Añadir app Android con package: `com.carlos121.appmozo`

#### Paso 2: Descargar credenciales

```bash
# Descargar google-services.json
# Colocar en: Las-Gambusinas/google-services.json
```

#### Paso 3: Configurar app.json

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.carlos121.appmozo"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#ffffff",
          "defaultChannel": "default",
          "enableBackgroundRemoteNotifications": true
        }
      ]
    ]
  }
}
```

### 6.4 Checklist Pre-Build

- [ ] `app.json` configurado con projectId de EAS
- [ ] `google-services.json` en la raíz del proyecto
- [ ] `eas.json` creado con perfiles de build
- [ ] Sonidos de notificación en `assets/sounds/`
- [ ] Iconos de notificación en `assets/`
- [ ] Variables de entorno configuradas (API_URL, etc.)

---

## 7. Tabla Resumen de Notificaciones

### 7.1 Eventos Críticos (Requieren Acción Inmediata)

| Evento | App Destino | Acción | Prioridad |
|--------|-------------|--------|-----------|
| `plato-actualizado` (estado='recoger') | App Mozos | Alertar mozo | 🔴 CRÍTICA |
| `nueva-comanda` | App Cocina | Mostrar en KDS | 🔴 CRÍTICA |
| `comanda-eliminada` | App Cocina/Mozos | Eliminar de vista | 🟡 ALTA |
| `plato-anulado` | App Mozos | Notificar anulación | 🟡 ALTA |

### 7.2 Eventos Informativos (Actualización de UI)

| Evento | App Destino | Acción | Prioridad |
|--------|-------------|--------|-----------|
| `mesa-actualizada` | App Mozos/Cocina | Actualizar estado | 🟢 MEDIA |
| `comanda-actualizada` | App Mozos/Cocina | Actualizar datos | 🟢 MEDIA |
| `plato-menu-actualizado` | Todas | Refrescar menú | 🟢 BAJA |
| `socket-status` | Todas | Actualizar indicador | ⚪ INFORMATIVA |

---

## 8. Archivos Clave del Sistema

### 8.1 Backend

| Archivo | Propósito |
|---------|-----------|
| `src/socket/events.js` | Emisión central de eventos WebSocket |
| `src/controllers/comandaController.js` | Lógica de comandas y platos |
| `src/socket/namespaces/mozos.js` | Namespace `/mozos` |
| `src/socket/namespaces/cocina.js` | Namespace `/cocina` |
| `src/controllers/mozosController.js` | Endpoint push-token |

### 8.2 App Mozos

| Archivo | Propósito |
|---------|-----------|
| `hooks/useSocketMozos.js` | Conexión WebSocket y listeners |
| `context/SocketContext.js` | Provider global del socket |
| `services/pushNotifications.js` | Registro de push tokens |
| `Pages/navbar/screens/InicioScreen.js` | Manejo de alertas de mesa |

### 8.3 App Cocina

| Archivo | Propósito |
|---------|-----------|
| `src/hooks/useSocketCocina.js` | Conexión WebSocket cocina |
| `src/hooks/useProcesamiento.js` | Finalizar platos/comandas |
| `src/components/Principal/Comandastyle.jsx` | Tablero KDS principal |

---

## 9. Próximos Pasos

### 9.1 Implementaciones Pendientes

1. **Haptics en plato-actualizado**: Añadir vibración cuando el estado es `recoger`
2. **Sonido de alerta**: Añadir archivo de sonido y lógica de reproducción
3. **Toast personalizado**: Crear componente visual para "Plato Listo"
4. **Firebase FCM**: Configurar proyecto Firebase para push reales

### 9.2 Build de Producción

1. Ejecutar `eas build:configure` si no existe
2. Configurar `google-services.json`
3. Crear build preview: `eas build --platform android --profile preview`
4. Probar APK en dispositivo real
5. Verificar push notifications con el backend

---

## 10. Referencias

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Socket.io Rooms](https://socket.io/docs/v4/rooms/)
