# Entrega a Plexperity — App de Mozos (Las Gambusinas)

**Fecha:** 17 de junio de 2026  
**Repositorio:** `gambusinas`  
**Versión actual:** `1.0.7` (`versionCode` 7, `runtimeVersion` 1.0.7)  
**Package Android:** `com.carlos121.appmozo`  
**Documentación de referencia:** [APP_MOZOS_DOCUMENTACION_COMPLETA.md](./APP_MOZOS_DOCUMENTACION_COMPLETA.md)

---

## 1. Resumen ejecutivo

La App de Mozos pasó de versión documentada en abril 2026 a **build productivo 1.0.7** con:

- **Distribución APK + OTA** vía Expo EAS (sin Play Store).
- **Notificaciones push** operativas (plato listo / comanda lista).
- **Impresión y PDF de boucher** rediseñados para impresora térmica Epson TM-m30II (80 mm).
- **Sesión persistente** al reabrir la app.
- **Branding** actualizado (logo, splash, iconos).

| Versión | Fecha | Cambio principal |
|---------|-------|------------------|
| 1.0.7 | Jun 2026 | PDF nativo con `pdf-lib`, impresión ePOS XML, refactor boucher |
| 1.0.6 | Jun 2026 | Boucher 80 mm sin papel en blanco (medición altura WebView) |
| 1.0.x | May 2026 | Push, OTA, logo, splash, permisos Android |

---

## 2. Cambios por versión

### v1.0.7 — PDF e impresión nativa (`1ccef31`, `b642090`)

**Problema resuelto:** Generación de PDF con `expo-print`/WebView dejaba márgenes blancos en Samsung y segunda página en impresoras Epson 80 mm.

**Solución:** Arquitectura modular de boucher en `services/boucherPrint/` y `utils/`:

| Módulo | Función |
|--------|---------|
| `services/boucherPrint/index.js` | Orquestador: alerta Imprimir / Compartir / Cancelar |
| `utils/boucherEposXml.js` | Genera XML ePOS-Print para Epson |
| `utils/boucherTmPrint.js` | Abre **Epson TM Print Assistant** vía intent `com.epson.tmassistant` |
| `utils/boucherPdfNative.js` | PDF 80 mm con **pdf-lib** (sin WebView) |
| `utils/boucherHtml.js` | HTML de respaldo para preview |
| `utils/boucherPdfCrop.js` | Recorte de PDF si aplica |
| `utils/boucherPdfShare.js` | Compartir PDF vía sistema Android |
| `utils/boucherPrint.js` | Constantes compartidas (`PUNTOS_ANCHO` = 80 mm) |

**Flujo post-pago (`PagosScreen` → `ModalPagoExitoso`):**

```
Pago exitoso
  → mostrarOpcionesBoucher()
      → Imprimir: generarXmlBoucher() → TM Print Assistant
      → Compartir: generarPdfNativo() → share sheet Android
```

**Dependencia nueva:** `pdf-lib` en `package.json`.

**AndroidManifest:** Queries para `tmprintassistant` scheme y paquete `com.epson.tmassistant`.

