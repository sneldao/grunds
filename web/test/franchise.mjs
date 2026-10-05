// Headless test for the Franchise (web/js/franchise.js + main.js wiring +
// convex/franchise.ts). The player's words — or a pasted photo link — become
// Tripo-grown stands on The Row, one per vacant lot. This pins the contract
// both ends hold to:
//   1. Three lots, unlocking days 3/4/5, mirrored between config.js and
//      convex/franchise.ts FRANCHISE_LOTS.
//   2. sanitizeFranchisePrompt keeps real descriptions, rejects junk;
//      isImageInput routes a pasted URL to image-to-model.
//   3. franchiseSpec is deterministic per (seed, lot, prompt); the key
//      contract is franchiseKey == assetKey(franchiseSpec).
//   4. Client: dead-mode never fetches; poll places each built lot;
//      rentDue sums across stands; describe POSTs lot + day + prompt;
//      nextVacant offers the first unlocked unbuilt lot; inherited()
//      spots stands this client didn't describe.
//   5. main.js wiring: brief line via nextVacant, dawn rent, receipt row.
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
const convexTripo = readFileSync(join(ROOT, 'convex/tripo.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'convex/schema.ts'), 'utf8');

// ============================================================
// 1) the lot table — mirrored client/server, pinned both ends
// ============================================================
check('three buildable lots', FRANCHISE.lots.length === 3, `lots=${FRANCHISE.lots.length}`);
check('lot ids are 14, 11, 18', FRANCHISE.lots.map(l => l.id).join(',') === '14,11,18', FRANCHISE.lots.map(l => l.id).join(','));
check('lots unlock days 3, 4, 5', FRANCHISE.lots.map(l => l.unlockDay).join(',') === '3,4,5', FRANCHISE.lots.map(l => l.unlockDay).join(','));
check('every lot pays a positive rent', FRANCHISE.lots.every(l => l.rent > 0 && l.rent <= 100));
check('every lot is across the road (z > 14)', FRANCHISE.lots.every(l => l.position[2] > 14), FRANCHISE.lots.map(l => l.position[2]).join(','));
check('every lot faces the café (rotationY = π)', FRANCHISE.lots.every(l => Math.abs(l.rotationY - Math.PI) < 1e-9));
check('lots are spaced apart', new Set(FRANCHISE.lots.map(l => l.position[0])).size === 3, 'duplicate x position');
check('storefront height beats pavement props', FRANCHISE.height > 2.5, `h=${FRANCHISE.height}`);
check('prompt cap is sane', FRANCHISE.promptMax >= 120 && FRANCHISE.promptMax <= 300, `max=${FRANCHISE.promptMax}`);

// The server keeps its own copy (Convex can't import client config) —
// pin parity so the two tables can never silently diverge.
for (const l of FRANCHISE.lots) {
  check(`server lot table mirrors ${l.id} (unlock ${l.unlockDay}, rent ${l.rent})`,
    new RegExp(`lot: "${l.id}"[\\s\\S]{0,120}unlockDay: ${l.unlockDay}, rent: ${l.rent}`).test(convexFr),
    `no matching row in FRANCHISE_LOTS`);
}

// ============================================================
// 2) client module — dead mode never fetches, methods always exist
// ============================================================
fetchCalls = [];
const dead = initFranchise({ scene: null, seed: 7, classic: false });
check('dead init returns state', dead && dead.lots && typeof dead.lots === 'object');
check('dead refresh is callable', typeof dead.refresh === 'function' && (dead.refresh(3), true));
check('dead rentDue pays nothing', dead.rentDue(5) === 0, `rentDue=${dead.rentDue(5)}`);
check('dead nextVacant offers lot 14 on day 3', dead.nextVacant(3)?.id === '14', JSON.stringify(dead.nextVacant(3)));
check('dead nextVacant is null before day 3', dead.nextVacant(2) === null);
check('dead inherited is null', dead.inherited() === null);
check('dead describe is callable', typeof dead.describe === 'function');
const dRes = await dead.describe('14', 'a tiny ramen counter', 3);
check('dead describe returns error status', dRes.status === 'error', `status=${dRes.status}`);
check('dead mode made zero fetches', fetchCalls.length === 0, `calls=${fetchCalls.length}`);

globalThis.__headless = true;
fetchCalls = [];
const hl = initFranchise({ scene: { add(){} }, seed: 7, classic: false });
check('headless init is dead', hl.lots && fetchCalls.length === 0, `calls=${fetchCalls.length}`);
globalThis.__headless = false;

// nextVacant walks the terrace in order
check('day 3 offers 14 only', dead.nextVacant(3)?.id === '14');
dead.lots['14'] = { status: 'success', placed: true, placedDay: 3, prompt: 'x', describedDay: 3, mine: true };
check('day 4 skips built 14, offers 11', dead.nextVacant(4)?.id === '11');
check('day 3 never offers 11 early (locked)', dead.nextVacant(3)?.id === '14' || dead.nextVacant(3) === null);
dead.lots['11'] = { status: 'processing', placed: false, placedDay: 0, prompt: 'x', describedDay: 4, mine: true };
check('day 4 skips processing 11, offers 18? no — 18 still locked', dead.nextVacant(4) === null, JSON.stringify(dead.nextVacant(4)));
check('day 5 offers 18 once 11 is building', dead.nextVacant(5)?.id === '18');

// ============================================================
// 3) live-mode poll: built lots place, rent sums, inherited detects
// ============================================================
// baseUrl() reads localStorage['grunds.convexUrl'] when off convex.site —
// seed it so the module goes live against the stubbed fetch.
store.set('grunds.convexUrl', 'http://test-bridge');
const placedInsts = [];
const scene = { add(i){ placedInsts.push(i); } };
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
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '14', status: 'success', prompt: 'a tiny ramen counter', day: 3, modelUrl: 'https://x/14.glb', previewUrl: null },
  { lot: '11', status: 'success', prompt: 'a vinyl cafe', day: 4, modelUrl: 'https://x/11.glb', previewUrl: null },
] }) });
fetchCalls = [];
const live = initFranchise({ scene, seed: 42, classic: false, loader });
await new Promise(r => setTimeout(r, 60));
check('poll fetched franchise status', fetchCalls.some(u => String(u).includes('/franchise/status?seed=42')), JSON.stringify(fetchCalls));
check('both built lots landed', live.lots['14'].status === 'success' && live.lots['11'].status === 'success', JSON.stringify(live.lots));
check('two GLBs were placed in the scene', placedInsts.length === 2, `placed=${placedInsts.length}`);
check('prompt remembered per lot', live.lots['14'].prompt === 'a tiny ramen counter' && live.lots['11'].prompt === 'a vinyl cafe');

