// web/test/blob-people.mjs — Tier-2 body upgrade: the instanced crowd grows
// rounded limbs, a trouser band (so the torso reads as a shirt), a taller
// head and a hair cap; the bar staff gets the same body plus portrait-seeded
// hair. All of it stays instanced (10 draw calls for the floor) and all of
// it stays cosmetic — the sim streams are untouched.
// Run: node --test web/test/blob-people.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PatronSystem, hairFor, baldAt } from '../js/patrons.js';
import { buildBarStaff, barStaffSpec } from '../js/barStaff.js';
import { StreetLife } from '../js/streetLife.js';

// deterministic stand-ins for the two cosmetic rolls spawn takes
function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function system() {
  const scene = new THREE.Group();
  const random = seededRand(101);
  const ps = new PatronSystem(scene, {}, null, null, null, { random, cosmetic: seededRand(202) });
  return { scene, ps };
}
const M = new THREE.Matrix4();
const scaleOf = (mesh, idx) => {
  mesh.getMatrixAt(idx, M);
  const v = new THREE.Vector3().setFromMatrixColumn(M, 0);
  return v.length();
};

test('the floor rig is rounded: capsule limbs, taller head, hips + hair bands', () => {
  const { ps } = system();
  assert.equal(ps.parts.legL.geometry.type, 'CapsuleGeometry');
  assert.equal(ps.parts.armL.geometry.type, 'CapsuleGeometry');
  assert.ok(ps.parts.hips instanceof THREE.InstancedMesh, 'a trouser band exists');
  assert.ok(ps.parts.hair instanceof THREE.InstancedMesh, 'a hair cap exists');
  // capsule limbs keep the old box heights (0.34 / 0.30) so the pose math
  // and the hip/shoulder pivots carry over untouched
  ps.parts.legL.geometry.computeBoundingBox();
  const bb = ps.parts.legL.geometry.boundingBox;
  assert.ok(Math.abs((bb.max.y - bb.min.y) - 0.34) < 1e-3, 'leg height preserved');
  // the head is taller than it is wide
  ps.parts.head.geometry.computeBoundingBox();
  const hb = ps.parts.head.geometry.boundingBox;
  assert.ok(hb.max.y - hb.min.y > hb.max.x - hb.min.x, 'head reads oval, not ball');
  assert.equal(Object.keys(ps.parts).length, 10, '8 body parts + hips + hair, still one mesh each');
});

test('hair palette is a pure function of idx — no streams, no surprises', () => {
  assert.equal(hairFor(3), hairFor(3));
  assert.equal(hairFor(3), hairFor(3 + 8), 'palette cycles by idx');
  assert.notEqual(hairFor(0), hairFor(1));
  let bald = 0;
  for (let i = 0; i < 90; i++) if (baldAt(i)) bald++;
  assert.equal(bald, 10, 'one head in nine stays bare');
  assert.equal(baldAt(4), true);
});

test('spawn + render puts a trouser band and a hair cap on the floor', () => {
  const { ps } = system();
  const p = ps.spawn('elders', 'counter');
  assert.ok(p, 'a patron spawned');
  ps._paint(p);
  // hips take the trouser colour, hair takes the palette colour
  const hipC = new THREE.Color(), hairC = new THREE.Color();
  ps.parts.hips.getColorAt(p.idx, hipC);
  ps.parts.hair.getColorAt(p.idx, hairC);
  // instanceColor is a Float32 buffer — compare per channel, not by ===
  const near = (a, b) => Math.abs(a - b) < 1 / 255 + 1e-6;
  assert.ok(near(hipC.r, p.legs.r) && near(hipC.g, p.legs.g) && near(hipC.b, p.legs.b),
    'the band matches the trousers');
  const expHair = new THREE.Color(hairFor(p.idx));
  assert.ok(near(hairC.r, expHair.r) && near(hairC.g, expHair.g) && near(hairC.b, expHair.b),
    'hair is the idx palette colour');
  p.vis = p.pos.clone();
  ps.render(1 / 60, 1000, false);
  assert.ok(scaleOf(ps.parts.hips, p.idx) > 0.1, 'hips rendered');
  assert.ok(scaleOf(ps.parts.torso, p.idx) > 0.1, 'torso rendered');
  if (baldAt(p.idx)) {
    assert.ok(scaleOf(ps.parts.hair, p.idx) < 0.01, 'a bare head renders nothing');
  } else {
    assert.ok(scaleOf(ps.parts.hair, p.idx) > 0.1, 'hair rendered');
  }
  // despawn zeroes every band, new ones included
  ps._despawn(p);
  assert.equal(scaleOf(ps.parts.hips, p.idx), 0);
  assert.equal(scaleOf(ps.parts.hair, p.idx), 0);
});

test('rendering the upgraded floor never draws the decision stream', () => {
  const { ps } = system();
  const patrons = [];
  for (let i = 0; i < 6; i++) {
    const p = ps.spawn(['elders', 'students', 'creatives'][i % 3], 'counter');
    if (p) { p.vis = p.pos.clone(); patrons.push(p); }
  }
  assert.ok(patrons.length >= 3);
  let draws = 0;
  const real = ps.random;
  ps.random = (...a) => { draws++; return real(...a); };
  for (let f = 0; f < 30; f++) ps.render(1 / 60, 1000 + f * 16, false);
  assert.equal(draws, 0, 'the frame loop is render-only');
});

test('the street crowd keeps its limbs rounded too', () => {
  const s = new StreetLife(new THREE.Group(), {});
  assert.equal(s.parts.legL.geometry.type, 'CapsuleGeometry');
  assert.equal(s.parts.armL.geometry.type, 'CapsuleGeometry');
});

test('bar staff: portrait-seeded hair, hidden under a hat or on a steel head', () => {
  const scene = new THREE.Group();
  const staff = buildBarStaff(scene);
  const parts = staff.parts;
  assert.ok(parts.hair instanceof THREE.Mesh, 'staff grew a hair cap');
  // Ruth's spec comes from her portrait seed — hair follows the face card
  const ruth = barStaffSpec('work');
  staff.setMode('work');
  if (ruth.hairStyle === 'beanie' || ruth.accessory === 'hat') {
    assert.equal(parts.hair.visible, false, 'a hat covers the hair');
  } else {
    assert.equal(parts.hair.visible, true, 'hair shows when nothing covers it');
    assert.equal('#' + parts.hair.material.color.getHexString(), String(ruth.hairColor).toLowerCase(),
      'hair colour is the portrait colour');
  }
  // the leased robot is steel — no hairStyle, no hair
  staff.setMode('robot');
  assert.equal(parts.hair.visible, false, 'the robot stays bald');
  assert.equal(parts.legL.geometry.type, 'CapsuleGeometry', 'staff limbs are rounded');
});
