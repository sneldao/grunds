// Phase 1 — Patron life arcs.
// Verifies the pure stage machine (identity.js), the day-pool (WalkinPool),
// companion + WOM helpers, client/server rule parity, and every wiring point
// (spawn attach, serve-loop visits, demand extra, board/dossier hooks).
//
// Imports identity.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  STAGES, STAGE_RULES, DEMOTE_OP, DEMOTE_FLOOR, COMPANION_CHANCE,
  WOM_PER_EVANGELIST, POOL_SIZE, POOL_CARRY, MAX_EVENTS,
  stageFor, recordVisit, makeIdentity, memoryLine,
  shouldBringCompanion, womReturnees, WalkinPool,
} from '../js/identity.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const regulars = readFileSync(resolve(root, 'web/js/regulars.js'), 'utf8');
const demand = readFileSync(resolve(root, 'web/js/demand.js'), 'utf8');
const gameConfig = readFileSync(resolve(root, 'convex/gameConfig.ts'), 'utf8');
const schema = readFileSync(resolve(root, 'convex/schema.ts'), 'utf8');
const serverRegulars = readFileSync(resolve(root, 'convex/regulars.ts'), 'utf8');

// (1) Promotion ladder
test('Phase 1 · stageFor climbs visitor → evangelist on visits + op', () => {
  assert.equal(stageFor(0, 0.15), 'visitor');
  assert.equal(stageFor(1, 0.15), 'first-timer');
  assert.equal(stageFor(2, 0.9), 'first-timer');   // visits without enough count
  assert.equal(stageFor(3, 0.11), 'regular');
  assert.equal(stageFor(3, 0.05), 'first-timer');  // visits without warmth
  assert.equal(stageFor(5, 0.41), 'friend');
  assert.equal(stageFor(7, 0.61), 'evangelist');
  assert.equal(stageFor(30, 0.9), 'evangelist');   // ceiling holds
});

// (2) Demotion: one stage on sour op, floored at first-timer
test('Phase 1 · op below DEMOTE_OP drops one stage, never below first-timer', () => {
  assert.equal(DEMOTE_OP, -0.2);
  assert.equal(DEMOTE_FLOOR, 'first-timer');
  assert.equal(stageFor(7, -0.5), 'friend');       // evangelist → friend
  assert.equal(stageFor(5, -0.5), 'regular');      // friend → regular
  assert.equal(stageFor(3, -0.5), 'first-timer');  // regular → first-timer
  assert.equal(stageFor(1, -0.9), 'first-timer');  // floor holds
  assert.equal(stageFor(0, -0.9), 'visitor');      // never-met stays visitor
});

// (3) recordVisit bumps visits, caps events, restages, pours the drink
test('Phase 1 · recordVisit accumulates history and restages', () => {
  const ident = makeIdentity({ pid: 't1', name: 'Test', cohort: 'students', drink: 'matcha' });
  assert.equal(ident.stage, 'visitor');
  recordVisit(ident, { day: 1, outcome: 'served' });
  assert.equal(ident.visits, 1);
  assert.equal(ident.stage, 'first-timer');
  for (let d = 1; d <= 20; d++) recordVisit(ident, { day: d, outcome: 'served' });
  assert.ok(ident.events.length <= MAX_EVENTS);
  assert.equal(ident.stage, 'regular');  // visits high, default op 0.15 > 0.1
  recordVisit(ident, { day: 21, drink: 'iced matcha', outcome: 'served' });
  assert.equal(ident.drink, 'iced matcha');
});

// (4) Companion gate: friend+ only, chance-gated
test('Phase 1 · shouldBringCompanion gates on friend stage + chance', () => {
  assert.equal(COMPANION_CHANCE, 0.35);
  for (const s of ['visitor', 'first-timer', 'regular']) {
    assert.equal(shouldBringCompanion(s, () => 0.0), false);
  }
  assert.equal(shouldBringCompanion('friend', () => 0.1), true);
  assert.equal(shouldBringCompanion('friend', () => 0.9), false);
  assert.equal(shouldBringCompanion('evangelist', () => 0.0), true);
});

// (5) WOM math
test('Phase 1 · womReturnees converts evangelist serves to returnees', () => {
  assert.equal(WOM_PER_EVANGELIST, 2);
  assert.equal(womReturnees(0), 0);
  assert.equal(womReturnees(3), 6);
  assert.equal(womReturnees(-2), 0);
});

