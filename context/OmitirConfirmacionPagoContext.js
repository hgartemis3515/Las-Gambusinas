import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OMITIR_CONFIRMACION_PAGO_KEY,
  parseOmitirConfirmacionPago,
  setOmitirConfirmacionPagoCache,
} from '../utils/omitirConfirmacionPago';

const OmitirConfirmacionPagoContext = createContext({
  omitirConfirmacionPago: false,
  setOmitirConfirmacionPago: () => {},
});

export function OmitirConfirmacionPagoProvider({ children }) {
  const [omitirConfirmacionPago, setOmitirState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(OMITIR_CONFIRMACION_PAGO_KEY);
        const next = parseOmitirConfirmacionPago(raw);
        setOmitirConfirmacionPagoCache(next);
        setOmitirState(next);
      } catch (e) {
        console.warn('Omitir confirmación pago: no se pudo cargar preferencia', e);
      }
    })();
  }, []);

  const setOmitirConfirmacionPago = useCallback((v) => {
    const next = v === true;
    setOmitirState(next);
    setOmitirConfirmacionPagoCache(next);
    AsyncStorage.setItem(OMITIR_CONFIRMACION_PAGO_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  return (
    <OmitirConfirmacionPagoContext.Provider value={{ omitirConfirmacionPago, setOmitirConfirmacionPago }}>
      {children}
    </OmitirConfirmacionPagoContext.Provider>
  );
}

export function useOmitirConfirmacionPago() {
  return useContext(OmitirConfirmacionPagoContext);
}
