import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  N_UNIDAD_STORAGE_KEY,
  N_UNIDAD_SIZE_DEFAULT,
  clampNUnidadSize,
  parseNUnidadSize,
} from '../utils/nUnidadMozo';

const NUnidadMozoContext = createContext({
  size: N_UNIDAD_SIZE_DEFAULT,
  setSize: () => {},
  reset: () => {},
});

export function NUnidadMozoProvider({ children }) {
  const [size, setSizeState] = useState(N_UNIDAD_SIZE_DEFAULT);
  const saveTimer = useRef(null);
  const sizeRef = useRef(N_UNIDAD_SIZE_DEFAULT);

  const persist = useCallback((next) => {
    sizeRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(N_UNIDAD_STORAGE_KEY, JSON.stringify({ size: next })).catch(() => {});
    }, 200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(N_UNIDAD_STORAGE_KEY);
        if (cancelled) return;
        const next = parseNUnidadSize(raw);
        sizeRef.current = next;
        setSizeState(next);
      } catch {
        /* default */
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setSize = useCallback((v) => {
    const next = clampNUnidadSize(v);
    setSizeState(next);
    persist(next);
  }, [persist]);

  const reset = useCallback(() => {
    setSizeState(N_UNIDAD_SIZE_DEFAULT);
    persist(N_UNIDAD_SIZE_DEFAULT);
  }, [persist]);

  return (
    <NUnidadMozoContext.Provider value={{ size, setSize, reset }}>
      {children}
    </NUnidadMozoContext.Provider>
  );
}

export function useNUnidadMozo() {
  return useContext(NUnidadMozoContext);
}
