// Cinematic camera — title orbit, crane-in, drag-orbit, beat push-ins, handheld breath.
import * as THREE from '../vendor/three.module.js';

const HOME = { target: new THREE.Vector3(0, 0.8, 2.5), theta: 0.12, phi: 1.02, r: 21 };

export class CameraRig {
  constructor(camera, dom) {
    this.cam = camera;
    this.mode = 'title';
    this.target = new THREE.Vector3(0, 1, 4);
    this.theta = 0; this.phi = 0.9; this.r = 27;
    this.home = { ...HOME, target: HOME.target.clone() };
    this.beat = null;          // {point, r, until, saved}
    this.shakeT = 0; this.shakeMag = 0;
    this.lastUser = 0;
    this.craneT = 0;
    this._drag = null;
    dom.addEventListener('pointerdown', e => { this._drag = { x: e.clientX, y: e.clientY }; this.lastUser = performance.now(); });
    addEventListener('pointermove', e => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag = { x: e.clientX, y: e.clientY };
      this.theta -= dx * 0.005; this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.004, 0.5, 1.32);
      this.lastUser = performance.now();
      if (this.beat) this.beat = null; // user takes the camera back
    });
    addEventListener('pointerup', () => this._drag = null);
    dom.addEventListener('wheel', e => {
      this.r = THREE.MathUtils.clamp(this.r * (1 + e.deltaY * 0.0009), 10, 34);
      this.lastUser = performance.now();
    }, { passive: true });
  }

  crane() { this.mode = 'crane'; this.craneT = 0; this._from = { target: this.target.clone(), theta: this.theta, phi: this.phi, r: this.r }; }

  focus(point, r = 12, secs = 4) {
    this.beat = { point: point.clone(), r, until: performance.now() / 1000 + secs, blend: 0 };
  }
  shake(mag = 0.35) { this.shakeT = 1; this.shakeMag = mag; }
  resetView() { this.beat = null; this.home = { ...HOME, target: HOME.target.clone() }; }

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
        if (t > this.beat.until) this.beat = null;
      } else if (idle) {
        this.target.lerp(this.home.target, dt * 0.4);
        this.r += (this.home.r - this.r) * dt * 0.25;
        this.theta += Math.sin(t * 0.00013 * 1000) * 0.00012; // barely-there drift
      }
    }
    // spherical placement + handheld breath
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    const px = this.target.x + this.r * sp * Math.sin(this.theta);
    const py = this.target.y + this.r * cp;
    const pz = this.target.z + this.r * sp * Math.cos(this.theta);
    const n1 = Math.sin(t * 0.9) * 0.045 + Math.sin(t * 2.3) * 0.02;
    const n2 = Math.cos(t * 1.1) * 0.045 + Math.sin(t * 1.7) * 0.02;
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
