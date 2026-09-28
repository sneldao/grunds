// Grunds — shared campaign tuning, ported from web/js/config.js.
// Single source of truth for the Convex backend. The web/ client keeps its
// own copy for headless/local play; this file governs server-side rolls so a
// seed produces the same drift + event distribution from any client.

export const DRIFT = {
  perDay: 0.025,
  accel: 0.008,
  maxIndex: 1.8,
  priceFloor: 4.8,
  priceCeiling: 5.4,
  priceDays: 5,
} as const;

export const CAMPAIGN_TUNING = {
  days: 5,
  beanBaseCost: 1.3,
  contractUnitFee: 0.09,    // £ per covered cup at standard size (mirrors config.js)
  contractFeeSlope: 0.025,  // per-cup rate steps this much per size tier
  contractUnits: 2400,
  wastePct: 0.06,
  debtInterest: 4.0,
  debtInterestRate: 0.025,
  creditLimit: 1500,        // supplier tab ceiling — resolveDecision enforces it
  startReputation: 62,
} as const;

export const EXPECTATION: Record<string, number> = {
  elders: -0.02,
  creatives: -0.01,
  commuters: 0.0,
  students: 0.01,
  tourists: 0.01,
};

// Phase 1 — life-stage machine, mirrored from web/js/identity.js STAGE_RULES.
// Keep the numbers identical: the server resolveDay and the client floor must
// promote/demote the same regular on the same day.
export const STAGE_RULES = {
  firstTimer: { visits: 1 },
  regular: { visits: 3, op: 0.1 },
  friend: { visits: 5, op: 0.4 },
  evangelist: { visits: 7, op: 0.6 },
} as const;
export const STAGE_ORDER = ['visitor', 'first-timer', 'regular', 'friend', 'evangelist'] as const;
export const DEMOTE_OP = -0.2;
export const DEMOTE_FLOOR = 'first-timer';

export function stageFor(visits: number, op: number): string {
  // Earned (visits-only) stage first: a sour veteran demotes exactly one
  // stage instead of collapsing — history survives one bad day.
  let earned = 'visitor';
  if (visits >= STAGE_RULES.firstTimer.visits) earned = 'first-timer';
  if (visits >= STAGE_RULES.regular.visits) earned = 'regular';
  if (visits >= STAGE_RULES.friend.visits) earned = 'friend';
  if (visits >= STAGE_RULES.evangelist.visits) earned = 'evangelist';
  if (op < DEMOTE_OP && earned !== 'visitor') {
    const i = Math.max(STAGE_ORDER.indexOf(DEMOTE_FLOOR), STAGE_ORDER.indexOf(earned as typeof STAGE_ORDER[number]) - 1);
    return STAGE_ORDER[i];
  }
  let stage = 'visitor';
  if (visits >= STAGE_RULES.firstTimer.visits) stage = 'first-timer';
  if (visits >= STAGE_RULES.regular.visits && op > STAGE_RULES.regular.op) stage = 'regular';
  if (visits >= STAGE_RULES.friend.visits && op > STAGE_RULES.friend.op) stage = 'friend';
  if (visits >= STAGE_RULES.evangelist.visits && op > STAGE_RULES.evangelist.op) stage = 'evangelist';
  return stage;
}

// Phase 1 — canon drinks, quirk-derived (mirrors web/js/identity.js
// CANON_DRINKS). The backfill pours these into pre-Phase-1 regular rows.
export const CANON_DRINKS: Record<string, string> = {
  Mara: 'flat white', Tomas: 'pour-over', Pip: 'matcha', Olu: 'filter',
  Gwen: 'latte', Yuki: 'single-origin', Dev: 'espresso', Esther: 'tea',
};

export type EventTier = "cata" | "bad" | "good" | "calm" | "warn";

export interface EventDef {
  tier: EventTier;
  dIndex: number;
  dur: number;
  weight: number;
  demand?: number;
  head: string;
  line: string;
}

export const EVENTS: Record<string, EventDef> = {
  frost_minas: {
    tier: "cata",
    dIndex: 0.3,
    dur: 2,
    weight: 8,
    head: "FROST ON MINAS GERAIS",
    line: "A cold front burned the arabica canopy in southern Brazil overnight. The market is scrambling.",
  },
  drought_ea: {
    tier: "bad",
    dIndex: 0.15,
    dur: 2,
    weight: 14,
    head: "EAST AFRICA SHORT RAINS",
    line: "The short rains failed across the washed-coffee belt. Lots are thinning out.",
  },
  harvest_good: {
    tier: "good",
    dIndex: -0.08,
    dur: 1,
    weight: 20,
    head: "CLEAN COLOMBIAN HARVEST",
    line: "A clean harvest landed in Huila. The market exhales; costs ease.",
  },
  stable: {
    tier: "calm",
    dIndex: 0.02,
    dur: 1,
    weight: 30,
    head: "A QUIET MARKET",
    line: "Nothing moving on the board. A day to breathe.",
  },
  hype_matcha: {
    tier: "good",
    dIndex: 0,
    dur: 1,
    weight: 12,
    demand: 1.18,
    head: "THE LISTS NOTICED MATCHA",
    line: "A matcha bar went viral. Your nature is now everyone's nature.",
  },
  rumour_frost: {
    tier: "warn",
    dIndex: 0.05,
    dur: 1,
    weight: 16,
    head: "A RUMOUR OFF THE PLATEAU",
    line: "There's talk of a cold front building. Nobody's contracted yet. You could.",
  },
};

export interface RegularSeed {
  name: string;
  coh: string;
  friends: string[];
  quirk: string;
}

export const REGULAR_ROSTER: RegularSeed[] = [
  { name: "Mara", coh: "commuters", friends: ["Dev", "Olu", "Pip"], quirk: "same flat white, no time" },
  { name: "Tomas", coh: "creatives", friends: ["Yuki", "Pip", "Olu"], quirk: "one pour-over, three hours" },
  { name: "Pip", coh: "students", friends: ["Tomas", "Yuki", "Gwen", "Mara"], quirk: "the 14:00 matcha" },
  { name: "Olu", coh: "elders", friends: ["Esther", "Mara", "Tomas"], quirk: "remembers every mistake" },
  { name: "Gwen", coh: "tourists", friends: ["Pip", "Tomas", "Dev"], quirk: "follows the lists, tips well" },
  { name: "Yuki", coh: "creatives", friends: ["Tomas", "Pip"], quirk: "only drinks single-origin" },
  { name: "Dev", coh: "commuters", friends: ["Mara", "Gwen"], quirk: "counts the queue out loud" },
  { name: "Esther", coh: "elders", friends: ["Olu"], quirk: "has today's loyalty stamp" },
];

// Deterministic LCG — mirrors web/js/exchange.js `seeded()`. Same seed +
// same day produce the same roll, per EVAL.md "same seed → same run".
export function seededRandom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Matcha till price on a 1-indexed day. Linear floor→ceiling over priceDays.
export function priceForDay(day: number): number {
  if (day <= 1) return DRIFT.priceFloor;
  if (day >= DRIFT.priceDays) return DRIFT.priceCeiling;
  return (
    DRIFT.priceFloor +
    ((DRIFT.priceCeiling - DRIFT.priceFloor) * (day - 1)) / (DRIFT.priceDays - 1)
  );
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
