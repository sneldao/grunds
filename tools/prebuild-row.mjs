#!/usr/bin/env node
// prebuild-row.mjs — grow a showcase street for the hackathon demo.
// POSTs /franchise/describe for each (lot, prompt) against a seed; stands
// are content-addressed and cached forever, so once built they are free
// for every later player — including every judge who opens the seed.
//
// Usage:
//   node tools/prebuild-row.mjs [seed] [baseUrl]
//   node tools/prebuild-row.mjs 42 https://striped-anaconda-746.convex.site
//
// Env: GRUNDS_BASE overrides the default deployment.
const SEED = Number(process.argv[2] || 42);
const BASE = (process.argv[3] || process.env.GRUNDS_BASE || 'https://striped-anaconda-746.convex.site').replace(/\/$/, '');

// One stand per lot, chosen to show the range: a late-night pull, a
// creative third place, a commuter grab-and-go — each exercises a
// different spec archetype on the floor.
const BUILDS = [
  { lot: 'pitch', prompt: 'a tiny late-night ramen counter', day: 1, purpose: null },
  { lot: '14', prompt: 'a vinyl listening bar with natural wine', day: 3, purpose: 'community' },
  { lot: '11', prompt: 'a commuter sandwich kiosk', day: 4, purpose: 'draw' },
  { lot: '18', prompt: 'a neon night market stall', day: 5, purpose: 'rent' },
];

for (const b of BUILDS) {
  const url = `${BASE}/franchise/describe?seed=${SEED}&lot=${encodeURIComponent(b.lot)}` +
    `&day=${b.day}&prompt=${encodeURIComponent(b.prompt)}` +
    (b.purpose ? `&purpose=${b.purpose}` : '');
  try {
    const r = await fetch(url, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    console.log(`${b.lot.padEnd(6)} ${d.status ?? r.status}  ${b.prompt}${d.standName ? `  →  ${d.standName}` : ''}${d.error ? `  (${d.error})` : ''}`);
  } catch (e) {
    console.log(`${b.lot.padEnd(6)} ERROR  ${e.message}`);
  }
}
console.log(`\nShowcase street: ?seed=${SEED} — stands land as Tripo finishes (~2 min each; poll /franchise/status?seed=${SEED})`);
