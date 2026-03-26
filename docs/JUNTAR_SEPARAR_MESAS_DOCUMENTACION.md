# Documentacion: Juntar y Separar Mesas
## Sistema Las Gambusinas - Backend v2.8 | App Mozos v2.2

---

## Tabla de Contenidos
1. [Resumen de Implementacion](#1-resumen-de-implementacion)
2. [Cambios en el Backend](#2-cambios-en-el-backend)
3. [Cambios en la App de Mozos](#3-cambios-en-la-app-de-mozos)
4. [Eventos Socket.io](#4-eventos-socketio)
5. [Sistema de Permisos](#5-sistema-de-permisos)
6. [Flujos de Uso](#6-flujos-de-uso)

---

## 1. Resumen de Implementacion

Se implemento la funcionalidad de juntar y separar mesas siguiendo el diseno arquitectonico especificado. La solucion permite a usuarios autorizados combinar multiples mesas en un grupo (usando la mesa de menor numero como principal) y separarlas posteriormente.

### Archivos Modificados/Creados

**Backend (6 archivos):**
- `src/database/models/mesas.model.js` - Nuevos campos en schema
- `src/repository/mesas.repository.js` - Funciones de negocio
- `src/controllers/mesasController.js` - Endpoints API
- `src/socket/events.js` - Eventos WebSocket
- `src/database/models/roles.model.js` - Nuevo permiso

**App Mozos (4 archivos):**
- `Pages/navbar/screens/InicioScreen.js` - UI completa
- `context/SocketContext.js` - Handlers de eventos
- `hooks/useSocketMozos.js` - Listeners de eventos

---

## 2. Cambios en el Backend

### 2.1 Modelo de Datos (`mesas.model.js`)

Se agregaron 6 nuevos campos al schema de mesas:

```javascript
// ========== CAMPOS PARA GRUPOS DE MESAS (Juntar/Separar) ==========

esMesaPrincipal: {
    type: Boolean,
    default: true,
    required: true
},
// true = mesa independiente o principal de un grupo
// false = mesa secundaria que esta unida a otra

mesaPrincipalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'mesas',
    default: null
},
// Si esMesaPrincipal=false, apunta a la mesa que es la principal

mesasUnidas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'mesas'
}],
// Array de mesas secundarias (solo tiene datos si esMesaPrincipal=true)

fechaUnion: {
    type: Date,
    default: null
},
// Timestamp de cuando se creo el grupo

unidoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'mozos',
    default: null
},
// Usuario que ejecuto la accion de juntar

motivoUnion: {
    type: String,
    default: null
}
// Nota opcional (ej: "grupo familiar grande")

nombreCombinado: {
    type: String,
    default: null
}
// Nombre combinado compacto para mesas juntadas (ej: "M1,2" o "M5,6,7,8")
```

### 2.2 Indices Agregados

```javascript
// INDICE 3: Mesas que son principales de grupo
mesasSchema.index(
    { esMesaPrincipal: 1, isActive: 1 },
    { name: 'idx_mesa_principal' }
);

// INDICE 4: Buscar mesas secundarias por su mesa principal
mesasSchema.index(
    { mesaPrincipalId: 1 },
    { name: 'idx_mesa_principal_ref' }
);
```

### 2.3 Repository (`mesas.repository.js`)

#### Funcion: `juntarMesas(mesasIds, mozoId, motivo)`

**Validaciones implementadas:**
- Cantidad de mesas: minimo 2, maximo 6
- Todas las mesas deben estar activas
- Todas deben pertenecer a la misma area
- Estados permitidos: solo 'libre' o 'esperando'
- Ninguna puede estar ya unida (esMesaPrincipal=false)
- Ninguna puede ser principal con mesas unidas (evitar uniones anidadas)
- No debe haber Pedidos abiertos en ninguna mesa

**Algoritmo:**
1. Ordenar mesas por numero ascendente
2. La de menor numero se convierte en principal
3. Generar nombreCombinado (ej: "Mesa 1 y Mesa 2")
4. Actualizar secundarias: esMesaPrincipal=false, mesaPrincipalId=principal, estado='ocupada'
5. Actualizar principal: mesasUnidas=[secundarias], nombreCombinado, estado='libre'
6. Emitir eventos Socket
7. Registrar auditoria

#### Funcion: `separarMesas(mesaPrincipalId, mozoId, motivo)`

**Validaciones:**
- La mesa debe existir
- Debe ser mesa principal (esMesaPrincipal=true)
- Debe tener mesasUnidas no vacio

**Logica de estados post-separacion:**
- Si principal en 'esperando' o 'libre' → todas quedan 'libre'
- Si principal en 'pedido', 'preparado', etc. → principal mantiene estado, secundarias quedan 'libre'

#### Funcion: `obtenerMesasAgrupadas()`

Retorna informacion de todos los grupos de mesas activos para UI.

#### Funcion: `obtenerMesaConGrupo(mesaId)`

Retorna una mesa con informacion completa de su grupo si pertenece a uno.

### 2.4 Controller (`mesasController.js`)

#### Nuevos Endpoints

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/mesas/juntar` | Junta varias mesas en un grupo |
| POST | `/api/mesas/separar` | Separa mesas previamente juntadas |
| GET | `/api/mesas/grupos` | Lista todas las mesas agrupadas |
| GET | `/api/mesas/:id/grupo` | Obtiene una mesa con info de su grupo |

#### Ejemplo Request: Juntar Mesas

```json
POST /api/mesas/juntar
{
    "mesasIds": ["ObjectId1", "ObjectId2", "ObjectId3"],
    "motivo": "Grupo familiar grande"
}
```

#### Ejemplo Response

```json
{
    "success": true,
    "message": "Mesas juntadas: Mesa 5 como principal",
    "mesaPrincipal": {
        "_id": "...",
        "nummesa": 5,
        "esMesaPrincipal": true,
        "mesasUnidas": ["ObjectId2", "ObjectId3"],
        "nombreCombinado": "M5,6,7",
        "estado": "libre"
    },
    "mesasSecundarias": [...],
    "todaslasmesas": [...]
}
```

---

## 3. Cambios en la App de Mozos

### 3.1 Nuevos Estados (`InicioScreen.js`)

```javascript
// Estados para juntar/separar mesas
const [modoSeleccion, setModoSeleccion] = useState(false);
const [mesasSeleccionadas, setMesasSeleccionadas] = useState([]);
const [modalJuntarVisible, setModalJuntarVisible] = useState(false);
const [modalSepararVisible, setModalSepararVisible] = useState(false);
const [motivoUnion, setMotivoUnion] = useState("");
const [procesandoAccion, setProcesandoAccion] = useState(false);
const [tienePermisoJuntarSeparar, setTienePermisoJuntarSeparar] = useState(false);
```

### 3.2 Funciones Helper

#### `mesaEstaEnGrupo(mesa)`
Verifica si una mesa pertenece a un grupo (es principal o secundaria).

#### `obtenerGrupoMesa(mesa)`
Retorna informacion completa del grupo de una mesa:
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
Valida todas las condiciones del diseno y retorna:
```javascript
{ valido: boolean, mensaje: string }
```

### 3.3 Funciones de Accion

#### `juntarMesas()`
- Valida condiciones con `puedeJuntarMesas()`
- Llama `POST /api/mesas/juntar`
- Actualiza UI y muestra alerta de exito

#### `separarMesas(mesaPrincipalId)`
- Valida permisos y estado
- Llama `POST /api/mesas/separar`
- Actualiza UI

### 3.4 Componente MesaAnimada Actualizado

Nuevas props:
```javascript
modoSeleccion={boolean}        // Activa modo seleccion multiple
estaSeleccionada={boolean}     // Mesa esta en la seleccion actual
esMesaPrincipal={boolean}      // Es principal o secundaria
mesasUnidas={[ObjectId]}       // Array de mesas unidas
mesaPrincipalNum={number}      // Numero de mesa principal (si es secundaria)
formatearGrupo={string}        // Texto formateado del grupo
```

#### Nuevos elementos visuales:
1. **Checkbox animado** cuando `modoSeleccion=true`
2. **Badge de grupo**:
   - Azul: Mesa principal con mesas unidas (`+N`)
   - Morado: Mesa secundaria (`M5`)
3. **Borde coloreado** segun estado de grupo

### 3.5 UI Nueva

#### Barra Flotante de Seleccion
- Aparece cuando `modoSeleccion=true`
- Muestra contador de mesas seleccionadas
- Boton "Juntar" (si cumple condiciones)
- Boton "Cancelar"

#### Modal de Juntar Mesas
- Lista de mesas seleccionadas
- Mesa principal destacada con badge
- Campo de nota opcional
- Boton confirmar/cancelar

#### Modal de Separar Mesas
- Informacion de la mesa principal
- Lista de mesas unidas
- Advertencia si hay comandas activas
- Campo de motivo opcional

### 3.6 Botones Sidebar Actualizados

- **Juntar Mesas**: Toggle del modo seleccion (muestra "Cancelar" cuando activo)
- **Separar Mesas**: Solo visible si hay grupos activos
- Deshabilitados si no tiene permiso `juntar-separar-mesas`

---

## 4. Eventos Socket.io

### 4.1 Nuevos Eventos

| Evento | Namespace | Direccion | Datos |
|--------|-----------|-----------|-------|
| `mesas-juntadas` | /mozos, /admin, /cocina | Server → Client | `{ mesaPrincipal, mesasSecundarias, mozoId, totalMesas, timestamp }` |
| `mesas-separadas` | /mozos, /admin, /cocina | Server → Client | `{ mesaPrincipal, mesasSecundarias, mozoId, totalMesasLiberadas, timestamp }` |

### 4.2 Funciones Emisoras (`events.js`)

#### `global.emitMesasJuntadas(mesaPrincipal, mesasSecundarias, mozoId)`

```javascript
const eventData = {
    mesaPrincipal: mesaPrincipal,
    mesasSecundarias: mesasSecundarias,
    mozoId: mozoId?.toString(),
    totalMesas: 1 + (mesasSecundarias?.length || 0),
    timestamp: moment().tz('America/Lima').toISOString()
};

mozosNamespace.emit('mesas-juntadas', eventData);
adminNamespace.emit('mesas-juntadas', eventData);
cocinaNamespace.emit('mesas-juntadas', eventData);
```

#### `global.emitMesasSeparadas(mesaPrincipal, mesasSecundarias, mozoId)`

Similar estructura, emite a los tres namespaces.

### 4.3 Handlers en App Mozos

#### `SocketContext.js`
```javascript
const [eventHandlers, setEventHandlers] = useState({
    // ... handlers existentes
    onMesasJuntadas: null,
    onMesasSeparadas: null
});

const handleMesasJuntadas = useCallback((data) => {
    if (eventHandlersRef.current.onMesasJuntadas) {
        eventHandlersRef.current.onMesasJuntadas(data);
    }
}, []);
```

#### `useSocketMozos.js`
```javascript
socket.on('mesas-juntadas', (data) => {
    console.log('🔗 [MOZOS] Mesas juntadas recibido:', data);
    
    // Notificar cambio de estado
    if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
    }
    
    // Actualizar mesa principal
    if (onMesaActualizada && data.mesaPrincipal) {
        onMesaActualizada(data.mesaPrincipal);
    }
    
    // Actualizar mesas secundarias
    if (onMesaActualizada && data.mesasSecundarias) {
        data.mesasSecundarias.forEach(mesa => {
            onMesaActualizada(mesa);
        });
    }
});
```

#### Suscripcion en `InicioScreen.js`
```javascript
subscribeToEvents({
    onMesaActualizada: handleMesaActualizada,
    onComandaActualizada: handleComandaActualizada,
    onNuevaComanda: handleNuevaComanda,
    onMesasJuntadas: (data) => {
        console.log('🔗 [INICIO] Evento mesas-juntadas recibido:', data);
        obtenerMesas(); // Recargar mesas
    },
    onMesasSeparadas: (data) => {
        console.log('🔗 [INICIO] Evento mesas-separadas recibido:', data);
        obtenerMesas(); // Recargar mesas
    }
});
```

---

## 5. Sistema de Permisos

### 5.1 Nuevo Permiso (`roles.model.js`)

```javascript
'juntar-separar-mesas': { 
    nombre: 'Juntar y Separar Mesas', 
    grupo: 'Backend/Dashboard', 
    descripcion: 'Combinar varias mesas en un grupo y separarlas posteriormente' 
}
```

### 5.2 Asignacion por Rol

| Rol | Permiso por Defecto |
|-----|---------------------|
| admin | Si |
| supervisor | Si |
| mozos | No |
| cocinero | No |
| cajero | No |

### 5.3 Verificacion en Backend

```javascript
// Helper en mesasController.js
const verificarPermiso = (req, permiso) => {
    const permisos = req.admin?.permisos || req.user?.permisos || [];
    
    // Admin tiene todos los permisos
    if (req.admin?.rol === 'admin' || req.user?.rol === 'admin') {
        return true;
    }
    
    return permisos.includes(permiso);
};

// En el endpoint
if (!verificarPermiso(req, 'juntar-separar-mesas')) {
    return res.status(403).json({ 
        success: false, 
        error: 'No tiene permiso para juntar mesas' 
    });
}
```

### 5.4 Verificacion en App Mozos

```javascript
// Verificar permisos al cargar userInfo
useEffect(() => {
    if (userInfo && userInfo.permisos) {
        const tienePermiso = userInfo.permisos.includes('mesas.juntar_separar');
        setTienePermisoJuntarSeparar(tienePermiso);
    }
}, [userInfo]);

// Usar para mostrar/ocultar botones
<TouchableOpacity
    style={[styles.barraItem, !tienePermisoJuntarSeparar && styles.barraItemDisabled]}
    onPress={activarModoJuntar}
    disabled={!tienePermisoJuntarSeparar}
>
```

---

## 6. Flujos de Uso

### 6.1 Flujo: Juntar Mesas

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
6. Se abre modal de confirmacion
   - Lista de mesas seleccionadas
   - Mesa principal destacada
   - Campo de nota opcional
   ↓
7. Mozo confirma
   ↓
8. POST /api/mesas/juntar
   ↓
9. Backend:
   - Valida condiciones
   - Determina mesa principal (menor numero)
   - Actualiza mesas secundarias
   - Actualiza mesa principal
   - Emite eventos Socket
   ↓
10. Todos los clientes reciben 'mesas-juntadas'
    ↓
11. UI se actualiza automaticamente
```

### 6.2 Flujo: Separar Mesas

```
1. Mozo presiona "Separar Mesas" en sidebar
   ↓
2. Se muestra lista de grupos disponibles
   ↓
3. Mozo selecciona el grupo a separar
   ↓
4. Se abre modal de confirmacion
   - Info de mesa principal
   - Lista de mesas unidas
   - Advertencia si hay comandas
   - Campo de motivo
   ↓
5. Mozo confirma
   ↓
6. POST /api/mesas/separar
   ↓
7. Backend:
   - Valida que es mesa principal
   - Determina estados post-separacion
   - Actualiza mesas secundarias (libre)
   - Actualiza mesa principal
   - Emite eventos Socket
   ↓
8. Todos los clientes reciben 'mesas-separadas'
   ↓
9. UI se actualiza automaticamente
```

### 6.3 Estados de Mesa con Grupos

| Estado | Visualizacion | Comportamiento |
|--------|--------------|----------------|
| Principal con unidas | Badge azul `+N` | Recibe comandas, muestra boton separar |
| Secundaria | Badge morado `M5` | No recibe comandas, redirige a principal |
| Independiente | Sin badge | Comportamiento normal |

---

## 7. Consideraciones Tecnicas

### 7.1 Edge Cases Manejados

1. **Dos mozos intentan juntar las mismas mesas**: Primera operacion gana, segunda falla por validacion de estado.

2. **Separar mesas con comandas activas**: Las comandas permanecen en la mesa principal, las secundarias quedan libres.

3. **Conexion Socket perdida**: La operacion se completa (persistida), el evento se emite al reconectar.

4. **Mesa con pedidos parcialmente pagados**: No se permite juntar (validacion de Pedido abierto).

### 7.2 Auditoria

Todas las operaciones registran:
- Timestamp
- Usuario que ejecuto la accion
- Mesas afectadas
- Motivo (si se proporciono)

```
📝 AUDITORIA - Mesas juntadas: {
    timestamp: "2024-01-15T12:30:00.000Z",
    mesaPrincipal: 5,
    mesasSecundarias: [6, 7],
    mozoId: "...",
    motivo: "Grupo familiar grande"
}
```

---

## 8. Migracion de Datos

Las mesas existentes no requieren migracion especial. Los nuevos campos tienen valores por defecto:

```javascript
esMesaPrincipal: true     // Todas las mesas existentes son independientes
mesaPrincipalId: null
mesasUnidas: []
fechaUnion: null
unidoPor: null
motivoUnion: null
```

---

## 9. Adaptacion del Nombre de Mesa en Interfaces

Se implemento la funcion `nombreCombinado` en todas las interfaces del sistema para mostrar correctamente el nombre de las mesas juntadas (ej: "M5,6,7" en lugar de solo "M5").

### 9.1 Archivos Modificados

**App de Cocina (React):**
- `appcocina/src/components/Principal/comandastyle.jsx` - Funcion `obtenerNombreMesa()` y tarjetas de comanda
- `appcocina/src/components/Principal/ComandastylePerso.jsx` - Funcion `obtenerNombreMesa()` y tarjetas de comanda

**Backend (HTML/Alpine.js):**
- `Backend-LasGambusinas/public/comandas.html` - Funcion `formatearNombreMesa()` y todos los listados
- `Backend-LasGambusinas/public/bouchers.html` - Impresion de bouchers
- `Backend-LasGambusinas/public/clientes.html` - Detalle de bouchers
- `Backend-LasGambusinas/public/admin.html` - Lista de bouchers

**App de Mozos (React Native):**
- `Las-Gambusinas/Pages/navbar/screens/PagosScreen.js` - Bouchers y pagos
- `Las-Gambusinas/Pages/ComandaDetalleScreen.js` - Detalle de comanda
- `Las-Gambusinas/Components/HeaderComandaDetalle.js` - Header de comanda
- `Las-Gambusinas/Pages/navbar/screens/ThridScreen.js` - Lista de comandas
- `Las-Gambusinas/Components/aditionals/ComandaSearch.js` - Busqueda de comandas
- `Las-Gambusinas/Components/selects/selectable.js` - Selector de mesas
- `Las-Gambusinas/Pages/navbar/screens/InicioScreen.js` - Funcion `formatearGrupoMesas()` actualizada

### 9.2 Funcion Helper

```javascript
// React/React Native
const obtenerNombreMesa = (mesa) => {
  if (!mesa) return 'N/A';
  if (mesa.nombreCombinado) {
    return mesa.nombreCombinado;  // ej: "M5,6,7"
  }
  return mesa.nummesa ? `M${mesa.nummesa}` : 'N/A';
};

// Alpine.js (Backend)
formatearNombreMesa(mesa) {
  if (!mesa) return '—';
  if (mesa.nombreCombinado) return mesa.nombreCombinado;
  if (mesa.nummesa) return `M${mesa.nummesa}`;
  if (typeof mesa === 'number') return `M${mesa}`;
  return mesa || '—';
}
```

### 9.3 Normalizacion de Datos

En `comandas.html` se actualizo la funcion `normalizarComanda()` para incluir el campo `nombreCombinado`:

```javascript
const mesaNorm = mesa && typeof mesa === 'object'
  ? { nummesa: mesa.nummesa || mesa.numMesa, area: mesa.area?.nombre || mesa.area || '', nombreCombinado: mesa.nombreCombinado || null }
  : { nummesa: mesa, area: '', nombreCombinado: null };
```

---

*Documentacion generada automaticamente - Sistema Las Gambusinas v2.8*
