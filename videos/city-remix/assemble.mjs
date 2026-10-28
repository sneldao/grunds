// assemble.mjs — build the City Remix film from the locked direction + takes.
//
// Reads direction/<script>.json (the M3.1-locked edit), capture/shots.json (the
// recorded takes), and capture/audio/bed.wav (the generated music bed), and
// produces dist/final.mp4 — 1920×1080 H.264 + AAC, subtitles burned in.
//
// Contracts (matching record-city-shots.mjs):
//   - Each take holds its scripted `hold` seconds plus TAIL; the assembler
//     trims the LAST `hold` seconds, dropping the TAIL teardown.
//   - C-open / C-end are drawn here as warm-dark typography cards
//     (#171310 ground, cream text, brass accents — ART.md's locked idiom).
//   - Subtitles are the film's only text track, burned from the script's
//     absolute `at` times via an ASS file (constraint-validated first).
//
//   node videos/city-remix/assemble.mjs                # full build → dist/final.mp4
//   node videos/city-remix/assemble.mjs --dry          # validate + print plan only
//   node videos/city-remix/assemble.mjs --script 04-final.json
//
// QC artifacts land in review/edit/ (one frame per scene) + a loudness report.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, 'work');
const DIST = join(HERE, 'dist');
const REVIEW = join(HERE, 'review', 'edit');
const CAPTURE = join(HERE, 'capture');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v ?? true;
};
const DRY = flag('--dry') === true;
const SCRIPT = flag('--script') || '06-final.json';
const OUT = flag('--out') || 'final.mp4';

