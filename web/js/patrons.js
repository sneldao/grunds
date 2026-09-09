// Patrons — hundreds of little people, 8 draw calls, one real queue line.
// The line out the door IS the chart.
import * as THREE from '../vendor/three.module.js';
import { COHORTS, LAYOUT, ECON, counterSlot, registerSlot, rivalSlot, MAX_VISIBLE_QUEUE } from './config.js';

const MAXP = ECON.maxPatrons;
const SKIN = [0xf2c89a, 0xe0ac82, 0xc98a5e, 0xa06a42, 0x7a4e30, 0x5e3a24];
const LEGS = [0x2a2c34, 0x3a3230, 0x24303a];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RED = new THREE.Color(0xd0503a);

export class PatronSystem {
  constructor(scene, world, regulars = null, exchange = null, fx = null) {
    this.world = world;
    this.regulars = regulars;     // for named-patron flagging
    this.exchange = exchange;     // for contract unit consumption
    this.fx = fx;                 // for greeting bubbles on join
    this.patrons = [];
    this.free = [];
    this.counterQ = []; this.registerQ = []; this.rivalQ = [];
    this.rivalClock = 0;
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();

    const mk = (geo, rough = 0.8) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: rough }), MAXP);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true; m.frustumCulled = false;
      m.count = MAXP;
      scene.add(m); return m;
    };
    const legGeo = new THREE.BoxGeometry(0.09, 0.34, 0.09); legGeo.translate(0, -0.17, 0);
    const armGeo = new THREE.BoxGeometry(0.07, 0.3, 0.07); armGeo.translate(0, -0.15, 0);
    this.parts = {
      torso: mk(new THREE.CapsuleGeometry(0.16, 0.34, 4, 10)),
      head: mk(new THREE.SphereGeometry(0.14, 10, 8)),
      legL: mk(legGeo), legR: mk(legGeo.clone()),
      armL: mk(armGeo), armR: mk(armGeo.clone()),
      hat: mk(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 12)),
      cup: mk(new THREE.CylinderGeometry(0.05, 0.038, 0.1, 8)),
    };
    this.parts.cup.castShadow = false;
    // zero-scale everything
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const part of Object.values(this.parts)) for (let i = 0; i < MAXP; i++) part.setMatrixAt(i, z);
    for (let i = MAXP - 1; i >= 0; i--) this.free.push(i);
  }

  get count() { return MAXP - this.free.length; }
  get queueLength() { return this.counterQ.filter(p => p.state === 'inQueue').length; }

  spawn(cohort, zone, quick = false) {
    if (!this.free.length) return null;
    const idx = this.free.pop();
    const fromLeft = Math.random() < 0.5;
    const s = fromLeft ? LAYOUT.spawnL : LAYOUT.spawnR;
    const torso = new THREE.Color(COHORTS[cohort]?.color ?? 0xaaaaaa).lerp(new THREE.Color(0x888888), 0.12);
    const p = {
      idx, active: true, cohort, zone,
      wantsMatcha: zone === 'counter' && Math.random() < (this.repriced ? 0.45 : ECON.matchaShare),   // a deal pulls the students
      pos: V3(s.x, 0, s.z + (Math.random() - 0.5) * 1.4), face: fromLeft ? Math.PI / 2 : -Math.PI / 2,
      path: [], state: 'walking', waitMin: 0, dwell: 0,
      speed: 2.1 + Math.random() * 0.9, phase: Math.random() * 6.28,
      jx: (Math.random() - 0.5) * 0.24, jz: (Math.random() - 0.5) * 0.2,
      seat: null, hasCup: false, cupGreen: false, hasHat: Math.random() < 0.45,
      torso, skin: new THREE.Color(SKIN[(Math.random() * SKIN.length) | 0]),
      legs: new THREE.Color(LEGS[(Math.random() * LEGS.length) | 0]),
      flash: 0, colorDirty: true, queueRef: null, slotI: -1, walking: true,
      scale: 0.92 + Math.random() * 0.16,
      regularName: null, regularIdx: -1, greeted: false,
    };
    // Is this spawn a named Regular? If so, mark seen, tag the patron, and
    // emit a one-line greeting when they actually join the queue.
    if (this.regulars && zone === 'counter') {
      const r = this.regulars.markSeen(cohort);
      if (r.found) { p.regularName = r.name; p.regularIdx = r.idx; p.hasHat = true; }
    }
    this.patrons.push(p);
    const door = V3(LAYOUT.door.x + (Math.random() - 0.5) * 2.2, 0, LAYOUT.door.z + 0.5);
    if (zone === 'counter') {
      p.queueRef = 'counter'; this.counterQ.push(p);
      p.goal = this._slotPos(counterSlot, this.counterQ.length - 1, p);
      if (quick) {  // at speed the crowd is just there — step out of it, keep arrival = spawn rate
        p.state = 'toQueue';
        p.pos.set(p.goal.x + (Math.random() - 0.5), 0, p.goal.z + 1.4 + Math.random());
      } else { p.state = 'walkingIn'; p.path = [door]; }
    } else {
      p.state = 'toBrowse';
      const shelf = V3(LAYOUT.retail.x + 1.3 + Math.random(), 0, LAYOUT.retail.z + (Math.random() - 0.5) * 4.4);
      if (quick) { p.pos.set(door.x, 0, door.z); p.path = [shelf]; } else p.path = [door, shelf];
    }
    this._paint(p);
    return p;
  }

  _slotPos(slotFn, i, p) {
    if (i < MAX_VISIBLE_QUEUE) { const s = slotFn(i); return V3(s.x + p.jx, 0, s.z + p.jz); }
    const k = i - MAX_VISIBLE_QUEUE;   // stable crowd grid by the door — no thrash
    return V3(-10.2 + (k % 9) * 0.62 + p.jx, 0, 7.2 + (Math.floor(k / 9) % 3) * 0.62 + p.jz);
  }

  _layoutQ(q, slotFn) {
    q.forEach((p, i) => {
      p.slotI = i;
      p.goal = this._slotPos(slotFn, i, p);   // queue states damp toward their goal — the line slides
    });
  }

  // ---- sim tick (one sim-minute) ---------------------------------------------
  tick(dayMin, ctx) {
    const ev = [];
    // everyone waiting ages a minute
    for (const p of this.counterQ) if (p.state === 'inQueue') p.waitMin++;
    for (const p of this.registerQ) if (p.state === 'inRegisterQ') p.waitMin++;

    // serve from the counter — the bar spends prep-points each minute; a made-to-order
    // matcha costs 4, a pre-batched one costs 1. The lever is visible in the line's speed.
    let points = ECON.barPoints, servedN = 0;
    for (let i = 0; i < this.counterQ.length && points > 0 && servedN < ECON.servePerTick;) {
      const p = this.counterQ[i];
      if (p.state !== 'inQueue') { i++; continue; }
      const cost = p.wantsMatcha ? (ctx.prebatched ? ECON.prepBatched : ECON.prepMatcha) : ECON.prepOther;
      if (cost > points) { i++; continue; }   // bar's busy — cheaper orders slip ahead
      this.counterQ.splice(i, 1); points -= cost; servedN++;
      if (p.wantsMatcha && ctx.prebatched) ctx.batchUnits = Math.max(0, ctx.batchUnits - 1);
      p.hasCup = true; p.cupGreen = p.wantsMatcha; p.colorDirty = true;
      ev.push({ type: 'served', p, isMatcha: p.wantsMatcha, price: p.wantsMatcha ? (ctx.repriced ? ECON.matchaDeal : ECON.matchaFull) : ECON.other });
      if (this.exchange) this.exchange.consume(1);   // burn one contract unit per cup
      this._afterServe(p);
    }
    this._layoutQ(this.counterQ, counterSlot);

    // balks — matcha waiters who've had enough walk to the chain
    for (let i = this.counterQ.length - 1; i >= 0; i--) {
      const p = this.counterQ[i];
      const balkChance = this.repriced ? ECON.balkChance * 0.5 : ECON.balkChance;   // a deal buys patience
      if (p.state === 'inQueue' && p.wantsMatcha && !ctx.prebatched && p.waitMin > ECON.balkAfter && Math.random() < balkChance) {
        this.counterQ.splice(i, 1);
        p.flash = 1; p.colorDirty = true;
        ev.push({ type: 'balked', p });
        if (Math.random() < 0.7 && this.rivalQ.length < 42) {
          p.state = 'defecting'; p.queueRef = 'rival'; this.rivalQ.push(p);
          p.goal = this._slotPos(rivalSlot, this.rivalQ.length - 1, p);
          p.path = [
            V3(LAYOUT.door.x, 0, LAYOUT.door.z + 0.6),
            V3(LAYOUT.crossX, 0, LAYOUT.pavementZ),
            V3(LAYOUT.crossX, 0, 14.6),
          ];
          // they walked out before being served — don't credit them with having been "seen"
          if (p.regularIdx >= 0 && this.regulars) this.regulars.unsee(p.regularIdx);
          p.regularName = null; p.regularIdx = -1;
          ev.push({ type: 'defect', p });
        } else this._leave(p);
      }
    }
    this._layoutQ(this.counterQ, counterSlot);

    // register — quick, one minute each
    let regN = 0;
    for (let i = 0; i < this.registerQ.length && regN < ECON.registerPerTick;) {
      const p = this.registerQ[i];
      if (p.state !== 'inRegisterQ') { i++; continue; }
      if (p.waitMin >= 1) {
        this.registerQ.splice(i, 1); regN++;
        ev.push({ type: 'served', p, isMatcha: false, price: ECON.other, viaRegister: true });
        if (Math.random() < 0.12) this._afterServe(p); else this._leave(p);
      } else i++;
    }
    this._layoutQ(this.registerQ, registerSlot);

    // browsers finish browsing; sitters finish their cups
    for (let j = this.patrons.length - 1; j >= 0; j--) {
      const p = this.patrons[j];
      if (p.state === 'browse' && --p.dwell <= 0) {
        p.state = 'toRegister'; p.queueRef = 'register'; this.registerQ.push(p);
        p.goal = this._slotPos(registerSlot, this.registerQ.length - 1, p);
        this._layoutQ(this.registerQ, registerSlot);
      } else if (p.state === 'sit' && --p.dwell <= 0) {
        this._leave(p);
      }
    }

    // the chain serves slowly — one every two minutes
    if (++this.rivalClock % 2 === 0 && this.rivalQ.length) {
      const p = this.rivalQ[0];
      if (p.state === 'inRivalQ') {
        this.rivalQ.shift();
        p.state = 'leaving'; p.queueRef = null;
        p.path = [V3(p.pos.x + 5, 0, 15.4)];
        ev.push({ type: 'rivalServed', p });
        this._layoutQ(this.rivalQ, rivalSlot);
      }
    }
    return ev;
  }

  _afterServe(p) {
    const freeSeats = this.world.seats.filter(s => !s.taken);
    if (Math.random() < ECON.sitChance && freeSeats.length) {
      const seat = freeSeats[(Math.random() * freeSeats.length) | 0];
      seat.taken = p; p.seat = seat; p.state = 'toSeat';
      p.path = [V3(seat.x, 0, seat.z)];
    } else this._leave(p);
  }

  _leave(p) {
    p.state = 'leaving'; p.queueRef = null; p.leaveT = 0;
    const out = [];
    if (p.pos.z < 5.8) out.push(V3(LAYOUT.door.x + (Math.random() - 0.5) * 2, 0, LAYOUT.door.z + 0.5)); // still inside — head for the door
    if (this.walkMul > 1.5) {
      out.push(V3(LAYOUT.door.x + (Math.random() - 0.5) * 6, 0, LAYOUT.pavementZ + 0.6)); // step off-camera, bow out
    } else {
      const exitL = Math.random() < 0.5;
      out.push(V3(exitL ? LAYOUT.spawnL.x : LAYOUT.spawnR.x, 0, LAYOUT.pavementZ + (Math.random() - 0.5)));
    }
    p.path = out;
  }

  _onArrive(p) {
    switch (p.state) {
      case 'walkingIn': p.state = 'toQueue'; break;   // through the door — now drift to your slot
      case 'toBrowse': p.state = 'browse'; p.dwell = 2 + (Math.random() * 4 | 0); break;
      case 'toSeat': p.state = 'sit'; p.dwell = 8 + (Math.random() * 14 | 0); p.face = p.seat.face; break;
      case 'defecting': p.state = 'inRivalQ'; break;
      case 'leaving': this._despawn(p); break;
    }
  }

  _despawn(p) {
    if (!p.active) return;
    p.active = false;
    if (p.seat) { p.seat.taken = null; p.seat = null; }
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const part of Object.values(this.parts)) { part.setMatrixAt(p.idx, z); part.instanceMatrix.needsUpdate = true; }
    this.free.push(p.idx);
    const i = this.patrons.indexOf(p); if (i >= 0) this.patrons.splice(i, 1);
  }

  randomPatron(near) {
    const cands = this.patrons.filter(p => p !== near && (p.state === 'sit' || p.state === 'inQueue'));
    if (!cands.length) return null;
    let best = null, bd = 1e9;
    for (const q of cands) { const d = q.pos.distanceTo(near.pos); if (d < bd) { bd = d; best = q; } }
    return best;
  }


  _paint(p) {
    // A named Regular gets a brass band on the hat (cohort colour) so they're
    // visibly a regular on the floor, not just a cohort-coloured patron.
    const hat = p.regularName
      ? this._c.copy(new THREE.Color(0xc9a227)).lerp(new THREE.Color(COHORTS[p.cohort]?.color ?? 0xffffff), 0.45)
      : this._c.copy(p.torso).lerp(new THREE.Color(0xffffff), 0.15);
    this.parts.torso.setColorAt(p.idx, p.torso);
    this.parts.head.setColorAt(p.idx, p.skin);
    this.parts.legL.setColorAt(p.idx, p.legs); this.parts.legR.setColorAt(p.idx, p.legs);
    this.parts.armL.setColorAt(p.idx, p.torso); this.parts.armR.setColorAt(p.idx, p.torso);
    this.parts.hat.setColorAt(p.idx, hat);
    this.parts.cup.setColorAt(p.idx, this._c.set(p.cupGreen ? 0x9fc46a : 0xf0ead8));
    for (const part of Object.values(this.parts)) if (part.instanceColor) part.instanceColor.needsUpdate = true;
  }

  // ---- per-frame: movement, walk cycle, matrix composition --------------------
  update(dt, walkMul, now) {
    this.walkMul = walkMul;
    const d = this._d; d.rotation.order = 'YXZ';
    const P = this.parts;
    for (const p of [...this.patrons]) {   // copy: arrivals can despawn mid-loop
      // movement: queue states slide toward their slot; everyone else walks waypoints.
      // The slide is speed-capped (no ice-skating) but 3x walk pace, so the line
      // advances fluidly at any sim speed and nobody chase-lags forever.
      let walking = false;
      const inQueueState = p.goal && (p.state === 'toQueue' || p.state === 'inQueue' || p.state === 'toRegister' || p.state === 'inRegisterQ' || p.state === 'inRivalQ');
      if (inQueueState) {
        const dx = p.goal.x - p.pos.x, dz = p.goal.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.15) {
          const step = Math.min(dist, p.speed * walkMul * 3 * dt);
          p.pos.x += (dx / dist) * step; p.pos.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let diff = want - p.face;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          p.face += diff * Math.min(1, dt * 10);
          walking = true;
        } else {
          const want = p.state === 'inRivalQ' ? 0 : Math.PI;   // in place — face the front
          let diff = want - p.face;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          p.face += diff * Math.min(1, dt * 6);
          if (p.state === 'toQueue') {
            p.state = 'inQueue'; p.waitMin = 0;
            if (p.regularName && !p.greeted && this.fx) {
              this.fx.bubble(p, `hi, ${p.regularName}`, 'good');
              p.greeted = true;
            }
          }
          else if (p.state === 'toRegister') { p.state = 'inRegisterQ'; p.waitMin = 0; }
        }
      } else if (p.path.length) {
        const t = p.path[0];
        const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = p.speed * walkMul * dt;
        if (dist <= Math.max(step, 0.06)) {
          p.pos.set(t.x, 0, t.z); p.path.shift();
          if (!p.path.length) { this._onArrive(p); if (!p.active) continue; }
        } else {
          p.pos.x += (dx / dist) * step; p.pos.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let diff = want - p.face;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          p.face += diff * Math.min(1, dt * 10);
          walking = true;
        }
      }
      p.walking = walking;
      if (p.state === 'leaving') {
        p.leaveT = (p.leaveT || 0) + dt;
        const ttl = walkMul > 5 ? 0.35 : walkMul > 1.5 ? 1.4 : Infinity;
        if (p.leaveT > ttl) { this._despawn(p); continue; }
      }
      p.phase += dt * (walking ? 7 * Math.min(walkMul, 2.2) : 1.4);
      if (p.flash > 0) {
        p.flash = Math.max(0, p.flash - dt * 1.6);
        this._c.copy(p.torso).lerp(RED, p.flash * 0.85);
        P.torso.setColorAt(p.idx, this._c); P.torso.instanceColor.needsUpdate = true;
      }

      const sitting = p.state === 'sit';
      const s = p.scale;
      const bob = walking ? Math.abs(Math.sin(p.phase)) * 0.05 : Math.sin(now * 0.0016 + p.idx * 1.7) * 0.012;
      const torsoY = (sitting ? 0.5 : 0.62) + bob;
      const headY = torsoY + 0.48 * s;
      const lean = walking ? 0.1 : 0;
      const legSwing = walking ? Math.sin(p.phase) * 0.6 : 0;
      const armSwing = walking ? -Math.sin(p.phase) * 0.45 : Math.sin(now * 0.0012 + p.idx) * 0.05;
      const headRy = walking ? 0 : Math.sin(now * 0.00045 + p.idx * 2.1) * 0.45;
      const fx = Math.sin(p.face), fz = Math.cos(p.face);   // forward
      const rx = Math.cos(p.face), rz = -Math.sin(p.face);  // right

      d.rotation.set(0, p.face, 0);
      d.position.set(p.pos.x, torsoY, p.pos.z); d.scale.setScalar(s);
      d.rotation.x = lean; d.updateMatrix(); P.torso.setMatrixAt(p.idx, d.matrix);

      d.rotation.set(0, p.face + headRy, 0);
      d.position.set(p.pos.x, headY, p.pos.z); d.updateMatrix(); P.head.setMatrixAt(p.idx, d.matrix);

      const hipY = 0.36 + bob * 0.5;
      d.position.set(p.pos.x - rx * 0.09 * s, hipY, p.pos.z - rz * 0.09 * s);
      d.rotation.set(legSwing, p.face, 0); d.scale.set(s, sitting ? 0.001 : s, s); d.updateMatrix();
      P.legL.setMatrixAt(p.idx, d.matrix);
      d.position.set(p.pos.x + rx * 0.09 * s, hipY, p.pos.z + rz * 0.09 * s);
      d.rotation.set(-legSwing, p.face, 0); d.updateMatrix();
      P.legR.setMatrixAt(p.idx, d.matrix);

      const shY = torsoY + 0.22 * s;
      d.scale.setScalar(s);
      d.position.set(p.pos.x - rx * 0.23 * s, shY, p.pos.z - rz * 0.23 * s);
      d.rotation.set(armSwing, p.face, 0); d.updateMatrix(); P.armL.setMatrixAt(p.idx, d.matrix);
      d.position.set(p.pos.x + rx * 0.23 * s, shY, p.pos.z + rz * 0.23 * s);
      d.rotation.set(-armSwing, p.face, 0); d.updateMatrix(); P.armR.setMatrixAt(p.idx, d.matrix);

      d.position.set(p.pos.x, headY + 0.13 * s, p.pos.z);
      d.rotation.set(0, p.face, 0); d.scale.setScalar(p.hasHat ? s : 0.001); d.updateMatrix();
      P.hat.setMatrixAt(p.idx, d.matrix);

      if (p.hasCup) {
        d.position.set(p.pos.x + fx * 0.24 * s + rx * 0.14 * s, torsoY + 0.1, p.pos.z + fz * 0.24 * s + rz * 0.14 * s);
        d.scale.setScalar(s); d.updateMatrix(); P.cup.setMatrixAt(p.idx, d.matrix);
      } else {
        d.position.set(0, -10, 0); d.scale.setScalar(0.001); d.updateMatrix(); P.cup.setMatrixAt(p.idx, d.matrix);
      }
    }
    for (const part of Object.values(P)) part.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (let i = this.patrons.length - 1; i >= 0; i--) this._despawn(this.patrons[i]);
    this.counterQ = []; this.registerQ = []; this.rivalQ = []; this.rivalClock = 0;
  }
}

