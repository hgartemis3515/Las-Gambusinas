# Plan — Listas de buscador adaptadas al teclado (App Mozos)

**Versión:** 1.0  
**Fecha:** 24 agosto 2026  
**Estado:** SUPERSEDIDO para el modal Menú de `OrdenesScreen` → ver `docs/PLAN_MODAL_MENU_TECLADO.md` (v2.0). Este archivo queda como inventario del resto de buscadores.  
**Alcance:** App Mozos (`Las-Gambusinas`). JS only (compatible con OTA / EAS Update).  
**Fuera:** App Cocina, Backend, `SecondScreen` / `ThridScreen` (no están en el Tab Navigator).

---

## 1. Problema

Al buscar platos (u otros listados filtrados), el teclado del teléfono tapa la lista. El mozo no ve resultados ni puede tocar un ítem sin cerrar el teclado.

No es un fallo de filtrado: la búsqueda sí funciona. Es un fallo de **layout**: la lista no encoge al espacio que queda **encima** del teclado.

El caso más visible:

1. Tab **Nueva Orden** → **Agregar Plato** → tipo de menú → `Buscar plato...`
2. **Comanda detalle** → **Editar** → **Agregar Plato** → `Buscar plato...`

---

## 2. Mapa de buscadores (inventario)

No existe un archivo `PlatosScreen`. El “pantalla de platos” es el **modal de menú** de `OrdenesScreen`.

### 2.1 En alcance (buscador + lista; abre teclado)

| # | Dónde en la app | Archivo | UI actual | Prioridad |
|---|-----------------|---------|-----------|-----------|
| 1 | Nueva Orden → modal **Menú** | `Pages/navbar/screens/OrdenesScreen.js` | Bottom sheet. Buscador + chips fijos. Lista `ScrollView` con `maxHeight: 500` | **P0** |
| 2 | Comanda detalle → modal **Editar** → agregar plato | `Pages/ComandaDetalleScreen.js` | Buscador **dentro** de un `ScrollView` padre (`maxHeight: 500`). Lista anidada `maxHeight: 200` | **P0** |
| 3 | Inicio → modal **Editar comanda** → agregar plato | `Pages/navbar/screens/InicioScreen.js` | Igual que detalle: anidado. Lista contenedor `height: 250` | **P1** |
| 4 | Reservar → paso platos | `Pages/ReservaWizardScreen.js` | `ScrollView` de pantalla. Buscador + filas mapeadas (sin lista anidada) | **P1** |
| 5 | Chat → inbox | `Pages/Chat/ChatScreen.js` | Buscador arriba + `SectionList` | **P2** |

### 2.2 Fuera de alcance de este plan

| Superficie | Por qué |
|------------|---------|
| `SecondScreen.js`, `ThridScreen.js`, `selectdishes.js` | No montados en `navbar.js` / stack actual |
| Login, Perfil, Settings, clientes, propina, panel gestión | Ya usan `KeyboardAvoidingView`; son **formularios**, no buscador+lista |
| Observaciones, motivo de eliminación, nota de complementos, compositor de chat | Inputs de texto, no listados de búsqueda |
| Cambiar `windowSoftInputMode` global | Ya es `adjustResize` en `AndroidManifest.xml`. Cambiarlo rompe Login/Perfil |

---

## 3. Causa raíz (código)

### 3.1 Android sí “ajusta” la Activity; el Modal no

`android/app/src/main/AndroidManifest.xml`:

`android:windowSoftInputMode="adjustResize"`

Eso reduce la ventana de la Activity. Un `Modal` de React Native **no hereda ese resize de forma fiable**. El overlay sigue a pantalla completa y el teclado se pinta encima.

`KeyboardAvoidingView` (Login, Perfil, etc.) **no está** en estos modales de menú. En Modal + Android es inestable; no es la herramienta principal aquí.

### 3.2 Lista con altura fija, más alta que el hueco libre

**OrdenesScreen** (`modalScrollView`): `maxHeight: 500`.  
Header + toggle Mesa/Para llevar + buscador + chips + 500px + teclado (~250–350px) **supera** la altura visible.

El buscador queda arriba (visible). La **lista** queda debajo y la cubre el teclado.

**ComandaDetalleScreen** es peor: el buscador **no** está arriba del modal. Encima hay título, leyenda, mesa, platos ya en la comanda y el botón Agregar. Con teclado, buscador y resultados quedan **bajo el pliegue**. Además hay `modalOverlay` duplicado en el mismo `StyleSheet` (L3780 `flex-end` vs L4161 `center`); gana el último → modal **centrado**, peor con teclado.

