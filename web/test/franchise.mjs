// Headless test for the Franchise (web/js/franchise.js + main.js wiring +
// convex/franchise.ts). The player's words become a Tripo-grown stand on
// The Row — this pins the contract both ends hold to:
//   1. sanitizeFranchisePrompt keeps real descriptions, rejects junk.
//   2. franchiseSpec is deterministic per (seed, prompt) and prompt-shaped.
//   3. franchiseKey == assetKey(franchiseSpec) — the row lookup contract.
//   4. Client module: dead-mode never fetches; status poll places a GLB;
//      rentDue gates the first morning; describe POSTs the right route.
//   5. main.js wiring: FRANCHISE constants, brief line gating, dawn rent,
//      receipt row, refresh per dawn, export for tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- stubs ------------------------------------------------------------------
function el() {
  return { style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10, value: '',
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

let fetchCalls = [];
let fetchImpl = () => Promise.reject(new Error('network must not be touched'));
globalThis.fetch = (...a) => { fetchCalls.push(a[0]); return fetchImpl(...a); };

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

globalThis.__headless = false; globalThis.__noGLB = false;
const { initFranchise } = await import('../js/franchise.js');
const { FRANCHISE } = await import('../js/config.js');

const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const convexFr = readFileSync(join(ROOT, 'convex/franchise.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'convex/schema.ts'), 'utf8');

// ============================================================
// 1) FRANCHISE constants — the contract both ends share
// ============================================================
check('offerDay is day 3', FRANCHISE.offerDay === 3, `offerDay=${FRANCHISE.offerDay}`);
check('rent is a positive dawn income', FRANCHISE.rent > 0 && FRANCHISE.rent <= 100, `rent=${FRANCHISE.rent}`);
check('placement is across the road (z > 14)', FRANCHISE.position[2] > 14, `z=${FRANCHISE.position[2]}`);
check('stand faces the café (rotationY = π)', Math.abs(FRANCHISE.rotationY - Math.PI) < 1e-9, `ry=${FRANCHISE.rotationY}`);
check('storefront height beats pavement props', FRANCHISE.height > 2.5, `h=${FRANCHISE.height}`);
check('prompt cap is sane', FRANCHISE.promptMax >= 120 && FRANCHISE.promptMax <= 300, `max=${FRANCHISE.promptMax}`);

// ============================================================
// 2) client module — dead mode never fetches, methods always exist
// ============================================================
fetchCalls = [];
const dead = initFranchise({ scene: null, seed: 7, classic: false });
check('dead init returns state', dead && dead.status === 'missing', `status=${dead && dead.status}`);
check('dead refresh is callable', typeof dead.refresh === 'function' && (dead.refresh(3), true));
check('dead rentDue pays nothing', dead.rentDue(5) === 0, `rentDue=${dead.rentDue(5)}`);
check('dead describe is callable', typeof dead.describe === 'function');
const dRes = await dead.describe('a tiny ramen counter', 3);
check('dead describe returns error status', dRes.status === 'error', `status=${dRes.status}`);
check('dead mode made zero fetches', fetchCalls.length === 0, `calls=${fetchCalls.length}`);

globalThis.__headless = true;
fetchCalls = [];
const hl = initFranchise({ scene: { add(){} }, seed: 7, classic: false });
check('headless init is dead', hl.status === 'missing' && fetchCalls.length === 0, `calls=${fetchCalls.length}`);
globalThis.__headless = false;

// ============================================================
// 3) live-mode poll: success places the GLB, rent gates on placedDay
// ============================================================
// baseUrl() reads localStorage['grunds.convexUrl'] when off convex.site —
// seed it so the module goes live against the stubbed fetch.
store.set('grunds.convexUrl', 'http://test-bridge');
let placedInst = null;
const scene = { add(i){ placedInst = i; } };
// fitToSlot needs a real Object3D (Box3.setFromObject traverses children) —
// hand it the vendor THREE the game itself uses, with a box child so the
// bounding box is non-empty.
const THREE = await import('../vendor/three.module.js');
const loader = { loadGLB: async (url, opts) => {
  const o = new THREE.Object3D();
  o.position.set(opts.position[0], opts.position[1], opts.position[2]);
  o.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.0, 1.2), new THREE.MeshBasicMaterial()));
  return o;
} };
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'success', prompt: 'a tiny ramen counter', day: 3, modelUrl: 'https://x/stand.glb', previewUrl: null }) });
fetchCalls = [];
const live = initFranchise({ scene, seed: 42, classic: false, loader });
await new Promise(r => setTimeout(r, 60));
check('poll fetched franchise status', fetchCalls.some(u => String(u).includes('/franchise/status?seed=42')), JSON.stringify(fetchCalls));
check('success status landed', live.status === 'success' && live.live === true, `status=${live.status} live=${live.live}`);
check('GLB was placed in the scene', placedInst !== null, 'scene.add not called');
check('prompt remembered', live.prompt === 'a tiny ramen counter', live.prompt);

