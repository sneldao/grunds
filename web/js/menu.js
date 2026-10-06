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
//
// Cause and effect (loseable day 1): price deltas move demand at spawn time
// (see priceDivert below) and 86ing turns loyalists away at the board (see
// eightySixedShare) — gouging or gutting the menu can lose the day, not
// just slow it.

import { ECON } from './config.js';
import { ATTACH_ITEMS } from './behavioral.js';

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

// Mean of charged price / base. 1 is the posted menu. Matcha may be the
// live board (or a deal); the other drinks read the menu.
export function ticketLevel(prices, matchaPrice) {
  let sum = 0;
  for (const id of DRINK_IDS) {
    const base = DRINKS[id].base;
    const price = id === 'matcha' ? (matchaPrice ?? base) : (prices?.[id] ?? base);
    sum += base > 0 ? price / base : 1;
  }
  return sum / DRINK_IDS.length;
}

// How far a ±£1 move pulls a cohort off a drink. 0 at the posted base,
// so a menu that hasn't moved reproduces the old weights exactly.
const PRICE_PULL = 0.55;

export function orderWeight(id, weight, prices) {
  const w = weight ?? 0;
  if (w <= 0 || !prices) return w;
  const base = DRINKS[id]?.base ?? 0;
  if (!(base > 0)) return w;
  const price = prices[id] ?? base;
  const tilt = ((price - base) / PRICE_BAND) * PRICE_PULL;
  return w * Math.min(1.8, Math.max(0.2, 1 - tilt));
}

// rollDrink(cohort, offered, rng, prices) — weighted pick among offered
// drinks. offered is {id: bool}; an 86 drops the drink before the weights
// run. prices, when passed, shift those weights inside the ±£1 band.
// Matcha is always offered (the Brief forbids 86ing it).
export function rollDrink(cohort, offered = null, rng = Math.random, prices = null) {
  const weights = COHORT_ORDERS[cohort] || COHORT_ORDERS.commuters;
  const open = DRINK_IDS.filter(id => id === 'matcha' || (offered ? offered[id] !== false : true));
  const pool = open.filter(id => (weights[id] ?? 0) > 0);
  const from = pool.length ? pool : open;
  const wOf = (id) => orderWeight(id, weights[id] ?? 1, prices);
  const total = from.reduce((s, id) => s + wOf(id), 0);
  let r = rng() * total;
  for (const id of from) {
    r -= wOf(id);
    if (r <= 0) return id;
  }
  return from[from.length - 1];
}

// Patience follows prep. A 4-point matcha walks at balkAfter; a 1-point
// espresso waits four times as long and walks a quarter as often. A batched
// matcha is the patient cup, not an immortal one. The deal (repriced) and a
// bad floor (balkMul) still scale the chance the way the old matcha gate did.
export function prepPoints(drink, batched = false) {
  if (drink === 'matcha') return batched ? ECON.prepBatched : ECON.prepMatcha;
  return DRINKS[drink]?.points ?? ECON.prepOther;
}
export function balkLimit(drink, batched = false) {
  const pts = Math.max(1, prepPoints(drink, batched));
  return ECON.balkAfter * (ECON.prepMatcha / pts);
}
export function balkChanceFor(drink, batched = false, { repriced = false, balkMul = 1 } = {}) {
  const pts = Math.max(1, prepPoints(drink, batched));
  return ECON.balkChance * (pts / ECON.prepMatcha) * (repriced ? 0.25 : 1) * (balkMul || 1);
}

// Names the roster and the walk-in pool already store, mapped onto the four
// drinks the board can actually pour. Tea, latte, pour-over stay off the
// board: they are not an 86, so the roller still picks.
const BOARD_DRINK = {
  espresso: 'espresso', filter: 'filter', matcha: 'matcha', flatwhite: 'flatwhite',
  'flat white': 'flatwhite',
};
export function preferredOnBoard(name, offered = null) {
  if (!name) return { drink: null, turnedAway: false };
  const id = BOARD_DRINK[String(name).trim().toLowerCase()] || null;
  if (!id) return { drink: null, turnedAway: false };
  const open = id === 'matcha' || (offered ? offered[id] !== false : true);
  return open ? { drink: id, turnedAway: false } : { drink: null, turnedAway: true };
}

