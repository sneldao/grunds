// menu.js — Phase 3: the drink menu.
//
// Four drinks with distinct margins, bar-time costs, and cohort followings.
// The Brief offers two menu decisions: 86 a drink (pull it for the day —
// matcha is never 86'd, the batch prep assumes it) and price within a band.
// The reprice lever (key 2) is untouched: it still cuts matcha mid-day.
//
// Pure + deterministic (no DOM, no clock): prices/offered sets live in the
// sim (main.js module scope, fresh per campaign) and pass in as args, so
// headless policy runs can't leak state across imports.

export const DRINKS = {
  espresso: { name: 'Espresso', base: 3.20, points: 1, milk: false, blurb: 'fast, cheap, gone in three sips' },
  flatwhite: { name: 'Flat white', base: 3.60, points: 2, milk: true, blurb: 'the everyday — milk, balance, margin' },
  filter: { name: 'Filter', base: 3.00, points: 3, milk: false, blurb: 'slow brew, slow bar, loyal drinkers' },
  matcha: { name: 'Matcha', base: 4.80, points: 4, milk: true, blurb: 'stone-ground, four minutes, the 14:00 wave' },
};
export const DRINK_IDS = Object.keys(DRINKS);

// Cohort order distributions (weights). Overall matcha ≈ 30% — near the
// legacy 35% share, so the floor's rhythm survives the menu.
export const COHORT_ORDERS = {
  commuters: { espresso: 5, flatwhite: 3, filter: 1, matcha: 1 },
  creatives: { filter: 4, flatwhite: 3, matcha: 2, espresso: 1 },
  students: { matcha: 5, flatwhite: 3, filter: 1, espresso: 1 },
  elders: { filter: 5, espresso: 2, flatwhite: 2, matcha: 1 },
  tourists: { flatwhite: 4, matcha: 3, filter: 2, espresso: 1 },
  rival: { espresso: 1 },
};

export const PRICE_STEP = 0.20;
export const PRICE_BAND = 1.00;   // ±£1.00 around base

export function basePrices() {
  return Object.fromEntries(DRINK_IDS.map(id => [id, DRINKS[id].base]));
}
export function clampPrice(id, price) {
  const base = DRINKS[id]?.base ?? 0;
  const lo = Math.round((base - PRICE_BAND) * 100) / 100;
  const hi = Math.round((base + PRICE_BAND) * 100) / 100;
  return Math.min(hi, Math.max(lo, Math.round(price * 100) / 100));
}
export function menuPrice(id, prices) {
  return prices?.[id] ?? DRINKS[id]?.base ?? 0;
}

// rollDrink(cohort, offered, rng) — weighted pick among offered drinks.
// offered is {id: bool}; matcha is always offered (the Brief forbids 86ing
// it), but the roller honors the set regardless — no special cases.
export function rollDrink(cohort, offered = null, rng = Math.random) {
  const weights = COHORT_ORDERS[cohort] || COHORT_ORDERS.commuters;
  const open = DRINK_IDS.filter(id => id === 'matcha' || (offered ? offered[id] !== false : true));
  const pool = open.filter(id => (weights[id] ?? 0) > 0);
  const from = pool.length ? pool : open;
  const total = from.reduce((s, id) => s + (weights[id] ?? 1), 0);
  let r = rng() * total;
  for (const id of from) {
    r -= weights[id] ?? 1;
    if (r <= 0) return id;
  }
  return from[from.length - 1];
}

// Milk delivery: yesterday's milky pour +10%, rounded to 10s, clamped.
export function deliveryQty(lastMilky) {
  return Math.min(400, Math.max(120, Math.round(((lastMilky || 0) * 1.1) / 10) * 10));
}

// Day-1 delivery (no history): size from today's wave sheet so the van
// matches the rush in sim scale and real play alike. milkyShare ≈ 0.5
// (flat white + matcha across the cohort mix), +10% buffer.
export function waveMilkEstimate(dayWaves, spawnScale, spawnMul, milkyShare = 0.5) {
  let q = 0;
  for (const w of dayWaves || []) {
    for (const s of w.spawns || []) q += s.q || 0;
  }
  return Math.min(4000, Math.max(120, Math.round((q * spawnScale * spawnMul * milkyShare * 1.1) / 10) * 10));
}
