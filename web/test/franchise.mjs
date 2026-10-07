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
const { initFranchise, morningFranchiseLines, FRANCHISE_POLL_MS, FRANCHISE_MAX_POLLS } = await import('../js/franchise.js');
const { FRANCHISE } = await import('../js/config.js');

const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const frJs = readFileSync(join(ROOT, 'web/js/franchise.js'), 'utf8');
const convexFr = readFileSync(join(ROOT, 'convex/franchise.ts'), 'utf8');
const convexTripo = readFileSync(join(ROOT, 'convex/tripo.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'convex/schema.ts'), 'utf8');
const idxHtml = readFileSync(join(ROOT, 'web/index.html'), 'utf8');

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
const dFx = dead.effectsDue(5);
check('dead effectsDue pays nothing', dFx.awareness === 0 && dFx.returnees === 0, JSON.stringify(dFx));

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
const placedInsts = [], removedInsts = [];
const scene = { add(i){ placedInsts.push(i); }, remove(i){ removedInsts.push(i); } };
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
let statusReads = 0;
const live = initFranchise({ scene, seed: 42, classic: false, loader, onStatus: () => { statusReads++; } });
await new Promise(r => setTimeout(r, 60));
check('poll fetched franchise status', fetchCalls.some(u => String(u).includes('/franchise/status?seed=42')), JSON.stringify(fetchCalls));
check('onStatus fired once the read landed', statusReads >= 1, `reads=${statusReads}`);
check('both built lots landed', live.lots['14'].status === 'success' && live.lots['11'].status === 'success', JSON.stringify(live.lots));
check('two GLBs were placed in the scene', placedInsts.filter(o => o.type !== 'Group').length === 2, `placed=${placedInsts.length}`);
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

// ---- purposes: draw +awareness, community +returnees, rent +bonus -----
// effect sizes live in config.js FRANCHISE.purposes so labels and ledger
// can't drift; legacy stands (purpose null) keep the plain £15 rent.
const P = FRANCHISE.purposes;
check('purpose ids mirror the backend list',
  JSON.stringify(Object.keys(P).sort()) === JSON.stringify(['community', 'draw', 'rent']));
live.day = 5;
live.lots['14'].purpose = null; live.lots['14'].placedDay = 3;
live.lots['11'].purpose = 'community'; live.lots['11'].placedDay = 4;
check('legacy purpose-less stand pays base rent', live.rentDue(5) === rent14 + rent11, `rentDue(5)=${live.rentDue(5)}`);
let fx = live.effectsDue(5);
check('community stand adds the config returnees', fx.returnees === P.community.returnees, JSON.stringify(fx));
check('community stand adds no awareness', fx.awareness === 0, JSON.stringify(fx));
check('arrival day earns nothing (14 arrived 3, close of 3)', live.effectsDue(3).returnees === 0);
live.lots['11'].purpose = 'draw';
fx = live.effectsDue(5);
check('draw stand adds the config awareness', Math.abs(fx.awareness - P.draw.awareness) < 1e-9, JSON.stringify(fx));
check('draw stand adds no returnees', fx.returnees === 0);
live.lots['11'].purpose = 'rent';
check('tenant stand pays the lease bonus over base', live.rentDue(5) === rent14 + rent11 + P.rent.rentBonus, `rentDue(5)=${live.rentDue(5)}`);
check('tenant uplift surfaces in effectsDue for the receipt split', live.effectsDue(5).rentBonus === P.rent.rentBonus);
live.lots['11'].placedDay = 5; // arrived today → not yet eligible
check('same-day arrival earns no bonus', live.effectsDue(5).returnees === 0 && live.rentDue(5) === rent14);
live.lots['11'].placedDay = 4;
check('unplaced stand earns no bonus', (live.lots['11'].placed = false, live.rentDue(5) === rent14));
live.lots['11'].placed = true;
// inherited stands still carry their purpose — the gift keeps its terms
check('inherited stand bonus counts (14 not ours, purpose set)', (live.lots['14'].purpose = 'rent', live.rentDue(5) === rent14 + P.rent.rentBonus + rent11 + P.rent.rentBonus));

// ============================================================
// 4) describe POSTs the right route with lot + day + encoded prompt
// ============================================================
fetchCalls = [];
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'processing', prompt: 'a vinyl cafe', purpose: 'draw', claimed: true }) });
const d2 = await live.describe('18', 'a vinyl cafe', 5, 'draw');
check('describe POSTs describe route', fetchCalls.some(u => String(u).includes('/franchise/describe?seed=42')), JSON.stringify(fetchCalls));
check('describe passes the lot', fetchCalls.some(u => String(u).includes('lot=18')), JSON.stringify(fetchCalls));
check('describe passes the day', fetchCalls.some(u => String(u).includes('day=5')), JSON.stringify(fetchCalls));
check('describe encodes the prompt', fetchCalls.some(u => String(u).includes('prompt=a%20vinyl%20cafe')), JSON.stringify(fetchCalls));
check('describe encodes the purpose', fetchCalls.some(u => String(u).includes('purpose=draw')), JSON.stringify(fetchCalls));
check('describe records processing on the lot', d2.status === 'processing' && live.lots['18'].status === 'processing', `status=${live.lots['18'].status}`);
check('describe retains the purpose on the lot', live.lots['18'].purpose === 'draw', `purpose=${live.lots['18'].purpose}`);
check('claimed describe marks the stand ours', live.lots['18'].mine === true);
check('worksite marker lands in the world on describe', !!live.lots['18'].marker && placedInsts.some(o => o.type === 'Group'), `marker=${!!live.lots['18'].marker}`);
check('marker sits on the described lot', live.lots['18'].marker.position.x === FRANCHISE.lots.find(l => l.id === '18').position[0]);
// old clients describe without a purpose — no purpose param sent
fetchCalls = [];
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'invalid', error: 'no' }) });
await live.describe('18', 'nope', 5);
check('purpose omitted when not given', !fetchCalls.some(u => String(u).includes('purpose=')), JSON.stringify(fetchCalls));
check('invalid verdict clears to retryable state', live.lots['18'].status === 'invalid');
check('failed describe drops the worksite', live.lots['18'].marker == null && removedInsts.length >= 1, `removed=${removedInsts.length}`);