// rent timing: arrival during day N pays from dawn N+1, summed across lots
live.day = 4; live.lots['14'].placedDay = 3; live.lots['11'].placedDay = 4;
const rent14 = FRANCHISE.lots.find(l => l.id === '14').rent;
const rent11 = FRANCHISE.lots.find(l => l.id === '11').rent;
check('day 4: 14 pays, 11 (arrived today) does not', live.rentDue(4) === rent14, `rentDue(4)=${live.rentDue(4)}`);
check('day 5: both stands pay', live.rentDue(5) === rent14 + rent11, `rentDue(5)=${live.rentDue(5)}`);
check('no rent before the stand exists', (live.lots['14'].placedDay = 4, live.rentDue(3) === 0), `rentDue(3)=${live.rentDue(3)}`);

// the gift: stands this client didn't describe are "inherited"
check('inherited() spots a stand we never described', live.inherited()?.id === '14', JSON.stringify(live.inherited()));
live.lots['14'].mine = true;
check('inherited() skips our own builds', live.inherited()?.id === '11');

// ============================================================
// 4) describe POSTs the right route with lot + day + encoded prompt
// ============================================================
fetchCalls = [];
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'processing', prompt: 'a vinyl cafe' }) });
const d2 = await live.describe('18', 'a vinyl cafe', 5);
check('describe POSTs describe route', fetchCalls.some(u => String(u).includes('/franchise/describe?seed=42')), JSON.stringify(fetchCalls));
check('describe passes the lot', fetchCalls.some(u => String(u).includes('lot=18')), JSON.stringify(fetchCalls));
check('describe passes the day', fetchCalls.some(u => String(u).includes('day=5')), JSON.stringify(fetchCalls));
check('describe encodes the prompt', fetchCalls.some(u => String(u).includes('prompt=a%20vinyl%20cafe')), JSON.stringify(fetchCalls));
check('describe records processing on the lot', d2.status === 'processing' && live.lots['18'].status === 'processing', `status=${live.lots['18'].status}`);

