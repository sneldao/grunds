// city.js — City Remix mode: ?city=<name> makes any place on Earth a
// shareable Grunds street (SandBase AI City Remix).
//
// A city IS a seed: the name hashes to the campaign seed, so every sim
// stream — market deck, walk-ins, district kit — stays deterministic and a
// "Lisbon" link replays the same street on every machine. On top of that,
// a cached Convex locality pack (M3.1 flash via SandBase, /city/pack)
// supplies the relatable dressing: real café names, currency, a landmark.
// Everything is fire-and-forget — no pack, no Convex, offline: the street
// still plays, it just speaks generic "district".

import { baseUrl } from './convexSync.js';

// The street's money — default £ at face value, repainted by the pack's
// currency + quoted matcha price when a city lands. `rate` scales every
// displayed amount so the house matcha (£4.80 base) reads as the local
// price the licence quotes; the sim's GBP numbers never move. `dp` drops
// to 0 for high-magnitude currencies (¥4,000, not ¥4,000.00). Read live by
// fmt everywhere money shows, so the flip lands mid-week.
export const MONEY = { symbol: '£', rate: 1, dp: 2 };
export function setMoneySymbol(sym) {
  if (typeof sym === 'string' && sym.trim() && sym.trim().length <= 3) MONEY.symbol = sym.trim();
}
export function setMoneyRate(localPrice, matchaGbp) {
  const p = Number(localPrice), base = Number(matchaGbp);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(base) || base <= 0) {
    MONEY.rate = 1; MONEY.dp = 2; return;
  }
  MONEY.rate = Math.min(Math.max(p / base, 0.01), 100000);
  MONEY.dp = MONEY.rate >= 20 ? 0 : 2;
}
// The one money formatter: symbol + grouped local amount. Negative reads
// `£-37.00` — the sign stays after the symbol, as the till always had it.
export function fmt(n, dp = MONEY.dp, grouped = false) {
  const v = (Number(n) || 0) * MONEY.rate;
  let s = Math.abs(v).toFixed(dp);
  if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return MONEY.symbol + (v < 0 ? '-' : '') + s;
}

// fnv-1a 32-bit — same string → same seed, every machine, no tables.
export function citySeed(name) {
  let h = 0x811c9dc5;
  const s = name.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 4294967295) + 1;
}

// One canonical form per city: lowercase. 'Lisbon' and 'lisbon' must grow
// the same street — the name flows into kit prompts server-side, and mixed
// case would key two kits for one city.
export function normalizeCityName(raw) {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
}

// Parse ?city= from a location.search string. Returns { name, seed } or
// null. ?seed stays authoritative when both are present — the caller checks
// that first, so this helper ignores it entirely.
export function cityFromSearch(search) {
  const name = normalizeCityName(new URLSearchParams(search || '').get('city'));
  return name ? { name, seed: citySeed(name) } : null;
}

// The shareable "lit city" URL: ?city= carries the seed implicitly, so the
// link drops ?seed to keep one canonical form per city.
export function cityUrl(name, href) {
  const u = new URL(href || location.href);
  u.searchParams.delete('seed');
  u.searchParams.set('city', normalizeCityName(name));
  return u.toString();
}

// Title-case fallback for display before the pack lands ("são paulo" →
// "São Paulo"). The pack's `display` ("São Paulo, Brazil") wins once it does.
export function cityDisplay(name) {
  // \w is ASCII-only — 'ã' would count as a boundary and produce 'SãO'.
  // Capitalize the first non-space char of each space-separated word instead.
  return name.replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase());
}

// Fire-and-forget pack fetch. Returns the server pack or null — callers
// treat null as "generic district".
export async function fetchCityPack(name) {
  const base = (baseUrl() || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const r = await fetch(`${base}/city/pack?city=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d && typeof d === 'object' && d.city ? d : null;
  } catch {
    return null;
  }
}
