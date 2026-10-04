// Phase 5 — Pose clips: pure math over the pose system (no DOM, no GL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as poses from '../js/poses.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const src = readFileSync(resolve(root, 'web/js/poses.js'), 'utf8');

test('Phase 5 · poses.js is pure (no DOM, graphics lib, or randomness)', () => {
  for (const banned of ['document', 'window', 'Math.random', 'createElement', 'Date.now']) {
    assert.ok(!src.includes(banned), `poses.js must not reference ${banned}`);
  }
});

test('Phase 5 · pose clips export the full vocabulary', () => {
  for (const k of ['GAIT', 'gaitFor', 'moodFor', 'walkPose', 'sitPose', 'sipPose',
    'celebratePose', 'grumblePose', 'serveReactPose', 'barPose', 'propSway', 'samplePose']) {
    assert.ok(poses[k] !== undefined, `poses must export ${k}`);
  }
});

test('Phase 5 · gait table carries per-cohort character', () => {
  for (const c of ['commuters', 'creatives', 'students', 'elders', 'tourists', 'rival']) {
    assert.ok(poses.GAIT[c], `GAIT must cover ${c}`);
  }
  assert.ok(poses.GAIT.elders.freqMul < poses.GAIT.tourists.freqMul, 'elders slower than tourists');
  assert.ok(poses.GAIT.tourists.freqMul < poses.GAIT.commuters.freqMul, 'tourists slower than commuters');
  assert.ok(poses.GAIT.elders.legSwing < poses.GAIT.commuters.legSwing * 0.5, 'elders swing < half');
  assert.ok(poses.GAIT.elders.bob < poses.GAIT.commuters.bob, 'elders bob less');
  assert.equal(poses.gaitFor('???'), poses.GAIT.rival, 'unknown cohort falls back');
});

test('Phase 5 · walkPose is deterministic sine with non-negative bob', () => {
  const g = poses.GAIT.commuters;
  assert.deepEqual(poses.walkPose(0.7, g), poses.walkPose(0.7, g));
  const a = poses.walkPose(0.7, g).legSwing, b = poses.walkPose(0.7 + Math.PI * 2, g).legSwing;
  assert.ok(Math.abs(a - b) < 1e-9, 'legSwing periodic in 2pi');
  for (const ph of [0, 0.5, 1.1, 2.4, 5.9]) {
    assert.ok(poses.walkPose(ph, g).bob >= 0, `bob >= 0 at ${ph}`);
  }
  const e = poses.walkPose(Math.PI / 2, poses.GAIT.elders).legSwing;
  const c = poses.walkPose(Math.PI / 2, poses.GAIT.commuters).legSwing;
  assert.ok(Math.abs(e) < Math.abs(c), 'elders swing less mid-stride');
});

test('Phase 5 · sitPose breathes within bounds, legs folded', () => {
  const s = poses.sitPose(12345, 3);
  assert.ok(Math.abs(s.bob) <= 0.02, 'sit bob bounded');
  assert.ok(Math.abs(s.headRy) <= 0.5, 'head wander bounded');
  assert.equal(s.legSwing, 0, 'sit folds the legs');
  assert.deepEqual(s, poses.sitPose(12345, 3), 'sit deterministic');
  assert.notDeepEqual(poses.sitPose(12345, 3), poses.sitPose(12345, 4), 'sit varies by patron');
});

test('reduced motion holds a still sit', () => {
  const a = poses.sitPose(1000, 2, true);
  const b = poses.sitPose(90000, 9, true);
  assert.deepEqual(a, b, 'a reduced sit does not advance with time or patron');
  for (const k of ['bob', 'lean', 'legSwing', 'armL', 'armR', 'headRy', 'headDip', 'squash']) {
    assert.equal(a[k], 0, `still sit ${k} is the rest pose`);
  }
  const early = poses.samplePose({ sitting: true, idx: 2, nowMs: 1000, reduced: true });
  const late = poses.samplePose({ sitting: true, idx: 4, nowMs: 90000, reduced: true });
  assert.deepEqual(early, late, 'samplePose keeps the still sit');
  assert.notEqual(
    poses.samplePose({ sitting: true, idx: 2, nowMs: 1000 }).headRy,
    poses.samplePose({ sitting: true, idx: 2, nowMs: 90000 }).headRy,
    'the sit loop still breathes when motion is allowed',
  );
  const walk = poses.samplePose({ walking: true, phase: 0.4, gait: poses.GAIT.students, reduced: true });
  assert.notEqual(walk.legSwing, 0, 'reduced motion stills the sit, not the walk');
});

