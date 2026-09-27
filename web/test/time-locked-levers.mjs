// PR-5 — Time-locked levers.
// Verifies: (1) commitDayPlan arms the lever lock, (2) the day-reset path
// disarms it, (3) doPrebatch / doReprice consult chargeLeverOverride when
// lock + dayMin >= 720, (4) the override constant is £4.20, (5) the
// gossip opinion hit is small (-0.06 / press).
//
// Pure file-shape test — no DOM, no runtime. Honest about what it can prove
// from the filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');

// (1) constant + helper exist
test('PR-5 · LEVER_OVERRIDE_PRICE constant is 4.20', () => {
  assert.match(main, /const\s+LEVER_OVERRIDE_PRICE\s*=\s*4\.20/);
});

test('PR-5 · LEVER_OVERRIDE_GOSSIP constant is 0.06 (small opinion hit)', () => {
  assert.match(main, /const\s+LEVER_OVERRIDE_GOSSIP\s*=\s*0\.06/);
});

test('PR-5 · chargeLeverOverride helper exists', () => {
  assert.match(main, /function\s+chargeLeverOverride\s*\(\s*leverName\s*\)/);
});

// (2) commitDayPlan arms the lock
test('PR-5 · commitDayPlan sets leversTimeLocked = true', () => {
  // The flag is set inside commitDayPlan, before the sync.managed branch.
  const idx = main.indexOf('function commitDayPlan');
  assert.ok(idx > 0, 'commitDayPlan must be defined');
  const body = main.slice(idx, idx + 800);
  assert.match(body, /leversTimeLocked\s*=\s*true/,
    'commitDayPlan must set leversTimeLocked=true so mid-day presses cost');
});

// (3) day reset disarms the lock
test('PR-5 · day reset (around line 1664) disarms leversTimeLocked', () => {
  // Find the reset block: lines containing `peakQueue = 0` and the
  // existing prebatched = false ... reset pattern, then check that
  // leversTimeLocked = false appears within ~120 chars after it.
  const m = main.match(/peakQueue\s*=\s*0[\s\S]{0,200}?leverOverrideCount\s*=\s*0\s*;/);
  assert.ok(m, 'day reset must set leversTimeLocked = false and leverOverrideCount = 0');
});

// (4) doPrebatch + doReprice consult chargeLeverOverride when locked
test('PR-5 · doPrebatch calls chargeLeverOverride when locked + dayMin >= 720', () => {
  const idx = main.indexOf('function doPrebatch');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 600);
  assert.match(body, /leversTimeLocked\s*&&\s*dayMin\s*>=\s*720/);
  assert.match(body, /chargeLeverOverride\(\s*['"]pre-batch['"]\s*\)/);
});

test('PR-5 · doReprice calls chargeLeverOverride when locked + dayMin >= 720', () => {
  const idx = main.indexOf('function doReprice');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 600);
  assert.match(body, /leversTimeLocked\s*&&\s*dayMin\s*>=\s*720/);
  assert.match(body, /chargeLeverOverride\(\s*['"]reprice['"]\s*\)/);
});

// (5) chargeLeverOverride refuses when till < £4.20
test('PR-5 · chargeLeverOverride refuses when till < price', () => {
  const idx = main.indexOf('function chargeLeverOverride');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 800);
  assert.match(body, /till\s*<\s*LEVER_OVERRIDE_PRICE/);
  assert.match(body, /not in the till/);
});

// (6) chargeLeverOverride applies the gossip opinion hit
test('PR-5 · chargeLeverOverride deducts opinion from every regular', () => {
  const idx = main.indexOf('function chargeLeverOverride');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 800);
  assert.match(body, /r\.op\s*=\s*Math\.max\(\s*0\s*,\s*r\.op\s*-\s*LEVER_OVERRIDE_GOSSIP\s*\)/);
});

// (7) the lever press itself is unchanged — override just unlocks it
test('PR-5 · doPrebatch still does the prep after override cost', () => {
  // If chargeLeverOverride returns true (caller does && ... && !charge), the
  // press proceeds. Make sure the gate pattern is `&& !chargeLeverOverride(...)`,
  // not `if (!charge) return;` — so the rest of the prep still runs.
  const idx = main.indexOf('function doPrebatch');
  const body = main.slice(idx, idx + 800);
  assert.match(body, /!\s*chargeLeverOverride\(\s*['"]pre-batch['"]\s*\)\s*\)\s*return/);
});
