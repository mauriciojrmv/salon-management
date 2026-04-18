// Subtle haptic feedback for key actions. Uses navigator.vibrate on Android;
// iOS Safari ignores vibrate so this is a no-op there — visual feedback still
// carries the interaction. Kept intentionally light: we never vibrate on
// passive events like page loads or list scrolls.

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(pattern);
  } catch {
    // ignore — some browsers throw when called without user gesture
  }
}

export const haptic = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  success: () => vibrate([12, 40, 12]),
  warning: () => vibrate([20, 60, 20]),
};
