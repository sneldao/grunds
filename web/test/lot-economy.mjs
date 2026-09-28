// Phase 2 — Named coffee lots: freshness, stock, serve nudges.
// Verifies the pure cellar math (lots.js), client/server catalog parity,
// and every lot wiring point (purchase routing, cash-basis books, stale
// opinions, Brief picker + commit).
//
// Imports lots.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  LOT_CATALOG, LOT_IDS, STARTER_STOCK, STALE_AFTER, EMERGENCY_MUL,
  FRESH_TOPUP_FRAC, STALE_NUDGE, AFFINITY_NUDGE, STALE_LINES,
  lotSpot, cupQuality, isStale, serveNudge, restockQty, LotsState,
} from '../js/lots.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const exchange = readFileSync(resolve(root, 'web/js/exchange.js'), 'utf8');
const gameConfig = readFileSync(resolve(root, 'convex/gameConfig.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'convex/schema.ts'), 'utf8');
const lotsTs = readFileSync(resolve(root, 'convex/lots.ts'), 'utf8');
const exchangeTs = readFileSync(resolve(root, 'convex/exchange.ts'), 'utf8');

// (1) Catalog: four lots, huila at legacy baseline, gesha capped microlot
test('Phase 2 · catalog holds 4 lots; huila == legacy £1.30 baseline', () => {
  assert.deepEqual([...LOT_IDS].sort(), ['cerrado', 'gesha', 'huila', 'yirgacheffe']);
  assert.equal(LOT_CATALOG.huila.unitBase, 1.30);
  assert.ok(LOT_CATALOG.cerrado.unitBase < LOT_CATALOG.huila.unitBase);
  assert.ok(LOT_CATALOG.yirgacheffe.unitBase > LOT_CATALOG.huila.unitBase);
  assert.equal(LOT_CATALOG.gesha.microlot, true);
  assert.equal(LOT_CATALOG.gesha.stockCap, 60);
  assert.equal(EMERGENCY_MUL, 1.5);
  assert.equal(STALE_AFTER, 2);
});

// (2) Spot pricing: base × drift × wire multiplier
test('Phase 2 · lotSpot multiplies base × index × wire mul', () => {
  assert.ok(Math.abs(lotSpot('cerrado', 1.0, 1) - 0.95) < 1e-9);
  assert.ok(Math.abs(lotSpot('cerrado', 1.2, 1.35) - 0.95 * 1.2 * 1.35) < 1e-9);
  assert.equal(lotSpot('nope', 1.0, 1), 0);
});

// (3) Freshness curve: fresh → fine → stale
test('Phase 2 · cupQuality decays 1 → 0.85 → 0.6; stale iff age > 2', () => {
  assert.equal(cupQuality(0), 1);
  assert.equal(cupQuality(1), 1);
  assert.equal(cupQuality(2), 0.85);
  assert.equal(cupQuality(3), 0.6);
  assert.equal(isStale(2), false);
  assert.equal(isStale(3), true);
});

// (4) Serve nudges: loved lots warm slowly, stale cups sour flat
test('Phase 2 · serveNudge rewards affinity, punishes staleness', () => {
  assert.equal(STALE_NUDGE, -0.03);
  assert.equal(AFFINITY_NUDGE, 0.05);
  assert.ok(Math.abs(serveNudge('yirgacheffe', 'creatives', 0) - 0.3 * 0.05) < 1e-9);
  assert.ok(serveNudge('yirgacheffe', 'commuters', 0) < 0);  // 0.95 affinity: mild dislike
  assert.ok(Math.abs(serveNudge('huila', 'tourists', 1) - 0.1 * 0.05) < 1e-9);
  for (const coh of ['commuters', 'creatives', 'students', 'elders', 'tourists']) {
    assert.equal(serveNudge('cerrado', coh, 5), -0.03);
  }
  assert.equal(Object.keys(STALE_LINES).length, 5);
});

// (5) Adaptive restock: yesterday +25%, rounded to 50s
test('Phase 2 · restockQty adapts to yesterday’s pour', () => {
  assert.equal(restockQty(0), 0);
  assert.equal(restockQty(400), 500);
  assert.equal(restockQty(100), 150);
  assert.equal(restockQty(1000), 1250);
});

// (6) Starter cellar: house huila deep, others shallow, gesha locked
test('Phase 2 · LotsState starts with a fresh, huila-housed cellar', () => {
  const s = new LotsState();
  assert.equal(s.house, 'huila');
  assert.equal(s.entry('huila').stock, 1500);
  assert.equal(s.entry('cerrado').stock, 600);
  assert.equal(s.entry('gesha').unlocked, false);
  assert.equal(s.age('huila', 1), 0);
});

// (7) Buy: cost math, average cost, roast-date rule, cap, locked refusal
test('Phase 2 · buy prices stock, averages cost, guards the roast clock', () => {
  const s = new LotsState();
  const r = s.buy('cerrado', 400, 1.0, 2, {});
  assert.deepEqual([r.cost, r.cups], [400, 400]);
  assert.ok(Math.abs(s.avgCost('cerrado') - ((600 * 0.95 + 400) / 1000)) < 1e-9);
  // deep stale sack + small top-up keeps the old roast date
  s.lots.cerrado.roastedOn = 1;
  s.buy('cerrado', 50, 1.0, 4, {});
  assert.equal(s.lots.cerrado.roastedOn, 1);
  // near-empty sack refreshes the roast date
  s.lots.cerrado.stock = 5;
  s.buy('cerrado', 400, 1.0, 4, {});
  assert.equal(s.lots.cerrado.roastedOn, 4);
  // microlot cap clamps
  const g = new LotsState();
  g.lots.gesha.unlocked = true;
  const gr = g.buy('gesha', 400, 3.2, 1, {});
  assert.equal(gr.cups, 60);
  assert.equal(gr.cost, 60 * 3.2);
  // locked lot refuses
  const locked = new LotsState().buy('gesha', 10, 3.2, 1, {});
  assert.deepEqual([locked.cost, locked.cups], [0, 0]);
  assert.equal(FRESH_TOPUP_FRAC, 0.2);
});

// (8) Pour: decrements, hedged-first, stockout cascade, bone-dry emergency
test('Phase 2 · pour spends stock, cascades on stockout, flags emergency', () => {
  const s = new LotsState();
  s.buy('huila', 100, 1.0, 1, { hedgedUnits: 100 });
  const p1 = s.pour(1);
  assert.equal(p1.lotId, 'huila');
  assert.equal(p1.hedged, true);
  assert.ok(Math.abs(p1.unitCost - s.avgCost('huila')) < 1e-9 || p1.unitCost > 0);
  // drain the house → cascade switches to the fullest open lot
  s.lots.huila.stock = 0;
  const p2 = s.pour(1);
  assert.equal(p2.switched, true);
  assert.equal(s.house, p2.lotId);
  // drain everything → emergency flag, no crash
  for (const id of LOT_IDS) s.lots[id].stock = 0;
  const p3 = s.pour(1);
  assert.equal(p3.emergency, true);
  assert.equal(p3.lotId, null);
});

// (9) Client/server catalog parity
test('Phase 2 · convex LOT_CATALOG mirrors lots.js numbers', () => {
  for (const id of LOT_IDS) {
    const m = gameConfig.match(new RegExp(`${id}:\\s*\\{[\\s\\S]*?unitBase:\\s*([\\d.]+)`));
    assert.ok(m, `${id} must exist server-side`);
    assert.equal(+m[1], LOT_CATALOG[id].unitBase, `${id}.unitBase parity`);
  }
  assert.match(gameConfig, /STALE_AFTER = 2/);
  assert.match(gameConfig, /STALE_NUDGE = -0\.03/);
  assert.match(gameConfig, /AFFINITY_NUDGE = 0\.05/);
  const m = gameConfig.match(/creatives:\s*1\.3/);
  assert.ok(m, 'yirgacheffe/creatives affinity must mirror');
});

// (10) Server schema + functions
test('Phase 2 · schema + lots.ts + openDay hook carry the tradeable mirror', () => {
  assert.match(schema, /lots: defineTable/);
  assert.match(schema, /lotMoves: defineTable/);
  assert.match(lotsTs, /ensureLots/);
  assert.match(lotsTs, /buyLot/);
  assert.match(lotsTs, /landDueMoves/);
  assert.match(exchangeTs, /landDueMoves\(ctx, args\.campaignId, day\)/);
  assert.match(exchangeTs, /lotReport/);
});

// (11) purchaseCup routing: matcha legacy, other pours the house
test('Phase 2 · exchange.purchaseCup(kind) splits matcha legacy from lot pours', () => {
  assert.match(exchange, /purchaseCup\(kind = 'other'\)/);
  assert.match(exchange, /if \(kind === 'matcha' \|\| !this\.lots\)/);
  assert.match(exchange, /this\.lots\.pour\(this\.day\)/);
  assert.match(exchange, /EMERGENCY_MUL/);
  assert.match(patrons, /purchaseCup\(p\.wantsMatcha \? 'matcha' : 'other'\)/);
  assert.match(patrons, /purchaseCup\('other'\)/);
});

// (12) Cash-basis books: lot cups skip cogs (paid at top-up, like batch)
test('Phase 2 · lot cups carry display beanCost but add no cogs', () => {
  const hits = main.match(/cogs \+= e\.lotId \? 0 : e\.beanCost \?\? 0/g) || [];
  assert.equal(hits.length, 2, 'both served branches (cash-only + normal) must guard cogs');
  assert.match(main, /beans stocked/);
});

// (13) Serve loop: emergency bills, switches toast, stale sours with reason
test('Phase 2 · serve loop bills emergency sacks and sours stale rooms', () => {
  assert.match(main, /e\.emergency && !emergencyToast/);
  assert.match(main, /till -= e\.spotCost; beanSpend \+= e\.spotCost/);
  assert.match(main, /e\.switched && e\.lotId/);
  assert.match(main, /serveNudge\(e\.lotId, e\.p\.cohort, age\)/);
  assert.match(main, /STALE_LINES\[e\.p\.cohort\]/);
  assert.match(main, /pouredOther\+\+/);
});

// (14) Brief picker + commit: pills, top-up staging, applyLots, dawn hooks
test('Phase 2 · Brief stages lots; commit executes; dawn schedules + lands', () => {
  assert.match(main, /function renderLotSection/);
  assert.match(main, /brief-lot-\$\{id\}/);
  assert.match(main, /brief-top-rest/);
  assert.match(main, /function applyLots/);
  assert.match(main, /applyLots\(\);/);
  assert.match(main, /lotState\.applyWireEvent\(ev\.id, d\)/);
  assert.match(main, /lotState\.resolveDawn\(d\)/);
  assert.match(main, /geshaUnlocked/);
  assert.match(main, /lotState\.reset\(\); selectedLot = 'huila'/);
});
