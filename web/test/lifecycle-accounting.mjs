// Headless lifecycle + accounting test — drives the real planning/commit loop:
// boot → planning (no roll) → stage → commit (charges once, then rolls) →
// trading → closeDay → review → explicit continue. No hidden day advances.
// Run: node web/test/lifecycle-accounting.mjs   (from the repo root)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CAMPAIGN, ECON } from '../js/config.js';
import { Exchange } from '../js/exchange.js';
import { PatronSystem } from '../js/patrons.js';
import { salePrice, operatingCosts, hedgeTerms, campaignVerdict } from '../js/economy.js';
import { priceForDay } from '../js/gentrification.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));

const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
    if (k === 'then') return undefined;
    return anyProxy();
  },
  set: () => true,
  apply: () => anyProxy(),
});

function makeEl(tag = 'div') {
  const el = {
    tag, tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, textContent: '', innerHTML: '',
    disabled: false, offsetWidth: 10, value: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    append(...cs) { for (const c of cs) el.appendChild(c); },
    prepend(c) { c._parent = el; el.children.unshift(c); },
    remove() { const pr = el._parent; if (pr) { const i = pr.children.indexOf(el); if (i >= 0) pr.children.splice(i, 1); } },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    setAttribute(k, v) { (el._attrs = el._attrs || {})[k] = String(v); },
    getAttribute(k) { return el._attrs && el._attrs[k]; },
    hasAttribute(k) { return !!(el._attrs && k in el._attrs); },
    removeAttribute(k) { if (el._attrs) delete el._attrs[k]; },
    matches() { return false; },
    getContext: () => anyProxy(),
    focus() {},
    get lastChild() { return el.children[el.children.length - 1] || null; },
    click() { el.onclick && el.onclick(); },
    onclick: null,
  };
  return el;
}
const registry = new Map();
const canvasStub = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });

globalThis.document = {
  getElementById: id => { if (!registry.has(id)) registry.set(id, makeEl()); return registry.get(id); },
  createElement: tag => tag === 'canvas' ? canvasStub() : makeEl(tag),
  createElementNS: () => canvasStub(),
  querySelectorAll: () => [],
  body: makeEl('body'),
};
globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' };
const keyHandlers = [];
globalThis.addEventListener = (t, f) => { if (t === 'keydown') keyHandlers.push(f); };
const fireKey = (key, opts = {}) => { for (const h of keyHandlers) h({ key, target: null, preventDefault() {}, ...opts }); };
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {}
}
globalThis.AudioContext = AudioContextStub;
globalThis.__headless = true;
let _rs = 424242;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
const _w = console.warn, _e = console.error;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };

let now = 1000;
function runFrames(n) { for (let f = 0; f < n; f++) { now += 100; const cb = rafCb; rafCb = null; if (!cb) throw new Error('loop stopped'); cb(now); const off = registry.get('offer'); if (off && off.classList.contains('show')) registry.get('offer-no').click(); } }

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
const fails = [];
const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

if (G.phase !== 'onboarding') fails.push(`boot phase should be onboarding, got ${G.phase}`);
registry.get('open').click();
await new Promise(r => setTimeout(r, 10));
let s = G.stats();
if (G.phase !== 'planning') fails.push(`after open phase should be planning, got ${G.phase}`);
if (s.dayMin !== 360) fails.push(`planning clock should park at 06:00 (360), got ${s.dayMin}`);
if (s.index !== 1.0 || G.exc.history.length !== 0) fails.push(`planning rolled the market early: index ${s.index} hist ${G.exc.history.length}`);
if (!G.paused) fails.push('planning should hold the clock paused');
runFrames(30);
s = G.stats();
if (s.dayMin !== 360) fails.push(`clock leaked during planning: ${s.dayMin}`);

