// street.js — VISION.md "street of shops": every stand on the street is a
// coffee business with an origin identity, a speciality, and (for the
// specialists) one distinctive insight no other shop holds. Pure and
// deterministic: no DOM, no Math.random, no clock. The floor reads this
// module; the sim reads it through the same exported functions so a seed
// replays identically.
//
// Origin keys match the Exchange's event geography (config.js EVENTS):
//   brazil (frost_minas), eastAfrica (drought_ea), colombia (harvest_good).
// A shop's origin is its exposure: the day's event hits shops whose origin
// it names, visibly — the Huila house's queue dies the morning the Colombia
// news breaks. That is "the floorplan is the chart" applied to competitors.

import { EVENTS } from './config.js';

// The street. `player` marks the player's own stand (the sim's existing
// position); the rest are neighbours. `specialism` is the one distinctive
// insight (null for hybrids — see VISION.md: hybrids trade depth for
// breadth). `fit` is the cohort-affinity map the demand layer can consult;
// weights are relative (1 = neutral), not probabilities.
export const STREET = [
  {
    id: 'player', name: 'YOUR STAND', origin: null, method: 'espresso',
    hybrid: false, specialism: null, fit: {},
  },
  {
    id: 'glasshouse', name: 'GLASSHOUSE', origin: null, method: 'espresso',
    hybrid: false, specialism: null, fit: { students: 1.2, commuters: 1.1 },
    // The existing rival: a chain operation. No origin loyalty — it buys
    // spot, so events move its costs but never its identity.
    chain: true,
  },
  {
    id: 'huila_house', name: 'HUILA HOUSE', origin: 'colombia', method: 'espresso',
    hybrid: false, specialism: 'harvest_ear',
    // Roaster-café: sees the green-bean board a day early. Its insight is
    // the harvest event itself — a clean Huila harvest is *its* good news.
    fit: { creatives: 1.3, elders: 1.1 },
  },
  {
    id: 'yirg_corner', name: 'YIRG CORNER', origin: 'eastAfrica', method: 'filter',
    hybrid: false, specialism: 'rain_taster',
    // Brew bar: the washed-coffee belt is its shelf, so the short rains are
    // its crisis. Its insight: it tastes the lots early — a thinning harvest
    // shows up in its cupping notes before the wire runs it.
    fit: { creatives: 1.4, students: 0.9 },
  },
  {
    id: 'cerrado_stand', name: 'CERRADO STAND', origin: 'brazil', method: 'espresso',
    hybrid: false, specialism: 'frost_watcher',
    // Origin house on the Brazilian interior: frost on Minas Gerais is
    // *its* frost. Its insight: the plateau rumour reaches it first.
    fit: { commuters: 1.3, tourists: 1.1 },
  },
  {
    id: 'cacao_row', name: 'CACAO & ROW', origin: null, method: 'chocolate',
    hybrid: true, specialism: null,
    // The hybrid: chocolate + coffee. Broad fit, diluted insight (null) —
    // it covers the niche intersections but holds no early read.
    fit: { tourists: 1.4, students: 1.2, creatives: 1.1 },
  },
];

// The origins a player's house can be built on. `none` is the open table:
// buy the board, hold no identity, feel the Exchange only through your till.
export const ORIGINS = [
  { id: null,         label: 'no house origin', perk: 'buy the board — the Exchange reaches you only through the till' },
  { id: 'colombia',   label: 'a Huila house',   perk: 'a clean harvest eases your costs further, and your growers call before the wire does' },
  { id: 'eastAfrica', label: 'a washed-lot bar', perk: 'the short rains hit your shelf harder — but your cupping table tastes them first' },
  { id: 'brazil',     label: 'a Cerrado house', perk: 'a frost is your frost, the biggest swing on the board — but the plateau calls you first' },
];
export function originDef(id) { return ORIGINS.find(o => o.id === (id || null)) || ORIGINS[0]; }
// `null` is "not chosen yet" (the Brief still asks). `'none'` is a choice:
// the open table, deliberately. Anything else must be a real origin id.
export const OPEN_TABLE = 'none';
export function validOrigin(id) {
  if (id === OPEN_TABLE) return OPEN_TABLE;
  return ORIGINS.some(o => o.id && o.id === id) ? id : null;
}
// What the Exchange and the street math see. The open table is no origin.
export function originKey(id) { return validOrigin(id) === OPEN_TABLE || !validOrigin(id) ? null : validOrigin(id); }

