import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const worldSrc = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
const mainSrc = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8');

const THREE = await import('../vendor/three.module.js');
const { PREMISES, PEEK_FIRST, PEEK_PERIOD, PEEK_SHOW, ambientPremiseIndex, createCutawayRig } = await import('../js/premises.js');

test('ambient peeks are one shop, a few seconds, then a long quiet', () => {
  const n = PREMISES.length;
  assert.equal(ambientPremiseIndex(0, n), -1);
  assert.equal(ambientPremiseIndex(PEEK_FIRST - 0.01, n), -1);
  assert.equal(ambientPremiseIndex(PEEK_FIRST, n), 0);
  assert.equal(ambientPremiseIndex(PEEK_FIRST + PEEK_SHOW - 0.01, n), 0);
  assert.equal(ambientPremiseIndex(PEEK_FIRST + PEEK_SHOW, n), -1);
  assert.equal(ambientPremiseIndex(PEEK_FIRST + PEEK_PERIOD, n), 1);
  assert.equal(ambientPremiseIndex(PEEK_FIRST + PEEK_PERIOD * 2 + 1, n), 2);
  assert.equal(ambientPremiseIndex(PEEK_FIRST + PEEK_PERIOD * 4 + 1, n), 0);
  assert.ok(PEEK_PERIOD - PEEK_SHOW > 60, 'quiet gap should stay long');
});

function groups() {
  return {
    shell: new THREE.Group(),
    face: new THREE.Group(),
    roof: new THREE.Group(),
    interior: new THREE.Group(),
  };
}

test('roofs stay shut until the player opens them, and a click peeks one shop', () => {
  const rig = createCutawayRig({ lite: false });
  const built = PREMISES.map((meta) => {
    const g = groups();
    rig.add({ ...meta, ...g });
    return g;
  });
  for (const g of built) {
    assert.equal(g.interior.visible, false);
    assert.equal(g.face.visible, true);
    assert.equal(g.roof.visible, true);
  }
  rig.update(1, 5000, { ambient: false });
  assert.ok(built.every((g) => g.interior.visible === false), 'default update should not open a roof');

  rig.setRoofs(true);
  rig.update(1, 6000, { ambient: false });
  assert.ok(built.every((g) => g.interior.visible && !g.roof.visible && !g.face.visible));

  rig.setRoofs(false, true);
  rig.update(1, 7000, { ambient: true });
  assert.ok(built.every((g) => !g.interior.visible && g.roof.visible && g.face.visible));
  assert.equal(rig.roofsShut, true);

  rig.peek('hearth', 8000);
  rig.update(1, performance.now(), { ambient: false });
  assert.equal(built[1].interior.visible, true);
  assert.equal(built[0].interior.visible, false);
  assert.equal(built[2].interior.visible, false);
  assert.equal(built[3].interior.visible, false);
});

test('a rare ambient peek opens one named shop and then closes it', () => {
  const rig = createCutawayRig({ lite: false });
  const built = PREMISES.map((meta) => {
    const g = groups();
    rig.add({ ...meta, ...g });
    return g;
  });
  rig.update(0.016, 1000, { ambient: true });
  assert.ok(built.every((g) => !g.interior.visible));
  const begun = rig.update(1, 1000 + (PEEK_FIRST + 1) * 1000, { ambient: true });
  assert.equal(begun && begun.id, 'quill');
  assert.equal(built[0].interior.visible, true);
  assert.ok(built.slice(1).every((g) => !g.interior.visible));
  rig.update(1, 1000 + (PEEK_FIRST + PEEK_SHOW + 1) * 1000, { ambient: true });
  assert.ok(built.every((g) => !g.interior.visible), 'peek should close after its short window');
});

test('open roofs and a single peek report which rooms are visible', () => {
  const rig = createCutawayRig({ lite: false });
  const built = PREMISES.map((meta) => {
    const g = groups();
    rig.add({ ...meta, ...g });
    return g;
  });
  assert.deepEqual(rig.openIds(), []);
  rig.setRoofs(true);
  rig.update(1, 1000, { ambient: false });
  assert.deepEqual(rig.openIds(), PREMISES.map((p) => p.id));
  rig.setRoofs(false, true);
  rig.update(1, 2000, { ambient: false });
  assert.deepEqual(rig.openIds(), []);
  rig.peek('bell', 8000);
  rig.update(1, performance.now(), { ambient: false });
  assert.deepEqual(rig.openIds(), ['bell']);
  assert.equal(built[2].interior.visible, true);
});

