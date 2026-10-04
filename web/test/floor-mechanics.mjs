// Five floor mechanics, numbers only:
//   1. Anyone in line can walk. Patience follows prep cost.
//      Unbatched matcha stays the least patient.
//   2. One dawn pastry case. Retail service decrements it.
//      Leftovers compost at close the way a matcha batch does.
//   3. A preferred drink that is on the board is the order.
//      An 86'd usual is the existing walk-out, not a substitute.
//   4. A full room adds high-dwell cohorts to the rival-choice roll.
//   5. A long Glasshouse wait walks a share back. Their speed prevents it.
//
// Run: node web/test/floor-mechanics.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ECON } from '../js/config.js';
import { balkLimit, balkChanceFor, preferredOnBoard, pastryPar, PASTRY } from '../js/menu.js';
import { ATTACH_ITEMS } from '../js/behavioral.js';
import { rivalChoiceProbability, rivalWalkbackChance, FULL_ROOM_PULL } from '../js/rival.js';
import { PatronSystem } from '../js/patrons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const scene = { add() {} };
const exchange = { matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 1.3, spotCost: 1.3, hedged: false }) };
const noSeats = { seats: [] };
const fullRoom = { seats: Array.from({ length: 9 }, () => ({ taken: { idx: 1 } })) };
const oneFree = { seats: Array.from({ length: 9 }, () => ({ taken: { idx: 1 } })) };
oneFree.seats[4].taken = null;

function sys(world, random, regulars = null) {
  return new PatronSystem(scene, world, regulars, exchange, null, { random });
}
function named(drink) {
  return {
    reputation: 50,
    regulars: [{ friends: [], events: [] }],
    markSeen: () => ({ found: true, idx: 0, name: 'Regular', coh: 'commuters', visits: 6, stage: 'regular', drink }),
    unsee() {},
  };
}
const ctxBase = () => ({ batchUnits: 0, batchReservedUntil: 0, milkStock: 50, milky: 0, milkOut: false, menuPrices: null, repriced: false });

// ----------------------------------------------------------------
// 1. Patience follows prep
// ----------------------------------------------------------------
{
  ok(close(balkLimit('matcha', false), ECON.balkAfter), `unbatched matcha limit ${balkLimit('matcha', false)}`);
  ok(close(balkChanceFor('matcha', false), ECON.balkChance), `unbatched matcha chance ${balkChanceFor('matcha', false)}`);
  ok(balkLimit('espresso') > balkLimit('flatwhite'), 'espresso waits longer than a flat white');
  ok(balkLimit('flatwhite') > balkLimit('filter'), 'flat white waits longer than filter');
  ok(balkLimit('filter') > balkLimit('matcha', false), 'filter waits longer than unbatched matcha');
  ok(close(balkLimit('matcha', true), balkLimit('espresso')), 'batched matcha is as patient as an espresso');
  ok(balkChanceFor('espresso') < balkChanceFor('filter'), 'cheaper prep walks less often');
  ok(balkChanceFor('filter') < balkChanceFor('matcha', false), 'unbatched matcha walks most often');
  ok(close(balkChanceFor('matcha', false, { repriced: true }), ECON.balkChance * 0.25), 'a deal still buys patience');

  const hold = Math.random;
  const queue = (drink, wait, extra = {}) => {
    const s = sys(noSeats, () => 0.99);
    s.capacityMult = 0;
    const p = s.spawn('commuters', 'counter', true);
    p.drink = drink; p.wantsMatcha = drink === 'matcha'; p.state = 'inQueue'; p.waitMin = wait;
    s.counterQ = [p];
    return s.tick(900, { ...ctxBase(), ...extra }).some(e => e.type === 'balked' && e.p === p);
  };
  Math.random = () => 0.02;
  ok(queue('matcha', ECON.balkAfter) === true, 'unbatched matcha still walks just past the old gate');
  ok(queue('espresso', ECON.balkAfter) === false, 'an espresso does not walk at the matcha gate');
  ok(queue('espresso', balkLimit('espresso')) === true, 'an espresso walks once its own prep limit is past');
  ok(queue('flatwhite', balkLimit('flatwhite')) === true, 'a flat white walks on its prep limit');
  ok(queue('filter', balkLimit('filter')) === true, 'a filter walks on its prep limit');
  ok(queue('matcha', balkLimit('matcha', true) - 1, { batchUnits: 8, batchReservedUntil: 0 }) === false, 'a live batch keeps matcha patient');
  ok(queue('matcha', balkLimit('matcha', true), { batchUnits: 8, batchReservedUntil: 0 }) === true, 'a live batch is patient, not immortal');
  Math.random = () => 0.2;
  ok(queue('matcha', 40) === false, 'a roll above the matcha chance stays');
  ok(queue('espresso', 40) === false, 'the same roll is under an espresso chance too — espresso walks less often');
  Math.random = hold;
}
console.log('PATIENCE  prep-weighted walk-outs verified');