// (6) Pool determinism: same seed+day → same faces; new day → new strangers
test('Phase 1 · WalkinPool is deterministic per seed + day', () => {
  const a = new WalkinPool(7); a.ensureDay(1);
  const b = new WalkinPool(7); b.ensureDay(1);
  assert.equal(a.heads.length, POOL_SIZE);
  assert.deepEqual(a.heads.map(h => h.pid), b.heads.map(h => h.pid));
  assert.deepEqual(a.heads.map(h => h.name), b.heads.map(h => h.name));
  const c = new WalkinPool(7); c.ensureDay(2);
  assert.notDeepEqual(
    a.heads.map(h => h.name).sort(),
    c.heads.map(h => h.name).sort(),
  );
});

// (7) draw matches cohort, falls back when empty
test('Phase 1 · WalkinPool.draw deals each head once per day, null on exhaustion', () => {
  const pool = new WalkinPool(7); pool.ensureDay(1);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const h = pool.draw('students', () => 0.99);
    if (!h) break;
    assert.ok(!seen.has(h.pid), 'a head never draws twice in a day');
    assert.equal(h.cohort, 'students');
    seen.add(h.pid);
  }
  assert.equal(pool.draw('students'), null, 'exhausted cohort returns null');
  assert.equal(pool.draw('rival'), null, 'no rival heads ever dealt');
  pool.ensureDay(2);
  assert.ok(pool.draw('students') !== null || !pool.heads.some(h => h.cohort === 'students'),
    'day 2 draws again for the same cohort');
});

// (8) Pool recordVisit nudges op by outcome and restages
test('Phase 1 · pool recordVisit moves op: serve up, balk/defect down, once per day', () => {
  const pool = new WalkinPool(7); pool.ensureDay(1);
  const pid = pool.heads[0].pid;
  pool.recordVisit(pid, { day: 1, outcome: 'served' });
  assert.ok(Math.abs(pool.get(pid)._op - 0.20) < 1e-9);
  const visitsAfter1 = pool.get(pid).visits;
  pool.recordVisit(pid, { day: 1, outcome: 'balked' });
  assert.ok(Math.abs(pool.get(pid)._op - 0.20) < 1e-9, 'same-day balk after a serve must not move op again');
  assert.equal(pool.get(pid).visits, visitsAfter1, 'same-day outcome must not double-count the visit');
  pool.recordVisit(pid, { day: 2, outcome: 'balked' });
  assert.ok(Math.abs(pool.get(pid)._op - 0.12) < 1e-9);
  pool.recordVisit(pid, { day: 3, outcome: 'defected' });
  assert.ok(pool.get(pid)._op < 0.12);
  assert.equal(pool.recordVisit('nope', { day: 3, outcome: 'served' }), null);
});

// (9) Carry-over: known faces survive dawn, strangers don't, pool stays 24
test('Phase 1 · ensureDay carries known faces and deals fresh strangers', () => {
  const pool = new WalkinPool(7); pool.ensureDay(1);
  const known = pool.heads[0].pid, stranger = pool.heads[1].pid;
  pool.recordVisit(known, { day: 1, outcome: 'served' });
  pool.ensureDay(2);
  assert.equal(pool.heads.length, POOL_SIZE);
  assert.ok(pool.get(known), 'visited head carries to day 2');
  assert.equal(pool.get(stranger), null, 'unvisited head does not carry');
  assert.ok(pool.get(known).visits >= 1, 'carried visits persist');
});

// (10) graduated(): regular+ walk-ins, most visits first, capped
test('Phase 1 · graduated lists regular+ walk-ins by visits', () => {
  const pool = new WalkinPool(7); pool.ensureDay(1);
  assert.deepEqual(pool.graduated(), []);
  const pid = pool.heads[0].pid;
  for (let d = 1; d <= 4; d++) pool.recordVisit(pid, { day: d, outcome: 'served' });
  const grads = pool.graduated();
  assert.ok(grads.length >= 1 && grads[0].pid === pid);
  assert.ok(grads.every(h => STAGES.indexOf(h.stage) >= STAGES.indexOf('regular')));
});

// (11) memoryLine branches
test('Phase 1 · memoryLine covers companion / evangelist / friend / quirk / regular / returner', () => {
  assert.match(memoryLine({ name: 'M', stage: 'friend', visits: 6, drink: 'tea', broughtFriend: 'J' }), /brought J/);
  assert.match(memoryLine({ name: 'M', stage: 'evangelist', visits: 9, drink: 'tea' }), /telling everyone/);
  assert.match(memoryLine({ name: 'M', stage: 'friend', visits: 6, drink: 'tea' }), /6 visits/);
  assert.match(memoryLine({ name: 'M', stage: 'regular', visits: 5, drink: 'tea', quirk: 'counts change' }), /counts change/);
  assert.match(memoryLine({ name: 'M', stage: 'regular', visits: 4, drink: 'tea' }), /still on the tea/);
  assert.match(memoryLine({ name: 'M', stage: 'first-timer', visits: 1, drink: 'tea' }), /tea again/);
});