test('lite mode does not run ambient peeks', () => {
  const rig = createCutawayRig({ lite: true });
  const g = groups();
  rig.add({ ...PREMISES[0], ...g });
  rig.update(0.016, 1000, { ambient: true });
  rig.update(1, 1000 + (PEEK_FIRST + 1) * 1000, { ambient: true });
  assert.equal(g.interior.visible, false);
});

test('pick hits the shop in front of the camera and skips a hidden interior', () => {
  const rig = createCutawayRig({ lite: false });
  const shell = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  shell.add(mesh);
  const interior = new THREE.Group();
  interior.visible = false;
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), new THREE.MeshBasicMaterial());
  hidden.position.set(0, 0, 1);
  interior.add(hidden);
  const face = new THREE.Group();
  const roof = new THREE.Group();
  rig.add({ ...PREMISES[2], shell, face, roof, interior });
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const hit = rig.pick(50, 50, camera, 100, 100);
  assert.equal(hit && hit.id, 'bell');
  assert.equal(hit.name, 'Bell & Brass');
});

test('the street keeps its four shop lots and a see-inside control', () => {
  for (const id of ['quill', 'hearth', 'bell', 'marrow']) {
    assert.ok(worldSrc.includes(`mountInterior('${id}'`), `${id} interior not mounted`);
  }
  assert.ok(/shopGroup\(-10\.55, d, 3\.6, true\)/.test(worldSrc), 'Quill moved off its lot');
  assert.ok(/shopGroup\(3\.55, d, 3\.6, true\)/.test(worldSrc), 'Hearth moved off its lot');
  assert.ok(/shopGroup\(7\.9, d, 3\.6, true\)/.test(worldSrc), 'Bell moved off its lot');
  assert.ok(/shopGroup\(11\.7, d, 3\.6, true\)/.test(worldSrc), 'Marrow moved off its lot');
  assert.ok(/id="roofpeek"/.test(html), 'see-inside button missing');
  assert.ok(/aria-pressed="false"/.test(html), 'button should start unpressed');
  assert.ok(/world\.setNeighborRoofs\(open, pref === 'shut'\)/.test(mainSrc), 'toggle not wired');
  assert.ok(/world\.peekPremise\(shop\.id\)/.test(mainSrc), 'click-to-peek not wired');
  assert.ok(/world\.updateNeighborPeeks\(dt, now, \{ ambient \}/.test(mainSrc), 'peek update not in the loop');
  assert.ok(/!lite && !_liteSwitched/.test(mainSrc), 'lite mode should not ambient-peek');
});

function mockDocument() {
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return (h) => (h === 'string' ? 'WebGL 2.0' : 1);
      if (k === 'then') return undefined;
      return anyProxy();
    },
    set: () => true,
    apply: () => anyProxy(),
  });
  const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
  globalThis.__headless = true;
  globalThis.__noGLB = true;
  globalThis.document = {
    createElement: (t) => (t === 'canvas' ? cs() : anyProxy()),
    createElementNS: () => cs(),
  };
}

test('built shops hide their rooms until roofs open, and lite drops the upstairs detail', async () => {
  mockDocument();
  const { buildWorld } = await import('../js/world.js');
  const renderer = { shadowMap: {} };
  const full = buildWorld(new THREE.Scene(), renderer, false);
  assert.deepEqual(full.premises.map((p) => p.id), ['quill', 'hearth', 'bell', 'marrow']);
  assert.deepEqual(full.premises.map((p) => p.interior.userData.room), ['books', 'bakery', 'office', 'grocer']);
  for (const p of full.premises) {
    assert.equal(p.interior.visible, false, `${p.id} room visible before opt-in`);
    assert.equal(p.roof.visible, true);
    assert.equal(p.face.visible, true);
    const detail = p.interior.children.find((c) => c.userData.cutawayDetail);
    assert.ok(detail && detail.children.length >= 3, `${p.id} missing the lighter upstairs or extra stock`);
    assert.equal(detail.visible, true);
    assert.ok(p.interior.children.length >= 4, `${p.id} room is too empty to read`);
  }
  full.setNeighborRoofs(true);
  full.updateNeighborPeeks(1, 1000, { ambient: false });
  assert.ok(full.premises.every((p) => p.interior.visible && !p.roof.visible && !p.face.visible));

  const lite = buildWorld(new THREE.Scene(), renderer, true);
  for (const p of lite.premises) {
    const detail = p.interior.children.find((c) => c.userData.cutawayDetail);
    assert.equal(detail.visible, false, `${p.id} lite still draws the upstairs`);
    assert.equal(p.interior.visible, false);
  }
  lite.setLite(true);
  assert.ok(lite.premises.every((p) => p.interior.children.find((c) => c.userData.cutawayDetail).visible === false));
});