### 3.3 iOS

La ventana no se encoge. Sin listener de teclado ni padding, el teclado tapa sí o sí. Hoy no hay `Keyboard.addListener` en estos flujos.

---

## 4. Comportamiento esperado

| Estado | Resultado |
|--------|-----------|
| Teclado cerrado | Lista usa el espacio del sheet (flex), scrolleable |
| Teclado abierto | Buscador (y chips) **fijos y visibles**. Lista **encoge** al hueco entre chips y teclado. Se puede scrollear y tocar ítems **sin** cerrar el teclado |
| Cerrar teclado | Lista recupera altura. Sin hueco muerto abajo |
| 0 resultados | Mensaje vacío visible encima del teclado |
| Landscape / teclado alto | Lista mínima ~120px; si no cabe, scrollea el sheet manteniendo buscador visible |

**No** desplazar todo el modal hacia arriba (eso escondería el buscador).  
**Sí** recortar solo la lista.

---

## 5. Decisión técnica

**Elegido:** hook JS `Keyboard` + contenedor de resultados con altura dinámica.

**Por qué no `react-native-keyboard-controller`:** dependencia nativa → APK nuevo; no entra por OTA (`expo-updates`).

**Por qué no solo `KeyboardAvoidingView`:** en Modal Android falla; y `behavior="padding"` movería el sheet entero, no encogería la lista.

**Por qué no cambiar `adjustResize`:** ya está; no arregla Modales; rompería pantallas que ya compensan.

### Hook

`hooks/useKeyboardInset.js`

- iOS: `keyboardWillShow` / `keyboardWillHide`
- Android: `keyboardDidShow` / `keyboardDidHide`
- Devuelve `{ inset, visible }` (`endCoordinates.height`)
- **Anti doble-conteo (Android pantalla completa):** si `Dimensions.get('window').height` ya bajó (Activity resized), `inset` efectivo = `0` en pantallas no-Modal. En **Modal**, usar siempre `inset` del evento (el Modal no se resized).

Parámetro `mode: 'modal' | 'screen'`.

### Contenedor

`Components/KeyboardAwareResults.js`

```
[header opcional — fijo]
[search — fijo]
[filters/chips — fijo]
[ScrollView/FlatList flex:1  ← único hijo que encoge]
```

- Altura del bloque lista = espacio restante del padre menos `inset` (modo modal) o `flex:1` (modo screen, Android resize).
- `keyboardShouldPersistTaps="handled"`
- `keyboardDismissMode="on-drag"`
- `nestedScrollEnabled` si el padre ya es ScrollView

No extrae la lógica de negocio (complementos, cantidades, tipoServicio). Solo layout.

---

## 6. Enfoque por pantalla

### 6.1 OrdenesScreen — modal Menú (P0)

Hoy: `modalContainer` `maxHeight: '90%'` sin altura real; lista `maxHeight: 500`.

Cambio:

1. Sheet con altura `min(90% ventana, ventana - inset)` (o `paddingBottom: inset` en el backdrop).
2. Columna `flex: 1`: header / toggle / buscador / chips **no flex**.
3. Lista: quitar `maxHeight: 500`; `flex: 1` + `KeyboardAwareResults` modo `modal`.
4. Extraer **solo el bloque lista+buscador** al contenedor compartido; el `map` de platos se queda.

Verificación: abrir Menú, enfocar búsqueda, escribir “arroz”; al menos 2–3 filas visibles y tappable encima del teclado.

### 6.2 ComandaDetalleScreen — Editar (P0)

El buscador embebido en el scroll del modal **no** se arregla solo encogiendo `platosScrollView` de 200px: sigue fuera de vista.

Cambio (el que cumple el objetivo):

1. Al pulsar **Agregar Plato** y elegir tipo, **no** pintar buscador+lista dentro del scroll de edición.
2. Abrir un **segundo sheet** (mismo patrón que OrdenesScreen): buscador + chips + lista keyboard-aware.
3. `handleAgregarPlato` sigue igual; al agregar, el sheet de menú puede permanecer abierto (como Nueva Orden).
4. El modal Editar conserva platos actuales, observaciones, Guardar/Cancelar.
5. Unificar `modalOverlay` (una sola definición, `justifyContent: 'flex-end'` para sheets).

Verificación: desde detalle → Editar → Agregar Plato → buscar; lista visible sobre el teclado; el plato entra en `platosEditados`.

### 6.3 InicioScreen — Editar (P1)

