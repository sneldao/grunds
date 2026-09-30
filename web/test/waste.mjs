// Phase 3 — Waste economy: compost, milk, and surfaced loss.
// Verifies the compost rule (lots.js), milk delivery math (menu.js), and
// every waste wiring point (dawn clean-out, dry-bar balks, receipt rows).
//
// Imports lots.js + menu.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COMPOST_AFTER, LotsState } from '../js/lots.js';
import { deliveryQty } from '../js/menu.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');

// (1) Compost binds the finale (day-1 leftovers tip day 5)
test('Phase 3 · COMPOST_AFTER binds late-campaign hoards', () => {
  assert.equal(COMPOST_AFTER, 3);
});

// (2) compost() discards only over-age stock, zeroes value, names lots
test('Phase 3 · compost tips over-age sacks and reports them', () => {
  const s = new LotsState();
  s.lots.huila.roastedOn = 1;
  const fresh = s.compost(2);
  assert.deepEqual([fresh.cups, fresh.names], [0, []]);
  // day 5: every starter sack (roasted day 1, age 4 > 3) tips together
  const stale = s.compost(5);
  assert.equal(stale.cups, 600 + 1500 + 600);
  assert.deepEqual([...stale.names].sort(), ['Brazil Cerrado', 'Colombia Huila', 'Ethiopia Yirgacheffe']);
  assert.equal(s.entry('huila').stock, 0);
  assert.equal(s.entry('huila').value, 0);
  // a near-empty sack topped up refreshes its roast date and survives
  const s2 = new LotsState();
  s2.lots.cerrado.stock = 5;
  s2.buy('cerrado', 400, 1.0, 5, {});
  const mixed = s2.compost(5);
  assert.ok(!mixed.names.includes('Brazil Cerrado'));
  assert.ok(s2.entry('cerrado').stock > 0);
});

// (3) Compost threshold honors Ruth's nursing (skill 2 → +1 day)
test('Phase 3 · compost takes the skill-adjusted threshold', () => {
  assert.match(main, /lotState\.compost\(d, COMPOST_AFTER \+ \(ruthSkill >= 2 \? 1 : 0\)\)/);
  assert.match(main, /morning clean-out — tipped/);
});

// (4) Milk delivery adapts; dry bar balks milky cups once-loudly
test('Phase 3 · milk delivers adaptively and fails loudly once', () => {
  assert.equal(deliveryQty(0), 120);
  assert.equal(deliveryQty(200), 220);
  assert.equal(deliveryQty(1349), 1480);
  assert.equal(deliveryQty(10000), 4000);
  assert.equal(deliveryQty(333), 370);
  // dawn delivery → bar stock; dry milky orders balk flagged milkOut.
  // Day 1 sizes from the wave sheet (no history); later days adapt.
  assert.match(main, /milkDelivery = d <= 1/);
  assert.match(main, /waveMilkEstimate\(dayWaves, ECON\.spawnScale, demand\.spawnMul\(\)\)/);
  assert.match(main, /deliveryQty\(lastMilky\)/);
  assert.match(main, /ctx\.milkStock = milkDelivery/);
  assert.match(patrons, /milkOut: true/);
  assert.match(main, /ctx\.milkOut && !milkToastDone/);
  assert.match(main, /milk’s out — milky cups are walking/);
});

// (5) Close: leftovers tip, milky count sizes tomorrow, rows print
test('Phase 3 · milk leftovers tip into the receipt; waste rows print', () => {
  assert.match(main, /lastMilky = ctx\.milky \|\| 0/);
  assert.match(main, /milkTipped = Math\.max\(0, ctx\.milkStock \|\| 0\)/);
  assert.match(main, /milk tipped/);
  assert.match(main, /stale composted/);
  // batch waste still surfaces (untouched Phase 0..2 behavior)
  assert.match(main, /matcha wasted/);
  assert.match(main, /beans stocked/);
});

// (6) Brief carries the menu slot
test('Phase 3 · index.html carries the menu slot', () => {
  assert.match(html, /id="brief-menu"/);
});
