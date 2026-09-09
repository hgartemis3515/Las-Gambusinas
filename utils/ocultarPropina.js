export const OCULTAR_PROPINA_KEY = '@lasgambusinas_ocultar_propina';

/** Por defecto se oculta Registrar propina. */
export const OCULTAR_PROPINA_DEFAULT = true;

let ocultarPropinaCache = OCULTAR_PROPINA_DEFAULT;

export function setOcultarPropinaCache(valor) {
  ocultarPropinaCache = valor !== false;
}

export function getOcultarPropinaCache() {
  return ocultarPropinaCache;
}

export function parseOcultarPropina(raw) {
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return OCULTAR_PROPINA_DEFAULT;
}
