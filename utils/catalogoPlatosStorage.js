import AsyncStorage from '@react-native-async-storage/async-storage';

export const CATALOGO_PLATOS_KEY = 'catalogoPlatosMozos:v1';
const MAX_BYTES = 1500000;

export async function leerCatalogoPlatosDisk() {
  try {
    const raw = await AsyncStorage.getItem(CATALOGO_PLATOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.platos)) return null;
    return {
      version: Number(parsed.version) || 1,
      fetchedAt: parsed.fetchedAt || null,
      platos: parsed.platos,
      categoriasInfo: Array.isArray(parsed.categoriasInfo) ? parsed.categoriasInfo : [],
    };
  } catch (e) {
    console.warn('[catalogo] disco ilegible', e?.message);
    return null;
  }
}

export async function escribirCatalogoPlatosDisk({ platos, categoriasInfo, fetchedAt }) {
  try {
    const payload = JSON.stringify({
      version: 1,
      fetchedAt: fetchedAt || new Date().toISOString(),
      platos: Array.isArray(platos) ? platos : [],
      categoriasInfo: Array.isArray(categoriasInfo) ? categoriasInfo : [],
    });
    if (payload.length > MAX_BYTES) {
      console.warn('[catalogo] JSON grande, no se persiste en disco', payload.length);
      return false;
    }
    await AsyncStorage.setItem(CATALOGO_PLATOS_KEY, payload);
    return true;
  } catch (e) {
    console.warn('[catalogo] no se pudo escribir disco', e?.message);
    return false;
  }
}
