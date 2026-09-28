// lots.js — Phase 2: named coffee lots with freshness, stock, and teeth.
//
// The hedge (contracts) was financial — beans you never taste. Lots are
// physical: named coffee with a unit cost, a roast clock, a finite sack, and
// cohort affinities. The Brief picks the house lot; cups pour from it;
// stale beans sour the room with a reason string.
//
// Pure + deterministic (no DOM, no clock): the sim owns when dawn resolves,
// when cups pour, and when the wire fires; this module owns the catalog, the
// math, and the state transitions. Server mirrors the tradeable subset
// (inventory + schedules); intra-day pours are floor-sim.

// unitBase is £/cup at beanIndex 1.0. Huila at £1.30 == today's baseline
// costPerCup, so the default house path reproduces legacy bean math and the
// old sim pins hold; the teeth live in switching.
export const LOT_CATALOG = {
  cerrado: {
    name: 'Brazil Cerrado', origin: 'Minas Gerais', unitBase: 0.95, quality: 0.65,
    affinity: { commuters: 1.15, elders: 1.05, students: 1.0, tourists: 1.0, creatives: 0.9 },
    blurb: 'the workhorse — cheap, consistent, nobody writes home',
  },
  huila: {
    name: 'Colombia Huila', origin: 'Huila', unitBase: 1.30, quality: 0.85,
    affinity: { commuters: 1.05, elders: 1.05, students: 1.05, tourists: 1.1, creatives: 1.05 },
    blurb: 'the balanced middle — nobody complains, nobody swoons',
  },
  yirgacheffe: {
    name: 'Ethiopia Yirgacheffe', origin: 'Gedeo Zone', unitBase: 1.90, quality: 1.0,
    affinity: { creatives: 1.3, tourists: 1.15, elders: 1.05, students: 1.0, commuters: 0.95 },
    blurb: 'floral, twice the price — the creatives can tell',
  },
  gesha: {
    name: 'Panama Gesha', origin: 'Boquete', unitBase: 3.20, quality: 1.2, microlot: true, stockCap: 60,
    affinity: { creatives: 1.5, tourists: 1.2, elders: 1.1, students: 1.05, commuters: 0.9 },
    blurb: 'the microlot — sixty cups of bragging rights',
  },
};
export const LOT_IDS = Object.keys(LOT_CATALOG);

// Starter sacks: the house default (huila) covers a busy day 1; the roast
// clock starts fresh so staleness first binds around day 4 (safe on-ramp).
export const STARTER_STOCK = { cerrado: 600, huila: 1500, yirgacheffe: 600, gesha: 0 };
export const STALE_AFTER = 2;          // age (days since roast) > 2 → stale
export const COMPOST_AFTER = 3;        // age > 3 → composted at dawn (binds the finale: day-1 leftovers tip day 5)
export const EMERGENCY_MUL = 1.5;      // all sacks empty: Idris's emergency sack
export const FRESH_TOPUP_FRAC = 0.2;   // top-up refreshes the roast date only when stock < 20% of the buy
export const STALE_NUDGE = -0.03;      // stale cup served to a roster regular
export const AFFINITY_NUDGE = 0.05;    // fresh cup: (affinity - 1) × this

// Roast program: each lot has an ideal level (1 light → 5 dark); distance
// costs 0.1 quality per step. Creatives love light Yirg, commuters love
// dark Cerrado — the numbers say it through quality, the room tastes it.
export const ROAST_IDEAL = { cerrado: 4, huila: 3, yirgacheffe: 2, gesha: 2 };
export function roastQuality(lotId, level) {
  const ideal = ROAST_IDEAL[lotId] ?? 3;
  const lv = Math.min(5, Math.max(1, Math.round(level)));
  return Math.round((1 - 0.1 * Math.abs(lv - ideal)) * 100) / 100;
}

// Wire → shelf: commodity events move specific lots with a landing lag, and
// hype/frost aftermath unlocks the Gesha microlot. Rumour handling stays in
// the event deck (it weights draws); this table prices the aftermath.
export const LOT_EVENTS = {
  frost_minas: { moves: [{ lot: 'cerrado', mul: 1.35, lag: 2 }], unlock: null },
  drought_ea: { moves: [{ lot: 'yirgacheffe', mul: 1.3, lag: 2 }], unlock: null },
  hype_matcha: { moves: [], unlock: { lot: 'gesha', days: 2 } },
};

