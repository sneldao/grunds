import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');

const { applyDistrictFog } = await import('../js/world.js');
const THREE = await import('../vendor/three.module.js');

test('applyDistrictFog never touches the global shader chunk', () => {
  const before = THREE.ShaderChunk.fog_fragment;
  const m = new THREE.MeshStandardMaterial();
  applyDistrictFog(m);
  assert.equal(THREE.ShaderChunk.fog_fragment, before, 'global fog chunk mutated');
  assert.ok(!/ShaderChunk\s*\.\s*fog_fragment\s*=/.test(world), 'world.js still assigns ShaderChunk.fog_fragment');
});

test('fog wrap runs the existing onBeforeCompile then injects the haze ramp', () => {
  const m = new THREE.MeshStandardMaterial();
  let prevRan = false, prevThis = null, prevShader = null;
  const self = { tag: 'material-this' };
  m.onBeforeCompile = function (shader, renderer) { prevRan = true; prevThis = this; prevShader = shader; };
  applyDistrictFog(m);
  const shader = { fragmentShader: 'void main() {\n#include <fog_fragment>\n}' };
  m.onBeforeCompile.call(self, shader, { renderer: 1 });
  assert.ok(prevRan, 'existing onBeforeCompile (lawn fade) not called');
  assert.equal(prevThis, self, 'original onBeforeCompile got wrong this');
  assert.equal(prevShader, shader, 'original onBeforeCompile got wrong shader');
  assert.ok(shader.fragmentShader.includes('0.74 * (1.0 - exp(-max(vFogDepth, 0.0) / fogFar))'), 'haze ramp not injected');
  assert.ok(!shader.fragmentShader.includes('#include <fog_fragment>'), 'stock fog chunk left in place');
});

test('cache key chains |grunds-haze-v1 and a second apply does not double-wrap', () => {
  const m = new THREE.MeshStandardMaterial();
  const keyBefore = m.customProgramCacheKey.call(m);
  applyDistrictFog(m);
  const wrapped = m.onBeforeCompile;
  assert.equal(m.customProgramCacheKey.call(m), keyBefore + '|grunds-haze-v1', 'cache key did not chain');
  applyDistrictFog(m);
  assert.equal(m.onBeforeCompile, wrapped, 'second apply re-wrapped onBeforeCompile');
  const distinct = new THREE.MeshStandardMaterial();
  applyDistrictFog(distinct);
  assert.ok(distinct.customProgramCacheKey.call(distinct).endsWith('|grunds-haze-v1'), 'cache key not chained per-material');
});

test('fog:false materials are excluded', () => {
  const sky = new THREE.ShaderMaterial({ fog: false });
  const prev = sky.onBeforeCompile;
  applyDistrictFog(sky);
  assert.equal(sky.onBeforeCompile, prev, 'fog:false material was wrapped');
});

test('window glow lights are lite-gated, curve-driven, and lite-switchable', () => {
  assert.ok(/W\.windowLights = \[\]/.test(world), 'windowLights registry missing');
  const paneGlow = world.match(/if \(!lite\) \{\s*const glow = new THREE\.PointLight\(0xffd2a0, 0\.18, 0\.9, 2\);[\s\S]*?W\.windowLights\.push\(glow\);/);
  assert.ok(paneGlow, 'window glow not gated on !lite or not registered');
  assert.ok(/for \(const wl of W\.windowLights\) wl\.intensity = 0\.18 \* Math\.max\(night, duskish\);/.test(world),
    'window lights do not ride the night/dusk curve');
  assert.ok(/W\.setLite = \(enabled\) => \{ W\.lite = enabled; for \(const wl of W\.windowLights\) wl\.visible = !enabled; \}/.test(world),
    'setLite does not hide window lights');
  assert.ok(/for \(const wl of world\.windowLights\) wl\.intensity \*= street;/.test(main),
    'vitalityGlow does not scale window lights');
  assert.ok(/postfx\.dispose\(\); world\.setLite\(true\);/.test(main),
    'dynamic lite fallback does not call world.setLite(true)');
});

test('both lamp arrays and the counter still-life survived the merges', () => {
  for (const name of ['lampLights', 'lampPoolMats'])
    assert.ok(new RegExp(`W\\.${name} = \\[\\]`).test(world), `W.${name} init missing`);
  assert.ok(/for \(const ll of W\.lampLights\) ll\.intensity = street \* 12;/.test(world), 'real-lamp street loop missing');
  assert.ok(/for \(const pm of W\.lampPoolMats\) pm\.opacity = street \* 0\.62;/.test(world), 'pavement-pool street loop missing');
  assert.ok(/const counterTop = 1\.106;/.test(world) && !/const lip = 1\.106/.test(world), 'counter lip rename missing or duplicated');
  assert.ok(/kettleWisps\.length/.test(world), 'kettle steam updater lost');
  assert.ok(/W\._chalkT0 && W\.menuMat/.test(world), 'chalk color clock lost');
});

test('scene materials are fogged at build end and inside place()', () => {
  assert.ok(/applyDistrictFogTree\(scene\)/.test(world), 'no district material sweep at build end');
  assert.ok(/parent\.add\(g\); applyDistrictFogTree\(g\)/.test(world), 'loaded GLB subtree not fogged');
  assert.ok(/export function applyDistrictFog\(material\)/.test(world), 'applyDistrictFog not exported');
});
