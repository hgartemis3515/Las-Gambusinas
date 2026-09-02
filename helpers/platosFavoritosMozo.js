import AsyncStorage from "@react-native-async-storage/async-storage";

export const CAT_FAVORITOS = "__favoritos__";

export function storageKeyFavoritos(mozoId) {
  return `platosFavoritos:${String(mozoId || "")}`;
}

export function normalizeFavoritoIds(arr) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    const id = String(x && x._id ? x._id : x);
    if (!id || id === "undefined" || id === "null") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function loadFavoritosLocal(mozoId) {
  if (!mozoId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKeyFavoritos(mozoId));
    return normalizeFavoritoIds(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return [];
  }
}

export async function saveFavoritosLocal(mozoId, ids) {
  if (!mozoId) return;
  try {
    await AsyncStorage.setItem(storageKeyFavoritos(mozoId), JSON.stringify(normalizeFavoritoIds(ids)));
  } catch (_) {}
}
