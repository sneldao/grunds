// web/js/weatherSnapshot.js — attention-street pillar 4, second seam:
// real weather → the climate envelope.
//
// Same contract as marketSnapshot.js: a SNAPSHOT, never a feed. A campaign
// resolves its weather synchronously from a cached live forecast or falls back
// to the seeded pickClimate — play never blocks on the network and the week
// in progress never drifts (a background refresh feeds the NEXT campaign).
// City campaigns (?city=lisbon) are the anchorable ones: the forecast is for
// that city's real sky. A seed-only campaign has no place to look up, so it
// stays seeded — bit-identical, exactly as before.
//
// Source: Open-Meteo (geocoding + daily forecast) — free, keyless,
// CORS-open. The climate envelope restyles the street scene only (density,
// cadence, sky, rain); no sim draws ride it, so a live anchor can never
// touch the till.
import { CLIMATES } from './climates.js';

export const WEATHER_KEY = 'grunds.weather';
export const WEATHER_TTL_MS = 12 * 3600 * 1000;   // a forecast goes stale fast
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 5;                    // a campaign is five days

// ---- parsers (pure, fixture-tested) ---------------------------------------
// Geocode reply: {results:[{name, latitude, longitude, country, …}]}.
export function parseGeocode(text) {
  try {
    const r = JSON.parse(text)?.results?.[0];
    if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
      return { name: r.name || null, lat: r.latitude, lon: r.longitude, country: r.country || null };
    }
  } catch {}
  return null;
}
// Daily forecast reply: {daily:{time:[], temperature_2m_max:[], …}}.
// Rows with any missing value drop out; we need at least three usable days
// to call it a week.
export function parseForecast(text) {
  try {
    const d = JSON.parse(text)?.daily;
    if (!d || !Array.isArray(d.time)) return null;
    const days = [];
    for (let i = 0; i < d.time.length; i++) {
      const tmax = d.temperature_2m_max?.[i];
      const tmin = d.temperature_2m_min?.[i];
      const precip = d.precipitation_sum?.[i];
      if (Number.isFinite(tmax) && Number.isFinite(tmin) && Number.isFinite(precip)) {
        days.push({ tmax, tmin, precip: Math.max(0, precip) });
      }
    }
    return days.length >= 3 ? days.slice(0, FORECAST_DAYS) : null;
  } catch {}
  return null;
}

// ---- the live mapping ------------------------------------------------------
// Real week → envelope. Weather is flavour, not a tax, but the mapping is
// honest: two wet days or a soaking total is a rain week; a 28°+ peak is a
// heatwave; a week whose days average 10° or under is crisp; otherwise fair.
// Pure and deterministic — the same forecast always yields the same sky.
export function climateFromWeather(days) {
  if (!Array.isArray(days) || days.length < 3) return null;
  const totalPrecip = days.reduce((s, d) => s + (d.precip || 0), 0);
  const rainDays = days.filter(d => (d.precip || 0) >= 1).length;
  const peakTmax = Math.max(...days.map(d => d.tmax));
  const meanTmax = days.reduce((s, d) => s + d.tmax, 0) / days.length;
  if (totalPrecip >= 8 || rainDays >= 2) return CLIMATES.rain;
  if (peakTmax >= 28) return CLIMATES.heat;
  if (meanTmax <= 10) return CLIMATES.crisp;
  return CLIMATES.fair;
}

// ---- fetch (best-effort, all-or-nothing, never throws) ---------------------
export async function fetchCityWeather(cityName, opts = {}) {
  if (!cityName) return null;
  const { timeoutMs = 6000, fetchImpl, days = FORECAST_DAYS } = opts;
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
  const place = parseGeocode(await get(
    `${GEOCODE_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`));
  if (!place) return null;
  const fc = parseForecast(await get(
    `${FORECAST_URL}?latitude=${place.lat}&longitude=${place.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&forecast_days=${days}&timezone=auto`));
  if (!fc) return null;
  return {
    city: place.name || cityName, country: place.country,
    lat: place.lat, lon: place.lon,
    days: fc, ts: Date.now(), source: 'live',
  };
}

// ---- cache (storage-agnostic; localStorage in the browser) ----------------
export function cacheWeather(storage, snap) {
  try { storage.setItem(WEATHER_KEY, JSON.stringify(snap)); } catch {}
}
export function loadCachedWeather(storage) {
  try {
    const j = JSON.parse(storage.getItem(WEATHER_KEY) || 'null');
    if (j && j.source === 'live' && Array.isArray(j.days) && j.days.length >= 3 &&
        Number.isFinite(j.ts) && climateFromWeather(j.days)) {
      return j;
    }
  } catch {}
  return null;
}
export function cacheFresh(storage, now = Date.now()) {
  const c = loadCachedWeather(storage);
  return !!(c && now - c.ts < WEATHER_TTL_MS);
}

// ---- resolution -------------------------------------------------------------
// The one rule of the pillar: a cached live snapshot or the seeded classic.
// resolveClimate never returns null — null weather falls through to
// pickClimate, which is the bit-identical path every save predating anchors
// (and every harness run) already walks.
export function resolveClimate(weatherSnap, pickSeeded) {
  const live = weatherSnap && weatherSnap.source === 'live'
    ? climateFromWeather(weatherSnap.days) : null;
  return live || pickSeeded();
}
