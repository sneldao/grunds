// Phase 3 — Drink menu: margins, orders, bands, 86 board.
// Verifies the pure menu math (menu.js), the cohort mix, and every menu
// wiring point (spawn orders, tick points, ticket prices, Brief section).
//
// Imports menu.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DRINKS, DRINK_IDS, COHORT_ORDERS, PRICE_STEP, PRICE_BAND,
  basePrices, clampPrice, menuPrice, rollDrink, deliveryQty, waveMilkEstimate,
} from '../js/menu.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');

// (1) Catalog: four drinks, sane margins, slowest = matcha
test('Phase 3 · menu holds 4 drinks with margins over bean cost', () => {
  assert.deepEqual([...DRINK_IDS].sort(), ['espresso', 'filter', 'flatwhite', 'matcha']);
  for (const id of DRINK_IDS) {
    assert.ok(DRINKS[id].base > 1.30, `${id} must clear the £1.30 bean baseline`);
  }
  assert.ok(DRINKS.espresso.points < DRINKS.flatwhite.points);
  assert.ok(DRINKS.flatwhite.points < DRINKS.filter.points);
  assert.ok(DRINKS.filter.points < DRINKS.matcha.points);
  assert.equal(DRINKS.flatwhite.milk, true);
  assert.equal(DRINKS.matcha.milk, true);
  assert.equal(DRINKS.espresso.milk, false);
  assert.equal(DRINKS.filter.milk, false);
});

// (2) Cohort mix keeps the matcha wave alive (≈20–30%, near legacy 35%)
test('Phase 3 · cohort orders keep matcha at wave strength', () => {
  let matcha = 0, total = 0;
  for (const [coh, weights] of Object.entries(COHORT_ORDERS)) {
    if (coh === 'rival') continue;
    const t = Object.values(weights).reduce((s, w) => s + w, 0);
    matcha += weights.matcha ?? 0;
    total += t;
  }
  const share = matcha / total;
  assert.ok(share >= 0.2 && share <= 0.3, `matcha share ${share} must read as a wave`);
});

// (3) rollDrink honors the 86 board, deterministic on rng
test('Phase 3 · rollDrink respects 86s and seeds', () => {
  const rng = () => 0.99;
  for (let i = 0; i < 50; i++) {
    assert.notEqual(rollDrink('creatives', { filter: false }, rng), 'filter');
  }
  // all 86'd except matcha → matcha (always offered, always pourable)
  assert.equal(rollDrink('elders', { espresso: false, flatwhite: false, filter: false }, rng), 'matcha');
  const a = rollDrink('tourists', null, () => 0.1);
  const b = rollDrink('tourists', null, () => 0.1);
  assert.equal(a, b);
});

// (4) Price bands: ±£1.00, cent-rounded
test('Phase 3 · clampPrice holds the band', () => {
  assert.equal(PRICE_STEP, 0.20);
  assert.equal(PRICE_BAND, 1.00);
  assert.equal(clampPrice('espresso', 9.99), 4.20);
  assert.equal(clampPrice('espresso', 0), 2.20);
  assert.equal(clampPrice('flatwhite', 3.65), 3.65);
  assert.deepEqual(basePrices(), { espresso: 3.20, flatwhite: 3.60, filter: 3.00, matcha: 4.80 });
  assert.equal(menuPrice('filter', { filter: 3.40 }), 3.40);
  assert.equal(menuPrice('filter', {}), 3.00);
});

// (5) Spawn orders by cohort, wantsMatcha stays consistent
test('Phase 3 · spawn rolls cohort drinks; wantsMatcha follows the drink', () => {
  assert.match(patrons, /rollDrink\(cohort, this\.menuOffered, this\.random/);
  assert.match(patrons, /drink, wantsMatcha: drink === 'matcha'/);
  assert.match(patrons, /menuOffered = null/);
});

// (6) Tick spends drink points; milk gates milky orders (legacy-safe:
// ctx objects without milk fields behave exactly as before)
test('Phase 3 · bar spends drink points; dry milk balks milky cups', () => {
  assert.match(patrons, /DRINKS\[dk\]\?\.points \?\? ECON\.prepOther/);
  assert.match(patrons, /DRINKS\[dk\]\?\.milk && ctx\.milkStock != null && ctx\.milkStock <= 0/);
  assert.match(patrons, /ctx\.milkOut = true/);
  assert.match(patrons, /ctx\.milky = \(ctx\.milky \|\| 0\) \+ 1/);
});

// (7) Tickets: matcha at the board, rest at menu prices, register too
test('Phase 3 · tickets price by drink; register honors the menu', () => {
  assert.match(patrons, /ctx\.menuPrices\?\.?\[dk\] \?\? ECON\.other/);
  assert.match(patrons, /ctx\.menuPrices\?\.?\[rdk\] \?\? ECON\.other/);
  // the reprice lever is untouched: key 2 still cuts matcha mid-day
  assert.match(main, /cut matcha to/);
  assert.match(main, /function doReprice/);
});

// (8) Brief menu section: steppers, 86 toggles, matcha always on
test('Phase 3 · day-1 milk sizes from the wave sheet, scale-free', () => {
  const waves = [{ spawns: [{ q: 100 }, { q: 50 }] }, { spawns: [{ q: 200 }] }];
  // 350 × 0.3 × 0.65 × 0.5 × 1.1 ≈ 37.5 → 40, floored to the 120 minimum
  assert.equal(waveMilkEstimate(waves, 0.3, 0.65), 120);
  // a real rush sheet scales: 4000 × 0.3 × 1.0 × 0.5 × 1.1 = 660
  const rush = [{ spawns: [{ q: 4000 }] }];
  assert.equal(waveMilkEstimate(rush, 0.3, 1.0), 660);
  assert.equal(waveMilkEstimate([], 0.3, 0.65), 120);   // floor holds empty
  assert.ok(waveMilkEstimate(rush, 3, 3) <= 4000);      // ceiling holds rush
});

// (9) Brief menu section: steppers, 86 toggles, matcha always on
test('Phase 3 · Brief stages prices + 86 board; commit applies', () => {
  const idx = main.indexOf('function renderMenuSection');
  assert.ok(idx > 0, 'renderMenuSection must be defined');
  const body = main.slice(idx, idx + 3500);
  assert.match(body, /brief-86-\$\{id\}/);
  assert.match(body, /clampPrice\(id, stagedMenu\.prices\[id\] [-+] 0\.20\)/);
  assert.match(body, /always on/);
  assert.match(main, /function applyMenu/);
  assert.match(main, /Object\.assign\(menuPrices, stagedMenu\.prices\)/);
  assert.match(main, /renderMenuSection\(\);/);
  assert.match(html, /id="brief-menu"/);
});
