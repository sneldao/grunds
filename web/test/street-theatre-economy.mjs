// web/test/street-theatre-economy.mjs — pillar 3 "make theatre pay".
// The street's attention gathers on a seeded timetable; while a window is
// live the frontage conversion rolls against lifted awareness. The plan is a
// pure function of (seed, day) read off the sim-minute clock, so it never
// touches the wall-clock vignette agents and stays frame-clock invariant.
// Run: node --test web/test/street-theatre-economy.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTheatre, theatreAt, THEATRE_KINDS } from '../js/street.js';
import { frontageChance } from '../js/frontage.js';

test('planTheatre is pure in (seed, day)', () => {
  const a = planTheatre(7, 2), b = planTheatre(7, 2);
  assert.deepEqual(a, b, 'same seed+day must deal the same day of theatre');
  assert.equal(a.length, 3, 'three windows a day');
  // a different day or seed deals a different hand (not guaranteed every
  // field differs, but the plan as a whole should not be a constant)
  const other = planTheatre(8, 2);
  assert.notDeepEqual(JSON.stringify(a), JSON.stringify(other));
});

test('windows stay inside the trading band and never overlap', () => {
  for (const seed of [1, 7, 11, 42, 99]) {
    for (let day = 1; day <= 5; day++) {
      const w = planTheatre(seed, day);
      const sorted = [...w].sort((x, y) => x.start - y.start);
      for (const win of sorted) {
        assert.ok(win.start >= 400 && win.end <= 1120, `window out of band: ${win.start}-${win.end}`);
        assert.ok(win.end > win.start, 'window has positive length');
        assert.ok(win.end - win.start >= 16 && win.end - win.start <= 26, 'window length in 16..26');
      }
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(sorted[i].start >= sorted[i - 1].end, 'windows must not overlap');
      }
    }
  }
});

test('every window carries a valid kind, boost and line', () => {
  for (const seed of [3, 17]) {
    for (const w of planTheatre(seed, 1)) {
      const def = THEATRE_KINDS[w.kind];
      assert.ok(def, `unknown theatre kind ${w.kind}`);
      assert.equal(w.boost, def.boost);
      assert.equal(w.line, def.line);
      assert.ok(w.boost > 0 && w.boost < 1, 'boost is a partial awareness lift');
    }
  }
});

test('theatreAt: inclusive start, exclusive end, null outside', () => {
  const w = planTheatre(7, 1);
  for (const win of w) {
    assert.equal(theatreAt(w, win.start), win, 'window is live at its start');
    assert.equal(theatreAt(w, win.end - 1), win, 'window is live one minute before end');
    assert.equal(theatreAt(w, win.end), null, 'window closes at its end minute');
    assert.equal(theatreAt(w, win.start - 1), null, 'not live before start');
  }
  assert.equal(theatreAt(w, 0), null);
  assert.equal(theatreAt(w, NaN), null);
  assert.equal(theatreAt(null, 500), null);
  assert.equal(theatreAt([], 500), null);
});

test('the lift raises the conversion chance while a window is live', () => {
  const awareness = 0.2, reputation = 60;
  const base = frontageChance(awareness, reputation);
  const w = planTheatre(7, 1)[0];
  const lifted = frontageChance(Math.min(1, awareness + w.boost), reputation);
  assert.ok(lifted > base, `theatre should lift the chance (${base} -> ${lifted})`);
  // and the lift respects the cap
  assert.ok(frontageChance(Math.min(1, 0.95 + w.boost), 100) <= 1);
});

test('the plan is frame-clock invariant (no wall-clock input)', () => {
  // planTheatre's signature only admits (seed, day); theatreAt only admits
  // (windows, minute). Re-deriving the same sim-minute from scratch must
  // agree — there is no wall-clock state to drift.
  const a = theatreAt(planTheatre(11, 3), 503);
  const b = theatreAt(planTheatre(11, 3), 503);
  assert.deepEqual(a, b, 'same minute, same answer, derived independently');
});
