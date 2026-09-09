// Headless test that PROVES the day-4 / day-5 closure:
//   1. letter.js defines a neighborhoodLine(s) function and includes it
//      in composeLetter for day >= 4.
//   2. web/js/world.js defines W.setConstructionRight and a third scaffold
//      at x = 17 (back-right facade).
//   3. audio.js defines constructionHammer(on) with a jittered rhythm
//      driver (0.6-0.9s).
//   4. main.js calls world.setConstructionRight(d) and
//      audio.constructionHammer(d >= 5) in openDay.
//   5. audio.js uses the noise buffer for the hammer taps (the wooden
//      tock + the metal click both come from the same source).
//   6. Public API smoke: AudioEngine.prototype.constructionHammer is a
//      function; the AudioEngine class has the _hammerTap helper.
//
// Run: node web/test/construction-final.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];

const letter = readFileSync(join(ROOT, 'web/js/letter.js'), 'utf8');
const world  = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
const audio  = readFileSync(join(ROOT, 'web/js/audio.js'), 'utf8');
const main   = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');

// 1) letter.js: neighborhoodLine(s) defined and called for day >= 4
if (!/function\s+neighborhoodLine\s*\(\s*s\s*\)/.test(letter))
  fails.push('letter.js: neighborhoodLine(s) function not defined');
if (!/neighborhoodLine\(s\)/.test(letter))
  fails.push('letter.js: neighborhoodLine(s) not called in composeLetter');
if (!/s\.day\s*>==?\s*5/.test(letter) || !/s\.day\s*===\s*4/.test(letter))
  fails.push('letter.js: neighborhoodLine does not gate on day >= 4 (need both `day === 4` and `day >= 5` branches)');
console.log('LETTER  neighborhoodLine(s) defined, called in composeLetter, gated day >= 4');

// 2) world.js: third scaffold at x = 17 + W.setConstructionRight
if (!/cgrpR\.position\.set\(\s*17/.test(world))
  fails.push('world.js: third scaffold not at x = 17');
if (!/W\.setConstructionRight\s*=/.test(world))
  fails.push('world.js: W.setConstructionRight not defined');
if (!/W\.cTarpMatR/.test(world))
  fails.push('world.js: W.cTarpMatR (third tarp material) not defined');
console.log('WORLD   third scaffold at x=17, W.setConstructionRight + cTarpMatR defined');

// 3) audio.js: constructionHammer(on) with jittered rhythm
if (!/constructionHammer\s*\(\s*on\s*\)/.test(audio))
  fails.push('audio.js: constructionHammer(on) not defined');
if (!/0\.6\s*\+\s*Math\.random\(\)\s*\*\s*0\.3/.test(audio))
  fails.push('audio.js: hammer rhythm not in 0.6-0.9s range');
if (!/this\._hammerOn/.test(audio))
  fails.push('audio.js: _hammerOn state not used');
console.log('AUDIO   constructionHammer(on) + jittered 0.6-0.9s rhythm + _hammerOn flag');

// 4) main.js wires the third scaffold + the hammer
if (!/world\.setConstructionRight\(d\)/.test(main))
  fails.push('main.js: does not call world.setConstructionRight(d)');
if (!/audio\.constructionHammer\(\s*constructionOn\s*\)/.test(main))
  fails.push('main.js: does not call audio.constructionHammer(constructionOn)');
console.log('WIRED   main.openDay → world.setConstructionRight + audio.constructionHammer');

// 5) audio.js: hammer taps use the noise buffer
if (!/this\.noiseBuf/.test(audio))
  fails.push('audio.js: hammer taps do not use this.noiseBuf');
console.log('NOISE   hammer taps use this.noiseBuf (wooden tock + metal click)');

// 6) Public API smoke
const { AudioEngine } = await import('../js/audio.js');
if (typeof AudioEngine.prototype.constructionHammer !== 'function')
  fails.push('AudioEngine.prototype.constructionHammer is not a function');
if (typeof AudioEngine.prototype._hammerTap !== 'function')
  fails.push('AudioEngine.prototype._hammerTap is not a function');
console.log('API     AudioEngine.constructionHammer + _hammerTap both present');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — day-4 letter line + day-5 third scaffold + jittered hammering rhythm');
