#!/usr/bin/env node
// tools/mint-pipeline.mjs — Generative District pre-warmer (TRIPOTHON.md §4).
//
// Grows the district kit for a list of seeds through the LIVE Convex backend:
// the same `district:ensure` action the first player's boot fires, so offline
// pre-warm and runtime share one prompt source of truth (convex/district.ts).
// Instead of waiting on the hourly mint-operation-reaper cron, each poll tick
// kicks the reaper directly — a fresh kit finalizes inside this run.
//
// Why pre-warm: judges' first load should hit a cached, art-directed street
// (seed 7 is the default seed in main.js). A seed nobody pre-warmed still
// works — the first visitor grows it and later visitors load the cache.
//
// Usage:
//   node tools/mint-pipeline.mjs             # hero seed 7
//   node tools/mint-pipeline.mjs 7 11 23     # explicit seeds
//   node tools/mint-pipeline.mjs --check 7   # read-only kit status, no ensure
//
// Writes out/district-manifest.json (statuses + GLB/preview URLs).
// Exit 0 only when every requested seed is fully grown (all five slots
// success). Un-grown slots are re-ensured up to MAX_ROUNDS — transient
// provider flakes (e.g. "safety check. Try again.") cost nothing to retry,
// and the floor plays the classic district until a kit is grown.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_TIMEOUT_MS = 12 * 60 * 1000; // a 5-slot kit finalizes well inside this
const POLL_MS = 25 * 1000;
const MAX_ROUNDS = 3; // re-ensure retries for transient provider flakes (failed Mint tasks cost zero credits)

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const seeds = argv.filter((a) => !a.startsWith('--')).map(Number);
if (seeds.some((s) => !Number.isFinite(s))) {
  console.error('seeds must be numbers — e.g. node tools/mint-pipeline.mjs 7 11');
  process.exit(2);
}
if (!seeds.length) seeds.push(7); // the hero seed the floor boots on

function convexRun(fn, args) {
  const out = execFileSync('npx', ['convex', 'run', fn, JSON.stringify(args)], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function summarize(seed, kit) {
  const slots = kit.slots || {};
  const status = Object.fromEntries(
    Object.entries(slots).map(([s, v]) => [s, { status: v.status, modelUrl: v.modelUrl ?? null, previewUrl: v.previewUrl ?? null }]),
  );
  const counts = {};
  for (const v of Object.values(slots)) counts[v.status] = (counts[v.status] || 0) + 1;
  // Settled means GROWN: five successes. missing/failed are retryable (the
  // provider refunds failed tasks); processing just needs the reaper kicked.
  const done = Object.keys(slots).length === 5 && !counts.missing && !counts.failed && !counts.processing;
  const growing = !!counts.processing;
  console.log(`  seed ${seed}: ${Object.entries(slots).map(([s, v]) => `${s}=${v.status}`).join(' ')}${done ? ' · grown' : growing ? ' · growing…' : ' · not grown'}`);
  return { seed, done, growing, counts, slots };
}

const manifest = { generatedAt: new Date().toISOString(), provider: 'mint', preset: 'fast', seeds: [] };

for (const seed of seeds) {
  console.log(`\n— seed ${seed}${checkOnly ? ' (check only)' : ''}`);
  let kit;
  try {
    if (!checkOnly) convexRun('district:ensure', { seed }); // idempotent get-or-create
    kit = convexRun('district:kit', { seed });
  } catch (e) {
    console.error(`  seed ${seed}: convex call failed — is the deployment up? (${e.message.split('\n')[0]})`);
    manifest.seeds.push({ seed, error: String(e.message).split('\n')[0] });
    continue;
  }
  let report = summarize(seed, kit);
  const deadline = Date.now() + KIT_TIMEOUT_MS;
  for (let round = 0; !report.done && !checkOnly && round <= MAX_ROUNDS && Date.now() < deadline; round++) {
    // wait out processing slots, kicking the reaper instead of the hourly cron
    while (report.growing && Date.now() < deadline) {
      await sleep(POLL_MS);
      try {
        convexRun('mint:reaper', {}); // poll the live Mint operations now, not at :45
        kit = convexRun('district:kit', { seed });
      } catch {
        continue; // transient CLI/network hiccup — next tick retries
      }
      report = summarize(seed, kit);
    }
    if (report.done || checkOnly || Date.now() >= deadline) break;
    if (round) console.log(`  seed ${seed}: re-ensuring un-grown slots (round ${round}/${MAX_ROUNDS})`);
    try {
      convexRun('district:ensure', { seed });
      kit = convexRun('district:kit', { seed });
    } catch {
      continue;
    }
    report = summarize(seed, kit);
  }
  if (!report.done && !checkOnly) console.log(`  seed ${seed}: not fully grown — retry later; the floor plays ?classicDistrict meanwhile`);
  manifest.seeds.push(report);
}

mkdirSync(join(ROOT, 'out'), { recursive: true });
const file = join(ROOT, 'out', 'district-manifest.json');
writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nmanifest → out/district-manifest.json`);

const allSettled = manifest.seeds.every((s) => s.done);
process.exit(allSettled ? 0 : 1);
