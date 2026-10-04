import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ECON, CAMPAIGN } from '../js/config.js';
import { firstMorningCopy, economicsLesson } from '../js/orientation.js';
import { computeNextAction } from '../js/nextAction.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));
const LOGS = '/tmp/grunds-orientation-logs';
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
function runFrames(n) {
  for (let f = 0; f < n; f++) {
    now += 100; const cb = rafCb; rafCb = null; if (!cb) return;
    cb(now);
    const off = byId('offer');
    if (off && off.classList.contains('show')) byId('offer-no')?.click();
    const ev = byId('evening');
    if (ev && ev.classList.contains('show')) byId('evening-close')?.click();
  }
}
const key = (k, target) => { for (const h of keyHandlers) h({ key: k, target: target === undefined ? (globalThis.document.activeElement || null) : target, preventDefault() {} }); };

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
const deepText = el => {
  let t = '';
  for (const c of el.children || []) t += c.nodeType === 3 ? c.v + '\n' : deepText(c);
  return t;
};
const sumOf = (id) => {
  const d = collect(byId(id), c => c.tagName === 'DETAILS')[0];
  const s = d ? collect(d, c => c.tagName === 'SUMMARY')[0] : null;
  return s ? s.textContent : null;
};

{
  const FM = firstMorningCopy();
  check('firstMorningCopy carries the settled beats', [FM.idrisQuote, FM.welcome, FM.ruthRole, FM.rival, FM.aim, FM.stocked].every(s => typeof s === 'string' && s.length > 10));
  check('choices order batch → deal → wait', FM.choices.map(c => c.key).join(',') === 'batch,reprice,hold', FM.choices.map(c => c.key).join(','));
  check('economicsLesson: empty/low house tops every other concern', /house coffee needs attention/.test(economicsLesson({ houseStock: 0, houseName: 'Huila', debt: 900 }).text));
  check('economicsLesson: low stock vs lastPour still urgent', economicsLesson({ houseStock: 5, lastPour: 40 }).urgent === true);
  check('economicsLesson: the tab names the amount, not just supplies', /supplier tab is £12\.00/.test(economicsLesson({ houseStock: 99, lastPour: 10, debt: 12 }).text), economicsLesson({ houseStock: 99, lastPour: 10, debt: 12 }).text);
  check('economicsLesson: staffing surface when available', /Ruth is tiring/.test(economicsLesson({ houseStock: 99, lastPour: 10, debt: 0, staffCanChoose: true }).text));
  check('economicsLesson: observed warn tier stays a warning, not a cost claim', /left a warning/.test(economicsLesson({ houseStock: 99, lastPour: 10, debt: 0, prevTier: 'warn' }).text));
  check('economicsLesson: bad tier uses the same neutral wording', /left a warning/.test(economicsLesson({ houseStock: 99, lastPour: 10, debt: 0, prevTier: 'bad' }).text));
  check('economicsLesson: calm default', /one day on the floor/.test(economicsLesson({ houseStock: 99, lastPour: 10 }).text));
  const calm = computeNextAction({ day: 1, guidedOpening: true, dayMin: 400, queue: 0, phase: 'trading' });
  check('calm day-1 goal settles in, not a queue directive', /Ruth is serving/.test(calm.text) && !/under/.test(calm.text), calm.text);
  const calmDeal = computeNextAction({ day: 1, guidedOpening: true, dayMin: 400, queue: 2, phase: 'trading', repriced: true });
  check('calm day-1 goal works with a small queue too', /Ruth is serving/.test(calmDeal.text), calmDeal.text);
  const queued = computeNextAction({ day: 1, guidedOpening: true, dayMin: 400, queue: 8, phase: 'trading' });
  check('day-1 pressure stays honest when the line is actually long', /line is long|cuts matcha/.test(queued.text), queued.text);
  const calmUnguided = computeNextAction({ day: 1, guidedOpening: false, dayMin: 400, queue: 0, phase: 'trading' });
  check('unguided day-1 keeps the old 11:00 beat', /11:00/.test(calmUnguided.text), calmUnguided.text);
}

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;

