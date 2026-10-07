// The District — a dollhouse diorama. All primitives + canvas textures, no assets.
import * as THREE from '../vendor/three.module.js';
import { PAL, LAYOUT, COPY } from './config.js';
import { woodFloor, pavement, road, awning, menuBoard, softSprite, streakSprite, shopSign, rentSign, stateForDay, tarp, dayHasConstruction } from './textures.js';
import { GLBLoader } from './loader.js';
import { DRINKS, DRINK_IDS, basePrices, menuPrice } from './menu.js';
import { PREMISES, dressInterior, createCutawayRig } from './premises.js';
import { BACKDROP_FACADES, vacantRowFronts } from './farSide.js';

const M = {}; // shared materials
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.em ?? 0x000000, emissiveIntensity: o.emi ?? 1, transparent: !!o.op, opacity: o.op ?? 1 });
  return M[k];
}
function box(parent, w, h, d, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || mat(color, o));
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  parent.add(m); return m;
}
function cyl(parent, r0, r1, h, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, o.seg ?? 14), o.mat || mat(color, o));
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  parent.add(m); return m;
}
// Object3D ids draw Math.random. Cosmetic meshes (rival crowd, heat ribbon)
// must not advance the café's seeded stream.
function quietRandom(fn) {
  const saved = Math.random;
  let a = 0x51EE7;
  Math.random = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  try { return fn(); }
  finally { Math.random = saved; }
}
function plane(parent, w, h, material, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.receiveShadow = o.recv ?? true; m.castShadow = o.cast ?? false;
  parent.add(m); return m;
}

// Chalkboard strike. u=0 is the hit, u=1 is rest. One uniform scale
// wobble — hard out, a small dip, a short rebound, then home. Not a
// squash (x and y stay locked) and not a new clip system.
const CHALK_HIT_MS = 320;
export function chalkPopScale(u) {
  const POP = 1.05;
  if (u <= 0) return 1 + POP;
  if (u >= 1) return 1;
  let amp;
  // Hold the strike long enough to read from the wide camera, then wobble home.
  if (u < 0.26) amp = POP;
  else if (u < 0.62) {
    const a = (u - 0.26) / 0.36;
    const e = a * a * (3 - 2 * a);
    amp = POP + (-0.06 - POP) * e;
  } else if (u < 0.82) {
    const a = (u - 0.62) / 0.2;
    const e = a * a * (3 - 2 * a);
    amp = -0.06 + 0.105 * e;
  } else {
    const a = (u - 0.82) / 0.18;
    const e = a * a * (3 - 2 * a);
    amp = 0.045 * (1 - e);
  }
  return 1 + amp;
}

