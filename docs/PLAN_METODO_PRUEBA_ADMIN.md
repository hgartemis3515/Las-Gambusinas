# Plan — Método "PRUEBA" (solo admin)

**Fecha:** 3 de octubre de 2026
**Estado:** plan. Fase 1 implementada (3 de octubre de 2026). Fase 2 (chips en Supervisor y Ver Cocina Completo) pendiente.
**Alcance:** app de mozos, backend, app cocina, panel `comandas.html`.

El admin puede marcar una orden nueva como **PRUEBA** desde "Nueva orden" (debajo del total). La comanda se prueba en cocina sin cobro: monto 0 en todas las pantallas, etiqueta **PRUEBA** en KDS, ver cocina completo, tabla de tickets y pagos adelantados, `comandas.html` y vista supervisor.

---

## 1. Qué pide el negocio

| Regla | Comportamiento |
|-------|----------------|
| Quién | Solo `admin` ve el botón y puede autorizarlo. El backend rechaza 403 a cualquier otro rol. |
| Dónde | App de mozos, Nueva orden, debajo del total. Toque → confirmación (autorización). |
| Monto | Siempre **0**: subtotal, IGV, total, tickets, comandas.html y reportes. |
| Pago | No hay solicitud de cobro. La comanda se cierra sola como `pagado` al entregar (mecanismo `omitirPago`). |
| Etiqueta | **PRUEBA** visible en: tabla KDS (Vista General y Personalizada), Ver Cocina Completo, tabla de tickets y pagos adelantados, `comandas.html` y Vista Supervisor. |
| Mesa especial | Una comanda PRUEBA **no** dispara el bloqueo `pago_total` de la mesa especial (no es un pago real). |

---

## 2. Contrato

Campo nuevo en `comandas`:

```js
esPrueba: { type: Boolean, default: false, index: true }
```

Campo nuevo en `ticketaprobacion` (los tickets de alta de comandas PRUEBA):

```js
esPrueba: { type: Boolean, default: false }
```

Reglas al crear comanda con `esPrueba: true` (solo si el actor JWT es `admin`):

- Snapshot de platos con `precio: 0` y `precioUnitario: 0` → todo monto derivado (subtotal, IGV, `totalCalculado`, tickets, bouchers, reportes, cierre de caja) sale 0 sin tocar cada pantalla.
- `omitirPago: true` + `pagoOmitido: { motivo: 'PRUEBA', usuarioId }` → al entregar todos los platos, la comanda cierra como `pagado` sin boucher (ya existente en `actualizarComandaSiTodosEntregados`).
- El alta del ticket **no se omite** (`comandaOmiteTicketAlta` devuelve `false` si `esPrueba`): la comanda PRUEBA aparece en la tabla de tickets y pagos adelantados con monto 0 y chip PRUEBA.
- El ticket lleva `esPrueba: true` → cocina puede aprobarlo **sin boucher** (`ticketPuedeAprobarse` acepta `esPrueba`); el botón "Cobrar" cobra 0.
- Al aprobar: los platos pasan al KDS normal. Si el ciclo queda libre la mesa pasa a `pagado`, pero **sin** `bloquearMesaEspecial('pago_total')` cuando el ticket es PRUEBA.

Flujo completo:

```
Admin (Nueva orden) → PRUEBA (confirmar) → totales 0 → Enviar
  → comanda { esPrueba, platos precio 0, omitirPago } , mesa 'pedido'
  → Ticket PRUEBA (0) en Tabla tickets y pagos adelantados [chip PRUEBA]
  → Cocina "Cobrar" (0, sin boucher) → platos entran al KDS [chip PRUEBA]
  → Cocina cocina y entrega → mozo entrega en la tablet
  → comanda cierra 'pagado' sola (omitirPago) → mesa se libera
```

Socket: sin eventos nuevos. Reutiliza `ticket-aprobacion-nuevo`, `comanda-aprobada` y `mesa-actualizada`.

