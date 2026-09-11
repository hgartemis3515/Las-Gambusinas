export const N_UNIDAD_STORAGE_KEY = '@lasgambusinas_n_unidad_mozo';

export const N_UNIDAD_SIZE_DEFAULT = 40;
export const N_UNIDAD_SIZE_MIN = 28;
export const N_UNIDAD_SIZE_MAX = 72;

export const N_UNIDAD_SIZE_PRESETS = [
  { label: 'Chico', value: 32 },
  { label: 'Normal', value: 40 },
  { label: 'Grande', value: 52 },
  { label: 'Extra', value: 64 },
];

export function clampNUnidadSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return N_UNIDAD_SIZE_DEFAULT;
  return Math.round(Math.max(N_UNIDAD_SIZE_MIN, Math.min(N_UNIDAD_SIZE_MAX, n)));
}

export function parseNUnidadSize(raw) {
  if (raw == null || raw === '') return N_UNIDAD_SIZE_DEFAULT;
  if (typeof raw === 'number') return clampNUnidadSize(raw);
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data && typeof data === 'object' && data.size != null) return clampNUnidadSize(data.size);
    return clampNUnidadSize(data);
  } catch {
    return clampNUnidadSize(raw);
  }
}

export function nUnidadColWidth(size) {
  const s = clampNUnidadSize(size);
  return s + 12;
}

export function estiloNUnidadBox(size) {
  const s = clampNUnidadSize(size);
  return {
    width: s,
    height: s,
    borderRadius: Math.max(8, Math.round(s * 0.22)),
  };
}

export function nUnidadFontSize(size) {
  const s = clampNUnidadSize(size);
  return Math.max(10, Math.round(s * 0.32));
}
