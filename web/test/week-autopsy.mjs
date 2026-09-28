// Phase 6 — Week autopsy: the verdict receipt names its causes (DOM-free).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildAutopsy } from '../js/autopsy.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const autopsySrc = readFileSync(resolve(root, 'web/js/autopsy.js'), 'utf8');

test('Phase 6 · autopsy is pure and DOM-free', () => {
  assert.equal(typeof buildAutopsy, 'function');
  assert.ok(!/document|window|location/.test(autopsySrc), 'autopsy.js must not touch DOM');
});

test('Phase 6 · stale lots collapse into day ranges', () => {
  const days = [
    { day: 3, staleCupsByLot: { yirgacheffe: 12 }, batchWaste: 0, compost: 0, balked: 0, defections: 0, netToday: 100, opDrops: [] },
    { day: 4, staleCupsByLot: { yirgacheffe: 8 }, batchWaste: 0, compost: 0, balked: 0, defections: 0, netToday: 100, opDrops: [] },
  ];
  const lines = buildAutopsy(days, []);
  assert.ok(lines.some((l) => /stale Yirgacheffe days 3–4 \(20 cups\)/.test(l)), `got: ${lines.join(' | ')}`);
});

test('Phase 6 · waste + compost surface as cups', () => {
  const days = [{ day: 1, staleCupsByLot: {}, batchWaste: 31, compost: 60, balked: 0, defections: 0, netToday: 10, opDrops: [] }];
  const lines = buildAutopsy(days, []).join(' | ');
  assert.match(lines, /31 cups wasted/);
  assert.match(lines, /60 cups composted/);
});

test('Phase 6 · named coolers read from per-day drops, snapshot as fallback', () => {
  const days = [{ day: 2, staleCupsByLot: {}, batchWaste: 0, compost: 0, balked: 0, defections: 0, netToday: 10, opDrops: [{ name: 'Mara', from: 0.5, to: 0.3 }] }];
  assert.ok(buildAutopsy(days, []).join(' ').includes('Mara cooled 0.5 → 0.3'));
  const snap = buildAutopsy([], [{ name: 'Mara', op: 0.3 }]).join(' ');
  assert.ok(snap.includes('Mara cooled to 0.3'), `got: ${snap}`);
});

test('Phase 6 · balks, defections and negative days are counted', () => {
  const days = [
    { day: 1, staleCupsByLot: {}, batchWaste: 0, compost: 0, balked: 40, defections: 5, netToday: -50, opDrops: [] },
    { day: 2, staleCupsByLot: {}, batchWaste: 0, compost: 0, balked: 0, defections: 0, netToday: 20, opDrops: [] },
  ];
  const lines = buildAutopsy(days, []).join(' | ');
  assert.match(lines, /40 walked/);
  assert.match(lines, /5 chose Sam/);
  assert.match(lines, /till went backward day 1/);
});

test('Phase 6 · empty week still returns one line', () => {
  assert.deepEqual(buildAutopsy([], []), ['no single cause — the week just never caught fire']);
});

test('Phase 6 · floor wires the autopsy into closeDay + campaignClose + reset', () => {
  assert.ok(main.includes("import { buildAutopsy } from './autopsy.js'"), 'main must import buildAutopsy');
  assert.ok(main.includes('staleByLotToday[e.lotId]'), 'serve loop counts stale cups by lot');
  assert.ok(main.includes('campaignDays.push({'), 'closeDay pushes a cause record');
  assert.ok(main.includes("'lost because'"), 'campaignClose renders lost-because rows');
  assert.ok(main.includes('campaignDays = []; weekOpStart = null; staleByLotToday = {};'), 'reset rewinds the autopsy');
});
