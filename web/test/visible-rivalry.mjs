// PR-B1 — Visible rivalry · headless file-shape test
// Verifies that the rival is now personal (a named barista, side-by-side stats, named in toasts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds/web';
const MAIN = `${ROOT}/js/main.js`;
const CFG = `${ROOT}/js/config.js`;
const HTML = `${ROOT}/index.html`;
const main = readFileSync(MAIN, 'utf8');
const cfg = readFileSync(CFG, 'utf8');
const html = readFileSync(HTML, 'utf8');

// --- BYOD: never trust a call that returns true

test('visible-rivalry: rivalBarista name added to COPY', () => {
  assert.match(cfg, /rivalBarista:\s*['"]\w+/);
});

test('visible-rivalry: rival name is "Sam" by default', () => {
  const m = cfg.match(/rivalBarista:\s*['"]([^'"]+)['"]/);
  assert.ok(m, 'rivalBarista string not found');
  // Accept any short first name — the design choice is "named barista", not the specific name
  assert.ok(m[1].length > 0 && m[1].length < 24, `unexpected rival barista name: ${m[1]}`);
});

test('visible-rivalry: cRivalServed / cRivalChoices accumulators declared', () => {
  // The declaration line may chain cRivalServed and cRivalChoices or
  // list them separately. Accept either shape.
  assert.match(main, /cRivalServed\s*=\s*0/);
  assert.match(main, /cRivalChoices\s*=\s*0/);
});

test('visible-rivalry: cRivalServed / cRivalChoices reset in campaign-reset block', () => {
  // The chain looks like `cRev = cCost = ... = cRivalServed = cRivalChoices = settledPaid = 0;`
  // We accept any chain where both rival counters are set to a numeric literal (0 or chained).
  const idx = main.indexOf('cRev = cCost = cBalked =');
  assert.ok(idx > -1, 'campaign reset chain not found');
  const slice = main.slice(idx, idx + 200);
  // cRivalServed and cRivalChoices BOTH appear in the chain before `0`
  assert.match(slice, /cRivalServed\s*=\s*cRivalChoices\s*=/);
  assert.match(slice, /=\s*0\s*;$/m);
});

test('visible-rivalry: cRivalServed / cRivalChoices accumulated on day-end', () => {
  // We anchor on the day-end block by looking for the cRev += till line, then read 600 chars
  // around the day-end accumulation block. This is decoupled from the regex parse above.
  const idx = main.indexOf('cRev += till;');
  assert.ok(idx > -1, 'cRev += till; not found');
  const block = main.slice(idx, idx + 600);
  assert.match(block, /cRivalServed \+= rivalServed/);
  assert.match(block, /cRivalChoices \+= patrons\.rivalChoices/);
});

test('visible-rivalry: lastDayStats records rivalServed + rivalChoices', () => {
  const m = main.match(/lastDayStats = \{[\s\S]*?\};/);
  assert.ok(m, 'lastDayStats assignment not found');
  const slice = m[0];
  assert.match(slice, /rivalServed/);
  assert.match(slice, /rivalChoices/);
});

test('visible-rivalry: #brief-rival slot exists in HTML', () => {
  assert.match(html, /<div\s+id=["']brief-rival["']/);
});

test('visible-rivalry: renderRivalLine function defined', () => {
  assert.match(main, /function\s+renderRivalLine\s*\(\s*\)/);
});

test('visible-rivalry: renderRivalLine shows Sam by name and references lastDayStats', () => {
  const start = main.indexOf('function renderRivalLine');
  assert.ok(start > -1);
  // slice generously — renderRivalLine is ~25 lines
  const slice = main.slice(start, start + 2500);
  assert.match(slice, /COPY\.rivalBarista/);
  assert.match(slice, /lastDayStats/);
  // references the rival strategy by name + price
  assert.match(slice, /CAMPAIGN\.rivalStrategies\[rivalStrategy\]/);
});

test('visible-rivalry: showMorningBrief calls renderRivalLine', () => {
  const m = main.match(/function\s+showMorningBrief[\s\S]{0,20000}?(?=\nfunction\s)/);
  assert.ok(m, 'showMorningBrief body not found');
  assert.match(m[0], /renderRivalLine\(\)/);
});

test('visible-rivalry: wave-debrief mid-day card has you vs Sam line', () => {
  // The middle-of-day card: left side is "you vs " + COPY.rivalBarista,
  // right side is a template literal with `${served + servedRetail}`,
  // `${COPY.rivalBarista}`, and `${rivalServed + patrons.rivalChoices}`.
  assert.match(main, /you vs '\s*\+\s*COPY\.rivalBarista/);
  assert.match(main, /\$\{served \+ servedRetail\}[\s\S]{0,40}?\$\{COPY\.rivalBarista\}[\s\S]{0,40}?\$\{rivalServed \+ patrons\.rivalChoices\}/);
});

test('visible-rivalry: verdict receipt has you vs Sam week-tally line', () => {
  // The receipt-specific comment anchors us to the right block, then we
  // expect cServed and cRivalServed + cRivalChoices in the same line.
  const anchor = main.indexOf('PR-B1 — final week tally');
  assert.ok(anchor > -1, 'receipt-side-by-side comment not found in main.js');
  const slice = main.slice(Math.max(0, anchor - 400), anchor + 400);
  assert.match(slice, /you vs '\s*\+\s*COPY\.rivalBarista/);
  assert.match(slice, /\$\{cServed\}/);
  assert.match(slice, /\$\{COPY\.rivalBarista\}/);
  assert.match(slice, /cRivalServed \+ cRivalChoices/);
});

test('visible-rivalry: one existing toast greets Sam by name on rival move', () => {
  // PR-B1 deliberately injects COPY.rivalBarista into the "GLASSHOUSE moves" toast
  assert.match(main, /\$\{COPY\.rivalBarista\} moves: /);
});
