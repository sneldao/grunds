// make-bed.mjs — the film's music bed, synthesized here so it is provably ours.
//
// The event forbids copyrighted material in the submitted film, and the two
// beds carried over from the Convex demo (`capture/audio/bed*.m4a`) have no
// artist, title, or source note — they cannot be cleared, so they cannot be
// used. This generates the brief instead: "a wordless acoustic bed of nylon
// guitar, brushed drums, and upright bass that remains warm and restrained
// beneath the letter," thinning near the end so the sign-off stays clear.
//
// Everything is deterministic: one seeded stream, no Math.random, no samples,
// no network. Re-running produces a byte-identical WAV (and the whole thing is
// in the repo, which is the point — the film's music has a generator, not a
// license).
//
//   node videos/city-remix/music/make-bed.mjs            # → capture/audio/bed.wav
//   node videos/city-remix/music/make-bed.mjs --secs 100 # longer bed
//
// Output: 48 kHz 16-bit stereo WAV. Assembly converts and mixes it; the QC gate
// measures the final mix, not this file.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'capture', 'audio', 'bed.wav');
const SR = 48000;
const secsArg = process.argv.indexOf('--secs');
const DUR = secsArg > -1 ? Number(process.argv[secsArg + 1]) : 95;
const SEED = 0x6c697362; // "lisb" — the seed this whole film is cut against

// ---- deterministic noise ---------------------------------------------------
let s = SEED >>> 0;
const rng = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- tiny DSP --------------------------------------------------------------
const len = Math.ceil(DUR * SR);
const L = new Float32Array(len);
const R = new Float32Array(len);

function put(buf, at, src, amp) {
  const i0 = Math.max(0, Math.round(at * SR));
  for (let i = 0; i < src.length; i++) {
    const j = i0 + i;
    if (j >= buf.length) break;
    buf[j] += src[i] * amp;
  }
}

// Karplus-Strong pluck: a noise burst pumped around a delay line one period
// long. Short, slightly dark decay reads as nylon rather than steel.
function pluck(freq, dur, decay = 0.9895, damp = 0.42) {
  const n = Math.max(4, Math.round(SR / freq));
  const ring = new Float32Array(n);
  let z = 0;
  for (let i = 0; i < n; i++) {
    z = z * (1 - damp) + (rng() * 2 - 1) * damp;   // dark noise seed
    ring[i] = z;
  }
  const out = new Float32Array(Math.ceil(dur * SR));
  let idx = 0, prev = ring[0];
  const a = Math.min(2, Math.round(0.002 * SR));   // 2 ms attack, no click
  for (let i = 0; i < out.length; i++) {
    const cur = ring[idx];
    ring[idx] = (cur + prev) * 0.5 * decay;        // the lossy averaging loop
    prev = cur;
    const env = i < a ? i / a : Math.pow(decay, (i - a) / n);  // note length
    out[i] = cur * env;
    idx = (idx + 1) % n;
  }
  return out;
}

// Felt-upright bass: sine plus a touch of second harmonic, slow attack.
function bass(freq, dur) {
  const out = new Float32Array(Math.ceil(dur * SR));
  const a = Math.round(0.02 * SR);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = (i < a ? i / a : 1) * Math.exp(-t * 1.5) * (1 - Math.exp(-t * 8));
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.22 * Math.sin(4 * Math.PI * freq * t)) * env;
  }
  return out;
}

// Brushed snare / shaker: filtered noise, no pitched tone.
function brush(dur, tone = 0.5) {
  const out = new Float32Array(Math.ceil(dur * SR));
  let lp = 0, hp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const n = rng() * 2 - 1;
    lp = lp * tone + n * (1 - tone);              // keeps the air, drops the fizz
    hp = n - lp;
    out[i] = (lp * 0.8 + hp * 0.5) * Math.exp(-t * (dur < 0.15 ? 55 : 14));
  }
  return out;
}

