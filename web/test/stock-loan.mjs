// Morning stock loan. The lump sits beside the tab: optional at dawn,
// 18% at close from the till before pitch and before the tab, and a
// skipped morning leaves the competent week on the existing floor.
// Run: node web/test/stock-loan.mjs
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../js/config.js';
import { campaignVerdict } from '../js/economy.js';
import { deliveryQty } from '../js/menu.js';
import {
  CASE_COST, CASE_RETURN_CAP, LOAN_MAX, LOAN_RATE, LOAN_STEP,
  MorningLoan, caseRevenue, loanAmount, loanDue, quoteClose,
} from '../js/stockLoan.js';

const fails = [];
const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// --- pure: steps, 18%, the case cap, the tab does not protect this lump ---
check(loanAmount(0) === 0, 'skip is a £0 draw');
check(loanAmount(400) === 400 && loanAmount(800) === 800 && loanAmount(1200) === 1200 && loanAmount(1600) === 1600, 'steps of £400 up to £1,600');
check(loanAmount(100) === null && loanAmount(2000) === null && loanAmount(-400) === null, 'off-step and over-cap draws are refused');
check(LOAN_STEP === 400 && LOAN_MAX === 1600 && LOAN_RATE === 0.18, 'agreed step, cap, and rate');
check(CASE_RETURN_CAP === 0.48, 'case return cap stays 48%');
check(CAMPAIGN.demand.returnMax === 0.48, 'loyalty return cap is not raised');
check(deliveryQty(200) === 220, 'the milk van stays at its existing buffer');
check(loanDue(400).interest === 72 && loanDue(400).due === 472, '£400 costs £72');
check(loanDue(1600).interest === 288 && loanDue(1600).due === 1888, '£1,600 costs £288');
check(loanDue(10).interest === 1.8 && loanDue(10).interest < CAMPAIGN.debtInterest, 'the £4 tab floor does not lift a small loan');
check(loanDue(10000).interest === 1800 && loanDue(10000).due === 11800 && loanDue(10000).due > CAMPAIGN.creditLimit, 'the £3,500 tab cap does not protect the lump');
check(caseRevenue(400) === 592, 'a £400 case sells through at the 48% cap');
check(caseRevenue(400) - loanDue(400).due === 120, 'sell-through leaves £120 after the 18%');
check(caseRevenue(400) / 400 - 1 <= CASE_RETURN_CAP + 1e-9, 'sell-through does not beat the return cap');
check(campaignVerdict(8001, 70) === 'star', 'clearing a day can still star the week');

const ordered = quoteClose({ till: 1000, balance: 400, pitchMin: 1150, pitchPct: 0.12, tabDue: 2000 });
check(ordered.loanPaid === 472 && ordered.loanUnpaid === 0, 'scarce till pays the loan first');
check(ordered.pitch === 1150, 'pitch is the floor on the till after the loan');
check(ordered.tabPaid === 0 && ordered.tabUnpaid === 2000, 'the tab waits behind the loan and the pitch floor');
const pitched = quoteClose({ till: 20000, balance: 400, pitchMin: 1150, pitchPct: 0.12, tabDue: 5000 });
check(near(pitched.pitch, 19528 * 0.12), 'pitch turnover uses the post-loan till');
check(pitched.pitch < 20000 * 0.12 - 1, 'pitch is not taken on the pre-loan till');
check(pitched.tabPaid === 5000, 'the tab is paid only after the loan and the pitch');

const fresh = new MorningLoan();
check(fresh.borrow(400).ok && !fresh.borrow(400).ok, 'one draw per morning');
check(!fresh.spend('batch', 40).ok, 'the purse cannot buy anything but case, lot, or sponsor');
const opened = (() => { fresh.spend('case', 400); return fresh.open(); })();
check(opened.returned === 0 && opened.kept === 400 && fresh.balance === 400, 'a spent draw stays with the lender as principal');
let missed = fresh.settle(0);
check(missed.loanUnpaid === 472 && fresh.balance === 472 && fresh.missedCloses === 1 && !fresh.seized, 'a missed close rolls the re-rated due');
fresh.beginMorning();
missed = fresh.settle(0);
check(near(missed.due, 556.96) && near(fresh.balance, 556.96) && fresh.missedCloses === 2 && fresh.seized, 'a second miss compounds 18% and takes the next delivery');
const dueNow = loanDue(fresh.balance).due;
const cleared = fresh.settle(dueNow);
check(cleared.loanUnpaid === 0 && fresh.balance === 0 && !fresh.seized, 'paying the re-rated due releases the next delivery');

const unspent = new MorningLoan();
unspent.borrow(1600);
unspent.spend('case', 400);
const back = unspent.open();
check(back.returned === 1200 && back.kept === 400 && unspent.balance === 400, 'unspent cash returns at open');

const week = new MorningLoan();
week.borrow(1600);
week.spend('lot', 1600);
week.open();
const end = week.settle(100, { weekEnd: true });
check(end.loanPaid === 100 && week.missedCloses === 1 && week.balance > 100 && week.seized, 'a week that ends with more loan than cash loses the next delivery');

