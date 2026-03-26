# Documentación Completa - App de Mozos (Las Gambusinas)

**Version:** 2.4  
**Ultima Actualizacion:** Marzo 2026  
**Tecnologia:** React Native + Expo + Socket.io-client + AsyncStorage

**Proposito del documento:** Analisis completo del app de mozos para Las Gambusinas: estructura, flujo de datos, integracion con backend y otras aplicaciones, librerias, funciones principales, problemas y propuestas de mejora. Documento alineado con el codebase actual (marzo 2026).

---

## 📋 Historial de Cambios

### v2.4 (Marzo 2026) - Funcionalidad Juntar/Separar Mesas

- ✅ **Juntar Mesas**: Nueva funcionalidad para combinar múltiples mesas (2-6) en un grupo
- ✅ **Separar Mesas**: Posibilidad de separar mesas previamente juntadas
- ✅ **UI de Selección**: Modo selección con checkbox animado y barra flotante
- ✅ **Modales de Confirmación**: Modal para juntar (con nota opcional) y separar (con motivo)
- ✅ **Visualización de Grupos**: Badge azul para mesa principal (+N), badge morado para secundaria
- ✅ **Sistema de Permisos**: Permiso `juntar-separar-mesas` para admin/supervisor
- ✅ **Eventos Socket.io**: `mesas-juntadas` y `mesas-separadas` para sincronización en tiempo real
- ✅ **Nombre Combinado**: Visualización correcta en todas las interfaces (ej: "M5,6,7")
- ✅ **Validaciones**: Mismo área, estados permitidos, sin pedidos abiertos, sin uniones anidadas

### v2.3 (Marzo 2026) - Mejoras de Tiempo Real

- ✅ **Listener `comanda-finalizada`**: Recibe actualización cuando cocina finaliza comanda completa
- ✅ **Sincronización mejorada**: Actualizaciones en tiempo real entre App Mozos y App Cocina

---

## 🎯 Objetivo del App de Mozos

### ¿Qué se está creando?

El **App de Mozos** es una aplicación móvil profesional diseñada para el personal de sala del restaurante Las Gambusinas. Su objetivo es digitalizar completamente el flujo de trabajo de los mozos, desde el ingreso al turno hasta el cierre de cuentas.

### Visión del Proyecto

Crear una herramienta que permita:

1. **Operación eficiente**: Reducir tiempos de toma de pedidos y errores
2. **Comunicación en tiempo real**: Sincronización instantánea con cocina y administración
3. **Trazabilidad de acciones**: Cada operación queda registrada con responsable
4. **Experiencia premium**: UI moderna con animaciones fluidas y feedback visual
5. **Trabajo offline**: Capacidad de operar sin conexión temporal

### Usuarios Objetivo

| Usuario | Función Principal |
|---------|-------------------|
| **Mozos** | Tomar pedidos, gestionar mesas, procesar pagos |
| **Supervisores** | Monitorear operaciones, resolver incidencias |
| **Administradores** | Ver métricas, gestionar configuración |

### Flujo de Trabajo del Mozo

```
Login → Ver Mapa de Mesas → Tomar Pedido → Enviar a Cocina
   ↓
Esperar Preparación → Recibir Plato → Entregar a Cliente
   ↓
Solicitar Pago → Procesar Pago → Generar Boucher → Liberar Mesa
```

---

## Tabla de Contenidos

