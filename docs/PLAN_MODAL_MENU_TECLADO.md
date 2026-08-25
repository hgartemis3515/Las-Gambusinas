# Plan — Modal Menú de platos + teclado (OrdenesScreen)

**Versión:** 2.0  
**Fecha:** 24 agosto 2026  
**Estado:** Implementado — overlay in-tree (`MenuPlatosSheet`) en `OrdenesScreen`.  
**App:** Mozos (`Las-Gambusinas`)  
**Pantalla:** Nueva Orden → **Agregar Plato** → modal **Menú**  
**Sustituye** (solo para este modal) a `docs/PLAN_TECLADO_BUSCADORES.md` v1.0. Ese plan se implementó y **sigue fallando**.

---

## 1. Síntoma actual

Al enfocar `Buscar plato...` el teclado abre y la **lista de platos se bugea**: desaparece, se aplasta a 0 px, o queda detrás del teclado. Pasa en el modal de menú (y el mismo patrón se copió a Comanda detalle).

La búsqueda **sí filtra**. El fallo es **layout**, no datos.

---

## 2. Qué se intentó y por qué falló

### Intento A — `flex: 1` + `paddingBottom` del teclado

Sheet con `flex: 1` y lista `flex: 1` dentro de un `Modal` sin **altura en píxeles**.

En RN, `flex: 1` en un hijo cuya padre solo tiene `maxHeight: '90%'` (wrap content) **calcula altura 0**. Al abrir el teclado, la lista se evapora.

### Intento B (código de ahora)

Archivos: `hooks/useKeyboardInset.js`, `Components/KeyboardAwareResults.js`, `OrdenesScreen.js`.

- `paddingBottom: keyboardInset` en el backdrop del `Modal`
- Lista con `maxHeight` numérico: `winH - inset - chrome(270)`

Sigue fallando porque se **restan dos veces** y el `chrome: 270` es un número inventado:

| Factor | Efecto |
|--------|--------|
| Android `adjustResize` | La **Activity** ya encoge `Dimensions.window` |
| `Modal` de RN | Es **otra ventana nativa**. `adjustResize` **no** aplica de forma fiable. El teclado se pinta encima |
| `paddingBottom: inset` | Empuja el sheet otra vez |
| `listMaxHeight = winH - inset - 270` | `winH` a veces **ya** está encogida; se resta el teclado otra vez → lista minúscula o 0 visual |
| `chrome: 270` | En landscape / teclado grande, header+toggle+buscador+chips superan 270 → la cuenta queda negativa y se clampa mal |

`KeyboardAvoidingView` **dentro de `Modal`** en Android es inestable (no usarlo como pieza central).

**No** añadir `react-native-keyboard-controller`: dependencia nativa, APK nuevo, rompe OTA.

**No** cambiar `windowSoftInputMode` global: Login/Perfil ya dependen de `adjustResize`.

---

## 3. Causa raíz (una frase)

El menú vive en un **`Modal` nativo**. Ese árbol **no participa** del resize de la Activity. Compensar con listeners + padding + `flex` sobre un padre sin altura fija es una carrera de condiciones: a veces tapa, a veces colapsa.

---

## 4. Decisión

**Sacar el menú del `Modal`.** Pintarlo como overlay **en el mismo árbol** que `OrdenesScreen` (`position: 'absolute'` / `StyleSheet.absoluteFill`).

Así, en Android, `adjustResize` **sí** encoge el overlay. La lista con `flex: 1` funciona porque el padre tendrá **altura explícita** (el overlay `flex: 1` de la pantalla ya resizeada).

En iOS la ventana no encoge: `KeyboardAvoidingView` `behavior="padding"` alrededor del sheet (ahora sí, porque **no** está dentro de `Modal`).

### Layout objetivo

```
SafeAreaView flex:1
  contenido Nueva Orden
  si menú abierto:
    View overlay (absoluteFill, zIndex alto)
      KeyboardAvoidingView flex:1  (iOS: padding; Android: undefined)
        Pressable backdrop (flex:1) → cierra menú
        View sheet
          height = explícita en px  (ver §5)
          Header / toggle / buscador / chips   ← NO flex, onLayout
          FlatList flex:1                      ← único hijo flexible
```

- Buscador **fijo arriba** (no se esconde).
- Lista **encoge** al hueco sobre el teclado.
- Tocar un plato **no** exige cerrar el teclado (`keyboardShouldPersistTaps="handled"`).
- Teclado cerrado: lista con el alto del sheet (~90% de pantalla).
- Mínimo lista: **140 px**. Si no cabe (landscape + teclado), el sheet se hace scrolleable por el chrome, **nunca** altura 0.

---

## 5. Altura del sheet (sin magia 270)

Medir, no adivinar:

