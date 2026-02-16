/**
 * Verificación de estado de comanda en el app de mozos (sin actualizar backend).
 *
 * El backend es la única fuente de verdad: actualiza automáticamente el status de la comanda
 * a 'recoger' cuando todos los platos están en 'entregado' (actualizarComandaSiTodosEntregados
 * en repository). El app confía en ese mecanismo y en los eventos Socket.io (comanda-actualizada)
 * para reflejar cambios en la UI.
 *
 * Estas funciones se mantienen como punto de extensión (p. ej. indicadores de UI) pero ya no
 * realizan PUT al backend, evitando Network Error y llamadas redundantes.
 *
 * Cuándo se usan: después de marcar plato como entregado, al refrescar/cargar comandas
 * y antes de llamar a comandas-para-pagar. No modifican el backend.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const comandasVerificadasCache = new Map(); // id -> timestamp

function isCacheValido(comandaId) {
  const ts = comandasVerificadasCache.get(comandaId);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

/**
 * Invalida el cache de comandas verificadas (llamar en refresh manual o al recibir comanda-actualizada por Socket).
 */
export function invalidarCacheComandasVerificadas(comandaId = null) {
  if (comandaId) {
    comandasVerificadasCache.delete(comandaId);
  } else {
    comandasVerificadasCache.clear();
  }
}

/**
 * Verifica si la comanda tiene todos los platos activos en 'entregado'.
 * No llama al backend (no GET, no PUT). El backend actualiza el status automáticamente
 * y emite comanda-actualizada por Socket.io.
 *
 * @param {string|object} comandaOrId - ID de la comanda o objeto comanda con platos y status
 * @param {object} axiosInstance - Instancia de axios (se ignora; se mantiene por compatibilidad con callers)
 * @returns {Promise<{ updated: boolean, allEntregado?: boolean }>} updated siempre false; allEntregado si aplica
 */
export async function verificarYActualizarEstadoComanda(comandaOrId, axiosInstance) {
  const id = typeof comandaOrId === 'string' ? comandaOrId : comandaOrId?._id;
  if (!id) {
    return { updated: false };
  }

  if (isCacheValido(id)) {
    return { updated: false };
  }

  // Solo evaluar si tenemos el objeto comanda; si solo tenemos ID, no hacemos GET (evitamos red).
  const comanda = typeof comandaOrId === 'object' && comandaOrId?.platos ? comandaOrId : null;
  if (!comanda || !Array.isArray(comanda.platos)) {
    return { updated: false };
  }

  const activos = comanda.platos.filter((p) => p.eliminado !== true);
  const totalActivos = activos.length;
  if (totalActivos === 0) {
    return { updated: false };
  }

  const entregados = activos.filter((p) => (p.estado || '').toString().toLowerCase() === 'entregado');
  const platosEntregados = entregados.length;
  if (platosEntregados !== totalActivos) {
    return { updated: false };
  }

  const statusActual = (comanda.status || '').toString().toLowerCase().trim();
  if (statusActual === 'recoger' || statusActual === 'entregado') {
    comandasVerificadasCache.set(id, Date.now());
    return { updated: false, allEntregado: true };
  }

  // Todos los platos entregados pero status no es recoger/entregado: el backend lo actualizará
  // automáticamente; no hacemos PUT para evitar Network Error y redundancia.
  comandasVerificadasCache.set(id, Date.now());
  return { updated: false, allEntregado: true };
}

/**
 * Ejecuta verificarYActualizarEstadoComanda para cada comanda (sin llamadas al backend).
 */
export async function verificarComandasEnLote(comandas, axiosInstance) {
  if (!Array.isArray(comandas) || !axiosInstance) return;
  const promises = comandas.map((c) => verificarYActualizarEstadoComanda(c, axiosInstance));
  await Promise.all(promises);
}
