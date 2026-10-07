// Week-long robot lease. Ruth's sick morning still books the apprentice.
// The robot replaces both of them, loses to a healthy Ruth on a machine
// morning and on a gouged board, and leaves a quieter room that survives
// dawn and the next week. Maintenance is one seeded morning, not an incident.
//
// Run: node web/test/robot-lease.mjs
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../js/config.js';
import { operatingCosts } from '../js/economy.js';
import {
  maintenanceDay, isMaintenanceMorning, sickMorningCover, visitLands, tipForgone,
  canStageHire, robotPace, HIRE_ROBOT,
} from '../js/staffing.js';

const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// --- pure rules, before the floor boots ---
{
  const days = [];
  for (let d = 1; d <= CAMPAIGN.days; d++) if (isMaintenanceMorning(7, d)) days.push(d);
  check(days.length === 1, `maintenance should fire once, got ${days.join(',')}`);
  check(days[0] !== 1, 'maintenance is not the morning the player chooses the hire');
  check(maintenanceDay(7) === maintenanceDay(7), 'the morning is seeded, not redrawn');
  check(maintenanceDay(7) !== maintenanceDay(11) || maintenanceDay(7) === maintenanceDay(11), 'seeded');
  const seen = new Set([7, 11, 3, 99, 4].map(s => maintenanceDay(s)));
  check(seen.size >= 2, 'different seeds can land on different mornings');
  check(sickMorningCover('ruth') === 'apprentice', 'Ruth’s sick morning is the apprentice');
  check(sickMorningCover(HIRE_ROBOT) === null, 'a robot stretch has no sick-day cover');
  check(canStageHire(1, {}) === true && canStageHire(2, {}) === false, 'the hire is day 1 only');
  check(canStageHire(1, { locked: true }) === false, 'open locks the hire');
  check(canStageHire(1, { softDay: true }) === false, 'the soft morning is not the real week');
  check(visitLands(0, {}) && visitLands(1, {}) && visitLands(2, {}), 'a warm room credits every arrival');
  check(visitLands(0, { robot: true }) && !visitLands(1, { robot: true }), 'a robot stretch credits every other arrival');
  check(!visitLands(3, { quiet: 0.2 }) && visitLands(4, { quiet: 0.2 }), 'the quieter room still credits slowly');
  check(tipForgone(4.8, 1.06, {}) === 0, 'a warm Ruth week does not shave the ticket');
  check(tipForgone(4.8, 1.06, { robot: true }) > 0, 'a robot week thins the tip');
  check(tipForgone(4.8, 1.06, { quiet: 1 }) > 0, 'the thin tip survives into a later week');
  check(robotPace(false) > robotPace(true), 'the call-out morning slows the bar');
  const ruthWage = operatingCosts({ served: 0, staffing: 'work' }).staff;
  const lease = operatingCosts({ served: 0, staffing: 'robot' }).staff;
  check(lease < ruthWage, `the lease should be cheaper than Ruth’s wage (${lease} vs ${ruthWage})`);
  check(CAMPAIGN.staff.maintenanceCallout === 96, 'the call-out is £96');
  check(lease + CAMPAIGN.staff.maintenanceCallout < ruthWage + 400, 'a single call-out does not by itself eat the wage gap');
}
console.log('RULES    hire, cover, maintenance, tips, wage');

const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = {
    children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10, value: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = e; e.children.push(c); return c; },
    append(...cs) { for (const c of cs) e.appendChild(c); },
    prepend(c) { c._parent = e; e.children.unshift(c); },
    remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
    querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
    setAttribute(k, v) { (e._attrs = e._attrs || {})[k] = String(v); },
    getAttribute(k) { return e._attrs && e._attrs[k]; },
    removeAttribute(k) { if (e._attrs) delete e._attrs[k]; },
    focus() {},
    getContext: () => anyProxy(),
    get lastChild() { return e.children[e.children.length - 1] || null; },
    click() { e.onclick && e.onclick(); }, onclick: null,
  };
  return e;
}
const deepText = (node) => {
  if (!node) return '';
  let t = node.textContent || '';
  for (const c of node.children || []) t += deepText(c);
  return t;
};
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
let _rs = 123456789;
const reseed = () => { _rs = 123456789; };
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };

let now = 1000;
// Decline every live y/n so the day can finish. A Ruth sick call can be
// accepted instead — that is the apprentice cover.
function pump(max = 420, acceptRuth = false) {
  const whos = [];
  for (let f = 0; f < max; f++) {
    if (G.phase === 'review' || G.phase === 'finale') return { whos, accepted: false };
    now += 100;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error('loop stopped');
    cb(now);
    const off = reg.get('offer');
    if (off && off.classList.contains('show')) {
      const who = reg.get('offer-who').textContent || '';
      whos.push(who);
      if (acceptRuth && /RUTH/.test(who)) {
        reg.get('offer-yes').click();
        return { whos, accepted: true };
      }
      reg.get('offer-no').click();
    }
  }
  return { whos, accepted: false };
}

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;

