// Five rules that reach the next dawn. Numbers only:
//   1. The ±£1 band shifts what a cohort rolls. The street comparison
//      uses the drink that person wanted. An 86 still removes a drink.
//   2. The broken machine and the inspector sit on the calendar and the
//      day loop calls them. A counter buys back most of the hit. The
//      cheap milk fill leaves a hole.
//   3. Pastry waste is already out of the till, the way leftover matcha
//      is, and a staged cut shrinks tomorrow's case. A walk-out who
//      crosses keeps the defect grudge. The busy-day bonus diminishes
//      past 60. A held week needs reputation.
//   4. The room is judged when someone would join the queue. Glasshouse
//      walk-back stays felt wait, on people already in that line.
//   5. The return cap sits above 35%, and a strong stock can use it.
//      A strong day unlocks Ruth's rest for the next morning. A starred
//      week sends a fuller van on the next day 1.
//
// Run: node web/test/next-dawn.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CAMPAIGN } from '../js/config.js';
import { DRINKS, basePrices, rollDrink, orderWeight, pastryPar, PASTRY, starredDelivery } from '../js/menu.js';
import { resolveShock, shockOnDay, COUNTERABLE } from '../js/shocks.js';
import { campaignVerdict } from '../js/economy.js';
import { Regulars, busyHappy } from '../js/regulars.js';
import { WALKOUT_OP } from '../js/consequences.js';
import { Demand } from '../js/demand.js';
import { earnedRestDay, canChooseStaffing } from '../js/staffing.js';
import { rivalChoiceProbability, rivalWalkbackChance } from '../js/rival.js';
import { PatronSystem } from '../js/patrons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const scene = { add() {} };
const exchange = { matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 0, spotCost: 0, hedged: false }) };
function sys(world, random, regulars = null) {
  return new PatronSystem(scene, world, regulars, exchange, null, { random });
}
const fullRoom = { seats: Array.from({ length: 9 }, () => ({ taken: { idx: 1 } })) };

function countDrink(cohort, prices, drink, offered = null, n = 400) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (rollDrink(cohort, offered, () => (i + 0.5) / n, prices) === drink) k++;
  }
  return k;
}

// ----------------------------------------------------------------
// 1. Price changes the order, and the street prices that order
// ----------------------------------------------------------------
{
  const base = basePrices();
  ok(close(orderWeight('matcha', 5, null), 5), 'no menu leaves the weight alone');
  ok(close(orderWeight('matcha', 5, base), 5), 'a posted base does not tilt the weight');
  ok(orderWeight('matcha', 5, { ...base, matcha: base.matcha + 1 }) < 5, 'a dear cup weighs less');
  ok(orderWeight('espresso', 5, { ...base, espresso: base.espresso - 1 }) > 5, 'a cheap cup weighs more');

  const posted = countDrink('students', null, 'matcha');
  const same = countDrink('students', base, 'matcha');
  const dear = countDrink('students', { ...base, matcha: DRINKS.matcha.base + 1 }, 'matcha');
  const cheapEsp = countDrink('commuters', { ...base, espresso: DRINKS.espresso.base - 1 }, 'espresso');
  const plainEsp = countDrink('commuters', base, 'espresso');
  ok(posted === same, `base prices reproduce the old roll, ${posted} vs ${same}`);
  ok(dear < posted, `a +£1 matcha shifts students off it, ${dear} < ${posted}`);
  ok(cheapEsp > plainEsp, `a −£1 espresso pulls commuters toward it, ${cheapEsp} > ${plainEsp}`);

  const bargain = { ...base, filter: DRINKS.filter.base - 1 };
  ok(countDrink('elders', bargain, 'filter', { filter: false }) === 0, 'an 86 still removes the drink, even cheap');

  const matchaPr = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'commuters', ourPrice: 4.80 });
  const flatPr = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'commuters', ourPrice: DRINKS.flatwhite.base });
  ok(matchaPr > 0.10 && flatPr < 0.10, `flat white is a different street from matcha, ${flatPr} vs ${matchaPr}`);
  const hold = Math.random;
  Math.random = () => 0;
  const mara = sys({ seats: [] }, () => 0.10, new Regulars());
  const mp = mara.spawn('commuters', 'counter', true);
  Math.random = hold;
  ok(mp && mp.drink === 'flatwhite' && mara.rivalChoices === 0 && mara.counterQ.includes(mp),
    `Mara is priced at the flat white she wanted, choices=${mara.rivalChoices} drink=${mp && mp.drink}`);
}
console.log('PRICE     band, usual, and 86 verified');

