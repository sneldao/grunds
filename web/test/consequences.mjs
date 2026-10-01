// Pure tests for web/js/consequences.js — attendance state machine and
// till-scaled incident pricing. No DOM, no imports of main.js.
import { planAttendance, incidentCost, ABSENCE_WORD } from '../js/consequences.js';

let pass = 0, fails = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${e.message}`); } }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const mk = (op, absence = 'present', events = []) => ({ name: 'X', absence, op, events, coh: 'commuters' });
const ev = (outcome) => ({ day: 1, drink: 'flat white', outcome, stayed: false });

t('unhappy present → away with reason', () => {
  const r = mk(-0.5, 'present', [ev('balked')]);
  const out = planAttendance([r], { day: 2 });
  eq(r.absence, 'away'); eq(r.absentReason, 'still annoyed about walking out of a long line');
  eq(out.away.length, 1); eq(out.returning.length, 0); eq(out.lost.length, 0);
});

t('unhappy away → returning (second chance regardless of op)', () => {
  const r = mk(-0.9, 'away');
  planAttendance([r], { day: 3 });
  eq(r.absence, 'returning'); eq(r.justLost, false);
});

t('unhappy returning → lost (first time, justLost set)', () => {
  const r = mk(-0.4, 'returning');
  const out = planAttendance([r], { day: 4 });
  eq(r.absence, 'lost'); eq(r.justLost, true); eq(out.lost.length, 1);
});

t('lost stays lost', () => {
  const r = mk(0.9, 'lost'); r.justLost = true;
  const out = planAttendance([r], { day: 5 });
  eq(r.absence, 'lost'); eq(r.justLost, false); eq(out.lost.length, 0);
});

t('recovered op → present', () => {
  const r = mk(-0.1, 'returning');
  planAttendance([r], { day: 4 });
  eq(r.absence, 'present'); eq(r.absentReason, null);
});

t('away recovered before returning → present', () => {
  const r = mk(0.2, 'away');
  planAttendance([r], { day: 3 });
  eq(r.absence, 'present');
});

t('reasons: defected → Glasshouse; no event → generic', () => {
  const a = mk(-0.5, 'present', [ev('defected')]);
  planAttendance([a], { day: 2 });
  eq(a.absentReason, 'tried Glasshouse instead yesterday');
  const b = mk(-0.5, 'present', []);
  planAttendance([b], { day: 2 });
  eq(b.absentReason, 'not happy with how things have been');
});

t('reason reads last own event only', () => {
  const r = mk(-0.5, 'present', [ev('balked'), ev('served')]);
  planAttendance([r], { day: 2 });
  eq(r.absentReason, 'not happy with how things have been');
});

t('happy regular stays present', () => {
  const r = mk(0.6);
  planAttendance([r], { day: 2 });
  eq(r.absence, 'present');
});

t('threshold boundary: op exactly -0.2 stays present', () => {
  const r = mk(-0.2);
  planAttendance([r], { day: 2 });
  eq(r.absence, 'present');
});

t('incidentCost: base floor when share·till small', () => {
  eq(incidentCost(45, 0.05, 100), 45);
});

t('incidentCost: scales with till, rounds to 5', () => {
  eq(incidentCost(45, 0.05, 4700), 235);   // 0.05*4700=235 already multiple of 5
  eq(incidentCost(45, 0.05, 4760), 240);   // 238 → 240
  eq(incidentCost(18, 0.02, 8100), 160);   // 162 → 160
});

t('incidentCost: contest share 0.14 on a big till', () => {
  eq(incidentCost(140, 0.14, 4700), 660);  // 658 → 660
});

t('ABSENCE_WORD covers all states', () => {
  eq(ABSENCE_WORD.away, 'Stayed away today.');
  eq(ABSENCE_WORD.returning, 'Giving you another chance.');
  eq(ABSENCE_WORD.lost, 'Now goes to Glasshouse.');
});

console.log(`consequences: ${pass} pass, ${fails.length} fail`);
for (const f of fails) console.log('  ' + f);
process.exit(fails.length ? 1 : 0);
