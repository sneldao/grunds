// impact.js — hitstop, volume-preserving object squash, and an FOV punch.
//
// ARCHITECTURE.md ("Game feel"): scale the gameplay delta and keep
// render, camera, and HUD on real time; squash the object that was hit
// with a 1/sqrt(s) counter-scale, then recover; punch FOV and let it
// return. Pose clips already carry a `squash` field — that is a body
// pose, not an object impact.
//
// Reduced motion skips all three. Headless day runs pass holdClock:false
// so a serve cannot stall the fixture clock. Routine serves and balks
// only squash the cup or torso — they never ask for the hold or the
// punch. A chalkboard press and a wave verdict opt in: they are one
// beat, not a tick.

export const HITSTOP_SEC = 0.07;
export const SQUASH_MIN_Y = 0.72;
export const SQUASH_SEC = 0.2;
export const FOV_KICK = 3.2;
export const FOV_SEC = HITSTOP_SEC;

const ID = Object.freeze({ x: 1, y: 1, z: 1 });

// Finished only. t = 0 is the impact, not a reason to drop the hit.
// The slop absorbs binary time (10 + 0.2 - 10 < 0.2).
function over(t, dur) {
  return t >= dur - 1e-4;
}

// t seconds since the hit. Full squash on the impact frame, then a cosine
// recover to identity. X/Z widen so x*y*z stays 1.
export function squashAxes(t, dur = SQUASH_SEC, minY = SQUASH_MIN_Y) {
  if (!(t >= 0) || over(t, dur)) return ID;
  const k = Math.cos((t / dur) * Math.PI / 2);
  const y = 1 + (minY - 1) * k;
  const xz = 1 / Math.sqrt(y);
  return { x: xz, y, z: xz };
}

// Degrees added to the base FOV. Full kick on the impact frame, home
// again when the hitstop window ends.
export function fovKick(t, dur = FOV_SEC, mag = FOV_KICK) {
  if (!(t >= 0) || over(t, dur)) return 0;
  const k = Math.cos((t / dur) * Math.PI / 2);
  return k === 0 ? 0 : -mag * k;
}

// Per-patron object squash (the served cup, or the balker's torso).
// Identity when this part was not the thing hit, and again once recovered.
export function axesFor(patron, part, nowSec) {
  const hit = patron && patron._impact;
  if (!hit || hit.part !== part || !Number.isFinite(nowSec)) return ID;
  const elapsed = nowSec - hit.at;
  if (over(elapsed, SQUASH_SEC)) {
    patron._impact = null;
    return ID;
  }
  return squashAxes(elapsed);
}

export function createImpact({ reduced = false, holdClock = true } = {}) {
  let stopUntil = -Infinity;
  let punchAt = -Infinity;
  const hits = [];

  function strike(nowSec, opts = {}) {
    if (reduced) return false;
    const t = Number.isFinite(nowSec) ? nowSec : 0;
    if (opts.stop !== false && holdClock) stopUntil = Math.max(stopUntil, t + HITSTOP_SEC);
    if (opts.fov !== false) punchAt = t;
    if (opts.patron && opts.part) opts.patron._impact = { at: t, part: opts.part };
    if (opts.object) {
      const prev = hits.find(h => h.object === opts.object);
      if (prev) { prev.at = t; prev.sample = opts.sample || null; prev.duration = opts.duration; }
      else hits.push({ object: opts.object, at: t, sample: opts.sample || null, duration: opts.duration });
    }
    return true;
  }

  function dtScale(nowSec) {
    if (reduced || !holdClock) return 1;
    return nowSec < stopUntil ? 0 : 1;
  }

  function fovDelta(nowSec) {
    if (reduced) return 0;
    return fovKick(nowSec - punchAt);
  }

  function update(nowSec) {
    const t = Number.isFinite(nowSec) ? nowSec : 0;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      const o = h.object;
      const elapsed = t - h.at;
      const dur = Number.isFinite(h.duration) ? h.duration : SQUASH_SEC;
      const sc = o && o.scale;
      if (!(sc && typeof sc.set === 'function')) {
        if (over(elapsed, dur)) hits.splice(i, 1);
        continue;
      }
      if (!o.userData) o.userData = {};
      if (!o.userData._impactBase) o.userData._impactBase = { x: sc.x, y: sc.y, z: sc.z };
      const b = o.userData._impactBase;
      if (over(elapsed, dur)) {
        sc.set(b.x, b.y, b.z);
        o.userData._impactBase = null;
        hits.splice(i, 1);
        continue;
      }
      const a = h.sample ? h.sample(elapsed) : squashAxes(elapsed);
      sc.set(b.x * a.x, b.y * a.y, b.z * a.z);
    }
  }

  return { strike, dtScale, fovDelta, update };
}