export function shopById(id) {
  return STREET.find(s => s.id === id) || null;
}

// The origin an event names, as a street origin key. Unknown events name
// no origin (hype, rain, stable) — nobody's identity is on the line.
export function eventOrigin(eventId) {
  const map = { frost_minas: 'brazil', drought_ea: 'eastAfrica', harvest_good: 'colombia', rumour_frost: 'brazil' };
  return map[eventId] || null;
}

// How hard today's event lands on a shop. 1 = neutral. An event on a
// shop's own origin is its crisis (or its harvest): exposure > 1 for bad
// tiers, and for `good`-tier events on the matching origin the exposure is
// the *windfall* side (still > 1 — the event moves them, in either
// direction). Chains and originless shops sit at 1 always.
export function originExposure(shop, event) {
  if (!shop || !event || shop.chain || !shop.origin) return 1;
  if (eventOrigin(event.id) !== shop.origin) return 1;
  const tier = event.tier;
  if (tier === 'cata') return 1.8;   // frost burns their canopy
  if (tier === 'bad') return 1.5;    // the short rains thin their lots
  if (tier === 'good') return 1.4;   // a clean harvest is their windfall
  if (tier === 'warn') return 1.25;  // the rumour alone moves them
  return 1;
}

// How much more (or less) the day's event moves the *player's* bean index
// when their house is built on the origin it names. Half the street
// exposure: a frost on your plateau lands ×1.4, a clean harvest on your
// valley eases costs ×1.2. 1 (bit-identical) with no origin or no match.
export function originAmp(origin, event) {
  origin = originKey(origin);
  if (!origin || !event) return 1;
  return 1 + (originExposure({ origin }, event) - 1) * 0.5;
}

// The street comes to ask the house that knows: footfall on a day your
// origin makes the news. 1 with no origin or no match.
export const ORIGIN_PULL = 1.04;
export function originPull(origin, event) {
  return originExposure({ origin: originKey(origin) }, event) > 1 ? ORIGIN_PULL : 1;
}

// The house's one insight (VISION.md: distinctive insights + specialisms).
// A house built on an origin hears that origin first: when the draw at the
// open names it, the Brief says so before the wire does.
// The cost is the amplified swing (originAmp): a bigger bet, with a warning.
// Returns { head, line, edge } or null (no origin, or the draw is elsewhere).
// Brazil has two live events (a frost and its rumour), so the Cerrado read
// is deliberately the same for both: you know the plateau is moving, not
// whether it is talk or a front. Colombia and East Africa have one event
// each, so those reads are exact. Asymmetric but never a perfect hedge.
const CERRADO_READ = { head: 'THE PLATEAU IS UNEASY', line: 'Your Cerrado contacts are uneasy — something is moving on the plateau. Could be talk, could be a front. The wire hasn’t heard.', edge: +1 };
export const HOUSE_READS = {
  frost_minas:  CERRADO_READ,
  rumour_frost: CERRADO_READ,
  drought_ea:   { head: 'THE LOTS CAME IN THIN', line: 'Your cupping table has tasted the short-rains lots. The wire runs it at the open.', edge: +1 },
  harvest_good: { head: 'THE HARVEST IS CLEAN', line: 'Your Huila growers say the picking came in clean. The board exhales at the open.', edge: -1 },
};
export function houseRead(origin, nextEvent) {
  if (!origin || !nextEvent) return null;
  if (eventOrigin(nextEvent.id) !== origin) return null;
  return HOUSE_READS[nextEvent.id] || null;
}

