// web/test/camera-grammar.mjs — Breaking-Bad camera register:
//   1. insert POVs place the camera inside the prop (authored pos + look)
//   2. beats may aim phi past the drag clamp (low-angle shots)
//   3. insert beats skip the r>=18 scripted clamp; normal beats keep it
//   4. matchcut frames pin via queueShot opts passthrough
import { test } from 'node:test';
import assert from 'node:assert';
import * as THREE from '../vendor/three.module.js';
import { CameraRig, SHOTS } from '../js/camera.js';

globalThis.addEventListener = () => {};
const dom = {
  addEventListener() {}, releasePointerCapture() {}, setPointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
};

function mkRig() {
  const cam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 300);
  cam.position.set(0, 14, 24);
  const rig = new CameraRig(cam, dom);
  rig.mode = 'play';
  rig._t = 0;
  performance.now = () => rig._t;
  return rig;
}
const world = {
  focus: {
    counter: new THREE.Vector3(-3, 1, -4),
    wide: new THREE.Vector3(0, 1.5, 6),
    rival: new THREE.Vector3(1.5, 1.6, 15.6),
    newbuild: new THREE.Vector3(10, 1, 15),
  },
};
const run = (rig, secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { rig._t += 1000 / 60; rig.update(1 / 60, rig._t); } };

test('insert view drives the camera inside the prop', () => {
  const rig = mkRig();
  rig.shot('espressoIns', world);
  assert.ok(rig.beat?.view, 'insert shot should carry a view');
  run(rig, 2.5);
  const want = new THREE.Vector3(...SHOTS.espressoIns.view.pos);
  const d = rig.cam.position.distanceTo(want);
  assert.ok(d < 0.4, `camera should sit inside the prop (dist ${d.toFixed(2)})`);
});

test('insert beats skip the 18-radius scripted clamp', () => {
  const rig = mkRig();
  rig.shot('espressoIns', world);
  assert.equal(rig.beat.r, 12, 'view beats keep the authored r, no clamp');
  rig.shot('verdict', world);
  assert.equal(rig.beat.r, 18, 'normal shots still clamp at 18');
});

test('low-angle beats aim phi past the drag clamp', () => {
  const rig = mkRig();
  rig.shot('lowStreet', world);
  assert.equal(rig.beat.phi, 1.5);
  run(rig, 3.5);
  assert.ok(rig.phi > 1.35, `phi should ease toward the shot (got ${rig.phi.toFixed(2)})`);
});

test('queueShot passes view/phi through when the beat promotes', () => {
  const rig = mkRig();
  rig.lastUser = -1e9; // force idle so the queue promotes
  rig.queueShot('matchcut', world, 60);
  assert.ok(rig.queued?.opts?.phi === 1.06, 'queued opts carry the shot params');
  run(rig, 1);
  assert.ok(rig.beat && rig.beat.phi === 1.06, 'promoted beat keeps phi');
});

test('matchcut pins a literal point, not a world anchor', () => {
  const rig = mkRig();
  rig.shot('matchcut', world);
  assert.ok(rig.beat.point.distanceTo(new THREE.Vector3(-5, 1.4, 4)) < 0.01);
});

test('insert expiry blends back to orbit instead of teleporting', () => {
  const rig = mkRig();
  rig.shot('espressoIns', world);
  run(rig, 3.1);
  let prev = rig.cam.position.clone();
  for (let i = 0; i < 72; i++) {
    rig._t += 1000 / 60;
    rig.update(1 / 60, rig._t);
    const d = rig.cam.position.distanceTo(prev);
    assert.ok(d < 1, `frame ${i}: jump of ${d.toFixed(2)} world units`);
    prev = rig.cam.position.clone();
  }
  assert.equal(rig.beat, null, 'insert beat should have expired');
  assert.equal(rig._viewMix, 0, 'exit blend finished');
});

test('queued insert waits for the live beat then promotes', () => {
  const rig = mkRig();
  rig.lastUser = -1e9;
  rig.shot('espressoIns', world);
  rig.queueShot('caseIns', world, 60);
  assert.ok(rig.queued, 'case insert should be queued behind the live beat');
  run(rig, 3.4);
  assert.equal(rig.queued, null);
  assert.ok(rig.beat?.view, 'queued insert should promote after the beat expires');
  const want = new THREE.Vector3(...SHOTS.caseIns.view.pos);
  run(rig, 2);
  assert.ok(rig.cam.position.distanceTo(want) < 0.5);
});

