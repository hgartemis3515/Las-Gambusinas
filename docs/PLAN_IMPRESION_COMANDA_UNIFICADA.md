# Plan de implementación — Impresión de comanda unificada (Mozos → Cocina + Dashboard)

**Versión:** 1.1  
**Fecha:** Junio 2026  
**Cambios v1.1:** Fix de numeración agrupada en ticket impreso (`#81+#82`) cuando hay varias comandas (mesas unidas, pedido agrupado, ticket de aprobación/PPA).  
**Alcance:** App Mozos (`gambusinas`), App Cocina (`appcocina`), Dashboard Backend (`backend-gambusinas/public/comandas.html`)  
**Documentación relacionada:**
- [PLAN_PLANTILLA_COMANDAS_APROBACION_Y_REPORTE.md](./PLAN_PLANTILLA_COMANDAS_APROBACION_Y_REPORTE.md) — plantilla comanda, bandeja cocina, endpoint `ticket-imprimible`
- [PLAN_PAGOS_ADELANTADOS.md](./PLAN_PAGOS_ADELANTADOS.md) — tickets PPA en la misma tabla
- [APP_MOZOS_DOCUMENTACION_COMPLETA.md](./APP_MOZOS_DOCUMENTACION_COMPLETA.md)

---

## 1. Resumen ejecutivo

### Objetivo

Unificar la impresión/compartición de comandas en **todos los puntos de salida** para que produzcan el **mismo ticket térmico 80 mm** que hoy genera el App de Mozos, usando la misma plantilla (`comandaPlantilla`) y el mismo pipeline de renderizado.

### Alcance de este plan

| Superficie | Botón / acción | Estado actual | Estado deseado |
|------------|----------------|---------------|----------------|
| **App Mozos** (referencia) | Imprimir comanda en `PagosScreen`, `InicioScreen`, modales | ✅ Implementado en `comandaPrint` | Sin cambios (fuente de verdad) |
| **App Cocina** — tabla "Comandas y Pagos Adelantados" | 🖨️ Imprimir en `TicketsPpaPage` y `PpaSidebar` | ⚠️ HTML duplicado; solo muestra `comandasNumbers[0]` | Igual que mozos (web) + etiqueta `#81+#82` si hay grupo |
| **Dashboard** — `comandas.html` | 🖨️ en filas expandidas de grupo | ⚠️ HTML duplicado; imprime solo número de la subfila | Igual que mozos (web) + `#81+#82` del pedido/grupo |

### Principio rector

> **Una sola lógica de impresión de comanda.** El App de Mozos ya resolvió el problema; Cocina y el dashboard deben **delegar** en esa lógica (o en un módulo extraído de ella), no mantener generadores HTML paralelos.

### Qué significa "imprimir como el app de mozos"

En mozos, `mostrarOpcionesComanda()` (`gambusinas/services/comandaPrint/index.js`) hace:

```
1. Cargar plantilla  → GET /api/configuracion/comanda-plantilla
2. Mapear datos      → mapComandaATicket(comanda, boucher, configMoneda)
3. Renderizar ticket → generarHtmlComanda({ datos, plantilla, serverOrigin })
4. Plataforma:
   · Web (RN)        → envolverHtmlBoucherTicket + window.open + window.print()
   · Móvil (iOS/Android) → generarPdfComandaNativo (pdf-lib 80mm) + compartirComandaPdf (expo-sharing)
```

**App Cocina y `comandas.html` son aplicaciones web.** El comportamiento equivalente es la rama **web** del servicio mozos (pasos 1–3 + `window.print()` con página `@page` de 80 mm). Opcionalmente se puede añadir descarga/compartir PDF en navegador para acercarse a la experiencia móvil.

---

## 2. Referencia: lógica actual del App de Mozos

### 2.1 Archivos canónicos (no duplicar)

| Archivo | Rol |
|---------|-----|
| `gambusinas/services/comandaPrint/index.js` | Orquestador: carga plantilla, mapea datos, decide web vs móvil |
| `gambusinas/utils/comandaHtml.js` | `generarHtmlComanda()`, `mapComandaATicket()` — HTML interior 80 mm |
| `gambusinas/utils/boucherPrint.js` | `envolverHtmlBoucherTicket()` — wrapper con `@page { size: 80mm … }` |
| `gambusinas/utils/logoPlantilla.js` | `resolveLogoUrl()` — logo relativo / base64 / absoluto |
| `gambusinas/utils/comandaPdfNative.js` | PDF nativo 80 mm (solo móvil, pdf-lib) |
| `gambusinas/utils/comandaPdfShare.js` | Compartir PDF vía `expo-sharing` (solo móvil) |

### 2.2 Flujo en `PagosScreen.js`

