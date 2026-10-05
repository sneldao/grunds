// Generative District provider routing (convex/district.ts): Tripo first,
// Mint as the proven fallback, dual-key reads so a slot grown by either
// provider resolves — and an already-grown slot is never re-grown.
//   1. pure helpers: pickSlotRow / providerOrder / shouldFallBack
//   2. tripoSpecForSlot: deterministic per (seed, slot), house-style negative,
//      face limits inside TRIPOTHON.md §7 discipline, keys differ by provider
//   3. ensure() against a stubbed ctx: cached-mint no-op, Tripo-first,
//      fallback on refusal/throw, never throws when both providers fail
//   4. kit() reads both keys and reports the provider
//   5. source anchors: tripo persist hook, pipeline kicks both reapers,
//      build-dist ships the asset board
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- load convex/district.ts with stubbed Convex modules --------------------
const context = vm.createContext({ console, process });
const vProxy = new Proxy(function () {}, { get: () => vProxy, apply: () => vProxy });
const vMod = new vm.SyntheticModule(['v'], function () { this.setExport('v', vProxy); }, { context });
const SERVER = ['query', 'mutation', 'action', 'internalQuery', 'internalMutation', 'internalAction', 'httpAction'];
const serverMod = new vm.SyntheticModule(SERVER, function () { for (const n of SERVER) this.setExport(n, (d) => d); }, { context });
const ref = new Proxy({}, { get: (_t, m) => new Proxy({}, { get: (_t2, f) => ({ __ref: `${String(m)}.${String(f)}` }) }) });
const apiMod = new vm.SyntheticModule(['api', 'internal'], function () { this.setExport('api', ref); this.setExport('internal', ref); }, { context });
for (const m of [vMod, serverMod, apiMod]) { await m.link(() => { throw new Error('leaf'); }); await m.evaluate(); }

const loaded = new Map();
async function load(abs) {
  if (loaded.has(abs)) return loaded.get(abs);
  const { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }, fileName: abs,
  });
  const m = new vm.SourceTextModule(outputText, { identifier: abs, context });
  loaded.set(abs, m);
  await m.link((spec) => {
    if (spec === 'convex/values') return vMod;
    if (/_generated\/server$/.test(spec)) return serverMod;
    if (/_generated\/api$/.test(spec)) return apiMod;
    if (spec.startsWith('.')) return load(join(dirname(abs), spec.replace(/\.js$/, '') + '.ts'));
    throw new Error(`unresolved import ${spec}`);
  });
  await m.evaluate();
  return m;
}
const D = (await load(join(ROOT, 'convex', 'district.ts'))).namespace;
const T = (await load(join(ROOT, 'convex', 'tripo.ts'))).namespace;

const fails = [];
const check = (name, fn) => {
  try { fn(); console.log('  PASS', name); } catch (e) { fails.push(`${name}: ${e.message}`); }
};
const plain = (x) => JSON.parse(JSON.stringify(x)); // vm-realm objects → this realm

// ============================================================
// 1) pure routing helpers
// ============================================================
const ok = (provider, url = `https://x/${provider}.glb`) => ({ status: 'success', provider, modelUrl: url, previewUrl: null });
const proc = (provider) => ({ status: 'processing', provider, modelUrl: null });
const failed = (provider) => ({ status: 'failed', provider, modelUrl: null });

check('pickSlotRow · nothing → null (missing)', () => assert.equal(D.pickSlotRow(null, null), null));
check('pickSlotRow · mint-cached slot resolves to mint', () => assert.equal(D.pickSlotRow(ok('mint'), null).provider, 'mint'));
check('pickSlotRow · tripo slot resolves to tripo', () => assert.equal(D.pickSlotRow(null, ok('tripo')).provider, 'tripo'));
check('pickSlotRow · both success → tripo', () => assert.equal(D.pickSlotRow(ok('mint'), ok('tripo')).provider, 'tripo'));
check('pickSlotRow · success beats a failed tripo row', () => {
  const hit = D.pickSlotRow(ok('mint'), failed('tripo'));
  assert.equal(hit.provider, 'mint'); assert.equal(hit.row.status, 'success');
});
check('pickSlotRow · success beats processing across providers', () => assert.equal(D.pickSlotRow(ok('mint'), proc('tripo')).provider, 'mint'));
check('pickSlotRow · processing beats failed', () => assert.equal(D.pickSlotRow(failed('mint'), proc('tripo')).row.status, 'processing'));
check('pickSlotRow · lone failed row still reported', () => assert.equal(D.pickSlotRow(failed('mint'), null).row.status, 'failed'));

