// Patrons — hundreds of little people, 8 draw calls, one real queue line.
// The line out the door IS the chart.
import * as THREE from '../vendor/three.module.js';
import { COHORTS, LAYOUT, ECON, CAMPAIGN, counterSlot, registerSlot, rivalSlot, MAX_VISIBLE_QUEUE } from './config.js';
import { salePrice } from './economy.js';
import { rivalChoiceProbability, rivalWalkbackChance, FULL_ROOM_PULL } from './rival.js';
import { memoryLine, shouldBringCompanion } from './identity.js';
import { DRINKS, rollDrink, balkLimit, balkChanceFor, preferredOnBoard, PASTRY, EMPTY_CASE_WALK, eightySixedShare, menuPrice } from './menu.js';
import { gaitFor, moodFor, samplePose, propSway } from './poses.js';
import { floorSeatBudget, isInsidePatron, planVisualSitters, spreadSeats } from './floorSeats.js';
import { axesFor } from './impact.js';

const MAXP = ECON.maxPatrons;
const SKIN = [0xf2c89a, 0xe0ac82, 0xc98a5e, 0xa06a42, 0x7a4e30, 0x5e3a24];
const LEGS = [0x2a2c34, 0x3a3230, 0x24303a];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RED = new THREE.Color(0xd0503a);
const GLASS = new THREE.Color(0x7fb3b0);

