// Streets gallery deeds. A franchise prompt is usually the player's words.
// A pasted photo is stored as the image URL (that string is the asset key),
// so the gallery and the asset board must print a label, never the URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deedLabel, deedQuote, isPhotoDeed } from '../js/deeds.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const PHOTO = 'https://striped-anaconda-746.convex.site/assets/board/seed-7.jpg';
const WORDS = 'a corner bookshop with a window reading seat';

const fails = [];
const check = (name, fn) => {
  try { fn(); console.log('  PASS', name); } catch (e) { fails.push(`${name}: ${e.message}`); }
};

check('a bare http(s) URL is a photo deed', () => {
  assert.equal(isPhotoDeed(PHOTO), true);
  assert.equal(isPhotoDeed(`  ${PHOTO}  `), true);
  assert.equal(isPhotoDeed('http://example.com/a.png'), true);
});
check('words and mixed text are not photo deeds', () => {
  assert.equal(isPhotoDeed(WORDS), false);
  assert.equal(isPhotoDeed(`see ${PHOTO}`), false);
  assert.equal(isPhotoDeed(''), false);
  assert.equal(isPhotoDeed(null), false);
});
check('a photo deed prints a title, not the URL', () => {
  assert.equal(deedLabel(PHOTO), 'a stand grown from a photo');
  assert.equal(deedQuote(PHOTO), 'a stand grown from a photo');
  assert.equal(deedQuote(PHOTO).includes('http'), false);
  assert.equal(deedQuote(PHOTO).includes('seed-7'), false);
});
check('word deeds stay quoted', () => {
  assert.equal(deedLabel(WORDS), WORDS);
  assert.equal(deedQuote(WORDS), `“${WORDS}”`);
});
check('an empty deed falls back to a stand', () => {
  assert.equal(deedLabel('   '), 'a stand');
  assert.equal(deedQuote(''), '“a stand”');
  assert.equal(deedQuote(undefined), '“a stand”');
});

const streets = read('web/streets.html');
const board = read('tools/build-asset-board.mjs');
check('gallery quotes deeds through deedQuote', () => {
  assert.match(streets, /import \{ deedQuote \} from '\.\/js\/deeds\.js'/);
  assert.match(streets, /deedQuote\(s\.prompt\)/);
  assert.doesNotMatch(streets, /“\$\{esc\(s\.prompt\)\}”/);
});
check('asset board labels photo deeds and still quotes words', () => {
  assert.match(board, /deedLabel, isPhotoDeed/);
  assert.match(board, /isPhotoDeed\(f\.prompt\) \? deedLabel\(f\.prompt\)/);
});

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
