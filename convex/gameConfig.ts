// Grunds — shared campaign tuning, ported from web/js/config.js.
// Single source of truth for the Convex backend. The web/ client keeps its
// own copy for headless/local play; this file governs server-side rolls so a
// seed produces the same drift + event distribution from any client.

export const DRIFT = {
  perDay: 0.025,
  maxIndex: 1.8,
  priceFloor: 4.8,
  priceCeiling: 5.4,
  priceDays: 5,
} as const;

export const CAMPAIGN_TUNING = {
  days: 5,
  beanBaseCost: 1.3,
  contractFee: 22.0,
  contractUnits: 2400,
  wastePct: 0.06,
  debtInterest: 4.0,
  startReputation: 62,
} as const;

export const EXPECTATION: Record<string, number> = {
  elders: -0.02,
  creatives: -0.01,
  commuters: 0.0,
  students: 0.01,
  tourists: 0.01,
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
