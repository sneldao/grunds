// Running the Stand — the right-hand vitals panel. Pure model + keyed renderer.
// Usage: node web/test/vitals.mjs
import assert from 'node:assert/strict';
import { buildVitals, renderVitals, cupCost } from '../js/vitals.js';
import { CAMPAIGN } from '../js/config.js';

const ops = { staff: 1700, supplies: 50, pitch: 1150, fees: 10, sundries: CAMPAIGN.sundries, power: 32, wifi: 6, marketing: 0, training: 0, sampling: 0, total: 2978 };
const base = {
  phase: 'trading', day: 2, dayMin: 700, staffing: 'work', staffCondition: 0.86,
  houseLot: 'huila', houseStock: 1200, houseAge: 1, cellarStock: 2400,
  milkDelivery: 400, milkStock: 320, batchUnits: 0, beanIndex: 1.0, matchaBean: 1.30,
  flatwhitePrice: 3.6, matchaPrice: 4.8, ops, till: 1500, cogs: 40, debt: 0,
};
const byId = s => Object.fromEntries(buildVitals(s).map(r => [r.id, r]));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ✓', name); };

ok('a healthy morning reads calm — no alarms at baseline', () => {
  const v = byId(base);
  for (const id of ['staff', 'beans', 'milk', 'cost', 'nut']) assert.equal(v[id].tone, 'ok', id);
  assert.ok(!v.tab && !v.batch, 'tab/batch rows only appear when relevant');
});

ok('Ruth frays below 0.35 (the sim slows the bar there)', () => {
  assert.equal(byId({ ...base, staffCondition: 0.5 }).staff.tone, 'warn');
  const v = byId({ ...base, staffCondition: 0.3 });
  assert.equal(v.staff.tone, 'bad');
  assert.match(v.staff.note, /send her home/);
  assert.equal(byId({ ...base, staffing: 'home', staffCondition: 0.2 }).staff.tone, 'ok');
});

ok('stale roast and a dry cellar surface on the beans row', () => {
  assert.equal(byId({ ...base, houseAge: 3 }).beans.tone, 'warn');
  const dry = byId({ ...base, cellarStock: 0, emergency: true }).beans;
  assert.equal(dry.tone, 'bad'); assert.equal(dry.value, 'cellar dry');
});

ok('milk warns under 20% and goes red when orders walk', () => {
  assert.equal(byId({ ...base, milkStock: 60 }).milk.tone, 'warn');
  assert.equal(byId({ ...base, milkStock: 0, milkOut: true }).milk.tone, 'bad');
});

ok('cost basis matches the cost sheet, and drift pushes the margin amber', () => {
  const fw = cupCost(1.30, 3.6);
  assert.ok(Math.abs(fw - (1.30 + CAMPAIGN.suppliesPerCup + CAMPAIGN.staffPerCup + 3.6 * CAMPAIGN.cardFeePct)) < 1e-9);
  assert.match(byId(base).cost.note, new RegExp(`flat white £${fw.toFixed(2)} of £3.60`));
  assert.match(byId(base).cost.value, /% margin$/);
  assert.notEqual(byId({ ...base, beanIndex: 1.6, matchaBean: 2.08 }).cost.tone, 'ok');
});

ok('the nut only alarms in the evening, and surfaces utilities', () => {
  assert.equal(byId({ ...base, till: 300 }).nut.tone, 'ok');
  assert.equal(byId({ ...base, till: 300, dayMin: 1030 }).nut.tone, 'bad');
  assert.match(byId({ ...base, till: 4000 }).nut.value, /covered ✓/);
  assert.match(byId(base).nut.note, new RegExp(`bills £${32 + 6 + CAMPAIGN.sundries}`));
});

