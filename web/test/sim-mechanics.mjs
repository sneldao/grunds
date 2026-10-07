// Three cafe mechanics, in Grunds' own numbers:
//   1. A shared hit merges with one counter before the bar reads milk.
//      Adds stack. Multipliers multiply. Capacity is not Ruth's condition.
//   2. Marketing reach enlarges the wave and weights the rival split.
//      The price level of both cafes grows or shrinks the pool.
//      Lot quality pulls on the split. Spawns stay one patron at a time.
//   3. Cafe satisfaction blends yesterday and today. Milk-outs and queue
//      walkouts are different weights. Tomorrow's return rate reads it.
//      The per-person grudge stays.
//
// Run: node web/test/sim-mechanics.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CAMPAIGN, ECON } from '../js/config.js';
import { Demand, marketingReach, priceElasticity, satisfactionTarget, blendSatisfaction, SAT_KEEP, SAT_TODAY } from '../js/demand.js';
import { mergeEffects, resolveShock, applyInventory, shockKnobs, repToOpinion, COUNTERABLE, counterForMenu, shockOnDay } from '../js/shocks.js';
import { MACRO_SHOCKS } from '../js/gentrification.js';
import { rivalChoiceProbability, strategyForDay } from '../js/rival.js';
import { ticketLevel, rollDrink } from '../js/menu.js';
import { resolveDecision } from '../js/decision.js';
import { Regulars } from '../js/regulars.js';
import { WALKOUT_OP } from '../js/consequences.js';
import { PatronSystem } from '../js/patrons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const scene = { add() {} };
const world = { seats: [] };
const exchange = { matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 0, spotCost: 0, hedged: false }) };

