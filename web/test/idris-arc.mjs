// Phase 4 — Idris's arc: the roaster remembers.
// Verifies real continuity lines (letter.js, imported), the memory builder,
// loyalty alpha, the Gesha A/B ask, and the ledger reset.
//
// Imports letter.js directly (agency.mjs precedent) — no DOM, no GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { composeLetter } from '../js/letter.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');

const base = {
  day: 3, index: 1.1, indexPrev: 1.0, cost: 1.4, sold: 80, balked: 10,
  defections: 0, reputation: 70, debt: 0, contract: null,
  mode: 'planning', event: { tier: 'calm', head: 'X', line: 'y' },
};
const idris = {
  contractsTaken: 0, settledCount: 0, ignoredAdvice: 0, loyal: false,
  lastHedge: 'hold', boardMoved: 0.05,
  houseLot: 'Colombia Huila', houseRoast: 3, houseAge: 1,
  topRegular: null,
};

// (1) Silence without memory: old snapshots print no arc lines
test('Phase 4 · letters without s.idris carry no arc lines', () => {
  const L = composeLetter({ ...base });
  for (const phrase of ['I remember who listens', 'rode naked', 'Look after them', 'from me first', 'fresh sacks or cold regulars']) {
    assert.ok(!L.body.includes(phrase), `must not print "${phrase}" without memory`);
  }
});

// (2) Cover vindication reads the board move both ways
test('Phase 4 · taken cover is vindicated or costed by the board', () => {
  const up = composeLetter({ ...base, idris: { ...idris, lastHedge: 'contract', boardMoved: 0.08 } });
  assert.match(up.body, /the trade working/);
  const down = composeLetter({ ...base, idris: { ...idris, lastHedge: 'contract', boardMoved: -0.06 } });
  assert.match(down.body, /insurance costs/);
  const quiet = composeLetter({ ...base, idris: { ...idris, lastHedge: 'contract_light', boardMoved: 0 } });
  assert.match(quiet.body, /bought you sleep/);
});

// (3) Ignored advice is quoted back
test('Phase 4 · ignored rumours are remembered', () => {
  const L = composeLetter({ ...base, idris: { ...idris, ignoredAdvice: 2 } });
  assert.match(L.body, /rode naked/);
});

// (4) Roast + regular callbacks quote the cellar and the cast
test('Phase 4 · roast and regular lines quote real state', () => {
  const stale = composeLetter({ ...base, idris: { ...idris, houseLot: 'Ethiopia Yirgacheffe', houseAge: 4 } });
  assert.match(stale.body, /Fresh sacks or cold regulars/i);
  const fresh = composeLetter({ ...base, idris: { ...idris, houseLot: 'Brazil Cerrado', houseRoast: 4, houseAge: 1 } });
  assert.match(fresh.body, /keep it there/);
  const reg = composeLetter({ ...base, idris: { ...idris, topRegular: { name: 'Mara', visits: 9 } } });
  assert.match(reg.body, /Mara.*9 days running/);
  const loyal = composeLetter({ ...base, idris: { ...idris, loyal: true, contractsTaken: 3 } });
  assert.match(loyal.body, /from me first/);
});

// (5) Ledger: covers, settles, ignored rumours, last hedge
test('Phase 4 · main.js keeps Idris’s ledger', () => {
  assert.match(main, /contractsTaken = 0, settledCount = 0, ignoredAdvice = 0, idrisHeldSack = false/);
  assert.match(main, /if \(hedge && hedge\.startsWith\('contract'\)\) contractsTaken\+\+/);
  assert.match(main, /if \(hedge === 'settle'\) settledCount\+\+/);
  assert.match(main, /exchange\.event\?\.id === 'rumour_frost' && !exchange\.contract\) ignoredAdvice\+\+/);
  assert.match(main, /buildIdrisMemory/);
  assert.match(main, /loyal: contractsTaken >= 2/);
  assert.match(main, /snap\.idris = buildIdrisMemory\(snap\)/);
});

// (6) A/B ask: Gesha hold offered once, bought with till, pass dismisses
test('Phase 4 · Gesha hold ask is local, till-checked, once-held', () => {
  assert.match(main, /function renderIdrisAsk/);
  assert.match(main, /!g\.unlocked \|\| idrisHeldSack\) return/);
  assert.match(main, /idris-hold/);
  assert.match(main, /lotState\.buy\('gesha', 60, price, day/);
  assert.match(main, /idrisHeldSack = true/);
  assert.match(main, /idris-pass/);
});

// (7) Loyalty alpha: frost + 2 covers opens Gesha a day early
test('Phase 4 · loyalty buys early Gesha on frost', () => {
  assert.match(main, /ev\.id === 'frost_minas' && contractsTaken >= 2/);
  assert.match(main, /Idris called it early — Gesha open for loyalty/);
});

// (8) Reset rewinds the ledger
test('Phase 4 · campaign reset clears Idris’s ledger', () => {
  assert.match(main, /contractsTaken = 0; settledCount = 0; ignoredAdvice = 0; idrisHeldSack = false;/);
});