if (!G.stageDayPlan({ hedge: 'contract_light' })) fails.push('stageDayPlan(contract_light) rejected in planning');
if (G.stats().debt !== 0) fails.push('staging charged the fee early');
if (!G.plan || G.plan.hedge !== 'contract_light') fails.push('plan snapshot does not reflect the staged hedge');
if (G.stageDayPlan({ hedge: 'nonsense' })) fails.push('invalid hedge staged');
if (G.stageDayPlan({ staffing: 'intern' })) fails.push('invalid staffing staged');

const draftBefore = JSON.stringify(G.plan);
if (G.stageDayPlan({ hedge: 'contract', staffing: 'intern' })) fails.push('compound patch with a bad key staged');
if (JSON.stringify(G.plan) !== draftBefore) fails.push('invalid compound patch left a partial draft');
if (G.stageDayPlan({ marketing: { sample: 'yes' } })) fails.push('non-boolean marketing staged');
if (G.stageDayPlan({ bogusKey: 1 })) fails.push('unknown plan key staged');
if (!G.stageDayPlan({ marketing: { sample: true } })) fails.push('sample staging rejected');
if (G.stats().sampleSpend !== 0 || G.stats().debt !== 0) fails.push('staging charged money');
if (!G.quote || !near(G.quote.sampling, CAMPAIGN.demand.sampleCost)) fails.push('quote getter out of sync with staged sample');
if (!G.stageDayPlan({ marketing: { sample: false } })) fails.push('unstaging sample rejected');
if (G.quote.sampling !== 0) fails.push('quote did not drop the unstaged sample');

const c1 = G.commitDayPlan();
if (!c1.ok) fails.push('commit rejected: ' + JSON.stringify(c1));
s = G.stats();
if (G.phase !== 'trading') fails.push(`post-commit phase should be trading, got ${G.phase}`);
if (!near(s.debt, hedgeTerms('contract_light').fee)) fails.push(`light contract fee should be ${hedgeTerms('contract_light').fee}, got ${s.debt}`);
if (!near(s.contract, 1.0)) fails.push(`contract should lock the pre-roll board 1.00, got ${s.contract}`);
if (G.exc.day !== 1 || G.exc.history.length !== 1) fails.push(`commit should roll day 1 exactly once: day ${G.exc.day} hist ${G.exc.history.length}`);
if (near(s.index, 1.0)) fails.push('commit should roll the market (index still 1.0)');
const c2 = G.commitDayPlan();
if (c2.ok || c2.why !== 'not planning') fails.push('second commit should fail as not planning: ' + JSON.stringify(c2));
if (!near(G.stats().debt, hedgeTerms('contract_light').fee)) fails.push('duplicate commit double-charged');
G.exc.contract.units = 3;
runFrames(220);
s = G.stats();
if (G.phase !== 'review') fails.push(`after close phase should be review, got ${G.phase}`);
if (!registry.get('receipt').classList.contains('show')) fails.push('receipt not shown at review');
if (!(s.hedgedCups > 0 && s.hedgeSavings !== 0)) fails.push(`hedge accounting missing: ${s.hedgedCups} cups / ${s.hedgeSavings}`);
const rc = G.lastDayReceipt;
if (!rc || !rc.lines.some(l => l[0] === 'hedge benefit (before fees)')) fails.push('receipt dropped the realized hedge line');
if (!rc.lines.some(l => l[0] === 'contract fee')) fails.push('receipt dropped the contract-fee line');
if (!rc.lines.some(l => l[0] === 'operations')) fails.push('receipt dropped the operations subtotal');
if (typeof rc.netToday !== 'number' || typeof rc.operatingNet !== 'number' || !rc.ops || typeof rc.hedgeSavings !== 'number' || typeof rc.fees !== 'number')
  fails.push('receipt missing numeric accounting fields (netToday/operatingNet/ops/hedgeSavings/fees)');