Misma receta que 6.2 (sheet de menú, no lista anidada `height: 250`). Reutilizar `KeyboardAwareResults`.

### 6.4 ReservaWizardScreen — paso platos (P1)

Pantalla completa (`mode: 'screen'`).

- `contentContainerStyle.paddingBottom` += `inset` en iOS (Android resize ya encoge el `ScrollView` si `flex: 1`).
- `keyboardShouldPersistTaps="handled"` (ya está).
- `onFocus` del buscador: `scrollTo` hacia el input para que chips + primeras filas queden sobre el teclado.

Verificación: paso platos, buscar, primeras coincidencias visibles.

### 6.5 ChatScreen — inbox (P2)

Buscador arriba + `SectionList` `flex: 1`. Modo `screen`. No tocar el compositor del hilo (no es buscador).

---

## 7. Archivos previstos

| Archivo | Acción |
|---------|--------|
| `hooks/useKeyboardInset.js` | Crear |
| `Components/KeyboardAwareResults.js` | Crear |
| `Pages/navbar/screens/OrdenesScreen.js` | Sheet Menú usa el contenedor; quitar `maxHeight: 500` de la lista de platos |
| `Pages/ComandaDetalleScreen.js` | Sheet de menú al agregar; quitar buscador anidado; overlay único |
| `Pages/navbar/screens/InicioScreen.js` | Igual que detalle (P1) |
| `Pages/ReservaWizardScreen.js` | Inset en ScrollView + scroll al foco |
| `Pages/Chat/ChatScreen.js` | Inset / flex en lista inbox |
| `docs/PLAN_TECLADO_BUSCADORES.md` | Este documento |

**No tocar:** `package.json`, `app.json`, `AndroidManifest.xml`, Login/Perfil/Settings.

---

## 8. Pasos de implementación (tras aprobar)

1. Hook `useKeyboardInset` + prueba mental: show/hide, unmount limpia listeners.
2. `KeyboardAwareResults` con `mode: 'modal' | 'screen'`.
3. OrdenesScreen (P0) — verificar en dispositivo.
4. ComandaDetalleScreen (P0) — sheet + overlay.
5. InicioScreen (P1).
6. ReservaWizard (P1).
7. Chat inbox (P2).

Cada paso se verifica en el dispositivo **antes** del siguiente. El teclado no se simula bien en web.

---

## 9. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Android pantalla: `adjustResize` + padding extra = hueco enorme | `mode: 'screen'` → inset 0 en Android si la ventana ya encogió |
| Android Modal: eventos de teclado vs resize | `mode: 'modal'` siempre usa altura del evento |
| `ModalComplementos` encima del Menú | El inset es global; al abrir complementos el Menú puede quedar detrás — no cambiar z-order; al cerrar complementos el Menú se reabre (flujo actual) |
| Landscape: teclado muy alto | `minHeight` lista ~120; sheet scrolleable |
| Extraer sheet en ComandaDetalle toca estado (`tipoPlatoFiltro`, `searchPlato`) | Mover visibilidad a `modalMenuPlatosVisible`; no cambiar payload de guardado |
| Overlay duplicado en detalle | Corregirlo en el mismo PR; si no, el sheet puede quedar centrado |

---

## 10. Criterios de aceptación

- [ ] Nueva Orden: buscar plato con teclado abierto; resultados visibles y tappable.
- [ ] Comanda detalle → Editar → Agregar: igual.
- [ ] Inicio → Editar comanda → Agregar: igual (P1).
- [ ] Reserva, paso platos: igual (P1).
- [ ] Chat inbox: lista de conversaciones no tapada por el teclado (P2).
- [ ] Cerrar teclado: sin padding fantasma.
- [ ] iOS y Android (el APK usa `adjustResize`).
- [ ] Tocar un plato **no** exige cerrar el teclado antes (`keyboardShouldPersistTaps`).
- [ ] Sin librería nativa nueva; OTA sigue siendo válida.

---

## 11. Fuera de este trabajo

- Unificar todos los menús de platos en un solo componente de negocio (complementos, cantidades, para llevar). Aquí solo se comparte **layout de teclado**.
- Formularios (motivo, observaciones, login, clientes).
- App Cocina.
- Rediseño visual del buscador.

---

## 12. Aprobación

Implementar solo tras OK explícito.

**Wedge mínimo si se recorta alcance:** P0 únicamente (`OrdenesScreen` + `ComandaDetalleScreen` + hook + contenedor). P1/P2 en un segundo paso.
