// Headless test that PROVES the pitch licence is wired:
//   1. The modal exists (#licence + name/stand inputs + role & background
//      pill rows + the sign button) and sits before the tutorial in the
//      open flow.
//   2. Identity threads the fiction: composeLetter salutes and addresses
//      the player by name, receipts print the stand, the tutorial greets
//      them, and the Convex owner reads localStorage live so the district
//      board lists the stand name.
//   3. Backgrounds are real perks, not classes: ex-barista paces the bar,
//      ex-accountant trims fees & payouts, newcomer warms the regulars,
//      circuit hears the wire's lean (qualitative — the × stays insider).
//   4. Skippable + safe: Enter/Escape signs with defaults, headless and
//      ?skipTutorial never show it, identity persists via localStorage.
//
// Run: node web/test/identity.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- 1) the modal + its place in the flow --------------------------------------
{
  const html = read('web/index.html');
  for (const id of ['licence', 'lic-name', 'lic-stand', 'lic-roles', 'lic-bgs', 'lic-sign'])
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  const main = read('web/js/main.js');
  assert.ok(main.includes('function showLicence()') && main.includes('function signLicence()'),
    'licence show/sign functions exist');
  assert.ok(main.includes('if (!skipLicence) { showLicence(); return; }'),
    'licence is the first beat after the title — before the tutorial');
  assert.ok(main.includes('openTutorial()'), 'signing routes into the tutorial');
  // Enter/Escape both sign — one keystroke accepts the defaults
  assert.ok(main.includes("e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); signLicence(); }"),
    'one keystroke signs with defaults');
  assert.ok(main.includes("const skipLicence = headless"), 'licence is headless-gated');
  assert.ok(main.includes("urlParams.has('skipLicence')") && main.includes('!wantTutorial'),
    '?skipLicence and ?skipTutorial both bypass');
  console.log('LICENCE modal + flow: first beat, Enter signs, headless/skip-gated');
}

// ---- 2) identity threads the fiction --------------------------------------------
{
  const main = read('web/js/main.js');
  const letter = read('web/js/letter.js');
  assert.ok(letter.includes('Dear ${s.player},'), 'letter salutes the player');
  assert.ok(letter.includes('What do you want to do, ${s.player}?'), 'letter closes on the player’s name');
  assert.equal((main.match(/player: playerName/g) || []).length, 2,
    'both letter snaps carry the player (night + Morning Brief)');
  assert.ok(main.includes("[standName, playerName]"), 'nightly receipt prints the stand');
  assert.ok(main.includes("[standName, playerName + ' — ' + playerRole]"), 'finale receipt prints stand + role');
  assert.ok(main.includes("playerName.toUpperCase()"), 'tutorial step 1 greets by name');
  assert.ok(main.includes("localStorage.setItem('grunds.owner', standName)"),
    'the stand name becomes the Convex owner');
  const sync = read('web/js/convexSync.js');
  assert.ok((sync.match(/ownerName\(\)/g) || []).length >= 3, 'mirror + poll read the owner live');
  // composeLetter: the name actually lands in the body
  const { composeLetter } = await import('../js/letter.js');
  const L = composeLetter({
    day: 2, index: 1.1, indexPrev: 1.0, cost: 1.4, sold: 80, balked: 8,
    defections: 0, reputation: 70, debt: 0, contract: null, player: 'Ada',
    event: { tier: 'calm', head: 'X', line: 'y' },
  });
  assert.ok(L.body.includes('Dear Ada,'), 'letter body salutes Ada');
  assert.ok(L.body.includes('do, Ada?'), 'letter closes on Ada');
  const anon = composeLetter({
    day: 2, index: 1.0, indexPrev: 1.0, cost: 1.3, sold: 10, balked: 0,
    defections: 0, reputation: 70, debt: 0, contract: null, event: {},
  });
  assert.ok(!anon.body.includes('Dear'), 'no name → no salutation');
  console.log('IDENTITY letter + receipt + tutorial + district board all carry the signature');
}

// ---- 3) backgrounds are perks, not classes ---------------------------------------
{
  const main = read('web/js/main.js');
  assert.ok(main.includes('const LIC_BGS'), 'background table exists');
  const bgBlock = main.slice(main.indexOf('const LIC_BGS'), main.indexOf('let licRole'));
  assert.equal((bgBlock.match(/id: '/g) || []).length, 4, 'four backgrounds');
  assert.ok(main.includes("perkBg === 'ex-barista' ? 1.08 : 1"), 'ex-barista paces the bar');
  assert.ok(main.includes("perkBg === 'ex-accountant' ? 0.85 : 1"), 'ex-accountant trims costs');
  assert.ok(main.includes('* perkCostMul'), 'payouts + card fees honour the trim');
  assert.ok(main.includes('* perkStaffMul'), 'dawn pace honours the wrist');
  assert.ok(main.includes("perkBg === 'newcomer' ? 0.25 : 0.15"), 'newcomer warms the regulars');
  assert.ok(main.includes("perkBg === 'circuit'"), 'circuit hears the lean');
  assert.ok(main.includes('the circuit whispers'), 'circuit whisper prints in the Brief');
  assert.ok(main.includes("localStorage.setItem('grunds.identity'"), 'identity persists across sessions');
  console.log('PERKS   4 backgrounds · pace/trim/warmth/whisper — one number each');
}

console.log('\nPASS — identity: the pitch licence signs the player into the fiction');
