// web/js/marketSnapshot.js — attention-street pillar 3: the real-world
// commodity snapshot.
//
// Contract: the market is a SNAPSHOT, never a live feed. A campaign resolves
// its anchor synchronously from a cached live snapshot or a seeded synthetic
// one, so play never blocks on the network and never drifts mid-week. A live
// value is fetched once in the background and cached for the *next* campaign
// (the Grove-mirror philosophy: network is optional, never a runtime
// dependency). The synthetic path is bit-identical to today's hose
// (startIndex 1.0), so the balance harness and every replay is untouched —
// only a cached live anchor moves the week's opening cost basis.
import { seeded } from './exchange.js';

// FRED hosts the IMF "Global Price of …, US Dollars per Metric Ton" series.
// `ref` is the normalization constant for each — a typical recent level — so
// the ratio (spot/ref) says how dear the real market is this week. These are
// display/normalization constants, not an economic claim; the anchor band
// below is what actually touches the sim.
export const SERIES = {
  arabica: { id: 'PCOFFARABUSDM', unit: '$/t', ref: 7000, label: 'arabica' },
  cocoa:   { id: 'PCOFFCOCOUSDM', unit: '$/t', ref: 7500, label: 'cocoa' },
};

// Live anchors bias the opening bean index within a bounded band; a real
// market can tilt the week's cost basis but never break its balance.
export const ANCHOR_BAND = { lo: 0.85, hi: 1.15, sensitivity: 0.5 };

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
export const SNAPSHOT_KEY = 'grunds.snapshot';
export const FRED_KEY_KEY = 'grunds.fredKey';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// A dedicated stream offset (+47) — the synthetic wobble never touches the
// sim streams (+17/+19/+23/+29/+43).
export function syntheticSnapshot(seed) {
  const r = seeded(((seed >>> 0) + 47) || 1);
  const wobble = (ref, spread) => Math.round(ref * (1 + (r() * 2 - 1) * spread));
  return {
    arabica: wobble(SERIES.arabica.ref, 0.18),
    cocoa: wobble(SERIES.cocoa.ref, 0.22),
    ts: null,
    source: 'synthetic',
  };
}

// Pure: (snapshot|null, seed) → anchor. A missing/invalid snapshot falls back
// to the seeded synthetic, and only a LIVE anchor moves startIndex off 1.0 —
// so offline, harness and replay runs stay bit-identical.
export function anchorFrom(snapshot, seed) {
  const snap = (snapshot && Number.isFinite(snapshot.arabica) && Number.isFinite(snapshot.cocoa))
    ? snapshot : syntheticSnapshot(seed ?? 7);
  const live = snap.source === 'live';
  const ratio = snap.arabica / SERIES.arabica.ref;
  const { lo, hi, sensitivity } = ANCHOR_BAND;
  const startIndex = live ? clamp(1 + (ratio - 1) * sensitivity, lo, hi) : 1.0;
  const unit = SERIES.arabica.unit;
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  const when = (snap.ts ? new Date(snap.ts) : null);
  const stamp = when ? when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  const line = live
    ? `the wire pegs the bean — arabica ${fmt(snap.arabica)} ${unit} · cocoa ${fmt(snap.cocoa)} ${unit}${stamp ? ' · snapshot ' + stamp : ''}`
    : `the market is a local read today — synthetic arabica ${fmt(snap.arabica)} ${unit} · cocoa ${fmt(snap.cocoa)} ${unit}`;
  return {
    arabica: Math.round(snap.arabica),
    cocoa: Math.round(snap.cocoa),
    unit, ts: snap.ts ?? null,
    source: live ? 'live' : 'synthetic',
    startIndex,
    line,
  };
}

// ---- parsers (pure, fixture-tested) ---------------------------------------
// Official FRED JSON API: {observations:[{date, value}]} newest-first or last.
export function parseFredJson(text) {
  try {
    const obs = JSON.parse(text)?.observations;
    if (!Array.isArray(obs)) return null;
    for (let i = obs.length - 1; i >= 0; i--) {
      const v = parseFloat(obs[i]?.value);
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return null;
}
// Keyless fredgraph.csv: `DATE,VALUE\n…` — last finite row wins; FRED marks
// missing values with "." which parseFloat rejects.
export function parseFredCsv(text) {
  try {
    const lines = String(text).trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',');
      const v = parseFloat(cols[cols.length - 1]);
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return null;
}

// Best-effort live fetch → normalized snapshot or null. All-or-nothing: a
// partial read (one commodity missing) is worse than a clean synthetic. The
// official JSON API is used when a free FRED key is cached; otherwise it falls
// to the keyless CSV. Never throws.
export async function fetchMarketSnapshot(opts = {}) {
  const { apiKey = null, timeoutMs = 6000, fetchImpl } = opts;
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return null;
  const get = async (url) => {
    let ctl = null, timer = null;
    try {
      if (typeof AbortController !== 'undefined') {
        ctl = new AbortController();
        timer = setTimeout(() => ctl.abort(), timeoutMs);
      }
      const res = await f(url, ctl ? { signal: ctl.signal } : undefined);
      if (!res || !res.ok) return null;
      return await res.text();
    } catch { return null; } finally { if (timer) clearTimeout(timer); }
  };
  const out = { ts: Date.now(), source: 'live' };
  for (const [k, s] of Object.entries(SERIES)) {
    let val = null;
    if (apiKey) {
      const url = `${FRED_API}?series_id=${s.id}&api_key=${encodeURIComponent(apiKey)}` +
        `&file_format=json&sort_order=desc&limit=1`;
      val = parseFredJson(await get(url));
    }
    if (val == null) val = parseFredCsv(await get(`${FRED_CSV}?id=${s.id}`));
    if (!Number.isFinite(val) || val <= 0) return null;
    out[k] = Math.round(val);
  }
  return out;
}

// ---- cache (storage-agnostic; localStorage in the browser) ----------------
export function cacheSnapshot(storage, snap) {
  try { storage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); } catch {}
}
export function loadCachedSnapshot(storage) {
  try {
    const j = JSON.parse(storage.getItem(SNAPSHOT_KEY) || 'null');
    if (j && Number.isFinite(j.arabica) && Number.isFinite(j.cocoa)) {
      return { arabica: +j.arabica, cocoa: +j.cocoa, ts: j.ts ?? null, source: 'live' };
    }
  } catch {}
  return null;
}
// Synchronous campaign-start resolution: a cached live snapshot if one exists,
// else the seeded synthetic. Never blocks, never fetches.
export function resolveSnapshot(storage, seed) {
  return loadCachedSnapshot(storage) || syntheticSnapshot(seed);
}
