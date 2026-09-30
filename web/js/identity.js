// identity.js — Phase 1: patron identity, life stages, memory.
//
// Pure + deterministic (no DOM, no THREE, no clock) like demand.js: the sim
// (patrons.js spawn, main.js serve-loop) owns when identities attach and when
// visits record; this module owns names, stages, lines, and dossiers.
//
// Two populations share one stage machine:
// - Canon regulars (the 8-roster: Mara, Tomas, …) — names/quirks/friends are
//   fixed; visits/stage/op persist on the Regulars entry + server row.
// - Walk-ins — generated heads from a per-day deterministic pool; a walk-in
//   who reaches 'regular' graduates onto the board under "new faces".
// Opinion itself stays where it lives (roster op / pool head op); stageFor
// takes (visits, op) so rosters and pools share the machine.
import { hashSeed, mulberry32 } from './portrait.js';

export const STAGES = ['visitor', 'first-timer', 'regular', 'friend', 'evangelist'];

// Promotion thresholds. Mirrored in convex/gameConfig.ts (STAGE_RULES) for
// the server resolveDay — keep the numbers identical.
export const STAGE_RULES = {
  firstTimer: { visits: 1 },
  regular: { visits: 3, op: 0.1 },
  friend: { visits: 5, op: 0.4 },
  evangelist: { visits: 7, op: 0.6 },
};
export const DEMOTE_OP = -0.2;        // below this: drop one stage
export const DEMOTE_FLOOR = 'first-timer'; // you can't un-meet someone
export const COMPANION_CHANCE = 0.35; // friend+ brings a +1
export const WOM_PER_EVANGELIST = 2;  // each evangelist serve → +2 returnees
export const POOL_SIZE = 24;
export const MAX_EVENTS = 12;

// Walk-in first names, per cohort vibe. Canon roster names never appear here.
export const NAME_POOLS = {
  commuters: ['Ash', 'Bex', 'Cole', 'Dana', 'Ellis', 'Fran', 'Gus', 'Hollis', 'Ira', 'Jo'],
  creatives: ['Wren', 'Juno', 'Sable', 'Indie', 'Moss', 'Pax', 'Rook', 'Suki', 'Theo', 'Vesper'],
  students: ['Ali', 'Bea', 'Cam', 'Dee', 'Ezra', 'Fay', 'Gil', 'Hana', 'Ivy', 'Jay'],
  elders: ['Alba', 'Bram', 'Cora', 'Dougal', 'Elsie', 'Frank', 'Greta', 'Harold', 'Iris', 'Walter'],
  tourists: ['Chloe', 'Diego', 'Emma', 'Felix', 'Gia', 'Hugo', 'Isla', 'Kenji', 'Lena', 'Marco'],
  rival: ['Rae', 'Kit'],
};

