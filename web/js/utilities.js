// utilities.js — the bills that keep the lights on, and the wifi that can drop.
//
// Pure + deterministic (no DOM, no clock): main.js owns when the day runs;
// this module owns the meter math and the seeded outage plan. Power scales
// with drinks made; wifi is flat but carries the card reader, so an outage
// is a cash-only window the player can buy their way out of (tether).
import { CAMPAIGN } from './config.js';

const U = () => CAMPAIGN.utilities;

// The day's utility lines for the cost sheet.
export function utilityCosts(served = 0) {
  const u = U();
  return { power: u.powerStanding + Math.max(0, served) * u.powerPerCup, wifi: u.wifi };
}

// Seeded 0..1 draws for (seed, day, salt): same seed + day → same week.
function draw(seed, day, salt) {
  let h = (Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) ^ Math.imul(day + 1, 40503) ^ Math.imul(salt + 7, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The day's outage, or null. Never day 1 (the first morning is for learning
// the floor). { start, end } in day-minutes.
export function planOutage(seed, day) {
  const o = U().outage;
  if (day < 2 || draw(seed, day, 1) >= o.chance) return null;
  const start = o.startMin + Math.floor(draw(seed, day, 2) * o.startSpan);
  return { start, end: start + o.durMin + Math.floor(draw(seed, day, 3) * o.durSpan) };
}

// Live state for an outage at dayMin: 'none' | 'down' | 'tethered' | 'restored'.
export function outageStatus(outage, dayMin) {
  if (!outage || dayMin < outage.start) return 'none';
  if (dayMin >= outage.end) return 'restored';
  return outage.tethered ? 'tethered' : 'down';
}

// Share of sales lost at the till right now from the wifi alone.
export function wifiCardLoss(outage, dayMin) {
  return outageStatus(outage, dayMin) === 'down' ? U().outage.cardLoss : 0;
}
