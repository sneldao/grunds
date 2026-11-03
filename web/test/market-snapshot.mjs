// web/test/market-snapshot.mjs — attention street pillar 3: the real-world
// commodity snapshot. Contract under test: the market is a SNAPSHOT, never a
// live feed — resolved synchronously from cache or a seeded synthetic, and
// the synthetic path is bit-identical to today's hose (startIndex 1.0) so the
// balance harness and every replay is untouched. Only a cached live anchor
// moves the week's opening cost basis, within a bounded band.
// Run: node --test web/test/market-snapshot.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERIES, ANCHOR_BAND, syntheticSnapshot, anchorFrom,
  parseFredJson, parseFredCsv, fetchMarketSnapshot,
  cacheSnapshot, loadCachedSnapshot, resolveSnapshot, SNAPSHOT_KEY,
} from '../js/marketSnapshot.js';
import { Exchange } from '../js/exchange.js';

test('syntheticSnapshot is deterministic per seed and stays near the refs', () => {
  const a = syntheticSnapshot(1234);
  const b = syntheticSnapshot(1234);
  assert.deepEqual(a, b, 'same seed → same synthetic market');
  assert.notDeepEqual(syntheticSnapshot(1234), syntheticSnapshot(4321), 'different seeds differ');
  assert.equal(a.source, 'synthetic');
  assert.equal(a.ts, null);
  for (const [k, s] of Object.entries(SERIES)) {
    const spread = k === 'arabica' ? 0.18 : 0.22;
    assert.ok(a[k] >= s.ref * (1 - spread) && a[k] <= s.ref * (1 + spread),
      `${k} ${a[k]} stays within ±${spread} of ref ${s.ref}`);
  }
});

test('the synthetic anchor is bit-identical to the classic hose (startIndex 1.0)', () => {
  const anchor = anchorFrom(null, 99);
  assert.equal(anchor.source, 'synthetic');
  assert.equal(anchor.startIndex, 1.0, 'offline/harness/replay weeks must open exactly as before');
  const e = new Exchange(99);
  e.setAnchor(anchor);
  assert.equal(e.beanIndex, 1.0);
  assert.match(anchor.line, /synthetic/i);
});

test('a live anchor biases the opening index within the bounded band', () => {
  const { lo, hi } = ANCHOR_BAND;
  const mk = (arabica) => anchorFrom(
    { arabica, cocoa: SERIES.cocoa.ref, ts: Date.UTC(2025, 10, 3), source: 'live' }, 5);
  // dear market: arabica at twice the ref saturates the band ceiling
  assert.equal(mk(SERIES.arabica.ref * 2).startIndex, hi);
  // cheap market: half the ref saturates the floor
  assert.equal(mk(SERIES.arabica.ref * 0.5).startIndex, lo);
  // at the ref the week opens square
  assert.equal(mk(SERIES.arabica.ref).startIndex, 1.0);
  // in-band moves are proportional and deterministic
  const a = mk(Math.round(SERIES.arabica.ref * 1.2));
  const b = mk(Math.round(SERIES.arabica.ref * 1.2));
  assert.deepEqual(a, b);
  assert.ok(a.startIndex > 1.0 && a.startIndex <= hi);
  assert.equal(a.source, 'live');
  assert.match(a.line, /snapshot \d\d? Nov/i);
});

test('anchorFrom rejects malformed snapshots back to the synthetic', () => {
  for (const bad of [undefined, {}, { arabica: NaN, cocoa: 1 }, { arabica: 1, cocoa: null }, { arabica: 'x', cocoa: 2 }]) {
    const a = anchorFrom(bad, 7);
    assert.equal(a.source, 'synthetic');
    assert.equal(a.startIndex, 1.0);
  }
});

