// Pointer gestures for the street camera. Pure so the drag threshold and
// pinch math can be tested without a WebGL context.
export const DRAG_THRESHOLD_PX = 6;

export function dragExceeded(dx, dy, threshold = DRAG_THRESHOLD_PX) {
  return (dx * dx + dy * dy) >= threshold * threshold;
}

export function pointerDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

// Fingers spreading shrinks the orbit radius (zoom in). Returns the next r.
export function pinchRadius(startDist, nowDist, startR, min = 10, max = 34) {
  if (!(startDist > 0) || !(nowDist > 0) || !(startR > 0)) return startR;
  const next = startR * (startDist / nowDist);
  return Math.max(min, Math.min(max, next));
}

export function touchPrimary() {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}
