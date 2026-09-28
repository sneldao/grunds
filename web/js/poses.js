// poses.js — pure patron pose clips (ART.md: sine over linear, squash over snap).
//
// DOM-free, deterministic f(inputs) only.
// patrons.js update() samples these per frame; all envelopes ease with sin
// or 0.5-0.5*cos so nothing pops. Gait character derives from COHORTS
// walkSpeed (speed itself stays in patrons.js spawn logic).
//
// Phase 5 — pose/clip system replacing inline sin-math.

export const TAU = Math.PI * 2;

// Per-cohort gait character. freqMul scales the ~7 rad/s phase rate;
// swing amplitudes scale the existing walk pose. Elders shuffle
// (low freq, small swing, low bob), commuters stride.
export const GAIT = {
  commuters: { freqMul: 1.15, legSwing: 0.70, armSwing: 0.50, bob: 0.055, lean: 0.12, sway: 0.09 },
  creatives: { freqMul: 0.90, legSwing: 0.50, armSwing: 0.38, bob: 0.042, lean: 0.08, sway: 0.06 },
  students: { freqMul: 1.00, legSwing: 0.60, armSwing: 0.45, bob: 0.050, lean: 0.10, sway: 0.08 },
  elders: { freqMul: 0.70, legSwing: 0.28, armSwing: 0.22, bob: 0.028, lean: 0.06, sway: 0.04 },
  tourists: { freqMul: 0.95, legSwing: 0.55, armSwing: 0.40, bob: 0.046, lean: 0.09, sway: 0.07 },
  rival: { freqMul: 1.00, legSwing: 0.55, armSwing: 0.40, bob: 0.045, lean: 0.09, sway: 0.06 },
};

export function gaitFor(cohort) {
  return GAIT[cohort] || GAIT.rival;
}

// Opinion (-1..1) → portrait mood. Mirrors portrait.js moodForOp so the
// floor and the faces share one vocabulary. NaN/undefined → flat.
export function moodFor(opinion) {
  if (!Number.isFinite(opinion)) return 'flat';
  if (opinion > 0.2) return 'warm';
  if (opinion < -0.2) return 'sour';
  return 'flat';
}

// Walk clip: leg/arm swing on phase, abs-sin bob (never negative),
// slight forward lean. Deterministic in (phase, gait).
export function walkPose(phase, gait) {
  const g = gait || GAIT.rival;
  return {
    bob: Math.abs(Math.sin(phase)) * g.bob,
    lean: g.lean,
    legSwing: Math.sin(phase) * g.legSwing,
    armL: -Math.sin(phase) * g.armSwing,
    armR: Math.sin(phase) * g.armSwing,
    headRy: 0,
    headDip: 0,
    squash: 0,
  };
}

// Sit clip: settled breathing, legs folded (legSwing 0), head wanders.
// Deterministic in (nowMs, idx) — no clock reads inside.
export function sitPose(nowMs, idx) {
  return {
    bob: Math.sin(nowMs * 0.0016 + idx * 1.7) * 0.012,
    lean: 0,
    legSwing: 0,
    armL: Math.sin(nowMs * 0.0012 + idx) * 0.05,
    armR: -Math.sin(nowMs * 0.0012 + idx) * 0.05,
    headRy: Math.sin(nowMs * 0.00045 + idx * 2.1) * 0.45,
    headDip: 0,
    squash: 0,
  };
}

// Sip envelope: sipT 0..1, soft sin in/out. Peak mid-sip lifts the arm,
// dips the head, leans back. Zeros at both ends — no snap.
export function sipPose(sipT) {
  const e = Math.sin(Math.max(0, Math.min(1, sipT)) * Math.PI);
  return {
    bob: 0,
    lean: -0.14 * e,
    legSwing: 0,
    armL: 0,
    armR: 0.6 * e,
    headRy: 0.12 * e,
    headDip: 0.04 * e,
    squash: 0,
  };
}

// Celebrate: ~0.9s bounce + arms up, sin envelope over t 0..1.
export function celebratePose(t) {
  const c = Math.max(0, Math.min(1, t));
  const e = Math.sin(c * Math.PI);
  return {
    bob: 0.06 * e,
    lean: -0.06 * e,
    legSwing: 0,
    armL: 0.9 * e,
    armR: 0.9 * e,
    headRy: 0,
    headDip: -0.02 * e,
    squash: 0.08 * e,
  };
}

// Grumble: head shake that oscillates and decays, shoulders hunch.
// |shake| shrinks across t so it reads as settling, not looping.
export function grumblePose(t) {
  const c = Math.max(0, Math.min(1, t));
  const e = Math.sin(c * Math.PI);
  const shake = Math.sin(c * Math.PI * 3) * 0.35 * (1 - c * 0.7);
  return {
    bob: 0,
    lean: 0.08 * e,
    legSwing: 0,
    armL: 0.15 * e,
    armR: 0.15 * e,
    headRy: shake,
    headDip: 0.02 * e,
    squash: 0,
  };
}

// Serve-react dispatches on mood: warm celebrates, sour grumbles,
// flat nods small.
export function serveReactPose(t, mood) {
  if (mood === 'warm') return celebratePose(t);
  if (mood === 'sour') return grumblePose(t);
  const c = Math.max(0, Math.min(1, t));
  const e = Math.sin(c * Math.PI);
  return {
    bob: 0,
    lean: 0.05 * e,
    legSwing: 0,
    armL: 0,
    armR: 0,
    headRy: 0,
    headDip: 0.03 * e,
    squash: 0,
  };
}

// Prop sway: cohorts swing their props with their gait.
export function propSway(phase, gait, walking) {
  if (!walking) return 0;
  return Math.sin(phase) * (gait || GAIT.rival).sway;
}

// Single entry patrons.js update() calls. Precedence: walk/sit base,
// then sip layers additively, then serve-react blends by reactT 0..1.
export function samplePose(opts) {
  const {
    phase = 0, gait = GAIT.rival, walking = false,
    nowMs = 0, idx = 0, sitting = false,
    sipT = -1, reactT = -1, reactKind = null, mood = 'flat',
  } = opts || {};
  const base = sitting
    ? { ...sitPose(nowMs, idx) }
    : walking
      ? { ...walkPose(phase, gait) }
      : { ...sitPose(nowMs, idx), legSwing: 0 };
  if (sipT >= 0 && sipT <= 1) {
    const s = sipPose(sipT);
    base.lean += s.lean;
    base.armR += s.armR;
    base.headRy += s.headRy;
    base.headDip += s.headDip;
  }
  if (reactKind && reactT >= 0 && reactT <= 1) {
    const r = reactKind === 'serve'
      ? serveReactPose(reactT, mood)
      : reactKind === 'celebrate'
        ? celebratePose(reactT)
        : grumblePose(reactT);
    const e = Math.sin(Math.max(0, Math.min(1, reactT)) * Math.PI);
    base.bob += r.bob * e;
    base.lean += r.lean * e;
    base.armL += r.armL * e;
    base.armR += r.armR * e;
    base.headRy += r.headRy * e;
    base.headDip += (r.headDip || 0) * e;
    base.squash += (r.squash || 0) * e;
  }
  return base;
}
