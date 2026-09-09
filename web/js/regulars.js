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

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const CONTAGION = 0.05;   // opinion pull toward each friend's mean (per day)

export class Regulars {
  constructor() {
    this.regulars = REGULAR_ROSTER.map((r, i) => ({
      ...r,
      i,
      op: 0.15,            // -1..1 opinion
      seen: false,         // did they show today?
      served: 0, balked: 0,
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
  pickFriendFor(idx, excludeIdx = -1) {
    const friends = this.friendships.get(idx);
    if (!friends || friends.size === 0) return null;
    const cands = [...friends].filter(f => f !== excludeIdx);
    if (cands.length === 0) return null;
    return cands[(Math.random() * cands.length) | 0];
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
  resolveDay({ served, balked, defections, priced }) {
    const happy = clamp(served / 60, 0, 1);
    for (const r of this.regulars) {
      if (!r.seen) continue;
      r.op += (happy - 0.5) * 0.10;
      if (balked > served * 0.18) r.op -= 0.05;        // a rough day sours the room
      if (defections > 8) r.op -= 0.03;                // the chain's line is a bad sign
      if (priced && r.coh === 'students') r.op += 0.04; // a deal the regulars love
      r.op = clamp(r.op, -1, 1);
      r.served = r.balked = 0; r.seen = false;
    }
    this.opContagion();
  }

  // One round of friendship contagion. Two-pass: compute the new opinion
  // for each regular into a temp array, then assign. Order-independent.
  // Isolates the contagion from the day's opinion update so tests can call
  // it directly.
  opContagion(weight = CONTAGION) {
    const n = this.regulars.length;
    const next = new Array(n);
    for (const r of this.regulars) {
      const friends = this.friendships.get(r.i);
      if (!friends || friends.size === 0) { next[r.i] = r.op; continue; }
      let sum = 0, count = 0;
      for (const f of friends) {
        const fr = this.regulars[f];
        if (fr) { sum += fr.op; count++; }   // defensive: skip stale refs
      }
      if (count === 0) { next[r.i] = r.op; continue; }
      const mean = sum / count;
      next[r.i] = r.op + (mean - r.op) * weight;
    }
    for (let i = 0; i < n; i++) this.regulars[i].op = clamp(next[i], -1, 1);
  }

  get reputation() {
    const m = this.regulars.reduce((s, r) => s + r.op, 0) / this.regulars.length;
    return Math.round(clamp(62 + m * 38, 0, 100));   // 0..100
  }
  get footfallMul() { return 1 + (this.reputation - 62) * 0.006; }   // ~±23% at the rails
  get tipMul() { return 1 + (this.reputation - 62) * 0.01; }

  // Mark a regular as present today (called when a patron of this cohort
  // spawns into the queue). Returns {idx, name, coh, found} so the patron
  // system can flag the mesh with a brass-band hat and a one-line greeting.
  // A chance to be a real, named regular (not just cohort colour) per cohort.
  markSeen(cohort) {
    const cands = this.regulars.filter(r => !r.seen && r.coh === cohort);
    if (!cands.length) return { found: false };
    const r = cands[(Math.random() * cands.length) | 0];
    r.seen = true;
    return { found: true, idx: r.i, name: r.name, coh: r.coh };
  }

  // Reverse a seen-mark when a patron defects to the rival before being served
  // (they didn't actually get the day's service — shouldn't earn opinion).
  unsee(idx) {
    const r = this.regulars[idx];
    if (r) r.seen = false;
  }
}
