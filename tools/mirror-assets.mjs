#!/usr/bin/env node
// mirror-assets.mjs — mirror Convex storage objects to Grove.
//
// Reads tripoAssets off the deployment, downloads every modelUrl/previewUrl
// under <deployment>.convex.cloud/api/storage/<uuid>, re-uploads each to
// Grove (immutable, chain_id 232), and rewrites the GROVE_ASSETS map in
// web/js/groveAssets.js. Run after new generations land, then deploy:site.
//
//   node tools/mirror-assets.mjs [--deployment striped-anaconda-746]
//
// Existing manifest entries are kept — Grove uploads are immutable, so a
// uuid that already has a mirror is never re-uploaded.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'web', 'js', 'groveAssets.js');
const GROVE_UPLOAD = 'https://api.grove.storage/?chain_id=232';

const argv = process.argv.slice(2);
const deployment = argv[argv.indexOf('--deployment') + 1] || 'striped-anaconda-746';

function detectType(buf) {
  if (buf.subarray(0, 4).toString('latin1') === 'glTF') return 'model/gltf-binary';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return 'application/octet-stream';
}

function existingManifest() {
  if (!fs.existsSync(MANIFEST)) return {};
  const src = fs.readFileSync(MANIFEST, 'utf8');
  const m = src.match(/GROVE_ASSETS = (\{[\s\S]*?\});/);
  return m ? JSON.parse(m[1].replace(/'/g, '"')) : {};
}

const rows = execFileSync('npx', ['convex', 'data', 'tripoAssets',
  '--deployment', deployment, '--format', 'jsonl'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

const wanted = new Map(); // uuid → convex storage url
for (const r of rows) {
  for (const u of [r.modelUrl, r.previewUrl]) {
    const m = typeof u === 'string' && u.match(/\.convex\.cloud\/api\/storage\/([0-9a-f-]+)/i);
    if (m) wanted.set(m[1], u);
  }
}
console.log(`${wanted.size} storage objects referenced by ${rows.length} rows`);

const manifest = existingManifest();
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(ROOT, 'out', 'mirror-'));
let uploaded = 0, failed = 0;
for (const [uuid, url] of wanted) {
  if (manifest[uuid]) continue;
  const file = path.join(tmp, uuid);
  const res = await fetch(url);
  if (!res.ok) { console.error(`download ${uuid}: HTTP ${res.status}`); failed++; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  const up = await fetch(GROVE_UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': detectType(buf) },
    body: buf,
  });
  if (!up.ok) { console.error(`upload ${uuid}: HTTP ${up.status}`); failed++; continue; }
  const [item] = await up.json();
  manifest[uuid] = item.gateway_url;
  uploaded++;
}
fs.rmSync(tmp, { recursive: true, force: true });

const src = fs.readFileSync(MANIFEST, 'utf8');
const map = '{\n' + Object.keys(manifest).sort()
  .map((k) => `  '${k}': '${manifest[k]}',`).join('\n') + '\n}';
fs.writeFileSync(MANIFEST, src.replace(/GROVE_ASSETS = \{[\s\S]*?\};/, `GROVE_ASSETS = ${map};`));
console.log(`mirrored ${uploaded} new object(s), ${failed} failed, ${Object.keys(manifest).length} total — review web/js/groveAssets.js`);
