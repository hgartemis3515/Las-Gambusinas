export const ORDENES_ACCIONES_STORAGE_KEY = '@lasgambusinas_ordenes_acciones';

export const UBICACION_ACCIONES_ARRIBA = 'arriba';
export const UBICACION_ACCIONES_ABAJO = 'abajo';
export const UBICACION_ACCIONES_DEFAULT = UBICACION_ACCIONES_ARRIBA;

export const AGREGAR_PLATO_COLOR_DEFAULT = '#00D4FF';
export const ENVIAR_ORDEN_COLOR_DEFAULT = '#C41E3A';

export const CATEGORIA_ETIQUETA_NOMBRE = 'nombre';
export const CATEGORIA_ETIQUETA_CODIGO = 'codigo';
export const CATEGORIA_ETIQUETA_DEFAULT = CATEGORIA_ETIQUETA_NOMBRE;
export const MOSTRAR_BUSCAR_CATEGORIAS_DEFAULT = false;

export const ACCIONES_ESCALA_MIN = 70;
export const ACCIONES_ESCALA_MAX = 150;
export const ACCIONES_ESCALA_DEFAULT = 100;
export const ACCIONES_ESCALA_PRESETS = [
  { label: 'Chico', value: 80 },
  { label: 'Normal', value: 100 },
  { label: 'Grande', value: 120 },
  { label: 'Extra', value: 140 },
];

export function clampAccionesEscala(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return ACCIONES_ESCALA_DEFAULT;
  return Math.round(Math.max(ACCIONES_ESCALA_MIN, Math.min(ACCIONES_ESCALA_MAX, n)));
}

export const ACCION_ORDEN_COLOR_PRESETS = [
  { label: 'Cian', value: '#00D4FF' },
  { label: 'Rojo', value: '#C41E3A' },
  { label: 'Azul', value: '#2196F3' },
  { label: 'Verde', value: '#00C851' },
  { label: 'Celeste', value: '#4FC3F7' },
  { label: 'Naranja', value: '#FF9800' },
  { label: 'Morado', value: '#7C3AED' },
];

function parseHexOr(raw, fallback) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  return fallback;
}

export function prefsOrdenesAccionesDefault() {
  return {
    agregarColor: AGREGAR_PLATO_COLOR_DEFAULT,
    enviarColor: ENVIAR_ORDEN_COLOR_DEFAULT,
    ubicacion: UBICACION_ACCIONES_DEFAULT,
    categoriaEtiqueta: CATEGORIA_ETIQUETA_DEFAULT,
    mostrarBuscarCategorias: MOSTRAR_BUSCAR_CATEGORIAS_DEFAULT,
    accionesEscala: ACCIONES_ESCALA_DEFAULT,
  };
}

export function parseOrdenesAccionesPrefs(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const ubi = data?.ubicacion === UBICACION_ACCIONES_ABAJO
      ? UBICACION_ACCIONES_ABAJO
      : UBICACION_ACCIONES_ARRIBA;
    const etiq = data?.categoriaEtiqueta === CATEGORIA_ETIQUETA_CODIGO
      ? CATEGORIA_ETIQUETA_CODIGO
      : CATEGORIA_ETIQUETA_NOMBRE;
    return {
      agregarColor: parseHexOr(data?.agregarColor, AGREGAR_PLATO_COLOR_DEFAULT),
      enviarColor: parseHexOr(data?.enviarColor, ENVIAR_ORDEN_COLOR_DEFAULT),
      ubicacion: ubi,
      categoriaEtiqueta: etiq,
      mostrarBuscarCategorias: data?.mostrarBuscarCategorias === true,
      accionesEscala: clampAccionesEscala(
        data?.accionesEscala != null ? data.accionesEscala : ACCIONES_ESCALA_DEFAULT
      ),
    };
  } catch {
    return prefsOrdenesAccionesDefault();
  }
}
