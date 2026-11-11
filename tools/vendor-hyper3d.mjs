#!/usr/bin/env node
// tools/vendor-hyper3d.mjs — generate a Hyper3D Rodin asset and vendor the
// GLB into web/assets/hyper3d/ with a per-asset manifest entry.
//
// Hyper3D is a source AND a server-side builder: the tool vendors GLBs offline,
// and convex/rodin.ts grows describe-path stands through the same API at
// runtime. The game *client* never calls the API.
// Generate here, commit the GLB, mirror via tools/mirror-assets.mjs if it
// lands somewhere the Grove rewrite needs, and list it in
// web/assets/SOURCES.md. API key: RODIN_API_KEY in .env.local (gitignored).
//
// Usage:
//   node tools/vendor-hyper3d.mjs --balance
//   node tools/vendor-hyper3d.mjs --name espresso-machine --image ref.png
//   node tools/vendor-hyper3d.mjs --name market-stall --prompt "folding market stall, low-poly"
//   node tools/vendor-hyper3d.mjs --name busker --image front.png --image side.png --t-pose
//
// Defaults follow the house scale discipline (Tripo P1 slots run 8–12k
// faces): tier Gen-2.5-Low (Basic-access safe — Creator plans can run it;
// Medium+ needs Full/Business), mesh Raw, quality_override 10000. Raw
// presets without an override are huge (medium = 500k faces) and unusable
// in-game, so the override is always sent unless --no-faces is passed. The
// combo (glb + Raw + override <= 20000, non-Extreme-High tier) also hits
// Rodin's Fast mode. Textures stay tier-default 2K; the gltf-transform
// post-step crushes to WebP 1k like vendor-meshy (geometry compression OFF —
// the vendored GLTFLoader has no meshopt/draco decoder).
//
// Lifecycle (see docs.hyper3d.ai/en/get-started/quick-start): POST /rodin
// (multipart) → { uuid, jobs.subscription_key } → POST /status until every
// job is Done → POST /download with { task_uuid: uuid }. Check the `error`
// field on submit (HTTP 201 can still carry one). Poll with backoff, honor
// 429 Retry-After, 20 min deadline.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const BASE = 'https://api.hyper3d.com/api/v2';
const OUT = join(ROOT, 'web/assets/hyper3d');
const MANIFEST = join(OUT, 'manifest.json');
const FIRST_POLL_MS = 5000;
const POLL_STEP_MS = 5000;
const POLL_MAX_MS = 30000;
const TASK_TIMEOUT_MS = 20 * 60 * 1000;

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function argAll(flag) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}
const has = (flag) => process.argv.includes(flag);

if (has('--help') || has('-h')) {
  console.log(`vendor-hyper3d.mjs — Rodin Gen-2.5 image/text-to-3D → web/assets/hyper3d/

  --balance                    check credit balance (no generation)
  --name <id>                  output id (<id>.glb); required unless --balance
  --image <path|url>           repeatable, up to 5 (first drives material).
                               omit for text-to-3D (needs --prompt instead)
  --prompt <text>              text-to-3D prompt (required without --image);
                               with --image, optional orientation guidance
  --tier <t>                   default Gen-2.5-Low (Basic-safe). Medium+ needs
                               Full API access (Business). Extreme-High adds
                               an extra charge + a 10M-face bonus mesh
  --faces <n>                  quality_override face target, default 10000
                               (house discipline: 8000-12000). --no-faces
                               omits it and falls back to --quality preset
  --quality <p>                preset when --no-faces: high|medium|low|extra-low
  --texture-mode <m>           omit for tier default; extreme-high can add cost
  --seed <0-65535>             optional mesh/texture seed
  --t-pose                     rest-pose conditioning for humanoids (anim-ready)
  --no-optimize                skip gltf-transform WebP-1k post-step
  --timeout-min <n>            poll deadline, default 20
  --rig <task>                 rig a completed generation (.tasks.json key)
                               via POST /rigging: human template, core
                               skinning, + walking preset. Output
                               <task>-rigged.glb (--name overrides). Falls
                               back to model upload when the raw asset is
                               unconfirmed; drops the anim preset when the
                               account rejects it. (~0.5 credits)
  --anim <id>                  repeatable animation preset (default
                               human_sp/walking); --no-anim rigs bare
  --template <t>               skeleton preset, default human

Style-match like vendor-meshy: render the in-game GLB first
  node tools/render-asset.mjs web/assets/meshy/cup-stack.glb /tmp/ref.png iso
then pass it as --image so Rodin matches the cozy low-poly palette.`);
  process.exit(0);
}