const sh = (cmd, args2, opts = {}) => {
  const r = spawnSync(cmd, args2, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args2.join(' ')} failed (${r.status})\n${r.stderr || r.stdout}`);
  }
  return r;
};
const ffprobeJson = (path) => {
  const r = sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path]);
  return JSON.parse(r.stdout);
};

// ── 1. load + validate the script ───────────────────────────────────────────
const scriptPath = join(HERE, 'direction', SCRIPT);
const film = JSON.parse(readFileSync(scriptPath, 'utf8'));
const manifest = JSON.parse(readFileSync(join(CAPTURE, 'shots.json'), 'utf8'));
const byName = new Map(manifest.map((m) => [m.name, m]));

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const isSmoke = SCRIPT.startsWith('00-');
check(isSmoke || (film.total_seconds >= 60 && film.total_seconds <= 180),
  `total ${film.total_seconds}s outside 60–180`);
let cursor = 0;
for (const s of film.scenes) {
  check(s.start === cursor, `scene ${s.id} starts at ${s.start}, expected ${cursor}`);
  cursor += s.duration;
  check(s.duration > 0, `scene ${s.id} duration ≤ 0`);
  for (const sub of s.subtitles) {
    check(sub.at >= s.start && sub.at + sub.dur <= s.start + s.duration + 0.05,
      `scene ${s.id} subtitle outside scene window: ${JSON.stringify(sub)}`);
    check(sub.dur >= 2.2, `scene ${s.id} subtitle < 2.2s`);
    for (const line of sub.text.split('\n')) {
      check(line.length <= 42, `scene ${s.id} line ${line.length} > 42 chars: "${line}"`);
    }
    const cps = sub.text.replace('\n', '').length / sub.dur;
    check(cps <= 15, `scene ${s.id} reading speed ${cps.toFixed(1)} cps > 15`);
  }
}
check(cursor === film.total_seconds, `timeline ends ${cursor}, total says ${film.total_seconds}`);

// shot → take mapping (S4 rides twice, in script order)
const SHOT_TAKES = {
  S1: ['s1-title'], S2: ['s2-licence-type'], S3: ['s3-licence-facts'],
  S4: ['s4-wide', 's4-low'], S5: ['s5-ticker'], S6: ['s6-brief'],
  S7: ['s7-patrons'], S8: ['s8-rival'], S9: ['s9-till'],
  S10: ['s10-card'], S11: ['s11-litmap'], S12: ['s12-newcity'],
};
const useCount = new Map();
const plan = film.scenes.map((s) => {
  if (s.shot === 'C-open' || s.shot === 'C-end') {
    check(!!s.card_text, `card scene ${s.id} has no card_text`);
    return { scene: s, kind: 'card' };
  }
  const takes = SHOT_TAKES[s.shot];
  check(!!takes, `unknown shot id ${s.shot} in scene ${s.id}`);
  const i = useCount.get(s.shot) ?? 0;
  useCount.set(s.shot, i + 1);
  const takeName = takes?.[i];
  const take = takeName ? byName.get(takeName) : null;
  check(!!take?.file, `scene ${s.id} (${s.shot} → ${takeName}): no recorded take in shots.json`);
  const file = take?.file ? join(CAPTURE, 'video', take.file) : null;
  check(!file || existsSync(file), `scene ${s.id}: take file missing on disk: ${file}`);
  check(!take || take.hold >= s.duration - 0.05,
    `scene ${s.id}: take hold ${take?.hold}s shorter than scene duration ${s.duration}s`);
  if (s.shot === 'S10') {
    check(existsSync(join(CAPTURE, 'shots', 'share-card.png')),
      `scene ${s.id}: no printed card artifact (capture/shots/share-card.png) — re-shoot s10-card`);
  }
  return { scene: s, kind: 'take', take: takeName, file };
});
if (problems.length) {
  console.error('SCRIPT VALIDATION FAILED:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`script OK: ${film.scenes.length} scenes, ${film.total_seconds}s, ${useCount.size} distinct shots`);
for (const p of plan) console.log(`  ${p.scene.id} ${p.scene.shot.padEnd(6)} ${String(p.scene.duration).padStart(4)}s  ${p.kind === 'card' ? '→ card' : `→ ${p.take}`}`);
if (DRY) { console.log('dry run — stopping before build.'); process.exit(0); }

// ── 2. text rendering (cards + subtitles via render_text.py + overlays) ────
for (const d of [WORK, DIST, REVIEW]) rmSync(d, { recursive: true, force: true });
for (const d of [WORK, DIST, REVIEW]) mkdirSync(d, { recursive: true });

const pad2 = (n) => String(n).padStart(2, '0');
const jobs = [];      // render_text.py jobs: cards + subtitle strips
const overlays = [];  // {png, at, dur} — burned on the final concat

const H = 1080;
const SUB_H = 62;     // subtitle line height at 50px Iowan
const SUB_SIZE = 50;
for (const { scene } of plan) {
  for (const sub of scene.subtitles) {
    const lines = sub.text.split('\n');
    const out = join(WORK, `sub-${pad2(scene.id)}.png`);
    jobs.push({
      out,
      lines: lines.map((text, i) => ({
        text, size: SUB_SIZE, color: 'cream', font: 'serif',
        y: H - 64 - (lines.length - i) * SUB_H,
      })),
    });
    overlays.push({ png: out, at: sub.at, dur: sub.dur, id: scene.id });
  }
}
// S10 — the printed card rides as a centered overlay (the genuine artifact
// the rig saved via pc-save during the take).
const s10 = plan.find((p) => p.scene.shot === 'S10');
const cardArtifact = join(CAPTURE, 'shots', 'share-card.png');
if (s10) {
  check(existsSync(cardArtifact), 'S10: no printed card artifact — re-shoot s10-card');
  overlays.push({
    png: cardArtifact, at: s10.scene.start + 0.4, dur: s10.scene.duration - 0.8,
    scale: 860, id: 'card-artifact',
  });
}

// ── 3. card specs ──────────────────────────────────────────────────────────
// Warm-dark typography cards in the game's idiom: brass kicker, cream title,
// brass rule, mono link. Layout per card kind, not generic.
const CARD_SPECS = {
  'C-open': (lines) => {
    if (lines.length !== 2) throw new Error(`C-open card_text wants 2 lines, got ${lines.length}`);
    return {
      lines: [
        { text: lines[0], size: 42, color: 'brass', font: 'serif', y: 412 },
        { text: lines[1], size: 88, color: 'cream', font: 'serif', y: 496 },
      ],
      rule: 596,
    };
  },
  'C-end': (lines) => {
    if (lines.length !== 3) throw new Error(`C-end card_text wants 3 lines, got ${lines.length}`);
    return {
      lines: [
        { text: lines[0], size: 84, color: 'cream', font: 'serif', y: 400 },
        { text: lines[1], size: 42, color: 'brass', font: 'mono', y: 604 },
        { text: lines[2], size: 34, color: 'cream', font: 'serif', y: 692 },
      ],
      rule: 520,
    };
  },
};
for (const p of plan) {
  if (p.kind !== 'card') continue;
  const spec = CARD_SPECS[p.scene.shot](p.scene.card_text.split('\n'));
  jobs.push({ out: join(WORK, `card-${pad2(p.scene.id)}.png`), ground: true, ...spec });
}

const jobsPath = join(WORK, 'text-jobs.json');
writeFileSync(jobsPath, JSON.stringify(jobs, null, 2));
sh('python3', [join(HERE, 'render_text.py'), jobsPath]);
console.log(`text: ${jobs.length} PNGs rendered (${overlays.length} subtitle strips + ${plan.filter((p) => p.kind === 'card').length} cards)`);

// ── 4. scene clips ─────────────────────────────────────────────────────────
// Cards: the rendered PNG looped for the scene's duration (fades on long
// holds). Takes: the last `hold` seconds of the take, minus the TAIL teardown.
const TAIL = 1.5;
const inputs = [];
for (const [i, p] of plan.entries()) {
  const out = join(WORK, `scene-${pad2(i + 1)}.mp4`);
  if (p.kind === 'card') {
    const png = join(WORK, `card-${pad2(p.scene.id)}.png`);
    const fades = [`fade=t=in:st=0:d=0.7`];
    if (p.scene.duration > 4) fades.push(`fade=t=out:st=${(p.scene.duration - 0.9).toFixed(2)}:d=0.9`);
    sh('ffmpeg', ['-y', '-v', 'error',
      '-loop', '1', '-i', png,
      '-t', p.scene.duration.toFixed(2), '-r', '30',
      '-vf', fades.join(','),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-an', out]);
    console.log(`card ${p.scene.id} → ${out}`);
  } else {
    const dur = Number(ffprobeJson(p.file).format.duration);
    const ss = Math.max(0, dur - TAIL - p.scene.duration);
    sh('ffmpeg', ['-y', '-v', 'error',
      '-ss', ss.toFixed(2), '-i', p.file, '-t', p.scene.duration.toFixed(2),
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out]);
    const got = Number(ffprobeJson(out).format.duration);
    if (Math.abs(got - p.scene.duration) > 0.35) {
      throw new Error(`scene ${p.scene.id}: trimmed to ${got.toFixed(2)}s, wanted ${p.scene.duration}s (take too short?)`);
    }
    console.log(`take ${p.scene.id} (${p.take}) → ${out}`);
  }
  inputs.push(out);
}

// ── 5. concat + burn subtitle overlays + mix bed ──────────────────────────
const bed = join(CAPTURE, 'audio', 'bed.wav');
const bedDur = Number(ffprobeJson(bed).format.duration);
const total = film.total_seconds;
if (bedDur < total - 0.5) throw new Error(`bed ${bedDur}s < film ${total}s — regenerate with --secs ${Math.ceil(total)}`);
const fadeStart = Math.max(0, total - 3.2).toFixed(2);
const fc = [];
fc.push(plan.map((_, i) => `[${pad2(i)}:v]`).join('') +
  `concat=n=${plan.length}:v=1:a=0[v0]`);
let label = 'v0';
const bedIdx = plan.length;      // bed.wav is the input after all scene clips
overlays.forEach((o, i) => {
  const next = `v${i + 1}`;
  const pngIdx = bedIdx + 1 + i; // subtitle PNGs follow the bed input
  if (o.scale) {
    fc.push(`[${pngIdx}:v]scale=${o.scale}:-1[ov${i}]`);
    fc.push(`[${label}][ov${i}]overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t,${o.at.toFixed(2)},${(o.at + o.dur).toFixed(2)})'[${next}]`);
  } else {
    fc.push(`[${label}][${pngIdx}:v]overlay=enable='between(t,${o.at.toFixed(2)},${(o.at + o.dur).toFixed(2)})'[${next}]`);
  }
  label = next;
});
fc.push(`[${bedIdx}:a]atrim=0:${total.toFixed(2)},afade=t=out:st=${fadeStart}:d=3.2,volume=0.55,aformat=sample_rates=48000:channel_layouts=stereo[aout]`);
const finalPath = join(DIST, OUT);
sh('ffmpeg', ['-y', '-v', 'error',
  ...inputs.map((f) => ['-i', f]).flat(),
  '-i', bed,
  ...overlays.map((o) => ['-i', o.png]).flat(),
  '-filter_complex', fc.join(';'),
  '-map', `[${label}]`, '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart', '-t', total.toFixed(2), finalPath]);
