// Pure truth-table for isQuiet — the quiet auto-pace gate.
// Run: node web/test/pace.mjs   (from the repo root)
import { isQuiet, QUIET_MUL } from '../js/pace.js';

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; }
  else { fail++; console.error(`FAIL ${name}: got ${got}, want ${want}`); }
};

const base = {
  phase: 'trading', paused: false, closed: false, modalOpen: false,
  cardVisible: false, momentPending: false, dayMin: 400, day: 3,
  offerResolved: false, incidentPending: false, settled: true,
};
const q = over => isQuiet({ ...base, ...over });

t('QUIET_MUL is 4', QUIET_MUL, 4);
t('quiet morning window', q(), true);
t('planning never quiet', q({ phase: 'planning' }), false);
t('review never quiet', q({ phase: 'review' }), false);
t('paused blocks quiet', q({ paused: true }), false);
t('closed blocks quiet', q({ closed: true }), false);
t('modal blocks quiet', q({ modalOpen: true }), false);
t('visible card blocks quiet', q({ cardVisible: true }), false);
t('a queued moment blocks quiet', q({ momentPending: true }), false);
t('unsettled day-1 morning is not quiet', q({ day: 1, settled: false }), false);
t('day-1 settled morning is quiet', q({ day: 1, settled: true }), true);

// window edges
t('659 still quiet', q({ dayMin: 659 }), true);
t('660 waits on the ask', q({ dayMin: 660 }), false);
t('660 quiet once the ask is answered', q({ dayMin: 660, offerResolved: true }), true);
t('809 quiet after the ask', q({ dayMin: 809, offerResolved: true }), true);
t('810 late-lunch is not quiet', q({ dayMin: 810, offerResolved: true }), false);
t('810 never quiet while the ask hangs', q({ dayMin: 810, offerResolved: false }), false);
t('959 not quiet', q({ dayMin: 959 }), false);
t('960 quiet when no incident is due', q({ dayMin: 960 }), true);
t('960 not quiet while an incident is pending', q({ dayMin: 960, incidentPending: true }), false);
t('1019 quiet when no incident is due', q({ dayMin: 1019 }), true);
t('1020 not quiet', q({ dayMin: 1020 }), false);

console.log(`pace: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
