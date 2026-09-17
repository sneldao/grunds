// Demand test — awareness brings them, loyalty brings them back:
//   1. Opening awareness (0.55) spawns ≈0.9× — below today's 1.0, room to grow.
//   2. spawnMul rails: 0 awareness → 0.4×, full → 1.3×.
//   3. Coasting decays awareness 0.04/close; catastrophes scare an extra 0.04.
//   4. Each dawn action lands its configured gain on tomorrow's awareness.
//   5. Return rate: 62 → 0.12, higher reputation returns more, capped at 0.35.
//   6. resolveDay counts returnees = served × rate; staged flags clear.
//   7. Sponsor can't stage before sponsorDay; double-staging is rejected.
//   8. Regulars.returnRate mirrors Demand.returnRateFor (one number, two doors).
//   9. main.js wires it: tick multiplies spawn, closeDay resolves, Brief stages.
//
// Run: node web/test/demand.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Demand } from '../js/demand.js';
import { Regulars } from '../js/regulars.js';
import { CAMPAIGN } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const D = CAMPAIGN.demand;

// 1) opening spawn multiplier
{
  const d = new Demand();
  ok(close(d.spawnMul(), D.spawnMin + (D.spawnMax - D.spawnMin) * D.start),
    `opening spawnMul follows start awareness (got ${d.spawnMul()})`);
  ok(d.spawnMul() < 1, 'opening demand sits just under the old always-1.0 floor');
}

// 2) rails
{
  const d = new Demand();
  d.awareness = 0; ok(close(d.spawnMul(), D.spawnMin), 'zero awareness → spawnMin');
  d.awareness = 1; ok(close(d.spawnMul(), D.spawnMax), 'full awareness → spawnMax');
}

// 3) coasting decay + catastrophe extra
{
  const d = new Demand();
  const t = d.resolveDay({ served: 100, reputation: 62, eventTier: 'calm' });
  ok(close(t.decay, D.decay), 'calm close decays the base rate');
  ok(close(d.awareness, D.start - D.decay), 'coasting visibly loses the street');
  const d2 = new Demand();
  const t2 = d2.resolveDay({ served: 100, reputation: 62, eventTier: 'cata' });
  ok(close(t2.decay, D.decay + D.cataExtra), 'catastrophe scares extra');
}

// 4) dawn actions land their gains
{
  for (const [id, gain] of [['chalk', D.chalkGain], ['sample', D.sampleGain], ['sponsor', D.sponsorGain]]) {
    const d = new Demand();
    ok(d.stage(id, 5), `${id} stages on day 5`);
    const t = d.resolveDay({ served: 100, reputation: 62, eventTier: 'calm' });
    ok(close(t.gain, gain), `${id} lands +${gain}`);
    ok(close(d.awareness, D.start - D.decay + gain), `${id} nets against decay`);
  }
}

// 5) return rate shape
{
  ok(close(Demand.returnRateFor(62), D.returnBase), 'rep 62 → base rate');
  ok(Demand.returnRateFor(80) > Demand.returnRateFor(62), 'legends get more back');
  ok(Demand.returnRateFor(40) < Demand.returnRateFor(62), 'soured rooms get less back');
  ok(close(Demand.returnRateFor(200), D.returnMax), 'return rate caps at returnMax');
}

// 6) returnees counted + staged flags clear
{
  const d = new Demand();
  d.stage('chalk', 1);
  const t = d.resolveDay({ served: 200, reputation: 62, eventTier: 'calm' });
  ok(t.returnees === Math.round(200 * D.returnBase), `returnees = served × rate (got ${t.returnees})`);
  ok(!d.staged.chalk && !d.staged.sample && !d.staged.sponsor, 'staged flags clear at close');
}

// 7) sponsor gate + double-stage
{
  const d = new Demand();
  ok(!d.canStage('sponsor', 1), 'sponsor locked before sponsorDay');
  ok(!d.stage('sponsor', 1), 'locked sponsor refuses to stage');
  ok(d.stage('sponsor', D.sponsorDay), 'sponsor stages on sponsorDay');
  ok(!d.stage('chalk', 1) === false, 'chalk stages (sanity)');
  ok(!d.stage('chalk', 1), 'double-staging rejected');
}

// 8) one number, two doors
{
  const r = new Regulars();
  ok(close(r.returnRate, Demand.returnRateFor(r.reputation)), 'Regulars.returnRate mirrors the pure function');
}

// 9) wiring in main.js
{
  const main = read('web/js/main.js');
  ok(main.includes("import { Demand } from './demand.js'"), 'main imports Demand');
  ok(main.includes('demand.spawnMul()'), 'tick multiplies the wave by awareness');
  ok(main.includes('demand.resolveDay'), 'closeDay resolves demand');
  ok(main.includes('brief-demand-'), 'Brief carries the three street-work buttons');
  ok(main.includes('demand.reset()'), 'campaign reset rewinds awareness');
  ok(main.includes('street ${demand.pips()}') || main.includes('demand.pips()'), 'tape prints awareness pips');
  const html = read('web/index.html');
  ok(html.includes('id="brief-demand"'), 'index.html has #brief-demand row');
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`PASS — demand: awareness decays, street work buys it back, loyalty returns ${D.returnBase * 100}% at rep 62`);
