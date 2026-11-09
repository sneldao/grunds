// Barista Stance — Tactical Floor Agency
// Verifies Ruth's live stance toggle: steady, rush, craft.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = `${ROOT}/js/main.js`;
const PATRONS = `${ROOT}/js/patrons.js`;
const INDEX = `${ROOT}/index.html`;

const main = readFileSync(MAIN, 'utf8');
const patrons = readFileSync(PATRONS, 'utf8');
const index = readFileSync(INDEX, 'utf8');

test('barista-stance: HTML button declared in levers', () => {
  assert.match(index, /<button id="stance">Ruth: Steady <kbd>S<\/kbd><small>balanced pace & craft<\/small><\/button>/);
});

test('barista-stance: patrons initializes ruthStance to steady', () => {
  assert.match(patrons, /this\.ruthStance = 'steady'/);
});

test('barista-stance: patrons scales bar prep points by stance', () => {
  assert.match(patrons, /const stancePaceMul = this\.ruthStance === 'rush' \? 1\.35 : \(this\.ruthStance === 'craft' \? 0\.72 : 1\.0\)/);
  assert.match(patrons, /const staffed = \(ECON\.barPoints \+ \(this\.skillPts \|\| 0\)\) \* \(this\.staffMul \|\| 1\) \* stancePaceMul/);
});

test('barista-stance: commuters balk faster in craft and hold in rush', () => {
  assert.match(patrons, /if \(this\.ruthStance === 'craft' && p\.cohort === 'commuters'\) stanceBalkMul = 1\.35/);
  assert.match(patrons, /else if \(this\.ruthStance === 'rush' && p\.cohort === 'commuters'\) stanceBalkMul = 0\.75/);
});

test('barista-stance: main declares ruthStance and toggleRuthStance', () => {
  assert.match(main, /let ruthStance = 'steady'/);
  assert.match(main, /function toggleRuthStance/);
  assert.match(main, /function updateStanceButton/);
});

test('barista-stance: keydown listener binds S key', () => {
  assert.match(main, /else if \(e\.key === 's' \|\| e\.key === 'S'\) toggleRuthStance\(\)/);
});

test('barista-stance: stance button click is wired', () => {
  assert.match(main, /bindPress\(\$\('stance'\), \(\) => toggleRuthStance\(\)\)/);
});

test('barista-stance: window.__grunds exports stance API', () => {
  assert.match(main, /toggleRuthStance, ruthStance: \(\) => ruthStance/);
});

test('barista-stance: craft stance rewards creatives and elders with opinion', () => {
  assert.match(main, /if \(e\.stance === 'craft' && \(e\.p\.cohort === 'creatives' \|\| e\.p\.cohort === 'elders'\)\)/);
  assert.match(main, /else if \(e\.stance === 'rush' && e\.p\.cohort === 'creatives'\)/);
});

test('floor-tactics: table bussing button declared in levers', () => {
  assert.match(index, /<button id="busbtn">Bus tables <kbd>B<\/kbd><small>clear dirty cups<\/small><\/button>/);
});

test('floor-tactics: main binds B key and busbtn click to busTables', () => {
  assert.match(main, /else if \(e\.key === 'b' \|\| e\.key === 'B'\) busTables\(\)/);
  assert.match(main, /bindPress\(\$\('busbtn'\), \(\) => busTables\(\)\)/);
  assert.match(main, /function busTables\(\)/);
  assert.match(main, /window\.__grunds[\s\S]*busTables/);
});

test('floor-tactics: patrons marks table dirty on sitter departure and avoids all-dirty room', () => {
  assert.match(patrons, /this\.world\.markTableDirty\(p\.seat\.table\)/);
  assert.match(patrons, /const dirtyAll = this\.world\?\.dirtyCount \? this\.world\.dirtyCount\(\) >= 3 : false/);
});

test('rival-spillover: jammed Sam queue defects to player', () => {
  assert.match(patrons, /this\.rivalQ\.length >= 6 && this\.counterQ\.length <= 2/);
  assert.match(patrons, /ev\.push\(\{ type: 'rivalSpillover', p \}\)/);
  assert.match(main, /e\.type === 'rivalSpillover'/);
});

test('social-contagion: glowing regulars spread good gossip bubbles', () => {
  assert.match(main, /r\.op > 0\.65 && floorRng\(\) < 0\.30/);
  assert.match(main, /fx\.gossipBubbles\?\.\(e\.p/);
});
