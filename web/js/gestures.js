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

const CHROME_IDS = new Set([
  'hud', 'levers', 'sys', 'notebook', 'coach', 'moment', 'feed', 'vitals',
  'hovercard', 'photo-actions', 'restart-ask', 'progressbar',
]);
const CHROME_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'LABEL']);

// The street view is a camera surface. HUD, open cards, and form controls are not.
// Anything else (the page itself, a leftover layer) still orbits, so a dismissed
// card cannot leave the view stuck.
export function cameraGestureTarget(target) {
  let node = target && target.nodeType === 1 ? target : (target && (target.parentElement || target._parent));
  if (!node) return true;
  while (node) {
    if (node.id === 'view') return true;
    const tag = node.tagName ? String(node.tagName).toUpperCase() : '';
    if (CHROME_TAGS.has(tag) || CHROME_IDS.has(node.id)) return false;
    const cls = node.classList;
    if (cls && cls.contains && cls.contains('modal') && cls.contains('show')) return false;
    const role = node.getAttribute && node.getAttribute('role');
    if (role === 'dialog' || role === 'button') return false;
    node = node.parentElement || node._parent || null;
  }
  return true;
}

// A lost touch pointer used to sit in the map and turn every later mouse drag
// into a pinch, which stops orbit. A new mouse press drops those ghosts.
export function stalePointerIds(ids, event) {
  if (!event || event.pointerType !== 'mouse' || event.pointerId == null) return [];
  const drop = [];
  for (const id of ids) if (id !== event.pointerId) drop.push(id);
  return drop;
}

// Mouse moves with no button mean the release was missed. Touch stays put
// until pointerup or pointercancel.
export function mouseButtonsUp(event) {
  return !!(event && event.pointerType === 'mouse' && event.type === 'pointermove' && event.buttons === 0);
}