// The shop's distinctive insight, as a deterministic read off the live
// Exchange state. Returns { head, line, edge } or null when the shop has
// no specialism or nothing to say today. `edge` is the actionable delta:
// the sign and rough size of what the specialist knows that the wire does
// not (yet). Hybrids never read (VISION.md: diluted specialism).
// `tomorrowDrift` is the *next* day's baseline drift increment — the
// roaster-café's early look at the green-bean board.
export function insightFor(shop, event, tomorrowDrift = 0) {
  if (!shop || !shop.specialism) return null;
  const d = Number(tomorrowDrift) || 0;
  switch (shop.specialism) {
    case 'harvest_ear':
      // Huila House reads the board a day early: rising drift is their
      // warning, falling drift their comfort — regardless of today's event.
      if (d > 0.005) return { head: 'HUILA HOUSE READS THE BOARD', line: 'Their roaster is quietly contracting. The green price is walking up.', edge: +1 };
      if (d < -0.005) return { head: 'HUILA HOUSE READS THE BOARD', line: 'Their roaster is riding spot and smiling. The green price is easing.', edge: -1 };
      return null;
    case 'rain_taster':
      // Yirg Corner tastes the lots: a thinning harvest shows in the cup
      // before the wire runs it — only meaningful when East Africa is live.
      if (event && eventOrigin(event.id) === 'eastAfrica' && event.tier === 'bad') {
        return { head: 'YIRG CORNER CUPPING NOTES', line: 'Their cupping table says the lots came in thin. They knew before the wire did.', edge: +1 };
      }
      return null;
    case 'frost_watcher':
      // Cerrado Stand feels the plateau: a frost rumour reaches the origin
      // house first, and a real frost confirms what they braced for.
      if (event && event.id === 'rumour_frost') {
        return { head: 'CERRADO STAND IS BRACING', line: 'The plateau called them overnight. They are contracting beans before the wire confirms.', edge: +1 };
      }
      if (event && event.id === 'frost_minas') {
        return { head: 'CERRADO STAND TOOK THE HIT', line: 'Their canopy caught the frost. Their board is dark; their queue will be too.', edge: +1 };
      }
      return null;
    default:
      return null;
  }
}

// Rivals act on what they know, and you can watch them do it. A specialist
// whose origin the coming draw names *behaves* differently at the open —
// buys forward, pulls a lot, stops contracting — and the Brief shows it.
// Honest but not guaranteed: a tell shows ~60% of the time it could, decided
// by a pure hash of (seed, day, shop) so replays agree and no rng stream is
// touched. Absence proves nothing; presence is real. Counter-read it.
export const TELL_CHANCE = 0.6;
const RIVAL_TELLS = {
  huila_house:   { match: ['harvest_good'], line: 'HUILA HOUSE has stopped buying forward — they’re riding spot.', edge: -1 },
  yirg_corner:   { match: ['drought_ea'],   line: 'YIRG CORNER has pulled its short-rains lot off the shelf.', edge: +1 },
  cerrado_stand: { match: ['frost_minas', 'rumour_frost'], line: 'CERRADO STAND is buying forward — hard.', edge: +1 },
};
function tellHash(seed, day, id) {
  let h = (Number(seed) | 0) ^ Math.imul((day | 0) + 1, 0x9e3779b1);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function rivalTells(nextEvent, seed, day) {
  if (!nextEvent) return [];
  const out = [];
  for (const shop of STREET) {
    const t = RIVAL_TELLS[shop.id];
    if (!t || !t.match.includes(nextEvent.id)) continue;
    if (tellHash(seed, day, shop.id) >= TELL_CHANCE) continue;
    out.push({ id: shop.id, name: shop.name, line: t.line, edge: t.edge });
  }
  return out;
}

// Street posture for the day: every shop with its exposure and read, in a
// stable order. The Brief and the floor both render from this one shape so
// the street cannot disagree with itself.
export function streetForDay(event, tomorrowDrift = 0, playerOrigin = null) {
  return STREET.map(shop => shop.id === 'player' ? { ...shop, origin: originKey(playerOrigin) } : shop).map(shop => ({
    id: shop.id,
    name: shop.name,
    origin: shop.origin,
    method: shop.method,
    hybrid: shop.hybrid,
    chain: !!shop.chain,
    exposure: originExposure(shop, event),
    insight: insightFor(shop, event, tomorrowDrift),
  }));
}
