const TZ_LIMA = 'America/Lima';

export function parseHoraHHMM(raw) {
  const s = String(raw || '').trim();
  if (s === '24:00' || s === '24:00:00') return '24:00';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59) return '';
  if (h === 24 && min === 0) return '24:00';
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function horaAHMinutos(raw) {
  const hhmm = parseHoraHHMM(raw);
  if (!hhmm) return null;
  if (hhmm === '24:00') return 24 * 60;
  const [h, min] = hhmm.split(':').map(Number);
  return h * 60 + min;
}

export function minutosEnZona(date = new Date(), tz = TZ_LIMA) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const min = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

export function minutosEnRango(nowMin, iniMin, finMin) {
  if (nowMin == null || iniMin == null || finMin == null) return false;
  if (iniMin === finMin) return true;
  if (iniMin < finMin) return nowMin >= iniMin && nowMin < finMin;
  return nowMin >= iniMin || nowMin < finMin;
}

export function duracionRangoMin(iniMin, finMin) {
  if (iniMin == null || finMin == null) return 24 * 60;
  if (iniMin === finMin) return 24 * 60;
  if (iniMin < finMin) return finMin - iniMin;
  return 24 * 60 - iniMin + finMin;
}

export function tipoMenuEnHorario(tipo, nowMin) {
  if (!tipo || tipo.activo === false) return false;
  const on = tipo.horaRedirectActiva === true
    || tipo.horaRedirectActiva === 'true'
    || tipo.horaRedirectActiva === 1;
  if (!on) return false;
  const ini = horaAHMinutos(tipo.horaRedirectInicio);
  const fin = horaAHMinutos(tipo.horaRedirectFin);
  return minutosEnRango(nowMin, ini, fin);
}

/** Tipo de menú cuyo rango cubre ahora (Lima). Si hay varios, el de ventana más corta. */
export function slugTipoPorHoraActual(tipos, date = new Date()) {
  const now = minutosEnZona(date);
  const list = (Array.isArray(tipos) ? tipos : []).filter((t) => tipoMenuEnHorario(t, now));
  if (!list.length) return null;
  list.sort((a, b) => {
    const da = duracionRangoMin(horaAHMinutos(a.horaRedirectInicio), horaAHMinutos(a.horaRedirectFin));
    const db = duracionRangoMin(horaAHMinutos(b.horaRedirectInicio), horaAHMinutos(b.horaRedirectFin));
    if (da !== db) return da - db;
    return (a.orden || 99) - (b.orden || 99);
  });
  return list[0]?.slug || null;
}

/** Recarga el catálogo si se puede y devuelve el slug de la carta de ahora (Lima). */
export async function resolverSlugMenuPorHora(refreshFn, catalogoActual) {
  let tipos = Array.isArray(catalogoActual) ? catalogoActual : [];
  if (typeof refreshFn === 'function') {
    try {
      const fresh = await refreshFn();
      if (Array.isArray(fresh) && fresh.length) tipos = fresh;
    } catch (_) { /* usar catálogo en memoria */ }
  }
  return slugTipoPorHoraActual(tipos);
}
