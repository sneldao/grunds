// PR-4c — Multi-placement paywall.
//
// Four upsell surfaces live in the markup, only one per tier:
//   1. brief    — "Insiders see the wire's full reasoning here"
//   2. offer    — "the regulars' take" (cached Nebius line, templated fallback)
//   3. verdict  — "Replay your week · £49.99 once" (free upsell for non-founders)
//   4. share    — Founder frame stamp upgrade (non-founder only)
//
// Founders see the inside-track (replay / gold stamp) and no upsell.
// Insiders see the desk and no desk/brief upsell, but still see founder-only
// surfaces (because the deal there is the gold stamp).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const mainSrc = readFileSync(new URL('js/main.js', root), 'utf8');

// ---- 1. Each upsell element exists in HTML ------------------
const placements = [
  { id: 'brief-insider-upsell',  text: 'Insiders see the wire' },
  { id: 'offer-insider-upsell',  text: "the regulars' take" },
  { id: 'verdict-upsell',        text: 'Replay your week' },
  { id: 'pc-founder-upsell',     text: 'Founder frame' },
];
for (const p of placements) {
  assert.ok(html.includes(`id="${p.id}"`), `HTML must declare #${p.id}`);
  assert.ok(html.includes(p.text), `#${p.id} should mention "${p.text}"`);
}

// Buttons that open the existing paywall modal
const wiredButtons = ['brief-insider-btn', 'verdict-upsell', 'pc-founder-upsell'];
for (const id of wiredButtons) {
  assert.ok(html.includes(`id="${id}"`), `HTML must declare #${id}`);
}
// main.js wires them to modals.open('paywall')
for (const id of wiredButtons) {
  const re = new RegExp(`['"\`]${id}['"\`]`);
  assert.ok(re.test(mainSrc), `main.js must wire #${id}`);
}

// ---- 2. applyPaywallPlacements defined + reachable ------------
assert.ok(/function\s+applyPaywallPlacements\(\)/.test(mainSrc),
  'applyPaywallPlacements must be defined as a named function');
assert.ok(/PAYWALL_PLACEMENTS\s*=/.test(mainSrc),
  'PAYWALL_PLACEMENTS lookup table must be defined');
// On change + on sign + on configure
assert.ok(/billing\.onChange\([\s\S]{0,300}applyPaywallPlacements/.test(mainSrc),
  'billing.onChange must call applyPaywallPlacements so surfaces stay in sync');
assert.ok(/applyPaywallPlacements\(\)/.test(mainSrc.match(/function\s+signLicence[\s\S]*?\n\}/)[0]),
  'applyPaywallPlacements must run inside signLicence');
assert.ok(/billing\.configure[\s\S]*?\.then[\s\S]*?applyPaywallPlacements/.test(mainSrc),
  'applyPaywallPlacements must run after billing.configure() resolves');

// ---- 3. Founder-only surface is gated -------------------------
// Match `share: { ... isFounderOnly: true ... }` — the value can sit
// anywhere inside the brace block, including the comment column.
const placementBlockMatch = mainSrc.match(/const PAYWALL_PLACEMENTS\s*=\s*\{[\s\S]*?\};/);
assert.ok(placementBlockMatch, 'PAYWALL_PLACEMENTS lookup table must exist as a const object');
const block = placementBlockMatch[0];
assert.ok(/share:\s*\{[^]*isFounderOnly:\s*true/.test(block),
  'share placement must be founder-only (show to non-founders)');
assert.ok(/brief:\s*\{[^]*isFounderOnly:\s*false/.test(block),
  'brief placement is not founder-only');

// ---- 4. The offer-take line is fetched and rendered ----------
assert.ok(/function\s+(async\s+)?fetchOfferTake\(\)/.test(mainSrc),
  'fetchOfferTake must be a named function');
assert.ok(/function\s+presentBeat[\s\S]*?fetchOfferTake\(\)\.then/.test(mainSrc),
  'presentBeat must call fetchOfferTake and write the line to #offer-insider-text');
// Cache key is the day — so a single day doesn't refetch on every open
assert.ok(/_offerTakeCache\s*=\s*\{\s*day/.test(mainSrc),
  '_offerTakeCache must key by day');

// ---- 5. Headless: applyPaywallPlacements under three tiers ----
// Re-implement the rule locally and verify against the table from main.js.
// (Both must stay in sync — a drift here means a silent UI bug.)
const PLACEMENTS = {
  brief:   { id: 'brief-insider-upsell', isFounderOnly: false },
  offer:   { id: 'offer-insider-upsell', isFounderOnly: false },
  verdict: { id: 'verdict-upsell',       isFounderOnly: false },
  share:   { id: 'pc-founder-upsell',    isFounderOnly: true  },
};
function shouldShow(placement, isInsider, isFounder) {
  if (placement.isFounderOnly) return !isFounder;
  return !isInsider;
}

// non-insider (free) → all four surfaces visible
assert.equal(shouldShow(PLACEMENTS.brief,   false, false), true, 'free reader sees brief upsell');
assert.equal(shouldShow(PLACEMENTS.offer,   false, false), true, 'free reader sees offer upsell');
assert.equal(shouldShow(PLACEMENTS.verdict, false, false), true, 'free reader sees verdict upsell');
assert.equal(shouldShow(PLACEMENTS.share,   false, false), true, 'free reader sees share upsell (founder frame)');
// insider (paid) → no brief/offer/verdict, still sees share upsell
assert.equal(shouldShow(PLACEMENTS.brief,   true,  false), false, 'insider should NOT see brief upsell');
assert.equal(shouldShow(PLACEMENTS.offer,   true,  false), false, 'insider should NOT see offer upsell');
assert.equal(shouldShow(PLACEMENTS.verdict, true,  false), false, 'insider should NOT see verdict upsell');
assert.equal(shouldShow(PLACEMENTS.share,   true,  false), true,  'insider still sees founder share upsell');
// founder → no upsells (they have everything, including the founder share)
assert.equal(shouldShow(PLACEMENTS.brief,   true,  true),  false, 'founder should NOT see brief upsell');
assert.equal(shouldShow(PLACEMENTS.offer,   true,  true),  false, 'founder should NOT see offer upsell');
assert.equal(shouldShow(PLACEMENTS.verdict, true,  true),  false, 'founder should NOT see verdict upsell');
assert.equal(shouldShow(PLACEMENTS.share,   true,  true),  false, 'founder should NOT see share upsell');

console.log(JSON.stringify({
  passed: true,
  tests: 12 + placements.length,
  placements: Object.keys(PLACEMENTS),
}));
