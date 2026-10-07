// PR-B4 — Sam's reactive cameo · headless file-shape test
// Verifies that when Sam undercuts he flips the chalkboard on camera.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = `${ROOT}/js/main.js`;
const WORLD = `${ROOT}/js/world.js`;
const main = readFileSync(MAIN, 'utf8');
const world = readFileSync(WORLD, 'utf8');

// world.js: state + cue + per-frame posture
test('sam-reactive-cameo: W.rivalReactUntil state declared in world.js', () => {
  assert.match(world, /W\.rivalReactUntil\s*=\s*0\s*;?/);
});

test('sam-reactive-cameo: cueRivalReact function defined', () => {
  assert.match(world, /W\.cueRivalReact\s*=\s*\(\s*\)\s*=>\s*\{\s*W\.rivalReactUntil\s*=\s*performance\.now\(\)\s*\+\s*1900/);
});

test('sam-reactive-cameo: updateRival animates silhouette forward + lean when reacting', () => {
  // Anchor on the function definition (assignment), not the comment that
  // appears earlier in the file.
  const start = world.indexOf('W.updateRival = ');
  assert.ok(start > -1, 'updateRival definition not found');
  const slice = world.slice(start, start + 2500);
  // PR-B4 reactive code path exists inside updateRival
  assert.match(slice, /if\s*\(\s*W\.rivalReactUntil\s*&&\s*now\s*<\s*W\.rivalReactUntil\s*\)/);
  // silhouette steps forward (position.z increases from -0.8 toward 0)
  assert.match(slice, /rvBarista\.position\.z\s*=\s*-0\.8\s*\+\s*0\.36/);
  // leans into the chalkboard
  assert.match(slice, /rvBarista\.rotation\.z\s*=\s*lean\s*\+\s*0\.18\s*\*\s*pulse/);
  // settles back to default pose outside the cue window
  assert.match(slice, /rvBarista\.position\.z\s*=\s*-0\.8\s*;/);
});

// main.js: hook the cameo to the reprice-react path
function repriceSlice() {
  const i = main.indexOf("playerMove === 'reprice'");
  assert.ok(i > -1, 'rivalReact reprice branch not found');
  return main.slice(i, i + 1500);
}

test('sam-reactive-cameo: reprice branch arms cueRivalReact', () => {
  const slice = repriceSlice();
  assert.match(slice, /world\.cueRivalReact\s*\(\s*\)/);
});

test('sam-reactive-cameo: reprice branch focuses camera on the rival spot', () => {
  const slice = repriceSlice();
  // rig.focus(world.focus.rival, ...) — a brief 13-unit push-in, 3.5s ease
  assert.match(slice, /world\.focus\.rival/);
  assert.match(slice, /rig\.focus\(\s*world\.focus\.rival\s*,\s*13\s*,\s*3\.5\s*\)/);
});

test('sam-reactive-cameo: reprice branch shows "BOARD FLIPPED" chapter card', () => {
  const slice = repriceSlice();
  assert.match(slice, /fx\.card\(\s*['"]BOARD FLIPPED['"]/);
  // subtitle contains the new price
  assert.match(slice, /\$\{COPY\.rivalBarista\}'s chalkboard now reads/);
});

test('sam-reactive-cameo: cueRivalReact + camera + card stay inside a try/catch (best-effort)', () => {
  // Reprice branch wraps the cameo in try/catch so headless or wire-bare runs don't crash.
  const slice = repriceSlice();
  // Find the start of the PR-B4 try block and the corresponding catch
  const tryStart = slice.indexOf('try {');
  assert.ok(tryStart > -1, 'PR-B4 try block not found');
  const tail = slice.slice(tryStart, tryStart + 800);
  assert.match(tail, /world\.cueRivalReact/);
  assert.match(tail, /rig\.focus/);
  assert.match(tail, /fx\.card/);
  // catch exists
  assert.match(tail, /catch\s*\{\s*\}/);
});

test('sam-reactive-cameo: prebatch branch does NOT cue cameo (reactive AI only on visible moves)', () => {
  // The prebatch branch should toast but not call cueRivalReact / rig.focus / BOARD FLIPPED card.
  const start = main.indexOf("playerMove === 'prebatch'");
  assert.ok(start > -1);
  const slice = main.slice(start, start + 1200);
  // explicitly NOT calling the cameo
  assert.doesNotMatch(slice, /cueRivalReact\s*\(\s*\)/);
  assert.doesNotMatch(slice, /BOARD FLIPPED/);
});
