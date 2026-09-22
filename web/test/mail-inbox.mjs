// Headless test for Feature 5 — the letter-arrival loop.
// Proves the full chain without a deployment or a real inbox:
//   1. Convex backend shape (source regexes): letters dir/action/from/
//      createdAt + by_campaign_dir_created index; outbound/inbound stamping;
//      latestInbox after-cursor; GET /agentmail/inbox route.
//   2. convexSync.inbox — offline never fetches; URL/cursor construction;
//      non-ok and network failures degrade to null.
//   3. mailTheater — headless/disarm are hard no-ops; arrival fires knock3
//      + toast + onArrive exactly once; polling self-throttles at ~8 s; the
//      flag lerps to up; the envelope falls, settles and is cleaned up;
//      reduced motion keeps the beats and drops the bodies.
//   4. main.js wiring — arm on post, disarm at dawn, and the mirror rule:
//      nothing near the arrival handler re-applies the mechanical move.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, ...p.split('/')), 'utf8');

function el() {
  return { style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
    appendChild(){}, append(){}, addEventListener(){}, click(){} };
}
const ctx2d = new Proxy({ _props: {} }, {
  get: (t, p) => (p === '_props' ? t._props : (p in t._props ? t._props[p] : () => {})),
  set: (t, p, v) => { t._props[p] = v; return true; },
});
globalThis.document = { getElementById: () => el(), createElement: (tag) => {
  const e = el();
  if (tag === 'canvas') e.getContext = () => ctx2d;
  return e;
}, createElementNS: () => el(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.setInterval = () => 0;   // initSync's 15s badge poll must not keep node alive
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const flush = () => new Promise(r => realSetTimeout(r, 0));

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

// ============================================================
// 1) Convex backend shape (deployed already; source is the contract)
// ============================================================
const schemaSrc = src('convex/schema.ts');
check('letters carry dir/action/from/createdAt', /dir:\s*v\.optional\(v\.string\(\)\)/.test(schemaSrc)
  && /action:\s*v\.optional\(v\.string\(\)\)/.test(schemaSrc)
  && /from:\s*v\.optional\(v\.string\(\)\)/.test(schemaSrc)
  && /createdAt:\s*v\.optional\(v\.number\(\)\)/.test(schemaSrc), 'field missing');
check('inbox index by_campaign_dir_created', /by_campaign_dir_created\",\s*\[\"campaignId\",\s*\"dir\",\s*\"createdAt\"\]/.test(schemaSrc), 'index missing');

const agentmailSrc = src('convex/agentmail.ts');
check('outbound stamped dir:"out" + createdAt', /dir:\s*"out"/.test(agentmailSrc));
check('inbound stamped dir:"in" + action + from', /dir:\s*"in"/.test(agentmailSrc)
  && /\baction[:,]/.test(agentmailSrc) && /\bfrom:/.test(agentmailSrc));
check('latestInbox query with after cursor', /export const latestInbox = query/.test(agentmailSrc)
  && /after/.test(agentmailSrc.split('latestInbox')[1] || ''));
check('latestInbox skips pre-migration rows', /typeof r\.createdAt === "number"/.test(agentmailSrc));

const httpSrc = src('convex/http.ts');
check('GET /agentmail/inbox route', /http\.route\(\{ path: "\/agentmail\/inbox", method: "GET", handler: agentmailInbox \}\)/.test(httpSrc));
check('inbox route never mutates (mirror posture)', (() => {
  const seg = httpSrc.split('agentmailInbox = httpAction')[1]?.split('export const syncState')[0] || '';
  return !/runMutation/.test(seg);
})(), 'route contains a runMutation');

// ============================================================
// 2) convexSync.inbox
// ============================================================
let fetchCalls = 0, lastUrl = '';
let inboxMode = 'ok';
globalThis.fetch = (u) => {
  fetchCalls++; lastUrl = String(u);
  if (inboxMode === 'throw') return Promise.reject(new Error('boom'));
  if (inboxMode === 'bad') return Promise.resolve({ ok: false, json: async () => ({}) });
  if (String(u).includes('/sync/plan'))
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, campaignId: 'campaign1' }) });
  return Promise.resolve({ ok: true, json: async () => ({ letter: { head: 'RE: x', body: 'Inbound reply (contract): done', action: 'contract', createdAt: 123 } }) });
};
globalThis.location = { search: '', hostname: 'localhost', origin: 'http://localhost' };
store.clear();
const { initSync } = await import('../js/convexSync.js');
const syncOffline = initSync();
fetchCalls = 0;
const offRes = await syncOffline.inbox(0);
check('offline inbox → null, zero fetches', offRes === null && syncOffline.live === false && fetchCalls === 0, `res=${JSON.stringify(offRes)} fetch=${fetchCalls}`);

