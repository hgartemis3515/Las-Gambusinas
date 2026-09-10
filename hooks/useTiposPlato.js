import { useEffect, useState, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import axios from 'axios';
import apiConfig from '../config/apiConfig';
import { getFallbackApiBase } from '../config/envDefaults';

export const EVT_TIPOS_PLATO_ACTUALIZADOS = 'tipos-plato-reglas-actualizadas';

function listaTipos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tipos)) return data.tipos;
  if (Array.isArray(data?.value)) return data.value;
  return [];
}

function ordenarTipos(data) {
  return listaTipos(data).slice().sort((a, b) => (a.orden || 99) - (b.orden || 99));
}

/**
 * Hook reutilizable para cargar el catálogo de tipos de plato desde el backend.
 *
 * Devuelve:
 *   - tipos: array de { slug, nombre, nombreCorto, icono, color, orden, activo }
 *   - loading: boolean
 *   - error: string | null
 *   - refresh(): vuelve a cargar
 *   - getTipoBySlug(slug): tipo encontrado
 *   - labelFor(slug): texto legible ("🌙 Cena")
 *
 * Fuente: GET /api/tipos-plato/menu (público para apps)
 */
const useTiposPlato = (opts = {}) => {
  const { soloActivos = true, autoLoad = true } = opts;
  const [tipos, setTipos] = useState([]);
  const tiposRef = useRef([]);
  tiposRef.current = tipos;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTipos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = apiConfig.isConfigured
        ? apiConfig.getEndpoint('/tipos-plato/menu')
        : `${getFallbackApiBase()}/tipos-plato/menu`;
      const qs = soloActivos ? '?activos=true' : '';
      const response = await axios.get(`${url}${qs}`, { timeout: 5000 });
      const data = Array.isArray(response.data) ? response.data : (response.data?.value || []);
      const sorted = ordenarTipos(data);
      setTipos(sorted);
      return sorted;
    } catch (e) {
      console.warn('useTiposPlato: no se pudo cargar catálogo, fallback legacy', e?.message);
      setError(e?.message || 'Error');
      if (tiposRef.current.length) return tiposRef.current;
      const fallback = [
        { slug: 'platos-desayuno', nombre: 'Desayuno', nombreCorto: 'DESAYUNO', icono: '🌅', color: '#ffa502', orden: 1, activo: true },
        { slug: 'plato-carta normal', nombre: 'Carta', nombreCorto: 'CARTA', icono: '🍽️', color: '#3498db', orden: 2, activo: true },
      ];
      setTipos(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [soloActivos]);

  useEffect(() => {
    if (autoLoad) fetchTipos();
  }, [autoLoad, fetchTipos]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVT_TIPOS_PLATO_ACTUALIZADOS, (data) => {
      const sorted = ordenarTipos(data);
      if (sorted.length) setTipos(sorted);
      else fetchTipos();
    });
    return () => sub.remove();
  }, [fetchTipos]);

  const getTipoBySlug = useCallback((slug) => {
    if (!slug) return null;
    return tipos.find(t => t.slug === slug) || null;
  }, [tipos]);

  const labelFor = useCallback((slug) => {
    const t = getTipoBySlug(slug);
    if (t) return `${t.icono || '🍽️'} ${t.nombre}`;
    if (slug === 'platos-desayuno') return '🌅 Desayuno';
    if (slug === 'plato-carta normal') return '🍽️ Carta';
    if (slug === 'carta-normal') return '🍽️ Carta';
    return slug;
  }, [getTipoBySlug]);

  return { tipos, loading, error, refresh: fetchTipos, getTipoBySlug, labelFor };
};

export default useTiposPlato;