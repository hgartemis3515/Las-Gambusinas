import AsyncStorage from "@react-native-async-storage/async-storage";

export const ARMADO_DRAFT_KEY = "armadoComandaDraft";

export function mesaKeyArmado(mesa) {
  if (!mesa) return "";
  if (mesa.sinMesa === true) return "sin-mesa";
  if (mesa._id == null && (mesa.nummesa === "Sin mesa" || mesa.nummesa === "SIN_MESA")) return "sin-mesa";
  return String(mesa._id || mesa.id || "");
}

export function segundosArmadoDesdeT0(t0, ahora = Date.now()) {
  if (t0 == null || !Number.isFinite(Number(t0))) return 0;
  return Math.max(0, Math.round((ahora - Number(t0)) / 1000));
}

export async function leerDraftArmado() {
  try {
    const raw = await AsyncStorage.getItem(ARMADO_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.iniciadoEn == null) return null;
    return d;
  } catch {
    return null;
  }
}

export async function asegurarT0Armado({ mozoId, mesaId, now = Date.now() } = {}) {
  const draft = await leerDraftArmado();
  const same = draft
    && String(draft.mozoId || "") === String(mozoId || "")
    && String(draft.mesaId || "") === String(mesaId || "");
  if (same && Number.isFinite(Number(draft.iniciadoEn))) {
    return Number(draft.iniciadoEn);
  }
  const next = { iniciadoEn: now, mozoId: mozoId || "", mesaId: mesaId || "" };
  await AsyncStorage.setItem(ARMADO_DRAFT_KEY, JSON.stringify(next));
  return now;
}

export async function borrarDraftArmado() {
  try {
    await AsyncStorage.removeItem(ARMADO_DRAFT_KEY);
  } catch (_) {}
}