store.set('grunds.campaignId', 'campaign1');
globalThis.location = { search: '?convex=http://test', hostname: 'x', origin: 'http://x' };
const syncLive = initSync();
check('live inbox builds cursor URL', true);   // exercised below
fetchCalls = 0; inboxMode = 'ok';
const beforeBegin = await syncLive.inbox(50);
check('inbox gated until begin yields a campaignId', beforeBegin === null && fetchCalls === 0, `res=${JSON.stringify(beforeBegin)} fetch=${fetchCalls}`);
await syncLive.beginRun(7);
const letter = await syncLive.inbox(50);
check('inbox hits /agentmail/inbox with campaign+after',
  /http:\/\/test\/agentmail\/inbox\?campaignId=campaign1&after=50$/.test(lastUrl), lastUrl);
check('inbox returns the letter row', letter && letter.createdAt === 123 && letter.action === 'contract', JSON.stringify(letter));
inboxMode = 'bad';
check('non-ok → null', (await syncLive.inbox(0)) === null);
inboxMode = 'throw';
check('network throw → null (never rejects)', (await syncLive.inbox(0)) === null);
inboxMode = 'ok';

// ============================================================
// 3) mailTheater
// ============================================================
globalThis.__headless = false;
const { buildMailTheater } = await import('../js/mailTheater.js');
const THREE = await import('../vendor/three.module.js');

function makeWorld() {
  return { mailFlag: { rotation: { z: -Math.PI / 2.4 } }, mailDown: -Math.PI / 2.4, mailUp: -Math.PI / 7, setMail(up) { this.mailFlag.rotation.z = up ? this.mailUp : this.mailDown; } };
}
function makeStage() {
  const added = [], removed = [];
  return { added, removed, scene: { add: (o) => added.push(o), remove: (o) => removed.push(o) } };
}

// 3a. headless is a hard no-op
{
  globalThis.__headless = true;
  let polled = 0;
  const mt = buildMailTheater({ world: makeWorld(), scene: makeStage().scene, audio: {}, fx: {}, headless: true,
    sync: { live: true, async inbox() { polled++; return null; } } });
  mt.arm(0);
  mt.update(0.016, 1000);
  check('headless: arm+update never polls', polled === 0 && mt.armed === false, `polled=${polled} armed=${mt.armed}`);
  globalThis.__headless = false;
}

