#!/usr/bin/env node
// tools/vendor-meshy.mjs — generate a Meshy asset and vendor the GLB into
// web/assets/meshy/ with a per-asset manifest entry.
//
// Meshy is a *source*, not a runtime dependency: play never calls the API.
// Generate here, commit the GLB, mirror via tools/mirror-assets.mjs if it
// lands somewhere the Grove rewrite needs, and list it in
// web/assets/SOURCES.md. API key: MESHY_API_KEY in .env.local (gitignored).
//
// Usage:
//   node tools/vendor-meshy.mjs --name hand-truck --image ref.png
//   node tools/vendor-meshy.mjs --name stall-crate --prompt "folding market crate"
//   node tools/vendor-meshy.mjs --name busker --prompt "busker with guitar" \
//       --model-type smart-topology --model meshy-t2.5 --polycount 15000 --rig
//   node tools/vendor-meshy.mjs --balance
//
// Defaults follow Meshy's own guidance for game assets: Smart Topology
// (meshy-t2 for props, meshy-t2.5 for characters) + meshy-n1 textures.
// Cheap drafts: --model meshy-6-lite. Hero props: --model meshy-7.1.
// --preview-only stops after the untextured mesh (text-to-3d preview).
// Downloads are post-processed with gltf-transform (WebP textures @1k,
// --no-optimize to skip); --optimize-existing re-optimizes the whole dir.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const API = 'https://api.meshy.ai';
const OUT = join(ROOT, 'web/assets/meshy');
const MANIFEST = join(OUT, 'manifest.json');
const POLL_MS = 5000;
const TASK_TIMEOUT_MS = 15 * 60 * 1000;

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const has = (flag) => process.argv.includes(flag);

// ---- GLB post-step: gltf-transform optimize ----
// WebP textures at 1k + prune/dedup/palette. Geometry compression stays OFF:
// the vendored GLTFLoader has no meshopt/draco decoder wired, and
// flatten/join/simplify/weld would endanger skinned rigs. Idempotent.
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

// --optimize-existing rewrites every GLB already in web/assets/meshy/
// (no API key needed — runs before loadKey).
if (has('--optimize-existing')) {
  for (const f of readdirSync(OUT).filter((f) => f.endsWith('.glb'))) {
    optimizeGlb(join(OUT, f));
  }
  process.exit(0);
}

function loadKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY;
  const env = join(ROOT, '.env.local');
  if (existsSync(env)) {
    const m = readFileSync(env, 'utf8').match(/^MESHY_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  console.error('MESHY_API_KEY not set — add it to .env.local (create at meshy.ai/developers/keys)');
  process.exit(2);
}
const KEY = loadKey();
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} -> ${r.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function waitTask(path, id) {
  const deadline = Date.now() + TASK_TIMEOUT_MS;
  for (;;) {
    const t = await api(`${path}/${id}`);
    process.stdout.write(`\r  ${path} ${id.slice(0, 8)}… ${t.status} ${t.progress ?? ''}%   `);
    if (t.status === 'SUCCEEDED') { console.log(); return t; }
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new Error(`${path} task ${id} ${t.status}: ${t.task_error?.message || JSON.stringify(t.task_error)}`);
    }
    if (Date.now() > deadline) throw new Error(`${path} task ${id} timed out`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url.slice(0, 80)}… -> ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

async function toImageUrl(v) {
  if (!v) return null;
  if (/^(https?:|data:)/.test(v)) return v;
  const b64 = readFileSync(v).toString('base64');
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(v).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${b64}`;
}

async function createTask(body) {
  const { result } = await api(body.__path, { method: 'POST', body: JSON.stringify(body.payload) });
  return result;
}

// ---- CLI ----

if (has('--balance')) {
  console.log(await api('/openapi/v1/balance'));
  process.exit(0);
}

const name = arg('--name');
const image = arg('--image');
const prompt = arg('--prompt');
if (!name || (!image && !prompt)) {
  console.error('need --name and one of --image <path|url|-> |--prompt <text>');
  process.exit(2);
}

const modelType = arg('--model-type', 'smart-topology');
const aiModel = arg('--model', modelType === 'smart-topology' ? 'meshy-t2' : 'meshy-7.1');
const polycount = Number(arg('--polycount', aiModel === 'meshy-t2.5' ? 15000 : 4000));
const textureModel = arg('--texture-model', 'meshy-n1');
const textureRes = arg('--texture-res', '2k');
const pbr = has('--pbr');
const previewOnly = has('--preview-only');
const doRig = has('--rig');
const doOptimize = !has('--no-optimize');

const targetFormats = ['glb'];
const common = {
  model_type: modelType,
  ai_model: aiModel,
  target_formats: targetFormats,
  ...(modelType === 'smart-topology' ? { target_polycount: polycount } : {}),
};

let task;
let kind;
if (image) {
  // image-to-3d is one-shot: geometry + texture in a single task.
  kind = 'image-to-3d';
  let imageUrl;
  if (image === '-') {
    imageUrl = 'data:image/png;base64,' + readFileSync(0).toString('base64');
  } else {
    imageUrl = await toImageUrl(image);
  }
  const id = await createTask({
    __path: '/openapi/v1/image-to-3d',
    payload: {
      image_url: imageUrl,
      model_type: modelType,
      ai_model: aiModel,
      target_formats: targetFormats,
      ...(modelType === 'smart-topology'
        ? { target_polycount: polycount }
        : { should_remesh: true, target_polycount: polycount }),
      should_texture: !previewOnly,
      ...(previewOnly ? {} : { texture_model: textureModel, texture_resolution: textureRes, enable_pbr: pbr || undefined }),
    },
  });
  task = await waitTask('/openapi/v1/image-to-3d', id);
} else {
  // text-to-3d v2: preview (geometry) then optional refine (texture).
  kind = 'text-to-3d';
  // --preview-task <id> resumes an already-succeeded preview task (e.g. one
  // orphaned by a 429 on the refine POST) instead of paying for a new one.
  const resumeId = arg('--preview-task');
  const previewId = resumeId || await createTask({
    __path: '/openapi/v2/text-to-3d',
    payload: { mode: 'preview', prompt, ...common, pose_mode: arg('--pose', '') || undefined },
  });
  const preview = resumeId
    ? await api(`/openapi/v2/text-to-3d/${previewId}`)
    : await waitTask('/openapi/v2/text-to-3d', previewId);
  if (previewOnly) {
    task = preview;
  } else {
    // meshy-n1 refine needs a reference image unless the preview was
    // meshy-7.1/latest — warn early instead of burning a task on a 400.
    if (textureModel === 'meshy-n1' && !arg('--texture-image')) {
      console.warn('note: meshy-n1 refine of a non-7.1 preview wants --texture-image <ref.png>');
    }
    const refineId = await createTask({
      __path: '/openapi/v2/text-to-3d',
      payload: {
        mode: 'refine',
        preview_task_id: previewId,
        ai_model: textureModel,
        texture_resolution: textureModel === 'meshy-n1' ? undefined : textureRes,
        enable_pbr: pbr || undefined,
        texture_prompt: arg('--texture-prompt') || undefined,
        texture_image_url: await toImageUrl(arg('--texture-image')) || undefined,
        target_formats: targetFormats,
      },
    });
    task = await waitTask('/openapi/v2/text-to-3d', refineId);
  }
}

const glbUrl = task.model_urls?.glb;
if (!glbUrl) throw new Error(`task ${task.id} succeeded but has no GLB url: ${JSON.stringify(task.model_urls)}`);

mkdirSync(OUT, { recursive: true });
const glbPath = join(OUT, `${name}.glb`);
await download(glbUrl, glbPath);
if (doOptimize) optimizeGlb(glbPath);
if (task.thumbnail_url) await download(task.thumbnail_url, join(OUT, `${name}.png`)).catch(() => {});

const entry = {
  id: name,
  source: 'meshy',
  task_id: task.id,
  kind,
  prompt: prompt || null,
  image: image ? basename(image) : null,
  ai_model: aiModel,
  model_type: modelType,
  target_polycount: modelType === 'smart-topology' ? polycount : null,
  texture_model: previewOnly ? null : textureModel,
  credits: task.consumed_credits ?? null,
  glb: `${name}.glb`,
  thumbnail: existsSync(join(OUT, `${name}.png`)) ? `${name}.png` : null,
  generated: new Date().toISOString(),
};
if (doRig) {
  const rigId = await createTask({
    __path: '/openapi/v1/rigging',
    payload: { model_url: glbUrl, height_meters: Number(arg('--height', 1.7)) },
  });
  const rig = await waitTask('/openapi/v1/rigging', rigId);
  const rigGlb = rig.result?.rigged_character_glb_url;
  if (rigGlb) {
    const rigPath = join(OUT, `${name}.rigged.glb`);
    await download(rigGlb, rigPath);
    if (doOptimize) optimizeGlb(rigPath);
    entry.rigged = { task_id: rig.id, glb: `${name}.rigged.glb`, credits: rig.consumed_credits ?? null };
    if (rig.result?.basic_animations?.walking_glb_url) {
      const walkPath = join(OUT, `${name}.walk.glb`);
      await download(rig.result.basic_animations.walking_glb_url, walkPath).catch(() => {});
      if (existsSync(walkPath) && doOptimize) optimizeGlb(walkPath);
      entry.rigged.walk_glb = `${name}.walk.glb`;
    }
  }
}

let manifest = {};
try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
manifest[name] = entry;
manifest._generated = new Date().toISOString().slice(0, 10);
manifest._source = 'https://www.meshy.ai — Meshy API; licence: generated output, see meshy.ai terms';
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n${name}.glb vendored -> web/assets/meshy/ (${entry.credits ?? '?'} credits)`);
