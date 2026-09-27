// PR-B3 — Weekly score with stakes · headless file-shape test
// Verifies that the week resolves: weekly winner is computed, the receipt
// declares it, the SOLD finale adapts, and the brief shows running totals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds/web';
const MAIN = `${ROOT}/js/main.js`;
const main = readFileSync(MAIN, 'utf8');

// campaignClose is where the finale is built
function campaignCloseSlice() {
  const i = main.indexOf('function campaignClose');
  assert.ok(i > -1, 'campaignClose not found');
  return main.slice(i, i + 6000);
}

function renderRivalSlice() {
  const i = main.indexOf('function renderRivalLine');
  assert.ok(i > -1, 'renderRivalLine not found');
  return main.slice(i, i + 2500);
}

test('weekly-stakes: weekly winner is computed from cServed vs (cRivalServed + cRivalChoices)', () => {
  const slice = campaignCloseSlice();
  // the helper variables must exist
  assert.match(slice, /yourWeekTotal\s*=\s*cServed/);
  assert.match(slice, /samWeekTotal\s*=\s*\(cRivalServed \|\| 0\)\s*\+\s*\(cRivalChoices \|\| 0\)/);
  assert.match(slice, /weekDelta\s*=\s*yourWeekTotal\s*-\s*samWeekTotal/);
  assert.match(slice, /wkWin\s*=\s*weekDelta\s*>\s*0\s*\?\s*['"]you['"]/);
  // tie branch: weekDelta < 0 → Sam wins, equality → tie
  assert.match(slice, /wkWin\s*===\s*['"]tie['"]/);
  assert.match(slice, /wkMargin\s*=\s*Math\.abs\(weekDelta\)/);
});

test('weekly-stakes: receipt has WEEK WINNER line', () => {
  const slice = campaignCloseSlice();
  assert.match(slice, /\['WEEK WINNER'/);
  // either "won by X cups" or "DEUCE" form
  assert.match(slice, /(won by) \$\{wkMargin\} cups|DEUCE/);
});

test('weekly-stakes: finale branches on wkWin', () => {
  const slice = campaignCloseSlice();
  // 'you' branch → FOR LEASE card + "you won the week"
  assert.match(slice, /if\s*\(wkWin\s*===\s*['"]you['"]\)/);
  assert.match(slice, /fx\.card\(\s*['"]FOR LEASE['"]/);
  assert.match(slice, /you won the week by \$\{wkMargin\} cups/);
  // 'Sam' branch → SOLD card + "Sam won the week". The actual code uses
  // `wkWin === COPY.rivalBarista` (no template wrapper).
  assert.match(slice, /else\s+if\s*\(wkWin\s*===\s*COPY\.rivalBarista\)/);
  assert.match(slice, /Sam won the week by \$\{wkMargin\} cups/);
  // tie branch → DEUCE
  assert.match(slice, /fx\.card\(\s*['"]DEUCE['"]/);
});

test('weekly-stakes: renderRivalLine shows week-so-far running tally', () => {
  const slice = renderRivalSlice();
  // cServed/cRivalServed/cRivalChoices used to compute week totals
  assert.match(slice, /weekYou\s*=\s*cServed/);
  assert.match(slice, /weekSam\s*=\s*\(cRivalServed \|\| 0\)\s*\+\s*\(cRivalChoices \|\| 0\)/);
  // day-2 gate: only show if day >= 2 AND delta is non-zero
  assert.match(slice, /day\s*>=\s*2\s*&&\s*Math\.abs\(weekDelta\)\s*>\s*0/);
  // "you lead by" / "Sam leads by" copy
  assert.match(slice, /leads by <b>\$\{-weekDelta\}<\/b>/);
});
