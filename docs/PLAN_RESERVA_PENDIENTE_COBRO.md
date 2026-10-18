# Reserva pendiente de cobro

La reserva creada en App Mozos no entra a cocina hasta que caja la cobra. Caja tiene 1 hora.

## Regla

1. El mozo crea la reserva. Queda en **Pendiente de Cobro** y nace un ticket en **Tablas de tickets y pagos adelantados**.
2. En esa pantalla el mozo ve un cronómetro de **60 minutos** (`fechaLimiteCobro`).
3. Si caja no cobra dentro de esa hora, el servidor anula la reserva y la comanda con el motivo **Reserva no cobrada**. La mesa vuelve a libre y el ticket sale de la bandeja.
4. Mientras no esté cobrada, no aparece en cocina: ni en la tabla de comandas imprimibles, ni en Reservadas, ni en el KDS.
5. Cuando caja cobra el ticket, se corta el cronómetro y sigue el flujo que ya existía: mesa reservada, activación a `fechaCocina` y entrada a cocina.

El cobro es la aprobación del ticket de la reserva. No es un rechazo de cocina.

## Dónde vive

| Pieza | Qué hace |
| --- | --- |
| `reserva.fechaLimiteCobro` | Hora límite, 60 min después de crear |
| `anularReservaNoCobrada` | Cancela reserva, comanda (`motivoEliminacion`) y ticket |
| `timeoutService.programarLimiteCobro` | Job de la hora. Se reprograma al reiniciar el servidor |
| Barrido cada 30 s | Cubre reservas viejas sin el job en memoria |
| App Mozos | Etiqueta **Pendiente de Cobro** y cronómetro en la espera, la tarjeta y el mapa |
| `GET /vista-cocina/reservadas` | Solo estado `pendiente` (ya cobrada) |
| `GET /aprobacion/comandas-imprimibles` | Excluye reservas en `pendiente_aprobar` |

Hasta que caja cobra, no se programan el no-show ni el bloqueo de mesa. Esos jobs arrancan en `confirmarReservaTrasAprobacionPPA`.

## Aviso en el KDS

Cuando la reserva ya está cobrada y su comanda todavía no entra a cocina (sigue en Reservadas):

1. El botón **Reserva** de Ver Comandas parpadea.
2. Al aparecer, y luego **cada 30 minutos**, sale una notificación: comanda, mesa y hora en que está disponible (`fechaCocina`).
3. En ese mismo momento suena el timbre configurado del KDS.
4. Al enviarse a cocina desaparece de Reservadas: se apaga el parpadeo y se cortan los avisos.
