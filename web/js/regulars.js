// The Regulars — the social layer. Named patrons whose opinion survives the
// day's reset; gossip and grudges compound into reputation. Reputation is the
// lever that connects the floor's yesterday to tomorrow's demand and tips.
// (ARCHITECTURE.md "precedent (memory) → opinions, friendships".)
//
// The friendship graph: each regular has 2-3 friends. Gossip routes through
// friends first (a "word of mouth" hop); reputation pulls toward the mean of
// a regular's friends (5%/day). Diameter is 2 for the current roster, so any
// sour or sweet day reaches the whole network within three hops.
import { REGULAR_ROSTER } from './config.js';
import { stageFor, CANON_DRINKS, MAX_EVENTS } from './identity.js';
import { Demand } from './demand.js';
import { WALKOUT_OP } from './consequences.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const CONTAGION = 0.05;   // opinion pull toward each friend's mean (per day)

// 0 at an empty day, 0.5 at 30 cups, 1 at 60. Past 60 the bonus keeps
// growing, and each extra cup adds less than the one before it.
export function busyHappy(served) {
  const s = Math.max(0, Number(served) || 0);
  if (s <= 60) return s / 60;
  return 1 + 0.5 * (1 - 60 / s);
}

export class Regulars {
  constructor() {
    this.regulars = REGULAR_ROSTER.map((r, i) => ({
      ...r,
      i,
      op: 0.15,            // -1..1 opinion
      seen: false,         // did they show today?
      served: 0, balked: 0,
      // Phase 1 — the cast starts established: 5 visits, regular stage,
      // quirk-derived drink. visits/stage persist across days (resolveDay
      // never resets them); events are this session's history for dossiers.
      visits: 5,
      stage: 'regular',
      drink: CANON_DRINKS[r.name] || 'filter',
      events: [],
      absence: 'present',
      absentReason: null,
    }));
    // Build the friendship graph once. Map<idx, Set<idx>> for O(1) edge lookup.
    // Edges are stored once (the undirected edge, not both directions).
    this.friendships = new Map();
    for (const r of this.regulars) this.friendships.set(r.i, new Set());
    const byName = new Map(this.regulars.map(r => [r.name, r.i]));
    for (const r of this.regulars) {
      const friends = r.friends ?? [];
      for (const fname of friends) {
        const fidx = byName.get(fname);
        if (fidx == null) continue;     // tolerate a typo in the roster
        this.friendships.get(r.i).add(fidx);
        this.friendships.get(fidx).add(r.i);   // bidirectional
      }
    }
  }

  // Return the iterable Set<idx> of friends of `idx`. Empty set if none.
  friendOf(idx) { return this.friendships.get(idx) ?? new Set(); }

  // Pick a random friend of `idx`, excluding `excludeIdx`. Returns idx or
  // null if no eligible friend exists. Used by the gossip router to choose
  // a friend-of-friend target who is currently on the floor.
  // `rng` is the caller's seeded stream; nothing calls this today (Math.random
  // default kept for the unseeded API only).
  pickFriendFor(idx, excludeIdx = -1, rng = Math.random) {
    const friends = this.friendships.get(idx);
    if (!friends || friends.size === 0) return null;
    const cands = [...friends].filter(f => f !== excludeIdx);
    if (cands.length === 0) return null;
    return cands[(rng() * cands.length) | 0];
  }

  // BFS-walk the graph up to `maxHops` from `fromIdx`, returning a Set of
  // reachable regulars (excluding the start). Used by the gossip router to
  // find a friend-of-friend who is on the floor, before falling back to a
  // random nearby patron.
  reachableIn(fromIdx, maxHops) {
    const out = new Set();
    const frontier = [fromIdx];
    let hops = 0;
    const visited = new Set([fromIdx]);
    while (frontier.length && hops < maxHops) {
      const next = [];
      for (const u of frontier) {
        for (const v of (this.friendships.get(u) ?? [])) {
          if (visited.has(v)) continue;
          visited.add(v); out.add(v); next.push(v);
        }
      }
      frontier.length = 0; frontier.push(...next);
      hops++;
    }
    return out;
  }

  // Resolve a day: fold the floor's outcomes into opinion, then run one
  // round of friendship contagion (each regular pulls 5% toward the mean
  // of their friends' opinions). Brought to the next dawn via the letter's
  // tone and the reputation meter.
  resolveDay({ served, balked, defections, priced, landVisit = null, warmth = 1 }) {
    const happy = busyHappy(served);
    const land = typeof landVisit === 'function' ? landVisit : () => true;
    const warm = Number.isFinite(warmth) ? warmth : 1;
    for (const r of this.regulars) {
      if (!r.seen) continue;
      // Phase 1 — a seen day is a visit (mirrors server resolveDay exactly:
      // visits = 5 + days seen). Restage after the op update below.
      // A quiet room credits fewer of them. The default credits every one.
      if (land(r.i)) r.visits += 1;
      r.op += (happy - 0.5) * 0.10 * warm;
      if (balked > served * 0.15) r.op -= 0.10;        // the floor drowned — the room sours hard
      else if (balked > served * 0.06) r.op -= 0.05;   // a rough day sours the room
      if (defections > 8) r.op -= 0.03;                // the chain's line is a bad sign
      if (priced && r.coh === 'students') r.op += 0.04; // a deal the regulars love
      r.op = clamp(r.op, -1, 1);
      r.served = r.balked = 0; r.seen = false;
    }
    this.opContagion();
    // Phase 1 — restage AFTER contagion, mirroring server resolveDay (which
    // stages from post-contagion op). Same visits, same op → same stage.
    for (const r of this.regulars) { r.stage = stageFor(r.visits, r.op); r._spawned = false; }
  }

