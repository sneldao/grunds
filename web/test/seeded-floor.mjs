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

test('main wires seeded floor streams and re-points them on reset and resume', async () => {
  const fs = await import('node:fs/promises');
  const main = await fs.readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /patronsRng = seeded\(seedNow\(\) \+ 17\)/);
  assert.match(main, /floorRng = seeded\(seedNow\(\) \+ 19\)/);
  assert.match(main, /\{ random: patronsRng \}\)/);
  assert.ok((main.match(/patrons\.random = patronsRng/g) || []).length >= 2,
    'reset and resume must re-point patrons.random after reseeding');
});
