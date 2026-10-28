// web/test/polyfork.mjs — guards for the Polyfork subsystem:
//   1. manifest.json entries and .glb files on disk are 1:1
//   2. every candidate id in districtGen's PF_SLOTS is vendored
//   3. every archetype id in franchise's PF_STANDS is vendored
//   4. PF_TINT zone names exist in that asset's manifest zones
//   5. every manifest night zone resolves an albedo (own field or zones[])
//   6. generated polyforkManifest.js mirrors manifest.json
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PF_DIR = join(ROOT, 'assets/polyfork');
const manifest = JSON.parse(readFileSync(join(PF_DIR, 'manifest.json'), 'utf8'));
const mIds = new Set(Object.keys(manifest).filter(k => !k.startsWith('_')));
const files = new Set(readdirSync(PF_DIR).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)));

const src = (f) => readFileSync(join(ROOT, 'js', f), 'utf8');
const dg = src('districtGen.js'), fr = src('franchise.js'), pf = src('polyfork.js');

const idRe = /'([a-z0-9-]+-[0-9a-f]{6})'/g;
const idsOf = (text) => new Set([...text.matchAll(idRe)].map(m => m[1]));

test('manifest entries and .glb files are 1:1', () => {
  assert.deepEqual([...mIds].sort(), [...files].sort());
});

test('PF_SLOTS candidates are all vendored', () => {
  const block = dg.match(/const PF_SLOTS = \{[\s\S]*?\};/)?.[0] || '';
  const missing = [...idsOf(block)].filter(id => !mIds.has(id));
  assert.deepEqual(missing, [], `not vendored: ${missing}`);
});

test('PF_STANDS archetypes are all vendored', () => {
  const block = fr.match(/const PF_STANDS = \[[\s\S]*?\];/)?.[0] || '';
  const missing = [...idsOf(block)].filter(id => !mIds.has(id));
  assert.deepEqual(missing, [], `not vendored: ${missing}`);
});

test('PF_TINT zone names exist in each asset manifest zones', () => {
  const block = pf.match(/export const PF_TINT = \{[\s\S]*?\n\};/)?.[0] || '';
  for (const m of block.matchAll(/'([a-z0-9-]+-[0-9a-f]{6})'\s*:\s*\{([^}]*)\}/g)) {
    const [id, zonesText] = [m[1], m[2]];
    assert.ok(mIds.has(id), `PF_TINT id not vendored: ${id}`);
    const zones = manifest[id].zones || {};
    for (const z of zonesText.matchAll(/(\w+)\s*:/g)) {
      assert.ok(zones[z[1]], `${id}: tint zone '${z[1]}' not in manifest zones ${Object.keys(zones)}`);
    }
  }
});

test('every night zone resolves an albedo', () => {
  for (const id of mIds) {
    for (const [zone, n] of Object.entries(manifest[id].night || {})) {
      assert.ok(n.albedo || manifest[id].zones?.[zone], `${id}: night zone '${zone}' has no albedo to match`);
    }
  }
});

test('generated polyforkManifest.js mirrors manifest.json', () => {
  const js = src('polyforkManifest.js');
  for (const id of mIds) assert.ok(js.includes(`"${id}"`), `polyforkManifest.js missing ${id}`);
});
