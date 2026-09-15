import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REDIRECCION_ENVIO_STORAGE_KEY,
  REDIRECCION_ENVIO_DEFAULT,
  parseRedireccionEnvioPref,
} from '../utils/redireccionEnvioPrefs';

const RedireccionEnvioContext = createContext({
  destino: REDIRECCION_ENVIO_DEFAULT,
  setDestino: () => {},
  reset: () => {},
});

export function RedireccionEnvioProvider({ children }) {
  const [destino, setDestinoState] = useState(REDIRECCION_ENVIO_DEFAULT);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REDIRECCION_ENVIO_STORAGE_KEY);
        if (cancelled || raw == null) return;
        setDestinoState(parseRedireccionEnvioPref(raw));
      } catch {
        /* default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setDestino = useCallback((next) => {
    const v = typeof next === 'function' ? next(destino) : next;
    setDestinoState(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(REDIRECCION_ENVIO_STORAGE_KEY, JSON.stringify({ destino: v })).catch(() => {});
    }, 200);
  }, [destino]);

  const reset = useCallback(() => {
    setDestino(REDIRECCION_ENVIO_DEFAULT);
  }, [setDestino]);

  const value = { destino, setDestino, reset };
  return (
    <RedireccionEnvioContext.Provider value={value}>
      {children}
    </RedireccionEnvioContext.Provider>
  );
}

export function useRedireccionEnvio() {
  return useContext(RedireccionEnvioContext);
}
