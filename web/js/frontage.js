import { COHORT_KEYS, LAYOUT } from './config.js';

const PEOPLE = COHORT_KEYS.filter(k => k !== 'rival');
export function frontageChance(awareness, reputation) {
  const aw = Number.isFinite(awareness) ? Math.max(0, Math.min(1, awareness)) : 0;
  const rep = Number.isFinite(reputation) ? Math.max(0, Math.min(100, reputation)) / 100 : 0;
  return Math.min(1, aw * rep * 3);
}

export class FrontageConversions {
  constructor(random) { this.random = random; this.reset(); }
  reset() { this.count = 0; this.pending = null; this.lastMinute = null; }
  tick(minute, { start = 360, awareness, reputation, spawn, approach = () => {}, resolve = () => {} }) {
    if (this.lastMinute === minute) return;
    this.lastMinute = minute;
    if (this.pending && minute >= this.pending.at + 8) {
      const p = this.pending;
      this.pending = null;
      const converted = this.random() < frontageChance(awareness, reputation) && !!spawn(p);
      if (converted) this.count++;
      resolve(p, converted);
    }
    if (this.count >= 3 || this.pending || minute < start || (minute - start) % 90 !== 45) return;
    this.pending = {
      at: minute,
      x: LAYOUT.door.x + (this.random() - 0.5) * 2.4,
      z: LAYOUT.pavementZ,
      cohort: PEOPLE[Math.floor(this.random() * PEOPLE.length)],
    };
    approach(this.pending);
  }
}