byId('open').click();
await new Promise(r => setTimeout(r, 10));
check('boot lands in planning day 1', G.phase === 'planning' && G.stats().day === 1, `phase=${G.phase}`);

G.renderBrief();
check('headless day-1 brief is not guided — OPEN is free', byId('brief-open').disabled === false);
{
  const r = G.commitDayPlan();
  check('headless commit without a choice still works (core API ungated)', r && r.ok === true, JSON.stringify(r));
}

G.reset();
await new Promise(r => setTimeout(r, 1700));
check('reset returns straight to day-1 planning (title element is gone)', G.phase === 'planning' && G.stats().day === 1 && byId('open') === null, `phase=${G.phase}`);
G.testState({ openingGuidance: true, curriculum: true });
G.renderBrief();

check('day-1 heading is YOUR FIRST MORNING', byId('brief-heading').textContent === 'YOUR FIRST MORNING', byId('brief-heading').textContent);
check('day-1 kicker reads "Day 1 of 5 · before opening"', byId('brief-kicker').textContent === 'Day 1 of 5 · before opening', byId('brief-kicker').textContent);
check('brief carries first-morning presentation', byId('brief').classList.contains('first-morning'));
const intro = deepText(byId('brief-intro'));
check('intro: welcome + Ruth role + rival + aim + stand name + stock line',
  /first five days on the street/.test(intro) && /Ruth brews and serves automatically/.test(intro)
  && /Glasshouse/.test(intro) && /run by Sam/.test(intro) && /matcha rush/.test(intro)
  && /already stocked/.test(intro) && /THE CORNER CUP/.test(intro), intro.slice(0, 300));
check('portrait rows render for Idris and Ruth', collect(byId('brief-intro'), c => c.className === 'fm-role').length === 2);

check('#brief-more is gone — the curriculum replaced the drawer', byId('brief-more') === null);
{
  const tools = byId('brief-tools');
  check('#brief-tools exists in the real markup', !!tools);
  const order = (tools.children || []).filter(c => c.nodeType === 1).map(c => c.id);
  check('tool slots sit in curriculum order',
    order.join(',') === 'brief-new,brief-lots,brief-menu,brief-demand,brief-actions,brief-context,brief-nut,brief-risk', order.join(','));
}
for (const id of ['brief-new', 'brief-lots', 'brief-menu', 'brief-demand', 'brief-actions', 'brief-context', 'brief-nut', 'brief-risk']) {
  const n = byId(id);
  check(`#${id} exists in the real markup`, !!n);
  check(`day-1 curriculum leaves #${id} hidden`, n && n.style.display === 'none', `display=${n && n.style.display}`);
  if (id !== 'brief-context') check(`day-1 curriculum leaves #${id} empty`, n && deepText(n).trim() === '', `text=${(n ? deepText(n) : '').slice(0, 120)}`);
}

const primary = visibleText(byId('brief'));
check('primary surface: no viability/bonus/commitment/finance talk',
  !/viable|as a bonus|committed|riding the spot|insure|the wire|2914/i.test(primary), primary.slice(0, 500));
check('curriculum day-1 primary hides every tool row',
  !/pouring |menu ·|supplier tab|the nut|Explore the full plan|More planning details|insure the beans|work the street/i.test(primary), primary.slice(0, 500));
check('primary surface keeps the prep choice + forecast',
  /ONE PLAN FOR THE AFTERNOON/.test(primary) && /Students arrive at 14:00/.test(primary), primary.slice(0, 500));
writeFileSync(join(LOGS, 'first-morning-visible.txt'), primary);