export class PatronSystem {
  constructor(scene, world, regulars = null, exchange = null, fx = null, { random = Math.random, walkins = null } = {}) {
    this.world = world;
    this.regulars = regulars;     // for named-patron flagging
    this.walkins = walkins;       // Phase 1 — day-pool of generated walk-in heads
    this.menuOffered = null;      // Phase 3 — {drink: bool} 86 board (null = everything offered)
    // Phase 3 — live board prices (set at dawn); null = base
    this.menuPrices = null;       // live menu; matcha is overwritten by the board
    this.priceMult = 1;           // shock price multiplier, separate from the menu
    this.skillPts = 0;            // Phase 3 — Ruth's skill bonus bar-points, set at dawn
    this.truceCeasefire = false;  // Phase 4 — Saturday ceasefire: no rival-bound spawns
    this.turnaways = 0;         // board turnaways (86'd first choice walked, never queued)
    this.exchange = exchange;     // for contract unit consumption
    this.fx = fx;                 // for greeting bubbles on join
    this.patrons = [];
    this.free = [];
    this.counterQ = []; this.registerQ = []; this.rivalQ = []; this._boardEvents = [];
    this.rivalClock = 0;
    this.rivalCredit = 0;
    this.rivalChoices = 0;
    this.rivalStrategy = 'DEFAULT';
    this.dwellMul = 1;
    this.random = random;
    this.apprenticeActive = false;
    this.staffMul = 1;   // <1 short-staffed — the bar spends fewer prep-points a tick
    this.capacityMult = 1; // shock capacity, separate from staffMul / Ruth's condition
    this.shockStaff = 0;   // extra hands from a merged shock; not a condition write
    this.reach = 1;        // marketing reach — weights who crosses, and the wave that spawned them
    this.cupQuality = 1;   // house-lot cup, 1 fresh; pulls the rival split
    this.balkMul = 1;    // >1 impatient floor — they walk sooner
    this._floorSitters = []; // patrons shown in a chair; follows who is inside
    this._reduced = false;
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

  _orderPrices() {
    const prices = { ...(this.menuPrices || {}) };
    for (const id of Object.keys(DRINKS)) if (prices[id] == null) prices[id] = DRINKS[id].base;
    if (this.exchange) prices.matcha = salePrice(this.exchange, this.repriced);
    return prices;
  }

  _priceOf(id) {
    const prices = this._orderPrices();
    const ticket = prices[id] ?? DRINKS[id]?.base ?? ECON.other;
    const mult = this.priceMult ?? 1;
    return ticket * mult;
  }

  // The regular markSeen would pick, without marking them. The street
  // price needs their usual before we know whether they cross.
  _pendingRegular(cohort) {
    const reg = this.regulars;
    if (!reg || !Array.isArray(reg.regulars)) return null;
    const only = this.markSeenOnly || null;
    const cands = reg.regulars.filter(r => r && !r.seen && !r._spawned && r.coh === cohort && r.absence !== 'away' && r.absence !== 'lost' && (!only || only.has(r.name)));
    if (!cands.length) return null;
    return cands[(this.random() * cands.length) | 0];
  }

  _attachRegular(p, r) {
    if (!r || !r.found) return;
    p.regularName = r.name; p.regularIdx = r.idx; p.hasHat = true;
    // Phase 1 — canon identity: roster history rides on the patron.
    p.pid = `roster-${r.name}`; p.pname = r.name; p.faceSeed = r.name;
    p.preferredDrink = r.drink; p.stage = r.stage; p.visits = r.visits;
    // copy the friend list onto the patron so the gossip router can route
    // by name (without re-walking the Regulars graph on every bubble)
    const roster = this.regulars && Array.isArray(this.regulars.regulars) ? this.regulars.regulars : null;
    const reg = roster ? roster[r.idx] : null;
    p.regularFriends = new Set(reg?.friends ?? []);
    let set = this.regularsByIdx.get(r.idx);
    if (!set) { set = new Set(); this.regularsByIdx.set(r.idx, set); }
    set.add(p);
  }

  _roomFull() {
    const seats = this.world && this.world.seats;
    return Array.isArray(seats) && seats.length > 0 && seats.every(s => s && s.taken);
  }

  _highDwell(p) {
    return (p.ritualDwell || 1) * (this.dwellMul || 1) > 1;
  }

  _rivalPull(cohort, drinkId, op, campPull = 0) {
    const mult = this.priceMult ?? 1;
    let ourPrice, boardDelta = 0;
    if (drinkId === 'matcha') {
      const board = this.exchange && Number.isFinite(this.exchange.matchaPrice)
        ? this.exchange.matchaPrice
        : (this.exchange ? salePrice(this.exchange, this.repriced) : ECON.matchaFull);
      const ticket = this.exchange ? salePrice(this.exchange, this.repriced) : ECON.matchaFull;
      boardDelta = (ticket - board) * mult;
      ourPrice = board * mult;
    } else {
      const base = DRINKS[drinkId]?.base;
      const price = menuPrice(drinkId, this.menuPrices);
      ourPrice = (Number.isFinite(base) ? base : (Number.isFinite(price) ? price : ECON.other)) * mult;
      if (Number.isFinite(base) && Number.isFinite(price)) boardDelta = (price - base) * mult;
    }
    return rivalChoiceProbability({
      strategy: this.rivalStrategy, cohort, ourPrice, op,
      ourQueue: this.queueLength, rivalQueue: this.rivalQ.length,
      reach: this.reach ?? 1, cupQuality: this.cupQuality ?? 1,
      campPull, boardDelta,
    });
  }

  // The room is judged when they would join the queue, not when they spawn.
  // High-dwell cohorts add the camp pull to the same rival roll.
  _campDivert(p) {
    if (this.truceCeasefire || !this._roomFull() || !this._highDwell(p)) return false;
    if (this.rivalQ.length >= 42) return false;
    const op = this.regulars ? (this.regulars.reputation - 50) / 50 : 0;
    const pr = this._rivalPull(p.cohort, p.drink, op, FULL_ROOM_PULL);
    return (p.choiceRoll ?? this.random()) < pr;
  }

  _leaveForRival(p, quick) {
    const i = this.counterQ.indexOf(p);
    if (i >= 0) this.counterQ.splice(i, 1);
    p.rivalOrigin = 'camp';
    p.queueRef = 'rival';
    this.rivalChoices++;
    this.rivalQ.push(p);
    p.goal = this._slotPos(rivalSlot, this.rivalQ.length - 1, p);
    if (quick) {
      const fromX = p.pos.x, fromZ = p.pos.z;
      p.state = 'inRivalQ';
      p.pos.set(p.goal.x + (this.random() - 0.5), 0, p.goal.z + 0.6 + this.random() * 0.4);
      this._noteCross(fromX, fromZ);
    } else {
      p.state = 'defecting';
      p.path = [V3(LAYOUT.crossX, 0, LAYOUT.pavementZ), V3(LAYOUT.crossX, 0, LAYOUT.farSideZ)];
    }
  }

  // High-speed defections join Sam's queue immediately so service timing
  // stays put. The callback only traces a cosmetic walker on the zebra.
  _noteCross(x, z) {
    if (typeof this.onCosmeticCross !== 'function') return;
    try { this.onCosmeticCross({ x, z }); } catch { /* a silhouette never blocks the queue */ }
  }

  spawn(cohort, zone, quick = false, viaCompanion = false) {
    if (!this.free.length) return null;
    const idx = this.free.pop();
    const fromLeft = this.random() < 0.5;
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
    // Loseable day 1: when the rolled drink is 86'd, its loyalists walk at the
    // board with a reason (turnaway) instead of silently re-rolling — gutting
    // the menu costs the day in lost sales AND reputation, not just mix.
    // The spawn still returns a patron (contract kept: callers and the queue
    // never see null); the turnaway is a flagged patron the tick loop walks
    // out immediately with a reason. The first-choice probe uses a
    // spawn-local deterministic stream (never this.random, never Math.random)
    // — with no 86 on the board the branch collapses to a single rollDrink,
    // so the default stream is bit-identical and seeded harnesses replay.
    const offered = this.menuOffered;
    const has86 = zone === 'counter' && offered && Object.entries(offered).some(([id, on]) => on === false && id !== 'matcha');
    let drink, firstChoice = null, turnedAway = false;
    if (has86) {
      const probe = ((n) => { let s = (n >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })((this._boardProbe = (this._boardProbe || 0) + 1) * 2654435761);
      firstChoice = rollDrink(cohort, null, probe);
      if (offered[firstChoice] === false && firstChoice !== 'matcha' && probe() < eightySixedShare(ECON)) {
        turnedAway = true;
      }
    }
    drink = rollDrink(cohort, this.menuOffered, this.random, this._orderPrices());
    const p = {
      idx, active: true, cohort, zone,
      drink, wantsMatcha: drink === 'matcha',
      pos: V3(s.x, 0, s.z + (this.random() - 0.5) * 1.4), face: fromLeft ? Math.PI / 2 : -Math.PI / 2,
      path: [], state: 'walking', waitMin: 0, dwell: 0,
      speed: ritualSpeed + (this.random() - 0.5) * 0.3, phase: this.random() * 6.28,
      jx: (this.random() - 0.5) * 0.24, jz: (this.random() - 0.5) * 0.2,
      seat: null, hasCup: false, cupGreen: false, hasHat: this.random() < 0.45,
      torso, skin: new THREE.Color(SKIN[(this.random() * SKIN.length) | 0]),
      legs: new THREE.Color(LEGS[(this.random() * LEGS.length) | 0]),
      flash: 0, colorDirty: true, queueRef: null, slotI: -1, walking: true,
      scale: 0.84 + this.random() * 0.32,
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
    // The drink they actually wanted: a roster usual when one is waiting,
    // otherwise the price-weighted roll. An 86'd usual is not a street
    // price — they turn away instead of crossing on a cup we won't pour.
    const pending = zone === 'counter' ? this._pendingRegular(cohort) : null;
    let wanted = drink;
    let usualEightySixed = false;
    if (pending) {
      const standing = preferredOnBoard(pending.drink, this.menuOffered);
      if (standing.drink) wanted = standing.drink;
      else if (standing.turnedAway) { usualEightySixed = true; p.turnawayDrink = pending.drink; }
    }
    p.choiceRoll = zone === 'counter' ? this.random() : null;
    // Within the cohort, not across it: shirt value wobbles around the
    // cohort color (hue stays), height is spread wider above, and a cohort
    // that already lists a second prop sometimes carries that one. The hat
    // roll above is the other per-person choice. Value and the spare prop
    // reuse the phase and lane rolls spawn already took.
    {
      const hsl = { h: 0, s: 0, l: 0 };
      p.torso.getHSL(hsl);
      const roll = (p.phase / 6.28) % 1;
      hsl.l = THREE.MathUtils.clamp(hsl.l + (roll - 0.5) * 0.16, 0.18, 0.62);
      p.torso.setHSL(hsl.h, hsl.s, hsl.l);
    }
    if (p.ritualProps.length > 1) {
      const roll = p.jz / 0.2 + 0.5;
      if (roll >= 0.66) {
        const alt = p.ritualProps[1];
        p.ritualProps = [alt, p.ritualProps[0], ...p.ritualProps.slice(2)];
      }
    }
    let toRival = false;
    let boardWalk = false;
    // A turnaway never queues — they read the board and leave with a reason.
    if (turnedAway || usualEightySixed) {
      boardWalk = true;
    }
    // Phase 4 — ceasefire Saturday: nobody crosses, neither way.
    // The room is not judged here. Camp pull happens when they join.
    // Price elasticity folds into the SAME rival-choice roll (no extra RNG):
    // the rolled drink's board delta shifts the rival probability before they
    // join. Overcharging pushes them toward Glasshouse; a fair price keeps
    // them; undercharging lures a few back (margin still pays it). Deltas are
    // measured against OUR board (menu base / today's matcha board), so base
    // prices divert exactly 0 and the default stream is untouched — the RNG
    // order never changes. The matcha deal (4.20 vs the board) lures back.
    if (!boardWalk && zone === 'counter' && !this.truceCeasefire && this.rivalQ.length < 42) {
      const op = this.regulars ? (this.regulars.reputation - 50) / 50 : 0;
      const pr = this._rivalPull(cohort, wanted, op);
      if (p.choiceRoll < pr) toRival = true;
    }
    // Is this spawn a named Regular? If so, mark seen, tag the patron, and
    // emit a one-line greeting when they actually join the queue.
    // pending was picked with the same roll markSeen used to spend, so the
    // person the street priced is the person who gets marked.
    if (!toRival && !boardWalk && this.regulars && zone === 'counter') {
      const r = pending
        ? this.regulars.markSeen(cohort, this.markSeenOnly || null, pending)
        : this.regulars.markSeen(cohort, this.markSeenOnly || null, null, this.random);
      this._attachRegular(p, r);
    }
    // Phase 1 — walk-in identity: draw a generated head from the day pool so
    // strangers accumulate visits and can graduate. Roster spawns skip this.
    if (!toRival && !boardWalk && !p.regularName && this.walkins && zone === 'counter') {
      const head = this.walkins.draw(cohort);
      if (head) {
        p.pid = head.pid; p.pname = head.name; p.faceSeed = head.faceSeed;
        p.preferredDrink = head.drink; p.stage = head.stage; p.visits = head.visits;
      }
    }
    // A named order, if we pour it. An 86'd usual is the board turnaway:
    // they do not take a substitute and they do not join the line.
    if (!toRival && p.preferredDrink) {
      const standing = preferredOnBoard(p.preferredDrink, this.menuOffered);
      if (standing.drink) {
        p.drink = standing.drink;
        p.wantsMatcha = standing.drink === 'matcha';
      } else if (standing.turnedAway) { p.boardTurnaway = true; p.turnawayDrink = p.preferredDrink; }
    }
    // Phase 1 — friends bring a +1: a friend-stage arrival sometimes spawns a
    // visitor companion on the spot. viaCompanion guards the recursion (one
    // level); spawn's null return guards a full floor.
    if (!toRival && !boardWalk && !p.boardTurnaway && !viaCompanion && shouldBringCompanion(p.stage, this.random)) {
      const c = this.spawn(cohort, zone, quick, true);
      if (c && c !== p) {
        c.companionOf = p.pid || p.regularName;
        p.broughtFriend = c.pname || 'a friend';
        if (p.regularName) (this.companionsToday ||= []).push({ name: p.regularName, friend: p.broughtFriend });
      }
    }
    // The 11:00 ask's party — stamp members during the rush so the evening
    // card can count who stayed and who walked.
    if (!toRival && !boardWalk && !p.boardTurnaway && zone === 'counter' && this.party && !this.party.declined
        && this.partyActive && this.party.left > 0 && cohort === this.party.cohort) {
      p.partyMember = true;
      this.party.left--;
    }
    this.patrons.push(p);
    const door = V3(LAYOUT.door.x + (this.random() - 0.5) * 2.2, 0, LAYOUT.door.z + 0.5);
    if (boardWalk || (zone === 'counter' && p.boardTurnaway)) {
      // Read the board, leave the room: counted at spawn (the tick loop must
      // stay clean — it iterates the whole patron list every sim-minute, so a
      // scan there flips unrelated seeded outcomes). They arrive through the
      // door like everyone else so spawn's contract holds (always a patron,
      // never null) — they just never reach the queue: grumble now, leave now.
      this.turnaways++;
      p.turnaway = p.turnawayDrink || firstChoice; p.boardWalk = true;
      p.flash = 1; p.colorDirty = true;
      p.reactKind = 'grumble'; p.reactT = 0.9;
      this._boardEvents.push({ type: 'balked', p, board: true, turnaway: p.turnaway });
      p.state = 'walkingIn'; p.path = [door];
      p.goal = door.clone ? door.clone() : door;
      p.queueRef = null;
      this._paint(p);
      this._leave(p);
      return p;
    }
    if (toRival) {
      const lost = this.regulars && this.regulars.regulars.find(r => r.absence === 'lost' && !r._defectShown && r.coh === cohort);
      if (lost) { lost._defectShown = true; p.regularName = lost.name; p.hasHat = true; p.pname = lost.name; p.faceSeed = lost.name; p.lostGlimpse = true; }
      p.rivalOrigin = 'choice'; p.queueRef = 'rival'; this.rivalChoices++;
      this.rivalQ.push(p);
      p.goal = this._slotPos(rivalSlot, this.rivalQ.length - 1, p);
      if (quick) {
        const fromX = p.pos.x, fromZ = p.pos.z;
        p.state = 'inRivalQ';
        p.pos.set(p.goal.x + (this.random() - 0.5), 0, p.goal.z + 0.6 + this.random() * 0.4);
        this._noteCross(fromX, fromZ);
      } else {
        p.state = 'defecting';
        p.path = [V3(LAYOUT.crossX, 0, LAYOUT.pavementZ), V3(LAYOUT.crossX, 0, LAYOUT.farSideZ)];
      }
    } else if (zone === 'counter') {
      // Quick spawn joins now, so the room is judged now. A slow walk
      // judges it at the door (_onArrive), when the seats are the seats
      // they would actually take.
      if (quick && this._campDivert(p)) this._leaveForRival(p, true);
      else {
        p.queueRef = 'counter'; this.counterQ.push(p);
        p.goal = this._slotPos(counterSlot, this.counterQ.length - 1, p);
        if (quick) {  // at speed the crowd is just there — step out of it, keep arrival = spawn rate
          p.state = 'toQueue';
          p.pos.set(p.goal.x + (this.random() - 0.5), 0, p.goal.z + 1.4 + this.random());
        } else { p.state = 'walkingIn'; p.path = [door]; }
      }
    } else {
      p.state = 'toBrowse';
      const shelf = V3(LAYOUT.retail.x + 1.3 + this.random(), 0, LAYOUT.retail.z + (this.random() - 0.5) * 4.4);
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
    // Board turnaways were already counted at spawn (which must stay the only
    // RNG-adjacent change — tick scans must not touch the shared stream).
    // Drain their stashed events here so the day loop counts them as balks
    // with a reason, exactly once each.
    if (this._boardEvents.length) ev.push(...this._boardEvents.splice(0));
    // everyone waiting ages a minute
    for (const p of this.counterQ) if (p.state === 'inQueue') p.waitMin++;
    for (const p of this.registerQ) if (p.state === 'inRegisterQ') p.waitMin++;
    for (const p of this.rivalQ) if (p.state === 'inRivalQ') p.waitMin = (p.waitMin || 0) + 1;

    // serve from the counter — the bar spends prep-points each minute.
    // Phase 3: points follow the drink (espresso fast, filter slow, matcha
    // slowest unless batched). Milky orders need milk stock (ctx.milkStock);
    // a dry bar loses the order to a balk, flagged once via ctx.milkOut.
    const staffed = (ECON.barPoints + (this.skillPts || 0)) * (this.staffMul || 1);
    let points = (staffed + (this.shockStaff || 0)) * (this.capacityMult ?? 1);
    let servedN = 0;
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
      const ticket = (dk === 'matcha'
        ? (this.exchange ? salePrice(this.exchange, ctx.repriced) : ECON.matchaFull)
        : (ctx.menuPrices?.[dk] ?? ECON.other)) * (ctx.priceMult || 1);
      ev.push({ type: 'served', p, isMatcha: p.wantsMatcha, price: ticket, fromBatch, ...cup });
      // Phase 5 — the serve lands on camera: a 0.9s mood reaction.
      p.reactKind = 'serve'; p.reactT = 0.9;
      p.op = (Number.isFinite(p.op) ? p.op : 0) + 0.2;
      this._afterServe(p);
    }
    this._layoutQ(this.counterQ, counterSlot);

    // balks — patience follows prep cost. Unbatched matcha is the least
    // patient; a deal still buys time; a bad floor still loses it.
    for (let i = this.counterQ.length - 1; i >= 0; i--) {
      const p = this.counterQ[i];
      if (p.state !== 'inQueue') continue;
      const dk = p.drink || (p.wantsMatcha ? 'matcha' : 'flatwhite');
      const batched = dk === 'matcha' && (ctx.batchUnits || 0) > 0 && dayMin >= (ctx.batchReservedUntil || 0);
      const chance = balkChanceFor(dk, batched, { repriced: !!this.repriced }) * (this.balkMul || 1);
      if (p.waitMin > balkLimit(dk, batched) && this.random() < chance) {
        this.counterQ.splice(i, 1);
        this._balk(p, ev);
      }
    }
    this._layoutQ(this.counterQ, counterSlot);

    // register — quick, one minute each
    let regN = 0;
    for (let i = 0; i < this.registerQ.length && regN < ECON.registerPerTick;) {
      const p = this.registerQ[i];
      if (p.state !== 'inRegisterQ') { i++; continue; }
      if (p.waitMin >= 1) {
        // Retail is the dawn pastry while the case still has one. Stock is
        // counted only once the day bought a case (ctx.pastryStock set).
        // An empty case loses the croissant: one in four leaves, and the
        // rest buy the drink they came for. No case keeps the drink path.
        if (ctx.pastryStock > 0) {
          ctx.pastryStock--;
          this.registerQ.splice(i, 1); regN++;
          ev.push({ type: 'served', p, isMatcha: false, price: PASTRY.price, viaRegister: true, pastry: true, beanCost: 0, spotCost: 0, hedged: false });
          if (this.random() < 0.12) this._afterServe(p); else this._leave(p);
          continue;
        }
        if (ctx.pastryStock != null && ctx.pastryStock <= 0 && this.random() < EMPTY_CASE_WALK) {
          this.registerQ.splice(i, 1);
          this._balk(p, ev, { pastry: true });
          continue;
        }
        const missedPastry = ctx.pastryStock != null && ctx.pastryStock <= 0;
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
        const regPrice = (regMatcha
          ? (this.exchange ? salePrice(this.exchange, ctx.repriced) : ECON.matchaFull)
          : (ctx.menuPrices?.[rdk] ?? ECON.other)) * (ctx.priceMult || 1);
        ev.push({ type: 'served', p, isMatcha: regMatcha, price: regPrice, viaRegister: true, ...cup, ...(missedPastry ? { pastryMiss: true } : {}) });
        if (this.random() < 0.12) this._afterServe(p); else this._leave(p);
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

    // the chain serves slowly — one every two minutes, faster when their
    // strategy says so. A long felt wait walks a share back to our door.
    // Speed is what keeps that wait from arriving.
    const stratDef = CAMPAIGN.rivalStrategies[this.rivalStrategy] || {};
    const speedMul = stratDef.speedMul || 1;
    const rivalReady = this.rivalQ.length > 0 && this.rivalQ[0].state === 'inRivalQ';
    this.rivalCredit += 0.5 * speedMul;
    if (!rivalReady) this.rivalCredit = Math.min(1, this.rivalCredit);
    while (this.rivalCredit >= 1 - 1e-9 && this.rivalQ.length && this.rivalQ[0].state === 'inRivalQ') {
      const p = this.rivalQ.shift();
      this.rivalCredit = Math.max(0, this.rivalCredit - 1);
      p.state = 'leaving'; p.queueRef = null;
      p.path = [V3(p.pos.x + 5, 0, 15.4)];
      ev.push({ type: 'rivalServed', p });
    }
    let walkedBack = false;
    for (let i = this.rivalQ.length - 1; i >= 0; i--) {
      const p = this.rivalQ[i];
      if (p.state !== 'inRivalQ') continue;
      const back = rivalWalkbackChance(p.waitMin, speedMul);
      if (back > 0 && this.random() < back) {
        this.rivalQ.splice(i, 1);
        p.state = 'toQueue'; p.queueRef = 'counter'; p.rivalOrigin = 'walkback'; p.waitMin = 0;
        this.counterQ.push(p);
        p.goal = this._slotPos(counterSlot, this.counterQ.length - 1, p);
        ev.push({ type: 'rivalWalkback', p });
        walkedBack = true;
      }
    }
    this._layoutQ(this.rivalQ, rivalSlot);
    if (walkedBack) this._layoutQ(this.counterQ, counterSlot);
    return ev;
  }

  // The existing walk-out: grumble, maybe cross, otherwise leave. Board
  // turnaways and the share who leave an empty case use this same path.
  _balk(p, ev, extra) {
    p.flash = 1; p.colorDirty = true;
    p.reactKind = 'grumble'; p.reactT = 0.9;
    p.op = (Number.isFinite(p.op) ? p.op : 0) - 0.08;
    ev.push({ type: 'balked', p, ...(extra || {}) });
    // Phase 4 — ceasefire Saturday: walk-outs walk, they don't defect.
    if (!this.truceCeasefire && this.random() < 0.7 && this.rivalQ.length < 42) {
      p.state = 'defecting'; p.queueRef = 'rival'; p.rivalOrigin = 'defection'; this.rivalQ.push(p);
      p.goal = this._slotPos(rivalSlot, this.rivalQ.length - 1, p);
      p.path = [
        V3(LAYOUT.door.x, 0, LAYOUT.door.z + 0.6),
        V3(LAYOUT.crossX, 0, LAYOUT.pavementZ),
        V3(LAYOUT.crossX, 0, LAYOUT.farSideZ),
      ];
      // they walked out before being served — don't credit them with having been "seen"
      if (p.regularIdx >= 0 && this.regulars) { p.defectedFrom = p.regularIdx; this.regulars.unsee(p.regularIdx); }
      p.regularName = null; p.regularIdx = -1;
      ev.push({ type: 'defect', p });
    } else this._leave(p);
  }

  _afterServe(p) {
    const freeSeats = this.world.seats.filter(s => !s.taken);
    if (this.random() < ECON.sitChance && freeSeats.length) {
      // PR-6 — cohort ritual: prefer the table the cohort claims first.
      // Falls through to a random free seat if their table is taken.
      let seat = null;
      if (p.ritualSeat != null && this.world.seats[p.ritualSeat] && !this.world.seats[p.ritualSeat].taken) {
        seat = this.world.seats[p.ritualSeat];
      } else {
        seat = freeSeats[(this.random() * freeSeats.length) | 0];
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
    if (p.pos.z < LAYOUT.door.z - 0.15) out.push(V3(LAYOUT.door.x + (this.random() - 0.5) * 2, 0, LAYOUT.door.z + 0.5)); // still inside — head for the door
    if (this.walkMul > 1.5) {
      out.push(V3(LAYOUT.door.x + (this.random() - 0.5) * 6, 0, LAYOUT.pavementZ + 0.6)); // step off-camera, bow out
    } else {
      const exitL = this.random() < 0.5;
      out.push(V3(exitL ? LAYOUT.spawnL.x : LAYOUT.spawnR.x, 0, LAYOUT.pavementZ + (this.random() - 0.5)));
    }
    p.path = out;
  }

  _onArrive(p) {
    switch (p.state) {
      case 'walkingIn':
        if (this._campDivert(p)) this._leaveForRival(p, false);
        else p.state = 'toQueue';
        break;
      case 'toBrowse': p.state = 'browse'; p.dwell = 2 + (this.random() * 4 | 0); break;
      case 'toSeat': p.state = 'sit'; p.dwell = Math.round((8 + (this.random() * 14 | 0)) * this.dwellMul); p.face = p.seat.face; p.sipAt = Math.max(1, p.dwell - 4); break;
      case 'defecting': p.state = 'inRivalQ'; this._paint(p); break;
      case 'leaving': this._despawn(p); break;
    }
  }

  _despawn(p) {
    if (!p.active) return;
    p.active = false;
    if (p.seat) { p.seat.taken = null; p.seat = null; }
    p._floorSeat = null; p._seatSettled = false;
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
    const pp = p.vis || p.pos;
    d.rotation.set(0, p.face, 0);
    d.scale.setScalar(s);
    const sway = propSway(p.phase, gaitFor(p.cohort), walking);
    switch (anchor) {
      case 'rightHip':
        // briefcase — held at right hip, swinging slightly forward
        d.position.set(pp.x + rx * 0.18 * s, hipY - 0.04, pp.z + rz * 0.18 * s);
        d.rotation.set(sway, p.face, 0);
        break;
      case 'chestFront':
        if (propKey === 'laptop' && sitting) {
          // laptop on the lap — tilted forward, dropped to lap height
          d.position.set(pp.x + fx * 0.20 * s, hipY + 0.18, pp.z + fz * 0.20 * s);
          d.rotation.set(-0.55, p.face, 0);
        } else if (propKey === 'camera' && sitting) {
          // camera raised to the eye — held up to look through the viewfinder
          d.position.set(pp.x + fx * 0.18 * s, headY - 0.02, pp.z + fz * 0.18 * s);
          d.rotation.set(0.18, p.face, 0);
        } else {
          // standing — laptop/camera held in front of chest, slightly down
          d.position.set(pp.x + fx * 0.22 * s, torsoY + 0.08, pp.z + fz * 0.22 * s);
          d.rotation.set(-0.3, p.face, 0);
        }
        break;
      case 'upperBack':
        // backpack — on the back, behind torso
        d.position.set(pp.x - fx * 0.12 * s, torsoY + 0.05, pp.z - fz * 0.12 * s);
        d.rotation.set(0, p.face, 0);
        break;
      case 'rightHand':
        // mug / notebook — at the right-hand level, slightly forward
        d.position.set(pp.x + fx * 0.20 * s + rx * 0.22 * s, shY - 0.04, pp.z + fz * 0.20 * s + rz * 0.22 * s);
        d.rotation.set(-0.2 + sway * 0.5, p.face, 0);
        break;
      case 'leftHand':
        d.position.set(pp.x + fx * 0.20 * s - rx * 0.22 * s, shY - 0.04, pp.z + fz * 0.20 * s - rz * 0.22 * s);
        d.rotation.set(-0.2 - sway * 0.5, p.face, 0);
        break;
      case 'rightHandGround':
        // cane — extends from right hand down to the floor
        d.position.set(pp.x + fx * 0.06 * s + rx * 0.18 * s, hipY - 0.10, pp.z + fz * 0.06 * s + rz * 0.18 * s);
        d.rotation.set(-0.08 + sway * 0.3, p.face, 0);
        break;
      default:
        d.position.set(pp.x, hipY, pp.z);
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

  // Chairs follow patrons who are actually inside. An empty room
  // keeps every seat free. Visual chairs are not `seat.taken` — that
  // flag is the full-room rival pull, and this must not change it.
  _syncFloorSeats() {
    const seats = this.world && this.world.seats;
    const list = Array.isArray(seats) ? seats : [];
    const inside = [];
    const room = LAYOUT.floor;
    const bounds = {
      doorZ: LAYOUT.door.z,
      minZ: room.z - room.d / 2, minX: room.x - room.w / 2, maxX: room.x + room.w / 2,
    };
    for (const p of this.patrons) if (isInsidePatron(p, bounds)) inside.push(p);
    const free = list.filter(s => s && !s.taken);
    const budget = Math.min(floorSeatBudget(inside), free.length);
    const next = planVisualSitters(this._floorSitters, inside, budget);
    const nextSet = new Set(next);
    this._floorSitters = next;
    const used = new Set();
    for (const p of this.patrons) {
      if (nextSet.has(p)) continue;
      p._floorSeat = null;
      p._seatSettled = false;
    }
    for (const p of next) {
      const prev = p._floorSeat;
      if (prev && !prev.taken && list.includes(prev) && !used.has(prev)) used.add(prev);
      else { p._floorSeat = null; p._seatSettled = false; }
    }
    const need = next.filter(p => !p._floorSeat);
    const open = free.filter(s => !used.has(s));
    const picked = spreadSeats(open, need.length);
    need.forEach((p, i) => {
      p._floorSeat = picked[i] || null;
      if (!picked[i]) p._seatSettled = false;
    });
  }

  // ---- per sim-minute: positions, arrivals, seat assignment — the sim half.
  // Stepped inside tick() so frame rate never steers queue joins or dwell. ----
  step(dt, walkMul, now, reduced = false) {
    this.walkMul = walkMul;
    this._reduced = !!reduced;
    this._syncFloorSeats();
    for (const p of [...this.patrons]) {   // copy: arrivals can despawn mid-loop
      // movement: queue states slide toward their slot; everyone else walks waypoints.
      // The slide is speed-capped (no ice-skating) but 3x walk pace, so the line
      // advances fluidly at any sim speed and nobody chase-lags forever.
      // A floor chair holds them out of that slide until they leave the room.
      let walking = false;
      const seatHold = p._floorSeat && p.state !== 'sit' && p.state !== 'toSeat';
      const inQueueState = p.goal && (p.state === 'toQueue' || p.state === 'inQueue' || p.state === 'toRegister' || p.state === 'inRegisterQ' || p.state === 'inRivalQ');
      if (seatHold) {
        const seat = p._floorSeat;
        const dx = seat.x - p.pos.x, dz = seat.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = p.speed * (walkMul || 1) * dt;
        if (dist <= Math.max(step, 0.08)) {
          p.pos.x = seat.x; p.pos.z = seat.z;
          p._seatSettled = true;
          let diff = seat.face - p.face;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          p.face += diff * Math.min(1, dt * 6);
        } else {
          p._seatSettled = false;
          p.pos.x += (dx / dist) * step; p.pos.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let diff = want - p.face;
          while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          p.face += diff * Math.min(1, dt * 10);
          walking = true;
        }
      } else if (inQueueState) {
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
      // Phase 5 — reactions decay on the sim clock.
      if (p.reactT > 0) p.reactT = Math.max(0, p.reactT - dt);
      if (p.state === 'leaving') {
        p.leaveT = (p.leaveT || 0) + dt;
        const ttl = walkMul > 5 ? 0.35 : walkMul > 1.5 ? 1.4 : Infinity;
        if (p.leaveT > ttl) { this._despawn(p); continue; }
      }
      p.phase += dt * (walking ? 7 * gaitFor(p.cohort).freqMul * Math.min(walkMul, 2.2) : 1.4);
    }
  }

  // ---- per-frame: pose + matrix composition — reads sim state, never advances it.
  // `vis` trails the tick-stepped position so 1× still glides. ----
  render(dt, now, reduced = false) {
    const d = this._d; d.rotation.order = 'YXZ';
    const P = this.parts;
    for (const p of [...this.patrons]) {
      if (!p.active) continue;
      if (!p.vis) p.vis = p.pos.clone();
      if (p.vis.distanceToSquared(p.pos) > 4) p.vis.copy(p.pos);
      else {
        const k = Math.min(1, Math.max(0, dt || 0) * 9);
        p.vis.x += (p.pos.x - p.vis.x) * k; p.vis.z += (p.pos.z - p.vis.z) * k;
      }
      const vx = p.vis.x, vz = p.vis.z;
      const walking = p.walking;
      if (p.state === 'defecting') {
        // Teal while they cross, so a walk to Sam reads against the café crowd.
        // Queue join still happens at the end of the same path as before.
        this._c.copy(p.torso).lerp(GLASS, 0.62);
        P.torso.setColorAt(p.idx, this._c); P.torso.instanceColor.needsUpdate = true;
      } else if (p.flash > 0) {
        p.flash = Math.max(0, p.flash - dt * 1.6);
        this._c.copy(p.torso).lerp(RED, p.flash * 0.85);
        P.torso.setColorAt(p.idx, this._c); P.torso.instanceColor.needsUpdate = true;
      }

      // Phase 5 — pose clips: one sample carries walk/sit/sip/react.
      const sipping = p.sipping > 0;
      const sitting = p.state === 'sit' || !!(p._floorSeat && p.state !== 'sit' && p.state !== 'toSeat' && p._seatSettled);
      const s = p.scale;
      const mood = moodFor(p.op);
      const pose = samplePose({
        phase: p.phase, gait: gaitFor(p.cohort), walking,
        nowMs: now, idx: p.idx, sitting, reduced: !!(this._reduced && sitting),
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
      const nowSec = (typeof now === 'number' ? now : 0) / 1000;
      const torsoAx = axesFor(p, 'torso', nowSec);

      d.rotation.set(0, p.face, 0);
      d.position.set(vx, torsoY, vz);
      d.scale.set(s * torsoAx.x, s * torsoAx.y, s * torsoAx.z);
      d.rotation.x = lean; d.updateMatrix(); P.torso.setMatrixAt(p.idx, d.matrix);
      d.scale.setScalar(s);

      d.rotation.set(0, p.face + headRy, 0);
      d.position.set(vx, headY, vz); d.updateMatrix(); P.head.setMatrixAt(p.idx, d.matrix);

      const hipY = 0.36 + bob * 0.5;
      d.position.set(vx - rx * 0.09 * s, hipY, vz - rz * 0.09 * s);
      d.rotation.set(legSwing, p.face, 0); d.scale.set(s, sitting ? 0.001 : s, s); d.updateMatrix();
      P.legL.setMatrixAt(p.idx, d.matrix);
      d.position.set(vx + rx * 0.09 * s, hipY, vz + rz * 0.09 * s);
      d.rotation.set(-legSwing, p.face, 0); d.updateMatrix();
      P.legR.setMatrixAt(p.idx, d.matrix);

      const shY = torsoY + 0.22 * s;
      d.scale.setScalar(s);
      d.position.set(vx - rx * 0.23 * s, shY, vz - rz * 0.23 * s);
      d.rotation.set(armSwing, p.face, 0); d.updateMatrix(); P.armL.setMatrixAt(p.idx, d.matrix);
      d.position.set(vx + rx * 0.23 * s, shY, vz + rz * 0.23 * s);
      d.rotation.set(-armSwingR, p.face, 0); d.updateMatrix(); P.armR.setMatrixAt(p.idx, d.matrix);

      d.position.set(vx, headY + 0.13 * s, vz);
      d.rotation.set(0, p.face, 0); d.scale.setScalar(p.hasHat ? s : 0.001); d.updateMatrix();
      P.hat.setMatrixAt(p.idx, d.matrix);

      if (p.hasCup) {
        const cupAx = axesFor(p, 'cup', nowSec);
        d.position.set(vx + fx * 0.24 * s + rx * 0.14 * s, torsoY + 0.1, vz + fz * 0.24 * s + rz * 0.14 * s);
        d.scale.set(s * cupAx.x, s * cupAx.y, s * cupAx.z); d.updateMatrix(); P.cup.setMatrixAt(p.idx, d.matrix);
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
          // cosmetic stream when FX carries one — a per-frame verb roll must
          // never consume a patron decision draw
          const verbR = (this.fx && this.fx.random) ? this.fx.random() : this.random();
          if (this.fx && propKey === 'camera' && sitting && verbR < 0.025) {
            this.fx.flash(d.position.x, d.position.y + 0.1, d.position.z);
          } else if (this.fx && propKey === 'laptop' && sitting && verbR < 0.045) {
            this.fx.sparkle(d.position.x, d.position.y + 0.1, d.position.z);
          } else if (this.fx && propKey === 'mug' && p.hasCup && verbR < 0.05) {
            this.fx.steam(vx, torsoY + 0.15, vz);
          } else if (this.fx && propKey === 'cane' && walking && verbR < 0.015) {
            this.fx.puff(vx, 0.15, vz, { n: 2, shade: 0.5 });
          }
        } catch { /* a verb never breaks the frame */ }
      }
    }
    for (const part of Object.values(P)) part.instanceMatrix.needsUpdate = true;
    // PR-A2 — prop instances have their own InstancedMeshes; flush each one.
    if (this.propMeshes) for (const prop of Object.values(this.propMeshes)) prop.instanceMatrix.needsUpdate = true;
  }

  // Composite kept for harnesses and callers that drive both halves at once.
  update(dt, walkMul, now, reduced = false) {
    this.step(dt, walkMul, now, reduced);
    this.render(dt, now, reduced);
  }

  reset() {
    for (let i = this.patrons.length - 1; i >= 0; i--) this._despawn(this.patrons[i]);
    // idx allocation order is sim-visible (the seat-plan tiebreak reads p.idx),
    // so the free list rewinds to its constructor order — a replayed day must
    // re-meet the same room, not the residue of the last despawn sweep.
    this.free = [];
    for (let i = MAXP - 1; i >= 0; i--) this.free.push(i);
    this.walkMul = 1;
    this.counterQ = []; this.registerQ = []; this.rivalQ = []; this.rivalClock = 0; this.rivalCredit = 0; this.rivalChoices = 0;
    this.staffMul = 1; this.capacityMult = 1; this.shockStaff = 0; this.reach = 1; this.cupQuality = 1;
    this.balkMul = 1; this.dwellMul = 1;
    this.turnaways = 0; this._boardProbe = 0; this._boardEvents = [];
    this.companionsToday = [];
    this._floorSitters = [];
  }
}

