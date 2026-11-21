#!/usr/bin/env node
// storage-audit.mjs — audit (and optionally prune) app-owned `_storage`.
//
// tripo.persist is the only writer of app storage; every live object should
// be reachable from a tripoAssets modelUrl/previewUrl. Orphans = v1
// static-hosting leftovers the component can't delete + persists whose rows
// were dropped or superseded. The serving URL encodes the doc id as a UUID,
// so we ask the deployment to map ids → urls (storageCleanup.storageIdMap)
// and cross-check against tripoAssets refs. Deletion goes through
// storageCleanup.deleteOrphans, which re-verifies references server-side.
//
//   node tools/storage-audit.mjs              # report only
//   node tools/storage-audit.mjs --delete     # delete orphans
//   node tools/storage-audit.mjs --prune-mirrored
//                                             # delete Convex copies whose
//                                             # Grove mirror is verified live
//   node tools/storage-audit.mjs --deployment striped-anaconda-746
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const deployment = argv[argv.indexOf('--deployment') + 1] || 'striped-anaconda-746';
const doDelete = argv.includes('--delete');

const convex = (args) =>
  execFileSync('npx', ['convex', ...args, '--deployment', deployment], { cwd: ROOT, encoding: 'utf8' });

const storage = convex(['data', '_storage', '--limit', '10000', '--format', 'jsonl'])
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));
const assets = convex(['data', 'tripoAssets', '--limit', '10000', '--format', 'jsonl'])
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

const refs = new Set();
for (const a of assets)
  for (const u of [a.modelUrl, a.previewUrl]) {
    const m = /\/api\/storage\/([0-9a-f-]+)/i.exec(u ?? '');
    if (m) refs.add(m[1]);
  }

const ids = storage.map((r) => r._id);
const mapRaw = convex(['run', 'storageCleanup:storageIdMap', JSON.stringify({ ids })]);
const map = JSON.parse(mapRaw.slice(mapRaw.indexOf('[')));
const urlOf = new Map(map.map((e) => [e.id, e.url]));
const uuidOf = (u) => (u ? /\/api\/storage\/([0-9a-f-]+)/i.exec(u)?.[1] : null);

const mb = (n) => (n / 1e6).toFixed(1) + 'MB';
const live = [], orphans = [], tombstones = [];
for (const r of storage) {
  const url = urlOf.get(r._id);
  if (!url) tombstones.push(r);
  else if (refs.has(uuidOf(url))) live.push(r);
  else orphans.push(r);
}

console.log(`app _storage: ${storage.length} objects, ${mb(storage.reduce((s, r) => s + r.size, 0))}`);
console.log(`  referenced by tripoAssets (${refs.size} urls): ${live.length} objects, ${mb(live.reduce((s, r) => s + r.size, 0))}`);
console.log(`  orphans:   ${orphans.length} objects, ${mb(orphans.reduce((s, r) => s + r.size, 0))}`);
console.log(`  tombstones (no url): ${tombstones.length} objects, ${mb(tombstones.reduce((s, r) => s + r.size, 0))}`);

// --prune-mirrored: reclaim the redundant archive. For every live object
// whose uuid has a Grove mapping in web/js/groveAssets.js, verify the mirror
// is actually serving before deleting the Convex copy. Runs before the
// orphan check — it's the common case, and the safe one.
if (argv.includes('--prune-mirrored')) {
  const src = fs.readFileSync(path.join(ROOT, 'web/js/groveAssets.js'), 'utf8');
  const m = src.match(/GROVE_ASSETS =\s*(\{[\s\S]*?\});/);
  const manifest = m ? JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*}/, '}')) : {};
  let verified = 0, missing = 0;
  const doomed = [];
  for (const r of live) {
    const uuid = uuidOf(urlOf.get(r._id));
    const grove = uuid && manifest[uuid];
    if (!grove) { missing++; continue; }
    const res = await fetch(grove, { method: 'HEAD' }).catch(() => null);
    if (res?.ok) { verified++; doomed.push(r._id); }
    else { missing++; console.error(`  mirror dead for ${uuid}: ${grove} — keeping Convex copy`); }
  }
  const bytes = live.filter((r) => doomed.includes(r._id)).reduce((s, r) => s + r.size, 0);
  console.log(`prune-mirrored: ${verified} verified mirrors (${mb(bytes)}), ${missing} kept (no/dead mirror)`);
  if (doomed.length) {
    const out = convex(['run', 'storageCleanup:deleteMirrored', JSON.stringify({ ids: doomed })]);
    console.log('deleteMirrored →', out.trim());
  }
  process.exit(0);
}

if (!doDelete) {
  console.log('\ndry run — re-run with --delete to remove orphans + tombstones');
  process.exit(0);
}

const doomed = [...orphans, ...tombstones].map((r) => r._id);
if (!doomed.length) { console.log('nothing to delete'); process.exit(0); }
const out = convex(['run', 'storageCleanup:deleteOrphans', JSON.stringify({ ids: doomed })]);
console.log('deleteOrphans →', out.trim());