check('providerOrder · success under either key → leave alone', () => {
  assert.deepEqual(plain(D.providerOrder(ok('mint'), null)), []);
  assert.deepEqual(plain(D.providerOrder(null, ok('tripo'))), []);
  assert.deepEqual(plain(D.providerOrder(ok('mint'), failed('tripo'))), []);
});
check('providerOrder · processing under either key → leave alone', () => {
  assert.deepEqual(plain(D.providerOrder(proc('mint'), null)), []);
  assert.deepEqual(plain(D.providerOrder(failed('mint'), proc('tripo'))), []);
});
check('providerOrder · un-grown → tripo first, mint fallback', () => {
  assert.deepEqual(plain(D.providerOrder(null, null)), ['tripo', 'mint']);
  assert.deepEqual(plain(D.providerOrder(failed('mint'), null)), ['tripo', 'mint']);
  assert.deepEqual(plain(D.providerOrder(failed('mint'), failed('tripo'))), ['tripo', 'mint']);
});
check('providerOrder · tripo already failed this slot → mint gets first go', () =>
  assert.deepEqual(plain(D.providerOrder(null, failed('tripo'))), ['mint', 'tripo']));

check('shouldFallBack · started/cached tasks stay', () => {
  assert.equal(D.shouldFallBack({ status: 'processing', created: true }), false);
  assert.equal(D.shouldFallBack({ status: 'success' }), false);
});
check('shouldFallBack · refusals / missing key / budget / null fall back', () => {
  assert.equal(D.shouldFallBack({ status: 'missing', fallback: true, error: 'safety' }), true);
  assert.equal(D.shouldFallBack({ status: 'missing', fallback: true, error: 'daily-budget' }), true);
  assert.equal(D.shouldFallBack({ status: 'failed' }), true);
  assert.equal(D.shouldFallBack(null), true);
});

// ============================================================
// 2) Tripo spec — deterministic, reproducible per (seed, slot)
// ============================================================
const SLOTS = [...D.DISTRICT_SLOTS];
check('tripoSpecForSlot · same seed → identical spec', () => {
  for (const seed of [7, 11, 23]) {
    const kit = D.kitSpecForSeed(seed);
    for (const slot of SLOTS) assert.deepEqual(plain(D.tripoSpecForSlot(seed, slot, kit[slot])), plain(D.tripoSpecForSlot(seed, slot, D.kitSpecForSeed(seed)[slot])));
  }
});
check('tripoSpecForSlot · prompt is the kit prompt verbatim (one source of truth)', () => {
  const kit = D.kitSpecForSeed(11);
  for (const slot of SLOTS) assert.equal(D.tripoSpecForSlot(11, slot, kit[slot]).prompt, kit[slot].prompt);
});
check('tripoSpecForSlot · P1 model, PBR, house negative prompt', () => {
  const s = D.tripoSpecForSlot(7, 'lantern', D.kitSpecForSeed(7).lantern);
  assert.equal(s.model, 'tripo-p1');
  assert.ok(T.MODEL_IDS[s.model], 'model must be pinned in MODEL_IDS');
  assert.equal(s.pbr, true);
  for (const w of ['text', 'watermark', 'logo', 'broken mesh']) assert.match(s.negativePrompt, new RegExp(w));
});
check('tripoSpecForSlot · fountain runs the P2 hero pipeline', () => {
  const s = D.tripoSpecForSlot(7, 'fountain', D.kitSpecForSeed(7).fountain);
  assert.equal(s.model, 'tripo-p2');
  assert.ok(T.MODEL_IDS[s.model], 'model must be pinned in MODEL_IDS');
  assert.equal(s.faceLimit, 15000);
});
check('tripoSpecForSlot · face limits inside 8–15k', () => {
  for (const slot of SLOTS) {
    const f = D.tripoSpecForSlot(7, slot, D.kitSpecForSeed(7)[slot]).faceLimit;
    assert.ok(f >= 8000 && f <= 15000, `${slot} faceLimit ${f}`);
  }
});
check('tripoSlotSeed · positive int32, distinct per slot / seed / salt', () => {
  const seen = new Set();
  for (const seed of [7, 11, 23]) for (const slot of SLOTS) {
    const s = D.tripoSlotSeed(seed, slot);
    assert.ok(Number.isInteger(s) && s >= 1 && s <= 2147483647, `seed ${s}`);
    seen.add(s);
    assert.notEqual(s, D.tripoSlotSeed(seed, slot, 0x7e57), 'model and texture seeds must differ');
  }
  assert.equal(seen.size, 18, 'model seeds collide across slots/seeds');
});
check('keys differ by provider by design', () => {
  const kit = D.kitSpecForSeed(7);
  for (const slot of SLOTS) {
    const mk = D.slotKey(slot, kit[slot]); const tk = D.tripoSlotKey(7, slot, kit[slot]);
    assert.match(mk, /^mint:/); assert.match(tk, /^tripo:/); assert.notEqual(mk, tk);
    assert.equal(tk, T.assetKey(D.tripoSpecForSlot(7, slot, kit[slot])));
  }
});