// ----------------------------------------------------------------
// 2. Calendar shocks, partial counters, a hole in the milk fill
// ----------------------------------------------------------------
{
  ok(shockOnDay(1) == null, 'day 1 is not a shock dawn');
  ok(shockOnDay(COUNTERABLE.dairy_crunch.day) === 'dairy_crunch', 'oat milk still has its day');
  ok(shockOnDay(2) === 'machine_breaks' && COUNTERABLE.machine_breaks.day === 2, 'the machine breaks on a calendar day');
  ok(shockOnDay(5) === 'health_inspector' && COUNTERABLE.health_inspector.day === 5, 'the inspector has a calendar day');

  const bare = resolveShock('dairy_crunch', null);
  const bought = resolveShock('dairy_crunch', 'replace');
  const shrunk = resolveShock('dairy_crunch', 'shrink');
  ok(bought.inventory < shrunk.inventory && bought.inventory > bare.inventory && -bought.inventory > -bare.inventory / 2,
    `the £36 fill leaves most of the hole, bought ${bought.inventory} shrink ${shrunk.inventory}`);

  const broken = resolveShock('machine_breaks', null);
  const repaired = resolveShock('machine_breaks', 'repair');
  ok(broken.capacityMult < 1 && repaired.capacityMult < 1 && repaired.capacityMult > broken.capacityMult,
    `repair buys back most of the bar, ${broken.capacityMult} → ${repaired.capacityMult}`);

  const cited = resolveShock('health_inspector', null);
  const cleaned = resolveShock('health_inspector', 'clean');
  const tidied = resolveShock('health_inspector', 'tidy');
  ok(cited.rep < tidied.rep && tidied.rep < cleaned.rep && cleaned.rep < 0,
    `clean buys back most of the citation, ${cited.rep} / ${tidied.rep} / ${cleaned.rep}`);
}
console.log('SHOCKS    calendar and partial counters verified');

