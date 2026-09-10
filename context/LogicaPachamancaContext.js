import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOGICA_PACHAMANCA_KEY,
  LOGICA_PACHAMANCA_SECUENCIA,
  parseLogicaPachamanca,
  setLogicaPachamancaCache,
} from '../utils/logicaPachamanca';

const LogicaPachamancaContext = createContext({
  logicaPachamanca: LOGICA_PACHAMANCA_SECUENCIA,
  setLogicaPachamanca: () => {},
});

export function LogicaPachamancaProvider({ children }) {
  const [logicaPachamanca, setState] = useState(LOGICA_PACHAMANCA_SECUENCIA);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOGICA_PACHAMANCA_KEY);
        const next = parseLogicaPachamanca(raw);
        setLogicaPachamancaCache(next);
        setState(next);
      } catch (e) {
        console.warn('Lógica pachamanca: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setLogicaPachamanca = useCallback((v) => {
    const next = parseLogicaPachamanca(v);
    setState(next);
    setLogicaPachamancaCache(next);
    AsyncStorage.setItem(LOGICA_PACHAMANCA_KEY, next).catch(() => {});
  }, []);

  return (
    <LogicaPachamancaContext.Provider value={{ logicaPachamanca, setLogicaPachamanca }}>
      {children}
    </LogicaPachamancaContext.Provider>
  );
}

export function useLogicaPachamanca() {
  return useContext(LogicaPachamancaContext);
}
