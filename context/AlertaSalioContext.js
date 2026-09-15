import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALERTA_SALIO_STORAGE_KEY,
  ALERTA_SALIO_DEFAULTS,
  ALERTA_SALIO_VELOCIDAD,
  parseAlertaSalioPrefs,
} from '../utils/alertaSalioPrefs';

const AlertaSalioPrefsContext = createContext({
  prefs: ALERTA_SALIO_DEFAULTS,
  setPrefs: () => {},
  reset: () => {},
});
const AlertaSalioFaseContext = createContext(0);

export function AlertaSalioProvider({ children }) {
  const [prefs, setPrefsState] = useState(ALERTA_SALIO_DEFAULTS);
  const [fase, setFase] = useState(0);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (prefs.estilo === 'apagado') return undefined;
    const ms = ALERTA_SALIO_VELOCIDAD[prefs.velocidad]?.ms || 750;
    const step = Math.max(220, Math.round(ms / 2));
    const id = setInterval(() => {
      setFase(Math.floor(Date.now() / step));
    }, step);
    return () => clearInterval(id);
  }, [prefs.estilo, prefs.velocidad]);

  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(ALERTA_SALIO_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ALERTA_SALIO_STORAGE_KEY);
        if (cancelled || raw == null) return;
        setPrefsState(parseAlertaSalioPrefs(raw));
      } catch {
        /* default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setPrefs = useCallback((patch) => {
    setPrefsState((prev) => {
      const next = parseAlertaSalioPrefs({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) });
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setPrefsState({ ...ALERTA_SALIO_DEFAULTS });
    persist({ ...ALERTA_SALIO_DEFAULTS });
  }, [persist]);

  const prefsValue = useMemo(() => ({ prefs, setPrefs, reset }), [prefs, setPrefs, reset]);
  return (
    <AlertaSalioPrefsContext.Provider value={prefsValue}>
      <AlertaSalioFaseContext.Provider value={fase}>
        {children}
      </AlertaSalioFaseContext.Provider>
    </AlertaSalioPrefsContext.Provider>
  );
}

export function useAlertaSalioPrefs() {
  return useContext(AlertaSalioPrefsContext);
}

export function useAlertaSalioFase() {
  return useContext(AlertaSalioFaseContext);
}

export function useAlertaSalio() {
  const { prefs, setPrefs, reset } = useAlertaSalioPrefs();
  const fase = useAlertaSalioFase();
  return { prefs, fase, setPrefs, reset };
}