// ---- the letter's music ----------------------------------------------------
// 76 bpm, 4/4, two bars a chord: Cmaj7 · Am7 · Dm7 · G7 — the warm, unresolved
// loop a café letter wants. Two passes of the form, then thin out under the
// sign-off so the invitation reads.
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  { bass: 36, notes: [55, 59, 64, 67] },  // Cmaj7
  { bass: 33, notes: [52, 57, 60, 64] },  // Am7
  { bass: 38, notes: [57, 60, 62, 65] },  // Dm7
  { bass: 31, notes: [50, 55, 59, 62] },  // G7
];
const BEAT = 60 / 76;
const BAR = BEAT * 4;
const BARS = Math.ceil(DUR / BAR);

for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * BAR;
  if (t0 > DUR) break;
  const ch = CHORDS[bar % CHORDS.length];
  const phrase = Math.floor(bar / CHORDS.length);      // pass through the form
  const thin = t0 > DUR - 12;                          // sign-off: leave space
  const lift = phrase >= 1 && !thin ? 1 : 0;           // a small pulse mid-film

  // nylon arpeggio — thumb on the beat, fingers between
  const pattern = [0, 2, 1, 3, 2, 3, 1, 2];
  for (let e = 0; e < 8; e++) {
    if (thin && e % 2 === 1) continue;
    const at = t0 + e * (BEAT / 2);
    const note = midi(ch.notes[pattern[e] % ch.notes.length] + 12);
    const amp = (e === 0 ? 0.42 : 0.30) * (lift ? 1.08 : 1);
    put(L, at, pluck(note, 2.4), amp * 0.95);
    put(R, at + 0.006, pluck(note, 2.4), amp);         // 6 ms spread = width
  }

  // upright bass on 1 and 3
  if (!thin || bar % 2 === 0) {
    put(L, t0, bass(midi(ch.bass), BAR * 0.95), 0.5);
    put(R, t0, bass(midi(ch.bass), BAR * 0.95), 0.5);
  }

  // brushed kit: soft thump on 1, brush on 2 and 4
  put(L, t0, brush(0.10, 0.85), 0.16);
  put(R, t0, brush(0.10, 0.85), 0.16);
  for (const beat of [1, 3]) {
    if (thin) continue;
    const at = t0 + beat * BEAT;
    put(L, at, brush(0.34, 0.35), 0.15 * (lift ? 1.2 : 1));
    put(R, at + 0.004, brush(0.34, 0.35), 0.15 * (lift ? 1.2 : 1));
  }

  // a whisper of shaker once the second pass starts
  if (lift && !thin) {
    for (let e = 1; e < 8; e += 2) put(R, t0 + e * (BEAT / 2), brush(0.09, 0.2), 0.07);
  }
}

// ---- room: two feedback delays + a lowpass, cheap and warm -----------------
for (const [buf, dlyMs, fb] of [[L, 137, 0.24], [R, 191, 0.22]]) {
  const d = Math.round(dlyMs * SR / 1000);
  let lp = 0;
  for (let i = d; i < buf.length; i++) {
    lp = lp * 0.72 + buf[i - d] * 0.28;
    buf[i] += lp * fb;
  }
}

// ---- head/tail fades, then a soft ceiling ----------------------------------
const fadeIn = Math.round(1.1 * SR);
const fadeOut = Math.round(3.2 * SR);
let peak = 0;
for (let i = 0; i < len; i++) {
  const g = Math.min(1, i / fadeIn, (len - i) / fadeOut);
  L[i] *= g; R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = peak > 0 ? 0.82 / peak : 1;
const soft = (x) => Math.tanh(x * 1.18) / Math.tanh(1.18);   // gentle knee

// ---- WAV (16-bit PCM stereo) ----------------------------------------------
const bytes = 44 + len * 4;
const buf = Buffer.alloc(bytes);
buf.write('RIFF', 0); buf.writeUInt32LE(bytes - 8, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
for (let i = 0; i < len; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(L[i] * gain))) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(R[i] * gain))) * 32767), 46 + i * 4);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);
console.log(`bed.wav — ${DUR}s, ${SR} Hz stereo, seeded ${SEED.toString(16)} → ${OUT}`);
