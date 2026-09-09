import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ORDENES_ACCIONES_STORAGE_KEY,
  AGREGAR_PLATO_COLOR_DEFAULT,
  ENVIAR_ORDEN_COLOR_DEFAULT,
  UBICACION_ACCIONES_DEFAULT,
  CATEGORIA_ETIQUETA_DEFAULT,
  MOSTRAR_BUSCAR_CATEGORIAS_DEFAULT,
  ACCIONES_ESCALA_DEFAULT,
  parseOrdenesAccionesPrefs,
  prefsOrdenesAccionesDefault,
} from '../utils/ordenesAccionesPrefs';

const OrdenesAccionesContext = createContext({
  agregarColor: AGREGAR_PLATO_COLOR_DEFAULT,
  enviarColor: ENVIAR_ORDEN_COLOR_DEFAULT,
  ubicacion: UBICACION_ACCIONES_DEFAULT,
  categoriaEtiqueta: CATEGORIA_ETIQUETA_DEFAULT,
  mostrarBuscarCategorias: MOSTRAR_BUSCAR_CATEGORIAS_DEFAULT,
  accionesEscala: ACCIONES_ESCALA_DEFAULT,
  setAgregarColor: () => {},
  setEnviarColor: () => {},
  setUbicacion: () => {},
  setCategoriaEtiqueta: () => {},
  setMostrarBuscarCategorias: () => {},
  setAccionesEscala: () => {},
  reset: () => {},
});

export function OrdenesAccionesProvider({ children }) {
  const [prefs, setPrefs] = useState(prefsOrdenesAccionesDefault);
  const saveTimer = useRef(null);
  const prefsRef = useRef(prefsOrdenesAccionesDefault());

  const persist = useCallback((next) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(ORDENES_ACCIONES_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ORDENES_ACCIONES_STORAGE_KEY);
        if (raw == null) return;
        const next = parseOrdenesAccionesPrefs(raw);
        prefsRef.current = next;
        setPrefs(next);
      } catch (e) {
        console.warn('Órdenes acciones: no se pudo cargar preferencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const patch = useCallback((partial) => {
    const next = parseOrdenesAccionesPrefs({ ...prefsRef.current, ...partial });
    setPrefs(next);
    persist(next);
  }, [persist]);

  const setAgregarColor = useCallback((v) => {
    patch({ agregarColor: v });
  }, [patch]);

  const setEnviarColor = useCallback((v) => {
    patch({ enviarColor: v });
  }, [patch]);

  const setUbicacion = useCallback((v) => {
    patch({ ubicacion: v });
  }, [patch]);

  const setCategoriaEtiqueta = useCallback((v) => {
    patch({ categoriaEtiqueta: v });
  }, [patch]);

  const setMostrarBuscarCategorias = useCallback((v) => {
    patch({ mostrarBuscarCategorias: v === true });
  }, [patch]);

  const setAccionesEscala = useCallback((v) => {
    patch({ accionesEscala: v });
  }, [patch]);

  const reset = useCallback(() => {
    const next = prefsOrdenesAccionesDefault();
    setPrefs(next);
    persist(next);
  }, [persist]);

  return (
    <OrdenesAccionesContext.Provider
      value={{
        ...prefs,
        setAgregarColor,
        setEnviarColor,
        setUbicacion,
        setCategoriaEtiqueta,
        setMostrarBuscarCategorias,
        setAccionesEscala,
        reset,
      }}
    >
      {children}
    </OrdenesAccionesContext.Provider>
  );
}

export function useOrdenesAcciones() {
  return useContext(OrdenesAccionesContext);
}