const prepBtns = () => collect(byId('brief-prep'), c => c.tagName === 'BUTTON' && c.dataset && c.dataset.prep);
check('three full choices in order batch → deal → wait', prepBtns().map(b => b.dataset.prep).join(',') === 'batch,reprice,hold', prepBtns().map(b => b.dataset.prep).join(','));
check('guided batch carries the one-line copy + tag', (() => { const t = deepText(prepBtns()[0]); return t.includes('Starter batch') && t.includes('£40.00 now · 40 cups ready at 14:00, served faster') && t.includes('Recommended for your first day'); })(), deepText(prepBtns()[0]));
check('deal one-line copy', deepText(prepBtns()[1]).includes('Matcha deal') && deepText(prepBtns()[1]).includes('£4.20 a cup · they’ll wait longer'), deepText(prepBtns()[1]));
check('wait one-line copy', deepText(prepBtns()[2]).includes('Wait and see') && deepText(prepBtns()[2]).includes('Every cup made to order — decide later'), deepText(prepBtns()[2]));
{
  const det = collect(byId('brief-prep'), c => c.tagName === 'DETAILS')[0];
  const dt = det ? deepText(det) + (det.textContent || '') : '';
  check('merged what’s-the-difference details', dt.includes('what’s the difference?') && dt.includes('A batch is made ahead, so the rush moves faster — leftovers spoil.'), dt.slice(0, 200));
}
check('guided: nothing pre-selected', prepBtns().every(b => !b.classList.contains('picked') && b.getAttribute('aria-pressed') === 'false'));
check('guided: OPEN disabled until a real choice', byId('brief-open').disabled === true);
const ftr = () => byId('brief-summary').textContent;
check('guided footer prompts for the plan, no big number', /Choose your afternoon plan/.test(ftr()) && /counted at closing/.test(ftr()) && !/2914|committed/i.test(ftr()), ftr());

key('Enter');
check('Enter before a choice is a no-op — still planning, nothing spent', G.phase === 'planning' && G.stats().batchSpend === 0, `phase=${G.phase} spend=${G.stats().batchSpend}`);

{
  byId('brief-open').focus();
  key('1');
  check('digit on a focused non-prep control does not pick', !prepBtns()[0].classList.contains('picked'), 'summary focus swallowed by interactive guard');
  globalThis.document.activeElement = null;
}
{
  const deal = prepBtns()[1];
  deal.focus();
  key('2');
  check('key 2 on a focused prep choice picks the deal', deal.classList.contains('picked') || prepBtns()[1].classList.contains('picked'), prepBtns().map(b => b.dataset.prep + ':' + b.classList.contains('picked')).join(','));
  check('numeric pick refocuses the fresh replacement button', globalThis.document.activeElement && globalThis.document.activeElement.dataset && globalThis.document.activeElement.dataset.prep === 'reprice', `active=${globalThis.document.activeElement && globalThis.document.activeElement.id}`);
}
check('OPEN unlocks after the choice', byId('brief-open').disabled === false);
check('chosen deal footer is honest — no prep spend, no bill number', /matcha deal/.test(ftr()) && !/2914/i.test(ftr()), ftr());
{
  const batch = prepBtns()[0];
  batch.focus();
  key('1');
  const nb = byId('brief-prep-batch');
  check('key 1 switches back to the starter batch and refocuses', nb.classList.contains('picked') && globalThis.document.activeElement === nb, `active=${globalThis.document.activeElement && globalThis.document.activeElement.id}`);
}
check('footer names the batch cash at opening', /starter batch, −£40/.test(ftr()), ftr());
writeFileSync(join(LOGS, 'first-morning-footer-batch.txt'), ftr());
{
  const before = ftr();
  key('4'); key('5');
  check('digits 4/5 on day 1 never reach the folded hedges', ftr() === before && G.plan.hedge === 'hold', G.plan.hedge);
}
{
  const inp = makeEl('input');
  byId('brief').appendChild(inp);
  inp.focus();
  key('2');
  check('typing in a field does not fire prep shortcuts', prepBtns()[0].classList.contains('picked'), 'input swallowed digit');
  inp.remove();
}
{
  const b = byId('brief-prep-batch');
  b.focus();
  key('Enter');
  check('Enter on a focused choice stays native — no commit', G.phase === 'planning', `phase=${G.phase}`);
  key(' ');
  check('Space on a focused choice stays native — no commit', G.phase === 'planning', `phase=${G.phase}`);
}

