// beats.js — the seeded mid-day timetable. Which regular asks, and when the
// floor bites back, is drawn from (seed, day) — never the wall clock —
// so a replayed week runs the same beats.
//
// Weekly shape (days 1–5, then repeating per week):
//   asks      — day 1 always has one; exactly one of days 2–5 is quiet;
//               each offer index is used at most once per week.
//   incidents — days 2–5 only; exactly one day gets none, exactly one gets
//               two, the rest one; no incident index repeats within a week.
import { seeded } from './exchange.js';

function weekParts(day) {
  const week = Math.floor((day - 1) / 5);
  const dow = ((day - 1) % 5) + 1;
  return { week, dow };
}

// A tiny deterministic shuffle over 0..n-1 keyed by (seed, week, salt).
function weekShuffle(seed, week, n, salt) {
  const rng = seeded((((seed >>> 0) ^ Math.imul(week + 1, 2654435761) ^ Math.imul(salt, 97)) >>> 0) || 1);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roll(seed, day, salt, span) {
  const rng = seeded((((seed >>> 0) ^ Math.imul(day + 1, 2246822519) ^ Math.imul(salt, 3266489917)) >>> 0) || 1);
  return (rng() * span) | 0;
}

// Which days of the week carry an ask: day 1 always; exactly one of 2..5 quiet.
export function askDays(seed, week) {
  const skip = 2 + roll(seed, (week * 5) + 2, 11, 4);   // one of days 2..5
  const days = [];
  for (let d = 1; d <= 5; d++) if (d !== skip) days.push(d);
  return days;   // [1, a, b, c] — four ask days in order
}

// Per-week incident counts for days 2..5: a seeded order of [0, 1, 1, 2].
export function incidentCounts(seed, week) {
  const order = weekShuffle(seed, week, 4, 13);
  const counts = [0, 1, 1, 2];
  return order.map(i => counts[i]);
}

export function planAsk(seed, day, offerCount) {
  if (offerCount <= 0 || day < 1) return { offerIdx: null, offerAt: null };
  const { week, dow } = weekParts(day);
  const days = askDays(seed, week);
  const ord = days.indexOf(dow);
  if (ord < 0) return { offerIdx: null, offerAt: null };
  const perm = weekShuffle(seed, week, offerCount, 3);
  return { offerIdx: perm[ord % perm.length], offerAt: 630 + roll(seed, day, 17, 121) };
}

export function planIncidents(seed, day, incidentCount) {
  if (day < 2 || incidentCount <= 0) return [];
  const { week, dow } = weekParts(day);
  const counts = incidentCounts(seed, week);
  const n = counts[dow - 2];
  if (!n) return [];
  // Indices are dealt from a week permutation in day order so no incident
  // index repeats within a week.
  let offset = 0;
  for (let d = 2; d < dow; d++) offset += counts[d - 2];
  const perm = weekShuffle(seed, week, incidentCount, 23);
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = perm[(offset + i) % perm.length];
    let at;
    if (n === 1) at = 895 + roll(seed, day, 29, 111);
    else if (i === 0) at = 895 + roll(seed, day, 31, 71);   // 895..965
    else at = Math.min(1005, out[0].at + 40 + roll(seed, day, 37, 70));
    out.push({ idx, at });
  }
  return out;
}
