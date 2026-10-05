// PR-A2 — Cohort prop rigs (briefcase / laptop / cane / camera / backpack).
// Verifies: (1) patrons.js declares 7 prop InstancedMeshes, (2) each is
// zero-scaled at startup AND on _despawn, (3) the per-frame update loop
// sets the prop matrix via _propKeyFor + _placeProp + setMatrixAt,
// (4) each cohort's first prop is anchored at a body slot (rightHip /
// chestFront / upperBack / rightHandGround), (5) rival cohort has no
// props so _propKeyFor returns null.
//
// Pure file-shape test — no DOM, no runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');

// (1) propMeshes map declared with all 7 rigs
test('PR-A2 · propMeshes map declares briefcase + laptop + mug + backpack + notebook + cane + camera', () => {
  const m = patrons.match(/this\.propMeshes\s*=\s*\{[\s\S]*?\};/);
  assert.ok(m, 'this.propMeshes must be declared');
  for (const rig of ['briefcase', 'laptop', 'mug', 'backpack', 'notebook', 'cane', 'camera']) {
    assert.match(m[0], new RegExp(`${rig}\\s*:\\s*mkProp`),
      `propMeshes must include ${rig}`);
  }
});

// (2) prop instances zero-scaled at startup
test('PR-A2 · all prop instances zero-scaled at startup', () => {
  // The startup zero block must include propMeshes
  assert.match(patrons, /zero-scale everything[\s\S]*?Object\.values\(this\.parts\)[\s\S]*?propMeshes/);
  // And it must call setMatrixAt for each prop instance
  assert.match(patrons, /for \(const prop of Object\.values\(this\.propMeshes\)\) for \(let i = 0; i < MAXP; i\+\+\) prop\.setMatrixAt\(i, z\)/);
});

// (3) _despawn zeroes the prop instance too
test('PR-A2 · _despawn zeroes prop instance', () => {
  const idx = patrons.indexOf('_despawn(p)');
  assert.ok(idx > 0, '_despawn must exist');
  const body = patrons.slice(idx, idx + 800);
  assert.match(body, /propMeshes[\s\S]*?setMatrixAt\(p\.idx,\s*z\)/);
});

