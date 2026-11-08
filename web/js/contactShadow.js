// contactShadow.js — cheap grounding: a radial-gradient blob under props so
// they stop hovering. One shared texture, one extra draw call per prop,
// render-side only (no sim, no rng). Pair with real shadow-mapped lights;
// this fills the ambient-occlusion gap the sun can't reach.
// Headless-safe: no DOM canvas → no-op, never throws into the caller.
import * as THREE from '../vendor/three.module.js';
import { softSprite } from './textures.js';

let _tex = null, _texFailed = false;
function tex() {
  if (_texFailed) return null;
  if (!_tex) {
    try { _tex = softSprite(); } catch { _texFailed = true; return null; }
  }
  return _tex;
}

// parent: the group/scene the prop lives in. x/z: world-ish local ground pos.
// w/d: footprint in metres. opacity ~0.28 reads as contact, not a hole.
export function addContactShadow(parent, x, z, w, d, opacity = 0.3) {
  const t = tex();
  if (!t || !parent?.add) return null;
  try {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        map: t, transparent: true, opacity,
        depthWrite: false, toneMapped: false,
        color: 0x000000,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    m.renderOrder = 1;
    m.userData.contactShadow = true;
    parent.add(m);
    return m;
  } catch {
    return null;
  }
}
