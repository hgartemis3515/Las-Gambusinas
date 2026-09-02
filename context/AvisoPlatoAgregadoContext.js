import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AVISO_PLATO_AGREGADO_KEY,
  parseMostrarAvisoPlatoAgregado,
  setMostrarAvisoPlatoAgregadoCache,
} from '../utils/avisoPlatoAgregado';

const AvisoPlatoAgregadoContext = createContext({
  mostrarAviso: true,
  setMostrarAviso: () => {},
});

export function AvisoPlatoAgregadoProvider({ children }) {
  const [mostrarAviso, setMostrarAvisoState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AVISO_PLATO_AGREGADO_KEY);
        const next = parseMostrarAvisoPlatoAgregado(raw);
        setMostrarAvisoPlatoAgregadoCache(next);
        setMostrarAvisoState(next);
      } catch (e) {
        console.warn('Aviso plato agregado: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setMostrarAviso = useCallback((v) => {
    const next = v !== false;
    setMostrarAvisoState(next);
    setMostrarAvisoPlatoAgregadoCache(next);
    AsyncStorage.setItem(AVISO_PLATO_AGREGADO_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return (
    <AvisoPlatoAgregadoContext.Provider value={{ mostrarAviso, setMostrarAviso }}>
      {children}
    </AvisoPlatoAgregadoContext.Provider>
  );
}

export function useAvisoPlatoAgregado() {
  return useContext(AvisoPlatoAgregadoContext);
}