Auditoría: `COMANDA_PRUEBA_CREADA` (comanda, admin, mesa) y el auto-cierre ya registra `COMANDA_OMITIR_PAGO_AUTO_PAGADO` con motivo PRUEBA.

---

## 3. API

| Ruta | Cambio |
|------|--------|
| `POST /api/comanda` | Acepta `esPrueba: true` solo si el JWT es rol `admin`; si no, 403. |
| `GET` KDS (`vistaCocina` / activas / para-pagos) | `esPrueba` viaja en el select/proyección de comandas para que cocina pinte el chip. |

---

## 4. App de mozos (Tab A11)

- Botón **PRUEBA** dentro del bloque de totales, debajo del TOTAL. Solo visible si `userInfo.rol === 'admin'`. Toque ≥ 48 px, un paso: toque → confirmación → activado.
- Activado: los tres montos (Subtotal, IGV, TOTAL) muestran 0 y el botón queda en estado activo con etiqueta "PRUEBA ACTIVA"; un segundo toque lo desactiva (con confirmación).
- Al enviar: `comandaData.esPrueba: true`. Al terminar el envío se desactiva el modo.
- `ComandaDetalleScreen`: chip **PRUEBA** junto al número de comanda cuando alguna comanda del ciclo tiene `esPrueba`. El botón Pagar queda oculto (los platos valen 0 → camino de costo cero → "Liberar").

---

## 5. App cocina

- `HeaderTarjetaComandaKds` (usado por Vista General `comandastyle.jsx` y Vista Personalizada `ComandastylePerso.jsx`): chip **PRUEBA** junto al número de comanda cuando `comanda.esPrueba`.
- `TicketsPpaPage` + `TicketsAprobacionTable`: chip **PRUEBA** junto al tipo, monto 0 (ya sale 0 por el snapshot) y botón "Cobrar" habilitado sin boucher (`ticketPuedeAprobarse` de `ticketAprobacionUi.js` acepta `esPrueba`).
- **Ver Cocina Completo** (monitor `CocinaMonitorLayout` → `CocineroPlatoCard`, cubre Completo y Personalizado): chip **PRUEBA** en el pie de la tarjeta junto a las mesas; la tarjeta lo muestra si algún plato del grupo pertenece a una comanda PRUEBA (`platos[].comanda.esPrueba` de la proyección KDS).
- **Fase 2 (pendiente):** chip en Vista Supervisor (`ComandaStyleSupervi.jsx`) — su render es por plato y no usa `CocineroPlatoCard`; llevar `esPrueba` a sus filas de plato.

---

## 6. Panel (`comandas.html`)

- Fila de comanda: pastilla **PRUEBA** junto al número/mesa cuando `c.esPrueba`. El monto mostrado ya sale 0 por el snapshot.

---

## 7. Pruebas

- Mozo (no admin) no ve el botón; si fuerza el POST con `esPrueba`, backend responde 403.
- Admin activa PRUEBA: totales 0 en la orden; la comanda creada tiene platos con precio 0 y `totalCalculado` 0.
- El ticket PRUEBA aparece en la tabla con chip PRUEBA y monto 0; cocina lo aprueba sin boucher.
- Los platos entran al KDS con chip PRUEBA (Vista General y Personalizada) y monto 0.
- `comandas.html` muestra la pastilla PRUEBA y monto 0.
- Al entregar: comanda `pagado` sola, sin boucher; la mesa especial NO se bloquea aunque tenga la casilla.
- Reports y cierre de caja: las comandas PRUEBA suman 0.

## 8. Fuera de este plan

- Borrar/comandar comandas PRUEBA en lote (las comandas de prueba se liberan como cualquier otra).
- PRUEBA desde el dashboard (`comandas.html` crear comanda) — el contrato lo permite (mismo POST), la UI del panel no lo expone aún.