```javascript
const generarComanda = async (boucher = null) => {
  const opts = construirOptsBoucher(boucher); // { boucher, comandas, mesa, plantilla, configMoneda, … }
  return mostrarOpcionesComanda(opts, {
    onStart: () => setIsGenerating(true),
    onEnd: () => setIsGenerating(false),
  });
};
```

`construirOptsBoucher` usa comandas de la mesa + boucher asociado como fuente de moneda, método de pago y cliente.

### 2.3 Rama web (la que deben replicar Cocina y Dashboard)

```javascript
// comandaPrint/index.js — Platform.OS === 'web'
const { html } = generarHtmlComanda({ datos, plantilla, serverOrigin });
const printWindow = window.open('', '_blank');
printWindow.document.write(html);   // html ya incluye envolverHtmlBoucherTicket
printWindow.document.close();
printWindow.focus();
printWindow.print();
```

Puntos críticos del wrapper `envolverHtmlBoucherTicket`:

- Ancho fijo **226 pt** (= 80 mm @ 72 PPI)
- `@page { size: 80mm <alto>mm; margin: 0 }`
- `print-color-adjust: exact` para logo y colores
- Altura dinámica según cantidad de platos

### 2.4 Rama móvil (referencia, fuera de alcance web)

```javascript
const uri = await compartirComandaPdf({ datos, plantilla, serverOrigin });
// → generarPdfComandaNativo + Sharing.shareAsync(mimeType: 'application/pdf')
```

---

## 3. Estado actual en Cocina y Dashboard (brechas)

### 3.1 App Cocina — `useTablaAprobacion.js`

**Ubicación del botón:**
- `appcocina/src/components/pages/TicketsPpaPage.jsx` → `handleImprimir(ticket)`
- `appcocina/src/components/Principal/PpaSidebar.jsx` → `imprimirComanda(ticket)`

**Implementación actual (`imprimirComanda` en el hook):**

1. ✅ Llama `GET /api/comanda/:id/ticket-imprimible` (correcto)
2. ✅ Carga plantilla `GET /api/configuracion/comanda-plantilla`
3. ❌ Usa `generarHtmlComanda80mm()` **inline** (~100 líneas duplicadas)
4. ❌ Wrapper HTML genérico (`max-width: 320px`) — **no** usa `envolverHtmlBoucherTicket`
5. ❌ Logo sin `resolveLogoUrl` (rutas `/assets/...` pueden fallar)
6. ❌ No llama `printWindow.print()` explícitamente (solo `onload` en script embebido)
7. ❌ Formato de moneda/tipoPago puede diferir del mapeo mozos

### 3.2 Dashboard — `comandas.html`

**Ubicación del botón:**
- Fila expandida de grupo de mesa: `imprimirComanda(comanda)` (línea ~422)
- Tab "Plantilla Comandas": `imprimirPreviewComanda()` (preview del editor — puede quedar separado)

**Implementación actual:**

1. ✅ Llama `GET /comanda/:id/ticket-imprimible`
2. ❌ `mapComandaATicket()` duplicado en Alpine (~30 líneas)
3. ❌ `generarHtmlComandaDesdeDatos()` duplicado (~150 líneas)
4. ❌ Wrapper HTML propio (Inter, 320px) — no 80 mm térmico
5. ❌ Preview de plantilla y comanda real usan generadores distintos → riesgo de divergencia visual

### 3.3 Matriz de divergencias

| Aspecto | Mozos (canónico) | Cocina actual | comandas.html actual |
|---------|------------------|---------------|----------------------|
| Generador HTML interior | `comandaHtml.js` | Copia inline | Copia Alpine |
| Wrapper 80 mm | `envolverHtmlBoucherTicket` | CSS genérico 320px | CSS genérico 320px |
| Logo | `resolveLogoUrl` | URL cruda | URL cruda / preview local |
| Fuente datos | `mapComandaATicket` + boucher | `ticket-imprimible` + fallback manual | `ticket-imprimible` + `mapComandaATicket` local |
| Impresión | `window.print()` directo | Solo `onload` script | Solo `onload` script |
| PDF compartir | expo-sharing (móvil) | No | No |
| Nº comanda en ticket (grupo) | `comandasNumbers` del boucher (UI mozos: `#81, #82`) | Solo `comandasNumbers[0]` | Solo `comandaNumber` de la fila |
| Nº comanda impreso (grupo) | ⚠️ `mapComandaATicket` usa una sola comanda | ❌ `#81` aunque el ticket tenga `[81, 82]` | ❌ `#81` aunque el grupo tenga varias |

---

## 4. Arquitectura propuesta

### 4.1 Diagrama de flujo unificado (web)

