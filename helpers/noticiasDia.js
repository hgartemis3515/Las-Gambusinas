import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../config/axiosConfig';
import apiConfig from '../config/apiConfig';

export const CAT_TOP = '__top__';

const KEY_TOP = '@gambusinas_top_visto';
const KEY_NOTICIAS = '@gambusinas_noticias_vistas';

let cacheTop = { at: 0, platos: [], fechaOperativa: '' };

export function ymdOperativoLima(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    let y = get('year');
    let m = get('month');
    let d = get('day');
    const hour = Number(get('hour'));
    if (hour < 4) {
      const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      dt.setUTCDate(dt.getUTCDate() - 1);
      y = String(dt.getUTCFullYear());
      m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      d = String(dt.getUTCDate()).padStart(2, '0');
    }
    return `${y}-${m}-${d}`;
  } catch (_) {
    return '';
  }
}

function urlApi(path) {
  if (apiConfig.isConfigured && apiConfig.baseURL) return `${apiConfig.baseURL}${path}`;
  throw new Error('API no configurada');
}

export function origenServidor() {
  const base = apiConfig.baseURL || '';
  return base.replace(/\/api\/?$/, '');
}

export async function cargarTopSemana(forzar = false) {
  if (!forzar && cacheTop.platos && Date.now() - cacheTop.at < 10 * 60 * 1000) return cacheTop;
  const res = await axios.get(urlApi('/noticias/top-semana'), { timeout: 12000 });
  cacheTop = {
    at: Date.now(),
    platos: Array.isArray(res.data?.platos) ? res.data.platos : [],
    fechaOperativa: res.data?.fechaOperativa || ymdOperativoLima(),
  };
  return cacheTop;
}

export async function cargarNoticiasHoy() {
  const res = await axios.get(urlApi('/noticias/hoy'), { timeout: 12000 });
  return {
    fechaOperativa: res.data?.fechaOperativa || ymdOperativoLima(),
    noticias: Array.isArray(res.data?.noticias) ? res.data.noticias : [],
  };
}

export function platosDelTop(catalogo, topPlatos) {
  const porId = new Map();
  for (const p of catalogo || []) {
    if (p?.stock != null && p.stock !== undefined && Number(p.stock) <= 0) continue;
    porId.set(String(p._id), p);
  }
  return (topPlatos || []).map((t) => {
    const p = porId.get(String(t._id));
    if (!p) return null;
    return { ...p, _puesto: t.puesto };
  }).filter(Boolean);
}

async function userId() {
  try {
    const raw = await AsyncStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return String(user?._id || user?.id || '');
  } catch (_) {
    return '';
  }
}

export async function topYaVisto(fecha) {
  const id = await userId();
  if (!id || !fecha) return false;
  const v = await AsyncStorage.getItem(`${KEY_TOP}:${id}`);
  return v === fecha;
}

export async function marcarTopVisto(fecha) {
  const id = await userId();
  if (!id || !fecha) return;
  await AsyncStorage.setItem(`${KEY_TOP}:${id}`, fecha);
}

export async function idsNoticiasVistas(fecha) {
  const id = await userId();
  if (!id) return [];
  try {
    const raw = await AsyncStorage.getItem(`${KEY_NOTICIAS}:${id}`);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || data.ymd !== fecha) return [];
    return Array.isArray(data.ids) ? data.ids.map(String) : [];
  } catch (_) {
    return [];
  }
}

export async function marcarNoticiasVistas(fecha, ids) {
  const id = await userId();
  if (!id || !fecha) return;
  await AsyncStorage.setItem(`${KEY_NOTICIAS}:${id}`, JSON.stringify({ ymd: fecha, ids: ids.map(String) }));
}
