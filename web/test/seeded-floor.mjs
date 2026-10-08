import test from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../js/exchange.js';

// Minimal stand-in: PatronSystem needs THREE in browser; instead assert the
// V0 contract the floor now documents — same seed streams replay bit-for-bit.
test('seeded streams replay', () => {
  const a = seeded(7 + 17);
  const b = seeded(7 + 17);
  const seqA = Array.from({ length: 40 }, () => a());
  const seqB = Array.from({ length: 40 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('seeded stream state resumes mid-sequence (week-resume contract)', () => {
  const live = seeded(7 + 17);
  const head = Array.from({ length: 40 }, () => live());
  const restored = seeded(7 + 17, live.state());
  const tail = Array.from({ length: 40 }, () => live());
  const replayed = Array.from({ length: 40 }, () => restored());
  assert.deepEqual(replayed, tail, 'restored stream must continue the live sequence');
  assert.notDeepEqual(replayed, head, 'restored stream must not restart from the seed');
});

test('week save carries stream positions and resume restores them', async () => {
  const fs = await import('node:fs/promises');
  const main = await fs.readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /streams:\s*\{\s*patrons: patronsRng[^}]*floor: floorRng[^}]*fx: fxRng[^}]*\}/s,
    'capturePreDawn must snapshot all three stream positions');
  assert.match(main, /seeded\(\(save\.seed \|\| seedNow\(\)\) \+ 17, ss\.patrons\)/,
    'resume must restore the patron stream position');
  assert.match(main, /seeded\(\(save\.seed \|\| seedNow\(\)\) \+ 19, ss\.floor\)/,
    'resume must restore the floor stream position');
  assert.match(main, /seeded\(\(save\.seed \|\| seedNow\(\)\) \+ 23, ss\.fx\)/,
    'resume must restore the fx stream position');
  assert.match(main, /cos: patronsCosRng[^}]*\}/s,
    'capturePreDawn must snapshot the cosmetic stream position');
  assert.match(main, /seeded\(\(save\.seed \|\| seedNow\(\)\) \+ 29, ss\.cos\)/,
    'resume must restore the cosmetic stream position');
});

test('patron and floor streams diverge from exchange', () => {
  const ex = seeded(7);
  const pat = seeded(7 + 17);
  const fl = seeded(7 + 19);
  assert.notEqual(ex(), pat());
  // re-seed fresh for a clean compare of first draws
  const ex2 = seeded(7);
  const pat2 = seeded(7 + 17);
  const fl2 = seeded(7 + 19);
  assert.notEqual(ex2(), fl2());
  assert.notEqual(pat2(), fl2());
});

test('patrons.js no longer calls Math.random()', async () => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../js/patrons.js', import.meta.url), 'utf8');
  const calls = [...src.matchAll(/Math\.random\(\)/g)];
  assert.equal(calls.length, 0, 'bare Math.random() left in patrons.js');
  assert.match(src, /random = Math\.random/); // constructor default only
});

test('spawn consumes the injected stream', async () => {
  const { PatronSystem } = await import('../js/patrons.js');
  const exchange = { matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 1.3, spotCost: 1.3, hedged: false }) };
  let draws = 0;
  const sys = new PatronSystem({ add() {} }, { seats: [] }, null, exchange, null,
    { random: () => (draws++, 0.99) });
  const p = sys.spawn('commuters', 'counter', true);
  assert.ok(p, 'spawn still returns a patron');
  assert.ok(draws > 0, `expected injected draws, got ${draws}`);
});

test('spawn draws paint fields on the cosmetic stream, not the decision stream', async () => {
  const { PatronSystem } = await import('../js/patrons.js');
  const exchange = { matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 1.3, spotCost: 1.3, hedged: false }) };
  let sim = 0, cos = 0;
  const sys = new PatronSystem({ add() {} }, { seats: [] }, null, exchange, null,
    { random: () => (sim++, 0.99), cosmetic: () => (cos++, 0.5) });
  const p = sys.spawn('commuters', 'counter', true);
  assert.ok(p, 'spawn still returns a patron');
  assert.equal(cos, 5, `phase/hat/skin/legs/scale ride the cosmetic stream; got ${cos}`);
  assert.ok(sim > 0, 'decision stream still consumed');
  // Cosmetic churn must not move the decision stream: same sim draws either way.
  let sim2 = 0;
  const sys2 = new PatronSystem({ add() {} }, { seats: [] }, null, exchange, null,
    { random: () => (sim2++, 0.99), cosmetic: () => 0.1 });
  sys2.spawn('commuters', 'counter', true);
  assert.equal(sim2, sim, 'cosmetic draw values must not shift decision-stream consumption');
});

test('main wires seeded floor streams and re-points them on reset and resume', async () => {
  const fs = await import('node:fs/promises');
  const main = await fs.readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /patronsRng = seeded\(seedNow\(\) \+ 17\)/);
  assert.match(main, /floorRng = seeded\(seedNow\(\) \+ 19\)/);
  assert.match(main, /patronsCosRng = seeded\(seedNow\(\) \+ 29\)/);
  assert.match(main, /\{ random: patronsRng, cosmetic: patronsCosRng \}\)/);
  assert.ok((main.match(/patrons\.random = patronsRng/g) || []).length >= 2,
    'reset and resume must re-point patrons.random after reseeding');
  assert.ok((main.match(/patrons\.cosmetic = patronsCosRng/g) || []).length >= 2,
    'reset and resume must re-point patrons.cosmetic after reseeding');
});

test('fx draws only from its injected stream; main wires and re-points fxRng', async () => {
  const fs = await import('node:fs/promises');
  const fx = await fs.readFile(new URL('../js/fx.js', import.meta.url), 'utf8');
  assert.equal([...fx.matchAll(/Math\.random\(\)/g)].length, 0, 'bare Math.random() left in fx.js');
  assert.match(fx, /\{ random = Math\.random \} = \{\}/);
  const main = await fs.readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /fxRng = seeded\(seedNow\(\) \+ 23\)/);
  assert.match(main, /new FX\(scene, null, lite, \{ random: fxRng \}\)/);
  assert.ok((main.match(/fx\.random = fxRng/g) || []).length >= 2,
    'reset and resume must re-point fx.random after reseeding');
});
