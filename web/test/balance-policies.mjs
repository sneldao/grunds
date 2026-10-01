import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN } from '../js/config.js';
import { campaignVerdict } from '../js/economy.js';

const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
const seeds = [7, 42, 101, 202, 555, 13, 77, 150, 314, 431];
const policies = ['passive', 'queue', 'growth', 'conservative', 'aggressive', 'forecaster', 'engaged', 'reckless'];
const sourceFiles = ['main', 'config', 'patrons', 'exchange', 'economy', 'decision', 'gentrification', 'demand', 'regulars', 'rival', 'staffing'];
const fingerprint = () => createHash('sha256').update(sourceFiles.map(name => readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8')).join('\n')).digest('hex');
const sourceHash = fingerprint();
const proxy = () => new Proxy(function () {}, {
  get: (_, k) => k === Symbol.toPrimitive ? hint => hint === 'string' ? 'WebGL 2.0' : 1 : k === 'then' ? undefined : proxy(),
  set: () => true, apply: () => proxy(),
});
const original = { log: console.log, debug: console.debug, warn: console.warn, error: console.error, timeout: setTimeout, interval: setInterval, random: Math.random, performance: globalThis.performance, dateNow: Date.now };
const warnings = new Set();
console.log = console.debug = () => {};
console.warn = (...args) => { if (!String(args[0]).startsWith('THREE.')) warnings.add(String(args[0])); };
console.error = (...args) => { if (!String(args[0]).startsWith('THREE.')) original.error(...args); };
globalThis.setTimeout = () => 0;
globalThis.setInterval = () => 0;

function element(tag = 'div', id = '') {
  let text = '', html = '';
  const e = {
    tagName: tag.toUpperCase(), id, children: [], style: {}, dataset: {}, attrs: {}, disabled: false, value: '', offsetWidth: 10, isConnected: true,
    classList: { values: new Set(), add(c) { this.values.add(c); }, remove(c) { this.values.delete(c); }, contains(c) { return this.values.has(c); }, toggle(c, yes) { yes ? this.values.add(c) : this.values.delete(c); } },
    appendChild(c) { c.parentElement = e; e.children.push(c); return c; },
    append(...cs) { cs.forEach(c => typeof c === 'object' && e.appendChild(c)); },
    prepend(c) { c.parentElement = e; e.children.unshift(c); },
    remove() { e.isConnected = false; if (e.parentElement) e.parentElement.children = e.parentElement.children.filter(c => c !== e); },
    querySelector: () => element(), querySelectorAll: () => [], addEventListener() {},
    setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; }, hasAttribute(k) { return k in e.attrs; }, removeAttribute(k) { delete e.attrs[k]; },
    focus() { document.activeElement = e; },
    click() { if (!e.disabled && e.onclick) return e.onclick(); },
    get lastChild() { return e.children.at(-1) || null; },
    get textContent() { return text; }, set textContent(v) { text = String(v); e.children = []; },
    get innerHTML() { return html; }, set innerHTML(v) { html = String(v); e.children = []; },
  };
  return e;
}

class AudioStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return proxy(); }
  createOscillator() { return proxy(); }
  createBiquadFilter() { return proxy(); }
  createBufferSource() { return proxy(); }
  createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() {}
}