**Requisito en tablet:** Instalar [Epson TM Print Assistant](https://play.google.com/store/apps/details?id=com.epson.tmassistant) para impresión directa.

---

### v1.0.6 — Boucher sin papel en blanco (`c12c11e`)

- Medición de altura real del ticket con WebView (`utils/medidorAlturaBoucher.js`).
- Alineación `textZoom` con `expo-print`.
- Dimensionado PDF a exactamente 80 mm para Epson TM-m30II.
- `runtimeVersion` 1.0.6 para canal OTA.

---

### v1.0.5–1.0.6 — UX y estabilidad

#### Restaurar sesión al abrir (`233d640`)

- Al iniciar, `Login.js` lee `AsyncStorage` (`user`, `authToken`).
- Si existen, navega directo a `Inicio` sin mostrar formulario.
- Estado `restoringSession` evita flash del login.
- Script `expo start --offline` en `package.json` para desarrollo sin login Expo.

#### Complementos sin perder orden de búsqueda (`8919f70`)

- En `OrdenesScreen.js`, al elegir complemento de un plato ya buscado, **no se reinicia** el filtro/orden de la lista de platos.

---

### Mayo 2026 — Push, OTA y distribución

#### Notificaciones push funcionales (`277a6eb`, `7d55df8`)

**Archivos:**

| Archivo | Rol |
|---------|-----|
| `services/pushNotifications.js` | Registro token, preferencias, handlers foreground |
| `hooks/useSocketMozos.js` | Listeners Socket + coordinación con push |
| `Pages/Notifications/NotificationsScreen.js` | Pantalla de historial/configuración |
| `context/SocketContext.js` | Conexión Socket con JWT |

**Preferencias en AsyncStorage:**

- `mozos_push_notifications_enabled` — global on/off
- `mozos_push_plato_listo` — alerta por plato en `recoger`
- `mozos_push_comanda_lista` — alerta comanda completa lista
- `mozos_push_sonido` / `mozos_push_vibracion`

**Registro:** Tras login exitoso → `registerPushAfterLogin(mozoId)` → `POST /api/mozos/push-token`.

#### Pantalla de carga (`9a36cd4`)

- `Pages/Splash/SplashScreen.js` con logo animado al arrancar.

#### Logo y branding (`2a3933f`)

- Nuevo logo POS (`Components/PosLogo.js`, `assets/logo-pos.svg`).
- Iconos launcher y notificación Android actualizados.
- `constants/posBrand.js` — colores y marca.

#### APK actualizable — EAS Update (`be58f3d`, `ba39645`)

- `services/otaUpdates.js` — `checkAndApplyOtaUpdate()` en release.
- `app.json`: `updates.url`, `checkAutomatically: ON_LOAD`.
- `eas.json` — perfiles `preview` / `production`.
- Documentación: [EXPO_EAS_APK_Y_ACTUALIZACIONES.md](./EXPO_EAS_APK_Y_ACTUALIZACIONES.md), [INSTALACION_Y_ACTUALIZACION_APP_MOZOS.md](./INSTALACION_Y_ACTUALIZACION_APP_MOZOS.md).

#### Permisos Android (`cc374fc`)

- `POST_NOTIFICATIONS` en `app.json` (Android 13+).
- `usesCleartextTraffic: true` para HTTP LAN (ver [NETWORK_ERROR_APK_VS_EXPO_GO.md](./NETWORK_ERROR_APK_VS_EXPO_GO.md)).

---

### Abril 2026 — Operativo en producción

#### Configuración de servidor (`af1d975`)

- `config/apiConfig.js`, `config/envDefaults.js` — URL del backend configurable desde app.
- `Components/SettingsModal.js` — modal para cambiar IP/puerto del servidor.
- `.env` dejó de versionarse; usar `.env.example`.

#### Integración voucher con auth (`a147d9d`)

- `PagosScreen.js` obtiene plantilla de boucher con JWT del mozo autenticado.

---

## 3. Arquitectura de impresión (diagrama)

```
┌─────────────────────────────────────────────────────────┐
│                    PagosScreen / ModalPagoExitoso        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  services/boucherPrint/       │
              │  mostrarOpcionesBoucher()     │
              └──────────────┬───────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐              ┌─────────────────┐
   │ boucherEposXml  │              │ boucherPdfNative │
   │ (XML ePOS)      │              │ (pdf-lib 80mm)   │
   └────────┬────────┘              └────────┬─────────┘
            ▼                                 ▼
   ┌─────────────────┐              ┌─────────────────┐
   │ boucherTmPrint  │              │ boucherPdfShare │
   │ TM Assistant    │              │ Android share   │
   └─────────────────┘              └─────────────────┘
```

---

## 4. Build y despliegue

### Versiones actuales (`app.json`)

```json
{
  "version": "1.0.7",
  "runtimeVersion": "1.0.7",
  "android": {
    "versionCode": 7,
    "package": "com.carlos121.appmozo"
  }
}
```

### Comandos habituales

```bash
# Desarrollo local (sin login Expo)
npm run start:offline

# Build APK en la nube
eas build --platform android --profile preview

# Publicar actualización OTA (sin reinstalar APK)
eas update --branch preview --message "descripción del cambio"
```

**Importante:** `runtimeVersion` del OTA debe coincidir con el APK instalado en las tablets.

### Guías operativas

| Documento | Contenido |
|-----------|-----------|
| [INSTALACION_Y_ACTUALIZACION_APP_MOZOS.md](./INSTALACION_Y_ACTUALIZACION_APP_MOZOS.md) | Instalar APK en tablets del restaurante |
| [EXPO_EAS_APK_Y_ACTUALIZACIONES.md](./EXPO_EAS_APK_Y_ACTUALIZACIONES.md) | EAS Build, canales, OTA |
| [NETWORK_ERROR_APK_VS_EXPO_GO.md](./NETWORK_ERROR_APK_VS_EXPO_GO.md) | Errores de red HTTP en APK |

---

## 5. Integración con Backend

| Funcionalidad | Endpoint / canal |
|---------------|------------------|
| Login | `POST /api/mozos/login` |
| Push token | `POST /api/mozos/push-token` |
| Plantilla boucher | `GET /api/configuracion/voucher-plantilla` |
| Tiempo real | Socket.io namespace `/mozos` (JWT) |
| Pagos | `POST /api/boucher` |

Documento de entrega backend: [ENTREGA_PLEXPERITY_JUNIO_2026.md](../../backend-gambusinas/docs/ENTREGA_PLEXPERITY_JUNIO_2026.md).

---

## 6. Pantallas y archivos clave modificados

| Pantalla / módulo | Cambios recientes |
|-------------------|-------------------|
| `Login.js` | Restaurar sesión, logo, push tras login |
| `PagosScreen.js` | Refactor boucher, menos lógica inline |
| `ModalPagoExitoso.js` | Delega a `boucherPrint` service |
| `OrdenesScreen.js` | Fix orden tras elegir complemento |
| `InicioScreen.js` | Mapa mesas, estados tiempo real |
| `ComandaDetalleScreen.js` | Entrega masiva, push listeners |
| `NotificationsScreen.js` | Configuración push |

---

## 7. Commits de referencia (abril–junio 2026)

```
1ccef31 Pdf bien generado
b642090 chore: bump app version to 1.0.7
8919f70 complemento sin reiniciar orden del plato
c12c11e fix(pagos): boucher 80mm sin papel en blanco y build 1.0.6
233d640 fix(mozos): restaurar sesion al abrir
277a6eb Notificaciones funcionales
be58f3d Apk actualizable
af1d975 Gambusinas operativo
```

---

## 8. Checklist para Plexperity

- [ ] Tablets con APK **1.0.7** instalado (o OTA sobre runtime 1.0.7)
- [ ] Epson TM Print Assistant instalado si usan impresión directa
- [ ] Permiso de notificaciones concedido (Android 13+)
- [ ] URL del backend configurada en Settings de la app (Wi‑Fi LAN)
- [ ] Backend con push notifications activo y mozos con token registrado
- [ ] Canal EAS (`preview`/`production`) documentado para el equipo de despliegue

---

*Documento generado para handoff a Plexperity. Detalle técnico completo en APP_MOZOS_DOCUMENTACION_COMPLETA.md.*
