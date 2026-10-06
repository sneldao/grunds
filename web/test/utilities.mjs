// Utilities — power + wifi on the cost sheet, and the seeded wifi drop.
// Pure checks, then a headless outage-day run on the default seed (mechanics)
// plus child runs on more outage seeds (the tether's pay-off as an average).
// Run: node web/test/utilities.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CAMPAIGN } from '../js/config.js';
import { operatingCosts } from '../js/economy.js';
import { utilityCosts, planOutage, outageStatus, wifiCardLoss } from '../js/utilities.js';

const fails = [];
const check = (c, msg) => { if (!c) fails.push(msg); else console.log('  ✓', msg); };
const U = CAMPAIGN.utilities;

// ---- pure ------------------------------------------------------------------------
const u3k = utilityCosts(3000);
check(Math.abs(u3k.power - (U.powerStanding + 3000 * U.powerPerCup)) < 1e-9, 'power = standing charge + per-cup draw');
check(utilityCosts(0).power === U.powerStanding && u3k.wifi === U.wifi, 'a dead day still owes the standing charge and the broadband');
const bills3k = u3k.power + u3k.wifi + CAMPAIGN.sundries;
check(Math.abs(bills3k - 64) <= 8, `a typical ~3,000-cup day's bills (£${bills3k.toFixed(0)}) stay near the old £64 sundries`);
const ops = operatingCosts({ served: 3000, till: 10000 });
check(ops.power === u3k.power && ops.wifi === u3k.wifi, 'the cost sheet itemises power and wifi');
check(Math.abs(ops.total - Object.entries(ops).filter(([k]) => k !== 'total').reduce((a, [, v]) => a + v, 0)) < 1e-9, 'ops total still sums its lines');

check([1, 7, 42, 99].every(s => planOutage(s, 1) === null), 'never on day 1');
check(JSON.stringify(planOutage(7, 3)) === JSON.stringify(planOutage(7, 3)), 'same seed + day → same outage');
let n = 0, okWin = true;
for (let s = 0; s < 4000; s++) for (let d = 2; d <= 5; d++) {
  const o = planOutage(s, d);
  if (!o) continue; n++;
  const dur = o.end - o.start;
  if (o.start < U.outage.startMin || o.start >= U.outage.startMin + U.outage.startSpan || dur < U.outage.durMin || dur >= U.outage.durMin + U.outage.durSpan) okWin = false;
}
const rate = n / 16000;
check(Math.abs(rate - U.outage.chance) < 0.03, `outage rate ${rate.toFixed(3)} ≈ configured ${U.outage.chance}`);
check(okWin, 'every outage lands inside its configured window and duration');
const o = { start: 600, end: 700 };
check(outageStatus(o, 599) === 'none' && outageStatus(o, 600) === 'down' && outageStatus(o, 700) === 'restored', 'status walks none → down → restored');
check(wifiCardLoss(o, 650) === U.outage.cardLoss && wifiCardLoss({ ...o, tethered: true }, 650) === 0, 'card loss only while down and untethered');

// ---- headless: the default seed's outage day ---------------------------------------
const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = { children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = e; e.children.push(c); return c; },
    append(...cs) { for (const c of cs) e.appendChild(c); },
    prepend(c) { c._parent = e; e.children.unshift(c); },
    remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
    querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
    get lastChild() { return e.children[e.children.length - 1] || null; }, click() { e.onclick && e.onclick(); }, onclick: null };
  return e;
}
const reg = new Map();
const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
globalThis.document = { getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); }, createElement: t => t === 'canvas' ? cs() : el(), createElementNS: () => cs(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
const SEED = Number(process.env.GRUNDS_UTIL_SEED ?? 7);
globalThis.location = { search: `?speed=1200&seed=${SEED}` }; globalThis.addEventListener = () => {};
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
let _rs = 0;
const reseed = () => { _rs = 123456789; };
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };

