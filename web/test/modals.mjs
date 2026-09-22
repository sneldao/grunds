import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createModalController } from '../js/modals.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

function matchTok(el, tok) {
  if (!el || !el.tagName) return false;
  if (tok.startsWith('#')) return el.id === tok.slice(1);
  if (tok.startsWith('.')) return !!(el.classList && el.classList.contains(tok.slice(1)));
  const m = tok.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (m) return el.hasAttribute ? (m[2] === undefined ? el.hasAttribute(m[1]) : el.getAttribute(m[1]) === m[2]) : false;
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

function makeDoc() {
  const doc = { activeElement: null, defaultView: null };
  function el(tag = 'div', id = '') {
    const e = {
      tagName: String(tag).toUpperCase(), id, children: [], _parent: null, attrs: {},
      style: {}, dataset: {}, disabled: false, hidden: false, inert: false,
      isConnected: true, textContent: '', onclick: null,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { e.attrs[k] = String(v); },
      getAttribute(k) { return e.attrs[k]; },
      hasAttribute(k) { return k in e.attrs; },
      removeAttribute(k) { delete e.attrs[k]; },
      appendChild(c) { c._parent = e; e.children.push(c); return c; },
      append(...cs) { for (const c of cs) e.appendChild(c); },
      remove() { e.isConnected = false; const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
      focus() { doc.activeElement = e; },
      click() { if (!e.disabled && e.onclick) e.onclick({ preventDefault() {} }); },
      matches(sel) { return sel.split(',').some(s => matchTok(e, s.trim())); },
      querySelector(sel) { return e.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const parts = sel.split(',').map(s => s.trim().split(/\s+/));
        const out = [];
        collect(e, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out);
        return out;
      },
      get parentElement() { return e._parent; },
      get isContentEditable() { let a = e; while (a) { if (a.attrs && a.attrs.contenteditable !== undefined && a.attrs.contenteditable !== 'false') return true; a = a._parent; } return false; },
      closest(sel) { let a = e; while (a) { if (a.matches && a.matches(sel)) return a; a = a._parent; } return null; },
    };
    return e;
  }
  doc.createElement = el;
  doc.body = el('body');
  const byId = new Map();
  doc.getElementById = id => byId.get(id) || null;
  doc.register = (id, e) => { e.id = id; byId.set(id, e); return e; };
  return doc;
}
const ev = (key, target, extra = {}) => ({ key, target, preventDefault() { this._pd = true; }, ...extra });

{
  const doc = makeDoc();
  const hud = doc.register('hud', doc.createElement('div'));
  const wirebtn = doc.createElement('button'); wirebtn.id = 'wirebtn'; hud.appendChild(wirebtn);
  doc.body.appendChild(hud);

  const mkModal = (id, kids) => {
    const m = doc.register(id, doc.createElement('div'));
    const p = doc.createElement('div'); p.classList.add('modal-panel');
    for (const k of kids) { k._parent = p; p.children.push(k); }
    m.appendChild(p); doc.body.appendChild(m);
    return { m, p };
  };
  const brief = mkModal('brief', []);
  const bHold = doc.createElement('button'); bHold.id = 'b-hold';
  const bContract = doc.createElement('button'); bContract.id = 'b-contract';
  const bHidden = doc.createElement('button'); bHidden.id = 'b-hidden'; bHidden.hidden = true;
  const bDisabled = doc.createElement('button'); bDisabled.id = 'b-disabled'; bDisabled.disabled = true;
  const bOpen = doc.createElement('button'); bOpen.id = 'brief-open';
  const bInput = doc.createElement('input'); bInput.id = 'brief-mail';
  const bSample = doc.createElement('button'); bSample.id = 'brief-demand-sample';
  for (const k of [bHold, bContract, bHidden, bDisabled, bSample, bInput, bOpen]) { k._parent = brief.p; brief.p.children.push(k); }
  const desk = mkModal('desk', []);
  const dClose = doc.createElement('button'); dClose.id = 'desk-close'; dClose._parent = desk.p; desk.p.children.push(dClose);
  const paywall = mkModal('paywall', []);
  const pBuy = doc.createElement('button'); pBuy.id = 'pw-buy'; pBuy._parent = paywall.p; paywall.p.children.push(pBuy);

  const shortcutLog = [], escapeLog = [];
  const modals = createModalController({
    document: doc,
    onShortcut: (t, e) => shortcutLog.push([t, e.key]),
    onEscape: t => { escapeLog.push(t); if (t === 'desk') modals.close('desk'); else if (t === 'paywall') modals.close('paywall'); },
  });

  wirebtn.focus();
  check(modals.top() === null, 'stack starts empty');
  check(modals.handleKey(ev('r', wirebtn)) === false, 'no modal: keys pass through');

  modals.open('brief');
  check(modals.top() === 'brief', 'brief is top');
  check(hud.hasAttribute('inert') || hud.inert === true, 'background inert while brief open');
  check(brief.m.getAttribute('aria-modal') === 'true' && brief.m.getAttribute('aria-hidden') === 'false', 'top modal aria');
  const dLink = doc.createElement('button'); dLink.id = 'brief-desklink'; dLink._parent = brief.p; brief.p.children.push(dLink);
  dLink.focus();
  modals.open('desk');
  check(modals.top() === 'desk', 'desk stacks over brief');
  check(brief.m.hasAttribute('inert') || brief.m.inert === true, 'underlayer brief inert');
  check(desk.m.getAttribute('aria-modal') === 'true', 'desk is the modal layer');
  check(brief.m.classList.contains('show'), 'brief DOM stays shown under desk');
  modals.open('paywall');
  check(modals.top() === 'paywall', 'paywall stacks over desk');
  check(desk.m.hasAttribute('inert') || desk.m.inert === true, 'desk inert under paywall');
  check(desk.m.classList.contains('show'), 'desk DOM stays shown under paywall');
  check(+brief.m.style.zIndex < +desk.m.style.zIndex && +desk.m.style.zIndex < +paywall.m.style.zIndex,
    `stack zIndex follows focus order: ${brief.m.style.zIndex}/${desk.m.style.zIndex}/${paywall.m.style.zIndex}`);
  const offerGhost = doc.register('offer', doc.createElement('div'));
  doc.body.appendChild(offerGhost);
  modals.refresh();
  check(offerGhost.inert === true || offerGhost.hasAttribute('inert'), 'never-opened owned modal stays inert');

  shortcutLog.length = 0;
  check(modals.handleKey(ev('x', paywall.p)) === true, 'modal key consumed');
  check(shortcutLog.length === 1 && shortcutLog[0][0] === 'paywall', `only top got the key: ${JSON.stringify(shortcutLog)}`);

  check(modals.handleKey(ev('Escape', paywall.p)) === true, 'escape consumed');
  check(modals.top() === 'desk' && !paywall.m.classList.contains('show'), 'escape closed paywall only');
  check(escapeLog[escapeLog.length - 1] === 'paywall', 'escape callback saw paywall');
  modals.handleKey(ev('Escape', desk.p));
  check(modals.top() === 'brief', 'escape closed desk, brief back on top');
  check(doc.activeElement === dLink, 'focus restored to the brief trigger');
  dLink.remove();

  let commits = 0; bOpen.onclick = () => commits++;
  bSample.focus();
  const space = ev(' ', bSample); check(modals.handleKey(space) === true, 'space consumed by modal');
  check(space._pd !== true, 'space on a button must not be prevented');
  check(commits === 0, 'space on a button must not commit');
  const enter = ev('Enter', bSample); modals.handleKey(enter);
  check(enter._pd !== true && commits === 0, 'enter on a button must not be prevented or commit');

  shortcutLog.length = 0;
  modals.handleKey(ev('Enter', brief.p));
  check(shortcutLog.length === 1 && shortcutLog[0][0] === 'brief' && shortcutLog[0][1] === 'Enter', 'panel Enter reached onShortcut');

  bOpen.focus();
  modals.handleKey(ev('Tab', bOpen));
  check(doc.activeElement === bHold, `Tab should wrap to first focusable, got ${doc.activeElement && doc.activeElement.id}`);
  bHold.focus();
  modals.handleKey(ev('Tab', bHold, { shiftKey: true }));
  check(doc.activeElement === bOpen, 'Shift+Tab wraps to last');
  const focusableIds = ['b-hold', 'b-contract', 'brief-demand-sample', 'brief-mail', 'brief-open'];
  modals.handleKey(ev('Tab', doc.body));
  check(doc.activeElement === bHold, 'Tab from outside lands on first focusable');

  shortcutLog.length = 0;
  bInput.focus();
  modals.handleKey(ev('1', bInput));
  check(shortcutLog.length === 0, 'typing in a field must not fire shortcuts');
  modals.handleKey(ev('Enter', bInput));
  check(shortcutLog.length === 0, 'Enter in a field stays native');

  modals.handleKey(ev('Escape', brief.p));
  check(modals.top() === 'brief' && brief.m.classList.contains('show'), 'required modal survives Escape');

  modals.open('desk'); modals.open('paywall');
  paywall.p.focus();
  modals.close('desk');
  check(modals.top() === 'paywall' && doc.activeElement === paywall.p, 'closing a non-top layer never steals focus');
  check(brief.m.inert === true && brief.m.classList.contains('show'), 'deepest underlayer stays shown and inert');
  paywall.m.classList.remove('show');
  check(modals.top() === 'brief', 'top() discards not-shown stack entries');

  modals.closeAll();
  check(modals.top() === null, 'closeAll empties the stack');
  check(!hud.hasAttribute('inert') && hud.inert === false, 'background inert restored');
  modals.dispose();
}
console.log('CONTROLLER stack, trap, inert, focus-restore, key semantics verified');

{
  const doc = makeDoc();
  const m = doc.register('brief', doc.createElement('div'));
  const p = doc.createElement('div'); p.classList.add('modal-panel'); m.appendChild(p); doc.body.appendChild(m);
  const vis = doc.createElement('button'); vis.id = 'vis'; p.appendChild(vis);
  const hid = doc.createElement('button'); hid.id = 'hid'; hid.hidden = true; p.appendChild(hid);
  const det = doc.createElement('details'); det.open = false; p.appendChild(det);
  const sum = doc.createElement('summary'); det.appendChild(sum);
  const sumBtn = doc.createElement('button'); sumBtn.id = 'sum-btn'; sum.appendChild(sumBtn);
  const insideClosed = doc.createElement('button'); det.appendChild(insideClosed);
  const hiddenWrap = doc.createElement('div'); hiddenWrap.style.display = 'none'; p.appendChild(hiddenWrap);
  const inHidden = doc.createElement('button'); inHidden.id = 'in-hidden'; hiddenWrap.appendChild(inHidden);
  const fs = doc.createElement('fieldset'); fs.disabled = true; p.appendChild(fs);
  const inFs = doc.createElement('button'); inFs.id = 'in-fs'; fs.appendChild(inFs);
  const editable = doc.createElement('div'); editable.setAttribute('contenteditable', 'true'); p.appendChild(editable);
  const inEditable = doc.createElement('span'); editable.appendChild(inEditable);
  const wrapped = doc.createElement('button'); wrapped.id = 'wrapped'; p.appendChild(wrapped);
  const innerSpan = doc.createElement('span'); wrapped.appendChild(innerSpan);
  const modals = createModalController({ document: doc });
  modals.open('brief');
  vis.focus();
  modals.handleKey(ev('Tab', vis, { shiftKey: true }));
  check(doc.activeElement === wrapped, `Shift+Tab wraps to the last real focusable, got ${doc.activeElement && (doc.activeElement.id || doc.activeElement.tagName)}`);
  wrapped.focus();
  modals.handleKey(ev('Tab', wrapped));
  check(doc.activeElement === vis, 'Tab wraps back to the first focusable');
  const letter = doc.register('letter', doc.createElement('div'));
  const lp = doc.createElement('div'); lp.classList.add('modal-panel'); letter.appendChild(lp); doc.body.appendChild(letter);
  const ldet = doc.createElement('details'); ldet.open = false; lp.appendChild(ldet);
  const lsum = doc.createElement('summary'); ldet.appendChild(lsum);
  const lhid = doc.createElement('button'); ldet.appendChild(lhid);
  modals.open('letter');
  check(doc.activeElement === lsum, 'first summary of closed details receives focus, not its siblings');
  modals.close('letter');
  const log = [];
  const modals2 = createModalController({ document: doc, onShortcut: (t, e) => log.push(e.key) });
  modals.dispose();
  modals2.open('brief');
  modals2.handleKey(ev('Enter', innerSpan));
  check(log.length === 0, 'Enter on a span inside a button stays native (no commit)');
  modals2.handleKey(ev('1', innerSpan));
  check(log.length === 0, 'digit on a span inside a button stays native');
  modals2.handleKey(ev('y', wrapped));
  check(log.length === 1 && log[0] === 'y', 'y/n routes to onShortcut when a button is focused');
  modals2.handleKey(ev('x', inEditable));
  check(log.length === 1, 'inherited contenteditable suppresses shortcuts');
  modals2.dispose();
}
console.log('FOCUSABLES hidden/disabled/closed-details excluded');

{
  const html = read('web/index.html');
  const css = html;
  for (const id of ['brief', 'offer', 'letter', 'licence', 'paywall', 'desk']) {
    const seg = html.slice(html.indexOf(`id="${id}"`), html.indexOf(`id="${id}"`) + 4000);
    for (const cls of ['modal-panel', 'modal-header', 'modal-body', 'modal-footer'])
      check(seg.includes(cls), `${id} missing .${cls}`);
    check(seg.includes('role="dialog"'), `${id} missing role=dialog`);
  }
  for (const rule of ['.modal:not(.show) { visibility: hidden', '.modal-body', 'overflow: auto', '.modal-footer', 'border-top: 1px solid',
    '#brief-summary', 'text-overflow: ellipsis', '#brief-open { min-height: 44px', 'min(760px, 86', 'calc(100dvh - 32px)'])
    check(css.includes(rule), `stylesheet missing: ${rule}`);
  check(!css.includes('38vh'), 'old 38vh drawer cap should be gone');
}
console.log('STRUCTURE six modals share panel/header/body/footer; CSS scroll+footer rules present (structural only — no geometry proof)');

{
  const schedule = JSON.parse(read('out/wave_schedule.json'));
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
      if (k === 'then') return undefined;
      return anyProxy();
    },
    set: () => true, apply: () => anyProxy(),
  });
  const doc = makeDoc();
  const registry = new Map();
  const mk = (tag, id) => {
    const e = doc.createElement(tag); e.id = id;
    e.getContext = () => anyProxy();
    e.querySelectorAll = sel => { const parts = sel.split(',').map(s => s.trim().split(/\s+/)); const out = []; collect(e, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out); return out; };
    e.querySelector = sel => e.querySelectorAll(sel)[0] || null;
    return e;
  };
  const MODAL_IDS = new Set(['brief', 'offer', 'letter', 'licence', 'paywall', 'desk', 'receipt', 'tutorial', 'title']);
  const CHILD_PARENT = {
    'review-last': 'brief', 'desklink': 'letter', 'open': 'title', 'shareWeek': 'receipt',
    'review-continue': 'receipt', 'review-letter': 'receipt',
    tbody: 'tutorial', ttitle: 'tutorial', tstep: 'tutorial', tnext: 'tutorial', tskip: 'tutorial', tclose: 'tutorial', again: 'receipt',
  };
  const PREFIX_PARENT = { brief: 'brief', offer: 'offer', letter: 'letter', lic: 'licence', licence: 'licence', pw: 'paywall', paywall: 'paywall', desk: 'desk', r: 'receipt', receipt: 'receipt' };
  const getEl = id => {
    if (!registry.has(id)) {
      const e = mk('div', id); registry.set(id, e);
      const par = MODAL_IDS.has(id) ? doc.body : (CHILD_PARENT[id] ? getEl(CHILD_PARENT[id]) : (PREFIX_PARENT[id.split('-')[0]] ? getEl(PREFIX_PARENT[id.split('-')[0]]) : doc.body));
      par.appendChild(e);
    }
    return registry.get(id);
  };
  globalThis.document = {
    getElementById: getEl,
    createElement: t => t === 'canvas' ? { width: 480, height: 72, getContext: () => anyProxy(), style: {}, addEventListener() {} } : mk(t, ''),
    createElementNS: () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} }),
    querySelectorAll: sel => {
      const parts = sel.split(',').map(s => s.trim().split(/\s+/));
      const out = [];
      collect(doc.body, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out);
      return out;
    },
    body: doc.body,
    get activeElement() { return doc.activeElement; },
  };
  globalThis.window = globalThis;
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  globalThis.devicePixelRatio = 1;
  globalThis.location = { search: '?speed=1200' };
  const keyHandlers = [];
  globalThis.addEventListener = (t, f) => { if (t === 'keydown') keyHandlers.push(f); };
  let rafCb = null;
  globalThis.requestAnimationFrame = cb => { rafCb = cb; };
  globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
  class AC { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
    createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
    resume() {} }
  globalThis.AudioContext = AC;
  globalThis.__headless = true;
  let _rs = 424242;
  Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
  const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };

  await import('../js/main.js');
  await new Promise(r => setTimeout(r, 40));
  const G = globalThis.__grunds;
  globalThis.document.getElementById('open').click();
  await new Promise(r => setTimeout(r, 10));
  check(G.phase === 'planning', `expected planning, got ${G.phase}`);
  G.renderBrief();
  check(registry.get('brief').classList.contains('show'), 'renderBrief opened the brief');
  // Day-1 disclosure: contracts fold into one details line, the dead settle
  // pill hides, and hold is the only flat action. Pills inside the fold still
  // take markBriefChoice's aria-pressed (querySelectorAll descends).
  const acts = () => registry.get('brief-actions').children.filter(c => c.tagName === 'BUTTON');
  const fold = () => registry.get('brief-actions').children.find(c => c.id === 'brief-hedge-details');
  const allPills = () => { const f = fold(); return acts().concat(f ? f.children.filter(c => c.tagName === 'BUTTON') : []); };
  check(!!fold(), 'calm day-1 folds the contract pills');
  check(!acts().some(b => b.dataset.id === 'settle'), 'day-1 hides the dead settle pill');
  check(acts().map(b => b.dataset.id).join(',') === 'hold', `day-1 flat actions are just hold, got ${acts().map(b => b.dataset.id)}`);
  check(allPills().length === 4, `day-1 keeps four live moves (3 folded contracts + hold), got ${allPills().length}`);
  check(allPills().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.id).join(',') === 'hold', 'default draft presses only hold');
  const contractBtn = allPills().find(b => b.dataset.id === 'contract');
  contractBtn.click();
  check(contractBtn.getAttribute('aria-pressed') === 'true', 'staged contract reads aria-pressed=true inside the fold');
  check(allPills().find(b => b.dataset.id === 'hold').getAttribute('aria-pressed') === 'false', 'other actions unpressed');
  check(G.stageDayPlan({ hedge: 'bogus' }) === false, 'invalid staging rejected');
  { const e = registry.get('brief-actions'); if (e) e.children.length = 0; }   // shim: textContent='' doesn't clear children
  G.renderBrief();
  check(!!fold() && fold().open === true, 'a staged contract keeps the fold open through re-render');
  check(allPills().find(b => b.dataset.id === 'contract').getAttribute('aria-pressed') === 'true', 'aria state persists through re-render');
  check(G.plan.hedge === 'contract', 'staged plan persists through re-render');
  const nut = registry.get('brief-nut').textContent;
  check(/committed minimum/.test(nut) && /fixed/.test(nut), 'quote prints the committed-minimum breakdown');
  check(/cups just to cover/.test(nut), 'quote prints the breakeven cup target');
  check(!/campaign net position/.test(nut), 'day-1 quote holds the net position until there is history');
  const debtBefore = G.stats().debt;
  for (const h of keyHandlers) h({ key: '2', target: null, preventDefault() {} });
  for (const h of keyHandlers) h({ key: 'r', target: null, preventDefault() {} });
  check(G.phase === 'planning' && G.stats().debt === debtBefore, 'game keys cannot fire under the brief');
  check(G.modals.top() === 'brief', 'controller top is the brief');
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — modal stack/focus/keys verified on the real controller; structural markup + Brief aria verified headless');