{
  G.stageDayPlan({ hedge: 'contract' });
  G.renderBrief();
  const ft = ftr();
  check('advanced choice discloses the real supplier-credit fee', /\+ bean cover £[\d.]+ on the tab/.test(ft) && !/2914/i.test(ft), ft);
  writeFileSync(join(LOGS, 'first-morning-footer-advanced.txt'), ft);
  G.stageDayPlan({ hedge: 'hold' });
  G.renderBrief();
}

check('no hedge or contract controls render on curriculum day 1', collect(byId('brief-actions'), c => c.tagName === 'BUTTON').length === 0, deepText(byId('brief-actions')).slice(0, 200));
check('staged credit on day 1 still discloses honestly', (() => { G.stageDayPlan({ hedge: 'contract' }); G.renderBrief(); const ok = /\+ bean cover £[\d.]+ on the tab/.test(ftr()); G.stageDayPlan({ hedge: 'hold' }); G.renderBrief(); return ok; })(), ftr());

G.coach.begin(true);
G.coach.tick();
check('a planning-phase tick preserves the prepared coach', !!G.coach.state() && byId('coach').hidden === true, `state=${JSON.stringify(G.coach.state())}`);
runFrames(2);
check('coach stays hidden while the Brief owns the stage', byId('coach').hidden === true, `hidden=${byId('coach').hidden} text=${deepText(byId('coach')).slice(0, 80)}`);

globalThis.document.activeElement = null;
key('Enter');
await new Promise(r => setTimeout(r, 10));
check('commit lands the batch plan', G.stats().batchUnits === ECON.batchUnits && Math.abs(G.stats().batchSpend - ECON.batchCost) < 1e-9, `units=${G.stats().batchUnits} spend=${G.stats().batchSpend}`);
check('the batch is reserved for the 14:00 rush (840)', G.stats().batchReservedUntil === 840, `reserved=${G.stats().batchReservedUntil}`);
check('a guided commit starts the coach', !!G.coach.state(), `coach=${JSON.stringify(G.coach.state())}`);

runFrames(1);
const firstCard = deepText(byId('coach'));
check('coach card reveals only after the Brief closed', /Ruth has the bar|Ruth has served/.test(firstCard), firstCard.slice(0, 200));
check('first card settles the player in, not a manual-serve directive', /afternoon plan is already set|room tells you/.test(firstCard), firstCard.slice(0, 200));

{
  let sawFalse = G.coach.state() ? G.coach.state().craftObserved === false : true;
  let flipped = 0, bodyAtFlip = null, guard = 0;
  while (G.stats().dayMin < 660 && guard++ < 600) {
    const was = G.coach.state() && G.coach.state().craftObserved;
    runFrames(2);
    const nowS = G.coach.state() && G.coach.state().craftObserved;
    if (!was && nowS) { flipped++; bodyAtFlip = byId('coach-body') ? byId('coach-body').textContent : ''; }
  }
  const servedOk = G.stats().served >= 5;
  check('craftObserved flips false → true exactly once on real serves', !servedOk || (sawFalse && flipped === 1), `served=${G.stats().served} flipped=${flipped}`);
  if (bodyAtFlip && G.coach.state()) {
    runFrames(6);
    check('craft card body is stable across later frames', byId('coach-body').textContent === bodyAtFlip || !/Ruth has served/.test(deepText(byId('coach'))), byId('coach-body').textContent.slice(0, 160));
    check('craft copy quotes the real served count', /served \d+ drinks automatically/.test(bodyAtFlip), bodyAtFlip.slice(0, 160));
  }
}

