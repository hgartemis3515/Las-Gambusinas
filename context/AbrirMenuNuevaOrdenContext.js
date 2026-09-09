import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ABRIR_MENU_NUEVA_ORDEN_KEY,
  parseAbrirMenuNuevaOrden,
  setAbrirMenuNuevaOrdenCache,
} from '../utils/abrirMenuNuevaOrden';

const AbrirMenuNuevaOrdenContext = createContext({
  abrirMenuNuevaOrden: true,
  setAbrirMenuNuevaOrden: () => {},
});

export function AbrirMenuNuevaOrdenProvider({ children }) {
  const [abrirMenuNuevaOrden, setState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ABRIR_MENU_NUEVA_ORDEN_KEY);
        const next = parseAbrirMenuNuevaOrden(raw);
        setAbrirMenuNuevaOrdenCache(next);
        setState(next);
      } catch (e) {
        console.warn('Abrir menú nueva orden: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setAbrirMenuNuevaOrden = useCallback((v) => {
    const next = v !== false;
    setState(next);
    setAbrirMenuNuevaOrdenCache(next);
    AsyncStorage.setItem(ABRIR_MENU_NUEVA_ORDEN_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return (
    <AbrirMenuNuevaOrdenContext.Provider value={{ abrirMenuNuevaOrden, setAbrirMenuNuevaOrden }}>
      {children}
    </AbrirMenuNuevaOrdenContext.Provider>
  );
}

export function useAbrirMenuNuevaOrden() {
  return useContext(AbrirMenuNuevaOrdenContext);
}
