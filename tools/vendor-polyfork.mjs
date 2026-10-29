// vendor-polyfork.mjs — fetch a curated set of free Polyfork assets into
// web/assets/polyfork/ and write manifest.json describing what each GLB
// carries: colour zones (knob name -> authored albedo), night-glow zones,
// named pivots, source page.
//
//   node tools/vendor-polyfork.mjs            # vendor the pilot set
//   node tools/vendor-polyfork.mjs <id> ...   # vendor additional ids
//
// Polyfork licence: commercial use, no attribution, do not redistribute the
// assets themselves as assets. In-game use is fine; list them in
// web/assets/SOURCES.md (repo convention) even though attribution isn't
// legally required.
//
// Determinism: Polyfork builds are deterministic ("same knob values always
// produce the same geometry; no Math.random anywhere"), so a vendored file
// is stable input for the seeded world.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://polyfork.dev/api/assets/';
const CDN = 'https://polyfork.dev/cdn/';
const OUT = new URL('../web/assets/polyfork/', import.meta.url).pathname;

// Pilot set — see the shortlist in the conversation. Interior pieces are all
// from modern-restaurant-cafe (one palette, one scale); street pieces are
// additive dressing.
const PILOT = [
  'espresso-machine-a2db84',
  'coffee-grinder-6f962a',
  'batch-brew-urn-f54a3b',
  'pos-terminal-f1273c',
  'takeaway-coffee-cup-1fd6dd',
  'pastry-display-case-8bcce5',
  'shop-coffee-roaster-c6a2b5',
  'chalkboard-menu-board-a24d9d',
  'bistro-table-877a6d',
  'bistro-chair-7c354d',
  'market-stall-94937d',
  'newsstand-6dfd65',
  'projecting-shop-sign-aa1867',
  'globe-lamp-346cb6',
  'brownstone-row-house-e58392',
];

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function vendor(id, manifest) {
  const meta = await getJson(API + id);
  if (meta.free !== true) throw new Error(`${id} is not free (${meta.plan})`);
  const params = meta.params_url ? await getJson(meta.params_url) : { params: {} };

  // Colour zones: every `color` knob's default is that zone's authored
  // albedo in COLOR_0 — the lookup polyfork.js uses for tint + night.
  const zones = {};
  for (const [name, p] of Object.entries(params.params || {})) {
    if (p?.type === 'color' && typeof p.default === 'string') zones[name] = p.default;
  }
  // Geometry/choice knobs ride along so placements can ask for variants
  // without re-fetching params.json.
  const knobs = {};
  for (const [name, p] of Object.entries(params.params || {})) {
    if (p?.type === 'color') continue;
    knobs[name] = { type: p.type, default: p.default, options: p.options, min: p.min, max: p.max };
  }
  const night = {};
  for (const [zone, n] of Object.entries(meta.night || {})) {
    night[zone] = { albedo: n.albedo, color: n.color, intensity: n.intensity };
  }

  const r = await fetch(CDN + id + '.glb');
  if (!r.ok) throw new Error(`${id}.glb -> ${r.status}`);
  const glb = Buffer.from(await r.arrayBuffer());
  writeFileSync(join(OUT, `${id}.glb`), glb);

  manifest[id] = {
    title: meta.title,
    kit: meta.kit,
    triangles: meta.triangles,
    size_m: meta.size_m,
    origin_y: meta.origin_y,
    zones,
    knobs,
    night,
    pivots: meta.preview_pivots || [],
    clips: meta.clips || [],
    page: meta.page,
    glb: `${id}.glb`,
    glb_bytes: glb.length,
  };
  console.log(`  ${id}  ${(glb.length / 1024).toFixed(0)} KB  zones:${Object.keys(zones).length} night:${Object.keys(night).join(',') || '-'}`);
}

// Remix variant: `vendorRemix(id, params, suffix)` — the CDN bakes geometry
// knobs into a GLB at {id}-remix.glb?p={json}; zone/night metadata aliases
// the base asset's entry under `{id}-{suffix}`.
async function vendorRemix(id, params, suffix, manifest) {
  const base = manifest[id] || await (async () => { await vendor(id, manifest); return manifest[id]; })();
  const q = encodeURIComponent(JSON.stringify(params));
  const r = await fetch(`${CDN}${id}-remix.glb?p=${q}`);
  if (!r.ok) throw new Error(`${id}-remix.glb?p=${q} -> ${r.status}`);
  const glb = Buffer.from(await r.arrayBuffer());
  const rid = `${id}-${suffix}`;
  writeFileSync(join(OUT, `${rid}.glb`), glb);
  manifest[rid] = { ...base, glb: `${rid}.glb`, glb_bytes: glb.length, remix_of: id, remix_params: params };
  console.log(`  ${rid}  ${(glb.length / 1024).toFixed(0)} KB  remix of ${id}`);
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : PILOT;
const REMIXES = {
  // Espresso machine group-head variants — the machine grows with the team.
  'espresso-machine-a2db84': [{ groups: 2 }, { groups: 3 }],
};
mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const jsPath = new URL('../web/js/polyforkManifest.js', import.meta.url).pathname;
// Merge into the existing manifest so id-scoped runs add rather than clobber.
let manifest = {};
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
console.log(`Vendoring ${ids.length} Polyfork assets -> ${OUT}`);
for (const id of ids) await vendor(id, manifest);
if (process.env.PF_NO_REMIX !== '1') {
  for (const [id, variants] of Object.entries(REMIXES)) {
    if (!ids.includes(id)) continue;
    for (const [i, p] of variants.entries()) await vendorRemix(id, p, `g${i + 2}`, manifest);
  }
}
manifest._generated = new Date().toISOString().slice(0, 10);
manifest._source = 'https://polyfork.dev — free low-poly catalogue; licence: commercial use, no attribution, no redistribution as assets';
const json = JSON.stringify(manifest, null, 2) + '\n';
writeFileSync(manifestPath, json);
// Runtime copy as an ES module (same pattern as groveAssets.js — generated,
// do not hand-edit) so web/js/polyfork.js needs no fetch and tests need no
// server.
writeFileSync(jsPath,
  '// polyforkManifest.js — generated by tools/vendor-polyfork.mjs; do not hand-edit.\n' +
  '// zones: colour-knob name -> authored COLOR_0 albedo (hex). night: glow\n' +
  '// zones (albedo to find, colour + intensity to emit). pivots/clips from\n' +
  '// the asset record. knobs: non-colour parameters (geometry rebuilds).\n' +
  'export const PF_MANIFEST = ' + json);
console.log(`manifest.json + polyforkManifest.js written (${ids.length} assets)`);