// (4) _propKeyFor reads p.ritualProps[0] and returns null for empty
test('PR-A2 · _propKeyFor reads p.ritualProps[0], null when empty', () => {
  assert.match(patrons, /_propKeyFor\(p\)\s*\{[\s\S]*?ritualProps[\s\S]*?return props\.length\s*\?\s*props\[0\]\s*:\s*null/);
});

// (5) per-frame update calls _propKeyFor + _placeProp + setMatrixAt
test('PR-A2 · per-frame update positions the prop instance', () => {
  const idx = patrons.indexOf('update(dt, walkMul, now, reduced = false)');
  assert.ok(idx > 0, 'update method must exist');
  const body = patrons.slice(idx);
  assert.match(body, /this\._propKeyFor\(p\)/);
  assert.match(body, /this\._placeProp\(/);
  assert.match(body, /this\.propMeshes\[propKey\]\.setMatrixAt\(p\.idx,\s*d\.matrix\)/);
});

// (6) per-frame loop flushes all prop instances
test('PR-A2 · per-frame loop flushes propMeshes via instanceMatrix.needsUpdate', () => {
  const idx = patrons.indexOf('update(dt, walkMul, now, reduced = false)');
  const body = patrons.slice(idx);
  assert.match(body, /for \(const prop of Object\.values\(this\.propMeshes\)\) prop\.instanceMatrix\.needsUpdate = true/);
});

// (7) Anchor map names all 7 rigs
test('PR-A2 · propAnchors map covers all 7 rigs', () => {
  const m = patrons.match(/this\.propAnchors\s*=\s*\{[\s\S]*?\};/);
  assert.ok(m, 'this.propAnchors must be declared');
  for (const rig of ['briefcase', 'laptop', 'mug', 'backpack', 'notebook', 'cane', 'camera']) {
    assert.match(m[0], new RegExp(`${rig}\\s*:`),
      `propAnchors must include ${rig}`);
  }
});

// (8) Anchors correspond to body slots — verify each cohort's primary prop
//      gets an anchor in the body coordinate space
test('PR-A2 · cohort primary props resolve to body anchors', () => {
  // Cohort-to-rig mapping: commuters → briefcase, creatives → laptop,
  // students → backpack, elders → cane, tourists → camera, rival → none
  // (these are the COHORTS[].props[0] entries)
  const expected = {
    commuters: 'briefcase',
    creatives: 'laptop',
    students:  'backpack',
    elders:    'cane',
    tourists:  'camera',
  };
  // The anchors map must give each rig a slot from the body-coordinate set.
  // We verify by reading the propAnchors map and checking each rig's anchor
  // is a valid body slot.
  const anchorMap = patrons.match(/this\.propAnchors\s*=\s*\{([\s\S]*?)\}/)[1];
  const validAnchors = new Set(['rightHip', 'chestFront', 'upperBack', 'rightHand', 'leftHand', 'rightHandGround']);
  for (const [cohort, rig] of Object.entries(expected)) {
    const re = new RegExp(`${rig}\\s*:\\s*['"](\\w+)['"]`);
    const m = anchorMap.match(re);
    assert.ok(m, `${cohort}'s rig "${rig}" must have an anchor`);
    assert.ok(validAnchors.has(m[1]),
      `${cohort}'s rig "${rig}" anchor "${m[1]}" must be a valid body slot`);
  }
});

// (9) Rival cohort has no props so _propKeyFor returns null
test('PR-A2 · rival cohort has empty props so _propKeyFor returns null', () => {
  const config = readFileSync(resolve(root, 'web/js/config.js'), 'utf8');
  assert.match(config, /rival:\s*\{[^}]*props:\s*\[\]/);
});

// (10) Each cohort's first prop is unique (no two cohorts share a primary rig)
test('PR-A2 · each cohort has a unique primary prop', () => {
  const config = readFileSync(resolve(root, 'web/js/config.js'), 'utf8');
  const cohorts = ['commuters', 'creatives', 'students', 'elders', 'tourists'];
  const seen = new Set();
  for (const coh of cohorts) {
    const m = config.match(new RegExp(`${coh}:\\s*\\{[^}]*props:\\s*\\[\\s*['"](\\w+)['"]`));
    assert.ok(m, `${coh} must declare a primary prop`);
    const prop = m[1];
    assert.ok(!seen.has(prop), `prop "${prop}" is shared across cohorts`);
    seen.add(prop);
  }
});

// (11) Seated pose: _placeProp takes propKey + sitting and folds
// laptop/camera into a lap pose / eye-level pose when seated
test('PR-A2 · _placeProp takes propKey + sitting and branches chestFront on both', () => {
  const idx = patrons.indexOf('_placeProp(d, p, anchor');
  assert.ok(idx > 0, '_placeProp must exist');
  const body = patrons.slice(idx, idx + 2200);
  assert.match(body, /_placeProp\(d,\s*p,\s*anchor,\s*propKey,\s*sitting/);
  // laptop on the lap — tilted forward, dropped to lap height
  assert.match(body, /propKey === 'laptop' && sitting/);
  // camera raised to the eye — held up to look through the viewfinder
  assert.match(body, /propKey === 'camera' && sitting/);
});

// (12) Per-frame call site passes propKey + sitting into _placeProp
test('PR-A2 · per-frame call site threads propKey + sitting into _placeProp', () => {
  const idx = patrons.indexOf('update(dt, walkMul, now, reduced = false)');
  assert.ok(idx > 0, 'update method must exist');
  const body = patrons.slice(idx);
  assert.match(body, /this\._placeProp\(d,\s*p,\s*anchor,\s*propKey,\s*sitting/);
});
