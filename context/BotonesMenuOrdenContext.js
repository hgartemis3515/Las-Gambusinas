import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOTONES_MENU_ORDEN_STORAGE_KEY,
  BOTON_CERRAR_COLOR_DEFAULT,
  BOTON_SUMAR_COLOR_DEFAULT,
  BOTON_CAMBIAR_COLOR_DEFAULT,
  BOTON_CAMBIAR_VISIBLE_DEFAULT,
  parseBotonesMenuOrdenPrefs,
  prefsDefault,
  estiloBotonCambiarPlato,
} from '../utils/botonesMenuOrden';

const BotonesMenuOrdenContext = createContext({
  cerrarColor: BOTON_CERRAR_COLOR_DEFAULT,
  sumarColor: BOTON_SUMAR_COLOR_DEFAULT,
  cambiarColor: BOTON_CAMBIAR_COLOR_DEFAULT,
  cambiarVisible: BOTON_CAMBIAR_VISIBLE_DEFAULT,
  setCerrarColor: () => {},
  setSumarColor: () => {},
  setCambiarColor: () => {},
  setCambiarVisible: () => {},
  reset: () => {},
  estiloCambiar: estiloBotonCambiarPlato(BOTON_CAMBIAR_COLOR_DEFAULT),
});

export function BotonesMenuOrdenProvider({ children }) {
  const [prefs, setPrefs] = useState(prefsDefault);
  const saveTimer = useRef(null);
  const prefsRef = useRef(prefsDefault());

  const persist = useCallback((next) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(BOTONES_MENU_ORDEN_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOTONES_MENU_ORDEN_STORAGE_KEY);
        if (raw == null) return;
        const next = parseBotonesMenuOrdenPrefs(raw);
        prefsRef.current = next;
        setPrefs(next);
      } catch (e) {
        console.warn('Botones menú orden: no se pudo cargar preferencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const patch = useCallback((partial) => {
    const next = { ...prefsRef.current, ...partial };
    setPrefs(next);
    persist(next);
  }, [persist]);

  const setCerrarColor = useCallback((v) => {
    patch({ cerrarColor: parseBotonesMenuOrdenPrefs({ cerrarColor: v }).cerrarColor });
  }, [patch]);

  const setSumarColor = useCallback((v) => {
    patch({ sumarColor: parseBotonesMenuOrdenPrefs({ sumarColor: v }).sumarColor });
  }, [patch]);

  const setCambiarColor = useCallback((v) => {
    patch({ cambiarColor: parseBotonesMenuOrdenPrefs({ cambiarColor: v }).cambiarColor });
  }, [patch]);

  const setCambiarVisible = useCallback((v) => {
    patch({ cambiarVisible: v !== false });
  }, [patch]);

  const reset = useCallback(() => {
    const next = prefsDefault();
    setPrefs(next);
    persist(next);
  }, [persist]);

  return (
    <BotonesMenuOrdenContext.Provider
      value={{
        ...prefs,
        setCerrarColor,
        setSumarColor,
        setCambiarColor,
        setCambiarVisible,
        reset,
        estiloCambiar: estiloBotonCambiarPlato(prefs.cambiarColor),
      }}
    >
      {children}
    </BotonesMenuOrdenContext.Provider>
  );
}

export function useBotonesMenuOrden() {
  return useContext(BotonesMenuOrdenContext);
}