// ----------------------------------------------------------------
// 2. One pastry case
// ----------------------------------------------------------------
{
  const waves = [{ spawns: [{ z: 'counter', q: 100 }, { z: 'retail', q: 40 }, { z: 'retail', q: 40 }] }];
  ok(pastryPar(waves, 0.3, 1) === 12, `first dawn is half the scaled retail sheet, got ${pastryPar(waves, 0.3, 1)}`);
  ok(pastryPar(waves, 0.3, 1, 20) === 22, `yesterday's register sizes the next case, got ${pastryPar(waves, 0.3, 1, 20)}`);
  ok(pastryPar([{ spawns: [{ z: 'counter', q: 500 }] }], 0.3, 1) === 4, 'a day with no retail still holds a tray');
  ok(PASTRY === ATTACH_ITEMS.croissant && PASTRY.price === 2.80 && PASTRY.cogs === 0.70, 'the one bake is the croissant');

  const s = sys(noSeats, () => 0.99);
  const calls = { n: 0 };
  s.exchange = { matchaPrice: 4.80, day: 1, purchaseCup() { calls.n++; return { beanCost: 1.3, spotCost: 1.3, hedged: false }; } };
  const mk = () => {
    const p = s.spawn('tourists', 'retail', true);
    p.state = 'inRegisterQ'; p.waitMin = 1; p.queueRef = 'register';
    return p;
  };
  const a = mk(); const b = mk(); const c = mk();
  s.counterQ = []; s.registerQ = [a];
  const hold = Math.random; Math.random = () => 0.5;
  const stock = { pastryStock: 2, milkStock: 20 };
  const ev1 = s.tick(700, stock);
  const sold = ev1.find(e => e.type === 'served' && e.p === a);
  ok(!!sold && sold.pastry === true && close(sold.price, 2.80) && sold.beanCost === 0, `retail serve should be the pastry, ${JSON.stringify(sold && { price: sold.price, pastry: sold.pastry, bean: sold.beanCost })}`);
  ok(stock.pastryStock === 1 && calls.n === 0, `case should decrement without a bean pull, stock=${stock.pastryStock} cups=${calls.n}`);
  s.registerQ = [b];
  s.tick(701, stock);
  ok(stock.pastryStock === 0, `second serve empties the case, stock=${stock.pastryStock}`);
  s.registerQ = [c];
  const ev3 = s.tick(702, stock);
  ok(ev3.some(e => e.type === 'balked' && e.p === c && e.pastry) && !ev3.some(e => e.type === 'served' && e.p === c), 'an empty case walks them out');
  ok(stock.pastryStock === 0 && calls.n === 0, 'an empty case does not pour a drink');
  Math.random = hold;

  const bare = sys(noSeats, () => 0.99);
  let cups = 0;
  bare.exchange = { matchaPrice: 4.80, day: 1, purchaseCup() { cups++; return { beanCost: 0, spotCost: 0, hedged: false }; } };
  const d = bare.spawn('tourists', 'retail', true);
  d.state = 'inRegisterQ'; d.waitMin = 1;
  bare.counterQ = []; bare.registerQ = [d];
  const evD = bare.tick(700, { milkStock: 20 });
  ok(cups === 1 && evD.some(e => e.type === 'served' && !e.pastry), 'no case keeps the old drink ticket');
}
console.log('PASTRY    one case, decrement, empty walk-out verified');

