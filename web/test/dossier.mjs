// Phase 1 — Dossiers: click a sitter, meet them.
// Verifies dossierLines assembly (stats + feel + friends + templated history)
// and every dossier/board wiring point (portrait, modals, buttons, markup).
//
// Imports identity.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { dossierLines, recordVisit, makeIdentity } from '../js/identity.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');
const modals = readFileSync(resolve(root, 'web/js/modals.js'), 'utf8');

// (1) Stats line: visits + drink always first
test('Phase 1 · dossierLines leads with stage + visits + drink', () => {
  const ident = makeIdentity({ pid: 'x', name: 'Mara', cohort: 'commuters', drink: 'flat white', visits: 9 });
  const lines = dossierLines(ident, { op: 0.3, friends: ['Dev', 'Olu'] });
  assert.equal(lines[0], 'regular · 9 visits · flat white');
  assert.match(lines[1], /warm/);
  assert.match(lines[2], /Dev, Olu/);
});

// (2) Feel line follows op thresholds
test('Phase 1 · feel line reads warming / neutral / unhappy from op', () => {
  const ident = makeIdentity({ pid: 'x', name: 'T', cohort: 'students', drink: 'matcha', visits: 2 });
  assert.match(dossierLines(ident, { op: 0.5 })[1], /warming/);
  assert.match(dossierLines(ident, { op: 0.0 })[1], /neutral/);
  assert.match(dossierLines(ident, { op: -0.5 })[1], /unhappy/);
  // no op → no feel line, no friends → no friends line
  assert.deepEqual(dossierLines(ident), ['warming up · 2 visits · matcha']);
});

// (3) History: templated from real events, newest first, capped at 5
test('Phase 1 · history lines template served / balked / defected, newest first', () => {
  const ident = makeIdentity({ pid: 'x', name: 'Pip', cohort: 'students', drink: 'matcha' });
  recordVisit(ident, { day: 1, outcome: 'served', stayed: true });
  recordVisit(ident, { day: 2, outcome: 'balked' });
  recordVisit(ident, { day: 3, outcome: 'defected' });
  const lines = dossierLines(ident, {});
  assert.match(lines[1], /day 3 — crossed to Glasshouse/);
  assert.match(lines[2], /day 2 — walked out/);
  assert.match(lines[3], /day 1 — served matcha, stayed a while/);
  for (let d = 4; d <= 12; d++) recordVisit(ident, { day: d, outcome: 'served' });
  assert.ok(dossierLines(ident, {}).length <= 1 + 5 + 2);
});

