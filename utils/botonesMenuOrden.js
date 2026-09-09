export const BOTONES_MENU_ORDEN_STORAGE_KEY = '@lasgambusinas_botones_menu_orden';

export const BOTON_CERRAR_COLOR_DEFAULT = '#2196F3';
export const BOTON_SUMAR_COLOR_DEFAULT = '#00C851';
export const BOTON_CAMBIAR_COLOR_DEFAULT = '#C41E3A';
export const BOTON_CAMBIAR_VISIBLE_DEFAULT = true;

function parseHexOr(raw, fallback) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  return fallback;
}

export function prefsDefault() {
  return {
    cerrarColor: BOTON_CERRAR_COLOR_DEFAULT,
    sumarColor: BOTON_SUMAR_COLOR_DEFAULT,
    cambiarColor: BOTON_CAMBIAR_COLOR_DEFAULT,
    cambiarVisible: BOTON_CAMBIAR_VISIBLE_DEFAULT,
  };
}

export function parseBotonesMenuOrdenPrefs(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      cerrarColor: parseHexOr(data?.cerrarColor, BOTON_CERRAR_COLOR_DEFAULT),
      sumarColor: parseHexOr(data?.sumarColor, BOTON_SUMAR_COLOR_DEFAULT),
      cambiarColor: parseHexOr(data?.cambiarColor, BOTON_CAMBIAR_COLOR_DEFAULT),
      cambiarVisible: data?.cambiarVisible !== false,
    };
  } catch {
    return prefsDefault();
  }
}

export function estiloBotonCerrarMenu(size, color) {
  const s = Math.max(32, Math.min(56, Number(size) || 48));
  return {
    width: s,
    height: s,
    borderRadius: 10,
    backgroundColor: parseHexOr(color, BOTON_CERRAR_COLOR_DEFAULT),
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function estiloBotonSumarBusqueda(size, color) {
  const s = Math.max(32, Math.min(56, Number(size) || 48));
  return {
    minWidth: s,
    height: s,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: parseHexOr(color, BOTON_SUMAR_COLOR_DEFAULT),
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function estiloBotonCambiarPlato(color) {
  return {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: parseHexOr(color, BOTON_CAMBIAR_COLOR_DEFAULT),
    alignItems: 'center',
    justifyContent: 'center',
  };
}
