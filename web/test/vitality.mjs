// Headless test for the vitality spine (director.js + vitality.js + the
// sky/audio mood hooks). Proves Feature 2's contract: the numbers change the
// LOOK and SOUND of the block, and ONLY that — the simulation (spawnMul) is
// untouched, and every modulation runs after the per-frame overwrites.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ============================================================
// 1) director — layered registry semantics
// ============================================================
const { buildDirector } = await import('../js/director.js');
const d = buildDirector();
const log = [];
d.add('a', () => log.push('a'));
d.add('b', () => { throw new Error('boom'); });
d.add('c', () => log.push('c'));
d.update({});
check('update runs layers in add order', log.join(',') === 'a,c', log.join(','));
check('a throwing layer never breaks the frame', true);
d.add('a', () => log.push('a2'));
log.length = 0; d.update({});
check('add(id) replaces by id, keeps position', log.join(',') === 'a2,c', log.join(','));
d.remove('a'); d.remove('nope');
check('remove drops the layer; missing id is a no-op', d.size === 2, `size=${d.size}`);
check('has() reports registered ids', d.has('c') && d.has('b') && !d.has('a'), 'has wrong');

// ============================================================
// 2) vitality — target math, clamps, glide
// ============================================================
const { buildVitality } = await import('../js/vitality.js');
const fakeDemand = { awareness: 0.5 };
const fakeReg = { reputation: 50 };
const v = buildVitality({ demand: fakeDemand, regulars: fakeReg });
v.recompute();
check('balanced numbers → 0.5', near(v.target, 0.5), `target=${v.target}`);
fakeDemand.awareness = 1; fakeReg.reputation = 0; v.recompute();
check('weight 0.65 awareness-only', near(v.target, 0.65), `target=${v.target}`);
fakeDemand.awareness = 2; fakeReg.reputation = 200; v.recompute();
check('out-of-range inputs clamp to 1', v.target === 1, `target=${v.target}`);
fakeDemand.awareness = -1; fakeReg.reputation = undefined; v.recompute();
check('negative/missing clamp toward the floor, rep defaults to 50', near(v.target, 0.65 * 0 + 0.35 * 0.5), `target=${v.target}`);
v.set(0);
for (let i = 0; i < 600; i++) v.tick();
check('tick glides current → target', near(v.current, 0, 0.001), `current=${v.current}`);
fakeDemand.awareness = 1; fakeReg.reputation = 100; v.recompute();
const pre = v.current; v.tick();
check('tick moves a small exponential step, never jumps', v.current > pre && v.current - pre < 0.03, `pre=${pre} now=${v.current}`);

// ============================================================
// 3) the non-double-count proof: real Demand.spawnMul is invariant
// ============================================================
const { Demand } = await import('../js/demand.js');
const demand = new Demand();
const before = demand.spawnMul();
const v2 = buildVitality({ demand, regulars: { reputation: 80 } });
v2.set(0.05);
for (let i = 0; i < 200; i++) v2.tick();
check('200 vitality ticks never move spawnMul', demand.spawnMul() === before, `${before} → ${demand.spawnMul()}`);

// ============================================================
// 4) sky mood — third arg scales the sun/stars uniforms, default is identical
// ============================================================
const { buildSky } = await import('../js/sky.js');
const skyScene = { mesh: null, add(m) { this.mesh = m; } };
const sky = buildSky(skyScene);
if (skyScene.mesh) {
  const u = skyScene.mesh.material.uniforms;
  sky.update(780);
  const sunNoon = u.uSunInt.value, starsNoon = u.uStars.value;
  sky.update(780, null, 0.5);
  check('mood=0.5 leaves the sun at 1.0× (multiplier midpoint)', near(u.uSunInt.value, sunNoon, 1e-9), `sun=${u.uSunInt.value} vs ${sunNoon}`);
  sky.update(780, null, 0);
  check('mood=0 → sun ×0.75, stars ×1.35', near(u.uSunInt.value, sunNoon * 0.75) && near(u.uStars.value, starsNoon * 1.35), `sun=${u.uSunInt.value} stars=${u.uStars.value}`);
  sky.update(780, null, 1);
  check('mood=1 is the identity (existing call sites unchanged)', near(u.uSunInt.value, sunNoon) && near(u.uStars.value, starsNoon), 'drift');
} else {
  check('sky mesh built in node (THREE available)', false, 'mesh was null');
}

// ============================================================
// 5) audio — setMood clamps, knock3/knock wiring is ctx-guarded
// ============================================================
const { AudioEngine } = await import('../js/audio.js');
const ae = new AudioEngine();
ae.setMood(2); check('setMood clamps high', ae.mood === 1, `mood=${ae.mood}`);
ae.setMood(-1); check('setMood clamps low', ae.mood === 0, `mood=${ae.mood}`);
ae.setMood(0.5); check('setMood passes through', ae.mood === 0.5, `mood=${ae.mood}`);
let threw = false;
try { ae.knock3(); ae._hammerTap(); ae.update(0.016); } catch { threw = true; }
check('knock3/_hammerTap/update are no-ops without a ctx', !threw, 'threw pre-gesture');

// ============================================================
// 6) regression: main.js wires the spine at the right moment
// ============================================================
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('loop order: tick → updateTimeOfDay → sky(mood) → director',
  /vitality\.tick\(\);\s*\n\s*world\.updateTimeOfDay\(dayMin\);\s*\n\s*sky\.update\(dayMin, null, vitality\.current\);\s*\n\s*director\.update\(/.test(mainSrc), 'loop block out of order');
check('loop: director.update strictly after updateTimeOfDay + sky.update',
  mainSrc.indexOf('sky.update(dayMin, null, vitality.current);') < mainSrc.indexOf('director.update(') &&
  mainSrc.indexOf('world.updateTimeOfDay(dayMin);') < mainSrc.indexOf('director.update('), 'director must run after the overwrites');
check('loop: director runs before postfx.render', mainSrc.indexOf('director.update(') < mainSrc.indexOf('postfx.render(now)'), 'late');
check('vitalityGlow layer registered', /director\.add\('vitalityGlow'/.test(mainSrc), 'missing');
check('layer scales pendants/bulbs/lamps/windows', /p\.intensity \*= warm/.test(mainSrc) && /bm\.emissiveIntensity \*= warm/.test(mainSrc) && /wm\.emissiveIntensity \*= street/.test(mainSrc), 'layer too thin');
check('audio mood fed every frame', /audio\.setMood\(vitality\.current\)/.test(mainSrc), 'missing');
check('openDay + closeDay recompute', (mainSrc.match(/vitality\.recompute\(\)/g) || []).length >= 3, 'recompute triggers missing');
check('__grunds exposes vitality for QA', /vitality, director,/.test(mainSrc), 'not exposed');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — vitality spine: layers run after the overwrites, mood is audiovisual-only, spawnMul untouched');
