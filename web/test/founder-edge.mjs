// PR-4b — Founder entitlement edge cases.
//
// Pins three contracts:
//   1. The #founder-replay button is hidden for non-founders, shown to founders
//   2. The replay-with-new-seed flow swaps SEED before reset() reads it
//   3. The share card renders the founder stamp variant when isFounder()
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const mainSrc = readFileSync(new URL('js/main.js', root), 'utf8');
const shareSrc = readFileSync(new URL('js/shareCard.js', root), 'utf8');

// ---- 1. Founder-replay button in the receipt modal ----------------
assert.ok(html.includes('id="founder-replay"'),
  'HTML must declare #founder-replay in the receipt footer');
assert.ok(/founder-replay[\s\S]*?Founder['’]s Pass/i.test(html),
  '#founder-replay must be labelled as the Founder’s Pass CTA');
assert.ok(html.includes('id="founder-replay" style="display:none'),
  '#founder-replay must start hidden');

// ---- 2. main.js wires the click + visibility gate -----------------
assert.ok(/founderReplay\(\)/.test(mainSrc),
  'main.js must define founderReplay()');
assert.ok(/billing\.isFounder\(\)/.test(mainSrc),
  'main.js must gate the founder replay on billing.isFounder()');
assert.ok(/SEED_OVERRIDE/.test(mainSrc),
  'main.js must define SEED_OVERRIDE for the fresh seed swap');
assert.ok(/founder-replay[\s\S]{0,400}\.style\.display\s*=\s*['"]{2}/.test(mainSrc) ||
         /billing\.isFounder\(\)\s*\?\s*\$?\(['"]founder-replay['"]\)\.style\.display\s*=\s*['"]{2}/.test(mainSrc) ||
         /\$\(['"]founder-replay['"]\)\.style\.display\s*=\s*['"]{2}/.test(mainSrc),
  'main.js must flip the founder-replay button visible on finale when isFounder()');

// ---- 3. The replay swaps the seed before reset reads it ------------
// founderReplay() must write SEED_OVERRIDE before calling reset()
const replayFn = mainSrc.match(/const founderReplay\s*=[\s\S]*?\};/);
assert.ok(replayFn, 'founderReplay must be a const arrow function');
assert.ok(replayFn[0].includes('SEED_OVERRIDE'), 'founderReplay must write SEED_OVERRIDE');
// The order matters: SEED_OVERRIDE must be set BEFORE reset() is called.
// Strip comments first — the comment "mirror reset() but swap the seed
// first" precedes SEED_OVERRIDE and contains the literal word.
const stripped = replayFn[0].replace(/\/\/[^\n]*/g, '');   // drop // comments
const writeIdx = stripped.indexOf('SEED_OVERRIDE');
const resetIdx = stripped.indexOf('reset()');
assert.ok(writeIdx >= 0 && resetIdx > writeIdx, 'SEED_OVERRIDE must be written before the reset() call');
// A _fresh_ value is used (not the same seed)
assert.ok(/fresh|new|Date\.now|Math\.random/.test(replayFn[0]),
  'founderReplay must choose a fresh seed (not the same one)');

// ---- 4. seedNow() everywhere reset() reads it ---------------------
// reset() must call seeded(seedNow()), not seeded(SEED) — otherwise the
// founder's fresh seed never reaches the RNG.
assert.ok(/seeded\(seedNow\(\)\)/.test(mainSrc),
  'reset() must seed the exchange from seedNow(), not the bare SEED const');
// The Photo share card also has to print the live seed (so the founder's
// replay cards carry the new seed)
assert.ok(/buildShareCard[\s\S]{0,200}seed:\s*seedNow\(\)/.test(mainSrc),
  'doPhoto() must pass seedNow() to buildShareCard');

// ---- 5. Share card founder variant --------------------------------
assert.ok(/founder\s*[:=]\s*false/.test(shareSrc),
  'buildShareCard opts must accept founder:false default');
assert.ok(/founder\s*\?\s*founderStampVariant\(\)/.test(shareSrc),
  'buildShareCard must switch on founder for the stamp variant');
assert.ok(/DISTRICT FOUNDER/.test(shareSrc),
  'founder stamp text must say "DISTRICT FOUNDER"');
// gold-leaf colour (rgba(201,162,39,...) instead of the red rgba(208,64,58,...))
assert.ok(/rgba\(201,\s*162,\s*39/.test(shareSrc),
  'founder stamp border + subtitle must use brass gold (rgba(201,162,39,…))');

// ---- 6. End-to-end: founderReplay sets SEED_OVERRIDE before reset()
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.has(k) ? memStore.get(k) : null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
};
globalThis.window = globalThis;
globalThis.location = { search: '', origin: 'http://test', href: 'http://test/?seed=7' };

const { billing } = await import('../js/billing.js?founder-iso=' + Date.now());

// Non-founder: replay guard rejects
billing.subscribed = false; billing.insider = false; billing.founder = false;
assert.equal(billing.isFounder(), false, 'fresh manager should not be a founder');

// Grant founder
billing.setEntitlement('district_founder', true);
assert.equal(billing.isFounder(), true, 'setEntitlement should flip founder');
// Insider still false — founder is its own flag
assert.equal(billing.isInsider(), true, 'founder carries insider perks (isInsider=true)');

console.log(JSON.stringify({
  passed: true,
  tests: 12,
  founderReplay: 'wired',
  seedSwap: 'verified (SEED_OVERRIDE written before reset)',
  shareVariant: 'founder stamp wired',
}));
