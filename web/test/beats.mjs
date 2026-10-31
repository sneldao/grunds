// beats.mjs — the seeded mid-day timetable.
// Proves: determinism per (seed, day), different seeds diverge, day-1 always
// asks, offer indices never repeat within a week, exactly one of days 2–5 is
// ask-free, incident days carry 0/1/2 in the agreed shape with no index
// repeating within a week, windows and gaps are respected, and the module
// never calls bare Math.random.
// Run: node web/test/beats.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planAsk, planIncidents } from '../js/beats.js';

const fails = [];
const check = (name, cond, detail) => {
  if (cond) console.log('  PASS', name);
  else fails.push(`${name}: ${detail || 'failed'}`);
};

const OFFERS = 5, INCIDENTS = 7;

// determinism: same seed + day → identical plans
{
  let same = true;
  for (const seed of [3, 42, 777]) for (let day = 1; day <= 10; day++) {
    const a = planAsk(seed, day, OFFERS), b = planAsk(seed, day, OFFERS);
    if (a.offerIdx !== b.offerIdx || a.offerAt !== b.offerAt) same = false;
    const x = planIncidents(seed, day, INCIDENTS), y = planIncidents(seed, day, INCIDENTS);
    if (x.length !== y.length || x.some((e, i) => e.idx !== y[i].idx || e.at !== y[i].at)) same = false;
  }
  check('same seed + day replays the same plan', same);
}

// different seeds produce different weeks
{
  let differ = false;
  for (const pair of [[1, 2], [7, 99], [13, 500]]) {
    let any = false;
    for (let day = 1; day <= 5; day++) {
      const a = planAsk(pair[0], day, OFFERS), b = planAsk(pair[1], day, OFFERS);
      if (a.offerIdx !== b.offerIdx || a.offerAt !== b.offerAt) any = true;
    }
    if (any) differ = true;
  }
  check('different seeds diverge somewhere in the week', differ);
}

// day 1 always has an ask; windows respected
{
  let ok = true;
  for (let seed = 0; seed < 60; seed++) {
    const p = planAsk(seed, 1, OFFERS);
    if (p.offerIdx === null || p.offerAt < 630 || p.offerAt > 750) ok = false;
  }
  check('day 1 always asks, inside 630–750', ok);
  let win = true;
  for (let seed = 0; seed < 60; seed++) for (let day = 1; day <= 10; day++) {
    const p = planAsk(seed, day, OFFERS);
    if (p.offerIdx !== null && (p.offerAt < 630 || p.offerAt > 750)) win = false;
    if (p.offerIdx !== null && (p.offerIdx < 0 || p.offerIdx >= OFFERS)) win = false;
  }
  check('every ask lands in 630–750 with a valid index', win);
}

// weekly ask shape: one quiet day among 2–5, no repeated offer index
{
  let ok = true, detail = '';
  for (let seed = 0; seed < 80; seed++) {
    const seen = new Set();
    let quiet = 0;
    for (let day = 1; day <= 5; day++) {
      const p = planAsk(seed, day, OFFERS);
      if (p.offerIdx === null) { if (day === 1) { ok = false; detail = `seed ${seed} quiet day 1`; } else quiet++; }
      else { if (seen.has(p.offerIdx)) { ok = false; detail = `seed ${seed} repeats ${p.offerIdx}`; } seen.add(p.offerIdx); }
    }
    if (quiet !== 1) { ok = false; detail = `seed ${seed} has ${quiet} quiet days`; }
  }
  check('exactly one of days 2–5 is quiet; each offer used at most once per week', ok, detail);
}

// incident shape: days<2 clean; days 2–5 → counts 0,1,1,2 in some order;
// windows 895–1005; second ≥40 after first; no index repeats within a week.
{
  check('day 1 has no incidents', planIncidents(5, 1, INCIDENTS).length === 0);
  let ok = true, detail = '';
  for (let seed = 0; seed < 80; seed++) {
    const counts = [], used = new Set();
    for (let day = 2; day <= 5; day++) {
      const list = planIncidents(seed, day, INCIDENTS);
      counts.push(list.length);
      for (const e of list) {
        if (e.at < 895 || e.at > 1005) { ok = false; detail = `seed ${seed} day ${day} at ${e.at}`; }
        if (used.has(e.idx)) { ok = false; detail = `seed ${seed} repeats incident ${e.idx}`; }
        used.add(e.idx);
      }
      if (list.length === 2 && list[1].at - list[0].at < 40) { ok = false; detail = `seed ${seed} day ${day} gap ${list[1].at - list[0].at}`; }
    }
    const sorted = [...counts].sort().join(',');
    if (sorted !== '0,1,1,2') { ok = false; detail = `seed ${seed} counts ${counts}`; }
  }
  check('days 2–5 carry exactly one 0-day, one 2-day, two 1-days; windows + gap + no weekly repeat', ok, detail);
}

// weeks beyond the first keep working
{
  let ok = true;
  for (let seed = 0; seed < 20; seed++) for (let day = 6; day <= 10; day++) {
    const p = planAsk(seed, day, OFFERS);
    if (p.offerIdx !== null && (p.offerIdx < 0 || p.offerIdx >= OFFERS)) ok = false;
    for (const e of planIncidents(seed, day, INCIDENTS)) if (e.at < 895 || e.at > 1005) ok = false;
  }
  check('week 2 plans stay in range', ok);
}

// the module never rolls a bare Math.random
{
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'beats.js'), 'utf8');
  check('beats.js contains no Math.random', !/Math\.random/.test(src));
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — beats: seeded timetable (asks + incidents) is deterministic, weekly-shaped, and window-safe');