let guard = 0;
while (G.phase === 'trading' && guard++ < 80) {
  runFrames(60);
  if (G.paused && !byId('brief').classList.contains('show')) G.togglePause();
}
check('day 1 closes into review', G.phase === 'review', 'phase=' + G.phase);
{
  const receipt = G.lastDayReceipt;
  const lessons = receipt && receipt.lessons || [];
  check('day-1 receipt lesson prices the real running cost',
    lessons.some(l => /Running the café today cost £[\d.,]+/.test(l) && receipt.ops && l.includes(`£${receipt.ops.total.toFixed(2)}`)),
    JSON.stringify(lessons));
  writeFileSync(join(LOGS, 'day1-receipt-lessons.txt'), lessons.join('\n'));
}
{
  G.coach.begin(true);
  const wasPaused = G.paused;
  G.coach.tick();
  check('a review-phase tick clears a prepared coach even with the receipt up', G.coach.state() === null, `state=${JSON.stringify(G.coach.state())}`);
  check('coach cleanup does not touch the pause state', G.paused === wasPaused, `paused=${G.paused}`);
}
G.continueFromReview();
await new Promise(r => setTimeout(r, 10));
G.renderBrief();
check('day 2 restores the normal brief', byId('brief-heading').textContent === 'THE MORNING BRIEF' && !byId('brief').classList.contains('first-morning'));
check('day 2 hides the first-morning intro', byId('brief-intro').style.display === 'none');
const briefNew2 = deepText(byId('brief-new'));
{
  const tt = G.curriculum.toolsToday || {};
  check('day 2 makes coffee the New today card', tt.newToday === 'coffee', JSON.stringify(tt));
  check('day 2 introduces coffee with the Your coffee card', /New today/.test(briefNew2) && /Your coffee/.test(briefNew2) && /Three coffees are in your cellar/.test(briefNew2), briefNew2.slice(0, 300));
  check('the coffee card names every cellar lot with its crowd', /favoured by/.test(briefNew2) && (briefNew2.match(/favoured by/g) || []).length === 3, briefNew2.slice(0, 400));
  check('the coffee card lists no locked microlot', !/Panama Gesha/.test(briefNew2), briefNew2.slice(0, 400));
  check('the coffee card carries the running-low need line', /house coffee is running low/.test(briefNew2), briefNew2.slice(0, 400));
  check('the coffee card row carries the roast sweet-spot hint', /ideal roast/.test(deepText(byId('brief-lots'))), deepText(byId('brief-lots')).slice(0, 300));
  check('the need line is not duplicated as a row note', !/New ·/.test(deepText(byId('brief-lots'))), deepText(byId('brief-lots')).slice(0, 120));
  const det = collect(byId('brief-lots'), c => c.tagName === 'DETAILS')[0];
  check('the coffee row is open on its intro day', !!det && det.open === true, `open=${det && det.open}`);
}
for (const id of ['brief-menu', 'brief-demand', 'brief-context']) {
  check(`day 2 keeps #${id} hidden`, byId(id).style.display === 'none', `display=${byId(id).style.display}`);
}
check('day 2 shows the nut row', byId('brief-nut').style.display !== 'none' && /counted at closing|the nut/i.test(deepText(byId('brief-nut'))), deepText(byId('brief-nut')).slice(0, 200));
check('day 2 shows the risk line', byId('brief-risk').style.display !== 'none' && /matcha £/.test(deepText(byId('brief-risk'))), deepText(byId('brief-risk')).slice(0, 200));
check('day-2 tool rows all end · change ›',
  ['brief-nut', 'brief-lots', 'brief-rival'].every(id => /· change ›$/.test(sumOf(id) || '')),
  ['brief-nut', 'brief-lots', 'brief-rival'].map(sumOf).join(' | '));
check('day 2 no actions row without insurance or tab', byId('brief-actions').style.display === 'none', deepText(byId('brief-actions')).slice(0, 200));
{
  const before = G.plan && G.plan.hedge;
  key('1'); key('2'); key('3'); key('4'); key('5');
  check('day-2 digits reach only rendered action buttons — none staged', (G.plan ? G.plan.hedge : null) === before, JSON.stringify(G.plan && G.plan.hedge));
}
check('day 2 normal prep pills are back', !!collect(byId('brief-prep'), c => c.dataset && c.dataset.prep === 'hold')[0] && /hold steady/.test(deepText(byId('brief-prep'))));
{
  const prep = byId('brief-prep');
  const half = byId('brief-pastry-half');
  check('day 2 asks to shrink tomorrow�s croissant case inside prep', !!half && half.parentElement && half.parentElement.parentElement === prep, half && half.parentElement && half.parentElement.id);
  half.click();
  check('baking half stages the existing cut', G.stats().pastryCut === 0.5, String(G.stats().pastryCut));
  byId('brief-pastry-full').click();
  check('the full case clears that cut', G.stats().pastryCut === 0, String(G.stats().pastryCut));
}
check('day 2 hint no longer claims a staged midday press is free', !/pressing 1 or 2 mid-day without it costs/.test(deepText(byId('brief-prep'))));
check('the learning line stays quiet beside the coffee card', byId('brief-learning').style.display === 'none' || !/house coffee needs attention/.test(byId('brief-learning').textContent), byId('brief-learning').textContent);
writeFileSync(join(LOGS, 'day2-brief-visible.txt'), visibleText(byId('brief')));

