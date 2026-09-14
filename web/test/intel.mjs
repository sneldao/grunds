// Linkup deep-research wiring: the live fetch route, the server-side deck
// consumption, the local deck bias, and the letter's source citation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Exchange } from '../js/exchange.js';
import { composeLetter } from '../js/letter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

// 1) The local deck honors a clamped bias map. stable ×3, everything else
//    ×0.2 → stable pool 90 vs ~14 others (≈86%); over 240 seeded rolls it
//    must dominate its 30% baseline with room to spare.
{
  let stable = 0;
  const bias = { stable: 3, frost_minas: 0.2, drought_ea: 0.2, harvest_good: 0.2, hype_matcha: 0.2, rumour_frost: 0.2 };
  for (let seed = 1; seed <= 240; seed++) {
    const ex = new Exchange(seed);
    const ev = ex.roll(bias);
    if (ev.id === 'stable') stable++;
  }
  assert.ok(stable / 240 > 0.7, `biased deck should favor stable (~86%), got ${stable}/240`);
}

// 2) No bias → identical seeded behavior; roll() still returns a valid event.
{
  const ex = new Exchange(7);
  const ev = ex.roll();
  assert.ok(ev && typeof ev.id === 'string' && ev.id.length > 0, 'unbiased roll returns an event');
}

// 3) Bias never breaks the pity timer: after a catastrophe, a cata event
//    stays forbidden even when intel boosts it.
{
  let catas = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const ex = new Exchange(seed);
    ex.lastTier = 'cata';
    const ev = ex.roll({ frost_minas: 3 });
    if (ev.tier === 'cata') catas++;
  }
  assert.equal(catas, 0, 'pity timer still forbids back-to-back catastrophes under bias');
}

// 4) The letter cites the wire only when intel actually arrived.
{
  const snap = { day: 2, index: 1.05, cost: 0.2, sold: 40, balked: 2, defections: 0, reputation: 65, debt: 0, contract: null };
  assert.ok(!composeLetter(snap).body.includes('Off the wire'), 'no intel → no citation line');
  const cited = composeLetter({
    ...snap,
    intel: { sources: [{ title: 'Brazil frost hits arabica belt', url: 'https://www.reuters.com/markets/x' }], marketShift: [] },
  });
  assert.ok(cited.body.includes('Off the wire — Brazil frost hits arabica belt (reuters.com)'),
    'intel source is cited with its domain');
}

// 5) Source wiring: the route, the fetcher, the cron, the server consumption.
{
  const http = read('convex/http.ts');
  assert.ok(http.includes('/ai/research') && http.includes('research.wireResearch'),
    'http.ts exposes GET /ai/research → the merged wire');
  const sync = read('web/js/convexSync.js');
  assert.ok(sync.includes('/ai/research') && /async function intel\(/.test(sync),
    'convexSync.js fetches intel over the bridge');
  const crons = read('convex/crons.ts');
  assert.ok(crons.includes('linkup-intel-refresh') && crons.includes('refreshLinkupIntelligence'),
    'crons.ts schedules the nightly Linkup refresh');
  const ex = read('convex/exchange.ts');
  assert.ok(ex.includes('research:wire:v1:') && ex.includes('linkup:research:v1:') && ex.includes('weightMul'),
    'convex openDay consumes the merged wire, falls back to raw Linkup');
  const local = read('web/js/exchange.js');
  assert.ok(local.includes('roll(bias)') && local.includes('Math.min(3'),
    'local deck accepts a clamped bias map');
  const main = read('web/js/main.js');
  assert.ok(main.includes('sync.intel()') && main.includes('marketIntel.marketShift'),
    'main.js fetches intel and tilts the dawn deck');
}

// 6) The merged wire: Firecrawl + Linkup corroborate, OpenAI writes the why.
{
  const research = read('convex/research.ts');
  assert.ok(research.includes('api.linkup.searchCommodityIntelligence') &&
    research.includes('api.firecrawl.fetchCommodityNews'),
    'wireResearch fans out to both pipes');
  assert.ok(research.includes('corroborated = true') && research.includes('* 1.15'),
    'corroborating pipes lift the tilt instead of stacking');
  assert.ok(research.includes('api.openai.wireWhy'), 'OpenAI writes the why-this-matters line');
  assert.ok(research.includes('research:wire:v1:'), 'merged payload caches under its own key');
  const fc = read('convex/firecrawl.ts');
  assert.ok(fc.includes('api.firecrawl.dev/v1/search') && fc.includes('KEYWORD_MAP'),
    'firecrawl crawls commodity news into deck suggestions');
  const oa = read('convex/openai.ts');
  assert.ok(oa.includes('export const wireWhy') && oa.includes('api.openai.com/v1/chat/completions'),
    'wireWhy hits the live OpenAI chat API');
  const crons = read('convex/crons.ts');
  assert.ok(crons.includes('wire-merge-refresh'), 'merged wire refreshes on the nightly cron');
  const main = read('web/js/main.js');
  const desk = read('web/js/desk.js');
  assert.ok(main.includes("s.origin ? ' · ' + s.origin") && desk.includes("s.origin ? ' · ' + s.origin"),
    'wire sources carry an origin tag on both surfaces');
  console.log('WIRE    Linkup + Firecrawl merge · corroboration boost · OpenAI why-line · origin tags');
}

console.log('\nPASS — Linkup intel: deck bias honored + clamped, pity intact, letter cites the wire, all surfaces wired');
