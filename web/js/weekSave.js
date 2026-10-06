// Local dawn save. The title screen reads this back after a refresh.
// The sim snapshot itself is assembled by main.js; this module only
// stores, loads, and labels it.
export const WEEK_SAVE_KEY = 'grunds.week';

export function saveWeek(storage, snap) {
  if (!storage || !snap || typeof snap.day !== 'number') return null;
  const body = { v: 1, savedAt: Date.now(), ...snap };
  storage.setItem(WEEK_SAVE_KEY, JSON.stringify(body));
  return body;
}

export function loadWeek(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEEK_SAVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || typeof o.day !== 'number' || o.day < 1 || o.day > 5) return null;
    return o;
  } catch {
    return null;
  }
}

export function clearWeek(storage) {
  try { storage && storage.removeItem(WEEK_SAVE_KEY); } catch { /* private mode */ }
}

export function resumeLabel(save) {
  if (!save || typeof save.day !== 'number') return '';
  return `resume day ${save.day}`;
}
