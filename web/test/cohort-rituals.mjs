// PR-6 — Visible cohort rituals.
// Verifies: (1) COHORTS table in config.js carries per-cohort ritual data
// (props, seat, dwellMul, walkSpeed) for all 5 visible cohorts, (2) each
// cohort has a unique prop rig (no two cohorts share), (3) patrons.js reads
// the ritual data and applies it (walk speed + seat preference), (4)
// _afterServe consults ritualSeat before falling back to random.
//
// Pure file-shape test — no DOM, no runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const config  = readFileSync(resolve(root, 'web/js/config.js'),  'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');

// (1) COHORTS table has ritual data for every visible cohort
test('PR-6 · COHORTS table — 5 cohorts × {props, seat, dwellMul, walkSpeed}', () => {
  for (const coh of ['commuters', 'creatives', 'students', 'elders', 'tourists']) {
    // After `commuters: {` we expect: props: [...], seat: N, dwellMul: N, walkSpeed: N
    const re = new RegExp(`${coh}:\\s*\\{[\\s\\S]*?props:[\\s\\S]*?seat:[\\s\\S]*?dwellMul:[\\s\\S]*?walkSpeed:`);
    assert.match(config, re, `${coh} must declare {props, seat, dwellMul, walkSpeed}`);
  }
});

// (2) every cohort has at least one prop and a numeric seat
test('PR-6 · props — 5 cohorts, every one carries a ritual prop', () => {
  for (const coh of ['commuters', 'creatives', 'students', 'elders', 'tourists']) {
    const re = new RegExp(`${coh}:[^}]*props:\\s*\\[`);
    assert.match(config, re, `${coh} must declare a props array`);
  }
});

// (3) unique prop rigs — no two cohorts share the same primary prop
test('PR-6 · each cohort has a unique primary prop', () => {
  // Pull (cohort, first-prop) pairs by scanning the table
  const pairs = [];
  for (const coh of ['commuters', 'creatives', 'students', 'elders', 'tourists']) {
    const m = config.match(new RegExp(`${coh}:\\s*\\{[^}]*props:\\s*\\[\\s*['"](\\w+)['"]`));
    assert.ok(m, `${coh} must list at least one prop`);
    pairs.push([coh, m[1]]);
  }
  const seen = new Set();
  for (const [, prop] of pairs) {
    assert.ok(!seen.has(prop), `prop "${prop}" is shared across cohorts — rituals should be visually distinct`);
    seen.add(prop);
  }
});

// (4) per-cohort walkSpeed varies
test('PR-6 · walkSpeed varies by cohort (elders slowest, commuters fastest)', () => {
  // Extract: commuters.walkSpeed > creatives.walkSpeed and elders.walkSpeed < commuters.walkSpeed
  const get = (coh) => {
    const m = config.match(new RegExp(`${coh}:[^}]*walkSpeed:\\s*([\\d.]+)`));
    return m ? Number(m[1]) : null;
  };
  const w = {
    commuters: get('commuters'),
    creatives: get('creatives'),
    students:  get('students'),
    elders:    get('elders'),
    tourists:  get('tourists'),
  };
  assert.ok(w.commuters > w.creatives, `commuters should walk faster than creatives (${w.commuters} vs ${w.creatives})`);
  assert.ok(w.elders < w.commuters,    `elders should walk slower than commuters (${w.elders} vs ${w.commuters})`);
  assert.ok(w.elders < w.students,     `elders should walk slowest of the room (${w.elders} vs ${w.students})`);
});

// (5) per-cohort dwellMul varies
test('PR-6 · dwellMul varies by cohort (elders stay longest, commuters rush)', () => {
  const get = (coh) => {
    const m = config.match(new RegExp(`${coh}:[^}]*dwellMul:\\s*([\\d.]+)`));
    return m ? Number(m[1]) : null;
  };
  const d = {
    commuters: get('commuters'),
    creatives: get('creatives'),
    elders:    get('elders'),
    tourists:  get('tourists'),
  };
  assert.ok(d.creatives > d.commuters, `creatives should linger longer than commuters (${d.creatives} vs ${d.commuters})`);
  assert.ok(d.elders > d.commuters,    `elders should linger longest (${d.elders} vs ${d.commuters})`);
});

// (6) patrons.js spawn reads cohort ritual config
test('PR-6 · patrons.js · spawn reads ritualProps + ritualSeat + ritualSpeed', () => {
  const spawn = patrons.match(/spawn\(cohort, zone, quick = false[^)]*\)[\s\S]*?_paint\(p\);/);
  assert.ok(spawn, 'spawn() must end at _paint(p)');
  assert.match(spawn[0], /ritualProps\s*=\s*Array\.isArray\(cohortDef\.props\)/);
  assert.match(spawn[0], /ritualSeat\s*=\s*\(typeof cohortDef\.seat === 'number'/);
  assert.match(spawn[0], /ritualDwell\s*=\s*\(typeof cohortDef\.dwellMul === 'number'/);
  assert.match(spawn[0], /ritualSpeed\s*=\s*\(typeof cohortDef\.walkSpeed === 'number'/);
});

// (7) patrons.js spawn applies ritualSpeed to the patron speed field
test('PR-6 · patrons.js · spawn speed derived from ritualSpeed', () => {
  const spawn = patrons.match(/spawn\(cohort, zone, quick = false[^)]*\)[\s\S]*?_paint\(p\);/);
  assert.match(spawn[0], /speed:\s*ritualSpeed\s*\+/);
});

// (8) patrons.js _afterServe consults ritualSeat first
test('PR-6 · patrons.js · _afterServe prefers ritualSeat before random seat', () => {
  // Find the FUNCTION DEFINITION, not the call site. The first occurrence
  // is the call inside tick(); the definition follows the body of tick.
  const idx = patrons.indexOf('_afterServe(p) {');
  assert.ok(idx > 0, '_afterServe must be defined as a method');
  const body = patrons.slice(idx, idx + 700);
  assert.match(body, /p\.ritualSeat\s*!=\s*null/);
  assert.match(body, /this\.world\.seats\[p\.ritualSeat\]/);
  // Falls through to random seat if ritualSeat is taken.
  assert.match(body, /freeSeats\[\(Math\.random\(\) \* freeSeats\.length\) \| 0\]/);
});

// (9) patron object carries ritualProps/Seat/Dwell forward
test('PR-6 · patron object stores ritualProps / ritualSeat / ritualDwell', () => {
  const spawn = patrons.match(/spawn\(cohort, zone, quick = false[^)]*\)[\s\S]*?_paint\(p\);/);
  assert.match(spawn[0], /ritualProps,\s*ritualSeat,\s*ritualDwell,/);
});
