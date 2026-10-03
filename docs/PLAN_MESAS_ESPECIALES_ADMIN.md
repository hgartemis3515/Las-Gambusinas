# Plan — Mesas especiales (solo admin)

**Fecha:** 2 de octubre de 2026  
**Estado:** implementado (2 de octubre de 2026).  
**Alcance:** panel `mesas.html`, backend, app de mozos. Cocina solo muestra el nombre.

Una mesa especial se crea en el panel. En la tablet la ven todos, pero solo un usuario con rol `admin` puede usarla. Nace bloqueada. El admin autoriza el uso, pide comandas y, cuando el ciclo queda pagado por completo, la mesa vuelve a bloquearse.

---

## 1. Qué pide el negocio

| Regla | Comportamiento |
|-------|----------------|
| Quién la toma | Rol `admin`. Mozo, cajero, capitán y supervisor no abren pedido ni cobran descuento en esa mesa. |
| Dónde se crea | Modal Crear / Editar mesa de `public/mesas.html`. La tablet no crea mesas. |
| Nombre | Opcional. Si hay nombre, el número también puede ir vacío. Hace falta al menos uno de los dos. |
| Descuento | El descuento de admin solo se aplica a una mesa marcada con esa función. En una mesa normal el descuento queda rechazado, aunque el usuario sea admin. |
| Autorización | Antes de la primera comanda del ciclo, el admin confirma que la mesa se puede usar. |
| Bloqueo | Al pago total del ciclo (saldo cero, mesa en `pagado`) se bloquea sola. Un pago parcial no la bloquea. El siguiente uso pide otra autorización. |

Las cuatro funciones se marcan en el modal. Al activar «Mesa especial» quedan encendidas. Se pueden apagar una por una.

1. Solo administradores pueden usarla.
2. Recibe descuento de administrador.
3. Exige autorización para usarla.
4. Se bloquea al pago total.

---

## 2. Cómo está hoy

- La mesa exige `nummesa` numérico (`mesas.model.js`). El modal de `mesas.html` no deja guardar sin número (`guardarMesa`).
- Quién atiende una mesa en servicio lo decide `rechazoOtroMozo` en `accesoMesaMozo.js`, llamado al crear comanda en `comanda.repository.js`. No distingue mesas de admin.
- El descuento (`PUT /api/comanda/:id/descuento` y el de grupo) mira el permiso `aplicar-descuentos` o los roles admin/supervisor. No mira la mesa.
- La ficha de mesa en la tablet (`MesaAnimada` en `InicioScreen.js`) es un cuadrado de un solo color de estado (`MesaDestelloCaja`). El texto ya puede mostrar `nombre` o `nombreCombinado`, pero el modelo no guarda un nombre propio. Los apodos de `apodosMesa.js` viven en el dispositivo y no sirven como nombre oficial.
- La mesa pasa a `pagado` cuando el ciclo está cobrado y aprobado (`evaluarMesaListaParaLiberar` en `ticketAprobacion.repository.js`). Ese es el gancho del bloqueo.

---

## 3. Contrato

Campos nuevos en `mesas`:

```js
especial: { type: Boolean, default: false }
nombreMesa: { type: String, default: null, trim: true, maxlength: 24 }
funcionesEspeciales: {
  soloAdmin: { type: Boolean, default: false },
  permiteDescuentoAdmin: { type: Boolean, default: false },
  requiereAutorizacion: { type: Boolean, default: false },
  bloquearAlPagoTotal: { type: Boolean, default: false }
}
usoEspecial: {
  bloqueada: { type: Boolean, default: false },
  autorizadaPor: { type: ObjectId, ref: 'mozos', default: null },
  autorizadaEn: { type: Date, default: null }
}
```

`nummesa` deja de ser obligatorio si `especial` es true y `nombreMesa` tiene texto. El índice único sigue siendo `{ nummesa, area }` y no aplica cuando no hay número (índice parcial: `nummesa` existe).

Etiqueta visible, en este orden: `nombreMesa`, si no `nombreCombinado`, si no `M{nummesa}`.

Al crear o al marcar especial: `usoEspecial.bloqueada = true` si `requiereAutorizacion` o `bloquearAlPagoTotal`.

### API

| Método | Ruta | Quién | Efecto |
|--------|------|-------|--------|
| POST/PUT | `/api/mesas` | Quien ya edita mesas en el panel | Guarda `especial`, `nombreMesa`, `funcionesEspeciales`. Valida nombre o número. |
| POST | `/api/mesas/:id/autorizar-uso` | JWT rol `admin` | Si la mesa es especial y exige autorización: `bloqueada=false`, guarda admin y fecha. Emite `mesa-actualizada`. |
| POST comanda | creación actual | Backend | Rechaza 403 si la mesa es especial y falla una regla de abajo. |
| PUT | `/api/comanda/:id/descuento` y descuento de grupo | Admin con `aplicar-descuentos` | 403 si la mesa no tiene `permiteDescuentoAdmin`. |

Reglas al crear comanda (también si `origenCreacion === 'dashboard'`):

