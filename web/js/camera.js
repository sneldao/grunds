// Cinematic camera — title orbit, crane-in, drag-orbit, beat push-ins, handheld breath.
import * as THREE from '../vendor/three.module.js';
import { cameraGestureTarget, dragExceeded, mouseButtonsUp, pinchRadius, pointerDistance, stalePointerIds } from './gestures.js';

// Idle/home framing. 24 is close enough that a person at the bar and the
// chalkboard read, and the far curb of the road still sits in frame.
// Scripted shots clamp at 18, so a debrief still pushes in from here.
const HOME = { target: new THREE.Vector3(0, 0.8, 4), theta: 0.12, phi: 0.70, r: 24 };

// ---- written camera grammar — named shots, not magic numbers --------------
// Phase 5: every cinematic beat names its shot. verdict (the till),
// lease (the sold storefront), debrief (the bar), rivalReact (Sam's
// board), newbuild (the turning-over street).
export const SHOTS = {
  verdict: { r: 11, secs: 5, theta: null, anchor: 'counter' },
  lease: { r: 17, secs: 7, theta: Math.PI, anchor: 'newbuild' },
  debrief: { r: 11, secs: 3.5, theta: null, anchor: 'counter' },
  rivalReact: { r: 13, secs: 3.5, theta: null, anchor: 'rival' },
  newbuild: { r: 17, secs: 7, theta: Math.PI, anchor: 'newbuild' },
};

