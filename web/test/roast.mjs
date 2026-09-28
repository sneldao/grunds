// Phase 3 — Roast program + Ruth's skill + scorch.
// Verifies roast math (lots.js), skill wiring, the scorch incident, and the
// server roast mirror. Imports lots.js directly — no DOM, no GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ROAST_IDEAL, SCORCH_LINE, roastQuality, cupQuality, serveNudge, LotsState,
} from '../js/lots.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const gameConfig = readFileSync(resolve(root, 'convex/gameConfig.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'convex/schema.ts'), 'utf8');

// (1) Ideals per lot
test('Phase 3 · ROAST_IDEAL maps lots to 1–5', () => {
  assert.deepEqual(ROAST_IDEAL, { cerrado: 4, huila: 3, yirgacheffe: 2, gesha: 2 });
});

// (2) Distance costs 0.1 quality per step, clamped 1–5
test('Phase 3 · roastQuality is 1.0 at ideal, fades with distance', () => {
  assert.equal(roastQuality('huila', 3), 1.0);
  assert.equal(roastQuality('huila', 4), 0.9);
  assert.equal(roastQuality('huila', 1), 0.8);
  assert.equal(roastQuality('yirgacheffe', 5), 0.7);
  assert.equal(roastQuality('huila', 99), roastQuality('huila', 5));
  assert.equal(roastQuality('huila', -3), roastQuality('huila', 1));
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

// (5) Entries default to ideal roast, unscorched; dawn clears scorch
test('Phase 3 · lots default ideal + clean; resolveDawn clears scorch', () => {
  const s = new LotsState();
  for (const id of ['cerrado', 'huila', 'yirgacheffe', 'gesha']) {
    assert.equal(s.entry(id).roast, ROAST_IDEAL[id]);
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
  assert.match(schema, /roast: v\.optional/);
  assert.match(schema, /scorched: v\.optional/);
});

// (7) Brief roast stepper stages per selected lot; commit applies
test('Phase 3 · roast stepper stages; applyLots commits the roast', () => {
  assert.match(main, /brief-roast-minus/);
  assert.match(main, /brief-roast-plus/);
  assert.match(main, /roastQuality\(selectedLot, stagedRoast\)/);
  assert.match(main, /entry\.roast = Math\.min\(5, Math\.max\(1, Math\.round\(stagedRoast\)\)\)/);
  assert.match(main, /stagedRoast = lotState\.entry\(selectedLot\)\?\.roast/);
});

// (8) Serve loop is roast-aware; Ruth cups the sour shots at skill 1+
test('Phase 3 · palate reads roast + scorch; skill halves sour nudges', () => {
  const idx = main.indexOf('roast-aware palate');
  assert.ok(idx > 0, 'roast-aware serve block must exist');
  const body = main.slice(idx, idx + 1400);
  assert.match(body, /roastQuality\(e\.lotId/);
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