// ----------------------------------------------------------------
// 3. Waste, the defect grudge, the busy bonus, a held week
// ----------------------------------------------------------------
{
  const waves = [{ spawns: [{ z: 'counter', q: 100 }, { z: 'retail', q: 80 }] }];
  const par = pastryPar(waves, 0.3, 1);
  ok(par === 12, `uncut par stays half the sheet, got ${par}`);
  ok(pastryPar(waves, 0.3, 1, 0, 0.5) === 6, `a staged half cut halves the case, got ${pastryPar(waves, 0.3, 1, 0, 0.5)}`);
  ok(pastryPar(waves, 0.3, 1, 20, 1) === 0, 'a full cut orders nothing tomorrow');
  const waste = 4;
  const caseCost = Math.round(par * PASTRY.cogs * 100) / 100;
  const wasteCost = Math.round(waste * PASTRY.cogs * 100) / 100;
  const soldCost = Math.round((par - waste) * PASTRY.cogs * 100) / 100;
  ok(wasteCost === 2.8, `the close charge is unsold croissants × £0.70, got ${wasteCost}`);
  ok(close(caseCost, soldCost + wasteCost) && wasteCost < caseCost, 'sold wholesale and the close charge add up to the case once');

  const reg = new Regulars();
  reg.friendships = new Map();
  const person = reg.regulars[0];
  const op = person.op;
  ok(reg.noteWalkout(person.i, { day: 3, outcome: 'balked' }), 'a first balk lands');
  ok(close(person.op, op + WALKOUT_OP.balked), 'the balk grudge is the old one');
  ok(reg.noteWalkout(person.i, { day: 3, outcome: 'balked' }) === false, 'a second balk the same day does not count');
  ok(close(person.op, op + WALKOUT_OP.balked), 'the second balk did not move opinion');
  ok(reg.noteWalkout(person.i, { day: 3, outcome: 'defected' }), 'the crossing still lands');
  ok(close(person.op, op + WALKOUT_OP.defected), `the defect grudge replaces the balk, op ${person.op}`);
  ok(person.events[person.events.length - 1].outcome === 'defected', 'the event follows them across');

  ok(close(busyHappy(0), 0) && close(busyHappy(30), 0.5) && close(busyHappy(60), 1), 'the bonus matches the old line through 60');
  const perCup = (a, b) => (busyHappy(b) - busyHappy(a)) / (b - a);
  ok(busyHappy(120) > 1 && perCup(60, 120) > perCup(120, 400), 'past 60 the bonus grows, and each cup adds less');
  const bump = (served) => {
    const room = new Regulars();
    room.friendships = new Map();
    for (const r of room.regulars) r.seen = false;
    const who = room.regulars[0];
    who.seen = true;
    const before = who.op;
    room.resolveDay({ served, balked: 0, defections: 0, priced: false });
    return who.op - before;
  };
  ok(bump(120) > bump(60) && close(bump(60), 0.05), `120 cups still outranks a full 60, 60→${bump(60)} 120→${bump(120)}`);

  ok(campaignVerdict(5000, 50) === 'held', 'cash and reputation hold the week');
  ok(campaignVerdict(5000, 49) === 'scarped', 'cash without reputation is not a held week');
  ok(campaignVerdict(9000, 70) === 'star' && campaignVerdict(6000, 60) === 'good', 'star and good keep their bars');
  ok(campaignVerdict(100, 80) === 'scarped' && campaignVerdict(-1, 90) === 'lost', 'scraped and lost stay on the cash');
}
console.log('DAWN      waste, grudge, bonus, and the held bar verified');

// ----------------------------------------------------------------
// 4. The room is judged at the queue, not at spawn
// ----------------------------------------------------------------
{
  const slow = sys(fullRoom, () => 0.2);
  const walker = slow.spawn('creatives', 'counter', false);
  ok(walker && walker.state === 'walkingIn' && slow.rivalChoices === 0 && slow.counterQ.includes(walker),
    'a full room does not divert someone who is still on the pavement');
  slow._onArrive(walker);
  ok(slow.rivalChoices === 1 && !slow.counterQ.includes(walker) && walker.rivalOrigin === 'camp',
    'the door is where a camper leaves a full room');

  const quick = sys(fullRoom, () => 0.2);
  quick.spawn('creatives', 'counter', true);
  ok(quick.rivalChoices === 1, 'a quick join is the join, so the room is judged then');

  const student = sys(fullRoom, () => 0.2);
  student.spawn('students', 'counter', true);
  ok(student.rivalChoices === 0, 'a low-dwell cohort still queues in a full room');

  const empty = sys({ seats: [] }, () => 0.2);
  const q = empty.spawn('elders', 'counter', false);
  empty._onArrive(q);
  ok(empty.rivalChoices === 0 && q.state === 'toQueue', 'no seats is not a full room, even at the door');

  ok(rivalWalkbackChance(16, 1) === 0, 'walk-back still holds at the felt floor');
  ok(rivalWalkbackChance(21, 1) > 0 && rivalWalkbackChance(21, 1.4) === 0, 'walk-back is still felt wait, and speed still prevents it');
}
console.log('ROOM      join-time camp pull, walk-back unchanged');