export class CameraRig {
  constructor(camera, dom) {
    this.cam = camera;
    this.mode = 'title';
    this.target = new THREE.Vector3(0, 1, 4);
    this.theta = 0; this.phi = 0.9; this.r = 27;
    this.home = { ...HOME, target: HOME.target.clone() };
    this.beat = null;          // {point, r, until, saved}
    this.shakeT = 0; this.shakeMag = 0;
    this._baseFov = camera.fov;
    this._fovOff = 0;
    this.lastUser = 0;
    this.craneT = 0;
    this.dom = dom;
    this.blocked = () => false;
    this._drag = null;
    this._pinch = null;
    this.pointers = new Map();
    this._cap = new Set();
    this.suppressClick = false;
    const endPointer = (e) => {
      if (!e || e.pointerId == null) { this.release(); return; }
      if (this._cap.has(e.pointerId)) {
        this._cap.delete(e.pointerId);
        try { dom.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      }
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this._pinch = null;
      if (this.pointers.size === 0) {
        this.suppressClick = !!(this._drag && this._drag.active);
        this._drag = null;
        return;
      }
      if (this.pointers.size === 1) {
        const p = this.pointers.values().next().value;
        this._drag = { x: p.x, y: p.y, ox: p.x, oy: p.y, active: false };
      }
    };
    const onDown = (e) => {
      if (this.blocked()) { this.release(); return; }
      if (!cameraGestureTarget(e.target)) return;
      if (e.pointerType === 'mouse' && e.button != null && e.button !== 0) return;
      for (const id of stalePointerIds(this.pointers.keys(), e)) this.pointers.delete(id);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastUser = performance.now();
      try { dom.setPointerCapture(e.pointerId); this._cap.add(e.pointerId); } catch { /* inert or gone */ }
      if (this.pointers.size === 1) {
        this._pinch = null;
        this._drag = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, active: false };
        this.suppressClick = false;
      } else if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        this._pinch = { dist: Math.max(1, pointerDistance(a, b)), r: this.r };
        this._drag = null;
      }
    };
    const onMove = (e) => {
      if (mouseButtonsUp(e)) { if (this.pointers.has(e.pointerId)) endPointer(e); return; }
      if (!this.pointers.has(e.pointerId)) return;
      if (this.blocked()) { this.release(); return; }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2 && this._pinch) {
        const [a, b] = [...this.pointers.values()];
        const dist = pointerDistance(a, b);
        this.r = pinchRadius(this._pinch.dist, dist, this._pinch.r);
        this.lastUser = performance.now();
        if (this.beat) this.beat = null;
        return;
      }
      if (!this._drag) return;
      if (!this._drag.active) {
        if (!dragExceeded(e.clientX - this._drag.ox, e.clientY - this._drag.oy)) return;
        this._drag.active = true;
        this._drag.x = e.clientX;
        this._drag.y = e.clientY;
        return;
      }
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      this.theta -= dx * 0.005; this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.004, 0.5, 1.32);
      this.lastUser = performance.now();
      if (this.beat) this.beat = null; // user takes the camera back
    };
    const onWheel = (e) => {
      if (this.blocked()) return;
      if (!cameraGestureTarget(e.target)) return;
      this.r = THREE.MathUtils.clamp(this.r * (1 + e.deltaY * 0.0009), 10, 34);
      this.lastUser = performance.now();
      if (this.beat) this.beat = null;
    };
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerup', endPointer, true);
    addEventListener('pointercancel', endPointer, true);
    addEventListener('blur', () => this.release());
    addEventListener('wheel', onWheel, { capture: true, passive: true });
  }

  // Drop a gesture that a card, a blur, or a lost pointerup interrupted.
  release() {
    for (const id of this._cap) {
      try { this.dom.releasePointerCapture(id); } catch { /* already released */ }
    }
    this._cap.clear();
    this.pointers.clear();
    this._drag = null;
    this._pinch = null;
  }

  crane() { this.mode = 'crane'; this.craneT = 0; this._from = { target: this.target.clone(), theta: this.theta, phi: this.phi, r: this.r }; this._calm = performance.now(); }

  focus(point, r = 12, secs = 4, theta = null) {
    this.beat = { point: point.clone(), r: Math.max(18, r), until: performance.now() / 1000 + secs, blend: 0, theta };
  }
  // queueFocus: a focus that waits for the current beat to finish (expiring
  // after ttl seconds) instead of stomping it. News beats chapters.
  queueFocus(point, r = 12, secs = 4, ttl = 12, theta = null) {
    this.queued = { point: point.clone(), r, secs, until: performance.now() / 1000 + ttl, theta };
  }
  // Phase 5 — named shots: shot() focuses now, queueShot() waits its turn.
  shot(name, world) {
    const s = SHOTS[name]; if (!s || !world?.focus) return;
    const anchor = world.focus[s.anchor] || world.focus.counter;
    if (anchor) this.focus(anchor, s.r, s.secs, s.theta);
  }
  queueShot(name, world, ttl = 12) {
    const s = SHOTS[name]; if (!s || !world?.focus) return;
    const anchor = world.focus[s.anchor] || world.focus.counter;
    if (anchor) this.queueFocus(anchor, s.r, s.secs, ttl, s.theta);
  }
  shake(mag = 0.35) {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shakeT = 1; this.shakeMag = mag;
  }
  // Short FOV kick. delta is degrees added to the rig's base fov; 0 restores.
  setFovOffset(delta) {
    const d = Number.isFinite(delta) ? delta : 0;
    if (Math.abs(d - this._fovOff) < 1e-4) return;
    this._fovOff = d;
    this.cam.fov = this._baseFov + d;
    if (this.cam.updateProjectionMatrix) this.cam.updateProjectionMatrix();
  }
  resetView() {
    this.beat = null;
    this.home = { ...HOME, target: HOME.target.clone() };
    this.target.copy(HOME.target); this.theta = HOME.theta; this.phi = HOME.phi; this.r = HOME.r;
  }

  update(dt, now) {
    const t = now / 1000;
    if (this.mode === 'title') {
      this.theta += dt * 0.07;
      this.target.set(0, 1, 4);
      this.r = 27; this.phi = 0.92;
    } else if (this.mode === 'crane') {
      this.craneT += dt / 3;
      const f = Math.min(this.craneT, 1), e = 1 - Math.pow(1 - f, 3);
      const fr = this._from;
      this.target.lerpVectors(fr.target, this.home.target, e);
      this.theta = fr.theta + (this.home.theta - fr.theta) * e;
      this.phi = fr.phi + (this.home.phi - fr.phi) * e;
      this.r = fr.r + (this.home.r - fr.r) * e;
      if (f >= 1) this.mode = 'play';
    } else {
      // play: drift home very slowly when the user isn't driving
      const idle = (now - this.lastUser) / 1000 > 4;
      if (this.beat) {
        this.beat.blend = Math.min(1, this.beat.blend + dt * 1.6);
        const e = this.beat.blend * this.beat.blend * (3 - 2 * this.beat.blend);
        this.target.lerp(this.beat.point, e * 0.12);
        this.r += (this.beat.r - this.r) * e * 0.12;
        // Street-side beats (rival, newbuild) also swing the orbit so the
        // camera looks at the storefront, not the back wall.
        if (this.beat.theta !== null && this.beat.theta !== undefined) {
          let diff = this.beat.theta - this.theta;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          this.theta += diff * e * 0.12;
        }
        if (t > this.beat.until) this.beat = null;
      } else if (idle) {
        // a queued news-focus promotes once the camera is free and idle —
        // never while the user is driving (it just expires).
        if (!this.beat && this.queued) {
          const q = this.queued; this.queued = null;
          if (t <= q.until) this.focus(q.point, q.r, q.secs, q.theta);
        }
        this.target.lerp(this.home.target, dt * 0.4);
        this.r += (this.home.r - this.r) * dt * 0.25;
        this.theta += Math.sin(t * 0.00013 * 1000) * 0.00012; // barely-there drift
      }
    }
    // spherical placement + gentle breath (muted in calm openings so the
    // street settles before crowds arrive — reads as curated, not chaotic).
    // Respects prefers-reduced-motion: breath scales to 0 when the user
    // prefers less motion (accessibility).
    const calmFactor = this._calm ? Math.min(1, Math.max(0, (performance.now() - this._calm) / 7000)) : 1;
    const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
    const breathScale = (0.25 + 0.75 * calmFactor) * reduceMotion;
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    const px = this.target.x + this.r * sp * Math.sin(this.theta);
    const py = this.target.y + this.r * cp;
    const pz = this.target.z + this.r * sp * Math.cos(this.theta);
    const n1 = (Math.sin(t * 0.9) * 0.035 + Math.sin(t * 2.3) * 0.015) * breathScale;
    const n2 = (Math.cos(t * 1.1) * 0.035 + Math.sin(t * 1.7) * 0.015) * breathScale;
    let sx = 0, sy = 0, sz = 0;
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt * 1.4);
      const m = this.shakeMag * this.shakeT * this.shakeT;
      sx = (Math.random() - 0.5) * m; sy = (Math.random() - 0.5) * m; sz = (Math.random() - 0.5) * m;
    }
    this.cam.position.set(px + n1 + sx, py + n2 * 0.6 + sy, pz + n2 + sz);
    this.cam.lookAt(this.target.x + n1 * 0.4 + sx * 0.5, this.target.y + sy * 0.5, this.target.z + n2 * 0.4 + sz * 0.5);
  }
}
