// Phase 3 — Roast program + Ruth's skill + scorch.
// Verifies roast math (lots.js), skill wiring, the scorch incident, and the
// server roast mirror. Imports lots.js directly — no DOM, no GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ROAST_IDEAL, ROAST_LEAN, ROAST_CLIMATE_LEAN, crowdRoastPull, roastIdeal, SCORCH_LINE,
  roastQuality, cupQuality, serveNudge, LotsState,
} from '../js/lots.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const gameConfig = readFileSync(resolve(root, 'convex/gameConfig.ts'), 'utf8');
const lotsTs = readFileSync(resolve(root, 'convex/lots.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'convex/schema.ts'), 'utf8');

// (1) Ideals per lot, and the crowd that moves them
test('Phase 3 · ROAST_IDEAL maps lots to 1–5', () => {
  assert.deepEqual(ROAST_IDEAL, { cerrado: 4, huila: 3, yirgacheffe: 2, gesha: 2 });
});

test('craft · the crowd pulls the ideal, so no sack has one right answer', () => {
  // light-seeking creatives vs dark-seeking commuters
  assert.equal(crowdRoastPull({ creatives: 100 }), -1);
  assert.equal(crowdRoastPull({ commuters: 100 }), 1);
  assert.equal(crowdRoastPull({}), 0);
  assert.equal(roastIdeal('huila', { commuters: 100 }), 4);
  assert.equal(roastIdeal('huila', { creatives: 100 }), 2);
  assert.equal(roastIdeal('yirgacheffe', { commuters: 100 }), 3);
  assert.equal(roastIdeal('yirgacheffe', { creatives: 100 }), 1);
  // no mix → the lot's base read, bit-identical to the legacy path
  assert.equal(roastIdeal('cerrado'), ROAST_IDEAL.cerrado);
  assert.equal(roastIdeal('yirgacheffe', { creatives: 900 }), 1);   // clamps at light
  // The week's sky moves the board, because the scheduled crowd mix is
  // near-balanced and rounds to zero — without this the "crowd read" is just
  // ROAST_IDEAL wearing a different name and the drum has one fixed answer.
  assert.equal(ROAST_CLIMATE_LEAN.heat, -1);
  assert.equal(ROAST_CLIMATE_LEAN.crisp, 1);
  assert.equal(roastIdeal('huila', {}, ROAST_CLIMATE_LEAN.heat), 2);
  assert.equal(roastIdeal('huila', {}, ROAST_CLIMATE_LEAN.crisp), 4);
  assert.equal(roastIdeal('huila', { commuters: 100 }, ROAST_CLIMATE_LEAN.heat), 3);
  assert.equal(roastIdeal('huila', {}, ROAST_CLIMATE_LEAN.fair), ROAST_IDEAL.huila);
  assert.equal(roastIdeal('cerrado'), roastIdeal('cerrado', {}, ROAST_CLIMATE_LEAN.fair));
});

// (2) Distance costs 0.1 quality per step, clamped 1–5; the crowd ideal
// overrides the base; an unprogrammed drum pours flat.
test('Phase 3 · roastQuality is 1.0 at ideal, fades with distance', () => {
  assert.equal(roastQuality('huila', 3), 1.0);
  assert.equal(roastQuality('huila', 4), 0.9);
  assert.equal(roastQuality('huila', 1), 0.8);
  assert.equal(roastQuality('yirgacheffe', 5), 0.7);
  assert.equal(roastQuality('huila', 99), roastQuality('huila', 5));
  assert.equal(roastQuality('huila', -3), roastQuality('huila', 1));
  // crowd read: the same level is right or wrong depending on who is coming
  assert.equal(roastQuality('huila', 4, 4), 1.0);
  assert.equal(roastQuality('huila', 4, 2), 0.8);
  // unprogrammed: flat, and not the same as roast 1
  assert.equal(roastQuality('huila', null), 0.9);
  assert.equal(roastQuality('cerrado', null), 0.9);
  assert.equal(roastQuality('huila', undefined), 0.9);
});

// (3) cupQuality composes age × roast × scorch
test('Phase 3 · cupQuality multiplies age, roast, scorch', () => {
  assert.equal(cupQuality(0), 1);
  assert.equal(cupQuality(0, 0.8, false), 0.8);
  assert.equal(cupQuality(0, 1, true), 0.5);
  assert.ok(Math.abs(cupQuality(3, 0.9, true) - 0.6 * 0.9 * 0.5) < 1e-9);
});

// (4) serveNudge scales warmth by roast, scorch reads as stale
test('Phase 3 · serveNudge takes roastMul + scorched with legacy defaults', () => {
  assert.ok(Math.abs(serveNudge('yirgacheffe', 'creatives', 0, 0.8) - 0.3 * 0.05 * 0.8) < 1e-9);
  assert.equal(serveNudge('huila', 'tourists', 0, 1, true), -0.03);
  // legacy 3-arg calls behave as roastMul 1, unscorched (backward compatible)
  assert.ok(Math.abs(serveNudge('huila', 'tourists', 0) - serveNudge('huila', 'tourists', 0, 1, false)) < 1e-12);
  assert.ok(typeof SCORCH_LINE === 'string' && SCORCH_LINE.length > 10);
});

// (5) Entries ship UNPROGRAMMED (the drum is a decision, not a default);
// dawn clears scorch.
test('Phase 3 · lots default unprogrammed + clean; resolveDawn clears scorch', () => {
  const s = new LotsState();
  for (const id of ['cerrado', 'huila', 'yirgacheffe', 'gesha']) {
    assert.equal(s.entry(id).roast, null);
    assert.equal(s.entry(id).scorched, false);
  }
  s.entry('huila').scorched = true;
  s.resolveDawn(2);
  assert.equal(s.entry('huila').scorched, false);
});

// (6) Server roast mirror
test('Phase 3 · convex mirrors roast ideals, quality, nudges, fields', () => {
  assert.match(gameConfig, /ROAST_IDEAL/);
  assert.match(gameConfig, /cerrado: 4, huila: 3, yirgacheffe: 2, gesha: 2/);
  assert.match(gameConfig, /function roastQuality/);
  assert.match(gameConfig, /roastMul = 1, scorched = false/);
  assert.match(gameConfig, /ROAST_LEAN/);
  assert.match(gameConfig, /ROAST_CLIMATE_LEAN: Record<string, number> = \{ fair: 0, heat: -1, rain: 0, crisp: 1 \}/);
  assert.match(gameConfig, /crowdRoastPull\(mix\) \+ \(\+climateLean \|\| 0\)/);
  assert.match(gameConfig, /function roastIdeal/);
  assert.match(gameConfig, /if \(level === null \|\| level === undefined\) return 0\.9/);
  assert.match(schema, /roast: v\.optional\(v\.union\(v\.number\(\), v\.null\(\)\)\)/);
  assert.match(schema, /scorched: v\.optional/);
  // the server cellar must not pre-program the drum either
  assert.match(lotsTs, /roast: null/);
});

// (7) Brief roast stepper stages per selected lot; commit applies
test('Phase 3 · roast stepper stages; applyLots commits the roast', () => {
  assert.match(main, /brief-roast-minus/);
  assert.match(main, /brief-roast-plus/);
  assert.match(main, /lotRoastQuality\(selectedLot, stagedRoast\)/);
  assert.match(main, /entry\.roast = Number\.isFinite\(stagedRoast\)/);
  assert.match(main, /stagedRoast = lotState\.entry\(selectedLot\)\?\.roast/);
  // the weekly read reaches the UI, and the serve loop reads the same target
  assert.match(main, /this week reads \$\{ideal\}/);
  assert.match(main, /The drum's sweet spot this week is \$\{ideal\}/);
  assert.match(main, /function crowdCupMix/);
  assert.match(main, /roastIdeal\(id, crowdCupMix\(\), ROAST_CLIMATE_LEAN\[climate\?\.id\]/);
});

// (8) Serve loop is roast-aware; Ruth cups the sour shots at skill 1+
test('Phase 3 · palate reads roast + scorch; skill halves sour nudges', () => {
  const idx = main.indexOf('roast-aware palate');
  assert.ok(idx > 0, 'roast-aware serve block must exist');
  const body = main.slice(idx, idx + 1400);
  assert.match(body, /lotRoastQuality\(e\.lotId, lot\?\.roast\)/);
  assert.match(body, /serveNudge\(e\.lotId, e\.p\.cohort, age, roastMul, scorched\)/);
  assert.match(body, /ruthSkill >= 1 && nudge < 0/);
  assert.match(body, /SCORCH_LINE/);
  assert.match(main, /patrons\.skillPts = ruthSkill/);
  assert.match(patrons, /ECON\.barPoints \+ \(this\.skillPts \|\| 0\)/);
  assert.match(main, /trainingTotal \+= trainingSpend/);
  assert.match(main, /Math\.min\(2, Math\.floor\(trainingTotal \/ 36\)\)/);
});

// (9) Scorch incident: re-roast or serve dark
test('Phase 3 · scorch incident trades £18 for a fresh clock', () => {
  assert.match(main, /who: 'the roast'/);
  assert.match(main, /e\.roastedOn = day; e\.scorched = false/);
  assert.match(main, /e\.scorched = true/);
});

// (10) The drum's own teeth: dark roasts can burn the sack, and the roll is
// on its own saved stream — never bare Math.random, and never an offset
// another stream already draws (the market wobble took +47 first).
test('craft · scorch is the price of a dark setting, on a seeded stream', () => {
  assert.match(main, /const SCORCH_RISK = \{ 1: 0, 2: 0, 3: 0, 4: 0\.08, 5: 0\.20 \}/);
  assert.match(main, /entry\.scorched = roastRng\(\) < SCORCH_RISK\[stagedRoast\]/);
  assert.match(main, /let roastRng = seeded\(seedNow\(\) \+ 53\)/);
  assert.match(main, /roastRng = seeded\(\(save\.seed \|\| seedNow\(\)\) \+ 53, ss\.roast\)/);
  assert.match(main, /roast: roastRng && roastRng\.state/);
  // an unprogrammed drum cannot scorch — you only burn a roast you chose
  assert.doesNotMatch(main, /SCORCH_RISK\[null\]/);
  const siblings = readdirSync(root + '/web/js')
    .filter(f => f.endsWith('.js') && f !== 'main.js')
    .map(f => readFileSync(resolve(root, 'web/js', f), 'utf8'))
    .filter(src => /seeded\([^)]*\+ *53\b/.test(src));
  assert.deepEqual(siblings, [], 'stream offset +53 is already drawn by another module');
});