// ----------------------------------------------------------------
// 3. Preferred drink, or the board turnaway
// ----------------------------------------------------------------
{
  ok(preferredOnBoard('flat white', null).drink === 'flatwhite', 'flat white is on the board');
  ok(preferredOnBoard('single-origin', null).drink === null && preferredOnBoard('tea', { filter: false }).turnedAway === false, 'off-menu usuals are not an 86');
  ok(preferredOnBoard('filter', { filter: false }).turnedAway === true, 'an 86d filter turns away');
  ok(preferredOnBoard('matcha', { matcha: false }).drink === 'matcha', 'matcha cannot be 86d');

  const mara = sys(noSeats, () => 0.99, named('flat white'));
  const mp = mara.spawn('commuters', 'counter', true);
  ok(mp && mp.drink === 'flatwhite' && mp.preferredDrink === 'flat white' && !mp.boardTurnaway && mara.counterQ.includes(mp),
    `usual on the board should be the order, drink=${mp && mp.drink}`);

  const yuki = sys(noSeats, () => 0.99, named('single-origin'));
  const yp = yuki.spawn('creatives', 'counter', true);
  ok(yp && yp.preferredDrink === 'single-origin' && ['espresso', 'flatwhite', 'filter', 'matcha'].includes(yp.drink) && yuki.counterQ.includes(yp),
    `off-menu usual keeps a board roll, drink=${yp && yp.drink}`);

  const olu = sys(noSeats, () => 0.99, named('filter'));
  olu.menuOffered = { filter: false };
  const op = olu.spawn('elders', 'counter', true);
  ok(op && op.boardTurnaway === true && op.drink !== 'filter' && !olu.counterQ.includes(op) && olu.turnaways.includes(op),
    `86d usual should not join and should not carry the 86d drink, drink=${op && op.drink}`);
  const hold = Math.random; Math.random = () => 0.99;
  const ev = olu.tick(600, ctxBase());
  Math.random = hold;
  ok(ev.some(e => e.type === 'balked' && e.board && e.p === op) && !ev.some(e => e.type === 'served'),
    `86d usual should be the existing walk-out, events=${ev.map(e => e.type).join(',')}`);
}
console.log('REGULAR   preferred order and board turnaway verified');

// ----------------------------------------------------------------
// 4. Full room adds campers to the rival roll
// ----------------------------------------------------------------
{
  const plain = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'creatives', ourPrice: 4.80 });
  const camp = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'creatives', ourPrice: 4.80, campPull: FULL_ROOM_PULL });
  ok(plain < 0.2 && camp > 0.2 && camp <= 0.6, `camp pull should cross 0.2, plain=${plain} camp=${camp}`);

  const cross = (world, cohort, dwell = 1) => {
    const s = sys(world, () => 0.2);
    s.dwellMul = dwell;
    s.spawn(cohort, 'counter', true);
    return s.rivalChoices;
  };
  ok(cross(fullRoom, 'creatives') === 1, 'a creative leaves a full room');
  ok(cross(fullRoom, 'elders') === 1, 'an elder leaves a full room');
  ok(cross(fullRoom, 'students') === 0, 'a student still queues in a full room');
  ok(cross(fullRoom, 'commuters') === 0, 'a commuter still queues in a full room');
  ok(cross(oneFree, 'creatives') === 0, 'one free seat is not a full room');
  ok(cross(noSeats, 'creatives') === 0, 'a headless world with no seats is not full');
  ok(cross(fullRoom, 'students', 1.3) === 1, 'a transit dwell bonus makes a student camp');
  ok(cross({ seats: [] }, 'tourists') === 0 && cross(noSeats, 'elders') === 0, 'empty seats do not divert elders');
}
console.log('ROOM      full-room camp pull verified');