if (!near(rc.netToday, rc.operatingNet - s.feeToday - s.interestToday)) fails.push('netToday should be operatingNet minus fee+interest');
let sumNet = rc.netToday;
if (G.exc.contract) fails.push('tiny contract should have exhausted to null');
if (G.applyReply('hold')) fails.push('applyReply should be inert outside planning');
if (G.commitDayPlan().ok) fails.push('commit should fail in review');

for (let d = 2; d <= CAMPAIGN.days; d++) {
  if (!G.continueFromReview()) fails.push(`day ${d}: continueFromReview rejected`);
  if (G.phase !== 'planning' || G.stats().day !== d) fails.push(`day ${d}: continue should land in planning, got ${G.phase}/${G.stats().day}`);
  if (d === 2) {
    // disclosure unlocks: street work arrives with its reason, contracts
    // render flat, and the live day-1 tab puts settle on the board.
    // (the shim's textContent='' doesn't clear children — wipe before render
    // so the assertions read this render only)
    for (const id of ['brief-actions', 'brief-demand']) { const e = registry.get(id); if (e) e.children.length = 0; }
    G.renderBrief();
    const dem = registry.get('brief-demand');
    if (dem.style.display === 'none') fails.push('day-2 brief hid the street-work row');
    if (!dem.children.some(c => c.id === 'brief-demand-intro')) fails.push('day-2 street work arrived without its reason line');
    if (registry.get('brief-actions').children.some(c => c.id === 'brief-hedge-details')) fails.push('day-2 brief still folds the contracts');
    const flat2 = registry.get('brief-actions').children.filter(c => c.tagName === 'BUTTON').map(c => c.dataset.id);
    if (!flat2.includes('settle')) fails.push('day-2 brief hid the settle move with a live tab');
    if (!(registry.get('brief-nut').textContent || '').includes('campaign net position'))
      fails.push('day-2 quote dropped the net position line');
  }
  if (G.exc.day !== d - 1) fails.push(`day ${d}: exchange.day ran ahead before commit (${G.exc.day})`);
  G.stageDayPlan({ hedge: 'hold' });
  const r = G.commitDayPlan();
  if (!r.ok) fails.push(`day ${d}: commit failed ${JSON.stringify(r)}`);
  if (G.exc.day !== d) fails.push(`day ${d}: exchange.day should align after commit (${G.exc.day})`);
  runFrames(220);
  if (G.phase !== 'review') fails.push(`day ${d}: expected review after close, got ${G.phase}`);
  const rcD = G.lastDayReceipt;
  sumNet += rcD.netToday;
  if (d >= 3 && !rcD.lines.some(l => l[0].includes('reval'))) fails.push(`day ${d}: receipt missing the pitch reval surcharge line`);
  if (d >= 4 && !rcD.lines.some(l => l[0].includes('oat surcharge'))) fails.push(`day ${d}: receipt missing the dairy surcharge line`);
}
s = G.stats();
if (!near(sumNet, s.netWorth, 0.01)) fails.push(`daily netToday sum ${sumNet} should reconcile to netWorth ${s.netWorth}`);
if (s.campaignDone) fails.push('day-5 close auto-finished the campaign');
if (!G.continueFromReview()) fails.push('final continueFromReview rejected');
if (!G.stats().campaignDone) fails.push('explicit continue on day 5 did not reach finale');
if (G.phase !== 'finale') fails.push(`post-campaign phase should be finale, got ${G.phase}`);

G.reset();
await new Promise(r => setTimeout(r, 5400));
s = G.stats();
if (s.campaignDone) fails.push('reset did not clear campaignDone');
if (G.phase !== 'planning' || s.day !== 1) fails.push(`reset should land in day-1 planning, got ${G.phase}/${s.day}`);
if (s.index !== 1.0 || G.exc.history.length !== 0 || s.debt !== 0) fails.push('reset did not restore the pre-roll baseline');
if (s.till !== 0 || s.cogs !== 0 || s.hedgedCups !== 0 || s.hedgeSavings !== 0) fails.push('reset left stale counters');
if (registry.get('receipt').classList.contains('show')) fails.push('a stale finale receipt printed after reset');
if (!G.plan || G.plan.hedge !== 'hold' || G.plan.staffing !== 'work') fails.push('reset did not build the default draft');

