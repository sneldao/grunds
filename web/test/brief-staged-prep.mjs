// PR-A1 — Brief-staged prep (radio picker).
// Verifies: (1) #brief-prep slot exists in the brief modal, (2) the
// stagedPrep state lives in main.js with batch/reprice toggles, (3)
// renderPrepSection() builds three radio pills (hold + batch + reprice) with
// the right copy, (4) applyStagedPrep() fires the lever with asPlanned: true,
// (5) doPrebatch/doReprice accept opts.asPlanned and skip chargeLeverOverride
// when true, (6) commitDayPlan calls applyStagedPrep() at the right place,
// (7) the day reset zeroes stagedPrep, (10) the pills are mutually exclusive
// (radio behaviour — clicking sets stagedPrep atomically).
//
// Pure file-shape test — no DOM, no runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main  = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const html  = readFileSync(resolve(root, 'web/index.html'), 'utf8');

// (1) HTML slot
test('PR-A1 · #brief-prep slot exists in the brief modal', () => {
  assert.match(html, /<div\s+id="brief-prep"\s+style="display:none"\s*><\/div>/);
});

// (2) stagedPrep state declaration
test('PR-A1 · stagedPrep state lives near other trading flags', () => {
  assert.match(main, /let\s+stagedPrep\s*=\s*\{\s*batch:\s*false\s*,\s*reprice:\s*false\s*\}/);
});

// (3) renderPrepSection exists and builds the three radio pills
test('PR-A1 · renderPrepSection() builds hold + batch + reprice radio pills', () => {
  const idx = main.indexOf('function renderPrepSection');
  assert.ok(idx > 0, 'renderPrepSection must be defined');
  // renderPrepSection is ~80 lines — slice generously
  const body = main.slice(idx, idx + 4500);
  assert.match(body, /brief-prep-hold/);
  assert.match(body, /brief-prep-batch/);
  assert.match(body, /brief-prep-reprice/);
  assert.match(body, /hold steady/);
  assert.match(body, /pre-batch \$\{ECON\.batchUnits\} cups/);
  // Use literal contains for the templated label (avoid regex escaping)
  assert.ok(body.includes('cut matcha to ${fmt(ECON.matchaDeal)}'),
    'reprice pill must label ECON.matchaDeal as the cut price');
  assert.match(body, /dataset\.prep\s*=\s*def\.key/,
    'pill must carry a prep key via dataset.prep');
});

// (4) applyStagedPrep calls doPrebatch/doReprice with asPlanned: true
test('PR-A1 · applyStagedPrep fires staged levers with asPlanned', () => {
  const idx = main.indexOf('function applyStagedPrep');
  assert.ok(idx > 0, 'applyStagedPrep must be defined');
  const body = main.slice(idx, idx + 1200);
  assert.match(body, /doPrebatch\(\s*\{\s*asPlanned:\s*true\s*\}\s*\)/);
  assert.match(body, /doReprice\(\s*\{\s*asPlanned:\s*true\s*\}\s*\)/);
});

// (5) doPrebatch + doReprice accept opts.asPlanned and skip the override
test('PR-A1 · doPrebatch skips override cost when opts.asPlanned is true', () => {
  const idx = main.indexOf('function doPrebatch');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 800);
  assert.match(body, /function doPrebatch\(opts\s*=\s*\{\}\)/);
  assert.match(body, /!opts\.asPlanned\s*&&\s*!chargeLeverOverride/);
});

test('PR-A1 · doReprice skips override cost when opts.asPlanned is true', () => {
  const idx = main.indexOf('function doReprice');
  assert.ok(idx > 0);
  const body = main.slice(idx, idx + 800);
  assert.match(body, /function doReprice\(opts\s*=\s*\{\}\)/);
  assert.match(body, /!opts\.asPlanned\s*&&\s*!chargeLeverOverride/);
});

// (6) commitDayPlan / applyCommittedPlan calls applyStagedPrep
test('PR-A1 · applyCommittedPlan calls applyStagedPrep after startTradingDay', () => {
  const idx = main.indexOf('function applyCommittedPlan');
  assert.ok(idx > 0);
  // applyCommittedPlan is ~50 lines — slice generously and find both anchors.
  const body = main.slice(idx, idx + 4500);
  // applyStagedPrep() must be called between startTradingDay and modals.close('brief').
  const st = body.search(/startTradingDay\(d\)\s*;?/);
  assert.ok(st > 0, 'startTradingDay must be called in applyCommittedPlan');
  const seg = body.slice(st, st + 400);
  assert.match(seg, /applyStagedPrep\(\)/);
  assert.match(seg, /modals\.close\(['"]brief['"]\)/);
});

// (7) Day reset zeroes stagedPrep
test('PR-A1 · day reset zeroes stagedPrep', () => {
  // Find the reset block (the line with peakQueue = 0 + the surrounding flags)
  const m = main.match(/prebatched\s*=\s*false[\s\S]{0,400}?stagedPrep\s*=\s*\{\s*batch:\s*false\s*,\s*reprice:\s*false\s*\}/);
  assert.ok(m, 'day reset must zero stagedPrep');
});

// (8) renderPrepSection is called from showMorningBrief
test('PR-A1 · showMorningBrief calls renderPrepSection', () => {
  const idx = main.indexOf('function showMorningBrief');
  assert.ok(idx > 0);
  // showMorningBrief is ~600 lines — slice the whole function and look for the call
  const endIdx = main.indexOf('\nfunction ', idx + 1);
  const body = main.slice(idx, endIdx > 0 ? endIdx : idx + 20000);
  assert.match(body, /renderPrepSection\(\)/);
});

// (9) Toast mentions "as planned" when staged lever fires
test('PR-A1 · doPrebatch toast appends "as planned in the brief" when staged', () => {
  const idx = main.indexOf('function doPrebatch');
  const body = main.slice(idx, idx + 2200);
  assert.match(body, /as planned in the brief/);
});

test('PR-A1 · doReprice toast appends "as planned in the brief" when staged', () => {
  const idx = main.indexOf('function doReprice');
  const body = main.slice(idx, idx + 1500);
  assert.match(body, /as planned in the brief/);
});

// (10) Radio behaviour: each pill sets stagedPrep atomically (mutually
// exclusive hold | batch | reprice), plus an isSelected helper that treats
// hold as "neither staged"
test('PR-A1 · prep pills are radio-exclusive (clicking sets both keys)', () => {
  const idx = main.indexOf('function renderPrepSection');
  assert.ok(idx > 0, 'renderPrepSection must be defined');
  const body = main.slice(idx, idx + 4500);
  // isSelected helper covers the three radio states
  assert.match(body, /key === 'hold'[\s\S]*?!stagedPrep\.batch && !stagedPrep\.reprice/);
  assert.match(body, /key === 'batch'[\s\S]*?stagedPrep\.batch && !stagedPrep\.reprice/);
  assert.match(body, /key === 'reprice'[\s\S]*?stagedPrep\.reprice && !stagedPrep\.batch/);
  // onclick sets both keys atomically per option
  assert.match(body, /def\.key === 'hold'[\s\S]*?stagedPrep\.batch = false;\s*stagedPrep\.reprice = false/);
  assert.match(body, /def\.key === 'batch'[\s\S]*?stagedPrep\.batch = true;\s*stagedPrep\.reprice = false/);
  assert.match(body, /def\.key === 'reprice'[\s\S]*?stagedPrep\.batch = false;\s*stagedPrep\.reprice = true/);
});
