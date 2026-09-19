// mailTheater.js — Idris's reply arrives as theater (Feature 5).
//
// While a posted letter is pending, poll the Convex inbox bridge
// (sync.inbox, ~8 s self-throttle). On arrival: the mailbox flag lerps up,
// three knocks land, an envelope drops from the slot to the pavement, the
// toast speaks. Headless and offline degrade to nothing — the letter modal
// and the server-side apply never depend on this.
//
// MIRROR RULE: handleInbound (convex/agentmail.ts) already applied the
// mechanical command to the campaign. This module — and its caller — must
// NEVER re-apply it. The client sees the play-by-play, not the move.

import * as THREE from '../vendor/three.module.js';
import { letterSprite } from './textures.js';

const POLL_MS = 8000;
// world.js mailbox: box at (-10.4, ~1.75, 6.4), opening ≈ y 2.0, front +z
const BOX = { x: -10.4, top: 2.05, z: 6.6 };

export function buildMailTheater({ world, scene, audio, fx, sync, headless, reducedMotion, onArrive }) {
  const state = {
    armed: false,        // a posted letter is awaiting its reply
    seenAt: 0,           // createdAt of the newest inbox row already seen
    arrived: 0,          // arrivals handled this session (for tests/QA)
    _nextPoll: 0,
    _flagTarget: null,   // rotation.z we're lerping the flag toward
    _env: null,          // { mesh, vy, spin, landed }
  };

  function arm(seenAt = 0) {
    if (headless || !sync || !sync.live) return;
    state.armed = true;
    state.seenAt = Math.max(state.seenAt, seenAt || 0);
    state._nextPoll = 0;   // poll on the next frame, not 8 s out
  }
  function disarm() {
    state.armed = false;
    clearEnvelope();
    state._flagTarget = null;
  }

  function clearEnvelope() {
    if (state._env) {
      try { scene.remove(state._env.mesh); state._env.mesh.material.map?.dispose(); state._env.mesh.material.dispose(); } catch { /* already gone */ }
      state._env = null;
    }
  }

  function dropEnvelope() {
    if (reducedMotion) return;   // reduced motion: flag + knock + toast, no falling bodies
    try {
      const geo = new THREE.PlaneGeometry(0.46, 0.34);
      const mat = new THREE.MeshBasicMaterial({
        map: letterSprite(), transparent: true, side: THREE.DoubleSide,
        depthWrite: false, fog: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(BOX.x, BOX.top, BOX.z);
      mesh.rotation.set(-0.5, 0.4, 0.2);
      scene.add(mesh);
      state._env = { mesh, vy: 0, spin: 1.6, landed: 0 };
    } catch {
      /* sprite bake needs a DOM; the beat survives without the envelope */
    }
  }

  function arrive(letter) {
    state.arrived++;
    state.seenAt = Math.max(state.seenAt, letter.createdAt || 0);
    if (reducedMotion) { try { world.setMail(true); } catch {} }
    else state._flagTarget = world.mailUp ?? -Math.PI / 7;
    try { audio.knock3(); } catch {}
    dropEnvelope();
    try { fx.toast('new letter from Idris — in the box', 'good'); } catch {}
    if (onArrive) { try { onArrive(letter); } catch { /* consumer bugs never eat the beat */ } }
  }

  function update(dt, now) {
    if (!state.armed) return;
    // poll — self-throttled; one in flight at a time
    if (now >= state._nextPoll) {
      state._nextPoll = now + POLL_MS;
      Promise.resolve(sync.inbox(state.seenAt)).then((letter) => {
        if (letter && state.armed) arrive(letter);
      }).catch(() => {});
    }
    // flag lerp (world.setMail snaps; the theater wants it to rise)
    if (state._flagTarget != null && world.mailFlag) {
      const f = world.mailFlag;
      f.rotation.z += (state._flagTarget - f.rotation.z) * Math.min(1, dt * 2.5);
      if (Math.abs(f.rotation.z - state._flagTarget) < 0.01) { f.rotation.z = state._flagTarget; state._flagTarget = null; }
    }
    // envelope: gravity, a tumble, a settle, then fade out
    const e = state._env;
    if (e) {
      if (!e.landed) {
        e.vy -= 4.2 * dt;
        e.mesh.position.y += e.vy * dt;
        e.mesh.rotation.z += e.spin * dt;
        if (e.mesh.position.y <= 0.06) { e.mesh.position.y = 0.06; e.landed = 0.0001; }
      } else {
        e.landed += dt;
        if (e.landed > 2.6) e.mesh.material.opacity = Math.max(0, 1 - (e.landed - 2.6) / 1.4);
        if (e.landed > 4) clearEnvelope();
      }
    }
  }

  return Object.assign(state, { arm, disarm, update });
}
