import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const MOZOS_BACKGROUND_FETCH_TASK = 'mozos-background-fetch';

TaskManager.defineTask(MOZOS_BACKGROUND_FETCH_TASK, async () => {
  try {
    // Reservado: refetch REST de mesas/comandas cuando el backend exponga un endpoint ligero.
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    console.warn('[backgroundFetch]', e?.message || e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerMozosBackgroundFetch() {
  const registered = await TaskManager.isTaskRegisteredAsync(
    MOZOS_BACKGROUND_FETCH_TASK
  );
  if (registered) return;

  await BackgroundFetch.registerTaskAsync(MOZOS_BACKGROUND_FETCH_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
