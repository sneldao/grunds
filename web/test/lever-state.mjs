import { ECON } from '../js/config.js';
import { DRINKS, DRINK_IDS } from '../js/menu.js';
import { leverState, computeNextAction } from '../js/nextAction.js';
import { PatronSystem } from '../js/patrons.js';
import { Regulars } from '../js/regulars.js';
import { WalkinPool } from '../js/identity.js';

const fails = [];
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else fails.push(`${name}: ${detail || 'failed'}`);
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

const S = (over) => ({ phase: 'trading', closed: false, ...over });

{
  const lv = leverState(S({ dayMin: 600 }));
  check('hold morning: batch available at £40, no override',
    lv.batch.available && near(lv.batch.cost, ECON.batchCost) && !lv.batch.changesPlan, JSON.stringify(lv.batch));
  check('hold morning: reprice available, free', lv.reprice.available && lv.reprice.cost === 0, JSON.stringify(lv.reprice));
}
{
  const lv = leverState(S({ dayMin: 800, leversTimeLocked: true }));
  check('late switch batch: £40 + £4.20 disclosed',
    lv.batch.available && lv.batch.changesPlan && near(lv.batch.cost, ECON.batchCost + 4.2), JSON.stringify(lv.batch));
  check('late switch reprice: £4.20 disclosed',
    lv.reprice.available && lv.reprice.changesPlan && near(lv.reprice.cost, 4.2), JSON.stringify(lv.reprice));
}
{
  const lv = leverState(S({ dayMin: 700, leversTimeLocked: true }));
  check('pre-noon committed press is not a late switch', lv.batch.available && !lv.batch.changesPlan, JSON.stringify(lv.batch));
}
{
  const lv = leverState(S({ dayMin: 700, prebatched: true, batchUnits: 40, leversTimeLocked: true }));
  check('reserved cups block a second press before 14:00',
    !lv.batch.available && /reserved/.test(lv.batch.reason), JSON.stringify(lv.batch));
  check('reserved cups lock the reprice', !lv.reprice.available && /locks the price/.test(lv.reprice.reason), JSON.stringify(lv.reprice));
}
{
  const lv = leverState(S({ dayMin: 900, prebatched: true, batchUnits: 5, leversTimeLocked: true }));
  check('wave top-up available at £40 only',
    lv.batch.available && near(lv.batch.cost, ECON.batchCost) && !lv.batch.changesPlan, JSON.stringify(lv.batch));
}
{
  const lv = leverState(S({ dayMin: 900, prebatched: true, batchUnits: 0, leversTimeLocked: true }));
  check('empty-batch replenish stays £40, no override',
    lv.batch.available && near(lv.batch.cost, ECON.batchCost) && !lv.batch.changesPlan, JSON.stringify(lv.batch));
}
{
  const lv = leverState(S({ dayMin: 900, prebatched: true, batchUnits: 20, leversTimeLocked: true }));
  check('healthy batch refuses a wave press', !lv.batch.available && /still ready/.test(lv.batch.reason), JSON.stringify(lv.batch));
}
{
  const lv = leverState(S({ dayMin: 900, repriced: true, leversTimeLocked: true }));
  check('repriced locks batch', !lv.batch.available && /locked/.test(lv.batch.reason), JSON.stringify(lv.batch));
  check('repriced is terminal', !lv.reprice.available, JSON.stringify(lv.reprice));
}
{
  const lv = leverState(S({ dayMin: 970 }));
  check('no prep after 16:00', !lv.batch.available && /too late/.test(lv.batch.reason), JSON.stringify(lv.batch));
  check('no reprice after 16:00', !lv.reprice.available && /too late/.test(lv.reprice.reason), JSON.stringify(lv.reprice));
  const c = leverState(S({ dayMin: 900, closed: true }));
  check('closed day offers nothing', !c.batch.available && !c.reprice.available, JSON.stringify(c));
  const p = leverState(S({ dayMin: 360, phase: 'planning' }));
  check('planning phase offers nothing', !p.batch.available && !p.reprice.available, JSON.stringify(p));
}

