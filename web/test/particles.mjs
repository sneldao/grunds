// Grey squares were unmasked Points. A Points primitive is a hardware quad;
// without a mask that reaches the corner, and with weather spawned up at the
// home camera, those quads read as litter drifting over the roofs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const textures = read('web/js/textures.js');
const world = read('web/js/world.js');
const fx = read('web/js/fx.js');
const index = read('web/index.html');

const fails = [];
const check = (name, fn) => {
  try { fn(); console.log('  PASS', name); } catch (e) { fails.push(`${name}: ${e.message}`); }
};

const maskFn = textures.slice(textures.indexOf('function maskTexture'), textures.indexOf('export function softSprite'));
const softFn = textures.slice(textures.indexOf('export function softSprite'), textures.indexOf('export function streakSprite'));
const streakFn = textures.slice(textures.indexOf('export function streakSprite'), textures.indexOf('export function letterSprite'));

check('sprite masks stay linear and cover the quad corner', () => {
  assert.match(maskFn, /NoColorSpace/);
  assert.doesNotMatch(maskFn, /SRGBColorSpace/);
  assert.match(softFn, /createRadialGradient\(32, 32, 0, 32, 32, 46\)/);
  assert.match(softFn, /maskTexture/);
  assert.match(streakFn, /maskTexture/);
});

const weather = world.slice(world.indexOf('const puff = softSprite()'), world.indexOf('// ---- sky extras'));
check('mist, motes, and rain are masked and stay under the camera', () => {
  assert.match(weather, /streakSprite\(\)/);
  assert.match(weather, /alphaMap: puff, alphaTest: 0\.05/);
  assert.match(weather, /alphaMap: rainStreak, alphaTest: 0\.05/);
  assert.match(weather, /fog: false/);
  assert.match(weather, /mp\[i\*3\+2\] = 5\.5 \+ Math\.random\(\)\*8/);
  assert.doesNotMatch(weather, /8 \+ Math\.random\(\)\*14/);
  assert.match(weather, /W\.mist\.visible = false/);
  assert.match(weather, /W\.motes\.visible = false/);
  assert.match(weather, /W\.rain\.visible = false/);
  assert.match(weather, /W\.mist\.visible = o > 0\.01/);
});

const stars = world.slice(world.indexOf('W.starMat'), world.indexOf('W.moonMat'));
check('stars use the same disc mask', () => {
  assert.match(stars, /map: puff, alphaMap: puff, alphaTest: 0\.05/);
  assert.match(stars, /size: 1\.6/);
  assert.match(stars, /W\.stars\.visible = false/);
});

const pool = fx.slice(fx.indexOf('class Pool'), fx.indexOf('spawn('));
check('dust and the other pools clip the quad and ignore fog', () => {
  assert.match(pool, /alphaMap: sprite, alphaTest: 0\.05/);
  assert.match(pool, /fog: false/);
});

check('the open-day plate thins so the street reads', () => {
  assert.match(index, /body\.in-play #hud \{ background: rgba\(23,19,16,\.34\); border-color: transparent; backdrop-filter: none; \}/);
  assert.doesNotMatch(index, /body\.in-play #hud \{[^}]*\.72/);
  assert.match(index, /#pressure:empty, #status:empty, #district:empty, #tape:empty \{ display: none; \}/);
});

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
