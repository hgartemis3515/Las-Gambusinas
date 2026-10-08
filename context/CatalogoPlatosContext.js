import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';
import { apiConfig } from '../apiConfig';
import { getFallbackApiBase } from '../config/envDefaults';
import { leerCatalogoPlatosDisk, escribirCatalogoPlatosDisk } from '../utils/catalogoPlatosStorage';
import { EVT_MOZO_SESSION } from './DensidadOrdenesContext';

const { applyMenuEventBatch, idCarta } = require('../utils/catalogoPlatosApply');

export const EVT_PLATO_MENU_ACTUALIZADO = 'plato-menu-actualizado';
export const EVT_CATALOGO_PLATOS_RECONNECT = 'catalogo-platos-reconnect';

const TTL_FOREGROUND_MS = 10 * 60 * 1000;
const TTL_RECONNECT_MS = 30 * 1000;
const COALESCE_MS = 300;
const DISK_DEBOUNCE_MS = 600;
const FRESH_MS = 15 * 1000;

const CatalogoPlatosContext = createContext({
  platos: [],
  categoriasInfo: [],
  loaded: false,
  refreshing: false,
  error: null,
  warm: async () => {},
  refresh: async () => ({ platos: [], categoriasInfo: [] }),
  applyMenuEvent: () => {},
  getPlatoById: () => null,
});

function urlPlatosCarta() {
  return apiConfig.isConfigured
    ? apiConfig.getEndpoint('/platos?carta=1')
    : `${getFallbackApiBase()}/platos?carta=1`;
}

function urlCategoriasLigero() {
  return apiConfig.isConfigured
    ? apiConfig.getEndpoint('/platos/categorias?ligero=1')
    : `${getFallbackApiBase()}/platos/categorias?ligero=1`;
}

function urlCategoriasFallback() {
  return apiConfig.isConfigured
    ? apiConfig.getEndpoint('/categorias-plato?ligero=1')
    : `${getFallbackApiBase()}/categorias-plato?ligero=1`;
}

function firmaCarta(list) {
  if (!Array.isArray(list) || list.length === 0) return '0';
  let h = list.length | 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p) continue;
    const id = p._id != null ? String(p._id) : (p.id != null ? String(p.id) : '');
    h = Math.imul(h, 33) ^ id.length;
    h ^= Number(p.precio) || 0;
    h = Math.imul(h, 31) ^ (Number(p.orden) || 0);
    h ^= Number(p.stock) || 0;
    h ^= p.isActive === false ? 1 : 0;
    const nombre = p.nombre ? String(p.nombre) : '';
    for (let j = 0; j < nombre.length; j += 2) h = Math.imul(h, 33) ^ nombre.charCodeAt(j);
    const upd = p.updatedAt ? String(p.updatedAt) : '';
    for (let j = 0; j < upd.length; j++) h = Math.imul(h, 33) ^ upd.charCodeAt(j);
    const comps = Array.isArray(p.complementos) ? p.complementos : [];
    h ^= comps.length;
    for (let c = 0; c < comps.length; c++) {
      const g = comps[c];
      const gn = g && (g.nombre || g.titulo) ? String(g.nombre || g.titulo) : '';
      h = Math.imul(h, 33) ^ gn.length ^ (gn.charCodeAt(0) || 0);
      const ops = g && (g.opciones || g.items);
      h ^= Array.isArray(ops) ? ops.length : 0;
    }
    h ^= Array.isArray(p.nombresSincronizados) ? p.nombresSincronizados.length : 0;
    h ^= Array.isArray(p.tipos) ? p.tipos.length : 0;
    if (p.tipo) h ^= String(p.tipo).length;
  }
  return String(h);
}

