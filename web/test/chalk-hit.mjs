// Chalkboard press reads as a hit: impact owns the board-scale sample,
// with the guarded camera nudge and chalk dust / screech on the lever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createImpact } from '../js/impact.js';
import { chalkPopScale } from '../js/world.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const worldSrc = readFileSync(resolve(root, 'web/js/world.js'), 'utf8');
const mainSrc = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const camSrc = readFileSync(resolve(root, 'web/js/camera.js'), 'utf8');

function mesh(x = 1, y = 1, z = 1) {
  return {
    userData: {},
    scale: { x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}

test('chalk pop is a hard uniform wobble that rests', () => {
  assert.ok(chalkPopScale(0) >= 2, 'strike is still too small to read from the idle camera');
  assert.equal(chalkPopScale(0), chalkPopScale(0.2), 'strike should hold long enough to read');
  assert.ok(chalkPopScale(0.7) < 1, 'wobble dips back through rest');
  assert.ok(chalkPopScale(0.7) > 0.9, 'dip is a wobble, not a collapse');
  assert.ok(Math.abs(chalkPopScale(1) - 1) < 1e-6, 'settles at 1');
  assert.ok(Math.abs(chalkPopScale(1.2) - 1) < 1e-6, 'stays home after the beat');
});

test('impact.js is the sole owner of board scale', () => {
  const flash = worldSrc.slice(worldSrc.indexOf('W.flashChalk'), worldSrc.indexOf('W._chalkPlane = plane'));
  assert.doesNotMatch(flash, /_chalkPlane\.scale|setScalar/, 'flashChalk must not write board scale');
  const delight = worldSrc.slice(worldSrc.indexOf('W._updateDelight'), worldSrc.indexOf('W.moteMat', worldSrc.indexOf('W._updateDelight')));
  assert.doesNotMatch(delight, /_chalkPlane\.scale|setScalar/, 'the delight loop must not write board scale');
  assert.match(worldSrc, /export function chalkPopScale\(u\)/, 'the pop curve stays a pure world export');
  assert.match(mainSrc, /sample: chalk \? t => \{ const s = chalkPopScale\(t \/ 0\.32\)/, 'main hands the board a uniform sample');
  assert.match(mainSrc, /duration: chalk \? 0\.32/, 'the board hit runs the chalk 0.32s, not the squash default');
  assert.match(mainSrc, /opts\.object === world\._chalkPlane/, 'the chalk sample only binds to the board');
  assert.match(mainSrc, /impact\.update\(nowSec\)/, 'the frame loop still drives impact scale');
});

test('the uniform sample scales the board then returns it to base at 0.32', () => {
  const imp = createImpact();
  const board = mesh();
  const sample = t => { const s = chalkPopScale(t / 0.32); return { x: s, y: s, z: s }; };
  imp.strike(4, { object: board, sample, duration: 0.32, stop: false, fov: false });
  imp.update(4);
  assert.ok(board.scale.x > 1 && Math.abs(board.scale.x - board.scale.y) < 1e-9 && Math.abs(board.scale.y - board.scale.z) < 1e-9,
    'the strike is a uniform pop, not a squash');
  imp.update(4 + 0.16);
  const mid = board.scale.x;
  assert.ok(mid > 1 && mid < chalkPopScale(0), 'wobbling home through the sample');
  imp.update(4 + 0.32);
  assert.equal(board.scale.x, 1);
  assert.equal(board.scale.y, 1);
  assert.equal(board.scale.z, 1);
  assert.equal(board.userData._impactBase, null);
});

test('repeated hits recapture the window but rest on the original base', () => {
  const imp = createImpact();
  const board = mesh(1.4, 0.9, 1);
  const sample = t => { const s = chalkPopScale(t / 0.32); return { x: s, y: s, z: s }; };
  imp.strike(2, { object: board, sample, duration: 0.32, stop: false, fov: false });
  imp.update(2 + 0.1);
  assert.ok(board.scale.x > 1.4, 'mid-strike the board is popped');
  imp.strike(2.1, { object: board, sample, duration: 0.32, stop: false, fov: false });
  imp.update(2.1 + 0.32);
  assert.equal(board.scale.x, 1.4);
  assert.equal(board.scale.y, 0.9);
  assert.equal(board.scale.z, 1);
  assert.equal(board.userData._impactBase, null, 'rest is the captured base, not a squashed one');
});

test('reduced motion leaves board scale, FOV, and the shake alone', () => {
  const quiet = createImpact({ reduced: true });
  const board = mesh();
  const sample = t => { const s = chalkPopScale(t / 0.32); return { x: s, y: s, z: s }; };
  assert.equal(quiet.strike(1, { object: board, sample, duration: 0.32, stop: true, fov: true }), false);
  quiet.update(1.05);
  assert.deepEqual({ x: board.scale.x, y: board.scale.y, z: board.scale.z }, { x: 1, y: 1, z: 1 });
  assert.equal(quiet.fovDelta(1.02), 0);
  assert.match(camSrc, /shake\(mag = 0\.35\) \{\s*\n?\s*if \(typeof matchMedia !== 'undefined' && matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return/, 'shake checks the preference at call time');
  assert.match(mainSrc, /_chalkNudge = \(\) => \{ if \(!reducedMotion\) rig\.shake\(0\.85\); \}/, 'the chalk nudge is guarded too');
});

test('press uses the existing dust and screech on both levers', () => {
  assert.match(worldSrc, /W\._chalkNudge\?\.\(\)/);
  for (const kind of ['batch', 'reprice']) {
    const i = mainSrc.indexOf(`world.flashChalk('${kind}')`);
    assert.ok(i > -1, kind);
    const slice = mainSrc.slice(i, i + 260);
    assert.match(slice, /fx\.chalkDust\(-5\.5, 2\.75, -6\.48\)/);
    assert.match(slice, /audio\.chalkScreech\(\)/);
    assert.match(slice, /feel\(\{ object: world\._chalkPlane, always: true \}\)/);
  }
});

test('lamps and the 17:00 wave-verdict beat are untouched', () => {
  assert.match(mainSrc, /audio\.waveRain\(read\.waveBalked\)/);
  assert.match(mainSrc, /feel\(\{ object: win \? world\.tillDrawer : world\._chalkPlane, always: true \}\)/);
  assert.match(worldSrc, /for \(const lm of W\.lampMats\) lm\.emissiveIntensity = street \* 2\.4/);
});
