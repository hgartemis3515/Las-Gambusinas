export const LOGICA_PACHAMANCA_KEY = '@lasgambusinas_logica_pachamanca';

/** 1 (default): llenar de a N sabores por pachamanca, en orden de toques. */
export const LOGICA_PACHAMANCA_SECUENCIA = 'secuencia';
/** 2: una combinación se copia a todas las pachamancas. */
export const LOGICA_PACHAMANCA_MISMA = 'misma';

export const LOGICAS_PACHAMANCA = [
  {
    id: LOGICA_PACHAMANCA_SECUENCIA,
    label: '1 · Por pachamanca',
    hint: 'Agregar Cantidad = cuántas. Los sabores entran de a 1, 2, 3 o 4 según el plato. Pollo + Res es la 1ª; Res + Chancho la 2ª.',
  },
  {
    id: LOGICA_PACHAMANCA_MISMA,
    label: '2 · Misma combinación',
    hint: 'Elegís los sabores una vez y la cantidad copia esa mezcla a todas. Menos toques si todas van iguales.',
  },
];

let logicaPachamanca = LOGICA_PACHAMANCA_SECUENCIA;

export function setLogicaPachamancaCache(valor) {
  logicaPachamanca = parseLogicaPachamanca(valor);
}

export function getLogicaPachamancaCache() {
  return logicaPachamanca;
}

export function parseLogicaPachamanca(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === LOGICA_PACHAMANCA_MISMA || s === '2') return LOGICA_PACHAMANCA_MISMA;
  return LOGICA_PACHAMANCA_SECUENCIA;
}

export function slotsOpNecesarios(logica, nPachamancas, saboresPorUnidad) {
  const n = Math.max(1, Math.min(99, Number(nPachamancas) || 1));
  const sab = Math.max(1, Math.min(8, Number(saboresPorUnidad) || 1));
  if (logica === LOGICA_PACHAMANCA_MISMA) return sab;
  return n * sab;
}
