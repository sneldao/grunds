import { strict as assert } from 'node:assert';
import { planTools, toolCopy, TOOL_IDS, essentialNote } from '../js/curriculum.js';
import { economicsLesson } from '../js/orientation.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error('FAIL', name); } };

{
  const r = planTools({ day: 1, introduced: [], houseStock: 100, lastPour: 50, debt: 0 });
  ok(r.visible.has('menu') && r.newToday === null, 'day 1: menu present but quiet (loseable, not taught)');
}
{
  const r = planTools({ day: 2, introduced: [], houseStock: 100, lastPour: 50, debt: 0 });
  ok(r.newToday === 'coffee' && r.visible.has('coffee'), 'day 2: coffee card (menu already used day 1, carded day 3)');
}
{
  const r = planTools({ day: 3, introduced: ['coffee'], houseStock: 100, lastPour: 50, debt: 0 });
  ok(r.newToday === 'menu' && r.visible.has('coffee') && r.visible.has('menu'), 'day 3: menu card, coffee persists');
}
{
  const r = planTools({ day: 4, introduced: ['coffee', 'menu'], houseStock: 100, lastPour: 50, debt: 0 });
  ok(r.newToday === 'street' && r.visible.has('street'), 'day 4: street card');
}
{
  const r = planTools({ day: 5, introduced: ['coffee', 'menu', 'street'], houseStock: 100, lastPour: 50, debt: 0 });
  ok(r.newToday === 'insurance' && r.visible.has('insurance'), 'day 5: insurance card');
}
{
  const r = planTools({ day: 2, introduced: [], houseStock: 100, lastPour: 50, debt: 0, threatToday: true });
  ok(r.newToday === 'insurance' && r.visible.has('insurance'), 'threat pulls insurance ahead of coffee');
}
{
  const r = planTools({ day: 3, introduced: ['coffee', 'insurance'], houseStock: 100, lastPour: 50, debt: 0, threatYesterday: true });
  ok(r.newToday === 'menu', 'already-introduced insurance not re-carded');
}
{
  const r = planTools({ day: 2, introduced: [], houseStock: 0, lastPour: 50, debt: 12 });
  ok(r.newToday === 'coffee', 'needed + unintroduced coffee takes the card, not a note');
  ok(r.essentialNew.includes('tab') && !r.essentialNew.includes('coffee'), 'tab essential beside the coffee card');
  ok(!r.essentialNew.includes(r.newToday), 'essential never duplicated as newToday');
  ok(r.visible.has('coffee') && r.visible.has('tab'), 'essentials visible');
}
{
  const r = planTools({ day: 3, introduced: ['coffee'], houseStock: 0, lastPour: 50, debt: 0 });
  ok(r.visible.has('coffee') && r.newToday === 'menu' && r.essentialNew.length === 0, 'introduced coffee stays a row: no card, no note');
}
{
  const r = planTools({ day: 2, introduced: [], houseStock: 0, lastPour: 50, debt: 0, threatToday: true });
  ok(r.newToday === 'insurance' && r.essentialNew.includes('coffee'), 'threat takes the card; needed coffee stays a note');
  ok(r.visible.has('coffee') && r.visible.has('insurance'), 'essential + card both visible');
}
{
  const r = planTools({ day: 2, introduced: new Set(['coffee', 'menu', 'street', 'insurance', 'tab']), houseStock: 100, lastPour: 50 });
  ok(r.visible.size === 5 && r.newToday === null, 'all introduced: everything visible, no card');
}
{
  const r = planTools({ day: 1, introduced: [], unlockAll: true });
  ok(r.visible.size === TOOL_IDS.length && r.newToday === null, 'unlockAll day 1');
}
{
  const c = toolCopy('coffee', { lots: { a: { name: 'Lot A', origin: 'O', blurb: 'b', affinity: { x: 1.2, y: 1.0 } } } });
  ok(c.title === 'Your coffee' && c.lots.length === 1 && c.lots[0].includes('favoured by x'), 'toolCopy coffee lot lines');
  ok(toolCopy('insurance', { threat: true }).voice.includes('may move'), 'insurance threat voice');
  ok(essentialNote('tab', { debt: 42, rate: 0.025 }).includes('£42.00') && essentialNote('tab', { debt: 42, rate: 0.025 }).includes('2.5%'), 'tab note real values');
}
{
  const ls = economicsLesson({ houseStock: 0, houseName: 'X', lastPour: 10, debt: 0, staffCanChoose: false, prevTier: 'calm' });
  ok(ls.tool === 'coffee', 'lesson: empty stock → coffee');
  const d = economicsLesson({ houseStock: 100, houseName: 'X', lastPour: 10, debt: 40, staffCanChoose: false, prevTier: 'calm' });
  ok(d.tool === 'tab', 'lesson: debt → tab');
  const s = economicsLesson({ houseStock: 100, houseName: 'X', lastPour: 10, debt: 0, staffCanChoose: true, prevTier: 'calm' });
  ok(s.tool === 'staff', 'lesson: staffing → staff');
  const m = economicsLesson({ houseStock: 100, houseName: 'X', lastPour: 10, debt: 0, staffCanChoose: false, prevTier: 'warn' });
  ok(m.tool === 'market', 'lesson: market warn → market');
  const c0 = economicsLesson({ houseStock: 100, houseName: 'X', lastPour: 10, debt: 0, staffCanChoose: false, prevTier: 'calm' });
  ok(c0.tool === null, 'lesson: calm → null');
}

console.log(`curriculum: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
