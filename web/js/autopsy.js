// autopsy.js — Phase 6: week autopsy (cause attribution).
//
// Pure + DOM-free: buildAutopsy(campaignDays, regularsSnapshot) → string[].
// Each campaign day pushes one record in closeDay; campaignClose renders the
// rows under a "lost because:" header so a lost week reads as fair, not cruel.
// No imports — the caller shapes the data, this module shapes the sentences.
const LOT_SHORT = {
  cerrado: 'Cerrado',
  huila: 'Huila',
  yirgacheffe: 'Yirgacheffe',
  gesha: 'Gesha',
};

const shortLot = (id) => LOT_SHORT[id] || String(id || 'house');

// Collapse consecutive day numbers into ranges: [3,4,5,7] → "3–5, 7".
function dayRanges(days) {
  const ds = [...new Set(days)].sort((a, b) => a - b);
  const out = [];
  let s = null, p = null;
  const flush = () => { out.push(s === p ? `${s}` : `${s}–${p}`); };
  for (const d of ds) {
    if (s == null) { s = p = d; continue; }
    if (d === p + 1) { p = d; continue; }
    flush(); s = p = d;
  }
  if (s != null) flush();
  return out.join(', ');
}

// One cause record per campaign day (pushed by closeDay):
// { day, staleCupsByLot: {lotId: n}, batchWaste, compost, balked, defections,
//   netToday, opDrops: [{name, from, to}] }
// regularsSnapshot: [{name, op}] — the week's end state, for the "cooled to"
// line when per-day drops are unavailable.
export function buildAutopsy(campaignDays = [], regularsSnapshot = []) {
  const days = Array.isArray(campaignDays) ? campaignDays : [];
  const lines = [];
  // Stale cups by lot → "stale Ethiopia Yirgacheffe days 3–4 (20 cups)".
  const staleDays = new Map(); // lotId → { days: [], cups: n }
  for (const d of days) {
    const byLot = d.staleCupsByLot || {};
    for (const [lot, n] of Object.entries(byLot)) {
      if (!n) continue;
      if (!staleDays.has(lot)) staleDays.set(lot, { days: [], cups: 0 });
      const e = staleDays.get(lot);
      e.days.push(d.day); e.cups += n;
    }
  }
  for (const [lot, e] of staleDays) {
    lines.push(`stale ${shortLot(lot)} days ${dayRanges(e.days)} (${e.cups} cups)`);
  }
  // Waste: batch leftovers + composted sacks.
  const waste = days.reduce((n, d) => n + (d.batchWaste || 0), 0);
  if (waste > 0) lines.push(`${waste} cups wasted (prepped, never poured)`);
  const compost = days.reduce((n, d) => n + (d.compost || 0), 0);
  if (compost > 0) lines.push(`${compost} cups composted (stale sacks tipped)`);
  // Named coolers: prefer per-day drops, fall back to the week snapshot.
  const drops = new Map(); // name → { from, to }
  for (const d of days) {
    for (const o of d.opDrops || []) {
      if (!o || !o.name) continue;
      const prev = drops.get(o.name);
      if (!prev) drops.set(o.name, { from: o.from, to: o.to });
      else drops.set(o.name, { from: prev.from, to: o.to });
    }
  }
  let coolers = [...drops.entries()]
    .map(([name, r]) => ({ name, delta: (r.to ?? 0) - (r.from ?? 0), ...r }))
    .filter((r) => r.delta < -0.05)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);
  if (!coolers.length && Array.isArray(regularsSnapshot)) {
    // Last resort (no per-day deltas): name the lowest end-of-week opinions.
    // Threshold sits above the 0.15 roster start so the ARCH example —
    // "Mara cooled to 0.3" — reads even when dawn baselines are unavailable.
    coolers = regularsSnapshot
      .filter((r) => r && Number.isFinite(r.op) && r.op < 0.35 && r.name)
      .sort((a, b) => a.op - b.op)
      .map((r) => ({ name: r.name, to: r.op, snapshot: true }))
      .slice(0, 3);
  }
  for (const c of coolers) {
    if (c.snapshot) lines.push(`${c.name} cooled to ${Number(c.to).toFixed(1)}`);
    else lines.push(`${c.name} cooled ${Number(c.from).toFixed(1)} → ${Number(c.to).toFixed(1)}`);
  }
  // The floor's verdict in numbers.
  const balked = days.reduce((n, d) => n + (d.balked || 0), 0);
  const defections = days.reduce((n, d) => n + (d.defections || 0), 0);
  if (balked > 0) lines.push(`${balked} walked (queue beat them)`);
  const turned = days.reduce((n, d) => n + (d.turnaways || 0), 0);
  if (turned > 0) lines.push(`${turned} left at the board (their drink was 86'd)`);
  if (defections > 0) lines.push(`${defections} chose Sam`);
  const negDays = days.filter((d) => (d.netToday ?? 0) < 0).map((d) => d.day);
  if (negDays.length) lines.push(`till went backward day${negDays.length > 1 ? 's' : ''} ${dayRanges(negDays)}`);
  if (!lines.length) lines.push('no single cause — the week just never caught fire');
  return lines;
}

// The one decision that cost the most. The rows above list symptoms; this
// names a choice the player could have made differently tomorrow. Priced causes
// (£) outrank unpriced ones. Optional per-day fields: emergencyCups,
// emergencySpend (billed at 1.5× spot, so a third of it was premium), interest,
// event, covered (a contract was live or paid out that day).
const SHOCKS = { frost_minas: 'a frost', drought_ea: 'an East Africa drought' };
const gbp = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;
export function turningPoint(campaignDays = []) {
  const days = Array.isArray(campaignDays) ? campaignDays : [];
  const causes = [];
  const dry = days.filter((d) => (d.emergencyCups || 0) > 0 && (d.emergencySpend || 0) > 0);
  if (dry.length) {
    const premium = dry.reduce((n, d) => n + d.emergencySpend / 3, 0);
    const cups = dry.reduce((n, d) => n + d.emergencyCups, 0);
    if (premium >= 25) causes.push({ cost: premium, line: `the cellar ran dry on day ${dry[0].day} — ${cups} cups at emergency prices cost about ${gbp(premium)} extra. Restock before close.` });
  }
  const interest = days.reduce((n, d) => n + (d.interest || 0), 0);
  if (interest >= 25) causes.push({ cost: interest, line: `the supplier tab charged ${gbp(interest)} in interest. Settle it sooner.` });
  const bare = days.find((d) => SHOCKS[d.event] && !d.covered);
  if (bare) causes.push({ cost: 0, line: `day ${bare.day}: ${SHOCKS[bare.event]} hit and the week had no cover. The wire warned a day earlier.` });
  causes.sort((a, b) => b.cost - a.cost);
  return causes.length ? causes[0].line : null;
}