// The race: we ask for purpose 'draw' but the server answers with the
// EXISTING claim — legacy null purpose, claimed:false. The client must
// take the server's word (null), not fabricate ours, and must not mark
// an already-claimed stand as ours.
live.lots['18'].mine = false;
live.lots['18'].placed = true; // already standing — don't re-place on success
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'success', purpose: null, claimed: false, modelUrl: 'https://x/18.glb' }) });
await live.describe('18', 'a book nook', 5, 'draw');
check('idempotent answer overrides requested purpose (null stays null)', live.lots['18'].purpose === null, `purpose=${live.lots['18'].purpose}`);
check('claimed:false does not mark the stand mine', live.lots['18'].mine === false);
// A retry by the same client (we claimed earlier) keeps mine=true.
live.lots['18'].mine = true;
await live.describe('18', 'a book nook', 5, 'draw');
check('retry preserves earlier authorship', live.lots['18'].mine === true);
// A status read is authoritative too: a stale local purpose clears.
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '14', status: 'success', prompt: 'a tiny ramen counter', day: 3, purpose: 'rent', modelUrl: 'https://x/14.glb', previewUrl: null },
  { lot: '18', status: 'success', prompt: 'a book nook', day: 5, purpose: null, modelUrl: 'https://x/18.glb', previewUrl: null },
] }) });
live.lots['18'].purpose = 'draw';          // stale local value the read must overwrite
live.lots['18'].placed = false; live.lots['18'].status = 'success';
live.refresh(5);
await new Promise(r => setTimeout(r, 60));
check('status poll overwrites stale local purpose with null', live.lots['18'].purpose === null, `purpose=${live.lots['18'].purpose}`);
check('status poll sets purpose from the server', live.lots['14'].purpose === 'rent', `purpose=${live.lots['14'].purpose}`);

