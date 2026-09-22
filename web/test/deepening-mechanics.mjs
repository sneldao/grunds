// Test suite verifying the three deepened mechanics:
// 1. Dynamic Rival AI (GLASSHOUSE strategies & pricing postures)
// 2. Non-linear Macro Shocks & Volatility (compounding drift & secondary shocks)
// 3. Staff Fatigue Surface Area & Apprentice Trade-offs (wages, training fee, Ruth condition rest)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CAMPAIGN, COPY } from '../js/config.js';
import { applyDrift, calculateNonLinearDrift, MACRO_SHOCKS, getMacroShockForDay, modifiersForDay, wavesForDay } from '../js/gentrification.js';
import { Exchange } from '../js/exchange.js';
import { PatronSystem } from '../js/patrons.js';
import { Regulars } from '../js/regulars.js';
import { rivalChoiceProbability, strategyForDay } from '../js/rival.js';
import { canHaveStaffCrisis, canChooseStaffing } from '../js/staffing.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));
const fails = [];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// -------------------------------------------------------------
// 1. Rival AI Strategies
// -------------------------------------------------------------
const strats = CAMPAIGN.rivalStrategies;
if (!strats) fails.push('CAMPAIGN.rivalStrategies missing');

{
  const scene = { add() {} };
  const world = { seats: [] };
  const mkSys = (strategy, random) => {
    const sys = new PatronSystem(scene, world, new Regulars(), { matchaPrice: 4.80, day: 1 }, null, { random });
    sys.rivalStrategy = strategy;
    return sys;
  };

  const war = mkSys('PRICE_WAR', () => 0.2);
  const before = war.regulars.regulars.every(r => !r.seen);
  war.spawn('students', 'counter', true);
  if (war.rivalChoices !== 1 || war.rivalQ.length !== 1) fails.push(`PRICE_WAR random=.2 should divert a student (choices=${war.rivalChoices} q=${war.rivalQ.length})`);
  if (!war.regulars.regulars.every(r => !r.seen) && before) fails.push('rival choice marked a regular seen');
  if (war.rivalQ[0].rivalOrigin !== 'choice') fails.push('rival choice not tagged rivalOrigin=choice');

  const def = mkSys('DEFAULT', () => 0.2);
  def.spawn('students', 'counter', true);
  if (def.rivalChoices !== 0 || def.counterQ.length !== 1) fails.push('DEFAULT random=.2 should NOT divert a student');
  def.spawn('students', 'retail', true);
  if (def.rivalQ.length !== 0) fails.push('shopping spawn must not be diverted');

  const pWar = rivalChoiceProbability({ strategy: 'PRICE_WAR', cohort: 'students', ourPrice: 4.80 });
  const pDef = rivalChoiceProbability({ strategy: 'DEFAULT', cohort: 'students', ourPrice: 4.80 });
  if (!(pWar > 0.2 && pDef < 0.2)) fails.push(`probabilities should straddle random=.2: war=${pWar} def=${pDef}`);

  const serve = strategy => {
    const sys = mkSys(strategy, () => 0.9);
    for (let i = 0; i < 8; i++) { const p = sys.spawn('commuters', 'counter', true); if (p) { p.state = 'inRivalQ'; } }
    sys.counterQ = []; sys.rivalQ = sys.patrons.slice();
    let served = 0;
    for (let t = 0; t < 10; t++) served += sys.tick(500, { prebatched: false, batchUnits: 0 }).filter(e => e.type === 'rivalServed').length;
    return served;
  };
  const dServed = serve('DEFAULT');
  const xServed = serve('EFFICIENCY_RUSH');
  if (dServed !== 5) fails.push(`DEFAULT should serve 5 in 10 ticks, got ${dServed}`);
  if (xServed !== 7) fails.push(`EFFICIENCY_RUSH should serve 7 in 10 ticks, got ${xServed}`);

  if (strategyForDay(1) !== 'DEFAULT') fails.push('day 1 rival should be DEFAULT');
  if (strategyForDay(3) !== 'PRICE_WAR') fails.push('day 3 rival should be PRICE_WAR');
  if (strategyForDay(4, 'cata') !== 'ROASTER_PIVOT') fails.push('cata tier should pivot the roaster');
}
console.log('RIVAL   live diversion + credit service verified');