function fetchedAtMs(iso) {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

async function fetchCategoriasLigero() {
  try {
    const catRes = await axios.get(urlCategoriasLigero(), { timeout: 5000 });
    return Array.isArray(catRes.data) ? catRes.data : [];
  } catch (_) {
    try {
      const catRes = await axios.get(urlCategoriasFallback(), { timeout: 5000 });
      return Array.isArray(catRes.data) ? catRes.data : [];
    } catch {
      return null;
    }
  }
}

export function CatalogoPlatosProvider({ children }) {
  const [platos, setPlatos] = useState([]);
  const [categoriasInfo, setCategoriasInfo] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const platosRef = useRef([]);
  const catsRef = useRef([]);
  const fetchedAtRef = useRef(null);
  const lastSocketAtRef = useRef(0);
  const pendingEventsRef = useRef([]);
  const coalesceTimer = useRef(null);
  const diskTimer = useRef(null);
  const inflightRef = useRef(null);
  const hydratingRef = useRef(false);
  const firmaRef = useRef('');
  const loadedRef = useRef(false);
  const refreshRef = useRef(async () => ({ platos: [], categoriasInfo: [] }));

  const commitPlatos = useCallback((next, { persist } = {}) => {
    const list = Array.isArray(next) ? next : [];
    const firma = firmaCarta(list);
    const misma = firma === firmaRef.current;
    if (!misma) {
      firmaRef.current = firma;
      platosRef.current = list;
      loadedRef.current = true;
      startTransition(() => {
        setPlatos(list);
        setLoaded(true);
      });
    } else if (!loadedRef.current) {
      loadedRef.current = true;
      setLoaded(true);
    }
    if (persist === false || misma) return;
    if (diskTimer.current) clearTimeout(diskTimer.current);
    diskTimer.current = setTimeout(() => {
      escribirCatalogoPlatosDisk({
        platos: platosRef.current,
        categoriasInfo: catsRef.current,
        fetchedAt: fetchedAtRef.current,
      });
    }, DISK_DEBOUNCE_MS);
  }, []);

  const firmaCatsRef = useRef('');
  const commitCats = useCallback((next) => {
    const list = Array.isArray(next) ? next : [];
    let firma = String(list.length);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      firma += `|${c?.nombre || ''}:${c?.codigoMozo || ''}:${c?.orden || ''}:${c?.imagenUrl || ''}`;
    }
    if (firma === firmaCatsRef.current) return;
    firmaCatsRef.current = firma;
    catsRef.current = list;
    startTransition(() => setCategoriasInfo(list));
  }, []);

  const refresh = useCallback(async ({ force } = {}) => {
    const now = Date.now();
    const age = now - fetchedAtMs(fetchedAtRef.current);
    if (
      !force
      && platosRef.current.length
      && fetchedAtRef.current
      && age >= 0
      && age < FRESH_MS
    ) {
      return { platos: platosRef.current, categoriasInfo: catsRef.current };
    }
    if (inflightRef.current && !force) {
      try {
        return await inflightRef.current;
      } catch (_) {
        return { platos: platosRef.current, categoriasInfo: catsRef.current };
      }
    }

    const run = (async () => {
      const mostrarSpinner = platosRef.current.length === 0;
      if (mostrarSpinner) setRefreshing(true);
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          return { platos: platosRef.current, categoriasInfo: catsRef.current };
        }
        const [platosRes, cats] = await Promise.all([
          axios.get(urlPlatosCarta(), { timeout: 8000 }),
          fetchCategoriasLigero(),
        ]);
        const nextPlatos = Array.isArray(platosRes.data) ? platosRes.data : null;
        if (!nextPlatos) {
          setError('Carta inválida');
          return { platos: platosRef.current, categoriasInfo: catsRef.current };
        }
        if (nextPlatos.length === 0 && platosRef.current.length && !force) {
          if (Array.isArray(cats)) commitCats(cats);
          return { platos: platosRef.current, categoriasInfo: catsRef.current };
        }
        fetchedAtRef.current = new Date().toISOString();
        setError(null);
        if (Array.isArray(cats)) commitCats(cats);
        commitPlatos(nextPlatos);
        return { platos: nextPlatos, categoriasInfo: Array.isArray(cats) ? cats : catsRef.current };
      } catch (e) {
        setError(e?.message || 'No se pudo cargar la carta');
        return { platos: platosRef.current, categoriasInfo: catsRef.current };
      } finally {
        if (mostrarSpinner) setRefreshing(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = run;
    return run;
  }, [commitCats, commitPlatos]);

  refreshRef.current = refresh;

  const flushMenuEvents = useCallback(() => {
    const batch = pendingEventsRef.current;
    pendingEventsRef.current = [];
    if (!batch.length) return;
    lastSocketAtRef.current = Date.now();
    const { platos: next, invalidate } = applyMenuEventBatch(platosRef.current, batch);
    if (invalidate) {
      refreshRef.current({ force: true });
      return;
    }
    fetchedAtRef.current = new Date().toISOString();
    commitPlatos(next);
  }, [commitPlatos]);

  const applyMenuEventIncoming = useCallback((event) => {
    if (!event || typeof event !== 'object') return;
    pendingEventsRef.current.push(event);
    if (coalesceTimer.current) clearTimeout(coalesceTimer.current);
    coalesceTimer.current = setTimeout(flushMenuEvents, COALESCE_MS);
  }, [flushMenuEvents]);

  const warm = useCallback(async () => {
    if (!platosRef.current.length && !hydratingRef.current) {
      hydratingRef.current = true;
      try {
        const disk = await leerCatalogoPlatosDisk();
        if (disk && Array.isArray(disk.platos) && disk.platos.length && !platosRef.current.length) {
          fetchedAtRef.current = disk.fetchedAt || fetchedAtRef.current;
          commitCats(disk.categoriasInfo);
          commitPlatos(disk.platos, { persist: false });
        }
      } finally {
        hydratingRef.current = false;
      }
    }
    refreshRef.current({ force: false });
  }, [commitCats, commitPlatos]);

  const getPlatoById = useCallback((id) => {
    const key = id != null ? String(id) : '';
    if (!key) return null;
    return platosRef.current.find((p) => idCarta(p) === key || String(p.id) === key) || null;
  }, []);

  useEffect(() => {
    warm();
  }, [warm]);

  useEffect(() => {
    const subSession = DeviceEventEmitter.addListener(EVT_MOZO_SESSION, () => {
      warm();
    });
    const subMenu = DeviceEventEmitter.addListener(EVT_PLATO_MENU_ACTUALIZADO, (data) => {
      applyMenuEventIncoming(data || {});
    });
    const subReconnect = DeviceEventEmitter.addListener(EVT_CATALOGO_PLATOS_RECONNECT, () => {
      const age = Date.now() - fetchedAtMs(fetchedAtRef.current);
      if (age > TTL_RECONNECT_MS) refreshRef.current({ force: false });
    });
    const onApp = (state) => {
      if (state !== 'active') return;
      const sinceSocket = Date.now() - (lastSocketAtRef.current || 0);
      const age = Date.now() - fetchedAtMs(fetchedAtRef.current);
      if (sinceSocket < TTL_RECONNECT_MS) return;
      if (age > TTL_FOREGROUND_MS) refreshRef.current({ force: false });
    };
    const appSub = AppState.addEventListener('change', onApp);
    return () => {
      subSession.remove();
      subMenu.remove();
      subReconnect.remove();
      appSub.remove();
      if (coalesceTimer.current) clearTimeout(coalesceTimer.current);
      if (diskTimer.current) clearTimeout(diskTimer.current);
    };
  }, [applyMenuEventIncoming, warm]);

  const value = useMemo(() => ({
    platos,
    categoriasInfo,
    loaded,
    refreshing,
    error,
    warm,
    refresh,
    applyMenuEvent: applyMenuEventIncoming,
    getPlatoById,
  }), [platos, categoriasInfo, loaded, refreshing, error, warm, refresh, applyMenuEventIncoming, getPlatoById]);

  return (
    <CatalogoPlatosContext.Provider value={value}>
      {children}
    </CatalogoPlatosContext.Provider>
  );
}

export function useCatalogoPlatos() {
  return useContext(CatalogoPlatosContext);
}
