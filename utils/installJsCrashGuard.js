/**
 * En release, un JS fatal cierra el Activity. Lo degradamos a log
 * para que ErrorBoundary / la UI puedan seguir en pie.
 */
export function installJsCrashGuard() {
  try {
    const eu = globalThis.ErrorUtils;
    if (!eu?.getGlobalHandler || !eu?.setGlobalHandler) return;
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((error, isFatal) => {
      console.error('[JS crash]', isFatal ? 'fatal' : 'error', error?.message || error);
      if (typeof prev === 'function') prev(error, false);
    });
  } catch (_) { /* noop */ }
}
