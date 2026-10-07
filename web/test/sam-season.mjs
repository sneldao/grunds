// Phase 4 — Sam's season: grudges, the Saturday truce, a finale with memory.
// Verifies season state, grudge tally copy, truce offer + ceasefire mechanics,
// and the history-weighted finale. File-shape on main.js/patrons.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');

// (1) Season state: grudges, truce, offer flag
test('Phase 4 · Sam season state is declared', () => {
  assert.match(main, /samGrudge = \{ cuts: 0, preps: 0, snubs: 0 \}/);
  assert.match(main, /samTruce = false, truceShown = false/);
});

// (2) rivalReact counts cuts + preps all week (headless still skips)
test('Phase 4 · rivalReact tallies the season', () => {
  assert.match(main, /samGrudge\.preps \+= 1/);
  assert.match(main, /samGrudge\.cuts \+= 1/);
  assert.match(main, /if \(headless\) return;/);
});

// (3) Brief tallies the season on the chalkboard line
test('Phase 4 · chalkboard copy counts the season from 2 incidents', () => {
  const idx = main.indexOf('the chalkboard says TRY HARDER');
  assert.ok(idx > 0, 'grudge line must exist');
  assert.match(main, /sCut \+ sPrep \+ sSnub >= 2/);
  assert.match(main, /snub\$\{sSnub > 1 \? 's' : ''\}/);
});

// (4) Truce: day 3, pre-wave window, beat with real accept/decline
test('Phase 4 · truce is offered day 3 with a split-or-snub trade', () => {
  assert.match(main, /day === 3 && !truceShown && dayMin >= 600 && dayMin < 1000/);
  assert.match(main, /split the street and both survive it/);
  assert.match(main, /accept\(\) \{ samTruce = true/);
  assert.match(main, /decline\(\) \{ samGrudge\.snubs \+= 1/);
  assert.match(main, /Saturday ceasefire — no bleeding, no feast/);
});

// (5) Ceasefire mechanics: flag, spawn gates, quieter Saturday
test('Phase 4 · ceasefire stops crossings and quiets Saturday', () => {
  assert.match(main, /patrons\.truceCeasefire = samTruce && d === 5/);
  assert.match(main, /samTruce && day === 5 \? 0\.92 : 1/);
  assert.match(patrons, /truceCeasefire = false/);
  assert.match(patrons, /!this\.truceCeasefire && this\.rivalQ\.length < 42/);
  assert.match(patrons, /!this\.truceCeasefire && this\.random\(\) < 0\.7/);
});

// (6) Finale: grudge row, truce row, snubbed Sam breaks DEUCE ties
test('Phase 4 · finale remembers the season and breaks ties on snubs', () => {
  assert.match(main, /remembers.*cuts.*prep-days.*snubs/);
  assert.match(main, /Saturday ceasefire.*held — no bleeding, no feast/);
  assert.match(main, /if \(wkWin === 'tie' && samGrudge\.snubs > 0\) wkWin = COPY\.rivalBarista/);
});

// (7) Reset rewinds the season
test('Phase 4 · campaign reset clears Sam’s season', () => {
  assert.match(main, /samGrudge = \{ cuts: 0, preps: 0, snubs: 0 \}; samTruce = false; truceShown = false;/);
});
