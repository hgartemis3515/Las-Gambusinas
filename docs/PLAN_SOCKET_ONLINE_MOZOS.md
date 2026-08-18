# Plan — App Mozos siempre Online (Socket.io, no polling HTTP)

**Versión:** 1.0  
**Fecha:** Agosto 2026  
**Alcance:** App Mozos (`gambusinas`) + CORS Socket.io en `backend-gambusinas`  
**Síntoma:** Al entrar y al configurar la IP del backend el indicador queda **OFFLINE**. Las mesas/comandas no se actualizan en tiempo real; se usa el polling HTTP de fallback (~30s).

---

## 1. Comportamiento esperado

| Momento | Resultado |
|---------|-----------|
| Entrar al app con sesión + IP válida | Indicador **ONLINE**; eventos Socket.io en `/mozos` |
| **Probar conexión** en Configuración del servidor | HTTP OK **y** reconexión del socket → **ONLINE** (si hay JWT) |
| Guardar una IP nueva | Socket se recrea contra esa IP **sin** reiniciar la app |
| Socket caído | Polling HTTP de `InicioScreen` solo como fallback |

**Online** = `socket.connected === true` (da igual si el transporte interno es websocket o engine.io polling). El polling HTTP de la app **no** es Online.

Sin JWT (pantalla de login) el namespace `/mozos` no puede autenticar. Tras **Probar conexión** se guarda la IP; al ingresar el socket debe conectar enseguida.

---

## 2. Causa raíz (código actual)

### 2.1 URL Socket.io en `ws://` (falla con polling-first en RN)

`config/apiConfig.js` → `generateWsURL()` convierte `http://IP:3000/api` en `ws://IP:3000` y lo persiste.

Cocina usa origen **http(s)** + `transports: ['websocket', 'polling']`. Mozos usa **ws://** + **polling primero**. En React Native el XHR de engine.io no habla `ws://`: el handshake de polling falla y no hay upgrade. El socket nunca llega a `connect` → **OFFLINE** permanente. Tras guardar la IP en el modal, el siguiente arranque vuelve a cargar `ws://`.

### 2.2 “Probar conexión” no toca el socket

`SettingsModal.testConnection` solo hace `GET /api/mozos`. No persiste URL, no recrea el cliente Socket.io. El guardado avisa “próximo inicio” y tampoco reconecta.

### 2.3 Login no avisa al `SocketProvider`

Tras login el JWT se guarda en AsyncStorage, pero **no** se llama `updateToken()`. El contexto mira el storage cada 5s. Hasta entonces (o si el socket ya nació contra otra URL) queda Offline.

### 2.4 El hook no se recrea al cambiar la IP

`useSocketMozos` depende solo de `[token]`. Cambia `apiConfig.wsURL` y el Manager sigue en el host viejo. El cleanup **no** hace `disconnect()`, así que al re-correr el effect se filtran sockets.

### 2.5 Eventos de reconexión de Socket.io v4

Cliente `socket.io-client@4.8`. `reconnect` / `reconnect_attempt` van en `socket.io`, no en `socket.on(...)`. `connect_error` pinta **desconectado** (rojo Offline) en lugar de **reconectando**.

### 2.6 CORS Socket.io más estricto que Express

Express permite requests **sin** `Origin` (app nativa). Socket.io usa un array fijo de orígenes. Expo Go envía `Origin: http://localhost:8081` o la IP del Metro → el handshake puede rechazarse.

### 2.7 Carrera `apiConfig.init()` vs socket

`init()` es async. Si el socket conecta antes de leer AsyncStorage, usa el fallback (`192.168.50.155`) y **no vuelve a intentar** cuando carga la IP real. HTTP sí usa la IP guardada → la API “funciona” y el socket no.

---

## 3. Cadena del bug

```
Abrir app / Probar conexión (HTTP 200)
        ↓
Indicador OFFLINE (socket.connected = false)
        ↓
InicioScreen activa polling HTTP 30s
        ↓
Mesas/comandas no llegan por mesa-actualizada / comanda-actualizada
```

---

## 4. Cambios

### A. `gambusinas/config/apiConfig.js` + `gambusinas/apiConfig.js`

- Origen Socket.io = `http(s)://host:puerto` (nunca `ws://`).
- Al cargar config guardada, normalizar `ws://` → `http://`.
- `whenReady()` (promesa de `init`).
- `subscribe(fn)` tras `setConfig` / `reset` / `init`.

### B. `useSocketMozos` + `SocketContext`

- Esperar `whenReady()` + JWT antes de `io()`.
- Deps: token + URL + nonce de reconexión.
- Cleanup: `removeAllListeners` + `disconnect`.
- `transports: ['websocket', 'polling']` (igual que cocina).
- `forceNew: true` al cambiar de host.
- `socket.io.on('reconnect_attempt'|'reconnect'|'reconnect_failed')`.
- Al conectar: status `reconectando` (amarillo), no Offline.
- `reconnectSocket()` público; AppState `active` si está caído → `socket.connect()`.
- Login: `updateToken(jwt)` inmediato. Logout: `updateToken(null)`.

### C. `SettingsModal`

- **Probar conexión** OK → `setConfig` + `reconnectSocket()`.
- Si hay JWT: mensaje “Online (tiempo real)” cuando `connected`.
- Si no hay JWT: “Servidor OK. Al ingresar quedarás Online.”
- Guardar también reconecta (ya no “próximo inicio”).

### D. Backend `index.js`

Misma política CORS para Express y Socket.io: sin Origin, lista `ALLOWED_ORIGINS`, localhost (Metro) y LAN privada.

---

## 5. Archivos

| Archivo | Cambio |
|---------|--------|
| `gambusinas/config/apiConfig.js` | origen http, whenReady, subscribe |
| `gambusinas/apiConfig.js` | `getWebSocketURL` normalizado |
| `gambusinas/hooks/useSocketMozos.js` | recrear socket, cleanup, transports |
| `gambusinas/context/SocketContext.js` | ready, reconnect, AppState |
| `gambusinas/Components/SettingsModal.js` | test → persistir + Online |
| `gambusinas/Pages/Login/Login.js` | `updateToken` |
| `gambusinas/Pages/navbar/screens/MasScreen.js` | logout limpia token de contexto |
| `backend-gambusinas/index.js` | CORS Socket.io alineado |

Sin cambios de payload ni de nombres de eventos.

---

## 6. Pruebas

1. Instalar/abrir con IP ya guardada y sesión → **ONLINE** en &lt; 3s, sin log de polling fallback.
2. Cambiar IP en el modal → **Probar conexión** → verde y **ONLINE** (con sesión).
3. Cerrar sesión, cambiar IP, **Probar conexión** → HTTP OK; al ingresar → **ONLINE**.
4. En cocina marcar un plato `recoger` → el mapa del mozo se actualiza al instante (no esperar 30s).
5. Poner la app en segundo plano y volver → sigue Online o reconecta sola.
6. Backend apagado → Offline + polling; encender backend → Online y el polling se corta.

---

## 7. Estado

Implementado en el mismo cambio que este documento (v1.0).
