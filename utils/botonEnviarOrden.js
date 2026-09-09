export const BOTON_ENVIAR_ORDEN_STORAGE_KEY = '@lasgambusinas_boton_enviar_orden';

export const BOTON_ENVIAR_SIZE_DEFAULT = 48;
export const BOTON_ENVIAR_SIZE_MIN = 32;
export const BOTON_ENVIAR_SIZE_MAX = 56;
export const BOTON_ENVIAR_COLOR_DEFAULT = '#4FC3F7';
export const BOTON_ENVIAR_VISIBLE_DEFAULT = true;

export const BOTON_ENVIAR_SIZE_PRESETS = [
  { label: 'Chico', value: 36 },
  { label: 'Normal', value: 48 },
  { label: 'Grande', value: 56 },
];

export const BOTON_ENVIAR_COLOR_PRESETS = [
  { label: 'Celeste', value: '#4FC3F7' },
  { label: 'Azul', value: '#2196F3' },
  { label: 'Verde', value: '#00C851' },
  { label: 'Naranja', value: '#FF9800' },
  { label: 'Rojo', value: '#C41E3A' },
  { label: 'Morado', value: '#7C3AED' },
];

export function clampBotonEnviarSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return BOTON_ENVIAR_SIZE_DEFAULT;
  return Math.round(Math.max(BOTON_ENVIAR_SIZE_MIN, Math.min(BOTON_ENVIAR_SIZE_MAX, n)));
}

export function parseBotonEnviarColor(raw) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  return BOTON_ENVIAR_COLOR_DEFAULT;
}

export function parseBotonEnviarPrefs(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      size: clampBotonEnviarSize(data?.size),
      color: parseBotonEnviarColor(data?.color),
      visible: data?.visible !== false,
    };
  } catch {
    return {
      size: BOTON_ENVIAR_SIZE_DEFAULT,
      color: BOTON_ENVIAR_COLOR_DEFAULT,
      visible: BOTON_ENVIAR_VISIBLE_DEFAULT,
    };
  }
}

export function iconSizeForBotonEnviar(size) {
  const s = clampBotonEnviarSize(size);
  return Math.round(Math.max(16, Math.min(28, s * 0.48)));
}

export function estiloBotonEnviar(size, color) {
  const s = clampBotonEnviarSize(size);
  return {
    width: s,
    height: s,
    borderRadius: 10,
    backgroundColor: parseBotonEnviarColor(color),
    alignItems: 'center',
    justifyContent: 'center',
  };
}
