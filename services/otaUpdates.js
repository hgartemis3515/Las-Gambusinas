import * as Updates from 'expo-updates';

/**
 * Comprueba y aplica actualizaciones OTA (EAS Update) en builds de release.
 * El canal debe coincidir con el del perfil de build (p. ej. preview → channel preview).
 */
export async function checkAndApplyOtaUpdate() {
  if (__DEV__) return { applied: false, reason: 'dev' };

  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) {
      return { applied: false, reason: 'no_update' };
    }
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return { applied: true };
  } catch (error) {
    console.warn('[OTA] Error al comprobar actualización:', error?.message || error);
    return { applied: false, reason: 'error', error };
  }
}

export function getOtaRuntimeInfo() {
  return {
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}
