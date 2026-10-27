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
const FONT_SERIF = join(HERE, '..', 'grunds-demo', 'fonts', 'iowan.ttc');
const FONT_MONO = '/System/Library/Fonts/Menlo.ttc';

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
const esc = (t) => t
  .replace(/\\/g, '\\\\')
  .replace(/:/g, '\\:')
  .replace(/'/g, "\\'")
  .replace(/,/g, '\\,')
  .replace(/\[/g, '\\[')
  .replace(/\]/g, '\\]');

// ── 1. load + validate the script ───────────────────────────────────────────
const scriptPath = join(HERE, 'direction', SCRIPT);
const film = JSON.parse(readFileSync(scriptPath, 'utf8'));
const manifest = JSON.parse(readFileSync(join(CAPTURE, 'shots.json'), 'utf8'));
const byName = new Map(manifest.map((m) => [m.name, m]));

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

check(film.total_seconds >= 60 && film.total_seconds <= 180,
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

// ── 2. work dirs + ASS subtitles ────────────────────────────────────────────
for (const d of [WORK, DIST, REVIEW]) rmSync(d, { recursive: true, force: true });
for (const d of [WORK, DIST, REVIEW]) mkdirSync(d, { recursive: true });

const pad2 = (n) => String(n).padStart(2, '0');
const assTime = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${pad2(m)}:${s.toFixed(2).padStart(5, '0')}`;
};
const CREAM = '&HD5E8F2';   // #F2E8D5 in BGR
const OUTL = '&H100F17';    // #171310 in BGR
const assLines = [];
for (const { scene } of plan) {
  for (const sub of scene.subtitles) {
    const start = sub.at - scene.start;
    assLines.push(
      `Dialogue: 0,${assTime(start)},${assTime(start + sub.dur)},Letter,,0,0,0,,` +
      sub.text.split('\n').join('\\N'),
    );
  }
}
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Letter,Iowan Old Style,50,${CREAM},&HFFFFFF,${OUTL},&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,140,140,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assLines.join('\n')}
`;
const assPath = join(WORK, 'subs.ass');
writeFileSync(assPath, ass);
console.log(`subtitles: ${assLines.length} dialogue lines → work/subs.ass`);

// ── 3. cards ────────────────────────────────────────────────────────────────
// One warm-dark card per C-scene; text drawn from card_text with the first
// line as the small brass kicker and the rest in cream, centered.
function buildCard(scene, out) {
  const lines = scene.card_text.split('\n');
  const H = 1080, W = 1920;
  const filters = [];
  const startY = (base) => base;
  if (lines.length >= 2) {
    filters.push(`drawtext=fontfile='${esc(FONT_SERIF)}':text='${esc(lines[0])}':` +
      `fontsize=42:fontcolor=0xB08D57:x=(w-text_w)/2:y=${startY(H / 2 - 128)}`);
    filters.push(`drawtext=fontfile='${esc(FONT_SERIF)}':text='${esc(lines[1])}':` +
      `fontsize=88:fontcolor=0xF2E8D5:x=(w-text_w)/2:y=${startY(H / 2 - 44)}`);
  } else {
    filters.push(`drawtext=fontfile='${esc(FONT_SERIF)}':text='${esc(lines[0])}':` +
      `fontsize=76:fontcolor=0xF2E8D5:x=(w-text_w)/2:y=(h-text_h)/2`);
  }
  // third/fourth lines: the link (mono, brass) + invitation (cream, smaller)
  if (lines[2]) {
    const mono = existsSync(FONT_MONO) ? FONT_MONO : FONT_SERIF;
    filters.push(`drawtext=fontfile='${esc(mono)}':text='${esc(lines[2])}':` +
      `fontsize=40:fontcolor=0xB08D57:x=(w-text_w)/2:y=${startY(H / 2 + 120)}`);
  }
  if (lines[3]) {
    filters.push(`drawtext=fontfile='${esc(FONT_SERIF)}':text='${esc(lines[3])}':` +
      `fontsize=36:fontcolor=0xF2E8D5:x=(w-text_w)/2:y=${startY(H / 2 + 210)}`);
  }
  filters.push(`drawbox=x=(w-560)/2:y=${startY(H / 2 + 36)}:w=560:h=2:color=0xB08D57@0.9:t=fill`);
  filters.push('fade=t=in:st=0:d=0.7');
  if (scene.duration > 4) filters.push(`fade=t=out:st=${(scene.duration - 0.9).toFixed(2)}:d=0.9`);
  const vf = filters.join(',');
  sh('ffmpeg', ['-y', '-v', 'error',
    '-f', 'lavfi', '-i', `color=c=0x171310:s=${W}x${H}:r=30:d=${scene.duration}`,
    '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-an', out]);
  console.log(`card ${scene.id} → ${out}`);
}

// ── 4. trim + normalize takes ───────────────────────────────────────────────
const TAIL = 1.5;
const inputs = [];
for (const [i, p] of plan.entries()) {
  const out = join(WORK, `scene-${pad2(i + 1)}.mp4`);
  if (p.kind === 'card') {
    buildCard(p.scene, out);
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

// ── 5. concat + burn subs + mix bed ────────────────────────────────────────
const bed = join(CAPTURE, 'audio', 'bed.wav');
const bedDur = Number(ffprobeJson(bed).format.duration);
const total = film.total_seconds;
if (bedDur < total - 0.5) throw new Error(`bed ${bedDur}s < film ${total}s — regenerate with --secs ${Math.ceil(total)}`);
const fadeStart = Math.max(0, total - 3.2).toFixed(2);
const fc = [];
plan.forEach((_, i) => fc.push(`[${pad2(i)}:v]`));
fc.push(`concat=n=${plan.length}:v=1:a=0[v]`);
fc.push(`[v]ass=${esc(assPath)}:fontsdir=${esc(dirname(FONT_SERIF))}[vout]`);
fc.push(`[${plan.length}:a]atrim=0:${total.toFixed(2)},afade=t=out:st=${fadeStart}:d=3.2,volume=0.55,aformat=sample_rates=48000:channel_layouts=stereo[aout]`);
const finalPath = join(DIST, OUT);
sh('ffmpeg', ['-y', '-v', 'error',
  ...inputs.map((f) => ['-i', f]).flat(),
  '-i', bed,
  '-filter_complex', fc.join(';'),
  '-map', '[vout]', '-map', '[aout]',
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