// Stale-cup reason strings, per cohort — the room tells you what it tastes.
export const STALE_LINES = {
  commuters: 'the commuters taste yesterday’s roast',
  creatives: 'the creatives noticed the new espresso',
  students: 'the students went quiet over their cups',
  elders: 'Olu remembers when the roast was fresh',
  tourists: 'a tourist asked if the beans are old',
};
export const SCORCH_LINE = 'today’s roast went dark — the room can tell';

// £/cup to BUY right now: base × market drift × wire multiplier.
export function lotSpot(lotId, beanIndex, priceMul = 1) {
  const entry = LOT_CATALOG[lotId];
  if (!entry) return 0;
  return entry.unitBase * beanIndex * priceMul;
}

// Pour quality from roast age, roast level, and scorch. Fresh + ideal =
// 1.0; age fades it, off-ideal roast fades it, a scorched sack halves it.
export function cupQuality(ageDays, roastMul = 1, scorched = false) {
  const base = ageDays <= 1 ? 1 : ageDays <= STALE_AFTER ? 0.85 : 0.6;
  return base * roastMul * (scorched ? 0.5 : 1);
}
export function isStale(ageDays) { return ageDays > STALE_AFTER; }

// Opinion delta for serving one roster regular a cup of (lot, cohort, age).
// Fresh loved lots warm slowly (scaled by roast); stale or scorched cups
// sour at a flat rate.
export function serveNudge(lotId, cohort, ageDays, roastMul = 1, scorched = false) {
  if (scorched || isStale(ageDays)) return STALE_NUDGE;
  const aff = (LOT_CATALOG[lotId]?.affinity ?? {})[cohort] ?? 1;
  return (aff - 1) * AFFINITY_NUDGE * roastMul;
}

// Adaptive restock: yesterday's pour + 25% buffer, rounded to 50s.
export function restockQty(pouredYesterday) {
  return Math.max(0, Math.ceil((pouredYesterday * 1.25) / 50) * 50);
}