// ----------------------------------------------------------------
// 1. Counterable shock merge
// ----------------------------------------------------------------
{
  ok(COUNTERABLE.dairy_crunch.day === MACRO_SHOCKS.dairy_crunch.day, 'dairy hit shares the crunch calendar day');
  ok(shockOnDay(1) == null, 'day 1 stays clear of the counterable calendar');
  ok(shockOnDay(COUNTERABLE.machine_breaks.day) === 'machine_breaks', 'the broken machine has a dawn');
  ok(shockOnDay(COUNTERABLE.health_inspector.day) === 'health_inspector', 'the inspector has a dawn');
  ok(COUNTERABLE.machine_breaks.day !== COUNTERABLE.dairy_crunch.day && COUNTERABLE.health_inspector.day !== COUNTERABLE.dairy_crunch.day, 'the three dawns do not share a day');

  const stacked = mergeEffects(
    { inventory: -140, rep: -6, staff: -1, cost: 10 },
    { inventory: 140, rep: 9, staff: 2, cost: 48 },
  );
  ok(stacked.inventory === 0 && stacked.rep === 3 && stacked.staff === 1 && stacked.cost === 58, `adds stack, got ${JSON.stringify(stacked)}`);

  const scaled = mergeEffects(
    { capacityMult: 0.55, priceMult: 1.1, demandMult: 0.65 },
    { capacityMult: 1.82, priceMult: 0.9, demandMult: 1.2 },
  );
  ok(close(scaled.capacityMult, 0.55 * 1.82), `capacity multiplies, got ${scaled.capacityMult}`);
  ok(close(scaled.priceMult, 1.1 * 0.9), `price multiplies, got ${scaled.priceMult}`);
  ok(close(scaled.demandMult, 0.65 * 1.2), `demand multiplies, got ${scaled.demandMult}`);

  const stray = mergeEffects({ inventory: -10, foo: 5 }, { inventory: 3, bar: 1 });
  ok(stray.inventory === -7 && stray.foo == null && stray.bar == null, 'unknown shapes are not folded in');
  ok(Object.keys(mergeEffects()).length === 0, 'empty merge is empty');

  const bare = resolveShock('dairy_crunch', null);
  const bought = resolveShock('dairy_crunch', 'replace');
  const shrunk = resolveShock('dairy_crunch', 'shrink');
  const delivered = 50;
  ok(applyInventory(delivered, bare) === 0, `shortage cuts the van to empty, got ${applyInventory(delivered, bare)}`);
  const filled = applyInventory(delivered, bought);
  ok(filled > 0 && filled < applyInventory(delivered, shrunk), `the £36 fill leaves a deeper hole than shrinking the menu, got ${filled}`);
  ok(bought.inventory < 0 && bought.inventory > bare.inventory && -bought.inventory > -bare.inventory / 2, 'the fill buys back fewer than half the missing cups');
  ok(applyInventory(delivered, shrunk) === 10, `shrinking the milky menu gives partial headroom, got ${applyInventory(delivered, shrunk)}`);
  ok(bought.cost === 36 && shrunk.shrinkMilky === true && bare.shrinkMilky == null, 'replace costs, shrink pulls the milky menu');
  ok(counterForMenu({ flatwhite: false }) === 'shrink', 'an 86’d flat white is the shrink counter');
  ok(counterForMenu({ flatwhite: true }) == null, 'a full milky menu is not a counter');

  const repaired = resolveShock('machine_breaks', 'repair');
  const broken = resolveShock('machine_breaks', null);
  ok(close(broken.capacityMult, 0.90), 'a broken machine cuts capacity');
  ok(close(repaired.capacityMult, 0.90 * 1.08), 'a repair multiplies capacity most of the way back');
  ok(repaired.capacityMult < 1 && repaired.capacityMult > broken.capacityMult, 'a repair does not restore the whole bar');
  const knobs = shockKnobs(repaired, 0.42);
  ok(close(knobs.capacityMult, repaired.capacityMult) && knobs.staffCondition === 0.42, 'capacity is not Ruth’s condition');
  ok(knobs.shockStaff === 0, 'a repair does not invent staff');

  const cited = resolveShock('health_inspector', null);
  const tidied = resolveShock('health_inspector', 'tidy');
  const cleaned = resolveShock('health_inspector', 'clean');
  ok(cited.rep === -6 && tidied.rep === -2 && cleaned.rep === -1, `rep adds: bare ${cited.rep} tidy ${tidied.rep} clean ${cleaned.rep}`);
  ok(cleaned.rep < 0 && cleaned.rep > tidied.rep, 'a deep clean buys back more than a tidy, and not the whole citation');
  const room = new Regulars();
  const repBefore = room.reputation;
  room.adjustOpinions(repToOpinion(cited.rep));
  ok(repBefore - room.reputation === 6, `a -6 rep hit moves the room by 6, ${repBefore} → ${room.reputation}`);

  const snap = { day: 4, index: 1.2, debt: 0, contract: null, extraFee: 0, staffCondition: 0.4 };
  const plan = { hedge: 'hold', staffing: 'work', marketing: { sample: false, sponsor: false } };
  ok(resolveDecision(snap, plan).ok === true, 'the dawn plan still resolves');
  ok(resolveDecision(snap, { ...plan, shock: 'replace' }).ok === false, 'a shock is not folded into resolveDecision');

  const dry = new PatronSystem(scene, world, null, exchange, null, { random: () => 0.99 });
  const wet = new PatronSystem(scene, world, null, exchange, null, { random: () => 0.99 });
  const queueFlat = (sys) => {
    const p = sys.spawn('commuters', 'counter', true);
    p.drink = 'flatwhite'; p.state = 'inQueue'; p.waitMin = 0;
    sys.counterQ = [p];
    return p;
  };
  const dryCtx = { milkStock: applyInventory(delivered, bare), milky: 0, milkOut: false, batchUnits: 0, menuPrices: { flatwhite: 3.60 } };
  const wetCtx = { milkStock: applyInventory(delivered, bought), milky: 0, milkOut: false, batchUnits: 0, menuPrices: { flatwhite: 3.60 } };
  queueFlat(dry); queueFlat(wet);
  const dryEv = dry.tick(700, dryCtx);
  const wetEv = wet.tick(700, wetCtx);
  ok(dryEv.some(e => e.type === 'balked' && e.milkOut) && dryCtx.milkStock === 0, 'the uncountered cut is what the patron reads');
  ok(wetEv.some(e => e.type === 'served') && wetCtx.milkStock === filled - 1, 'the replace counter is in the stock before the pour, hole and all');

  let pulled = 0, rolls = 0;
  const offered = { espresso: true, flatwhite: !shrunk.shrinkMilky, filter: true, matcha: true };
  for (let i = 0; i < 40; i++) {
    const id = rollDrink('commuters', offered, () => (i + 1) / 41);
    rolls++;
    if (id === 'flatwhite') pulled++;
  }
  ok(pulled === 0 && rolls === 40, 'shrink takes flat white off the menu the roller reads');

  const hands = (cap, extra, staffMul) => {
    const sys = new PatronSystem(scene, world, null, exchange, null, { random: () => 0.99 });
    sys.capacityMult = cap; sys.shockStaff = extra; sys.staffMul = staffMul;
    const q = [];
    for (let i = 0; i < 12; i++) {
      const p = sys.spawn('elders', 'counter', true);
      p.drink = 'espresso'; p.state = 'inQueue'; p.waitMin = 0; q.push(p);
    }
    sys.counterQ = q;
    const prev = Math.random; Math.random = () => 0.99;
    const n = sys.tick(500, { milkStock: 20, milky: 0, milkOut: false, batchUnits: 0, menuPrices: { espresso: 3.20 } })
      .filter(e => e.type === 'served').length;
    Math.random = prev;
    return n;
  };
  const full = hands(1, 0, 1);
  const slowed = hands(0.55, 0, 1);
  const tired = hands(1, 0, 0.7);
  const both = hands(0.55, 0, 0.7);
  const extra = hands(1, 2, 1);
  ok(full === 8, `full bar serves 8, got ${full}`);
  ok(slowed === 4, `capacity 0.55 serves 4 with staffMul still 1, got ${slowed}`);
  ok(tired === 5 && both === 3, `staffMul and capacity multiply as separate knobs, tired ${tired} both ${both}`);
  ok(extra === 10, `extra hands add before capacity, got ${extra}`);
}

