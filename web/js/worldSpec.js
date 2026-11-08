// worldSpec.js — the described street (hackathon build, move 3).
//
// Same contract as marketSnapshot/weatherSnapshot: a SNAPSHOT resolved
// synchronously, never a live feed. `?world=<words>` names the district you
// want; the spec is produced twice — a deterministic keyword classifier
// answers instantly (offline, no key, first paint), and a background Convex
// call asks an LLM for the richer card, cached for the NEXT campaign. The
// spec rides the week save like the anchors, so a resumed week keeps the
// street it was dealt.
//
// What a spec may touch — all bounded, all opt-in (no ?world= → null →
// every path bit-identical):
//   climate    — the week's sky envelope (live weather forecast still wins)
//   bias       — event-deck weight muls merged into the dawn roll
//   demandMul  — a ±15% lean on the whole week's footfall
//   rivalName  — what the chain across the road is called
//   origin     — a suggested house origin, shown as a hint (never forced)
//   name/line  — what the Brief calls your street
import { CLIMATE_IDS } from './climates.js';

export const WORLD_SPEC_KEY = 'grunds.worldspec';
export const WORLD_SPEC_TTL_MS = 30 * 24 * 3600 * 1000;
export const WORLD_PROMPT_MAX = 200;
export const DEMAND_MUL_BAND = { lo: 0.85, hi: 1.15 };
export const BIAS_BAND = { lo: 0.3, hi: 2.5 };

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const str = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function worldSpecHash(prompt) {
  const s = str(prompt, WORLD_PROMPT_MAX).toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// Strict validator for the LLM card (and defensive re-validation of cache).
// Unknown fields drop; numbers clamp into their bands; enums whitelist.
// `eventIds` is the deck's key set — callers pass EVENTS keys so a spec can
// never invent an event.
export function validateWorldSpec(raw, eventIds = []) {
  if (!raw || typeof raw !== 'object') return null;
  const known = new Set(eventIds);
  const bias = {};
  if (raw.bias && typeof raw.bias === 'object') {
    for (const [id, mul] of Object.entries(raw.bias)) {
      if (known.has(id) && Number.isFinite(mul)) {
        bias[id] = clamp(mul, BIAS_BAND.lo, BIAS_BAND.hi);
      }
    }
  }
  const climate = CLIMATE_IDS.includes(raw.climate) ? raw.climate : null;
  const demandMul = Number.isFinite(raw.demandMul)
    ? clamp(raw.demandMul, DEMAND_MUL_BAND.lo, DEMAND_MUL_BAND.hi) : 1;
  const rivalName = str(raw.rivalName, 24);
  const origin = ['colombia', 'eastAfrica', 'brazil', 'none'].includes(raw.origin) ? raw.origin : null;
  const spec = {
    name: str(raw.name, 48),
    line: str(raw.line, 140),
    climate,
    bias,
    demandMul,
    rivalName: rivalName || null,
    origin,
  };
  // A spec that says nothing isn't a spec.
  if (!spec.name && !spec.line && !spec.climate && !Object.keys(spec.bias).length &&
      spec.demandMul === 1 && !spec.rivalName && !spec.origin) return null;
  return spec;
}

// The deterministic street: same words → same world, every machine. Keyword
// buckets only — the LLM card refines naming and prose, never the skeleton.
export function classifyWorld(prompt) {
  const w = String(prompt || '').toLowerCase();
  if (!w.trim()) return null;
  const bias = {};
  let climate = null, demandMul = 1, rivalName = null, origin = null;
  const nameIt = (noun) => `the ${noun} row`;
  if (/rain|storm|monsoon|soak|drizzle|grey|gray|wash/.test(w)) {
    climate = 'rain'; bias.rain_soak = 1.9; bias.drought_ea = 0.5;
  } else if (/heat|hot|summer|desert|sun|scorch/.test(w)) {
    climate = 'heat'; bias.hype_matcha = 1.5; bias.stable = 1.2;
  } else if (/frost|winter|cold|snow|crisp|nordic/.test(w)) {
    climate = 'crisp'; bias.frost_minas = 1.7; bias.rumour_frost = 1.6; bias.drought_ea = 0.6;
  } else if (/harvest|bumper|plenty|market day/.test(w)) {
    bias.harvest_good = 1.8; bias.stable = 1.3;
  }
  if (/student|cheap|budget|queue|busy|rush|crowd|festival|market/.test(w)) demandMul = 1.1;
  else if (/quiet|empty|ghost|slow|sleepy|deserted/.test(w)) demandMul = 0.88;
  else if (/luxury|fine|rare|single.?origin|specialty/.test(w)) { demandMul = 0.95; bias.hype_matcha = 1.4; }
  if (/tokyo|neon|night|noir|cyber|japan/.test(w)) { demandMul = 1.08; bias.hype_matcha = 1.5; }
  if (/colombia|huila|coffee farm|origin/.test(w)) origin = 'colombia';
  else if (/ethiopia|kenya|africa|washed/.test(w)) origin = 'eastAfrica';
  else if (/brazil|cerrado|minas|frost belt/.test(w)) origin = 'brazil';
  else if (/no origin|open table|spot market/.test(w)) origin = 'none';
  // A rival name only when the words plainly offer one: "rival called X",
  // "against X", "X across the road".
  const nm = w.match(/(?:rival|chain|across the road|competition)[^a-z0-9]{0,20}(?:called|named)?\s+([a-z][a-z0-9 '&-]{1,22})/) ||
             w.match(/\bagainst\s+([a-z][a-z0-9 '&-]{1,22})/);
  if (nm) rivalName = str(nm[1].replace(/\b(the|a|an|called|named)\b/g, ' '), 24).toUpperCase() || null;
  const first = str(prompt, 60).split(' ').slice(0, 4).join(' ');
  return {
    name: str(first, 48) ? `${str(first, 44)}…` : '',
    line: '',
    climate, bias, demandMul, rivalName, origin,
    _seeded: true,
  };
}

// ---- cache (storage-agnostic) ----------------------------------------------
export function cacheWorldSpec(storage, prompt, spec) {
  try {
    storage.setItem(WORLD_SPEC_KEY, JSON.stringify({
      hash: worldSpecHash(prompt), prompt: str(prompt, WORLD_PROMPT_MAX),
      spec, ts: Date.now(), source: 'live',
    }));
  } catch {}
}
export function loadCachedWorldSpec(storage, prompt, eventIds = []) {
  try {
    const j = JSON.parse(storage.getItem(WORLD_SPEC_KEY) || 'null');
    if (!j || j.hash !== worldSpecHash(prompt)) return null;
    if (!Number.isFinite(j.ts) || Date.now() - j.ts > WORLD_SPEC_TTL_MS) return null;
    return validateWorldSpec(j.spec, eventIds);
  } catch { return null; }
}

// The one rule: cached LLM card or the seeded classifier — never a wait.
export function resolveWorldSpec(storage, prompt, eventIds = []) {
  const p = str(prompt, WORLD_PROMPT_MAX);
  if (!p) return null;
  const live = loadCachedWorldSpec(storage, p, eventIds);
  if (live) return { prompt: p, spec: live, source: 'live' };
  const seededSpec = classifyWorld(p);
  const spec = validateWorldSpec({ ...seededSpec, _seeded: undefined }, eventIds) || seededSpec;
  return spec ? { prompt: p, spec, source: 'seeded' } : null;
}

// Background refresh → the LLM card for the NEXT campaign. Never throws.
export async function refreshWorldSpec(storage, base, prompt, eventIds = []) {
  const p = str(prompt, WORLD_PROMPT_MAX);
  if (!p || !base) return null;
  try {
    const r = await fetch(`${base}/ai/worldspec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: p }),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || d.fallback || !d.spec) return null;
    const spec = validateWorldSpec(d.spec, eventIds);
    if (!spec) return null;
    cacheWorldSpec(storage, p, spec);
    return spec;
  } catch { return null; }
}
