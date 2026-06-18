/**
 * Utilidades para cargar el logo de la plantilla de voucher en dispositivos móviles.
 * Soporta data URLs (base64), rutas relativas (/assets/...) y URLs absolutas.
 */
import { getServerBaseURL } from '../apiConfig';

export function resolveLogoUrl(logo, serverOrigin) {
  if (!logo) return '';
  const s = String(logo).trim();
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) {
    return s;
  }
  const origin = serverOrigin || getServerBaseURL();
  if (!origin) return s;
  if (s.startsWith('/')) return `${origin}${s}`;
  return `${origin}/${s}`;
}

export function isPngLogo(logo) {
  const lower = String(logo || '').toLowerCase();
  return lower.includes('image/png') || lower.includes('.png');
}

function decodeDataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('data URL inválida');
  const b64 = dataUrl.slice(comma + 1);
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * @returns {Promise<{ bytes: Uint8Array, isPng: boolean }>}
 */
export async function loadLogoBytes(logo, serverOrigin) {
  const resolved = resolveLogoUrl(logo, serverOrigin);
  if (!resolved) throw new Error('logo vacío');

  if (resolved.startsWith('data:')) {
    return {
      bytes: decodeDataUrlToBytes(resolved),
      isPng: isPngLogo(resolved),
    };
  }

  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`No se pudo cargar el logo (${res.status})`);
  const buf = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    isPng: isPngLogo(resolved),
  };
}
