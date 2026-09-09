// loader.js — small async helper for the vendored GLTFLoader.
//
//   const { loader, loadGLB } = GLBLoader();
//   const bar = await loadGLB('kitchenBar.glb', { scale: 1, position: [x, y, z] });
//   scene.add(bar);
//
// Caches parse results by URL so the same .glb requested N times parses once
// (a 1.5 m table used 3× is one parse + three Group clones). Cache is FIFO-
// evicted at 32 entries to bound memory across long sessions.
//
// Graceful fallback: if the GLTFLoader throws (corrupt file, missing
// texture, network error), returns a placeholder 0.1 m cube so the rest of
// the world still renders. Headless tests opt into a no-GL mode by setting
// `globalThis.__noGLB = true`; the loader returns a placeholder without
// touching any I/O.
//
// Vendored under web/vendor/loaders/GLTFLoader.js (Three.js r160 examples,
// MIT). The food-kit GLBs reference Textures/colormap.png via a relative
// path; we register the asset root with `setPath('assets/')` so the loader
// resolves `Textures/colormap.png` to `assets/Textures/colormap.png`.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

const PLACEHOLDER = () => {
  const g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const m = new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.9 });   // magenta = "GLB failed to load"
  const mesh = new THREE.Mesh(g, m);
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.placeholder = true;
  return group;
};

export function GLBLoader(opts = {}) {
  const path = opts.path || 'assets/';
  const cacheLimit = opts.cacheLimit ?? 32;
  const cache = new Map();
  const threeLoader = new GLTFLoader();
  threeLoader.setPath(path);

  // Cloning a parsed GLB group is cheap; we deep-clone the subtree so per-
  // instance position/scale/rotation don't bleed between uses. Materials and
  // textures are shared (Three.js doesn't deep-clone them on Object3D.clone).
  function cloneTemplate(tpl) {
    const c = tpl.clone(true);
    c.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    c.userData.source = tpl.userData.source;
    return c;
  }

  function placeholder(url, why) {
    const g = PLACEHOLDER();
    g.userData.source = url;
    g.userData.error = why || 'unknown';
    return g;
  }

  async function loadOne(url) {
    if (globalThis.__noGLB) return placeholder(url, 'noGLB');
    try {
      const gltf = await threeLoader.loadAsync(url);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) return placeholder(url, 'no-scene');
      root.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      root.userData.source = url;
      // FIFO eviction
      if (cache.size >= cacheLimit) {
        const firstKey = cache.keys().next().value;
        const evicted = cache.get(firstKey);
        evicted?.then?.((g) => g?.traverse?.((n) => {
          if (n.isMesh) { n.geometry?.dispose?.(); if (Array.isArray(n.material)) n.material.forEach(m => m.dispose?.()); else n.material?.dispose?.(); }
        }));
        cache.delete(firstKey);
      }
      return root;
    } catch (e) {
      return placeholder(url, e?.message || String(e));
    }
  }

  function loadGLB(url, apply) {
    if (!cache.has(url)) cache.set(url, loadOne(url));
    return cache.get(url).then((tpl) => {
      const inst = cloneTemplate(tpl);
      if (apply) {
        if (apply.position) inst.position.set(apply.position[0], apply.position[1], apply.position[2]);
        if (apply.rotationY != null) inst.rotation.y = apply.rotationY;
        if (apply.scale != null) {
          const s = apply.scale;
          if (Array.isArray(s)) inst.scale.set(s[0], s[1], s[2]);
          else inst.scale.setScalar(s);
        }
        if (apply.raiseToY != null) inst.position.y = apply.raiseToY + (inst.position.y || 0);
      }
      return inst;
    });
  }

  function dispose() {
    for (const p of cache.values()) {
      p?.then?.((g) => g?.traverse?.((n) => {
        if (n.isMesh) { n.geometry?.dispose?.(); if (Array.isArray(n.material)) n.material.forEach(m => m.dispose?.()); else n.material?.dispose?.(); }
      }));
    }
    cache.clear();
  }

  return { loader: threeLoader, loadGLB, dispose, _cache: cache };
}
