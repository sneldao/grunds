// portrait.js — Phase 0: seeded procedural portraits (ART.md).
//
// Split like shareCard.js: pure spec generation (node-testable, no DOM) plus
// a thin painter onto a caller-supplied 2D context. Only portraitCanvas()
// touches document, so importing this module in Node is DOM-free.
//
// A face is forever: avatarSpec(seed, cohort) is deterministic — same seed
// always yields the same spec. Never re-roll a living patron.

export const PORTRAIT_SIZE = 128;

// ART.md palette, canvas form.
export const PAL = {
  ink: '#171310',
  paper: '#efe6d3',
  cream: '#f6efe0',
  brass: '#c9a227',
  matcha: '#86a860',
  neg: '#d0603b',
  teal: '#7fb3b0',
  walnut: '#4a3423',
  slate: '#2a2c34',
};

const SKINS = ['#f2d3b3', '#e0ac82', '#c68642', '#8d5524', '#5c3a21'];
const HAIR_COLORS = [PAL.ink, PAL.walnut, '#8a7a63', PAL.brass, PAL.neg];
const HAIR_STYLES = ['side-part', 'bob', 'bun', 'fade', 'curls', 'beanie'];
const ACCESSORIES = ['none', 'glasses', 'earring', 'hat'];

// Cohort clothing stays inside the ART.md cohort palettes.
const COHORT_CLOTHING = {
  commuters: [PAL.walnut, PAL.slate],
  creatives: [PAL.ink, PAL.teal],
  students: [PAL.matcha, PAL.brass],
  elders: [PAL.cream, PAL.walnut],
  tourists: [PAL.teal, PAL.brass],
  rival: [PAL.cream, PAL.ink],
};
const DEFAULT_CLOTHING = [PAL.matcha, PAL.teal];

export const MOODS = ['warm', 'flat', 'sour'];

// FNV-1a → uint32. Deterministic string seed.
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 PRNG. Pure function of the numeric seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// avatarSpec(seedStr, cohort) → { skin, hairStyle, hairColor, accessory,
// clothing }. Deterministic: same inputs, same face, forever.
export function avatarSpec(seedStr, cohort) {
  const rng = mulberry32(hashSeed(String(seedStr)));
  const clothingPool = COHORT_CLOTHING[cohort] || DEFAULT_CLOTHING;
  return {
    skin: pick(rng, SKINS),
    hairStyle: pick(rng, HAIR_STYLES),
    hairColor: pick(rng, HAIR_COLORS),
    accessory: pick(rng, ACCESSORIES),
    clothing: pick(rng, clothingPool),
  };
}

// paintPortrait(ctx, spec, size = 128, mood = 'flat').
// Draw order (enforced by test): bg → clothing → face → hair → eyes →
// mouth → accessory. Flat shapes only — no gradients on faces (ART.md).
export function paintPortrait(ctx, spec, size = PORTRAIT_SIZE, mood = 'flat') {
  const u = size / PORTRAIT_SIZE;
  const cx = size / 2;

  // bg — paper disc with a brass ring (the stamp idiom).
  ctx.fillStyle = PAL.paper;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = PAL.brass;
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.arc(cx, cx, size / 2 - 3 * u, 0, Math.PI * 2);
  ctx.stroke();

  // clothing — shoulders trapezoid at the base.
  ctx.fillStyle = spec.clothing;
  ctx.beginPath();
  ctx.moveTo(cx - 44 * u, size);
  ctx.lineTo(cx - 30 * u, 92 * u);
  ctx.lineTo(cx + 30 * u, 92 * u);
  ctx.lineTo(cx + 44 * u, size);
  ctx.closePath();
  ctx.fill();
  // brass clasp dot.
  ctx.fillStyle = PAL.brass;
  ctx.beginPath();
  ctx.arc(cx, 104 * u, 3.5 * u, 0, Math.PI * 2);
  ctx.fill();

  // face — rounded flesh.
  ctx.fillStyle = spec.skin;
  ctx.beginPath();
  ctx.ellipse(cx, 62 * u, 26 * u, 30 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  // hair — six styles, all flat caps over the crown.
  ctx.fillStyle = spec.hairColor;
  const hy = 40 * u;
  if (spec.hairStyle === 'side-part') {
    ctx.beginPath();
    ctx.ellipse(cx - 2 * u, hy, 27 * u, 14 * u, -0.12, Math.PI, 0);
    ctx.fill();
  } else if (spec.hairStyle === 'bob') {
    ctx.beginPath();
    ctx.ellipse(cx, hy + 6 * u, 29 * u, 22 * u, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
  } else if (spec.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.ellipse(cx, hy, 26 * u, 13 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, hy - 12 * u, 8 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.hairStyle === 'fade') {
    ctx.beginPath();
    ctx.ellipse(cx, hy + 2 * u, 25 * u, 9 * u, 0, Math.PI, 0);
    ctx.fill();
  } else if (spec.hairStyle === 'curls') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 11 * u, hy + (i % 2 ? 2 : -1) * u, 8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spec.hairStyle === 'beanie') {
    ctx.beginPath();
    ctx.ellipse(cx, hy + 1 * u, 27 * u, 15 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = PAL.brass;
    ctx.fillRect(cx - 27 * u, hy - 2 * u, 54 * u, 5 * u);
    ctx.beginPath();
    ctx.arc(cx, hy - 14 * u, 5 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyes — two ink dots. The highest-ROI pixels in the game.
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.arc(cx - 10 * u, 62 * u, 2.6 * u, 0, Math.PI * 2);
  ctx.arc(cx + 10 * u, 62 * u, 2.6 * u, 0, Math.PI * 2);
  ctx.fill();

  // mouth — mood reads here and only here (ART.md).
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath();
  if (mood === 'warm') {
    ctx.arc(cx, 72 * u, 8 * u, Math.PI * 0.15, Math.PI * 0.85);
  } else if (mood === 'sour') {
    ctx.arc(cx, 84 * u, 8 * u, Math.PI * 1.15, Math.PI * 1.85);
  } else {
    ctx.moveTo(cx - 7 * u, 78 * u);
    ctx.lineTo(cx + 7 * u, 78 * u);
  }
  ctx.stroke();

  // accessory — one item, drawn last (in front).
  if (spec.accessory === 'glasses') {
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(cx - 10 * u, 62 * u, 6.5 * u, 0, Math.PI * 2);
    ctx.arc(cx + 10 * u, 62 * u, 6.5 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 3.5 * u, 62 * u);
    ctx.lineTo(cx + 3.5 * u, 62 * u);
    ctx.stroke();
  } else if (spec.accessory === 'earring') {
    ctx.fillStyle = PAL.brass;
    ctx.beginPath();
    ctx.arc(cx + 26 * u, 68 * u, 3 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (spec.accessory === 'hat') {
    ctx.fillStyle = PAL.walnut;
    ctx.beginPath();
    ctx.ellipse(cx, 34 * u, 28 * u, 9 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 28 * u, 32 * u, 62 * u, 5 * u);
  }
}

// portraitCanvas(seedStr, cohort, size, mood) → HTMLCanvasElement.
// The ONLY function in this module that touches document.
export function portraitCanvas(seedStr, cohort, size = PORTRAIT_SIZE, mood = 'flat') {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  paintPortrait(canvas.getContext('2d'), avatarSpec(seedStr, cohort), size, mood);
  return canvas;
}
