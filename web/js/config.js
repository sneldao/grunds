// Grunds — The District: shared config. One art direction, one source of truth.

export const PAL = {
  ink: 0x171310, paper: 0xefe6d3, cream: 0xf6efe0,
  walnut: 0x4a3423, walnutDark: 0x33241a, brass: 0xc9a227,
  plaster: 0xd8cbb2, wainscot: 0x3d5243, awning: 0x2f4f43,
  matcha: 0x86a860, neg: 0xd0603b, teal: 0x7fb3b0,
  asphalt: 0x2a2c30, pavement: 0x6f6a60, curb: 0x54504a,
  glass: 0xbfd8d2, steel: 0x8a8d90,
};

// Cohorts: culture as mechanics. Color must read instantly on the floor.
export const COHORTS = {
  commuters: { color: 0x5aa3d8, name: 'commuters' },
  creatives: { color: 0xa47fd8, name: 'creatives' },
  students:  { color: 0x86a860, name: 'students' },   // matcha green — the wave
  elders:    { color: 0xd8c27a, name: 'elders' },
  tourists:  { color: 0xd87f9a, name: 'tourists' },
  rival:     { color: 0x9aa5a8, name: 'rival' },       // the chain's grey
};
export const COHORT_KEYS = Object.keys(COHORTS);

// The diorama. Café floor x∈[-12,12], z∈[-8,6]; street z∈[6,14]; rival across.
export const LAYOUT = {
  floor: { x: 0, z: -1, w: 24, d: 14 },
  counter: { x: -6, z: -5.4, w: 9, d: 1.3 },       // drinks bar along the back
  register: { x: -0.6, z: -5.4 },                   // till at the right end of the bar
  retail: { x: -11.2, z: 1, w: 1.4, d: 6 },         // shelf along the left wall
  tables: [ { x: 4.2, z: -0.4 }, { x: 8, z: 1.2 }, { x: 5.6, z: 4 } ],
  door: { x: -5, z: 6 },                            // front opening
  pavementZ: 7.8, roadZ0: 9.6, roadZ1: 13.8,
  rival: { x: 1.5, z: 16.6 },                       // GLASSHOUSE across the road
  crossX: -2.2,                                     // pedestrian crossing
  spawnL: { x: -16, z: 7.8 }, spawnR: { x: 16, z: 7.8 },
};

// Queue slot lines. The counter queue snakes out the door when it gets long —
// the line IS the chart.
export function counterSlot(i) {
  if (i < 12) return { x: -6, z: -3.7 + i * 0.85 };            // inside, facing the bar
  return { x: -5.8 - (i - 12) * 0.85, z: 7.1 };                 // out the door, along the pavement
}
export function registerSlot(i) { return { x: -0.6, z: -3.7 + i * 0.8 }; }
export function rivalSlot(i) { return { x: 1.5 + 0.9 + i * 0.85, z: 15.4 }; }
export const MAX_VISIBLE_QUEUE = counterSlotMax();
function counterSlotMax() { return 30; }

// Economy — identical to the original slice. Do not tune here without a reason.
export const ECON = {
  matchaFull: 4.80, matchaDeal: 4.20, other: 3.60,
  batchCost: 4.20, batchUnits: 40,
  matchaWaitMin: 4, servePerTick: 12, registerPerTick: 4,
  barPoints: 8, prepOther: 1, prepMatcha: 4, prepBatched: 1,   // the bar spends prep-points; matcha is expensive unless batched
  balkAfter: 3, balkChance: 0.12, matchaShare: 0.35,
  sitChance: 0.35, maxPatrons: 260,
  spawnScale: 0.3,   // the 13-week dataset compressed to one day: scale demand to ~2x service at peak
};

// Story beats keyed to the real wave shapes in out/wave_schedule.json.
export const CHAPTERS = [
  { t: 360,  k: 'FIRST LIGHT',      sub: 'the regulars take their corners' },
  { t: 420,  k: 'THE COMMUTE',      sub: 'same order, no time — don’t be the bottleneck', beat: 'counter' },
  { t: 600,  k: 'THE LAPTOP HOURS', sub: 'one pour-over, three hours — reputation walks in', beat: 'tables' },
  { t: 720,  k: 'HIGH NOON',        sub: 'the “best of” lists arrive', notebook: true, beat: 'counter' },
  { t: 840,  k: 'THE MATCHA WAVE',  sub: 'students · 14:00 · you either batched or you didn’t', beat: 'counter', wave: true },
  { t: 1050, k: 'THE GOLDEN HOUR',  sub: 'tourists spend, regulars judge', beat: 'tables' },
  { t: 1215, k: 'LAST ORDERS',      sub: 'count the till — the chain across the road already has', beat: 'wide' },
];

export const COPY = {
  title: 'GRUNDS', subtitle: 'THE DISTRICT',
  tagline: 'You can’t control demand. You can only be ready for it —\nfaster than the café across the street.',
  open: 'OPEN THE DISTRICT',
  controls: 'drag to look · scroll to zoom · 1 pre-batch · 2 reprice · M sound · R reset',
  notebookTitle: 'ROASTER’S NOTEBOOK',
  notebook: 'Matcha: 139 → 683 a week in thirteen weeks.\nThe student wave lands at 14:00.\nMade to order, a matcha takes 4 minutes.\nPre-batch and the wave hits a warm till.',
  gossipBad: ['matcha here is a WAIT…', 'queue’s out the door again', 'four minutes. for a latte.', 'the chain across the road is faster', 'they switched roasters, you know'],
  gossipGood: ['worth the queue today', 'pre-batched. genius.', 'best matcha on the street', 'they know my order here'],
  rivalName: 'GLASSHOUSE',
};

