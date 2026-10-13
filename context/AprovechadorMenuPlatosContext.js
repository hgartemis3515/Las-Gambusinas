import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APROVECHADOR_MENU_PLATOS_KEY,
  parseAprovechadorMenuPlatos,
} from '../utils/aprovechadorMenuPlatos';

const AprovechadorMenuPlatosContext = createContext({
  aprovechador: true,
  setAprovechador: () => {},
});

export function AprovechadorMenuPlatosProvider({ children }) {
  const [aprovechador, setAprovechadorState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APROVECHADOR_MENU_PLATOS_KEY);
        setAprovechadorState(parseAprovechadorMenuPlatos(raw));
      } catch (e) {
        console.warn('Aprovechador menú: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setAprovechador = useCallback((v) => {
    const next = v !== false;
    setAprovechadorState(next);
    AsyncStorage.setItem(APROVECHADOR_MENU_PLATOS_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return (
    <AprovechadorMenuPlatosContext.Provider value={{ aprovechador, setAprovechador }}>
      {children}
    </AprovechadorMenuPlatosContext.Provider>
  );
}

export function useAprovechadorMenuPlatos() {
  return useContext(AprovechadorMenuPlatosContext);
}
