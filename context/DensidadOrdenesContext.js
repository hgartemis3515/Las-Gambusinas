import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';
import { apiConfig } from '../apiConfig';
import { getFallbackApiBase } from '../config/envDefaults';
import {
  DENSIDAD_ORDENES_KEY,
  GAP_CATEGORIAS_DEFAULT,
  COMPACTO_DEFAULT,
  CHIP_CATEGORIA_ESCALA_DEFAULT,
  CUADRO_CATEGORIA_ESCALA_DEFAULT,
  clampGapCategorias,
  clampCompacto,
  clampChipCategoriaEscala,
  clampCuadroCategoriaEscala,
  parseDensidadOrdenes,
} from '../utils/densidadOrdenes';

export const EVT_MOZO_SESSION = 'gambusinas-mozo-session';

const DensidadOrdenesContext = createContext({
  gapCategorias: GAP_CATEGORIAS_DEFAULT,
  compacto: COMPACTO_DEFAULT,
  chipCategoriaEscala: CHIP_CATEGORIA_ESCALA_DEFAULT,
  cuadroCategoriaEscala: CUADRO_CATEGORIA_ESCALA_DEFAULT,
  setGapCategorias: () => {},
  setCompacto: () => {},
  setChipCategoriaEscala: () => {},
  setCuadroCategoriaEscala: () => {},
  reset: () => {},
});

function prefsDefault() {
  return {
    gapCategorias: GAP_CATEGORIAS_DEFAULT,
    compacto: COMPACTO_DEFAULT,
    chipCategoriaEscala: CHIP_CATEGORIA_ESCALA_DEFAULT,
    cuadroCategoriaEscala: CUADRO_CATEGORIA_ESCALA_DEFAULT,
  };
}

async function mozoEndpoint(id) {
  return apiConfig.isConfigured
    ? `${apiConfig.getEndpoint('/mozos')}/${id}`
    : `${getFallbackApiBase()}/mozos/${id}`;
}

async function leerMozoId() {
  try {
    const raw = await AsyncStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return user?._id || null;
  } catch {
    return null;
  }
}

export function DensidadOrdenesProvider({ children }) {
  const [gapCategorias, setGapState] = useState(GAP_CATEGORIAS_DEFAULT);
  const [compacto, setCompactoState] = useState(COMPACTO_DEFAULT);
  const [chipCategoriaEscala, setChipState] = useState(CHIP_CATEGORIA_ESCALA_DEFAULT);
  const [cuadroCategoriaEscala, setCuadroState] = useState(CUADRO_CATEGORIA_ESCALA_DEFAULT);
  const saveTimer = useRef(null);
  const remoteTimer = useRef(null);
  const prefsRef = useRef(prefsDefault());

  const applyLocal = useCallback((next) => {
    const parsed = parseDensidadOrdenes(next);
    prefsRef.current = parsed;
    setGapState(parsed.gapCategorias);
    setCompactoState(parsed.compacto);
    setChipState(parsed.chipCategoriaEscala);
    setCuadroState(parsed.cuadroCategoriaEscala);
    return parsed;
  }, []);

  const persistRemote = useCallback((next) => {
    if (remoteTimer.current) clearTimeout(remoteTimer.current);
    remoteTimer.current = setTimeout(async () => {
      try {
        const id = await leerMozoId();
        if (!id) return;
        const url = await mozoEndpoint(id);
        await axios.put(url, {
          prefsApp: { cuadroCategoriaEscala: next.cuadroCategoriaEscala },
        }, { timeout: 8000 });
      } catch (e) {
        console.warn('Densidad órdenes: no se pudo guardar en el usuario', e?.message);
      }
    }, 600);
  }, []);

  const persist = useCallback((next, opts = {}) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(DENSIDAD_ORDENES_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
    if (opts.remote) persistRemote(next);
  }, [persistRemote]);

  const hydrateFromUser = useCallback(async () => {
    try {
      const id = await leerMozoId();
      if (!id) return;
      const url = await mozoEndpoint(id);
      const res = await axios.get(url, { timeout: 8000 });
      const remote = res.data?.prefsApp?.cuadroCategoriaEscala;
      if (remote == null) return;
      const next = parseDensidadOrdenes({
        ...prefsRef.current,
        cuadroCategoriaEscala: remote,
      });
      applyLocal(next);
      AsyncStorage.setItem(DENSIDAD_ORDENES_KEY, JSON.stringify(next)).catch(() => {});
    } catch (_) {
      /* se queda la copia local */
    }
  }, [applyLocal]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DENSIDAD_ORDENES_KEY);
        if (raw != null) applyLocal(parseDensidadOrdenes(raw));
      } catch (e) {
        console.warn('Densidad órdenes: no se pudo cargar preferencia', e);
      }
      await hydrateFromUser();
    })();
    const sub = DeviceEventEmitter.addListener(EVT_MOZO_SESSION, () => {
      hydrateFromUser();
    });
    return () => {
      sub.remove();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (remoteTimer.current) clearTimeout(remoteTimer.current);
    };
  }, [applyLocal, hydrateFromUser]);

  const setGapCategorias = useCallback((v) => {
    const nextGap = clampGapCategorias(v);
    setGapState(nextGap);
    persist({ ...prefsRef.current, gapCategorias: nextGap });
  }, [persist]);

  const setCompacto = useCallback((v) => {
    const next = clampCompacto(v);
    setCompactoState(next);
    persist({ ...prefsRef.current, compacto: next });
  }, [persist]);

  const setChipCategoriaEscala = useCallback((v) => {
    const next = clampChipCategoriaEscala(v);
    setChipState(next);
    persist({ ...prefsRef.current, chipCategoriaEscala: next });
  }, [persist]);

  const setCuadroCategoriaEscala = useCallback((v) => {
    const next = clampCuadroCategoriaEscala(v);
    setCuadroState(next);
    persist({ ...prefsRef.current, cuadroCategoriaEscala: next }, { remote: true });
  }, [persist]);

  const reset = useCallback(() => {
    const next = prefsDefault();
    applyLocal(next);
    persist(next, { remote: true });
  }, [applyLocal, persist]);

  return (
    <DensidadOrdenesContext.Provider
      value={{
        gapCategorias,
        compacto,
        chipCategoriaEscala,
        cuadroCategoriaEscala,
        setGapCategorias,
        setCompacto,
        setChipCategoriaEscala,
        setCuadroCategoriaEscala,
        reset,
      }}
    >
      {children}
    </DensidadOrdenesContext.Provider>
  );
}

export function useDensidadOrdenes() {
  return useContext(DensidadOrdenesContext);
}
