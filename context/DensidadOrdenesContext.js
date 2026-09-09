import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DENSIDAD_ORDENES_KEY,
  GAP_CATEGORIAS_DEFAULT,
  COMPACTO_DEFAULT,
  CHIP_CATEGORIA_ESCALA_DEFAULT,
  clampGapCategorias,
  clampCompacto,
  clampChipCategoriaEscala,
  parseDensidadOrdenes,
} from '../utils/densidadOrdenes';

const DensidadOrdenesContext = createContext({
  gapCategorias: GAP_CATEGORIAS_DEFAULT,
  compacto: COMPACTO_DEFAULT,
  chipCategoriaEscala: CHIP_CATEGORIA_ESCALA_DEFAULT,
  setGapCategorias: () => {},
  setCompacto: () => {},
  setChipCategoriaEscala: () => {},
  reset: () => {},
});

export function DensidadOrdenesProvider({ children }) {
  const [gapCategorias, setGapState] = useState(GAP_CATEGORIAS_DEFAULT);
  const [compacto, setCompactoState] = useState(COMPACTO_DEFAULT);
  const [chipCategoriaEscala, setChipState] = useState(CHIP_CATEGORIA_ESCALA_DEFAULT);
  const saveTimer = useRef(null);
  const prefsRef = useRef({
    gapCategorias: GAP_CATEGORIAS_DEFAULT,
    compacto: COMPACTO_DEFAULT,
    chipCategoriaEscala: CHIP_CATEGORIA_ESCALA_DEFAULT,
  });

  const persist = useCallback((next) => {
    prefsRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(DENSIDAD_ORDENES_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DENSIDAD_ORDENES_KEY);
        if (raw == null) return;
        const next = parseDensidadOrdenes(raw);
        prefsRef.current = next;
        setGapState(next.gapCategorias);
        setCompactoState(next.compacto);
        setChipState(next.chipCategoriaEscala);
      } catch (e) {
        console.warn('Densidad órdenes: no se pudo cargar preferencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

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

  const reset = useCallback(() => {
    const next = {
      gapCategorias: GAP_CATEGORIAS_DEFAULT,
      compacto: COMPACTO_DEFAULT,
      chipCategoriaEscala: CHIP_CATEGORIA_ESCALA_DEFAULT,
    };
    setGapState(next.gapCategorias);
    setCompactoState(next.compacto);
    setChipState(next.chipCategoriaEscala);
    persist(next);
  }, [persist]);

  return (
    <DensidadOrdenesContext.Provider
      value={{
        gapCategorias,
        compacto,
        chipCategoriaEscala,
        setGapCategorias,
        setCompacto,
        setChipCategoriaEscala,
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
