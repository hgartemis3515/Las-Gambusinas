# Documentación Completa - App de Mozos (Las Gambusinas)

**Version:** 2.10  
**Ultima Actualizacion:** Abril 2026  
**Tecnologia:** React Native + Expo + Socket.io-client + AsyncStorage

**Proposito del documento:** Analisis completo del app de mozos para Las Gambusinas: estructura, flujo de datos, integracion con backend y otras aplicaciones, librerias, funciones principales, problemas y propuestas de mejora. Documento alineado con el codebase actual (abril 2026). Incluye documentacion detallada de ComandaDetalleScreen, guía de conversión a APK nativo con notificaciones push, funcionamiento en segundo plano, y catálogo completo de eventos Socket.io.

---

## 📋 Historial de Cambios

### v2.10 (Abril 2026) - Catálogo de Eventos Socket.io

- ✅ **Nueva sección completa**: Catálogo de todos los eventos Socket.io que el App Mozos recibe
- ✅ **Eventos de Comandas**: `nueva-comanda`, `comanda-actualizada`, `comanda-eliminada`, `comanda-revertida`, `comanda-finalizada`, `comanda-anulada`
- ✅ **Eventos de Platos**: `plato-actualizado`, `plato-actualizado-batch`, `plato-anulado`, `plato-entregado`
- ✅ **Eventos de Mesas**: `mesa-actualizada`, `mesas-juntadas`, `mesas-separadas`, `mapa-actualizado`, `catalogo-mesas-areas-actualizado`
- ✅ **Eventos de Descuentos**: Documentación completa de `PUT /api/comanda/:id/descuento` y `DELETE /api/comanda/:id/descuento` desde comandas.html
- ✅ **Eventos de Reservas**: `reserva-creada`, `reserva-actualizada`, `reserva-expirada`, `reserva-alerta-expiracion`, `reserva-cancelada`
- ✅ **Eventos de Propinas**: `propina-registrada`, `propina-actualizada`, `propina-eliminada`
- ✅ **Eventos de Menú**: `plato-menu-actualizado`
- ✅ **Notificaciones Push sugeridas**: Mapeo de eventos a notificaciones móviles recomendadas
- ✅ **Resumen de listeners**: Lista completa de eventos a escuchar en `useSocketMozos.js`

### v2.9 (Abril 2026) - Guía de Conversión a APK Nativo

- ✅ **Nueva sección completa**: Conversión de Expo Go a APK/AAB productivo
- ✅ **Notificaciones Push**: Implementación completa con FCM/APNs
  - Servicio `notificationService.js` con registro de tokens
  - Backend controller para envío de notificaciones
  - Canales Android personalizados por tipo de alerta
- ✅ **Background Tasks**: Funcionamiento en segundo plano
  - BackgroundFetch API para polling de mesas
  - Headless JS para tareas con app cerrada
  - BootReceiver para inicio automático
- ✅ **Foreground Service**: Socket.io persistente en Android
  - Servicio nativo con notificación persistente
  - Manejo de reconexión automática
- ✅ **Optimización de batería**: Solicitud de exclusión de optimizaciones
- ✅ **Checklist de implementación**: 5 fases con pasos detallados
- ✅ **Dependencias actualizadas**: expo-notifications, expo-background-fetch, @notifee/react-native

### v2.8 (Marzo 2026) - Voucher Sincronizado con Backend

- ✅ **Nueva funcionalidad**: Plantilla de voucher sincronizada entre backend y App Mozos
- ✅ **Generación de PDF mejorada**: El app genera PDFs usando la plantilla configurada en `bouchers.html`
- ✅ **ModalPagoExitoso**: Nuevo componente para mostrar opciones post-pago con animaciones
- ✅ **ModalRegistrarPropina**: Nuevo modal para registrar propinas después del pago
- ✅ **Endpoints sincronizados**: `/api/configuracion/voucher-plantilla` para obtener configuración
- ✅ **Archivos modificados**:
  - `Pages/navbar/screens/ModalPagoExitoso.js` - Nuevo componente
  - `Pages/navbar/screens/ModalRegistrarPropina.js` - Nuevo componente
  - `Pages/navbar/screens/PagosScreen.js` - Integración de modales post-pago

### v2.7 (Marzo 2026) - Corrección de Registro de Propinas

- ✅ **Bug corregido**: El modal de propinas fallaba con error 400 al intentar registrar propinas
- ✅ **Causa raíz**: El campo `mozoId` no se extraía correctamente cuando `boucherData.mozo` venía poblado desde el backend
- ✅ **Solución frontend**: Función `extraerId()` robusta en `ModalRegistrarPropina.js` que maneja strings, ObjectIds y objetos poblados
- ✅ **Solución backend**: Función `idsCoinciden()` mejorada en `propinaCalculo.js` para comparar correctamente IDs
- ✅ **Validación priorizada**: El `mesaId` ahora se extrae de `boucherData.mesa` como prioridad para evitar discrepancias
- ✅ **Debug mejorado**: Logs detallados de IDs enviados al endpoint para facilitar debugging
- ✅ **Archivos modificados**:
  - `Pages/navbar/screens/ModalRegistrarPropina.js` - Extracción robusta de IDs
  - `Pages/navbar/screens/PagosScreen.js` - Corrección en paso de `mozoData`
  - `src/utils/propinaCalculo.js` (backend) - Función `idsCoinciden()` mejorada

### v2.6 (Marzo 2026) - Visualización de Complementos en ComandaDetalleScreen

- ✅ **Bug corregido**: Los complementos de los platos no se mostraban en ComandaDetalleScreen ni en los modales de eliminación
- ✅ **Causa raíz**: La proyección `PROYECCION_RESUMEN_MESA` en el backend NO incluía los campos `platos.complementosSeleccionados` y `platos.notaEspecial`
- ✅ **Solución backend**: Agregados campos faltantes en la proyección del repository
- ✅ **Solución frontend**: Actualizados helpers `filtrarPlatosPorEstado()` y `separarPlatosEditables()` para incluir complementos
- ✅ **Modales actualizados**: Eliminación de platos, eliminación de comanda ahora muestran complementos
- ✅ **Lección documentada**: Ver sección "🐛 Debugging de Datos - Metodología" para aprender a identificar problemas similares

### v2.5 (Marzo 2026) - Documentación de ComandaDetalleScreen