1. Overlay `onLayout` → `overlayH`.
2. Bloque chrome (header+toggle+search+chips) `onLayout` → `chromeH`.
3. `listH = max(140, overlayH - chromeH)`.

No usar `window - keyboard - 270`. El overlay **ya** refleja el teclado en Android. En iOS el `KeyboardAvoidingView` reduce `overlayH`.

`useKeyboardInset` **deja de usarse** en este modal (o se queda solo para otras pantallas). Este menú no depende de él.

---

## 6. Complementos (iOS)

Hoy: un segundo `Modal` encima del menú **no se ve** en iOS → se cierra el menú, se abre `ModalComplementos`, al cerrar se reabre el menú (`handleAddPlato`, refs `platoPendienteComplementosRef` / `reabrirModalPlatosTrasComplementosRef`).

Con overlay in-tree el menú **ya no es Modal**. Complementos puede seguir siendo `Modal` **encima** del overlay. Entonces:

- **Probar primero:** abrir complementos **sin** cerrar el menú.
- Si en un dispositivo el `Modal` tapa y al volver el overlay quedó mal, mantener el cierre/reabrir actual.

No mezclar dos `Modal` de menú+complementos; el menú deja de ser `Modal`.

---

## 7. Archivos

| Archivo | Acción |
|---------|--------|
| `Components/MenuPlatosSheet.js` | **Nuevo.** Overlay + sheet + buscador + chips + `FlatList`. Props: visible, platos, búsqueda, tipo servicio, callbacks add/remove. **Sin** cambiar reglas de negocio (cantidades, para llevar, complementos). |
| `Pages/navbar/screens/OrdenesScreen.js` | Quitar el `<Modal>` de platos. Renderizar `MenuPlatosSheet`. Quitar `useKeyboardInset` de esta pantalla. El `Modal` de **mesas** no se toca. |
| `hooks/useKeyboardInset.js` | No usar aquí. No borrar todavía (Comanda detalle aún lo usa). |
| `Components/KeyboardAwareResults.js` | Deja de usarse en el menú. No borrar todavía. |
| `docs/PLAN_MODAL_MENU_TECLADO.md` | Este documento. |

**No tocar:** `package.json`, `app.json`, `AndroidManifest.xml`, Login, Perfil, modal de mesas.

**Fuera de esta iteración:** Inicio, Reserva, Chat. Comanda detalle **después**, reutilizando `MenuPlatosSheet`.

---

## 8. Pasos (tras aprobar)

1. Extraer JSX del menú a `MenuPlatosSheet` **sin** cambiar layout (sigue `Modal`) — verificar que el menú sigue igual **con teclado cerrado**.
2. Cambiar `Modal` → overlay in-tree + `KeyboardAvoidingView` + sheet con `height`/`flex` explícitos + `FlatList` `flex:1`.
3. `onLayout` chrome/overlay para `listH`. Quitar `paddingBottom` de teclado y `useKeyboardInset`.
4. Probar complementos: con menú abierto; si falla, restaurar cierre/reabrir.
5. Landscape y teclado alto: lista ≥ 140 px.

Cada paso se verifica **en dispositivo** (el teclado no se simula bien en web).

---

## 9. Criterios de aceptación

- [ ] Nueva Orden → Agregar Plato → tipo → enfocar búsqueda: **≥ 2 filas** de platos visibles **encima** del teclado.
- [ ] Escribir filtra; se puede **tocar + / Agregar** con el teclado abierto.
- [ ] Cerrar teclado: lista recupera altura; **sin** hueco fantasma abajo.
- [ ] Volver atrás (cambiar tipo): selector DESAYUNO/CARTA intacto.
- [ ] Complementos: al confirmar, el plato queda en la orden y el menú se puede seguir usando.
- [ ] Android (APK / Expo) **e** iOS si hay dispositivo.
- [ ] Sin librería nativa nueva.

---

## 10. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Overlay queda **detrás** del tab bar | `zIndex` / `elevation` altos; overlay cubre toda `SafeAreaView` incluida la zona del nav |
| `ScrollView` de Nueva Orden captura gestos | Overlay `absoluteFill` con fondo; el sheet no está dentro de ese `ScrollView` |
| Android **sí** resizea y además KAV hace padding | Android: `behavior={undefined}` / `enabled={Platform.OS === 'ios'}` |
| Landscape: poco alto | `minHeight` lista 140; chrome compacto opcional después, no en el primer PR |
| Extraer componente rompe cantidades / para llevar | El primer paso es copy-paste del JSX; mismos handlers |

---

## 11. Rollback

Si el overlay empeora: volver el menú a `<Modal>` (git) y **no** reintroducir `flex:1` ni `paddingBottom` de teclado hasta tener altura en px medida.

---

## 12. Aprobación

Implementar solo con OK explícito. Alcance de esta iteración: **solo modal Menú de `OrdenesScreen`**.