test('parseFredJson / parseFredCsv read the last finite observation', () => {
  assert.equal(parseFredJson(JSON.stringify({
    observations: [{ date: '2025-10-01', value: '.' }, { date: '2025-09-01', value: '7412.5' }],
  })), 7412.5);
  assert.equal(parseFredJson('not json'), null);
  assert.equal(parseFredJson(JSON.stringify({ observations: [] })), null);
  const csv = 'observation_date,PCOFFARABUSDM\n2025-09-01,7100\n2025-10-01,.\n2025-11-01,7412\n';
  assert.equal(parseFredCsv(csv), 7412);
  assert.equal(parseFredCsv('<html>bot wall</html>'), null, 'an HTML block page parses to nothing');
  assert.equal(parseFredCsv(''), null);
});

function mockFetch(byUrl) {
  return async (url) => {
    const body = byUrl[url.includes('series/observations') ? 'api' : 'csv'];
    if (body == null) return { ok: false, status: 403, text: async () => '' };
    return { ok: true, status: 200, text: async () => body };
  };
}

test('fetchMarketSnapshot is all-or-nothing and prefers the keyed API', async () => {
  const api = (v) => JSON.stringify({ observations: [{ date: '2025-11-01', value: String(v) }] });
  // both series via the official API
  const both = await fetchMarketSnapshot({
    apiKey: 'k',
    fetchImpl: async (url) => ({
      ok: true,
      text: async () => api(url.includes(SERIES.arabica.id) ? 7412 : 8100),
    }),
  });
  assert.equal(both.arabica, 7412);
  assert.equal(both.cocoa, 8100);
  assert.equal(both.source, 'live');
  assert.ok(both.ts > 0);
  // one series missing → null, never a half-anchored week
  const partial = await fetchMarketSnapshot({
    fetchImpl: async (url) => url.includes(SERIES.arabica.id)
      ? { ok: true, text: async () => 'observation_date,V\n2025-11-01,7412\n' }
      : { ok: false, text: async () => '' },
  });
  assert.equal(partial, null);
  // bot-walled everything → null
  assert.equal(await fetchMarketSnapshot({ fetchImpl: mockFetch({}) }), null);
  // a hard network failure → null
  assert.equal(await fetchMarketSnapshot({ fetchImpl: async () => { throw new Error('net down'); } }), null);
});

test('the cache round-trips and resolveSnapshot prefers a cached live read', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.equal(loadCachedSnapshot(storage), null);
  const snap = { arabica: 7412, cocoa: 8100, ts: 1730000000000, source: 'live' };
  cacheSnapshot(storage, snap);
  assert.ok(store.get(SNAPSHOT_KEY));
  assert.deepEqual(loadCachedSnapshot(storage), snap);
  const resolved = resolveSnapshot(storage, 5);
  assert.equal(resolved.source, 'live');
  assert.equal(resolved.arabica, 7412);
  // a corrupt cache falls back to the seeded synthetic, not a crash
  store.set(SNAPSHOT_KEY, '{corrupt');
  assert.equal(loadCachedSnapshot(storage), null);
  assert.equal(resolveSnapshot(storage, 5).source, 'synthetic');
  // no storage at all still resolves
  assert.equal(resolveSnapshot(null, 5).source, 'synthetic');
});

test('Exchange.setAnchor applies once, only before the first dawn', () => {
  const live = anchorFrom({ arabica: Math.round(SERIES.arabica.ref * 1.3), cocoa: 8000, ts: 1, source: 'live' }, 3);
  assert.notEqual(live.startIndex, 1.0);
  const e = new Exchange(3);
  e.setAnchor(live);
  assert.equal(e.beanIndex, live.startIndex, 'a fresh campaign opens on the real market');
  const before = e.beanIndex;
  e.setAnchor(anchorFrom(null, 3));
  assert.equal(e.anchor.source, 'live', 'the anchor is set once per campaign');
  assert.equal(e.beanIndex, before);
  // mid-week re-anchor is refused: the save's beanIndex is authoritative
  const e2 = new Exchange(3);
  e2.openDay();
  const idx = e2.beanIndex;
  e2.setAnchor(live);
  assert.equal(e2.anchor, live);
  assert.equal(e2.beanIndex, idx, 'day>0 never re-anchors');
});