// ----------------------------------------------------------------
// 5. A good week changes the next morning
// ----------------------------------------------------------------
{
  const D = CAMPAIGN.demand;
  ok(D.returnMax > 0.35, `return cap is above 35%, got ${D.returnMax}`);
  ok(close(Demand.returnRateFor(80), D.returnBase + (80 - 62) * D.returnPerRep), 'the old slope holds through a decent week');
  ok(Demand.returnRateFor(100) > 0.35 && Demand.returnRateFor(100) < D.returnMax, `a strong stock clears the old cap, got ${Demand.returnRateFor(100)}`);
  ok(Demand.returnRateFor(200) === D.returnMax, 'the new cap is the ceiling');
  const room = new Regulars();
  ok(close(room.returnRate, Demand.returnRateFor(room.reputation)), 'the two return doors still share one number');

  ok(earnedRestDay(2, { reputation: 60, campaignDays: 5 }) === 3, 'a loved day unlocks the next morning');
  ok(earnedRestDay(1, { served: 120, balked: 4, campaignDays: 5 }) === 2, 'a quiet day 1 unlocks day 2, not day 5');
  ok(earnedRestDay(5, { reputation: 90, served: 200, campaignDays: 5 }) === 0, 'the last close has no morning left in the week');
  ok(earnedRestDay(2, { served: 40, balked: 20, reputation: 40, campaignDays: 5 }) === 0, 'a rough day does not earn the rest');
  ok(canChooseStaffing(4, 0.9) === false, 'being fine still does not open the tiredness door');

  ok(starredDelivery(250, false) === 250, 'an ordinary week gets the ordinary van');
  ok(starredDelivery(250, true) === 300, 'a starred week adds a fifth to day 1 milk');
  ok(starredDelivery(333, true) === 400, 'the fuller van still rounds to the milk step');
}
console.log('UPSIDE    return cap, Ruth’s rest, starred van verified');

// ----------------------------------------------------------------
// Wiring
// ----------------------------------------------------------------
{
  const main = read('web/js/main.js');
  const patrons = read('web/js/patrons.js');
  const regulars = read('web/js/regulars.js');
  const shockFn = main.slice(main.indexOf('function applyDawnShock'), main.indexOf('function stageShockCounter'));
  const spawn = patrons.slice(patrons.indexOf('spawn(cohort'), patrons.indexOf('_slotPos(slotFn'));
  ok(spawn.includes('rollDrink(cohort, this.menuOffered, this.random'), 'orders still roll first');
  ok(spawn.includes('_priceOf(wanted)'), 'the street prices the drink they wanted');
  ok(!spawn.includes('campPull'), 'spawn does not judge the room');
  ok(patrons.includes("_campDivert(p)") && patrons.includes("case 'walkingIn'"), 'the door judges the room');
  ok(patrons.includes('rivalWalkbackChance'), 'walk-back still runs on the rival line');
  ok(shockFn.includes('shockOnDay(day)'), 'the day loop calls whichever shock the calendar names');
  ok(main.includes('pastryPar(') && main.includes('pastryCut') && main.includes('stagePastryCut'), 'a cut reaches tomorrow’s case');
  ok(main.includes('brief-pastry-half') && main.includes('share: 0.5') && main.includes('stagePastryCut(def.share)') && main.includes('renderPastryCut(wrap)'), 'the dawn brief stages tomorrow’s case');
  ok(!read('web/index.html').includes('id="brief-pastry"'), 'the case cut is not a new panel');
  ok(main.includes('till -= pastryWasteCost') && !main.includes('till -= pastrySpend'), 'close bills the unsold case, and dawn does not prepay it');
  ok(main.includes('unsold croissants'), 'the day’s result names that close charge');
  ok(regulars.includes('busyHappy(served)'), 'the busy bonus reads the diminishing curve');
  ok(main.includes('earnedRestDay(') && main.includes('ruthRestOffer'), 'a strong day unlocks the existing rest');
  ok(main.includes('starredDelivery') && main.includes("starCarry = verdictId === 'star'"), 'a star changes the next day 1');
  const reset = main.slice(main.indexOf('function reset'), main.indexOf('function beginWeek'));
  ok(!reset.includes('starCarry = false'), 'reset does not wipe the star before day 1 spends it');
  ok(!main.includes('id="pastry"') && !read('web/js/vitals.js').includes('pastry'), 'no new meter');
}
console.log('WIRING    next-dawn hooks verified');

if (fails.length) {
  console.error('\nFAIL\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('\nPASS — next dawn');
