import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { frontageChance, FrontageConversions } from '../js/frontage.js';
import { seeded } from '../js/exchange.js';
import { COHORT_KEYS, LAYOUT } from '../js/config.js';
import { StreetLife } from '../js/streetLife.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PEOPLE = COHORT_KEYS.filter(k => k !== 'rival');
const scene = { add() {} };

const CFG = { start: 360, awareness: 0.5, reputation: 80 };

function drive(fc, from, to, { spawn = () => ({}), log = [], ...cfg } = {}) {
  for (let m = from; m <= to; m++) {
    fc.tick(m, {
      ...CFG, ...cfg,
      spawn: (p) => { const r = spawn(p); log.push(['spawn', m, p.cohort]); return r; },
      approach: (p) => log.push(['approach', m, p.x, p.z, p.cohort]),
      resolve: (p, converted) => log.push(['resolve', m, converted]),
    });
  }
  return log;
}

test('frontageChance: awareness(0..1) × reputation(0..100) × 3', () => {
  assert.ok(Math.abs(frontageChance(0.28, 62) - 0.5208) < 1e-9);
  assert.equal(frontageChance(0, 50), 0);
  assert.equal(frontageChance(-0.4, 50), 0);
  assert.equal(frontageChance(0.5, -10), 0);
  assert.equal(frontageChance(NaN, 50), 0);
  assert.equal(frontageChance(0.5, NaN), 0);
  assert.equal(frontageChance(Infinity, 50), 0);
  assert.equal(frontageChance(1, 100), 1);
  assert.equal(frontageChance(4, 300), 1);
});

test('cadence: candidate at start+45, hesitation 8 sim-minutes, resolve at +8', () => {
  const fc = new FrontageConversions(() => 0.4);
  const log = drive(fc, 404, 413);
  assert.deepEqual(log.filter(e => e[0] === 'approach').map(e => e[1]), [405]);
  assert.deepEqual(log.filter(e => e[0] === 'spawn').map(e => e[1]), [413],
    'no spawn may fire between approach and the 8-minute hesitation');
  assert.deepEqual(log.filter(e => e[0] === 'resolve'), [['resolve', 413, true]]);
  assert.equal(fc.count, 1);
});

test('every 90 minutes: resolves at 413/503/593, then the day cap stops it', () => {
  const fc = new FrontageConversions(() => 0.1);
  const log = drive(fc, 400, 800);
  assert.deepEqual(log.filter(e => e[0] === 'approach').map(e => e[1]), [405, 495, 585]);
  assert.deepEqual(log.filter(e => e[0] === 'spawn').map(e => e[1]), [413, 503, 593]);
  assert.deepEqual(log.filter(e => e[0] === 'resolve').map(e => e[2]), [true, true, true]);
  assert.equal(fc.count, 3);
});

test('a null spawn never consumes the cap; the next cadence retries', () => {
  const fc = new FrontageConversions(() => 0.1);
  const log = drive(fc, 400, 700, { spawn: () => null });
  assert.deepEqual(log.filter(e => e[0] === 'resolve').map(e => e[2]), [false, false, false, false]);
  assert.equal(fc.count, 0);
  assert.ok(log.filter(e => e[0] === 'approach').length >= 3, 'cap unconsumed — every cadence retries');
});

test('a rejected hesitation still resolves; converted candidates are counted once', () => {
  const fc = new FrontageConversions(() => 0.9);   // chance ≤ ~0.9 → roll fails
  const log = drive(fc, 400, 500, { awareness: 0.3, reputation: 60 });
  assert.deepEqual(log.filter(e => e[0] === 'resolve'), [['resolve', 413, false]]);
  assert.equal(fc.count, 0);
  assert.deepEqual(log.filter(e => e[0] === 'approach').map(e => e[1]), [405, 495]);
});

test('the same sim-minute twice draws nothing extra', () => {
  const fc = new FrontageConversions(() => 0.4);
  const log = drive(fc, 405, 405);
  drive(fc, 405, 405, { log });
  assert.equal(log.filter(e => e[0] === 'approach').length, 1);
});

test('reset clears pending, count and the minute marker', () => {
  const fc = new FrontageConversions(() => 0.4);
  drive(fc, 405, 405);
  assert.ok(fc.pending);
  fc.reset();
  assert.equal(fc.count, 0);
  assert.equal(fc.pending, null);
  assert.equal(fc.lastMinute, null);
  const log = drive(fc, 405, 405);
  assert.equal(log.filter(e => e[0] === 'approach').length, 1, 'the cadence slot opens again after reset');
});

test('stream state survives the dawn boundary: saved .state() restores the same day', () => {
  const rng = seeded(50);
  const ref = new FrontageConversions(rng);
  drive(ref, 360, 1259);
  const saved = rng.state();
  ref.reset();
  const refLog = drive(ref, 360, 1259);
  const refCount = ref.count;
  const refState = rng.state();
  const res = new FrontageConversions(seeded(50, saved));
  const resLog = drive(res, 360, 1259);
  assert.deepEqual(resLog, refLog);
  assert.equal(res.count, refCount);
  assert.equal(res.random.state(), refState);
});