ok('utilities read calm until the wifi drops — then the row carries the tether', () => {
  const calm = byId(base).utilities;
  assert.equal(calm.tone, 'ok'); assert.match(calm.value, /power £32 · wifi £6/); assert.ok(!calm.action);
  const down = byId({ ...base, wifi: 'down', wifiBack: 735 }).utilities;
  assert.equal(down.tone, 'bad');
  assert.equal(down.action.act, 'tether');
  assert.match(down.action.label, new RegExp(`£${CAMPAIGN.utilities.outage.tetherCost}`));
  assert.match(down.note, /12:15/);
  assert.match(byId({ ...base, wifi: 'down', wifiBack: 735, perkCostMul: 0.9 }).utilities.action.label, /£41/, 'the accountant perk trims the tether');
  const teth = byId({ ...base, wifi: 'tethered', wifiBack: 735 }).utilities;
  assert.equal(teth.tone, 'warn'); assert.ok(!teth.action);
  assert.match(byId({ ...base, wifi: 'restored' }).utilities.note, /restored/);
});

ok('the tab appears with debt and reddens near the limit', () => {
  assert.equal(byId({ ...base, debt: 500 }).tab.tone, 'ok');
  assert.equal(byId({ ...base, debt: CAMPAIGN.creditLimit * 0.9 }).tab.tone, 'bad');
});

ok('renderer is keyed: rows reused, stale rows removed, unchanged rows untouched', () => {
  const mk = () => ({ className: '', textContent: '', hidden: false, style: {}, dataset: {}, children: [],
    appendChild(c) { this.children.push(c); c._p = this; return c; },
    remove() { const p = this._p; if (p) p.children.splice(p.children.indexOf(this), 1); } });
  globalThis.document = { createElement: mk };
  const list = mk();
  renderVitals(list, buildVitals({ ...base, debt: 900 }));
  const count = list.children.length;
  const first = list.children[0];
  renderVitals(list, buildVitals({ ...base, debt: 900 }));
  assert.equal(list.children.length, count); assert.equal(list.children[0], first);
  renderVitals(list, buildVitals(base));
  assert.equal(list.children.length, count - 1, 'tab row removed when debt clears');
  assert.ok(list.children.every(li => li.dataset.v !== 'tab'));
});

ok('mapped rows render mask glyph classes; unmapped keep their emoji', () => {
  const mk = () => ({ className: '', textContent: '', hidden: false, style: {}, dataset: {}, children: [], attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); c._p = this; return c; },
    remove() { const p = this._p; if (p) p.children.splice(p.children.indexOf(this), 1); } });
  globalThis.document = { createElement: mk };
  const list = mk();
  renderVitals(list, buildVitals({ ...base, debt: 900, batchUnits: 12 }));
  const vi = id => list.children.find(li => li.dataset.v === id).children[0];
  assert.equal(vi('staff').className, 'vi vital-icon vital-icon-cup');
  assert.equal(vi('beans').className, 'vi vital-icon vital-icon-coffee');
  assert.equal(vi('milk').className, 'vi vital-icon vital-icon-milk');
  assert.equal(vi('batch').className, 'vi vital-icon vital-icon-cup');
  assert.equal(vi('tab').className, 'vi vital-icon vital-icon-coins');
  for (const id of ['staff', 'beans', 'milk', 'batch', 'tab']) {
    assert.equal(vi(id).textContent, '', id);
    assert.equal(vi(id).attrs['aria-hidden'], 'true', id);
  }
  assert.equal(vi('utilities').className, 'vi');
  assert.equal(vi('utilities').textContent, '⚡');
  assert.equal(vi('cost').className, 'vi');
  assert.equal(vi('cost').textContent, '⚖');
  assert.equal(vi('nut').className, 'vi');
});

ok('cache re-renders when icon or label changes under the same row id', () => {
  const mk = () => ({ className: '', textContent: '', hidden: false, style: {}, dataset: {}, children: [],
    appendChild(c) { this.children.push(c); c._p = this; return c; },
    remove() { const p = this._p; if (p) p.children.splice(p.children.indexOf(this), 1); } });
  globalThis.document = { createElement: mk };
  const list = mk();
  const row = (icon, label) => ({ id: 'probe', icon, label, value: 'v', tone: 'ok' });
  renderVitals(list, [row('a', 'one')]);
  assert.equal(list.children[0].children[0].textContent, 'a');
  assert.equal(list.children[0].children[1].textContent, 'one');
  renderVitals(list, [row('a', 'one')]);
  renderVitals(list, [row('b', 'two')]);
  assert.equal(list.children[0].children[0].textContent, 'b');
  assert.equal(list.children[0].children[1].textContent, 'two');
});

console.log(`vitals: ${n} passed`);