```
┌─────────────────────────────────────────────────────────────────┐
│  Botón Imprimir (Cocina / comandas.html / Mozos web)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  comandaPrintWeb()            │  ← módulo compartido
              │  (extraído de comandaPrint)   │
              └──────────────┬───────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ticket-imprimible    comanda-plantilla    serverOrigin
  (datos enriquecidos) (plantilla MongoDB)  (URL base API)
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  generarHtmlComanda()         │
              │  + envolverHtmlBoucherTicket  │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  window.open → write(html)    │
              │  → focus() → print()          │
              └──────────────────────────────┘
```

### 4.2 Estrategia de código compartido (recomendada)

**Opción A — Módulo estático en backend (menor fricción para `comandas.html`):**

1. Extraer de `gambusinas/utils/` a `backend-gambusinas/public/js/comanda-print/`:
   - `comandaHtml.js` (sin imports RN)
   - `boucherPrint.js` (solo `envolverHtmlBoucherTicket`, `PUNTOS_ANCHO`, `pxToMm`)
   - `logoPlantilla.js` (solo `resolveLogoUrl`)
   - `comandaPrintWeb.js` — función `imprimirComandaWeb({ comandaId, datos, serverOrigin })`

2. App Cocina importa el mismo código vía alias de build o copia sincronizada en `appcocina/src/utils/comandaPrint/`.

3. `comandas.html` carga `<script type="module" src="/js/comanda-print/comandaPrintWeb.js">` y reemplaza `imprimirComanda()` por una línea.

**Opción B — Paquete npm interno `@gambusinas/comanda-print`:**

- Monorepo con build ESM; consumido por `gambusinas`, `appcocina` y empaquetado en `backend-gambusinas/public/js/`.
- Más limpio a largo plazo; más setup inicial.

**Recomendación:** empezar con **Opción A** (módulo estático + import en Cocina) y migrar a paquete si crece el uso.

### 4.3 API del módulo web compartido

```javascript
/**
 * Imprime una comanda en navegador con el mismo resultado que App Mozos (web).
 *
 * @param {Object} opts
 * @param {string} [opts.comandaId] - ID Mongo; si se pasa, obtiene datos de ticket-imprimible
 * @param {Object} [opts.datos] - Datos ya mapeados (evita fetch si vienen del ticket de aprobación)
 * @param {number[]} [opts.comandasNumbersOverride] - Fuerza etiqueta agrupada (#81+#82) sin depender solo del fetch
 * @param {Object} [opts.plantilla] - Plantilla precargada (opcional)
 * @param {string} opts.serverOrigin - Origen del servidor para logo y API
 * @param {Function} [opts.fetchJson] - (url) => Promise<json> — inyectable para auth
 * @param {Function} [opts.onStart] / [opts.onEnd] - loading UI
 */
export async function imprimirComandaWeb(opts) { … }

/**
 * Variante para ticket de la bandeja de aprobación (comanda o PPA).
 * Resuelve comandaId desde ticket.comandasIds[0] || ticket.comandaId.
 */
export async function imprimirComandaDesdeTicket(ticket, opts) { … }

/**
 * Formatea números de comanda para el campo visible del ticket.
 * Una comanda  → "#81"
 * Varias       → "#81+#82"   (orden ascendente, sin duplicados)
 */
export function formatComandasNumbersLabel(comandasNumbers) { … }
```

### 4.4 Normalización de datos

El endpoint `GET /api/comanda/:id/ticket-imprimible` ya devuelve el shape esperado por `generarHtmlComanda`. El módulo web debe:

1. Preferir siempre `ticket-imprimible` cuando hay `comandaId`.
2. Normalizar campos antes de renderizar:
   - `moneda`: `'USD'` | `'Soles'` (como ya hace Cocina)
   - `fechaPedido`: string localizado `es-PE` o Date → `formatFecha` de `comandaHtml.js`
   - `productos[].paraLlevar`: `tipoServicio === 'para_llevar'`
3. **No** reimplementar mapeo si el endpoint responde; usar fallback `mapComandaATicket` solo si el fetch falla.
4. Calcular **`comandaNumeroDisplay`** (texto del ticket) con `formatComandasNumbersLabel(datos.comandasNumbers)`; si el array tiene un solo elemento, mostrar `#81`; si tiene varios, `#81+#82`.

### 4.5 Fix: numeración agrupada en ticket impreso (`#81+#82`)

#### Problema actual

Cuando se **juntan mesas** o varias comandas comparten el mismo **pedido** (`pedidoId`), el ticket impreso solo muestra el número de **una** comanda:

