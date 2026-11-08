// standSpec.js — what a described stand IS, not just what it looks like.
//
// The Franchise's second half (hackathon build): the player's words become
// geometry AND a working character. A spec is a small validated card —
// name, cuisine, the crowd it pulls, the hours it pulls them, a signature,
// a quirk — produced three ways, always converging on the same shape:
//   1. specFromPrompt()   — deterministic keyword classifier. Always
//      available: polyfork stands, offline play, no API key, mid-generation.
//   2. The Convex standSpec.expand action — an LLM reads the same words and
//      returns the same card richer (a real name, a real quirk). Stored on
//      the franchise row, so every later player inherits the same stand.
//   3. normalizeSpec()    — the strict validator both paths pass through.
//
// The sim consumes specs through specPull(): a placed stand adds bounded
// spawn weight to ITS cohort inside ITS daypart — "a midnight ramen bar"
// literally pulls students after 18:00. Pure + deterministic: no DOM, no
// rng, no clock. A stand without a spec (legacy rows, junk prompts) pulls
// nothing, so every pre-spec save and replay stays bit-identical.

export const COHORT_IDS = ['commuters', 'creatives', 'students', 'elders', 'tourists'];
export const PRICE_TIERS = ['cheap', 'mid', 'premium'];

// Archetypes are the logic vocabulary: each maps a kind of stand to the
// crowd and hours it draws. `pull` is the additive spawn-weight bonus
// (0.12–0.28) applied while the stand stands; SPEC_PULL_CAP bounds the
// combined lift so three loud neighbours can't flood the floor.
export const ARCHETYPES = {
  nightEats:    { cuisine: 'late-night eats',   cohort: 'students',  daypart: [1080, 1260], pull: 0.24, priceTier: 'cheap',   signature: 'something hot, after hours' },
  studyHall:    { cuisine: 'study fuel',        cohort: 'students',  daypart: [720, 1080],  pull: 0.20, priceTier: 'cheap',   signature: 'bottomless filter' },
  thirdPlace:   { cuisine: 'a third place',     cohort: 'creatives', daypart: [600, 1020],  pull: 0.22, priceTier: 'mid',     signature: 'the corner table' },
  singleOrigin: { cuisine: 'single-origin bar', cohort: 'creatives', daypart: [600, 1080],  pull: 0.24, priceTier: 'premium', signature: 'one lot, done properly' },
  grabAndGo:    { cuisine: 'grab and go',       cohort: 'commuters', daypart: [360, 660],   pull: 0.22, priceTier: 'cheap',   signature: 'in and out in ninety seconds' },
  pastry:       { cuisine: 'a pastry counter',  cohort: 'tourists',  daypart: [480, 900],   pull: 0.20, priceTier: 'mid',     signature: 'still warm at ten' },
  community:    { cuisine: 'a local hub',       cohort: 'elders',    daypart: [480, 1080],  pull: 0.20, priceTier: 'mid',     signature: 'they know your order' },
  market:       { cuisine: 'a market stall',    cohort: 'tourists',  daypart: [540, 1140],  pull: 0.22, priceTier: 'cheap',   signature: 'whatever the season brings' },
};
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);
// Street-worthy names for the seeded path — the LLM writes its own.
export const ARCH_NAMES = {
  nightEats: 'The Night Counter', studyHall: 'The Study Hall',
  thirdPlace: 'The Third Place', singleOrigin: 'The Origin Bar',
  grabAndGo: 'The Quick Counter', pastry: 'The Pastry Counter',
  community: 'The Front Room', market: 'The Market Pitch',
};
export const SPEC_PULL_CAP = 0.6;   // combined lift across all standing specs
export const SPEC_PULL_MAX = 0.3;   // one spec can never pull harder than this

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const str = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// Keyword → archetype. Ordered: the first match wins, so specific beats
// generic ("student ramen bar" is nightEats, not studyHall). Exported for
// tests; specFromPrompt is the only caller in play.
const KEYWORDS = [
  [/ramen|noodle|late|midnight|izakaya|taco|bbq|burger|pizza|kebab|street food|late-night/, 'nightEats'],
  [/study|library|book|essay|exam|homework|co-?work|workspace|quiet/, 'studyHall'],
  [/vinyl|record|listening|jazz|wine|cocktail|gallery|concept|roaster|single.?origin|specialty|pour.?over/, 'singleOrigin'],
  [/third place|community|neighbou?rhood|local|church|club|society|regulars/, 'community'],
  [/commuter|station|platform|to-?go|sandwich|meal deal|breakfast|lunch|express/, 'grabAndGo'],
  [/cake|bake|pastry|croissant|bread|patisserie|dessert|ice cream|gelato/, 'pastry'],
  [/market|stall|farm|flower|produce|festival|fair|bazaar/, 'market'],
  [/coffee|cafe|café|espresso|matcha|tea|bar|kiosk|stand|cart|shop|store|barber|tattoo|plant|thrift|vintage/, 'thirdPlace'],
];
export function archetypeFor(prompt) {
  const w = String(prompt || '').toLowerCase();
  for (const [re, id] of KEYWORDS) if (re.test(w)) return id;
  return 'thirdPlace';
}

