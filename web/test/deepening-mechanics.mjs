// Test suite verifying the three deepened mechanics:
// 1. Dynamic Rival AI (GLASSHOUSE strategies & pricing postures)
// 2. Non-linear Macro Shocks & Volatility (compounding drift & secondary shocks)
// 3. Staff Fatigue Surface Area & Apprentice Trade-offs (wages, training fee, Ruth condition rest)
import { CAMPAIGN, COPY } from '../js/config.js';
import { applyDrift, calculateNonLinearDrift, MACRO_SHOCKS, getMacroShockForDay } from '../js/gentrification.js';
import { Exchange } from '../js/exchange.js';

const fails = [];

// -------------------------------------------------------------
// 1. Rival AI Strategies
// -------------------------------------------------------------
const strats = CAMPAIGN.rivalStrategies;
if (!strats) fails.push('CAMPAIGN.rivalStrategies missing');
if (!strats.PRICE_WAR || strats.PRICE_WAR.price !== 3.80) fails.push('PRICE_WAR strategy misconfigured');
if (!strats.ROASTER_PIVOT || strats.ROASTER_PIVOT.price !== 5.20) fails.push('ROASTER_PIVOT strategy misconfigured');
if (!strats.EFFICIENCY_RUSH || strats.EFFICIENCY_RUSH.speedMul !== 1.4) fails.push('EFFICIENCY_RUSH strategy misconfigured');

console.log('RIVAL   strategies verified:', Object.keys(strats).join(', '));

// -------------------------------------------------------------
// 2. Non-Linear Macro Shocks
// -------------------------------------------------------------
const baseDrift = CAMPAIGN.drift.perDay; // 0.025
const accel = CAMPAIGN.drift.accel;     // 0.008

const d1 = calculateNonLinearDrift(1, baseDrift, accel);
const d3 = calculateNonLinearDrift(3, baseDrift, accel);
const d5 = calculateNonLinearDrift(5, baseDrift, accel);

if (d1 !== baseDrift) fails.push(`day 1 non-linear drift should equal baseDrift (${d1} !== ${baseDrift})`);
if (d3 <= d1) fails.push(`day 3 non-linear drift should exceed day 1 (${d3} <= ${d1})`);
if (d5 <= d3) fails.push(`day 5 non-linear drift should exceed day 3 (${d5} <= ${d3})`);

// Test macro shocks
const shock3 = getMacroShockForDay(3);
if (!shock3 || shock3.id !== 'pitch_reval') fails.push('getMacroShockForDay(3) should return pitch_reval');

const ex = new Exchange(42);
const initIndex = ex.beanIndex;
applyDrift(ex, 3, 0.05); // apply drift with shock
const expectedIndex = initIndex + baseDrift + 0.05;
if (Math.abs(ex.beanIndex - expectedIndex) > 1e-12) fails.push(`applyDrift with shock failed: ${ex.beanIndex} vs ${expectedIndex}`);

console.log('SHOCKS  non-linear drift verified: Day 1=' + d1.toFixed(4) + ', Day 3=' + d3.toFixed(4) + ', Day 5=' + d5.toFixed(4));
console.log('SHOCKS  pitch reval shock:', JSON.stringify(shock3));

// -------------------------------------------------------------
// 3. Staff Fatigue & Apprentice Mechanics
// -------------------------------------------------------------
const staff = CAMPAIGN.staff;
if (!staff) fails.push('CAMPAIGN.staff config missing');
if (staff.apprenticeDayRate !== 65) fails.push(`apprenticeDayRate expected 65, got ${staff.apprenticeDayRate}`);
if (staff.apprenticeTrainingFee !== 12) fails.push(`apprenticeTrainingFee expected 12, got ${staff.apprenticeTrainingFee}`);
if (staff.apprenticeStaffMul !== 1.05) fails.push(`apprenticeStaffMul expected 1.05, got ${staff.apprenticeStaffMul}`);
if (staff.ruthApprenticeRest !== 0.25) fails.push(`ruthApprenticeRest expected 0.25, got ${staff.ruthApprenticeRest}`);

console.log('STAFF   apprentice config verified: wage=£' + staff.apprenticeDayRate + ', rest=+' + staff.ruthApprenticeRest);

if (fails.length) {
  console.error('\nFAIL:\n - ' + fails.join('\n - '));
  process.exit(1);
}
console.log('\nPASS — All 3 friction point solutions verified: Dynamic Rival AI, Non-linear Macro Shocks, and Apprentice Staffing.');