const purse = new MorningLoan();
purse.borrow(400);
check(purse.spend('sponsor', 160).spent === 160, 'the purse can pay the sponsor');
check(purse.spend('lot', 300).spent === 240, 'the purse stops when it is empty');
check(!purse.spend('case', 400).spent, 'no case once the purse is empty');

if (fails.length) {
  console.error('\nFAIL (pure):\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('PURE   steps, 18%, case margin, roll, seizure, waterfall — ok');

// --- sim: the same morning, wired through the brief, the till, and the week ---
const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = {
    children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10, id: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = e; e.children.push(c); return c; },
    append(...cs) { for (const c of cs) e.appendChild(c); },
    prepend(c) { c._parent = e; e.children.unshift(c); },
    remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
    querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
    setAttribute() {}, getAttribute() { return null; },
    getContext: () => anyProxy(),
    get lastChild() { return e.children[e.children.length - 1] || null; },
    click() { e.onclick && e.onclick(); }, onclick: null,
  };
  return e;
}
function findId(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children || []) { const f = findId(c, id); if (f) return f; }
  return null;
}
const reg = new Map();
const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
globalThis.document = {
  getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); },
  createElement: t => t === 'canvas' ? cs() : el(),
  createElementNS: () => cs(),
  querySelectorAll: () => [],
  body: el(),
};
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' }; globalThis.addEventListener = () => {};
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
const _e = console.error; console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume() {}
}
globalThis.AudioContext = ACS;
let _rs = 987654321;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
let now = 1000;
function runFrames(n) {
  for (let f = 0; f < n; f++) {
    now += 100; const cb = rafCb; rafCb = null; if (!cb) throw new Error('loop stopped'); cb(now);
    const off = reg.get('offer'); if (off && off.classList.contains('show')) reg.get('offer-no').click();
  }
}
function loanLine() {
  return findId(reg.get('brief-prep'), 'brief-loan');
}

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;

function openMorning() {
  G.reset();
  reg.get('open').click();
}

// Brief: one line in the prep block, borrow or skip.
openMorning();
await new Promise(r => setTimeout(r, 10));
G.renderBrief();
const line = loanLine();
check(!!line && line.id === 'brief-loan', 'dawn brief has no loan line in the prep block');
check(line && line.textContent === 'borrow or skip', 'the line should offer borrow or skip, got ' + (line && line.textContent));
check(!reg.has('brief-loan-panel') && line && line._parent === reg.get('brief-prep'), 'the loan line is not a new panel');
line.click();
const stepped = loanLine();
check(stepped && stepped.textContent === 'borrow £400 or skip', 'clicking the line steps to £400, got ' + (stepped && stepped.textContent));

// Unspent loan cash returns when the doors open. A lot paid from the purse
// does not also land on the tab.
openMorning();
await new Promise(r => setTimeout(r, 10));
const stockBefore = G.stats().houseStock;
check(G.stageLoan(1600) === true && G.stageLoan(100) === false, 'staging accepts a step and refuses an off-step');
check(G.stageCellar({ topup: 100 }) === true, 'lot staging rejected');
check(G.commitDayPlan().ok, 'commit with a loan failed');
let s = G.stats();
check(s.loan.returned === 1470, 'unspent purse should return £1,470, got ' + s.loan.returned);
check(s.loan.balance === 130, 'the lot should keep £130 of the draw, got ' + s.loan.balance);
check(s.debt === 0, 'the loan-funded lot must not ride the tab, debt ' + s.debt);
check(s.houseStock === stockBefore + 100, 'the lot should land in the cellar');
check(s.till === 0, 'unspent loan cash must not sit in the till at open, till ' + s.till);

// A borrowed case that sells through, paid before the pitch. The tab is untouched.
openMorning();
await new Promise(r => setTimeout(r, 10));
check(G.stageLoan(400) && G.stageCase(1), 'case staging rejected');
check(G.stageDayPlan({ hedge: 'contract_light' }), 'light cover rejected');
check(G.commitDayPlan().ok, 'case commit failed');
const debtAtOpen = G.stats().debt;
check(debtAtOpen > 0, 'the tab should still be there beside the loan');
G.testState({ closeTill: 20000 });
runFrames(220);
s = G.stats();
check(s.caseRevenue === 592, 'case sell-through should be £592, got ' + s.caseRevenue);
check(s.loan.paid === 472 && s.loan.balance === 0, 'the £400 case should cost £472 at close, paid ' + s.loan.paid + ' balance ' + s.loan.balance);
check(s.caseRevenue - s.loan.paid === 120, 'margin after the 18% should be £120');
check(s.debt === debtAtOpen, 'paying the loan must not pay or grow the tab');
const pitchOf = (t) => Math.max(CAMPAIGN.pitchMin, Math.max(0, t) * CAMPAIGN.pitchPct);
check(near(s.ops.pitch, pitchOf(s.till)), 'pitch should be worked out on the post-loan till');
check(Math.abs(pitchOf(s.till + s.loan.paid) - pitchOf(s.till)) > 1, 'this till is high enough that loan-before-pitch changes the rent');
check(Math.abs(s.ops.pitch - pitchOf(s.till + s.loan.paid)) > 1, 'pitch was taken on the pre-loan till');
const dueLine = G.lastDayReceipt.lines.find(l => l[0] === 'loan due' || l[0] === 'loan unpaid');
check(dueLine && dueLine[0] === 'loan due' && dueLine[1] === '£472.00', 'receipt should say loan due £472.00, got ' + JSON.stringify(dueLine));
const pitchAt = G.lastDayReceipt.lines.findIndex(l => String(l[0]).startsWith('pitch rent'));
const loanAt = G.lastDayReceipt.lines.findIndex(l => l[0] === 'loan due');
check(loanAt >= 0 && pitchAt > loanAt, 'the receipt should name the loan before the pitch');

