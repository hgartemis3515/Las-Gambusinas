export const LOGICA_PACHAMANCA_KEY = '@lasgambusinas_logica_pachamanca';

/** 1 (default): llenar de a N sabores por pachamanca, en orden de toques. */
export const LOGICA_PACHAMANCA_SECUENCIA = 'secuencia';
/** 2: una combinación se copia a todas las pachamancas. */
export const LOGICA_PACHAMANCA_MISMA = 'misma';

export const LOGICAS_PACHAMANCA = [
  {
    id: LOGICA_PACHAMANCA_SECUENCIA,
    label: '1 · Por cantidad',
    hint: 'Elegí cantidad de pachamancas y tocá sabores en orden. 3 sabores × 2: Pollo, Carnero, Cerdo → N1; Res, Pollo, Carnero → N2. En 1/4 leña, 2 pechos + 2 piernas crea N1…N4. Guardar Cambios, sin Continuar.',
  },
  {
    id: LOGICA_PACHAMANCA_MISMA,
    label: '2 · Como ahora',
    hint: 'Los mismos sabores para todas las pachamancas: elegís la combinación una vez y la cantidad la copia a N1, N2… Guardar Cambios al terminar.',
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