// ============================================================
// 3) ensure() — stubbed ctx
// ============================================================
function makeCtx(rows, generators) {
  const calls = [];
  return {
    calls,
    async runQuery(r, args) {
      assert.equal(r.__ref, 'tripo.byKey');
      return rows.get(args.key) ?? null;
    },
    async runAction(r, args) {
      const provider = r.__ref.split('.')[0];
      calls.push({ provider, fn: r.__ref, args: plain(args) });
      return generators[provider](args);
    },
  };
}
const keysFor = (seed) => {
  const kit = D.kitSpecForSeed(seed);
  return Object.fromEntries(SLOTS.map((s) => [s, { mint: D.slotKey(s, kit[s]), tripo: D.tripoSlotKey(seed, s, kit[s]) }]));
};
const never = () => { throw new Error('must not generate'); };

await (async () => {
  // a) seed fully Mint-cached (seed 7 today): zero generation calls, no churn
  const k7 = keysFor(7);
  const rows = new Map(SLOTS.map((s) => [k7[s].mint, ok('mint')]));
  const ctx = makeCtx(rows, { tripo: never, mint: never });
  const r = plain(await D.ensure.handler(ctx, { seed: 7 }));
  check('ensure · mint-cached seed → no generation calls', () => assert.equal(ctx.calls.length, 0));
  check('ensure · mint-cached seed → every slot success via mint', () => {
    for (const s of SLOTS) { assert.equal(r.slots[s].status, 'success'); assert.equal(r.slots[s].provider, 'mint'); }
  });
})();

await (async () => {
  // b) fresh seed, Tripo accepts: Tripo only, deterministic spec on the wire
  const ctx = makeCtx(new Map(), { tripo: () => ({ key: 'k', created: true, status: 'processing' }), mint: never });
  const r = plain(await D.ensure.handler(ctx, { seed: 11 }));
  check('ensure · fresh seed → Tripo only, once per slot', () => {
    assert.equal(ctx.calls.length, 6);
    assert.ok(ctx.calls.every((c) => c.fn === 'tripo.generate'));
  });
  check('ensure · Tripo args are tripoSpecForSlot', () => {
    const kit = D.kitSpecForSeed(11);
    SLOTS.forEach((s, i) => assert.deepEqual(ctx.calls[i].args, plain(D.tripoSpecForSlot(11, s, kit[s]))));
  });
  check('ensure · slots report processing via tripo', () => {
    for (const s of SLOTS) { assert.equal(r.slots[s].status, 'processing'); assert.equal(r.slots[s].provider, 'tripo'); }
  });
})();

await (async () => {
  // c) Tripo refuses / throws → Mint fallback
  let n = 0;
  const ctx = makeCtx(new Map(), {
    tripo: () => { if (n++ % 2) throw new Error('upstream 503'); return { key: 'k', created: false, fallback: true, status: 'missing', error: 'refused' }; },
    mint: () => ({ key: 'm', created: true, status: 'processing' }),
  });
  const r = plain(await D.ensure.handler(ctx, { seed: 23 }));
  check('ensure · Tripo refusal or throw → Mint generates the slot', () => {
    assert.equal(ctx.calls.filter((c) => c.provider === 'mint').length, 6);
    for (const s of SLOTS) { assert.equal(r.slots[s].status, 'processing'); assert.equal(r.slots[s].provider, 'mint'); }
  });
  check('ensure · Mint args unchanged (prompt/name/fast preset → same mint key)', () => {
    const kit = D.kitSpecForSeed(23);
    const m = ctx.calls.filter((c) => c.provider === 'mint');
    SLOTS.forEach((s, i) => assert.deepEqual(m[i].args, { prompt: kit[s].prompt, name: kit[s].name, preset: D.DISTRICT_PRESET }));
  });
})();

await (async () => {
  // d) both providers down → missing (classic stand-in), never throws
  const ctx = makeCtx(new Map(), {
    tripo: () => { throw new Error('tripo down'); },
    mint: () => ({ key: 'm', created: false, fallback: true, status: 'missing', error: 'safety check' }),
  });
  let r, threw = null;
  try { r = plain(await D.ensure.handler(ctx, { seed: 11 })); } catch (e) { threw = e; }
  check('ensure · both providers failing never throws', () => assert.equal(threw, null));
  check('ensure · both failing → missing + both errors reported', () => {
    for (const s of SLOTS) {
      assert.equal(r.slots[s].status, 'missing'); assert.equal(r.slots[s].fallback, true);
      assert.match(r.slots[s].error, /tripo: tripo down/); assert.match(r.slots[s].error, /mint: safety check/);
    }
  });
})();

