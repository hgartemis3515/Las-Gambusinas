/**
 * Utilidad espejo de backend/src/utils/precioComplementos.js para App Mozos.
 * Permite mostrar precios y subtotales en tiempo real en ModalComplementos y carrito.
 *
 * v3.0 — Junio 2026
 */

/**
 * Normaliza una opción (string u objeto) a { nombre, precio }.
 */
export function normalizarOpcion(op) {
  if (op == null) return { nombre: '', precio: 0 };
  if (typeof op === 'string') return { nombre: op.trim(), precio: 0 };
  if (typeof op === 'object') {
    const nombre = String(op.nombre ?? op.opcion ?? '').trim();
    const precio = Number(op.precio);
    return {
      nombre,
      precio: Number.isFinite(precio) && precio > 0 ? precio : 0,
    };
  }
  return { nombre: String(op).trim(), precio: 0 };
}

/**
 * Extrae el nombre de una opción (string u objeto).
 */
export function getNombreOpcion(op) {
  if (op == null) return '';
  if (typeof op === 'string') return op.trim();
  return String(op.nombre ?? op.opcion ?? '').trim();
}

/**
 * Normaliza un array de opciones.
 */
export function normalizarOpciones(opciones) {
  if (!Array.isArray(opciones)) return [];
  return opciones.map(normalizarOpcion).filter((o) => o.nombre.length > 0);
}

/**
 * Busca el precio de una opción dentro de un grupo. Case-insensitive por nombre.
 */
export function getPrecioOpcion(grupo, nombreOpcion) {
  if (!grupo || !nombreOpcion) return 0;
  const target = String(nombreOpcion).trim().toLowerCase();
  const opciones = normalizarOpciones(grupo.opciones);
  const encontrada = opciones.find((o) => o.nombre.toLowerCase() === target);
  return encontrada ? encontrada.precio : 0;
}

/** Variaciones de una opción de catálogo (Ensalada → Limón / Vinagreta). */
export function variacionesDeOpcion(op) {
  if (op == null || typeof op === 'string') return [];
  const list = Array.isArray(op.variaciones) ? op.variaciones : [];
  const seen = new Set();
  const out = [];
  for (const v of list) {
    const nombre = typeof v === 'string' ? String(v).trim() : String(v?.nombre || '').trim();
    if (!nombre) continue;
    const key = nombre.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const precio = Number(typeof v === 'object' && v != null ? v.precio : 0);
    out.push({
      nombre,
      precio: Number.isFinite(precio) && precio > 0 ? precio : 0,
    });
  }
  return out;
}

export function getPrecioVariacion(grupo, nombreOpcion, nombreVar) {
  const targetOp = String(nombreOpcion || '').trim().toLowerCase();
  const targetV = String(nombreVar || '').trim().toLowerCase();
  if (!grupo || !targetOp || !targetV) return 0;
  const ops = Array.isArray(grupo.opciones) ? grupo.opciones : [];
  for (const op of ops) {
    const n = typeof op === 'string' ? op.trim() : String(op?.nombre || op?.opcion || '').trim();
    if (n.toLowerCase() !== targetOp) continue;
    const found = variacionesDeOpcion(op).find((v) => v.nombre.toLowerCase() === targetV);
    return found ? found.precio : 0;
  }
  return 0;
}

/** Texto para mozos / tickets: "Ensalada Limón". */
export function textoOpcionComplemento(comp) {
  const op = Array.isArray(comp?.opcion)
    ? comp.opcion.filter(Boolean).join(', ')
    : String(comp?.opcion || comp?.nombre || '').trim();
  const v = String(comp?.variacion || '').trim();
  if (!op) return v;
  if (!v) return op;
  return `${op} ${v}`;
}

export function camposSnapshotComplemento(comp) {
  const variacion = String(comp?.variacion || '').trim();
  const pronombre = String(comp?.pronombre || '').trim();
  return {
    grupo: comp.grupo,
    opcion: comp.opcion,
    cantidad: comp.cantidad || 1,
    ...(comp.precio != null ? { precio: Number(comp.precio) || 0 } : {}),
    ...(pronombre ? { pronombre } : {}),
    ...(variacion ? { variacion } : {}),
  };
}

/**
 * Precio unitario de una línea de plato con complementos.
 * @param {number} precioBase
 * @param {Array} complementosSeleccionados [{ grupo, opcion, cantidad, precio? }]
 * @param {Object} [opts] { afectanPrecio = true }
 */
export function calcularPrecioUnitarioConComplementos(
  precioBase,
  complementosSeleccionados,
  opts = {}
) {
  const afectanPrecio = opts.afectanPrecio !== false;
  const base = Number(precioBase) || 0;
  const selecciones = Array.isArray(complementosSeleccionados) ? complementosSeleccionados : [];

  let extra = 0;
  for (const sel of selecciones) {
    const cantidad = Math.max(1, Number(sel.cantidad) || 1);
    const precioUnit = Number(sel.precio) || 0;
    if (afectanPrecio) extra += precioUnit * cantidad;
  }
  return { precioUnitario: base + extra, extraComplementos: extra };
}

/**
 * Subtotal de una línea de plato = precioUnitario × cantidad de platos.
 */
export function calcularPrecioLinea(plato, complementosElegidos, cantidadPlato = 1) {
  const base = Number(plato?.precio) || 0;
  const afectanPrecio = plato?.complementosAfectanPrecio !== false;
  const { precioUnitario, extraComplementos } = calcularPrecioUnitarioConComplementos(
    base,
    complementosElegidos,
    { afectanPrecio }
  );
  const cantidad = Math.max(1, Number(cantidadPlato) || 1);
  return {
    precioBase: base,
    extraComplementos,
    precioUnitario,
    cantidad,
    subtotal: precioUnitario * cantidad,
  };
}

/**
 * Total de unidades y monto extra (para resumen de impresión).
 */
export function calcularResumenComplementos(complementosSeleccionados, opts = {}) {
  const afectanPrecio = opts.afectanPrecio !== false;
  const selecciones = Array.isArray(complementosSeleccionados) ? complementosSeleccionados : [];
  let totalUnidades = 0;
  let extra = 0;
  for (const sel of selecciones) {
    const cantidad = Math.max(1, Number(sel.cantidad) || 1);
    totalUnidades += cantidad;
    if (afectanPrecio) extra += (Number(sel.precio) || 0) * cantidad;
  }
  return { totalUnidades, extraComplementos: extra };
}

/**
 * Texto compacto para el resumen de impresión.
 */
export function textoResumenComplementos(complementosSeleccionados, flags = {}, simbolo = 'S/.') {
  const mostrarCantidad = flags.mostrarCantidad !== false;
  const mostrarMontoExtra = flags.mostrarMontoExtra !== false;
  const { totalUnidades, extraComplementos } = calcularResumenComplementos(complementosSeleccionados);
  if (totalUnidades === 0) return '';
  const partes = [];
  if (mostrarCantidad) {
    partes.push(`${totalUnidades} ${totalUnidades === 1 ? 'ud.' : 'uds.'}`);
  }
  if (mostrarMontoExtra && extraComplementos > 0) {
    partes.push(`(+${simbolo}${extraComplementos.toFixed(2)})`);
  }
  return partes.join(' ').trim();
}

export default {
  normalizarOpcion,
  getNombreOpcion,
  normalizarOpciones,
  getPrecioOpcion,
  variacionesDeOpcion,
  getPrecioVariacion,
  textoOpcionComplemento,
  camposSnapshotComplemento,
  calcularPrecioUnitarioConComplementos,
  calcularPrecioLinea,
  calcularResumenComplementos,
  textoResumenComplementos,
};
