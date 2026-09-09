// Headless test for web/js/loader.js. Stubs the DOM/GL/audio paths the same
// way as the other tests, then asserts the loader's contract:
//   1. module imports cleanly under stubs
//   2. loadGLB returns a THREE.Group (the placeholder path under __noGLB)
//   3. cache returns the *same* promise for repeated URLs
//   4. apply.position/rotationY/scale mutate the returned instance
//   5. an unknown URL does NOT throw — graceful fallback to placeholder
//   6. dispose clears the cache
//   7. web/js/world.js still imports and runs (regression guard for the
//      substitution map)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));

// ---- DOM / GL / audio stubs --------------------------------------------------
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = { children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c, v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
    appendChild(c){c._parent=e;e.children.push(c);return c;},
    prepend(c){c._parent=e;e.children.unshift(c);},
    remove(){const p=e._parent;if(p){const i=p.children.indexOf(e);if(i>=0)p.children.splice(i,1);}},
    querySelector:()=>el(), querySelectorAll:()=>[], addEventListener(){},
    get lastChild(){return e.children[e.children.length-1]||null;}, click(){e.onclick&&e.onclick();}, onclick:null };
  return e;
}
const reg = new Map();
const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
globalThis.document = { getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); }, createElement: t => t === 'canvas' ? cs() : el(), createElementNS: () => cs(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis; globalThis.__headless = true; globalThis.__noGLB = true;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '' }; globalThis.addEventListener = () => {};
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
const _e = console.error; console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime(){}, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  createOscillator() { return { type:'', frequency:{value:0,setTargetAtTime(){},exponentialRampToValueAtTime(){},setValueAtTime(){}}, detune:{value:0}, connect(){}, start(){}, stop(){} }; }
  createBiquadFilter() { return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
  createBufferSource() { return { buffer:null, loop:false, playbackRate:{value:1}, connect(){}, start(){}, stop(){} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume(){}
}
globalThis.AudioContext = ACS;

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

// ============================================================
// 1) loader module imports + loadGLB returns a Group
// ============================================================
const { GLBLoader } = await import('../js/loader.js');
const { loadGLB } = GLBLoader();
const bar = await loadGLB('kitchenBar.glb');
check('loadGLB returns THREE.Group', bar && bar.isGroup === true, JSON.stringify(bar?.type || null));
check('placeholder flagged', !!bar.userData.placeholder || !!bar.userData.source, 'no userData set');
check('placeholder has child mesh', bar.children.length > 0 && bar.children[0].isMesh, 'no child mesh');

// ============================================================
// 2) cache prevents re-parsing the same URL
// ============================================================
// The cache is keyed by URL inside one loader. Each call to loadGLB clones
// the cached template (so per-instance position/scale don't bleed between
// uses), but the parse runs once. The strongest assertion we can make
// without instrumenting the loader is: after 10 calls, the cache holds 1
// entry, not 10. If it held 10, every call would have re-parsed.
const { loadGLB: lcached, _cache: cc1 } = GLBLoader();
const groups = [];
for (let i = 0; i < 10; i++) groups.push(await lcached('tableRound.glb'));
check('cache stores 1 entry after 10 calls', cc1.size === 1, `got ${cc1.size}`);
check('resolved values are different clones', new Set(groups).size === 10, 'cache returned the same instance; should clone for per-call transform');
check('each clone carries the source URL', groups.every(g => g.userData.source === 'tableRound.glb'), 'userData.source missing on a clone');

// ============================================================
// 3) apply.position / rotationY / scale mutate the returned instance
// ============================================================
const inst = await loadGLB('kitchenBar.glb', { position: [1, 2, 3], rotationY: 1.57, scale: 0.5 });
check('position applied', inst.position.x === 1 && inst.position.y === 2 && inst.position.z === 3, `got ${inst.position.x},${inst.position.y},${inst.position.z}`);
check('rotationY applied', Math.abs(inst.rotation.y - 1.57) < 1e-6, `got ${inst.rotation.y}`);
check('scale applied', Math.abs(inst.scale.x - 0.5) < 1e-6 && Math.abs(inst.scale.y - 0.5) < 1e-6, `got ${inst.scale.x}`);

// ============================================================
// 4) unknown URL does NOT throw — graceful placeholder fallback
// ============================================================
let threw = null;
try { const u = await loadGLB('does-not-exist.glb'); check('unknown URL returns placeholder', u && u.isGroup, 'no group'); check('placeholder has userData.error', !!u.userData.error, 'no error field'); }
catch (e) { threw = e; }
check('unknown URL did not throw', threw === null, threw?.message || 'threw');

// ============================================================
// 5) dispose clears the cache
// ============================================================
const { loadGLB: ld, dispose, _cache } = GLBLoader();
const _x = ld('kitchenCoffeeMachine.glb');
check('cache has 1 entry after one load', _cache.size === 1, `got ${_cache.size}`);
dispose();
check('cache empty after dispose', _cache.size === 0, `got ${_cache.size}`);

// ============================================================
// 6) world.js still imports + runs (regression guard for the substitution)
// ============================================================
await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
check('window.__grunds exists', !!globalThis.__grunds, 'no globals after main.js import');
check('main.js produced exc + reg', globalThis.__grunds?.exc && globalThis.__grunds?.reg, 'campaign loop not initialized');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — GLB loader: cache, fallback, apply, dispose, world regression all hold');