// (4) openProfile paints a mood portrait, fills the card, opens the modal
test('Phase 1 · openProfile paints a 96px mood portrait and opens the modal', () => {
  const idx = main.indexOf('function openProfile');
  assert.ok(idx > 0, 'openProfile must be defined');
  const body = main.slice(idx, idx + 2200);
  assert.match(body, /profileView\(ident/);
  assert.match(body, /portraitCanvas\(faceSeed, cohort, 96/);
  assert.match(body, /op > 0\.2 \? 'warm' : op < -0\.2 \? 'sour' : 'flat'/);
  assert.match(body, /dossier-hello/);
  assert.match(body, /modals\.open\('dossier'\)/);
  const didx = main.indexOf('function openDossier');
  assert.ok(didx > 0, 'openDossier must be defined');
  const dbody = main.slice(didx, didx + 1200);
  assert.match(dbody, /regulars\.regulars\[p\.regularIdx\]/);
  assert.match(dbody, /walkins\.get\(p\.pid\)/);
});

// (5) Board: cast + graduated new faces, fresh every open
test('Phase 1 · renderBoard lists the cast and graduated walk-ins', () => {
  const idx = main.indexOf('function renderBoard');
  assert.ok(idx > 0, 'renderBoard must be defined');
  const body = main.slice(idx, idx + 1500);
  assert.match(body, /board-cast/);
  assert.match(body, /walkins\.graduated\(\)/);
  assert.match(body, /board-new/);
  assert.match(body, /modals\.open\('regulars'\)/);
  // portraits paint in boardRow (40px mood-mapped minis)
  const bidx = main.indexOf('function boardRow');
  assert.ok(bidx > 0, 'boardRow must be defined');
  const bbody = main.slice(bidx, bidx + 1200);
  assert.match(bbody, /portraitCanvas\(faceSeed, cohort, 40/);
});

// (6) Modal controller owns both ids
test('Phase 1 · modals OWNED includes dossier + regulars', () => {
  assert.match(modals, /'dossier', 'regulars'/);
});

// (7) Markup: both modals + buttons + board CSS exist
test('Phase 1 · index.html carries dossier + board modals, buttons, CSS', () => {
  assert.match(html, /id="dossier"/);
  assert.match(html, /id="dossier-portrait"/);
  assert.match(html, /id="dossier-lines"/);
  assert.match(html, /id="dossier-close"/);
  assert.match(html, /id="regulars"/);
  assert.match(html, /id="board-cast"/);
  assert.match(html, /id="board-new"/);
  assert.match(html, /id="board-close"/);
  assert.match(html, /id="regularsbtn"/);
  assert.match(html, /\.b-row/);
});

// (8) Click routing: any identified patron opens a profile; identity-less keeps
// the bubble with NO opinion change (the uncapped wave exploit is gone)
test('Phase 1 · identified clicks open profiles; the wave exploit is removed', () => {
  const idx = main.indexOf("renderer.domElement.addEventListener('click'");
  assert.ok(idx > 0, 'click handler must exist');
  const body = main.slice(idx, idx + 900).split('});')[0];
  assert.match(body, /p\.regularIdx >= 0 \|\| p\.pid/);
  assert.match(body, /openDossier\(p\); return/);
  assert.doesNotMatch(body, /op \+ 0\.06|op \+= 0\.06/);
  const gidx = main.indexOf('function greet(');
  assert.ok(gidx > 0, 'greet must exist');
  const gbody = main.slice(gidx, gidx + 900);
  assert.match(gbody, /greetedToday\.has\(k\)/);
  assert.match(gbody, /Math\.min\(1, r\.op \+ 0\.06\)/);
  assert.match(gbody, /Math\.min\(1, \(head\._op \?\? 0\) \+ 0\.06\)/);
});

// (9) Hover names the relationship in words — never raw op numbers
test('Phase 1 · hover shows stage + feeling words, no op numbers', () => {
  const idx = main.indexOf('function showHover');
  assert.ok(idx > 0, 'showHover must exist');
  const body = main.slice(idx, idx + 1600);
  assert.match(body, /click to meet them/);
  assert.match(body, /p\.pname/);
  assert.doesNotMatch(body, /op \$\{|`op |\.toFixed\(2\)/);
});

// (10) The gesture is once per person per day, reset with the day
test('Phase 1 · Say hello is daily-gated and reset per day', () => {
  assert.match(main, /const greetedToday = new Set\(\)/);
  const pidx = main.indexOf('function prepareDay');
  assert.ok(pidx > 0);
  assert.match(main.slice(pidx, pidx + 1500), /greetedToday\.clear\(\)/);
  const ridx = main.indexOf('function reset()');
  assert.ok(ridx > 0);
  assert.match(main.slice(ridx, ridx + 2600), /greetedToday\.clear\(\)/);
  assert.match(html, /id="dossier-hello"/);
});

// (11) Board rows are real buttons that open the same profile on top
test('Phase 1 · board rows are buttons opening the profile', () => {
  const bidx = main.indexOf('function boardRow');
  const bbody = main.slice(bidx, bidx + 400);
  assert.match(bbody, /createElement\('button'\)/);
  assert.match(bbody, /row\.onclick = onOpen/);
  const ridx = main.indexOf('function renderBoard');
  assert.match(main.slice(ridx, ridx + 1600), /openProfile\(/);
  assert.match(modals, /'dossier', 'regulars'/);
});
