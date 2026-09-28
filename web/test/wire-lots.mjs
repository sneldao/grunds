// Phase 2 — Wire → shelf: commodity events price specific lots with lags,
// hype/frost aftermath opens the Gesha window, dawn lands and expires.
// Verifies the schedule machine (LotsState) both sides of the mirror.
//
// Imports lots.js directly — no DOM, no GL. Server parity is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LOT_CATALOG, LOT_EVENTS, LotsState } from '../js/lots.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const gameConfig = readFileSync(resolve(root, 'convex/gameConfig.ts'), 'utf8');
const lotsTs = readFileSync(resolve(root, 'convex/lots.ts'), 'utf8');

// (1) Schedule table: frost/drought move Cerrado/Yirgacheffe with lag 2
test('Phase 2 · LOT_EVENTS prices frost and drought with a 2-day lag', () => {
  assert.deepEqual(LOT_EVENTS.frost_minas.moves, [{ lot: 'cerrado', mul: 1.35, lag: 2 }]);
  assert.deepEqual(LOT_EVENTS.drought_ea.moves, [{ lot: 'yirgacheffe', mul: 1.3, lag: 2 }]);
  assert.deepEqual(LOT_EVENTS.hype_matcha.moves, []);
  assert.deepEqual(LOT_EVENTS.hype_matcha.unlock, { lot: 'gesha', days: 2 });
  assert.equal(LOT_EVENTS.frost_minas.unlock, null);
});

// (2) applyWireEvent schedules moves and opens windows with note lines
test('Phase 2 · applyWireEvent schedules + unlocks + narrates', () => {
  const s = new LotsState();
  const notes = s.applyWireEvent('frost_minas', 1);
  assert.equal(s.pending.length, 1);
  assert.deepEqual(s.pending[0], { lot: 'cerrado', mul: 1.35, landDay: 3 });
  assert.match(notes[0], /Cerrado \+35% in 2d/);
  const h = new LotsState();
  const hnotes = h.applyWireEvent('hype_matcha', 2);
  assert.equal(h.entry('gesha').unlocked, true);
  assert.equal(h.entry('gesha').unlockUntil, 4);
  assert.match(hnotes[0], /Gesha unlocked \(2d\)/);
  assert.deepEqual(new LotsState().applyWireEvent('stable', 1), []);
});

// (3) resolveDawn lands due moves with report lines, holds future ones
test('Phase 2 · resolveDawn lands due moves exactly on landDay', () => {
  const s = new LotsState();
  s.applyWireEvent('drought_ea', 1);   // lands day 3
  assert.deepEqual(s.resolveDawn(2), []);
  assert.equal(s.entry('yirgacheffe').priceMul, 1);
  const report = s.resolveDawn(3);
  assert.equal(s.entry('yirgacheffe').priceMul, 1.3);
  assert.match(report[0], /Yirgacheffe \+30% — landed/);
  assert.equal(s.pending.length, 0);
});

// (4) Frost aftermath: landing Cerrado opens the Gesha window
test('Phase 2 · landing a cerrado move unlocks Gesha (supply shifts)', () => {
  const s = new LotsState();
  s.applyWireEvent('frost_minas', 1);
  assert.equal(s.entry('gesha').unlocked, false);
  const report = s.resolveDawn(3);
  assert.equal(s.entry('gesha').unlocked, true);
  assert.equal(s.entry('gesha').unlockUntil, 5);
  assert.ok(report.some(l => /Gesha unlocked/.test(l)));
});

// (5) Windows expire: unlockUntil passes → locked + report
test('Phase 2 · microlot windows close after unlockUntil', () => {
  const s = new LotsState();
  s.applyWireEvent('hype_matcha', 1);  // until day 3
  assert.deepEqual(s.resolveDawn(3), []);
  assert.equal(s.entry('gesha').unlocked, true);
  const report = s.resolveDawn(4);
  assert.equal(s.entry('gesha').unlocked, false);
  assert.ok(report.some(l => /window closed/.test(l)));
});

// (6) Landed multipliers compound and round to cents
test('Phase 2 · repeated landings compound priceMul', () => {
  const s = new LotsState();
  s.applyWireEvent('frost_minas', 1);
  s.applyWireEvent('frost_minas', 2);
  s.resolveDawn(3);   // first lands (day 1 + 2)
  assert.equal(s.entry('cerrado').priceMul, 1.35);
  s.resolveDawn(4);   // second lands (day 2 + 2)
  assert.equal(s.entry('cerrado').priceMul, Math.round(1.35 * 1.35 * 100) / 100);
});

// (7) Server LOT_WIRE mirrors the schedule table
test('Phase 2 · convex LOT_WIRE mirrors LOT_EVENTS', () => {
  assert.match(gameConfig, /frost_minas: \{ moves: \[\{ lot: 'cerrado', mul: 1\.35, lag: 2 \}\]/);
  assert.match(gameConfig, /drought_ea: \{ moves: \[\{ lot: 'yirgacheffe', mul: 1\.3, lag: 2 \}\]/);
  assert.match(gameConfig, /hype_matcha: \{ moves: \[\], unlock: \{ lot: 'gesha', days: 2 \} \}/);
  assert.match(lotsTs, /scheduleLotMoves/);
  assert.match(lotsTs, /unlockLot/);
  assert.match(lotsTs, /Panama Gesha unlocked/);
});
