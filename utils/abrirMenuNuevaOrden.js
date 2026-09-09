export const ABRIR_MENU_NUEVA_ORDEN_KEY = '@lasgambusinas_abrir_menu_nueva_orden';

/** Por defecto activado: Nueva orden abre el menú de tipos. */
let abrirMenuNuevaOrden = true;

export function setAbrirMenuNuevaOrdenCache(valor) {
  abrirMenuNuevaOrden = valor !== false;
}

export function getAbrirMenuNuevaOrdenCache() {
  return abrirMenuNuevaOrden;
}

export function parseAbrirMenuNuevaOrden(raw) {
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return true;
}