  // One round of friendship contagion. Two-pass: compute the new opinion
  // for each regular into a temp array, then assign. Order-independent.
  // Isolates the contagion from the day's opinion update so tests can call
  // it directly. Robust to filtered rosters (tests mutate regulars[]).
  opContagion(weight = CONTAGION) {
    const next = new Map();
    // index by original i so sparse/deleted rosters don't alias array positions
    for (const r of this.regulars) {
      const friends = this.friendships.get(r.i);
      if (!friends || friends.size === 0) { next.set(r.i, r.op); continue; }
      let sum = 0, count = 0;
      for (const f of friends) {
        const fr = this.regulars.find(rr => rr.i === f);
        if (fr && Number.isFinite(fr.op)) { sum += fr.op; count++; }
      }
      if (count === 0) { next.set(r.i, r.op); continue; }
      const mean = sum / count;
      next.set(r.i, r.op + (mean - r.op) * weight);
    }
    for (const r of this.regulars) {
      const v = next.get(r.i);
      if (Number.isFinite(v)) r.op = clamp(v, -1, 1);
    }
  }

  // Shift every regular's opinion by delta — incidents that hit the whole
  // room (a failed inspection, a cold snap). Reputation derives from the mean.
  adjustOpinions(delta) {
    for (const r of this.regulars) r.op = clamp(r.op + delta, -1, 1);
  }

  get reputation() {
    const m = this.regulars.reduce((s, r) => s + r.op, 0) / this.regulars.length;
    return Math.round(clamp(62 + m * 38, 0, 100));   // 0..100
  }
  get footfallMul() { return 1 + (this.reputation - 62) * 0.014; }   // ~±53% at the rails
  get tipMul() { return 1 + (this.reputation - 62) * 0.01; }
  // Loyalty as a return rate: yesterday's served × this reappear across
  // today's waves (see Demand.resolveDay). 62 → returnBase, capped at returnMax.
  get returnRate() {
    return Demand.returnRateFor(this.reputation);
  }

  // Mark a regular as present today (called when a patron of this cohort
  // spawns into the queue). Returns {idx, name, coh, found} so the patron
  // system can flag the mesh with a brass-band hat and a one-line greeting.
  // A chance to be a real, named regular (not just cohort colour) per cohort.
  // Phase 1: also returns visits/stage/drink so the floor greets returning
  // faces by history, not just by name.
  // `rng`: PatronSystem passes its seeded stream. The fallback roll only
  // fires when no `chosen` was pre-picked, which PatronSystem never leaves
  // with live candidates, so passing it adds no draws to the patron stream.
  markSeen(cohort, only = null, chosen = null, rng = Math.random) {
    const cands = this.regulars.filter(r => !r.seen && !r._spawned && r.coh === cohort && r.absence !== 'away' && r.absence !== 'lost' && (!only || only.has(r.name)));
    if (!cands.length) return { found: false };
    const r = chosen && cands.includes(chosen) ? chosen : cands[(rng() * cands.length) | 0];
    r.seen = true; r._spawned = true;
    return { found: true, idx: r.i, name: r.name, coh: r.coh, visits: r.visits, stage: r.stage, drink: r.drink };
  }

  // Phase 1 — record a served visit on a canon regular: append a capped
  // session event and restage against current op. Visits count *days seen*
  // (bumped in resolveDay, mirroring the server) so client and server
  // restage identically; events are the session's texture for dossiers.
  // Returns the stage.
  noteVisit(idx, { day, drink, stayed } = {}) {
    const r = this.regulars[idx];
    if (!r) return null;
    r.events.push({ day, drink: drink || r.drink, outcome: 'served', stayed: !!stayed });
    if (r.events.length > MAX_EVENTS) r.events.splice(0, r.events.length - MAX_EVENTS);
    r.stage = stageFor(r.visits, r.op);
    return r.stage;
  }

  noteWalkout(idx, { day, outcome } = {}) {
    const r = this.regulars[idx];
    if (!r) return null;
    const delta = outcome === 'defected' ? WALKOUT_OP.defected : WALKOUT_OP.balked;
    // A second balk the same day does not count twice. A walk-out who then
    // crosses keeps the defect grudge: the opinion moves from the balk to
    // the crossing, and the event follows.
    if (day != null && r._lastWalkoutDay === day) {
      if (outcome === 'defected' && r._lastWalkout !== 'defected') {
        const already = r._lastWalkout === 'balked' ? WALKOUT_OP.balked : 0;
        r.op = clamp(r.op + (WALKOUT_OP.defected - already), -1, 1);
        r._lastWalkout = 'defected';
        const last = r.events[r.events.length - 1];
        if (last && last.day === day && last.outcome === 'balked') last.outcome = 'defected';
        else {
          r.events.push({ day, drink: r.drink, outcome, stayed: false });
          if (r.events.length > MAX_EVENTS) r.events.splice(0, r.events.length - MAX_EVENTS);
        }
        return r;
      }
      return false;
    }
    if (day != null) { r._lastWalkoutDay = day; r._lastWalkout = outcome; }
    r.events.push({ day, drink: r.drink, outcome, stayed: false });
    if (r.events.length > MAX_EVENTS) r.events.splice(0, r.events.length - MAX_EVENTS);
    r.op = clamp(r.op + delta, -1, 1);
    return r;
  }

  // Reverse a seen-mark when a patron defects to the rival before being served
  // (they didn't actually get the day's service — shouldn't earn opinion).
  unsee(idx) {
    const r = this.regulars[idx];
    if (r) r.seen = false;
  }
}
