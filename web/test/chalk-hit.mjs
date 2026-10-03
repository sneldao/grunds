// Chalkboard press reads as a hit: a short uniform scale wobble, the
// existing camera shake, and the chalk dust / screech already on the lever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const worldSrc = readFileSync(resolve(root, 'web/js/world.js'), 'utf8');
const mainSrc = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const camSrc = readFileSync(resolve(root, 'web/js/camera.js'), 'utf8');

const fn = worldSrc.match(/export function chalkPopScale\(u\) \{([\s\S]*?)\n\}/);
if (!fn) throw new Error('chalkPopScale missing');
const chalkPopScale = new Function('u', fn[1]);

test('chalk pop is a hard uniform wobble that rests', () => {
  assert.ok(chalkPopScale(0) >= 1.5, 'strike is still the old 1.02 twitch');
  assert.equal(chalkPopScale(0), chalkPopScale(0.2), 'strike should hold long enough to read');
  assert.ok(chalkPopScale(0.7) < 1, 'wobble dips back through rest');
  assert.ok(chalkPopScale(0.7) > 0.9, 'dip is a wobble, not a collapse');
  assert.ok(Math.abs(chalkPopScale(1) - 1) < 1e-6, 'settles at 1');
  assert.ok(Math.abs(chalkPopScale(1.2) - 1) < 1e-6, 'stays home after the beat');
});

test('flashChalk drives that wobble and does not linger', () => {
  assert.equal((worldSrc.match(/setScalar\(1\.02\)/g) || []).length, 0);
  assert.match(worldSrc, /CHALK_HIT_MS = 320/);
  assert.match(worldSrc, /chalkPopScale\(u\)/);
  assert.match(worldSrc, /W\._chalkPlane\.scale\.setScalar\(1\)/);
  const hit = worldSrc.slice(worldSrc.indexOf('W.flashChalk'), worldSrc.indexOf('W._chalkPlane = plane'));
  assert.doesNotMatch(hit, /fov|hitstop|squash/i);
});

test('press uses the existing shake, dust, and screech', () => {
  assert.match(mainSrc, /world\._chalkNudge = \(\) => rig\.shake\(0\.5\)/);
  assert.match(worldSrc, /W\._chalkNudge\?\.\(\)/);
  for (const kind of ['batch', 'reprice']) {
    const i = mainSrc.indexOf(`world.flashChalk('${kind}')`);
    assert.ok(i > -1, kind);
    const slice = mainSrc.slice(i, i + 220);
    assert.match(slice, /fx\.chalkDust\(-5\.5, 2\.75, -7\.95\)/);
    assert.match(slice, /audio\.chalkScreech\(\)/);
  }
});

test('idle camera, lamps, and the 17:00 beat are untouched', () => {
  assert.match(camSrc, /r: 32/);
  assert.doesNotMatch(camSrc, /fov/);
  assert.match(mainSrc, /audio\.waveRain\(read\.waveBalked\)/);
  assert.match(worldSrc, /for \(const lm of W\.lampMats\) lm\.emissiveIntensity = street \* 2\.4/);
});
