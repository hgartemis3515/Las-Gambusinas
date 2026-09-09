import apiConfig from '../config/apiConfig';
import { getFallbackApiBase } from '../config/envDefaults';

export function originServidor() {
  const base = apiConfig.isConfigured && apiConfig.baseURL
    ? apiConfig.baseURL
    : getFallbackApiBase();
  return String(base || '').replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/** Convierte /uploads/... del backend en URL absoluta para Image. */
export function urlMediaServidor(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const origin = originServidor();
  if (!origin) return p.startsWith('/') ? p : `/${p}`;
  return `${origin}${p.startsWith('/') ? p : `/${p}`}`;
}
