// vitals.js — "Running the Stand": the right-hand panel of what keeps the
// café alive while it trades. Read-only: every row is derived from state the
// sim already owns (Ruth's condition, the cellar, milk, the cost sheet, the
// tab). No new mechanics live here — this is the dashboard, not the engine.
//
// Pure model (buildVitals) + a tiny keyed renderer (renderVitals) so the HUD
// loop can call it at ~5Hz without rebuilding DOM every frame.
import { CAMPAIGN } from './config.js';
import { LOT_CATALOG, STALE_AFTER, lotSpot } from './lots.js';

const money = n => '£' + Math.round(n).toLocaleString('en-GB');
const money2 = n => '£' + n.toFixed(2);
const clamp01 = n => Math.max(0, Math.min(1, n));

// Per-cup cost basis at today's market: beans + supplies + flex labour + the
// card fee on the sale price. Fixed costs (roster, rent) live in "the nut".
export function cupCost(beanCost, price, perkCostMul = 1) {
  return beanCost + CAMPAIGN.suppliesPerCup + CAMPAIGN.staffPerCup + price * CAMPAIGN.cardFeePct * perkCostMul;
}

function staffRow(s) {
  const c = clamp01(s.staffCondition ?? 1);
  if (s.staffing === 'home') return { id: 'staff', icon: '☕', label: 'Ruth', value: 'home — resting', meter: c, tone: 'ok', note: 'the bar runs without her today' };
  const word = c >= 0.7 ? 'fresh' : c >= 0.4 ? 'tired' : 'frayed';
  const tone = s.crisis || c < 0.35 ? 'bad' : c < 0.55 ? 'warn' : 'ok';
  const note = s.crisis ? 'she’s at breaking point'
    : c < 0.35 ? 'slowing the bar — send her home tomorrow'
    : s.staffing === 'apprentice' ? 'a temp is backing her up'
    : c < 0.55 ? 'long queues wear her down' : 'steady on the bar';
  return { id: 'staff', icon: '☕', label: 'Ruth', value: `${word} · ${Math.round(c * 100)}%`, meter: c, tone, note };
}

function beanRow(s) {
  const entry = LOT_CATALOG[s.houseLot];
  const name = entry ? entry.name.split(' ').slice(-1)[0] : '—';
  const stock = Math.max(0, s.cellarStock ?? 0);
  if (s.emergency || stock <= 0) {
    return { id: 'beans', icon: '🫘', label: 'Beans', value: 'cellar dry', meter: 0, tone: 'bad', note: 'emergency sacks at 1.5× spot' };
  }
  const age = s.houseAge ?? 0;
  const stale = age > STALE_AFTER;
  const low = (s.houseStock ?? 0) < 150;
  const tone = stale || low ? 'warn' : 'ok';
  const note = stale ? `roast is ${age}d old — regulars can taste it`
    : low ? 'house sack nearly empty'
    : `roast ${age}d old · stale after ${STALE_AFTER}d`;
  return { id: 'beans', icon: '🫘', label: 'Beans', value: `${name} · ${(s.houseStock ?? 0).toLocaleString('en-GB')} cups`,
    // The meter is the roast clock (freshness), not the sack — sack sizes vary.
    meter: clamp01(1 - age / (STALE_AFTER + 1)), tone, note };
}

function milkRow(s) {
  const delivery = Math.max(0, s.milkDelivery ?? 0);
  const stock = Math.max(0, s.milkStock ?? 0);
  if (!delivery) return { id: 'milk', icon: '🥛', label: 'Milk', value: 'delivery at dawn', meter: null, tone: 'dim', note: '' };
  const frac = clamp01(stock / delivery);
  const tone = s.milkOut || stock <= 0 ? 'bad' : frac < 0.2 ? 'warn' : 'ok';
  const note = s.milkOut || stock <= 0 ? 'milky orders are walking out' : frac < 0.2 ? 'running low' : `of ${delivery} delivered`;
  return { id: 'milk', icon: '🥛', label: 'Milk', value: `${stock} cups left`, meter: frac, tone, note };
}

function batchRow(s) {
  if (!s.prebatched && !(s.batchUnits > 0)) return null;
  const n = Math.max(0, s.batchUnits ?? 0);
  return { id: 'batch', icon: '🍵', label: 'Batch', value: n ? `${n} matcha ready` : 'sold through', meter: null,
    tone: n ? 'ok' : 'dim', note: n ? 'leftovers spoil at close' : '' };
}

