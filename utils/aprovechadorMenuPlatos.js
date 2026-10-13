export const APROVECHADOR_MENU_PLATOS_KEY = '@lasgambusinas_aprovechador_menu_platos';

/** Por defecto los cuadros van pegados. Solo '0' o 'false' lo apaga. */
export function parseAprovechadorMenuPlatos(raw) {
  if (raw === '0' || raw === 'false') return false;
  return true;
}
