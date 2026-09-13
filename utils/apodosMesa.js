export const APODOS_MESA_KEY_PREFIX = '@gambusinas/apodos-mesa/';
export const APODO_MESA_MAX = 24;

export function storageKeyApodosMesa(userId) {
  const id = String(userId || '').trim();
  return `${APODOS_MESA_KEY_PREFIX}${id || 'anon'}`;
}

export function parseApodosMesa(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { data = null; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    const nick = String(v || '').trim().slice(0, APODO_MESA_MAX);
    if (k && nick) out[String(k)] = nick;
  });
  return out;
}

export function claveMesaApodo(mesa) {
  if (mesa?._id != null) return String(mesa._id);
  if (mesa?.nummesa != null && mesa.nummesa !== '') return `n:${mesa.nummesa}`;
  return '';
}

export function apodoDeMesa(map, mesa) {
  const m = map && typeof map === 'object' ? map : {};
  const id = mesa?._id != null ? String(mesa._id) : '';
  const n = mesa?.nummesa != null && mesa.nummesa !== '' ? `n:${mesa.nummesa}` : '';
  return (id && m[id]) || (n && m[n]) || '';
}

export function numeroMesaLabel(mesa) {
  if (!mesa) return 'Mesa';
  if (mesa.sinMesa) return 'Sin mesa';
  const comb = String(mesa.nombreCombinado || '').trim();
  if (comb) return comb;
  const nom = String(mesa.nombre || '').trim();
  if (nom) return nom;
  if (mesa.nummesa != null && mesa.nummesa !== '') return `M${mesa.nummesa}`;
  return 'Mesa';
}

export function textoMesaConApodo(mesa, apodo) {
  const base = numeroMesaLabel(mesa);
  const nick = String(apodo || '').trim();
  return nick ? `${base} · ${nick}` : base;
}
