// web/test/street-chars.mjs — the Polyfork humanoids walk. Five of the ten
// street figures ship a rigged Walk clip; the other five borrow it (one
// shared 22-bone rig — clips bind by bone name). The stride eases in/out,
// keeps a deterministic per-agent phase, pins root drift, and never touches
// the sim or its rng. Figures without a clip (the busker) keep their
// authored pose.
// Run: node --test web/test/street-chars.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { StreetLife, assignDonorWalk } from '../js/streetLife.js';

// A minimal stand-in rig: just the bones the clip targets.
function fakeRig(name = 'figure') {
  const root = new THREE.Group(); root.name = name;
  const hips = new THREE.Object3D(); hips.name = 'Hips';
  hips.position.set(0, 1, 0);
  const spine = new THREE.Object3D(); spine.name = 'Spine';
  hips.add(spine);
  root.add(hips);
  return root;
}
// Walk clip with deliberate root drift (x/z move) + a vertical bob, so the
// hips pin and the stride are both observable.
function fakeWalk(duration = 1) {
  const track = new THREE.VectorKeyframeTrack('Hips.position',
    [0, duration / 2, duration],
    [0, 1, 0, 0.3, 1.06, 0.2, 0, 1, 0]);
  return new THREE.AnimationClip('Walk', duration, [track]);
}
function life(templates) {
  const s = new StreetLife(new THREE.Group(), {});
  s._charTemplates = templates;
  return s;
}
function agent(idx = 0, extra = {}) {
  return Object.assign({
    kind: 'row', cohort: 'commuters', idx,
    pos: { x: 1, z: 2 }, face: 0.5, phase: 0, gait: { freq: 5, amp: 0.4, lean: 0 },
  }, extra);
}

test('assignDonorWalk lends the stride to static figures, never the busker', () => {
  const walk = fakeWalk();
  const tpl = {
    commuters: [{ scene: fakeRig(), walk: null }, { scene: fakeRig(), walk }],
    elders: [{ scene: fakeRig(), walk: null }],
    busker: [{ scene: fakeRig(), walk: null }],
  };
  assignDonorWalk(tpl, walk);
  assert.equal(tpl.commuters[0].walk, walk, 'a static commuter borrows the donor');
  assert.equal(tpl.commuters[1].walk, walk, 'a figure keeps its own clip');
  assert.equal(tpl.elders[0].walk, walk);
  assert.equal(tpl.busker[0].walk, null, 'the busker keeps his authored pose');
  // no donor → nothing changes
  const tpl2 = { commuters: [{ scene: fakeRig(), walk: null }] };
  assignDonorWalk(tpl2, null);
  assert.equal(tpl2.commuters[0].walk, null);
});

test('_charFor attaches a mixer with a deterministic per-agent offset', () => {
  const walk = fakeWalk(1);
  const s = life({ commuters: [{ scene: fakeRig(), walk }] });
  const c0 = s._charFor(agent(0));
  const c3 = s._charFor(agent(3));
  assert.ok(c0.userData.charMixer instanceof THREE.AnimationMixer);
  const a0 = c0.userData.charAction, a3 = c3.userData.charAction;
  assert.equal(a0.time, 0);
  assert.equal(a3.time, (3 * 0.37) % 1, 'offset is a hash of idx, not rng');
  assert.equal(a0.timeScale, 0, 'born standing — the stride eases in');
  assert.ok(c0.userData.hipsPin, 'the hips are pinned against root drift');
  assert.equal(c0.scale.x, 0.62);
  // a figure without a clip gets no mixer (authored pose intact)
  const s2 = life({ busker: [{ scene: fakeRig(), walk: null }] });
  const b = s2._charFor(agent(1, { vg: 'busker', kind: 'vignette' }));
  assert.equal(b.userData.charMixer, undefined);
});

test('walking eases the stride in; the bob plays; the hips stay pinned', () => {
  const s = life({ commuters: [{ scene: fakeRig(), walk: fakeWalk(1) }] });
  const a = agent(1);
  a.char = s._charFor(a);
  s.scene.add(a.char);
  const action = a.char.userData.charAction;
  // a second of walking frames
  for (let i = 0; i < 60; i++) s._driveChar(a, true, 1 / 60, false);
  assert.ok(action.timeScale > 0.9, `timeScale eased toward full stride, got ${action.timeScale}`);
  const t = action.time % 1;
  assert.ok(t > 0, 'the clip advanced');
  const hips = a.char.userData.hipsPin.hips;
  assert.equal(hips.position.x, 0, 'root drift pinned on x');
  assert.equal(hips.position.z, 0, 'root drift pinned on z');
});

test('dwelling eases the stride back to a stand', () => {
  const s = life({ commuters: [{ scene: fakeRig(), walk: fakeWalk(1) }] });
  const a = agent(2);
  a.char = s._charFor(a);
  const action = a.char.userData.charAction;
  for (let i = 0; i < 60; i++) s._driveChar(a, true, 1 / 60, false);
  assert.ok(action.timeScale > 0.9);
  const tWalking = action.time % 1;
  for (let i = 0; i < 120; i++) s._driveChar(a, false, 1 / 60, false);
  assert.ok(action.timeScale < 0.05, `timeScale eased to a stand, got ${action.timeScale}`);
  // clock still runs but the stride is frozen in place
  const after = action.time % 1;
  for (let i = 0; i < 30; i++) s._driveChar(a, false, 1 / 60, false);
  assert.ok(Math.abs((action.time % 1) - after) < 0.02, 'no march in place while dwelling');
  assert.ok(tWalking !== undefined);
});

test('reduced motion keeps the figure still', () => {
  const s = life({ commuters: [{ scene: fakeRig(), walk: fakeWalk(1) }] });
  const a = agent(4);
  a.char = s._charFor(a);
  const action = a.char.userData.charAction;
  for (let i = 0; i < 60; i++) s._driveChar(a, true, 1 / 60, true);
  assert.ok(action.timeScale < 0.05, 'reduced motion never starts the stride');
});

test('a clip-less figure keeps the sine bob while walking', () => {
  const s = life({ busker: [{ scene: fakeRig(), walk: null }] });
  const a = agent(1, { vg: 'busker', kind: 'vignette' });
  a.char = s._charFor(a);
  a.phase = Math.PI / 2;   // sin peak
  s._driveChar(a, true, 1 / 60, false);
  assert.ok(Math.abs(a.char.position.y - 0.02) < 1e-9, 'the old bob carries figures without clips');
});

test('despawn stops and uncaches the mixer', () => {
  const s = life({ commuters: [{ scene: fakeRig(), walk: fakeWalk(1) }] });
  const a = agent(0);
  a.active = true;
  a.char = s._charFor(a);
  a.pos = { x: 0, z: 0 };
  s.agents.push(a);
  const mixer = a.char.userData.charMixer;
  const char = a.char;
  s._despawn(a);
  assert.equal(a.char, null);
  assert.ok(!s.scene.children.includes(char), 'the clone left the scene');
  assert.equal(mixer._nActiveActions, 0, 'no action left running after despawn');
});

test('driving a char never draws the street rng', () => {
  const s = life({ commuters: [{ scene: fakeRig(), walk: fakeWalk(1) }] });
  const a = agent(7);
  a.char = s._charFor(a);
  let draws = 0;
  const real = s.rng;
  s.rng = (...args) => { draws++; return real(...args); };
  for (let i = 0; i < 120; i++) s._driveChar(a, i % 2 === 0, 1 / 60, false);
  assert.equal(draws, 0, 'stride is cosmetic — the stream is untouched');
});