// The worksite marker: a processing read scaffolds the lot in the world,
// exactly once across repeat polls; arrival or failure takes it down.
live.lots['18'].placed = false; live.lots['18'].status = 'processing';
const groupsBefore = placedInsts.filter(o => o.type === 'Group').length;
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '18', status: 'processing', prompt: 'a book nook', day: 5, purpose: null },
] }) });
live.refresh(5);
await new Promise(r => setTimeout(r, 60));
check('processing read stands a worksite in the world', placedInsts.filter(o => o.type === 'Group').length === groupsBefore + 1);
live.refresh(5);
await new Promise(r => setTimeout(r, 60));
check('repeat polls do not duplicate the worksite', placedInsts.filter(o => o.type === 'Group').length === groupsBefore + 1);
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '18', status: 'success', prompt: 'a book nook', day: 5, purpose: null, modelUrl: 'https://x/18.glb' },
] }) });
const removedBefore = removedInsts.length;
live.refresh(5);
await new Promise(r => setTimeout(r, 60));
check('the worksite comes down when the stand lands', removedInsts.length > removedBefore && !live.lots['18'].marker);

// A success read whose GLB fails to load keeps the worksite — the reveal
// hasn't happened yet, and the next poll retries. Removed only once a
// real stand lands.
const adds2 = [], removes2 = [];
const scene2 = { add(i){ adds2.push(i); }, remove(i){ removes2.push(i); } };
let loadFail = true;
const flakyLoader = { loadGLB: async (url, opts) => {
  if (loadFail) throw new Error('bad glb');
  const o = new THREE.Object3D();
  o.position.set(opts.position[0], opts.position[1], opts.position[2]);
  o.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.0, 1.2), new THREE.MeshBasicMaterial()));
  return o;
} };
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '14', status: 'processing', prompt: 'a noodle bar', day: 3, purpose: null },
] }) });
const live2 = initFranchise({ scene: scene2, seed: 43, classic: false, loader: flakyLoader });
await new Promise(r => setTimeout(r, 60));
check('processing lot scaffolds on a fresh read', !!live2.lots['14'].marker && adds2.filter(o => o.type === 'Group').length === 1);
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '14', status: 'success', prompt: 'a noodle bar', day: 3, purpose: null, modelUrl: 'https://x/f.glb' },
] }) });
live2.refresh(4);
await new Promise(r => setTimeout(r, 60));
check('worksite stays while the GLB fails', !!live2.lots['14'].marker, 'marker removed too early');
check('failed load places nothing', adds2.filter(o => o.type !== 'Group').length === 0);
loadFail = false;
live2.refresh(5);
await new Promise(r => setTimeout(r, 60));
check('worksite removed once the real GLB lands', !live2.lots['14'].marker && removes2.some(o => o.type === 'Group'));
check('stand placed exactly once after retry', adds2.filter(o => o.type !== 'Group').length === 1 && live2.lots['14'].placed);
check('no duplicate markers across the whole flow', adds2.filter(o => o.type === 'Group').length === 1);

