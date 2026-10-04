// Hitstop, volume-preserving object squash, and the FOV punch.
// Pure clock plus source wiring. No DOM, no GL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  HITSTOP_SEC, SQUASH_SEC, FOV_SEC, squashAxes, fovKick, axesFor, createImpact,
} from '../js/impact.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const main = read('web/js/main.js');
const patrons = read('web/js/patrons.js');
const camera = read('web/js/camera.js');
const world = read('web/js/world.js');
const poses = read('web/js/poses.js');

function mesh(x = 1, y = 1, z = 1) {
  return {
    userData: {},
    scale: { x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}

test('squash preserves volume, peaks on the hit, then returns to identity', () => {
  const rest = squashAxes(-0.01);
  assert.deepEqual(rest, { x: 1, y: 1, z: 1 });
  assert.equal(squashAxes(SQUASH_SEC), rest);
  const hit = squashAxes(0);
  const later = squashAxes(SQUASH_SEC * 0.5);
  assert.ok(hit.y < later.y && later.y < 1, 'full squash on impact, then recover');
  assert.ok(hit.x > 1 && hit.z > 1, 'the other axes widen');
  assert.ok(Math.abs(hit.x * hit.y * hit.z - 1) < 1e-9, 'x * y * z stays 1');
});

test('FOV kick is immediate and home when hitstop ends', () => {
  assert.equal(fovKick(-0.01), 0);
  assert.equal(fovKick(FOV_SEC), 0);
  assert.equal(FOV_SEC, HITSTOP_SEC);
  const peak = fovKick(0);
  assert.ok(peak < -1, 'the punch narrows fov on the hit frame');
  assert.ok(fovKick(FOV_SEC / 2) < 0 && fovKick(FOV_SEC / 2) > peak);
});

test('a hit holds gameplay for a few frames, then the clock and the view return', () => {
  const imp = createImpact();
  const board = mesh();
  const patron = {};
  assert.equal(imp.dtScale(10), 1);
  assert.equal(imp.strike(10, { patron, part: 'cup', object: board, stop: true, fov: true }), true);
  assert.equal(imp.dtScale(10), 0);
  assert.equal(imp.dtScale(10 + HITSTOP_SEC - 0.016), 0);
  assert.equal(imp.dtScale(10 + HITSTOP_SEC), 1, 'the hold is over after ~70ms');
  assert.ok(imp.fovDelta(10 + HITSTOP_SEC / 2) < 0);
  assert.equal(imp.fovDelta(10 + HITSTOP_SEC), 0);
  imp.update(10 + SQUASH_SEC * 0.28);
  assert.ok(board.scale.y < board.userData._impactBase.y);
  const base = board.userData._impactBase;
  const vol = (board.scale.x / base.x) * (board.scale.y / base.y) * (board.scale.z / base.z);
  assert.ok(Math.abs(vol - 1) < 1e-9);
  const cup = axesFor(patron, 'cup', 10 + SQUASH_SEC * 0.28);
  assert.ok(cup.y < 1);
  assert.deepEqual(axesFor(patron, 'torso', 10 + 0.05), { x: 1, y: 1, z: 1 });
  imp.update(10 + SQUASH_SEC);
  assert.equal(board.scale.x, 1);
  assert.equal(board.scale.y, 1);
  assert.equal(board.scale.z, 1);
  assert.equal(board.userData._impactBase, null);
  assert.deepEqual(axesFor(patron, 'cup', 10 + SQUASH_SEC), { x: 1, y: 1, z: 1 });
  assert.equal(patron._impact, null);
  let held = 0;
  for (let ms = 0; ms < 80; ms += 16) if (imp.dtScale(10 + ms / 1000) === 0) held++;
  assert.ok(held >= 3 && held <= 5, `hitstop held ${held} frames`);
});

test('reduced motion and a frozen headless clock do not hitch', () => {
  const quiet = createImpact({ reduced: true });
  const patron = {};
  assert.equal(quiet.strike(1, { patron, part: 'cup', object: mesh(), stop: true, fov: true }), false);
  assert.equal(quiet.dtScale(1), 1);
  assert.equal(quiet.fovDelta(1.02), 0);
  assert.equal(patron._impact, undefined);

  const headless = createImpact({ holdClock: false });
  const board = mesh(2, 1, 0.5);
  assert.equal(headless.strike(3, { object: board, stop: true, fov: true }), true);
  assert.equal(headless.dtScale(3.01), 1, 'headless days keep the sim clock');
  assert.ok(headless.fovDelta(3.02) < 0);
  headless.update(3 + SQUASH_SEC * 0.28);
  assert.ok(board.scale.y < 1);
  headless.update(3 + SQUASH_SEC);
  assert.equal(board.scale.x, 2);
  assert.equal(board.scale.y, 1);
  assert.equal(board.scale.z, 0.5);
});

test('a serve and a balk squash different objects; fast-forward does not extend the hold', () => {
  const imp = createImpact();
  const served = {};
  const walked = {};
  imp.strike(5, { patron: served, part: 'cup', stop: false, fov: false });
  imp.strike(5, { patron: walked, part: 'torso', stop: true, fov: true });
  assert.equal(imp.dtScale(5.01), 0);
  assert.ok(axesFor(served, 'cup', 5.05).y < 1);
  assert.deepEqual(axesFor(served, 'torso', 5.05), { x: 1, y: 1, z: 1 });
  assert.ok(axesFor(walked, 'torso', 5.05).y < 1);
  assert.deepEqual(axesFor(walked, 'cup', 5.05), { x: 1, y: 1, z: 1 });
});

const feelSrc = main.slice(main.indexOf('function feel'), main.indexOf('\nfunction ', main.indexOf('function feel') + 1));
function makeFeel({ speed, eveningFast = false, rushFast = false, strikes = [] }) {
  const factory = new Function(
    'impact', 'world', 'chalkPopScale', 'headless', 'frameNow', 'performance', 'speed', 'eveningFast', 'rushFast',
    feelSrc + '; return feel;'
  );
  const impact = { strike: (t, o) => { strikes.push(o); return true; } };
  const worldObj = { _chalkPlane: { name: 'chalk' } };
  return factory(impact, worldObj, () => 1, false, 0, performance, speed, eveningFast, rushFast);
}

test('routine serves and balks never hold the clock or punch FOV at any speed', () => {
  for (const speed of [60, 300, 1200]) for (const fast of [false, true]) {
    const strikes = [];
    const feel = makeFeel({ speed, eveningFast: fast, rushFast: fast, strikes });
    const cup = { name: 'cup-patron' };
    feel({ patron: cup, part: 'cup' });
    const walked = { name: 'torso-patron' };
    feel({ patron: walked, part: 'torso' });
    assert.equal(strikes.length, 2, `speed ${speed} fast ${fast}: two strikes`);
    for (const [i, s] of strikes.entries()) {
      assert.equal(s.stop, false, `speed ${speed} fast ${fast} strike ${i}: no hitstop`);
      assert.equal(s.fov, false, `speed ${speed} fast ${fast} strike ${i}: no fov punch`);
    }
    assert.equal(strikes[0].patron, cup);
    assert.equal(strikes[0].part, 'cup');
    assert.equal(strikes[1].patron, walked);
    assert.equal(strikes[1].part, 'torso');
  }
  const beats = [];
  const feel = makeFeel({ speed: 300, strikes: beats });
  feel({ object: { name: 'till' }, always: true });
  assert.equal(beats[0].stop, true, 'explicit beat keeps the hold');
  assert.equal(beats[0].fov, true, 'explicit beat keeps the punch');
});

test('the floor wires the three beats without touching pose squash', () => {
  assert.match(poses, /squash: 0\.08 \* e/);
  assert.match(main, /createImpact\(\{ reduced: reducedMotion, holdClock: !headless \}\)/);
  assert.match(main, /feel\(\{ patron: e\.p, part: 'cup' \}\)/);
  assert.match(main, /feel\(\{ patron: e\.p, part: 'torso' \}\)/);
  assert.match(main, /feel\(\{ object: world\._chalkPlane, always: true \}\)/);
  assert.match(main, /feel\(\{ object: win \? world\.tillDrawer : world\._chalkPlane, always: true \}\)/);
  assert.match(main, /const clock = !!opts\.always\s*;/);
  assert.match(main, /acc \+= dt \* 1000 \* impact\.dtScale\(nowSec\)/);
  assert.match(main, /rig\.update\(dt, now\)/);
  assert.match(main, /rig\.setFovOffset\(impact\.fovDelta\(nowSec\)\)/);
  assert.match(main, /impact\.update\(nowSec\)/);
  assert.match(patrons, /axesFor\(p, 'torso', nowSec\)/);
  assert.match(patrons, /axesFor\(p, 'cup', nowSec\)/);
  assert.match(camera, /setFovOffset\(delta\)/);
  assert.match(camera, /this\.cam\.fov = this\._baseFov \+ d/);
  const flash = world.slice(world.indexOf('W.flashChalk'), world.indexOf('W._chalkPlane'));
  assert.ok(!flash.includes('setScalar'), 'the chalk pulse is the impact squash, not a uniform pop');
});