// LotsState — the cellar. Lots keyed by id:
// { stock, value (£ sunk), roastedOn (day), roast (1-5), scorched,
//   priceMul, unlocked, unlockUntil, hedgedStock }.
export class LotsState {
  constructor() { this.reset(); }
  reset() {
    this.lots = {};
    for (const id of LOT_IDS) {
      this.lots[id] = {
        stock: STARTER_STOCK[id] ?? 0,
        value: (STARTER_STOCK[id] ?? 0) * LOT_CATALOG[id].unitBase,
        roastedOn: 1,
        roast: ROAST_IDEAL[id] ?? 3,
        scorched: false,
        priceMul: 1,
        unlocked: !LOT_CATALOG[id].microlot,
        unlockUntil: 0,
        hedgedStock: 0,
      };
    }
    this.house = 'huila';
    this.pending = [];   // [{ lot, mul, landDay }]
  }
  entry(lotId) { return this.lots[lotId] || null; }
  age(lotId, day) { const e = this.entry(lotId); return e ? Math.max(0, day - e.roastedOn) : 0; }
  avgCost(lotId) {
    const e = this.entry(lotId);
    return e && e.stock > 0 ? e.value / e.stock : lotSpot(lotId, 1, e?.priceMul ?? 1);
  }
  // Buy cups into a lot. Contract cover (units + price) flows through opts
  // when the player holds a forward position: cups cost the locked price and
  // pour as hedged. A mostly-fresh delivery resets the roast clock; topping
  // a deep stale sack keeps the old date ("new sack on old beans").
  buy(lotId, cups, unitPrice, day, { hedgedUnits = 0 } = {}) {
    const e = this.entry(lotId);
    if (!e || cups <= 0) return { cost: 0, cups: 0 };
    if (e.unlocked === false) return { cost: 0, cups: 0 };
    let room = cups;
    if (LOT_CATALOG[lotId].stockCap) room = Math.min(room, Math.max(0, LOT_CATALOG[lotId].stockCap - e.stock));
    if (room <= 0) return { cost: 0, cups: 0 };
    const cost = room * unitPrice;
    if (e.stock < room * FRESH_TOPUP_FRAC) e.roastedOn = day;
    e.stock += room;
    e.value += cost;
    e.hedgedStock += Math.min(room, hedgedUnits);
    return { cost, cups: room };
  }
  // Pour one cup from the house lot. Stockout cascades to the fullest open
  // lot; bone-dry cellar triggers an emergency sack (flagged, never silent).
  pour(day) {
    void day;
    let e = this.entry(this.house);
    let lotId = this.house;
    if (!e || e.stock <= 0 || e.unlocked === false) {
      let best = null;
      for (const id of LOT_IDS) {
        const c = this.lots[id];
        if (c.unlocked === false || c.stock <= 0) continue;
        if (!best || c.stock > best.stock) best = { id, stock: c.stock };
      }
      if (!best) return { lotId: null, unitCost: 0, hedged: false, emergency: true, switched: false };
      lotId = best.id;
      e = this.lots[lotId];
    }
    const switched = lotId !== this.house;
    if (switched) this.house = lotId;
    const unitCost = e.stock > 0 ? e.value / e.stock : 0;
    const hedged = e.hedgedStock > 0;
    e.stock -= 1;
    e.value = Math.max(0, e.value - unitCost);
    if (hedged) e.hedgedStock -= 1;
    return { lotId, unitCost, hedged, emergency: false, switched };
  }
  // Wire event fires: schedule price moves with lags, open microlot windows.
  // Returns note lines for the Brief ("the frost will land in 2 days").
  applyWireEvent(eventId, day) {
    const def = LOT_EVENTS[eventId];
    if (!def) return [];
    const notes = [];
    for (const m of def.moves || []) {
      this.pending.push({ lot: m.lot, mul: m.mul, landDay: day + m.lag });
      const entry = LOT_CATALOG[m.lot];
      notes.push(`${entry ? entry.name : m.lot} +${Math.round((m.mul - 1) * 100)}% in ${m.lag}d`);
    }
    if (def.unlock) {
      const e = this.entry(def.unlock.lot);
      if (e) {
        e.unlocked = true;
        e.unlockUntil = Math.max(e.unlockUntil, day + def.unlock.days);
        notes.push(`${LOT_CATALOG[def.unlock.lot].name} unlocked (${def.unlock.days}d)`);
      }
    }
    return notes;
  }
  // Dawn: land due moves, expire microlot windows. Returns report lines.
  // Landing a cerrado move shifts supply to Panama: the Gesha window opens
  // (mirrors server landDueMoves).
  resolveDawn(day) {
    const report = [];
    const due = this.pending.filter(p => p.landDay <= day);
    this.pending = this.pending.filter(p => p.landDay > day);
    for (const m of due) {
      const e = this.entry(m.lot);
      if (!e) continue;
      e.priceMul = Math.round(e.priceMul * m.mul * 100) / 100;
      report.push(`${LOT_CATALOG[m.lot].name} ${m.mul >= 1 ? '+' : ''}${Math.round((m.mul - 1) * 100)}% — landed`);
      if (m.lot === 'cerrado') {
        const g = this.entry('gesha');
        if (g) {
          g.unlocked = true;
          g.unlockUntil = Math.max(g.unlockUntil, day + 2);
          report.push('Panama Gesha unlocked (2d) — supply shifts');
        }
      }
    }
    for (const id of LOT_IDS) {
      const e = this.lots[id];
      if (e.unlocked && LOT_CATALOG[id].microlot && e.unlockUntil > 0 && day > e.unlockUntil) {
        e.unlocked = false;
        e.unlockUntil = 0;
        report.push(`${LOT_CATALOG[id].name} window closed`);
      }
      e.scorched = false;   // yesterday's scorch never crosses dawn
    }
    return report;
  }
  // Compost: discard stock older than afterDays (dawn clean-out). Returns
  // { cups, names } for the receipt + toast. Ruth at skill 2 nurses beans
  // a day longer (caller passes the threshold).
  compost(day, afterDays = COMPOST_AFTER) {
    let cups = 0;
    const names = [];
    for (const id of LOT_IDS) {
      const e = this.lots[id];
      if (e.stock > 0 && day - e.roastedOn > afterDays) {
        cups += e.stock;
        names.push(LOT_CATALOG[id].name);
        e.stock = 0; e.value = 0; e.hedgedStock = 0;
      }
    }
    return { cups, names };
  }
}