G.renderBrief();
{
  const planSnap = JSON.stringify(G.plan);
  for (const k of ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) fireKey(k);
  fireKey('Tab', { shiftKey: true });
  if (JSON.stringify(G.plan) !== planSnap || G.phase !== 'planning' || G.stats().debt !== 0)
    fails.push('focus keys caused gameplay side effects');
  if (!registry.get('brief').classList.contains('show')) fails.push('renderBrief did not open the brief');
}

// ---- progressive disclosure: day 1 teaches open/price/serve first --------
{
  for (const id of ['brief-actions', 'brief-demand']) { const e = registry.get(id); if (e) e.children.length = 0; }
  G.renderBrief();
  const acts = registry.get('brief-actions');
  const fold = acts.children.find(c => c.id === 'brief-hedge-details');
  const flatIds = acts.children.filter(c => c.tagName === 'BUTTON').map(c => c.dataset.id);
  const dTier = G.exc.event?.tier || 'calm';
  if (dTier === 'calm' || dTier === 'good') {
    if (!fold) fails.push('calm day-1 brief should fold the contract pills into one line');
    else if (!fold.children.some(c => c.tagName === 'BUTTON')) fails.push('the hedge fold rendered empty');
    if (flatIds.some(id => id && id.startsWith('contract'))) fails.push('a day-1 contract pill leaked outside the fold');
    if (!flatIds.includes('hold')) fails.push('day-1 brief must keep hold visible');
  } else if (fold) fails.push('a threatened opening morning should NOT fold the contracts');
  if (flatIds.includes('settle')) fails.push('dead settle pill rendered with no tab to settle');
  if (registry.get('brief-demand').style.display !== 'none') fails.push('day-1 brief showed the street-work row');
  if ((registry.get('brief-nut').textContent || '').includes('campaign net position'))
    fails.push('day-1 quote printed a net position with no history behind it');
  // risk reveals the tool: a warn-tier board springs the fold back open
  const savedEvent = G.exc.event;
  G.exc.event = { id: 'rumour_frost', tier: 'warn', head: 'H', line: 'l', day: 1 };
  { const e = registry.get('brief-actions'); if (e) e.children.length = 0; }
  G.renderBrief();
  if (registry.get('brief-actions').children.some(c => c.id === 'brief-hedge-details'))
    fails.push('a warn-tier board should spring the day-1 hedge fold open');
  G.exc.event = savedEvent;
}

const exFix = new Exchange(9);
exFix.contractBeans(1, 0);
const cup1 = exFix.purchaseCup();
exFix.beanIndex = 1.8;
const cup2 = exFix.purchaseCup();
if (!near(cup1.beanCost, 1.30) || !near(cup1.spotCost, 1.30) || !cup1.hedged) fails.push(`hedged cup wrong: ${JSON.stringify(cup1)}`);
if (!near(cup2.beanCost, 2.34) || !near(cup2.spotCost, 2.34) || cup2.hedged) fails.push(`spot cup wrong: ${JSON.stringify(cup2)}`);