{
  const n = computeNextAction({ dayMin: 700, queue: 8, prebatched: true, batchUnits: 40 });
  check('reserved stock outranks queue noise', n.id === 'status' && /reserved/.test(n.text), JSON.stringify(n));
  const low = computeNextAction({ dayMin: 900, queue: 8, prebatched: true, batchUnits: 6 });
  check('low wave stock points at the top-up', low.id === 'batch' && /top up/.test(low.text) && /40\.00/.test(low.text), JSON.stringify(low));
  const deal = computeNextAction({ dayMin: 900, queue: 12, repriced: true });
  check('deal under pressure never offers prep', !/press <b>1<\/b>/.test(deal.text) && /patience/.test(deal.text), JSON.stringify(deal));
  check('deal copy is honest about walks', /lower walk-out risk/.test(deal.text) && !/but staying/.test(deal.text), JSON.stringify(deal));
  const late = computeNextAction({ dayMin: 900, queue: 8, leversTimeLocked: true });
  check('late wave batch discloses £44.20', late.id === 'batch' && /44\.20/.test(late.text), JSON.stringify(late));
  const after16 = computeNextAction({ dayMin: 970, queue: 12, prebatched: true, batchUnits: 0 });
  check('past 16:00 nothing claims reserved cups or press advice', !/reserved for <b>14:00/.test(after16.text) && !/press <b>[12]<\/b>/.test(after16.text), JSON.stringify(after16));
  const plan = computeNextAction({ dayMin: 360, phase: 'planning', queue: 9 });
  check('planning phase never proposes a press', !/press <b>[12]<\/b>/.test(plan.text), JSON.stringify(plan));
  const mail = computeNextAction({ dayMin: 700, mailPending: true, queue: 9 });
  check('mail directive points at the box', mail.id === 'mail' && mail.target === 'mailbox' && /take it from the box/.test(mail.text), JSON.stringify(mail));
  const hot = computeNextAction({ dayMin: 750, queue: 8, leversTimeLocked: true });
  check('hot morning queue never sells the batch as relief',
    !/press <b>1<\/b> to prep/.test(hot.text) && /reserves for|reserves <b>40<\/b>|reserves 40/.test(hot.text) && /<b>2<\/b> cuts/.test(hot.text) && /£4\.20 late switch/.test(hot.text) && /regulars lose warmth/.test(hot.text), JSON.stringify(hot));
  let matrixOk = true, matrixDetail = '';
  for (const t of [700, 750, 900]) for (const q of [0, 2, 8]) {
    const lv = leverState(S({ dayMin: t, queue: q, leversTimeLocked: true }));
    const n = computeNextAction({ dayMin: t, queue: q, leversTimeLocked: true });
    if (!lv.batch.available) { matrixOk = false; matrixDetail = `t=${t} q=${q} unavailable`; break; }
    const want = lv.batch.changesPlan ? '44.20' : '40.00';
    if (!n.text.includes(want)) { matrixOk = false; matrixDetail = `t=${t} q=${q} missing ${want}: ${n.text}`; break; }
    if (lv.batch.changesPlan && !/regulars lose warmth/.test(n.text)) { matrixOk = false; matrixDetail = `t=${t} q=${q} missing opinion warning`; break; }
    if (lv.batch.changesPlan && /\(£40\.00\)/.test(n.text)) { matrixOk = false; matrixDetail = `t=${t} q=${q} still says £40.00`; break; }
  }
  check('every batch mention prices the actual lever cost × queue × time', matrixOk, matrixDetail);
  const hotNoDeal = computeNextAction({ dayMin: 750, queue: 8, prebatched: true, batchUnits: 0, leversTimeLocked: true });
  check('hot queue with no deal available: ride it out, still no press-1 bait',
    !/press <b>1<\/b> to prep/.test(hotNoDeal.text), JSON.stringify(hotNoDeal));
  const postAsk = computeNextAction({ dayMin: 700, queue: 2, offerShown: true });
  check('after 11:00 the guidance points at 14:00, not the ask', /14:00/.test(postAsk.text) && !/11:00/.test(postAsk.text), JSON.stringify(postAsk));
  const eve = computeNextAction({ dayMin: 1100, eveningFast: true });
  check('every halo target is a real spot', ['chalk', 'street', 'mailbox', null].includes(eve.target), JSON.stringify(eve));
}

let seed = 99;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mkScene = () => ({ add() {} });
const mkWorld = () => ({ seats: [] });
const mkExchange = () => ({ matchaPrice: 4.80, day: 1, purchaseCup: () => ({ beanCost: 0, spotCost: 0, hedged: false }) });
const COHORTS_TEST = ['commuters', 'creatives', 'students', 'elders', 'tourists'];