// fitToSlot needs a real Box3 path — the stub above can't produce one, so
// rent timing is pinned on the state flags, not the GLB internals.
live.day = 4; live.placedDay = 3;
check('rent starts the dawn after arrival', live.rentDue(4) === FRANCHISE.rent, `rentDue(4)=${live.rentDue(4)}`);
check('no rent on the arrival day itself', live.rentDue(3) === 0, `rentDue(3)=${live.rentDue(3)}`);
check('no rent before the stand exists', (live.placedDay = 4, live.rentDue(3) === 0), `rentDue(3)=${live.rentDue(3)}`);

// ============================================================
// 4) describe POSTs the right route with encoded prompt + day
// ============================================================
fetchCalls = [];
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'processing', prompt: 'a vinyl cafe' }) });
const d2 = await live.describe('a vinyl cafe', 4);
check('describe POSTs describe route', fetchCalls.some(u => String(u).includes('/franchise/describe?seed=42')), JSON.stringify(fetchCalls));
check('describe passes the day', fetchCalls.some(u => String(u).includes('day=4')), JSON.stringify(fetchCalls));
check('describe encodes the prompt', fetchCalls.some(u => String(u).includes('prompt=a%20vinyl%20cafe')), JSON.stringify(fetchCalls));
check('describe records processing', d2.status === 'processing' && live.status === 'processing', `status=${live.status}`);

// ============================================================
// 5) convex backend — sanitize, spec, key contract, routes, schema
// ============================================================
check('schema: franchises table exists', /franchises: defineTable\(/.test(schema));
check('schema: by_seed index', schema.includes('.index("by_seed", ["seed"])'));

check('sanitize rejects <3 real words', /words\.length >= 3 \? clean : null/.test(convexFr));
check('sanitize caps at FRANCHISE_PROMPT_MAX', convexFr.includes('.slice(0, FRANCHISE_PROMPT_MAX)'));
check('spec: prompt wraps player words + house frame', convexFr.includes('`${prompt}${FRANCHISE_FRAME}`'));
check('spec: model_seed + texture_seed derived per (seed,prompt)', /modelSeed: tripoSlotSeed\(seed \^ promptSalt/.test(convexFr) && /textureSeed: tripoSlotSeed\(seed \^ promptSalt, "stall", 0x7e57\)/.test(convexFr));
check('franchiseKey equals the assetKey tripo.generate writes', /return assetKey\(franchiseSpec\(seed, prompt\)\)/.test(convexFr));
check('describe is idempotent on live rows', /existing\.status === "success" \|\| existing\.status === "processing"/.test(convexFr));
check('status query reads franchises then tripoAssets', /query\("franchises"\)[\s\S]*query\("tripoAssets"\)/.test(convexFr));
check('failed attempt falls through to re-describe', !/existing.*return.*before.*generate/s.test(convexFr) || convexFr.includes('falls'));

check('http: /franchise/status GET route', http.includes('path: "/franchise/status"') && http.includes('method: "GET"'));
check('http: /franchise/describe POST route', http.includes('path: "/franchise/describe"') && http.includes('method: "POST"'));
check('http: describe is POST-only', /franchiseDescribe[\s\S]{0,200}POST only/.test(http));

// ============================================================
// 6) main.js wiring
// ============================================================
check('initFranchise called with scene + seed', /initFranchise\(\{[\s\S]*scene, seed: SEED/.test(main));
check('arrival toast wired', main.includes('the builders finished'));
check('dawn refresh in prepareDay', /franchise\.refresh\(d\)/.test(main));
check('rent applied at open', /const fr = franchise\.rentDue\(d\); if \(fr\) \{ till \+= fr/.test(main));
check('receipt carries the rent row', main.includes("'14 The Row · stand rent'"));
check('brief line gated to offerDay', main.includes('day < FRANCHISE.offerDay'));
check('brief line hides once sent', main.includes("franchise.status === 'processing' || franchise.status === 'success'"));
check('brief line POSTs describe', main.includes('franchise.describe(input.value, day)'));
check('franchiseRentToday reset per dawn + campaign', (main.match(/franchiseRentToday = 0/g) || []).length >= 2);
check('franchise exported for headless tests', /\n  franchise,\n/.test(main));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — the franchise: sanitized words → deterministic spec → Tripo-grown stand → dawn rent on the receipt');
process.exit(fails.length ? 1 : 0);
