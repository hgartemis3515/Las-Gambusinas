/** Decodifica el payload de un JWT sin verificar firma (solo para leer `exp`). */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const seg = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
    const binary = globalThis.atob(seg + pad);
    return JSON.parse(binary);
  } catch {
    return null;
  }
}

/** true si no hay exp o ya venció (30s de margen). */
export function isJwtExpired(token, skewMs = 30_000) {
  const payload = decodeJwtPayload(token);
  if (!payload || payload.exp == null) return true;
  return payload.exp * 1000 <= Date.now() + skewMs;
}

export function msUntilJwtExpiry(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || payload.exp == null) return 0;
  return payload.exp * 1000 - Date.now();
}
