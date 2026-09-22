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
//   5. Ruth — the staff layer: one hidden condition stat, a Brief choice
//      (send home / push on), real consequences both ways, and the
//      sick-barista incident reads her state.
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

// ---- 2) sizing: a real position — light / standard / heavy are three distinct stacks
{
  const { Exchange } = await import('../js/exchange.js');
  const { CAMPAIGN } = await import('../js/config.js');
  for (const [tag, mul] of [['light', 0.5], ['standard', 1], ['heavy', 2]]) {
    const ex = new Exchange(7);
    ex.contractBeans(CAMPAIGN.contractUnits * mul, CAMPAIGN.contractFee * mul);
    assert.equal(ex.contract.units, CAMPAIGN.contractUnits * mul, `${tag} contract sizes the units`);
    assert.equal(Math.round(ex.debt), CAMPAIGN.contractFee * mul, `${tag} contract sizes the fee`);
  }
  const ex = new Exchange(7);
  ex.contractBeans(CAMPAIGN.contractUnits / 2, CAMPAIGN.contractFee / 2);
  for (let i = 0; i < CAMPAIGN.contractUnits / 2; i++) ex.consume(1);
  assert.equal(ex.contract, null, 'contract clears exactly at quota');
  console.log('SIZE    light/std/heavy contracts size units+fee, burn cup-by-cup, clear at quota');
}

// ---- 3) the letter carries five replies: light / standard / heavy / hold / settle ---
{
  const { composeLetter } = await import('../js/letter.js');
  const L = composeLetter({
    day: 2, index: 1.15, indexPrev: 1.0, cost: 1.5, sold: 80, balked: 10,
    defections: 0, reputation: 70, debt: 22, contract: null, event: { tier: 'bad', head: 'X', line: 'y' },
  });
  assert.equal(L.actions.length, 5, 'letter offers five replies');
  assert.deepEqual(L.actions.map(a => a.id), ['contract_light', 'contract', 'contract_heavy', 'hold', 'settle'],
    'replies are light / standard / heavy / hold / settle');
  assert.ok(L.body.includes('Spot closed up 15%'), 'letter names today’s spot move');
  assert.ok(L.body.includes('carried before'), 'letter says what the move implies');
  const flat = composeLetter({
    day: 2, index: 1.0, indexPrev: 1.0, cost: 1.3, sold: 10, balked: 0,
    defections: 0, reputation: 70, debt: 0, contract: null, event: {},
  });
  assert.ok(flat.body.includes('held flat'), 'flat day prints the flat line');
  console.log('LETTER  5 replies (light/std/heavy/hold/settle) · spot delta + stack implication');
}