// -------------------------------------------------------------
// 2. Non-Linear Macro Shocks
// -------------------------------------------------------------
{
  const ex = new Exchange(42);
  for (let d = 1; d <= CAMPAIGN.days; d++) {
    const before = ex.beanIndex;
    const ev = ex.openDay();
    const expected = Math.max(0.6, Math.min(2.6, Math.min(CAMPAIGN.drift.maxIndex, before + calculateNonLinearDrift(d)) + ev.dIndex));
    if (!near(ex.beanIndex, expected))
      fails.push(`day ${d}: index ${ex.beanIndex} !== expected ${expected} (before ${before}, drift ${calculateNonLinearDrift(d)}, event ${ev.dIndex})`);
  }
  const ex2 = new Exchange(42);
  const d3before = ex2.beanIndex;
  ex2.openDay(); ex2.openDay();
  const b3 = ex2.beanIndex;
  const ev3 = ex2.openDay();
  const drift3 = ex2.beanIndex - b3 - ev3.dIndex;
  if (!near(drift3, calculateNonLinearDrift(3)) && Math.abs(ex2.beanIndex - CAMPAIGN.drift.maxIndex) > 1e-9)
    fails.push(`day-3 accelerating drift wrong: ${drift3} vs ${calculateNonLinearDrift(3)}`);

  // Test macro shocks
  const m2a = modifiersForDay(2), m2b = modifiersForDay(2);
  if (JSON.stringify(m2a) !== JSON.stringify(m2b)) fails.push('modifiersForDay not idempotent');
  if (m2a.commuterDelayMinutes !== 30 || m2a.dwellBonus !== 0.3) fails.push('day-2 transit modifiers wrong');
  if (modifiersForDay(3).commuterDelayMinutes !== 0) fails.push('day 3 should have no transit delay');
  if (modifiersForDay(3).pitchPctDelta !== MACRO_SHOCKS.pitch_reval.pitchPctDelta) fails.push('day-3 pitch reval missing');
  if (modifiersForDay(4).suppliesDelta !== MACRO_SHOCKS.dairy_crunch.suppliesDelta) fails.push('day-4 dairy crunch missing');

  const orig = JSON.parse(JSON.stringify(schedule.waves));
  const w2 = wavesForDay(schedule.waves, 2);
  for (const w of w2) {
    if (w.t === 420 && w.spawns.some(s => s.c === 'commuters')) fails.push('day-2 commuter spawn still at 420');
    if (w.t === 450 && !w.spawns.some(s => s.c === 'commuters') && orig.some(o => o.t === 420 && o.spawns.some(s => s.c === 'commuters'))) fails.push('day-2 commuter spawn missing at 450');
  }
  const movedCommuters = w2.flatMap(w => w.t === 450 ? w.spawns : []).some(s => s.c === 'commuters');
  if (!movedCommuters) fails.push('day-2 commuters not shifted to 450');
  const w2non = w2.flatMap(w => w.t === 420 ? w.spawns : []).filter(s => s.c !== 'commuters');
  const o420non = orig.flatMap(w => w.t === 420 ? w.spawns : []).filter(s => s.c !== 'commuters');
  if (JSON.stringify(w2non) !== JSON.stringify(o420non)) fails.push('day-2 non-commuter 420 spawns changed');
  if (JSON.stringify(schedule.waves) !== JSON.stringify(orig)) fails.push('wavesForDay mutated the raw schedule');
  const qtyMap = waves => { const m = {}; for (const w of waves) for (const s of w.spawns) m[s.c] = (m[s.c] || 0) + s.q; return m; };
  if (JSON.stringify(qtyMap(w2)) !== JSON.stringify(qtyMap(orig))) fails.push('day-2 wave shift lost or duplicated spawn quantities');
  const w3 = wavesForDay(schedule.waves, 3);
  if (JSON.stringify(w3.map(w => w.t)) !== JSON.stringify(orig.map(w => w.t))) fails.push('day 3 should have no wave delay');
  if (JSON.stringify(qtyMap(w3)) !== JSON.stringify(qtyMap(orig))) fails.push('day-3 waves changed spawn quantities');
}
console.log('SHOCKS  drift-through-openDay, modifiers, and wave delay verified');

// -------------------------------------------------------------
// 3. Staff Fatigue & Apprentice Mechanics
// -------------------------------------------------------------
{
  const base = { day: 4, condition: 0.15, crisis: false, dayMin: 920 };
  if (!canHaveStaffCrisis({ ...base, staffing: 'work' })) fails.push('crisis should fire for a worked floor');
  if (canHaveStaffCrisis({ ...base, staffing: 'home' })) fails.push('crisis must not fire when Ruth is home');
  if (canHaveStaffCrisis({ ...base, staffing: 'apprentice' })) fails.push('crisis must not fire under an apprentice');
  if (canHaveStaffCrisis({ ...base, staffing: 'work', condition: 0.5 })) fails.push('crisis gated by condition');
  if (canHaveStaffCrisis({ ...base, staffing: 'work', crisis: true })) fails.push('crisis fires once only');
  if (canHaveStaffCrisis({ ...base, staffing: 'work', dayMin: 1100 })) fails.push('crisis window ends at 17:10');

  if (!canChooseStaffing(4, 0.4)) fails.push('staffing choice should open on day 4 when tired');
  if (canChooseStaffing(1, 0.4)) fails.push('staffing choice locked on day 1');
  if (canChooseStaffing(4, 0.9)) fails.push('staffing choice locked when Ruth is fine');
}
console.log('STAFF   crisis + choice predicates verified');

if (fails.length) {
  console.error('\nFAIL:\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('\nPASS — behavioral: openDay drift increments, rival diversion/service, transit wave shift, staff predicates');