{
  const pex = new Exchange(9);
  pex.day = CAMPAIGN.days;
  pex.matchaPrice = priceForDay(CAMPAIGN.days);
  pex.beanIndex = 1.0;
  pex.contractBeans(1, 0);
  pex.beanIndex = 1.8;
  const ps = new PatronSystem({ add() {} }, { seats: [] }, null, pex, null, { random: () => 0.99 });
  const ctx = { prebatched: false, repriced: false, batchUnits: 0 };
  const p1 = ps.spawn('commuters', 'counter', true);
  const p2 = ps.spawn('commuters', 'counter', true);
  for (const p of [p1, p2]) { p.state = 'inQueue'; p.wantsMatcha = true; p.waitMin = 0; }
  const ev1 = ps.tick(500, ctx).filter(e => e.type === 'served');
  if (ev1.length !== 2) fails.push(`patron fixture should serve 2 cups, got ${ev1.length}`);
  else {
    if (!near(ev1[0].price, 5.40)) fails.push(`day-5 patron price should be 5.40, got ${ev1[0].price}`);
    if (!near(ev1[0].beanCost, 1.30) || !ev1[0].hedged) fails.push(`first cup should ride the lock at 1.30, got ${JSON.stringify(ev1[0])}`);
    if (!near(ev1[1].beanCost, 2.34) || ev1[1].hedged) fails.push(`second cup should pay spot 2.34, got ${JSON.stringify(ev1[1])}`);
  }
  const p3 = ps.spawn('commuters', 'counter', true);
  p3.state = 'inQueue'; p3.wantsMatcha = true; p3.waitMin = 0;
  ctx.repriced = true; ps.repriced = true;
  const ev2 = ps.tick(501, ctx).filter(e => e.type === 'served');
  if (!ev2.length || !near(ev2[0].price, ECON.matchaDeal)) fails.push(`repriced cup should charge ${ECON.matchaDeal}, got ${ev2[0] && ev2[0].price}`);
  if (pex.contract) fails.push('the 1-unit contract should have exhausted');
}

const d5 = { day: CAMPAIGN.days, matchaPrice: priceForDay(CAMPAIGN.days) };
if (!near(salePrice(d5), 5.40)) fails.push(`day-5 price should be 5.40, got ${salePrice(d5)}`);
if (!near(salePrice(d5, true), ECON.matchaDeal)) fails.push(`repriced day-5 should be ${ECON.matchaDeal}, got ${salePrice(d5, true)}`);
if (!near(salePrice({ day: 1 }), priceForDay(1))) fails.push('day-1 fallback price wrong');

const opsHome = operatingCosts({ served: 10, staffing: 'home' });
const opsApp = operatingCosts({ served: 10, staffing: 'apprentice' });
const opsWork = operatingCosts({ served: 10, staffing: 'work' });
if (!near(opsHome.staff, 10 * CAMPAIGN.staffPerCup)) fails.push(`home staffing should drop the wage: ${opsHome.staff}`);
if (!near(opsApp.staff, CAMPAIGN.staff.apprenticeDayRate + 10 * CAMPAIGN.staffPerCup)) fails.push(`apprentice wage wrong: ${opsApp.staff}`);
if (!near(opsWork.staff, CAMPAIGN.staffDayRate + 10 * CAMPAIGN.staffPerCup)) fails.push(`work wage wrong: ${opsWork.staff}`);
if (!near(opsApp.supplies - opsWork.supplies, 10 * CAMPAIGN.staff.apprenticeWasteExtra)) fails.push('apprentice waste extra missing');
if (!near(opsWork.training + opsWork.sampling, 0)) fails.push('default ops should carry no training/sampling');
const opsTrain = operatingCosts({ served: 0, staffing: 'apprentice', training: 12, sampling: 8 });
if (!near(opsTrain.training, 12) || !near(opsTrain.sampling, 8)) fails.push('training/sampling ops params not itemized');
if (!near(opsTrain.total, opsTrain.staff + opsTrain.supplies + opsTrain.pitch + opsTrain.fees + opsTrain.sundries + opsTrain.marketing + opsTrain.training + opsTrain.sampling)) fails.push('ops total does not sum its line items');
const nut = operatingCosts({ served: 0 });
if (!near(nut.total, CAMPAIGN.staffDayRate + CAMPAIGN.pitchMin + CAMPAIGN.sundries)) fails.push(`the nut should be ${CAMPAIGN.staffDayRate + CAMPAIGN.pitchMin + CAMPAIGN.sundries}, got ${nut.total}`);
const ht = hedgeTerms('contract_light', 18);
if (!ht || !near(ht.fee, hedgeTerms('contract_light').fee + 18) || ht.units !== CAMPAIGN.contractUnits / 2) fails.push('hedgeTerms light+extraFee wrong');
if (hedgeTerms('hold')) fails.push('hedgeTerms should return null for non-contracts');

