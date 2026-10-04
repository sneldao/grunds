// One figure behind the bar. Same body as a patron (capsule, sphere, boxes)
// and the same pour clip. Ruth's colours come from her portrait seed;
// the apprentice is the other portrait seed. Home leaves the spot empty.
import * as THREE from '../vendor/three.module.js';
import { LAYOUT } from './config.js';
import { avatarSpec } from './portrait.js';
import { barPose } from './poses.js';

const LOOK = {
  work: { seed: 'ruth', cohort: 'commuters' },
  apprentice: { seed: 'apprentice', cohort: 'students' },
};

const LEG = 0x2a2c34;
const CUP = 0xf0ead8;
const HAT = 0x4a3423;
const POUR_SECS = 2.6;

// barStaffSpec(mode) → portrait spec, or null when nobody is on the bar.
export function barStaffSpec(mode) {
  const who = LOOK[mode];
  if (!who) return null;
  return { mode, seed: who.seed, cohort: who.cohort, ...avatarSpec(who.seed, who.cohort) };
}

// Feet behind the counter, facing the room. Not in the queue.
export function barStand() {
  const C = LAYOUT.counter;
  return { x: -7.4, z: C.z - C.d / 2 - 0.62, face: 0 };
}

export function buildBarStaff(scene) {
  const stand = barStand();
  const root = new THREE.Group();
  root.name = 'bar-staff';
  root.position.set(stand.x, 0, stand.z);
  root.rotation.y = stand.face;
  scene.add(root);

  const mat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const torsoMat = mat(HAT);
  const headMat = mat(0x5c3a21);
  const armMat = mat(HAT);
  const legMat = mat(LEG);
  const hatMat = mat(HAT, 0.7);
  const cupMat = mat(CUP, 0.5);

  const legGeo = new THREE.BoxGeometry(0.09, 0.34, 0.09); legGeo.translate(0, -0.17, 0);
  const armGeo = new THREE.BoxGeometry(0.07, 0.3, 0.07); armGeo.translate(0, -0.15, 0);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 10), torsoMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), headMat);
  const legL = new THREE.Mesh(legGeo, legMat);
  const legR = new THREE.Mesh(legGeo.clone(), legMat);
  const armL = new THREE.Mesh(armGeo, armMat);
  const armR = new THREE.Mesh(armGeo.clone(), armMat);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 12), hatMat);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.1, 8), cupMat);
  cup.castShadow = false;
  for (const m of [torso, head, legL, legR, armL, armR, hat]) m.castShadow = true;
  root.add(torso, head, legL, legR, armL, armR, hat);
  armR.add(cup);
  cup.position.set(0, -0.32, 0.04);

  const parts = { torso, head, legL, legR, armL, armR, hat, cup };
  let mode = 'home';
  let phase = 0;

  function paint(spec) {
    torsoMat.color.set(spec.clothing);
    armMat.color.set(spec.clothing);
    headMat.color.set(spec.skin);
    const hatted = spec.accessory === 'hat' || spec.hairStyle === 'beanie';
    hat.visible = hatted;
  }

  function apply(pose, s = 1) {
    const bob = pose.bob;
    const torsoY = 0.62 + bob;
    const headY = torsoY + 0.48 * s - (pose.headDip || 0);
    const hipY = 0.36 + bob * 0.5;
    const shY = torsoY + 0.22 * s;
    torso.position.set(0, torsoY, 0);
    torso.rotation.set(pose.lean, 0, 0);
    torso.scale.setScalar(s);
    head.position.set(0, headY, 0);
    head.rotation.set(0, pose.headRy || 0, 0);
    head.scale.setScalar(s);
    legL.position.set(-0.09 * s, hipY, 0);
    legL.rotation.set(pose.legSwing, 0, 0);
    legL.scale.setScalar(s);
    legR.position.set(0.09 * s, hipY, 0);
    legR.rotation.set(-pose.legSwing, 0, 0);
    legR.scale.setScalar(s);
    armL.position.set(-0.23 * s, shY, 0);
    armL.rotation.set(pose.armL, 0, 0);
    armL.scale.setScalar(s);
    armR.position.set(0.23 * s, shY, 0);
    armR.rotation.set(-pose.armR, 0, 0);
    armR.scale.setScalar(s);
    hat.position.set(0, headY + 0.13 * s, 0);
    hat.scale.setScalar(s);
  }

  function setMode(next) {
    const spec = barStaffSpec(next);
    const nextMode = spec ? spec.mode : 'home';
    if (nextMode === mode) return;
    mode = nextMode;
    root.visible = !!spec;
    if (!spec) return;
    paint(spec);
    phase = 0;
    apply(barPose(0));
  }

  function update(dt, reduced) {
    if (!root.visible) return;
    if (reduced) {
      phase = 0;
      apply(barPose(0));
      return;
    }
    const step = Number.isFinite(dt) ? dt : 0;
    phase = (phase + step / POUR_SECS) % 1;
    apply(barPose(phase));
  }

  setMode('work');
  return {
    root, parts, stand, setMode, update,
    get mode() { return mode; },
    get phase() { return phase; },
  };
}
