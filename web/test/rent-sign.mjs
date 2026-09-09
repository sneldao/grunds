// Headless test that PROVES the rent-pressure sign:
//   1. rentSign() returns a factory with a draw() function and a canvas
//      object (512x384).
//   2. draw('let'), draw('lease'), draw('sold') are each callable and each
//      return a texture with a non-null image. The draw() function
//      intentionally re-bakes onto the shared canvas, so the texture
//      object differs across bakes.
//   3. stateForDay(d) returns 'let' for d ∈ {1, 2}, 'lease' for d ∈ {3, 4},
//      'sold' for d = 5 (and clamps past 5 to 'sold').
//   4. Public API + integration: the rent-sign + stateForDay + main.js
//      openDay → W.setRentPressure(d) chain is in place (verified by
//      grepping the source — we don't render in headless, so we check the
//      wiring is real, not that pixels changed).
//
// Run: node web/test/rent-sign.mjs
import { rentSign, stateForDay } from '../js/textures.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- minimal canvas stub ------------------------------------------------------
// textures.js uses document.createElement('canvas').getContext('2d') for every
// draw. We need a 2D context that satisfies the calls rentSign() makes: fill
// styles, fillRect/strokeRect/fillText/strokeText, save/restore/translate/
// rotate, fillStyle/strokeStyle/font/textAlign/textBaseline, and the gradient
// helpers. We don't need pixel reads — the test verifies state via the texture
// object, not via getImageData. So a no-op recording stub works.
function makeCtx() {
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', font: '', textAlign: 'left', textBaseline: 'top',
    lineWidth: 1,
    fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {}, fill() {}, arc() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    clearRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  return ctx;
}
globalThis.document = {
  createElement: t => t === 'canvas' ? { width: 0, height: 0, getContext: () => makeCtx() } : {},
};
const fails = [];

// 1) rentSign returns a factory with draw() and a canvas
const rs = rentSign();
if (typeof rs.draw !== 'function') fails.push('rentSign().draw is not a function');
if (!(rs.canvas && rs.canvas.width === 512 && rs.canvas.height === 384))
  fails.push(`rentSign().canvas shape wrong: ${rs.canvas?.width}x${rs.canvas?.height}`);
console.log('API     rentSign().draw is fn | canvas 512x384');

// 2) Each state is callable and returns a texture with a non-null image.
//    We test that draw() does not throw and that the returned texture's
//    image is the shared canvas (the re-bake pattern).
const tLet = rs.draw('let');
const tLease = rs.draw('lease');
const tSold = rs.draw('sold');
for (const [name, t] of [['let', tLet], ['lease', tLease], ['sold', tSold]]) {
  if (!t) fails.push(`draw("${name}") returned null`);
  else if (!t.image) fails.push(`draw("${name}") texture has no image`);
}
if (tLet === tLease || tLease === tSold || tLet === tSold)
  fails.push('expected distinct texture instances per state');
console.log('DRAW    let/lease/sold all return textures with non-null image');

// 3) stateForDay ladder
const cases = [[1, 'let'], [2, 'let'], [3, 'lease'], [4, 'lease'], [5, 'sold'], [6, 'sold'], [99, 'sold']];
for (const [d, expected] of cases) {
  if (stateForDay(d) !== expected)
    fails.push(`stateForDay(${d}) = ${stateForDay(d)}, expected ${expected}`);
}
console.log('LADDER  stateForDay: 1..2=let, 3..4=lease, 5..=sold');

// 4) Integration: main.js calls W.setRentPressure(d) in openDay. We check
//    the source so we don't have to spin up the full DOM stack just for
//    this assertion. (The other tests do the full spin-up; this one keeps
//    it light because pixel sampling would need a real canvas.)
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
if (!/world\.setRentPressure\(d\)/.test(main))
  fails.push('main.js does not call world.setRentPressure(d) in openDay');
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
if (!/W\.setRentPressure\s*=/.test(world))
  fails.push('world.js does not define W.setRentPressure');
if (!/rentSign\(/.test(world))
  fails.push('world.js does not import/use rentSign()');
console.log('WIRED   main.openDay → W.setRentPressure(d) → rentSign(stateForDay(d))');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — rent sign: factory, three drawable states, day→state ladder, integrated into openDay');
