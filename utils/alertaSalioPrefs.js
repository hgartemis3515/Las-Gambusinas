export const ALERTA_SALIO_STORAGE_KEY = '@gambusinas/alerta-salio-prefs';

const LEGACY_ESTILO = { pulso: 'sirena', borde: 'ola' };

export const ALERTA_SALIO_ESTILOS = [
  { id: 'destello', label: 'Destello' },
  { id: 'sirena', label: 'Sirena' },
  { id: 'ola', label: 'Ola de color' },
  { id: 'apagado', label: 'Sin animación' },
];

export const ALERTA_SALIO_COLORES = {
  naranja: {
    id: 'naranja',
    label: 'Naranja',
    lo: '#FFEDD5',
    hi: '#F97316',
    alt: '#FACC15',
    chip: '#EA580C',
  },
  rojo: {
    id: 'rojo',
    label: 'Rojo',
    lo: '#FECACA',
    hi: '#EF4444',
    alt: '#FB923C',
    chip: '#DC2626',
  },
  ambar: {
    id: 'ambar',
    label: 'Ámbar',
    lo: '#FEF3C7',
    hi: '#F59E0B',
    alt: '#F43F5E',
    chip: '#D97706',
  },
};

export const ALERTA_SALIO_VELOCIDAD = {
  rapida: { id: 'rapida', label: 'Rápida', ms: 420 },
  media: { id: 'media', label: 'Media', ms: 750 },
  lenta: { id: 'lenta', label: 'Lenta', ms: 1200 },
};

export const ALERTA_SALIO_DEFAULTS = {
  estilo: 'destello',
  color: 'naranja',
  velocidad: 'media',
};

export function parseAlertaSalioPrefs(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { data = null; }
  }
  if (!data || typeof data !== 'object') return { ...ALERTA_SALIO_DEFAULTS };
  const estiloRaw = LEGACY_ESTILO[data.estilo] || data.estilo;
  const estilo = ALERTA_SALIO_ESTILOS.some((e) => e.id === estiloRaw) ? estiloRaw : ALERTA_SALIO_DEFAULTS.estilo;
  const color = ALERTA_SALIO_COLORES[data.color] ? data.color : ALERTA_SALIO_DEFAULTS.color;
  const velocidad = ALERTA_SALIO_VELOCIDAD[data.velocidad] ? data.velocidad : ALERTA_SALIO_DEFAULTS.velocidad;
  return { estilo, color, velocidad };
}

export function alertaSalioAnim(prefs) {
  const p = parseAlertaSalioPrefs(prefs);
  if (p.estilo === 'apagado') return null;
  return {
    estilo: p.estilo,
    pal: ALERTA_SALIO_COLORES[p.color],
    dur: ALERTA_SALIO_VELOCIDAD[p.velocidad].ms,
    key: `${p.estilo}-${p.color}-${p.velocidad}`,
  };
}

/** Color de fondo según fase del reloj global (no depende de estado local de la fila). */
export function fondoAlertaSalio(prefs, fase) {
  const pal = ALERTA_SALIO_COLORES[prefs?.color] || ALERTA_SALIO_COLORES.naranja;
  const estilo = prefs?.estilo || 'destello';
  if (estilo === 'apagado') return pal.lo;
  if (estilo === 'sirena') return (fase & 1) === 0 ? pal.hi : pal.alt;
  if (estilo === 'ola') {
    const t = Math.abs(fase) % 3;
    return t === 0 ? pal.lo : t === 1 ? pal.hi : pal.alt;
  }
  return (fase & 1) === 0 ? pal.lo : pal.hi;
}