1. [Vision General](#vision-general)
2. [Arquitectura y Tecnologias](#arquitectura-y-tecnologias)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Flujo de Datos](#flujo-de-datos)
5. [Flujo de envio de comanda (App Mozos -> Backend -> App Cocina)](#flujo-de-envio-de-comanda-app-mozos--backend--app-cocina)
6. [Estados de platos y comandas (3 apps)](#estados-de-platos-y-comandas-3-apps)
7. [Interfaz y Navegacion](#interfaz-y-navegacion)
8. [Funcionalidades Principales](#funcionalidades-principales)
9. [Integracion con Backend y Otras Apps](#integracion-con-backend-y-otras-apps)
10. [Librerias y Dependencias](#librerias-y-dependencias)
11. [Funciones y Componentes Clave](#funciones-y-componentes-clave)
12. [Problemas Criticos Identificados](#problemas-criticos-identificados)
13. [Problemas de logica en la funcion de eliminar platos](#problemas-de-logica-en-la-funcion-de-eliminar-platos)
14. [Propuestas de Mejora](#propuestas-de-mejora)
15. [Actualizacion en Tiempo Real - Arquitectura Completa](#actualización-en-tiempo-real---arquitectura-completa)
16. [Resumen Ejecutivo](#resumen-ejecutivo)

---

## Vision General

### Que es el App de Mozos?

El **App de Mozos** es una aplicacion movil (React Native con Expo) para que el personal de sala de Las Gambusinas gestione:

- **Login**: Autenticacion por nombre y DNI con animaciones premium y modal de bienvenida.
- **Configuracion dinamica de API**: Modal de ajustes para cambiar URL del servidor sin recompilar (patron Singleton).
- **Mapa de mesas**: Ver estado de mesas (libre, pedido, preparado, pagado) y acceder a comandas.
- **Creacion de comandas**: Seleccionar mesa, platos, cantidades, complementos y enviar a cocina.
- **Gestion de comandas**: Editar platos (PUT editar-platos), eliminar platos (PUT eliminar-platos por indices), eliminar comanda, ver detalle por mesa.
- **Pago**: Procesar pago, asociar cliente, generar boucher (PDF) y opciones post-pago.
- **Liberacion de mesa**: Tras confirmar pago, el mozo puede liberar la mesa o imprimir boucher.

### Caracteristicas Principales

| Caracteristica | Estado |
|----------------|--------|
| Login con nombre + DNI | Implementado (animaciones premium) |
| Configuracion dinamica de API (Singleton + AsyncStorage) | Implementado |
| Modal de configuracion en Login | Implementado |
| Mapa de mesas con estados visuales | Implementado |
| Creacion y edicion de comandas | Implementado |
| Seleccion de complementos para platos | Implementado |
| Eliminacion de platos / comandas con motivo | Implementado |
| Proceso de pago y boucher PDF | Implementado |
| Opciones post-pago (Liberar mesa / Imprimir boucher) | Implementado |
| Gestion de clientes (registrados e invitados) | Implementado |
| Tema claro/oscuro | Implementado |
| WebSocket (Socket.io) namespace `/mozos` | Implementado (conectado, rooms por mesa, heartbeat, rejoin) |
| Indicador de conexion visual (SocketStatus) | Implementado (animado, estados: online, conectando, offline, live) |
| Persistencia local (AsyncStorage) | Implementado |
| Logging local (expo-file-system) | Implementado |
| Cola offline (offlineQueue) | Implementado |
| Overlay de carga animado | Implementado |
| Soporte para orientacion horizontal/vertical | Implementado |
| **Juntar/Separar Mesas** | Implementado (v2.4) |
| **Nombre Combinado de Mesas** | Implementado (v2.4) |

---

## Arquitectura y Tecnologias

### Stack Tecnologico

| Tecnologia | Version (package.json) | Proposito |
|------------|------------------------|-----------|
| **React** | 19.1.0 | Core UI |
| **React Native** | 0.81.5 | Framework movil |
| **Expo** | 54.x | Build, assets, APIs nativas (Print, Haptics, FileSystem) |
| **React Navigation** | 6.x | Stack + Material Bottom Tabs |
| **Socket.io-client** | 4.8.3 | Tiempo real (namespace `/mozos`) |
| **Axios** | 1.6.7 | HTTP REST |
| **AsyncStorage** | 2.2.0 | Persistencia (usuario, configuracion, datos de pago) |
| **Moment-timezone** | 0.5.45 | Fechas/horas (America/Lima) |
| **expo-print** / **expo-sharing** | 15.x / 14.x | Generacion y comparticion de PDF (boucher) |
| **Moti** / **react-native-reanimated** | 0.30 / 4.x | Animaciones premium 60fps |
| **react-native-gesture-handler** | 2.x | Gestos |
| **react-native-paper** | 5.14.5 | Componentes Material |
| **expo-haptics** | 15.x | Feedback tactil |
| **expo-linear-gradient** | 15.x | Fondos con gradiente |
| **lodash.debounce** | - | Debounce en busqueda |

### Patrones Utilizados

- **Singleton**: `config/apiConfig.js` — una sola instancia de configuracion de API, persistida en AsyncStorage.
- **Context**: `ThemeContext` (tema), `SocketContext` (WebSocket y suscripcion a eventos).
- **Custom Hooks**: `useSocketMozos`, `useOrientation`.
- **Helper modules**: `utils/comandaHelpers.js`, `utils/verificarEstadoComanda.js`, `utils/offlineQueue.js`, `utils/logger.js`.

---

## Estructura del Proyecto

```
Las-Gambusinas/
├── App.js                          # Punto de entrada: Stack (Login -> Navbar -> ComandaDetalle)
├── app.json                        # Configuracion Expo (name: appmozo, slug: appmozo)
├── apiConfig.js                    # Re-export endpoints y getServerBaseURL/getWebSocketURL
├── package.json
├── config/
│   ├── apiConfig.js                # Singleton: baseURL, wsURL, testConnection, getEndpoint
│   └── axiosConfig.js              # Axios con timeout 10s anti-bloqueo
├── constants/
│   ├── colors.js
│   ├── theme.js
│   └── animations.js
├── context/
│   ├── SocketContext.js            # Provider Socket, joinMesa/leaveMesa, subscribeToEvents
│   └── ThemeContext.js
├── hooks/
│   ├── useSocketMozos.js           # Conexion Socket.io /mozos, heartbeat 25s, rejoin rooms
│   └── useOrientation.js           # Deteccion de orientacion horizontal/vertical
├── Pages/
│   ├── Login/
│   │   └── Login.js                # Login animado con modal de configuracion
│   ├── navbar/
│   │   ├── navbar.js               # Bottom Tabs: Inicio, Ordenes, Pagos, Mas + SocketStatus
│   │   └── screens/
│   │       ├── InicioScreen.js     # Mapa de mesas (muy grande, 230k+ chars)
│   │       ├── OrdenesScreen.js    # Creacion de comandas con complementos
│   │       ├── PagosScreen.js
│   │       ├── MasScreen.js        # Perfil, tema, logout
│   │       ├── SecondScreen.js
│   │       └── ThridScreen.js
│   └── ComandaDetalleScreen.js     # Detalle de comanda por mesa
├── Components/
│   ├── BottomNavBar.js
│   ├── TabNav.js
│   ├── SocketStatus.js             # Indicador visual animado de conexion
│   ├── SettingsModal.js            # Modal para configurar URL del servidor
│   ├── ModalClientes.js
│   ├── ModalComplementos.js        # Modal para seleccionar complementos de platos
│   ├── PlatoItem.js / PlatoItemConEstado.js
│   ├── FilaPlatoCompacta.js
│   ├── BadgeEstadoPlato.js
│   ├── HeaderComandaDetalle.js
│   ├── IconoBoton.js
│   ├── selects/ (selectable.js, selectdishes.js)
│   └── aditionals/ (ComandaSearch.js, Comandastyle.js)
├── utils/
│   ├── logger.js
│   ├── comandaHelpers.js           # Helpers para filtrar comandas activas, estados
│   ├── verificarEstadoComanda.js
│   └── offlineQueue.js             # Cola de eventos para procesar al reconectar
├── services/
│   └── configuracionService.js     # Servicio para configuracion de moneda
└── styles/
    └── globalStyles.js
```

---

## Flujo de Datos

### Flujo General

```
Usuario (Mozo)
    |
Login -> AsyncStorage (user) -> Navbar (Tabs)
    |
InicioScreen: GET /mesas, GET /comanda/fecha/:fecha -> mesas, comandas
    |
Tap mesa -> ComandaDetalleScreen (params: mesa) o acciones (Ordenes, Pagos)
    |
ComandaDetalle: GET /comanda/fecha/:fecha -> filtrar por mesa -> comandas
    |
SocketContext: join-mesa(mesaId) -> eventos plato-actualizado, plato-actualizado-batch, comanda-actualizada, etc.
    |
Backend (Node.js + MongoDB) <-> Socket.io namespace /mozos (rooms por mesa)
```

### Flujo por Pantalla

1. **Login** — POST `/api/mozos/auth` (nombre, DNI) -> guarda user en AsyncStorage -> navega a Navbar. Incluye modal de configuracion para cambiar URL del servidor.

2. **InicioScreen** — Carga: obtenerMesas(), obtenerComandasHoy(), obtenerPlatos(), obtenerAreas(). Estado visual de mesa: getEstadoMesa(mesa). Acciones: crear comanda (-> Ordenes), ver detalle (-> ComandaDetalle), pagar (-> Pagos), eliminar comandas/platos (API + refresh).

3. **OrdenesScreen** — Seleccion de mesa, platos con complementos (ModalComplementos), cantidades, observaciones. POST `/api/comanda` con validacion de estado de mesa. Overlay de carga animado durante envio.

4. **ComandaDetalleScreen** — refrescarComandas() (GET por fecha, filtro por mesa). Socket: joinMesa(mesa._id), listeners plato-actualizado, plato-actualizado-batch, comanda-actualizada. Editar: PUT `/api/comanda/:id/editar-platos`. Eliminar platos: PUT `/api/comanda/:id/eliminar-platos` (body: platosAEliminar como indices).

5. **PagosScreen** — Calculo total, cliente, POST `/api/boucher` -> PDF (expo-print) -> compartir -> limpia AsyncStorage y navega a Inicio.

6. **MasScreen** — Perfil, tema claro/oscuro, logout.

---

## Flujo de envio de comanda (App Mozos -> Backend -> App Cocina)

### 1. App Mozos (OrdenesScreen) – Construccion y envio

- Payload tipico POST `/api/comanda`: `{ mozos, mesas, platos: [{ plato, platoId, estado: "en_espera", complementosSeleccionados, notaEspecial }], cantidades, observaciones, status: "en_espera", IsActive: true }`.
- Validacion de estado de mesa antes de enviar (no permitir crear en mesa reservada, verificar mismo mozo).
- Overlay de carga animado con verificacion de creacion en backend.

### 2. Backend – Recepcion y persistencia

- Controller -> repository `agregarComanda()`. Valida mesa, mozo, platos; crea documento; actualiza estado mesa a `pedido`; emite `emitNuevaComanda(data.comanda)`.

### 3. Backend – Emision Socket.io

- **emitNuevaComanda:** cocina -> room `fecha-YYYY-MM-DD` (`nueva-comanda`); mozos -> broadcast (`nueva-comanda`).

### 4. App Cocina – Recepcion

- Namespace `/cocina`, room `fecha-YYYY-MM-DD`. Listener `nueva-comanda` -> muestra comanda en columna En espera.

### Resumen

```
OrdenesScreen -> POST /api/comanda -> Backend agregarComanda() -> emitNuevaComanda()
  -> Socket /cocina (room fecha) + /mozos (broadcast) -> App Cocina y App Mozos actualizan
```

---

## Estados de platos y comandas (3 apps)

### Backend (modelos y API)

- **Comanda status:** `en_espera`, `recoger`, `entregado`, `pagado`, `cancelado`.
- **Plato estado:** `pedido`, `en_espera`, `recoger`, `entregado`, `pagado`.
- **Mesa estado:** `libre`, `esperando`, `pedido`, `preparado`, `pagado`, `reservado`.

### Actualizacion de estado de comanda

- El **backend** actualiza automaticamente el `status` de la comanda. El app de mozos **no** envia PUT a `/api/comanda/:id/status` para este fin; confia en el backend y en los eventos Socket (`comanda-actualizada`).

### Helpers en el app (verificarEstadoComanda.js)

- **verificarYActualizarEstadoComanda(comandaOrId, axios):** Solo verificacion local (sin GET/PUT al backend).
- **verificarComandasEnLote(comandas, axios):** Verificacion en memoria para cada comanda.
- Cache e invalidacion se mantienen por compatibilidad.

### App Mozos (visual)

- Estado de plato: pedido (incluye en_espera), recoger, entregado, pagado. Helper: obtenerColoresEstadoAdaptados(estado, isDark, esEditable).
- Estado de mesa (visual): getEstadoMesa(mesa) segun comandas activas (libre, pedido, preparado, pagado).
- Comanda activa: sin boucher, no eliminada, status no pagado/completado/cerrado/cancelado. Helpers: esComandaActiva, filtrarComandasActivas.

### App Cocina (React Web)

- Mismos estados de plato; columnas Kanban En espera -> Recoger -> Entregado. Platos eliminado: true se muestran tachados.

---

## Interfaz y Navegacion

- **Stack (App.js):** Login -> Navbar -> ComandaDetalle (params: mesa).
- **Tabs (navbar.js):** Inicio | Ordenes | Pagos | Mas.
- **SocketStatus:** Indicador conexion WebSocket en todas las pantallas (animado: verde online, amarillo conectando, rojo offline).

| Pantalla | Funcion principal |
|----------|-------------------|
| Login | Nombre + DNI -> auth -> Navbar (animaciones premium, modal configuracion) |
| Inicio | Mapa de mesas, estados, acciones (crear orden, detalle, pagar, eliminar) |
| Ordenes | Mesa + platos + complementos + cantidades -> crear comanda |
| ComandaDetalle | Platos por estado, editar, eliminar platos/comanda, pagar |
| Pagos | Total, cliente, boucher, PDF |
| Mas | Perfil, tema, logout |

---

## Funcionalidades Principales

### 1. Configuracion de API (apiConfig.js)

- **Singleton**: baseURL, wsURL, persistencia AsyncStorage (`apiConfig`). 
- Metodos: getEndpoint(path), testConnection(), setConfig(), validateURL(), generateWsURL(baseURL).
- **Modal de configuracion**: SettingsModal accesible desde Login para cambiar URL sin recompilar.
- Indicador visual de configuracion (verde = configurado, rojo = no configurado).

### 2. Login

- Animaciones premium con react-native-reanimated y Moti.
- Particulas flotantes animadas.
- Modal de bienvenida animado al iniciar sesion.
- Validacion de conexion antes de navegar.
- POST `/api/mozos/auth` con { name, DNI }. Guardado de usuario en AsyncStorage.

### 3. Mesas y Comandas

- InicioScreen: getEstadoMesa(mesa), getTodasComandasPorMesa(mesaNum), getComandasPorMesa(mesaNum), sincronizarManual().
- ComandaDetalleScreen: GET /api/comanda/fecha/:fecha, filtro por mesa. Edicion: PUT /api/comanda/:id/editar-platos. Eliminacion platos: PUT /api/comanda/:id/eliminar-platos (body: { platosAEliminar: [indices], motivo, mozoId }).
- **Soporte para filtrado por cliente**: Parametros `clienteId` y `filterByCliente` en route.params.

### 4. Complementos de Platos

- **ModalComplementos**: Modal para seleccionar complementos opcionalmente obligatorios.
- Cada plato puede tener complementos definidos (ej: termino de carne, acompanantes).
- Nota especial por plato.
- instanceId unico para diferenciar el mismo plato con distintos complementos.

### 5. Pago y Boucher

- POST `/api/boucher` -> PDF (expo-print) -> compartir. Limpieza de comandasPago y mesaPago en AsyncStorage tras pago exitoso.
- Configuracion de moneda dinamica (IGV, simbolo) desde `configuracionService`.

### 6. WebSocket (Socket.io)

- **Namespace:** `/mozos`.
- **useSocketMozos:** Conexion a getWebSocketURL()/mozos, heartbeat 25s, reconexion con backoff, rejoin de rooms (join-mesa) tras reconectar.
- **SocketContext:** socket, connected, connectionStatus, joinMesa(mesaId), leaveMesa(mesaId), subscribeToEvents({ onMesaActualizada, onComandaActualizada, onNuevaComanda }).
- **Eventos recibidos:** 
  - `plato-actualizado` (granular)
  - `plato-actualizado-batch`
  - `comanda-actualizada`
  - `nueva-comanda`
  - `mesa-actualizada`
  - `comanda-revertida`
  - `plato-anulado`
  - `comanda-anulada`
  - `socket-status`
  - `heartbeat-pong`
- **SocketStatus:** Indicador visual animado con estados: ONLINE, CONECTANDO, OFFLINE, LIVE (parpadeo al recibir actualizaciones).

### 7. Persistencia y Offline

- AsyncStorage: usuario, apiConfig, comandasPago, mesaPago, selectedPlates, cantidadesComanda, additionalDetails.
- offlineQueue: encola eventos cuando el socket esta desconectado; al reconectar se procesan con los handlers actuales.
- Max 100 eventos en cola.

### 8. Logging

- utils/logger.js: logs en directorio de documentos (expo-file-system), formateo con moment-timezone, rotacion.

### 9. Orientacion

- useOrientation hook para detectar horizontal/vertical.
- UI adaptativa en OrdenesScreen y otras pantallas.

---

## Integracion con Backend y Otras Apps

### Endpoints REST Utilizados

| Metodo | Endpoint | Uso |
|--------|----------|-----|
| POST | `/api/mozos/auth` | Login mozo |
| GET | `/api/mesas` | Listar mesas |
| PUT | `/api/mesas/:id` | Actualizar mesa |
| GET | `/api/platos` | Listar platos |
| GET | `/api/areas` | Listar areas |
| GET | `/api/comanda/fecha/:fecha` | Comandas del dia |
| POST | `/api/comanda` | Crear comanda |
| PUT | `/api/comanda/:id` | Actualizar comanda |
| PUT | `/api/comanda/:id/editar-platos` | Editar platos/cantidades |
| PUT | `/api/comanda/:id/status` | Cambiar status comanda (uso limitado) |
| PUT | `/api/comanda/:id/plato/:platoId/estado` | Cambiar estado plato |
| PUT | `/api/comanda/:id/eliminar-plato/:platoIndex` | Eliminar un plato por indice (soft delete) |
| PUT | `/api/comanda/:id/eliminar-platos` | Eliminar varios platos por indices (body: platosAEliminar) |
| PUT | `/api/comanda/:id/eliminar` | Eliminar comanda (motivo) |
| POST | `/api/boucher` | Crear boucher (pago) |
| GET | `/api/clientes` | Clientes (buscar/crear) |
| GET | `/api/mesas/resumen` | Mesas con resumen (optimizado) |
| GET | `/api/mesas/con-comandas` | Mesas con comandas activas |

### Relacion con App Cocina

- Mozo crea comanda -> Backend emite Socket `/cocina` (nueva-comanda) -> App Cocina muestra en tiempo real.
- Cocina cambia estado -> Backend emite en `/cocina` y `/mozos` -> App Mozos actualiza por evento.

### Liberacion de mesa y flujo post-pago

- Tras confirmar pago y boucher, el app presenta opciones: Cancelar, Liberar mesa, Imprimir boucher.
- La accion de **liberar la mesa** esta implementada en el **backend** (admin.html).

### Relacion con Dashboard Admin

- Mismo backend. El app de mozos utiliza flujos con **admin.html** (liberacion de mesa, post-pago, boucher).

---

## Librerias y Dependencias

### Produccion
- react 19.1.0
- react-native 0.81.5
- expo 54.x (expo-print, expo-sharing, expo-file-system, expo-haptics, expo-linear-gradient)
- @react-navigation/* 6.x
- react-native-gesture-handler 2.x
- react-native-reanimated 4.x
- react-native-screens 4.x
- @react-native-async-storage/async-storage 2.2.0
- axios 1.6.7
- socket.io-client 4.8.3
- moment-timezone 0.5.45
- moti 0.30.0
- react-native-paper 5.14.5
- @react-native-picker/picker 2.x
- react-native-picker-select 9.x
- lodash.debounce

### Utilidades internas
- apiConfig (Singleton)
- logger (expo-file-system)
- comandaHelpers (filtrarComandasActivas, obtenerColoresEstadoAdaptados, etc.)
- offlineQueue
- configuracionService (moneda, IGV)

---

## Funciones y Componentes Clave

### useSocketMozos.js

- Conexion a getWebSocketURL()/mozos con reconnection, pingInterval 25s, pingTimeout 60s.
- join-mesa, leave-mesa; roomsJoinedRef para rejoin tras reconectar.
- Callbacks: onMesaActualizada, onComandaActualizada, onNuevaComanda, onSocketStatus.
- Estados: 'conectado', 'desconectado', 'reconectando', 'online-active'.
- Exporta: socket, connected, connectionStatus, reconnectAttempts, trackRoom, untrackRoom.

### SocketContext.js

- Provee estado de conexion, joinMesa(mesaId), leaveMesa(mesaId), subscribeToEvents(handlers).
- Al reconectar, procesa offlineQueue con los handlers actuales.
- Usa useRef para evitar recrear callbacks y causar desconexiones.

### config/apiConfig.js (Singleton)

- init(), setConfig(config), testConnection(), getEndpoint(path), getWebSocketURL(), axiosInstance, getInfo(), reset(), validateURL(), generateWsURL(baseURL).
- Persistencia en AsyncStorage con clave 'apiConfig'.

### apiConfig.js (raiz)

- Exporta constantes estaticas (LOGIN_AUTH_API, COMANDA_API, etc.) para compatibilidad.
- Funciones dinamicas: getLoginAuthAPI(), getComandaAPI(), getServerBaseURL(), getWebSocketURL(), isWsUrlValidForOfflineQueue().
- Endpoints optimizados: getMesasResumenAPI(), getMesasConComandasAPI(), getComandaCocinaAPI().

### SocketStatus.js

- Indicador visual animado permanente.
- Estados: ONLINE (verde), CONECTANDO (amarillo), OFFLINE (rojo), LIVE (verde parpadeante).
- Animacion de pulso cuando reconecta o recibe actualizaciones.

### comandaHelpers.js

- **esComandaActiva(comanda):** Determina si una comanda esta activa (sin boucher, no eliminada, no pagada).
- **filtrarComandasActivas(comandas):** Filtra array de comandas para obtener solo activas.
- **filtrarPlatosPorEstado(comandas, estadosPermitidos):** Filtra platos segun estados (pedido, recoger, etc.).
- **separarPlatosEditables(comandas):** Separa platos en editables (pedido, recoger) y no editables.
- **obtenerColoresEstadoAdaptados(estado, isDark, esEditable):** Colores adaptados al tema.
- **obtenerEstadoMesa(mesa, comandas):** Calcula estado de mesa segun comandas.

### ComandaDetalleScreen

- Filtro por mesa y opcionalmente por cliente (clienteId, filterByCliente).
- Socket listeners para actualizaciones granulares de platos.
- Modal de edicion de platos con complementos.
- Modal de eliminacion de platos/comandas con motivo.
- Configuracion de moneda dinamica (IGV, simbolo).

### OrdenesScreen

- Overlay de carga animado durante envio de comanda.
- Verificacion de estado de mesa antes de crear.
- ModalComplementos para platos con complementos.
- Debounce en busqueda de platos (300ms).
- Soporte para orientacion horizontal.

---

## Problemas Criticos Identificados

### 1. Filtrado por cliente en ComandaDetalleScreen — Implementado

- **Problema anterior:** Se filtraban comandas solo por mesa, no por cliente.
- **Estado actual:** Implementado soporte para `clienteId` y `filterByCliente` en route.params.
- **Impacto:** Permite filtrar/agrupar por cliente cuando corresponda.

### 2. Liberacion de mesa y mesa "nueva" — Parcial

- **Contexto:** Metodo de liberacion existe (backend/admin.html). Integracion app mozos <-> admin.html operativa.
- **Requisito:** Al crear una nueva comanda en una mesa liberada no deben aparecer platos de clientes que ya pagaron.
- **Estado:** Implementacion backend (IsActive, eliminada, status pagado) permite filtrar; verificado en app que listados por mesa no muestran comandas pagadas como activas.

### 3. Socket en mozos — Implementado (mejorado)

- Conexion, rooms por mesa, heartbeat 25s, rejoin tras reconectar, listeners implementados.
- Indicador visual SocketStatus siempre visible.
- Estado 'online-active' para parpadeo al recibir actualizaciones.

### 4. InicioScreen muy grande — Pendiente optimizacion

- El archivo InicioScreen.js tiene mas de 230KB (muy grande).
- **Recomendacion:** Dividir en componentes mas pequenos (MesaCard, ComandaCard, etc.).

---

## Problemas de logica en la funcion de eliminar platos

### Dos endpoints en el backend

| Endpoint | Uso | Estado comanda | Estado plato | Tipo |
|----------|-----|----------------|--------------|------|
| **PUT /comanda/:id/eliminar-plato/:platoIndex** | Un plato por **indice** | Solo `en_espera` | Cualquiera no eliminado | Soft delete (eliminado = true) |
| **PUT /comanda/:id/eliminar-platos** | Varios platos por **indices** | Cualquiera | Solo `entregado` o `recoger` | Hard delete (splice) |

### Problemas identificados

1. **Reglas opuestas:** eliminar-plato solo en en_espera; eliminar-platos solo platos en recoger/entregado. Logica repartida.
2. **Indices vs IDs:** Ambos usan **indices** (platoIndex o platosAEliminar como array de indices). En la app (ComandaDetalleScreen, InicioScreen) se envian **indices** a eliminar-platos; no enviar platoId por error.
3. **Comanda vacia tras eliminar-platos:** Backend marca comanda eliminada/cancelado; el modelo Comanda incluye `cancelado` en el enum status.
4. **Eventos Socket:** eliminar-plato emite comanda:plato-eliminado y comanda-actualizada; eliminar-platos emite plato-actualizado y comanda-actualizada. App cocina debe reaccionar a ambos.

### Recomendaciones

- Unificar criterio y documentar en codigo que platosAEliminar son **indices** (0-based).
- Mantener alineados platos y cantidades en cualquier nueva logica.
- Pruebas: eliminar plato del medio, luego varios, y verificar indices tras cada operacion.

---

## Propuestas de Mejora

### Prioridad alta — Estado

1. **Optimizar InicioScreen** — Dividir en componentes mas pequenos.
2. **Completar uso de WebSocket en todas las pantallas** — Parcial (eventos implementados; algun refresco manual aun usado).
3. **Manejo de errores y reintentos** — Mejorar try/catch y mensajes al usuario, reintentos en operaciones criticas.

### Prioridad media — Pendiente

4. Autenticacion JWT (sustituir o complementar auth actual).
5. Optimizacion de carga (paginacion, cache mesas/platos).
6. Notificaciones push.
7. Envio de logs al backend para auditoria.

### Prioridad baja — Pendiente

8. Metodos de pago en boucher (campo metodo, monto recibido, vuelto).
9. Mejoras UX (atajos, confirmaciones, indicadores de carga).

---

## 📝 Funciones Detalladas por Pantalla

### Login.js

| Función | Descripción | Endpoint |
|---------|-------------|----------|
| `handleLogin()` | Valida credenciales y navega al dashboard | `POST /api/mozos/auth` |
| `verifyConnection()` | Verifica conexión con el servidor antes de login | Config check |
| `showWelcomeModal()` | Muestra modal de bienvenida animado | Local |
| `handleConfigChange()` | Actualiza URL del servidor desde SettingsModal | AsyncStorage |

### InicioScreen.js

| Función | Descripción | Endpoint |
|---------|-------------|----------|
| `obtenerMesas()` | Carga lista de mesas con estado | `GET /api/mesas` |
| `obtenerComandasHoy()` | Carga comandas del día actual | `GET /api/comanda/fecha/:fecha` |
| `obtenerPlatos()` | Carga catálogo de platos | `GET /api/platos` |
| `obtenerAreas()` | Carga áreas del restaurante | `GET /api/areas` |
| `getEstadoMesa(mesa)` | Calcula estado visual de una mesa | Helper local |
| `getTodasComandasPorMesa(mesaNum)` | Obtiene comandas activas de una mesa | Filtro local |
| `sincronizarManual()` | Fuerza recarga de todos los datos | Múltiples GET |
| `handleEliminarComanda(comandaId)` | Elimina una comanda con motivo | `PUT /api/comanda/:id/eliminar` |
| `handleEliminarPlatos(comandaId, indices)` | Elimina platos específicos | `PUT /api/comanda/:id/eliminar-platos` |

### OrdenesScreen.js

| Función | Descripción | Endpoint |
|---------|-------------|----------|
| `seleccionarMesa(mesa)` | Selecciona mesa para nueva comanda | Local |
| `buscarPlatos(query)` | Búsqueda con debounce de platos | Filtro local |
| `agregarPlato(plato)` | Agrega plato con complementos | Local |
| `abrirModalComplementos(plato)` | Abre modal para seleccionar complementos | Local |
| `eliminarPlatoSeleccionado(index)` | Elimina plato de la lista temporal | Local |
| `actualizarCantidad(index, cantidad)` | Modifica cantidad de un plato | Local |
| `enviarComanda()` | Envía comanda al backend | `POST /api/comanda` |
| `validarEstadoMesa()` | Verifica que la mesa esté disponible | `GET /api/mesas/:id` |

### ComandaDetalleScreen.js

| Función | Descripción | Endpoint |
|---------|-------------|----------|
| `refrescarComandas()` | Recarga comandas de la mesa | `GET /api/comanda/fecha/:fecha` |
| `joinMesa(mesaId)` | Suscribe a eventos de la mesa | Socket `join-mesa` |
| `handlePlatoActualizado(data)` | Actualiza estado de plato en tiempo real | Socket event |
| `handleComandaActualizada(data)` | Actualiza comanda completa | Socket event |
| `editarPlato(plato, index)` | Abre modal para editar plato | Local |
| `guardarEdicionPlato()` | Guarda cambios del plato | `PUT /api/comanda/:id/editar-platos` |
| `eliminarPlatosSeleccionados()` | Elimina platos marcados | `PUT /api/comanda/:id/eliminar-platos` |
| `irAPago(comanda)` | Navega a pantalla de pago | Navigation |

### PagosScreen.js

| Función | Descripción | Endpoint |
|---------|-------------|----------|
| `calcularTotal()` | Calcula total de comandas a pagar | Local |
| `buscarCliente(query)` | Busca cliente por nombre/DNI | `GET /api/clientes` |
| `seleccionarCliente(cliente)` | Asigna cliente al pago | Local |
| `procesarPago()` | Registra el pago | `POST /api/boucher` |
| `generarPDF(boucher)` | Genera y comparte PDF del boucher | expo-print |
| `limpiarDatosPago()` | Limpia datos de AsyncStorage | Local |

---

## 🔌 Eventos Socket.io Detallados

### Eventos Emitidos por el App

| Evento | Datos | Cuándo |
|--------|-------|--------|
| `join-mesa` | `{ mesaId }` | Al entrar a ComandaDetalle |
| `leave-mesa` | `{ mesaId }` | Al salir de ComandaDetalle |
| `heartbeat-ping` | `{ timestamp }` | Cada 25 segundos |

### Eventos Recibidos del Backend

| Evento | Datos | Acción |
|--------|-------|--------|
| `joined-mesa` | `{ mesaId }` | Confirmación de suscripción |
| `heartbeat-ack` | `{ timestamp }` | Confirmación de heartbeat |
| `plato-actualizado` | `{ comandaId, platoId, nuevoEstado }` | Actualizar estado de plato |
| `plato-actualizado-batch` | `[{ comandaId, platoId, nuevoEstado }]` | Batch de actualizaciones |
| `comanda-actualizada` | `{ comanda }` | Recargar comanda completa |
| `nueva-comanda` | `{ comanda }` | Agregar nueva comanda |
| `mesa-actualizada` | `{ mesa }` | Actualizar estado de mesa |
| `comanda-eliminada` | `{ comandaId }` | Remover comanda |
| `socket-status` | `{ connected, socketId }` | Estado de conexión |
| `token-expiring-soon` | `{ message }` | Advertencia de token |

### Estados del SocketStatus

| Estado | Color | Descripción |
|--------|-------|-------------|
| `conectado` | Verde | Conexión establecida |
| `reconectando` | Amarillo | Intentando reconectar |
| `desconectado` | Rojo | Sin conexión |
| `auth_error` | Rojo oscuro | Error de autenticación |
| `live` | Verde parpadeante | Recibiendo datos |

---

## 🔄 Actualización en Tiempo Real - Arquitectura Completa

### Visión General del Sistema de Tiempo Real

El sistema de actualización en tiempo real conecta tres aplicaciones mediante Socket.io:
- **App Mozos** (namespace `/mozos`) - Recibe actualizaciones de platos y comandas
- **App Cocina** (namespace `/cocina`) - Emite cambios de estado de platos
- **Backend** - Orquesta eventos y mantiene la fuente de verdad

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Mozos     │     │    Backend      │     │   App Cocina    │
│  (React Native) │     │  (Node.js +     │     │   (React Web)   │
│                 │     │   Socket.io)    │     │                 │
│  namespace:     │     │                 │     │  namespace:     │
│  /mozos         │◄────┤  Event Router   ├────►│  /cocina        │
│                 │     │                 │     │                 │
│  Rooms:         │     │  Rooms:         │     │  Rooms:         │
│  - mesa-{id}    │     │  - fecha-{date} │     │  - fecha-{date} │
│  - broadcast    │     │  - mesa-{id}    │     │  - zona-{id}    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Arquitectura de Namespaces y Rooms

#### Namespace `/mozos` (App Mozos)

El namespace `/mozos` está diseñado para que los mozos reciban actualizaciones solo de las mesas que están visualizando.

**Rooms disponibles:**
| Room | Propósito | Uso |
|------|-----------|-----|
| `mesa-{mesaId}` | Actualizaciones de una mesa específica | ComandaDetalleScreen |
| broadcast (todos) | Novedades globales (nueva comanda) | InicioScreen |

**Autenticación:**
- JWT obligatorio en handshake (`auth.token`)
- Middleware `authenticateMozos` valida el token
- Socket desconectado si auth falla

#### Namespace `/cocina` (App Cocina)

**Rooms disponibles:**
| Room | Propósito | Uso |
|------|-----------|-----|
| `fecha-{YYYY-MM-DD}` | Comandas del día activo | Todas las comandas |
| `zona-{zonaId}` | Comandas de una zona específica | Cocineros por zona |
| `cocinero-{id}` | Room personal del cocinero | Configuración individual |

### Flujo Completo: Actualización de Estado de Plato

Cuando cocina cambia el estado de un plato (ej: `en_espera` → `recoger`), el flujo es:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    1. APP COCINA - Acción del Usuario                    │
├──────────────────────────────────────────────────────────────────────────┤
│  Cocinero hace clic en botón "Listo" en un plato                         │
│  → PUT /api/comanda/:id/plato/:platoId/estado                            │
│  → Body: { nuevoEstado: "recoger" }                                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    2. BACKEND - Controller                               │
├──────────────────────────────────────────────────────────────────────────┤
│  comandaController.js → cambiarEstadoPlato(id, platoId, nuevoEstado)     │
│                                                                          │
│  a) Actualiza el estado del plato en MongoDB                             │
│  b) Recalcula estado de la comanda según todos los platos                │
│  c) Actualiza estado de la mesa si es necesario                          │
│  d) Llama a función de emisión Socket                                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    3. BACKEND - Emisión Socket.io                        │
├──────────────────────────────────────────────────────────────────────────┤
│  events.js → emitPlatoActualizadoGranular(datos)                         │
│                                                                          │
│  FASE 5 (Batching): Los eventos se agregan a una cola                    │
│  Cada 300ms se emiten en batch para optimizar tráfico                    │
│                                                                          │
│  Datos del evento:                                                       │
│  {                                                                       │
│    comandaId: "67abc123...",                                             │
│    platoId: 5,                                                           │
│    nuevoEstado: "recoger",                                               │
│    estadoAnterior: "en_espera",                                          │
│    mesaId: "67def456...",                                                │
│    timestamp: "2026-03-25T14:30:00.000Z"                                 │
│  }                                                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  4a. NAMESPACE /COCINA        │   │  4b. NAMESPACE /MOZOS         │
├───────────────────────────────┤   ├───────────────────────────────┤
│  Room: fecha-2026-03-25       │   │  Room: mesa-67def456...       │
│                               │   │  (solo mozos viendo esa mesa) │
│  cocinaNamespace.to(roomName) │   │                               │
│    .emit('plato-actualizado') │   │  mozosNamespace.to(roomName)  │
│                               │   │    .emit('plato-actualizado') │
│  → Todos los cocineros ven    │   │                               │
│    el cambio en tiempo real   │   │  → Solo mozos en              │
│                               │   │    ComandaDetalleScreen       │
│                               │   │    de esa mesa lo reciben     │
└───────────────────────────────┘   └───────────────────────────────┘
                                                    │
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    5. APP MOZOS - Recepción del Evento                   │
├──────────────────────────────────────────────────────────────────────────┤
│  ComandaDetalleScreen.js                                                 │
│                                                                          │
│  socket.on('plato-actualizado', (data) => {                              │
│    // 1. Actualizar estado del plato en el state local                   │
│    // 2. Mostrar animación de cambio                                     │
│    // 3. Reproducir sonido de notificación                               │
│    // 4. Actualizar indicador visual SocketStatus a 'live'               │
│  });                                                                     │
│                                                                          │
│  El mozo ve inmediatamente que el plato pasó a "Listo para recoger"      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Flujo Completo: Actualización de Comanda Entera

Cuando se actualiza toda la comanda (ej: se elimina un plato, se editan cantidades):

```
App Mozos → PUT /api/comanda/:id/editar-platos → Backend
                                                    │
                                                    ▼
                                    emitComandaActualizada(comandaId)
                                                    │
                    ┌───────────────────────────────┼───────────────────┐
                    ▼                               ▼                   ▼
            /cocina (fecha)              /mozos (mesa)         /admin (broadcast)
                    │                               │
                    ▼                               ▼
            App Cocina actualiza          App Mozos actualiza
            la comanda completa           la vista de la mesa
```

### Optimización FASE 5: Batching de Eventos

El backend implementa un sistema de batching para reducir el tráfico de WebSocket:

**Problema:** Si cocina cambia 10 platos en 2 segundos, se emitían 10 eventos separados.

**Solución FASE 5:**
```javascript
// Backend - websocketBatch.js
const batchQueue = [];
const BATCH_INTERVAL = 300; // ms

function addPlatoEvent(datos) {
  batchQueue.push(datos);
}

setInterval(() => {
  if (batchQueue.length > 0) {
    emitPlatoBatch({
      comandaId: batchQueue[0].comandaId,
      platos: batchQueue.map(e => ({
        platoId: e.platoId,
        nuevoEstado: e.nuevoEstado,
        estadoAnterior: e.estadoAnterior
      })),
      mesaId: batchQueue[0].mesaId
    }));
    batchQueue.length = 0;
  }
}, BATCH_INTERVAL);
```

**Resultado:**
- 10 eventos → 1 evento batch
- Reducción de payload: ~80%
- Latencia máxima: 300ms (imperceptible para UX)

### Sistema de Heartbeat y Reconexión

#### Heartbeat (App Mozos)

```javascript
// useSocketMozos.js
const heartbeatInterval = 25000; // 25 segundos

// Enviar ping cada 25s
setInterval(() => {
  if (socket.connected) {
    socket.emit('heartbeat-ping', { timestamp: Date.now() });
  }
}, heartbeatInterval);

// Esperar pong
socket.on('heartbeat-pong', (data) => {
  const latency = Date.now() - lastPingRef.current;
  console.log(`Latencia: ${latency}ms`);
});
```

#### Reconexión Automática con Backoff

```javascript
// Configuración de Socket.io
const socket = io(wsURL, {
  reconnection: true,
  reconnectionDelay: 1000,      // 1s inicial
  reconnectionDelayMax: 5000,   // 5s máximo
  reconnectionAttempts: 10,      // 10 intentos
  randomizationFactor: 0.5,      // Aleatoriedad para evitar tormentas
});
```

#### Rejoin de Rooms tras Reconexión

Cuando el socket se reconecta, debe volver a unirse a las rooms:

```javascript
// useSocketMozos.js
const roomsJoinedRef = useRef(new Set());

// Al conectar
socket.on('connect', () => {
  // Rejoin rooms
  roomsJoinedRef.current.forEach(mesaId => {
    socket.emit('join-mesa', mesaId);
  });
});

// Trackear rooms
const joinMesa = (mesaId) => {
  socket.emit('join-mesa', mesaId);
  roomsJoinedRef.current.add(mesaId);  // Guardar para rejoin
};
```

### Manejo de Eventos en ComandaDetalleScreen

La pantalla `ComandaDetalleScreen` implementa listeners para todos los eventos relevantes:

```javascript
// ComandaDetalleScreen.js - Estructura de listeners
useEffect(() => {
  if (!socket || !connected || !mesaId) return;

  // 1. Unirse a la room de la mesa
  joinMesa(mesaId);

  // 2. Listeners de eventos
  socket.on('plato-actualizado', handlePlatoActualizado);
  socket.on('plato-agregado', handlePlatoAgregado);
  socket.on('plato-entregado', handlePlatoEntregado);
  socket.on('comanda-actualizada', handleComandaActualizada);
  socket.on('comanda-eliminada', handleComandaEliminada);
  socket.on('plato-anulado', handlePlatoAnulado);
  socket.on('comanda-anulada', handleComandaAnulada);

  // 3. Cleanup al desmontar
  return () => {
    leaveMesa(mesaId);
    socket.off('plato-actualizado');
    socket.off('plato-agregado');
    socket.off('plato-entregado');
    socket.off('comanda-actualizada');
    socket.off('comanda-eliminada');
    socket.off('plato-anulado');
    socket.off('comanda-anulada');
  };
}, [socket, connected, mesaId]);
```

#### Handlers de Eventos

**1. plato-actualizado (Actualización granular de un plato)**
```javascript
const handlePlatoActualizado = (data) => {
  const { comandaId, platoId, nuevoEstado, mesaId } = data;
  
  // Buscar la comanda en el state
  setComandas(prevComandas => {
    return prevComandas.map(comanda => {
      if (comanda._id === comandaId) {
        return {
          ...comanda,
          platos: comanda.platos.map((plato, index) => {
            if (index === platoId) {
              return { ...plato, estado: nuevoEstado };
            }
            return plato;
          })
        };
      }
      return comanda;
    });
  });
  
  // Feedback visual
  setConnectionStatus('live');
  setTimeout(() => setConnectionStatus('conectado'), 2000);
};
```

**2. comanda-actualizada (Recarga completa de comanda)**
```javascript
const handleComandaActualizada = (data) => {
  if (data.comanda) {
    // Reemplazar la comanda en el state
    setComandas(prevComandas => {
      const existe = prevComandas.find(c => c._id === data.comanda._id);
      if (existe) {
        return prevComandas.map(c => 
          c._id === data.comanda._id ? data.comanda : c
        );
      }
      return [...prevComandas, data.comanda];
    });
  }
};
```

**3. plato-anulado (Plato anulado por cocina)**
```javascript
const handlePlatoAnulado = (data) => {
  const { comanda, platoAnulado, auditoria } = data;
  
  // Actualizar la comanda
  handleComandaActualizada({ comanda });
  
  // Mostrar alerta al mozo
  Alert.alert(
    'Plato Anulado',
    `El plato "${platoAnulado.nombre}" fue anulado por cocina.\nMotivo: ${platoAnulado.motivo}`
  );
};
```

### Flujo de Eventos: App Cocina → Backend → App Mozos

#### Secuencia de Estados de Plato

```
ESTADO INICIAL: pedido/en_espera
       │
       │  [Cocina toma el plato]
       ▼
ESTADO: en_preparacion (si aplica)
       │
       │  [Cocina marca como listo]
       ▼
ESTADO: recoger  ──────────────────────► EVENTO: plato-actualizado
       │                                        → App Mozos recibe
       │  [Mozo recoge y entrega]               → SocketStatus parpadea
       ▼
ESTADO: entregado  ────────────────────► EVENTO: plato-entregado
                                                → App Mozos actualiza
```

### Indicador Visual de Conexión (SocketStatus)

El componente `SocketStatus` refleja el estado de la conexión en tiempo real:

| Estado | Visual | Condición |
|--------|--------|-----------|
| `conectado` | Verde sólido | Socket conectado, sin actividad reciente |
| `reconectando` | Amarillo parpadeante | Socket intentando reconectar |
| `desconectado` | Rojo sólido | Sin conexión |
| `auth_error` | Rojo oscuro | Error de autenticación JWT |
| `live` / `online-active` | Verde parpadeante | Recibiendo datos en tiempo real |

**Transición a 'live':**
```javascript
// Al recibir cualquier evento de actualización
socket.on('plato-actualizado', (data) => {
  setConnectionStatus('online-active');
  
  // Volver a estado normal después de 2s
  setTimeout(() => {
    setConnectionStatus('conectado');
  }, 2000);
});
```

### Cola Offline (offlineQueue)

Cuando el socket está desconectado, los eventos se encolan para procesarse al reconectar:

```javascript
// utils/offlineQueue.js
const MAX_QUEUE_SIZE = 100;
const queue = [];

const offlineQueue = {
  add: (event, data) => {
    if (queue.length < MAX_QUEUE_SIZE) {
      queue.push({ event, data, timestamp: Date.now() });
    }
  },
  
  processQueue: (handlers) => {
    while (queue.length > 0) {
      const { event, data } = queue.shift();
      if (handlers[event]) {
        handlers[event](data);
      }
    }
  }
};
```

### Diagrama de Secuencia Completo

```
┌────────┐          ┌────────┐          ┌────────┐          ┌────────┐
│  Mozos │          │Backend │          │ Socket │          │ Cocina │
└───┬────┘          └───┬────┘          └───┬────┘          └───┬────┘
    │                   │                   │                   │
    │ join-mesa(mesaId) │                   │                   │
    │──────────────────►│                   │                   │
    │                   │ joined-mesa       │                   │
    │◄──────────────────│                   │                   │
    │                   │                   │                   │
    │                   │                   │  PUT /plato/estado│
    │                   │                   │◄──────────────────│
    │                   │                   │                   │
    │                   │ emitPlatoActualiz │                   │
    │                   │◄──────────────────│                   │
    │                   │                   │                   │
    │ plato-actualizado │                   │                   │
    │◄──────────────────│                   │                   │
    │                   │                   │                   │
    │ [Actualiza UI]    │                   │                   │
    │                   │                   │                   │
```

### Resumen de Eventos por Dirección

#### Backend → App Mozos (Eventos recibidos)

| Evento | Cuándo se emite | Datos |
|--------|-----------------|-------|
| `plato-actualizado` | Cocina cambia estado de plato | `{ comandaId, platoId, nuevoEstado, estadoAnterior, mesaId }` |
| `plato-actualizado-batch` | Batch de múltiples platos | `{ comandaId, platos: [{ platoId, nuevoEstado }] }` |
| `comanda-actualizada` | Cambios en toda la comanda | `{ comandaId, comanda, platosEliminados }` |
| `nueva-comanda` | Se crea nueva comanda | `{ comanda }` |
| `mesa-actualizada` | Cambia estado de mesa | `{ mesaId, mesa }` |
| `comanda-eliminada` | Se elimina comanda completa | `{ comandaId }` |
| `plato-anulado` | Cocina anula un plato | `{ comandaId, comanda, platoAnulado, auditoria }` |
| `comanda-anulada` | Cocina anula toda la comanda | `{ comandaId, comanda, platosAnulados }` |
| `comanda-revertida` | Cocina revierte comanda | `{ comanda, mesa }` |
| `comanda-finalizada` | Cocina finaliza comanda completa (v7.4) | `{ comandaId, comanda, tipo: 'comanda-finalizada' }` |
| `mesas-juntadas` | Mesas combinadas en grupo (v2.4) | `{ mesaPrincipal, mesasSecundarias, mozoId, totalMesas, timestamp }` |
| `mesas-separadas` | Mesas separadas de grupo (v2.4) | `{ mesaPrincipal, mesasSecundarias, mozoId, totalMesasLiberadas, timestamp }` |

#### App Mozos → Backend (Eventos emitidos)

| Evento | Cuándo se emite | Datos |
|--------|-----------------|-------|
| `join-mesa` | Mozo entra a ComandaDetalleScreen | `mesaId` |
| `leave-mesa` | Mozo sale de ComandaDetalleScreen | `mesaId` |
| `heartbeat-ping` | Cada 25 segundos | `{ timestamp }` |

---

## 📁 Almacenamiento Local (AsyncStorage)

### Claves Utilizadas

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `user` | JSON | Datos del mozo logueado |
| `apiConfig` | JSON | Configuración de URL del servidor |
| `comandasPago` | Array | Comandas seleccionadas para pagar |
| `mesaPago` | Object | Mesa actual en proceso de pago |
| `selectedPlates` | Array | Platos seleccionados temporalmente |
| `cantidadesComanda` | Object | Cantidades por plato |
| `additionalDetails` | Object | Detalles adicionales de pedido |
| `socketLastPing` | String | Timestamp del último heartbeat |
| `cocinaAuth` | String | Token JWT de autenticación |

### Estructura de apiConfig

```javascript
{
  "baseURL": "http://192.168.18.11:3000",
  "wsURL": "ws://192.168.18.11:3000",
  "lastUpdated": "2026-03-25T10:30:00Z"
}
```

### Estructura de user

```javascript
{
  "_id": "65abc123...",
  "name": "Juan Pérez",
  "DNI": "12345678",
  "rol": "mozos",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔗 Juntar y Separar Mesas (v2.4)

### Descripción General

La funcionalidad de Juntar y Separar Mesas permite combinar múltiples mesas en un grupo para atender grupos grandes de clientes. La mesa de menor número se convierte en la principal y las demás quedan como secundarias.

### Requisitos para Juntar Mesas

- Entre 2 y 6 mesas
- Todas deben estar activas
- Todas deben pertenecer a la misma área
- Estados permitidos: solo 'libre' o 'esperando'
- Ninguna puede estar ya unida
- No debe haber Pedidos abiertos en ninguna mesa
- Permiso: `juntar-separar-mesas` (admin/supervisor)

### Funciones Helper

#### `mesaEstaEnGrupo(mesa)`
Verifica si una mesa pertenece a un grupo (es principal o secundaria).

#### `obtenerGrupoMesa(mesa)`
Retorna información completa del grupo:
```javascript
{
  esPrincipal: boolean,
  grupo: [mesa, ...mesasUnidas],
  mesaPrincipal: mesa,
  mesasSecundarias: [...]
}
```

#### `formatearGrupoMesas(mesa)`
Formatea para mostrar en UI: `"M5 + 6, 7"` o `"Unida a M5"`.

#### `puedeJuntarMesas()`
Valida todas las condiciones y retorna:
```javascript
{ valido: boolean, mensaje: string }
```

### Endpoints Utilizados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/mesas/juntar` | Junta varias mesas en un grupo |
| POST | `/api/mesas/separar` | Separa mesas previamente juntadas |
| GET | `/api/mesas/grupos` | Lista todas las mesas agrupadas |
| GET | `/api/mesas/:id/grupo` | Obtiene una mesa con info de su grupo |

### Visualización de Grupos

| Estado | Visualización | Comportamiento |
|--------|--------------|----------------|
| Principal con unidas | Badge azul `+N` | Recibe comandas, muestra botón separar |
| Secundaria | Badge morado `M5` | No recibe comandas, redirige a principal |
| Independiente | Sin badge | Comportamiento normal |

### Flujo de Uso: Juntar Mesas

```
1. Mozo presiona "Juntar Mesas" en sidebar
   ↓
2. Se activa modoSeleccion=true
   ↓
3. Mozo toca las mesas a juntar (2-6 mesas)
   ↓
4. Se muestra barra flotante con contador
   ↓
5. Mozo presiona "Juntar"
   ↓
6. Se abre modal de confirmación
   ↓
7. Mozo confirma → POST /api/mesas/juntar
   ↓
8. UI se actualiza automáticamente via Socket.io
```

---

## Resumen Ejecutivo

- **Que es:** App movil (React Native + Expo) para mozos: login, mapa de mesas, comandas, pago y boucher PDF. Se conecta al mismo backend que App Cocina y admin.html.
- **Estructura:** Stack (Login -> Navbar -> ComandaDetalle), Tabs (Inicio, Ordenes, Pagos, Mas). Singleton apiConfig, ThemeContext, SocketContext. Pantallas criticas: InicioScreen, ComandaDetalleScreen, OrdenesScreen, PagosScreen.
- **Flujo de datos:** Carga inicial por REST; creacion/edicion/eliminacion comandas y platos via REST (editar-platos, eliminar-plato, eliminar-platos). Tiempo real via Socket.io namespace `/mozos`, rooms por mesa; ComandaDetalleScreen joinMesa y reacciona a eventos. AsyncStorage y offlineQueue para persistencia y eventos pendientes.
- **Tiempo real:** Sistema de actualizacion en tiempo real bidireccional entre App Mozos y App Cocina via Backend. Namespaces separados (`/mozos`, `/cocina`), rooms por mesa para notificaciones especificas, batching de eventos (FASE 5) para optimizar trafico, heartbeat cada 25s para mantener conexion activa, reconexion automatica con backoff exponencial y rejoin de rooms.
- **Novedades:** Configuracion dinamica de API, animaciones premium, complementos de platos, indicador de conexion visual mejorado, soporte para orientacion horizontal, overlay de carga animado, **juntar/separar mesas (v2.4)**, **nombre combinado de mesas**.
- **Trabajo con otras apps:** Backend fuente de verdad. App Cocina recibe por `/cocina`; cambios de cocina se reflejan en `/mozos`. admin.html para post-pago y liberacion de mesa.
- **Mejoras recomendadas:** Alto: optimizar InicioScreen, unificar uso WebSocket y manejo de errores. Medio: JWT, optimizacion, push, logs al backend. Bajo: metodo de pago en boucher, UX.

---

## 🔧 Herramientas y Tecnologías Utilizadas

### Stack Principal

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **React** | 19.1.0 | Core UI |
| **React Native** | 0.81.5 | Framework móvil |
| **Expo** | 54.x | Build, assets, APIs nativas |
| **React Navigation** | 6.x | Navegación Stack + Tabs |
| **Socket.io-client** | 4.8.3 | Tiempo real |
| **Axios** | 1.13.6 | HTTP REST |
| **AsyncStorage** | 2.2.0 | Persistencia local |
| **Moti** | 0.30.0 | Animaciones 60fps |
| **react-native-reanimated** | 4.x | Animaciones nativas |

### APIs de Expo Utilizadas

| API | Uso |
|-----|-----|
| **expo-print** | Generación de PDF (bouchers) |
| **expo-sharing** | Compartir archivos PDF |
| **expo-file-system** | Logging local |
| **expo-haptics** | Feedback táctil |
| **expo-linear-gradient** | Fondos con gradiente |

### Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Expo CLI** | Desarrollo y build |
| **Expo Go** | Testing rápido en dispositivo |
| **React DevTools** | Debug de componentes |
| **Flipper** | Debug de React Native |

---

## 🚀 Roadmap de Desarrollo

### Fase Actual (v2.2) - Marzo 2026

- ✅ Login con animaciones premium
- ✅ Configuración dinámica de API
- ✅ WebSocket con autenticación JWT
- ✅ Complementos de platos
- ✅ Indicador de conexión visual
- ✅ Soporte orientación horizontal
- ✅ Cola offline

### Próximas Implementaciones

#### Corto Plazo (1-2 meses)

1. **Optimizar InicioScreen** - Dividir en componentes más pequeños
   - Extraer MesaCard, ComandaCard, ActionButton
   - Implementar FlatList virtualizada
   - Mejorar rendimiento de renderizado

2. **Mejorar manejo de errores**
   - Toast notifications en lugar de alerts
   - Reintentos automáticos para operaciones críticas
   - Mensajes más descriptivos

3. **Tests unitarios**
   - Configurar Jest + React Native Testing Library
   - Tests para helpers (comandaHelpers, verificarEstadoComanda)
   - Tests para hooks (useSocketMozos, useOrientation)

#### Medio Plazo (3-6 meses)

1. **Notificaciones push**
   - Alertas de platos listos
   - Recordatorios de mesas pendientes
   - Comunicados de administración

2. **Mejoras de UX**
   - Atajos de gestos (swipe para acciones)
   - Búsqueda de platos con voz
   - Modo oscuro automático

3. **Sincronización mejorada**
   - Background sync
   - Resolución de conflictos
   - Estado de sincronización visible

#### Largo Plazo (6-12 meses)

1. **Offline completo**
   - Base de datos local (SQLite/Realm)
   - Sincronización bidireccional
   - Operaciones CRUD offline

2. **IA para sugerencias**
   - Platos más pedidos por cliente
   - Sugerencias basadas en hora
   - Alertas de alergias

3. **Multi-idioma**
   - Español, inglés, portugués
   - Detección automática
   - Traducción de menú

---

## 💡 Sugerencias para el Equipo de Desarrollo

### Mejoras de Código

1. **Estructura de carpetas por features**
   ```
   src/
   ├── features/
   │   ├── auth/
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   ├── screens/
   │   │   └── utils/
   │   ├── mesas/
   │   ├── comandas/
   │   └── pagos/
   ```

2. **Custom hooks para lógica reutilizable**
   ```javascript
   // hooks/useComandas.js
   export const useComandas = (mesaId) => {
     const [comandas, setComandas] = useState([]);
     const [loading, setLoading] = useState(true);
     
     const fetchComandas = useCallback(async () => {
       // ...
     }, [mesaId]);
     
     return { comandas, loading, refetch: fetchComandas };
   };
   ```

3. **Componentes atómicos**
   ```javascript
   // components/atoms/
   // Button, Input, Badge, Card, etc.
   
   // components/molecules/
   // MesaCard, PlatoItem, SearchBar, etc.
   
   // components/organisms/
   // ComandaList, MesaGrid, etc.
   ```

### Mejoras de Performance

1. **Memoización selectiva**
   ```javascript
   const MesaCard = memo(({ mesa, onPress }) => {
     // ...
   }, (prevProps, nextProps) => {
     return prevProps.mesa.estado === nextProps.mesa.estado;
   });
   ```

2. **FlatList optimizada**
   ```javascript
   <FlatList
     data={mesas}
     keyExtractor={(item) => item._id}
     renderItem={renderMesa}
     initialNumToRender={10}
     maxToRenderPerBatch={5}
     windowSize={5}
     removeClippedSubviews={true}
   />
   ```

3. **Imágenes optimizadas**
   - Usar WebP en lugar de PNG
   - Caché de imágenes con react-native-fast-image
   - Lazy loading de imágenes

### Mejoras de UX

1. **Estados de carga skeletons**
   ```javascript
   const MesaSkeleton = () => (
     <View style={styles.skeleton}>
       <Skeleton width={100} height={100} />
     </View>
   );
   ```

2. **Feedback táctil consistente**
   ```javascript
   const handlePress = () => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
     // ...
   };
   ```

3. **Navegación fluida**
   ```javascript
   // Transiciones personalizadas
   navigation.navigate('ComandaDetalle', {
     mesa,
     transition: 'slide_from_right'
   });
   ```

### Mejoras de Seguridad

1. **Almacenamiento seguro**
   ```javascript
   // Usar expo-secure-store para datos sensibles
   import * as SecureStore from 'expo-secure-store';
   
   await SecureStore.setItemAsync('userToken', token);
   ```

2. **Validación de entrada**
   ```javascript
   const validateDNI = (dni) => {
     return /^\d{8}$/.test(dni);
   };
   ```

3. **Timeout de sesión**
   ```javascript
   // Cerrar sesión después de inactividad
   const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
   ```

---

## 📊 Métricas y Monitoreo Sugeridos

### Métricas de Uso

| Métrica | Descripción |
|---------|-------------|
| Tiempo promedio de pedido | Desde selección de mesa hasta envío |
| Tasa de errores de conexión | Porcentaje de operaciones fallidas |
| Uso de offline queue | Frecuencia de operaciones offline |
| Tiempo de carga inicial | App start hasta mostrar mesas |

### Monitoreo Recomendado

| Herramienta | Uso |
|-------------|-----|
| **Sentry** | Crash reporting |
| **Firebase Analytics** | Eventos de uso |
| **Flipper** | Debug en desarrollo |
| **React Native Performance** | Métricas de rendimiento |

---

## 🔗 Integración con Otras Aplicaciones

### Flujo de Datos con Backend

```
App Mozos ───────────────────────► Backend
    │                                  │
    │  POST /api/comanda               │
    │  GET /api/mesas                  │
    │  GET /api/platos                 │
    │  POST /api/boucher               │
    │                                  │
    │  ◄───────────────────────────────│
    │         Socket.io /mozos         │
    │         Eventos tiempo real       │
```

### Flujo de Datos con App Cocina

```
App Mozos ──► Backend ──► App Cocina
    │                         │
    │  Nueva comanda          │
    │  ──────────────────────►│
    │                         │
    │  ◄──────────────────────│
    │  Plato listo            │
```

### Sincronización de Estados

| Estado | App Mozos | Backend | App Cocina |
|--------|-----------|---------|------------|
| Comanda creada | En espera | `en_espera` | Columna "En espera" |
| Plato en preparación | Pendiente | `en_espera` | Columna "Preparando" |
| Plato listo | Recoger | `recoger` | Columna "Listo" |
| Plato entregado | Entregado | `entregado` | Movido a historial |

---

**Version del documento:** 2.4  
**Ultima actualizacion:** Marzo 2026  
**Sistema:** Las Gambusinas – App de Mozos