test('Phase 5 · sipPose eases in and out (no snap)', () => {
  const z0 = poses.sipPose(0), z1 = poses.sipPose(1), mid = poses.sipPose(0.5);
  assert.ok(Math.abs(z0.armR) < 1e-9 && Math.abs(z1.armR) < 1e-9, 'sip rests at ends');
  assert.ok(Math.abs(mid.armR - 0.6) < 1e-9, 'sip peaks mid-sip');
  assert.ok(Math.abs(mid.headDip - 0.04) < 1e-9, 'head dips mid-sip');
  assert.ok(mid.armR > z0.armR, 'midpoint above endpoints');
});

test('Phase 5 · celebrate peaks mid, grumble shake decays', () => {
  const c0 = poses.celebratePose(0), c1 = poses.celebratePose(1), cm = poses.celebratePose(0.5);
  assert.ok(Math.abs(c0.armL) < 1e-9 && Math.abs(c1.armL) < 1e-9, 'celebrate rests at ends');
  assert.ok(cm.bob > 0.05 && cm.armL > 0.8, 'celebrate peaks mid');
  assert.ok(cm.armL > 0.65, 'celebrate is sine, not linear ramp');
  const early = Math.abs(poses.grumblePose(0.25).headRy), late = Math.abs(poses.grumblePose(0.9).headRy);
  assert.ok(late < early, 'grumble shake decays');
});

test('Phase 5 · serveReactPose dispatches on mood', () => {
  assert.deepEqual(poses.serveReactPose(0.5, 'warm'), poses.celebratePose(0.5));
  assert.deepEqual(poses.serveReactPose(0.5, 'sour'), poses.grumblePose(0.5));
  const flat = poses.serveReactPose(0.5, 'flat');
  assert.ok(Math.abs(flat.headDip) <= 0.1 && flat.armL === 0, 'flat is a small nod');
});

test('Phase 5 · moodFor maps opinion to warm/flat/sour', () => {
  assert.equal(poses.moodFor(0.3), 'warm');
  assert.equal(poses.moodFor(-0.3), 'sour');
  assert.equal(poses.moodFor(0), 'flat');
  assert.equal(poses.moodFor(NaN), 'flat');
  assert.equal(poses.moodFor(undefined), 'flat');
  assert.equal(poses.moodFor(99), 'warm');
});

test('Phase 5 · samplePose blends walk/sit/sip/react with exact keys', () => {
  const g = poses.GAIT.commuters;
  const w = poses.samplePose({ phase: 0.7, gait: g, walking: true, idx: 1, nowMs: 999 });
  assert.deepEqual(w, { ...poses.walkPose(0.7, g) }, 'walking equals walkPose');
  const sit = poses.samplePose({ sitting: true, idx: 2, nowMs: 999 });
  assert.equal(sit.legSwing, 0, 'sitting folds legs');
  const sip = poses.samplePose({ sitting: true, idx: 2, nowMs: 999, sipT: 0.5 });
  assert.ok(sip.armR > sit.armR && sip.headDip > 0, 'sip layers additively');
  const calm = poses.samplePose({ phase: 0.7, gait: g, walking: true, idx: 1, nowMs: 999, reactKind: 'celebrate', reactT: 0 });
  assert.deepEqual(calm, w, 'react at t=0 matches base');
  const hot = poses.samplePose({ phase: 0.7, gait: g, walking: true, idx: 1, nowMs: 999, reactKind: 'celebrate', reactT: 0.5 });
  assert.notDeepEqual(hot, w, 'react mid-blend deviates');
  for (const k of ['bob', 'lean', 'legSwing', 'armL', 'armR', 'headRy', 'headDip', 'squash']) {
    assert.ok(Number.isFinite(hot[k]), `samplePose.${k} finite`);
  }
  assert.deepEqual(Object.keys(hot).sort(),
    ['armL', 'armR', 'bob', 'headDip', 'headRy', 'lean', 'legSwing', 'squash']);
});

