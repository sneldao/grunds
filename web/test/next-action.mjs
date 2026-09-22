// Headless test for nextAction.js — the single source of truth behind the
// goal strip and the idle halo. Proves the decision table and that main.js
// actually renders from it (so words and pointer can never drift apart).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

const { computeNextAction, NEXT_ACTION_PRIORITY } = await import('../js/nextAction.js');

// ---- the decision table -------------------------------------------------------
const a1 = computeNextAction({ dayMin: 600, queue: 0 });
check('calm pre-rush → hold/street', a1.id === 'hold' && a1.target === 'street', JSON.stringify(a1));
const a2 = computeNextAction({ dayMin: 600, queue: 3 });
check('queue 3 → watch/street', a2.id === 'watch' && a2.target === 'street', JSON.stringify(a2));
const a3 = computeNextAction({ dayMin: 600, queue: 6 });
check('queue 6 → batch/chalk', a3.id === 'batch' && a3.target === 'chalk', JSON.stringify(a3));
const a4 = computeNextAction({ dayMin: 600, queue: 6, prebatched: true, batchUnits: 40 });
check('batched wins over queue → status', a4.id === 'status' && /40 cups ready/.test(a4.text), JSON.stringify(a4));
const a5 = computeNextAction({ dayMin: 600, queue: 9, repriced: true });
check('repriced does not cancel a failing line', a5.id === 'batch', JSON.stringify(a5));
const a5b = computeNextAction({ dayMin: 700, queue: 2, repriced: true });
check('repriced and calm → status', a5b.id === 'status' && /matcha £4\.20/.test(a5b.text), JSON.stringify(a5b));
const a6 = computeNextAction({ dayMin: 900, queue: 0 });
check('wave with no cups → top up', a6.id === 'batch' && a6.target === 'chalk', JSON.stringify(a6));
const a6b = computeNextAction({ dayMin: 900, queue: 4, prebatched: true, batchUnits: 30 });
check('wave with stock → cups left', a6b.id === 'status' && /30 cups left/.test(a6b.text), JSON.stringify(a6b));
const a6c = computeNextAction({ dayMin: 1000, eveningFast: true });
check('evening fast-forward is a status, not a new lever', a6c.id === 'status' && /receipt is next/.test(a6c.text), JSON.stringify(a6c));
const a7 = computeNextAction({ dayMin: 900, queue: 2, prebatched: true, mailPending: true });
check('mailPending outranks everything → mailbox', a7.id === 'mail' && a7.target === 'mailbox', JSON.stringify(a7));
const a8 = computeNextAction();
check('empty snapshot still answers (no crash)', !!a8.id && !!a8.text && !!a8.target, JSON.stringify(a8));

// strings the game-feel of the strip depends on
check('directive strings kept verbatim',
  /line’s past <b>5<\/b> — press <b>1<\/b> to prep cups/.test(a3.text) &&
  /keep the line under <b>5<\/b>/.test(a1.text) &&
  /regular asks at <b>11:00<\/b>/.test(a1.text) &&
  /<b>11:00<\/b> ask/.test(a2.text), 'text drift from the shipped copy');
const a2b = computeNextAction({ dayMin: 700, queue: 3, offerShown: true });
check('after the ask, the read is 14:00', a2b.id === 'watch' && /<b>1<\/b> buys cups or <b>2<\/b> cuts the price/.test(a2b.text), JSON.stringify(a2b));

for (const s of [{}, { dayMin: 700, queue: 7, prebatched: true, mailPending: true }]) {
  const r = computeNextAction(s);
  check(`id is in the priority table (${r.id})`, NEXT_ACTION_PRIORITY.includes(r.id), r.id);
}

// ---- regression: main.js renders from the module, not inline branches ----------
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('main.js imports computeNextAction', /import \{ computeNextAction \}/.test(mainSrc), 'not imported');
check('goal strip reads na.id/na.text', /const na = currentAction\(\);/.test(mainSrc) && /na\.id === 'mail'/.test(mainSrc) && /na\.text/.test(mainSrc), 'strip not re-pointed');
check('no inline directive left in main.js', !/keep the line under <b>5<\/b>/.test(mainSrc), 'copy duplicated — drift is back');
check('currentAction feeds mailPending', /mailPending, offerShown, eveningFast \}/.test(mainSrc), 'mail not threaded');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — nextAction: one answer per moment, strip and halo read the same source');
