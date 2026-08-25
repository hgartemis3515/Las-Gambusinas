import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lasgambusinas_online_badge_opacity';
export const DEFAULT_ONLINE_BADGE_OPACITY = 0.55;
const MIN = 0.1;
const MAX = 1;

const OnlineBadgeContext = createContext({
  opacity: DEFAULT_ONLINE_BADGE_OPACITY,
  setOpacity: () => {},
});

function clampOpacity(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return DEFAULT_ONLINE_BADGE_OPACITY;
  return Math.max(MIN, Math.min(MAX, n));
}

export function OnlineBadgeProvider({ children }) {
  const [opacity, setOpacityState] = useState(DEFAULT_ONLINE_BADGE_OPACITY);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved != null) setOpacityState(clampOpacity(saved));
      } catch (e) {
        console.warn('OnlineBadge: no se pudo cargar transparencia', e);
      }
    })();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setOpacity = useCallback((v) => {
    const next = clampOpacity(v);
    setOpacityState(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
    }, 250);
  }, []);

  return (
    <OnlineBadgeContext.Provider value={{ opacity, setOpacity }}>
      {children}
    </OnlineBadgeContext.Provider>
  );
}

export function useOnlineBadge() {
  return useContext(OnlineBadgeContext);
}