- ✅ **Documentación detallada de ComandaDetalleScreen**: Cada función documentada con propósito, endpoints, validaciones y flujos
- ✅ **Relaciones entre pantallas**: Diagramas de navegación y flujo de datos
- ✅ **Estados de plato**: Ciclo de vida completo desde pedido hasta pagado
- ✅ **Casos de uso comunes**: Ejemplos prácticos de operaciones típicas
- ✅ **Notas de implementación**: Consideraciones técnicas críticas

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
15. [Actualizacion en Tiempo Real - Arquitectura Completa](#actualización-en-tiempo-real---arquitectura-completa) — ver [Herramientas tiempo real pantallas](#herramientas-para-actualizar-pantallas-en-tiempo-real)
16. [Resumen Ejecutivo](#resumen-ejecutivo)
17. [Conversion a APK Nativo y Funcionalidades Moviles Avanzadas](#-conversión-a-apk-nativo-y-funcionalidades-móviles-avanzadas)
    - [Generación de APK/AAB Productivo](#1-generación-de-apkaab-productivo)
    - [Sistema de Notificaciones Push](#2-sistema-de-notificaciones-push)
    - [Funcionamiento en Segundo Plano](#3-funcionamiento-en-segundo-plano-background)
    - [Socket.io en Segundo Plano](#4-socketio-en-segundo-plano)
    - [Optimización de Batería](#5-optimización-de-batería)
    - [Resumen de Implementación](#6-resumen-de-implementación)
18. [Catálogo Completo de Eventos Socket.io y Notificaciones](#-catálogo-completo-de-eventos-socketio-y-notificaciones)
    - [Eventos de Comandas](#1-eventos-de-comandas)
    - [Eventos de Platos](#2-eventos-de-platos)
    - [Eventos de Mesas](#3-eventos-de-mesas)
    - [Eventos de Descuentos](#4-eventos-de-descuentos-adminsupervisor)
    - [Eventos de Reservas](#5-eventos-de-reservas)
    - [Eventos de Propinas](#6-eventos-de-propinas)
    - [Eventos de Conexión y Sistema](#7-eventos-de-conexión-y-sistema)
    - [Eventos de Menú/Catálogo](#8-eventos-de-menúcatálogo)
    - [Notificaciones Push Sugeridas](#9-notificaciones-push-sugeridas)
    - [Resumen de Listeners](#10-resumen-de-listeners-en-app-mozos)

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
- **ModalPagoExitoso (v2.8)**: Modal post-pago con opciones: Registrar Propina, Compartir, Imprimir, Ir al inicio.
- **ModalRegistrarPropina (v2.8)**: Modal para registrar propinas (monto fijo o porcentaje) después del pago exitoso.
- **Plantilla sincronizada (v2.8)**: El PDF se genera usando la plantilla configurada en el backend (`/api/configuracion/voucher-plantilla`).

### 6. WebSocket (Socket.io)

- **Namespace:** `/mozos`.
- **useSocketMozos:** Conexion a getWebSocketURL()/mozos, heartbeat 25s, reconexion con backoff, rejoin de rooms (join-mesa) tras reconectar.
- **SocketContext:** socket, connected, connectionStatus, joinMesa(mesaId), leaveMesa(mesaId), subscribeToEvents({ onMesaActualizada, onComandaActualizada, onNuevaComanda, onMesasJuntadas, onMesasSeparadas, onMapaActualizado, onCatalogoMesasAreas }).
- **Eventos recibidos (listeners en useSocketMozos; la pantalla reacciona vía subscribeToEvents):** 
  - `plato-actualizado` (granular)
  - `plato-actualizado-batch`
  - `comanda-actualizada`
  - `nueva-comanda`
  - `mesa-actualizada`
  - `mesas-juntadas` / `mesas-separadas`
  - `catalogo-mesas-areas-actualizado` (admin mesas/áreas → refetch REST en InicioScreen)
  - `mapa-actualizado` (editor de mapa admin → refetch mesas en InicioScreen)
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
- Callbacks: onMesaActualizada, onComandaActualizada, onNuevaComanda, onSocketStatus, onMesasJuntadas, onMesasSeparadas, onMapaActualizado, onCatalogoMesasAreas.
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
| `mesa-actualizada` | `{ mesaId, mesa, timestamp }` | Actualizar estado de mesa (merge en lista local) |
| `catalogo-mesas-areas-actualizado` | `{ timestamp, razon? }` | Admin creó/editó/eliminó mesa o área: refetch `GET /mesas` y `GET /areas` (InicioScreen) |
| `mapa-actualizado` | `{ areaId, timestamp }` | Admin guardó mapa: refetch mesas (InicioScreen) |
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

### Herramientas para actualizar pantallas en tiempo real

Las pantallas no “poll-ean” de forma continua cuando el socket está bien: reaccionan a **eventos Socket.io** y, en algunos casos, a un **refetch REST** puntual. Componentes y archivos implicados:

| Herramienta | Ubicación / paquete | Función |
|-------------|---------------------|---------|
| **socket.io-client** | `package.json` (~4.8.3) | Cliente WebSocket; conexión al namespace `/mozos` con JWT en `auth.token`. |
| **useSocketMozos** | `hooks/useSocketMozos.js` | Crea el socket, heartbeat (~25s), reconexión, registro de listeners (`mesa-actualizada`, `comanda-actualizada`, `catalogo-mesas-areas-actualizado`, `mapa-actualizado`, juntar/separar, etc.) y notifica `SocketStatus`. |
| **SocketContext** | `context/SocketContext.js` | Provider global: expone `subscribeToEvents`, `joinMesa` / `leaveMesa`, `connected`. Los callbacks de pantalla se guardan en refs para no desmontar el socket en cada render. |
| **subscribeToEvents** | Desde cualquier pantalla con `useSocket()` | Cada pantalla registra qué hacer al llegar cada evento (p. ej. InicioScreen: `handleMesaActualizada`, refetch catálogo/mapa). |
| **React Navigation useFocusEffect** | Pantallas como `InicioScreen.js` | Patrón recomendado: al **entrar** a la pantalla se llama `subscribeToEvents({ ... })`; en el **cleanup** al salir se ponen esos handlers a `null` para no procesar eventos fuera de la pantalla activa. |
| **Estado React (useState)** | Dentro de cada pantalla | Tras un evento, se actualiza la UI con `setMesas`, `setComandas`, etc. (merge parcial o lista completa según el evento). |
| **Axios + apiConfig** | `config/axiosConfig.js`, `config/apiConfig.js` | Refetch cuando el evento lo exige: p. ej. `GET /api/mesas` y `GET /api/areas` tras `catalogo-mesas-areas-actualizado`; `GET /api/mesas` tras `mapa-actualizado` en Inicio. |
| **offlineQueue** | `utils/offlineQueue.js` | Si el socket estuvo caído, algunos eventos pueden quedar encolados y aplicarse al reconectar con los handlers vigentes. |
| **Polling de respaldo** | `InicioScreen.js` (efecto ligado a `socketConnected`) | Solo cuando el WebSocket **no** está conectado: intervalo ~30s que vuelve a pedir mesas/comandas por REST. |
| **SocketStatus** | `Components/SocketStatus.js` (navbar) | Indicador visual (conectado / reconectando / live al recibir datos). |

**Resumen:** el backend emite en `/mozos` → **useSocketMozos** recibe → **SocketContext** delega al callback registrado con **subscribeToEvents** en la pantalla enfocada → esa pantalla actualiza **estado React** y, si aplica, hace **GET** para alinearse con la fuente de verdad.

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

## 📄 ComandaDetalleScreen - Documentación Detallada

### Propósito y Objetivo

`ComandaDetalleScreen` es la **pantalla central de operaciones** del App de Mozos. Es el hub principal donde el mozo gestiona todas las operaciones relacionadas con una mesa específica: visualizar platos, editar comandas, eliminar platos, marcar entregas, y procesar pagos.

### Ubicación en la Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE NAVEGACIÓN                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   InicioScreen ──────► ComandaDetalleScreen ◄───── OrdenesScreen    │
│        │                      │                           │         │
│        │                      │                           │         │
│        │                      ▼                           │         │
│        │                 PagosScreen  ◄───────────────────┘         │
│        │                      │                                     │
│        │                      ▼                                     │
│        └────────────── Volver a Inicio ◄────────────────────────────┘
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Relación con Otras Pantallas

| Pantalla | Relación | Descripción |
|----------|----------|-------------|
| **InicioScreen** | Origen principal | Navega aquí al tocar una mesa con comandas activas. Recibe `mesa` y `comandas` como parámetros. |
| **OrdenesScreen** | Creación de comandas | Navega aquí para crear nueva comanda (`handleNuevaComanda`). Recibe `mesa` y `reserva` como parámetros. |
| **PagosScreen** | Procesar pagos | Navega aquí cuando todos los platos están entregados (`handlePagar`). Envía `mesa`, `comandasParaPagar` y `totalPendiente`. |

### Parámetros de Navegación Recibidos

```javascript
// route.params
{
  mesa: Object,           // Datos completos de la mesa
  comandas: Array,        // Comandas iniciales (opcional, para evitar recarga)
  onRefresh: Function,    // Callback para refrescar InicioScreen
  clienteId: String,      // ID de cliente para filtrar (opcional)
  filterByCliente: Boolean, // Activar filtro por cliente
  reserva: Object         // Datos de reserva asociada (opcional)
}
```

---

### Funciones Principales - Documentación Detallada

#### 1. Funciones de Carga y Actualización de Datos

##### `refrescarComandas()` - Líneas 218-267

**Propósito:** Obtener las comandas actualizadas de la mesa desde el backend.

**Endpoint utilizado:** `GET /api/comanda/fecha/:fecha`

**Flujo:**
1. Obtiene la fecha actual en zona horaria `America/Lima`
2. Construye la URL del endpoint según configuración
3. Filtra las comandas por ID de mesa o número de mesa
4. Aplica `filtrarComandasActivas()` para excluir comandas pagadas/eliminadas
5. Aplica filtro opcional por cliente si `filterByCliente` está activo
6. Actualiza el estado local y ejecuta `verificarComandasEnLote()` para corrección automática de status

**Retorno:** `Promise<Array>` - Array de comandas activas

**Uso:** Se ejecuta al montar el componente, al recibir actualizaciones Socket, y manualmente con pull-to-refresh.

---

##### `prepararPlatosOrdenados()` - Líneas 163-211

**Propósito:** Transformar las comandas en una lista plana de platos ordenados por prioridad de estado.

**Lógica:**
1. Itera sobre todas las comandas y sus platos
2. Extrae información relevante de cada plato (cantidad, estado, precio, complementos)
3. Normaliza el estado `en_espera` → `pedido`
4. Excluye platos eliminados (`eliminado: true`) y anulados (`anulado: true`)
5. Ordena por prioridad: `recoger` (1) → `pedido` (2) → `entregado` (3) → `pagado` (4)

**Estado actualizado:** `todosLosPlatos` - Array plano de objetos de plato

---

#### 2. Funciones de Socket.io (Tiempo Real)

##### Listeners de Eventos - Líneas 351-527

**Propósito:** Escuchar actualizaciones en tiempo real del backend para reflejar cambios instantáneamente.

| Evento | Handler | Acción |
|--------|---------|--------|
| `plato-actualizado` | Líneas 361-416 | Actualiza estado de un plato específico. Muestra alerta si el plato pasó a `recoger`. |
| `plato-agregado` | Líneas 418-424 | Refresca comandas si el plato pertenece a nuestra mesa. |
| `plato-entregado` | Líneas 426-428 | Refresca comandas. |
| `comanda-actualizada` | Líneas 430-437 | Invalida caché y refresca si es nuestra comanda. |
| `comanda-eliminada` | Líneas 439-452 | Refresca y navega a Inicio si no quedan comandas activas. |
| `plato-anulado` | Líneas 455-475 | Muestra alerta al mozo indicando que cocina anuló un plato. |
| `comanda-anulada` | Líneas 478-514 | Muestra alerta con el total anulado y navega a Inicio si corresponde. |

**Manejo de Rooms:**
- `joinMesa(mesaId)`: Se une a la room de la mesa al montar el componente
- `leaveMesa(mesaId)`: Sale de la room al desmontar el componente

**Indicador Visual:**
- `setLocalConnectionStatus('online-active')`: Parpadea verde al recibir actualizaciones
- Vuelve a estado normal después de 2 segundos

---

#### 3. Funciones de Edición de Comanda

##### `handleEditarComanda()` - Líneas 900-957

**Propósito:** Abrir el modal de edición para modificar platos de la comanda.

**Validaciones:**
- Solo platos en estados `pedido` o `recoger` son editables
- Muestra alerta si no hay platos editables

**Preparación de datos:**
- Carga catálogo de platos con `obtenerPlatos()`
- Prepara `platosEditados` con datos completos de cada plato editable
- Genera `instanceId` único para cada instancia de plato

**Estados modificados:**
- `platosEditables`: Lista de platos que se pueden editar
- `platosNoEditables`: Platos que no se pueden modificar (ya entregados)
- `platosEditados`: Estado temporal de edición
- `modalEditarVisible`: Abre el modal

---

##### `handleGuardarEdicion()` - Líneas 713-801

**Propósito:** Guardar los cambios realizados en la edición de la comanda.

**Endpoint utilizado:** `PUT /api/comanda/:id`

**Validaciones de Seguridad:**
- Detecta si se intentaron eliminar platos en estado `recoger` (no permitido desde edición)
- Muestra error y ofrece refrescar si se detectó manipulación

**Payload enviado:**
```javascript
{
  mesas: mesa._id,
  platos: [{ plato, platoId, estado, complementosSeleccionados, notaEspecial }],
  cantidades: [1, 2, 1, ...],
  observaciones: "Sin cebolla en el segundo..."
}
```

---

#### 4. Funciones de Eliminación

##### `handleEliminarPlatos()` - Líneas 959-976

**Propósito:** Abrir el modal para seleccionar platos a eliminar.

**Reglas de Negocio:**
- **Solo se pueden eliminar platos en estado `pedido`**
- Los platos en `recoger` ya están preparados y no deben desperdiciarse

**Estados modificados:**
- `platosParaEliminar`: Lista de platos eliminables
- `modalEliminarVisible`: Abre el modal

---

##### `confirmarEliminacionPlatos()` - Líneas 997-1029

**Propósito:** Validar y proceder con la eliminación de platos seleccionados.

**Validaciones:**
- No permitir eliminar todos los platos (usar eliminar comanda)
- Detectar platos preparados y mostrar advertencia de desperdicio

---

##### `procederConEliminacion()` - Líneas 1031-1162

**Propósito:** Ejecutar la eliminación de platos en el backend.

**Endpoint utilizado:** `PUT /api/comanda/:id/eliminar-platos`

**Payload:**
```javascript
{
  platosAEliminar: [0, 2, 5], // ÍNDICES de platos a eliminar (0-based)
  motivo: "El cliente cambió de opinión",
  mozoId: "65abc123...",
  usuarioId: "65abc123..."
}
```

**⚠️ CRÍTICO:** Los índices son posiciones en el array `comanda.platos`, NO IDs de plato.

**Comportamiento post-eliminación:**
- Si se eliminan todos los platos → La comanda se marca como cancelada
- Navega automáticamente a InicioScreen

---

##### `handleEliminarComanda()` - Líneas 1164-1221

**Propósito:** Preparar y validar la eliminación de una comanda completa.

**Reglas de Negocio:**
- Solo se puede eliminar si TODOS los platos están en estado `pedido`
- Si hay algún plato en `recoger` o `entregado` → Bloquear eliminación

**Validaciones:**
```javascript
const hayPlatosEnRecoger = todosLosPlatos.some(p => p.estado === 'recoger' && !p.eliminado);
const hayPlatosEntregados = todosLosPlatos.some(p => 
  (p.estado === 'entregado' || p.estado === 'pagado') && !p.eliminado
);

if (hayPlatosEnRecoger || hayPlatosEntregados) {
  // Bloquear eliminación
}
```

---

##### `confirmarEliminacionComanda()` - Líneas 1223-1341

**Propósito:** Ejecutar la eliminación de la comanda en el backend.

**Endpoint utilizado:** `PUT /api/comanda/:id/eliminar`

**Payload:**
```javascript
{
  motivo: "El cliente se fue sin pagar",
  usuarioId: "65abc123...",
  mozoId: "65abc123..."
}
```

---

#### 5. Funciones de Entrega de Platos

##### `toggleSeleccionarPlatoEntregar(plato)` - Líneas 1419-1437

**Propósito:** Alternar la selección de un plato para entrega masiva.

**Identificación única:**
```javascript
const platoKey = plato._id || `${plato.platoId}-${plato.index}`;
```
Usa el `_id` del subdocumento (único por instancia) para distinguir platos duplicados con diferentes complementos.

---

##### `handleEntregarPlatos()` - Líneas 1440-1460

**Propósito:** Confirmar y ejecutar la entrega de platos seleccionados.

**Validación:** Muestra confirmación con cantidad de platos a entregar.

---

##### `ejecutarEntregaPlatos()` - Líneas 1463-1544

**Propósito:** Ejecutar las peticiones PUT para marcar platos como entregados.

**Endpoint utilizado:** `PUT /api/comanda/:id/plato/:platoIdentifier/estado`

**Payload:**
```javascript
{ nuevoEstado: 'entregado' }
```

**Manejo de errores:**
- Procesa cada plato individualmente
- Acumula errores sin detener el proceso
- Muestra resumen de éxitos y errores al finalizar

---

##### `handleMarcarPlatoEntregado(platoObj)` - Líneas 270-319

**Propósito:** Marcar un único plato como entregado (acción individual desde la fila).

**Flujo:**
1. Valida que el plato esté en estado `recoger` o `pedido`
2. Muestra confirmación al usuario
3. Envía PUT al endpoint `/estado`
4. Refresca comandas y muestra confirmación

---

#### 6. Funciones de Navegación y Acciones

##### `handleNuevaComanda()` - Líneas 1343-1362

**Propósito:** Navegar a OrdenesScreen para crear una nueva comanda.

**Condiciones permitidas:**
- Mesa en estado `pedido`, `preparado`, `recoger`, o `reservado`
- Si viene de una reserva, la pasa como parámetro

**Navegación:**
```javascript
navigation.navigate('Ordenes', {
  mesa: mesa,
  origen: 'ComandaDetalle',
  reserva: reserva || null
});
```

---

##### `handlePagar()` - Líneas 1364-1411

**Propósito:** Navegar a PagosScreen para procesar el pago.

**Validaciones:**
- Todos los platos deben estar en estado `entregado` o `pagado`
- Si hay platos pendientes, muestra alerta

**Flujo:**
1. Ejecuta `verificarYActualizarEstadoComanda()` para corrección preventiva
2. Obtiene comandas para pagar desde `/api/comanda/comandas-para-pagar/:mesaId`
3. Navega a PagosScreen con los datos

**Navegación:**
```javascript
navigation.navigate('Pagos', {
  mesa: response.data.mesa,
  comandasParaPagar: response.data.comandas,
  totalPendiente: response.data.totalPendiente,
  origen: 'ComandaDetalle'
});
```

---

#### 7. Funciones de Descuento (Admin/Supervisor)

##### `handleAbrirDescuento()` - Líneas 809-831

**Propósito:** Abrir el modal para aplicar un descuento a la comanda.

**Permisos requeridos:** `rol === 'admin'` o `rol === 'supervisor'`

---

##### `handleAplicarDescuento()` - Líneas 834-895

**Propósito:** Aplicar el descuento en el backend.

**Endpoint utilizado:** `PUT /api/comanda/:id/descuento`

**Payload:**
```javascript
{
  descuento: 10, // Porcentaje
  motivo: "Cliente frecuente",
  usuarioId: "65abc123...",
  usuarioRol: "admin"
}
```

---

#### 8. Funciones de Cálculo

##### `calcularTotales()` - Líneas 536-569

**Propósito:** Calcular subtotal, IGV y total de la comanda.

**Configuración dinámica:**
- Obtiene porcentaje de IGV desde `configMoneda`
- Soporta precios que incluyen o no incluyen IGV
- Usa decimales configurados

**Lógica:**
```javascript
if (preciosIncluyenIGV) {
  // Desglosar IGV del precio total
  igv = subtotal * (igvPorcentaje / 100) / (1 + igvPorcentaje / 100);
  subtotalSinIGV = subtotal - igv;
} else {
  // Agregar IGV al precio
  subtotalSinIGV = subtotal;
  igv = subtotal * (igvPorcentaje / 100);
  total = subtotal + igv;
}
```

---

### Estados del Componente

| Estado | Tipo | Propósito |
|--------|------|-----------|
| `comandas` | Array | Lista de comandas activas de la mesa |
| `todosLosPlatos` | Array | Lista plana de platos ordenados por prioridad |
| `refreshing` | Boolean | Indicador de carga para pull-to-refresh |
| `loading` | Boolean | Indicador de carga para operaciones |
| `userInfo` | Object | Datos del usuario logueado |
| `configMoneda` | Object | Configuración de moneda (IGV, símbolo, decimales) |
| `modalEditarVisible` | Boolean | Controla visibilidad del modal de edición |
| `modalEliminarVisible` | Boolean | Controla visibilidad del modal de eliminación de platos |
| `modalEliminarComandaVisible` | Boolean | Controla visibilidad del modal de eliminación de comanda |
| `modalDescuentoVisible` | Boolean | Controla visibilidad del modal de descuento |
| `platosEditados` | Array | Estado temporal de platos durante edición |
| `platosSeleccionadosEliminar` | Array | Platos marcados para eliminar |
| `platosSeleccionadosEntregar` | Array | Platos marcados para entregar |
| `localConnectionStatus` | String | Estado local de conexión Socket ('conectado', 'online-active', etc.) |

---

### Validaciones de Botones

| Botón | Condición de Habilitación |
|-------|---------------------------|
| **Editar Comanda** | `platosEnPedido.length > 0` |
| **Eliminar Platos** | `platosEnPedido.length > 0` (solo estado `pedido`) |
| **Eliminar Comanda** | `comandas.length > 0 && comandas[0].status !== 'pagado'` y sin platos en `recoger`/`entregado` |
| **Nueva Comanda** | Mesa en estados `pedido`, `preparado`, `recoger`, o `reservado` |
| **Entregar** | `platosEnRecoger.length > 0` |
| **Pagar** | Todos los platos en estado `entregado` o `pagado` |
| **Descuento** | `userInfo.rol === 'admin' \|\| 'supervisor'` |

---

### Diagrama de Flujo de Estados de Plato

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA DEL PLATO                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [OrdenesScreen]                                                   │
│        │                                                            │
│        │ POST /api/comanda                                          │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │ PEDIDO  │ ◄── Estado inicial al crear comanda                   │
│   │ en_espera│   - Editable ✓                                       │
│   └────┬────┘   - Eliminable ✓                                      │
│        │                                                            │
│        │ [Cocina marca como listo]                                  │
│        │ Socket: plato-actualizado                                  │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │RECOGER │ ◄── Listo para entregar                                │
│   │        │   - Editable ✓ (con restricciones)                     │
│   └────┬────┘   - NO eliminable ✗                                   │
│        │                                                            │
│        │ [Mozo entrega]                                             │
│        │ PUT /plato/:id/estado {nuevoEstado: 'entregado'}           │
│        ▼                                                            │
│   ┌──────────┐                                                      │
│   │ENTREGADO │ ◄── En manos del cliente                             │
│   │          │   - NO editable ✗                                    │
│   └────┬─────┘   - NO eliminable ✗                                  │
│        │                                                            │
│        │ [Mozo procesa pago]                                        │
│        │ POST /api/boucher                                          │
│        ▼                                                            │
│   ┌─────────┐                                                       │
│   │ PAGADO  │ ◄── Pago completado                                   │
│   └─────────┘                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Componentes Utilizados

| Componente | Propósito | Props Recibidas |
|------------|-----------|-----------------|
| `HeaderComandaDetalle` | Cabecera con info de mesa y estado de conexión | `mesa`, `comanda`, `onSync`, `navigation`, `connectionStatus`, `isConnected` |
| `FilaPlatoCompacta` | Renderiza cada fila de plato | `plato`, `estilos`, `onMarcarEntregado`, `onToggleSeleccion`, `seleccionado` |
| `BadgeEstadoPlato` | Badge con estado del plato | `estado`, `isDark`, `esEditable` |
| `ModalComplementos` | Modal para seleccionar complementos | `visible`, `plato`, `onConfirm`, `onCancel` |

---

### Helpers Utilizados (utils/comandaHelpers.js)

| Función | Propósito |
|---------|-----------|
| `filtrarComandasActivas(comandas)` | Filtra comandas que no están pagadas ni eliminadas |
| `separarPlatosEditables(comandas)` | Separa platos en editables y no editables |
| `filtrarPlatosPorEstado(comandas, estados)` | Filtra platos por estados permitidos |
| `detectarPlatosPreparados(platos)` | Detecta si hay platos ya preparados |
| `validarEliminacionCompleta(todos, seleccionados)` | Valida que no se eliminen todos los platos |
| `obtenerColoresEstadoAdaptados(estado, isDark, esEditable)` | Obtiene colores según estado y tema |

---

### Endpoints REST Utilizados

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/api/comanda/fecha/:fecha` | Obtener comandas del día |
| PUT | `/api/comanda/:id` | Actualizar comanda completa |
| PUT | `/api/comanda/:id/editar-platos` | Editar platos y cantidades |
| PUT | `/api/comanda/:id/eliminar-platos` | Eliminar platos por índices |
| PUT | `/api/comanda/:id/eliminar` | Eliminar comanda completa |
| PUT | `/api/comanda/:id/plato/:platoId/estado` | Cambiar estado de un plato |
| PUT | `/api/comanda/:id/descuento` | Aplicar descuento (admin/supervisor) |
| GET | `/api/comanda/comandas-para-pagar/:mesaId` | Obtener comandas listas para pagar |
| GET | `/api/platos` | Obtener catálogo de platos |

---

### Casos de Uso Comunes

#### Caso 1: Mozo quiere agregar más platos a una mesa existente

```
1. Mozo está en ComandaDetalleScreen
2. Presiona "Nueva Comanda"
3. Navega a OrdenesScreen con mesa preseleccionada
4. Agrega platos y envía
5. Vuelve a ComandaDetalleScreen (via Socket o manual)
```

#### Caso 2: Cliente cambia de opinión sobre un plato

```
1. Mozo está en ComandaDetalleScreen
2. Presiona "Eliminar Platos"
3. Selecciona el plato (debe estar en estado "pedido")
4. Ingresa motivo (mínimo 5 caracteres)
5. Confirma eliminación
6. Backend emite Socket "plato-actualizado" o "comanda-actualizada"
```

#### Caso 3: Cocina notifica que un plato está listo

```
1. Backend emite Socket "plato-actualizado" con nuevoEstado: "recoger"
2. ComandaDetalleScreen recibe el evento
3. Actualiza estado del plato en el state local
4. Muestra Alert: "🍽️ Plato Listo - [nombre] está listo para recoger"
5. SocketStatus parpadea en verde ("online-active")
```

#### Caso 4: Mozo entrega platos al cliente

```
1. Mozo ve platos en estado "recoger" (fondo amarillo)
2. Selecciona los platos a entregar (checkbox)
3. Presiona "Entregar"
4. Confirma la acción
5. Cada plato cambia a estado "entregado"
6. Al entregar todos, el botón "Pagar" se habilita
```

#### Caso 5: Procesar pago

```
1. Todos los platos están en estado "entregado"
2. Mozo presiona "Pagar"
3. Se valida que no haya platos pendientes
4. Se navega a PagosScreen con comandasParaPagar
5. PagosScreen genera boucher PDF
```

---

### Notas de Implementación Importantes

#### Identificación Única de Platos

**Problema:** El mismo plato puede aparecer múltiples veces con diferentes complementos.

**Solución:** Usar el `_id` del subdocumento como identificador único:
```javascript
const platoKey = plato._id || `${plato.platoId}-${plato.index}`;
```

#### Prevención de Loops en Socket Listeners

**Problema:** Los listeners de Socket pueden causar loops infinitos si incluyen dependencias inestables.

**Solución:** Usar `useRef` para mantener referencias estables:
```javascript
const comandasRef = useRef(comandas);
const refrescarComandasRef = useRef(refrescarComandas);

// En el listener
socket.on('plato-actualizado', (data) => {
  const comandasActuales = comandasRef.current; // Siempre actualizado
});
```

#### Validación de Estados para Eliminación

**Regla de negocio crítica:**
- **Solo platos en estado `pedido` pueden eliminarse**
- Platos en `recoger` ya están preparados (costo de ingredientes)
- Platos en `entregado` ya fueron consumidos

---

## 🐛 Debugging de Datos - Metodología

### Lección Aprendida: Caso de los Complementos Faltantes (Marzo 2026)

#### El Problema

Los complementos seleccionados de los platos no se mostraban en `ComandaDetalleScreen` ni en los modales relacionados. El mozo no podía ver información crítica como término de carne, acompañamientos o salsas elegidas por el cliente.

#### Metodología de Debugging Aplicada

**1. Verificar el flujo completo de datos:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Mozos     │     │    Backend      │     │   MongoDB       │
│  (crea comanda) │────►│  (guarda datos) │────►│  (persiste)     │
│                 │     │                 │     │                 │
│  ¿Datos ok? ✓   │     │  ¿Datos ok? ✓   │     │  ¿Datos ok? ✓   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**2. Identificar dónde se pierden los datos:**

| Capa | Verificación | Resultado |
|------|--------------|-----------|
| Modelo MongoDB | Revisar schema | ✅ Tiene `complementosSeleccionados` |
| Endpoint POST | Revisar payload enviado | ✅ Incluye complementos |
| Endpoint GET | Revisar respuesta del servidor | ❌ NO incluye complementos |
| Frontend helpers | Revisar mapeo de datos | ✅ Código correcto |

**3. Ubicar el archivo responsable:**

El archivo clave fue `comanda.repository.js` que contiene las **proyecciones** de MongoDB.

**4. El error específico:**

```javascript
// ANTES - Proyección incompleta
const PROYECCION_RESUMEN_MESA = {
    'platos._id': 1,
    'platos.estado': 1,
    'platos.eliminado': 1,
    'platos.anulado': 1
    // ❌ FALTABAN: complementosSeleccionados, notaEspecial, plato, platoId
};

// DESPUÉS - Proyección corregida
const PROYECCION_RESUMEN_MESA = {
    cantidades: 1,
    'platos._id': 1,
    'platos.platoId': 1,
    'platos.estado': 1,
    'platos.eliminado': 1,
    'platos.anulado': 1,
    'platos.complementosSeleccionados': 1,  // ✅ AGREGADO
    'platos.notaEspecial': 1,                // ✅ AGREGADO
    'platos.plato': 1                         // ✅ AGREGADO
};
```

### Archivos Clave para Debugging de Datos

#### Backend (Node.js)

| Archivo | Cuándo revisarlo |
|---------|------------------|
| `src/database/models/*.model.js` | Cuando faltan campos en los datos recibidos |
| `src/repository/*.repository.js` | Cuando los datos no llegan completos (PROYECCIONES) |
| `src/controllers/*.controller.js` | Cuando hay errores en endpoints específicos |

#### Frontend (React Native)

| Archivo | Cuándo revisarlo |
|---------|------------------|
| `utils/comandaHelpers.js` | Cuando los helpers no mapean datos correctamente |
| `Components/FilaPlatoCompacta.js` | Cuando la UI no muestra datos que deberían estar |
| `Pages/ComandaDetalleScreen.js` | Cuando los modales no muestran información |

### Checklist de Debugging de Datos

```
□ 1. ¿El modelo de MongoDB tiene el campo?
   → Revisar src/database/models/*.model.js

□ 2. ¿El endpoint POST guarda el campo?
   → Revisar payload en la app que crea los datos

□ 3. ¿El endpoint GET retorna el campo?
   → Usar Postman/curl para verificar respuesta cruda
   → Si falta, revisar PROYECCIONES en repository

□ 4. ¿El frontend recibe el campo?
   → Console.log de la respuesta del API

□ 5. ¿El helper mapea el campo?
   → Revisar funciones en comandaHelpers.js

□ 6. ¿El componente renderiza el campo?
   → Revisar props y condiciones de renderizado
```

### Patrón Común: Proyecciones de MongoDB

MongoDB permite usar **proyecciones** para limitar los campos retornados, optimizando rendimiento. Sin embargo, si un campo no está en la proyección, **nunca llegará al frontend**.

```javascript
// Ubicación típica: src/repository/*.repository.js

// ❌ ERROR COMÚN: Proyección muy restrictiva
query.select({ 'platos.estado': 1 }); // Solo retorna estado

// ✅ CORRECTO: Incluir todos los campos necesarios
query.select({
    'platos._id': 1,
    'platos.estado': 1,
    'platos.complementosSeleccionados': 1,
    'platos.notaEspecial': 1
});
```

### Comando Útil: Verificar Datos en el Backend

```bash
# Hacer petición directa al endpoint
curl http://localhost:3000/api/comanda/fecha/2026-03-29 | jq '.[0].platos[0]'

# Verificar si el campo existe en la respuesta
```

### Resumen

**Regla de oro:** Cuando un dato no aparece en el frontend, la causa más probable es que **nunca salió del backend**. Verificar siempre las proyecciones en el repository antes de buscar errores en el frontend.

---

## 📱 Conversión a APK Nativo y Funcionalidades Móviles Avanzadas

### Estado Actual: Expo Go vs APK Productivo

El app está desarrollado con **Expo (SDK 54)** en modo desarrollo. Para producción, requiere convertirse en un APK/AAP standalone con build nativo.

| Aspecto | Expo Go (Actual) | APK Productivo |
|---------|------------------|----------------|
| Distribución | Solo desarrollo | Play Store / APK directo |
| Notificaciones push | Limitadas | Completas con FCM/APNs |
| Segundo plano | Limitado | Headless JS + Background Tasks |
| Performance | Debug mode | Optimizado |
| Permisos | Parciales | Completos |

---

### 1. Generación de APK/AAB Productivo

#### Opción A: EAS Build (Recomendado - Expo Application Services)

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Configurar proyecto
eas build:configure

# Crear eas.json
```

**eas.json recomendado:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Comandos de build:**
```bash
# APK para testing interno
eas build --platform android --profile preview

# AAB para Play Store
eas build --platform android --profile production

# Submit a Play Store
eas submit --platform android --profile production
```

#### Opción B: Prebuild y Build Local

```bash
# Prebuild para generar carpetas android/
npx expo prebuild --platform android

# Build con Gradle
cd android
./gradlew assembleRelease

# APK generado en:
# android/app/build/outputs/apk/release/app-release.apk
```

#### Configuración Requerida en app.json

```json
{
  "expo": {
    "name": "App Mozos - Las Gambusinas",
    "slug": "appmozo",
    "version": "2.8.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "android": {
      "package": "com.lasgambusinas.appmozo",
      "versionCode": 28,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.POST_NOTIFICATIONS"
      ],
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true
    },
    "plugins": [
      "expo-notifications",
      [
        "expo-background-fetch",
        {
          "icon": "./assets/icon.png",
          "color": "#1a1a2e"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "tu-project-id"
      }
    }
  }
}
```

---

### 2. Sistema de Notificaciones Push

#### Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE NOTIFICACIONES PUSH                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Backend ──────► FCM (Firebase Cloud Messaging) ──────► App Mozos      │
│      │                        │                          │              │
│      │                        │                          │              │
│      │   1. Detecta evento   │   2. Envía push         │   3. Muestra  │
│      │   (plato listo)       │      notification       │      alerta   │
│      │                        │                          │              │
│      │   4. Guarda token     │◄── 5. Token guardado    │   6. App      │
│      │      en MongoDB       │      al login           │      abre     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Instalación de Dependencias

```bash
npm install expo-notifications expo-device expo-constants
npm install @react-native-firebase/app @react-native-firebase/messaging
```

#### Implementación: Servicio de Notificaciones

**services/notificationService.js:**
```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';

// Configurar handler de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registrar para notificaciones push
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones de Mesa',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    // Canal específico para platos listos
    await Notifications.setNotificationChannelAsync('plato-listo', {
      name: 'Platos Listos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#4CAF50',
      sound: 'plato_listo.wav',
      enableVibrate: true,
    });

    // Canal para alertas de mesa
    await Notifications.setNotificationChannelAsync('mesa-alerta', {
      name: 'Alertas de Mesa',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF9800',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permiso de notificaciones denegado');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'tu-project-id',
      })).data;
      
      console.log('✅ Token de notificación:', token);
      
      // Guardar token localmente
      await AsyncStorage.setItem('pushToken', token);
      
      // Enviar token al backend
      await sendTokenToBackend(token);
    } catch (e) {
      console.error('Error obteniendo token:', e);
    }
  } else {
    console.log('⚠️ Notificaciones push solo funcionan en dispositivo físico');
  }

  return token;
}

// Enviar token al backend
async function sendTokenToBackend(token) {
  try {
    const user = JSON.parse(await AsyncStorage.getItem('user'));
    if (user && user._id) {
      await axios.post('/api/mozos/push-token', {
        mozoId: user._id,
        pushToken: token,
        platform: Platform.OS,
        deviceId: Device.deviceId || 'unknown',
      });
      console.log('✅ Token registrado en backend');
    }
  } catch (error) {
    console.error('Error enviando token:', error);
  }
}

// Listener de notificaciones recibidas
export function setupNotificationListeners(navigation) {
  // Notificación recibida mientras app está en primer plano
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📬 Notificación recibida:', notification);
      
      const data = notification.request.content.data;
      
      // Vibrar y reproducir sonido
      if (data.tipo === 'plato-listo') {
        // Sonido específico para plato listo
        playSound('plato_listo');
      }
    }
  );

  // Usuario toca la notificación
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('👆 Usuario tocó notificación');
      
      const data = response.notification.request.content.data;
      
      // Navegar según el tipo de notificación
      if (data.mesaId) {
        navigation.navigate('ComandaDetalle', {
          mesaId: data.mesaId,
          mesa: data.mesa,
        });
      }
    }
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

// Reproducir sonido local
async function playSound(soundName) {
  // Implementar con expo-av si es necesario
  console.log(`🔊 Reproduciendo sonido: ${soundName}`);
}
```

#### Integración en App.js

```javascript
import { registerForPushNotificationsAsync, setupNotificationListeners } from './services/notificationService';

export default function App() {
  const [notification, setNotification] = useState(false);
  const navigationRef = useRef();

  useEffect(() => {
    // Registrar notificaciones
    registerForPushNotificationsAsync();

    // Configurar listeners
    const cleanup = setupNotificationListeners(navigationRef.current);

    return cleanup;
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        {/* ... screens ... */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

#### Backend: Controlador de Notificaciones

**src/controllers/notificationController.js:**
```javascript
const admin = require('firebase-admin');
const Mozo = require('../database/models/mozo.model');

// Inicializar Firebase Admin (una sola vez)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// Guardar token del dispositivo
async function guardarPushToken(req, res) {
  try {
    const { mozoId, pushToken, platform, deviceId } = req.body;

    await Mozo.findByIdAndUpdate(mozoId, {
      pushToken,
      pushPlatform: platform,
      deviceId,
      pushTokenUpdatedAt: new Date(),
    });

    res.json({ success: true, message: 'Token registrado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Enviar notificación a un mozo específico
async function enviarNotificacionMozo(mozoId, notificacion) {
  try {
    const mozo = await Mozo.findById(mozoId);
    
    if (!mozo || !mozo.pushToken) {
      console.log(`Mozo ${mozoId} no tiene push token`);
      return;
    }

    const message = {
      to: mozo.pushToken,
      sound: notificacion.sound || 'default',
      title: notificacion.title,
      body: notificacion.body,
      data: notificacion.data || {},
      priority: 'high',
      channelId: notificacion.channelId || 'default',
    };

    // Enviar vía Expo
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log(`✅ Notificación enviada a ${mozo.name}`);
  } catch (error) {
    console.error('Error enviando notificación:', error);
  }
}

// Enviar cuando un plato está listo
async function notificarPlatoListo(comanda, platoIndex) {
  const mozoId = comanda.mozos[0]; // Primer mozo de la comanda
  
  await enviarNotificacionMozo(mozoId, {
    title: '🍽️ Plato Listo',
    body: `${comanda.platos[platoIndex].plato} está listo para recoger`,
    sound: 'plato_listo.wav',
    channelId: 'plato-listo',
    data: {
      tipo: 'plato-listo',
      comandaId: comanda._id,
      mesaId: comanda.mesas,
      platoIndex,
    },
  });
}

module.exports = {
  guardarPushToken,
  enviarNotificacionMozo,
  notificarPlatoListo,
};
```

#### Tipos de Notificaciones

| Tipo | Título | Body | Prioridad | Canal |
|------|--------|------|-----------|-------|
| Plato listo | 🍽️ Plato Listo | [Nombre] está listo para recoger | MAX | plato-listo |
| Comanda nueva | 📝 Nueva Comanda | Mesa [N] tiene nuevo pedido | HIGH | default |
| Mesa asignada | 🏷️ Mesa Asignada | Se te asignó la Mesa [N] | HIGH | mesa-alerta |
| Pago pendiente | 💰 Pago Pendiente | Mesa [N] solicita el pago | HIGH | default |
| Alerta admin | ⚠️ [Mensaje] | [Detalle] | MAX | mesa-alerta |

---

### 3. Funcionamiento en Segundo Plano (Background)

#### Arquitectura de Background Tasks

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND EXECUTION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐ │
│   │  Foreground      │    │  Background      │    │  Headless JS     │ │
│   │  (App abierta)   │    │  (App minimizada)│    │  (App cerrada)   │ │
│   │                  │    │                  │    │                  │ │
│   │  - Socket.io     │    │  - Push tokens   │    │  - Background    │ │
│   │  - Polling       │    │  - Background    │    │    Fetch API     │ │
│   │  - Real-time     │    │    fetch         │    │  - BootReceiver  │ │
│   │                  │    │  - Local         │    │  - Scheduled     │ │
│   │                  │    │    notifications │    │    tasks         │ │
│   └──────────────────┘    └──────────────────┘    └──────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Implementación: Background Fetch

**hooks/useBackgroundTask.js:**
```javascript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';

const BACKGROUND_FETCH_TASK = 'background-fetch-mesas';
const PING_INTERVAL = 60000; // 1 minuto

// Definir tarea de background
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('🔄 Ejecutando background fetch...');
    
    const user = JSON.parse(await AsyncStorage.getItem('user'));
    if (!user) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Verificar mesas asignadas
    const response = await axios.get(`/api/mesas/mozos/${user._id}/asignadas`);
    const mesas = response.data;

    // Verificar si hay platos listos
    const platosListos = mesas.flatMap(m => 
      m.comandas?.flatMap(c => 
        c.platos.filter(p => p.estado === 'recoger')
      ) || []
    );

    if (platosListos.length > 0) {
      // Enviar notificación local
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🍽️ Platos Pendientes',
          body: `Tienes ${platosListos.length} plato(s) listo(s) para recoger`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error en background fetch:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Registrar tarea de background
export async function registerBackgroundFetchAsync() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutos (mínimo en Android)
      stopOnTerminate: false,   // Continuar después de cerrar app
      startOnBoot: true,        // Iniciar al boot del dispositivo
    });
    
    console.log('✅ Background fetch registrado');
  } catch (err) {
    console.log('❌ Error registrando background fetch:', err);
  }
}

// Desregistrar
export async function unregisterBackgroundFetchAsync() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('✅ Background fetch desregistrado');
  } catch (err) {
    console.log('❌ Error desregistrando:', err);
  }
}

// Verificar estado
export async function checkBackgroundFetchStatus() {
  const status = await BackgroundFetch.getStatusAsync();
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  
  return { status, isRegistered };
}
```

#### Implementación: Headless JS (Android)

**android/app/src/main/java/com/lasgambusinas/appmozo/HeadlessTaskService.java:**
```java
package com.lasgambusinas.appmozo;

import android.content.Intent;
import android.os.Bundle;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsConfig;

public class HeadlessTaskService extends HeadlessJsTaskService {
  @Override
  protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
    Bundle extras = intent.getExtras();
    return new HeadlessJsTaskConfig(
      "BackgroundTask",
      extras != null ? Arguments.fromBundle(extras) : null,
      60000, // timeout: 60 segundos
      true   // permitir en foreground
    );
  }
}
```

**android/app/src/main/java/com/lasgambusinas/appmozo/BootReceiver.java:**
```java
package com.lasgambusinas.appmozo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
      Log.d("BootReceiver", "Device booted, starting background task");
      
      // Iniciar servicio de background
      Intent serviceIntent = new Intent(context, HeadlessTaskService.class);
      context.startService(serviceIntent);
    }
  }
}
```

**android/app/src/main/AndroidManifest.xml (agregar):**
```xml
<!-- Permisos -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

<application>
  <!-- Boot Receiver -->
  <receiver android:name=".BootReceiver" android:enabled="true">
    <intent-filter>
      <action android:name="android.intent.action.BOOT_COMPLETED" />
      <action android:name="android.intent.action.QUICKBOOT_POWERON" />
    </intent-filter>
  </receiver>

  <!-- Headless Service -->
  <service android:name=".HeadlessTaskService" android:enabled="true" />
</application>
```

#### Tarea Headless en JavaScript

**tasks/backgroundTask.js:**
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';

module.exports = async (taskData) => {
  console.log('📱 Headless task ejecutándose...');
  
  try {
    const user = JSON.parse(await AsyncStorage.getItem('user'));
    
    if (!user) {
      console.log('No hay usuario logueado');
      return;
    }

    // Verificar mesas del mozo
    const response = await axios.get(`/api/mesas/mozos/${user._id}/asignadas`);
    const mesas = response.data;

    // Contar platos pendientes
    let platosPendientes = 0;
    mesas.forEach(mesa => {
      mesa.comandas?.forEach(comanda => {
        comanda.platos.forEach(plato => {
          if (plato.estado === 'recoger') platosPendientes++;
        });
      });
    });

    if (platosPendientes > 0) {
      // Notificar al sistema (será manejado por el servicio nativo)
      console.log(`🔔 ${platosPendientes} platos pendientes`);
    }
  } catch (error) {
    console.error('Error en headless task:', error);
  }
};
```

---

### 4. Socket.io en Segundo Plano

#### Problema

Socket.io se desconecta cuando la app pasa a segundo plano en React Native.

#### Solución: Servicio Foreground (Android)

**services/SocketForegroundService.js:**
```javascript
import { Platform } from 'react-native';
import Notifee, { AndroidImportance } from '@notifee/react-native';
import io from 'socket.io-client';

class SocketForegroundService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async startForegroundService() {
    if (Platform.OS !== 'android') return;

    // Crear canal de notificación
    await Notifee.createChannel({
      id: 'socket-service',
      name: 'Servicio de Conexión',
      importance: AndroidImportance.LOW,
      sound: '',
      vibration: false,
    });

    // Mostrar notificación persistente
    await Notifee.displayNotification({
      id: 'socket-foreground',
      title: 'App Mozos - Conectado',
      body: 'Recibiendo actualizaciones de mesas',
      android: {
        channelId: 'socket-service',
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
      },
    });
  }

  async connect(wsURL, user) {
    if (this.socket?.connected) return;

    this.socket = io(`${wsURL}/mozos`, {
      auth: { token: user.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('🟢 Socket conectado (foreground)');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket desconectado:', reason);
      this.isConnected = false;
    });

    // Iniciar foreground service
    await this.startForegroundService();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    Notifee.cancelNotification('socket-foreground');
  }
}

export default new SocketForegroundService();
```

---

### 5. Optimización de Batería

#### Solicitar Exclusión de Optimizaciones de Batería

```javascript
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

async function requestIgnoreBatteryOptimization() {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        {
          flags: 1, // FLAG_ACTIVITY_NEW_TASK
        }
      );
    } catch (error) {
      console.log('Error solicitando exclusión de batería:', error);
    }
  }
}
```

#### Configuración en MasScreen

Agregar botón en la pantalla de configuración:
```javascript
<TouchableOpacity onPress={requestIgnoreBatteryOptimization}>
  <View style={styles.settingRow}>
    <Text>🔋 Optimizar para segundo plano</Text>
    <Text style={styles.hint}>Toca para permitir ejecución en segundo plano</Text>
  </View>
</TouchableOpacity>
```

---

### 6. Resumen de Implementación

#### Checklist de Conversión a APK Nativo

```
□ FASE 1: Build Básico
  □ Crear cuenta Expo EAS
  □ Configurar eas.json
  □ Agregar íconos adaptativos
  □ Configurar package name (com.lasgambusinas.appmozo)
  □ Build APK de prueba
  □ Test en dispositivo físico

□ FASE 2: Notificaciones Push
  □ Crear proyecto Firebase
  □ Configurar google-services.json
  □ Implementar notificationService.js
  □ Backend: endpoints de push tokens
  □ Backend: integrar en eventos Socket
  □ Test notificaciones en primer plano
  □ Test notificaciones en segundo plano
  □ Test notificaciones con app cerrada

□ FASE 3: Background Tasks
  □ Implementar useBackgroundTask.js
  □ Registrar BackgroundFetch
  □ Configurar Headless JS
  □ Agregar BootReceiver
  □ Test funcionamiento en segundo plano
  □ Test reinicio después de boot

□ FASE 4: Optimización
  □ Solicitar exclusión de batería
  □ Configurar canales de notificación
  □ Agregar sonidos personalizados
  □ Test de consumo de batería
  □ Test de memoria
  □ Documentar uso

□ FASE 5: Distribución
  □ Build AAB para Play Store
  □ Preparar assets (screenshots, descripción)
  □ Configurar firmas
  □ Submit a Play Store
  □ O alternativamente: distribución APK directa
```

#### Dependencias Finales a Agregar

```json
{
  "dependencies": {
    "expo-notifications": "~0.27.0",
    "expo-device": "~5.9.0",
    "expo-background-fetch": "~12.0.0",
    "expo-task-manager": "~11.0.0",
    "@notifee/react-native": "^7.0.0",
    "expo-intent-launcher": "~11.0.0"
  }
}
```

---

## 📬 Catálogo Completo de Eventos Socket.io y Notificaciones

Esta sección documenta todos los eventos WebSocket que el **App de Mozos** recibe del backend, incluyendo su origen (App Cocina, admin, sistema), datos enviados y acciones recomendadas en el frontend.

---

### 1. Eventos de Comandas

#### `nueva-comanda`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comanda` | Object | Comanda completa creada |
| `comandaId` | String | ID de la comanda |
| `timestamp` | String | ISO timestamp |

**Origen:** App Mozos (POST `/api/comanda`), Backend.

**Destino:** App Cocina (namespace `/cocina`, room `fecha-YYYY-MM-DD`), App Mozos (broadcast), Admin.

**Acción App Mozos:** Agregar comanda a la lista local, actualizar estado de mesa a `pedido`.

---

#### `comanda-actualizada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `comanda` | Object | Comanda completa actualizada |
| `estadoAnterior` | String | Estado anterior (opcional) |
| `estadoNuevo` | String | Estado nuevo (opcional) |
| `timestamp` | String | ISO timestamp |

**Origen:** Edición de comanda, cambios de estado, **aplicación/eliminación de descuentos**, pagos.

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}`), Admin.

**Acción App Mozos:** Reemplazar comanda en el state local, recalcular totales si hay descuento.

---

#### `comanda-eliminada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda eliminada |
| `mesaId` | String | ID de la mesa |
| `motivo` | String | Motivo de eliminación |
| `timestamp` | String | ISO timestamp |

**Origen:** Mozo o Admin elimina comanda completa.

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}`), Admin.

**Acción App Mozos:** Remover comanda de la lista, si no quedan comandas activas navegar a InicioScreen.

---

#### `comanda-revertida`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comanda` | Object | Comanda revertida |
| `mesa` | Object | Mesa actualizada |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina revierte una comanda (devuelve a estado anterior).

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}`), Admin.

**Acción App Mozos:** Actualizar comanda y estado de mesa.

---

#### `comanda-finalizada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `comanda` | Object | Comanda con todos los platos entregados |
| `cocinero` | Object | Información del cocinero |
| `tipo` | String | `"comanda-finalizada"` |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina marca todos los platos como entregados.

**Destino:** App Cocina (room `fecha-YYYY-MM-DD`), Admin.

**Acción App Mozos:** Actualizar estado de comanda, habilitar botón de pago.

---

#### `comanda-anulada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `comanda` | Object | Comanda anulada |
| `motivoGeneral` | String | Motivo de la anulación |
| `totalAnulado` | Number | Monto total anulado |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina anula toda la comanda.

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}`), Admin.

**Acción App Mozos:** Mostrar alerta con el monto anulado, actualizar UI, navegar a Inicio si corresponde.

---

### 2. Eventos de Platos

#### `plato-actualizado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `platoId` | Number | Índice del plato en el array |
| `nuevoEstado` | String | Estado nuevo (`pedido`, `recoger`, `entregado`, `pagado`) |
| `estadoAnterior` | String | Estado anterior |
| `mesaId` | String | ID de la mesa |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina cambia estado de un plato (ej: marca como listo).

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}` si existe, sino broadcast), Admin.

**Acción App Mozos:** Actualizar estado del plato en la UI, mostrar alerta si `nuevoEstado === 'recoger'`, actualizar indicador SocketStatus a `online-active`.

---

#### `plato-actualizado-batch`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `platos` | Array | `[{ platoId, nuevoEstado, estadoAnterior }]` |
| `mesaId` | String | ID de la mesa |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina actualiza múltiples platos en lote (FASE 5 batching).

**Destino:** App Cocina, App Mozos.

**Acción App Mozos:** Actualizar todos los platos del batch en una sola operación.

---

#### `plato-anulado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `comanda` | Object | Comanda actualizada |
| `platoAnulado` | Object | `{ nombre, motivo, platoId }` |
| `auditoria` | Object | `{ activos, anulados, eliminados }` |
| `timestamp` | String | ISO timestamp |

**Origen:** App Cocina anula un plato específico.

**Destino:** App Cocina, App Mozos (room `mesa-{mesaId}`), Admin.

**Acción App Mozos:** Mostrar alerta: `"🍽️ Plato Anulado - [nombre] fue anulado por cocina. Motivo: [motivo]"`, actualizar comanda.

---

#### `plato-entregado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `platoId` | Number | Índice del plato |
| `platoNombre` | String | Nombre del plato |
| `estadoAnterior` | String | Estado anterior |
| `timestamp` | String | ISO timestamp |

**Origen:** Mozo marca plato como entregado.

**Destino:** App Mozos, Admin.

**Acción App Mozos:** Actualizar estado del plato, recalcular si todos entregados para habilitar pago.

---

### 3. Eventos de Mesas

#### `mesa-actualizada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mesaId` | String | ID de la mesa |
| `mesa` | Object | Mesa completa actualizada |
| `timestamp` | String | ISO timestamp |

**Origen:** Cambio de estado de mesa (libre → pedido, pagado → libre, etc.), reserva creada/actualizada.

**Destino:** App Mozos (broadcast), App Cocina (broadcast), Admin.

**Acción App Mozos:** Merge de la mesa en la lista local (`mesas.map(m => m._id === mesaId ? mesa : m)`), actualizar color/estado visual.

---

#### `mesas-juntadas`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mesaPrincipal` | Object | Mesa principal del grupo |
| `mesasSecundarias` | Array | Lista de mesas secundarias |
| `mozoId` | String | ID del mozo que realizó la acción |
| `totalMesas` | Number | Total de mesas en el grupo |
| `timestamp` | String | ISO timestamp |

**Origen:** Mozo/Admin junta mesas (POST `/api/mesas/juntar`).

**Destino:** App Mozos (broadcast), App Cocina (broadcast), Admin.

**Acción App Mozos:** Actualizar mesas en la lista, mostrar badge de grupo en UI.

---

#### `mesas-separadas`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mesaPrincipal` | Object | Mesa principal |
| `mesasSecundarias` | Array | Mesas liberadas |
| `mozoId` | String | ID del mozo |
| `totalMesasLiberadas` | Number | Cantidad liberada |
| `timestamp` | String | ISO timestamp |

**Origen:** Mozo/Admin separa mesas (POST `/api/mesas/separar`).

**Destino:** App Mozos (broadcast), App Cocina (broadcast), Admin.

**Acción App Mozos:** Actualizar mesas, remover badges de grupo.

---

#### `mapa-actualizado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `areaId` | String | ID del área actualizada |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin guarda cambios en el editor de mapa (posiciones, layout).

**Destino:** App Mozos, Admin.

**Acción App Mozos:** Refetch de mesas (`GET /api/mesas`).

---

#### `catalogo-mesas-areas-actualizado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | String | ISO timestamp |
| `razon` | String | Razón del cambio (opcional) |

**Origen:** Admin crea/edita/elimina mesas o áreas (mesas.html, areas.html).

**Destino:** App Mozos.

**Acción App Mozos:** Refetch de mesas (`GET /api/mesas`) y áreas (`GET /api/areas`).

---

### 4. Eventos de Descuentos (Admin/Supervisor)

#### Aplicación de Descuento - `comanda-actualizada`

Cuando se aplica un descuento desde **comandas.html** (admin):

**Endpoint:** `PUT /api/comanda/:id/descuento`

**Body enviado:**
```javascript
{
  descuento: 10,          // Porcentaje (0-100)
  motivo: "Cliente frecuente",
  usuarioId: "65abc123...",
  usuarioRol: "admin"
}
```

**Evento emitido:** `comanda-actualizada` con datos adicionales:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comandaId` | String | ID de la comanda |
| `comanda.descuento` | Number | Porcentaje de descuento |
| `comanda.motivoDescuento` | String | Motivo |
| `comanda.descuentoAplicadoPor` | Object | Usuario que aplicó |
| `comanda.descuentoAplicadoAt` | String | Timestamp |
| `comanda.montoDescuento` | Number | Monto descontado |
| `comanda.totalCalculado` | Number | Total con descuento aplicado |

**Acción App Mozos:** Actualizar totales en la vista de comanda, mostrar badge/indicador de descuento aplicado.

---

#### Eliminación de Descuento - `comanda-actualizada`

**Endpoint:** `DELETE /api/comanda/:id/descuento`

**Body enviado:**
```javascript
{
  usuarioId: "65abc123...",
  usuarioRol: "admin",
  motivoEliminacion: "Descuento aplicado por error"
}
```

**Evento emitido:** `comanda-actualizada` con `comanda.descuento = 0`.

**Acción App Mozos:** Recalcular totales sin descuento, remover indicador visual.

---

### 5. Eventos de Reservas

#### `reserva-creada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reserva` | Object | Reserva creada |
| `mesaId` | String | ID de la mesa reservada |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin crea reserva.

**Destino:** App Mozos, Admin.

**Acción App Mozos:** Actualizar estado de mesa a `reservado`, mostrar indicador.

---

#### `reserva-actualizada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reservaId` | String | ID de la reserva |
| `cambios` | Object | Campos actualizados |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin modifica reserva.

**Acción App Mozos:** Actualizar datos de reserva si está en la mesa actual.

---

#### `reserva-expirada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reservaId` | String | ID de la reserva |
| `reserva` | Object | Reserva expirada (opcional) |
| `timestamp` | String | ISO timestamp |

**Origen:** Reserva expira por tiempo.

**Acción App Mozos:** Liberar mesa si estaba en estado reservado.

---

#### `reserva-alerta-expiracion`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reservaId` | String | ID de la reserva |
| `datos` | Object | Información adicional |
| `timestamp` | String | ISO timestamp |

**Origen:** Alerta de reserva próxima a expirar (configurable).

**Acción App Mozos:** Mostrar notificación de advertencia.

---

#### `reserva-cancelada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `reservaId` | String | ID de la reserva |
| `motivo` | String | Motivo de cancelación (opcional) |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin cancela reserva.

**Acción App Mozos:** Liberar mesa, actualizar UI.

---

### 6. Eventos de Propinas

#### `propina-registrada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `propinaId` | String | ID de la propina |
| `mesaId` | String | ID de la mesa |
| `numMesa` | Number | Número de mesa |
| `mozoId` | String | ID del mozo |
| `nombreMozo` | String | Nombre del mozo |
| `montoPropina` | Number | Monto de la propina |
| `tipo` | String | Tipo (`efectivo`, `tarjeta`, `yape`) |
| `boucherNumber` | String | Número de boucher |
| `nota` | String | Nota opcional |
| `timestamp` | String | ISO timestamp |

**Origen:** Mozo registra propina desde App Mozos (ModalRegistrarPropina).

**Destino:** Admin (dashboard), Mozo específico (room `mozo-{mozoId}`).

**Acción App Mozos:** Mostrar confirmación de propina registrada.

---

#### `propina-actualizada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `propinaId` | String | ID de la propina |
| `mozoId` | String | ID del mozo |
| `montoPropina` | Number | Nuevo monto |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin modifica propina.

**Acción App Mozos:** Actualizar registro de propina si aplica.

---

#### `propina-eliminada`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `propinaId` | String | ID de la propina |
| `mozoId` | String | ID del mozo |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin elimina propina (soft delete).

**Acción App Mozos:** Remover de la lista local.

---

### 7. Eventos de Conexión y Sistema

#### `joined-mesa`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mesaId` | String | ID de la mesa |
| `roomName` | String | Nombre de la room |

**Origen:** Backend confirma suscripción a room de mesa.

**Acción App Mozos:** Logging, confirmación de conexión.

---

#### `heartbeat-ack` / `heartbeat-pong`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | String | ISO timestamp |

**Origen:** Backend responde al heartbeat del cliente.

**Acción App Mozos:** Calcular latencia, mantener conexión activa.

---

#### `socket-status`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `connected` | Boolean | Estado de conexión |
| `socketId` | String | ID del socket |

**Origen:** Backend notifica cambios de estado.

---

### 8. Eventos de Menú/Catálogo

#### `plato-menu-actualizado`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `platoId` | String | ID del plato |
| `plato` | Object | Plato actualizado |
| `cambios` | Object | Campos modificados |
| `timestamp` | String | ISO timestamp |

**Origen:** Admin modifica plato del menú.

**Destino:** App Cocina, App Mozos, Admin.

**Acción App Mozos:** Refetch de platos (`GET /api/platos`).

---

### 9. Notificaciones Push Sugeridas

Basado en los eventos anteriores, estas son las notificaciones push recomendadas para el App de Mozos:

| Evento | Título Push | Body Push | Prioridad |
|--------|-------------|-----------|-----------|
| `plato-actualizado` (estado=recoger) | 🍽️ Plato Listo | `[nombre] está listo para recoger` | MAX |
| `comanda-anulada` | ⚠️ Comanda Anulada | `Mesa [N]: [motivo]` | HIGH |
| `plato-anulado` | ⚠️ Plato Anulado | `Cocina anuló: [nombre]` | HIGH |
| `mesa-actualizada` (estado=libre) | ✅ Mesa Liberada | `Mesa [N] ahora está libre` | DEFAULT |
| `propina-registrada` | 💰 Propina Recibida | `S/. [monto] de Mesa [N]` | DEFAULT |
| `reserva-alerta-expiracion` | ⏰ Reserva por Expirar | `Mesa [N] reserva expira pronto` | HIGH |
| `mesas-juntadas` | 🔗 Mesas Juntadas | `Mesa [N] ahora es principal` | DEFAULT |
| `mesas-separadas` | ✂️ Mesas Separadas | `Mesa [N] liberada del grupo` | DEFAULT |

---

### 10. Resumen de Listeners en App Mozos

```javascript
// useSocketMozos.js - Eventos que el App Mozos debe escuchar
const eventsToListen = [
  'plato-actualizado',
  'plato-actualizado-batch',
  'plato-entregado',
  'plato-anulado',
  'comanda-actualizada',
  'comanda-eliminada',
  'comanda-revertida',
  'comanda-anulada',
  'comanda-finalizada',
  'nueva-comanda',
  'mesa-actualizada',
  'mesas-juntadas',
  'mesas-separadas',
  'mapa-actualizado',
  'catalogo-mesas-areas-actualizado',
  'plato-menu-actualizado',
  'reserva-creada',
  'reserva-actualizada',
  'reserva-expirada',
  'reserva-alerta-expiracion',
  'reserva-cancelada',
  'propina-registrada',
  'propina-actualizada',
  'propina-eliminada',
  'joined-mesa',
  'heartbeat-ack',
  'socket-status'
];
```

---

**Version del documento:** 2.10  
**Ultima actualizacion:** Abril 2026  
**Sistema:** Las Gambusinas – App de Mozos
