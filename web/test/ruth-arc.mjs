// Phase 4 — Ruth's arc: hinted condition → asked cause → promised rest →
// a friend walks in. All state and UI live in main.js (condition, staffing
// row, dawn hooks); this file pins every step by shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');

// (1) Arc state + causes exist
test('Phase 4 · Ruth arc state and causes are declared', () => {
  assert.match(main, /ruthNoticed = false, ruthAsked = false, ruthRestDay = 0, ruthReturned = false/);
  assert.match(main, /RUTH_CAUSES/);
  assert.match(main, /the lunch rush, every day/);
  assert.match(main, /Four 5ams in a row/);
});

// (2) Dawn hint: fading past 0.45, once, never day 1
test('Phase 4 · dawn notices Ruth fading exactly once', () => {
  assert.match(main, /!ruthNoticed && d > 1 && baristaCondition < 0\.45/);
  assert.match(main, /Ruth’s moving slow this morning — is she alright\?/);
});

// (3) Ask reveals the cause; the cause reads yesterday
test('Phase 4 · ask button reveals a cause read from yesterday’s floor', () => {
  assert.match(main, /brief-ruth-ask/);
  assert.match(main, /ask her what’s wrong/);
  assert.match(main, /lastDayStats\?\.balked \|\| 0\) > 50 \? RUTH_CAUSES\.rush : RUTH_CAUSES\.opens/);
  assert.match(main, /Ruth, quietly:/);
});

// (4) Promise locks tomorrow (never past the week); forced home honors it
test('Phase 4 · promise locks tomorrow’s staffing; rest day forces home', () => {
  assert.match(main, /brief-ruth-promise/);
  assert.match(main, /promise her tomorrow off/);
  assert.match(main, /ruthRestDay = Math\.min\(day \+ 1, CAMPAIGN\.days\)/);
  assert.match(main, /if \(ruthRestDay === d\) \{\s*\n?\s*if \(planDraft\) planDraft\.staffing = 'home'/);
  assert.match(main, /Ruth’s day off — as promised/);
});

// (5) Return: the morning after rest, a stranger becomes a friend
test('Phase 4 · Ruth returns with a friend who becomes a regular', () => {
  assert.match(main, /ruthRestDay > 0 && d === ruthRestDay \+ 1 && !ruthReturned/);
  assert.match(main, /cand\.visits = 5; cand\._op = 0\.5; cand\.stage = stageFor\(5, 0\.5\)/);
  assert.match(main, /Ruth brought .* she’s a regular now/);
});

// (6) Reset rewinds the arc
test('Phase 4 · campaign reset clears Ruth’s arc', () => {
  assert.match(main, /ruthNoticed = false; ruthAsked = false; ruthRestDay = 0; ruthReturned = false;/);
});
