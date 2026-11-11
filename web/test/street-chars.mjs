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
import { readFileSync } from 'node:fs';
import { StreetLife, assignDonorWalk, assignIdles, assignStand, armsAtSides, standClip, pickIdleAgents, IDLE_CAP } from '../js/streetLife.js';

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
  assert.equal(a.char.userData.charSettled, true, 'a settled figure stops paying for skinning');
  // walking again wakes the mixer back up
  for (let i = 0; i < 60; i++) s._driveChar(a, true, 1 / 60, false);
  assert.ok(action.timeScale > 0.5, 'the stride eases back in');
  assert.equal(a.char.userData.charSettled, false);
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

function fakeIdle(duration = 1) {
  // Held off the rest pose the whole way, so the assertion does not
  // depend on which phase idx lands on.
  const track = new THREE.QuaternionKeyframeTrack('LeftArm.quaternion',
    [0, duration],
    [0, 0, 0.38, 0.925, 0, 0, 0.38, 0.925]);
  return new THREE.AnimationClip('IdleChat', duration, [track]);
}
function rigWithArm() {
  const root = fakeRig();
  const arm = new THREE.Object3D();
  arm.name = 'LeftArm';
  root.getObjectByName('Spine').add(arm);
  return root;
}

test('assignIdles shares the clips and leaves the busker posed', () => {
  const clips = [fakeIdle(), fakeIdle()];
  const tpl = {
    commuters: [{ scene: fakeRig(), walk: fakeWalk() }],
    busker: [{ scene: fakeRig(), walk: null }],
  };
  assignIdles(tpl, clips);
  assert.equal(tpl.commuters[0].idles, clips);
  assert.equal(tpl.busker[0].idles, undefined);
  assignIdles(tpl, []);
  assert.equal(tpl.commuters[0].idles, clips, 'an empty pack changes nothing');
});

test('a dwelling figure eases into its idle; walking and reduced motion do not', () => {
  const idle = fakeIdle(1);
  const s = life({ commuters: [{ scene: rigWithArm(), walk: fakeWalk(1), idles: [idle, idle, idle] }] });
  const a = agent(1);
  a.char = s._charFor(a);
  const arm = a.char.getObjectByName('LeftArm');
  assert.equal(a.char.userData.charIdle.getClip().name, 'IdleChat');
  assert.equal(a.char.userData.charIdle.weight, 0);
  // idx 1 of 3 clips is the second idle — deterministic, not a draw
  assert.equal(a.char.userData.charIdle.getClip(), idle);
  for (let i = 0; i < 90; i++) s._driveChar(a, false, 1 / 60, false, true);
  assert.ok(a.char.userData.charIdle.weight > 0.95, 'the idle takes the pose');
  assert.ok(a.char.userData.charAction.weight < 0.05, 'the frozen stride steps aside');
  assert.ok(arm.quaternion.z > 0.05, 'the idle actually moves the arm');
  assert.equal(a.char.userData.charSettled, false, 'an idle keeps the mixer awake');
  for (let i = 0; i < 30; i++) s._driveChar(a, true, 1 / 60, false, false);
  assert.ok(a.char.userData.charIdle.weight < 0.5, 'walking fades the idle back out');
  // reduced motion never raises it
  const b = agent(2);
  b.char = s._charFor(b);
  for (let i = 0; i < 60; i++) s._driveChar(b, false, 1 / 60, true, true);
  assert.ok(b.char.userData.charIdle.weight < 0.05, 'reduced motion stays on the rest pose');
});

test('a dwell eases onto the stand pose, arms at the sides', () => {
  const root = rigWithArm();
  armsAtSides(root);
  assert.ok(root.getObjectByName('LeftArm').quaternion.z < -0.5);
  const full = standClip();
  assert.ok(full.tracks.some(t => t.name === 'LeftArm.quaternion'));
  assert.ok(full.tracks.some(t => t.name === 'RightArm.quaternion'));
  const arm = full.tracks.find(t => t.name === 'LeftArm.quaternion');
  const tpl = {
    commuters: [{ scene: rigWithArm(), walk: fakeWalk(1), stand: new THREE.AnimationClip('Stand', 1, [arm]) }],
    busker: [{ scene: rigWithArm(), walk: null }],
  };
  assignStand(tpl, standClip());
  assert.ok(tpl.commuters[0].stand);
  assert.equal(tpl.busker[0].stand, undefined);
  const s = life(tpl);
  const a = agent(0);
  a.char = s._charFor(a);
  for (let i = 0; i < 90; i++) s._driveChar(a, false, 1 / 60, false, false);
  assert.ok(a.char.userData.charStand.weight > 0.95, 'the stand takes the body');
  assert.ok(a.char.userData.charAction.weight < 0.05, 'the stride steps aside');
  assert.ok(a.char.getObjectByName('LeftArm').quaternion.z < -0.5, 'the arm hangs');
  assert.equal(a.char.userData.charSettled, true, 'a held stand stops the mixer');
  for (let i = 0; i < 40; i++) s._driveChar(a, true, 1 / 60, false, false);
  assert.ok(a.char.userData.charStand.weight < 0.5, 'walking leaves the stand');
});

test('pickIdleAgents prefers a vignette and stops at the cap', () => {
  function dweller(idx, kind, extra = {}) {
    return Object.assign({
      active: true, walking: false, state: 'dwell', sitting: false, hidden: false,
      idx, kind, char: { userData: { charIdle: {} } },
    }, extra);
  }
  const crowd = [];
  for (let i = 0; i < IDLE_CAP + 2; i++) crowd.push(dweller(i, 'queue'));
  crowd.push(dweller(40, 'vignette'));
  const picked = pickIdleAgents(crowd);
  assert.equal(picked.length, IDLE_CAP);
  assert.equal(picked[0].idx, 40, 'a vignette stander is ahead of the queue');
  assert.ok(!picked.some(a => a.idx === IDLE_CAP), 'the cap leaves someone out');
  assert.equal(pickIdleAgents([dweller(1, 'queue', { walking: true })]).length, 0);
  assert.equal(pickIdleAgents([dweller(1, 'queue', { sitting: true })]).length, 0);
});

test('the baked idles are closed loops on the Polyfork bone names', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/polyfork/idles.json', import.meta.url), 'utf8'));
  const clips = data.clips.map(c => THREE.AnimationClip.parse(c));
  assert.deepEqual(clips.map(c => c.name), ['IdleChat', 'IdleWatch', 'IdleLook']);
  for (const clip of clips) {
    assert.equal(clip.duration, 5);
    const arm = clip.tracks.find(t => t.name === 'LeftArm.quaternion');
    assert.ok(arm, clip.name + ' targets LeftArm');
    assert.equal(clip.tracks.some(t => t.name.startsWith('mixamorig')), false);
    const n = arm.values.length;
    for (let i = 0; i < 4; i++) assert.equal(arm.values[i], arm.values[n - 4 + i], clip.name + ' loop closes');
    const root = rigWithArm();
    const mixer = new THREE.AnimationMixer(root);
    const armClip = new THREE.AnimationClip(clip.name, clip.duration, [arm]);
    mixer.clipAction(armClip).play();
    mixer.setTime(2.5);
    const q = root.getObjectByName('LeftArm').quaternion;
    assert.ok(Math.hypot(q.x, q.y, q.z) > 0.02, clip.name + ' moves the arm off the rest pose');
  }
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
