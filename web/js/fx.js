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

    // 3D conversation lines — drawn between two patrons during a gossip hop.
    // One LineSegments with CAP segments; each slot is a 2-vertex line. When
    // idle, both vertices sit at y = -999 (off-screen) so we don't pay the
    // raster cost of empty segments.
    this.CONV_CAP = 32;
    this.conversations = [];   // {a, b, t, dur, kind, slot}
    const convPos = new Float32Array(this.CONV_CAP * 2 * 3);
    convPos.fill(-999);
    const convCol = new Float32Array(this.CONV_CAP * 2 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(convPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(convCol, 3));
    this.convMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false,
    });
    this.convLines = new THREE.LineSegments(g, this.convMat);
    this.convLines.frustumCulled = false;
    scene.add(this.convLines);
    this._convNextSlot = 0;
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

  // gossipBubbles: route the gossip through the friendship graph first.
  // If `fromP` is a named Regular and one of their friends is currently on
  // the floor (sitting or in queue), the bubble goes to that friend — the
  // "word of mouth" hop. Otherwise we fall back to the nearest patron, the
  // way the bubble system has always worked. The visual conversation line
  // is drawn in 3D between the two patrons for the lifetime of the bubble.
  // `chainDepth` bounds friend-graph hops; deep chains tunnel the network.
  gossipBubbles(fromP, text, kind = 'bad', chainDepth = 0) {
    if (!fromP) return;
    const to = this.pickGossipTarget(fromP, kind, chainDepth) ?? this.patrons.randomPatron(fromP);
    if (!to) return;
    const el = document.createElement('div');
    el.className = 'bubble ' + kind;
    el.textContent = text;
    this.layer.appendChild(el);
    this.bubbles.push({ el, from: fromP, to, t: 0, kind, chained: chainDepth > 0 });
    this.startConversation(fromP, to, kind);
  }

  // Pick the next-hop target for a bubble. Friend graph if `fromP` is a
  // named regular and a friend is on the floor (within 2 hops). Returns
  // the patron object or null.
  pickGossipTarget(fromP, kind, chainDepth) {
    if (!fromP.regularFriends || fromP.regularFriends.size === 0) return null;
    if (chainDepth > 1) return null;        // bound the friend-graph tunnel
    // gather candidate patrons whose regularName is one of fromP's friends
    const cands = [];
    for (const set of this.patrons.regularsByIdx.values()) {
      for (const p of set) {
        if (p === fromP) continue;
        if (!fromP.regularFriends.has(p.regularName)) continue;
        if (p.state !== 'sit' && p.state !== 'inQueue') continue;
        cands.push(p);
      }
    }
    if (cands.length === 0) return null;
    return cands[(Math.random() * cands.length) | 0];
  }

  // ---- 3D conversation lines ----------------------------------------------------
  // A conversation is a single dashed line between two patrons' heads,
  // coloured by kind (red = bad, green = good), with a slight vertical arc.
  // We use a fixed pool of CAP line segments and rotate through them.
  startConversation(a, b, kind = 'bad', dur = 1.5) {
    if (!a || !b) return;
    // de-dupe: don't start a second conversation for the same pair while one
    // is still in flight
    for (const c of this.conversations) {
      if ((c.a === a && c.b === b) || (c.a === b && c.b === a)) return;
    }
    const slot = this._convNextSlot;
    this._convNextSlot = (this._convNextSlot + 1) % this.CONV_CAP;
    this.conversations.push({ a, b, t: 0, dur, kind, slot });
  }
  _updateConversations(dt) {
    const pos = this.convLines.geometry.attributes.position.array;
    const col = this.convLines.geometry.attributes.color.array;
    // zero everything (vertices fall to y = -999 when no conversation is using
    // a slot, so the line is invisible)
    for (let i = 0; i < this.CONV_CAP * 2 * 3; i++) pos[i] = -999;
    const RED = [0.82, 0.31, 0.23], GREEN = [0.42, 0.71, 0.36];
    for (let i = this.conversations.length - 1; i >= 0; i--) {
      const c = this.conversations[i];
      c.t += dt;
      const k = Math.min(c.t / c.dur, 1);
      if (!c.a.pos || !c.b.pos) { this.conversations.splice(i, 1); continue; }
      // ease-in for the arc: appears to "rise" toward the other patron
      const a = c.a.pos, b = c.b.pos;
      const arc = Math.sin(k * Math.PI) * 0.35;
      const x0 = a.x, y0 = 1.55, z0 = a.z;
      const x1 = b.x, y1 = 1.55, z1 = b.z;
      const xm = (x0 + x1) / 2, ym = Math.max(y0, y1) + arc, zm = (z0 + z1) / 2;
      // approximate the arc as two segments (a→mid, mid→b) sharing slot's two
      // vertices. For a single-segment line, just use endpoints with the arc
      // height on the midpoint we can't render in a 2-vertex line — instead
      // lift both endpoints by a fraction of the arc, so the line still arcs.
      const lift = arc * 0.4;
      const off = c.slot * 6;
      pos[off + 0] = x0; pos[off + 1] = y0 + lift; pos[off + 2] = z0;
      pos[off + 3] = x1; pos[off + 4] = y1 + lift; pos[off + 5] = z1;
      const fade = k < 0.85 ? 1 : (1 - k) / 0.15;
      const tint = c.kind === 'bad' ? RED : GREEN;
      for (let v = 0; v < 2; v++) {
        col[off + v * 3 + 0] = tint[0] * fade;
        col[off + v * 3 + 1] = tint[1] * fade;
        col[off + v * 3 + 2] = tint[2] * fade;
      }
      if (k >= 1) this.conversations.splice(i, 1);
    }
    this.convLines.geometry.attributes.position.needsUpdate = true;
    this.convLines.geometry.attributes.color.needsUpdate = true;
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
    this._updateConversations(dt);
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
  reset() { for (const b of this.bubbles) b.el.remove(); this.bubbles = []; this.conversations = []; }

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

