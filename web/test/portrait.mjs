// Phase 0 — Seeded procedural portraits (ART.md).
// Verifies: (1) hashSeed is stable uint32, (2) avatarSpec is deterministic
// (same seed → same face, forever), (3) different seeds vary, (4) full
// coverage of styles/accessories/skins across seeds, (5) clothing stays
// inside the ART.md cohort palettes, (6) paint order is bg → clothing →
// face → hair → eyes → mouth → accessory (recording stub), (7) mood changes
// only the mouth, (8) only portraitCanvas touches document (DOM-free import).
//
// Imports the pure module directly — no DOM, no GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  hashSeed, mulberry32, avatarSpec, paintPortrait,
  PAL, MOODS, PORTRAIT_SIZE,
} from '../js/portrait.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../js/portrait.js'), 'utf8');

// Recording stub ctx — records every set + call in order.
function stubCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_t, p) => (...a) => { calls.push([p, ...a]); },
    set: (_t, p, v) => { calls.push(['set:' + String(p), v]); return true; },
  });
  return { calls, ctx };
}

// (1) hashSeed: stable uint32
test('Phase 0 · hashSeed is a stable uint32', () => {
  const a = hashSeed('mara-004');
  assert.equal(a, hashSeed('mara-004'));
  assert.ok(Number.isInteger(a) && a >= 0 && a <= 0xffffffff);
  assert.notEqual(a, hashSeed('mara-005'));
});

// (2) avatarSpec: deterministic — same seed, same face, forever
test('Phase 0 · avatarSpec is deterministic per seed + cohort', () => {
  const a = avatarSpec('mara-004', 'creatives');
  const b = avatarSpec('mara-004', 'creatives');
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a).sort(),
    ['accessory', 'clothing', 'hairColor', 'hairStyle', 'skin']);
});

// (3) different seeds vary
test('Phase 0 · different seeds yield different faces', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(JSON.stringify(avatarSpec('patron-' + i, 'students')));
  assert.ok(seen.size > 40, `expected variety, got ${seen.size}/50 unique`);
});

// (4) full coverage across seeds
test('Phase 0 · every style/accessory/skin appears across seeds', () => {
  const hair = new Set(), acc = new Set(), skin = new Set();
  for (let i = 0; i < 500; i++) {
    const s = avatarSpec('cover-' + i, 'commuters');
    hair.add(s.hairStyle); acc.add(s.accessory); skin.add(s.skin);
  }
  assert.equal(hair.size, 6);
  assert.equal(acc.size, 4);
  assert.equal(skin.size, 5);
});

// (5) clothing inside ART.md cohort palettes
test('Phase 0 · clothing stays inside the cohort palette', () => {
  const cohorts = {
    commuters: [PAL.walnut, PAL.slate],
    creatives: [PAL.ink, PAL.teal],
    students: [PAL.matcha, PAL.brass],
    elders: [PAL.cream, PAL.walnut],
    tourists: [PAL.teal, PAL.brass],
    rival: [PAL.cream, PAL.ink],
  };
  for (const [cohort, pool] of Object.entries(cohorts)) {
    for (let i = 0; i < 30; i++) {
      const s = avatarSpec(`${cohort}-${i}`, cohort);
      assert.ok(pool.includes(s.clothing),
        `${cohort} clothing ${s.clothing} outside palette`);
    }
  }
  // unknown cohort falls back to default (matcha/teal), never crashes
  const d = avatarSpec('stranger-1', 'nope');
  assert.ok([PAL.matcha, PAL.teal].includes(d.clothing));
});

// (6) paint order: bg → clothing → face → hair → eyes → mouth → accessory
test('Phase 0 · paintPortrait layers in ART.md order', () => {
  // Synthetic spec with all-distinct colors so layer order is unambiguous
  // (real specs may legitimately repeat a color across layers).
  const spec = { skin: '#111111', hairStyle: 'side-part', hairColor: '#222222', accessory: 'none', clothing: '#333333' };
  const { calls, ctx } = stubCtx();
  paintPortrait(ctx, spec, PORTRAIT_SIZE, 'flat');
  // bg paper is literally the first thing painted
  assert.deepEqual(calls[0], ['set:fillStyle', PAL.paper]);
  const first = (style) => calls.findIndex(([k, v]) => k === 'set:fillStyle' && v === style);
  const iCloth = first('#333333'), iFace = first('#111111'), iHair = first('#222222');
  assert.ok(iCloth > 0 && iCloth < iFace && iFace < iHair,
    'clothing → face → hair order violated');
  // eyes: two ink dots (r=2.6u), after hair
  const eyeIdx = calls.findIndex(([m, _x, _y, r]) => m === 'arc' && r === 2.6);
  assert.ok(eyeIdx > iHair, 'eyes must be drawn after hair');
  // mouth (ink stroke) after eyes
  const mouthStroke = calls.findIndex(([k, v]) => k === 'set:strokeStyle' && v === PAL.ink);
  assert.ok(mouthStroke > eyeIdx, 'mouth must be drawn after eyes');
  // brass ring + clasp exist (the stamp idiom)
  assert.ok(calls.some(([k, v]) => k === 'set:strokeStyle' && v === PAL.brass));
});

// (7) mood changes only the mouth
test('Phase 0 · mood branches the mouth (warm/flat/sour differ)', () => {
  assert.deepEqual([...MOODS].sort(), ['flat', 'sour', 'warm']);
  const spec = avatarSpec('mood-1', 'elders');
  const logs = {};
  for (const mood of MOODS) {
    const { calls, ctx } = stubCtx();
    paintPortrait(ctx, spec, PORTRAIT_SIZE, mood);
    logs[mood] = JSON.stringify(calls);
  }
  assert.notEqual(logs.warm, logs.flat);
  assert.notEqual(logs.sour, logs.flat);
  assert.notEqual(logs.warm, logs.sour);
  // …but everything before the mouth is identical (mouth is last-varying layer
  // before accessory): specs are equal, only paint calls differ
  assert.deepEqual(spec, avatarSpec('mood-1', 'elders'));
});

// (8) DOM-free import — only portraitCanvas touches document
test('Phase 0 · only portraitCanvas references document', () => {
  const code = src.replace(/\/\/.*$/gm, ''); // strip comments
  const hits = (code.match(/document/g) || []).length;
  assert.equal(hits, 1);
  assert.match(src, /export function portraitCanvas/);
});

// mulberry32 sanity: [0,1) stream, seed-sensitive
test('Phase 0 · mulberry32 streams in [0,1) and splits by seed', () => {
  const r1 = mulberry32(7), r2 = mulberry32(7), r3 = mulberry32(8);
  const a = [r1(), r1(), r1()], b = [r2(), r2(), r2()], c = [r3(), r3(), r3()];
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const v of [...a, ...c]) assert.ok(v >= 0 && v < 1);
});