// Walk-in drinks per cohort. Canon drinks live below (quirk-derived).
export const COHORT_DRINKS = {
  commuters: ['espresso', 'flat white'],
  creatives: ['pour-over', 'single-origin'],
  students: ['matcha', 'iced matcha'],
  elders: ['filter', 'tea'],
  tourists: ['latte', 'cappuccino'],
  rival: ['espresso'],
};
export const CANON_DRINKS = {
  Mara: 'flat white', Tomas: 'pour-over', Pip: 'matcha', Olu: 'filter',
  Gwen: 'latte', Yuki: 'single-origin', Dev: 'espresso', Esther: 'tea',
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// stageFor(visits, op) → stage. Promotion needs visits AND warmth (the op
// gates); a sour veteran demotes exactly one stage from their *earned*
// (visits-only) stage instead of collapsing — history survives one bad day.
// Floored at first-timer: you can't un-meet someone.
export function stageFor(visits, op) {
  let earned = 'visitor';
  if (visits >= STAGE_RULES.firstTimer.visits) earned = 'first-timer';
  if (visits >= STAGE_RULES.regular.visits) earned = 'regular';
  if (visits >= STAGE_RULES.friend.visits) earned = 'friend';
  if (visits >= STAGE_RULES.evangelist.visits) earned = 'evangelist';
  if (op < DEMOTE_OP && earned !== 'visitor') {
    const i = Math.max(STAGES.indexOf(DEMOTE_FLOOR), STAGES.indexOf(earned) - 1);
    return STAGES[i];
  }
  let stage = 'visitor';
  if (visits >= STAGE_RULES.firstTimer.visits) stage = 'first-timer';
  if (visits >= STAGE_RULES.regular.visits && op > STAGE_RULES.regular.op) stage = 'regular';
  if (visits >= STAGE_RULES.friend.visits && op > STAGE_RULES.friend.op) stage = 'friend';
  if (visits >= STAGE_RULES.evangelist.visits && op > STAGE_RULES.evangelist.op) stage = 'evangelist';
  return stage;
}

// recordVisit(identity, { day, drink, outcome, stayed }) — bumps visits,
// appends a capped event, and restages against the supplied op. Mutates and
// returns the identity (the pool/roster owns the object).
export function recordVisit(ident, { day, drink, outcome, stayed }) {
  if (day != null && ident._lastOutcomeDay === day) return ident;
  if (day != null) ident._lastOutcomeDay = day;
  ident.visits += 1;
  ident.events.push({ day, drink: drink || ident.drink, outcome, stayed: !!stayed });
  if (ident.events.length > MAX_EVENTS) ident.events.splice(0, ident.events.length - MAX_EVENTS);
  if (drink) ident.drink = drink;
  ident.stage = stageFor(ident.visits, ident._op ?? 0.15);
  return ident;
}

export function stageLabel(ident) {
  if (!ident || !ident.stage) return 'visitor';
  if (ident.stage === 'first-timer' && (ident.visits || 0) > 1) return 'warming up';
  return ident.stage;
}

export function feeling(op) { return op > 0.2 ? 'warming' : op < -0.2 ? 'unhappy' : 'neutral'; }

// makeIdentity — the blank face. Callers fill canon fields for roster spawns.
export function makeIdentity({ pid, name, cohort, drink, homeTable = null, visits = 0, op = 0.15, stage = null, events = [] } = {}) {
  const ident = { pid, name, faceSeed: pid, cohort, drink, homeTable, visits, events: [...events], _op: op };
  ident.stage = stage || stageFor(visits, op);
  return ident;
}

// memoryLine — the arrival greeting for a returning face. Pure: every field
// comes from the identity (+ optional quirk / companion name).
export function memoryLine({ name, stage, visits, drink, quirk = null, broughtFriend = null }) {
  if (broughtFriend) return `${name} brought ${broughtFriend} — “look after them, yeah?”`;
  if (stage === 'evangelist') return `${name}’s telling everyone about this place`;
  if (stage === 'friend') return `${name}! — ${visits} visits and counting`;
  if (quirk && visits % 2 === 1) return `${name} — ${quirk}`;
  if (stage === 'regular' || stage === 'friend') return `${name}’s back — ${visits} visits, still on the ${drink}`;
  return `${name}’s back — ${drink} again?`;
}

// dossierLines — the click-a-sitter card: stats + up to 5 recent events,
// templated from real history. Pure.
export function dossierLines(ident, { op = null, friends = [] } = {}) {
  const lines = [];
  lines.push(`${stageLabel(ident)} · ${ident.visits} visit${ident.visits === 1 ? '' : 's'} · ${ident.drink}`);
  if (op != null) lines.push(`${feeling(op)} about this place`);
  if (friends.length) lines.push(`friends here: ${friends.slice(0, 3).join(', ')}`);
  for (const e of ident.events.slice(-5).reverse()) {
    const when = `day ${e.day}`;
    if (e.outcome === 'served') lines.push(`${when} — served ${e.drink}${e.stayed ? ', stayed a while' : ''}`);
    else if (e.outcome === 'balked') lines.push(`${when} — walked out (the line)`);
    else if (e.outcome === 'defected') lines.push(`${when} — crossed to Glasshouse`);
  }
  return lines;
}

// shouldBringCompanion(stage, rng) — friend+ gate for the +1 spawn hook.
export function shouldBringCompanion(stage, rng = Math.random) {
  const i = STAGES.indexOf(stage);
  return i >= STAGES.indexOf('friend') && rng() < COMPANION_CHANCE;
}

// womReturnees(evangelistServes) — evangelist serves become tomorrow's crowd.
export function womReturnees(evangelistServes) {
  return Math.max(0, Math.floor(evangelistServes)) * WOM_PER_EVANGELIST;
}

// WalkinPool — one living pool of generated heads per campaign day.
// ensureDay(day) carries yesterday's known faces (visits > 0, up to 8 —
// the regulars-to-be) and deals fresh heads from mulberry32(seed:day) for
// the rest, so a replayed opening day meets the same strangers but a lived
// week keeps its people. draw(cohort) hands out a matching head (falling
// back to any cohort); recordVisit mutates the head in place.
export const POOL_CARRY = 8;
export class WalkinPool {
  constructor(seed = 7) {
    this.seed = seed;
    this.day = -1;
    this.heads = [];
    this.byPid = new Map();
    this.drawn = new Set();
  }
  ensureDay(day) {
    if (day === this.day) return this.heads;
    this.day = day;
    this.drawn = new Set();
    // carry the known faces — most visits first, capped so fresh blood
    // keeps arriving.
    const carry = this.heads
      .filter(h => h.visits > 0)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, POOL_CARRY);
    this.heads = [...carry];
    this.byPid = new Map();
    for (const h of carry) this.byPid.set(h.pid, h);
    const rng = mulberry32(hashSeed(`${this.seed}:${day}`));
    const cohorts = Object.keys(NAME_POOLS).filter(c => c !== 'rival');
    const dealt = new Set(carry.map(h => h.name));
    for (let i = this.heads.length; i < POOL_SIZE; i++) {
      const cohort = cohorts[(rng() * cohorts.length) | 0];
      const pool = NAME_POOLS[cohort];
      let name = pool[(rng() * pool.length) | 0];
      if (dealt.has(name)) name = `${name} ${String.fromCharCode(66 + (i % 20))}.`;
      dealt.add(name);
      const drinks = COHORT_DRINKS[cohort] || ['filter'];
      const pid = `d${day}-w${i}`;
      const head = makeIdentity({
        pid, name, cohort,
        drink: drinks[(rng() * drinks.length) | 0],
        visits: 0, op: 0.15,
      });
      head._op = 0.15;
      this.heads.push(head);
      this.byPid.set(pid, head);
    }
    return this.heads;
  }
  draw(cohort, rng = Math.random) {
    const matching = this.heads.filter(h => h.cohort === cohort && !this.drawn.has(h.pid));
    if (!matching.length) return null;
    const h = matching[(rng() * matching.length) | 0];
    this.drawn.add(h.pid);
    return h;
  }
  get(pid) { return this.byPid.get(pid) || null; }
  // outcome: 'served' | 'balked' | 'defected'. Nudges pool op, restages.
  recordVisit(pid, { day, drink, outcome, stayed }) {
    const head = this.byPid.get(pid);
    if (!head) return null;
    if (day != null && head._lastOutcomeDay === day) return head;
    if (outcome === 'served') head._op = clamp(head._op + 0.05, -1, 1);
    else if (outcome === 'balked') head._op = clamp(head._op - 0.08, -1, 1);
    else if (outcome === 'defected') head._op = clamp(head._op - 0.12, -1, 1);
    return recordVisit(head, { day, drink, outcome, stayed });
  }
  // graduated walk-ins for the board: stage regular+, most visits first.
  graduated(limit = 8) {
    return this.heads
      .filter(h => STAGES.indexOf(h.stage) >= STAGES.indexOf('regular'))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, limit);
  }
}