// ============================================================
// 5) convex backend — sanitize, spec, key contract, image mode, routes
// ============================================================
check('schema: franchises table exists', /franchises: defineTable\(/.test(schema));
check('schema: by_seed index', schema.includes('.index("by_seed", ["seed"])'));
check('schema: lot column present', schema.includes('lot: v.optional(v.string())'));

check('sanitize rejects <3 real words', /words\.length >= 3 \? clean : null/.test(convexFr));
check('sanitize caps at FRANCHISE_PROMPT_MAX', convexFr.includes('.slice(0, FRANCHISE_PROMPT_MAX)'));
check('spec: prompt wraps player words + house frame', convexFr.includes('`${prompt}${FRANCHISE_FRAME}`'));
check('spec: lot salts the deterministic seeds', /hashKey\(`\$\{seed\}:\$\{lot\}:\$\{prompt\}`\)/.test(convexFr));
check('franchiseKey equals the assetKey tripo.generate writes', /return assetKey\(franchiseSpec\(seed, lot, prompt\)\)/.test(convexFr));
check('describe validates the lot', convexFr.includes('no such lot on The Row'));
check('describe gates on the unlock day', /args\.day < def\.unlockDay/.test(convexFr));
check('describe is idempotent per (seed,lot)', /existing\.lots\.find\(\(l\) => l\.lot === args\.lot\)/.test(convexFr));
check('status query returns a lots array', /Promise<\{ lots: LotStatus\[\] \}>/.test(convexFr));
check('status back-fills pre-multi-lot rows to lot 14', convexFr.includes('fr.lot ?? "14"'));

// photo → model: the same input serves image URLs
check('isImageInput detects pasted links', /isImageInput[\s\S]{0,80}https\?:/.test(convexFr));
check('sanitize accepts photo links (URLs skip the word count)', convexFr.includes('if (isImageInput(clean)) return clean;'));
check('image specs carry imageUrl', /if \(isImageInput\(prompt\)\) spec\.imageUrl = prompt/.test(convexFr));
check('generate args accept imageUrl', /imageUrl: v\.optional\(v\.string\(\)\)/.test(convexTripo));
check('image tasks hit the image-to-model endpoint', convexTripo.includes('image-to-model'));
check('image tasks post file {type,url}', /file: \{[\s\S]{0,400}url: spec\.imageUrl/.test(convexTripo));
check('imageUrl is content-addressed in assetKey', convexTripo.includes('spec.imageUrl ?? ""'));

check('http: /franchise/status GET route', http.includes('path: "/franchise/status"') && http.includes('method: "GET"'));
check('http: /franchise/describe POST route', http.includes('path: "/franchise/describe"') && http.includes('method: "POST"'));
check('http: describe is POST-only', /franchiseDescribe[\s\S]{0,200}POST only/.test(http));
check('http: describe passes the lot param', /p\.get\("lot"\)/.test(http));

// ============================================================
// 6) main.js wiring
// ============================================================
check('initFranchise called with scene + seed', /initFranchise\(\{[\s\S]*scene, seed: SEED/.test(main));
check('arrival toast names the lot', main.includes('${def.name} is open'));
check('dawn refresh in prepareDay', /franchise\.refresh\(d\)/.test(main));
check('rent applied at open', /const fr = franchise\.rentDue\(d\); if \(fr\) \{ till \+= fr/.test(main));
check('receipt carries the rent row', main.includes("'The Row · stand rent'"));
check('brief line offers the next vacant lot', main.includes('franchise.nextVacant(day)'));
check('brief line POSTs describe with the lot id', main.includes('franchise.describe(vacant.id, input.value, day)'));
check('brief line accepts photo links', main.includes('photo link'));
check('inherited stands get their own line', main.includes('spoken for') && main.includes('previous owner'));
check('franchiseRentToday reset per dawn + campaign', (main.match(/franchiseRentToday = 0/g) || []).length >= 2);
check('franchise exported for headless tests', /\n  franchise,\n/.test(main));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — the franchise: three buildable lots · words or photos → Tripo-grown stands → dawn rent · the street remembers');
process.exit(fails.length ? 1 : 0);
