// web/test/perf-hygiene.mjs — pins the frame-time fixes of the performance
// passes (the "patchy and juddery" report). These are source contracts: the
// jank came from per-tick work storms and unbounded GPU cost, and the guard
// rails below keep them from quietly growing back.
// Run: node --test web/test/perf-hygiene.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../js/world.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const patrons = readFileSync(new URL('../js/patrons.js', import.meta.url), 'utf8');

// The ticker block: from its IIFE to the matching closer.
const tickerSrc = world.slice(world.indexOf('W.ticker = (function () {'), world.indexOf('// ---- the mailbox'));

test('the roaster ticker allocates ONE texture for the life of the page', () => {
  const allocs = (tickerSrc.match(/new THREE\.CanvasTexture/g) || []).length;
  assert.equal(allocs, 1, 'every draw used to allocate + upload a fresh GL texture (and leak the old one)');
  const drawBody = tickerSrc.slice(tickerSrc.indexOf('const draw = (s) => {'));
  assert.ok(!drawBody.includes('new THREE.CanvasTexture'), 'draw() must never allocate a texture');
  assert.ok(!drawBody.includes('tickerMat.needsUpdate'), 'the material never changes — only the texture contents do');
  assert.ok(drawBody.includes('tex.needsUpdate = true'), 'redraws flag the one texture for re-upload');
});

test('the ticker skips identical redraws and blits a pre-rendered grain', () => {
  assert.ok(tickerSrc.includes('lastKey'), 'change detection: same numbers → no repaint');
  assert.ok(/if \(key === lastKey\) return;/.test(tickerSrc));
  const drawBody = tickerSrc.slice(tickerSrc.indexOf('const draw = (s) => {'));
  assert.ok(!/i < 900/.test(drawBody), 'the 900-fillRect linen grain must not run inside draw()');
  assert.ok(drawBody.includes('g.drawImage(grain, 0, 0)'), 'grain is blitted from a pre-rendered canvas');
  assert.ok(tickerSrc.indexOf('const grain = document.createElement') < tickerSrc.indexOf('const draw'),
    'grain is built once, before the first draw');
});

test('the HUD flushes once per frame, not once per sim tick', () => {
  // tick() marks the HUD dirty; it no longer does DOM work itself.
  const tickBody = main.slice(main.indexOf('function tick() {'), main.indexOf('function recentTakeHome'));
  assert.ok(!/[^.\w]updateHUD\(\)/.test(tickBody), 'tick() must not call updateHUD() directly');
  assert.ok(tickBody.includes('_hudPending = true'), 'tick() marks the HUD pending instead');
  // The loop flushes exactly once, after all of the frame's ticks/bursts.
  assert.ok(main.includes('if (_hudPending) { _hudPending = false; updateHUD(); }'),
    'the frame loop coalesces ticks into one HUD pass');
  const flushAt = main.indexOf('if (_hudPending) { _hudPending = false; updateHUD(); }');
  const renderAt = main.indexOf('if (!headless) postfx.render(now);');
  assert.ok(flushAt > 0 && renderAt > 0 && flushAt < renderAt, 'the flush lands before the frame renders');
});

test('shadow budget flips on a hysteresis band, never per frame', () => {
  assert.ok(main.includes('patrons.queueLength <= 40'), 'off only past 40 in line');
  assert.ok(main.includes('patrons.queueLength < 32'), 'back on only under 32');
  assert.ok(main.includes('if (wantShadow !== _shadowOn)'), 'renderer state is written only on a real crossing');
});

test('the quality governor steps render scale before the lite cliff, and recovers', () => {
  assert.ok(main.includes('const _prLevels'), 'a resolution ladder exists');
  assert.ok(main.includes('if (++_slowFrames >= 4)'),
    'a step-down takes 4 slow frames — one dawn hitch must not downgrade the session');
  assert.ok(main.includes('if (_prIdx < _prLevels.length - 1) { _prIdx += 1; applyRenderScale(); }'),
    'scale steps down first');
  const ladderAt = main.indexOf('_prIdx < _prLevels.length');
  const cliffAt = main.indexOf('_liteSwitched = true', ladderAt);
  assert.ok(ladderAt > 0 && cliffAt > ladderAt, 'the lite cliff is strictly the last resort');
  assert.ok(main.includes('if (++_fastFrames >= 240 && _prIdx > 0)'),
    'a sustained fast stretch climbs one rung back');
  assert.ok(main.includes('if (_slowFrames > 0) _slowFrames--') && main.includes('else if (_fastFrames > 0) _fastFrames--'),
    'mixed frames decay both counters');
});

test('render scale changes resize the postfx targets in device pixels', () => {
  assert.ok(main.includes('renderer.getDrawingBufferSize(new THREE.Vector2())'),
    'scale changes and window resizes measure the drawing buffer');
  assert.ok(main.includes('postfx.resize(bs.x | 0, bs.y | 0)'),
    'postfx never receives CSS px (a retina window resize used to halve the RT)');
  assert.ok(!main.includes('postfx.resize(innerWidth, innerHeight)'), 'the old CSS-px resize is gone');
});

test('the sun shadow map stays on the integrated-GPU budget', () => {
  assert.ok(world.includes('sun.shadow.mapSize.set(1024, 1024)'),
    '2048² shadows were double the fill for marginal softness');
  assert.ok(!world.includes('mapSize.set(2048'), 'the 2048 map must not grow back');
});

test('patrons render loop keeps its per-frame allocations down', () => {
  const renderBody = patrons.slice(patrons.indexOf('render(dt, now, reduced = false) {'));
  assert.ok(!renderBody.includes('[...this.patrons]'), 'no per-frame array copy of the patron list');
  assert.ok(renderBody.includes('if (!p._prevVis) p._prevVis ='), '_prevVis is allocated once per patron, mutated after');
});
