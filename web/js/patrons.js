// Patrons — hundreds of little people, 8 draw calls, one real queue line.
// The line out the door IS the chart.
import * as THREE from '../vendor/three.module.js';
import { COHORTS, LAYOUT, ECON, CAMPAIGN, counterSlot, registerSlot, rivalSlot, MAX_VISIBLE_QUEUE } from './config.js';
import { salePrice } from './economy.js';
import { rivalChoiceProbability } from './rival.js';
import { memoryLine, shouldBringCompanion } from './identity.js';
import { DRINKS, rollDrink } from './menu.js';
import { gaitFor, moodFor, samplePose, propSway } from './poses.js';

const MAXP = ECON.maxPatrons;
const SKIN = [0xf2c89a, 0xe0ac82, 0xc98a5e, 0xa06a42, 0x7a4e30, 0x5e3a24];
const LEGS = [0x2a2c34, 0x3a3230, 0x24303a];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RED = new THREE.Color(0xd0503a);

export class PatronSystem {
  constructor(scene, world, regulars = null, exchange = null, fx = null, { random = Math.random, walkins = null } = {}) {
    this.world = world;
    this.regulars = regulars;     // for named-patron flagging
    this.walkins = walkins;       // Phase 1 — day-pool of generated walk-in heads
    this.menuOffered = null;      // Phase 3 — {drink: bool} 86 board (null = everything offered)
    this.skillPts = 0;            // Phase 3 — Ruth's skill bonus bar-points, set at dawn
    this.truceCeasefire = false;  // Phase 4 — Saturday ceasefire: no rival-bound spawns
    this.exchange = exchange;     // for contract unit consumption
    this.fx = fx;                 // for greeting bubbles on join
    this.patrons = [];
    this.free = [];
    this.counterQ = []; this.registerQ = []; this.rivalQ = [];
    this.rivalClock = 0;
    this.rivalCredit = 0;
    this.rivalChoices = 0;
    this.rivalStrategy = 'DEFAULT';
    this.dwellMul = 1;
    this.random = random;
    this.apprenticeActive = false;
    this.staffMul = 1;   // <1 short-staffed — the bar spends fewer prep-points a tick
    this.balkMul = 1;    // >1 impatient floor — they walk sooner
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();

    const mk = (geo, rough = 0.8) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: rough }), MAXP);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true; m.frustumCulled = false;
      m.count = MAXP;
      scene.add(m); return m;
    };
    const mkProp = (geo, color, rough = 0.6) => {
      // PR-A2 — prop meshes are colored by cohort (slightly tinted prop
      // material per rig). One InstancedMesh per rig type, MAXP instances.
      const mat = new THREE.MeshStandardMaterial({ color, roughness: rough });
      const m = new THREE.InstancedMesh(geo, mat, MAXP);
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
    // PR-A2 — Cohort prop rigs. One InstancedMesh per prop type, all sized
    // to MAXP. The first prop in COHORTS[cohort].props is the primary rig
    // — the data already flows through patrons.js (spawn copies ritualProps
    // onto each patron), so we just resolve a prop key per patron here.
    this.propMeshes = {
      briefcase: mkProp(new THREE.BoxGeometry(0.10, 0.13, 0.20), 0x4a3423, 0.7),    // walnut
      laptop:    mkProp(new THREE.BoxGeometry(0.22, 0.015, 0.15), 0x2a2c34, 0.55),   // dark grey
      mug:       mkProp(new THREE.CylinderGeometry(0.045, 0.038, 0.08, 8), 0xefe6d3, 0.5),  // cream
      backpack:  mkProp(new THREE.BoxGeometry(0.18, 0.24, 0.10), 0x86a860, 0.7),    // matcha green
      notebook:  mkProp(new THREE.BoxGeometry(0.10, 0.012, 0.14), 0xc9a227, 0.5),   // brass
      cane:      mkProp(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), 0x4a3423, 0.5), // walnut
      camera:    mkProp(new THREE.BoxGeometry(0.07, 0.055, 0.04), 0x171310, 0.45),   // ink
    };
    // Anchor map: where each prop sits relative to the body. Names match
    // the local-coordinate slots used inside the per-frame update loop.
    this.propAnchors = {
      briefcase: 'rightHip',
      laptop:    'chestFront',
      mug:       'rightHand',
      backpack:  'upperBack',
      notebook:  'leftHand',
      cane:      'rightHandGround',
      camera:    'chestFront',
    };
    // zero-scale everything
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const part of Object.values(this.parts)) for (let i = 0; i < MAXP; i++) part.setMatrixAt(i, z);
    // PR-A2 — zero-scale all prop instances at startup; the per-frame loop
    // updates them only when a patron actually carries that rig.
    for (const prop of Object.values(this.propMeshes)) for (let i = 0; i < MAXP; i++) prop.setMatrixAt(i, z);
    for (let i = MAXP - 1; i >= 0; i--) this.free.push(i);
    // regularIdx -> Set<patron>: which live patrons represent a given named
    // regular. The gossip router uses this to find a friend-of-friend who is
    // currently on the floor.
    this.regularsByIdx = new Map();
  }

  get count() { return MAXP - this.free.length; }
  get queueLength() { return this.counterQ.filter(p => p.state === 'inQueue').length; }

  spawn(cohort, zone, quick = false, viaCompanion = false) {
    if (!this.free.length) return null;
    const idx = this.free.pop();
    const fromLeft = Math.random() < 0.5;
    const s = fromLeft ? LAYOUT.spawnL : LAYOUT.spawnR;
    const torso = new THREE.Color(COHORTS[cohort]?.color ?? 0xaaaaaa).lerp(new THREE.Color(0x888888), 0.12);
    // PR-6 — cohort rituals: walk pace + which prop they carry + which
    // table they'll claim. The cohort config owns these so the floor
    // reads as five rooms, not one.
    const cohortDef = COHORTS[cohort] ?? {};
    const ritualProps = Array.isArray(cohortDef.props) ? cohortDef.props : [];
    const ritualSeat = (typeof cohortDef.seat === 'number' && cohortDef.seat >= 0) ? cohortDef.seat : null;
    const ritualDwell = (typeof cohortDef.dwellMul === 'number') ? cohortDef.dwellMul : 1.0;
    const ritualSpeed = (typeof cohortDef.walkSpeed === 'number') ? cohortDef.walkSpeed : 2.1;
    // Phase 3 — the order: weighted by cohort, honoring the 86 board.
    // wantsMatcha stays as the legacy flag so batch/balk/price paths read on.
    const drink = rollDrink(cohort, this.menuOffered, this.random);
    const p = {
      idx, active: true, cohort, zone,
      drink, wantsMatcha: drink === 'matcha',
      pos: V3(s.x, 0, s.z + (Math.random() - 0.5) * 1.4), face: fromLeft ? Math.PI / 2 : -Math.PI / 2,
      path: [], state: 'walking', waitMin: 0, dwell: 0,
      speed: ritualSpeed + (Math.random() - 0.5) * 0.3, phase: Math.random() * 6.28,
      jx: (Math.random() - 0.5) * 0.24, jz: (Math.random() - 0.5) * 0.2,
      seat: null, hasCup: false, cupGreen: false, hasHat: Math.random() < 0.45,
      torso, skin: new THREE.Color(SKIN[(Math.random() * SKIN.length) | 0]),
      legs: new THREE.Color(LEGS[(Math.random() * LEGS.length) | 0]),
      flash: 0, colorDirty: true, queueRef: null, slotI: -1, walking: true,
      scale: 0.92 + Math.random() * 0.16,
      regularName: null, regularIdx: -1, greeted: false,
      regularFriends: null,   // Set<string> of friend names, populated if named
      // Phase 1 — identity: roster regulars fill canon fields below;
      // walk-ins draw a generated head from the day pool. Same fields both
      // paths so greetings/dossiers never branch on population.
      pid: null, pname: null, faceSeed: null, preferredDrink: null,
      stage: 'visitor', visits: 0, broughtFriend: null,
      // PR-6 ritual record — survives the spawn so analytics + greeting
      // bubbles can show which cohort the patron belongs to without
      // re-resolving COHORTS[] every tick.
      ritualProps, ritualSeat, ritualDwell,
      // Phase 5 — pose/react state: opinion drives mood faces, reactT counts
      // down a 0.9s serve/balk reaction blended in update().
      op: 0, reactT: 0, reactKind: null,
    };
    let toRival = false;
    // Phase 4 — ceasefire Saturday: nobody crosses, neither way.
    if (zone === 'counter' && !this.truceCeasefire && this.rivalQ.length < 42) {
      const ourPrice = this.exchange ? salePrice(this.exchange, this.repriced) : ECON.matchaFull;
      const op = this.regulars ? (this.regulars.reputation - 50) / 50 : 0;
      const pr = rivalChoiceProbability({
        strategy: this.rivalStrategy, cohort, ourPrice, op,
        ourQueue: this.queueLength, rivalQueue: this.rivalQ.length,
      });
      if (this.random() < pr) toRival = true;
    }
    // Is this spawn a named Regular? If so, mark seen, tag the patron, and
    // emit a one-line greeting when they actually join the queue.
    if (!toRival && this.regulars && zone === 'counter') {
      const r = this.regulars.markSeen(cohort);
      if (r.found) {
        p.regularName = r.name; p.regularIdx = r.idx; p.hasHat = true;
        // Phase 1 — canon identity: roster history rides on the patron.
        p.pid = `roster-${r.name}`; p.pname = r.name; p.faceSeed = r.name;
        p.preferredDrink = r.drink; p.stage = r.stage; p.visits = r.visits;
        // copy the friend list onto the patron so the gossip router can route
        // by name (without re-walking the Regulars graph on every bubble)
        const reg = this.regulars.regulars[r.idx];
        p.regularFriends = new Set(reg?.friends ?? []);
        let set = this.regularsByIdx.get(r.idx);
        if (!set) { set = new Set(); this.regularsByIdx.set(r.idx, set); }
        set.add(p);
      }
    }
    // Phase 1 — walk-in identity: draw a generated head from the day pool so
    // strangers accumulate visits and can graduate. Roster spawns skip this.
    if (!toRival && !p.regularName && this.walkins && zone === 'counter') {
      const head = this.walkins.draw(cohort);
      if (head) {
        p.pid = head.pid; p.pname = head.name; p.faceSeed = head.faceSeed;
        p.preferredDrink = head.drink; p.stage = head.stage; p.visits = head.visits;
      }
    }
    // Phase 1 — friends bring a +1: a friend-stage arrival sometimes spawns a
    // visitor companion on the spot. viaCompanion guards the recursion (one
    // level); spawn's null return guards a full floor.
    if (!toRival && !viaCompanion && shouldBringCompanion(p.stage, this.random)) {
      const c = this.spawn(cohort, zone, quick, true);
      if (c && c !== p) {
        c.companionOf = p.pid || p.regularName;
        p.broughtFriend = c.pname || 'a friend';
      }
    }
    // The 11:00 ask's party — stamp members during the rush so the evening
    // card can count who stayed and who walked.
    if (!toRival && zone === 'counter' && this.party && !this.party.declined
        && this.partyActive && this.party.left > 0 && cohort === this.party.cohort) {
      p.partyMember = true;
      this.party.left--;
    }
    this.patrons.push(p);
    const door = V3(LAYOUT.door.x + (Math.random() - 0.5) * 2.2, 0, LAYOUT.door.z + 0.5);
    if (toRival) {
      p.rivalOrigin = 'choice'; p.queueRef = 'rival'; this.rivalChoices++;
      this.rivalQ.push(p);
      p.goal = this._slotPos(rivalSlot, this.rivalQ.length - 1, p);
      if (quick) { p.state = 'inRivalQ'; p.pos.set(p.goal.x + (Math.random() - 0.5), 0, p.goal.z + 0.6 + Math.random() * 0.4); }
      else {
        p.state = 'defecting';
        p.path = [V3(LAYOUT.crossX, 0, LAYOUT.pavementZ), V3(LAYOUT.crossX, 0, 14.6)];
      }
    } else if (zone === 'counter') {
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

    // serve from the counter — the bar spends prep-points each minute.
    // Phase 3: points follow the drink (espresso fast, filter slow, matcha
    // slowest unless batched). Milky orders need milk stock (ctx.milkStock);
    // a dry bar loses the order to a balk, flagged once via ctx.milkOut.
    let points = (ECON.barPoints + (this.skillPts || 0)) * (this.staffMul || 1), servedN = 0;
    for (let i = 0; i < this.counterQ.length && points > 0 && servedN < ECON.servePerTick;) {
      const p = this.counterQ[i];
      if (p.state !== 'inQueue') { i++; continue; }
      const fromBatch = p.wantsMatcha && (ctx.batchUnits || 0) > 0 && dayMin >= (ctx.batchReservedUntil || 0);
      // Phase 3 — drink drives points; legacy mock patrons without a drink
      // fall back to the wantsMatcha flag.
      const dk = p.drink || (p.wantsMatcha ? 'matcha' : 'flatwhite');
      const cost = dk === 'matcha' ? (fromBatch ? ECON.prepBatched : ECON.prepMatcha) : (DRINKS[dk]?.points ?? ECON.prepOther);
      if (cost > points) { i++; continue; }   // bar's busy — cheaper orders slip ahead
      if (DRINKS[dk]?.milk && ctx.milkStock != null && ctx.milkStock <= 0) {
        this.counterQ.splice(i, 1);
        p.flash = 1; p.colorDirty = true;
        ev.push({ type: 'balked', p, milkOut: true });
        ctx.milkOut = true;
        this._leave(p);
        continue;
      }
      this.counterQ.splice(i, 1); points -= cost; servedN++;
      if (DRINKS[dk]?.milk && ctx.milkStock != null) { ctx.milkStock--; ctx.milky = (ctx.milky || 0) + 1; }
      if (fromBatch) ctx.batchUnits = Math.max(0, ctx.batchUnits - 1);
      p.hasCup = true; p.cupGreen = p.wantsMatcha; p.colorDirty = true;
      // Batch cups were paid at prep (£1 each) — skip the bean charge and
      // don't burn a hedge unit on inventory already bought. Phase 2:
      // non-batch matcha keeps legacy bean math; other cups pour the house lot.
      let cup;
      if (fromBatch) cup = { beanCost: 0, spotCost: 0, hedged: false, prepaid: true };
      else cup = this.exchange ? this.exchange.purchaseCup(p.wantsMatcha ? 'matcha' : 'other') : { beanCost: 0, spotCost: 0, hedged: false };
      // Phase 3 — the ticket: matcha at the board price, everything else at
      // its menu price (staged in the Brief, committed at OPEN).
      const ticket = dk === 'matcha'
        ? (this.exchange ? salePrice(this.exchange, ctx.repriced) : ECON.matchaFull)
        : (ctx.menuPrices?.[dk] ?? ECON.other);
      ev.push({ type: 'served', p, isMatcha: p.wantsMatcha, price: ticket, fromBatch, ...cup });
      // Phase 5 — the serve lands on camera: a 0.9s mood reaction.
      p.reactKind = 'serve'; p.reactT = 0.9;
      p.op = (Number.isFinite(p.op) ? p.op : 0) + 0.2;
      this._afterServe(p);
    }
    this._layoutQ(this.counterQ, counterSlot);

    // balks — matcha waiters who've had enough walk to the chain
    for (let i = this.counterQ.length - 1; i >= 0; i--) {
      const p = this.counterQ[i];
      const balkChance = ECON.balkChance * (this.repriced ? 0.25 : 1) * (this.balkMul || 1);   // a deal buys patience; a bad floor loses it
      const hasBatch = (ctx.batchUnits || 0) > 0 && dayMin >= (ctx.batchReservedUntil || 0);
      if (p.state === 'inQueue' && p.wantsMatcha && !hasBatch && p.waitMin > ECON.balkAfter && Math.random() < balkChance) {
        this.counterQ.splice(i, 1);
        p.flash = 1; p.colorDirty = true;
        // Phase 5 — walk-outs grumble on camera.
        p.reactKind = 'grumble'; p.reactT = 0.9;
        p.op = (Number.isFinite(p.op) ? p.op : 0) - 0.08;
        ev.push({ type: 'balked', p });
        // Phase 4 — ceasefire Saturday: walk-outs walk, they don't defect.
        if (!this.truceCeasefire && Math.random() < 0.7 && this.rivalQ.length < 42) {
          p.state = 'defecting'; p.queueRef = 'rival'; p.rivalOrigin = 'defection'; this.rivalQ.push(p);
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
        // Phase 3 — register honors the drink: matcha pours powder at the
        // board price, the rest pour the house lot at menu prices. Milky
        // orders need milk stock, same as the bar.
        const rdk = p.drink || (p.wantsMatcha ? 'matcha' : 'flatwhite');
        if (DRINKS[rdk]?.milk && ctx.milkStock != null && ctx.milkStock <= 0) {
          this.registerQ.splice(i, 1);
          p.flash = 1; p.colorDirty = true;
          ev.push({ type: 'balked', p, milkOut: true });
          ctx.milkOut = true;
          this._leave(p);
          continue;
        }
        this.registerQ.splice(i, 1); regN++;
        if (DRINKS[rdk]?.milk && ctx.milkStock != null) { ctx.milkStock--; ctx.milky = (ctx.milky || 0) + 1; }
        const regMatcha = rdk === 'matcha';
        const cup = this.exchange ? this.exchange.purchaseCup(regMatcha ? 'matcha' : 'other') : { beanCost: 0, spotCost: 0, hedged: false };
        const regPrice = regMatcha
          ? (this.exchange ? salePrice(this.exchange, ctx.repriced) : ECON.matchaFull)
          : (ctx.menuPrices?.[rdk] ?? ECON.other);
        ev.push({ type: 'served', p, isMatcha: regMatcha, price: regPrice, viaRegister: true, ...cup });
        if (Math.random() < 0.12) this._afterServe(p); else this._leave(p);
      } else i++;
    }
    this._layoutQ(this.registerQ, registerSlot);

    // browsers finish browsing; sitters finish their cups + sip at dwell==4
    for (let j = this.patrons.length - 1; j >= 0; j--) {
      const p = this.patrons[j];
      if (p.state === 'browse' && --p.dwell <= 0) {
        p.state = 'toRegister'; p.queueRef = 'register'; this.registerQ.push(p);
        p.goal = this._slotPos(registerSlot, this.registerQ.length - 1, p);
        this._layoutQ(this.registerQ, registerSlot);
      } else if (p.state === 'sit') {
        if (p.sipAt != null && p.dwell === p.sipAt) { p.sipping = 2; if (this.fx) this.fx.steam.spawn(p.pos.x, 1.05, p.pos.z, 0, 0.22, 0, 0.9, 0.35); }
        if (p.sipping) p.sipping--;
        if (--p.dwell <= 0) this._leave(p);
      }
    }

    // the chain serves slowly — one every two minutes
    const stratDef = CAMPAIGN.rivalStrategies[this.rivalStrategy] || {};
    const rivalReady = this.rivalQ.length > 0 && this.rivalQ[0].state === 'inRivalQ';
    this.rivalCredit += 0.5 * (stratDef.speedMul || 1);
    if (!rivalReady) this.rivalCredit = Math.min(1, this.rivalCredit);
    while (this.rivalCredit >= 1 - 1e-9 && this.rivalQ.length && this.rivalQ[0].state === 'inRivalQ') {
      const p = this.rivalQ.shift();
      this.rivalCredit = Math.max(0, this.rivalCredit - 1);
      p.state = 'leaving'; p.queueRef = null;
      p.path = [V3(p.pos.x + 5, 0, 15.4)];
      ev.push({ type: 'rivalServed', p });
    }
    this._layoutQ(this.rivalQ, rivalSlot);
    return ev;
  }

  _afterServe(p) {
    const freeSeats = this.world.seats.filter(s => !s.taken);
    if (Math.random() < ECON.sitChance && freeSeats.length) {
      // PR-6 — cohort ritual: prefer the table the cohort claims first.
      // Falls through to a random free seat if their table is taken.
      let seat = null;
      if (p.ritualSeat != null && this.world.seats[p.ritualSeat] && !this.world.seats[p.ritualSeat].taken) {
        seat = this.world.seats[p.ritualSeat];
      } else {
        seat = freeSeats[(Math.random() * freeSeats.length) | 0];
      }
      seat.taken = p; p.seat = seat; p.state = 'toSeat';
      p.path = [V3(seat.x, 0, seat.z)];
      // Phase 1 — they stayed: flip the last session event to stayed so the
      // dossier can tell "served and stayed a while" from "served and left".
      if (p.regularIdx >= 0 && this.regulars) {
        const evs = this.regulars.regulars[p.regularIdx]?.events;
        const last = evs?.[evs.length - 1];
        if (last && last.outcome === 'served') last.stayed = true;
      } else if (p.pid && this.walkins) {
        const head = this.walkins.get(p.pid);
        const last = head?.events[head.events.length - 1];
        if (last && last.outcome === 'served') last.stayed = true;
      }
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
      case 'toSeat': p.state = 'sit'; p.dwell = Math.round((8 + (Math.random() * 14 | 0)) * this.dwellMul); p.face = p.seat.face; p.sipAt = Math.max(1, p.dwell - 4); break;
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
    // PR-A2 — also zero-scale the prop instance so the rig disappears when
    // the patron leaves the floor.
    if (this.propMeshes) for (const prop of Object.values(this.propMeshes)) { prop.setMatrixAt(p.idx, z); prop.instanceMatrix.needsUpdate = true; }
    this.free.push(p.idx);
    const i = this.patrons.indexOf(p); if (i >= 0) this.patrons.splice(i, 1);
    // unregister from the regularsByIdx map (if this patron was a named regular)
    if (p.regularIdx >= 0) {
      const set = this.regularsByIdx.get(p.regularIdx);
      if (set) { set.delete(p); if (set.size === 0) this.regularsByIdx.delete(p.regularIdx); }
    }
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

  // PR-A2 — resolve a patron's primary prop key from its cohort ritual.
  // Returns null when the cohort has no props (e.g. rival).
  _propKeyFor(p) {
    const props = (p && p.ritualProps) || [];
    return props.length ? props[0] : null;
  }

  // PR-A2 — position a prop mesh at the body anchor slot for this patron.
  // The matrices are written into `d` (the same scratch Object3D used for
  // body parts). Anchors read from propAnchors above. propKey tells which
  // rig this is (so laptop/camera can fold into a seated pose); sitting is
  // p.state === 'sit' from the per-frame loop.
  _placeProp(d, p, anchor, propKey, sitting, shY, torsoY, headY, hipY, rx, rz, fx, fz, s, walking) {
    d.rotation.set(0, p.face, 0);
    d.scale.setScalar(s);
    const sway = propSway(p.phase, gaitFor(p.cohort), walking);
    switch (anchor) {
      case 'rightHip':
        // briefcase — held at right hip, swinging slightly forward
        d.position.set(p.pos.x + rx * 0.18 * s, hipY - 0.04, p.pos.z + rz * 0.18 * s);
        d.rotation.set(sway, p.face, 0);
        break;
      case 'chestFront':
        if (propKey === 'laptop' && sitting) {
          // laptop on the lap — tilted forward, dropped to lap height
          d.position.set(p.pos.x + fx * 0.20 * s, hipY + 0.18, p.pos.z + fz * 0.20 * s);
          d.rotation.set(-0.55, p.face, 0);
        } else if (propKey === 'camera' && sitting) {
          // camera raised to the eye — held up to look through the viewfinder
          d.position.set(p.pos.x + fx * 0.18 * s, headY - 0.02, p.pos.z + fz * 0.18 * s);
          d.rotation.set(0.18, p.face, 0);
        } else {
          // standing — laptop/camera held in front of chest, slightly down
          d.position.set(p.pos.x + fx * 0.22 * s, torsoY + 0.08, p.pos.z + fz * 0.22 * s);
          d.rotation.set(-0.3, p.face, 0);
        }
        break;
      case 'upperBack':
        // backpack — on the back, behind torso
        d.position.set(p.pos.x - fx * 0.12 * s, torsoY + 0.05, p.pos.z - fz * 0.12 * s);
        d.rotation.set(0, p.face, 0);
        break;
      case 'rightHand':
        // mug / notebook — at the right-hand level, slightly forward
        d.position.set(p.pos.x + fx * 0.20 * s + rx * 0.22 * s, shY - 0.04, p.pos.z + fz * 0.20 * s + rz * 0.22 * s);
        d.rotation.set(-0.2 + sway * 0.5, p.face, 0);
        break;
      case 'leftHand':
        d.position.set(p.pos.x + fx * 0.20 * s - rx * 0.22 * s, shY - 0.04, p.pos.z + fz * 0.20 * s - rz * 0.22 * s);
        d.rotation.set(-0.2 - sway * 0.5, p.face, 0);
        break;
      case 'rightHandGround':
        // cane — extends from right hand down to the floor
        d.position.set(p.pos.x + fx * 0.06 * s + rx * 0.18 * s, hipY - 0.10, p.pos.z + fz * 0.06 * s + rz * 0.18 * s);
        d.rotation.set(-0.08 + sway * 0.3, p.face, 0);
        break;
      default:
        d.position.set(p.pos.x, hipY, p.pos.z);
    }
  }

  // Phase 1 — arrival line for a patron joining the queue. Canon regulars
  // with history (or an established baseline) get a memory line; first
  // sightings get the classic hello; returning walk-ins get theirs;
  // strangers get nothing (their hello is the first-timer toast at serve).
  _greetingFor(p) {
    if (p.regularName && this.regulars) {
      const reg = this.regulars.regulars[p.regularIdx];
      if (!reg) return `hi, ${p.regularName}`;
      const returning = reg.visits > 5 || reg.events.length > 0;
      if (!returning) return `hi, ${p.regularName}`;
      return memoryLine({
        name: p.regularName, stage: reg.stage, visits: reg.visits,
        drink: reg.drink, quirk: reg.quirk, broughtFriend: p.broughtFriend,
      });
    }
    if (p.pid && this.walkins) {
      const head = this.walkins.get(p.pid);
      if (head && head.visits > 0) {
        return memoryLine({
          name: head.name, stage: head.stage, visits: head.visits,
          drink: head.drink, broughtFriend: p.broughtFriend,
        });
      }
    }
    return null;
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
            if (!p.greeted && this.fx) {
              const line = this._greetingFor(p);
              const gk = p.pname || p.regularName || p;
              const seen = this.fx._greeted && this.fx._greeted.has(gk);
              if (line && !seen && this.fx.bubble(p, line, 'good')) {
                if (this.fx.greetOnce) this.fx.greetOnce(gk);
                p.greeted = true;
              }
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
      // Phase 5 — reactions decay on the frame clock.
      if (p.reactT > 0) p.reactT = Math.max(0, p.reactT - dt);
      if (p.state === 'leaving') {
        p.leaveT = (p.leaveT || 0) + dt;
        const ttl = walkMul > 5 ? 0.35 : walkMul > 1.5 ? 1.4 : Infinity;
        if (p.leaveT > ttl) { this._despawn(p); continue; }
      }
      p.phase += dt * (walking ? 7 * gaitFor(p.cohort).freqMul * Math.min(walkMul, 2.2) : 1.4);
      if (p.flash > 0) {
        p.flash = Math.max(0, p.flash - dt * 1.6);
        this._c.copy(p.torso).lerp(RED, p.flash * 0.85);
        P.torso.setColorAt(p.idx, this._c); P.torso.instanceColor.needsUpdate = true;
      }

      // Phase 5 — pose clips: one sample carries walk/sit/sip/react.
      const sipping = p.sipping > 0;
      const sitting = p.state === 'sit';
      const s = p.scale;
      const mood = moodFor(p.op);
      const pose = samplePose({
        phase: p.phase, gait: gaitFor(p.cohort), walking,
        nowMs: now, idx: p.idx, sitting,
        sipT: sipping ? 0.5 : -1,
        reactT: p.reactT > 0 ? 1 - p.reactT / 0.9 : -1,
        reactKind: p.reactT > 0 ? p.reactKind : null, mood,
      });
      const bob = pose.bob;
      const torsoY = (sitting ? 0.5 : 0.62) + bob;
      const headY = torsoY + 0.48 * s + (sipping ? -0.04 : 0) - pose.headDip;
      const lean = pose.lean;
      const legSwing = pose.legSwing;
      const armSwing = pose.armL;
      const armSwingR = pose.armR;
      const headRy = pose.headRy;
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
      d.rotation.set(-armSwingR, p.face, 0); d.updateMatrix(); P.armR.setMatrixAt(p.idx, d.matrix);

      d.position.set(p.pos.x, headY + 0.13 * s, p.pos.z);
      d.rotation.set(0, p.face, 0); d.scale.setScalar(p.hasHat ? s : 0.001); d.updateMatrix();
      P.hat.setMatrixAt(p.idx, d.matrix);

      if (p.hasCup) {
        d.position.set(p.pos.x + fx * 0.24 * s + rx * 0.14 * s, torsoY + 0.1, p.pos.z + fz * 0.24 * s + rz * 0.14 * s);
        d.scale.setScalar(s); d.updateMatrix(); P.cup.setMatrixAt(p.idx, d.matrix);
      } else {
        d.position.set(0, -10, 0); d.scale.setScalar(0.001); d.updateMatrix(); P.cup.setMatrixAt(p.idx, d.matrix);
      }

      // PR-A2 — Cohort prop rig. Position the cohort's primary prop at its
      // anchor slot relative to the body. The local coords mirror the body
      // matrix composition above (rx/rz = right vector, fx/fz = forward).
      const propKey = this._propKeyFor(p);
      if (propKey && this.propMeshes[propKey]) {
        const anchor = this.propAnchors[propKey];
        this._placeProp(d, p, anchor, propKey, sitting, shY, torsoY, headY, hipY, rx, rz, fx, fz, s, walking);
        d.updateMatrix();
        this.propMeshes[propKey].setMatrixAt(p.idx, d.matrix);
        // Phase 5 — one verb per prop: camera flash, laptop glow, cup
        // steam, cane tap. Rare by design (reads as event, not noise).
        try {
          const verbR = Math.random();
          if (this.fx && propKey === 'camera' && sitting && verbR < 0.025) {
            this.fx.flash(d.position.x, d.position.y + 0.1, d.position.z);
          } else if (this.fx && propKey === 'laptop' && sitting && verbR < 0.045) {
            this.fx.sparkle(d.position.x, d.position.y + 0.1, d.position.z);
          } else if (this.fx && propKey === 'mug' && p.hasCup && verbR < 0.05) {
            this.fx.steam(p.pos.x, torsoY + 0.15, p.pos.z);
          } else if (this.fx && propKey === 'cane' && walking && verbR < 0.015) {
            this.fx.puff(p.pos.x, 0.15, p.pos.z, { n: 2, shade: 0.5 });
          }
        } catch { /* a verb never breaks the frame */ }
      }
    }
    for (const part of Object.values(P)) part.instanceMatrix.needsUpdate = true;
    // PR-A2 — prop instances have their own InstancedMeshes; flush each one.
    if (this.propMeshes) for (const prop of Object.values(this.propMeshes)) prop.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (let i = this.patrons.length - 1; i >= 0; i--) this._despawn(this.patrons[i]);
    this.counterQ = []; this.registerQ = []; this.rivalQ = []; this.rivalClock = 0; this.rivalCredit = 0; this.rivalChoices = 0;
    this.staffMul = 1; this.balkMul = 1; this.dwellMul = 1;
  }
}