// Arrival toasts only fire for transitions witnessed live — the first
// status read hydrates silently (an inherited street was always there,
// nothing "opened" today); a describe landing success still announces.
const scene3 = { add(){}, remove(){} };
let toasts3 = 0;
fetchImpl = async () => ({ ok: true, json: async () => ({ lots: [
  { lot: '14', status: 'success', prompt: 'a ramen counter', day: 3, purpose: null, modelUrl: 'https://x/a.glb' },
] }) });
const live3 = initFranchise({ scene: scene3, seed: 44, classic: false, loader, onArrived: () => { toasts3++; } });
await new Promise(r => setTimeout(r, 60));
check('hydration read places stands silently', toasts3 === 0 && live3.lots['14'].placed, `toasts=${toasts3}`);
fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'success', purpose: null, claimed: true, modelUrl: 'https://x/b.glb' }) });
await live3.describe('11', 'a jazz record shop', 4, 'draw');
await new Promise(r => setTimeout(r, 60));
check('a witnessed arrival still announces', toasts3 === 1 && live3.lots['11'].placed, `toasts=${toasts3}`);

// ============================================================
// 5) convex backend — sanitize, spec, key contract, image mode, routes
// ============================================================
check('schema: franchises table exists', /franchises: defineTable\(/.test(schema));
check('schema: by_seed index', schema.includes('.index("by_seed", ["seed"])'));
check('schema: lot column present', schema.includes('lot: v.optional(v.string())'));
check('schema: purpose column present (optional, legacy rows null)', schema.includes('purpose: v.optional(v.string())'));

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
check('status returns purpose per lot (null for legacy)', convexFr.includes('purpose: fr.purpose ?? null'));
check('purpose values are exactly draw/community/rent', convexFr.includes('FRANCHISE_PURPOSES = ["draw", "community", "rent"]'));
check('describe accepts an optional purpose arg', /args: \{[\s\S]{0,200}purpose: v\.optional\(v\.string\(\)\)/.test(convexFr));
check('describe rejects unknown purposes', convexFr.includes('"unknown purpose"') && /FRANCHISE_PURPOSES[\s\S]{0,60}includes\(purpose\)/.test(convexFr));
check('purpose is not part of the asset key', !/purpose[\s\S]{0,40}assetKey|franchiseSpec\(seed, lot, prompt, purpose\)/.test(convexFr));
check('idempotent return carries the existing purpose', convexFr.includes('purpose: mine.purpose ?? null'));
check('idempotent return is not a claim', convexFr.includes('claimed: false'));
check('a fresh describe claims the lot', convexFr.includes('claimed: true'));
check('record persists the purpose', (convexFr.match(/purpose: args\.purpose/g) || []).length >= 2);

// photo → model: the same input serves image URLs
check('isImageInput detects pasted links', /isImageInput[\s\S]{0,80}https\?:/.test(convexFr));
check('sanitize accepts photo links (URLs skip the word count)', convexFr.includes('if (isImageInput(clean)) return clean;'));
check('image specs carry imageUrl', /if \(isImageInput\(prompt\)\) spec\.imageUrl = prompt/.test(convexFr));
check('generate args accept imageUrl', /imageUrl: v\.optional\(v\.string\(\)\)/.test(convexTripo));
check('image tasks hit the image-to-model endpoint', convexTripo.includes('image-to-model'));
check('image tasks post file {type,url}', /file: \{[\s\S]{0,400}url: spec\.imageUrl/.test(convexTripo));
check('imageUrl is content-addressed in assetKey (and only present for image specs, so legacy keys hold)', convexTripo.includes('...(spec.imageUrl ? [spec.imageUrl] : [])'));

check('http: /franchise/status GET route', http.includes('path: "/franchise/status"') && http.includes('method: "GET"'));
check('http: /franchise/describe POST route', http.includes('path: "/franchise/describe"') && http.includes('method: "POST"'));
check('http: describe is POST-only', /franchiseDescribe[\s\S]{0,200}POST only/.test(http));
check('http: describe passes the lot param', /p\.get\("lot"\)/.test(http));
check('http: describe passes the purpose param', /p\.get\("purpose"\) \?\? undefined/.test(http) && /describe, \{ seed, lot, prompt, day, purpose, byline \}/.test(http));

// ============================================================
// 6) main.js wiring
// ============================================================
check('initFranchise called with scene + seed', /initFranchise\(\{[\s\S]*scene, seed: SEED/.test(main));
check('arrival toast names the lot', main.includes('${def.name} is open'));
check('inherited arrival never claims "builders finished"', main.includes('the rent is yours') && main.includes('a previous owner built it') && main.includes('ls && ls.mine'));
check('a signed inherited stand names its builder', main.includes('`built by ${ls.byline}`') && main.includes('ls && ls.byline'));
check('card states the £15 ground rent plainly', main.includes('£15 ground rent each dawn'));
check('chosen purpose previews its effect honestly', main.includes('first full day on the street'));
check('worksite markers live in franchise.js', /new THREE\.Group\(\)/.test(frJs) && frJs.includes('scaffold(l.lot)') && frJs.includes('unscaffold(lotId)'));
check('markers never appear in dead/classic mode', frJs.includes('dead || !scene'));
check('dawn refresh in prepareDay', /franchise\.refresh\(d\)/.test(main));
check('rent applied at open', /const fr = franchise\.rentDue\(d\); if \(fr\) \{ till \+= fr/.test(main));
check('receipt carries the rent row', main.includes("'The Row · stand rent'"));
check('the Row card renders in its own brief section', main.includes("renderFranchiseRow()") && main.includes("$('brief-row')"));
check('row teaser promises the first lease on day 3', main.includes('the first lease opens day 3'));
check('teaser skipped once stands are built (inherited seed before day 3)', /if \(built\.length\) \{ doneBlock\(false\); return; \}/.test(main));
check('partial row names remaining lease days, not "spoken for"', main.includes('opens day ${l.unlockDay}') && main.includes('already ${built.length > 1 ? \'stand\' : \'stands\'} on the Row'));
check('full-row wording only when every lot is built', main.includes('built.length === FRANCHISE.lots.length'));
check('all-scaffolding row is never called built', main.includes('under scaffolding'));
check('render key digests every lot status + purpose', main.includes("ls(l.id).status || ''}:${ls(l.id).purpose || ''"));
check('typed draft survives same-lot redraws', main.includes('input.value = rowDraft') && main.includes('rowDraft = input.value'));
check('draft resets only on a new day or lot', /if \(forNow !== rowFor\) \{ rowFor = forNow;/.test(main));
check('brief offers the next vacant lot', main.includes('franchise.nextVacant(day)'));
check('lease card POSTs describe with lot + purpose + byline', /franchise\.describe\(vacant\.id, text, day, rowPurpose,/.test(main));
check('lease card labels the three purposes', main.includes('awareness at close') && main.includes('returnees tomorrow') && main.includes('rent per dawn'));
check('purpose labels derive from config so they cannot drift', /FRANCHISE\.purposes\.\w+\.\w+/.test(main) && main.includes('FRANCHISE.purposes.rent.rentBonus'));
check('purpose buttons are mutually exclusive pressed-states', (main.match(/aria-pressed/g) || []).length >= 2 && main.includes('row-purpose'));
check('lease card has an aria-live status line', main.includes("id = 'brief-row-status'") && main.includes("aria-live', 'polite'") || main.includes('brief-row-status') && main.includes('aria-live'));
check('send requires a chosen purpose', main.includes('pick what the stand is for'));
check('builders-working copy promises no fixed time', main.includes('may arrive later today or at the next dawn'));
check('full row offers a fresh district out', main.includes('open a fresh district') && main.includes('newStreetUrl'));
check('fresh district seed comes from crypto.getRandomValues', main.includes('crypto.getRandomValues'));
check('fresh seed spans the 32-bit space', main.includes('4294967295'));
check('brief accepts photo links', main.includes('photo link'));
check('inherited stands get their own line', main.includes('spoken for') && main.includes('previous owner'));
check('close folds purpose returnees into resolveDay', /extraReturnees: womReturnees\(evangelistServes\) \+ rowFx\.returnees/.test(main));
check('draw bonus clamps awareness once after resolveDay', /demand\.awareness = Math\.min\(1, Math\.max\(0, demand\.awareness \+ rowFx\.awareness\)\)/.test(main));
check('logged awareness after stays consistent', main.includes('dtrace.after = demand.awareness'));
check('receipt names the awareness bonus (non-money row)', main.includes("'The Row · a draw'") && main.includes('awareness carried into tomorrow'));
check('receipt names the returnees bonus by the chosen word', main.includes("'The Row · a hub'") && main.includes('returnees tomorrow'));
check('receipt splits the tenant lease out of the rent line', main.includes('a tenant’s lease') && main.includes('franchiseRentToday - franchiseFxToday.rentBonus'));
check('purpose bonuses reset with the day and the campaign', (main.match(/franchiseFxToday = \{ awareness: 0, returnees: 0, rentBonus: 0 \}/g) || []).length >= 3);
check('client takes the server purpose verbatim', frJs.includes('ls.purpose = d.purpose ?? null'));
check('client marks mine only on claimed', frJs.includes('if (d.claimed) ls.mine = true'));
check('poll overwrites purpose with the read', frJs.includes('ls.purpose = l.purpose ?? null'));
check('hydration read never toasts — only witnessed arrivals', frJs.includes('!firstRead') && /announce = true/.test(frJs));
check('status reads re-render the card while planning', /if \(phase === 'planning'\) renderFranchiseRow\(\)/.test(main));
check('claimed lots suppress the day-5 scaffold props', main.includes("setConstruction(d, rowClaimed('18'))") && main.includes("setConstructionLeft(d, rowClaimed('11'))"));
check('scaffold setters accept the suppress flag', /setConstruction = \(day, suppress = false\)/.test(readFileSync(join(ROOT, 'web/js/world.js'), 'utf8')));
check('the letter is Row-aware', main.includes('snap.row = rowSummary') && readFileSync(join(ROOT, 'web/js/letter.js'), 'utf8').includes('s.row'));
check('status route nudges mature tasks', http.includes('api.franchise.statusLive'));
check('deeds carry an optional signature', convexFr.includes('sanitizeByline') && convexFr.includes('byline: v.optional(v.string())') && schema.includes('byline'));
check('status returns the builder signature', convexFr.includes('byline: fr.byline ?? null'));
check('client passes byline on describe and stores it on read', frJs.includes('&byline=') && frJs.includes('ls.byline = d.byline ?? null') && frJs.includes('ls.byline = l.byline ?? null'));
check('lease card has a deeds signature line', main.includes('brief-row-byline') && main.includes('rowByline') && /describe\(vacant\.id, text, day, rowPurpose, \(sign/.test(main));
check('signature pre-fills from the licence name', main.includes("playerName !== 'Sam' ? playerName"));
check('streets registry + route exist', convexFr.includes('export const streets') && http.includes('/franchise/streets'));
check('gallery page reads the registry and plays seed links', readFileSync(join(ROOT, 'web/streets.html'), 'utf8').includes('/franchise/streets') && readFileSync(join(ROOT, 'web/streets.html'), 'utf8').includes('?seed='));
check('gallery is shipped by the build', readFileSync(join(ROOT, 'tools/build-dist.sh'), 'utf8').includes('streets.html'));
check('licence links to the gallery', idxHtml.includes('href="/streets.html"'));
check('statusLive re-queries past the nudge threshold', convexFr.includes('statusLive') && convexFr.includes('NUDGE_MS') && convexFr.includes('internal.tripo.pollTask'));
check('tripo exposes a per-task live poll', convexTripo.includes('export const pollTask') && convexTripo.includes('checkTripoTask'));
check('licence offers the two street entries', main.includes("lic-see-street") && main.includes("lic-new-street") && main.includes("set('seed', '99')"));
check('franchiseRentToday reset per dawn + campaign', (main.match(/franchiseRentToday = 0/g) || []).length >= 2);
check('franchise exported for headless tests', /\n  franchise,\n/.test(main));
check('index.html: #brief-row sits above #brief-prep', idxHtml.indexOf('id="brief-row"') > -1 && idxHtml.indexOf('id="brief-row"') < idxHtml.indexOf('id="brief-prep"'));
check('index.html: licence street entries exist', idxHtml.includes('id="lic-see-street"') && idxHtml.includes('id="lic-new-street"'));

// A stand should show up the same day (~2 min of polling), and the next
// morning's brief should name the bonus even while another lease is vacant.
check('poll looks immediately and keeps looking for about six minutes', FRANCHISE_POLL_MS === 10000 && FRANCHISE_MAX_POLLS === 36);
check('a failed status read schedules another look',
  /if \(!r\.ok\) \{ continuePoll\(attempt, gen\); return; \}/.test(frJs) &&
  /catch \{ waiting = true;/.test(frJs) &&
  /if \(waiting\) continuePoll\(attempt, gen\)/.test(frJs));
check('a success that has not landed keeps polling', frJs.includes("ls.status === 'success' && !ls.placed) waiting = true"));
check('describe starts the look immediately', frJs.includes('scaffold(lotId); armPoll()'));
check('nudge asks Tripo after 15s', /export const NUDGE_MS = 15 \* 1000/.test(convexTripo));
check('morning brief renders the row bonus', main.includes('morningFranchiseLines') && main.includes("id = 'brief-row-bonus'"));
check('morning brief keeps last night’s hub for today’s line',
  /franchiseCarry = \{[\s\S]{0,240}franchiseFxToday\.returnees/.test(main) &&
  main.indexOf('franchiseCarry = {') < main.indexOf('franchiseFxToday = { awareness: 0, returnees: 0, rentBonus: 0 };', main.indexOf('franchiseCarry = {')));
check('row bonus is visible in the brief', idxHtml.includes('#brief-row .row-bonus'));

const briefFx = initFranchise({ scene: null, seed: 1, classic: true });
briefFx.lots['14'] = { placed: true, placedDay: 3, purpose: 'community', status: 'success' };
briefFx.lots['11'] = { placed: true, placedDay: 4, purpose: 'draw', status: 'success' };
briefFx.lots['18'] = { placed: false, placedDay: 0, purpose: null, status: 'missing' };
const opened = morningFranchiseLines(briefFx, 3, { awareness: 0, returnees: 0, rentBonus: 0 });
check('the morning a hub opens names when neighbours start',
  opened.some(l => l.includes('14 The Row is open') && l.includes(String(P.community.returnees))), opened.join(' | '));
check('the morning a hub opens does not claim rent already landed', !opened.some(l => l.includes('ground rent')), opened.join(' | '));
const lines = morningFranchiseLines(briefFx, 4, { awareness: 0, returnees: 0, rentBonus: 0 });
const rent14b = FRANCHISE.lots.find(l => l.id === '14').rent;
check('day 4 names this morning’s ground rent', lines.some(l => l.includes(`£${rent14b}`) && l.includes('ground rent')), lines.join(' | '));
check('day 4 names the hub’s neighbours from tonight',
  lines.some(l => l.includes(`${P.community.returnees} neighbours`) && l.includes('tomorrow')), lines.join(' | '));
check('a stand that arrived today says when the draw starts',
  lines.some(l => l.includes('11 The Row is open') && l.includes('draw')), lines.join(' | '));
const carried = morningFranchiseLines(briefFx, 4, { awareness: 0, returnees: P.community.returnees, rentBonus: 0 });
check('last night’s hub is in today’s crowd', carried.some(l => /today.s crowd/.test(l) && l.includes(String(P.community.returnees))), carried.join(' | '));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — the franchise: three buildable lots · words or photos → Tripo-grown stands → dawn rent · the street remembers');
process.exit(fails.length ? 1 : 0);
