import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OCULTAR_PROPINA_KEY,
  OCULTAR_PROPINA_DEFAULT,
  parseOcultarPropina,
  setOcultarPropinaCache,
} from '../utils/ocultarPropina';

const OcultarPropinaContext = createContext({
  ocultarPropina: OCULTAR_PROPINA_DEFAULT,
  setOcultarPropina: () => {},
});

export function OcultarPropinaProvider({ children }) {
  const [ocultarPropina, setOcultarState] = useState(OCULTAR_PROPINA_DEFAULT);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(OCULTAR_PROPINA_KEY);
        const next = parseOcultarPropina(raw);
        setOcultarPropinaCache(next);
        setOcultarState(next);
      } catch (e) {
        console.warn('Ocultar propina: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setOcultarPropina = useCallback((v) => {
    const next = v !== false;
    setOcultarState(next);
    setOcultarPropinaCache(next);
    AsyncStorage.setItem(OCULTAR_PROPINA_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return (
    <OcultarPropinaContext.Provider value={{ ocultarPropina, setOcultarPropina }}>
      {children}
    </OcultarPropinaContext.Provider>
  );
}

export function useOcultarPropina() {
  return useContext(OcultarPropinaContext);
}