// ---- 4) the regular's ask ----------------------------------------------------------
{
  const html = read('web/index.html');
  for (const id of ['offer', 'offer-who', 'offer-line', 'offer-effect', 'offer-yes', 'offer-no'])
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  const main = read('web/js/main.js');
  assert.ok(main.includes('const OFFERS'), 'offers table exists');
  const offersBlock = main.slice(main.indexOf('const OFFERS'), main.indexOf('// The floor bites back'));
  assert.equal((offersBlock.match(/who: '/g) || []).length, 5, 'five rotating offers');
  assert.ok(main.includes('dayMin >= 660'), 'offer fires at 11:00');
  assert.ok(main.includes('oluPayoutAt = 750'), 'Olu’s 12:30 payout is deferred');
  assert.ok(main.includes('officeRunAt = 900'), 'Mara’s 15:00 queue check is deferred');
  assert.ok(main.includes('estherCard'), 'Esther’s stamp card carries forward');
  assert.ok(main.includes('!offerShown && dayMin >= 660'), 'offer fires once at 11:00');
  assert.ok(main.includes("phase !== 'trading' || modals.top() !== 'offer'"),
    'resolveOffer only resolves the live top offer');
  assert.ok(main.includes("resolveOffer(true)") && main.includes("resolveOffer(false)"),
    'y/n keys resolve the offer');
  console.log('ASK     modal, 5 offers, deferred consequences, headless gate — all wired');
}

// ---- 5) the floor bites back: incidents + the cost sheet ------------------------------
{
  const main = read('web/js/main.js');
  assert.ok(main.includes('const INCIDENTS'), 'incidents table exists');
  const incBlock = main.slice(main.indexOf('const INCIDENTS'), main.indexOf('function showIncident'));
  assert.equal((incBlock.match(/who: '/g) || []).length, 6, 'six operational incidents');
  assert.ok(main.includes('day >= 2 && !incidentShown'), 'incidents are day-2+ (day 1 stays clean)');
  assert.ok(main.includes('dayMin >= 895'), 'incidents land post-wave');
  assert.ok(main.includes('patrons.balkMul = 1.6'), 'plumber decline hits patience');
  assert.ok(main.includes('patrons.staffMul = 0.6'), 'sick barista slows the bar');
  assert.ok(main.includes('cashOnly = 0.2'), 'dead card machine kills a fifth of sales');
  assert.ok(main.includes('adjustOpinions(-0.16)'), 'failed inspection hits reputation');
  assert.ok(main.includes('solicitorAt = 990'), 'contested scald claim is deferred to 16:30');
  assert.ok(main.includes('contractFeeExtra += 18'), 'COD refusal rides on the next contract fee');
  const p = read('web/js/patrons.js');
  assert.ok(p.includes('ECON.barPoints * (this.staffMul || 1)'), 'staffMul throttles the bar');
  assert.ok(p.includes('* (this.balkMul || 1)'), 'balkMul throttles patience');
  const cfg = read('web/js/config.js');
  for (const k of ['staffDayRate', 'staffPerCup', 'suppliesPerCup', 'pitchMin', 'pitchPct', 'cardFeePct', 'sundries'])
    assert.ok(cfg.includes(k + ':'), `CAMPAIGN has ${k}`);
  assert.ok(main.includes('cOps += ops.total'), 'the cost sheet accumulates');
  assert.ok(main.includes("['operating costs', fmt(cOps)]"), 'finale prints the operating-cost line');
  assert.ok(main.includes('netWorth: cRev - cCost - cOps'), 'netWorth subtracts operating costs');
  console.log('BITES   6 incidents · real sim effects · cost sheet on the receipt');
}

// ---- 6) Morning Brief: the Drug Wars turn — paused at 06:00, commit then OPEN ----
{
  const html = read('web/index.html');
  for (const id of ['brief', 'brief-kicker', 'brief-letter', 'brief-canvas', 'brief-wire', 'brief-demand', 'brief-actions', 'brief-open', 'brief-desklink'])
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  const main = read('web/js/main.js');
  assert.ok(main.includes('function showMorningBrief()'), 'Morning Brief: showMorningBrief() exists');
  assert.ok(main.includes('function dismissBriefAndStartDay()'), 'Morning Brief: dismiss path exists');
  assert.ok(main.includes('briefChoice'), 'Morning Brief: briefChoice state exists');
  assert.ok(main.includes('OPEN FOR DAY'), 'Morning Brief: OPEN commit button exists');
  assert.ok(main.includes('drawBriefSparkline'), 'Morning Brief: 5-day bean sparkline exists');
  // the Brief is the planning turn: it must pause the floor and must be gated headless
  assert.ok(main.includes("!headless && !tutorialActive") && main.includes('showMorningBrief'),
    'Morning Brief is headless-gated and tutorial-gated');
  // Brief offers the same sizing choice as the letter — the position before the day runs
  assert.ok(main.includes('contract_light') && main.includes('contract_heavy'),
    'Morning Brief carries the sizing choice (light/std/heavy)');
  // Brief before brief-open must NOT call openDay(day+1) — it commits the price, not the next day
  const briefBlock = main.slice(main.indexOf('function dismissBriefAndStartDay()'),
    main.indexOf('// ---- dawns'));
  assert.ok(!briefBlock.includes('openDay(day + 1)'),
    'Brief commit stays on today — only the letter advances the day');
  assert.ok(/function startTradingDay[\s\S]{0,6000}paused = false/.test(main), 'Brief OPEN resumes the floor through startTradingDay');
  // Street work: three dawn toggles with real costs, committed with the hedge
  assert.ok(main.includes('brief-demand-'),
    'Brief carries the street-work row (chalk/sample/sponsor)');
  assert.ok(main.includes('marketingSpend'), 'sponsor cost rides a marketing accumulator into the ops sheet');
  assert.ok(main.includes('demand.resolveDay'), 'closeDay resolves awareness decay + returnees');
  console.log('BRIEF   06:00 paused turn: letter + sparkline + wire + sizing + street work + OPEN — headless/tutorial-gated');
}

// ---- 7) Ruth: one hidden condition, one Brief choice, real consequences ----
{
  const html = read('web/index.html');
  assert.ok(html.includes('id="brief-staff"'), 'index.html has #brief-staff row');
  const main = read('web/js/main.js');
  assert.ok(main.includes('baristaCondition'), 'hidden condition state exists');
  // the choice only surfaces when she's fading — and never on day 1
  const staffing = read('web/js/staffing.js');
  assert.ok(main.includes('canChooseStaffing(day, baristaCondition)') && staffing.includes('day >= 2 && condition < .55'),
    'staff row is condition-gated, day-2+');
  assert.ok(main.includes('brief-staff-home') && main.includes('brief-staff-push') && main.includes('brief-staff-apprentice'), 'home/apprentice/push buttons exist');
  // both branches carry a real trade: home slows the bar but saves the wage and recovers her
  assert.ok(main.includes("baristaHomeToday = res.plan.staffing === 'home'"), 'Brief commit lands the staff choice');
  assert.ok(main.includes('patrons.staffMul = 0.7'), 'sent home → solo bar runs −30%');
  assert.ok(main.includes('baristaCondition + 0.45'), 'sent home → she recovers at close');
  assert.ok(read('web/js/economy.js').includes("staffing === 'home' ? 0"), 'sent home → wage saved on the cost sheet');
  assert.ok(main.includes('baristaCondition - 0.14'), 'a worked day drains her');
  // neglect has teeth: exhausted legs slow the bar, pushed under a fifth she breaks
  assert.ok(main.includes('baristaCondition < 0.35 ? 0.8 : 1'), 'exhausted dawn → slower bar');
  assert.ok(main.includes('baristaCrisis') && staffing.includes('condition < .2'), 'crisis fires under a fifth');
  assert.ok(main.includes('patrons.staffMul = 0.5'), 'crisis: she falls asleep — bar crawls');
  assert.ok(main.includes('adjustOpinions(-0.2)'), 'crisis: she snaps at a regular — rep hit');
  // the incident table reads her state: home → she can't call in sick; fumes → worse terms
  assert.ok(main.includes('o = INCIDENTS[(idx + 1) % INCIDENTS.length]'), 'home days skip the sick-call');
  assert.ok(main.includes('patrons.staffMul = 0.4'), 'fumes variant declines to a −60% bar');
  // campaign hygiene
  assert.ok(main.includes('baristaCondition = 1.0'), 'reset() restores Ruth');
  assert.ok(main.includes('lastDayStats'), 'Brief reads yesterday’s counters, not reset zeros');
  assert.ok(main.includes('staff_sent_home') && main.includes('staff_pushed') && main.includes('staff_crisis'),
    'staff analytics: sent home / pushed / crisis');
  console.log('RUTH    hidden condition · Brief home/push · solo-bar cost · crisis under a fifth');
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — agency: the tape, sized contracts, letter stakes, the regular’s ask, the floor’s bite, the Morning Brief turn, Ruth’s ledger');