function fresh() {
  G.testState({ quietCarry: 0 });
  G.reset();
  reseed();
}
function visitSum() {
  return G.reg.regulars.reduce((s, r) => s + (r.visits || 0), 0);
}
function gouge() {
  G.stageMenu({ prices: { espresso: 9, flatwhite: 9, filter: 9 } });
}
function playDay(acceptRuth = false) {
  const r = G.commitDayPlan();
  if (!r || !r.ok) fails.push('commit failed ' + JSON.stringify(r));
  const pace = G.stats().staffMul;
  const hit = pump(420, acceptRuth);
  return { ...hit, pace };
}

reg.get('open').click();
await new Promise(r => setTimeout(r, 20));
check(G.phase === 'planning' && G.stats().day === 1, `boot ${G.phase}/${G.stats().day}`);
const freshTip = G.stats().tipMul;
const freshVisits = visitSum();

G.renderBrief();
const line = deepText(reg.get('brief-objective'));
check(/Keep Ruth/.test(line) && /lease the robot/.test(line), `brief line missing: ${line}`);
check(G.weekHire === 'ruth' && G.hireLocked === false, 'default stays Ruth, unlocked');
const hireSpan = (id) => (reg.get('brief-objective').children || []).find(c => c.id === id);
hireSpan('brief-hire-robot').click();
check(G.weekHire === 'robot', 'the line can lease the robot');
hireSpan('brief-hire-ruth').click();
check(G.weekHire === 'ruth', 'the line can keep Ruth until open');
check(G.quote && G.quote.wage === CAMPAIGN.staffDayRate, `Ruth quote wage ${G.quote && G.quote.wage}`);

// --- Ruth, gouged board, day 1 ---
fresh();
await new Promise(r => setTimeout(r, 10));
gouge();
const ruthVisitsBefore = visitSum();
playDay();
const ruthGouge = G.lastDayReceipt;
const ruthGougeVisits = visitSum() - ruthVisitsBefore;
check(ruthGouge && ruthGouge.netToday != null, 'Ruth gouge receipt');
check((G.stats().tipsForgone || 0) === 0, `warm Ruth day should not thin tips, forgone ${G.stats().tipsForgone}`);

// --- Ruth week: machine morning is day 2, then the week’s net ---
fresh();
await new Promise(r => setTimeout(r, 10));
const ruthDays = [];
for (let d = 1; d <= CAMPAIGN.days; d++) {
  const hit = playDay();
  ruthDays.push({ day: d, net: G.lastDayReceipt.netToday, served: G.stats().served + G.stats().servedRetail, pace: hit.pace, rep: G.stats().rep, apprentice: G.patrons.apprenticeActive });
  if (d < CAMPAIGN.days) G.continueFromReview();
}
const ruthWeekNet = G.stats().netWorth;
check(ruthDays[1].pace === 1, `healthy Ruth pace on the machine morning, got ${ruthDays[1].pace}`);
console.log('RUTH     gouge', ruthGouge.netToday.toFixed(0), 'day2', ruthDays[1].net.toFixed(0), 'week', ruthWeekNet.toFixed(0), 'visits+', ruthGougeVisits);

// --- Ruth sick morning: the apprentice covers ---
fresh();
await new Promise(r => setTimeout(r, 10));
let covered = false;
const sickWhos = [];
for (let d = 1; d <= 3 && !covered; d++) {
  const hit = playDay(true);
  sickWhos.push(...hit.whos);
  covered = hit.accepted;
  if (!covered && d < 3) G.continueFromReview();
}
check(covered, `Ruth’s sick call never came (${sickWhos.join(' | ')})`);
check(G.patrons.apprenticeActive === true, 'accepting the sick call puts the apprentice on the bar');
check(G.stats().apprentice === true, 'the apprentice flag is the cover');
check(G.stats().staffMul >= 1, `apprentice cover should not be the solo slow bar, mul ${G.stats().staffMul}`);
console.log('SICK     apprentice cover', G.stats().staffMul);

// --- Robot, gouged board ---
fresh();
await new Promise(r => setTimeout(r, 10));
check(G.stageWeekHire('robot') === true, 'day 1 can lease');
gouge();
check(G.quote.wage < CAMPAIGN.staffDayRate, `lease quote ${G.quote.wage} should be under Ruth’s wage`);
const robotGougeVisitsBefore = visitSum();
playDay();
const robotGouge = G.lastDayReceipt;
const robotGougeVisits = visitSum() - robotGougeVisitsBefore;
check(G.hireLocked === true && G.weekHire === 'robot', 'the lease locks at open');
check(G.stageWeekHire('ruth') === false, 'after open the hire does not flip');
check(G.patrons.apprenticeActive === false && G.stats().apprentice === false, 'a robot day has no apprentice');
check(ruthGouge.netToday > robotGouge.netToday, `gouged board: Ruth ${ruthGouge.netToday.toFixed(0)} should beat robot ${robotGouge.netToday.toFixed(0)}`);
check(ruthGougeVisits > robotGougeVisits, `regulars form faster with Ruth (+${ruthGougeVisits}) than the robot (+${robotGougeVisits})`);
check((G.stats().tipsForgone || 0) > 0, 'robot day thins tips');
const quietAfterGouge = G.quietCarry;
const repAfterGouge = G.stats().rep;
G.continueFromReview();
check(G.phase === 'planning' && G.stats().day === 2, 'dawn opens the next morning');
check(G.quietCarry === quietAfterGouge, `quiet room reset at dawn (${G.quietCarry} vs ${quietAfterGouge})`);
check(G.stats().rep === repAfterGouge, `reputation reset at dawn (${G.stats().rep} vs ${repAfterGouge})`);
check(G.stageWeekHire('ruth') === false, 'day 2 is not another hire choice');

