// FX — particles (steam, coins, dust, huffs) + DOM storytelling (bubbles, cards, receipt).
import * as THREE from '../vendor/three.module.js';
import { softSprite } from './textures.js';
import { COPY } from './config.js';

class Pool {
  constructor(scene, n, { size, blending, tint = 0xffffff }) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.pos.fill(-999);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: softSprite(), transparent: true, depthWrite: false, blending, vertexColors: true, sizeAttenuation: true });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.baseColor = new THREE.Color(tint);
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, shade = 1) {
    const i = this.i = (this.i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.max[i] = life;
    this.col[i * 3] = this.baseColor.r * shade; this.col[i * 3 + 1] = this.baseColor.g * shade; this.col[i * 3 + 2] = this.baseColor.b * shade;
  }
  update(dt, gravity = 0, drag = 1) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; this.col[i * 3 + 1] = 0; continue; }
      this.vel[i * 3 + 1] += gravity * dt;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.max[i];
      const dim = f * f;
      this.col[i * 3] = this.baseColor.r * dim; this.col[i * 3 + 1] = this.baseColor.g * dim; this.col[i * 3 + 2] = this.baseColor.b * dim;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, patrons, lite) {
    this.patrons = patrons;
    this.steam = new Pool(scene, lite ? 60 : 160, { size: 0.24, blending: THREE.AdditiveBlending, tint: 0xfff4e2 });
    this.coins = new Pool(scene, 120, { size: 0.16, blending: THREE.AdditiveBlending, tint: 0xffd24a });
    this.huffs = new Pool(scene, 60, { size: 0.3, blending: THREE.NormalBlending, tint: 0x9a938a });
    this.bubbles = [];
    this.steamAcc = 0;
    if (!lite) {
      this.dust = new Pool(scene, 90, { size: 0.05, blending: THREE.AdditiveBlending, tint: 0xffe9c0 });
      for (let i = 0; i < 90; i++) this.dust.spawn(-11 + Math.random() * 22, 0.3 + Math.random() * 3.2, -7.5 + Math.random() * 13, 0, 0, 0, 1e9, 0.35 + Math.random() * 0.3);
      // dust drifts forever: life is huge, update only wanders
      this.dust.mat.opacity = 0.5;
    }
    this.layer = document.getElementById('bubbles');
  }

  // steam rises from every fresh cup
  steamFrom(dt) {
    this.steamAcc += dt;
    if (this.steamAcc < 0.09) return;
    this.steamAcc = 0;
    for (const p of this.patrons.patrons) {
      if (!p.hasCup || p.walking) continue;
      if (Math.random() < 0.3) {
        const fx = Math.sin(p.face), fz = Math.cos(p.face), rx = Math.cos(p.face), rz = -Math.sin(p.face);
        this.steam.spawn(p.pos.x + fx * 0.24 + rx * 0.14, 1.05, p.pos.z + fz * 0.24 + rz * 0.14,
          (Math.random() - 0.5) * 0.08, 0.3 + Math.random() * 0.15, (Math.random() - 0.5) * 0.08, 1.4 + Math.random(), 0.5);
      }
    }
  }
  coinBurst(x, y, z, n = 7) {
    for (let i = 0; i < n; i++)
      this.coins.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 1.4, 1.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.4, 0.7 + Math.random() * 0.4);
  }
  huff(x, y, z) {
    for (let i = 0; i < 5; i++)
      this.huffs.spawn(x + (Math.random() - 0.5) * 0.2, y + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5, 0.55 + Math.random() * 0.3, 0.8);
  }
  dustDrift(now) {
    if (!this.dust) return;
    const p = this.dust.pos;
    for (let i = 0; i < this.dust.n; i++) {
      p[i * 3] += Math.sin(now * 0.0002 + i) * 0.0012;
      p[i * 3 + 1] += Math.cos(now * 0.00016 + i * 1.3) * 0.0009;
    }
    this.dust.points.geometry.attributes.position.needsUpdate = true;
  }

  // ---- gossip bubbles: comic speech that travels patron → patron ---------------
  bubble(fromP, text, kind = 'bad', chained = false) {
    const to = this.patrons.randomPatron(fromP);
    if (!to) return;
    const el = document.createElement('div');
    el.className = 'bubble ' + kind;
    el.textContent = text;
    this.layer.appendChild(el);
    this.bubbles.push({ el, from: fromP, to, t: 0, kind, chained });
  }
  _project(v, camera) {
    const p = v.clone ? v.clone() : new THREE.Vector3(v.x, v.y, v.z);
    p.project(camera);
    return [(p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight, p.z < 1];
  }
  update(dt, camera, now) {
    this.steam.update(dt, 0.12, 0.985);
    this.coins.update(dt, -4.5, 0.99);
    this.huffs.update(dt, 0.4, 0.96);
    this.dustDrift(now);
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt / 1.5;
      const t = Math.min(b.t, 1);
      const a = b.from.pos, c = b.to.pos;
      const pos = new THREE.Vector3(a.x + (c.x - a.x) * t, 1.7 + Math.sin(t * Math.PI) * 0.8, a.z + (c.z - a.z) * t);
      const [x, y, vis] = this._project(pos, camera);
      b.el.style.left = x + 'px'; b.el.style.top = y + 'px';
      b.el.style.opacity = vis ? String(t < 0.85 ? 1 : (1 - t) / 0.15) : '0';
      if (b.t >= 1) {
        b.el.remove(); this.bubbles.splice(i, 1);
        // word of mouth: a bad review travels ≥2 hops
        if (!b.chained && Math.random() < 0.5) {
          const lines = b.kind === 'bad' ? COPY.gossipBad : COPY.gossipGood;
          this.bubble(b.to, lines[(Math.random() * lines.length) | 0], b.kind, true);
        }
      }
    }
  }
  reset() { for (const b of this.bubbles) b.el.remove(); this.bubbles = []; }

  // ---- DOM story beats ----------------------------------------------------------
  card(k, sub) {
    const el = document.getElementById('chapter');
    el.querySelector('.ck').textContent = k;
    el.querySelector('.cs').textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  toast(text, kind = '') {
    const feed = document.getElementById('feed');
    const el = document.createElement('div');
    el.className = 'note ' + kind; el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 3) feed.lastChild.remove();
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 900); }, 5200);
  }
  notebook(show) { document.getElementById('notebook').classList.toggle('show', show); }
  receipt(stats) {
    const el = document.getElementById('receipt');
    if (!stats) { el.classList.remove('show'); return; }
    document.getElementById('r-lines').innerHTML = stats.lines.map(l =>
      `<div class="rl"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('');
    document.getElementById('r-verdict').textContent = stats.verdict;
    el.classList.add('show');
  }
}

