import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ALERTA_SALIO_STORAGE_KEY,
  ALERTA_SALIO_DEFAULTS,
  parseAlertaSalioPrefs,
} from '../utils/alertaSalioPrefs';

const AlertaSalioContext = createContext({
  prefs: ALERTA_SALIO_DEFAULTS,
  setPrefs: () => {},
  reset: () => {},
});

export function AlertaSalioProvider({ children }) {
  const [prefs, setPrefsState] = useState(ALERTA_SALIO_DEFAULTS);
  const saveTimer = useRef(null);

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

  const value = useMemo(() => ({ prefs, setPrefs, reset }), [prefs, setPrefs, reset]);
  return (
    <AlertaSalioContext.Provider value={value}>
      {children}
    </AlertaSalioContext.Provider>
  );
}

export function useAlertaSalio() {
  return useContext(AlertaSalioContext);
}