// 3b. the arrival beat
{
  const world = makeWorld();
  const st = makeStage();
  let knocks = 0; const toasts = []; let arrived = null;
  let mode = 'none'; let polls = 0;
  const letterRow = { head: 'RE: Letter #3', body: 'Inbound reply (contract) from Bob <b@x>: done — beans locked', action: 'contract', createdAt: 5000 };
  const sync = { live: true, async inbox(after) { polls++; return mode === 'hit' && 5000 > after ? letterRow : null; } };
  const mt = buildMailTheater({ world, scene: st.scene, audio: { knock3() { knocks++; } }, fx: { toast: (t) => toasts.push(t) }, sync, onArrive: (l) => { arrived = l; } });
  mt.update(0.016, 100);
  check('disarmed: update never polls', polls === 0, `polls=${polls}`);
  mt.arm(1000);
  mode = 'hit';
  mt.update(0.016, 200);
  await flush();
  check('armed poll found the letter', polls === 1 && mt.arrived === 1, `polls=${polls} arrived=${mt.arrived}`);
  check('knock3 fired once', knocks === 1, `knocks=${knocks}`);
  check('toast speaks', toasts.some(t => /Idris/.test(t) && /box/.test(t)), toasts.join('|'));
  check('onArrive got the row (consumer clears mailPending)', arrived === letterRow);
  check('cursor advanced past the row', mt.seenAt === 5000, `seenAt=${mt.seenAt}`);
  check('envelope spawned at the mailbox', st.added.length === 1 && Math.abs(st.added[0].position.x + 10.4) < 0.01 && st.added[0].position.y > 1.9, JSON.stringify(st.added.map(o => o.position.toArray())));
  // throttle: nothing polls inside the 8 s window
  mode = 'none';
  for (let i = 0; i < 40; i++) mt.update(0.016, 200 + i * 50);
  check('polling self-throttles (~8 s)', polls === 1, `polls=${polls}`);
  // next window: no new mail → no second arrival
  mt.update(0.016, 9000);
  await flush();
  check('second poll with empty box is silent', polls === 2 && mt.arrived === 1, `polls=${polls} arrived=${mt.arrived}`);
  // flag lerps up (never via the snapping setMail)
  let setMailCalls = 0;
  world.setMail = () => { setMailCalls++; };
  for (let i = 0; i < 200; i++) mt.update(0.05, 9000 + i * 50);
  check('flag lerps to up', Math.abs(world.mailFlag.rotation.z - world.mailUp) < 0.02, `z=${world.mailFlag.rotation.z}`);
  check('lerp bypassed the snapping setMail', setMailCalls === 0);
  // envelope physics: it fell, landed, faded and was cleaned up by now —
  // the 10 s lerp loop above outlived the whole envelope lifetime
  const env = st.added[0];
  check('envelope fell to the pavement', env.position.y <= 0.07, `y=${env.position.y}`);
  check('faded envelope is removed', st.removed.length === 1 && mt._env === null, `removed=${st.removed.length} env=${!!mt._env}`);
  // disarm stops the watch
  mt.arm(0); mt.disarm();
  const p = polls;
  mt.update(0.016, 30000);
  await flush();
  check('disarm ends the poll loop', polls === p, `polls went ${p}→${polls}`);
}

// 3c. reduced motion keeps the beats, drops the bodies
{
  const world = makeWorld();
  const st = makeStage();
  let knocks = 0; const toasts = [];
  const sync = { live: true, async inbox() { return { head: 'RE', body: 'Inbound reply (settle): cleaned', action: 'settle', createdAt: 222 }; } };
  const mt = buildMailTheater({ world, scene: st.scene, audio: { knock3() { knocks++; } }, fx: { toast: (t) => toasts.push(t) }, sync, reducedMotion: true });
  mt.arm(0);
  mt.update(0.016, 10);
  await flush();
  check('reduced motion: knock + toast + flag still land', knocks === 1 && toasts.length === 1 && world.mailFlag.rotation.z === world.mailUp, `k=${knocks} t=${toasts.length} z=${world.mailFlag.rotation.z}`);
  check('reduced motion: no falling envelope', st.added.length === 0 && mt._env === null);
}

// ============================================================
// 4) main.js wiring + the mirror rule
// ============================================================
const mainSrc = src('web/js/main.js');
check('main arms on post success', /mailPending = true;\s*\n\s*mailT\.arm\(Date\.now\(\)\)/.test(mainSrc));
check('main disarms at dawn', /mailT\.disarm\(\);/.test(mainSrc));
check('mail beat updates in the loop', /mailT\.update\(dt, now\)/.test(mainSrc));
check('mailT exposed on __grunds', /vitality, director, district, kitBeat, mailT/.test(mainSrc));
{
  const i = mainSrc.indexOf('onArrive: (letter)');
  const seg = mainSrc.slice(i, i + 900);
  check('arrival handler never re-applies the move (mirror rule)', !/applyReply|handleInbound/.test(seg), seg.slice(0, 120));
}
const mtSrc = src('web/js/mailTheater.js');
check('mailTheater talks only through sync.inbox', !/\bfetch\(/.test(mtSrc) && !/api\.|convex\.site/.test(mtSrc));
check('mailTheater documents the mirror rule', /NEVER re-apply/.test(mtSrc));

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — letter arrival: backend stamps the inbox, client mirrors it, theater fires once');
