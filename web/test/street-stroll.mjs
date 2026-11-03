// Cosy street, phase 2 (VISION.md "Flip the ratio"): footfall is recruited,
// not spawned. The stroll share sends a slice of each wave past the door —
// they glance at the board from the pavement and keep walking. The share
// falls with awareness, so the marketing levers visibly change who comes in.
// The decision reuses the spawn's existing choiceRoll (no new sim draws):
// the RIVAL band is decided first, exactly as before the cosy street — lost
// regulars ride on rival-choice spawns (Mara's glimpse) and that stream must
// not move — then the stroll takes its share of what remains, remapped onto
// the unit interval. Pending regulars came for us and never stroll.
// Run: node --test web/test/street-stroll.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { strollShare, STROLL_BASE, STROLL_FLOOR } from '../js/demand.js';
import { seeded } from '../js/exchange.js';
import { PatronSystem } from '../js/patrons.js';
import { DRINKS } from '../js/menu.js';

// ---- the share formula -------------------------------------------------------

test('stroll share falls with awareness, never below the floor', () => {
  assert.equal(strollShare(0), STROLL_BASE);
  assert.ok(strollShare(0.28) < strollShare(0.1));
  assert.ok(strollShare(0.6) < strollShare(0.28));
  assert.equal(strollShare(1), STROLL_FLOOR);
  assert.equal(strollShare(4), STROLL_FLOOR, 'clamps above 1');
  assert.ok(strollShare(0.28) > 0.2, 'opening awareness still mostly passers-by');
});

// ---- the spawn-side remap ------------------------------------------------------

const scene = { add() {} };
const world = { seats: [] };
const exchange = { matchaPrice: 4.8, day: 1, purchaseCup: () => ({ beanCost: 0, spotCost: 0, hedged: false }) };

const mkSys = (seed, share) => {
  // Production wiring: sim and cosmetic streams are separate (main.js).
  const sys = new PatronSystem(scene, world, null, exchange, null,
    { random: seeded(seed), cosmetic: seeded(seed + 999) });
  sys.strollShare = share;
  return sys;
};

const spawnSome = (sys, n, recycle = false) => {
  const cohorts = ['commuters', 'office', 'creatives', 'students', 'elders', 'weekenders'];
  for (let i = 0; i < n; i++) {
    const p = sys.spawn(cohorts[i % cohorts.length], 'counter', false);
    // The instance pool is finite and only tick/serve recycle in production;
    // long synthetic runs must despawn + drain queues (spawn-time gates read
    // rivalQ.length) or the pool exhausts and spawn starts returning null.
    if (p && recycle) sys._despawn(p);
    if (recycle) { sys.rivalQ.length = 0; sys.counterQ.length = 0; }
  }
  return sys;
};

test('strollers are counted, never queue, never enter the room', () => {
  const sys = spawnSome(mkSys(301, 0.3), 200);
  assert.equal(sys.passedBy + sys.counterQ.length + sys.rivalQ.length + sys.turnaways, 200,
    'every counter spawn lands in a named bucket (retail browsing only exists for retail spawns)');
  assert.ok(sys.passedBy >= 30 && sys.passedBy <= 95, `~30% stroll, got ${sys.passedBy}/200`);
  assert.ok(sys.counterQ.every(p => !p.stroll), 'no stroller holds a queue slot');
});

test('share 0 keeps the old funnel exactly: nobody strolls', () => {
  const sys = spawnSome(mkSys(301, 0), 200);
  assert.equal(sys.passedBy, 0);
});

test('among people who came for coffee, the rival probability is unchanged', () => {
  // Same seed, same draws — only the stroll slice differs. The rival rate
  // per NON-stroller must match the share-0 rival rate per spawn.
  const withStroll = spawnSome(mkSys(777, 0.3), 1200, true);
  const baseline = spawnSome(mkSys(777, 0), 1200, true);
  const nonStroll = 1200 - withStroll.passedBy;
  const rateWith = withStroll.rivalChoices / nonStroll;
  const rateBase = baseline.rivalChoices / 1200;
  assert.ok(Math.abs(rateWith - rateBase) < 0.02,
    `rival rate preserved: ${rateWith.toFixed(3)} vs ${rateBase.toFixed(3)}`);
});

test('the same seed and share reproduce the same street', () => {
  const a = spawnSome(mkSys(4242, 0.25), 300, true);
  const b = spawnSome(mkSys(4242, 0.25), 300, true);
  assert.equal(a.passedBy, b.passedBy);
  assert.equal(a.rivalChoices, b.rivalChoices);
  assert.equal(a.turnaways, b.turnaways);
});

test('quick spawns at speed still count — arrival math never depends on fps', () => {
  const sys = mkSys(555, 1);
  for (let i = 0; i < 20; i++) sys.spawn('commuters', 'counter', true);
  assert.equal(sys.passedBy, 20);
  assert.equal(sys.counterQ.length, 0);
});

test('strolling never starves the rival stream — the count holds', () => {
  // The rival band is decided BEFORE the stroll on the raw choiceRoll (Mara's
  // glimpse rides on rival-choice spawns), so a spawn that would cross is
  // never stolen into a stroll. With queues drained, pr is fixed per cohort
  // and the rival count must not drift with the share. A priced-up board
  // gives rival pull ~0.17 so the count is large enough to measure.
  const pricey = {}; for (const id in DRINKS) pricey[id] = DRINKS[id].base + 2.5;
  const mk = (seed, share) => { const s = mkSys(seed, share); s.menuPrices = pricey; return s; };
  for (const seed of [777, 1234]) {
    const withStroll = spawnSome(mk(seed, 0.3), 1200, true);
    const baseline = spawnSome(mk(seed, 0), 1200, true);
    assert.equal(withStroll.rivalChoices, baseline.rivalChoices,
      `seed ${seed}: rival count unchanged by the stroll share`);
    assert.ok(withStroll.passedBy > 200, `seed ${seed}: and the stroll slice still happens`);
  }
});

test('a lost regular\'s defection is never swallowed by the stroll', () => {
  // Regression (lifecycle-accounting): even at share 1, a spawn whose roll
  // lands in the rival band crosses visibly with Mara's name on it. A priced
  // board makes defection real (rival pull ~0.2 > roll 0.01).
  const sys = new PatronSystem(scene, world, {
    reputation: 62,
    regulars: [{ name: 'Mara', coh: 'commuters', seen: false, _spawned: false, absence: 'lost', _defectShown: false }],
  }, exchange, null, { random: () => 0.01 });
  sys.strollShare = 1;
  sys.menuPrices = { espresso: 6.4 };
  const p = sys.spawn('commuters', 'counter', false);
  assert.equal(p.lostGlimpse, true, 'the glimpse is stamped');
  assert.equal(p.regularName, 'Mara');
  assert.equal(sys.passedBy, 0);
});

test('a pending regular is never street traffic — they came for us', () => {
  const sys = new PatronSystem(scene, world, {
    reputation: 62,
    markSeen: (coh, only, pendingR) => pendingR,
    regulars: [{ name: 'Sam', coh: 'commuters', seen: false, _spawned: false, absence: 'present', found: true, idx: 0, drink: 'flatwhite', visits: 3 }],
  }, exchange, null, { random: () => 0.99 });
  sys.strollShare = 1;
  const p = sys.spawn('commuters', 'counter', false);
  assert.notEqual(p.state, 'strolling', 'the pending regular does not stroll');
  assert.equal(sys.passedBy, 0);
  assert.equal(p.regularName, 'Sam', 'the regular attaches');
});
