# Verificación — Pagos adelantados (PPA) vs estado de la comanda

**Fecha:** 26 agosto 2026  
**App:** Mozos (`gambusinas`) + backend (`POST /pago-adelantado`)  
**Relacionado:** [PLAN_PAGOS_ADELANTADOS.md](./PLAN_PAGOS_ADELANTADOS.md) (plan de implementación; el §4 de ese doc está desactualizado)

---

## 1. Pregunta

¿Con el código actual se puede hacer **pago adelantado** sobre una comanda, y los estados (plato / comanda / mesa) son consistentes?

**Respuesta corta:** **sí, en el caso feliz** (comanda activa `en_espera` / `recoger`, platos en `pedido` o `en_espera`, sin TPA previo). **No está alineado al 100%** con las reglas del plan: el botón puede aparecer (o el GET devolver comandas) en estados donde el `POST` rechaza, o sobre platos que ya no deberían cobrarse por PPA (`salio`, `pendiente`).

---

## 2. Flujo real (mozos)

```
ComandaDetalle
  → botón violeta "Pago Adelantado" si getReglasBotonesComandaDetalle().mostrarPagoAdelantado
  → GET /comanda/comandas-para-pago-adelantado/:mesaId
  → navigate Pagos (origen: 'PagoAdelantado')
  → ModalClientes (método de pago) → POST /pago-adelantado
  → boucher + TicketPagoAdelantado (pendiente_aprobacion)
  → plato.pagoAdelantado { cobrado, estadoTicket: pendiente_aprobacion }
  → mesa.estado = pendiente_pago
  → Alert "Esperando aprobación de cocina" → Inicio
```

Pago **normal** (botón Pagar) es otro camino: `POST /boucher` → platos a `pendiente` → mesa `pendiente_aprobar` → cocina aprueba ticket → `pagado`. No mezclar con PPA.

---

## 3. Cuándo SÍ se puede (contrato efectivo)

| Capa | Condición |
|------|-----------|
| **Comanda** | `IsActive`, status **no** `pagado`/`completado` en el GET. El **POST** solo busca status `en_espera` \| `pedido` \| `recoger`. |
| **Plato** | No `eliminado`/`anulado`. Estado **no** `recoger` / `entregado` / `pagado`. Sin `pagoAdelantado.estadoTicket` `pendiente_aprobacion` o `aprobado`. |
| **Mesa** | Ciclo de servicio con comandas activas (`getComandasActivasPorMesa`). |
| **Composición** | `solo_para_llevar`: solo PPA (Pagar clásico deshabilitado). `solo_mesa` / `mixta`: PPA opcional + Pagar cuando todos están `entregado`/`pagado`. |

Estados de **plato** (mapa): `pendiente` → `pedido` → `en_espera` → `recoger` → `salio` → `entregado` → `pagado`.  
Estados de **comanda**: `en_espera` \| `recoger` \| `salio` \| `entregado` \| `pagado` \| `cancelado` \| `pendiente_aprobar` \| `completado`.

Tras PPA, la mesa pasa a **`pendiente_pago`** (no `pendiente_aprobar`). Eso es correcto: cocina aprueba un **TPA**, no el ticket de pago normal.

---

## 4. Desalineaciones (código vs plan vs POST)

Regla 2 del plan: elegibles solo `para_llevar` en `pedido`, o `mesa` en `pedido`/`en_espera`. Excluye `recoger` / `entregado` / `pagado`.

### 4.1 Helper mozos (`pagoAdelantadoHelpers.js`)

`esPlatoElegibleParaPPA` **no** mira `tipoServicio` y **no** excluye `salio` ni `pendiente`. Cualquier plato que no sea recoger/entregado/pagado y no tenga TPA cuenta. El botón PPA puede salir con platos ya salidos de cocina o ya cobrados en pago normal (`pendiente`).

### 4.2 GET mozos vs POST backend

| | GET `/comandas-para-pago-adelantado` | POST `/pago-adelantado` (`getComandasParaPagoAdelantado`) |
|--|--|--|
| Status comanda | `$nin: ['pagado','completado']` (incluye `salio`, `entregado`, `pendiente_aprobar`) | `$in: ['en_espera','pedido','recoger']` |
| Filtro plato | Igual al helper (no excluye `salio`/`pendiente`) | Igual (tampoco excluye `salio`/`pendiente`) |

