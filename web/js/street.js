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
//
// Attention street (pillar 4): the four neighbour ids ARE the buildings on
// the block — streetLife's NEIGHBOR_DOORS (quill/hearth/bell/marrow) map 1:1
// onto this roster, so a door, an agent route and a shop row are one thing.
// The buildings led; the coffee identities moved in:
//   THE QUILL      brew bar + reading room — the washed-lot shelf
//   HEARTH & RYE   the hearth is their roaster — a Brazilian origin house
//   BELL & BRASS   the established house — roasts and reads the board early
//   MARROW LANE    the hybrid — chocolate + coffee out of crates
export const STREET = [
  {
    id: 'player', name: 'YOUR STAND', origin: null, method: 'espresso',
    hybrid: false, specialism: null, fit: {},
  },
  {
    id: 'glasshouse', name: 'GLASSHOUSE', origin: null, method: 'espresso',
    hybrid: false, specialism: null, fit: { students: 1.2, commuters: 1.1 },
    // The existing rival: a chain operation across the road. No origin
    // loyalty — it buys spot, so events move its costs but never its identity.
    chain: true,
  },
  {
    id: 'bell', name: 'BELL & BRASS', origin: 'colombia', method: 'espresso',
    hybrid: false, specialism: 'harvest_ear',
    // Roaster-café behind the brass bell: sees the green-bean board a day
    // early. Its insight is the harvest event itself — a clean Huila harvest
    // is *its* good news.
    fit: { creatives: 1.3, elders: 1.1 },
  },
  {
    id: 'quill', name: 'THE QUILL', origin: 'eastAfrica', method: 'filter',
    hybrid: false, specialism: 'rain_taster',
    // Brew bar between the bookshelves: the washed-coffee belt is its shelf,
    // so the short rains are its crisis. Its insight: it tastes the lots
    // early — a thinning harvest shows up in its cupping notes before the
    // wire runs it.
    fit: { creatives: 1.4, students: 0.9 },
  },
  {
    id: 'hearth', name: 'HEARTH & RYE', origin: 'brazil', method: 'espresso',
    hybrid: false, specialism: 'frost_watcher',
    // Origin house with the roaster in the old bread hearth: frost on Minas
    // Gerais is *its* frost. Its insight: the plateau rumour reaches it first.
    fit: { commuters: 1.3, tourists: 1.1 },
  },
  {
    id: 'marrow', name: 'MARROW LANE', origin: null, method: 'chocolate',
    hybrid: true, specialism: null,
    // The hybrid: chocolate + coffee out of the crates on the pavement.
    // Broad fit, diluted insight (null) — it covers the niche intersections
    // but holds no early read.
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
      // Bell & Brass reads the board a day early: rising drift is their
      // warning, falling drift their comfort — regardless of today's event.
      if (d > 0.005) return { head: 'BELL & BRASS READS THE BOARD', line: 'Their roaster is quietly contracting. The green price is walking up.', edge: +1 };
      if (d < -0.005) return { head: 'BELL & BRASS READS THE BOARD', line: 'Their roaster is riding spot and smiling. The green price is easing.', edge: -1 };
      return null;
    case 'rain_taster':
      // The Quill tastes the lots: a thinning harvest shows in the cup
      // before the wire runs it — only meaningful when East Africa is live.
      if (event && eventOrigin(event.id) === 'eastAfrica' && event.tier === 'bad') {
        return { head: 'THE QUILL CUPPING NOTES', line: 'Their cupping table says the lots came in thin. They knew before the wire did.', edge: +1 };
      }
      return null;
    case 'frost_watcher':
      // Hearth & Rye feels the plateau: a frost rumour reaches the origin
      // house first, and a real frost confirms what they braced for.
      if (event && event.id === 'rumour_frost') {
        return { head: 'HEARTH & RYE IS BRACING', line: 'The plateau called them overnight. They are contracting beans before the wire confirms.', edge: +1 };
      }
      if (event && event.id === 'frost_minas') {
        return { head: 'HEARTH & RYE TOOK THE HIT', line: 'Their canopy caught the frost. Their board is dark; their queue will be too.', edge: +1 };
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
  bell:   { match: ['harvest_good'], line: 'BELL & BRASS has stopped buying forward — they’re riding spot.', edge: -1 },
  quill:  { match: ['drought_ea'],   line: 'THE QUILL has pulled its short-rains lot off the shelf.', edge: +1 },
  hearth: { match: ['frost_minas', 'rumour_frost'], line: 'HEARTH & RYE is buying forward — hard.', edge: +1 },
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

// The board outside each shop says what the market did to THAT shop today.
// Pure function of the streetForDay row (+ the live event) — the same shape
// the Brief renders, so the pavement cannot disagree with the paper.
// tone: 'dark' (the event hit them), 'bright' (windfall), 'bracing'
// (acting on an early read), 'flat' (an ordinary day, standing copy).
const BOARD_STANDING = {
  quill:  'slow pours · quiet pages',
  hearth: 'roasted at first light',
  bell:   'the morning bell rings early',
  marrow: 'cocoa · coffee · both',
};
const BOARD_EVENT_LINES = {
  frost_minas:  { title: 'THE PLATEAU FROZE', sub: 'our canopy took it — short pours today' },
  rumour_frost: { title: 'PLATEAU RUMOURS', sub: 'contracting beans until the wire confirms' },
  drought_ea:   { title: 'THE LOTS CAME IN THIN', sub: 'the short-rains shelf is light today' },
  harvest_good: { title: 'THE HARVEST IS CLEAN', sub: 'fresh Huila on the bar today' },
};
export function boardLine(row, event) {
  if (!row || row.id === 'player') return null;
  const standing = BOARD_STANDING[row.id] || 'open today';
  // The event names their origin: the shop wears it on the board.
  if (row.exposure > 1 && event && BOARD_EVENT_LINES[event.id]) {
    const ev = BOARD_EVENT_LINES[event.id];
    const tone = event.tier === 'good' ? 'bright' : event.tier === 'warn' ? 'bracing' : 'dark';
    return { title: ev.title, sub: ev.sub, tone };
  }
  // No event on their origin, but the specialist is acting on an early read.
  if (row.insight) {
    const edge = row.insight.edge;
    return {
      title: edge > 0 ? 'BUYING AHEAD OF THE WIRE' : 'RIDING THE EASING BOARD',
      sub: edge > 0 ? 'the roaster is contracting today' : 'spot is kind today — come taste it',
      tone: edge > 0 ? 'bracing' : 'bright',
    };
  }
  // Chains post price, not posture — Glasshouse keeps its own board.
  if (row.chain) return null;
  return { title: row.name, sub: standing, tone: 'flat' };
}

// The boards are real shops — their aprons carry the day's queue. Counts are
// a pure function of the board tones (the same streetForDay shape the Brief
// renders), plus a hash of (seed, day, shop) for placement within the band:
// a shop the market hit stands nearly empty; a shop on a windfall has a line.
// No rng stream — replays agree without saving anything.
const QUEUE_BY_TONE = { dark: [0, 1], bracing: [1, 2], bright: [3, 4], flat: [1, 2] };
export function neighborQueues(boards, seed, day) {
  const out = {};
  for (const b of boards || []) {
    if (!b || !b.id || b.id === 'player' || b.id === 'glasshouse') continue;
    const band = QUEUE_BY_TONE[b.tone] || QUEUE_BY_TONE.flat;
    const h = tellHash(seed, day, b.id + ':queue');
    out[b.id] = band[0] + Math.floor(h * (band[1] - band[0] + 1));
  }
  return out;
}

// Street theatre is attention made visible (VISION.md pillar 2 → pillar 3).
// When the street gathers around something, that attention is a tide the
// frontage can catch: passers-by linger, heads turn, and a hesitator at the
// door is easier to win. The timetable is a pure function of (seed, day) —
// the same idiom as beats.js / neighborQueues — so replays agree and nothing
// is saved. Times are sim-minutes; while a window is live its boost is added
// to the awareness the frontage conversion rolls against. It never reads the
// wall-clock vignette agents (they expire in update(dt)), so the economy stays
// frame-clock invariant.
export const THEATRE_KINDS = {
  busker:   { boost: 0.18, line: 'A busker has drawn a crowd on the pavement.' },
  argue:    { boost: 0.14, line: 'Two voices rise over a coffee — the street slows to watch.' },
  catwatch: { boost: 0.12, line: 'The street cat has gathered an audience.' },
  chat:     { boost: 0.10, line: 'Neighbours stop to talk in the open street.' },
  skater:   { boost: 0.08, line: 'A skater threads the kerb — heads turn to follow.' },
};
const THEATRE_ORDER = ['busker', 'argue', 'catwatch', 'chat', 'skater'];
const THEATRE_BAND_START = 400, THEATRE_BAND_END = 1120;

// Three windows a day, dealt into equal slots across the trading band so they
// never overlap. Kind, offset, and length all hash off (seed, day, slot).
export function planTheatre(seed, day) {
  const n = 3;
  const slotW = (THEATRE_BAND_END - THEATRE_BAND_START) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = THEATRE_ORDER[Math.floor(tellHash(seed, day, `theatre:kind:${i}`) * THEATRE_ORDER.length)];
    const dur = 16 + Math.floor(tellHash(seed, day, `theatre:dur:${i}`) * 11);   // 16..26 min
    const slotS = THEATRE_BAND_START + i * slotW;
    const slack = Math.max(0, slotW - dur);
    const start = slotS + Math.floor(tellHash(seed, day, `theatre:start:${i}`) * slack);
    const def = THEATRE_KINDS[kind];
    out.push({ kind, start, end: start + dur, boost: def.boost, line: def.line });
  }
  return out;
}

// The live window at a sim-minute, or null. Windows are disjoint, so the
// first match is the only match.
export function theatreAt(windows, minute) {
  if (!Array.isArray(windows) || !Number.isFinite(minute)) return null;
  for (const w of windows) if (minute >= w.start && minute < w.end) return w;
  return null;
}