await (async () => {
  // e) mixed: one slot mint-cached, one tripo-processing, one tripo-failed, rest fresh
  const k = keysFor(11);
  const rows = new Map([[k.lantern.mint, ok('mint')], [k.planter.tripo, proc('tripo')], [k.stall.tripo, failed('tripo')]]);
  const ctx = makeCtx(rows, {
    tripo: () => ({ key: 't', created: true, status: 'processing' }),
    mint: () => ({ key: 'm', created: true, status: 'processing' }),
  });
  const r = plain(await D.ensure.handler(ctx, { seed: 11 }));
  check('ensure · mixed seed only grows the un-grown slots', () => {
    assert.deepEqual(ctx.calls.map((c) => c.provider), ['mint', 'tripo', 'tripo', 'tripo']); // stall, sign, cart, fountain
    assert.equal(r.slots.lantern.provider, 'mint'); assert.equal(r.slots.planter.provider, 'tripo');
    assert.equal(r.slots.stall.provider, 'mint');
  });
})();

// ============================================================
// 4) kit() — dual-key read with a stubbed db
// ============================================================
await (async () => {
  const k = keysFor(7);
  const rows = new Map([[k.lantern.mint, ok('mint', 'https://cdn.mint.gg/l.glb')], [k.cart.tripo, ok('tripo', 'https://storage/c.glb')], [k.sign.tripo, proc('tripo')]]);
  const db = { query: () => ({ withIndex: (_i, fn) => { let key; fn({ eq: (_f, v) => { key = v; return null; } }); return { unique: async () => rows.get(key) ?? null }; } }) };
  const r = plain(await D.kit.handler({ db }, { seed: 7 }));
  check('kit · mint-keyed slot reads success via mint', () => assert.deepEqual([r.slots.lantern.status, r.slots.lantern.provider, r.slots.lantern.modelUrl], ['success', 'mint', 'https://cdn.mint.gg/l.glb']));
  check('kit · tripo-keyed slot reads success via tripo', () => assert.deepEqual([r.slots.cart.status, r.slots.cart.provider], ['success', 'tripo']));
  check('kit · tripo processing slot reads processing', () => assert.equal(r.slots.sign.status, 'processing'));
  check('kit · un-grown slot reads missing (classic stand-in contract)', () => assert.deepEqual([r.slots.stall.status, r.slots.stall.modelUrl, r.slots.stall.provider], ['missing', null, null]));
  check('kit · every slot carries its exact prompt', () => { const kit = D.kitSpecForSeed(7); for (const s of SLOTS) assert.equal(r.slots[s].prompt, kit[s].prompt); });
})();

// ============================================================
// 5) source anchors
// ============================================================
const districtSrc = read('convex/district.ts');
const tripoSrc = read('convex/tripo.ts');
const pipeSrc = read('tools/mint-pipeline.mjs');
check('district.ts · ensure references both providers', () => {
  assert.match(districtSrc, /api\.tripo\.generate/); assert.match(districtSrc, /api\.mint\.generate/);
});
check('district.ts · kit reads both provider keys', () => {
  const body = districtSrc.slice(districtSrc.indexOf('export const kit'), districtSrc.indexOf('export const ensure'));
  assert.match(body, /slotKey\(/); assert.match(body, /tripoSlotKey\(/);
});
check('tripo.ts · successful tripo rows are persisted to Convex storage', () => {
  assert.match(tripoSrc, /scheduler\.runAfter\(0,\s*internal\.tripo\.persist/);
  assert.match(tripoSrc, /ctx\.storage\.store\(/);
});
check('pipeline · kicks both provider reapers', () => {
  assert.match(pipeSrc, /'tripo:reaper'/); assert.match(pipeSrc, /'mint:reaper'/);
});
check('pipeline · manifest keeps its schema keys', () => {
  for (const k of ['generatedAt', 'provider', 'preset', 'seeds']) assert.match(pipeSrc, new RegExp(`${k}:`));
});
check('build-dist ships the asset board', () => {
  assert.ok(existsSync(join(ROOT, 'tools', 'build-asset-board.mjs')), 'tools/build-asset-board.mjs missing');
  assert.match(read('tools/build-dist.sh'), /build-asset-board\.mjs/);
});

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — district routing: Tripo first, Mint fallback, dual-key reads, cached slots never re-grown');