Efecto: el mozo puede entrar a Pagos con origen PPA y el POST responder **«No hay comandas elegibles para pago adelantado»** si la comanda ya está en `salio` / `entregado` / `pendiente_aprobar`.

### 4.3 Lista en PagosScreen (modo PPA)

`listarPlatosEnPantallaPago(..., true)` muestra `pedido` y `en_espera` (correcto para PPA). No lista `salio`. Si el GET mete una comanda `salio` con líneas aún en `pedido`, esas líneas sí aparecen.

### 4.4 Tras confirmar PPA

- No abre modal de propina (Alert → Inicio). Coherente: la mesa no está `pagado`.
- Platos para llevar se dejan en `pedido` hasta aprobar TPA. Mesa `pendiente_pago`.
- `solo_para_llevar`: el POST no cambia `status` de comanda (sigue `en_espera` en la práctica; el comentario habla de `pedido`, que **no** está en el enum de comanda).

---

## 5. Veredicto por escenario

| Escenario | ¿PPA viable? | Notas |
|-----------|--------------|--------|
| Comanda nueva `en_espera`, platos `pedido`/`en_espera` | **Sí** | Camino soportado. |
| Solo para llevar, aún no cobrados | **Sí** (obligatorio; Pagar está off) | |
| Mixta: llevar en `pedido` + mesa ya en cocina | **Sí** para los elegibles | POST OK si comanda sigue `en_espera`/`recoger`. |
| Plato ya `recoger`/`entregado`/`pagado` | **No** | Correcto; usar Pagar / parcial. |
| Comanda `salio` con resto sin cobrar | **UI puede sí, POST no** | Gap. Unificar filtro de status. |
| Plato `pendiente` (pago normal, ticket cocina) | **Helper lo trata como elegible** | Gap: no debe re-cobrarse por PPA. |
| Plato con TPA pendiente/aprobado | **No** | Correcto. |
| Mesa ya `pendiente_aprobar` (pago normal hecho) | GET puede listar; POST no | Gap. |

---

## 6. Plan de corrección (cuando se implemente)

Prioridad: alinear **una** función de elegibilidad y usarla en helper mozos, GET y POST.

1. **Excluir platos** `salio`, `pendiente` (y `pendiente_aprobar` si aparece en línea). Opcional: exigir `pedido` \| `en_espera` como el plan.
2. **POST y GET:** mismas comandas. Propuesta: status `$in: ['en_espera', 'recoger']` (el status `pedido` de comanda no existe en el enum actual).
3. Si no hay elegibles, **ocultar** el botón (el helper ya lo hace si se corrige 1).
4. Si el GET queda vacío, no navegar a Pagos.
5. Tests: helper + `getComandasParaPagoAdelantado` con comanda `salio` y plato `pendiente`.

Fuera de este plan: retención KDS de `para_llevar` al crear comanda (Regla 3 del plan original); no se re-audita aquí.

---

## 7. Criterios de aceptación (cuando se cierre el gap)

- [ ] Botón PPA solo si hay ≥1 plato `pedido` o `en_espera` sin TPA, comanda `en_espera` o `recoger`.
- [ ] GET y POST devuelven / aceptan el mismo conjunto.
- [ ] Plato `pendiente` (pago normal) no aparece en PPA.
- [ ] `solo_para_llevar` sigue sin botón Pagar clásico.
- [ ] Tras PPA: boucher + TPA, mesa `pendiente_pago`, cocina recibe `ticket-ppa-nuevo`.

---

## 8. Archivos de referencia

| Archivo | Rol |
|---------|-----|
| `gambusinas/helpers/pagoAdelantadoHelpers.js` | Botón y elegibilidad UI |
| `gambusinas/Pages/ComandaDetalleScreen.js` | `handlePagoAdelantado`, botones |
| `gambusinas/Pages/navbar/screens/PagosScreen.js` | `origen === 'PagoAdelantado'` |
| `gambusinas/utils/pagoParcialHelpers.js` | Lista/cobrables en Pagos |
| `backend-gambusinas/src/controllers/comandaController.js` | GET comandas PPA |
| `backend-gambusinas/src/repository/ticketPagoAdelantado.repository.js` | POST: query de comandas |
| `backend-gambusinas/src/controllers/pagoAdelantadoController.js` | Crear TPA + mesa `pendiente_pago` |
