import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVT_MOZO_SESSION } from './DensidadOrdenesContext';
import {
  storageKeyApodosMesa,
  parseApodosMesa,
  apodoDeMesa,
  claveMesaApodo,
  APODO_MESA_MAX,
} from '../utils/apodosMesa';

const ApodosMesaContext = createContext({
  apodos: {},
  apodoDe: () => '',
  setApodo: async () => {},
});

async function leerUserId() {
  try {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return String(u?._id || u?.id || '');
  } catch {
    return '';
  }
}

export function ApodosMesaProvider({ children }) {
  const [userId, setUserId] = useState('');
  const [apodos, setApodos] = useState({});
  const saveTimer = useRef(null);

  const load = useCallback(async () => {
    const uid = await leerUserId();
    setUserId(uid);
    if (!uid) {
      setApodos({});
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(storageKeyApodosMesa(uid));
      setApodos(parseApodosMesa(raw));
    } catch {
      setApodos({});
    }
  }, []);

  useEffect(() => {
    load();
    const sub = DeviceEventEmitter.addListener(EVT_MOZO_SESSION, load);
    return () => sub.remove();
  }, [load]);

  const persist = useCallback((uid, next) => {
    if (!uid) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(storageKeyApodosMesa(uid), JSON.stringify(next)).catch(() => {});
    }, 180);
  }, []);

  const setApodo = useCallback((mesa, texto) => {
    const key = claveMesaApodo(mesa);
    if (!key) return;
    const nick = String(texto || '').trim().slice(0, APODO_MESA_MAX);
    setApodos((prev) => {
      const next = { ...prev };
      if (nick) next[key] = nick;
      else delete next[key];
      persist(userId, next);
      return next;
    });
  }, [persist, userId]);

  const apodoDe = useCallback((mesa) => apodoDeMesa(apodos, mesa), [apodos]);

  const value = useMemo(() => ({ apodos, apodoDe, setApodo }), [apodos, apodoDe, setApodo]);

  return (
    <ApodosMesaContext.Provider value={value}>
      {children}
    </ApodosMesaContext.Provider>
  );
}

export function useApodosMesa() {
  return useContext(ApodosMesaContext);
}