{
  G.stageDayPlan({ hedge: 'hold' });
  const r = G.commitDayPlan();
  check('day 2 commits', r && r.ok === true, JSON.stringify(r));
  check('the commit records coffee as introduced', (G.curriculum.introduced || []).includes('coffee'), JSON.stringify(G.curriculum.introduced));
}
guard = 0;
while (G.phase === 'trading' && guard++ < 80) {
  runFrames(60);
  if (G.paused && !byId('brief').classList.contains('show')) G.togglePause();
}
check('day 2 closes into review', G.phase === 'review', 'phase=' + G.phase);
{
  const receipt = G.lastDayReceipt;
  const lessons = receipt && receipt.lessons || [];
  const poured = (G.curriculum.pouredByLotToday || {});
  const houseLot = G.stats().houseLot;
  check('day-2 receipt lesson quotes the real house pour',
    !!houseLot && lessons.some(l => new RegExp(`${poured[houseLot] || 0} cups poured`).test(l)),
    JSON.stringify({ lessons, poured, houseLot }));
  writeFileSync(join(LOGS, 'day2-receipt-lessons.txt'), lessons.join('\n'));
}
G.continueFromReview();
await new Promise(r => setTimeout(r, 10));
G.renderBrief();
{
  const briefNew3 = deepText(byId('brief-new'));
  check('day 3 introduces the menu card', /New today/.test(briefNew3) && /Your menu/.test(briefNew3), briefNew3.slice(0, 300));
  check('the menu row ends · change ›', /· change ›$/.test(sumOf('brief-menu') || ''), sumOf('brief-menu'));
  check('day 3 keeps the coffee row as an introduced tool', byId('brief-lots').style.display !== 'none' && !/New today/.test(deepText(byId('brief-lots'))), deepText(byId('brief-lots')).slice(0, 120));
  const debt = G.stats().debt;
  if (debt > 0) {
    check('day 3 shows the tab essential note with the real amount',
      new RegExp(`New · You owe Idris £${debt.toFixed(2)}`).test(deepText(byId('brief-actions'))), deepText(byId('brief-actions')).slice(0, 300));
    check('settle is visible while the tab is open', collect(byId('brief-actions'), c => c.tagName === 'BUTTON').some(b => /settle/i.test(b.textContent)), deepText(byId('brief-actions')).slice(0, 200));
  } else {
    check('day 3 actions stay hidden without debt or threat', byId('brief-actions').style.display === 'none', deepText(byId('brief-actions')).slice(0, 120));
  }
  writeFileSync(join(LOGS, 'day3-brief-visible.txt'), visibleText(byId('brief')));
  const savedDebt = G.exc.debt;
  G.exc.debt = CAMPAIGN.creditLimit - 300;
  G.stageCellar({ topup: 'restock' });
  G.renderBrief();
  const lbl = (byId('brief-top-rest') || {}).textContent || '';
  const lm = lbl.match(/tab covers ~(\d+) \(£([\d.]+)\)/);
  check('capped restock discloses the tab-funded count', !!lm, lbl);
  if (lm) {
    const before = G.stats().houseStock;
    const rc = G.commitDayPlan();
    const gained = G.stats().houseStock - before;
    check('the labelled tab count equals what applyLots buys', rc.ok === true && gained === +lm[1], `label=${lm[1]} gained=${gained}`);
  }
  G.exc.debt = savedDebt;
}

