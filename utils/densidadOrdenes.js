export const DENSIDAD_ORDENES_KEY = '@lasgambusinas_densidad_ordenes';

export const GAP_CATEGORIAS_MIN = 0;
export const GAP_CATEGORIAS_MAX = 14;
export const GAP_CATEGORIAS_DEFAULT = 2;

export const COMPACTO_MIN = 0;
export const COMPACTO_MAX = 100;
export const COMPACTO_DEFAULT = 80;

export const CHIP_CATEGORIA_ESCALA_MIN = 70;
export const CHIP_CATEGORIA_ESCALA_MAX = 160;
export const CHIP_CATEGORIA_ESCALA_DEFAULT = 100;
export const CHIP_CATEGORIA_ESCALA_PRESETS = [
  { label: 'Chico', value: 80 },
  { label: 'Normal', value: 100 },
  { label: 'Grande', value: 120 },
  { label: 'Extra', value: 145 },
];

export const CUADRO_CATEGORIA_ESCALA_MIN = 70;
export const CUADRO_CATEGORIA_ESCALA_MAX = 160;
export const CUADRO_CATEGORIA_ESCALA_DEFAULT = 100;
export const CUADRO_CATEGORIA_ESCALA_PRESETS = CHIP_CATEGORIA_ESCALA_PRESETS;

export function clampGapCategorias(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return GAP_CATEGORIAS_DEFAULT;
  return Math.round(Math.max(GAP_CATEGORIAS_MIN, Math.min(GAP_CATEGORIAS_MAX, n)));
}

export function clampCompacto(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return COMPACTO_DEFAULT;
  return Math.round(Math.max(COMPACTO_MIN, Math.min(COMPACTO_MAX, n)));
}

export function clampChipCategoriaEscala(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return CHIP_CATEGORIA_ESCALA_DEFAULT;
  return Math.round(Math.max(CHIP_CATEGORIA_ESCALA_MIN, Math.min(CHIP_CATEGORIA_ESCALA_MAX, n)));
}

export function clampCuadroCategoriaEscala(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return CUADRO_CATEGORIA_ESCALA_DEFAULT;
  return Math.round(Math.max(CUADRO_CATEGORIA_ESCALA_MIN, Math.min(CUADRO_CATEGORIA_ESCALA_MAX, n)));
}

/** Padding, fuente e icono de los chips de categoría (códigos / nombres en el buscador). */
export function estiloChipCategoria(escala) {
  const t = clampChipCategoriaEscala(escala) / 100;
  return {
    paddingHorizontal: Math.max(4, Math.round(8 * t)),
    paddingVertical: Math.max(2, Math.round(4 * t)),
    borderRadius: Math.max(8, Math.round(14 * t)),
    fontSize: Math.max(10, Math.round(12 * t)),
    iconSize: Math.max(12, Math.round(16 * t)),
    minHeight: Math.max(24, Math.round(28 * t)),
    gap: Math.max(2, Math.round(4 * t)),
  };
}

/** Cuadros del modal Categorías: columnas según el tamaño pedido y el ancho de pantalla. */
export function layoutCuadrosCategoria(usableWidth, escala) {
  const t = clampCuadroCategoriaEscala(escala) / 100;
  const w = Math.max(160, Number(usableWidth) || 280);
  const gap = Math.max(6, Math.round(8 * t));
  const target = Math.round(102 * t);
  let cols = Math.floor((w + gap) / (target + gap));
  cols = Math.max(2, Math.min(4, cols || 2));
  const cardW = (w - gap * (cols - 1)) / cols;
  return {
    cols,
    gap,
    cardW,
    imgH: Math.round(cardW * 0.72),
    fontSize: Math.max(10, Math.round(12 * (cardW / 110))),
    codeFontSize: Math.max(11, Math.round(15 * (cardW / 110))),
    iconSize: Math.max(20, Math.round(28 * (cardW / 110))),
  };
}

export function lerpDensidad(spacious, compact, compacto) {
  const t = clampCompacto(compacto) / 100;
  return Math.round(spacious + (compact - spacious) * t);
}

export function parseDensidadOrdenes(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object') obj = {};
  return {
    gapCategorias: clampGapCategorias(
      obj.gapCategorias != null ? obj.gapCategorias : GAP_CATEGORIAS_DEFAULT
    ),
    compacto: clampCompacto(obj.compacto != null ? obj.compacto : COMPACTO_DEFAULT),
    chipCategoriaEscala: clampChipCategoriaEscala(
      obj.chipCategoriaEscala != null ? obj.chipCategoriaEscala : CHIP_CATEGORIA_ESCALA_DEFAULT
    ),
    cuadroCategoriaEscala: clampCuadroCategoriaEscala(
      obj.cuadroCategoriaEscala != null ? obj.cuadroCategoriaEscala : CUADRO_CATEGORIA_ESCALA_DEFAULT
    ),
  };
}
