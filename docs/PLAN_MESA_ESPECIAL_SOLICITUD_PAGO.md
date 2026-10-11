# Plan — Solicitud de pago en mesa especial

**Fecha:** 8 de octubre de 2026
**Estado:** implementado.

En una mesa especial, cualquier solicitud de pago cobra **toda** la cuenta pendiente y deja la mesa en **Pendiente de aprobación**. No queda en Entregado ni como abono parcial.

## Regla

| Paso | Qué pasa |
|------|----------|
| Mozo pide el pago | El backend ignora el monto parcial y toma todas las comandas entregadas de esa mesa. |
| Cobro | Un solo ticket por el saldo completo. No es abono. |
| Mesa | Pasa a `pendiente_aprobar`. En la tablet se lee Pendiente de aprobación. |
| Cocina | Cobra ese ticket. Recién ahí la mesa puede quedar pagada. |
| Mesa normal | Sigue pudiendo cobrar por partes. |

## Por qué se veía Entregado

Con cobro por cantidad, un monto menor al saldo se guardaba como abono: había boucher, no había ticket de aprobación y la mesa seguía `entregado`. La tarjeta entonces pintaba Entregado.

## Dónde

- Backend: `boucherPagoService.procesarPagoBoucher` si `mesa.especial`.
- Mozos: `InicioScreen.getEstadoMesa` no pinta Entregado en una especial con platos ya entregados; el toque abre el cobro mientras el estado real aún no es `pendiente_aprobar`.