{
  byId('regularsbtn').click();
  check('the regulars board opens over the floor', G.modals.top() === 'regulars', G.modals.top());
  const rows = collect(byId('board-cast'), c => c.tagName === 'BUTTON');
  check('cast board rows are keyboard-activatable buttons', rows.length === 8 && rows.every(r => r.tagName === 'BUTTON'), `${rows.length}`);
  rows.find(r => /Mara/.test(r.textContent)).click();
  check('a cast row opens the profile on top of the board', G.modals.top() === 'dossier', G.modals.top());
  const prof = deepText(byId('dossier'));
  check('Mara’s profile reads bio/wants/usual/feeling in words', /8:10/.test(prof) && /Wants:/.test(prof) && /Usual:/.test(prof) && /warming to you|unhappy with you|still making up their mind/.test(prof), prof.slice(0, 300));
  check('the profile carries no raw opinion numbers', !/op [\d.]|0\.15/.test(prof), prof.slice(0, 300));
  writeFileSync(join(LOGS, 'profile-mara.txt'), prof);
  const op0 = G.reg.regulars.find(r => r.name === 'Mara').op;
  const hello = byId('dossier-hello');
  hello.click();
  const op1 = G.reg.regulars.find(r => r.name === 'Mara').op;
  check('Say hello warms the cast member exactly +0.06 and locks for the day', Math.abs(op1 - op0 - 0.06) < 1e-9 && hello.disabled === true && /said hello today/.test(hello.textContent), `${op0}→${op1}`);
  hello.click();
  check('a second hello does nothing', G.reg.regulars.find(r => r.name === 'Mara').op === op1, `${op1}`);
  key('Escape');
  check('Escape returns to the board', G.modals.top() === 'regulars', G.modals.top());
  byId('board-close').click();
  const head = G.patrons.walkins.heads[0];
  G.openDossier({ regularIdx: -1, pid: head.pid });
  const wprof = deepText(byId('dossier'));
  check('a walk-in opens A NEW FACE with cohort words', /A NEW FACE/.test(wprof) && /Wants:/.test(wprof), wprof.slice(0, 300));
  writeFileSync(join(LOGS, 'profile-walkin.txt'), wprof);
  const hop0 = head._op;
  byId('dossier-hello').click();
  check('the walk-in gesture warms the head +0.06 once', Math.abs(head._op - hop0 - 0.06) < 1e-9 && byId('dossier-hello').disabled === true, `${hop0}→${head._op}`);
  key('Escape');
}

G.reset();
await new Promise(r => setTimeout(r, 200));
G.testState({ openingGuidance: true });
G.renderBrief();
check('reset regates the guided opening', byId('brief-open').disabled === true, `disabled=${byId('brief-open').disabled}`);
check('reset cleared the coach until a fresh commit', !G.coach.state(), `coach=${JSON.stringify(G.coach.state())}`);
byId('brief-prep-hold') && byId('brief-prep-hold').click();
key('Enter');
await new Promise(r => setTimeout(r, 10));
check('the reset run re-opens on a real choice', G.phase === 'trading' || G.phase === 'review', `phase=${G.phase}`);
check('coach begins again only after the new commit', !!G.coach.state(), `coach=${JSON.stringify(G.coach.state())}`);

