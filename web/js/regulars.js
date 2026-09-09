// The Regulars — the social layer. Named patrons whose opinion survives the
// day's reset; gossip and grudges compound into reputation. Reputation is the
// lever that connects the floor's yesterday to tomorrow's demand and tips.
// (ARCHITECTURE.md "precedent (memory) → opinions, friendships".)
import { REGULAR_ROSTER, COHORTS } from './config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class Regulars {
  constructor() {
    this.regulars = REGULAR_ROSTER.map((r, i) => ({
      ...r,
      i,
      op: 0.15,            // -1..1 opinion
      seen: false,         // did they show today?
      served: 0, balked: 0,
    }));
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

  // Resolve a day: fold the floor's outcomes into opinion. Brought to the
  // next dawn via the letter's tone and the reputation meter.
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
  }
}
