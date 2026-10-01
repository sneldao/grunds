// Headless test that PROVES the pitch licence is wired:
//   1. The modal exists as a staged card — three steps (fields → backgrounds
//      → role + sign) with progress dots, the same si-in fade-and-rise as
//      #softintro, off under prefers-reduced-motion — and sits before the
//      tutorial in the open flow.
//   2. Identity threads the fiction: composeLetter salutes and addresses
//      the player by name, receipts print the stand, the tutorial greets
//      them, and the Convex owner reads localStorage live so the district
//      board lists the stand name.
//   3. Backgrounds are real perks, not classes: ex-barista paces the bar,
//      ex-accountant trims fees & payouts, newcomer warms the regulars,
//      circuit hears the wire's lean (qualitative — the × stays insider).
//   4. Skippable + safe: Enter activates each step's primary (sign lands
//      only on the last step), Escape stays inert, headless and
//      ?skipTutorial never show it, identity persists via localStorage.
//
// Run: node web/test/identity.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- 1) the staged card + its place in the flow --------------------------------
{
  const html = read('web/index.html');
  for (const id of ['licence', 'lic-name', 'lic-stand', 'lic-roles', 'lic-bgs', 'lic-sign',
    'lic-step', 'lic-step-0', 'lic-step-1', 'lic-step-2', 'lic-next', 'lic-dots'])
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  assert.ok(!html.includes('lic-more'), 'the licence details fold is gone');
  const dotsSeg = html.slice(html.indexOf('id="lic-dots"'));
  const dotsRow = dotsSeg.slice(0, dotsSeg.indexOf('</div>'));
  assert.equal((dotsRow.match(/<span/g) || []).length, 3, 'three progress dots');
  // the three steps: fields → backgrounds (all four, no fold) → role + sign
  const s0 = html.indexOf('id="lic-step-0"'), s1 = html.indexOf('id="lic-step-1"'), s2 = html.indexOf('id="lic-step-2"');
  assert.ok(s0 < s1 && s1 < s2, 'steps 0-2 render in order');
  assert.ok(s0 < html.indexOf('id="lic-name"') && html.indexOf('id="lic-stand"') < s1,
    'name/stand fields live on step 0');
  assert.ok(s1 < html.indexOf('id="lic-bgs"') && html.indexOf('id="lic-bgs"') < s2,
    'the background pills live on step 1 — flat, no fold');
  assert.ok(s2 < html.indexOf('id="lic-roles"') && html.indexOf('id="lic-sign"') > s2,
    'role pills + Sign land on the last step');
  assert.ok(html.includes('the name on the lease · the name on the sign'), 'step-0 helper line');
  assert.ok(html.includes('before this') && html.includes('signed as')
    && html.includes('blank is fine — the district decides'), 'step labels + signing hint');
  assert.ok(html.includes('SIGN THE WEEK →'), 'the sign button keeps its copy');
  // same staged-card look as #softintro: fade-and-rise, off under reduced motion
  assert.ok(html.includes('#lic-step.si-in') && html.includes('#lic-dots'), 'si-in animation + dots styled');
  assert.ok(/prefers-reduced-motion[^}]*#lic-step\.si-in[^}]*animation: none/.test(html),
    'reduced motion disables the step fade');
  const main = read('web/js/main.js');
  assert.ok(main.includes('function showLicence()') && main.includes('function signLicence()'),
    'licence show/sign functions exist');
  assert.ok(main.includes('const LIC_STEPS = 3') && /licStep\s*=\s*0/.test(main)
    && main.includes('function paintLicenceStep()'), 'the step machine exists');
  assert.ok(main.includes("licStep >= LIC_STEPS - 1 ? $('lic-sign') : $('lic-next')"),
    'the step primary swaps Next → Sign on the last step');
  assert.ok(main.includes('if (!skipLicence) { showLicence(); return; }'),
    'licence is the first beat after the title — before the tutorial');
  assert.ok(main.includes('openTutorial()'), 'signing routes into the tutorial');
  // Enter = the step's primary — on the card and inside the step-0 inputs.
  // The Sign only lands on the last step (licPrimary resolves to lic-sign
  // there); Escape stays inert because the licence is gated.
  assert.ok(/t === 'licence'\) \{\s*if \(e\.key === 'Enter'\) \{ const b = licPrimary\(\)/.test(main),
    'Enter on the card activates the step primary');
  assert.ok(main.includes("e.key === 'Enter' && modals.top() === 'licence'")
    && /tagName === 'INPUT'/.test(main), 'Enter inside the fields advances the card');
  assert.ok(main.includes('.onclick = signLicence'), 'the Sign button activates signLicence');
  assert.ok(main.includes("$('lic-next')"), 'the Next button is wired');
  assert.ok(!main.includes('paintLicMore') && !main.includes('lic-more'), 'the old fold is gone from the code');
  const escBlock = main.slice(main.indexOf('onEscape:'), main.indexOf('onShortcut:'));
  assert.ok(!escBlock.includes('licence'), 'Escape stays inert on the licence');
  assert.ok(main.includes("const skipLicence = headless"), 'licence is headless-gated');
  assert.ok(main.includes("urlParams.has('skipLicence')") && main.includes('!wantTutorial'),
    '?skipLicence and ?skipTutorial both bypass');
  console.log('LICENCE staged card: 3 steps · Enter advances · Sign on the last step');
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
  // PR-1 rebalance moved perks from inline ternaries to the PERK_VALUES
  // table (ex-accountant 0.85→0.90, newcomer 0.25→0.18 — the diagnostic said
  // the stacked trim and the compounding warm were the dominant levers).
  assert.ok(main.includes('const PERK_VALUES'), 'perk table exists');
  assert.ok(main.includes("'ex-barista':    { staffMul: 1.08"), 'ex-barista paces the bar');
  assert.ok(main.includes("'ex-accountant': { staffMul: 1.00, costMul: 0.90"), 'ex-accountant trims costs');
  assert.ok(main.includes('* perkCostMul'), 'payouts + card fees honour the trim');
  assert.ok(main.includes('* perkStaffMul'), 'dawn pace honours the wrist');
  assert.ok(main.includes("'newcomer':      { staffMul: 1.00, costMul: 1.00, opWarm: 0.18"), 'newcomer warms the regulars');
  assert.ok(main.includes("'circuit':"), 'circuit hears the lean');
  assert.ok(main.includes('the circuit whispers'), 'circuit whisper prints in the Brief');
  assert.ok(main.includes("localStorage.setItem('grunds.identity'")
    && main.includes("localStorage.getItem('grunds.identity')"), 'identity persists + prefills across sessions');
  assert.ok(main.includes("playerName = 'Sam', standName = 'THE CORNER CUP'")
    && main.includes("playerRole = 'the new owner'"), 'blank defaults stay Sam / THE CORNER CUP / the new owner');
  assert.ok(main.includes("|| 'Sam'") && main.includes("'the corner cup'"),
    'blank fields sign as the district defaults');
  assert.ok(main.includes("licence_signed', { role: playerRole, bg: perkBg"),
    'the signature lands in analytics with role + background');
  console.log('PERKS   4 backgrounds · pace/trim/warmth/whisper — one number each');
}

console.log('\nPASS — identity: the pitch licence signs the player into the fiction');