| Contexto | Datos disponibles | Qué imprime hoy | Qué debe imprimir |
|----------|-------------------|-----------------|-------------------|
| Ticket aprobación / PPA (cocina) | `ticket.comandasNumbers: [81, 82]` | `#81` (`comandasNumbers[0]`) | **`#81+#82`** |
| Grupo en `comandas.html` (varias comandas, mismo pedido) | `row.comandas[].numComanda` | `#81` al imprimir subfila | **`#81+#82`** (números del grupo) |
| Mesa unida + pago mozos | `boucher.comandasNumbers: [81, 82]` | Solo `comandas[0]` en `mapComandaATicket` | **`#81+#82`** en campo Comanda del ticket |
| Comanda individual (sin grupo) | `[81]` | `#81` | `#81` (sin cambio) |

En `PagosScreen` la UI de mozos **ya lista** varias comandas (`#81, #82`), pero `generarHtmlComanda` en el ticket impreso aún usa un solo `comandaNumero`. Este fix alinea **lo impreso** con lo que el operador ve cuando hay agrupación.

#### Formato acordado

```
1 comanda   →  #81
2 comandas  →  #81+#82
3 comandas  →  #81+#82+#85
```

Reglas:

- Prefijo `#` en cada número.
- Separador **`+`** (sin espacios), distinto a la UI de mozos que usa coma en pantalla.
- Orden **ascendente** numérico.
- Eliminar duplicados y valores nulos.
- El campo de plantilla sigue siendo la etiqueta configurable (`etiquetas.comandaNumero`, default `"Comanda"`); el **valor** es `comandaNumeroDisplay`.

#### Helper compartido (en `comandaHtml.js`)

```javascript
/**
 * @param {Array<number|string|null|undefined>} comandasNumbers
 * @returns {string} ej. "#81+#82" o ""
 */
export function formatComandasNumbersLabel(comandasNumbers) {
  const nums = [...new Set(
    (comandasNumbers || [])
      .map((n) => (n != null && n !== '' ? Number(n) : NaN))
      .filter((n) => !Number.isNaN(n))
  )].sort((a, b) => a - b);

  if (nums.length === 0) return '';
  return nums.map((n) => `#${n}`).join('+');
}

/**
 * Aplica display agrupado sobre payload ticket-imprimible o mapComandaATicket.
 */
export function aplicarComandaNumeroDisplay(datos) {
  const label = formatComandasNumbersLabel(datos.comandasNumbers);
  if (label) {
    return { ...datos, comandaNumeroDisplay: label };
  }
  const fallback = datos.comandaNumero != null ? `#${datos.comandaNumero}` : '';
  return { ...datos, comandaNumeroDisplay: fallback };
}
```

#### Cambio en `generarHtmlComanda`

Reemplazar el valor mostrado en el bloque "Nº Comanda":

```javascript
// Antes
if (vis.comandaNumero !== false && datos.comandaNumero) {
  html += fila(etiquetas.comandaNumero, String(datos.comandaNumero));
}

// Después
const numeroEtiqueta = datos.comandaNumeroDisplay
  || formatComandasNumbersLabel(datos.comandasNumbers)
  || (datos.comandaNumero != null ? `#${datos.comandaNumero}` : '');
if (vis.comandaNumero !== false && numeroEtiqueta) {
  html += fila(etiquetas.comandaNumero, numeroEtiqueta);
}
```

Mismo cambio en `comandaPdfNative.js` (móvil) para que PDF y web coincidan.

#### Backend — enriquecer `ticket-imprimible`

El endpoint ya devuelve `comandasNumbers` cuando el origen es `TicketAprobacion` o `TicketPagoAdelantado`. Falta completar el caso **comanda suelta dentro de un pedido agrupado**:

| Origen del fetch | Acción |
|------------------|--------|
| `TicketAprobacion` / `TicketPagoAdelantado` | Ya trae `comandasNumbers[]` completo → sin cambio |
| Comanda con `pedidoId` | Buscar hermanas del mismo `Pedido` → `comandasNumbers = pedido.comandasNumbers` |
| Comanda sin pedido | `comandasNumbers: [comanda.comandaNumber]` |
| Boucher asociado | Si existe, unir `boucher.comandasNumbers` (fuente de verdad post-pago) |

Archivo: `backend-gambusinas/src/controllers/aprobacionController.js` (rama "sin ticket") y/o nuevo helper `resolverComandasNumbersParaImpresion(comandaId)`.

Respuesta enriquecida:

```json
{
  "comandaNumero": 81,
  "comandasNumbers": [81, 82],
  "comandaNumeroDisplay": "#81+#82",
  "cantidadComandas": 2,
  "mesa": "M05+M06",
  "mesaCombinada": true
}
```

`mesaCombinada` / `nombreCombinado` (opcional en la misma iteración): si la mesa tiene `mesasUnidas` o `nombreCombinado`, el campo **Mesa** del ticket puede mostrar `M05+M06` — alineado con `InicioScreen` / `formatearNombreMesa`. No sustituye el fix de comandas, pero mejora legibilidad en mesas unidas.

#### `comandas.html` — impresión con contexto de grupo

**Subfila (comanda dentro de grupo expandido):**

```javascript
async imprimirComanda(comanda, contextoGrupo = null) {
  const comandasNumbers = contextoGrupo?.comandas
    ?.map(c => c.numComanda || c.comandaNumber)
    .filter(Boolean)
    ?? [comanda.numComanda || comanda.comandaNumber];

  await imprimirComandaWeb({
    comandaId: comanda._id,
    comandasNumbersOverride: comandasNumbers,  // fuerza #81+#82
    serverOrigin: window.location.origin,
  });
}
```

En el template Alpine, pasar el grupo padre:

```html
<button @click.stop="imprimirComanda(comanda, row)" …>🖨️</button>
```

(solo en filas hijas dentro de `row.tipo === 'grupo'`).

**Fila de grupo (recomendado):** añadir botón 🖨️ en acciones del grupo que imprima el **consolidado** del pedido (platos de todas las comandas o ticket-imprimible del boucher/ticket asociado al pedido):

```html
<button @click.stop="imprimirGrupoComandas(row)" title="Imprimir grupo">🖨️</button>
```

`imprimirGrupoComandas(row)`:

1. Si todas las comandas comparten un `TicketAprobacion` / boucher → un solo ticket con `comandasNumbers` del grupo.
2. Si no hay ticket unificado → imprimir con `comandasNumbers` del grupo y productos concatenados (o primera comanda + override de números, según datos de `ticket-imprimible`).

#### App Cocina — tabla "Comandas y Pagos Adelantados"

El ticket en bandeja ya incluye `comandasNumbers` (desde `TicketAprobacion` / `TicketPagoAdelantado`).

```javascript
// imprimirComandaDesdeTicket
const comandasNumbers = ticket.comandasNumbers?.length
  ? ticket.comandasNumbers
  : [ticket.comandaNumber].filter(Boolean);

