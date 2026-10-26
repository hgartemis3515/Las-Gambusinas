// InteractionManager se eliminó en React Native 0.88. Corre fuera del frame
// actual y se puede cancelar, igual que runAfterInteractions.
export function runAfterInteractions(task) {
  let cancelled = false;
  const id = requestIdleCallback(() => {
    if (!cancelled && typeof task === 'function') task();
  }, { timeout: 32 });
  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelIdleCallback(id);
    },
  };
}