test('a queued shot expires while the user is driving and drops on idle', () => {
  const rig = mkRig();
  rig.queueShot('verdict', world, 1);
  rig.lastUser = rig._t;
  run(rig, 0.5);
  assert.ok(rig.queued, 'still queued while the user drives');
  run(rig, 1);
  rig.lastUser = -1e9;
  run(rig, 0.2);
  assert.equal(rig.queued, null, 'stale queue entry dropped, not promoted');
  assert.equal(rig.beat, null);
});

test('lowStreet phi eases home after the beat expires', () => {
  const rig = mkRig();
  rig.shot('lowStreet', world);
  run(rig, 4.2);
  assert.ok(rig.phi > 1.3);
  rig.lastUser = -1e9;
  run(rig, 16);
  assert.ok(rig.phi < 0.85, `phi should be easing home (got ${rig.phi.toFixed(2)})`);
});

test('matchcut hold pins the frame past its written length', () => {
  const rig = mkRig();
  rig.lastUser = -1e9;
  rig.shot('matchcut', world);
  run(rig, 5);
  assert.ok(rig.beat?.hold, 'matchcut should hold past its secs');
  assert.ok(rig.r >= 18, 'non-view shots keep the scripted clamp');
  const pos = rig.cam.position.clone();
  const quat = rig.cam.quaternion.clone();
  run(rig, 20);
  assert.ok(rig.cam.position.distanceTo(pos) < 1e-9, 'held frame drifted');
  assert.ok(Math.abs(rig.cam.quaternion.dot(quat) - 1) < 1e-9, 'held frame rotated');
  assert.ok(rig.beat?.hold, 'hold survives until something replaces it');
});

test('crane departs the held frame and arrives home', () => {
  const rig = mkRig();
  rig.lastUser = -1e9;
  rig.shot('matchcut', world);
  run(rig, 5);
  const t0 = { target: rig.target.clone(), theta: rig.theta, phi: rig.phi, r: rig.r };
  rig.crane();
  assert.equal(rig.beat, null);
  assert.equal(rig.queued, null);
  assert.equal(rig.mode, 'crane');
  assert.ok(rig._from.target.distanceTo(t0.target) < 1e-9);
  assert.equal(rig._from.theta, t0.theta);
  assert.equal(rig._from.phi, t0.phi);
  assert.equal(rig._from.r, t0.r);
  run(rig, 3.1);
  assert.equal(rig.mode, 'play');
  assert.ok(rig.target.distanceTo(rig.home.target) < 0.05);
  assert.ok(Math.abs(rig.r - rig.home.r) < 0.05);
  assert.ok(Math.abs(rig.phi - rig.home.phi) < 0.05);
  assert.ok(Math.abs(rig.theta - rig.home.theta) < 0.05);
});

test('crane during an insert starts from the real camera position', () => {
  const rig = mkRig();
  rig.shot('espressoIns', world);
  run(rig, 2);
  const before = rig.cam.position.clone();
  rig.crane();
  rig.update(0, rig._t);
  assert.ok(rig.cam.position.distanceTo(before) < 0.1, 'crane should take off from the insert frame');
  run(rig, 3.1);
  assert.equal(rig.mode, 'play');
  const want = new THREE.Vector3(...SHOTS.espressoIns.view.pos);
  assert.ok(rig.cam.position.distanceTo(want) > 1, 'crane must not resurrect the insert');
});

test('resetView clears a held beat, the queue and the exit blend', () => {
  const rig = mkRig();
  rig.shot('espressoIns', world);
  run(rig, 1);
  rig.queued = { point: new THREE.Vector3(), r: 18, secs: 4, until: 1e9, theta: null, opts: {} };
  assert.ok(rig._viewMix > 0);
  rig.resetView();
  assert.equal(rig.beat, null);
  assert.equal(rig.queued, null);
  assert.equal(rig._viewMix, 0);
  assert.equal(rig.r, rig.home.r);
});