// ----------------------------------------------------------------
// 5. Glasshouse can fail
// ----------------------------------------------------------------
{
  ok(rivalWalkbackChance(16, 1) === 0, 'the floor holds');
  ok(rivalWalkbackChance(21, 1) > 0, 'a slow bar past the floor leaks');
  ok(rivalWalkbackChance(21, 1.4) === 0, 'the same clock under express speed holds');

  const park = (strategy, wait, n = 4) => {
    const s = sys(noSeats, () => 0.99);
    s.rivalStrategy = strategy;
    for (let i = 0; i < n; i++) {
      const p = s.spawn('commuters', 'counter', true);
      p.state = 'inRivalQ'; p.waitMin = wait; p.queueRef = 'rival';
    }
    s.counterQ = [];
    s.rivalQ = s.patrons.filter(p => p.state === 'inRivalQ');
    return s;
  };
  const hold = Math.random; Math.random = () => 0;
  const slow = park('DEFAULT', 20);
  const evS = slow.tick(800, ctxBase());
  const fast = park('EFFICIENCY_RUSH', 20);
  const evF = fast.tick(800, ctxBase());
  Math.random = hold;
  const back = (ev) => ev.filter(e => e.type === 'rivalWalkback').length;
  ok(back(evS) === 4 && slow.counterQ.length === 4 && slow.rivalQ.length === 0, `a long default line should walk back, back=${back(evS)} q=${slow.rivalQ.length}`);
  ok(back(evF) === 0 && fast.rivalQ.length === 4 && evF.filter(e => e.type === 'rivalServed').length === 0, `express speed should still be holding them, back=${back(evF)}`);
  ok(evS.every(e => e.type !== 'rivalWalkback' || e.p.queueRef === 'counter'), 'walk-backs join our queue');

  const probe = (strategy) => {
    const s = park(strategy, 0, 8);
    let served = 0, backs = 0;
    for (let t = 0; t < 10; t++) {
      const ev = s.tick(500, ctxBase());
      served += ev.filter(e => e.type === 'rivalServed').length;
      backs += ev.filter(e => e.type === 'rivalWalkback').length;
    }
    return { served, backs };
  };
  const d = probe('DEFAULT');
  const x = probe('EFFICIENCY_RUSH');
  ok(d.served === 5 && d.backs === 0, `short default service stays 5, got ${d.served} backs ${d.backs}`);
  ok(x.served === 7 && x.backs === 0, `short express service stays 7, got ${x.served} backs ${x.backs}`);
}
console.log('RIVAL     walk-back vs speed verified');

// ----------------------------------------------------------------
// Wiring: data paths only
// ----------------------------------------------------------------
{
  const patrons = read('web/js/patrons.js');
  const main = read('web/js/main.js');
  const vitals = read('web/js/vitals.js');
  const html = read('web/index.html');
  ok(patrons.includes('rollDrink(cohort, this.menuOffered, this.random'), 'orders still roll first');
  ok(patrons.includes('preferredDrink: null'), 'the patron literal still starts without a usual');
  ok(!patrons.includes('wantsMatcha && !hasBatch'), 'the walk-out is no longer matcha-only');
  ok(patrons.includes('balkLimit(') && patrons.includes('balkChanceFor('), 'the walk-out reads prep');
  ok(main.includes('pastryPar(') && main.includes('till -= pastryWasteCost') && !main.includes('till -= pastrySpend'), 'close charges the unsold case, dawn does not prepay it');
  ok(main.includes('if (e.pastry)') && main.includes('PASTRY.cogs'), 'a sold croissant pays the same wholesale at the register');
  ok(main.includes('pastryWaste = Math.max(0, ctx.pastryStock | 0)'), 'leftovers are counted at close');
  ok(main.includes('pastryWaste, compost'), 'the day row carries the compost count');
  ok(!main.includes('calculateTip') && !main.includes('rollBasketAttachment') && !main.includes('DECOY_MENU'), 'the tip jar and the decoy menu stay off the floor');
  ok((main.match(/unsold croissants/g) || []).length === 2, 'both day results name the unsold close charge');
  ok(!/pastry|croissant|seat-map|rival menu/i.test(vitals), 'vitals gains no meter');
  ok(!html.includes('id="pastry"') && !html.includes('seat-map'), 'no pastry widget and no seat map');
  ok(/revenue', fmt\(till \+ batchSpend\)/.test(main), 'receipt revenue stays gross of the matcha batch only');
}
console.log('WIRING    pastry, patience, and the untouched panels verified');

if (fails.length) {
  console.error('\nFAIL\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('\nPASS — floor mechanics');
