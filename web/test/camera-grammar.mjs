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
const run = (rig, secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) rig.update(1 / 60, i * (1000 / 60)); };

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