// Two missed closes roll, re-rate, and seize the next delivery.
openMorning();
await new Promise(r => setTimeout(r, 10));
check(G.stageLoan(400) && G.stageCase(1) && G.commitDayPlan().ok, 'miss setup failed');
G.testState({ loanCash: 0 });
runFrames(220);
s = G.stats();
check(s.loan.balance === 472 && s.loan.missedCloses === 1 && !s.loan.seized, 'first miss should roll £472, got ' + JSON.stringify(s.loan));
const unpaidLine = G.lastDayReceipt.lines.find(l => l[0] === 'loan unpaid');
check(unpaidLine && unpaidLine[1] === '£472.00', 'receipt should say loan unpaid, got ' + JSON.stringify(unpaidLine));
check(G.continueFromReview(), 'day 2 did not open');
check(G.commitDayPlan().ok, 'day 2 commit failed');
G.testState({ loanCash: 0 });
runFrames(220);
s = G.stats();
check(near(s.loan.balance, 556.96) && s.loan.missedCloses === 2 && s.loan.seized, 'second miss should re-rate to £556.96 and seize, got ' + JSON.stringify(s.loan));
check(G.continueFromReview() && G.phase === 'planning' && G.stats().day === 3, 'day 3 should still open after a seizure');
s = G.stats();
check(s.milkDelivery === 0 && s.milkStock === 0, 'seized delivery has no van, milk ' + s.milkDelivery + '/' + s.milkStock);
check(s.board === 'beans and water', 'seized board should be beans and water, got ' + s.board);
check(G.patrons.menuOffered.espresso === true && G.patrons.menuOffered.filter === true, 'beans and water should stay on the board');
check(G.patrons.menuOffered.matcha === false && G.patrons.menuOffered.flatwhite === false, 'milk drinks should be off while the delivery is held');
check(G.stageCase(1) === false, 'a seized morning must refuse the case');

// A week below £0 still closes the cafe, loan or not.
openMorning();
await new Promise(r => setTimeout(r, 10));
check(G.stageLoan(400) && G.stageCase(1) && G.commitDayPlan().ok, 'insolvency setup failed');
G.testState({ loanCash: 0 });
runFrames(220);
check(G.stats().loan.balance === 472, 'loan should still be outstanding when the week goes under');
G.exc.debt = 1e9;
check(G.continueFromReview() === true && G.phase === 'finale' && G.stats().campaignDone, 'a week below £0 should still close the cafe');

// Skip the loan: the competent week stays above the existing £600 floor.
G.reset();
await new Promise(r => setTimeout(r, 10));
_rs = 987654321;
for (let d = 1; d <= CAMPAIGN.days; d++) {
  const before = G.stats();
  check(before.loan.balance === 0 && !before.loan.seized, `day ${d} skip path carried a loan`);
  G.stageCellar({ lot: 'huila', topup: 'restock' });
  G.stageDayPlan({ hedge: d === 1 ? 'contract' : (before.debt > 0 ? 'settle' : 'hold') });
  const cr = G.commitDayPlan();
  check(cr.ok, `day ${d} skip commit failed ${JSON.stringify(cr)}`);
  runFrames(220);
  const rc = G.lastDayReceipt;
  check(!rc.lines.some(l => l[0] === 'loan due' || l[0] === 'loan unpaid'), `day ${d} receipt mentioned a loan`);
  G.continueFromReview();
}
const endWeek = G.stats();
console.log('SKIP   campaignDone', endWeek.campaignDone, '| netWorth', endWeek.netWorth.toFixed(0), '| loan', endWeek.loan.balance);
check(endWeek.campaignDone, 'skipped week never closed');
check(endWeek.netWorth > 600, 'skipped week should stay above the £600 floor, got ' + endWeek.netWorth);
check(endWeek.loan.balance === 0, 'skipped week should owe nothing');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — morning stock loan: skip week, case margin, roll, seizure, unspent return, loan before pitch and tab');