{
  const sys = new PatronSystem(mkScene(), mkWorld(), null, mkExchange(), null, { random: rng });
  let ok = true;
  for (let i = 0; i < 80; i++) {
    const p = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
    if (!p) continue;
    if (!DRINK_IDS.includes(p.drink) || p.wantsMatcha !== (p.drink === 'matcha')) { ok = false; break; }
  }
  check('every rolled order is a real menu id and wantsMatcha agrees', ok, 'spawned order mismatch');
}
{
  const regulars = new Regulars();
  const walkins = new WalkinPool(11); walkins.ensureDay(1);
  const sys = new PatronSystem(mkScene(), mkWorld(), regulars, mkExchange(), null, { random: rng, walkins });
  sys.menuOffered = { matcha: true, flatwhite: false, espresso: true, filter: false, cappuccino: false, latte: false };
  let ok = true, named = 0, anonymous = 0;
  for (let i = 0; i < 400 && (named < 3 || anonymous < 3); i++) {
    const p = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
    if (!p) continue;
    if (p.pname || p.regularName) named++; else anonymous++;
    if (p.drink === 'filter' || p.drink === 'flatwhite' || p.drink === 'cappuccino' || p.drink === 'latte') { ok = false; break; }
  }
  check('86ed drinks never roll — named or anonymous', ok && named > 0 && anonymous > 0, `named=${named} anon=${anonymous}`);
}
{
  const regulars = new Regulars();
  const walkins = new WalkinPool(11); walkins.ensureDay(1);
  const sys = new PatronSystem(mkScene(), mkWorld(), regulars, mkExchange(), null, { random: rng, walkins });
  let ok = true, named = 0;
  for (let i = 0; i < 60; i++) {
    const p = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
    if (!p) continue;
    if (p.pname || p.regularName) named++;
    if (!DRINK_IDS.includes(p.drink) || p.wantsMatcha !== (p.drink === 'matcha')) { ok = false; break; }
  }
  check('identity attachment never rewrites the rolled drink', ok && named > 0, `named=${named}`);
}
{
  const sys = new PatronSystem(mkScene(), mkWorld(), null, mkExchange(), null, { random: rng });
  sys.truceCeasefire = true;
  const ctx = { batchUnits: 40, batchReservedUntil: 840, milkStock: 99999, milky: 0, milkOut: false, menuPrices: null, repriced: false, prebatched: true };
  let p = null;
  for (let i = 0; i < 60 && !p; i++) {
    const c = sys.spawn('students', 'counter', true);
    if (c && c.drink === 'matcha') p = c;
  }
  if (!p) fails.push('could not spawn a matcha patron for the reservation check');
  else {
    p.state = 'inQueue'; p.waitMin = 0;
    sys.counterQ = [p];
    const ev839 = sys.tick(839, ctx);
    const svEarly = ev839.find(e => e.type === 'served' && e.p === p);
    check('pre-window pour is made-to-order, reserved stock untouched', !!svEarly && svEarly.fromBatch === false && ctx.batchUnits === 40, `units=${ctx.batchUnits}`);
    let q = null;
    for (let i = 0; i < 60 && !q; i++) {
      const c = sys.spawn('students', 'counter', true);
      if (c && c.drink === 'matcha') q = c;
    }
    if (!q) fails.push('could not spawn a second matcha patron');
    else {
      q.state = 'inQueue'; q.waitMin = 0;
      sys.counterQ = [q];
      const milkBefore = ctx.milkStock;
      const ev840 = sys.tick(840, ctx);
      const sv = ev840.find(e => e.type === 'served' && e.p === q);
      check('batch cup pours at 14:00', !!sv && sv.fromBatch === true && ctx.batchUnits === 39, JSON.stringify({ sv: !!sv, units: ctx.batchUnits }));
      check('batch cup charges the board price, not the deal', !!sv && near(sv.price, 4.80), sv && sv.price);
      check('batch matcha still draws milk and counts it', ctx.milkStock === milkBefore - 1 && ctx.milky >= 1, `milk ${milkBefore} → ${ctx.milkStock}`);
    }
  }
}
{
  const sys = new PatronSystem(mkScene(), mkWorld(), null, mkExchange(), null, { random: rng });
  sys.truceCeasefire = true;
  const ctx = { batchUnits: 40, batchReservedUntil: 840, milkStock: 99999, milky: 0, milkOut: false, menuPrices: { matcha: 4.80 }, repriced: false, prebatched: true };
  const queued = [];
  for (let i = 0; i < 9; i++) {
    const c = sys.spawn('students', 'counter', true);
    if (c) { c.drink = 'matcha'; c.wantsMatcha = true; c.state = 'inQueue'; c.queueRef = 'counter'; c.waitMin = ECON.balkAfter + 50; queued.push(c); }
  }
  sys.counterQ = [...queued];
  if (queued.length < 9) fails.push('could not fill a matcha queue for the balk check');
  else {
    const realRandom = Math.random; Math.random = () => 0.01;
    const ev839 = sys.tick(839, ctx);
    Math.random = realRandom;
    check('reserved cups give no patience before the window', ev839.some(e => e.type === 'balked'), `events=${ev839.map(e => e.type).join(',')}`);
    check('balks leave the reserve sealed', ctx.batchUnits === 40, `units=${ctx.batchUnits}`);
  }
}
{
  const sys = new PatronSystem(mkScene(), mkWorld(), null, mkExchange(), null, { random: rng });
  sys.truceCeasefire = true;
  const ctx = { batchUnits: 0, batchReservedUntil: 0, milkStock: 5, milky: 0, milkOut: false, menuPrices: { flatwhite: 3.60 }, repriced: false };
  let p = null;
  for (let i = 0; i < 80 && !p; i++) {
    const c = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
    if (c && c.drink === 'flatwhite') p = c;
  }
  if (!p) fails.push('could not spawn a flat white for the milk check');
  else {
    p.state = 'inQueue'; p.waitMin = 0;
    sys.counterQ = [p];
    const ev = sys.tick(700, ctx);
    const sv = ev.find(e => e.type === 'served' && e.p === p);
    check('milky cup draws milk stock and counts it', !!sv && ctx.milkStock === 4 && ctx.milky === 1, JSON.stringify({ milk: ctx.milkStock, milky: ctx.milky }));
    check('milky cup charges its menu price', !!sv && near(sv.price, 3.60), sv && sv.price);
    check('milky cup is made-to-order, not batch', !!sv && !sv.fromBatch, '');
    ctx.milkStock = 0;
    let q = null;
    for (let i = 0; i < 80 && !q; i++) {
      const c = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
      if (c && c.drink === 'flatwhite') q = c;
    }
    if (!q) fails.push('could not spawn a second flat white for the dry-bar check');
    else {
      q.state = 'inQueue'; q.waitMin = 0;
      sys.counterQ = [q];
      const ev2 = sys.tick(701, ctx);
      check('dry bar balks the milky order, flagged once', ev2.some(e => e.type === 'balked' && e.p === q && e.milkOut) && ctx.milkOut === true, JSON.stringify(ev2.map(e => e.type)));
    }
  }
}
{
  const sys = new PatronSystem(mkScene(), mkWorld(), null, mkExchange(), null, { random: rng });
  sys.truceCeasefire = true;
  const ctx = { batchUnits: 0, batchReservedUntil: 0, milkStock: 99999, milky: 0, milkOut: false, menuPrices: { flatwhite: 3.60 }, repriced: false };
  const queued = [];
  for (let i = 0; i < 60 && queued.length < 6; i++) {
    const c = sys.spawn(COHORTS_TEST[i % COHORTS_TEST.length], 'counter', true);
    if (c && c.drink === 'flatwhite') { c.state = 'inQueue'; c.waitMin = 0; queued.push(c); }
  }
  if (queued.length < 5) fails.push(`could not fill a flat white queue for the points check (${queued.length})`);
  else {
    sys.counterQ = [...queued];
    const ev = sys.tick(700, ctx);
    const served = ev.filter(e => e.type === 'served');
    const expect = Math.floor(ECON.barPoints / DRINKS.flatwhite.points);
    check(`8 bar points pour exactly ${expect} flat whites, no more`,
      served.length === expect && served.every(e => near(e.price, 3.60) && !e.fromBatch),
      `served=${served.length} prices=${served.map(e => e.price).join(',')}`);
    check('points test drew real milk', ctx.milky === expect, `milky=${ctx.milky}`);
    check('the rest stay queued for the next minute', sys.counterQ.filter(x => x.state === 'inQueue').length === queued.length - expect, `left=${sys.counterQ.filter(x => x.state === 'inQueue').length}`);
  }
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — leverState: one answer for UI, keys, and guidance — verified against a live PatronSystem');