function title(s) {
  const w = str(s, 40).toLowerCase().replace(/^(a|an|the)\s+/, '');
  return w ? w[0].toUpperCase() + w.slice(1) : '';
}

// The deterministic card: same words → same spec, every machine, forever.
// Used when no LLM spec exists (polyfork path, offline, no key) and as the
// floor normalizeSpec() never drops below.
export function specFromPrompt(prompt) {
  const words = str(prompt, 160);
  if (!words) return null;
  const archId = archetypeFor(words);
  const arch = ARCHETYPES[archId];
  const cuisine = arch.cuisine;
  const name = ARCH_NAMES[archId] || `The ${title(cuisine)}`;
  return {
    name: name.slice(0, 48),
    cuisine,
    archetype: archId,
    cohort: arch.cohort,
    daypart: arch.daypart ? arch.daypart.slice() : null,
    pull: Math.min(SPEC_PULL_MAX, arch.pull),
    priceTier: arch.priceTier,
    signature: arch.signature,
    quirk: `built from the words "${words.length > 60 ? words.slice(0, 60) + '…' : words}"`,
    source: 'seeded',
  };
}

// Strict validator — the LLM path and any cached row pass through here.
// Returns a normalized spec or null; a partial answer degrades field by
// field, never to garbage. archetype may be absent (custom stands still
// get cohort/daypart/pull if the model supplied them).
export function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cohort = COHORT_IDS.includes(raw.cohort) ? raw.cohort : null;
  let daypart = null;
  if (Array.isArray(raw.daypart) && raw.daypart.length === 2 &&
      raw.daypart.every(Number.isFinite)) {
    const a = clamp(Math.round(raw.daypart[0]), 0, 1440);
    const b = clamp(Math.round(raw.daypart[1]), 0, 1440);
    if (b > a) daypart = [a, b];
  }
  const pull = Number.isFinite(raw.pull) ? clamp(raw.pull, 0, SPEC_PULL_MAX) : 0;
  const archId = ARCHETYPE_IDS.includes(raw.archetype) ? raw.archetype : null;
  const arch = archId ? ARCHETYPES[archId] : null;
  // Fill gaps from the archetype, then from nothing — a spec with no crowd
  // and no hours still names itself but pulls nothing.
  const effCohort = cohort || arch?.cohort || null;
  const effDaypart = daypart || (arch?.daypart ? arch.daypart.slice() : null);
  const effPull = pull > 0 ? pull : (arch ? Math.min(SPEC_PULL_MAX, arch.pull) : 0);
  const name = str(raw.name, 48) || (arch ? `The ${title(arch.cuisine)}` : 'The Stand');
  return {
    name,
    cuisine: str(raw.cuisine, 32) || arch?.cuisine || 'a street stand',
    archetype: archId,
    cohort: effCohort,
    daypart: effDaypart,
    pull: effPull,
    priceTier: PRICE_TIERS.includes(raw.priceTier) ? raw.priceTier : (arch?.priceTier ?? null),
    signature: str(raw.signature, 48) || arch?.signature || '',
    quirk: str(raw.quirk, 90) || '',
    source: str(raw.source, 12) || 'llm',
  };
}

// The spec a lot state resolves to: the server/LLM card when present,
// else the seeded classifier over the remembered prompt, else null.
export function specForLot(ls) {
  if (!ls) return null;
  const cached = normalizeSpec(ls.spec);
  if (cached) return cached;
  return ls.prompt ? specFromPrompt(ls.prompt) : null;
}

// Additive spawn weight one spec contributes for (cohort, wave minute).
// Zero unless the cohort matches AND the wave time sits inside the
// daypart (a null daypart means all day). Pure — no clock, no rng.
export function specPull(spec, cohort, waveT) {
  if (!spec || !spec.cohort || spec.cohort !== cohort) return 0;
  const p = spec.pull > 0 ? spec.pull : 0;
  if (p <= 0) return 0;
  if (spec.daypart) {
    const t = Number(waveT);
    if (!Number.isFinite(t) || t < spec.daypart[0] || t >= spec.daypart[1]) return 0;
  }
  return p;
}

// Combined lift over a set of specs, capped. `specs` is an array of spec
// objects (or lot states — pass specForLot'd values). Exported so the sim
// and tests share one arithmetic.
export function specPullSum(specs, cohort, waveT, cap = SPEC_PULL_CAP) {
  let add = 0;
  for (const s of specs || []) add += specPull(s, cohort, waveT);
  return 1 + Math.min(cap, add);
}

const MIN_LABEL = (m) => {
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${mm}`;
};
const COHORT_LABEL = {
  commuters: 'the morning crowd', creatives: 'the creatives',
  students: 'students', elders: 'the regulars', tourists: 'visitors',
};
// One honest line for the morning brief: who it pulls and when.
export function specLine(spec) {
  if (!spec) return '';
  const who = spec.cohort ? (COHORT_LABEL[spec.cohort] || spec.cohort) : 'the street';
  const when = spec.daypart ? ` between ${MIN_LABEL(spec.daypart[0])} and ${MIN_LABEL(spec.daypart[1])}` : '';
  const quirk = spec.quirk && spec.source !== 'seeded' ? ` — ${spec.quirk}` : '';
  return `${spec.name} pulls ${who}${when}${quirk}`;
}
