import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOTON_CANTIDAD_STORAGE_KEY,
  BOTON_CANTIDAD_SIZE_DEFAULT,
  BOTON_CANTIDAD_COLOR_DEFAULT,
  ESTILO_CANTIDAD_DEFAULT,
  clampBotonCantidadSize,
  parseBotonCantidadColor,
  parseEstiloCantidad,
  parseBotonCantidadPrefs,
  iconSizeForBotonCantidad,
  estiloBotonCantidad,
} from '../utils/botonCantidadPlato';

const BotonCantidadPlatoContext = createContext({
  size: BOTON_CANTIDAD_SIZE_DEFAULT,
  color: BOTON_CANTIDAD_COLOR_DEFAULT,
  estiloAgregar: ESTILO_CANTIDAD_DEFAULT,
  setSize: () => {},
  setColor: () => {},
  setEstiloAgregar: () => {},
  reset: () => {},
  iconSize: iconSizeForBotonCantidad(BOTON_CANTIDAD_SIZE_DEFAULT),
  estilo: estiloBotonCantidad(BOTON_CANTIDAD_SIZE_DEFAULT, BOTON_CANTIDAD_COLOR_DEFAULT),
});

export function BotonCantidadPlatoProvider({ children }) {
  const [size, setSizeState] = useState(BOTON_CANTIDAD_SIZE_DEFAULT);
  const [color, setColorState] = useState(BOTON_CANTIDAD_COLOR_DEFAULT);
  const [estiloAgregar, setEstiloAgregarState] = useState(ESTILO_CANTIDAD_DEFAULT);
  const saveTimer = useRef(null);
  const prefsRef = useRef({
    size: BOTON_CANTIDAD_SIZE_DEFAULT,
    color: BOTON_CANTIDAD_COLOR_DEFAULT,
    estiloAgregar: ESTILO_CANTIDAD_DEFAULT,
  });

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
        setEstiloAgregarState(next.estiloAgregar);
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
    persist({ ...prefsRef.current, size: nextSize });
  }, [persist]);

  const setColor = useCallback((v) => {
    const nextColor = parseBotonCantidadColor(v);
    setColorState(nextColor);
    persist({ ...prefsRef.current, color: nextColor });
  }, [persist]);

  const setEstiloAgregar = useCallback((v) => {
    const nextEstilo = parseEstiloCantidad(v);
    setEstiloAgregarState(nextEstilo);
    persist({ ...prefsRef.current, estiloAgregar: nextEstilo });
  }, [persist]);

  const reset = useCallback(() => {
    const next = {
      size: BOTON_CANTIDAD_SIZE_DEFAULT,
      color: BOTON_CANTIDAD_COLOR_DEFAULT,
      estiloAgregar: ESTILO_CANTIDAD_DEFAULT,
    };
    setSizeState(next.size);
    setColorState(next.color);
    setEstiloAgregarState(next.estiloAgregar);
    persist(next);
  }, [persist]);

  return (
    <BotonCantidadPlatoContext.Provider
      value={{
        size,
        color,
        estiloAgregar,
        setSize,
        setColor,
        setEstiloAgregar,
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
