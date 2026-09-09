import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOTON_ENVIAR_ORDEN_STORAGE_KEY,
  BOTON_ENVIAR_SIZE_DEFAULT,
  BOTON_ENVIAR_COLOR_DEFAULT,
  BOTON_ENVIAR_VISIBLE_DEFAULT,
  clampBotonEnviarSize,
  parseBotonEnviarColor,
  parseBotonEnviarPrefs,
  iconSizeForBotonEnviar,
  estiloBotonEnviar,
} from '../utils/botonEnviarOrden';

const BotonEnviarOrdenContext = createContext({
  size: BOTON_ENVIAR_SIZE_DEFAULT,
  color: BOTON_ENVIAR_COLOR_DEFAULT,
  visible: BOTON_ENVIAR_VISIBLE_DEFAULT,
  setSize: () => {},
  setColor: () => {},
  setVisible: () => {},
  reset: () => {},
  iconSize: iconSizeForBotonEnviar(BOTON_ENVIAR_SIZE_DEFAULT),
  estilo: estiloBotonEnviar(BOTON_ENVIAR_SIZE_DEFAULT, BOTON_ENVIAR_COLOR_DEFAULT),
});

export function BotonEnviarOrdenProvider({ children }) {
  const [size, setSizeState] = useState(BOTON_ENVIAR_SIZE_DEFAULT);
  const [color, setColorState] = useState(BOTON_ENVIAR_COLOR_DEFAULT);
  const [visible, setVisibleState] = useState(BOTON_ENVIAR_VISIBLE_DEFAULT);
  const saveTimer = useRef(null);
  const prefsRef = useRef({
    size: BOTON_ENVIAR_SIZE_DEFAULT,
    color: BOTON_ENVIAR_COLOR_DEFAULT,
    visible: BOTON_ENVIAR_VISIBLE_DEFAULT,
  });

  const persist = useCallback((next) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(BOTON_ENVIAR_ORDEN_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOTON_ENVIAR_ORDEN_STORAGE_KEY);
        if (raw == null) return;
        const next = parseBotonEnviarPrefs(raw);
        prefsRef.current = next;
        setSizeState(next.size);
        setColorState(next.color);
        setVisibleState(next.visible);
      } catch (e) {
        console.warn('Botón E enviar: no se pudo cargar preferencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setSize = useCallback((v) => {
    const nextSize = clampBotonEnviarSize(v);
    setSizeState(nextSize);
    persist({ ...prefsRef.current, size: nextSize });
  }, [persist]);

  const setColor = useCallback((v) => {
    const nextColor = parseBotonEnviarColor(v);
    setColorState(nextColor);
    persist({ ...prefsRef.current, color: nextColor });
  }, [persist]);

  const setVisible = useCallback((v) => {
    const nextVisible = v !== false;
    setVisibleState(nextVisible);
    persist({ ...prefsRef.current, visible: nextVisible });
  }, [persist]);

  const reset = useCallback(() => {
    const next = {
      size: BOTON_ENVIAR_SIZE_DEFAULT,
      color: BOTON_ENVIAR_COLOR_DEFAULT,
      visible: BOTON_ENVIAR_VISIBLE_DEFAULT,
    };
    setSizeState(next.size);
    setColorState(next.color);
    setVisibleState(next.visible);
    persist(next);
  }, [persist]);

  return (
    <BotonEnviarOrdenContext.Provider
      value={{
        size,
        color,
        visible,
        setSize,
        setColor,
        setVisible,
        reset,
        iconSize: iconSizeForBotonEnviar(size),
        estilo: estiloBotonEnviar(size, color),
      }}
    >
      {children}
    </BotonEnviarOrdenContext.Provider>
  );
}

export function useBotonEnviarOrden() {
  return useContext(BotonEnviarOrdenContext);
}