// ----------------------------------------------------------------
// 2. Reach grows the street and weights the split
// ----------------------------------------------------------------
{
  ok(close(priceElasticity(4.80, 4.50), 1), `opening prices are a neutral street, got ${priceElasticity(4.80, 4.50)}`);
  const dear = priceElasticity(5.40, 5.20);
  const cheap = priceElasticity(4.20, 3.80);
  ok(dear < 1 && cheap > 1, `price level moves the pool, dear ${dear} cheap ${cheap}`);
  ok(dear >= 0.6 && cheap <= 1.25, 'elasticity stays inside the rails');

  const sample = marketingReach({ sample: true });
  const sponsor = marketingReach({ sponsor: true });
  const bothReach = marketingReach({ sample: true, sponsor: true });
  ok(close(sample, CAMPAIGN.demand.sampleReach), 'a sample is reach');
  ok(close(sponsor, CAMPAIGN.demand.sponsorReach), 'a sponsor is reach');
  ok(close(bothReach, sample * sponsor), 'sample and sponsor multiply');
  ok(marketingReach({}) === 1, 'no street work is reach 1');

  const baseN = 20;
  const grown = Math.round(baseN * cheap * bothReach);
  const shrunk = Math.round(baseN * dear);
  ok(grown > baseN && shrunk < baseN, `reach grows the count and a dear street shrinks it, ${grown} / ${shrunk}`);

  const plain = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'commuters', ourPrice: 4.80 });
  const formula = .08 + .12 * (4.80 - CAMPAIGN.rivalStrategies.DEFAULT.price);
  ok(close(plain, formula), `default split is unchanged at reach 1 and a fresh cup, ${plain}`);
  const war = rivalChoiceProbability({ strategy: 'PRICE_WAR', cohort: 'students', ourPrice: 4.80 });
  const calm = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'students', ourPrice: 4.80 });
  ok(war > calm, 'scripted archetypes still pull');
  ok(strategyForDay(1) === 'DEFAULT' && strategyForDay(3) === 'PRICE_WAR', 'archetype calendar is untouched');

  const reached = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'commuters', ourPrice: 4.80, reach: bothReach });
  ok(close(reached, formula / bothReach), 'our reach weights the split down');
  const stale = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'commuters', ourPrice: 4.80, cupQuality: 0.6 });
  ok(stale > plain, `a tired cup pushes people across, ${stale} > ${plain}`);

  const seq = (first, rest) => { let i = 0; return () => i++ === 1 ? first : rest; };   // draw 1 is the drink roll (side roll leads)
  const cross = (reach, quality, roll) => {
    const sys = new PatronSystem(scene, world, null, exchange, null, { random: seq(0.99, roll) });
    // High roll lands creatives on matcha — priced at the day's board, so the
    // reach split is the one this block is measuring.
    sys.reach = reach; sys.cupQuality = quality; sys.rivalStrategy = 'DEFAULT';
    let rivals = 0;
    for (let i = 0; i < 8; i++) {
      const p = sys.spawn('creatives', 'counter', true);
      if (p && p.queueRef === 'rival') rivals++;
    }
    return rivals;
  };
  const lost = cross(1, 1, 0.10);
  const kept = cross(bothReach, 1, 0.10);
  const soured = cross(1, 0.5, 0.15);
  const fresh = cross(1, 1, 0.15);
  ok(lost > kept, `reach keeps patrons who would have crossed, lost ${lost} kept ${kept}`);
  ok(soured > fresh, `cup quality sends more across, soured ${soured} fresh ${fresh}`);
}