// (12) Client/server rule parity — the mirror must use identical numbers
test('Phase 1 · convex STAGE_RULES match identity.js exactly', () => {
  const num = (src, key) => {
    const m = src.match(new RegExp(key + ':\\s*\\{[^}]*?visits:\\s*(\\d+)(?:[^}]*?op:\\s*([\\d.]+))?'));
    assert.ok(m, `${key} must exist server-side`);
    return { visits: +m[1], op: m[2] === undefined ? null : +m[2] };
  };
  for (const key of ['firstTimer', 'regular', 'friend', 'evangelist']) {
    const server = num(gameConfig, key);
    const client = STAGE_RULES[key];
    assert.equal(server.visits, client.visits, `${key}.visits parity`);
    if (client.op !== undefined) assert.equal(server.op, client.op, `${key}.op parity`);
  }
  assert.match(gameConfig, /DEMOTE_OP = -0\.2/);
  assert.match(gameConfig, /DEMOTE_FLOOR = 'first-timer'/);
});

// (13) Server schema + functions carry identity fields
test('Phase 1 · schema + regulars.ts carry stage/visits/faceSeed/drink + backfill', () => {
  for (const f of ['stage', 'visits', 'faceSeed', 'drink', 'homeTable']) {
    assert.match(schema, new RegExp(`${f}: v\\.optional`), `schema needs optional ${f}`);
  }
  assert.match(serverRegulars, /stageFor\(visits, finalOp\)/);
  assert.match(serverRegulars, /visits,\s*\n?\s*stage: stageFor/);
  assert.match(serverRegulars, /visits: pick\.visits/);
  assert.match(serverRegulars, /ensureIdentityFields/);
});

// (14) Client Regulars class: established cast + noteVisit + mirrored resolve
test('Phase 1 · Regulars entries start established; noteVisit + resolveDay restage', () => {
  assert.match(regulars, /visits: 5,\s*\n?\s*stage: 'regular'/);
  assert.match(regulars, /drink: CANON_DRINKS/);
  assert.match(regulars, /noteVisit\(idx/);
  assert.match(regulars, /r\.visits \+= 1/);
  assert.match(regulars, /for \(const r of this\.regulars\) \{\s*r\.stage = stageFor/);
  assert.match(regulars, /visits: r\.visits, stage: r\.stage, drink: r\.drink/);
});

// (15) patrons.js: identity attach + companion hook + memory greeting
test('Phase 1 · spawn attaches identity, hooks companions, greets by memory', () => {
  assert.match(patrons, /walkins = null/);
  assert.match(patrons, /drink, wantsMatcha: drink === 'matcha'/);
  assert.match(patrons, /pid: null, pname: null, faceSeed: null, preferredDrink: null/);
  assert.match(patrons, /this\.walkins\.draw\(cohort\)/);
  assert.match(patrons, /shouldBringCompanion\(p\.stage, this\.random\)/);
  assert.match(patrons, /this\.spawn\(cohort, zone, quick, true\)/);
  assert.match(patrons, /_greetingFor\(p\)/);
  assert.match(patrons, /memoryLine\(/);
});

// (16) main.js: pool lifecycle + serve-loop visits + WOM + dossier/board wiring
test('Phase 1 · main.js wires pool, visits, WOM, dossier, board', () => {
  assert.match(main, /new WalkinPool\(campaignSeed\)/);
  assert.match(main, /patrons\.walkins = walkins/);
  assert.match(main, /walkins\.ensureDay\(d\)/);
  assert.match(main, /regulars\.noteVisit\(e\.p\.regularIdx/);
  assert.match(main, /walkins\.recordVisit\(e\.p\.pid/);
  assert.match(main, /evangelistServes\+\+/);
  assert.match(main, /extraReturnees: womReturnees\(evangelistServes\)/);
  assert.match(main, /p\.state === 'sit' && \(p\.regularName \|\| p\.pid\)/);
  assert.match(main, /function openDossier/);
  assert.match(main, /function renderBoard/);
  assert.match(main, /\$\('regularsbtn'\)\.onclick/);
});

// (17) demand.js: extraReturnees folds into returnees
test('Phase 1 · demand.resolveDay accepts extraReturnees', () => {
  assert.match(demand, /extraReturnees = 0/);
  assert.match(demand, /todayReturnees = Math\.max\(0, Math\.round\(served \* rate\)\) \+ Math\.max\(0, Math\.floor\(extraReturnees\)\)/);
});