function loadKey() {
  if (process.env.RODIN_API_KEY) return process.env.RODIN_API_KEY;
  for (const dotfile of ['.env.local', '.env']) {
    const env = join(ROOT, dotfile);
    if (!existsSync(env)) continue;
    const m = readFileSync(env, 'utf8').match(/^RODIN_API_KEY=(.+)$/m);
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  console.error('RODIN_API_KEY not set — add it to .env.local (create at https://hyper3d.ai/workspace/api-dashboard)');
  process.exit(2);
}

async function apiJson(path, { method = 'GET', body = null, key } = {}) {
  const headers = { Authorization: `Bearer ${key}` };
  let payload;
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, { method, headers, body: payload });
  if (r.status === 429) {
    const wait = Math.max(1, Number(r.headers.get('Retry-After')) || 5);
    await new Promise((res) => setTimeout(res, wait * 1000));
    return apiJson(path, { method, body, key });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function waitDone(subscriptionKey, key, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  await new Promise((r) => setTimeout(r, FIRST_POLL_MS));
  let delay = FIRST_POLL_MS;
  for (;;) {
    const st = await apiJson('/status', { method: 'POST', body: { subscription_key: subscriptionKey }, key });
    const jobs = st.jobs ?? [];
    const states = jobs.map((j) => j.status);
    process.stdout.write(`\r  status ${states.join(',') || '?'}   `);
    if (states.includes('Failed')) throw new Error(`Rodin job failed: ${JSON.stringify(st).slice(0, 500)}`);
    if (states.length && states.every((s) => s === 'Done')) {
      console.log();
      return st;
    }
    if (Date.now() > deadline) throw new Error('Rodin task timed out');
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + POLL_STEP_MS, POLL_MAX_MS);
  }
}

// ---- GLB post-step: gltf-transform optimize (same flags as vendor-meshy) ----
const OPT_FLAGS = [
  '--compress', 'false', '--flatten', 'false', '--join', 'false',
  '--instance', 'false', '--simplify', 'false', '--weld', 'false',
  '--texture-compress', 'webp', '--texture-size', '1024',
];
function optimizeGlb(file) {
  const tmp = file + '.opt.glb';
  execFileSync('npx', ['gltf-transform', 'optimize', file, tmp, ...OPT_FLAGS], { stdio: 'inherit' });
  renameSync(tmp, file);
  console.log(`  optimized ${basename(file)} → ${(statSync(file).size / 1e6).toFixed(1)} MB`);
}

if (has('--optimize-existing')) {
  for (const f of readdirSync(OUT).filter((f) => f.endsWith('.glb'))) {
    optimizeGlb(join(OUT, f));
  }
  process.exit(0);
}

const KEY = loadKey();

if (has('--balance')) {
  // GET /check_balance per docs/en/api-specification/check-balance.
  console.log(await apiJson('/check_balance', { key: KEY }));
  process.exit(0);
}

const rigTask = arg('--rig');
if (rigTask) {
  // POST /rigging: asset_id (completed Rodin uuid) or model upload +
  // bone_template + optional animation_preset; same status/download
  // lifecycle as /rodin. ~0.5 credits, charged on successful packaging.
  const rigName = arg('--name', `${rigTask}-rigged`);
  const template = arg('--template', 'human');
  const rigTimeoutMs = Number(arg('--timeout-min', 20)) * 60 * 1000;
  let anims = argAll('--anim');
  if (!anims.length && !has('--no-anim')) anims = ['human_sp/walking'];
  let log = {};
  try { log = JSON.parse(readFileSync(join(OUT, '.tasks.json'), 'utf8')); } catch {}
  const rec = log[rigTask];

  async function submitRig(useModel) {
    const f = new FormData();
    if (useModel) {
      const src = join(OUT, `${rigTask}.glb`);
      if (!existsSync(src)) throw new Error(`no vendored ${rigTask}.glb to upload`);
      f.append('model', new Blob([readFileSync(src)], { type: 'model/gltf-binary' }), `${rigTask}.glb`);
    } else {
      if (!rec?.task_uuid) throw new Error(`no .tasks.json record for "${rigTask}" — rig a completed generation name`);
      f.append('asset_id', rec.task_uuid);
    }
    f.append('bone_template', template);
    f.append('skinning_method', template === 'human' ? 'core' : 'shell');
    f.append('geometry_file_format', 'glb');
    for (const a of anims) f.append('animation_preset', a);
    const r = await fetch(`${BASE}/rigging`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: f });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(`POST /rigging -> ${r.status}: ${(d.error || d.message || JSON.stringify(d)).slice(0, 300)}`);
    return d;
  }

  console.log(`Submitting rigging (${template}${anims.length ? ` + ${anims.join(',')}` : ', no anim'}) → ${rigName} …`);
  let rig;
  try {
    rig = await submitRig(false);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/ASSET_NOT_AVAILABLE|NO_SUCH_TASK/i.test(msg)) {
      console.log('  asset_id refused — retrying as model upload (geometry+materials preserved)');
      rig = await submitRig(true);
    } else if (/animation/i.test(msg) && anims.length) {
      console.log('  animation preset refused — retrying rig without animation');
      anims = [];
      rig = await submitRig(false);
    } else throw e;
  }
  let rigSub = rig.jobs?.subscription_key;
  let rigUuid = rig.uuid;
  if (!rigSub || !rigUuid) throw new Error(`rigging submit missing ids: ${JSON.stringify(rig).slice(0, 200)}`);
  console.log(`  submitted uuid=${rigUuid} consumed=${rig.consumed ?? '?'}`);
  mkdirSync(OUT, { recursive: true });
  try {
    await waitDone(rigSub, KEY, rigTimeoutMs);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/Invalid input/i.test(msg)) {
      // Raw Rodin geometry has no confirmed model/texture, so the asset_id
      // path can submit fine then fail in-job. Retry once as a model upload
      // (geometry + materials preserved per the rigging spec).
      console.log('  asset_id job refused — retrying as model upload');
      rig = await submitRig(true);
      rigSub = rig.jobs?.subscription_key;
      rigUuid = rig.uuid;
      if (!rigSub || !rigUuid) throw new Error(`rigging resubmit missing ids: ${JSON.stringify(rig).slice(0, 200)}`);
      console.log(`  resubmitted uuid=${rigUuid} consumed=${rig.consumed ?? '?'}`);
      await waitDone(rigSub, KEY, rigTimeoutMs);
    } else throw e;
  }
  const rdl = await apiJson('/download', { method: 'POST', body: { task_uuid: rigUuid }, key: KEY });
  const rfiles = rdl.files ?? rdl.downloads ?? rdl.data ?? rdl.list ?? [];
  let rigUrl = null;
  for (const fl of Array.isArray(rfiles) ? rfiles : [rfiles]) {
    const u = typeof fl === 'string' ? fl : fl.url || fl.glb_url || fl.model_url || fl.download_url;
    if (!u) continue;
    if (String(u).split('?')[0].toLowerCase().endsWith('.glb')) { rigUrl = u; break; }
  }
  if (!rigUrl) throw new Error(`rigging download has no .glb url: ${JSON.stringify(rdl).slice(0, 300)}`);
  const rigPath = join(OUT, `${rigName}.glb`);
  {
    const r = await fetch(rigUrl);
    if (!r.ok) throw new Error(`download rigged glb -> ${r.status}`);
    writeFileSync(rigPath, Buffer.from(await r.arrayBuffer()));
  }
  if (!has('--no-optimize')) optimizeGlb(rigPath);
  let rmanifest = {};
  try { rmanifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
  rmanifest[rigName] = {
    id: rigName,
    source: 'hyper3d',
    task_uuid: rigUuid,
    kind: 'rigging',
    rig_of: rigTask,
    bone_template: template,
    skinning: template === 'human' ? 'core' : 'shell',
    animations: anims,
    credits: rig.consumed ?? null,
    glb: `${rigName}.glb`,
    glb_bytes: statSync(rigPath).size,
    generated: new Date().toISOString(),
  };
  rmanifest._generated = new Date().toISOString().slice(0, 10);
  writeFileSync(MANIFEST, JSON.stringify(rmanifest, null, 2) + '\n');
  console.log(`\n${rigName}.glb vendored -> web/assets/hyper3d/ (${rig.consumed ?? '?'} credits)`);
  process.exit(0);
}