// ----------------------------------------------------------------
// 3. Sticky satisfaction from the walkout mix
// ----------------------------------------------------------------
{
  ok(close(ticketLevel(null, 4.80), 1), 'posted menu is price level 1');
  const deal = ticketLevel(null, ECON.matchaDeal);
  ok(deal < 1, 'a matcha deal lowers the level');

  const fresh = satisfactionTarget({ priceLevel: 1, cupQuality: 1, queueAway: 0, milkAway: 0 });
  const lined = satisfactionTarget({ priceLevel: 1, cupQuality: 1, queueAway: 0.2, milkAway: 0 });
  const dry = satisfactionTarget({ priceLevel: 1, cupQuality: 1, queueAway: 0, milkAway: 0.2 });
  ok(dry < lined && lined < fresh, `milk-outs hurt more than the queue, ${dry} < ${lined} < ${fresh}`);

  const sticky = blendSatisfaction(80, fresh);
  ok(close(sticky, 80 * SAT_KEEP + fresh * SAT_TODAY), `blend keeps ${SAT_KEEP} of yesterday, got ${sticky}`);
  ok(sticky > 62 && sticky < 100, 'a good day does not forget yesterday or slam the rail');

  const queueDay = new Demand();
  const milkDay = new Demand();
  const q = queueDay.resolveDay({
    served: 80, reputation: 90, eventTier: 'calm',
    priceLevel: 1, cupQuality: 1, queueBalks: 20, milkBalks: 0, attracted: 100,
  });
  const m = milkDay.resolveDay({
    served: 80, reputation: 90, eventTier: 'calm',
    priceLevel: 1, cupQuality: 1, queueBalks: 0, milkBalks: 20, attracted: 100,
  });
  ok(m.satisfaction < q.satisfaction, `cafe satisfaction distinguishes the walkouts, milk ${m.satisfaction} queue ${q.satisfaction}`);
  ok(close(m.returnRate, Demand.returnRateFor(m.satisfaction)), 'tomorrow’s return rate reads satisfaction');
  ok(m.returnRate < Demand.returnRateFor(90), 'a sour room does not return at the reputation rate');
  ok(m.returnees === Math.round(80 * m.returnRate), 'returnees use that rate');

  const legacy = new Demand();
  const t = legacy.resolveDay({ served: 200, reputation: 62, eventTier: 'calm' });
  ok(t.returnees === Math.round(200 * CAMPAIGN.demand.returnBase), 'callers without the mix still use reputation');
  ok(legacy.satisfaction === 62, 'satisfaction stays neutral until a mix is passed');

  const reg = new Regulars();
  const person = reg.regulars[0];
  const op = person.op;
  reg.noteWalkout(person.i, { day: 2, outcome: 'balked' });
  ok(close(person.op, op + WALKOUT_OP.balked), 'the per-person grudge is unchanged');
  ok(WALKOUT_OP.defected === -0.12 && WALKOUT_OP.balked === -0.08, 'grudge table is the old one');
}

// ----------------------------------------------------------------
// Wiring: live sim, no new meter, still one patron per spawn
// ----------------------------------------------------------------
{
  const main = read('web/js/main.js');
  const patrons = read('web/js/patrons.js');
  const vitals = read('web/js/vitals.js');
  const html = read('web/index.html');
  ok(main.includes('for (let i = 0; i < n; i++) patrons.spawn(s.c, s.z, speed > 60)'), 'waves still spawn one patron at a time');
  ok(main.includes('elasticity * reach'), 'the wave multiplier includes elasticity and reach');
  ok(patrons.includes('reach: this.reach ?? 1, cupQuality: this.cupQuality ?? 1'), 'the split reads reach and cup quality');
  ok(main.includes('milkBalks: milkBalked'), 'close passes milk balks apart from the queue');
  ok(main.includes('applyDawnShock()'), 'the merged hit runs at commit');
  const shockFn = main.slice(main.indexOf('function applyDawnShock'), main.indexOf('function stageShockCounter'));
  ok(shockFn.includes('shockOnDay(day)'), 'machine and inspector ride the same dawn call as the oat milk');
  ok(shockFn.includes('ctx.milkStock = applyInventory'), 'milk is rewritten from the merge');
  ok(shockFn.includes('patrons.capacityMult = knobs.capacityMult'), 'capacity lands on its own knob');
  ok(!/baristaCondition\s*=/.test(shockFn), 'the shock does not write Ruth’s condition');
  const snap = main.slice(main.indexOf('function vitalsSnapshot'), main.indexOf('function updateVitals'));
  ok(!snap.includes('satisfaction'), 'the vitals panel does not grow a satisfaction meter');
  ok(!vitals.includes('satisfaction'), 'vitals has no satisfaction row');
  ok(!html.includes('scenario-') && !html.includes('share-bar'), 'no scenario buttons or share bar');
  ok(read('web/js/decision.js').includes("exactKeys(plan, ['hedge', 'staffing', 'marketing'])"), 'the plan shape is unchanged');
}

if (fails.length) {
  console.error('\nFAIL:\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('PASS — shock merge, street reach, sticky satisfaction');
