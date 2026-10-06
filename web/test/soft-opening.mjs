import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TOOL_IDS } from '../js/curriculum.js';
import { LOT_CATALOG } from '../js/lots.js';
import { dossierLines } from '../js/identity.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));
const LOGS = '/tmp/grunds-soft-logs';
try { mkdirSync(LOGS, { recursive: true }); } catch {}
const fails = [];
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else fails.push(`${name}: ${detail || 'failed'}`);
}

const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
    if (k === 'then') return undefined;
    return anyProxy();
  },
  set: () => true, apply: () => anyProxy(),
});

function camel(s) { return s.replace(/-([a-z])/g, (m, c) => c.toUpperCase()); }
function matchTok(el, tok) {
  if (!el || el.nodeType !== 1) return false;
  const m = tok.match(/^([\w-]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
  if (m && (m[1] || m[2])) {
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2]) {
      const v = m[2].startsWith('data-')
        ? el.dataset[camel(m[2].slice(5))]
        : el.getAttribute(m[2]);
      if (m[3] === undefined ? (v === undefined || v === null) : v !== m[3]) return false;
    }
    return true;
  }
  if (tok.startsWith('#')) return el.id === tok.slice(1);
  if (tok.startsWith('.')) return el.classList.contains(tok.slice(1));
  return el.tagName === tok.toUpperCase();
}
function chainOk(el, toks) {
  if (toks.length === 1) return true;
  let a = el.parentElement;
  for (let i = toks.length - 2; i >= 0 && a; i--) {
    while (a && !matchTok(a, toks[i])) a = a.parentElement;
    if (!a) return false;
    a = a.parentElement;
  }
  return true;
}
function collect(el, pred, out = []) {
  for (const c of el.children || []) { if (pred(c)) out.push(c); collect(c, pred, out); }
  return out;
}
function textNode(v) {
  const n = { nodeType: 3, v: String(v), _parent: null };
  Object.defineProperty(n, 'parentElement', { get: () => n._parent });
  Object.defineProperty(n, 'textContent', { get: () => n.v, set: x => { n.v = String(x); } });
  return n;
}
function makeEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(), nodeType: 1,
    children: [], _parent: null,
    id: '', value: '', dataset: {}, _attrs: {},
    disabled: false, hidden: false, inert: false, open: false,
    _classSet: new Set(),
    onclick: null,
    appendChild(c) {
      if (typeof c === 'string') c = textNode(c);
      if (c._parent) { const i = c._parent.children.indexOf(c); if (i >= 0) c._parent.children.splice(i, 1); }
      c._parent = el; el.children.push(c); return c;
    },
    append(...cs) { for (const c of cs) el.appendChild(c); },
    prepend(c) {
      if (typeof c === 'string') c = textNode(c);
      if (c._parent) { const i = c._parent.children.indexOf(c); if (i >= 0) c._parent.children.splice(i, 1); }
      c._parent = el; el.children.unshift(c);
    },
    remove() { const pr = el._parent; if (pr) { const i = pr.children.indexOf(el); if (i >= 0) { pr.children.splice(i, 1); el._parent = null; } } },
    replaceWith(n) { const pr = el._parent; if (pr) { const i = pr.children.indexOf(el); if (i >= 0) { pr.children[i] = n; n._parent = pr; el._parent = null; } } },
    setAttribute(k, v) {
      el._attrs[k] = String(v);
      if (k === 'id') el.id = String(v);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.style.cssText = String(v);
      else if (k === 'inert') el.inert = true;
      else if (k === 'hidden') el.hidden = true;
      else if (k === 'disabled') el.disabled = true;
      else if (k === 'open') el.open = true;
      else if (k.startsWith('data-')) el.dataset[camel(k.slice(5))] = String(v);
    },
    getAttribute(k) {
      if (k === 'id') return el.id || undefined;
      if (k === 'class') return el.className || undefined;
      return el._attrs[k];
    },
    hasAttribute(k) {
      if (k === 'id') return !!el.id;
      if (k === 'class') return el._classSet.size > 0;
      return k in el._attrs;
    },
    removeAttribute(k) {
      delete el._attrs[k];
      if (k === 'inert') el.inert = false;
      if (k === 'hidden') el.hidden = false;
      if (k === 'disabled') el.disabled = false;
      if (k === 'open') el.open = false;
    },
    matches(sel) { return sel.split(',').some(s => matchTok(el, s.trim())); },
    closest(sel) { let a = el; while (a) { if (a.nodeType === 1 && a.matches(sel)) return a; a = a.parentElement; } return null; },
    querySelector(sel) {
      const parts = sel.split(',').map(s => s.trim().split(/\s+/));
      return collect(el, c => c.nodeType === 1 && parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)))[0] || null;
    },
    querySelectorAll(sel) {
      const parts = sel.split(',').map(s => s.trim().split(/\s+/));
      return collect(el, c => c.nodeType === 1 && parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)));
    },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; },
    focus() { globalThis.document.activeElement = el; },
    blur() { if (globalThis.document.activeElement === el) globalThis.document.activeElement = null; },
    click() { if (!el.disabled && el.onclick) el.onclick({ preventDefault() {} }); },
  };
  el.classList = {
    _s: el._classSet,
    add(c) { this._s.add(c); },
    remove(c) { this._s.delete(c); },
    toggle(c, v) { (v === undefined ? !this._s.has(c) : v) ? this._s.add(c) : this._s.delete(c); },
    contains(c) { return this._s.has(c); },
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el._classSet].join(' '); },
    set(v) { el._classSet.clear(); for (const c of String(v).split(/\s+/)) if (c) el._classSet.add(c); },
  });
  const style = {};
  Object.defineProperty(style, 'cssText', {
    get() { return Object.entries(style).filter(([k]) => k !== 'cssText').map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';'); },
    set(v) {
      for (const k of Object.keys(style)) delete style[k];
      for (const d of String(v).split(';')) {
        const i = d.indexOf(':'); if (i <= 0) continue;
        style[camel(d.slice(0, i).trim())] = d.slice(i + 1).trim();
      }
    },
  });
  el.style = style;
  Object.defineProperty(el, 'parentElement', { get: () => el._parent });
  Object.defineProperty(el, 'childNodes', { get: () => el.children });
  Object.defineProperty(el, 'lastChild', { get: () => el.children[el.children.length - 1] || null });
  Object.defineProperty(el, 'offsetWidth', { get: () => 10 });
  Object.defineProperty(el, 'isConnected', { get: () => { let a = el; while (a._parent) a = a._parent; return a === docBody; } });
  Object.defineProperty(el, 'textContent', {
    get() { let t = ''; for (const c of el.children) t += c.nodeType === 3 ? c.v : c.textContent; return t; },
    set(v) { for (const c of el.children) c._parent = null; el.children.length = 0; el.appendChild(textNode(v ?? '')); },
  });
  Object.defineProperty(el, 'innerText', {
    get() { return el.textContent; },
    set(v) { el.textContent = v; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el.textContent; },
    set(v) { el.textContent = String(v ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''); },
  });
  if (el.tagName === 'CANVAS') { el.width = 480; el.height = 72; el.getContext = () => anyProxy(); }
  return el;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP = new Set(['script', 'style']);