const name = arg('--name');
const images = argAll('--image');
const prompt = arg('--prompt');
if (!name || (!images.length && !prompt)) {
  console.error('need --name and one of --image <path|url> (repeatable, ≤5) |--prompt <text>');
  process.exit(2);
}
if (images.length > 5) {
  console.error('Rodin takes at most 5 images');
  process.exit(2);
}

const tier = arg('--tier', 'Gen-2.5-Low');
const meshMode = arg('--mesh-mode', 'Raw');
const faces = has('--no-faces') ? null : Number(arg('--faces', 10000));
const quality = arg('--quality', 'low');
const textureMode = arg('--texture-mode');
const seed = arg('--seed');
const timeoutMs = Number(arg('--timeout-min', 20)) * 60 * 1000;
const doOptimize = !has('--no-optimize');

function mimeFor(path) {
  return { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(path).toLowerCase()] || 'image/png';
}

const form = new FormData();
for (const src of images) {
  if (/^https?:/.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`fetch image ${src.slice(0, 80)}… -> ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    form.append('images', new Blob([buf], { type: r.headers.get('content-type') || 'image/png' }), basename(src) || 'ref.png');
  } else {
    const buf = readFileSync(src);
    form.append('images', new Blob([buf], { type: mimeFor(src) }), basename(src));
  }
}
if (prompt) form.append('prompt', prompt);
form.append('tier', tier);
form.append('mesh_mode', meshMode);
form.append('geometry_file_format', 'glb');
form.append('material', 'PBR');
if (faces != null) form.append('quality_override', String(faces));
else form.append('quality', quality);
if (textureMode) form.append('texture_mode', textureMode);
if (seed != null) form.append('seed', String(seed));
if (has('--t-pose')) form.append('TAPose', 'true');

console.log(`Submitting Rodin ${tier} ${images.length ? `${images.length} image(s)` : 'text-to-3D'} → ${name} …`);
const sub = await fetch(`${BASE}/rodin`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}` },
  body: form,
});
const gen = await sub.json().catch(() => ({}));
if (!sub.ok || gen.error) {
  throw new Error(`POST /rodin -> ${sub.status}: ${(gen.error || gen.message || JSON.stringify(gen)).slice(0, 400)}`);
}
const subscriptionKey = gen.jobs?.subscription_key;
const taskUuid = gen.uuid;
if (!subscriptionKey || !taskUuid) throw new Error(`rodin submit missing ids: ${JSON.stringify(gen).slice(0, 300)}`);
console.log(`  submitted uuid=${taskUuid} consumed=${gen.consumed ?? '?'} (point-in-time, not a reservation)`);
mkdirSync(OUT, { recursive: true });
{
  const logPath = join(OUT, '.tasks.json');
  let log = {};
  try { log = JSON.parse(readFileSync(logPath, 'utf8')); } catch {}
  log[name] = { task_uuid: taskUuid, subscription_key: subscriptionKey, tier, mesh_mode: meshMode, faces, quality, prompt: prompt || null, images: images.length ? images.map((s) => basename(s)) : null, submitted: new Date().toISOString() };
  writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
}