{
  G.stageDayPlan({ hedge: 'hold' });
  if (!G.commitDayPlan().ok) fails.push('post-reset day-1 commit failed');
  runFrames(220);
  if (G.phase !== 'review') fails.push('post-reset day never closed');
  if (G.stats().cogs <= 0) fails.push('post-reset day has no COGS — purchaseCup not wired');
  G.continueFromReview(); await new Promise(r => setTimeout(r, 10));
  G.stageDayPlan({ hedge: 'hold' }); G.commitDayPlan(); runFrames(220);
  G.continueFromReview(); await new Promise(r => setTimeout(r, 10));
  G.stageDayPlan({ hedge: 'hold' }); G.commitDayPlan(); runFrames(220);
  G.continueFromReview(); await new Promise(r => setTimeout(r, 10));
  if (G.stats().day !== 4 || G.phase !== 'planning') fails.push(`expected day-4 planning, got ${G.stats().day}/${G.phase}`);
  G.testState({ baristaCondition: 0.15 });
  const condBefore = G.stats().staffCondition;
  if (!G.stageDayPlan({ staffing: 'apprentice' })) fails.push('tired-day apprentice staging rejected');
  if (!G.commitDayPlan().ok) fails.push('day-4 apprentice commit failed');
  runFrames(220);
  const condAfter = G.stats().staffCondition;
  if (!near(condAfter, Math.min(1, condBefore + (CAMPAIGN.staff.ruthApprenticeRest || 0.25)), 1e-9)) fails.push(`apprentice day should rest Ruth +0.25: ${condBefore} -> ${condAfter}`);
  if (G.stats().baristaCrisis) fails.push('apprentice day must not trigger a barista crisis');
  if (G.stats().trainingSpend !== CAMPAIGN.staff.apprenticeTrainingFee) fails.push(`training spend should be ${CAMPAIGN.staff.apprenticeTrainingFee}, got ${G.stats().trainingSpend}`);
  const rc4 = G.lastDayReceipt;
  if (!rc4.lines.some(l => l[0] === 'apprentice training')) fails.push('day-4 receipt missing the apprentice training line');
  if (G.phase !== 'review') fails.push('day-4 apprentice run did not reach review');
  if (!G.continueFromReview()) fails.push('day-5 continue rejected');
  G.testState({ baristaCondition: 0.15 });
  if (!G.stageDayPlan({ staffing: 'work' })) fails.push('day-5 push-on staging rejected');
  if (!G.commitDayPlan().ok) fails.push('day-5 pushed commit failed');
  runFrames(220);
  if (G.stats().baristaCrisis !== true) fails.push('pushed day at 0.15 condition should trigger the barista crisis');
}

// Insolvency — mid-campaign, the supplier calls the tab. Inflate the debt past
// net worth at a day-1 review; the campaign must end 'lost' on the spot.
G.reset();
await new Promise(r => setTimeout(r, 5400));
{
  G.stageDayPlan({ hedge: 'hold' });
  if (!G.commitDayPlan().ok) fails.push('insolvency-fixture commit failed');
  runFrames(220);
  if (G.phase !== 'review') fails.push(`insolvency fixture expected review, got ${G.phase}`);
  G.exc.debt = 99999;
  if (G.stats().netWorth >= 0) fails.push(`fixture should be insolvent, netWorth ${G.stats().netWorth}`);
  if (!G.continueFromReview()) fails.push('insolvent continueFromReview rejected');
  if (G.phase !== 'finale' || !G.stats().campaignDone) fails.push(`insolvency should end the campaign early, got ${G.phase}`);
  if (campaignVerdict(G.stats().netWorth, G.stats().rep) !== 'lost') fails.push('insolvent campaign should verdict lost');
  if (G.stats().day !== 1) fails.push('insolvency ran past the failed day');
}