- `funcionesEspeciales.soloAdmin` y el actor no es rol `admin` → 403 «Solo un administrador puede usar esta mesa».
- `requiereAutorizacion` y `usoEspecial.bloqueada` → 403 «Un administrador debe autorizar el uso de esta mesa».
- Autorizada y el actor es admin → se permite. Las comandas siguientes del mismo ciclo no piden otra autorización.

Bloqueo: en el mismo sitio que hoy pone la mesa en `pagado` por ciclo cobrado, si `bloquearAlPagoTotal`, poner `usoEspecial.bloqueada = true` y limpiar `autorizadaPor` / `autorizadaEn`. Liberar la mesa desde el panel también la deja bloqueada. Un pago parcial no toca `usoEspecial`.

Socket: reutilizar `mesa-actualizada` (rooms ya existentes). Sin evento nuevo y sin poll.

Auditoría: `MESA_ESPECIAL_AUTORIZADA` y `MESA_ESPECIAL_BLOQUEADA` (mesa, admin, motivo `pago_total` o `liberacion`).

Una mesa especial no se junta con otras. `POST /mesas/juntar` la rechaza.

---

## 4. Panel (`mesas.html`)

En el modal Crear / Editar, debajo de Notas:

- Casilla **Mesa especial**.
- Si está marcada, casillas de las cuatro funciones (las cuatro activas al marcarla).
- Campo **Nombre de mesa** (opcional, máx. 24). El número deja de ser obligatorio si hay nombre.
- En la grilla, una pastilla «Especial» y el nombre junto al número.

`guardarMesa` manda los campos nuevos. Sigue avisando si el número ya existe en el local.

---

## 5. App de mozos (Tab A11)

La ficha sigue siendo un toque (toda la tarjeta, ≥ 48 px). El color de estado se mantiene. Encima, una **barra de dos colores** de unos 8 px: mitad oro `#D4AF37` y mitad vino `#7A1F2B`, de borde a borde. Así se distingue de las mesas de un solo color sin tapar el nombre.

- Nombre en una línea, recortado. Si no hay nombre, `M{número}`.
- Bloqueada: la misma barra y un candado chico. El color de estado sigue siendo el de libre.
- En servicio: barra duo más el color de estado de siempre.

Toques:

| Quién | Mesa | Qué pasa |
|-------|------|----------|
| Mozo u otro rol | Especial | Aviso corto «Mesa de administrador». No abre pedido. |
| Admin | Bloqueada | Una hoja: nombre, botón **Autorizar uso** (~56 px) y Cancelar. Al autorizar, la ficha se actualiza al momento y sigue el camino normal de nueva orden. |
| Admin | Ya autorizada | Igual que una mesa normal: pedido, cobro, descuento. |

El botón Descuento de `ComandaDetalleScreen` solo se muestra si el usuario es admin y la mesa de la comanda tiene `permiteDescuentoAdmin`. En cualquier otra mesa el botón no aparece.

Los apodos locales no sustituyen `nombreMesa`.

---

## 6. Cocina

No autoriza, no bloquea y no pinta la barra duo. En KDS, ticket e impresión la mesa sale con `nombreMesa` (o el número si no hay nombre), para que un `nummesa` vacío no pinte «Mundefined». Mismos puntos: `nombreMesaKds` y el texto de mesa en comanda/impresión.

---

## 7. Fases

1. **Backend.** Campos, validación al crear/editar, autorización, rechazo al crear comanda, bloqueo al pasar a `pagado`, rechazo de descuento fuera de mesa especial, no juntar. Pruebas en `acceso-mesa-mozo` y un caso de descuento.
2. **Panel.** Casillas y nombre en el modal; pastilla en la lista.
3. **Mozos.** Barra duo, candado, hoja de autorización, aviso al mozo, descuento solo en esa mesa.
4. **Cocina.** Etiqueta con nombre.

El backend de la fase 1 ya niega el uso aunque la tablet todavía no tenga la hoja: la regla no depende de la UI.

---

## 8. Pruebas

- Mesa normal: número obligatorio, cualquier mozo la toma, descuento de admin rechazado.
- Mesa especial sin número y con nombre: se crea, se ve el nombre en tablet y en KDS.
- Mozo toca mesa especial: no crea comanda (403).
- Admin sin autorizar: 403. Tras autorizar: crea comanda. Segunda comanda del mismo ciclo: no pide otra autorización.
- Pago parcial: sigue autorizada. Pago total: `bloqueada` y hace falta autorizar de nuevo.
- Descuento de admin en mesa especial: aplica. En mesa normal: 403. Supervisor en mesa especial: 403.
- Juntar una mesa especial: rechazo.

---

## 9. Fuera de este plan

- Crear la mesa desde la tablet.
- Darle la mesa a supervisor, cajero o capitán.
- Un permiso nuevo de usuario: el rol `admin` alcanza. La función vive en la mesa.
- Cambiar colores de estado o el mapa del salón más allá de la barra duo en la vista de tarjetas. En la vista mapa, la misma barra o un borde duo, sin redibujar el plano.
