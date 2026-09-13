// The District — a dollhouse diorama. All primitives + canvas textures, no assets.
import * as THREE from '../vendor/three.module.js';
import { PAL, LAYOUT, COPY } from './config.js';
import { woodFloor, pavement, road, awning, menuBoard, softSprite, shopSign, rentSign, stateForDay, tarp, dayHasConstruction } from './textures.js';
import { GLBLoader } from './loader.js';

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
function plane(parent, w, h, material, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.receiveShadow = o.recv ?? true; m.castShadow = o.cast ?? false;
  parent.add(m); return m;
}

export function buildWorld(scene, renderer, lite) {
  const W = { lite };
  const glb = GLBLoader();
  const pending = [];                       // async GLB placements, awaited by W.ready
  // Place a Kenney GLB: kick off the load, attach the resolved Group to
  // `parent` at the given transform. Returns the promise for chaining.
  function place(parent, url, opts = {}) {
    const p = glb.loadGLB(url, opts).then((g) => { parent.add(g); return g; });
    pending.push(p);
    return p;
  }
  W._glbLoader = glb;                       // exposed for tests / disposal
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.background = new THREE.Color(0x26304d);
  scene.fog = new THREE.Fog(0x1f2740, 32, 92);

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
  for (const px of [-8.5, -6, -3.5]) {
    const p = new THREE.PointLight(0xffd2a0, 7, 10, 2); p.position.set(px, 2.15, -5.2); scene.add(p); pendants.push(p);
  }
  const tableLight = new THREE.PointLight(0xffd2a0, 5, 10, 2); tableLight.position.set(6, 2.4, 1.4); scene.add(tableLight); pendants.push(tableLight);
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
  plane(g, 44, 2.6, paveMat, 0, 0.02, 15.2, { rx: -Math.PI / 2 });
  const roadTex = road();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0.02 });
  plane(g, 44, LAYOUT.roadZ1 - LAYOUT.roadZ0, roadMat, 0, 0.015, (LAYOUT.roadZ0 + LAYOUT.roadZ1) / 2, { rx: -Math.PI / 2 });
  for (let i = 0; i < 5; i++) box(g, 0.62, 0.03, 3.4, 0xd8d2c0, LAYOUT.crossX - 1 + i * 0.60, 0.03, 11.7, { cast: false, op: 0.88 }); // zebra crossing — slightly wider + decal-friendly

  // ---- café shell ---------------------------------------------------------
  const cafe = new THREE.Group(); scene.add(cafe);
  box(cafe, 24, 4.4, 0.4, PAL.plaster, 0, 2.2, -8.2, { cast: false });            // back wall
  box(cafe, 0.4, 4.4, 14.4, PAL.plaster, -12.2, 2.2, -1, { cast: false });        // left wall
  box(cafe, 0.3, 1.15, 14.4, PAL.wainscot, 12.1, 0.57, -1, { cast: false });      // right half-wall (cutaway)
  box(cafe, 24, 0.9, 0.5, PAL.wainscot, 0, 0.45, -8.05, { cast: false });         // back wainscot
  box(cafe, 0.5, 0.9, 14.4, PAL.wainscot, -12.05, 0.45, -1, { cast: false });
  // front: pillars + fascia beam + sign + awning (dollhouse — no front wall)
  for (const px of [-11.6, -7, -3, 11.6]) box(cafe, 0.42, 3.6, 0.42, PAL.walnutDark, px, 1.8, 6);
  box(cafe, 24, 0.7, 0.5, PAL.walnutDark, 0, 3.75, 6, { cast: false });
  const signTex = shopSign('G R U N D S');
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffc98a, emissiveMap: signTex, emissiveIntensity: 0.4, roughness: 0.8 });
  plane(cafe, 6.4, 1.2, signMat, 0, 4.6, 6.42); box(cafe, 6.6, 1.35, 0.18, PAL.walnutDark, 0, 4.6, 6.32, { cast: false });
  const awnTex = awning();
  const awnMat = new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.88, metalness: 0.01, side: THREE.DoubleSide });
  plane(cafe, 13, 2.6, awnMat, -2, 3.15, 7.1, { rx: -Math.PI / 2 + 0.32 });
  // awning tie-downs — tiny brass dots where the awning meets the fascia
  for (const px of [-6.8, -3.9, -1.0, 1.8]) {
    const td = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat(0xc9a227, { metal: 0.6, rough: 0.35, cast: false }));
    td.position.set(px, 3.52, 6.18); cafe.add(td);
  }
  W.signMat = signMat;

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
  // The bar is 9 m wide (C.w); the GLB is roughly 1 m in the kit. We scale
  // it to match the bar width; the procedural walnut shell above keeps
  // the bar visually continuous even if the GLB is a few cm short.
  place(bar, 'kitchenBar.glb', { position: [C.x, 1.05, C.z], scale: 9, rotationY: 0 });
  // Kenney kitchenCoffeeMachine.glb replaces the procedural espresso machine.
  place(bar, 'kitchenCoffeeMachine.glb', { position: [-8.3, 1.05, -5.5], scale: 1.6, rotationY: 0 });
  // grinder hopper + body (procedural; no matching Kenney GLB)
  cyl(bar, 0.16, 0.2, 0.5, 0x8a4f2e, -9.5, 1.35, -5.5, { rough: 0.5 });            // grinder hopper
  box(bar, 0.4, 0.5, 0.4, 0x3a3d40, -9.5, 1.28, -5.5, { metal: 0.5, rough: 0.5 });
  // 3 bar stools at the customer-side of the bar (Kenney stoolBar.glb)
  for (const dx of [-3, 0, 3]) {
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


  // ---- menu board + back bar ----------------------------------------------
  const board = menuBoard();
  W.menuTexture = board.draw('4.80', false);
  W.menuMat = new THREE.MeshStandardMaterial({ map: W.menuTexture, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 });
  W.setMatchaPrice = (p, struck) => { board.draw(p, struck); W.menuTexture.needsUpdate = true; };
  W.flashChalk = (kind) => {
    if (!W.menuMat) return;
    const flashCol = kind === 'reprice' ? 0xc9a227 : 0x86a860;
    W.menuMat.emissive.setHex(flashCol);
    W.menuMat.emissiveIntensity = 0.55;
    // desaturate briefly so the flash reads as chalk, not just glow
    const prevRough = W.menuMat.roughness;
    W.menuMat.roughness = 0.45;
    setTimeout(() => { W.menuMat.emissiveIntensity = 0; W.menuMat.roughness = prevRough; }, 650);
    // tiny board wobble via scale pulse
    if (W._chalkPlane) {
      W._chalkPlane.scale.setScalar(1.02);
      setTimeout(() => W._chalkPlane.scale.setScalar(1), 120);
    }
  };
  W._chalkPlane = plane(cafe, 3.6, 2.7, W.menuMat, -5.5, 2.75, -7.95);
  for (const sy of [1.9, 2.5]) {
    box(cafe, 7, 0.07, 0.5, PAL.walnut, -1.2, sy, -7.85, { cast: false });
    for (let i = 0; i < 7; i++) {
      const jx = -4.2 + i * 1.05, jr = ((i * 41 + sy * 13) % 10) / 10;
      if (jr < 0.5) cyl(cafe, 0.11, 0.11, 0.3, [0xc46a4a, 0x8a9a6a, 0xd8c27a, 0x7fb3b0][i % 4], jx, sy + 0.19, -7.85, { cast: false });
      else box(cafe, 0.2, 0.3, 0.14, [0xb59a6a, 0x6a7a8a][i % 2], jx, sy + 0.19, -7.85, { cast: false });
    }
  }
  // pendant lamps over the bar — Kenney lampRoundTable.glb replaces the
  // cord+cone shade; the emissive bulb stays procedural so the time-of-day
  // director (W.bulbMats) can still drive the glow.
  W.bulbMats = [];
  for (const px of [-8.5, -6, -3.5]) {
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
  place(scene, 'sideTable.glb', { position: [9.5, 0, -1], scale: 1.0, rotationY: 0 });
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
  W.lampMats = []; W.lampGlows = [];
  const glowTex = softSprite();
  for (const lx of [-9, 7]) {
    cyl(scene, 0.06, 0.08, 3.6, 0x22262a, lx, 1.8, 9.2, { metal: 0.5 });
    cyl(scene, 0.05, 0.05, 1, 0x22262a, lx, 3.55, 8.9, { rx: Math.PI / 2, cast: false });
    const lm = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lm); lamp.position.set(lx, 3.5, 8.55); scene.add(lamp);
    W.lampMats.push(lm);
    const sm = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(sm); spr.position.set(lx, 3.5, 8.55); spr.scale.setScalar(2.6); scene.add(spr);
    W.lampGlows.push(sm);
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
  for (const px of [-7.8, -2.2]) {
    place(scene, 'pottedPlant.glb', { position: [px, 0, 6.6], scale: 0.6, rotationY: 0 });
  }
  // living plant crown (3 spheres above the right planter at -2.2, 6.6)
  W.plantMats = [];
  W.plantGroup = new THREE.Group(); W.plantGroup.position.set(-2.2, 0.9, 6.6); scene.add(W.plantGroup);
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
    W.catPath = [new THREE.Vector3(L.spawnL.x, 0, L.spawnL.z), new THREE.Vector3(L.door.x, 0, 6.2), new THREE.Vector3(5.6, 0, 4)];
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

  // ---- the rival: GLASSHOUSE across the road --------------------------------
  const rv = new THREE.Group(); rv.position.set(LAYOUT.rival.x, 0, LAYOUT.rival.z); scene.add(rv);
  box(rv, 4.6, 2.5, 2.1, 0xdfe3e2, 0, 1.25, 0, { rough: 0.55 });
  box(rv, 4.8, 0.14, 2.3, PAL.teal, 0, 2.6, 0, { rough: 0.5 });
  box(rv, 4.2, 0.7, 0.5, 0xcfd4d3, 0, 0.95, -1.2, { cast: false });                  // their counter
  const rvSignTex = shopSign(COPY.rivalName, '#e8f0ee', '#27403c', '600 40px Georgia, serif');
  W.rivalSignMat = new THREE.MeshStandardMaterial({ map: rvSignTex, emissive: 0xbfe8e2, emissiveMap: rvSignTex, emissiveIntensity: 0.25, roughness: 0.7 });
  plane(rv, 3.4, 0.64, W.rivalSignMat, 0, 2.05, -1.07, { ry: Math.PI });
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
  };

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

  // ---- the day-5 construction prop: scaffold + tarp on the sold storefront --
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
  W.setConstruction = (day) => {
    const on = dayHasConstruction(day);
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
  W.setConstructionLeft = (day) => {
    const on = dayHasConstruction(day);
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

  // ---- the district: a street of facades + a far skyline ---------------------
  // Lit windows are emissive-map quads that glow at night (time-of-day drives them).
  W.winMats = [];
  function facade(col, wcol) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    // brick base — two-tone bricks + mortar
    g.fillStyle = col; g.fillRect(0, 0, 512, 512);
    const mortar = 'rgba(32,28,26,.55)';
    const brickH = 24, brickW = 64, rows = 20, cols = 8;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (brickW / 2);
      const y = r * (brickH + 2);
      for (let ci = 0; ci < cols; ci++) {
        const x = ci * brickW - off;
        const shade = ((ci * 37 + r * 53) % 20) - 10;
        const rr = parseInt(col.slice(1, 3), 16) + shade, gg = parseInt(col.slice(3, 5), 16) + shade, bb = parseInt(col.slice(5, 7), 16) + shade;
        g.fillStyle = `rgb(${rr},${gg},${bb})`; g.fillRect(x + 1, y + 1, brickW - 3, brickH - 2);
        // brick highlight top edge + shadow bottom
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1, y + 1, brickW - 3, 2);
        g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 1, y + brickH - 2, brickW - 3, 2);
      }
      g.fillStyle = mortar; g.fillRect(0, y + brickH - 2, 512, 2);
    }
    // micro grain over brick
    g.fillStyle = 'rgba(0,0,0,.04)'; for (let i = 0; i < 900; i++) g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    // windows cut into the brick — with white frame + sill shadow
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 512;
    const g2 = c2.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, 512, 512);
    const wCols = 6, wRows = 9, wx0 = 30, wy0 = 28, ww = 52, wh = 36, xg = 68, yg = 52;
    for (let r = 0; r < wRows; r++) for (let ci = 0; ci < wCols; ci++) {
      const x = wx0 + ci * xg, y = wy0 + r * yg;
      const lit = Math.random() < 0.46;
      // window recess shadow
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 2, y + 2, ww + 2, wh + 2);
      // white frame
      g.fillStyle = '#e8e0d0'; g.fillRect(x, y, ww, wh);
      // glass inset
      g.fillStyle = lit ? wcol : 'rgba(22,26,34,.92)'; g.fillRect(x + 3, y + 3, ww - 6, wh - 6);
      // glass specular streak
      if (lit) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 5, y + 5, ww - 24, 4); }
      // sill shadow under window
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - 1, y + wh, ww + 2, 4);
      // emissive map — only lit glass glows
      if (lit) { g2.fillStyle = wcol; g2.fillRect(x + 3, y + 3, ww - 6, wh - 6); }
    }
    // cornice shadow at top
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 512, 10);
    const tF = new THREE.CanvasTexture(c); tF.colorSpace = THREE.SRGBColorSpace; tF.wrapS = tF.wrapT = THREE.RepeatWrapping;
    const tE = new THREE.CanvasTexture(c2); tE.colorSpace = THREE.SRGBColorSpace; tE.wrapS = tE.wrapT = THREE.RepeatWrapping; tE.repeat.copy(tF.repeat);
    const m = new THREE.MeshStandardMaterial({ map: tF, emissive: 0xffd089, emissiveMap: tE, emissiveIntensity: 0, roughness: 0.88, metalness: 0.01 });
    W.winMats.push(m); return m;
  }
  const blocks = [
    { x: -10, z: 19, w: 7, h: 9, d: 6, col: '#54514a', wc: '#ffe7b0' },
    { x: 11, z: 19.5, w: 8, h: 11, d: 6, col: '#4a4e54', wc: '#ffd089' },
    { x: -16, z: 20, w: 6, h: 7, d: 5, col: '#5a4a3a', wc: '#fff0c0' },
    { x: 17, z: 20.5, w: 6, h: 8, d: 5, col: '#494d50', wc: '#ffe0a0' },
  ];
  for (const b of blocks) {
    const m = facade(b.col, b.wc); const rep = 1;
    m.map.repeat.set(1, 1); m.emissiveMap.repeat.set(1, 1);
    box(scene, b.w, b.h, b.d, 0xffffff, b.x, b.h / 2, b.z, { mat: m, cast: true, rough: 0.88 });
    // cornice cap
    box(scene, b.w + 0.3, 0.42, b.d + 0.3, 0x2a2824, b.x, b.h + 0.06, b.z, { cast: false });
    // ground-floor shopfront band — darker, with a thin brass line
    box(scene, b.w + 0.02, 1.4, b.d + 0.06, 0x3a352e, b.x, 0.7, b.z, { cast: false });
    box(scene, b.w + 0.04, 0.04, b.d + 0.08, 0xc9a227, b.x, 1.42, b.z, { cast: false });
  }
  for (let i = 0; i < 9; i++) {        // far skyline — more depth, some windows on
    const x = -26 + i * 6 + (i % 3) * 1.2, h = 13 + ((i * 37) % 13), z = -25 - (i % 3) * 2.5;
    const dcol = i % 2 ? 0x3a3d44 : 0x4a4a52;
    const sm = mat(dcol, { rough: 0.92, metal: 0.02 });
    box(scene, 4.2, h, 4.2, 0xffffff, x, h / 2, z, { mat: sm, cast: false, rough: 0.92 });
    // tiny skyline windows
    if (i % 2 === 0) {
      const wm = new THREE.MeshStandardMaterial({ color: 0xffe7b0, emissive: 0xffd089, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), wm); q.position.set(x, h * 0.55, z + 2.12); q.rotation.y = 0; scene.add(q);
    }
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
      row('BEAN  ' + arrow, '\u00a3' + s.cost.toFixed(2) + '/cup', up ? '#9ad89a' : '#e07a7a', 108);
      row('LOCKED', s.locked != null ? '\u00a3' + s.locked.toFixed(2) + '/cup' : '\u2014', s.locked != null ? '#7fb3b0' : '#6a6460', 158);
      row('MARGIN', '\u00a3' + s.margin.toFixed(2) + '/cup', '#e8c46a', 208);
      g.fillStyle = 'rgba(239,230,211,.72)'; g.font = '13px ui-monospace, monospace'; g.textAlign = 'center';
      g.fillText('DAY ' + s.day + '/' + s.total + '   \u00b7   REP ' + s.rep, 256, 268);
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
  W.mistMat = new THREE.PointsMaterial({ color: 0x9a9ea6, size: 0.5, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: true });
  const mistN = 120, mp = new Float32Array(mistN * 3);
  for (let i = 0; i < mistN; i++) { mp[i*3] = -14 + Math.random()*34; mp[i*3+1] = 0.2 + Math.random()*1.6; mp[i*3+2] = 8 + Math.random()*14; }
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  W.mist = new THREE.Points(mistGeo, W.mistMat); scene.add(W.mist);
  W.setMist = (a) => { W.mistMat.opacity = Math.max(0, a) * 0.42; };
  // dust motes — warm, slow, only visible in shafts
  W.moteMat = new THREE.PointsMaterial({ color: 0xffe9a0, size: 0.065, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: true, blending: THREE.AdditiveBlending });
  const moteN = 180, moteP = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) { moteP[i*3] = -10 + Math.random()*20; moteP[i*3+1] = 0.6 + Math.random()*3.2; moteP[i*3+2] = -2 + Math.random()*10; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  W.motes = new THREE.Points(moteGeo, W.moteMat); scene.add(W.motes);
  W._motePhase = 0;
  W._moteTarget = 0;
  W.setMotes = (a) => { W._moteTarget = Math.max(0, Math.min(0.42, a * 0.95)); };


  // ---- sky extras -------------------------------------------------------------
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(140 * 3);
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2, r = 70;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  W.starMat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.55, transparent: true, opacity: 0, sizeAttenuation: false, fog: false });
  scene.add(new THREE.Points(starGeo, W.starMat));
  W.moonMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ff, emissive: 0xcdd8f8, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), W.moonMat); moon.position.set(-20, 17, -10); scene.add(moon);


  // Rival heat: how busy GLASSHOUSE looks. main.js feeds the rival queue
  // length every HUD update; the sign burns brighter as their line grows —
  // winning, visibly, when your regulars cross the road.
  W._rivalHeat = 0;
  W.setRivalHeat = (n) => { W._rivalHeat = Math.max(0, n || 0); };

  // ---- time-of-day director ---------------------------------------------------
  // t = minutes since midnight. Light tells the story of the day.
  const K = [
    { t: 360,  elev: 5,  azim: 15,  sun: 0x8fa3c8, sunI: 0.22, hemiI: 0.28, sky: 0x26304d, fog: 0x1f2740, pend: 1.0,  street: 1 },
    { t: 410,  elev: 10, azim: 22,  sun: 0xffc27d, sunI: 1.05, hemiI: 0.42, sky: 0xd9a06b, fog: 0xc08e6a, pend: 0.85, street: 0.5 },
    { t: 500,  elev: 26, azim: 45,  sun: 0xffe9c4, sunI: 1.25, hemiI: 0.55, sky: 0xbcd3e0, fog: 0xb6c4cf, pend: 0.4,  street: 0 },
    { t: 720,  elev: 55, azim: 90,  sun: 0xfff4e0, sunI: 1.35, hemiI: 0.65, sky: 0xcfe2ea, fog: 0xc3d2da, pend: 0.25, street: 0 },
    { t: 960,  elev: 40, azim: 125, sun: 0xffedc8, sunI: 1.2,  hemiI: 0.6,  sky: 0xcfdde4, fog: 0xc6cfd4, pend: 0.3,  street: 0 },
    { t: 1080, elev: 16, azim: 155, sun: 0xffb45e, sunI: 1.0,  hemiI: 0.5,  sky: 0xe0b07a, fog: 0xd09e72, pend: 0.55, street: 0.25 },
    { t: 1150, elev: 5,  azim: 168, sun: 0xff8a52, sunI: 0.45, hemiI: 0.38, sky: 0x7a6a8a, fog: 0x5e5470, pend: 0.95, street: 0.85 },
    { t: 1210, elev: 1,  azim: 175, sun: 0x8a9cc8, sunI: 0.15, hemiI: 0.3,  sky: 0x2e3a5c, fog: 0x232c48, pend: 1.1,  street: 1 },
    { t: 1260, elev: -5, azim: 180, sun: 0x7788bb, sunI: 0.08, hemiI: 0.26, sky: 0x1c2440, fog: 0x161d33, pend: 1.15, street: 1 },
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
    // motes drift + fade toward target (driven by godRay/weather)
    if (W.moteMat) {
      W.moteMat.opacity += (W._moteTarget - W.moteMat.opacity) * Math.min(1, d * 1.2);
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
    W.signMat.emissiveIntensity = 0.25 + street * 0.9;
    W.rivalSignMat.emissiveIntensity = 0.2 + street * 1.1 + Math.min(0.6, W._rivalHeat * 0.05);
    // Their glass follows the streetlights: pale reflective panes by day,
    // lamplit amber after dark. The silhouettes read against both.
    rvWinMat.color.lerpColors(RV_DAY, RV_NIGHT, THREE.MathUtils.clamp(street, 0.12, 1));
    const night = THREE.MathUtils.clamp((t - 1150) / 80, 0, 1);
    const duskish = THREE.MathUtils.clamp(1 - Math.abs((t - 720) / 480), 0, 1) * 0.4; // a little window-glow at golden hour too
    if (!W.useSky) { W.starMat.opacity = night * 0.9; W.moonMat.opacity = night; W.moonMat.emissiveIntensity = night * 0.9; }
    for (const wm of W.winMats) wm.emissiveIntensity = Math.max(night * 1.1, duskish); // the district's windows come alive
    W.night = night;
    try { W._updateDelight(performance.now()); } catch {}
  };
  W.updateTimeOfDay(360);

  // ---- anchors ----------------------------------------------------------------
  W.focus = {
    counter: new THREE.Vector3(-6, 1.2, -4.2),
    tables: new THREE.Vector3(6, 1, 1.5),
    wide: new THREE.Vector3(0, 1, 3),
    rival: new THREE.Vector3(LAYOUT.rival.x, 1.6, LAYOUT.rival.z - 1),
    newbuild: new THREE.Vector3(8, 2.2, 16),   // the sold storefronts, day-5 finale
  };
  // All Kenney GLB placements are queued above; W.ready resolves once they
  // are all in the scene. main.js awaits W.ready before enabling the title
  // button so the user never sees a half-loaded floor.
  W.ready = Promise.all(pending).then(() => W, (err) => { console.warn('world GLB load failed', err); return W; });
  return W;
}