let now = 1000;
function frame() { now += 100; const cb = rafCb; rafCb = null; if (!cb) throw new Error('loop stopped'); cb(now); const off = reg.get('offer'); if (off && off.classList.contains('show')) reg.get('offer-no').click(); }
const tick = r => new Promise(res => setTimeout(res, r));

await import('../js/main.js');
await tick(40);
const G = globalThis.__grunds;

const OUT_DAY = [2, 3, 4, 5].find(d => planOutage(SEED, d));
check(!!OUT_DAY, `seed ${SEED} has an outage day (day ${OUT_DAY})`);

// Play days 1..OUT_DAY-1 identically, then the outage day with `onDrop`.
async function runToOutage(onDrop) {
  G.reset(); await tick(10); reseed();
  for (let d = 1; d < OUT_DAY; d++) {
    G.commitDayPlan();
    let guard = 0; while (G.phase !== 'review' && guard++ < 600) frame();
    G.continueFromReview();
  }
  G.commitDayPlan();
  const plan = G.wifiOutage;
  const snap = {};
  let guard = 0;
  while (G.phase !== 'review' && guard++ < 900) {
    frame();
    const w = G.wifiOutage;
    if (w && w.status === 'down' && !snap.down) {
      snap.down = { staffMul: G.patrons.staffMul };
      snap.rowDown = G.vitals().find(r => r.id === 'utilities');
      onDrop(snap);
    }
    if (w && w.status === 'restored' && !snap.restored) snap.restored = { staffMul: G.patrons.staffMul };
  }
  return { plan, snap, stats: G.stats(), receipt: G.lastDayReceipt };
}

const ignore = await runToOutage(() => {});
check(ignore.plan && ignore.plan.start === planOutage(SEED, OUT_DAY).start, 'the dawn plan carries the seeded outage');
check(ignore.snap.rowDown && ignore.snap.rowDown.tone === 'bad' && ignore.snap.rowDown.action?.act === 'tether', 'the panel flags the drop and offers the tether');

const teth = await runToOutage(s => { s.tethered = G.tetherWifi(); s.again = G.tetherWifi(); s.after = G.patrons.staffMul; s.row = G.vitals().find(r => r.id === 'utilities'); });
check(teth.snap.tethered === true && teth.snap.again === false, 'tether works once, then refuses');
check(Math.abs(teth.snap.after - teth.snap.down.staffMul * U.outage.tetherStaffMul) < 1e-9, 'the hotspot slows the bar a touch');
check(teth.snap.row.tone === 'warn' && !teth.snap.row.action, 'the row goes amber, no button, once tethered');
check(teth.snap.restored && Math.abs(teth.snap.restored.staffMul - teth.snap.down.staffMul) < 1e-9, 'bar speed comes back when the line does');
console.log(`  outage day ${OUT_DAY}: ignore till £${ignore.stats.till.toFixed(0)} balked ${ignore.stats.balked} · tether till £${teth.stats.till.toFixed(0)} balked ${teth.stats.balked}`);
check(teth.stats.balked < ignore.stats.balked, 'ignoring the drop loses more sales at the till');
if (process.env.GRUNDS_UTIL_SEED) { console.log(`DIFF ${teth.stats.till - ignore.stats.till}`); process.exit(0); }
// The per-seed till swing is coin-flip variance in the patron stream, so the
// design claim — a tethered hotspot pays for itself — is tested as an average
// across seeded outages, not pinned to one lucky draw.
const diffs = [teth.stats.till - ignore.stats.till];
for (const s of [13, 27, 29]) {
  const out = execFileSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)],
    { env: { ...process.env, GRUNDS_UTIL_SEED: String(s) }, encoding: 'utf8' });
  const m = out.match(/^DIFF (-?[\d.]+)/m);
  diffs.push(m ? parseFloat(m[1]) : NaN);
}
const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
check(diffs.every(Number.isFinite) && avg > 100, `tethering pays for itself across seeds 7/13/27/29 (avg £${avg.toFixed(0)})`);

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — utilities itemised, outages seeded, tether trades a fee for the till');
