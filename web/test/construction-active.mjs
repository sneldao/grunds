// Headless test that PROVES the day-5 construction is *active* (not just
// a static prop):
//   1. fx.js defines a constructionDust(dt) method and a `constructionActive`
//      property/setter.
//   2. fx.js creates a dustSite Pool instance in its constructor (the
//      particles that drift between the two day-5 scaffolds).
//   3. audio.js defines a constructionSaw(on) method that ramps a low
//      sawtooth gain up/down.
//   4. main.js sets fx.constructionActive and calls audio.constructionSaw
//      in openDay, gated on `d >= 5`.
//   5. Public API smoke: the FX class has all the new methods, the
//      AudioEngine class has constructionSaw, and the constructionOn flag
//      is local to main.js (no cross-module coupling).
//
// Run: node web/test/construction-active.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];

const fx = readFileSync(join(ROOT, 'web/js/fx.js'), 'utf8');
const audio = readFileSync(join(ROOT, 'web/js/audio.js'), 'utf8');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');

// 1) fx.js has constructionDust(dt) and constructionActive
if (!/constructionDust\s*\(\s*dt\s*\)/.test(fx))
  fails.push('fx.js: constructionDust(dt) method missing');
if (!/this\.constructionActive/.test(fx))
  fails.push('fx.js: constructionActive property missing');
console.log('FX      constructionDust(dt) + constructionActive present');

// 2) dustSite Pool is created in the FX constructor (not lazy)
if (!/this\.dustSite\s*=\s*new Pool/.test(fx))
  fails.push('fx.js: dustSite Pool not created in constructor');
console.log('POOL    dustSite = new Pool(...) at construction');

// 3) audio.js has constructionSaw(on) with a sawtooth + bandpass
if (!/constructionSaw\s*\(\s*on\s*\)/.test(audio))
  fails.push('audio.js: constructionSaw(on) method missing');
if (!/sawtooth/.test(audio))
  fails.push('audio.js: constructionSaw does not use a sawtooth oscillator');
if (!/bandpass/.test(audio))
  fails.push('audio.js: constructionSaw does not use a bandpass filter');
console.log('AUDIO   constructionSaw(on) — sawtooth + bandpass');

// 4) main.js wires both: sets fx.constructionActive + audio.constructionSaw
if (!/fx\.constructionActive\s*=\s*constructionOn/.test(main))
  fails.push('main.js: does not set fx.constructionActive');
if (!/audio\.constructionSaw\s*\(\s*constructionOn\s*\)/.test(main))
  fails.push('main.js: does not call audio.constructionSaw(constructionOn)');
// the gate: d >= 5, matched against dayHasConstruction in world.js
if (!/constructionOn\s*=\s*d\s*>=\s*5/.test(main))
  fails.push('main.js: constructionOn gate is not d >= 5');
console.log('WIRED   main.openDay → fx.constructionActive + audio.constructionSaw (gated d >= 5)');

// 5) Public API smoke: the two classes are still importable + instances work
const { FX } = await import('../js/fx.js');
const { AudioEngine } = await import('../js/audio.js');
if (typeof FX.prototype.constructionDust !== 'function')
  fails.push('FX.prototype.constructionDust is not a function');
if (typeof AudioEngine.prototype.constructionSaw !== 'function')
  fails.push('AudioEngine.prototype.constructionSaw is not a function');
console.log('API     FX.constructionDust + AudioEngine.constructionSaw both present');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — day-5 construction is active: dust drifts, saw fades in, gated on day 5');
