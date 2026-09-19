// Headless test for the Generative District boot (web/js/districtGen.js).
// Proves the completeness escape hatch: the district NEVER reaches the
// network when it can't be trusted to, so a bad key / flaky net / offline
// demo still plays the procedural street.
//   1. districtOptOut matches ?classicDistrict / ?noDistrict / ?nogen and
//      combinations; rejects empty, unrelated params, and hostnames.
//   2. initDistrictGen({classic:true}) is a hard no-op (live=false, placed=0)
//      and fetch is NEVER called.
//   3. __headless / __noGLB short-circuit before any base lookup.
//   4. a live-looking boot with no Convex base URL falls back (no fetch).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- minimal DOM / network stubs ----------------------------------------------
function el() {
  return { style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
    appendChild(){}, append(){}, addEventListener(){}, click(){} };
}
globalThis.document = { getElementById: () => el(), createElement: () => el(), createElementNS: () => el(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.location = { search: '', hostname: 'localhost', origin: 'http://localhost' };

let fetchCalls = 0;
globalThis.fetch = () => { fetchCalls++; return Promise.reject(new Error('network must not be touched in these paths')); };

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

// ============================================================
// 1) districtOptOut — the pure gate
// ============================================================
globalThis.__headless = false; globalThis.__noGLB = false;
const { districtOptOut, initDistrictGen, SLOTS } = await import('../js/districtGen.js');

check('matches ?classicDistrict', districtOptOut('?classicDistrict') === true, 'not matched');
check('matches ?noDistrict', districtOptOut('?seed=7&noDistrict') === true, 'not matched');
check('matches ?nogen=1', districtOptOut('?nogen=1') === true, 'not matched');
check('matches mid-string &classicDistrict&', districtOptOut('?a=1&classicDistrict&seed=7') === true, 'not matched');
check('rejects empty search', districtOptOut('') === false, 'false positive');
check('rejects ?seed=7', districtOptOut('?seed=7') === false, 'false positive');
check('rejects partial word (noclassicDistrictish)', districtOptOut('?xclassicDistrictish=1') === false, 'false positive');
check('rejects null/undefined', districtOptOut(undefined) === false, 'false positive');

// ============================================================
// 2) classic:true is a hard no-op, never a fetch
// ============================================================
const scene = { add(){} };
fetchCalls = 0;
const stClassic = initDistrictGen({ scene, seed: 7, classic: true });
check('classic state.live is false', stClassic.live === false, `live=${stClassic.live}`);
check('classic state.placed is 0', stClassic.placed === 0, `placed=${stClassic.placed}`);
check('classic flag recorded', stClassic.classic === true, 'classic not set');
check('classic made NO network call', fetchCalls === 0, `fetch called ${fetchCalls}x`);
check('classic exposes no grown machinery', stClassic.grown === undefined && stClassic.grownSlots === undefined, 'onGrown leaked into classic');

// ============================================================
// 3) headless / noGLB short-circuit
// ============================================================
globalThis.__headless = true;
fetchCalls = 0;
const stHead = initDistrictGen({ scene, seed: 7 });
check('headless no-ops (live false, no fetch)', stHead.live === false && fetchCalls === 0, `live=${stHead.live} fetch=${fetchCalls}`);
globalThis.__headless = false;
globalThis.__noGLB = true;
fetchCalls = 0;
const stNoGlb = initDistrictGen({ scene, seed: 7 });
check('__noGLB no-ops (live false, no fetch)', stNoGlb.live === false && fetchCalls === 0, `live=${stNoGlb.live} fetch=${fetchCalls}`);
globalThis.__noGLB = false;

// ============================================================
// 4) live-looking boot with no Convex base → procedural fallback, no fetch
// ============================================================
globalThis.location = { search: '?nogen', hostname: 'localhost', origin: 'http://localhost' };
// baseUrl() reads ?convex (absent) + convex.site host (absent) + localStorage (unset) → null
fetchCalls = 0;
const stNoBase = initDistrictGen({ scene, seed: 7, classic: false });
check('no-base boot falls back (live false)', stNoBase.live === false, `live=${stNoBase.live}`);
check('no-base boot made no fetch', fetchCalls === 0, `fetch called ${fetchCalls}x`);

// ============================================================
// 5) slot table integrity (placement contract)
// ============================================================
check('five street slots', Object.keys(SLOTS).length === 5, Object.keys(SLOTS).join(','));
check('every slot has position + height',
  Object.values(SLOTS).every(s => Array.isArray(s.position) && s.position.length === 3 && typeof s.height === 'number'),
  'a slot is missing position/height');

// ============================================================
// 6) regression: main.js actually threads classic through
// ============================================================
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('main.js imports districtOptOut', /districtOptOut/.test(mainSrc), 'not imported');
check('main.js passes classic: districtOptOut(location.search)',
  /initDistrictGen\(\{[^}]*classic:\s*districtOptOut\(location\.search\)/.test(mainSrc), 'call site not gated');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — Generative District: classic opt-out, headless/no-GL/no-base all fall back without a network call');
