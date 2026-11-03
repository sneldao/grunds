// web/test/weather-snapshot.mjs — attention street pillar 4, second seam:
// real weather → the climate envelope. Contract under test: SNAPSHOT, never
// a feed — resolved synchronously from a cached live forecast, and the null
// path is the seeded pickClimate itself, bit-identical (harness, offline,
// pre-anchor saves). The envelope restyles the street scene only, so a live
// anchor can never touch the till.
// Run: node --test web/test/weather-snapshot.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  climateFromWeather, parseGeocode, parseForecast, fetchCityWeather,
  cacheWeather, loadCachedWeather, cacheFresh, resolveClimate,
  WEATHER_TTL_MS, FORECAST_DAYS,
} from '../js/weatherSnapshot.js';
import { pickClimate, CLIMATES } from '../js/climates.js';

const day = (tmax, tmin, precip) => ({ tmax, tmin, precip });
const mild = [day(18, 11, 0), day(20, 12, 0.2), day(19, 11, 0), day(21, 13, 0), day(18, 10, 0.4)];

test('the null path IS the seeded pickClimate — bit-identical fallback', () => {
  for (const seed of [1, 7, 42, 999, 123456]) {
    for (const city of [undefined, 'lisbon', 'São Paulo']) {
      const classic = pickClimate(seed, city);
      const resolved = resolveClimate(null, () => pickClimate(seed, city));
      assert.equal(resolved.id, classic.id);
      // malformed anchors fall through the same way
      assert.equal(resolveClimate({ source: 'nope' }, () => pickClimate(seed, city)).id, classic.id);
      assert.equal(resolveClimate({ source: 'live', days: [day(1, 1, 1)] }, () => pickClimate(seed, city)).id, classic.id);
    }
  }
});

test('climateFromWeather maps a real week honestly', () => {
  // a soaking total is a rain week even without two wet days
  assert.equal(climateFromWeather([day(16, 9, 9), ...mild.slice(1)]).id, 'rain');
  // two wet days (≥1mm) is a rain week even if the total is modest
  assert.equal(climateFromWeather([day(15, 8, 1.2), day(16, 9, 1.0), day(17, 10, 0), day(15, 9, 0.3), day(16, 8, 0)]).id, 'rain');
  // rain outranks heat: a wet hot week is still a wet week
  assert.equal(climateFromWeather([day(31, 22, 4), day(30, 21, 5), day(29, 20, 0), day(30, 21, 0), day(31, 22, 0)]).id, 'rain');
  // a 28°+ peak without the rain is a heatwave
  assert.equal(climateFromWeather([day(24, 15, 0), day(29, 18, 0), day(26, 16, 0.4), day(25, 15, 0), day(27, 17, 0)]).id, 'heat');
  // a week whose days average 10° or under is crisp (Bergen-shaped: 8.7° mean)
  assert.equal(climateFromWeather([day(7, 1, 0), day(9, 2, 0.2), day(6, 0, 0), day(8, 1, 0), day(9, 3, 0.3)]).id, 'crisp');
  assert.equal(climateFromWeather([day(9.2, 4, 0), day(9.6, 5, 0), day(9.9, 4, 0), day(7.3, 2, 0), day(7.3, 2, 0)]).id, 'crisp');
  // a mild-cool week just above the line stays fair
  assert.equal(climateFromWeather([day(12, 6, 0), day(11, 5, 0), day(12, 6, 0.3), day(10, 5, 0), day(11, 6, 0)]).id, 'fair');
  // otherwise, fair
  assert.equal(climateFromWeather(mild).id, 'fair');
  // guards
  assert.equal(climateFromWeather(null), null);
  assert.equal(climateFromWeather([day(20, 10, 0), day(21, 11, 0)]), null, 'under three usable days is not a week');
});