const HAZE_FOG_FRAGMENT = `#ifdef USE_FOG
float fogFactor = 0.74 * (1.0 - exp(-max(vFogDepth, 0.0) / fogFar));
gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;
const _hazedMaterials = new WeakSet();
export function applyDistrictFog(material) {
  if (!material || material.fog === false || _hazedMaterials.has(material)) return material;
  _hazedMaterials.add(material);
  const prevCompile = material.onBeforeCompile;
  const origKey = material.customProgramCacheKey.call(material);
  material.onBeforeCompile = function (shader, renderer) {
    if (prevCompile) prevCompile.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', HAZE_FOG_FRAGMENT);
  };
  material.customProgramCacheKey = function () { return origKey + '|grunds-haze-v1'; };
  return material;
}
function applyDistrictFogTree(root) {
  root.traverse((o) => {
    const m = o.material;
    if (Array.isArray(m)) m.forEach(applyDistrictFog);
    else applyDistrictFog(m);
  });
}
export function windowMenuRows({ prices = {}, offered = {} } = {}) {
  return DRINK_IDS.map((id) => ({
    id,
    name: DRINKS[id].name,
    price: Number(menuPrice(id, prices)).toFixed(2),
    offered: id === 'matcha' || offered[id] !== false,
  }));
}

export function buildWorld(scene, renderer, lite) {
  const W = { lite };
  const glb = GLBLoader();
  const pending = [];                       // async GLB placements, awaited by W.ready
  // Place a Kenney GLB: kick off the load, attach the resolved Group to
  // `parent` at the given transform. Returns the promise for chaining.
  function place(parent, url, opts = {}) {
    const p = glb.loadGLB(url, opts).then((g) => { parent.add(g); applyDistrictFogTree(g); return g; });
    pending.push(p);
    p.then(() => {
      W._loaded = (W._loaded || 0) + 1;
      const cb = globalThis.__grundsLoadProgress;
      if (typeof cb === 'function') cb(W._loaded, pending.length);
    }, () => {
      W._loaded = (W._loaded || 0) + 1;
      const cb = globalThis.__grundsLoadProgress;
      if (typeof cb === 'function') cb(W._loaded, pending.length);
    });
    return p;
  }
  W._glbLoader = glb;                       // exposed for tests / disposal
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.background = new THREE.Color(0x26304d);
  // Steam, not a painted wall. Colour still shifts with the day (cream at
  // open, paper through the afternoon, brass by close — set on the keyframes
  // below). The shape must not. Stock fog is a smoothstep that hits 1 at
  // fogFar and stays 1, so every fragment past that distance is the same flat
  // colour: a white rectangle at open, a yellow band at close, sitting in
  // front of a sky that does not use fog. This ramp never finishes. It
  // approaches three-quarters strength on a long scale and is still climbing
  // at the back of the park (view depth ~120; the lawn ends near z=109), so
  // there is no distance where the haze becomes a constant colour and grows
  // an edge. Grass and the far trees stay in the mix and thin into it. The
  // sky dome is built with fog off, so the sky stays the sky.
  const HAZE_SCALE = 165;
  scene.fog = new THREE.Fog(PAL.cream, 0.1, HAZE_SCALE);

  // ---- lights -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xc8d8ea, 0x4a3f32, 0.42); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.25);
  sun.castShadow = !lite;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.018;
  scene.add(sun); scene.add(sun.target);
  // bounce — cheap fill that lifts the underside of the bar + tables
  const bounce = new THREE.HemisphereLight(0x4a3f32, 0x0a0a0a, 0.22); scene.add(bounce);
  const pendants = [];
  for (const px of [-7.4, -5.4, -3.4]) {
    const p = new THREE.PointLight(0xffd2a0, 7, 10, 2); p.position.set(px, 2.15, -5.2); scene.add(p); pendants.push(p);
  }
  const tableLight = new THREE.PointLight(0xffd2a0, 5, 10, 2); tableLight.position.set(-2.8, 2.4, 1.1); scene.add(tableLight); pendants.push(tableLight);
  W.lights = { hemi, sun, pendants };

  // ---- ground block -------------------------------------------------------
  const g = new THREE.Group(); scene.add(g);
  box(g, 44, 1, 34, PAL.curb, 0, -0.52, 4, { cast: false });                       // city block base
  const woodTex = woodFloor();
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.02 });
  plane(g, LAYOUT.floor.w, LAYOUT.floor.d, woodMat, LAYOUT.floor.x, 0.01, LAYOUT.floor.z, { rx: -Math.PI / 2 });
  // scuff decal — one darkened plank where the barista stands
  const scuffGeo = new THREE.PlaneGeometry(1.4, 0.9);
  const scuffMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, transparent: true, opacity: 0.14, roughness: 0.85, depthWrite: false });
  const scuff = new THREE.Mesh(scuffGeo, scuffMat); scuff.rotation.x = -Math.PI / 2; scuff.position.set(-6.2, 0.02, -1.8); g.add(scuff);
  const paveTex = pavement();
  const paveMat = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.92, metalness: 0.01 });
  plane(g, 44, 3.6, paveMat, 0, 0.02, LAYOUT.pavementZ, { rx: -Math.PI / 2 });
  // The hall that used to surround the tables is the neighbours' ground:
  // The Quill on the left, Hearth & Rye / Bell & Brass / Marrow Lane on
  // the right, and a sidewalk from the new front (z=4) out to the street.
  plane(g, 5.2, 10.75, paveMat, -11.5, 0.02, -1.425, { rx: -Math.PI / 2 });
  plane(g, 13.6, 10.75, paveMat, 7.65, 0.02, -1.425, { rx: -Math.PI / 2 });
  plane(g, 32, 1.9, paveMat, -1, 0.02, 5.0, { rx: -Math.PI / 2 });
  plane(g, 44, 2.6, paveMat, 0, 0.02, 15.2, { rx: -Math.PI / 2 });
  const roadTex = road();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0.02 });
  plane(g, 44, LAYOUT.roadZ1 - LAYOUT.roadZ0, roadMat, 0, 0.015, (LAYOUT.roadZ0 + LAYOUT.roadZ1) / 2, { rx: -Math.PI / 2 });
  for (let i = 0; i < 5; i++) box(g, 0.62, 0.03, 3.4, 0xd8d2c0, LAYOUT.crossX - 1 + i * 0.60, 0.03, 11.7, { cast: false, op: 0.88 }); // zebra crossing — slightly wider + decal-friendly

  // ---- pavement wear --------------------------------------------------------
  // The near pavement (z 6–9.6) and the road. A few damp patches catch the
  // sun that's already in the scene; a grate sits in the gutter; one paper
  // cup lies by the bench. The far pavement stays bare.
  const wetMat = new THREE.MeshPhysicalMaterial({
    color: PAL.ink, roughness: 0.06, metalness: 0.04,
    clearcoat: 1, clearcoatRoughness: 0.04,
    specularIntensity: 1, specularColor: new THREE.Color(PAL.cream),
    transparent: true, opacity: 0.55, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const puddle = (rx, rz, wobble) => {
    const shape = new THREE.Shape();
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const j = 0.84 + ((i * 5 + wobble) % 4) * 0.055;
      const x = Math.cos(a) * rx * j;
      const y = Math.sin(a) * rz * (1.06 - ((i * 3 + wobble) % 3) * 0.045);
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  };
  // left lamp, right lamp, and one longer slick on the asphalt clear of the zebra
  const wetSpots = [
    { x: -8.2, z: 8.2, rx: 0.9, rz: 0.46, wobble: 2, y: 0.032 },
    { x: 7.45, z: 8.7, rx: 0.72, rz: 0.38, wobble: 5, y: 0.032 },
    { x: 3.4, z: 10.35, rx: 1.15, rz: 0.42, wobble: 1, y: 0.026 },
  ];
  for (const s of wetSpots) {
    const m = new THREE.Mesh(puddle(s.rx, s.rz, s.wobble), wetMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(s.x, s.y, s.z);
    m.receiveShadow = false; m.castShadow = false; m.renderOrder = 2;
    g.add(m);
  }
  // gutter grate — same iron as the lamp posts, two brass bolts
  const drainX = 2.15, drainZ = 9.42;
  box(g, 0.82, 0.018, 0.42, PAL.ink, drainX, 0.032, drainZ, { cast: false, rough: 0.95 });
  for (let i = 0; i < 5; i++) box(g, 0.72, 0.022, 0.03, 0x22262a, drainX, 0.048, drainZ - 0.14 + i * 0.07, { metal: 0.5, rough: 0.42 });
  box(g, 0.04, 0.028, 0.42, 0x22262a, drainX - 0.39, 0.046, drainZ, { metal: 0.5, rough: 0.42 });
  box(g, 0.04, 0.028, 0.42, 0x22262a, drainX + 0.39, 0.046, drainZ, { metal: 0.5, rough: 0.42 });
  cyl(g, 0.02, 0.02, 0.014, PAL.brass, drainX - 0.28, 0.064, drainZ + 0.16, { metal: 0.7, rough: 0.32, seg: 6, cast: false });
  cyl(g, 0.02, 0.02, 0.014, PAL.brass, drainX + 0.28, 0.064, drainZ + 0.16, { metal: 0.7, rough: 0.32, seg: 6, cast: false });
  // one dropped cup, cream paper with a walnut sleeve, lying just past the bench
  const cup = new THREE.Group();
  const paperMat = mat(PAL.paper, { rough: 0.58 });
  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.12, 8), paperMat);
  cupBody.castShadow = true; cupBody.receiveShadow = true;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.034, 8), mat(PAL.walnut, { rough: 0.72 }));
  sleeve.position.y = -0.01; sleeve.castShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 4, 8), paperMat);
  lip.rotation.x = Math.PI / 2; lip.position.y = 0.06;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.044, 8), mat(PAL.walnutDark, { rough: 0.4 }));
  inside.rotation.x = -Math.PI / 2; inside.position.y = 0.061;
  cup.add(cupBody, sleeve, lip, inside);
  cup.rotation.set(0, 0.4, Math.PI / 2);
  cup.scale.setScalar(1.75);
  cup.position.set(6.45, 0.135, 8.25);
  g.add(cup);

  // ---- café shell ---------------------------------------------------------
  // Walls follow the customer room. The ground beside it is the neighbours.
  const roomX0 = LAYOUT.floor.x - LAYOUT.floor.w / 2;
  const roomX1 = LAYOUT.floor.x + LAYOUT.floor.w / 2;
  const roomZ0 = LAYOUT.floor.z - LAYOUT.floor.d / 2;
  const roomZ1 = LAYOUT.floor.z + LAYOUT.floor.d / 2;
  const cafe = new THREE.Group(); scene.add(cafe);
  const backWall = box(cafe, LAYOUT.floor.w, 4.4, 0.4, PAL.plaster, LAYOUT.floor.x, 2.2, roomZ0 - 0.2, { cast: false }); // back wall
  const leftWall = box(cafe, 0.4, 4.4, LAYOUT.floor.d + 0.4, PAL.plaster, roomX0 - 0.2, 2.2, LAYOUT.floor.z, { cast: false }); // left wall
  box(cafe, 0.3, 1.15, LAYOUT.floor.d + 0.4, PAL.wainscot, roomX1 + 0.1, 0.57, LAYOUT.floor.z, { cast: false }); // right half-wall (cutaway)
  box(cafe, LAYOUT.floor.w, 0.9, 0.5, PAL.wainscot, LAYOUT.floor.x, 0.45, roomZ0 - 0.05, { cast: false }); // back wainscot
  box(cafe, 0.5, 0.9, LAYOUT.floor.d + 0.4, PAL.wainscot, roomX0 - 0.05, 0.45, LAYOUT.floor.z, { cast: false });
  // front: pillars + fascia beam + sign + awning (dollhouse — no front wall)
  for (const px of [roomX0 + 0.35, -6.2, -3.4, roomX1 - 0.35]) box(cafe, 0.42, 3.6, 0.42, PAL.walnutDark, px, 1.8, roomZ1);
  const frontBeam = box(cafe, LAYOUT.floor.w, 0.7, 0.5, PAL.walnutDark, LAYOUT.floor.x, 3.75, roomZ1, { cast: false });
  const signTex = shopSign('G R U N D S');
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffc98a, emissiveMap: signTex, emissiveIntensity: 0.4, roughness: 0.8 });
  const signFace = plane(cafe, 6.4, 1.2, signMat, LAYOUT.floor.x, 4.6, roomZ1 + 0.42); const signBack = box(cafe, 6.6, 1.35, 0.18, PAL.walnutDark, LAYOUT.floor.x, 4.6, roomZ1 + 0.32, { cast: false });
  const awnTex = awning();
  const awnMat = new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.88, metalness: 0.01, side: THREE.DoubleSide });
  const awningPlane = plane(cafe, LAYOUT.floor.w - 0.8, 2.2, awnMat, LAYOUT.floor.x, 3.15, roomZ1 + 1.05, { rx: -Math.PI / 2 + 0.32 });
  // awning tie-downs — tiny brass dots where the awning meets the fascia
  for (const px of [-7.2, -5.4, -3.6, -1.6]) {
    const td = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat(0xc9a227, { metal: 0.6, rough: 0.35, cast: false }));
    td.position.set(px, 3.52, roomZ1 + 0.18); cafe.add(td);
  }
  // Near-side front the player stands at (door bay x≈-5, window bay to its
  // left). The wide canopy above is a title occluder and hides in play, so
  // this bay stays dressed: brass-and-cream awning, a menu in the glass,
  // steam drifting from inside out to the door. The walk-through between
  // the pillars at -6.2 and -3.4 stays clear.
  const doorAwning = new THREE.Group(); cafe.add(doorAwning);
  const doorAwnTex = awning('#c9a227', '#efe6d3'); doorAwnTex.repeat.set(1.35, 1);
  const doorAwnMat = new THREE.MeshStandardMaterial({ map: doorAwnTex, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
  // canopy slopes down toward the pavement; a short valance hangs the scallops
  // where the street can see them, clear of the window lettering below.
  const doorAwnX = -4.9, doorAwnW = 3.6;
  plane(doorAwning, doorAwnW, 1.15, doorAwnMat, doorAwnX, 3.34, roomZ1 + 0.55, { rx: -Math.PI / 2 + 0.58, cast: true });
  const skirtTex = doorAwnTex.clone(); skirtTex.repeat.set(1.35, 0.42); skirtTex.offset.set(0, 0); skirtTex.needsUpdate = true;
  const skirtMat = new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
  plane(doorAwning, doorAwnW - 0.1, 0.36, skirtMat, doorAwnX, 2.98, roomZ1 + 0.95, { cast: true });
  box(doorAwning, doorAwnW + 0.2, 0.16, 0.32, PAL.walnutDark, doorAwnX, 3.58, roomZ1 + 0.08, { cast: false });
  box(doorAwning, doorAwnW, 0.045, 0.08, PAL.brass, doorAwnX, 3.5, roomZ1 + 0.22, { metal: 0.55, rough: 0.38, cast: false });
  for (const px of [-6.4, -5.6, -4.8, -4.0, -3.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(PAL.brass, { metal: 0.62, rough: 0.32, cast: false }));
    eye.position.set(px, 3.5, roomZ1 + 0.24); doorAwning.add(eye);
  }
  W._menuState = { prices: basePrices(), offered: Object.fromEntries(DRINK_IDS.map((id) => [id, true])), matchaStruck: false };
  const winMenuC = document.createElement('canvas'); winMenuC.width = 512; winMenuC.height = 640;
  const winMenuG = winMenuC.getContext('2d');
  W.windowMenuTexture = new THREE.CanvasTexture(winMenuC);
  W.windowMenuTexture.colorSpace = THREE.SRGBColorSpace; W.windowMenuTexture.anisotropy = 8;
  const drawWindowMenu = (rows) => {
    const g = winMenuG;
    g.fillStyle = '#efe6d3'; g.fillRect(0, 0, 512, 640);
    g.fillStyle = 'rgba(74,52,35,.045)';
    for (let i = 0; i < 800; i++) g.fillRect((i * 97) % 512, (i * 53) % 640, 1.2, 1.2);
    g.strokeStyle = '#c9a227'; g.lineWidth = 14; g.strokeRect(18, 18, 476, 604);
    g.strokeStyle = 'rgba(201,162,39,.7)'; g.lineWidth = 3; g.strokeRect(34, 34, 444, 572);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#171310'; g.font = '600 58px Georgia, serif'; g.fillText('GRUNDS', 256, 96);
    g.fillStyle = '#4a3423'; g.font = 'italic 24px Georgia, serif'; g.fillText('in the window', 256, 142);
    g.strokeStyle = '#c9a227'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(72, 172); g.lineTo(440, 172); g.stroke();
    g.beginPath(); g.moveTo(120, 180); g.lineTo(392, 180); g.stroke();
    W.windowMenuRows = rows;
    let y = 240;
    for (const r of rows) {
      if (r.id === 'matcha') { g.fillStyle = '#86a860'; g.fillRect(48, y - 14, 8, 28); }
      const off = !r.offered;
      g.fillStyle = off ? 'rgba(23,19,16,.38)' : '#171310';
      g.font = '600 34px Georgia, serif'; g.textAlign = 'left'; g.fillText(r.name, 68, y);
      g.font = '600 28px ui-monospace, Menlo, monospace'; g.textAlign = 'right'; g.fillText(off ? '86' : r.price, 450, y);
      if (off) {
        g.strokeStyle = '#d0603b'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(64, y - 4); g.lineTo(452, y + 4); g.stroke();
      }
      g.strokeStyle = 'rgba(23,19,16,.16)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(62, y + 28); g.lineTo(450, y + 28); g.stroke();
      y += 85;
    }
    g.fillStyle = '#4a3423'; g.font = '20px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
    g.fillText('today’s board', 256, 578);
    W.windowMenuTexture.needsUpdate = true;
  };
  drawWindowMenu(windowMenuRows(W._menuState));
  const winMenu = W.windowMenuTexture;
  const winX = -7.15, winY = 1.78, winZ = roomZ1 + 0.2, winW = 1.45, winH = 2.35;
  box(cafe, winW + 0.18, 0.12, 0.16, PAL.walnutDark, winX, winY + winH / 2, winZ, { cast: false });
  box(cafe, winW + 0.22, 0.14, 0.2, PAL.walnutDark, winX, winY - winH / 2, winZ);
  box(cafe, 0.11, winH, 0.16, PAL.walnutDark, winX - winW / 2, winY, winZ, { cast: false });
  box(cafe, 0.11, winH, 0.16, PAL.walnutDark, winX + winW / 2, winY, winZ, { cast: false });
  box(cafe, winW, 0.04, 0.05, PAL.brass, winX, winY + winH / 2 - 0.1, winZ + 0.04, { metal: 0.55, rough: 0.36, cast: false });
  const frontGlass = new THREE.MeshStandardMaterial({ color: PAL.glass, roughness: 0.06, metalness: 0.12, transparent: true, opacity: 0.2, depthWrite: false });
  plane(cafe, winW - 0.08, winH - 0.16, frontGlass, winX, winY, winZ + 0.05, { cast: false, recv: false });
  const streak = new THREE.MeshBasicMaterial({ color: 0xf6efe0, transparent: true, opacity: 0.22, depthWrite: false });
  plane(cafe, 0.12, winH * 0.72, streak, winX - 0.28, winY + 0.08, winZ + 0.07, { rz: 0.06, cast: false, recv: false });
  const winMenuMat = new THREE.MeshStandardMaterial({ map: winMenu, roughness: 0.86, emissive: 0xf6efe0, emissiveMap: winMenu, emissiveIntensity: 0.16 });
  plane(cafe, winW - 0.2, winH - 0.35, winMenuMat, winX, winY - 0.02, winZ - 0.1, { cast: false });
  const doorSteam = [];
  const steamTex = softSprite();
  for (let i = 0; i < 7; i++) {
    const sm = new THREE.SpriteMaterial({ map: steamTex, color: 0xf6efe0, transparent: true, opacity: 0.45, depthWrite: false });
    const sp = new THREE.Sprite(sm);
    sp.position.set(-5.05, 1.6, roomZ1 - 0.6); sp.scale.setScalar(0.8);
    cafe.add(sp);
    doorSteam.push({ sp, sm, phase: i / 7 });
  }
  W.signMat = signMat;
  W.occluders = { backWall, leftWall, frontBeam, signFace, signBack, awning: awningPlane };
  W.manageCutaway = (camPos, mode = 'play') => {
    const o = W.occluders;
    const play = mode === 'play' || mode === 'demo';
    o.frontBeam.visible = !play;
    o.signFace.visible = !play;
    o.signBack.visible = !play;
    o.awning.visible = !play;
    doorAwning.visible = play;
    o.backWall.visible = !(play && camPos.z < roomZ0 - 0.2);
    o.leftWall.visible = !(play && camPos.x < roomX0 - 0.2);
  };

  // ---- the bar ------------------------------------------------------------
  const bar = new THREE.Group(); scene.add(bar);
  const C = LAYOUT.counter;
  // Procedural walnut bar shell (replaced by Kenney kitchenBar.glb below)
  // — kept as a thin back/side trim so the GLB doesn't sit on raw pavement.
  box(bar, C.w, 1.02, C.d, PAL.walnut, C.x, 0.51, C.z);
  box(bar, C.w + 0.3, 0.09, C.d + 0.3, 0x7a5a3a, C.x, 1.06, C.z, { rough: 0.5 });
  // brass foot rail stays procedural (the GLB doesn't include one)
  cyl(bar, 0.03, 0.03, C.w - 0.6, PAL.brass, C.x, 0.22, C.z + C.d / 2 + 0.22, { rz: Math.PI / 2, metal: 0.8, rough: 0.35, cast: false }); // foot rail
  // Kenney kitchenBar.glb sits on the bar top, facing the customer side.
  // The GLB is roughly 1 m in the kit. Scale matches the shortened bar
  // (C.w); the procedural walnut shell above keeps it continuous.
  place(bar, 'kitchenBar.glb', { position: [C.x, 1.05, C.z], scale: C.w, rotationY: 0 });
  // Kenney kitchenCoffeeMachine.glb replaces the procedural espresso machine.
  place(bar, 'kitchenCoffeeMachine.glb', { position: [-6.35, 1.05, -5.5], scale: 1.6, rotationY: 0 });
  // grinder hopper + body (procedural; no matching Kenney GLB)
  cyl(bar, 0.16, 0.2, 0.5, 0x8a4f2e, -7.55, 1.35, -5.5, { rough: 0.5 });            // grinder hopper
  box(bar, 0.4, 0.5, 0.4, 0x3a3d40, -7.55, 1.28, -5.5, { metal: 0.5, rough: 0.5 });
  // 3 bar stools at the customer-side of the bar (Kenney stoolBar.glb)
  for (const dx of [-2.2, 0, 2.2]) {
    place(scene, 'stoolBar.glb', { position: [C.x + dx, 0, C.z + C.d / 2 + 1.0], scale: 1.0, rotationY: Math.PI });
  }
  // pastry case
  const pc = new THREE.Group(); pc.position.set(-4.3, 1.1, -5.4); bar.add(pc);
  box(pc, 1.7, 0.1, 0.8, PAL.walnutDark, 0, 0.05, 0);
  const glassMat = new THREE.MeshStandardMaterial({ color: PAL.glass, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.25 });
  box(pc, 1.7, 0.62, 0.8, 0xffffff, 0, 0.42, 0, { mat: glassMat, cast: false });
  box(pc, 1.6, 0.03, 0.7, 0xd8d2c0, 0, 0.38, 0, { cast: false });
  const pastryCols = [0xd89a5a, 0xc46a7a, 0x9a6a3a, 0xe0c47a, 0x8a5a3a, 0xd87f9a];
  // Pastry items: 3 croissants (procedural torus -> Kenney croissant.glb)
  // and 3 cakes (procedural box -> Kenney cake.glb). The case frame stays
  // procedural because the GLB kit has no display case.
  pastryCols.forEach((col, i) => {
    const px = -0.6 + (i % 3) * 0.6, py = i < 3 ? 0.16 : 0.46, pz = -0.15 + (i % 2) * 0.3;
    if (i % 3 === 0) {
      // croissant.glb replaces the procedural torus donut
      place(pc, 'croissant.glb', { position: [px, py, pz], scale: 0.7, rotationY: Math.PI / 4 });
    } else {
      // cake.glb replaces the procedural box pastry (the largest one in the case)
      place(pc, 'cake.glb', { position: [px, py, pz], scale: 0.45, rotationY: 0 });
    }
  });
  // till on its own little pay station at the end of the bar
  // (Kenney kitchenBarEnd.glb replaces the procedural walnut stand; the
  // brass screen and receipt roll stay procedural for screen readability)
  box(bar, 0.8, 1.02, 0.7, PAL.walnut, LAYOUT.register.x, 0.51, -5.4);
  box(bar, 0.9, 0.07, 0.8, 0x7a5a3a, LAYOUT.register.x, 1.06, -5.4, { rough: 0.5 });
  place(bar, 'kitchenBarEnd.glb', { position: [LAYOUT.register.x, 0, -5.4], scale: 0.9, rotationY: Math.PI });
  W.tillScreen = plane(bar, 0.4, 0.26, new THREE.MeshStandardMaterial({ color: 0x111418, emissive: 0x86a860, emissiveIntensity: 0.7 }), LAYOUT.register.x, 1.5, -5.32, { rx: -0.25 });
  cyl(bar, 0.07, 0.07, 0.12, 0xf0ead8, LAYOUT.register.x + 0.45, 1.16, -5.45, { cast: false }); // receipt roll

  // ---- counter still-life ---------------------------------------------------
  // Left stretch of the bar, on the wood customers actually see. A kettle,
  // three cups that don't match, and the ring one of them wore into the top.
  // Kept as a few meshes — not a cup system.
  const counterTop = 1.106;
  const kettleWisps = [];
  const wispHome = new THREE.Vector3(0.05, 0.24, 0.14);
  {
    const stain = new THREE.Mesh(
      new THREE.RingGeometry(0.072, 0.128, 28),
      new THREE.MeshStandardMaterial({
        color: PAL.walnutDark, roughness: 1, metalness: 0,
        transparent: true, opacity: 0.58, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      }),
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(-2.77, counterTop + 0.004, -4.74);
    stain.scale.set(1.2, 0.78, 1);
    stain.castShadow = false; stain.receiveShadow = false;
    bar.add(stain);

    const kettle = new THREE.Group();
    kettle.position.set(-3.3, counterTop, -4.88);
    bar.add(kettle);
    cyl(kettle, 0.09, 0.1, 0.15, PAL.brass, 0, 0.075, 0, { metal: 0.7, rough: 0.38, seg: 10 });
    cyl(kettle, 0.072, 0.088, 0.028, PAL.brass, 0, 0.158, 0, { metal: 0.7, rough: 0.38, seg: 10, cast: false });
    cyl(kettle, 0.064, 0.07, 0.018, PAL.cream, 0, 0.18, 0, { rough: 0.42, seg: 10, cast: false });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat(PAL.brass, { metal: 0.75, rough: 0.32 }));
    knob.position.set(0, 0.198, 0); kettle.add(knob);
    cyl(kettle, 0.016, 0.024, 0.1, PAL.brass, 0.02, 0.15, 0.06, { metal: 0.7, rough: 0.38, seg: 7, rx: 1.05, cast: false });
    const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.01, 5, 8, Math.PI), mat(0x2a2c34, { metal: 0.4, rough: 0.42 }));
    kHandle.position.set(-0.1, 0.09, 0); kHandle.rotation.z = Math.PI; kettle.add(kHandle);
    const steamTex = softSprite();
    for (let i = 0; i < 4; i++) {
      const sm = new THREE.SpriteMaterial({ map: steamTex, color: 0xf6efe0, transparent: true, opacity: 0.4, depthWrite: false });
      const s = new THREE.Sprite(sm);
      s.position.copy(wispHome); s.position.y += i * 0.08;
      s.scale.setScalar(0.12);
      kettle.add(s); kettleWisps.push(s);
    }

    // handled mug — paper body, brass lip
    const mug = new THREE.Group(); mug.position.set(-2.27, counterTop, -4.86); bar.add(mug);
    cyl(mug, 0.05, 0.042, 0.112, PAL.paper, 0, 0.056, 0, { rough: 0.48, seg: 10 });
    const mugLip = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.007, 5, 12), mat(PAL.brass, { metal: 0.62, rough: 0.36 }));
    mugLip.rotation.x = Math.PI / 2; mugLip.position.y = 0.11; mug.add(mugLip);
    const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 5, 8, Math.PI), mat(PAL.paper, { rough: 0.5 }));
    mugHandle.position.set(0.068, 0.055, 0); mugHandle.rotation.z = Math.PI; mug.add(mugHandle);
    cyl(mug, 0.038, 0.038, 0.008, PAL.walnut, 0, 0.1, 0, { rough: 0.35, cast: false, seg: 8 });

    // short wide cup — cream, matcha in it, no handle
    const wide = new THREE.Group(); wide.position.set(-1.83, counterTop, -4.72); wide.rotation.y = 0.5; bar.add(wide);
    cyl(wide, 0.064, 0.052, 0.068, PAL.cream, 0, 0.034, 0, { rough: 0.42, seg: 10 });
    cyl(wide, 0.05, 0.05, 0.008, PAL.matcha, 0, 0.064, 0, { rough: 0.28, cast: false, seg: 8 });

    // small espresso on a saucer, leaned, no brass
    cyl(bar, 0.058, 0.058, 0.012, PAL.cream, -1.43, counterTop + 0.006, -4.92, { rough: 0.5, seg: 10, cast: false });
    const tiny = new THREE.Group(); tiny.position.set(-1.41, counterTop + 0.014, -4.9); tiny.rotation.z = -0.16; tiny.rotation.x = 0.05; bar.add(tiny);
    cyl(tiny, 0.03, 0.024, 0.072, PAL.paper, 0, 0.036, 0, { rough: 0.5, seg: 8 });
    cyl(tiny, 0.022, 0.022, 0.006, PAL.walnut, 0, 0.068, 0, { rough: 0.4, cast: false, seg: 8 });
  }


  // ---- menu board + back bar ----------------------------------------------
  const board = menuBoard();
  W.menuTexture = board.draw('4.80', false);
  W.menuMat = new THREE.MeshStandardMaterial({ map: W.menuTexture, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 });
  const redrawBoards = () => {
    const s = W._menuState;
    try {
      const t2 = board.drawMenu(s);
      W.menuMat.map = t2; W.menuMat.needsUpdate = true;
      if (W.menuTexture && W.menuTexture !== t2 && W.menuTexture.dispose) { try { W.menuTexture.dispose(); } catch {} }
      W.menuTexture = t2;
    } catch {
      board.draw(s.prices.matcha ?? '4.80', s.matchaStruck);
      W.menuTexture.needsUpdate = true;
    }
    drawWindowMenu(windowMenuRows(s));
  };
  W.setMatchaPrice = (p, struck) => {
    W._menuState.prices.matcha = p;
    W._menuState.matchaStruck = !!struck;
    redrawBoards();
  };
  // Phase 5 — live menu: the full Phase-3 board (prices + 86). setMatchaPrice
  // stays as a thin wrapper so existing call sites never break.
  W.setMenu = ({ prices = {}, offered = {}, matchaStruck = false } = {}) => {
    W._menuState = { prices: { ...prices }, offered: { ...offered }, matchaStruck };
    redrawBoards();
  };
  W._chalkT0 = 0;
  W._chalkRough = null;
  W._chalkReset = 0;
  // Optional camera nudge. main.js points this at CameraRig.shake.
  W._chalkNudge = null;
  W.flashChalk = (kind) => {
    if (!W.menuMat) return;
    const flashCol = kind === 'reprice' ? 0xc9a227 : 0x86a860;
    W.menuMat.emissive.setHex(flashCol);
    W.menuMat.emissiveIntensity = 0.55;
    // desaturate briefly so the flash reads as chalk, not just glow
    if (!W._chalkT0) W._chalkRough = W.menuMat.roughness;
    W.menuMat.roughness = 0.45;
    // Armed, not started. The first painted frame begins the clock so a
    // hitch between the click and the next draw cannot skip the strike.
    W._chalkT0 = -1;
    try { W._chalkNudge?.(); } catch {}
    if (W._chalkReset) clearTimeout(W._chalkReset);
    // The frame loop settles the board. This only catches a stalled loop.
    W._chalkReset = setTimeout(() => {
      if (!W._chalkT0) return;
      if (W._chalkT0 > 0 && performance.now() - W._chalkT0 < CHALK_HIT_MS) return;
      W._chalkT0 = 0;
      if (!W.menuMat) return;
      W.menuMat.emissiveIntensity = 0;
      if (W._chalkRough != null) W.menuMat.roughness = W._chalkRough;
    }, CHALK_HIT_MS + 80);
  };
  W._chalkPlane = plane(cafe, 3.6, 2.7, W.menuMat, -5.5, 2.75, -6.48);
  // The menu board hangs on the back wall in view of this counter, so a
  // little chalk has settled on the ledge under its left edge. Static —
  // the press puff stays in flashChalk / fx.chalkDust.
  {
    const dustCol = mat(PAL.cream, { rough: 1 });
    for (const [x, y, z, r] of [
      [-7.12, 0.912, -6.42, 0.014], [-6.9, 0.908, -6.48, 0.01],
      [-6.68, 0.916, -6.4, 0.016], [-6.46, 0.91, -6.5, 0.011],
      [-6.24, 0.914, -6.44, 0.013], [-6.82, 0.906, -6.38, 0.009],
      [-7.02, 0.918, -6.52, 0.012],
    ]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), dustCol);
      d.position.set(x, y + r, z); d.castShadow = false; d.receiveShadow = false; cafe.add(d);
    }
    for (const [x, z, r] of [[-2.43, -6.02, 0.011], [-2.17, -5.92, 0.008]]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), dustCol);
      d.position.set(x, counterTop + r, z); d.castShadow = false; d.receiveShadow = false; bar.add(d);
    }
  }
  for (const sy of [1.9, 2.5]) {
    box(cafe, 5.6, 0.07, 0.4, PAL.walnut, -4.3, sy, -6.38, { cast: false });
    for (let i = 0; i < 6; i++) {
      const jx = -6.55 + i * 0.9, jr = ((i * 41 + sy * 13) % 10) / 10;
      if (jr < 0.5) cyl(cafe, 0.11, 0.11, 0.3, [0xc46a4a, 0x8a9a6a, 0xd8c27a, 0x7fb3b0][i % 4], jx, sy + 0.19, -6.38, { cast: false });
      else box(cafe, 0.2, 0.3, 0.14, [0xb59a6a, 0x6a7a8a][i % 2], jx, sy + 0.19, -6.38, { cast: false });
    }
  }
  // pendant lamps over the bar — Kenney lampRoundTable.glb replaces the
  // cord+cone shade; the emissive bulb stays procedural so the time-of-day
  // director (W.bulbMats) can still drive the glow.
  W.bulbMats = [];
  for (const px of [-7.4, -5.4, -3.4]) {
    place(cafe, 'lampRoundTable.glb', { position: [px, 2.7, -5.2], scale: 0.6, rotationY: 0 });
    const bm = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd2a0, emissiveIntensity: 1.55 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bm); bulb.position.set(px, 2.9, -5.2); cafe.add(bulb);
    W.bulbMats.push(bm);
    // cord — thin brass tube from fascia to shade
    cyl(cafe, 0.012, 0.012, 0.65, 0xc9a227, px, 3.3, -5.2, { metal: 0.45, rough: 0.45, cast: false });
  }

  // ---- tables --------------------------------------------------------------
  // A small Kenney sideTable.glb next to the table cluster — used for the
  // server's pickup tray. (Procedural equivalent would be one more
  // cylinder+leg; the GLB is a free win.)
  place(scene, 'sideTable.glb', { position: [-1.6, 0, -2.15], scale: 1.0, rotationY: 0 });
  // Kenney tableRound.glb + chairModernCushion.glb replace the procedural
  // 3-cylinder-per-table + 2-cylinder-per-chair construction. Seats[] is
  // still emitted with the same shape so patrons.js's sit logic is
  // unchanged. tableRound is roughly 1.0 m diameter in the kit, matching
  // the procedural 0.68 m radius we used.
  const seats = [];
  for (const t of LAYOUT.tables) {
    place(scene, 'tableRound.glb', { position: [t.x, 0, t.z], scale: 1.4, rotationY: 0 });
    const n = 3, baseA = Math.random() * Math.PI * 2;
    for (let s = 0; s < n; s++) {
      const a = baseA + (s / n) * Math.PI * 2, sx = t.x + Math.cos(a) * 1.05, sz = t.z + Math.sin(a) * 1.05;
      place(scene, 'chairModernCushion.glb', { position: [sx, 0, sz], scale: 1.0, rotationY: a + Math.PI });
      seats.push({ x: sx, z: sz, face: Math.atan2(t.x - sx, t.z - sz), taken: null, table: t });
    }
  }
  W.seats = seats;

  // ---- retail shelf ---------------------------------------------------------
  // Kenney bookcaseClosedDoors.glb replaces the procedural walnut backing
  // box. The 3 shelf layers and 18 product items (loaves, coffee bags,
  // jars) stay procedural because they are shop content, not furniture.
  const R = LAYOUT.retail;
  place(scene, 'bookcaseClosedDoors.glb', { position: [R.x - 0.3, 0, R.z], scale: [1.4, 2.7, 0.7], rotationY: 0 });
  for (let s = 0; s < 3; s++) {
    const sy = 0.6 + s * 0.75;
    box(scene, R.w + 0.3, 0.06, R.d, 0x7a5a3a, R.x - 0.15, sy, R.z, { cast: false });
    for (let i = 0; i < 6; i++) {
      const iz = R.z - R.d / 2 + 0.6 + i * 0.9, jr = ((i * 31 + s * 17) % 10) / 10;
      if (s === 0) cyl(scene, 0.09, 0.13, 0.34, 0xb59a6a, R.x - 0.1, sy + 0.2, iz, { cast: false });        // loaves
      else if (jr < 0.6) box(scene, 0.24, 0.34, 0.16, [0x86a860, 0xc9a227, 0xa47f5a][i % 3], R.x - 0.1, sy + 0.2, iz, { cast: false }); // coffee bags
      else cyl(scene, 0.1, 0.1, 0.3, 0xd8cbb2, R.x - 0.1, sy + 0.18, iz, { cast: false });                 // jars
    }
  }


  // ---- street furniture -----------------------------------------------------
  W.lampMats = []; W.lampGlows = []; W.lampLights = []; W.lampPoolMats = [];
  const glowTex = softSprite();
  // one shared pool — both lamps follow the same street curve
  const poolMat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const gg = c.getContext('2d');
    const grd = gg.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,242,216,0.95)');
    grd.addColorStop(0.32, 'rgba(255,217,160,0.45)');
    grd.addColorStop(0.68, 'rgba(255,196,120,0.12)');
    grd.addColorStop(1, 'rgba(255,196,120,0)');
    gg.fillStyle = grd; gg.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: t, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
  })();
  W.lampPoolMats.push(poolMat);
  for (const lx of [-9, 7]) {
    cyl(scene, 0.06, 0.08, 3.6, 0x22262a, lx, 1.8, 9.2, { metal: 0.5 });
    cyl(scene, 0.05, 0.05, 1, 0x22262a, lx, 3.55, 8.9, { rx: Math.PI / 2, cast: false });
    const lm = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lm); lamp.position.set(lx, 3.5, 8.55); scene.add(lamp);
    W.lampMats.push(lm);
    const sm = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(sm); spr.position.set(lx, 3.5, 8.55); spr.scale.setScalar(2.6); scene.add(spr);
    W.lampGlows.push(sm);
    // The globe is emissive only. A honey point at the same spot actually
    // lights the pavement. No shadow. Distance 12 / decay 2 pools the
    // street and the door queue and falls off before the bar.
    const ll = new THREE.PointLight(0xffd2a0, 0, 12, 2);
    ll.castShadow = false;
    ll.position.copy(lamp.position);
    scene.add(ll);
    W.lampLights.push(ll);
    // small pool on the pavement under the head — same warm as the globe
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.scale.set(1, 0.72, 1);
    pool.position.set(lx, 0.042, 8.4); pool.renderOrder = 3; pool.castShadow = false; pool.receiveShadow = false;
    scene.add(pool);
  }
  for (const tx of [-14.5, 13.5]) {  // street trees
    cyl(scene, 0.09, 0.13, 1.6, 0x4a3423, tx, 0.8, 7.8);
    const fol = mat(0x3d5a33, { rough: 0.95 });
    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), fol); f1.position.set(tx, 2.1, 7.8); f1.castShadow = true; scene.add(f1);
    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 9, 7), fol); f2.position.set(tx + 0.5, 2.7, 7.6); f2.castShadow = true; scene.add(f2);
  }
  box(scene, 1.8, 0.08, 0.5, PAL.walnut, 5, 0.45, 7.4);                              // bench
  for (const bx of [4.3, 5.7]) box(scene, 0.1, 0.45, 0.5, 0x2a2c2e, bx, 0.22, 7.4);
  box(scene, 1.8, 0.5, 0.08, PAL.walnut, 5, 0.75, 7.62, { cast: false });
  // planters flanking the door — Kenney pottedPlant.glb replaces the
  // procedural box+sphere pair. The pot is ~0.6 m tall in the kit, scale 0.6
  // puts the foliage at the same 0.72 m height as the procedural version.
  // W.plant: the living plant — three sphere "leaves" we tint by queue health.
  for (const px of [-6.5, -3.6]) {
    place(scene, 'pottedPlant.glb', { position: [px, 0, LAYOUT.door.z + 0.6], scale: 0.6, rotationY: 0 });
  }
  // living plant crown (3 spheres above the right planter beside the door)
  W.plantMats = [];
  W.plantGroup = new THREE.Group(); W.plantGroup.position.set(-3.6, 0.9, LAYOUT.door.z + 0.6); scene.add(W.plantGroup);
  for (let i = 0; i < 3; i++) {
    const pm = new THREE.MeshStandardMaterial({ color: 0x6b8a4a, roughness: 0.9, emissive: 0x2a3d18, emissiveIntensity: 0 });
    const ms = new THREE.Mesh(new THREE.SphereGeometry(0.22 - i * 0.04, 8, 6), pm);
    ms.position.set((i - 1) * 0.16, 0.12 + Math.abs(i - 1) * 0.05, (i % 2 ? 0.1 : -0.08));
    W.plantGroup.add(ms); W.plantMats.push(pm);
  }
  // god rays — a tall translucent quad behind the café that fades with mist; used for frost/harvest mood
  W.godRayMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const godGeo = new THREE.PlaneGeometry(18, 14);
  W.godRay = new THREE.Mesh(godGeo, W.godRayMat); W.godRay.position.set(0, 7, -14); W.godRay.rotation.y = 0;
  W.godRay.visible = false; scene.add(W.godRay);
  W.setGodRay = (a) => { W.godRay.visible = a > 0.02; W.godRayMat.opacity = Math.min(0.18, a * 0.18); };
  W.setPlantHealth = (queue) => {
    // queue <5 = lush bloom (green + emissive), 5-10 = ok, 10+ = wilt (brown, dim)
    const health = queue <= 5 ? 1 : queue <= 10 ? 0.55 : 0.18;
    const col = new THREE.Color().setHSL(0.28 - (1 - health) * 0.18, 0.45 + health * 0.15, 0.42 + health * 0.12);
    const wilt = (1 - health) * 0.18;
    for (const pm of W.plantMats) {
      pm.color.copy(col); pm.emissiveIntensity = health > 0.8 ? 0.35 : 0;
    }
    W.plantGroup.scale.setScalar(1 - wilt);
    W.plantGroup.rotation.z = (1 - health) * 0.12;
  };
  // till drawer — a thin box that slides on sale
  W.tillDrawer = box(scene, 0.62, 0.06, 0.42, 0xd8cbb2, LAYOUT.register.x, 0.62, -5.05, { cast: false });
  W.tillDrawerBaseZ = -5.05; W.tillDrawerOpenUntil = 0;
  W.popTillDrawer = () => { W.tillDrawerOpenUntil = performance.now() + 420; };
  // street cat — a tiny capsule + head that walks spawnL->door->tables once/day
  W.cat = (() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.32, 4, 8), mat(0x3a3d40, { rough: 0.9 }));
    body.rotation.z = Math.PI / 2; body.position.y = 0.14; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0x3a3d40, { rough: 0.9 }));
    head.position.set(0.22, 0.18, 0); g.add(head);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.24, 6), mat(0x3a3d40, { rough: 0.9 }));
    tail.position.set(-0.22, 0.16, 0); tail.rotation.z = 0.6; g.add(tail);
    return g;
  })();
  W.catPath = []; W.catT = 0; W.catOn = false; W.catSitsUntil = 0;
  W.spawnCat = () => {
    if (W.catOn) return;
    W.catOn = true; W.catT = 0; W.cat.visible = true; W.catSitsUntil = 0;
    const L = LAYOUT;
    W.catPath = [new THREE.Vector3(L.spawnL.x, 0, L.spawnL.z), new THREE.Vector3(L.door.x, 0, L.door.z + 0.2), new THREE.Vector3(LAYOUT.tables[2].x, 0, LAYOUT.tables[2].z)];
    W.cat.position.copy(W.catPath[0]);
  };
  W._catMeowed = false;
  W.updateCat = (dt, queueLen) => {
    if (!W.catOn) return;
    if (W.catSitsUntil > 0) {
      W.catSitsUntil -= dt;
      if (!W._catMeowed && W.catSitsUntil < 7.5 && W.catSitsUntil > 6.8 && W._onCatMeow) { W._onCatMeow(); W._catMeowed = true; }
      if (W.catSitsUntil <= 0 && queueLen > 10) { W.catOn = false; W.cat.visible = false; } // scatter
      else if (W.catSitsUntil <= 0) { W.catSitsUntil = 0; W._catMeowed = false; }
      else return;
    }
    if (W.catPath.length < 2) {
      // at tables — sit if calm, else wander a bit
      if (queueLen < 4 && W.catSitsUntil === 0) { W.catSitsUntil = 8; W._catMeowed = false; }
      else if (queueLen > 10) { W.catOn = false; W.cat.visible = false; }
      return;
    }
    const a = W.catPath[0], b = W.catPath[1];
    const dx = b.x - W.cat.position.x, dz = b.z - W.cat.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) { W.catPath.shift(); return; }
    const step = 1.1 * dt;
    W.cat.position.x += (dx / dist) * step; W.cat.position.z += (dz / dist) * step;
    W.cat.rotation.y = Math.atan2(dx, dz);
    // tiny bob
    W.cat.position.y = Math.abs(Math.sin(performance.now() * 0.008 + W.catT)) * 0.02;
    W.catT += dt;
  };
  W.rivalJeerUntil = 0; W.rivalJeerBaseEmi = 0.25;
  W.jeerRival = () => { W.rivalJeerUntil = performance.now() + 2200; };
  // PR-B4 — Sam's reactive cameo: when the player undercuts, Sam lurches
  // toward his chalkboard and flips it on camera. cueRivalReact() arms a
  // ~1.9s window during which the silhouette leans + steps forward; the
  // backdrop chalkboard text already updates via W.setRivalStrategy above.
  W.rivalReactUntil = 0;
  W.cueRivalReact = () => { W.rivalReactUntil = performance.now() + 1900; };

  // ---- the rival: GLASSHOUSE across the road --------------------------------
  const rv = new THREE.Group(); rv.position.set(LAYOUT.rival.x, 0, LAYOUT.rival.z); scene.add(rv);
  box(rv, 4.6, 2.5, 2.1, 0xdfe3e2, 0, 1.25, 0, { rough: 0.55 });
  box(rv, 4.8, 0.14, 2.3, PAL.teal, 0, 2.6, 0, { rough: 0.5 });
  box(rv, 4.2, 0.7, 0.5, 0xcfd4d3, 0, 0.95, -1.2, { cast: false });                  // their counter
  const rvSignTex = shopSign(COPY.rivalName, '#e8f0ee', '#27403c', '600 40px Georgia, serif');
  W.rivalSignMat = new THREE.MeshStandardMaterial({ map: rvSignTex, emissive: 0xbfe8e2, emissiveMap: rvSignTex, emissiveIntensity: 0.25, roughness: 0.7 });
  plane(rv, 3.4, 0.64, W.rivalSignMat, 0, 2.05, -1.07, { ry: Math.PI });
  const rvStratC = document.createElement('canvas'); rvStratC.width = 512; rvStratC.height = 64;
  const rvStratG = rvStratC.getContext('2d');
  const rvStratTex = new THREE.CanvasTexture(rvStratC); rvStratTex.colorSpace = THREE.SRGBColorSpace;
  const rvStratMat = new THREE.MeshStandardMaterial({ map: rvStratTex, emissive: 0xbfe8e2, emissiveMap: rvStratTex, emissiveIntensity: 0.3, roughness: 0.7 });
  plane(rv, 3.2, 0.4, rvStratMat, 0, 1.58, -1.07, { ry: Math.PI });
  // Phase 5 — strategy display names: the board renders what Sam is doing,
  // not the internal key. Key → title kept next to the board it feeds.
  const stratLine = (key) => {
    const titles = {
      DEFAULT: 'BALANCED', PRICE_WAR: 'PRICE WAR',
      ROASTER_PIVOT: 'GUEST ROASTER', EFFICIENCY_RUSH: 'EXPRESS BAR',
      BALANCED: 'BALANCED',
    };
    return { title: titles[key] || String(key).replace(/_/g, ' ') };
  };
  W.setRivalStrategy = (name, price) => {
    rvStratG.fillStyle = '#1d2a24'; rvStratG.fillRect(0, 0, 512, 64);
    rvStratG.strokeStyle = 'rgba(201,162,39,.6)'; rvStratG.lineWidth = 2; rvStratG.strokeRect(4, 4, 504, 56);
    rvStratG.fillStyle = '#e8f0ee'; rvStratG.font = '600 26px Georgia, serif'; rvStratG.textAlign = 'center'; rvStratG.textBaseline = 'middle';
    // Phase 5 — the board renders the actual strategy: display name (not
    // the key) plus one line of what it means on the street.
    const def = stratLine(name);
    rvStratG.fillText(def.title + ' · £' + (+price).toFixed(2), 256, 34);
    rvStratTex.needsUpdate = true;
  };
  W.setRivalStrategy('BALANCED', 4.50);
  const rvAwn = new THREE.MeshStandardMaterial({ map: awning('#27403c', '#dfe3e2'), roughness: 0.9, side: THREE.DoubleSide });
  plane(rv, 5, 1.6, rvAwn, 0, 2.9, -1.5, { rx: -Math.PI / 2 + 0.3 });
  box(rv, 0.9, 1.9, 0.14, 0x111418, -1.4, 1.15, -1.06, { em: 0xbfe8e2, emi: 0.5, cast: false }); // their lightbox menu

  // ---- rival life: warm windows with staff silhouettes ----------------------
  // GLASSHOUSE reads as *open* — two glowing front windows with a barista
  // and a customer swaying inside. Flat dark boxes against warm quads: a
  // silhouette, not a simulation. W.updateRival(dt, now) drifts them; the
  // main loop calls it every frame next to patrons.update.
  const rvWinMat = new THREE.MeshBasicMaterial({ color: 0xffb45e });
  W.rivalWinMat = rvWinMat;   // exposed for the day/night curve + tests
  const RV_DAY = new THREE.Color(0x9fb6bd), RV_NIGHT = new THREE.Color(0xffb45e);
  plane(rv, 1.1, 0.95, rvWinMat, -1.05, 1.25, -1.06, { ry: Math.PI });
  plane(rv, 1.1, 0.95, rvWinMat, 1.05, 1.25, -1.06, { ry: Math.PI });
  const rvSilMat = new THREE.MeshBasicMaterial({ color: 0x14181c });
  const rvBarista = new THREE.Group(); rvBarista.position.set(-0.5, 0, -0.8); rv.add(rvBarista);
  box(rvBarista, 0.34, 0.7, 0.24, 0x14181c, 0, 0.95, 0, { cast: false, mat: rvSilMat });
  box(rvBarista, 0.22, 0.24, 0.22, 0x14181c, 0, 1.42, 0, { cast: false, mat: rvSilMat });
  const rvGuest = new THREE.Group(); rvGuest.position.set(1.2, 0, -0.8); rv.add(rvGuest);
  box(rvGuest, 0.3, 0.62, 0.22, 0x14181c, 0, 0.86, 0, { cast: false, mat: rvSilMat });
  box(rvGuest, 0.2, 0.22, 0.2, 0x14181c, 0, 1.28, 0, { cast: false, mat: rvSilMat });
  W.updateRival = (dt, now) => {
    const t = now / 1000;
    rvBarista.position.x = -0.5 + Math.sin(t * 0.9) * 0.3;
    rvBarista.position.y = Math.abs(Math.sin(t * 1.7)) * 0.03;
    const lean = (W._rivalHeat || 0) > 6 ? -0.08 : 0;
    rvBarista.rotation.z = lean;
    rvGuest.position.x = 1.2 + Math.sin(t * 0.5 + 2) * 0.18;
    // PR-B4 — Sam's reactive cameo: when he undercuts, step the silhouette
    // forward (toward +z, i.e. the chalkboard on the front face) + lean.
    // The cue lasts ~1.9s; we pulse the extra lean with a sine so it reads
    // like an emphatic "putting pen to board" gesture, not a fixed pose.
    if (W.rivalReactUntil && now < W.rivalReactUntil) {
      const remaining = W.rivalReactUntil - now;
      const pulse = Math.sin((1900 - remaining) * 0.012);
      rvBarista.position.z = -0.8 + 0.36;   // step forward (toward the door)
      rvBarista.position.x = -0.2;          // face the chalkboard (was -0.5)
      rvBarista.rotation.z = lean + 0.18 * pulse;
    } else {
      // settle back to default pose
      rvBarista.position.z = -0.8;
      rvBarista.rotation.z = lean;
    }
    // Extra bodies behind the glass as Sam's line grows. The queue itself
    // is still the real patrons; these only thicken the shop.
    const heat = W._rivalHeat || 0;
    const marks = W._rivalCrowd || [];
    const gates = [2, 6, 12];
    for (let i = 0; i < marks.length; i++) {
      marks[i].visible = heat >= gates[i];
      marks[i].position.y = Math.sin(t * 0.7 + i) * 0.015;
    }
    // A short queue used to wash the zebra at ~0.2 and disappear into the
    // paint. Steeper, and capped, so two or three people read from the café.
    if (W.rivalHeatMat) W.rivalHeatMat.opacity = heat > 0 ? Math.min(0.58, 0.28 + heat * 0.05) : 0;
  };

  const crowd = quietRandom(() => {
    const crowdSpots = [[0.2, -0.72], [0.85, -0.66], [-1.2, -0.7]];
    const marks = [];
    for (const [x, z] of crowdSpots) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.visible = false;
      box(g, 0.28, 0.58, 0.2, 0x14181c, 0, 0.8, 0, { cast: false, recv: false, mat: rvSilMat });
      box(g, 0.18, 0.2, 0.18, 0x14181c, 0, 1.18, 0, { cast: false, recv: false, mat: rvSilMat });
      rv.add(g);
      marks.push(g);
    }
    return marks;
  });
  W._rivalCrowd = crowd;

  // ---- the rent-pressure sign: gentrification drift made physical ------------
  // A two-post signboard on the right side of the street, in front of the
  // big facade block. Three states: 'let' (day 1-2), 'lease' (day 3-4),
  // 'sold' (day 5). The texture re-bakes; the panel material stays the
  // same. The sign faces the café across the road (rotationY = π).
  const rent = rentSign();
  const rentTex = rent.draw(stateForDay(1));     // start at 'let' (day 1)
  W.rentMat = new THREE.MeshStandardMaterial({ map: rentTex, emissive: 0xffe6c0, emissiveMap: rentTex, emissiveIntensity: 0.18, roughness: 0.85 });
  const rentPost = new THREE.Group(); rentPost.position.set(6, 0, 16.5); scene.add(rentPost);
  // two posts (left + right of the panel)
  box(rentPost, 0.08, 1.7, 0.08, PAL.walnutDark, -0.7, 0.85, 0, { cast: true });
  box(rentPost, 0.08, 1.7, 0.08, PAL.walnutDark,  0.7, 0.85, 0, { cast: true });
  // the panel itself
  plane(rentPost, 1.6, 1.2, W.rentMat, 0, 1.2, 0, { ry: Math.PI });
  // a brass nameplate beneath
  box(rentPost, 1.4, 0.05, 0.08, 0xc9a227, 0, 0.6, 0.02, { cast: false });
  W.setRentPressure = (day) => {
    const state = stateForDay(day);
    rent.draw(state);                 // redraws onto the same canvas
    rentTex.needsUpdate = true;       // GPU re-uploads the new pixels
  };
  // Phase 5 — the lease sign as a physical finale object: campaignClose
  // re-bakes the same board to FOR LEASE (player wins) / SOLD (Sam wins)
  // / DEUCE (tie) so the verdict exists on the street, not just in DOM.
  W.setLeaseFinale = (result) => {
    if (!result) { W.setRentPressure(5); return; }
    const state = result === 'you' ? 'forlease' : result === 'tie' ? 'deuce' : 'sold';
    rent.draw(state);
    rentTex.needsUpdate = true;
  };

  // ---- the day-5 construction prop: scaffold + tarp on the sold storefront --
  // The blocks these comments name are built later (BACKDROP_FACADES).
  // Lives in front of the big right-side facade block (x: 11, z: 19.5, w: 8,
  // h: 11, d: 6). The block's nearest face is at z = 19.5 - 3 = 16.5. We sit
  // the prop at (x: 11, z: 16.4) — just in front of the face, ~5m to the
  // right of the rent sign at x: 6. Scaffold straddles the face; the tarp
  // covers the lower-middle of the block. Whole group is invisible on days
  // 1-4; W.setConstruction(d) makes it visible on day 5.
  const ctar = tarp();
  const ctarTex = ctar.draw();
  W.cTarpMat = new THREE.MeshStandardMaterial({ map: ctarTex, emissive: 0x000000, transparent: true, opacity: 0, roughness: 0.95, side: THREE.DoubleSide });
  const cgrp = new THREE.Group(); cgrp.position.set(11, 0, 16.4); cgrp.visible = false; scene.add(cgrp);
  // the tarp panel (centered, slightly smaller than the block face)
  plane(cgrp, 6.0, 2.0, W.cTarpMat, 0, 2.0, 0, { ry: Math.PI });
  // the scaffold — 4 vertical posts + horizontal cross-beams at 3 levels + 2 diagonals
  const POST = [0.08, 6.5, 0.08];
  const X = [-3.0, 3.0], Z = [-0.4, 0.4];
  for (const x of X) for (const z of Z) box(cgrp, POST[0], POST[1], POST[2], PAL.walnutDark, x, POST[1] / 2, z, { cast: true });
  for (const yLevel of [0.4, 3.0, 5.6]) {
    box(cgrp, 6.2, 0.08, 0.08, PAL.walnutDark, 0, yLevel, -0.4, { cast: false });
    box(cgrp, 6.2, 0.08, 0.08, PAL.walnutDark, 0, yLevel,  0.4, { cast: false });
  }
  // diagonals (X braces on the front face)
  for (const side of [-1, 1]) {
    box(cgrp, 0.06, 5.6, 0.06, PAL.walnutDark, side * 1.6, 2.8, 0, { rz: Math.atan2(5.6, 3.2) * 0.5 * side, cast: false });
  }
  // `suppress`: a Row stand claimed this facade — the player's worksite or
  // finished stand is the construction story here, not the generic prop.
  W.setConstruction = (day, suppress = false) => {
    const on = dayHasConstruction(day) && !suppress;
    cgrp.visible = on;
    W.cTarpMat.opacity = on ? 1.0 : 0.0;
  };

  // ---- the day-5 left-side construction prop: mirror of the right -----------
  // Lives in front of the closer left-side facade block (x: -10, z: 19, w: 7,
  // h: 9, d: 6). The block's nearest face is at z = 19 - 3 = 16. We sit the
  // prop at (x: -10, z: 15.9) — just in front of the face, mirroring the
  // right side. Same shape, scaled smaller to fit a smaller facade: 4 posts,
  // 3 cross-beam levels, X-brace diagonals, 5.2m × 1.6m tarp.
  const ctarL = tarp();
  const ctarLTex = ctarL.draw();
  W.cTarpMatL = new THREE.MeshStandardMaterial({ map: ctarLTex, emissive: 0x000000, transparent: true, opacity: 0, roughness: 0.95, side: THREE.DoubleSide });
  const cgrpL = new THREE.Group(); cgrpL.position.set(-10, 0, 15.9); cgrpL.visible = false; scene.add(cgrpL);
  plane(cgrpL, 5.2, 1.6, W.cTarpMatL, 0, 1.6, 0, { ry: Math.PI });
  const POSTL = [0.08, 5.0, 0.08];
  const XL = [-2.6, 2.6], ZL = [-0.4, 0.4];
  for (const x of XL) for (const z of ZL) box(cgrpL, POSTL[0], POSTL[1], POSTL[2], PAL.walnutDark, x, POSTL[1] / 2, z, { cast: true });
  for (const yLevel of [0.4, 2.4, 4.5]) {
    box(cgrpL, 5.4, 0.08, 0.08, PAL.walnutDark, 0, yLevel, -0.4, { cast: false });
    box(cgrpL, 5.4, 0.08, 0.08, PAL.walnutDark, 0, yLevel,  0.4, { cast: false });
  }
  for (const side of [-1, 1]) {
    box(cgrpL, 0.06, 4.4, 0.06, PAL.walnutDark, side * 1.4, 2.4, 0, { rz: Math.atan2(4.4, 2.8) * 0.5 * side, cast: false });
  }
  W.setConstructionLeft = (day, suppress = false) => {
    const on = dayHasConstruction(day) && !suppress;
    cgrpL.visible = on;
    W.cTarpMatL.opacity = on ? 1.0 : 0.0;
  };

  // ---- the day-5 back-row construction prop: third scaffold -----------------
  // The back-right facade block (x: 17, z: 20.5, w: 6, h: 8, d: 5) is the
  // highest block on the right side; the wide camera frames it well. We
  // sit the prop at (x: 17, z: 18.0) — just in front of the face
  // (z = 20.5 - 2.5 = 18). Same primitive pattern, smaller to fit a
  // smaller facade: 4 posts, 3 cross-beam levels, X-brace diagonals,
  // 4.4m × 1.4m tarp. The third scaffold makes the gentrification read
  // from any camera angle on the wide shot.
  const ctarR = tarp();
  const ctarRTex = ctarR.draw();
  W.cTarpMatR = new THREE.MeshStandardMaterial({ map: ctarRTex, emissive: 0x000000, transparent: true, opacity: 0, roughness: 0.95, side: THREE.DoubleSide });
  const cgrpR = new THREE.Group(); cgrpR.position.set(17, 0, 18.0); cgrpR.visible = false; scene.add(cgrpR);
  plane(cgrpR, 4.4, 1.4, W.cTarpMatR, 0, 1.5, 0, { ry: Math.PI });
  const POSTR = [0.08, 4.5, 0.08];
  const XR = [-2.2, 2.2], ZR = [-0.4, 0.4];
  for (const x of XR) for (const z of ZR) box(cgrpR, POSTR[0], POSTR[1], POSTR[2], PAL.walnutDark, x, POSTR[1] / 2, z, { cast: true });
  for (const yLevel of [0.4, 2.0, 3.8]) {
    box(cgrpR, 4.6, 0.08, 0.08, PAL.walnutDark, 0, yLevel, -0.4, { cast: false });
    box(cgrpR, 4.6, 0.08, 0.08, PAL.walnutDark, 0, yLevel,  0.4, { cast: false });
  }
  for (const side of [-1, 1]) {
    box(cgrpR, 0.06, 3.8, 0.06, PAL.walnutDark, side * 1.2, 2.0, 0, { rz: Math.atan2(3.8, 2.4) * 0.5 * side, cast: false });
  }
  W.setConstructionRight = (day) => {
    const on = dayHasConstruction(day);
    cgrpR.visible = on;
    W.cTarpMatR.opacity = on ? 1.0 : 0.0;
  };

  // ---- neighbours: the named shops on the ground the hall gave back ----------
  // The Quill, Hearth & Rye, Bell & Brass, and Marrow Lane stand on the
  // lots beside the café, signs turned toward the play camera. Same plaster,
  // walnut, brass, and canvas-sign language. GLASSHOUSE stays across the
  // road. Each street window is a shallow lit diorama:
  // a warm back (this is what dusk drives through W.winMats), a few props
  // that belong to the shop, then glass with a faint reflection.
  W.winMats = [];
  W.windowLights = [];
  const winMat = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd089, emissiveIntensity: 0, roughness: 0.94 });
  W.winMats.push(winMat);
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: PAL.glass, roughness: 0.06, metalness: 0.22, transparent: true, opacity: 0.2,
    emissive: PAL.glass, emissiveIntensity: 0.08, depthWrite: false,
  });
  const reflectMat = new THREE.MeshBasicMaterial({
    map: windowReflection(), transparent: true, opacity: 0.34, depthWrite: false,
  });
  const far = new THREE.Group(); scene.add(far);
  // Local -z is the shop front. faceCamera turns that front toward +z so
  // the sign reads from the play camera; otherwise it faces the road.
  function shopGroup(x, depth, frontZ, faceCamera) {
    const g = new THREE.Group();
    if (faceCamera) {
      g.rotation.y = Math.PI;
      g.position.set(x, 0, frontZ - depth / 2);
    } else {
      g.position.set(x, 0, frontZ + depth / 2);
    }
    far.add(g);
    return g;
  }
  function shopSignFace(parent, text, w, h, x, y, z, fg, bg, font) {
    const tex = shopSign(text, fg, bg, font);
    const sm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffc98a, emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.78 });
    plane(parent, w, h, sm, x, y, z, { ry: Math.PI });
    box(parent, w + 0.08, h + 0.08, 0.07, PAL.walnutDark, x, y, z + 0.045, { cast: false });
  }
  // A cream frame, open in the middle, proud of the solid wall just enough
  // for a book or a tin to sit between the warm back and the glass.
  function pane(parent, w, h, x, y, z, dress) {
    const reveal = 0.15;
    const front = z - reveal;
    const backZ = z - 0.02;
    const midZ = (front + backZ) / 2;
    const lip = 0.05;
    box(parent, w + lip * 2, lip, reveal, PAL.cream, x, y + h / 2 + lip / 2, midZ, { cast: false });
    box(parent, w + lip * 2, lip, reveal, PAL.cream, x, y - h / 2 - lip / 2, midZ, { cast: false });
    box(parent, lip, h, reveal, PAL.cream, x - w / 2 - lip / 2, y, midZ, { cast: false });
    box(parent, lip, h, reveal, PAL.cream, x + w / 2 + lip / 2, y, midZ, { cast: false });
    plane(parent, w * 0.96, h * 0.96, winMat, x, y, backZ, { ry: Math.PI, recv: false });
    box(parent, w + lip * 2, 0.045, 0.08, PAL.walnut, x, y - h / 2 - 0.012, front + 0.03, { cast: false });
    const room = { x, y, w, h, z: midZ + 0.01, sill: y - h / 2 + 0.04 };
    if (dress) dress(parent, room);
    if (!lite) {
      const glow = new THREE.PointLight(0xffd2a0, 0.18, 0.9, 2);
      glow.position.set(x, y, front + 0.03);
      parent.add(glow);
      W.windowLights.push(glow);
    }
    addWindowGlass(parent, w * 0.96, h * 0.96, x, y, front);
  }
  function windowReflection() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 256);
    const band = g.createLinearGradient(0, 256, 128, 0);
    band.addColorStop(0, 'rgba(246,239,224,0)');
    band.addColorStop(0.4, 'rgba(246,239,224,0)');
    band.addColorStop(0.5, 'rgba(246,239,224,0.9)');
    band.addColorStop(0.58, 'rgba(239,230,211,0.22)');
    band.addColorStop(0.7, 'rgba(246,239,224,0)');
    band.addColorStop(1, 'rgba(246,239,224,0)');
    g.fillStyle = band; g.fillRect(0, 0, 128, 256);
    const brass = g.createLinearGradient(24, 230, 78, 16);
    brass.addColorStop(0, 'rgba(201,162,39,0)');
    brass.addColorStop(0.47, 'rgba(201,162,39,0)');
    brass.addColorStop(0.53, 'rgba(201,162,39,0.5)');
    brass.addColorStop(0.62, 'rgba(201,162,39,0)');
    brass.addColorStop(1, 'rgba(201,162,39,0)');
    g.fillStyle = brass; g.fillRect(0, 0, 128, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function addWindowGlass(parent, w, h, x, y, z) {
    const glass = plane(parent, w, h, windowGlassMat, x, y, z, { ry: Math.PI, recv: false, cast: false });
    glass.renderOrder = 2;
    const ref = plane(parent, w * 0.97, h * 0.97, reflectMat, x, y, z - 0.012, { ry: Math.PI, recv: false, cast: false });
    ref.renderOrder = 3;
  }
  // Props stay inside the palette: ink, walnut, cream, brass, matcha, teal.
  function lit(color, o = {}) {
    return { ...o, em: o.em ?? color, emi: o.emi ?? 0.16, cast: false, rough: o.rough ?? 0.68 };
  }
  function bookStack(parent, x, sill, z, cols) {
    cols.forEach((c, i) => {
      box(parent, 0.16, 0.06, 0.07, c, x, sill + 0.035 + i * 0.06, z, lit(c, { rz: i === cols.length - 1 ? -0.05 : 0.02, emi: 0.2 }));
    });
  }
  function bookShelf(parent, x, sill, z, cols, bh) {
    const span = Math.max(0.16, (cols.length - 1) * 0.072 + 0.1);
    box(parent, span, 0.028, 0.08, PAL.walnut, x, sill, z, lit(PAL.walnut, { rough: 0.55, emi: 0.12 }));
    cols.forEach((c, i) => {
      box(parent, 0.062, bh, 0.07, c, x + (i - (cols.length - 1) / 2) * 0.072, sill + 0.02 + bh / 2, z, lit(c, { rough: 0.58, emi: 0.22 }));
    });
  }
  function hangingLamp(parent, x, yTop, z) {
    cyl(parent, 0.008, 0.008, 0.16, PAL.ink, x, yTop - 0.08, z, { cast: false });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 8), mat(PAL.brass, lit(PAL.brass, { metal: 0.55, rough: 0.32, emi: 0.4 })));
    shade.castShadow = false; shade.position.set(x, yTop - 0.18, z); parent.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), mat(0xfff2d8, { em: 0xffd2a0, emi: 1.35, rough: 0.3, cast: false }));
    bulb.position.set(x, yTop - 0.2, z); parent.add(bulb);
  }
  function tinStack(parent, x, sill, z, n, colors) {
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      cyl(parent, 0.08, 0.08, 0.07, c, x, sill + 0.04 + i * 0.072, z, lit(c, { metal: 0.55, rough: 0.3, emi: 0.28 }));
    }
  }
  function shopPlant(parent, x, sill, z, scale = 1) {
    cyl(parent, 0.06 * scale, 0.05 * scale, 0.07 * scale, PAL.walnut, x, sill + 0.035 * scale, z, lit(PAL.walnut, { rough: 0.8, emi: 0.12 }));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 8, 6), mat(PAL.matcha, lit(PAL.matcha, { em: PAL.awning, emi: 0.28, rough: 0.78 })));
    leaf.castShadow = false; leaf.scale.set(1, 0.75, 0.62); leaf.position.set(x, sill + 0.15 * scale, z); parent.add(leaf);
    const sprig = new THREE.Mesh(new THREE.SphereGeometry(0.065 * scale, 7, 5), mat(PAL.awning, lit(PAL.awning, { emi: 0.2, rough: 0.8 })));
    sprig.castShadow = false; sprig.position.set(x + 0.06 * scale, sill + 0.18 * scale, z - 0.01); parent.add(sprig);
  }
  function inkwell(parent, x, sill, z) {
    cyl(parent, 0.038, 0.044, 0.055, PAL.ink, x, sill + 0.028, z, lit(PAL.ink, { emi: 0.12 }));
    cyl(parent, 0.016, 0.016, 0.02, PAL.brass, x, sill + 0.062, z, lit(PAL.brass, { metal: 0.5, emi: 0.3 }));
    box(parent, 0.012, 0.22, 0.012, PAL.cream, x + 0.03, sill + 0.14, z, lit(PAL.cream, { rz: -0.6, emi: 0.35 }));
  }
  function loaf(parent, x, sill, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(PAL.walnut, lit(PAL.walnut, { rough: 0.74, emi: 0.2 })));
    m.castShadow = false; m.scale.set(1.35, 0.62, 0.8); m.position.set(x, sill + 0.045, z); parent.add(m);
    box(parent, 0.09, 0.012, 0.012, PAL.cream, x, sill + 0.075, z - 0.03, lit(PAL.cream, { emi: 0.3 }));
  }
  function brassBell(parent, x, sill, z) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.1, 8), mat(PAL.brass, lit(PAL.brass, { metal: 0.62, rough: 0.28, emi: 0.4 })));
    b.castShadow = false; b.position.set(x, sill + 0.07, z); parent.add(b);
    cyl(parent, 0.012, 0.012, 0.05, PAL.ink, x, sill + 0.02, z, { cast: false });
  }
  function mantelClock(parent, x, sill, z) {
    box(parent, 0.13, 0.16, 0.045, PAL.walnut, x, sill + 0.08, z, lit(PAL.walnut, { emi: 0.18 }));
    cyl(parent, 0.05, 0.05, 0.016, PAL.cream, x, sill + 0.09, z - 0.028, lit(PAL.cream, { rx: Math.PI / 2, emi: 0.4 }));
    box(parent, 0.008, 0.035, 0.008, PAL.ink, x + 0.008, sill + 0.1, z - 0.04, { cast: false });
    box(parent, 0.028, 0.008, 0.008, PAL.ink, x + 0.012, sill + 0.085, z - 0.04, { cast: false });
  }
  function cafeCup(parent, x, sill, z) {
    cyl(parent, 0.042, 0.034, 0.06, PAL.cream, x, sill + 0.03, z, lit(PAL.cream, { rough: 0.5, emi: 0.45 }));
    cyl(parent, 0.046, 0.046, 0.012, PAL.brass, x, sill + 0.062, z, lit(PAL.brass, { metal: 0.45, emi: 0.35 }));
  }
  // The two front panes are already a flat warm quad. The counter hides
  // anything below its top, so the plant, cups, and lamp sit on that line,
  // in front of the glass, with the same faint reflection as the other shops.
  function dressGlasshouseWindow(parent, x, side) {
    const y = 1.48, w = 0.42, h = 0.4, zGlass = -1.32;
    const sill = 1.34;
    const z = -1.22;
    if (side === 'left') {
      shopPlant(parent, x, sill, z, 0.9);
      cafeCup(parent, x + 0.1, sill, z);
    } else {
      hangingLamp(parent, x, 1.64, z);
      cafeCup(parent, x - 0.08, sill, z);
    }
    addWindowGlass(parent, w, h, x, y, zGlass);
  }
  function stripedAwning(parent, w, len, x, y, z, stripeA, stripeB) {
    const am = new THREE.MeshStandardMaterial({ map: awning(stripeA, stripeB), roughness: 0.88, metalness: 0.01, side: THREE.DoubleSide });
    plane(parent, w, len, am, x, y, z, { rx: -Math.PI / 2 + 0.34 });
  }

  // Hollow shells. The street face and the lid are their own groups so a
  // peek can lift the roof without moving the lot. Door anchors used by
  // street life sit in front of these fronts (z ≈ 5.7); keep the x and the
  // front at 3.6.
  const cutaways = createCutawayRig({ lite });
  W.premises = cutaways.premises;
  W.setNeighborRoofs = cutaways.setRoofs;
  W.peekPremise = cutaways.peek;
  W.pickPremise = cutaways.pick;
  W.updateNeighborPeeks = cutaways.update;
  W.openPremiseIds = () => cutaways.openIds();
  function skirt(parent, w, h, d, color, y, o = {}) {
    const t = 0.1;
    const opt = { cast: false, ...o };
    box(parent, w, h, t, color, 0, y, d / 2 - t / 2, opt);
    box(parent, w, h, t, color, 0, y, -d / 2 + t / 2, opt);
    box(parent, t, h, d - 2 * t, color, -w / 2 + t / 2, y, 0, opt);
    box(parent, t, h, d - 2 * t, color, w / 2 - t / 2, y, 0, opt);
  }
  function openShop(g, w, h, d, color) {
    const t = 0.14;
    const shell = new THREE.Group(); g.add(shell);
    const face = new THREE.Group(); g.add(face);
    const roof = new THREE.Group(); g.add(roof);
    const interior = new THREE.Group(); interior.visible = false; g.add(interior);
    const wall = { cast: true, recv: true };
    box(shell, w - t * 2 - 0.02, 0.05, d - t * 2 - 0.02, PAL.walnutDark, 0, 0.03, 0, { cast: false, rough: 0.72 });
    box(shell, w, h, t, color, 0, h / 2, d / 2 - t / 2, wall);
    box(shell, t, h, d - t * 2, color, -w / 2 + t / 2, h / 2, 0, wall);
    box(shell, t, h, d - t * 2, color, w / 2 - t / 2, h / 2, 0, wall);
    box(face, w, h, t, color, 0, h / 2, -d / 2 + t / 2, wall);
    return { shell, face, roof, interior };
  }
  function mountInterior(id, parts, w, h, d) {
    const meta = PREMISES.find((p) => p.id === id);
    const detail = new THREE.Group();
    detail.userData.cutawayDetail = true;
    parts.interior.add(detail);
    cutaways.trackDetail(detail);
    dressInterior(id, { interior: parts.interior, detail, w, h, d, box, cyl, plane, THREE, PAL });
    cutaways.add({ id, name: meta.name, line: meta.line, shell: parts.shell, face: parts.face, roof: parts.roof, interior: parts.interior });
  }

  // A head and shoulders in one pane, the same dark read as Glasshouse.
  // The face group hides with the roof, so an open shop shows the room
  // instead of this shape.
  const shopSilMat = new THREE.MeshBasicMaterial({ color: 0x14181c });
  W._shopSils = [];
  function windowFigure(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.userData.homeX = x;
    box(g, 0.15, 0.32, 0.07, 0x14181c, 0, 0.16, 0, { cast: false, recv: false, mat: shopSilMat });
    box(g, 0.1, 0.11, 0.07, 0x14181c, 0, 0.38, 0, { cast: false, recv: false, mat: shopSilMat });
    parent.add(g);
    W._shopSils.push(g);
    return g;
  }

  // THE QUILL — tall and narrow, stepped ink parapet, a bay window.
  (function quill() {
    const w = 3.05, h = 3.85, d = 2.2;
    const g = shopGroup(-10.55, d, 3.6, true);
    const fz = -d / 2;
    const parts = openShop(g, w, h, d, PAL.plaster);
    skirt(parts.shell, w + 0.06, 0.85, d + 0.04, PAL.ink, 0.42);
    box(parts.roof, w + 0.16, 0.18, d + 0.12, PAL.ink, 0, h + 0.06, 0, { cast: false });
    box(parts.roof, w * 0.68, 0.28, d * 0.62, PAL.ink, 0, h + 0.28, 0);
    box(parts.roof, w * 0.36, 0.34, d * 0.36, PAL.brass, 0, h + 0.56, 0, { metal: 0.5, rough: 0.38 });
    cyl(parts.roof, 0.025, 0.008, 0.62, PAL.brass, 0, h + 1.02, 0, { metal: 0.55, rough: 0.35 });
    box(parts.face, 1.15, 1.35, 0.28, PAL.cream, 0, 0.85, fz - 0.1);
    // The door sits in the middle of the bay, so the lit glass is the two cheeks.
    pane(parts.face, 0.2, 0.62, -0.44, 1.02, fz - 0.24, (p, d) => {
      bookStack(p, d.x, d.sill, d.z, [PAL.walnutDark, PAL.ink, PAL.walnut]);
    });
    pane(parts.face, 0.2, 0.62, 0.44, 1.02, fz - 0.24, (p, d) => {
      inkwell(p, d.x, d.sill, d.z);
    });
    pane(parts.face, 0.62, 1.15, -0.62, 2.55, fz, (p, d) => {
      bookShelf(p, d.x, d.sill, d.z, [PAL.ink, PAL.walnut, PAL.cream, PAL.walnutDark], 0.36);
      bookShelf(p, d.x, d.sill + 0.46, d.z, [PAL.brass, PAL.ink, PAL.walnut, PAL.cream], 0.34);
    });
    pane(parts.face, 0.62, 1.15, 0.62, 2.55, fz, (p, d) => {
      bookShelf(p, d.x - 0.06, d.sill, d.z, [PAL.walnut, PAL.ink, PAL.walnutDark], 0.32);
      hangingLamp(p, d.x + 0.16, d.y + d.h / 2 - 0.06, d.z);
    });
    box(parts.face, 0.62, 1.55, 0.08, PAL.walnut, 0, 0.78, fz - 0.28);
    shopSignFace(g, 'THE QUILL', 2.7, 0.7, 0, 3.35, fz - 0.08, '#f6efe0', '#171310', '600 72px Georgia, serif');
    windowFigure(parts.face, -0.78, 2.35, fz - 0.05);
    mountInterior('quill', parts, w, h, d);
  })();

  // HEARTH & RYE — street-facing gable, chimney, cream-and-walnut awning.
  (function hearth() {
    const w = 4.6, h = 3.15, d = 2.35;
    const g = shopGroup(3.55, d, 3.6, true);
    const fz = -d / 2;
    const parts = openShop(g, w, h, d, PAL.plaster);
    skirt(parts.shell, w + 0.06, 0.7, d + 0.04, PAL.walnut, 0.35);
    // A rim, not a slab — the old brass rule ran around the solid box.
    skirt(parts.shell, w + 0.08, 0.05, d + 0.06, PAL.brass, 0.72, { metal: 0.5, rough: 0.4 });
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-w / 2 - 0.18, 0);
    roofShape.lineTo(0, 1.08);
    roofShape.lineTo(w / 2 + 0.18, 0);
    roofShape.closePath();
    const roofLen = d + 0.4;
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: roofLen, bevelEnabled: false });
    roofGeo.translate(0, 0, -roofLen / 2);
    const gable = new THREE.Mesh(roofGeo, mat(PAL.walnutDark, { rough: 0.86 }));
    gable.position.set(0, h, 0); gable.castShadow = true; gable.receiveShadow = true; parts.roof.add(gable);
    box(parts.roof, 0.42, 1.05, 0.42, PAL.walnut, 1.25, h + 0.72, 0.28);
    box(parts.roof, 0.54, 0.1, 0.54, PAL.ink, 1.25, h + 1.26, 0.28, { cast: false });
    stripedAwning(parts.face, w + 0.15, 1.35, 0, 1.72, fz - 0.12, '#4a3423', '#efe6d3');
    pane(parts.face, 0.82, 0.72, -1.4, 1.15, fz, (p, room) => {
      tinStack(p, room.x - 0.2, room.sill, room.z, 3, [PAL.brass, PAL.teal, PAL.brass]);
      loaf(p, room.x + 0.2, room.sill, room.z);
      hangingLamp(p, room.x, room.y + room.h / 2 - 0.02, room.z);
    });
    pane(parts.face, 0.82, 0.72, 1.4, 1.15, fz, (p, room) => {
      hangingLamp(p, room.x + 0.16, room.y + room.h / 2 - 0.04, room.z);
      loaf(p, room.x - 0.16, room.sill, room.z);
    });
    box(parts.face, 0.78, 1.55, 0.08, PAL.walnutDark, 0, 0.78, fz - 0.02);
    cyl(parts.face, 0.02, 0.02, 0.32, PAL.brass, 0.24, 0.82, fz - 0.1, { metal: 0.6, rough: 0.35, cast: false });
    shopSignFace(g, 'HEARTH & RYE', 3.7, 0.72, 0, 2.42, fz - 0.08, '#f6efe0', '#4a3423', '600 58px Georgia, serif');
    windowFigure(parts.face, 1.7, 1.12, fz - 0.05);
    mountInterior('hearth', parts, w, h, d);
  })();

  // BELL & BRASS — square cream front, round clock, brass cupola.
  (function bell() {
    const w = 3.2, h = 3.05, d = 2.2;
    const g = shopGroup(7.9, d, 3.6, true);
    const fz = -d / 2;
    const parts = openShop(g, w, h, d, PAL.cream);
    skirt(parts.shell, w + 0.05, 0.55, d + 0.03, PAL.walnut, 0.28);
    box(parts.roof, w + 0.14, 0.12, d + 0.1, PAL.brass, 0, h + 0.02, 0, { metal: 0.55, rough: 0.35, cast: false });
    cyl(parts.face, 0.4, 0.4, 0.1, PAL.brass, 0, 2.62, fz + 0.02, { rx: Math.PI / 2, metal: 0.6, rough: 0.35 });
    cyl(parts.face, 0.31, 0.31, 0.08, PAL.cream, 0, 2.62, fz - 0.04, { rx: Math.PI / 2, cast: false });
    box(parts.face, 0.03, 0.22, 0.02, PAL.ink, 0.015, 2.68, fz - 0.1, { cast: false });
    box(parts.face, 0.16, 0.028, 0.02, PAL.ink, 0.06, 2.6, fz - 0.1, { cast: false });
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.5, 10), mat(PAL.brass, { metal: 0.5, rough: 0.4 }));
    cup.position.set(0, h + 0.62, 0.15); cup.castShadow = true; parts.roof.add(cup);
    cyl(parts.roof, 0.2, 0.32, 0.36, PAL.walnutDark, 0, h + 0.2, 0.15);
    pane(parts.face, 0.62, 0.72, -0.9, 1.15, fz, (p, room) => {
      hangingLamp(p, room.x + 0.12, room.y + room.h / 2 - 0.04, room.z);
      brassBell(p, room.x - 0.12, room.sill, room.z);
    });
    pane(parts.face, 0.62, 0.72, 0.9, 1.15, fz, (p, room) => {
      mantelClock(p, room.x - 0.1, room.sill, room.z);
      tinStack(p, room.x + 0.14, room.sill, room.z, 2, [PAL.brass, PAL.cream]);
    });
    box(parts.face, 0.64, 1.45, 0.08, PAL.walnut, 0, 0.72, fz - 0.02);
    shopSignFace(g, 'BELL & BRASS', 2.9, 0.62, 0, 1.78, fz - 0.08, '#f6efe0', '#1d2a24', '600 52px Georgia, serif');
    windowFigure(parts.face, 1.12, 1.12, fz - 0.05);
    mountInterior('bell', parts, w, h, d);
  })();

  // MARROW LANE — low and wide, deep matcha awning, crates on the pavement.
  (function marrow() {
    const w = 3.7, h = 2.7, d = 2.3;
    const g = shopGroup(11.7, d, 3.6, true);
    const fz = -d / 2;
    const parts = openShop(g, w, h, d, PAL.plaster);
    box(parts.roof, w + 0.08, 0.16, d + 0.06, PAL.matcha, 0, h + 0.05, 0, { cast: false });
    skirt(parts.shell, w + 0.04, 0.42, d + 0.02, PAL.walnut, 0.21);
    stripedAwning(parts.face, w + 0.25, 1.55, 0, 1.7, fz - 0.18, '#86a860', '#f6efe0');
    shopSignFace(g, 'MARROW LANE', 3.25, 0.66, 0, 2.28, fz - 0.08, '#171310', '#efe6d3', '600 56px Georgia, serif');
    pane(parts.face, 1.15, 0.62, 0.85, 1.15, fz, (p, room) => {
      shopPlant(p, room.x - 0.28, room.sill, room.z, 1.35);
      tinStack(p, room.x + 0.22, room.sill, room.z, 3, [PAL.matcha, PAL.cream, PAL.brass]);
    });
    box(parts.face, 1.7, 0.85, 0.32, PAL.walnut, -0.7, 0.48, fz - 0.12);
    box(g, 0.4, 0.34, 0.4, PAL.walnutDark, -1.45, 0.17, fz - 0.55);
    box(g, 0.36, 0.3, 0.36, PAL.walnut, -1.05, 0.15, fz - 0.62);
    const fruit = (color, x, y, z, r) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(color, { rough: 0.72 }));
      s.position.set(x, y, z); s.castShadow = true; g.add(s);
    };
    fruit(PAL.matcha, -1.45, 0.46, fz - 0.55, 0.11);
    fruit(PAL.neg, -1.22, 0.44, fz - 0.68, 0.09);
    fruit(PAL.brass, -1.05, 0.42, fz - 0.5, 0.1);
    fruit(PAL.cream, 0.15, 0.98, fz - 0.18, 0.1);
    windowFigure(parts.face, 1.28, 1.1, fz - 0.05);
    mountInterior('marrow', parts, w, h, d);
  })();

  // GLASSHOUSE keeps its glowing panes and the staff behind them. The
  // street-readable interior is the outer glass: plant and cup on the left,
  // cups and a lamp on the right, each under a faint reflection.
  dressGlasshouseWindow(rv, -1.32, 'left');
  dressGlasshouseWindow(rv, 1.32, 'right');

  // ---- far-side massing: the facade blocks the scaffolds were written for --
  // Backdrop only. Glasshouse, the park, and the Row stay the opposite
  // street. Windows face both ways: the lease camera looks up from the café,
  // the play camera sits behind these blocks and sees the park side.
  {
    const massing = new THREE.Group(); scene.add(massing);
    const brick = 0x6e4036;
    const facadeWinMat = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd089, emissiveIntensity: 0, roughness: 0.9 });
    W.winMats.push(facadeWinMat);
    const paperWin = new THREE.MeshStandardMaterial({ color: 0x2c2824, roughness: 0.92, emissive: 0x1a1612, emissiveIntensity: 0.2 });
    function facadeFace(g, spec, side) {
      const zFace = side * (spec.d / 2);
      const nudge = side * 0.05;
      const ry = side < 0 ? Math.PI : 0;
      const cols = spec.w >= 7.5 ? 3 : 2;
      const rows = spec.h >= 10 ? 3 : 2;
      box(g, spec.w * 0.94, 2.15, 0.1, PAL.plaster, 0, 1.35, zFace + nudge * 0.6, { cast: false });
      box(g, spec.w * 0.22, 1.7, 0.08, PAL.walnutDark, -spec.w * 0.22, 0.9, zFace + nudge, { cast: false });
      box(g, spec.w * 0.72, 0.06, 0.04, PAL.brass, 0, 2.5, zFace + nudge, { metal: 0.45, cast: false });
      const winW = Math.min(0.72, spec.w * 0.16);
      const winH = 0.95;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * (spec.w * 0.28);
          const y = 3.55 + r * 1.85;
          if (y + winH / 2 > spec.h - 0.35) continue;
          box(g, winW + 0.1, winH + 0.1, 0.06, PAL.cream, x, y, zFace + nudge * 0.7, { cast: false });
          plane(g, winW, winH, facadeWinMat, x, y, zFace + nudge, { ry, recv: false, cast: false });
        }
      }
    }
    for (const spec of BACKDROP_FACADES) {
      const g = new THREE.Group();
      g.position.set(spec.x, 0, spec.z);
      g.name = `facade-${spec.id}`;
      box(g, spec.w, spec.h, spec.d, brick, 0, spec.h / 2, 0, { cast: true, recv: true });
      box(g, spec.w + 0.16, 0.22, spec.d + 0.12, PAL.walnutDark, 0, spec.h + 0.08, 0, { cast: false });
      box(g, spec.w + 0.06, 0.08, spec.d + 0.04, PAL.brass, 0, spec.h - 0.02, 0, { metal: 0.4, cast: false });
      facadeFace(g, spec, -1);
      facadeFace(g, spec, 1);
      massing.add(g);
    }
    const rowFronts = new Map();
    for (const spec of vacantRowFronts()) {
      const g = new THREE.Group();
      g.position.set(spec.x, 0, spec.z);
      g.name = `row-front-${spec.id}`;
      box(g, spec.w, spec.h, spec.d, PAL.plaster, 0, spec.h / 2, 0, { cast: true, recv: true });
      box(g, spec.w + 0.08, 0.14, spec.d + 0.08, PAL.walnutDark, 0, spec.h + 0.04, 0, { cast: false });
      const tex = shopSign(String(spec.name).toUpperCase(), '#171310', '#efe6d3', '600 40px Georgia, serif');
      const sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, emissive: 0xfff2d8, emissiveMap: tex, emissiveIntensity: 0.14 });
      for (const side of [-1, 1]) {
        const z = side * (spec.d / 2 + 0.02);
        const ry = side < 0 ? Math.PI : 0;
        box(g, 0.48, 1.4, 0.06, PAL.walnut, side * -0.62, 0.75, z, { cast: false });
        plane(g, 0.78, 0.7, paperWin, side * 0.42, 1.22, z, { ry, recv: false, cast: false });
        box(g, 0.045, 0.62, 0.03, PAL.cream, side * 0.42, 1.22, z + side * 0.03, { rz: 0.7, cast: false });
        box(g, 0.045, 0.62, 0.03, PAL.cream, side * 0.42, 1.22, z + side * 0.03, { rz: -0.7, cast: false });
        plane(g, spec.w * 0.82, 0.38, sm, 0, 2.28, z + side * 0.015, { ry, recv: false, cast: false });
      }
      massing.add(g);
      rowFronts.set(spec.id, g);
    }
    W.setRowFront = (id, on) => {
      const g = rowFronts.get(String(id));
      if (g) g.visible = !!on;
    };
  }

  // ---- closed gardens behind the neighbour houses ----------------------------
  // The pavement behind The Quill and behind the right-hand row is a walled
  // garden: grass, a low wall, a shut gate toward the café, a little
  // overgrowth, two trees on the long plot and one on the short. It is only
  // scenery. Nothing routes a customer, a sale, or a purchase through it.
  {
    const garden = new THREE.Group(); scene.add(garden);
    const grassTex = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const pg = c.getContext('2d');
      pg.fillStyle = '#86a860'; pg.fillRect(0, 0, 128, 128);
      pg.fillStyle = '#2f4f43';
      for (let i = 0; i < 280; i++) pg.fillRect((i * 47) % 128, (i * 89) % 128, 2 + (i % 3), 2 + (i % 2));
      pg.fillStyle = 'rgba(246,239,224,.18)';
      for (let i = 0; i < 70; i++) pg.fillRect((i * 113) % 128, (i * 61) % 128, 1, 2);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); t.anisotropy = 8;
      return t;
    })();
    const gardenGrass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.97, metalness: 0 });
    const plots = [
      { x0: -13.55, x1: -9.25, z0: -8.0, z1: 0.7, gate: 'e', trees: [[-11.3, -3.6, 6.1, -1]] },
      { x0: 1.45, x1: 13.75, z0: -8.0, z1: 0.7, gate: 'n', trees: [[4.4, -4.6, 6.4, 1], [10.8, -3.2, 5.5, -1]] },
    ];
    const wallH = 0.82, wallT = 0.22, gateW = 1.45;
    const shrub = (x, z, r, lift, col) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat(col, { rough: 0.95 }));
      s.position.set(x, lift, z); s.castShadow = true; s.receiveShadow = true; garden.add(s);
    };
    const tree = (x, z, h, lean) => {
      cyl(garden, 0.1, 0.15, h * 0.52, PAL.walnut, x, h * 0.26, z);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.32, 9, 7), mat(PAL.awning, { rough: 0.95 }));
      crown.position.set(x, h * 0.58, z); crown.castShadow = true; garden.add(crown);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(h * 0.2, 8, 6), mat(PAL.matcha, { rough: 0.96 }));
      puff.position.set(x + 0.32 * lean, h * 0.84, z + 0.12); puff.castShadow = true; garden.add(puff);
    };
    for (const p of plots) {
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      const pw = p.x1 - p.x0, pd = p.z1 - p.z0;
      plane(garden, pw - 0.2, pd - 0.2, gardenGrass, cx, 0.045, cz, { rx: -Math.PI / 2 });
      const cap = (x, z, w, d) => box(garden, w, 0.08, d, PAL.walnut, x, wallH + 0.02, z, { cast: false });
      const runX = (z, xA, xB) => {
        if (xB - xA < 0.2) return;
        const w = xB - xA, x = (xA + xB) / 2;
        box(garden, w, wallH, wallT, PAL.plaster, x, wallH / 2, z, { cast: true });
        cap(x, z, w + 0.04, wallT + 0.06);
      };
      const runZ = (x, zA, zB) => {
        if (zB - zA < 0.2) return;
        const d = zB - zA, z = (zA + zB) / 2;
        box(garden, wallT, wallH, d, PAL.plaster, x, wallH / 2, z, { cast: true });
        cap(x, z, wallT + 0.06, d + 0.04);
      };
      const g0 = (p.gate === 'n' ? cx : cz) - gateW / 2;
      const g1 = (p.gate === 'n' ? cx : cz) + gateW / 2;
      if (p.gate === 'n') {
        runX(p.z1, p.x0, p.x1);
        runX(p.z0, p.x0, g0);
        runX(p.z0, g1, p.x1);
        runZ(p.x0, p.z0, p.z1);
        runZ(p.x1, p.z0, p.z1);
        const gz = p.z0;
        box(garden, 0.12, 1.15, 0.12, PAL.walnutDark, g0, 0.58, gz, { cast: false });
        box(garden, 0.12, 1.15, 0.12, PAL.walnutDark, g1, 0.58, gz, { cast: false });
        box(garden, gateW * 0.48, 1.28, 0.06, PAL.walnut, cx - gateW * 0.24, 0.66, gz + 0.02);
        box(garden, gateW * 0.48, 1.28, 0.06, PAL.walnut, cx + gateW * 0.24, 0.66, gz + 0.02);
        box(garden, gateW * 0.92, 0.06, 0.04, PAL.brass, cx, 0.92, gz + 0.06, { metal: 0.6, rough: 0.35, cast: false });
        cyl(garden, 0.035, 0.035, 0.04, PAL.brass, cx, 0.78, gz + 0.08, { metal: 0.65, rough: 0.32, seg: 8, cast: false });
        box(garden, 0.55, 0.02, 2.4, PAL.walnutDark, cx, 0.055, gz + 1.35, { cast: false });
      } else {
        runX(p.z0, p.x0, p.x1);
        runX(p.z1, p.x0, p.x1);
        const gx = p.gate === 'e' ? p.x1 : p.x0;
        const inward = p.gate === 'e' ? -1 : 1;
        if (p.gate === 'e') {
          runZ(p.x0, p.z0, p.z1);
          runZ(p.x1, p.z0, g0);
          runZ(p.x1, g1, p.z1);
        } else {
          runZ(p.x1, p.z0, p.z1);
          runZ(p.x0, p.z0, g0);
          runZ(p.x0, g1, p.z1);
        }
        box(garden, 0.12, 1.15, 0.12, PAL.walnutDark, gx, 0.58, g0, { cast: false });
        box(garden, 0.12, 1.15, 0.12, PAL.walnutDark, gx, 0.58, g1, { cast: false });
        box(garden, 0.06, 1.28, gateW * 0.48, PAL.walnut, gx + inward * 0.02, 0.66, cz - gateW * 0.24);
        box(garden, 0.06, 1.28, gateW * 0.48, PAL.walnut, gx + inward * 0.02, 0.66, cz + gateW * 0.24);
        box(garden, 0.04, 0.06, gateW * 0.92, PAL.brass, gx + inward * 0.06, 0.92, cz, { metal: 0.6, rough: 0.35, cast: false });
        cyl(garden, 0.035, 0.035, 0.04, PAL.brass, gx + inward * 0.08, 0.78, cz, { rx: Math.PI / 2, metal: 0.65, rough: 0.32, seg: 8, cast: false });
        box(garden, 0.55, 0.02, 2.4, PAL.walnutDark, gx + inward * 1.35, 0.055, cz, { cast: false });
      }
      for (const [tx, tz, th, lean] of p.trees) tree(tx, tz, th, lean);
      const edge = [
        [p.x0 + 0.55, p.z0 + 0.7, 0.42], [p.x0 + 1.5, p.z1 - 0.6, 0.34],
        [p.x1 - 0.7, p.z0 + 1.1, 0.38], [cx + 1.7, p.z0 + 0.85, 0.28],
        [cx + (p.x1 - cx) * 0.45, cz + 0.4, 0.5],
      ];
      edge.forEach(([x, z, r], i) => {
        shrub(x, z, r, r * 0.7, i % 2 ? PAL.matcha : PAL.awning);
        if (i % 2 === 0) shrub(x + 0.22, z - 0.16, r * 0.65, wallH + r * 0.2, PAL.awning);
      });
    }
  }

  // ---- past the far curb: a park apron and a tree line -----------------------
  // The city slab ends just behind the shops. A matcha lawn runs from that
  // edge out into the fog so the ground does not stop as a hard cut, and a
  // low planted ridge closes the empty horizon. Same greens as the awning
  // and the matcha token — no new hues.
  const park = new THREE.Group(); scene.add(park);
  const grassTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const pg = c.getContext('2d');
    pg.fillStyle = '#86a860'; pg.fillRect(0, 0, 256, 256);
    pg.fillStyle = '#2f4f43';
    for (let i = 0; i < 640; i++) pg.fillRect((i * 47) % 256, (i * 89) % 256, 2 + (i % 3), 2 + (i % 2));
    pg.fillStyle = 'rgba(246,239,224,.22)';
    for (let i = 0; i < 180; i++) pg.fillRect((i * 113) % 256, (i * 61) % 256, 1, 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 18); t.anisotropy = 8;
    return t;
  })();
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.97, metalness: 0, transparent: true });
  // Same plane as before. Its far side fades out so the haze has no silhouette
  // to stop on: a fog-coloured edge against the sky is the hard band. Local +Y
  // points back toward the shops after the ground rotation; local -Y is the
  // far edge. The near half, under the trees, stays solid.
  grassMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLawnFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLawnFade = smoothstep(-42.0, 8.0, position.y);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLawnFade;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n\tgl_FragColor.a *= vLawnFade;');
  };
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(96, 90), grassMat);
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.04, 63.95); lawn.receiveShadow = true; park.add(lawn);
  const moundMat = mat(PAL.matcha, { rough: 0.96 });
  const shrubMat = mat(PAL.awning, { rough: 0.95 });
  function mound(x, z, sx, sy, sz) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), moundMat);
    m.scale.set(sx, sy, sz); m.position.set(x, sy * 0.28, z);
    m.receiveShadow = true; park.add(m);
  }
  // Behind the facade blocks (their backs reach z ≈ 23), not through them.
  [-28, -20, -12, -4, 4, 12, 20, 28].forEach((x, i) => mound(x, 26.0 + (i % 2) * 0.7, 5.4, 0.52 + (i % 3) * 0.08, 2.6));
  function parkTree(x, z, h, lean) {
    cyl(park, 0.07, 0.11, h * 0.5, PAL.walnut, x, h * 0.25, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.36, 9, 7), shrubMat);
    crown.position.set(x, h * 0.58, z); crown.castShadow = true; park.add(crown);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(h * 0.24, 8, 6), moundMat);
    puff.position.set(x + 0.28 * lean, h * 0.86, z - 0.1); puff.castShadow = true; park.add(puff);
  }
  for (const [x, z, h, lean] of [
    [-27, 28.4, 4.4, -1], [-22, 31.2, 5.6, 1], [-17.2, 27.5, 3.9, -1],
    [-12.4, 30.8, 6.1, 1], [-7.2, 27.9, 4.6, -1], [-2.2, 31.5, 5.5, 1],
    [2.8, 27.7, 4.2, -1], [7.6, 31.0, 5.9, 1], [12.4, 28.1, 4.5, -1],
    [17.2, 31.3, 6.0, 1], [22.2, 28.3, 4.3, -1], [27, 30.6, 5.3, 1],
  ]) parkTree(x, z, h, lean);
  for (const [x, z, r] of [
    [-24.5, 25.1, 0.85], [-15, 24.3, 0.7], [-9.5, 25.5, 0.95], [-4.6, 24.5, 0.65],
    [0.4, 25.3, 0.8], [5.2, 24.4, 0.72], [10, 25.4, 0.9], [15.4, 24.5, 0.75],
    [20.5, 25.2, 0.85], [25.5, 24.3, 0.62],
  ]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), shrubMat);
    s.position.set(x, r * 0.72, z); s.castShadow = true; park.add(s);
  }


  // ---- the commodity ticker: the floorplan is the chart, Extended ------------
  // curb + bollards along the pavement edge — micro detail that sells scale
  for (const x of [-13, -9, -5, -1, 3, 7, 11]) {
    cyl(scene, 0.06, 0.06, 0.42, 0x22262a, x, 0.21, 5.55, { metal: 0.35, cast: false });
    cyl(scene, 0.045, 0.045, 0.08, 0xc9a227, x, 0.44, 5.55, { metal: 0.45, cast: false });
  }
  // street decal — faint district name at the zebra
  const decalTex = (() => { const [dc, dg] = [document.createElement('canvas'), null]; dc.width = 512; dc.height = 64;
    const gg = dc.getContext('2d'); gg.fillStyle = 'rgba(0,0,0,0)'; gg.clearRect(0, 0, 512, 64);
    gg.fillStyle = 'rgba(232,220,170,.18)'; gg.font = '700 22px ui-monospace, monospace'; gg.textAlign = 'center'; gg.fillText('—  THE DISTRICT  —', 256, 38); gg.fillStyle = 'rgba(232,220,170,.08)'; gg.fillRect(0, 48, 512, 1);
    const tt = new THREE.CanvasTexture(dc); tt.colorSpace = THREE.SRGBColorSpace; return tt; })();
  const decalMat = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, opacity: 0.9, roughness: 0.98, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.52), decalMat); decal.rotation.x = -Math.PI / 2; decal.position.set(LAYOUT.crossX, 0.031, 13.4); scene.add(decal);

  W.ticker = (function () {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    W.tickerMat = new THREE.MeshStandardMaterial({ emissive: 0x141822, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.04 });
    const post = new THREE.Group(); post.position.set(13.6, 0, 6.2); scene.add(post);
    cyl(post, 0.07, 0.09, 2.4, 0x22262a, 0, 1.2, 0, { metal: 0.5 });
    // brass collar at top of post
    cyl(post, 0.10, 0.10, 0.04, 0xc9a227, 0, 2.36, 0, { metal: 0.55, cast: false });
    plane(post, 2.1, 1.45, W.tickerMat, 0, 2.60, 0, { ry: -0.6 });
    box(post, 2.1, 1.47, 0.12, 0x111418, 0, 2.60, 0.05, { cast: false });
    // brass screws on ticker frame
    for (const sx of [-0.92, 0.92]) for (const sy of [-0.62, 0.62]) {
      const scr = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(0xc9a227, { metal: 0.5, cast: false }));
      scr.position.set(sx, 2.60 + sy, 0.12); post.add(scr);
    }
    const draw = (s) => {
      const g = c.getContext('2d'); g.clearRect(0, 0, 512, 320);
      g.fillStyle = '#0c0f14'; g.fillRect(0, 0, 512, 320);
      // linen grain
      g.fillStyle = 'rgba(255,255,255,.015)'; for (let i = 0; i < 900; i++) g.fillRect(Math.random() * 512, Math.random() * 320, 1, 1);
      // bias highlight — when Linkup tilts the deck, the market board glows
      if (s.bias && s.bias !== 1) {
        const col = s.bias > 1 ? 'rgba(208,96,59,.18)' : 'rgba(134,168,96,.14)';
        g.fillStyle = col; g.fillRect(8, 8, 496, 304);
      }
      g.strokeStyle = '#c9a227'; g.lineWidth = 3.5; g.strokeRect(8, 8, 496, 304);
      g.strokeStyle = 'rgba(201,162,39,.28)'; g.lineWidth = 1; g.strokeRect(12, 12, 488, 296);
      g.fillStyle = '#c9a227'; g.font = '600 24px Georgia, serif'; g.textAlign = 'center'; g.fillText('ROASTER\u2019S  TICKER', 256, 46);
      g.fillStyle = 'rgba(201,162,39,.45)'; g.font = '10px ui-monospace, monospace'; g.letterSpacing = '0.2em'; g.fillText('—  THE DISTRICT  —', 256, 62);
      const up = s.index >= (s.prev ?? s.index);
      const row = (label, val, col, y) => {
        g.fillStyle = '#9a9486'; g.font = '13px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(label, 28, y);
        g.fillStyle = 'rgba(201,162,39,.18)'; g.fillRect(28, y + 6, 456, 1);
        g.fillStyle = col || '#efe6d3'; g.font = '700 24px ui-monospace, monospace'; g.textAlign = 'right'; g.fillText(val, 484, y);
      };
      const arrow = up ? '\u25B2' : '\u25BC';
      const beanCol = s.bias && s.bias > 1 ? '#ff9a7a' : s.bias && s.bias < 1 ? '#9ad89a' : (up ? '#9ad89a' : '#e07a7a');
      row('BEAN  ' + arrow + (s.bias ? ' \u00b7 WIRE' : ''), '\u00a3' + s.cost.toFixed(2) + '/cup', beanCol, 108);
      row('LOCKED', s.locked != null ? '\u00a3' + s.locked.toFixed(2) + '/cup' : '\u2014', s.locked != null ? '#7fb3b0' : '#6a6460', 158);
      row('MARGIN', '\u00a3' + s.margin.toFixed(2) + '/cup', '#e8c46a', 208);
      // 5-day sparkline — the bean index history the ticker board actually tracks
      const hist = s.history;
      if (hist && hist.length > 1) {
        const x0 = 28, w = 456, y0 = 228, h = 34;
        const n = hist.length;
        const vals = hist.slice(-13);
        const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
        const span = Math.max(0.08, hi - lo);
        // track
        g.fillStyle = 'rgba(239,230,211,.06)'; g.fillRect(x0, y0, w, h);
        g.strokeStyle = 'rgba(201,162,39,.18)'; g.lineWidth = 0.8; g.strokeRect(x0, y0, w, h);
        // line
        g.strokeStyle = up ? '#9ad89a' : '#e07a7a'; g.lineWidth = 1.6; g.beginPath();
        vals.forEach((v, i) => {
          const x = x0 + (i / Math.max(1, vals.length - 1)) * w;
          const y = y0 + h - ((v - lo) / span) * h;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.stroke();
        // dots
        vals.forEach((v, i) => {
          const x = x0 + (i / Math.max(1, vals.length - 1)) * w;
          const y = y0 + h - ((v - lo) / span) * h;
          g.fillStyle = i === vals.length - 1 ? '#efe6d3' : 'rgba(239,230,211,.55)';
          g.beginPath(); g.arc(x, y, i === vals.length - 1 ? 2.2 : 1.2, 0, Math.PI * 2); g.fill();
        });
        g.fillStyle = 'rgba(239,230,211,.45)'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(vals[0].toFixed(2), x0 + 2, y0 + 9);
        g.textAlign = 'right'; g.fillText(vals[vals.length - 1].toFixed(2), x0 + w - 2, y0 + 9);
      }
      g.fillStyle = 'rgba(239,230,211,.72)'; g.font = '13px ui-monospace, monospace'; g.textAlign = 'center';
      g.fillText('DAY ' + s.day + '/' + s.total + '   \u00b7   REP ' + s.rep + (s.bias ? '   \u00b7   \u25B2 WIRE' : ''), 256, s.history && s.history.length > 1 ? 282 : 268);
      if (s.bias) {
        g.fillStyle = 'rgba(201,162,39,.62)'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center';
        g.fillText('tap the wire for sources', 256, s.history && s.history.length > 1 ? 294 : 282);
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      W.tickerMat.map = t; W.tickerMat.emissiveMap = t; W.tickerMat.needsUpdate = true;
    };
    return { draw };
  })();

  // ---- the mailbox: the Roaster's Letter lives here ---------------------------
  W.mailFlag = null;
  (function () {
    const mb = new THREE.Group(); mb.position.set(-10.4, 0, 6.4); scene.add(mb);
    cyl(mb, 0.07, 0.09, 1.6, 0x22262a, 0, 0.8, 0, { metal: 0.4 });
    box(mb, 0.5, 0.6, 0.36, 0x7a2020, 0, 1.75, 0, { rough: 0.7 });
    box(mb, 0.5, 0.06, 0.36, 0x5a1616, 0, 2.06, 0, { cast: false });
    box(mb, 0.16, 0.04, 0.22, 0x2a1010, 0, 1.55, 0.19, { cast: false });
    const flag = box(mb, 0.03, 0.14, 0.16, 0xd0403a, 0.28, 1.7, 0, { em: 0x802018, emi: 0.4, cast: false });
    flag.rotation.z = -Math.PI / 2.4;   // down by day
    W.mailFlag = flag; W.mailDown = -Math.PI / 2.4; W.mailUp = -Math.PI / 7;
  })();
  W.setMail = (up) => { W.mailFlag.rotation.z = up ? W.mailUp : W.mailDown; };

  // ---- weather: low mist that thickens after a frost + warm dust motes -----
  // Points without a mask are hardware squares. The home camera sits near
  // z≈19, so a point spawned up there size-attenuates into a big grey quad
  // and the orbit makes it look like it is drifting over the roofs. Masks
  // clip the quad to a disc (or a streak), and the volumes stay on the
  // street, under the camera. Hidden until a weather call asks for them.
  const puff = quietRandom(() => softSprite());
  const rainStreak = quietRandom(() => streakSprite());
  const puffMat = (color, size, extra = {}) => new THREE.PointsMaterial({
    color, size, map: puff, alphaMap: puff, alphaTest: 0.05,
    transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true,
    ...extra,
  });
  W.mistMat = puffMat(0x9a9ea6, 0.42);
  const mistN = 120, mp = new Float32Array(mistN * 3);
  for (let i = 0; i < mistN; i++) { mp[i*3] = -14 + Math.random()*34; mp[i*3+1] = 0.25 + Math.random()*1.2; mp[i*3+2] = 5.5 + Math.random()*8; }
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  W.mist = new THREE.Points(mistGeo, W.mistMat); W.mist.visible = false; scene.add(W.mist);
  W.setMist = (a) => { const o = Math.max(0, a) * 0.42; W.mistMat.opacity = o; W.mist.visible = o > 0.01; };
  // dust motes — warm, slow, only visible in shafts
  W.moteMat = puffMat(0xffe9a0, 0.065, { blending: THREE.AdditiveBlending });
  const moteN = 180, moteP = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) { moteP[i*3] = -10 + Math.random()*20; moteP[i*3+1] = 0.6 + Math.random()*3.2; moteP[i*3+2] = -2 + Math.random()*10; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  W.motes = new THREE.Points(moteGeo, W.moteMat); W.motes.visible = false; scene.add(W.motes);
  W._motePhase = 0;
  W._moteTarget = 0;
  W.setMotes = (a) => { W._moteTarget = Math.max(0, Math.min(0.42, a * 0.95)); };
  // Phase 5 — rain: one Points layer over the street, ink-grey streaks.
  // setRain(a) drives opacity; prepareDay branches on the rain event.
  W.rainMat = new THREE.PointsMaterial({
    color: 0x8a9aa8, size: 0.28, map: rainStreak, alphaMap: rainStreak, alphaTest: 0.05,
    transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true,
  });
  const rainN = 220, rainP = new Float32Array(rainN * 3);
  for (let i = 0; i < rainN; i++) { rainP[i*3] = -14 + Math.random()*34; rainP[i*3+1] = 0.4 + Math.random()*4.6; rainP[i*3+2] = -4 + Math.random()*14; }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3));
  W.rain = new THREE.Points(rainGeo, W.rainMat); W.rain.visible = false; scene.add(W.rain);
  W._rainTarget = 0;
  W.setRain = (a) => { W._rainTarget = Math.max(0, Math.min(1, a)); };


  // ---- sky extras -------------------------------------------------------------
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(140 * 3);
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2, r = 70;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  W.starMat = new THREE.PointsMaterial({
    color: 0xdfe6ff, size: 1.6, map: puff, alphaMap: puff, alphaTest: 0.05,
    transparent: true, opacity: 0, sizeAttenuation: false, fog: false,
  });
  W.stars = new THREE.Points(starGeo, W.starMat); W.stars.visible = false; scene.add(W.stars);
  W.moonMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ff, emissive: 0xcdd8f8, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), W.moonMat); moon.position.set(-20, 17, -10); scene.add(moon);


  // Rival heat: how busy GLASSHOUSE looks. main.js feeds the rival queue
  // length every HUD update; the sign burns brighter as their line grows —
  // winning, visibly, when your regulars cross the road. The ribbon is the
  // zebra itself lighting up, so the walk-over reads even when the line is
  // already standing at the door.
  W._rivalHeat = 0;
  W.setRivalHeat = (n) => { W._rivalHeat = Math.max(0, n || 0); };
  quietRandom(() => {
    // Normal alpha, not additive: the zebra is already near-white, so adding
    // light just clips to white and the wash disappears.
    W.rivalHeatMat = new THREE.MeshBasicMaterial({
      color: 0xd4481a, transparent: true, opacity: 0, depthWrite: false, fog: false,
      side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    // Sit on the zebra stripes (centred z 11.7), just above the paint.
    const heatRibbon = new THREE.Mesh(
      new THREE.PlaneGeometry(3.15, 3.6),
      W.rivalHeatMat,
    );
    heatRibbon.rotation.x = -Math.PI / 2;
    heatRibbon.position.set(LAYOUT.crossX + 0.2, 0.055, 11.7);
    heatRibbon.renderOrder = 3;
    heatRibbon.frustumCulled = false;
    scene.add(heatRibbon);
  });
  W.setLite = (enabled) => { W.lite = enabled; for (const wl of W.windowLights) wl.visible = !enabled; };
  const _setLiteShell = W.setLite;
  W.setLite = (enabled) => { _setLiteShell(enabled); cutaways.applyLite(enabled); };

  // ---- time-of-day director ---------------------------------------------------
  // t = minutes since midnight. Light tells the story of the day.
  const K = [
    { t: 360,  elev: 5,  azim: 15,  sun: 0x8fa3c8, sunI: 0.22, hemiI: 0.28, sky: 0x26304d, fog: PAL.cream, pend: 1.0,  street: 1 },
    { t: 410,  elev: 10, azim: 22,  sun: 0xffc27d, sunI: 1.05, hemiI: 0.42, sky: 0xd9a06b, fog: PAL.cream, pend: 0.85, street: 0.5 },
    { t: 500,  elev: 26, azim: 45,  sun: 0xffe9c4, sunI: 1.25, hemiI: 0.55, sky: 0xbcd3e0, fog: PAL.paper, pend: 0.4,  street: 0 },
    { t: 720,  elev: 55, azim: 90,  sun: 0xfff4e0, sunI: 1.35, hemiI: 0.65, sky: 0xcfe2ea, fog: PAL.paper, pend: 0.25, street: 0 },
    { t: 960,  elev: 40, azim: 125, sun: 0xffedc8, sunI: 1.2,  hemiI: 0.6,  sky: 0xcfdde4, fog: PAL.paper, pend: 0.3,  street: 0 },
    { t: 1080, elev: 16, azim: 155, sun: 0xffb45e, sunI: 1.0,  hemiI: 0.5,  sky: 0xe0b07a, fog: PAL.brass, pend: 0.55, street: 0.25 },
    { t: 1150, elev: 5,  azim: 168, sun: 0xff8a52, sunI: 0.45, hemiI: 0.38, sky: 0x7a6a8a, fog: PAL.brass, pend: 0.95, street: 0.85 },
    { t: 1210, elev: 1,  azim: 175, sun: 0x8a9cc8, sunI: 0.15, hemiI: 0.3,  sky: 0x2e3a5c, fog: PAL.brass, pend: 1.1,  street: 1 },
    { t: 1260, elev: -5, azim: 180, sun: 0x7788bb, sunI: 0.08, hemiI: 0.26, sky: 0x1c2440, fog: PAL.brass, pend: 1.15, street: 1 },
  ].map(k => ({ ...k, sunC: new THREE.Color(k.sun), skyC: new THREE.Color(k.sky), fogC: new THREE.Color(k.fog) }));

  // delight updaters called from main loop (till slide with shadow stretch)
  W._tillShadow = null;
  // tiny shadow plane under the drawer — stretches when drawer is out
  W._tillShadowMat = new THREE.MeshBasicMaterial({ color: 0x171310, transparent: true, opacity: 0, depthWrite: false });
  W._tillShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), W._tillShadowMat);
  W._tillShadow.rotation.x = -Math.PI / 2; W._tillShadow.position.set(LAYOUT.register.x, 0.02, -5.05);
  scene.add(W._tillShadow);
  W._updateDelight = (now, dt) => {
    const d = typeof dt === 'number' && isFinite(dt) ? dt : 0.016;
    if (W._shopSils) {
      const swayT = now * 0.001;
      for (let i = 0; i < W._shopSils.length; i++) {
        const fig = W._shopSils[i];
        fig.position.x = fig.userData.homeX + Math.sin(swayT * 0.6 + i * 1.4) * 0.035;
      }
    }
    // chalkboard strike — same clock as the till. Peaks on the press,
    // wobbles home, and is back at rest inside CHALK_HIT_MS.
    if (W._chalkT0 && W.menuMat) {
      if (W._chalkT0 < 0) W._chalkT0 = now;
      const u = (now - W._chalkT0) / CHALK_HIT_MS;
      if (u >= 1) {
        W._chalkT0 = 0;
        W.menuMat.emissiveIntensity = 0;
        if (W._chalkRough != null) W.menuMat.roughness = W._chalkRough;
      } else {
        W.menuMat.emissiveIntensity = u < 0.72 ? 0.55 : 0.55 * (1 - (u - 0.72) / 0.28);
      }
    }
    // a little steam off the kettle — sine, never a constant rise
    for (let i = 0; i < kettleWisps.length; i++) {
      const s = kettleWisps[i];
      const phase = ((now * 0.00032) + i * 0.34) % 1;
      s.position.set(
        wispHome.x + Math.sin(now * 0.0014 + i * 1.7) * 0.02 * phase,
        wispHome.y + phase * 0.36,
        wispHome.z + Math.cos(now * 0.0011 + i) * 0.016 * phase,
      );
      s.material.opacity = 0.32 + (1 - phase) * (1 - phase) * 0.48;
      const sc = 0.16 + phase * 0.2;
      s.scale.set(sc, sc * 1.4, 1);
    }
    // motes drift + fade toward target (driven by godRay/weather)
    if (W.moteMat) {
      W.moteMat.opacity += (W._moteTarget - W.moteMat.opacity) * Math.min(1, d * 1.2);
      if (W.motes) W.motes.visible = W.moteMat.opacity > 0.008;
      if (W.moteMat.opacity > 0.008 && W.motes && W.motes.geometry) {
        W._motePhase += d * 0.18;
        const attr = W.motes.geometry.attributes.position;
        const arr = attr.array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += Math.sin(W._motePhase + i * 0.08) * d * 0.04;
          if (arr[i + 1] > 4.2) arr[i + 1] -= 3.6;
          if (arr[i + 1] < 0.4) arr[i + 1] += 3.6;
        }
        attr.needsUpdate = true;
      }
    }
    // Phase 5 — rain falls toward target, streaks recycle top-down.
    if (W.rainMat) {
      W.rainMat.opacity += ((W._rainTarget * 0.55) - W.rainMat.opacity) * Math.min(1, d * 1.5);
      if (W.rain) W.rain.visible = W.rainMat.opacity > 0.01;
      if (W.rainMat.opacity > 0.01 && W.rain && W.rain.geometry) {
        const attr = W.rain.geometry.attributes.position;
        const arr = attr.array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= d * (5 + (i % 5));
          if (arr[i + 1] < 0) arr[i + 1] += 6;
        }
        attr.needsUpdate = true;
      }
    }
    if (doorSteam.length) {
      const sec = now * 0.001;
      for (const p of doorSteam) {
        const u = (p.phase + sec * 0.07) % 1;
        const curl = Math.sin(u * Math.PI * 2 + p.phase * 6.2) * 0.38;
        // born inside the room, brightest as it crosses the door, then thins out
        p.sp.position.set(-5.05 + curl, 1.35 + u * 0.85, 4.35 + u * 2.85);
        p.sp.scale.setScalar(0.85 + u * 1.25);
        const approach = Math.min(1, u / 0.22);
        const leave = u < 0.8 ? 1 : Math.max(0, 1 - (u - 0.8) / 0.2);
        p.sm.opacity = 0.16 + approach * leave * 0.7;
      }
    }
    if (W.tillDrawer) {
      const opening = now < W.tillDrawerOpenUntil;
      const targetZ = opening ? W.tillDrawerBaseZ + 0.38 : W.tillDrawerBaseZ;
      W.tillDrawer.position.z += (targetZ - W.tillDrawer.position.z) * 0.22;
      // shadow stretches with the drawer — mass
      const openFrac = Math.abs(W.tillDrawer.position.z - W.tillDrawerBaseZ) / 0.38;
      W._tillShadow.scale.set(1 + openFrac * 0.35, 1, 1);
      W._tillShadowMat.opacity = openFrac * 0.18;
    }
    if (W.rivalSignMat && W.rivalJeerUntil) {
      if (now < W.rivalJeerUntil) {
        const pulse = 0.5 + Math.sin(now * 0.012) * 0.35;
        W.rivalSignMat.emissiveIntensity = W.rivalJeerBaseEmi + 0.9 + pulse * 0.4;
      }
    }
  };
  W.updateTimeOfDay = function (t) {
    let i = 0;
    while (i < K.length - 2 && K[i + 1].t <= t) i++;
    const a = K[i], b = K[i + 1];
    let f = THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
    f = f * f * (3 - 2 * f);
    const L = (x, y) => x + (y - x) * f;
    const elev = THREE.MathUtils.degToRad(L(a.elev, b.elev)), azim = THREE.MathUtils.degToRad(L(a.azim, b.azim));
    sun.position.set(Math.cos(azim) * 28, Math.max(1.5, Math.sin(elev) * 32), 8 + Math.sin(azim) * 4);
    sun.color.lerpColors(a.sunC, b.sunC, f); sun.intensity = L(a.sunI, b.sunI);
    hemi.intensity = L(a.hemiI, b.hemiI);
    if (!W.useSky && scene.background) scene.background.lerpColors(a.skyC, b.skyC, f); // the shader sky owns the backdrop otherwise
    scene.fog.color.lerpColors(a.fogC, b.fogC, f);
    const pend = L(a.pend, b.pend), street = L(a.street, b.street);
    for (const p of pendants) p.intensity = 6 * pend;
    for (const bm of W.bulbMats) bm.emissiveIntensity = 0.25 + pend * 1.5;
    for (const lm of W.lampMats) lm.emissiveIntensity = street * 2.4;
    for (const sm of W.lampGlows) sm.opacity = street * 0.5;
    for (const ll of W.lampLights) ll.intensity = street * 12;
    // pools track the lamps: full at open and close, gone when street is 0 (midday)
    for (const pm of W.lampPoolMats) pm.opacity = street * 0.62;
    W.signMat.emissiveIntensity = 0.25 + street * 0.9;
    W.rivalSignMat.emissiveIntensity = 0.2 + street * 1.1 + Math.min(0.6, W._rivalHeat * 0.05);
    // Their glass follows the streetlights: pale reflective panes by day,
    // lamplit amber after dark. The silhouettes read against both.
    rvWinMat.color.lerpColors(RV_DAY, RV_NIGHT, THREE.MathUtils.clamp(street, 0.12, 1));
    // Noon panes are pale. Pull them toward the night amber while Glasshouse
    // has a queue, so the shop reads warm from across the road.
    const heatGlow = Math.min(0.48, (W._rivalHeat || 0) * 0.06);
    if (heatGlow > 0) rvWinMat.color.lerp(RV_NIGHT, heatGlow);
    const night = THREE.MathUtils.clamp((t - 1150) / 80, 0, 1);
    const duskish = THREE.MathUtils.clamp(1 - Math.abs((t - 720) / 480), 0, 1) * 0.4; // a little window-glow at golden hour too
    if (!W.useSky) {
      W.starMat.opacity = night * 0.9;
      if (W.stars) W.stars.visible = W.starMat.opacity > 0.02;
      W.moonMat.opacity = night; W.moonMat.emissiveIntensity = night * 0.9;
    }
    // Warm enough to read as lit glass after dark, dim enough that the
    // books and tins in front of it stay separate from the glow.
    for (const wm of W.winMats) wm.emissiveIntensity = Math.max(night * 0.42, duskish * 0.55);
    for (const wl of W.windowLights) wl.intensity = 0.18 * Math.max(night, duskish);
    W.night = night;
    try { W._updateDelight(performance.now()); } catch {}
  };
  W.updateTimeOfDay(360);

  // ---- anchors ----------------------------------------------------------------
  W.focus = {
    counter: new THREE.Vector3(-5.2, 1.2, -4.2),
    tables: new THREE.Vector3(-2.8, 1, 1.1),
    wide: new THREE.Vector3(0, 1, 3),
    rival: new THREE.Vector3(LAYOUT.rival.x, 1.6, LAYOUT.rival.z - 1),
    newbuild: new THREE.Vector3(8, 2.2, 16),   // the sold storefronts, day-5 finale
    board: new THREE.Vector3(-5.5, 2.2, -6.2), // the chalkboard menu
    case: new THREE.Vector3(-4.3, 1.35, -4.8), // pastry case, customer side
    ticker: new THREE.Vector3(13.6, 2.4, 6.2), // the morning wire on the street
  };
  applyDistrictFogTree(scene);
  // All Kenney GLB placements are queued above; W.ready resolves once they
  // are all in the scene. main.js awaits W.ready before enabling the title
  // button so the user never sees a half-loaded floor.
  W.ready = Promise.all(pending).then(() => W, (err) => { console.warn('world GLB load failed', err); return W; });
  return W;
}

