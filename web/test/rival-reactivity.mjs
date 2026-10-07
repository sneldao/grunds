// PR-B2 — Reactive AI · headless file-shape test
// Verifies that the rival reacts visibly to player moves during the day.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = `${ROOT}/js/main.js`;
const main = readFileSync(MAIN, 'utf8');

function sliceAfter(needle, n) {
  const i = main.indexOf(needle);
  if (i < 0) return '';
  return main.slice(i, i + n);
}

test('rival-reactivity: state declared', () => {
  assert.match(main, /let\s+rivalReacted\s*=\s*\{\s*cut:\s*0\s*,\s*prep:\s*0\s*\}/);
  assert.match(main, /let\s+rivalReactLog\s*=\s*\[\]/);
});

test('rival-reactivity: rivalReact function exists', () => {
  assert.match(main, /function\s+rivalReact\s*\(\s*playerMove\s*\)/);
});

test('rival-reactivity: prebatch branch boosts rivalCredit and toasts "Sam"', () => {
  // slice the function body generously
  const fnStart = main.indexOf('function rivalReact');
  assert.ok(fnStart > -1);
  const body = main.slice(fnStart, fnStart + 1500);
  assert.match(body, /playerMove\s*===\s*['"]prebatch['"]/);
  assert.match(body, /patrons\.rivalCredit\s*=\s*Math\.min\(1,\s*patrons\.rivalCredit\s*\+\s*1\.5\)/);
  // The toast is dynamic — the message must contain "grinding" or "clocks your prep"
  assert.match(body, /COPY\.rivalBarista/);
  assert.match(body, /['"]warn['"]/);
});

test('rival-reactivity: reprice branch drops stratDef.price by 0.10 and toasts "Sam undercuts"', () => {
  const fnStart = main.indexOf('function rivalReact');
  const body = main.slice(fnStart, fnStart + 1500);
  assert.match(body, /playerMove\s*===\s*['"]reprice['"]/);
  assert.match(body, /stratDef\.price\s*=\s*newPrice/);
  // newPrice formula: max(3.5, basePrice - 0.10), rounded to 2dp
  assert.match(body, /Math\.max\(3\.5,\s*Math\.round\(\(basePrice\s*-\s*0\.10\)\s*\*\s*100\)\s*\/\s*100\)/);
  // updates world.setRivalStrategy with the new price
  assert.match(body, /world\.setRivalStrategy\(rivalStrategy,\s*newPrice\.toFixed\(2\)\)/);
  // toast mentions Sam undercuts
  assert.match(body, /\$\{COPY\.rivalBarista\}\s+undercuts/);
});

test('rival-reactivity: doPrebatch hooks rivalReact("prebatch")', () => {
  const idx = main.indexOf('world.flashChalk(\'batch\')');
  assert.ok(idx > -1);
  const slice = main.slice(idx, idx + 400);
  assert.match(slice, /rivalReact\(\s*['"]prebatch['"]\s*\)/);
});

test('rival-reactivity: doReprice hooks rivalReact("reprice")', () => {
  const idx = main.indexOf('world.flashChalk(\'reprice\')');
  assert.ok(idx > -1);
  const slice = main.slice(idx, idx + 400);
  assert.match(slice, /rivalReact\(\s*['"]reprice['"]\s*\)/);
});

test('rival-reactivity: state reset on day-end', () => {
  // The day-reset block at line ~2425 has many `let x = ...` style resets.
  // Find a chunk that resets both rivalReacted and rivalReactLog together.
  const m = main.match(/rushFast = false;[\s\S]{0,2000}?rivalReacted\s*=\s*\{\s*cut:\s*0\s*,\s*prep:\s*0\s*\};\s*rivalReactLog\s*=\s*\[\]/);
  assert.ok(m, 'day-end reset of rivalReacted/rivalReactLog not found');
});

test('rival-reactivity: state reset on campaign-reset', () => {
  const m = main.match(/apprenticeHiredToday = false; rivalStrategy = 'DEFAULT';[\s\S]{0,200}?rivalReacted\s*=\s*\{\s*cut:\s*0\s*,\s*prep:\s*0\s*\};\s*rivalReactLog\s*=\s*\[\]/);
  assert.ok(m, 'campaign-reset of rivalReacted/rivalReactLog not found');
});

test('rival-reactivity: rivalReactLog sliced into renderRivalLine', () => {
  const fnStart = main.indexOf('function renderRivalLine');
  assert.ok(fnStart > -1);
  const slice = main.slice(fnStart, fnStart + 2000);
  // actual code: `(rivalReactLog || []).slice(0, 3).map(...)`
  assert.match(slice, /\(rivalReactLog\s*\|\|\s*\[\s*\]\)\s*\.\s*slice\(\s*0\s*,\s*3\s*\)/);
});