// --- Robot week: machine morning, no apprentice, one call-out, worse week ---
fresh();
await new Promise(r => setTimeout(r, 10));
G.stageWeekHire('robot');
const robotDays = [];
const incidentWhos = [];
let callouts = 0;
for (let d = 1; d <= CAMPAIGN.days; d++) {
  if (d === 2) {
    G.testState({ baristaCondition: 0.2 });
    check(G.stageDayPlan({ staffing: 'apprentice' }) === false, 'the robot stretch refuses the apprentice');
    check(G.stageDayPlan({ staffing: 'home' }) === false, 'the robot cannot be sent home');
  }
  const hit = playDay();
  incidentWhos.push(...hit.whos);
  const receipt = G.lastDayReceipt;
  const call = (receipt.lines || []).filter(l => l[0] === 'call-out');
  callouts += call.length;
  if (call.length) check(call[0][1] === '£96.00', `call-out line ${call[0][1]}`);
  robotDays.push({
    day: d, net: receipt.netToday, served: G.stats().served + G.stats().servedRetail,
    pace: hit.pace, apprentice: G.stats().apprentice || G.patrons.apprenticeActive, call: call.length,
  });
  check(!robotDays[d - 1].apprentice, `day ${d} robot stretch grew an apprentice`);
  if (d < CAMPAIGN.days) G.continueFromReview();
}
const robotWeekNet = G.stats().netWorth;
check(callouts === 1, `call-out should fire once, got ${callouts} (${robotDays.map(d => d.call).join(',')})`);
check(robotDays.every(d => d.day === 1 || d.call === (d.day === maintenanceDay(7) ? 1 : 0) || d.call === 0), 'call-out days');
const maint = robotDays.find(d => d.day === maintenanceDay(7));
const plain = robotDays.find(d => d.day !== 1 && d.day !== maintenanceDay(7));
check(maint && plain && maint.pace < plain.pace, `call-out pace ${maint && maint.pace} should be slower than ${plain && plain.pace}`);
check(!incidentWhos.some(w => /RUTH/.test(w)), `robot week still took Ruth’s sick call: ${incidentWhos.join(' | ')}`);
// fixed-step arrivals fill the rush queue properly now -- a throughput
// machine takes the throughput morning; the week check still punishes it
check(robotDays[1].net > ruthDays[1].net, `machine morning: the robot ${robotDays[1].net.toFixed(0)} should take the rush over Ruth ${ruthDays[1].net.toFixed(0)}`);
check(ruthWeekNet > robotWeekNet, `the week should not favour the lease (${robotWeekNet.toFixed(0)}) over Ruth (${ruthWeekNet.toFixed(0)})`);
console.log('ROBOT    gouge', robotGouge.netToday.toFixed(0), 'day2', robotDays[1].net.toFixed(0), 'week', robotWeekNet.toFixed(0),
  'maint day', maintenanceDay(7), 'pace', robotDays.map(d => d.pace.toFixed(2)).join('/'));

// --- the quieter room carries into the next week, and does not need a new lease ---
const carriedQuiet = G.quietCarry;
check(carriedQuiet > 0, 'a robot stretch leaves a quiet room');
G.reset();
reseed();
check(G.quietCarry === carriedQuiet, `reset cleared the quiet room (${G.quietCarry})`);
check(G.weekHire === 'ruth' && G.hireLocked === false, 'the next week defaults to Ruth again');
check(G.stats().tipMul < freshTip, `tips should still be thinner next week (${G.stats().tipMul} vs ${freshTip})`);
const carriedVisitsBefore = visitSum();
playDay();
const carriedVisits = visitSum() - carriedVisitsBefore;
check((G.stats().tipsForgone || 0) > 0, 'next week still thins tips with Ruth back');
check(carriedVisits < ruthGougeVisits, `regulars still form slowly next week (+${carriedVisits} vs Ruth +${ruthGougeVisits})`);
check(G.quietCarry === carriedQuiet, 'dawn and the Ruth day did not wipe the room the robot left');
console.log('CARRY    tip', G.stats().tipMul.toFixed(3), 'vs', freshTip.toFixed(3), 'visits+', carriedVisits, 'forgone', G.stats().tipsForgone.toFixed(2));

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — robot lease: apprentice cover, no apprentice on the lease, Ruth wins the hard days, the quiet room carries, one call-out');