// Evening call — the three choices are real and the prep gate holds.
// resolveEvening is exposed for headless coverage. Each branch runs the day
// past the rush first — closing at dawn is (correctly) insolvency.
const runTo = (min, cap = 900) => { let g = 0; while (G.phase === 'trading' && G.stats().dayMin < min && g++ < cap) runFrames(1); };
G.reset();
await new Promise(r => setTimeout(r, 5400));
{
  G.stageDayPlan({ hedge: 'hold' });
  if (!G.commitDayPlan().ok) fails.push('evening-fixture commit failed');
  runTo(1025);
  if (G.phase !== 'trading') fails.push(`evening fixture expected trading past the rush, got ${G.phase}@${G.stats().dayMin}`);
  G.resolveEvening('close');
  if (G.phase !== 'review') fails.push(`evening close should land on the review, got ${G.phase}`);
}
{
  // 'hold' fast-forwards to close; on a price-cut day 'topup' coerces to hold
  G.continueFromReview(); await new Promise(r => setTimeout(r, 10));
  G.stageDayPlan({ hedge: 'hold' }); G.commitDayPlan();
  runFrames(5);
  registry.get('reprice').click();
  runTo(1025);
  G.resolveEvening('topup');
  if (G.stats().batchUnits !== 0) fails.push(`topup on a price-cut day should coerce to hold, got ${G.stats().batchUnits} cups`);
  if (G.stats().batchSpend !== 0) fails.push('coerced topup should not charge');
  runFrames(220);
  if (G.phase !== 'review') fails.push(`evening fast-forward should still close the day, got ${G.phase}`);
}
{
  // a prep day can top up — it charges, adds cups, and the day still closes
  G.continueFromReview(); await new Promise(r => setTimeout(r, 10));
  G.stageDayPlan({ hedge: 'hold' }); G.commitDayPlan();
  runFrames(5);
  registry.get('prebatch').click();
  const before = G.stats().batchUnits;
  if (before !== ECON.batchUnits) fails.push(`prep should buy ${ECON.batchUnits} cups, got ${before}`);
  runTo(1025);
  const atEvening = G.stats().batchUnits;   // the rush may have drunk the first batch
  G.resolveEvening('topup');
  if (G.stats().batchUnits !== atEvening + ECON.batchUnits) fails.push(`evening topup should add ${ECON.batchUnits} cups, got ${G.stats().batchUnits}`);
  if (!near(G.stats().batchSpend, ECON.batchCost * 2)) fails.push(`two batches should spend ${ECON.batchCost * 2}, got ${G.stats().batchSpend}`);
  G.resolveEvening('hold');   // second call is a no-op — the evening is already resolving
  if (G.stats().batchUnits !== atEvening + ECON.batchUnits) fails.push('repeat evening call should be idempotent');
  runFrames(220);
  if (G.phase !== 'review') fails.push(`topped-up evening should still close, got ${G.phase}`);
  const rcE = G.lastDayReceipt;
  if (!rcE || !rcE.lines.some(l => l[0] === 'matcha batch bought')) fails.push('receipt missing the batch-bought line');
  const revLine = rcE && rcE.lines.find(l => l[0] === 'revenue');
  const stE = G.stats();
  const wantRev = '£' + (stE.till + stE.batchSpend).toFixed(2);
  if (!revLine || revLine[1] !== wantRev) fails.push(`revenue should be gross of batch spend: got ${revLine && revLine[1]}, want ${wantRev}`);
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — lifecycle gates hold, commit charges once, hedge accounting is realized, reset kills stale timers');
