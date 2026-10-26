// React Native 0.88 quitó InteractionManager. El stack de navegación lo
// importa al arrancar; sin este reemplazo Expo Go cierra en Card.tsx.
const ReactNative = require('react-native');

const handles = new Set();
const tasks = [];
let nextHandle = 1;
let scheduled = false;

function schedule() {
  if (scheduled || handles.size > 0 || tasks.length === 0) return;
  scheduled = true;
  requestIdleCallback(() => {
    scheduled = false;
    if (handles.size > 0) return;
    const batch = tasks.splice(0, tasks.length);
    for (const run of batch) run();
  }, { timeout: 32 });
}

export function runAfterInteractions(task) {
  let cancelled = false;
  const api = {
    cancel() {
      cancelled = true;
    },
  };
  tasks.push(() => {
    if (!cancelled && typeof task === 'function') task();
  });
  schedule();
  return api;
}

const InteractionManager = {
  createInteractionHandle() {
    const handle = nextHandle++;
    handles.add(handle);
    return handle;
  },
  clearInteractionHandle(handle) {
    handles.delete(handle);
    schedule();
  },
  runAfterInteractions,
  addListener() {
    return { remove() {} };
  },
  setDeadline() {},
};

Object.defineProperty(ReactNative, 'InteractionManager', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: InteractionManager,
});