test('candidates draw cohort/x/z only — the sim owns the hesitation, not the street', () => {
  const fc = new FrontageConversions(seeded(7));
  drive(fc, 405, 405);
  const p = fc.pending;
  assert.ok(p);
  assert.ok(Math.abs(p.x - LAYOUT.door.x) <= 1.2);
  assert.equal(p.z, LAYOUT.pavementZ);
  assert.ok(PEOPLE.includes(p.cohort));
  assert.deepEqual(Object.keys(p).sort(), ['at', 'cohort', 'x', 'z']);
});

function econTrace(fc, street) {
  const log = [];
  for (let m = 400; m <= 700; m++) {
    fc.tick(m, {
      ...CFG,
      approach: (p) => street && street.showFrontage(p),
      resolve: (p, c) => { if (street) street.finishFrontage(p, c); log.push([m, c]); },
      spawn: () => ({ id: log.length }),
    });
  }
  return { log, count: fc.count };
}

function liveStreet(opts) {
  const s = new StreetLife(scene, opts);
  s.beginDay(1, 7);
  return s;
}

test('the street is paint only: populated, lite and saturated streets give the same economy', () => {
  const base = econTrace(new FrontageConversions(seeded(50)), null);
  const full = econTrace(new FrontageConversions(seeded(50)), liveStreet());
  const lite = econTrace(new FrontageConversions(seeded(50)), liveStreet({ lite: true }));
  const packed = liveStreet();
  for (let guard = 0; packed.count < packed.cap && guard < 64; guard++) packed._spawnForced({ kind: 'pavement' });
  const sat = econTrace(new FrontageConversions(seeded(50)), packed);
  for (const [name, t] of [['full', full], ['lite', lite], ['saturated', sat]]) {
    assert.deepEqual(t.log, base.log, `${name} street changed the resolve trace`);
    assert.equal(t.count, base.count, `${name} street changed the conversion count`);
  }
  assert.ok(base.count > 0, 'the trace must actually exercise conversions');
});

test('showFrontage paints a dweller at the front; finishFrontage releases or removes it', () => {
  const s = liveStreet();
  const cand = { at: 405, x: LAYOUT.door.x + 0.4, z: LAYOUT.pavementZ, cohort: 'elders' };
  s.showFrontage(cand);
  const a = s.agents.find(x => x.frontage === cand);
  assert.ok(a, 'no frontage agent spawned');
  assert.equal(a.kind, 'frontage');
  assert.equal(a.state, 'dwell');
  assert.equal(a.dwell, Infinity);
  assert.equal(a.cohort, 'elders');
  assert.ok(Math.abs(a.pos.x - cand.x) < 1e-6 && Math.abs(a.pos.z - cand.z) < 1e-6);

  s.finishFrontage(cand, false);
  assert.equal(a.dwell, 0);
  s.update(0.05, 1);
  assert.equal(a.state, 'walk');
  assert.ok(s.agents.includes(a));

  const cand2 = { at: 495, x: LAYOUT.door.x - 0.6, z: LAYOUT.pavementZ, cohort: 'students' };
  s.showFrontage(cand2);
  const b = s.agents.find(x => x.frontage === cand2);
  assert.ok(b);
  s.finishFrontage(cand2, true);
  assert.ok(!s.agents.includes(b));
});

test('showFrontage is inert off a live street or a full cap', () => {
  const s = new StreetLife(scene);
  const cand = { at: 405, x: LAYOUT.door.x, z: LAYOUT.pavementZ, cohort: 'elders' };
  s.showFrontage(cand);
  assert.equal(s.count, 0, 'not live — nothing spawns');
  s.beginDay(1, 7);
  for (let guard = 0; s.count < s.cap && guard < 64; guard++) s._spawnForced({ kind: 'pavement' });
  s.showFrontage(cand);
  assert.equal(s.agents.filter(a => a.kind === 'frontage').length, 0, 'cap full — nothing spawns');
});

test('main.js wires frontage through the sim tick, not the frame loop', () => {
  const src = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
  assert.ok(src.includes('new FrontageConversions(patronsConvRng)'));
  assert.ok(src.includes('frontage.tick(dayMin'));
  assert.ok(!src.includes('_convRolled'), 'the RAF hesitator scan is gone');
  assert.ok(!src.includes('_pfConvN'), 'the RAF counter is gone');
  const block = src.match(/frontage\.tick\(dayMin, \{[\s\S]*?\}\);/)?.[0] || '';
  assert.ok(block.includes("patrons.spawn(p.cohort, 'counter', false)"));
  assert.ok(block.includes('patron.pos.set(p.x, 0, p.z)'), 'spawn relocates the origin only');
  assert.ok(!block.includes('.path'), 'the spawn keeps its own path');
});
