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
check('batched wins over queue → status', a4.id === 'status' && /batched 40/.test(a4.text), JSON.stringify(a4));
const a5 = computeNextAction({ dayMin: 600, queue: 9, repriced: true });
check('repriced → status even at queue 9', a5.id === 'status' && /price cut/.test(a5.text), JSON.stringify(a5));
const a6 = computeNextAction({ dayMin: 900, queue: 0 });
check('post 14:00 → status (run the floor)', a6.id === 'status' && a6.target === 'street', JSON.stringify(a6));
const a7 = computeNextAction({ dayMin: 900, queue: 2, prebatched: true, mailPending: true });
check('mailPending outranks everything → mailbox', a7.id === 'mail' && a7.target === 'mailbox', JSON.stringify(a7));
const a8 = computeNextAction();
check('empty snapshot still answers (no crash)', !!a8.id && !!a8.text && !!a8.target, JSON.stringify(a8));

// strings the game-feel of the strip depends on
check('directive strings kept verbatim',
  /queue’s building — 1 to batch/.test(a3.text) &&
  /keep the <b>queue under 5<\/b>/.test(a1.text) &&
  /<b>1<\/b> batches before the rush/.test(a2.text), 'text drift from the shipped copy');

for (const s of [{}, { dayMin: 700, queue: 7, prebatched: true, mailPending: true }]) {
  const r = computeNextAction(s);
  check(`id is in the priority table (${r.id})`, NEXT_ACTION_PRIORITY.includes(r.id), r.id);
}

// ---- regression: main.js renders from the module, not inline branches ----------
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('main.js imports computeNextAction', /import \{ computeNextAction \}/.test(mainSrc), 'not imported');
check('goal strip reads na.id/na.text', /const na = currentAction\(\);/.test(mainSrc) && /\$\('goal'\)\.innerHTML = `☕ \$\{na\.text\}/.test(mainSrc), 'strip not re-pointed');
check('no inline directive left in main.js', !/keep the <b>queue under 5<\/b>/.test(mainSrc), 'copy duplicated — drift is back');
check('currentAction feeds mailPending', /mailPending \}/.test(mainSrc), 'mail not threaded');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — nextAction: one answer per moment, strip and halo read the same source');
