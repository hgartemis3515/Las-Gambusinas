export const BOTON_CANTIDAD_STORAGE_KEY = '@lasgambusinas_boton_cantidad_plato';

export const BOTON_CANTIDAD_SIZE_DEFAULT = 32;
export const BOTON_CANTIDAD_SIZE_MIN = 24;
export const BOTON_CANTIDAD_SIZE_MAX = 48;
export const BOTON_CANTIDAD_COLOR_DEFAULT = '#C41E3A';

export const BOTON_CANTIDAD_SIZE_PRESETS = [
  { label: 'Chico', value: 28 },
  { label: 'Normal', value: 32 },
  { label: 'Grande', value: 40 },
  { label: 'Extra', value: 48 },
];

export const BOTON_CANTIDAD_COLOR_PRESETS = [
  { label: 'Rojo', value: '#C41E3A' },
  { label: 'Verde', value: '#00C851' },
  { label: 'Azul', value: '#2196F3' },
  { label: 'Naranja', value: '#FF9800' },
  { label: 'Morado', value: '#7C3AED' },
  { label: 'Negro', value: '#1F2937' },
];

export function clampBotonCantidadSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return BOTON_CANTIDAD_SIZE_DEFAULT;
  return Math.round(Math.max(BOTON_CANTIDAD_SIZE_MIN, Math.min(BOTON_CANTIDAD_SIZE_MAX, n)));
}

export function parseBotonCantidadColor(raw) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  return BOTON_CANTIDAD_COLOR_DEFAULT;
}

export function parseBotonCantidadPrefs(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      size: clampBotonCantidadSize(data?.size),
      color: parseBotonCantidadColor(data?.color),
    };
  } catch {
    return {
      size: BOTON_CANTIDAD_SIZE_DEFAULT,
      color: BOTON_CANTIDAD_COLOR_DEFAULT,
    };
  }
}

export function iconSizeForBotonCantidad(size) {
  const s = clampBotonCantidadSize(size);
  return Math.round(Math.max(14, Math.min(26, s * 0.55)));
}

export function estiloBotonCantidad(size, color) {
  const s = clampBotonCantidadSize(size);
  return {
    width: s,
    height: s,
    borderRadius: Math.round(s / 2),
    backgroundColor: parseBotonCantidadColor(color),
    alignItems: 'center',
    justifyContent: 'center',
  };
}
