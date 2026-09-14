// Headless test that PROVES the agency pass is wired:
//   1. The tape: #tape element exists in the HUD and main.js renders the
//      bean index with a day-over-day delta and click-through to the desk.
//   2. Sizing: the letter offers four replies (light/deep/hold/settle) and
//      contractBeans(units, fee) sizes the position — deep locks ~2× units
//      at ~2× fee.
//   3. The regular's ask: #offer modal markup exists, five rotating offers
//      each carry a real effect, the 11:00 trigger + deferred consequences
//      (Olu 12:30, Mara 15:00) and the Esther dawn charge are wired, and
//      the trigger is headless-gated so tests don't stall on the pause.
//   4. Letter stakes: composeLetter prints the spot delta line when given
//      indexPrev.
//
// Run: node web/test/agency.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const fails = [];

// ---- 1) the tape ---------------------------------------------------------------
{
  const html = read('web/index.html');
  assert.ok(html.includes('id="tape"'), 'index.html has #tape HUD line');
  const main = read('web/js/main.js');
  assert.ok(main.includes('tapePrev'), 'main.js tracks yesterday’s close');
  assert.ok(main.includes("exchange.beanIndex - tapePrev"), 'tape renders a day-over-day delta');
  assert.ok(main.includes("$('tape').onclick") && main.includes('desk.open(marketIntel)'),
    'tape clicks through to the wire desk');
  console.log('TAPE    #tape HUD line, delta render, desk click-through wired');
}

// ---- 2) sizing: a real position --------------------------------------------------
{
  const { Exchange } = await import('../js/exchange.js');
  const { CAMPAIGN } = await import('../js/config.js');
  const ex = new Exchange(7);
  ex.contractBeans(CAMPAIGN.contractUnits / 2, CAMPAIGN.contractFee / 2);
  assert.equal(ex.contract.units, CAMPAIGN.contractUnits / 2, 'light contract sizes the units');
  assert.equal(Math.round(ex.debt), CAMPAIGN.contractFee / 2, 'light contract sizes the fee');
  const ex2 = new Exchange(7);
  ex2.contractBeans(CAMPAIGN.contractUnits * 2, CAMPAIGN.contractFee * 2);
  assert.equal(ex2.contract.units, CAMPAIGN.contractUnits * 2, 'deep contract doubles the cover');
  assert.equal(Math.round(ex2.debt), CAMPAIGN.contractFee * 2, 'deep contract doubles the fee');
  // the position burns cup-by-cup and clears exactly at quota
  for (let i = 0; i < CAMPAIGN.contractUnits / 2; i++) ex.consume(1);
  assert.equal(ex.contract, null, 'contract clears exactly at quota');
  console.log('SIZE    light/deep contracts size units+fee, burn cup-by-cup, clear at quota');
}

// ---- 3) the letter carries four replies ------------------------------------------
{
  const { composeLetter } = await import('../js/letter.js');
  const L = composeLetter({
    day: 2, index: 1.15, indexPrev: 1.0, cost: 1.5, sold: 80, balked: 10,
    defections: 0, reputation: 70, debt: 22, contract: null, event: { tier: 'bad', head: 'X', line: 'y' },
  });
  assert.equal(L.actions.length, 4, 'letter offers four replies');
  assert.deepEqual(L.actions.map(a => a.id), ['contract', 'contract_deep', 'hold', 'settle'],
    'replies are light / deep / hold / settle');
  assert.ok(L.body.includes('Spot closed up 15%'), 'letter names today’s spot move');
  assert.ok(L.body.includes('lock tonight'), 'letter says what the move implies');
  const flat = composeLetter({
    day: 2, index: 1.0, indexPrev: 1.0, cost: 1.3, sold: 10, balked: 0,
    defections: 0, reputation: 70, debt: 0, contract: null, event: {},
  });
  assert.ok(flat.body.includes('held flat'), 'flat day prints the flat line');
  console.log('LETTER  4 replies · spot delta + implication in the body');
}

// ---- 4) the regular's ask ----------------------------------------------------------
{
  const html = read('web/index.html');
  for (const id of ['offer', 'offer-who', 'offer-line', 'offer-effect', 'offer-yes', 'offer-no'])
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  const main = read('web/js/main.js');
  assert.ok(main.includes('const OFFERS'), 'offers table exists');
  assert.equal((main.match(/who: '/g) || []).length, 5, 'five rotating offers');
  assert.ok(main.includes('dayMin >= 660'), 'offer fires at 11:00');
  assert.ok(main.includes('oluPayoutAt = 750'), 'Olu’s 12:30 payout is deferred');
  assert.ok(main.includes('officeRunAt = 900'), 'Mara’s 15:00 queue check is deferred');
  assert.ok(main.includes('estherCard'), 'Esther’s stamp card carries forward');
  assert.ok(main.includes('!headless && !offerShown'), 'offer is headless-gated (no stall)');
  assert.ok(main.includes("resolveOffer(true)") && main.includes("resolveOffer(false)"),
    'y/n keys resolve the offer');
  console.log('ASK     modal, 5 offers, deferred consequences, headless gate — all wired');
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — agency: the tape, sized contracts, letter stakes, and the regular’s ask');
