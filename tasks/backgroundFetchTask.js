import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const MOZOS_BACKGROUND_FETCH_TASK = 'mozos-background-fetch';

try {
  TaskManager.defineTask(MOZOS_BACKGROUND_FETCH_TASK, async () => {
    try {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e) {
      console.warn('[backgroundFetch]', e?.message || e);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.warn('[backgroundFetch] defineTask omitido:', e?.message || e);
}

export async function registerMozosBackgroundFetch() {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(
      MOZOS_BACKGROUND_FETCH_TASK
    );
    if (registered) return;

    await BackgroundFetch.registerTaskAsync(MOZOS_BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn('[backgroundFetch] registro omitido:', e?.message || e);
  }
}