const ENT = { '&amp;': '&', '&#39;': "'", '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&rarr;': '→', '&middot;': '·', '&times;': '×', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…' };
const unesc = s => s.replace(/&(?:amp|#39|apos|quot|lt|gt|nbsp|rarr|middot|times|mdash|ndash|hellip);/g, m => ENT[m] || m);

function parseBody(html) {
  const bi = html.indexOf('<body');
  assert(bi >= 0, 'index.html has no <body>');
  const src = html.slice(bi).replace(/<!--[\s\S]*?-->/g, '');
  const root = makeEl('body');
  const stack = [root];
  let pos = src.indexOf('>') + 1;
  while (pos < src.length) {
    const lt = src.indexOf('<', pos);
    if (lt < 0) break;
    const text = unesc(src.slice(pos, lt)).replace(/\s+/g, ' ');
    if (text.trim()) stack[stack.length - 1].appendChild(textNode(text));
    if (src.startsWith('</', lt)) {
      const m = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(src.slice(lt));
      assert(m, `unparseable closing tag near ${src.slice(lt, lt + 40)}`);
      const tag = m[1].toLowerCase();
      if (tag === 'body' || tag === 'html') { pos = lt + m[0].length; if (tag === 'body') break; continue; }
      while (stack.length > 1 && stack[stack.length - 1].tagName !== tag.toUpperCase()) {
        assert(!VOID.has(stack[stack.length - 1].tagName.toLowerCase()), `unclosed void ${tag}`);
        stack.pop();
      }
      assert(stack.length > 1, `stray closing </${tag}>`);
      stack.pop();
      pos = lt + m[0].length;
      continue;
    }
    const m = /^<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/.exec(src.slice(lt));
    assert(m, `unparseable tag near ${src.slice(lt, lt + 60)}`);
    const tag = m[1].toLowerCase();
    const rawAttrs = m[2];
    if (SKIP.has(tag)) {
      const close = src.indexOf(`</${tag}`, lt);
      assert(close >= 0, `unclosed <${tag}>`);
      pos = src.indexOf('>', close) + 1;
      continue;
    }
    const el = makeEl(tag);
    const attrRe = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;
    let am;
    while ((am = attrRe.exec(rawAttrs))) {
      const v = am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : (am[2] !== undefined ? am[2] : '');
      el.setAttribute(am[1], unesc(String(v)));
    }
    stack[stack.length - 1].appendChild(el);
    const selfClose = /\/\s*>$/.test(m[0]) || VOID.has(tag);
    if (!selfClose) stack.push(el);
    pos = lt + m[0].length;
  }
  return root;
}

const indexHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const docBody = parseBody(indexHtml);
const byId = id => collect(docBody, c => c.id === id)[0] || null;
globalThis.document = {
  getElementById: byId,
  createElement: t => makeEl(t),
  createElementNS: () => makeEl('canvas'),
  querySelector: sel => docBody.querySelector(sel),
  querySelectorAll: sel => docBody.querySelectorAll(sel),
  body: docBody,
  activeElement: null,
};
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1280; globalThis.innerHeight = 800; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' };
const keyHandlers = [];
globalThis.addEventListener = (t, f) => { if (t === 'keydown') keyHandlers.push(f); };
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  resume() {}
}
globalThis.AudioContext = ACS; globalThis.webkitAudioContext = ACS;
let _rs = 77; Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };

let now = 1000;
function runFrames(n, { acceptOffer = false } = {}) {
  for (let f = 0; f < n; f++) {
    now += 100; const cb = rafCb; rafCb = null; if (!cb) return;
    cb(now);
    const off = byId('offer');
    if (off && off.classList.contains('show')) byId(acceptOffer ? 'offer-yes' : 'offer-no')?.click();
    const ev = byId('evening');
    if (ev && ev.classList.contains('show')) byId('evening-close')?.click();
    if (G && G.paused && G.phase === 'trading' && !modalsTop()) G.togglePause();
  }
}
const modalsTop = () => { try { return !!(G.modals && G.modals.top && G.modals.top()); } catch { return false; } };
function deepText(el) {
  let t = '';
  for (const c of el.children || []) t += c.nodeType === 3 ? c.v + '\n' : deepText(c);
  return t;
}
function capLines(el, out = []) {
  for (const c of el.children || []) {
    if (c.nodeType === 3) { const v = c.v.replace(/\s+/g, ' ').trim(); if (v) out.push(v); continue; }
    if (c.hidden || (c.style && c.style.display === 'none')) continue;
    if (el.tagName === 'DETAILS' && !el.open && c.tagName !== 'SUMMARY') continue;
    capLines(c, out);
  }
  return out;
}
const visibleText = el => capLines(el).join('\n');

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
byId('open').click();
await new Promise(r => setTimeout(r, 10));
check('boot lands in planning day 1', G.phase === 'planning' && G.stats().day === 1, `phase=${G.phase}`);

// The headless path has wantTutorial=false, so the soft day must be opted
// into explicitly — the same gate the spec calls softOpening.
const key = k => { for (const h of keyHandlers) h({ key: k, preventDefault() {} }); };
G.testState({ softOpening: true, tutorial: true, openingGuidance: true, curriculum: true, moments: true });
check('softOpening testState arms the soft day', G.softDay === true);

// ---- the soft day itself ----------------------------------------------------
const spies = { spawns: 0, walkins: 0, cast: new Set(), partyCount: 0, firstParty: null, maraAt: null, oluAt: null };
const origSpawn = G.patrons.spawn.bind(G.patrons);
G.patrons.spawn = (cohort, zone, quick, via) => {
  const p = origSpawn(cohort, zone, quick, via);
  if (p) {
    spies.spawns++;
    if (p.partyMember) { spies.partyCount++; if (!spies.firstParty) spies.firstParty = p.regularName || p.pname; }
    else spies.walkins++;
    if (p.regularName) {
      spies.cast.add(p.regularName);
      if (p.regularName === 'Mara' && spies.maraAt === null) spies.maraAt = G.stats().dayMin;
      if (p.regularName === 'Olu' && spies.oluAt === null) spies.oluAt = G.stats().dayMin;
    }
  }
  return p;
};

G.renderBrief();
check('soft day opens #softintro, not the brief',
  byId('softintro').classList.contains('show') && !byId('brief').classList.contains('show'));
const sHead = byId('softintro-heading'), sLine = byId('softintro-line'), sPrim = byId('softintro-primary'), sSkip = byId('softintro-skip');
check('step 1 heading is the stand name', sHead.textContent.length > 0, sHead.textContent);
check('one card carries both lines', sLine.textContent === 'Your café — before anyone knows it’s here. Ruth makes every drink. You watch the room and make the calls.', sLine.textContent);
check('primary opens the doors', sPrim.textContent === 'Open the doors', sPrim.textContent);
check('skip button visible', sSkip.style.display !== 'none' && sSkip.textContent === 'Skip the soft opening', sSkip.textContent);
check('Ruth is on the card', byId('softintro-portrait').children.length > 0 && byId('softintro-portrait').style.display !== 'none');
check('no 14:00 plan spoiler on the soft morning', !/14:00|Students/.test(deepText(byId('softintro'))), deepText(byId('softintro')));
writeFileSync(join(LOGS, 'softintro-step1.txt'), visibleText(byId('softintro')));
key('Escape');
check('Escape does not open the doors', G.phase === 'planning' && G.softDay === true && byId('softintro').classList.contains('show'));
check('reduced-motion rule exists', readFileSync(join(ROOT, 'web/index.html'), 'utf8').includes('@media (prefers-reduced-motion: reduce) { #softintro-step.si-in, #lic-step.si-in { animation: none; } }'));
sPrim.click();
check('Open the doors commits and starts trading', G.phase === 'trading' && byId('softintro').classList.contains('show') === false, `phase=${G.phase}`);
check('the soft commit staged no prep', G.stats().batchUnits === 0 && G.stats().batchSpend === 0, `units=${G.stats().batchUnits}`);
check('the soft commit kept hedge hold', !G.plan || G.plan.hedge === 'hold', JSON.stringify(G.plan));
runFrames(2);
check('coach begins on the soft day', !!G.coach.state(), JSON.stringify(G.coach.state()));
check('soft coach intro line', (byId('coach-body').innerHTML || byId('coach-body').textContent || '').includes('Watch the first orders and notice who comes in.'), (byId('coach-body').innerHTML || '').slice(0, 160));
G.coach.skip();
let guard = 0;
while (G.phase === 'trading' && guard++ < 4000) runFrames(1);
check('soft day closes into review', G.phase === 'review', `phase=${G.phase} dayMin=${G.stats().dayMin}`);
check('soft day ends at 17:00', G.stats().dayMin >= 1020 && G.stats().dayMin < 1260, `dayMin=${G.stats().dayMin}`);
check('walk-ins inside the thinned band', spies.walkins >= 35 && spies.walkins <= 90, `walkins=${spies.walkins} total=${spies.spawns}`);
check('only Mara/Pip/Olu are ever tagged', [...spies.cast].every(n => ['Mara', 'Pip', 'Olu'].includes(n)), [...spies.cast].join(','));
check('Mara arrives by 08:30', spies.maraAt !== null && spies.maraAt <= 510, `maraAt=${spies.maraAt}`);
check('Olu arrives by 13:00', spies.oluAt !== null && spies.oluAt <= 780, `oluAt=${spies.oluAt}`);
check('declining the soft offer lands no party students', spies.partyCount === 0, `party=${spies.partyCount}`);
check('declined offer never queues the plan card', !G.moment.done().includes('plan'), G.moment.done().join(','));

// ---- soft receipt -----------------------------------------------------------
{
  const rc = G.lastDayReceipt;
  check('soft receipt exists', !!rc);
  const labels = rc.lines.map(l => l[0]);
  const forbidden = ['operations', 'staff', 'pitch rent', 'card fees', 'sundries', 'debt', 'NET TODAY', 'street awareness', 'bean cost'];
  check('soft receipt has no ledger lines', !labels.some(l => forbidden.some(f => String(l).toLowerCase().includes(f.toLowerCase()))), labels.join('|'));
  check('soft receipt carries served/walked/takings', ['served', 'walked', 'takings'].every(k => labels.includes(k)), labels.join('|'));
  check('soft receipt verdict', rc.verdict === 'Soft opening', rc.verdict);
  check('practice-money lesson leads', rc.lessons[0] === 'Practice money — today’s takings don’t count toward the week.', rc.lessons[0]);
  check('continue button offers the week', byId('review-continue').textContent === 'open the week →', byId('review-continue').textContent);
  check('no evening letter after the practice day', byId('review-letter').style.display === 'none', byId('review-letter').style.display);
  writeFileSync(join(LOGS, 'receipt-soft.txt'), JSON.stringify({ lines: rc.lines, verdict: rc.verdict, lessons: rc.lessons }, null, 2));
}

// ---- beginWeek: only relationships carry ------------------------------------
const softSocial = {};
for (const r of G.reg.regulars) softSocial[r.name] = { op: r.op, visits: r.visits, events: r.events.length };
const maraSoft = G.reg.regulars.find(r => r.name === 'Mara');

check('review-continue opens the week', G.continueFromReview() === true && G.phase === 'planning' && G.stats().day === 1, `phase=${G.phase}`);
check('softDay cleared for the week', G.softDay === false && G.softWeekDone === true);
check('coachedOpening marks the coach as spent', G.coachedOpening === true);
const weekStart = { index: G.exc.beanIndex, debt: G.exc.debt, history: G.exc.history.length, cRev: G.stats().cRev, cCost: G.stats().cCost, cOps: G.stats().cOps, settledPaid: G.stats().settledPaid, staff: G.stats().staffCondition, awareness: G.stats().awareness,
  lots: Object.fromEntries(Object.keys(LOT_CATALOG).map(id => [id, G.exc.lots.entry(id)?.stock ?? null])) };
check('week starts on a clean ledger', weekStart.cRev === 0 && weekStart.cCost === 0 && weekStart.cOps === 0 && weekStart.settledPaid === 0 && weekStart.debt === 0 && weekStart.history === 0, JSON.stringify(weekStart));

const maraWeek = G.reg.regulars.find(r => r.name === 'Mara');
check('Mara keeps her soft-day visits', maraWeek.visits === maraSoft.visits && maraWeek.visits > 5, `visits=${maraWeek.visits}`);
check('soft events are relabelled day 0', maraWeek.events.length === maraSoft.events.length && maraWeek.events.every(e => e.day === 0), JSON.stringify(maraWeek.events));
const dl = dossierLines(maraWeek, { op: maraWeek.op });
check('day-0 history renders as "soft opening —"', dl.some(l => l.startsWith('soft opening — ')), dl.join('|'));
const carriedHeads = G.patrons.walkins ? G.patrons.walkins.heads.filter(h => h.pid.startsWith('d0-')) : [];
check('soft-day faces carry into the week pool', carriedHeads.length > 0, `carried=${carriedHeads.length}`);

G.renderBrief();
writeFileSync(join(LOGS, 'brief-week.txt'), visibleText(byId('brief')));
check('week brief heading OPENING WEEK', byId('brief-heading').textContent === 'OPENING WEEK', byId('brief-heading').textContent);
check('week brief kicker', byId('brief-kicker').textContent === 'Day 1 of 5 · the street knows you’re open', byId('brief-kicker').textContent);
const wIntro = deepText(byId('brief-intro'));
check('week intro is the single paragraph', wIntro.trim() === 'The soft opening is behind you. Today the whole street can find you — same choices, many more people.', wIntro.trim().slice(0, 90));
check('week brief has no portraits', !deepText(byId('brief-intro')).includes('Idris · your roaster'));
check('week prep choices are ungated', byId('brief-open').disabled === false);
check('no coach on the week after a soft day', G.coach.state() === null);

// same start as a fresh reset — snapshot the control after, same seed
G.testState({ softOpening: false });
G.reset();
await new Promise(r => setTimeout(r, 10));
const ctrl = { index: G.exc.beanIndex, debt: G.exc.debt, history: G.exc.history.length, cRev: G.stats().cRev, cCost: G.stats().cCost, cOps: G.stats().cOps, settledPaid: G.stats().settledPaid, staff: G.stats().staffCondition, awareness: G.stats().awareness,
  lots: Object.fromEntries(Object.keys(LOT_CATALOG).map(id => [id, G.exc.lots.entry(id)?.stock ?? null])) };
check('beginWeek equals a fresh campaign start', JSON.stringify(weekStart) === JSON.stringify(ctrl), `${JSON.stringify(weekStart)} vs ${JSON.stringify(ctrl)}`);

// ---- skip button lands on the same week -------------------------------------
G.testState({ softOpening: true });
G.reset();
await new Promise(r => setTimeout(r, 10));
check('reset re-arms the soft day', G.softDay === true);
G.renderBrief();
check('skip run shows the softintro', byId('softintro').classList.contains('show') && byId('softintro-primary').textContent === 'Open the doors', byId('softintro-primary').textContent);
byId('softintro-skip').click();
check('skip jumps straight into the week brief', G.phase === 'planning' && G.softDay === false && G.softWeekDone === true, `phase=${G.phase}`);
const skipStart = { index: G.exc.beanIndex, debt: G.exc.debt, history: G.exc.history.length, cRev: G.stats().cRev, cCost: G.stats().cCost, cOps: G.stats().cOps, settledPaid: G.stats().settledPaid, staff: G.stats().staffCondition, awareness: G.stats().awareness,
  lots: Object.fromEntries(Object.keys(LOT_CATALOG).map(id => [id, G.exc.lots.entry(id)?.stock ?? null])) };
check('skip carries nothing economic', JSON.stringify(skipStart) === JSON.stringify(ctrl), JSON.stringify(skipStart));
check('skip leaves regulars pristine', G.reg.regulars.every(r => r.events.length === 0 && r.visits === 5));

// ---- veteran path: all tools introduced → straight to the week ---------------
G.testState({ softOpening: null, tutorial: true, curriculumIntroduced: [...TOOL_IDS] });
G.reset();
await new Promise(r => setTimeout(r, 10));
check('veteran skips the soft day', G.softDay === false && G.softWeekDone === false, `softDay=${G.softDay}`);
check('veteran daytag is the normal week', byId('daytag').textContent.startsWith('DAY 1/5'), byId('daytag').textContent);

// ---- accepting Pip's offer lands the whole study group ----------------------
G.testState({ softOpening: null, tutorial: true, curriculumIntroduced: null, moments: true });
G.reset();
await new Promise(r => setTimeout(r, 10));
check('eligible path arms the soft day without a test flag', G.softDay === true);
const spy2 = { party: 0, first: null };
G.patrons.spawn = (cohort, zone, quick, via) => {
  const p = origSpawn(cohort, zone, quick, via);
  if (p && p.partyMember) { spy2.party++; if (!spy2.first) spy2.first = p.regularName || p.pname; }
  return p;
};
G.stageDayPlan({ hedge: 'hold' });
const c2 = G.commitDayPlan();
check('accept run commits', c2.ok === true);
G.coach.skip();
let g2 = 0;
let planSeen = null, prioInjected = false, prioWon = false;
while (G.phase === 'trading' && g2++ < 4000) {
  runFrames(1, { acceptOffer: true });
  if (G.moment.active() === 'plan') {
    if (!planSeen) {
      const det = collect(byId('moment-actions'), c => c.tagName === 'DETAILS')[0];
      planSeen = { dayMin: G.stats().dayMin, text: visibleText(byId('moment')), actions: collect(byId('moment-actions'), c => c.tagName === 'BUTTON').map(b => b.textContent),
        details: det ? deepText(det) : '' };
      if (!prioInjected) {
        prioInjected = true;
        G.moment.enqueue('counter', 'prio-c', { name: 'Olu' });
        G.moment.enqueue('plan', 'prio-p', { expiresAt: 900 });
      }
    }
  }
  if (prioInjected && planSeen && G.stats().dayMin >= 840 && G.moment.active() === 'plan') prioWon = true;
}
check('accepting Pip lands exactly 24 party students', G.party && G.party._landed === 24, `landed=${G.party && G.party._landed} tagged=${spy2.party} left=${G.party && G.party.left}`);
check('every tagged member counted (none lost silently)', G.party && spy2.party === 24 - G.party.left, `tagged=${spy2.party} left=${G.party && G.party.left}`);
check('the first party member is Pip', spy2.first === 'Pip', `first=${spy2.first}`);
check('accept run closes into review', G.phase === 'review');
check('accepted offer shows the plan card', !!planSeen, `seen=${!!planSeen}`);
if (planSeen) {
  check('plan card body copy', /24 students at 14:00\./.test(planSeen.text) && /How will you get ready\?/.test(planSeen.text), planSeen.text.slice(0, 160));
  check('plan card batch line at the live £40', planSeen.actions.some(a => a === 'Starter batch · £40.00 · 40 cups ready, served faster'), planSeen.actions.join(' | '));
  check('plan card deal line, no extra fee before noon', planSeen.actions.some(a => a === 'Matcha deal · £4.20 a cup · they’ll wait longer'), planSeen.actions.join(' | '));
  check('plan card wait line', planSeen.actions.some(a => a === 'Wait and see · every cup made to order'), planSeen.actions.join(' | '));
  check('plan card shows before 14:00', planSeen.dayMin < 840, `dayMin=${planSeen.dayMin}`);
  check('plan card details merge', planSeen.details.includes('what’s the difference?') && planSeen.details.includes('A batch is made ahead, so the rush moves faster — leftovers spoil. A deal doesn’t speed Ruth up, but people wait longer before leaving. Waiting keeps your options open; after noon, a first change of plan costs a little extra.'), planSeen.details.slice(0, 200));
  writeFileSync(join(LOGS, 'plan-card.txt'), planSeen.text);
}
check('plan outranks a queued counter moment for the next slot', prioWon, `done=${G.moment.done().join(',')}`);
check('plan cards are gone after 14:00', G.moment.active() !== 'plan' && G.moment.pending().every(m => m.type !== 'plan'), `active=${G.moment.active()} dayMin=${G.stats().dayMin}`);

// ---- the plan card's buttons drive the real levers --------------------------
async function softAcceptRun(clickText) {
  G.testState({ softOpening: true, tutorial: true, openingGuidance: true, curriculum: true, moments: true });
  G.reset();
  await new Promise(r => setTimeout(r, 10));
  G.renderBrief();
  byId('softintro-primary').click();
  if (G.phase !== 'trading') return { ok: false };
  G.coach.skip();
  let g = 0;
  while (G.phase === 'trading' && g++ < 4000) {
    runFrames(1, { acceptOffer: true });
    if (G.moment.active() === 'plan') {
      const btn = collect(byId('moment-actions'), c => c.tagName === 'BUTTON').find(b => b.textContent.startsWith(clickText));
      if (btn) { btn.click(); return { ok: true, dayMin: G.stats().dayMin }; }
      return { ok: false, actions: collect(byId('moment-actions'), c => c.tagName === 'BUTTON').map(b => b.textContent).join('|') };
    }
  }
  return { ok: false };
}
{
  const r = await softAcceptRun('Starter batch');
  check('plan Starter batch fires', r.ok === true && r.dayMin < 720, JSON.stringify(r));
  check('Starter batch reserves 40 cups for 14:00', G.stats().prebatched === true && G.stats().batchUnits === 40 && G.stats().batchReservedUntil === 840, `units=${G.stats().batchUnits} until=${G.stats().batchReservedUntil}`);
  check('Starter batch charged only the £40 batch cost', G.stats().batchSpend === 40, `batchSpend=${G.stats().batchSpend}`);
}
{
  const r = await softAcceptRun('Matcha deal');
  check('plan Matcha deal fires', r.ok === true && r.dayMin < 720, JSON.stringify(r));
  check('Matcha deal reprices with no fee before noon', G.stats().repriced === true && G.stats().batchSpend === 0, `repriced=${G.stats().repriced} spend=${G.stats().batchSpend}`);
}

if (fails.length) { console.error('soft-opening FAIL:'); for (const f of fails) console.error(' -', f); process.exit(1); }
console.log(`soft-opening: all pass (${fails.length} fails)`);
