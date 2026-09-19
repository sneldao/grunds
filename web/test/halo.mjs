// Headless test for halo.js — the pure gate (shouldHalo) needs no GL; the ring
// builder is only proven to degrade to a no-op when the scene can't take it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

const { shouldHalo, buildHalo } = await import('../js/halo.js');

const ok = { started: true, closed: false, paused: false, photo: false, modalsOpen: false, headless: false, busy: false, idleMs: 5000 };
check('idle on the floor → halo', shouldHalo(ok) === true, 'refused');
check('4.5s is the bar', shouldHalo({ ...ok, idleMs: 4500 }) === false && shouldHalo({ ...ok, idleMs: 4501 }) === true, 'boundary wrong');
for (const [k, label] of [['closed', 'day closed'], ['paused', 'paused'], ['photo', 'photo mode'], ['modalsOpen', 'a modal open'], ['headless', 'headless'], ['busy', 'kit beat running']]) {
  check(`${label} blocks the halo`, shouldHalo({ ...ok, [k]: true }) === false, label + ' leaked');
}
check('not started blocks', shouldHalo({ ...ok, started: false }) === false, 'pre-title leaked');

// buildHalo degrades with a scene that throws (no GL)
const hostile = { add() { throw new Error('no GL here'); } };
const halo = buildHalo(hostile);
let threw = false;
try { halo.showAt({ copy() {} }, 0); halo.update(0.016, 0); halo.hide(); } catch { threw = true; }
check('buildHalo survives a throwing scene, all ops no-op', !threw && halo.visible === false, 'threw or stayed visible');

// ---- regression: main.js wires it in the loop ----------------------------------
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('halo built once, headless-guarded', /const halo = headless \? null : buildHalo\(scene\)/.test(mainSrc), 'build site wrong');
check('loop asks shouldHalo every frame', /shouldHalo\(\{ started, closed, paused/.test(mainSrc), 'trigger missing');
check('idle clock is max(rig.lastUser, _lastIntentAt)', /Math\.max\(rig\.lastUser \|\| 0, _lastIntentAt \|\| 0\)/.test(mainSrc), 'intent gate missing');
check('levers + keys stamp intent', /markIntent\(\);/.test(mainSrc) && (mainSrc.match(/markIntent\(\)/g) || []).length >= 5, 'stamps missing');
check('halo targets come from currentAction', /HALO_SPOTS\[currentAction\(\)\.target\]/.test(mainSrc), 'not wired to nextAction');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — halo: pure gate honours every stop condition, GL side degrades clean');