// One dawn bake. The retail wave is this croissant, not six SKUs.
// After a day on the floor, tomorrow's case is what sold plus a tray (10%).
// The first dawn has no history: half the scaled retail sheet. The other
// half never gets a body — the room holds 260 and the register is four a
// minute — so the case matches who can reach the till. Leftovers compost.
export const PASTRY = ATTACH_ITEMS.croissant;
// An empty case is not a closed shop. The croissant sale is lost.
// Three in four still buy the drink they came for. One in four leaves.
// The first time it happens that day, the room's mood drops by this much.
export const EMPTY_CASE_WALK = 0.25;
export const EMPTY_CASE_MOOD = -0.04;
export function pastryPar(dayWaves, spawnScale = 1, spawnMul = 1, lastRetail = 0, cut = 0) {
  let n;
  if (lastRetail > 0) n = Math.max(4, Math.round(lastRetail * 1.1));
  else {
    let q = 0;
    for (const w of dayWaves || []) {
      for (const s of w.spawns || []) {
        if (s && s.z && s.z !== 'counter') q += s.q || 0;
      }
    }
    const scale = Number.isFinite(spawnScale) ? spawnScale : 1;
    const mul = Number.isFinite(spawnMul) ? spawnMul : 1;
    n = Math.max(4, Math.round(q * scale * mul * 0.5));
  }
  const share = Math.min(1, Math.max(0, Number(cut) || 0));
  if (share > 0) n = Math.max(0, Math.round(n * (1 - share)));
  return n;
}

// A starred week sends a fuller van on the next day 1. One shot.
export function starredDelivery(qty, carry) {
  const q = qty || 0;
  if (!carry) return q;
  return Math.min(4000, Math.round((q * 1.2) / 10) * 10);
}

// Milk delivery: yesterday's milky pour +10%, rounded to 10s, clamped.
export function deliveryQty(lastMilky) {
  return Math.min(4000, Math.max(120, Math.round(((lastMilky || 0) * 1.1) / 10) * 10));
}

// Price elasticity at spawn time is measured against OUR board, not the
// rival's: delta = price − base for the rolled drink (£, can be negative).
// Positive deltas push patrons toward Glasshouse; negative deltas lure a few
// back (capped — a giveaway still costs margin). Pure: the board math lives
// here, spawn applies it. Tuned so base prices divert exactly 0, +£1 costs
// up to +30pts of diversion, −£1 buys back ~15pts. (The street's matcha
// curve is priced by the district, not the player, so it never diverts —
// only priced menu deltas and the mid-day deal move demand.)
export function priceDivert(delta, econ = null) {
  const per = econ?.pricePullPerPound ?? 0.45;
  const hi = econ?.pricePullMax ?? 0.30;
  const lo = econ?.priceLureMax ?? 0.15;
  const d = Number.isFinite(+delta) ? +delta : 0;
  if (d >= 0) return Math.min(hi, d * per);
  return Math.max(-lo, d * per);
}

// Matcha's board delta when the day-price moves under it: the chalkboard
// curve (4.80 → 5.40) is priced by the street, so patrons compare against
// the rival's board, not yesterday's memory. Kept SEPARATE from the
// player-priced menu path above (spawn never calls it) so the
// gentrification curve never double-counts the menu tool. Reserved for
// future event-deck use; not part of the day-1 lose path.
export function markupDivert(ourPrice, rivalPrice, econ = null) {
  const per = econ?.pricePullPerPound ?? 0.45;
  const hi = econ?.pricePullMax ?? 0.30;
  const lo = econ?.priceLureMax ?? 0.15;
  const d = (Number.isFinite(+ourPrice) ? +ourPrice : 0) - (Number.isFinite(+rivalPrice) ? +rivalPrice : 0);
  if (d >= 0) return Math.min(hi, d * per);
  return Math.max(-lo, d * per);
}

// 86 turnaway: share of patrons whose first-choice drink is off the board
// who walk at the board with a reason instead of re-rolling. The rest order
// something else — gutting the menu still costs the day, but never empties
// the room outright.
export function eightySixedShare(econ = null) {
  const s = econ?.eightySixedTurnaway ?? 0.48;
  return Math.max(0, Math.min(1, s));
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
