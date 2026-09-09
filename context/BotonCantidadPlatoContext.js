import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOTON_CANTIDAD_STORAGE_KEY,
  BOTON_CANTIDAD_SIZE_DEFAULT,
  BOTON_CANTIDAD_COLOR_DEFAULT,
  clampBotonCantidadSize,
  parseBotonCantidadColor,
  parseBotonCantidadPrefs,
  iconSizeForBotonCantidad,
  estiloBotonCantidad,
} from '../utils/botonCantidadPlato';

const BotonCantidadPlatoContext = createContext({
  size: BOTON_CANTIDAD_SIZE_DEFAULT,
  color: BOTON_CANTIDAD_COLOR_DEFAULT,
  setSize: () => {},
  setColor: () => {},
  reset: () => {},
  iconSize: iconSizeForBotonCantidad(BOTON_CANTIDAD_SIZE_DEFAULT),
  estilo: estiloBotonCantidad(BOTON_CANTIDAD_SIZE_DEFAULT, BOTON_CANTIDAD_COLOR_DEFAULT),
});

export function BotonCantidadPlatoProvider({ children }) {
  const [size, setSizeState] = useState(BOTON_CANTIDAD_SIZE_DEFAULT);
  const [color, setColorState] = useState(BOTON_CANTIDAD_COLOR_DEFAULT);
  const saveTimer = useRef(null);
  const prefsRef = useRef({ size: BOTON_CANTIDAD_SIZE_DEFAULT, color: BOTON_CANTIDAD_COLOR_DEFAULT });

  const persist = useCallback((next) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(BOTON_CANTIDAD_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOTON_CANTIDAD_STORAGE_KEY);
        if (raw == null) return;
        const next = parseBotonCantidadPrefs(raw);
        prefsRef.current = next;
        setSizeState(next.size);
        setColorState(next.color);
      } catch (e) {
        console.warn('Botón cantidad: no se pudo cargar preferencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setSize = useCallback((v) => {
    const nextSize = clampBotonCantidadSize(v);
    setSizeState(nextSize);
    persist({ size: nextSize, color: prefsRef.current.color });
  }, [persist]);

  const setColor = useCallback((v) => {
    const nextColor = parseBotonCantidadColor(v);
    setColorState(nextColor);
    persist({ size: prefsRef.current.size, color: nextColor });
  }, [persist]);

  const reset = useCallback(() => {
    setSizeState(BOTON_CANTIDAD_SIZE_DEFAULT);
    setColorState(BOTON_CANTIDAD_COLOR_DEFAULT);
    persist({ size: BOTON_CANTIDAD_SIZE_DEFAULT, color: BOTON_CANTIDAD_COLOR_DEFAULT });
  }, [persist]);

  return (
    <BotonCantidadPlatoContext.Provider
      value={{
        size,
        color,
        setSize,
        setColor,
        reset,
        iconSize: iconSizeForBotonCantidad(size),
        estilo: estiloBotonCantidad(size, color),
      }}
    >
      {children}
    </BotonCantidadPlatoContext.Provider>
  );
}

export function useBotonCantidadPlato() {
  return useContext(BotonCantidadPlatoContext);
}
