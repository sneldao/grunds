// The District — a dollhouse diorama. All primitives + canvas textures, no assets.
import * as THREE from '../vendor/three.module.js';
import { PAL, LAYOUT, COPY } from './config.js';
import { woodFloor, pavement, road, awning, menuBoard, softSprite, shopSign } from './textures.js';
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
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.background = new THREE.Color(0x26304d);
  scene.fog = new THREE.Fog(0x1f2740, 34, 95);

  // ---- lights -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xbdd0e0, 0x3a2f26, 0.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = !lite;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const pendants = [];
  for (const px of [-8.5, -6, -3.5]) {
    const p = new THREE.PointLight(0xffd9a0, 6, 9, 2); p.position.set(px, 2.15, -5.2); scene.add(p); pendants.push(p);
  }
  const tableLight = new THREE.PointLight(0xffd9a0, 4, 10, 2); tableLight.position.set(6, 2.4, 1.4); scene.add(tableLight); pendants.push(tableLight);
  W.lights = { hemi, sun, pendants };

  // ---- ground block -------------------------------------------------------
  const g = new THREE.Group(); scene.add(g);
  box(g, 44, 1, 34, PAL.curb, 0, -0.52, 4, { cast: false });                       // city block base
  const woodMat = new THREE.MeshStandardMaterial({ map: woodFloor(), roughness: 0.7 });
  plane(g, LAYOUT.floor.w, LAYOUT.floor.d, woodMat, LAYOUT.floor.x, 0.01, LAYOUT.floor.z, { rx: -Math.PI / 2 });
  const paveMat = new THREE.MeshStandardMaterial({ map: pavement(), roughness: 0.95 });
  plane(g, 44, 3.6, paveMat, 0, 0.02, LAYOUT.pavementZ, { rx: -Math.PI / 2 });
  plane(g, 44, 2.6, paveMat, 0, 0.02, 15.2, { rx: -Math.PI / 2 });
  const roadMat = new THREE.MeshStandardMaterial({ map: road(), roughness: 0.95 });
  plane(g, 44, LAYOUT.roadZ1 - LAYOUT.roadZ0, roadMat, 0, 0.015, (LAYOUT.roadZ0 + LAYOUT.roadZ1) / 2, { rx: -Math.PI / 2 });
  for (let i = 0; i < 5; i++) box(g, 0.55, 0.02, 3.4, 0xd8d2c0, LAYOUT.crossX - 1 + i * 0.55, 0.03, 11.7, { cast: false, op: 0.85 }); // zebra crossing

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
  const awnMat = new THREE.MeshStandardMaterial({ map: awning(), roughness: 0.9, side: THREE.DoubleSide });
  plane(cafe, 13, 2.6, awnMat, -2, 3.15, 7.1, { rx: -Math.PI / 2 + 0.32 });
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
  W.setMatchaPrice = (p, struck) => { board.draw(p, struck); W.menuTexture.needsUpdate = true; };
  plane(cafe, 3.6, 2.7, new THREE.MeshStandardMaterial({ map: W.menuTexture, roughness: 0.9 }), -5.5, 2.75, -7.95);
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
    // The cord is part of the GLB; we drop the procedural cord+shade.
    // Scale 0.6 puts the lamp shade roughly at 2.95 m above the bar, matching
    // the previous procedural shade position. raiseToY lifts the GLB's
    // origin to the cord-hang point so it sits where the cord used to.
    place(cafe, 'lampRoundTable.glb', { position: [px, 2.7, -5.2], scale: 0.6, rotationY: 0 });
    const bm = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd9a0, emissiveIntensity: 1.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bm); bulb.position.set(px, 2.9, -5.2); cafe.add(bulb);
    W.bulbMats.push(bm);
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
  for (const px of [-7.8, -2.2]) {
    place(scene, 'pottedPlant.glb', { position: [px, 0, 6.6], scale: 0.6, rotationY: 0 });
  }

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

  // ---- the district: a street of facades + a far skyline ---------------------
  // Lit windows are emissive-map quads that glow at night (time-of-day drives them).
  W.winMats = [];
  function facade(col, wcol) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random()*0.06})`; g.fillRect(Math.random()*256, Math.random()*512, 2, 2); }
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 512;
    const g2 = c2.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, 256, 512);
    const cols = 6, rows = 16;
    for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
      const x = 14 + cI * 38, y = 16 + r * 30, lit = Math.random() < 0.5;
      g.strokeStyle = 'rgba(20,18,14,.5)'; g.strokeRect(x, y, 26, 22);
      if (lit) { g2.fillStyle = wcol; g2.fillRect(x, y, 26, 22); }
    }
    const tF = new THREE.CanvasTexture(c); tF.colorSpace = THREE.SRGBColorSpace; tF.wrapS = tF.wrapT = THREE.RepeatWrapping;
    const tE = new THREE.CanvasTexture(c2); tE.colorSpace = THREE.SRGBColorSpace; tE.wrapS = tE.wrapT = THREE.RepeatWrapping; tE.repeat.copy(tF.repeat);
    const m = new THREE.MeshStandardMaterial({ map: tF, emissive: 0xffd089, emissiveMap: tE, emissiveIntensity: 0, roughness: 0.92 });
    W.winMats.push(m); return m;
  }
  const blocks = [
    { x: -10, z: 19, w: 7, h: 9, d: 6, col: '#54514a', wc: '#ffe7b0' },
    { x: 11, z: 19.5, w: 8, h: 11, d: 6, col: '#4a4e54', wc: '#ffd089' },
    { x: -16, z: 20, w: 6, h: 7, d: 5, col: '#5a4a3a', wc: '#fff0c0' },
    { x: 17, z: 20.5, w: 6, h: 8, d: 5, col: '#494d50', wc: '#ffe0a0' },
  ];
  for (const b of blocks) {
    const m = facade(b.col, b.wc); const rep = Math.max(2, Math.round(b.h / 4));
    m.map.repeat.set(1, rep); m.emissiveMap.repeat.set(1, rep);
    box(scene, b.w, b.h, b.d, 0xffffff, b.x, b.h / 2, b.z, { mat: m, cast: true, rough: 0.95 });
    box(scene, b.w, 0.3, b.d, 0x2a2824, b.x, b.h, b.z, { cast: false });
  }
  for (let i = 0; i < 7; i++) {        // far skyline behind the café for depth
    const x = -22 + i * 7 + (i % 2) * 1.5, h = 14 + ((i * 37) % 12), z = -24 - (i % 3) * 3;
    box(scene, 5, h, 5, 0xffffff, x, h / 2, z, { mat: mat(0x3a3d44, { rough: 0.98 }), cast: false, rough: 0.98 });
  }


  // ---- the commodity ticker: the floorplan is the chart, Extended ------------
  W.ticker = (function () {
    const c = document.createElement('canvas'); c.width = 384; c.height = 256;
    W.tickerMat = new THREE.MeshStandardMaterial({ emissive: 0x141822, emissiveIntensity: 0.85, roughness: 0.55 });
    const post = new THREE.Group(); post.position.set(13.6, 0, 6.2); scene.add(post);
    cyl(post, 0.07, 0.09, 2.4, 0x22262a, 0, 1.2, 0, { metal: 0.5 });
    plane(post, 1.9, 1.28, W.tickerMat, 0, 2.55, 0, { ry: -0.6 });
    box(post, 1.9, 1.3, 0.12, 0x111418, 0, 2.55, 0.05, { cast: false });
    const draw = (s) => {
      const g = c.getContext('2d'); g.clearRect(0, 0, 384, 256);
      g.fillStyle = '#0c0f14'; g.fillRect(0, 0, 384, 256);
      g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.strokeRect(3, 3, 378, 250);
      g.fillStyle = '#c9a227'; g.font = '600 22px Georgia, serif'; g.textAlign = 'center'; g.fillText('ROASTER\u2019S TICKER', 192, 34);
      const up = s.index >= (s.prev ?? s.index);
      const row = (label, val, col, y) => {
        g.fillStyle = '#9a9486'; g.font = '14px ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(label, 22, y);
        g.fillStyle = col || '#efe6d3'; g.font = '700 22px ui-monospace, monospace'; g.textAlign = 'right'; g.fillText(val, 362, y);
      };
      const arrow = up ? '\u25B2' : '\u25BC';
      row('BEAN ' + arrow, '\u00a3' + s.cost.toFixed(2) + '/cup', up ? '#9ad89a' : '#e07a7a', 78);
      row('LOCKED', s.locked != null ? '\u00a3' + s.locked.toFixed(2) + '/cup' : '\u2014', s.locked != null ? '#7fb3b0' : '#5a544a', 122);
      row('MARGIN', '\u00a3' + s.margin.toFixed(2) + '/cup', '#e8c46a', 166);
      g.fillStyle = '#efe6d3'; g.font = '13px ui-monospace, monospace'; g.textAlign = 'center';
      g.fillText('DAY ' + s.day + '/' + s.total + '   \u00b7   REP ' + s.rep, 192, 210);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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

  // ---- weather: low mist that thickens after a frost --------------------------
  W.mistMat = new THREE.PointsMaterial({ color: 0x9a9ea6, size: 0.5, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: true });
  const mistN = 120, mp = new Float32Array(mistN * 3);
  for (let i = 0; i < mistN; i++) { mp[i*3] = -14 + Math.random()*34; mp[i*3+1] = 0.2 + Math.random()*1.6; mp[i*3+2] = 8 + Math.random()*14; }
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  W.mist = new THREE.Points(mistGeo, W.mistMat); scene.add(W.mist);
  W.setMist = (a) => { W.mistMat.opacity = Math.max(0, a) * 0.4; };


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
    W.rivalSignMat.emissiveIntensity = 0.2 + street * 1.1;
    const night = THREE.MathUtils.clamp((t - 1150) / 80, 0, 1);
    const duskish = THREE.MathUtils.clamp(1 - Math.abs((t - 720) / 480), 0, 1) * 0.4; // a little window-glow at golden hour too
    if (!W.useSky) { W.starMat.opacity = night * 0.9; W.moonMat.opacity = night; W.moonMat.emissiveIntensity = night * 0.9; }
    for (const wm of W.winMats) wm.emissiveIntensity = Math.max(night * 1.1, duskish); // the district's windows come alive
    W.night = night;
  };
  W.updateTimeOfDay(360);

  // ---- anchors ----------------------------------------------------------------
  W.focus = {
    counter: new THREE.Vector3(-6, 1.2, -4.2),
    tables: new THREE.Vector3(6, 1, 1.5),
    wide: new THREE.Vector3(0, 1, 3),
    rival: new THREE.Vector3(LAYOUT.rival.x, 1.6, LAYOUT.rival.z - 1),
  };
  // All Kenney GLB placements are queued above; W.ready resolves once they
  // are all in the scene. main.js awaits W.ready before enabling the title
  // button so the user never sees a half-loaded floor.
  W.ready = Promise.all(pending).then(() => W, (err) => { console.warn('world GLB load failed', err); return W; });
  return W;
}