await imprimirComandaWeb({
  comandaId: ticket.comandasIds?.[0] || ticket.comandaId,
  comandasNumbersOverride: comandasNumbers,
  …
});
```

**UI opcional (no bloqueante):** en la columna ID de `TicketsPpaPage`, mostrar `#81+#82` cuando `ticket.comandasNumbers.length > 1`, para que cocina vea el agrupamiento antes de imprimir.

#### Mozos — consistencia vía módulo compartido

Al unificar `comandaHtml.js`, el fix de `comandaNumeroDisplay` aplica automáticamente en mozos si `mostrarOpcionesComanda` pasa `comandasNumbers` del boucher:

```javascript
// comandaPrint/index.js — al construir datos
const comandasNumbers = boucher?.comandasNumbers
  ?? comandas.map(c => c.comandaNumber).filter(n => n != null);
const datos = aplicarComandaNumeroDisplay({
  ...mapComandaATicket(primeraComanda, boucher, configMoneda),
  comandasNumbers,
});
```

### 4.6 PDF compartir en web (opcional, fase 2)

Para acercarse a la experiencia móvil (compartir PDF):

```javascript
// Tras generar HTML, opcional:
// html2pdf / jsPDF + html2canvas → Blob → navigator.share({ files: [pdf] })
// o descarga: <a download="comanda-152.pdf">
```

No bloquea la fase 1. La prioridad es **mismo layout 80 mm + window.print()**.

---

## 5. Cambios por proyecto

### 5.1 Backend (`backend-gambusinas`)

| Tarea | Detalle |
|-------|---------|
| Publicar módulo JS | `public/js/comanda-print/` con archivos extraídos (ver §4.2) |
| Helper agrupación | `resolverComandasNumbersParaImpresion(comandaId)` — pedido, boucher, ticket |
| Extender `ticket-imprimible` | Devolver `comandasNumbers`, `comandaNumeroDisplay`, `cantidadComandas`; resolver hermanas por `pedidoId` |
| Mantener endpoint | `GET /api/configuracion/comanda-plantilla` |
| (Opcional) | `nombreCombinado` / mesa unida en payload imprimible |
| (Opcional fase 2) | `GET /api/comanda/:id/ticket-pdf` — PDF server-side |

### 5.2 Dashboard — `comandas.html`

| Tarea | Archivo / zona | Acción |
|-------|----------------|--------|
| Reemplazar `imprimirComanda` | Alpine `comandasApp()` ~L2152 | Delegar en `imprimirComandaWeb`; pasar `comandasNumbersOverride` desde grupo padre |
| Impresión de grupo | Acciones fila `tipo === 'grupo'` | Nuevo `imprimirGrupoComandas(row)` + botón 🖨️ en header del grupo |
| Subfila en grupo | Template hijo ~L422 | `imprimirComanda(comanda, row)` para heredar números del pedido |
| Eliminar duplicados | `mapComandaATicket`, `generarHtmlComandaDesdeDatos` | Borrar tras migración |
| Unificar preview | `generarPreviewComanda()`, `imprimirPreviewComanda()` | Usar mismo generador que impresión real (solo datos de ejemplo) |
| Cargar script | `<head>` o antes de `comandasApp` | `<script type="module">` importando `comandaPrintWeb.js` |
| UX impresión | — | `window.print()` + toast "Comanda enviada a impresión" / catch popup bloqueado |

