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
    let hedge = 'hold';
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
    assert.ok(Math.abs(receipt.netToday - (s.till - s.cogs - s.ops.total - s.feeToday - s.interestToday)) < 1e-7);
    assert.equal(s.feeToday, quote.contractFee);
    days.push({ day, hedge, staffing, marketing, event: s.event, index: s.index, revenue: s.till, beanCost: s.cogs, ops: { ...s.ops }, net: receipt.netToday,
      served: s.served + s.servedRetail, balked: s.balked, defections: s.defections, rivalChoices: s.rivalChoices,
      rep: s.rep, staffCondition: s.staffCondition, awareness: s.awareness, hedgeSavings: s.hedgeSavings, contractFee: s.feeToday, interest: s.interestToday, frames });
    assert.equal(game.continueFromReview(), true);
    if (game.phase === 'finale') break;   // the supplier called the tab — insolvent
  }
  const end = game.stats();
  assert.equal(game.phase, 'finale');
  assert.ok(Math.abs(days.reduce((n, d) => n + d.net, 0) - end.netWorth) < 1e-6, 'Daily and campaign ledgers must reconcile');
  const sum = key => days.reduce((n, d) => n + d[key], 0);
  return { seed, policy, netWorth: end.netWorth, reputation: end.rep, served: sum('served'), balked: sum('balked'), rivalChoices: sum('rivalChoices'),
    verdict: campaignVerdict(end.netWorth, end.rep), worstDayNet: Math.min(...days.map(d => d.net)), negativeDays: days.filter(d => d.net < 0).length,
    hedgeBenefitAfterFees: sum('hedgeSavings') - sum('contractFee') - sum('interest'),
    marketingSpend: days.reduce((n, d) => n + d.ops.marketing + d.ops.sampling, 0), days };
}

try {
  if (process.argv[2] === '--single') {
    original.log(JSON.stringify(await run(Number(process.argv[3]), process.argv[4])));
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
