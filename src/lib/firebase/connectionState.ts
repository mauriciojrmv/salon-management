// Lightweight observable store for Firestore connection + pending write state.
// Used by the ConnectionPill to tell workers at a glance whether their taps
// have been acknowledged by the server — critical on the salon's flaky wifi.
//
// `pending` counts mutations that have started but not yet resolved. It is
// incremented/decremented by the `trackWrite` wrapper (see db.ts). When offline,
// pending writes sit in Firestore's IndexedDB queue and flush on reconnect.

type Listener = () => void;

const listeners = new Set<Listener>();
let pending = 0;

function notify() {
  listeners.forEach((l) => l());
}

export function beginWrite() {
  pending += 1;
  notify();
}

export function endWrite() {
  pending = Math.max(0, pending - 1);
  notify();
}

export function getPendingCount(): number {
  return pending;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function trackWrite<T>(fn: () => Promise<T>): Promise<T> {
  beginWrite();
  try {
    return await fn();
  } finally {
    endWrite();
  }
}