**Botones afectados:**
- 🖨️ en fila de comanda dentro de grupo expandido (con contexto `row` → `#81+#82`)
- 🖨️ nuevo en fila header de **GRUPO** (imprimir consolidado del pedido)
- (Recomendado) 🖨️ en modal de detalle de comanda individual

### 5.3 App Cocina (`appcocina`)

| Tarea | Archivo | Acción |
|-------|---------|--------|
| Crear util compartido | `src/utils/comandaPrint/comandaPrintWeb.js` | Port del módulo (o import desde backend en dev) |
| Simplificar hook | `src/hooks/useTablaAprobacion.js` | Eliminar `generarHtmlComanda80mm` y `ETIQUETAS_DEFAULT` duplicados |
| Actualizar `imprimirComanda` | `useTablaAprobacion.js` | Pasar `ticket.comandasNumbers` como override; eliminar fallback que usa solo `[0]` |
| UI columna ID (opcional) | `TicketsPpaPage.jsx` | Mostrar `#81+#82` si `comandasNumbers.length > 1` |
| UI sin cambios | `TicketsPpaPage.jsx`, `PpaSidebar.jsx` | Mantienen `handleImprimir` / `onClick` — solo cambia implementación del hook |
| Loading | `TicketsPpaPage.jsx` | (Opcional) estado `imprimiendoId` con spinner en botón |

**Tickets PPA vs comanda completa:** ambos traen `comandasNumbers[]` en el ticket; la impresión debe usar el array completo, no solo `comandasIds[0]`.

### 5.4 App Mozos (`gambusinas`) — refactor menor

| Tarea | Detalle |
|-------|---------|
| Extraer rama web | Mover bloque `Platform.OS === 'web'` de `comandaPrint/index.js` a `comandaPrintWeb.js` |
| Reutilizar | `mostrarOpcionesComanda` importa `imprimirComandaWeb` en web |
| Numeración agrupada | Pasar `boucher.comandasNumbers` a `aplicarComandaNumeroDisplay` antes de renderizar |
| Sin cambio UX | Mozos sigue igual para el usuario; ticket impreso muestra `#81+#82` si aplica |

---

## 6. Flujo detallado por superficie

### 6.1 Tabla "Comandas y Pagos Adelantados" (App Cocina)

```
Usuario pulsa [Imprimir] en fila (COMANDA o ADELANTADO)
  → imprimirComanda(ticket)
  → comandasNumbers = ticket.comandasNumbers (array completo)
  → comandaId = ticket.comandasIds?.[0] (fetch de productos / boucher)
  → GET /api/comanda/{comandaId}/ticket-imprimible
  → merge comandasNumbersOverride si el fetch trae menos números que el ticket
  → aplicarComandaNumeroDisplay → "#81+#82"
  → generarHtmlComanda + print()
```

**Casos:**
- Ticket con varias comandas (`comandasNumbers: [81, 82]`): campo Comanda del ticket = **`#81+#82`**.
- Ticket con una sola comanda: **`#81`**.
- Ticket ya aprobado/reportado: imprimir sigue habilitado (regla de negocio existente).

### 6.2 `comandas.html` — grupo y subfilas

**Subfila dentro de grupo expandido:**

```
Usuario pulsa 🖨️ en comanda hija del grupo
  → imprimirComanda(comanda, rowGrupo)
  → comandasNumbers = rowGrupo.comandas.map(c => c.numComanda)
  → imprimirComandaWeb({ comandaId, comandasNumbersOverride, serverOrigin })
  → ticket muestra Comanda: #81+#82
```

**Header de grupo (nuevo):**

```
Usuario pulsa 🖨️ en fila GRUPO
  → imprimirGrupoComandas(row)
  → comandasNumbers de todas las comandas del pedido
  → un ticket consolidado (preferir ticket-imprimible del boucher/ticket del pedido)
```

**Comanda individual (sin agrupar):** comportamiento actual, `#81` solamente.

### 6.3 Equivalencia con mozos post-pago

| Mozos | Cocina / Dashboard |
|-------|-------------------|
| `boucher.comandasNumbers` → `comandaNumeroDisplay` | `ticket.comandasNumbers` o `row.comandas` del grupo |
| `mapComandaATicket` + override | `ticket-imprimible` + `comandasNumbersOverride` |
| `plantilla` de estado o fetch | fetch `comanda-plantilla` |
| `generarHtmlComanda` + print | **Idéntico** |
| Móvil: PDF + share | N/A en web; opcional fase 2 |