test('parseGeocode / parseForecast are defensive', () => {
  const geo = parseGeocode(JSON.stringify({ results: [{ name: 'Lisbon', latitude: 38.72, longitude: -9.14, country: 'Portugal' }] }));
  assert.deepEqual(geo, { name: 'Lisbon', lat: 38.72, lon: -9.14, country: 'Portugal' });
  assert.equal(parseGeocode(JSON.stringify({ results: [] })), null);
  assert.equal(parseGeocode('<html>bot wall</html>'), null);
  const fc = parseForecast(JSON.stringify({ daily: {
    time: ['2025-11-03', '2025-11-04', '2025-11-05', '2025-11-06', '2025-11-07', '2025-11-08'],
    temperature_2m_max: [18, 20, null, 21, 19, 18],
    temperature_2m_min: [11, 12, null, 13, 11, 10],
    precipitation_sum: [0, 0.2, null, 0, 0.4, 0],
  } }));
  assert.equal(fc.length, 5, 'rows with missing values drop out, capped at the campaign week');
  assert.ok(fc.length <= FORECAST_DAYS);
  assert.equal(fc[0].tmax, 18);
  assert.equal(parseForecast(JSON.stringify({ daily: { time: ['a', 'b'], temperature_2m_max: [1, 2], temperature_2m_min: [0, 0], precipitation_sum: [0, 0] } })), null);
  assert.equal(parseForecast('nonsense'), null);
});

test('fetchCityWeather geocodes then forecasts, all-or-nothing', async () => {
  const geoBody = JSON.stringify({ results: [{ name: 'Lisbon', latitude: 38.7, longitude: -9.1, country: 'Portugal' }] });
  const fcBody = JSON.stringify({ daily: {
    time: ['d1', 'd2', 'd3', 'd4', 'd5'],
    temperature_2m_max: [19, 20, 21, 20, 19],
    temperature_2m_min: [12, 12, 13, 12, 11],
    precipitation_sum: [0, 0.4, 0, 0, 0.2],
  } });
  const calls = [];
  const ok = async (url) => { calls.push(url); return { ok: true, text: async () => (url.includes('geocoding') ? geoBody : fcBody) }; };
  const snap = await fetchCityWeather('lisbon', { fetchImpl: ok });
  assert.equal(snap.source, 'live');
  assert.equal(snap.city, 'Lisbon');
  assert.equal(snap.days.length, 5);
  assert.ok(calls[1].includes('latitude=38.7'), 'the forecast queries the geocoded point');
  assert.equal(climateFromWeather(snap.days).id, 'fair');
  // no city → nothing to look up (seed-only campaigns stay seeded)
  assert.equal(await fetchCityWeather('', { fetchImpl: ok }), null);
  // geocode miss → null
  assert.equal(await fetchCityWeather('nowhere', { fetchImpl: async () => ({ ok: true, text: async () => '{"results":[]}' }) }), null);
  // forecast failure → null
  assert.equal(await fetchCityWeather('lisbon', {
    fetchImpl: async (url) => url.includes('geocoding') ? { ok: true, text: async () => geoBody } : { ok: false, text: async () => '' },
  }), null);
  // hard network failure → null
  assert.equal(await fetchCityWeather('lisbon', { fetchImpl: async () => { throw new Error('net'); } }), null);
});

test('the cache round-trips, rejects stale/corrupt, and honours the TTL', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.equal(loadCachedWeather(storage), null);
  const now = Date.now();
  const snap = { city: 'Lisbon', lat: 38.7, lon: -9.1, days: mild, ts: now, source: 'live' };
  cacheWeather(storage, snap);
  assert.deepEqual(loadCachedWeather(storage).days, mild);
  assert.equal(cacheFresh(storage, now + 1000), true);
  assert.equal(cacheFresh(storage, now + WEATHER_TTL_MS + 1000), false, 'a forecast goes stale fast');
  store.set('grunds.weather', '{corrupt');
  assert.equal(loadCachedWeather(storage), null);
  assert.equal(cacheFresh(storage, now), false);
  // a cached synthetic-shaped entry never counts as live
  cacheWeather(storage, { ...snap, source: 'synthetic' });
  assert.equal(loadCachedWeather(storage), null);
});

test('a live anchor is deterministic and seed-independent', () => {
  const rainy = { source: 'live', days: [day(14, 8, 6), day(15, 9, 4), day(16, 10, 0), day(15, 9, 1), day(14, 8, 0)], ts: 1 };
  const a = resolveClimate(rainy, () => pickClimate(1, 'x'));
  const b = resolveClimate(rainy, () => pickClimate(99999, 'y'));
  assert.equal(a.id, 'rain');
  assert.equal(a.id, b.id, 'the real sky decides; the seeded fallback never runs');
  assert.equal(a, CLIMATES.rain, 'the envelope object itself comes off the classic table');
});
