import { Alert } from 'react-native';

export const AVISO_PLATO_AGREGADO_KEY = '@lasgambusinas_mostrar_aviso_plato_agregado';

/** Por defecto se muestra el aviso; el mozo puede ocultarlo en Personalizar. */
let mostrarAvisoPlatoAgregado = true;

export function setMostrarAvisoPlatoAgregadoCache(valor) {
  mostrarAvisoPlatoAgregado = valor !== false;
}

export function getMostrarAvisoPlatoAgregadoCache() {
  return mostrarAvisoPlatoAgregado;
}

export function parseMostrarAvisoPlatoAgregado(raw) {
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return true;
}

export function textoAvisoPlatoAgregado(nombre, cantidad = 1) {
  const nom = String(nombre || 'Plato').trim() || 'Plato';
  const n = Number(cantidad);
  const cant = Number.isFinite(n) && n > 1 ? n : 1;
  return cant > 1 ? `${nom} ×${cant} agregado` : `${nom} agregado`;
}

export function avisarPlatoAgregado(nombre, cantidad = 1) {
  if (!mostrarAvisoPlatoAgregado) return;
  Alert.alert('✅', textoAvisoPlatoAgregado(nombre, cantidad));
}
