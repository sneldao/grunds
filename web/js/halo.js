// halo.js — idle-time guidance: a brass ring pulsing on the pavement under
// whatever nextAction says to attend to. Camera-invariant by shape (a ring
// has no direction to read wrong, unlike an arrow, under the orbit rig),
// bloom-friendly, retired by any intent, any modal, or leaving the floor.
//
// shouldHalo() is the pure decision; buildHalo() is the GL side and is never
// constructed headless.
import * as THREE from '../vendor/three.module.js';
import { softSprite } from './textures.js';

const IDLE_MS = 4500;   // same bar the camera sets before it drifts home

export function shouldHalo(st = {}) {
  const {
    started = false, closed = false, paused = false, photo = false,
    modalsOpen = false, headless = false, busy = false, idleMs = 0,
  } = st;
  if (headless || busy || !started || closed || paused || photo || modalsOpen) return false;
  return idleMs > IDLE_MS;
}

export function buildHalo(scene) {
  let group = null, ringMat = null, glowMat = null;
  try {
    ringMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.9, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    glowMat = new THREE.SpriteMaterial({
      map: softSprite(), color: 0xc9a227, transparent: true, opacity: 0, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(2.4, 2.4, 1);
    glow.position.y = 0.06;
    group = new THREE.Group();
    group.add(ring); group.add(glow);
    group.visible = false;
    scene.add(group);
  } catch {
    group = ringMat = glowMat = null;   // no GL: guidance quietly doesn't exist
  }
  let shown = false;
  return {
    showAt(vec, nowMs) {
      if (!group) return;
      group.position.copy(vec);
      group.visible = true;
      shown = true;
    },
    hide() {
      shown = false;
      if (group) group.visible = false;
    },
    update(dt, nowMs, { reduced = false } = {}) {
      if (!group || !shown) return;
      const o = reduced ? 0.3 : 0.25 + 0.2 * Math.sin(nowMs * 0.004);
      ringMat.opacity = o;
      glowMat.opacity = o * 0.5;
    },
    get visible() { return !!group && shown; },
  };
}
