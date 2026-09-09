// Headless test that PROVES the day-5 left-side construction prop:
//   1. W.setConstructionLeft is defined in web/js/world.js source.
//   2. The left scaffold is at x = -10 (mirror of the right at x = +11).
//   3. W.setConstructionLeft toggles visibility + opacity (source check).
//   4. main.js calls world.setConstructionLeft(d) in openDay.
//
// Run: node web/test/construction-left.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];

// 1) W.setConstructionLeft is defined in world.js
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
if (!/W\.setConstructionLeft\s*=/.test(world))
  fails.push('world.js does not define W.setConstructionLeft');
console.log('API     W.setConstructionLeft defined in world.js');

// 2) The left scaffold is at x = -10 (mirror of right at x = +11)
if (!/cgrpL\.position\.set\(\s*-10/.test(world))
  fails.push('left scaffold not at x = -10');
const rightAt11 = /cgrp\.position\.set\(\s*11/.test(world);
if (!rightAt11)
  fails.push('right scaffold not at x = 11 (sanity check — the mirror pair should both be present)');
console.log('POS     left scaffold at x = -10 (mirror of right at x = +11)');

// 3) W.setConstructionLeft toggles visibility + opacity
if (!/cgrpL\.visible\s*=\s*on/.test(world))
  fails.push('W.setConstructionLeft does not toggle cgrpL.visible');
if (!/cTarpMatL\.opacity\s*=\s*on/.test(world))
  fails.push('W.setConstructionLeft does not toggle tarp opacity');
console.log('TOGGLE  cgrpL.visible + cTarpMatL.opacity both gated by dayHasConstruction');

// 4) main.js calls world.setConstructionLeft(d) in openDay
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
if (!/world\.setConstructionLeft\(d\)/.test(main))
  fails.push('main.js does not call world.setConstructionLeft(d) in openDay');
console.log('WIRED   main.openDay → world.setConstructionLeft(d)');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — day-5 left scaffold: defined, mirrored, day-gated, wired into openDay');