function costRow(s) {
  const fwPrice = s.flatwhitePrice ?? 3.6;
  const fwBean = lotSpot(s.houseLot, s.beanIndex ?? 1, s.housePriceMul ?? 1);
  const fw = cupCost(fwBean, fwPrice, s.perkCostMul);
  const mPrice = s.matchaPrice ?? 4.8;
  const m = cupCost(s.matchaBean ?? CAMPAIGN.beanBaseCost, mPrice, s.perkCostMul);
  const margin = Math.min((fwPrice - fw) / fwPrice, (mPrice - m) / mPrice);
  // A flat white at index 1.0 clears ~44% — the baseline reads calm; the
  // drift (or a deep price cut) is what pushes it amber, then red.
  const tone = margin < 0.2 ? 'bad' : margin < 0.35 ? 'warn' : 'ok';
  const drift = Math.round(((s.beanIndex ?? 1) - 1) * 100);
  return { id: 'cost', icon: '⚖', label: 'Per cup', value: `${Math.round(margin * 100)}% margin`, meter: null, tone,
    note: `flat white ${money2(fw)} of ${money2(fwPrice)} · matcha ${money2(m)} of ${money2(mPrice)} · beans ${drift >= 0 ? '+' : ''}${drift}%` };
}

function nutRow(s) {
  const ops = s.ops;
  if (!ops) return null;
  const nut = ops.total + (s.cogs ?? 0);
  const covered = nut > 0 ? clamp01((s.till ?? 0) / nut) : 1;
  // Most of the nut is committed before the first cup, so a part-covered
  // morning is normal; it only alarms once the evening (17:00) is near.
  const late = (s.dayMin ?? 0) >= 1020;
  const tone = s.phase !== 'trading' ? 'dim' : covered >= 1 || !late ? 'ok' : covered < 0.8 ? 'bad' : 'warn';
  return { id: 'nut', icon: '🏠', label: 'The nut', value: covered >= 1 ? `${money(nut)} · covered ✓` : `${money(nut)} · ${Math.round(covered * 100)}% covered`,
    meter: covered, tone,
    note: `staff ${money(ops.staff)} · rent ${money(ops.pitch)} · supplies ${money(ops.supplies)} · utilities ${money(ops.sundries)}` };
}

function tabRow(s) {
  const debt = Math.max(0, s.debt ?? 0);
  if (!debt) return null;
  const limit = CAMPAIGN.creditLimit;
  const frac = clamp01(debt / limit);
  return { id: 'tab', icon: '📒', label: 'Idris’s tab', value: `${money(debt)} / ${money(limit)}`, meter: frac,
    tone: frac >= 0.85 ? 'bad' : frac >= 0.6 ? 'warn' : 'ok', note: 'interest compounds daily', inverse: true };
}

// s: a flat snapshot assembled by main.js (see vitalsSnapshot()).
export function buildVitals(s) {
  return [staffRow(s), beanRow(s), milkRow(s), batchRow(s), costRow(s), nutRow(s), tabRow(s)].filter(Boolean);
}

// Keyed renderer: one <li> per row id, rewritten only when its text changes.
// Row nodes are cached on the list element (no querySelector), so it is cheap
// at 5Hz and safe under the headless DOM stubs.
function makeRow(id) {
  const el = (tag, cls) => { const n = document.createElement(tag); n.className = cls; return n; };
  const li = document.createElement('li');
  li.dataset.v = id;
  const parts = { vi: el('span', 'vi'), vl: el('span', 'vl'), vv: el('span', 'vv'), vm: el('div', 'vm'), bar: document.createElement('i'), vn: el('div', 'vn') };
  parts.vm.appendChild(parts.bar);
  for (const k of ['vi', 'vl', 'vv', 'vm', 'vn']) li.appendChild(parts[k]);
  return { li, parts, sig: '' };
}
export function renderVitals(listEl, rows) {
  if (!listEl) return;
  const cache = listEl._vitalRows || (listEl._vitalRows = new Map());
  const seen = new Set();
  for (const r of rows) {
    seen.add(r.id);
    let row = cache.get(r.id);
    if (!row) { row = makeRow(r.id); cache.set(r.id, row); listEl.appendChild(row.li); }
    const sig = [r.value, r.tone, r.note, r.meter == null ? '' : Math.round(r.meter * 100)].join('|');
    if (row.sig === sig) continue;
    row.sig = sig;
    const p = row.parts;
    row.li.className = 'v-' + r.tone + (r.inverse ? ' v-inv' : '');
    p.vi.textContent = r.icon;
    p.vl.textContent = r.label;
    p.vv.textContent = r.value;
    p.vn.textContent = r.note || '';
    p.vm.hidden = r.meter == null;
    if (r.meter != null) p.bar.style.width = Math.round(r.meter * 100) + '%';
  }
  for (const [id, row] of cache) if (!seen.has(id)) { row.li.remove(); cache.delete(id); }
}