// THE DISTRICT — the connected campaign. The Gamble clock, the Regulars, the
// Roaster's Letter. Numbers anchored to benchmark_corpus.json (COGS ~30% of
// revenue for a UK independent) and locality_packs.json (matcha £3.50–£6.50 in
// London). No LLM — every prose line is templated from state.
// ─────────────────────────────────────────────────────────────────────────────

// The bean market — a single index. 1.00 = baseline. Events nudge it day to day.
// Cost per cup = index × BEAN_BASE_COST. A matcha at £4.80 with index 1.0 costs
// ~£1.30 → ~27% COGS, right in the UK independent band (25–35%).
export const CAMPAIGN = {
  days: 5,
  beanBaseCost: 1.30,       // £ per drink at index 1.0 (≈27% of £4.80)
  contractFee: 22.0,       // lock the price: £22 supplier credit (the debt clock)
  contractUnits: 40,       // a contract covers ~40 units of made drinks
  wastePct: 0.06,          // 6% of sales lost to waste (Business Waste / Notions)
  debtInterest: 4.0,      // the Drug Wars debt clock: £ per day on outstanding supplier credit
  startReputation: 62,     // 0..100 — the regulars' aggregate opinion
};

// The event deck — Drug Wars blood. Pity timer: never two catastrophes in a row,
// and a catastrophe is always followed by a recovery-ish draw (docs: "fairest
// losses win"). `tier` drives the dawn's weather/atmosphere and the letter's tone.
export const EVENTS = {
  frost_minas:   { tier: 'cata',   dIndex: +0.30, dur: 2, weight: 8,
    head: 'FROST ON MINAS GERAIS', line: 'A cold front burned the arabica canopy in southern Brazil overnight. The market is scrambling.' },
  drought_ea:    { tier: 'bad',    dIndex: +0.15, dur: 2, weight: 14,
    head: 'EAST AFRICA SHORT RAINS', line: 'The short rains failed across the washed-coffee belt. Lots are thinning out.' },
  harvest_good:  { tier: 'good',   dIndex: -0.08, dur: 1, weight: 20,
    head: 'CLEAN COLOMBIAN HARVEST', line: 'A clean harvest landed in Huila. The market exhales; costs ease.' },
  stable:        { tier: 'calm',   dIndex: +0.02, dur: 1, weight: 30,
    head: 'A QUIET MARKET', line: 'Nothing moving on the board. A day to breathe.' },
  hype_matcha:   { tier: 'good',   dIndex: 0,     dur: 1, weight: 12, demand: 1.18,
    head: 'THE LISTS NOTICED MATCHA', line: 'A matcha bar went viral. Your nature is now everyone’s nature.' },
  rumour_frost:  { tier: 'warn',   dIndex: +0.05, dur: 1, weight: 16,
    head: 'A RUMOUR OFF THE PLATEAU', line: 'There’s talk of a cold front building. Nobody’s contracted yet. You could.' },
};

// The Regulars — persistent named patrons whose opinion survives the reset.
// Reputation = aggregate opinion (0..100) → meters tomorrow's footfall + tips.
// See ARCHITECTURE.md "precedent (memory)" and "friendship graph".
export const REGULAR_ROSTER = [
  { name: 'Mara',   coh: 'commuters', quirk: 'same flat white, no time' },
  { name: 'Tomas',  coh: 'creatives', quirk: 'one pour-over, three hours' },
  { name: 'Pip',    coh: 'students',  quirk: 'the 14:00 matcha' },
  { name: 'Olu',    coh: 'elders',    quirk: 'remembers every mistake' },
  { name: 'Gwen',   coh: 'tourists', quirk: 'follows the lists, tips well' },
  { name: 'Yuki',   coh: 'creatives', quirk: 'only drinks single-origin' },
  { name: 'Dev',    coh: 'commuters', quirk: 'counts the queue out loud' },
  { name: 'Esther', coh: 'elders',    quirk: 'has today’s loyalty stamp' },
];

export const LETTER = {
  from: 'the roaster',
  sign: '— Idris, your roaster',
  // templated in letter.js; these are the reply buttons (reply-to-command)
  actions: [
    { id: 'contract', label: 'CONTRACT 40kg at today’s price', hint: 'lock cost · +£22 credit' },
    { id: 'hold',     label: 'hold at the spot price',         hint: 'ride the market' },
    { id: 'settle',   label: 'settle the debt',                hint: 'pay it down from the till' },
  ],
};

export const VERDICTS = {
  star:      'The street is yours. The regulars are telling their friends.',
  good:      'A good week on the floor. The regulars noticed.',
  held:      'Held the line when it mattered. The debt is paid.',
  scarped:   'You fed the chain across the road one too many times.',
  lost:      'The wave ate you, and the market ate the margin.',
};