console.log(`assembled → ${finalPath}`);

// ── 6. QC: probe, loudness, review frames ──────────────────────────────────
const fin = ffprobeJson(finalPath);
const v = fin.streams.find((s) => s.codec_type === 'video');
const a = fin.streams.find((s) => s.codec_type === 'audio');
console.log(`QC streams: video ${v.codec_name} ${v.width}×${v.height} ${v.pix_fmt} · audio ${a.codec_name} ${a.sample_rate}Hz`);
console.log(`QC duration: ${Number(fin.format.duration).toFixed(2)}s (script ${total}s)`);

const vol = sh('ffmpeg', ['-i', finalPath, '-af', 'volumedetect', '-f', 'null', '-'],
  { stdio: ['ignore', 'pipe', 'pipe'] });
const mixed = `${vol.stderr}\n${vol.stdout}`;
const mean = mixed.match(/mean_volume: (-?[\d.]+) dB/)?.[1];
const peak = mixed.match(/max_volume: (-?[\d.]+) dB/)?.[1];
console.log(`QC loudness: mean ${mean} dB, peak ${peak} dB`);

for (const [i, p] of plan.entries()) {
  const at = p.scene.start + p.scene.duration / 2;
  sh('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(2), '-i', finalPath,
    '-frames:v', '1', join(REVIEW, `scene-${pad2(i + 1)}-${p.scene.shot}.png`)]);
}
console.log(`QC frames → review/edit/ (${plan.length} stills, one per scene)`);
console.log(`DONE: ${finalPath}`);