---

## 7. Criterios de aceptación

### 7.1 Visual / funcional

- [ ] Ticket impreso desde Cocina es **pixel-equivalente** al impreso desde Mozos (misma plantilla, logo, fuentes, ancho 80 mm).
- [ ] Ticket impreso desde `comandas.html` coincide con Mozos y Cocina para la **misma comanda**.
- [ ] Logo PNG (ruta `/assets/...` o base64) se ve en los tres contextos.
- [ ] Complementos, notas, marcador `(P.L.)`, total, cliente y observaciones respetan `visibilidad` y `bloques` de la plantilla.
- [ ] Popup de impresión del navegador se abre; si está bloqueado, se muestra mensaje claro.
- [ ] **Grupo 2+ comandas:** ticket muestra `Comanda: #81+#82` (cocina, comandas.html y mozos).
- [ ] **1 comanda:** ticket muestra `Comanda: #81` (sin `+` extra).
- [ ] **Grupo en comandas.html:** imprimir desde subfila o desde header de grupo muestra todos los números del pedido.
- [ ] **Mesa unida:** si hay varias comandas en el mismo pago/pedido, numeración agrupada visible en el ticket.

### 7.2 Código

- [ ] No queda `generarHtmlComanda80mm` duplicado en `useTablaAprobacion.js`.
- [ ] No queda `generarHtmlComandaDesdeDatos` duplicado en `comandas.html` (salvo preview mock si se unifica).
- [ ] Endpoint `ticket-imprimible` resuelve `comandasNumbers` desde pedido/boucher cuando hay hermanas.
- [ ] `formatComandasNumbersLabel` tiene un solo hogar en `comandaHtml.js`.

### 7.3 Regresión

- [ ] App Mozos móvil: PDF + compartir sigue funcionando.
- [ ] App Mozos web: impresión post-pago sin cambios.
- [ ] Endpoint `ticket-imprimible` para comanda sin ticket de aprobación (solo comanda + boucher).
- [ ] Endpoint `ticket-imprimible` para PPA.

---

## 8. Plan de implementación por fases

### Fase 1 — Módulo web compartido + helper agrupación (1–2 días)

1. Crear `comandaPrintWeb.js` extrayendo rama web de `comandaPrint/index.js`.
2. Copiar/adaptar `comandaHtml.js` con `formatComandasNumbersLabel` y `aplicarComandaNumeroDisplay`.
3. Actualizar `generarHtmlComanda` y `comandaPdfNative` para usar `comandaNumeroDisplay`.
4. Probar con mocks: `[81]`, `[81, 82]`, `[82, 81]` → siempre `#81+#82`.

### Fase 1b — Backend `ticket-imprimible` (0.5 día)

1. Implementar `resolverComandasNumbersParaImpresion` (pedido, boucher, ticket).
2. Incluir `comandaNumeroDisplay` y `cantidadComandas` en la respuesta JSON.
3. Probar comanda hija de pedido con 2+ comandas.

### Fase 2 — App Cocina (0.5–1 día)

1. Integrar módulo en `appcocina`.
2. Reemplazar `imprimirComanda` en `useTablaAprobacion.js`.
3. Eliminar código duplicado del hook.
4. Probar: comanda completa con 2 números, PPA con 2 números, ticket con 1 número.

### Fase 3 — Dashboard `comandas.html` (0.5–1 día)

1. Servir módulo en `public/js/comanda-print/`.
2. Reemplazar `imprimirComanda(comanda, rowGrupo?)` con override de números.
3. Añadir `imprimirGrupoComandas(row)` + botón 🖨️ en fila grupo.
4. Eliminar funciones duplicadas.

### Fase 4 — Refactor mozos + limpieza (0.5 día)

1. `comandaPrint/index.js` usa `imprimirComandaWeb` en web y pasa `comandasNumbers` del boucher.
2. Documentar en README interno la regla: **no agregar generadores HTML de comanda fuera del módulo**.

### Fase 5 — (Opcional) PDF en web

1. Evaluar `navigator.share` + blob PDF.
2. Botón "Compartir PDF" en Cocina si el dispositivo lo soporta.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Divergencia futura si se editan 3 copias del JS | Un solo módulo en `public/js/comanda-print/`; Cocina importa o script de sync en build |
| Popup bloqueado por el navegador | Detectar `!printWindow` y mostrar toast con instrucción |
| Logo no carga (CORS / ruta) | Siempre `resolveLogoUrl(logo, serverOrigin)` |
| `ticket-imprimible` lento o caído | Fallback `mapComandaATicket` + `comandasNumbersOverride` del contexto UI |
| Override vs fetch desincronizados | Regla: `union(fetch.comandasNumbers, override)` antes de formatear |
| Grupo sin ticket único en backend | Concatenar productos de comandas hermanas o imprimir con números agrupados y platos de la comanda solicitada (documentar decisión en implementación) |
| Impresoras térmicas distintas | Mantener `@page 80mm` y márgenes 0 del wrapper canónico |

