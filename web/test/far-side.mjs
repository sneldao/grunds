// Far-side massing: the day-5 scaffold comments finally have blocks behind
// them, and the Row's three units stand vacant from the first morning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FRANCHISE } from '../js/config.js';
import {
  BACKDROP_FACADES, SCAFFOLD_AT, blockAabb, aabbOverlap, vacantRowFronts, glasshouseAabb,
} from '../js/farSide.js';
import * as THREE from '../vendor/three.module.js';
import { buildWorld } from '../js/world.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('backdrop blocks match the scaffold comments and stay off Glasshouse', () => {
  const byId = Object.fromEntries(BACKDROP_FACADES.map(b => [b.id, b]));
  assert.equal(byId.right.w, 8);
  assert.equal(byId.right.h, 11);
  assert.equal(byId.right.d, 6);
  assert.equal(byId.left.w, 7);
  assert.equal(byId.left.h, 9);
  assert.equal(byId.left.d, 6);
  assert.equal(byId.backRight.w, 6);
  assert.equal(byId.backRight.h, 8);
  assert.equal(byId.backRight.d, 5);
  const boxes = BACKDROP_FACADES.map(blockAabb);
  assert.equal(boxes.find(b => b.id === 'right').z0, 16.5);
  assert.equal(boxes.find(b => b.id === 'left').z0, 16);
  assert.equal(boxes.find(b => b.id === 'backRight').z0, 18);
  for (const box of boxes) {
    const sc = SCAFFOLD_AT[box.id];
    assert.ok(sc.x > box.x0 && sc.x < box.x1, `${box.id} scaffold x`);
    assert.ok(sc.z <= box.z0 + 0.02, `${box.id} scaffold is on the café face`);
    assert.ok(sc.z > box.z0 - 0.8, `${box.id} scaffold is not buried in the street`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.equal(aabbOverlap(boxes[i], boxes[j]), false, `${boxes[i].id} overlaps ${boxes[j].id}`);
    }
    assert.equal(aabbOverlap(boxes[i], glasshouseAabb()), false, boxes[i].id);
  }
});

test('vacant Row fronts exist for every lot with no day gate', () => {
  const fronts = vacantRowFronts();
  assert.deepEqual(fronts.map(f => f.id), FRANCHISE.lots.map(l => l.id));
  assert.equal(fronts.length, 3);
  for (const front of fronts) {
    const lot = FRANCHISE.lots.find(l => l.id === front.id);
    assert.equal(front.x, lot.position[0]);
    assert.ok(front.z < lot.position[2]);
    const z0 = front.z - front.d / 2;
    const z1 = front.z + front.d / 2;
    assert.ok(z0 > 14.45, `${front.id} clips the pavement visitors`);
    assert.ok(z1 < 15.45, `${front.id} clips the scaffold`);
    assert.ok(front.h > 2 && front.h < 4);
  }
  const world = read('web/js/world.js');
  const main = read('web/js/main.js');
  assert.match(world, /BACKDROP_FACADES/);
  assert.match(world, /vacantRowFronts\(\)/);
  assert.match(world, /W\.setRowFront\s*=/);
  assert.match(world, /W\._shopSils/);
  assert.match(world, /windowFigure\(/);
  assert.match(main, /world\.setRowFront\(lot\.id, !rowClaimed\(lot\.id\)\)/);
});

test('buildWorld plants the blocks, the vacant fronts, and a figure in each window', () => {
  const prevDoc = globalThis.document;
  const prevGlb = globalThis.__noGLB;
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 48 });
      if (prop === 'canvas') return { width: 64, height: 64 };
      return () => {};
    },
    set() { return true; },
  });
  globalThis.document = {
    createElement: (tag) => tag === 'canvas'
      ? { width: 64, height: 64, getContext: () => ctx, style: {} }
      : { style: {} },
  };
  globalThis.__noGLB = true;
  try {
    const scene = new THREE.Scene();
    const renderer = { shadowMap: {}, toneMapping: 0, toneMappingExposure: 1, outputColorSpace: '' };
    const world = buildWorld(scene, renderer, true);
    const names = [];
    scene.traverse((o) => { if (o.name) names.push(o.name); });
    for (const id of ['right', 'left', 'backRight']) assert.ok(names.includes(`facade-${id}`), id);
    for (const lot of FRANCHISE.lots) assert.ok(names.includes(`row-front-${lot.id}`), lot.id);
    assert.equal(world._shopSils.length, 4);
    const front = scene.getObjectByName('row-front-18');
    assert.equal(front.visible, true);
    world.setRowFront('18', false);
    assert.equal(front.visible, false);
    world.setRowFront('18', true);
    assert.equal(front.visible, true);
    assert.equal(typeof world.openPremiseIds, 'function');
    assert.deepEqual(world.openPremiseIds(), []);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevGlb === undefined) delete globalThis.__noGLB;
    else globalThis.__noGLB = prevGlb;
  }
});