await waitDone(subscriptionKey, KEY, timeoutMs || TASK_TIMEOUT_MS);
const dl = await apiJson('/download', { method: 'POST', body: { task_uuid: taskUuid }, key: KEY });
const files = dl.files ?? dl.downloads ?? dl.data ?? dl.list ?? [];
const pickUrl = (f) => (typeof f === 'string' ? f : f.url || f.glb_url || f.model_url || f.download_url);
let glbUrl = null;
for (const f of Array.isArray(files) ? files : [files]) {
  const u = pickUrl(f);
  if (!u) continue;
  const clean = String(u).split('?')[0].toLowerCase();
  const nm = String(f.name || f.filename || '').toLowerCase();
  if (clean.endsWith('.glb') || nm.endsWith('.glb')) {
    glbUrl = u;
    break;
  }
}
if (!glbUrl) {
  const flat = JSON.stringify(dl).slice(0, 500);
  throw new Error(`download has no .glb url: ${flat}`);
}

mkdirSync(OUT, { recursive: true });
const glbPath = join(OUT, `${name}.glb`);
{
  const r = await fetch(glbUrl);
  if (!r.ok) throw new Error(`download glb -> ${r.status}`);
  writeFileSync(glbPath, Buffer.from(await r.arrayBuffer()));
}
if (doOptimize) optimizeGlb(glbPath);

let manifest = {};
try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
manifest[name] = {
  id: name,
  source: 'hyper3d',
  task_uuid: taskUuid,
  kind: images.length ? 'image-to-3D' : 'text-to-3D',
  prompt: prompt || null,
  images: images.length ? images.map((s) => basename(s)) : null,
  tier,
  mesh_mode: meshMode,
  faces: faces ?? { quality },
  texture_mode: textureMode || `tier-default`,
  credits: gen.consumed ?? null,
  glb: `${name}.glb`,
  glb_bytes: statSync(glbPath).size,
  generated: new Date().toISOString(),
};
manifest._generated = new Date().toISOString().slice(0, 10);
manifest._source = 'https://hyper3d.ai — Rodin API; licence: paid plans include unlimited export/any use, free is limited — see hyper3d.ai/pricing';
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n${name}.glb vendored -> web/assets/hyper3d/ (${gen.consumed ?? '?'} credits)`);
