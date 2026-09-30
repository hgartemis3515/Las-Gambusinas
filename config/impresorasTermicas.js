import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'impresorasTermicas';

export const IMPRESORAS_DEFAULT = {
  cocina: { modelo: 'TM-m30III', ip: '192.168.50.228' },
  caja: { modelo: 'TM-m30II', ip: '192.168.50.150' },
};

const PAR_ANTERIOR = { cocina: '192.168.50.150', caja: '192.168.50.228' };

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

export function ipImpresoraValida(ip) {
  const s = String(ip ?? '').trim();
  if (!s) return true;
  return IPV4.test(s);
}

function normalizar(raw) {
  let cocinaIp = String(raw?.cocina?.ip == null ? IMPRESORAS_DEFAULT.cocina.ip : raw.cocina.ip).trim();
  let cajaIp = String(raw?.caja?.ip == null ? IMPRESORAS_DEFAULT.caja.ip : raw.caja.ip).trim();
  if (cocinaIp === PAR_ANTERIOR.cocina && cajaIp === PAR_ANTERIOR.caja) {
    cocinaIp = IMPRESORAS_DEFAULT.cocina.ip;
    cajaIp = IMPRESORAS_DEFAULT.caja.ip;
  }
  return {
    cocina: { modelo: 'TM-m30III', ip: cocinaIp },
    caja: { modelo: 'TM-m30II', ip: cajaIp },
  };
}

export async function leerImpresorasTermicas() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizar(null);
    return normalizar(JSON.parse(raw));
  } catch {
    return normalizar(null);
  }
}

export async function guardarImpresorasTermicas(cfg) {
  const next = normalizar(cfg);
  if (!ipImpresoraValida(next.cocina.ip) || !ipImpresoraValida(next.caja.ip)) {
    const err = new Error('Escribe una IPv4 válida o deja el campo vacío.');
    err.code = 'IP_INVALIDA';
    throw err;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