let serial = 0;
async function run(seed, policy) {
  assert.equal(fingerprint(), sourceHash, 'Source changed during the policy comparison');
  const registry = new Map();
  let raf = null, randomState = seed >>> 0, now = 0;
  globalThis.performance = { now: () => now };
  Date.now = () => 1790000000000 + now;
  const random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
  Math.random = random;
  const canvas = () => ({ ...element('canvas'), width: 480, height: 72, getContext: () => proxy() });
  globalThis.document = {
    body: element('body'), activeElement: null,
    getElementById(id) { if (!registry.has(id)) registry.set(id, element('div', id)); return registry.get(id); },
    createElement: tag => tag === 'canvas' ? canvas() : element(tag), createElementNS: () => canvas(), querySelectorAll: () => [],
  };
  Object.assign(globalThis, {
    window: globalThis, __headless: true, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    location: { search: `?speed=1200&seed=${seed}`, hostname: 'localhost', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, requestAnimationFrame: cb => { raf = cb; },
    fetch: async () => ({ ok: true, json: async () => schedule }), AudioContext: AudioStub,
  });
  await import(`../js/main.js?policyRun=${serial++}`);
  await new Promise(resolve => setImmediate(resolve));
  const game = globalThis.__grunds;
  assert.equal(game.sync.live, false);
  document.getElementById('open').click();
  randomState = seed >>> 0;
  const days = [];
  for (let day = 1; day <= CAMPAIGN.days; day++) {
    assert.equal(game.phase, 'planning');
    const before = game.stats();
    let hedge = before.debt > 0 && policy !== 'passive' && policy !== 'reckless' ? 'settle' : 'hold';   // competent policies clear the tab before re-borrowing
    if (policy === 'conservative') {
      if (!game.exc.contract && before.index <= 1.1) hedge = 'contract_light';
      else if (before.debt > 0) hedge = 'settle';
    }
    if (policy === 'aggressive' && !game.exc.contract) hedge = 'contract_heavy';
    if ((policy === 'forecaster' || policy === 'engaged') && !game.exc.contract) {
      if (before.event === 'rumour_frost') hedge = 'contract_heavy';
      else if (before.event === 'frost_minas' || before.event === 'drought_ea') hedge = 'contract_light';
      else if (before.debt > 0) hedge = 'settle';
    }
    if (policy === 'reckless' && !game.exc.contract) hedge = 'contract_heavy';
    const staffing = policy !== 'passive' && policy !== 'reckless' && day >= 2 && before.staffCondition < .55 ? 'apprentice' : 'work';
    const marketing = { sample: (policy === 'growth' || policy === 'engaged') && day < CAMPAIGN.days, sponsor: (policy === 'growth' || policy === 'engaged' || policy === 'reckless') && day >= 3 && day < CAMPAIGN.days };
    // Competent policies restock the cellar every morning (the Brief's coffee
    // tool); passive and reckless stay naive so the harness keeps a floor.
    if (policy !== 'passive' && policy !== 'reckless') assert.equal(game.stageCellar({ topup: 'restock' }), true);
    assert.equal(game.stageDayPlan({ hedge, staffing, marketing }), true);
    let quote = game.quote;
    let res = await game.commitDayPlan();
    if (!res.ok && hedge !== 'hold' && hedge !== 'settle') {   // the supplier tab is maxed — ride the spot
      assert.equal(game.stageDayPlan({ hedge: 'hold' }), true);
      quote = game.quote;
      res = await game.commitDayPlan();
    }
    assert.equal(res.ok, true, JSON.stringify(res));
    let frames = 0;
    while (game.phase === 'trading' && frames++ < 1000) {
      if (game.modals.top() === 'offer') document.getElementById(policy === 'engaged' ? 'offer-yes' : 'offer-no').click();
      const s = game.stats();
      if (policy !== 'passive' && policy !== 'reckless' && !game.paused) {
        const batch = document.getElementById('prebatch');
        if (s.queue >= 6 && s.dayMin < 960 && !batch.disabled) batch.click();
        const price = document.getElementById('reprice');
        if (s.queue >= 12 && s.dayMin >= 800 && !price.disabled) price.click();
      }
      assert.equal(typeof raf, 'function');
      const cb = raf; raf = null; now += 100; cb(now);
    }
    assert.equal(game.phase, 'review', `${seed}/${policy}/day${day} did not finish within frame budget`);
    const s = game.stats(), receipt = game.lastDayReceipt;
    assert.equal(s.dayMin, 1260);
    assert.ok(Number.isFinite(receipt.netToday));
    // Ledger model: sacks ride the supplier tab (the verdict nets debt once);
    // emergency cups, batch prep and the Gesha hold bill the till directly.
    // The till at close is already net of every cash line, so closeDay's
    // netToday is till − matcha cogs − ops − fee − interest with no gross-ups.
    const beanBill = s.cogs;
    assert.ok(Math.abs(receipt.netToday - (s.till - beanBill - s.ops.total - s.feeToday - s.interestToday)) < 1e-7);
    assert.equal(s.feeToday, quote.contractFee);
    // Reconcile against the campaign ledger the same way it compounds:
    // netWorth = Σ(till) − Σ(cogs) − Σ(ops) − settledPaid − debt_end, where
    // debt_end = Σ(fees + interest + sacks) − Σ(settled). Settlement is
    // netWorth-neutral (settledPaid cancels the debt relief), fees/interest
    // are P&L accruals that reach netWorth through debt, and sacks are the
    // one cost that touches neither the till nor cCost — so the day row is
    // netToday minus the day's tab-funded sacks.
    const sackSpend = s.sackSpend || 0;
    const dayCashNet = s.till - beanBill - s.ops.total - s.feeToday - s.interestToday - sackSpend;
    assert.ok(Math.abs(dayCashNet - (receipt.netToday - sackSpend)) < 1e-7);
    days.push({ day, hedge, staffing, marketing, event: s.event, index: s.index, revenue: s.till, beanCost: beanBill, ops: { ...s.ops }, net: dayCashNet,
      served: s.served + s.servedRetail, balked: s.balked, defections: s.defections, rivalChoices: s.rivalChoices,
      rep: s.rep, staffCondition: s.staffCondition, awareness: s.awareness, hedgeSavings: s.hedgeSavings, contractFee: s.feeToday, interest: s.interestToday,
      debt: s.debt, settledPaid: s.settledPaid, frames });
    assert.equal(game.continueFromReview(), true);
    if (game.phase === 'finale') break;   // the supplier called the tab — insolvent
  }
  const end = game.stats();
  assert.equal(game.phase, 'finale');
  try {
    const lhs = days.reduce((n, d) => n + d.net, 0);
    const rhs = end.netWorth;
    if (Math.abs(lhs - rhs) >= 1e-6) {
      for (const d of days) original.error('RECONCILE day:', JSON.stringify({ day: d.day, net: Math.round(d.net * 100) / 100, till: Math.round(d.revenue), bean: Math.round(d.beanCost), ops: Math.round(d.ops?.total), fee: d.contractFee, interest: Math.round((d.interest || 0) * 100) / 100, settle: d.settledPaid, debt: Math.round((d.debt || 0) * 100) / 100, hedge: d.hedge }));
      original.error('RECONCILE end:', JSON.stringify({ netWorth: Math.round(end.netWorth * 100) / 100, debt: Math.round(end.debt * 100) / 100, settledPaid: end.settledPaid, days: days.length }));
    }
  } catch {}
  assert.ok(Math.abs(days.reduce((n, d) => n + d.net, 0) - end.netWorth) < 1e-6, 'Daily and campaign ledgers must reconcile');
  const sum = key => days.reduce((n, d) => n + d[key], 0);
  return { seed, policy, netWorth: end.netWorth, reputation: end.rep, served: sum('served'), balked: sum('balked'), rivalChoices: sum('rivalChoices'),
    verdict: campaignVerdict(end.netWorth, end.rep), worstDayNet: Math.min(...days.map(d => d.net)), negativeDays: days.filter(d => d.net < 0).length,
    hedgeBenefitAfterFees: sum('hedgeSavings') - sum('contractFee') - sum('interest'),
    marketingSpend: days.reduce((n, d) => n + d.ops.marketing + d.ops.sampling, 0), days };
}

// Same-lot probe: run one policy with a fixed house lot + restock discipline.
// cellar: { lot, topup } staged via game.stageCellar before every commit.
// Returns the run() record (netWorth, served, verdict, days[]).
async function runWithCellar(seed, policy, cellar) {
  assert.equal(fingerprint(), sourceHash, 'Source changed during the policy comparison');
  const registry = new Map();
  let raf = null, randomState = seed >>> 0, now = 0;
  globalThis.performance = { now: () => now };
  Date.now = () => 1790000000000 + now;
  const random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
  Math.random = random;
  const canvas = () => ({ ...element('canvas'), width: 480, height: 72, getContext: () => proxy() });
  globalThis.document = {
    body: element('body'), activeElement: null,
    getElementById(id) { if (!registry.has(id)) registry.set(id, element('div', id)); return registry.get(id); },
    createElement: tag => tag === 'canvas' ? canvas() : element(tag), createElementNS: () => canvas(), querySelectorAll: () => [],
  };
  Object.assign(globalThis, {
    window: globalThis, __headless: true, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    location: { search: `?speed=1200&seed=${seed}`, hostname: 'localhost', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, requestAnimationFrame: cb => { raf = cb; },
    fetch: async () => ({ ok: true, json: async () => schedule }), AudioContext: AudioStub,
  });
  await import(`../js/main.js?cellarRun=${serial++}`);
  await new Promise(resolve => setImmediate(resolve));
  const game = globalThis.__grunds;
  document.getElementById('open').click();
  randomState = seed >>> 0;
  const days = [];
  for (let day = 1; day <= CAMPAIGN.days; day++) {
    assert.equal(game.phase, 'planning');
    assert.equal(game.stageCellar(cellar), true, `stageCellar rejected ${JSON.stringify(cellar)}`);
    assert.equal(game.stageDayPlan({ hedge: 'hold', staffing: 'work', marketing: {} }), true);
    const res = await game.commitDayPlan();
    assert.equal(res.ok, true, JSON.stringify(res));
    let frames = 0;
    while (game.phase === 'trading' && frames++ < 1000) {
      if (game.modals.top() === 'offer') document.getElementById('offer-no').click();
      assert.equal(typeof raf, 'function');
      const cb = raf; raf = null; now += 100; cb(now);
    }
    assert.equal(game.phase, 'review', `${seed}/${cellar.lot}/day${day} did not finish`);
    const s = game.stats();
    days.push({ day, net: s.till - s.cogs - s.ops.total - s.feeToday - s.interestToday - (s.sackSpend || 0),
      served: s.served + s.servedRetail, emergencyCups: s.emergencyCups, beanSpend: s.beanSpend,
      houseLot: s.houseLot, houseStock: s.houseStock, till: s.till });
    assert.equal(game.continueFromReview(), true);
    if (game.phase === 'finale') break;
  }
  const end = game.stats();
  const sum = key => days.reduce((n, d) => n + d[key], 0);
  return { seed, cellar, netWorth: end.netWorth, served: sum('served'),
    emergencyCups: sum('emergencyCups'), beanSpend: days.reduce((n, d) => n + d.beanSpend, 0), days };
}

try {
  if (process.argv[2] === '--single') {
    original.log(JSON.stringify(await run(Number(process.argv[3]), process.argv[4])));
  } else if (process.argv[2] === '--cellar') {
    // node web/test/balance-policies.mjs --cellar <seed> <lot> <topup>
    original.log(JSON.stringify(await runWithCellar(Number(process.argv[3]), 'passive',
      { lot: process.argv[4], topup: process.argv[5] || 'restock' })));
  } else {
  const isolatedRun = (seed, policy) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--single', String(seed), policy], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
  const runs = [];
  for (const seed of seeds) for (const policy of policies) runs.push(isolatedRun(seed, policy));
  const repeat = isolatedRun(seeds[0], policies[0]);
  assert.deepEqual(repeat, runs[0], 'Same seed and policy must reproduce the same outcome');
  assert.equal(fingerprint(), sourceHash, 'Source changed during evaluation');
  const summary = policies.map(policy => {
    const rows = runs.filter(r => r.policy === policy);
    const mean = key => rows.reduce((n, r) => n + r[key], 0) / rows.length;
    const verdicts = {};
    for (const r of rows) verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
    return { policy, runs: rows.length, meanNetWorth: mean('netWorth'), minNetWorth: Math.min(...rows.map(r => r.netWorth)), maxNetWorth: Math.max(...rows.map(r => r.netWorth)),
      meanReputation: mean('reputation'), meanServed: mean('served'), meanBalked: mean('balked'), meanHedgeBenefitAfterFees: mean('hedgeBenefitAfterFees'),
      verdicts, meanWorstDayNet: mean('worstDayNet'), totalNegativeDays: rows.reduce((n, r) => n + r.negativeDays, 0) };
  });
  const report = { sourceHash, seeds, policies, assumptions: ['Local simulator, no identity perk, speed1200, deterministic Math.random reset immediately before play', 'All offers and incidents declined through the same modal action handler', 'All active policies batch at queue>=6 before16:00 and discount at queue>=12 after13:20; apprentice when eligible', 'Growth samples days1-4 and sponsors days3-4; conservative locks light at index<=1.1 or settles outstanding debt; aggressive buys heavy whenever uncovered; forecaster/engaged buy heavy after a rumour day and light after a spike; engaged also accepts offers and incidents; reckless buys heavy whenever uncovered, pushes Ruth, never works the queue; a rejected contract (supplier tab limit) falls back to riding the spot', 'Each campaign runs in a fresh Node process; fixed 100ms frame clock, fixed Date.now origin, and UI animation timers disabled; no browser, live backend, or human playtest', 'Ten-seed diagnostic pilot. Verdicts come from the shared campaignVerdict ladder; still not an isolated marketing ROI estimate'], summary, runs };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  original.log(JSON.stringify({ sourceHash, seeds, replayVerified: true, summary, artifact: process.argv[2] || null }, null, 2));
  }
} finally {
  console.log = original.log; console.debug = original.debug; console.warn = original.warn; console.error = original.error;
  globalThis.setTimeout = original.timeout; globalThis.setInterval = original.interval; Math.random = original.random;
  globalThis.performance = original.performance; Date.now = original.dateNow;
}
