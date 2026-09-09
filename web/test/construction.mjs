// Headless test that PROVES the day-5 construction prop:
//   1. tarp() returns a factory with a draw() function and a 512×512 canvas.
//   2. tarp().draw() returns a texture with a non-null image.
//   3. dayHasConstruction(d) returns true for d >= 5, false for d ∈ {1,2,3,4}.
//   4. Public API + integration: main.js calls W.setConstruction(d) in
//      openDay; world.js defines W.setConstruction; the source has the
//      visibility-toggle logic.
//
// Run: node web/test/construction.mjs
import { tarp, dayHasConstruction } from '../js/textures.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- minimal canvas stub (same shape as rent-sign) --------------------------
function makeCtx() {
  return {
    fillStyle: '#000', strokeStyle: '#000', font: '', textAlign: 'left', textBaseline: 'top',
    lineWidth: 1,
    fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
    beginPath() {}, rect() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {}, fill() {}, arc() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    clearRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}
globalThis.document = {
  createElement: t => t === 'canvas' ? { width: 0, height: 0, getContext: () => makeCtx() } : {},
};

const fails = [];

// 1) tarp() returns a factory with draw() and a canvas
const t = tarp();
if (typeof t.draw !== 'function') fails.push('tarp().draw is not a function');
if (!(t.canvas && t.canvas.width === 512 && t.canvas.height === 512))
  fails.push(`tarp().canvas shape wrong: ${t.canvas?.width}x${t.canvas?.height}`);
console.log('API     tarp().draw is fn | canvas 512x512');

// 2) draw() returns a texture with a non-null image
const tex = t.draw();
if (!tex) fails.push('tarp().draw() returned null');
else if (!tex.image) fails.push('tarp().draw() texture has no image');
console.log('DRAW    tarp().draw() → texture with image');

// 3) dayHasConstruction ladder
const cases = [[1, false], [2, false], [3, false], [4, false], [5, true], [6, true], [99, true]];
for (const [d, expected] of cases) {
  if (dayHasConstruction(d) !== expected)
    fails.push(`dayHasConstruction(${d}) = ${dayHasConstruction(d)}, expected ${expected}`);
}
console.log('LADDER  dayHasConstruction: 1..4=false, 5..=true');

// 4) Integration: main.js → world.setConstruction(d); world.js defines it
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
if (!/world\.setConstruction\(d\)/.test(main))
  fails.push('main.js does not call world.setConstruction(d) in openDay');
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
if (!/W\.setConstruction\s*=/.test(world))
  fails.push('world.js does not define W.setConstruction');
if (!/tarp\(/.test(world))
  fails.push('world.js does not import/use tarp()');
// visibility-toggle logic: cgrp.visible = ... and W.cTarpMat.opacity = ...
if (!/cgrp\.visible\s*=\s*on/.test(world))
  fails.push('world.js does not toggle cgrp.visible on day-5');
if (!/cTarpMat\.opacity\s*=\s*on/.test(world))
  fails.push('world.js does not toggle tarp opacity on day-5');
console.log('WIRED   main.openDay → W.setConstruction(d) → tarp visible on day 5');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — day-5 construction: tarp factory, day-gated visibility, integrated into openDay');