// ---- the wire row: one more tool row, folded on a calm dawn ---------------------
G.reset();
await new Promise(r => setTimeout(r, 200));
G.testState({ curriculum: false });
G.renderBrief();
{
  const wireCtx = byId('brief-context');
  const wireSum = () => (collect(wireCtx, c => c.tagName === 'SUMMARY')[0] || {}).textContent || '';
  check('the wire row is a real <details> in the stack', !!wireCtx && wireCtx.tagName === 'DETAILS');
  check('no sources fold lives inside the wire row', byId('brief-wire-details') === null
    && collect(wireCtx, c => c.id === 'brief-wire-details').length === 0);
  check('a calm dawn folds the wire', wireCtx.open === false && wireSum() === 'the wire', `open=${wireCtx.open} "${wireSum()}"`);
  writeFileSync(join(LOGS, 'brief-wire-calm.txt'), `summary: ${wireSum()}\nopen: ${wireCtx.open}\n\n${visibleText(wireCtx)}`);
  G.exc.event = { id: 'frost_minas', tier: 'cata', head: 'FROST HITS MINAS', line: 'The belt froze overnight.' };
  G.renderBrief();
  check('a market signal opens the wire and says so', wireCtx.open === true && wireSum() === 'the wire — a warning in it', `open=${wireCtx.open} "${wireSum()}"`);
  writeFileSync(join(LOGS, 'brief-wire-warning.txt'), `summary: ${wireSum()}\nopen: ${wireCtx.open}\n\n${visibleText(wireCtx)}`);
  G.exc.event = null;
  check('the desk door still sits in the markup', !!byId('brief-desklink'));
  const dSum = collect(byId('brief-demand'), c => c.tagName === 'SUMMARY')[0];
  check('the street row ends · change ›', !!dSum && /· change ›$/.test(dSum.textContent), dSum && dSum.textContent);
  const prepDiff = collect(byId('brief-prep'), c => c.tagName === 'SUMMARY').find(s => /the difference\?/.test(s.textContent || ''));
  check("the prep row still asks 'what's the difference?'", !!prepDiff);
  const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
  check("both 'what's the difference?' folds still stand", (mainSrc.match(/what’s the difference\?/g) || []).length >= 2);
}

// ---- the licence card: three staged steps, Enter walks them ---------------------
G.showLicence();
check('the licence opens as the top modal', G.modals.top() === 'licence', G.modals.top());
{
  const licStepOn = () => [0, 1, 2].find(i => byId(`lic-step-${i}`) && !byId(`lic-step-${i}`).hidden);
  const licText = () => visibleText(byId('licence'));
  const dotsOn = () => [...byId('lic-dots').children].map(d => d.classList.contains('on')).join(',');
  check('step 0 carries the two fields + the lease/sign line',
    licStepOn() === 0 && /the name on the lease · the name on the sign/.test(licText())
    && dotsOn() === 'true,false,false', `${licStepOn()} ${dotsOn()} :: ${licText().slice(0, 200)}`);
  writeFileSync(join(LOGS, 'licence-step-0.txt'), licText());
  byId('lic-name').focus();
  key('Enter');
  check('Enter inside a field advances to the background step', licStepOn() === 1, `step=${licStepOn()}`);
  const bgs = deepText(byId('lic-bgs'));
  check('all four backgrounds sit flat on step 1 — no fold',
    byId('lic-bgs').children.filter(c => c.tagName === 'BUTTON').length === 4
    && collect(byId('licence'), c => c.tagName === 'DETAILS').length === 0, bgs.slice(0, 200));
  check('every background keeps its perk line',
    /8% faster/.test(bgs) && /fees & payouts −10%/.test(bgs) && /regulars warm quicker/.test(bgs) && /names its lean/.test(bgs), bgs.slice(0, 300));
  writeFileSync(join(LOGS, 'licence-step-1.txt'), licText());
  key('Enter', byId('lic-step-1'));
  check('Enter on the card advances to signing', licStepOn() === 2, `step=${licStepOn()}`);
  check('the last step carries role pills + the blank-is-fine hint',
    /signed as/.test(licText()) && /blank is fine — the district decides/.test(licText())
    && dotsOn() === 'false,false,true', `${dotsOn()} :: ${licText().slice(0, 300)}`);
  writeFileSync(join(LOGS, 'licence-step-2.txt'), licText());
  key('Escape');
  check('Escape stays inert on the licence — it is gated', G.modals.top() === 'licence', G.modals.top());
  key('Enter', byId('lic-step-2'));
  await new Promise(r => setTimeout(r, 20));
  check('Enter on the last step signs and closes the card', G.modals.top() !== 'licence', G.modals.top());
  const sig = globalThis.localStorage.getItem('grunds.identity') || '';
  check('the signature persists to localStorage', /"playerName":"Sam"/.test(sig) && /"standName":"THE CORNER CUP"/.test(sig), sig);
}

if (fails.length) { console.error('\nFAILURES:'); for (const f of fails) console.error(' -', f); process.exit(1); }
console.log('\norientation.mjs OK');
