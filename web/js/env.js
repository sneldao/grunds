// env.js — image-based lighting: a CC0 Poly Haven dusk HDRI gives every
// MeshStandardMaterial image-based ambient + reflections, which is what
// makes low-poly geometry read as premium (same trick stylized hits use).
// Async + best-effort: no HDRI / no WebGL2 / headless → scene unchanged.
import * as THREE from '../vendor/three.module.js';
import { RGBELoader } from '../vendor/loaders/RGBELoader.js';

export const ENV_INTENSITY = 0.42;   // dusk HDRI is moody; keep it a fill, not a key

// envMapIntensity scales the scene.environment contribution per material.
// Call on any subtree after materials exist; safe to call repeatedly.
export function applyEnvIntensity(root, v = ENV_INTENSITY) {
  if (!root?.traverse) return;
  root.traverse((n) => {
    const mats = Array.isArray(n.material) ? n.material : (n.material ? [n.material] : []);
    for (const m of mats) {
      if (m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) m.envMapIntensity = v;
    }
  });
}

export function initEnvironment(renderer, scene, opts = {}) {
  const url = opts.url || 'assets/hdri/evening_road_01_puresky_1k.hdr';
  const intensity = opts.intensity ?? ENV_INTENSITY;
  if (globalThis.__noGLB || globalThis.__headless) return Promise.resolve(false);
  try {
    const loader = new RGBELoader();
    return loader.loadAsync(url).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromEquirectangular(tex);
      scene.environment = envRT.texture;
      tex.dispose(); pmrem.dispose();
      applyEnvIntensity(scene, intensity);   // world + anything already placed
      return true;
    }).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