---

## 10. Archivos a crear / modificar (checklist)

### Crear

| Ruta | Descripción |
|------|-------------|
| `backend-gambusinas/public/js/comanda-print/comandaHtml.js` | Generador HTML + `formatComandasNumbersLabel` |
| `backend-gambusinas/src/services/comandaImpresion.service.js` | (Nuevo) `resolverComandasNumbersParaImpresion` |
| `backend-gambusinas/public/js/comanda-print/boucherPrintWeb.js` | `envolverHtmlBoucherTicket` + constantes |
| `backend-gambusinas/public/js/comanda-print/logoPlantillaWeb.js` | `resolveLogoUrl` |
| `backend-gambusinas/public/js/comanda-print/comandaPrintWeb.js` | API `imprimirComandaWeb`, `imprimirComandaDesdeTicket` |
| `appcocina/src/utils/comandaPrint/` | Mismo contenido (o re-export) |

### Modificar

| Ruta | Cambio |
|------|--------|
| `gambusinas/utils/comandaHtml.js` | `formatComandasNumbersLabel`, `aplicarComandaNumeroDisplay`, render agrupado |
| `gambusinas/utils/comandaPdfNative.js` | Usar `comandaNumeroDisplay` en PDF móvil |
| `backend-gambusinas/src/controllers/aprobacionController.js` | Enriquecer `ticket-imprimible` con hermanas de pedido |
| `appcocina/src/hooks/useTablaAprobacion.js` | Delegar impresión; pasar `comandasNumbers` completos |
| `backend-gambusinas/public/comandas.html` | `imprimirComanda(comanda, row)`, `imprimirGrupoComandas` |
| `gambusinas/services/comandaPrint/index.js` | Importar `imprimirComandaWeb` en rama web |

### No tocar (en esta iteración)

| Ruta | Motivo |
|------|--------|
| `gambusinas/utils/comandaPdfNative.js` | Solo móvil |
| `backend-gambusinas/public/bouchers.html` | Sigue siendo voucher fiscal, no comanda |
| Flag `mozos.botonImprimirComanda` | Solo afecta visibilidad en App Mozos |

---

## 11. Pruebas manuales sugeridas

1. **Misma comanda, tres superficies:** anotar `comandaId`, imprimir desde Mozos (web), Cocina y `comandas.html`; comparar PDF impreso o captura.
2. **PPA:** imprimir ticket adelantado desde bandeja Cocina; verificar moneda y método de pago.
3. **Plantilla:** ocultar bloque "Datos cliente" en editor de `comandas.html`; verificar que los tres reflejan el cambio tras guardar.
4. **Logo:** subir logo en plantilla; imprimir desde Cocina en tablet y desde dashboard en PC.
5. **Para llevar:** plato con `(P.L.)`, complementos y nota especial visibles.
6. **Grupo pedido (comandas.html):** mesa con 2 comandas en mismo `pedidoId`; imprimir subfila → `#81+#82`; imprimir header grupo → mismo resultado.
7. **Bandeja cocina:** ticket con `comandasNumbers: [81, 82]` → imprimir → `#81+#82` en ticket.
8. **Pago mozos mesa unida:** boucher con 2 comandas → ticket impreso `#81+#82`.
9. **Fallback:** simular 404 en `ticket-imprimible`; override desde UI sigue mostrando agrupación.
10. **Mozos móvil (regresión):** compartir PDF post-pago sigue abriendo sheet nativo con numeración agrupada.

---

## 12. Resumen para el desarrollador

**Hoy:** Mozos imprime bien vía `comandaPrint` + `comandaHtml` + wrapper 80 mm, pero el ticket suele mostrar **un solo** número aunque el pago agrupe varias comandas. Cocina y `comandas.html` reimplementaron el HTML a mano y además pierden la numeración agrupada.

**Mañana:** Un módulo `comandaPrintWeb` compartido; todos los botones 🖨️ delegan en él. El campo **Comanda** del ticket muestra `#81+#82` cuando el pedido, ticket o grupo tiene varias comandas (mesas unidas, agrupación por cliente/pedido). Una sola comanda sigue siendo `#81`.

**Regla de oro:** Si necesitas cambiar cómo se ve una comanda impresa (layout o numeración agrupada), editas **solo** `comandaHtml.js` (y el módulo se propaga a mozos web, cocina y dashboard).
