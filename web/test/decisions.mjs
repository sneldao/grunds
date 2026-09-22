import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveDecision } from '../js/decision.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

{
  const snap = { day: 1, index: 1.0, debt: 0, contract: null, extraFee: 0, staffCondition: 1 };
  const plan = { hedge: 'hold', staffing: 'work', marketing: { sample: false, sponsor: false } };
  const ok = resolveDecision(snap, plan);
  check(ok.ok === true && ok.plan.hedge === 'hold' && ok.debt === 0 && ok.fee === 0, 'hold day1 resolves clean');
  check(resolveDecision({ ...snap, day: 0 }, plan).ok === false, 'day 0 rejected');
  check(resolveDecision({ ...snap, day: 6 }, plan).ok === false, 'day 6 rejected');
  check(resolveDecision({ ...snap, day: 1.5 }, plan).ok === false, 'non-integer day rejected');
  check(resolveDecision({ ...snap, index: 0.5 }, plan).ok === false, 'index below floor rejected');
  check(resolveDecision({ ...snap, index: 2.7 }, plan).ok === false, 'index above cap rejected');
  check(resolveDecision({ ...snap, index: NaN }, plan).ok === false, 'NaN index rejected');
  check(resolveDecision({ ...snap, debt: -1 }, plan).ok === false, 'negative debt rejected');
  check(resolveDecision({ ...snap, extraFee: -1 }, plan).ok === false, 'negative surcharge rejected');
  check(resolveDecision({ ...snap, staffCondition: 2 }, plan).ok === false, 'condition above 1 rejected');
  check(resolveDecision(snap, { ...plan, hedge: 'bogus' }).ok === false, 'unknown hedge rejected');
  check(resolveDecision(snap, { ...plan, hedge: 'constructor' }).ok === false, 'prototype hedge rejected');
  check(resolveDecision(snap, { ...plan, staffing: 'intern' }).ok === false, 'unknown staffing rejected');
  check(resolveDecision(snap, { hedge: 'hold', staffing: 'work', marketing: { sample: false } }).ok === false, 'marketing missing sponsor rejected');
  check(resolveDecision(snap, { hedge: 'hold', staffing: 'work', marketing: { sample: false, sponsor: false, extra: true } }).ok === false, 'marketing extra key rejected');
  check(resolveDecision(snap, { ...plan, marketing: { sample: 'yes', sponsor: false } }).ok === false, 'non-boolean marketing rejected');
  check(resolveDecision({ ...snap, day: 2 }, { ...plan, marketing: { sample: false, sponsor: true } }).ok === false, 'sponsor before day 3 rejected');
  check(resolveDecision({ ...snap, day: 5 }, { ...plan, marketing: { sample: true, sponsor: false } }).ok === false, 'day5 marketing rejected');
  check(resolveDecision({ ...snap, day: 3 }, { ...plan, staffing: 'home' }).ok === false, 'ineligible staffing rejected');
  check(resolveDecision({ ...snap, staffCondition: 0.2, day: 3 }, { ...plan, staffing: 'home' }).ok === true, 'eligible staffing accepted');
  check(resolveDecision({ ...snap, contract: { price: 1, units: 100, fee: 2 } }, { ...plan, hedge: 'contract' }).ok === false, 'new contract under active contract rejected');
  check(resolveDecision({ ...snap, contract: { price: 3.0, units: 100, fee: 2 } }, plan).ok === false, 'out-of-range contract price rejected');
  check(resolveDecision({ ...snap, contract: { price: 1, units: 9999, fee: 2 } }, plan).ok === false, 'oversized contract units rejected');
  const frozen = JSON.parse(JSON.stringify(snap)), frozenPlan = JSON.parse(JSON.stringify(plan));
  resolveDecision(snap, plan);
  check(JSON.stringify(snap) === JSON.stringify(frozen) && JSON.stringify(plan) === JSON.stringify(frozenPlan), 'inputs are not mutated');
  const settle = resolveDecision({ day: 3, index: 1.2, debt: 20, contract: null, extraFee: 0, staffCondition: 1 }, { ...plan, hedge: 'settle' });
  check(settle.ok && settle.settlement === 20 && settle.interest === 0 && settle.debt === 0, 'settle clears debt without interest');
  const hold = resolveDecision({ day: 3, index: 1.2, debt: 20, contract: null, extraFee: 0, staffCondition: 1 }, plan);
  check(hold.ok && hold.interest === 4 && hold.debt === 24, 'hold on day>1 adds the interest tick');
  const hedged = resolveDecision({ day: 2, index: 1.2, debt: 0, contract: null, extraFee: 5, staffCondition: 1 }, { ...plan, hedge: 'contract' });
  check(hedged.ok && hedged.contract && hedged.contract.price === 1.2 && hedged.extraFee === 0 && hedged.debt === hedged.fee, 'contract locks index, clears surcharge, debts the fee');
}
console.log('PURE resolveDecision validation + finance verified');

const context = vm.createContext({
  process, console, crypto, fetch: globalThis.fetch, URL, URLSearchParams,
  TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, queueMicrotask,
  Request, Response, Headers,
});
const vProxy = new Proxy(function () {}, { get: () => vProxy, apply: () => vProxy });
const vMod = new vm.SyntheticModule(['v'], function () { this.setExport('v', vProxy); }, { context });
const regFn = d => d;
const serverMod = new vm.SyntheticModule(
  ['query', 'mutation', 'action', 'internalQuery', 'internalMutation', 'internalAction', 'httpAction'],
  function () { for (const n of ['query', 'mutation', 'action', 'internalQuery', 'internalMutation', 'internalAction', 'httpAction']) this.setExport(n, regFn); },
  { context },
);
const apiProxy = new Proxy({}, { get: (t, m) => new Proxy({}, { get: (t2, f) => ({ __ref: `${String(m)}.${String(f)}` }) }) });
const apiMod = new vm.SyntheticModule(['api', 'internal', 'components'], function () {
  this.setExport('api', apiProxy); this.setExport('internal', apiProxy); this.setExport('components', { staticHosting: {} });
}, { context });
const decisionJsMod = new vm.SyntheticModule(['resolveDecision'], function () { this.setExport('resolveDecision', resolveDecision); }, { context });
const httpRoutes = [];
const convexServerMod = new vm.SyntheticModule(['httpRouter'], function () {
  this.setExport('httpRouter', () => ({ route: (spec) => httpRoutes.push(spec) }));
}, { context });
const hostingMod = new vm.SyntheticModule(['registerStaticRoutes'], function () {
  this.setExport('registerStaticRoutes', () => {});
}, { context });

const registry = {};
const loaded = new Map();
async function load(file) {
  const abs = file.startsWith('/') ? file : join(ROOT, file);
  if (loaded.has(abs)) return loaded.get(abs);
  const { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: abs,
  });
  const m = new vm.SourceTextModule(outputText, { identifier: abs, context });
  loaded.set(abs, m);
  await m.link(spec => resolveSpec(spec, abs));
  await m.evaluate();
  return m;
}
function resolveSpec(spec, from) {
  if (spec === 'convex/values') return vMod;
  if (spec === 'convex/server') return convexServerMod;
  if (spec === '@convex-dev/static-hosting') return hostingMod;
  if (/_generated\/server$/.test(spec)) return serverMod;
  if (/_generated\/api$/.test(spec)) return apiMod;
  if (/web\/js\/decision\.js$/.test(spec)) return decisionJsMod;
  if (spec.startsWith('.')) {
    const p = join(dirname(from), spec);
    return load(/\.(ts|js)$/.test(p) ? p : p + '.ts');
  }
  throw new Error(`unresolved import ${spec} from ${from}`);
}
for (const m of [vMod, serverMod, apiMod, decisionJsMod, convexServerMod, hostingMod]) { await m.link(() => { throw new Error('leaf'); }); await m.evaluate(); }
for (const name of ['decisions', 'exchange', 'agentmail', 'stands', 'http']) registry[name] = await load(`convex/${name}.ts`);

function makeCtx() {
  const tables = new Map(); let seq = 0;
  const tbl = n => { if (!tables.has(n)) tables.set(n, new Map()); return tables.get(n); };
  const clone = r => JSON.parse(JSON.stringify(r));
  const resolveRef = r => (r && r.__ref) ? registry[r.__ref.split('.')[0]].namespace[r.__ref.split('.')[1]] : r;
  const db = {
    async get(id) { const r = tbl(String(id).split(':')[0]).get(id); return r ? clone(r) : null; },
    async insert(table, doc) { const id = `${table}:${++seq}`; tbl(table).set(id, { _id: id, ...clone(doc) }); return id; },
    async patch(id, fields) {
      const row = tbl(String(id).split(':')[0]).get(id);
      if (!row) throw new Error('patch missing ' + id);
      for (const [k, val] of Object.entries(fields)) { if (val === undefined) delete row[k]; else row[k] = clone(val); }
    },
    query(table) {
      return {
        withIndex(name, fn) {
          const filters = [];
          const q = { eq: (f, val) => { filters.push([f, val]); return q; } };
          fn(q);
          const rows = () => [...tbl(table).values()].filter(r => filters.every(([f, val]) => r[f] === val));
          return {
            unique: async () => { const r = rows(); return r.length ? clone(r[0]) : null; },
            collect: async () => rows().map(clone),
            first: async () => { const r = rows(); return r.length ? clone(r[0]) : null; },
            order: () => ({ take: async n => rows().reverse().slice(0, n).map(clone) }),
          };
        },
      };
    },
  };
  const ctx = {
    db,
    runQuery: async (r, a) => resolveRef(r).handler(ctx, a),
    runMutation: async (r, a) => resolveRef(r).handler(ctx, a),
    runAction: async (r, a) => resolveRef(r).handler(ctx, a),
  };
  return { ctx, tbl };
}

const sha = s => createHash('sha256').update(s).digest('hex');
async function dispatch(ctx, b) {
  const tokenHash = sha(b.token);
  const D = registry.decisions.namespace;
  switch (b.op) {
    case 'begin': return D.begin.handler(ctx, { tokenHash, seed: b.seed });
    case 'prepare': return D.prepare.handler(ctx, { tokenHash, snapshot: b.snapshot, plan: b.plan });
    case 'stage': return D.stage.handler(ctx, { tokenHash, day: b.day, plan: b.plan });
    case 'commit': return D.commit.handler(ctx, { tokenHash, day: b.day, plan: b.plan });
    case 'finish': return D.finish.handler(ctx, { tokenHash, day: b.day, state: b.state, ownerName: b.ownerName });
    case 'abandon': return D.abandon.handler(ctx, { tokenHash });
    default: return { ok: false, why: 'bad op' };
  }
}

const { ctx, tbl } = makeCtx();
const D = registry.decisions.namespace, A = registry.agentmail.namespace, X = registry.exchange.namespace;
const H = (m, f, args) => m[f].handler(ctx, args);
const snap1 = { day: 1, index: 1.0, debt: 0, contract: null, extraFee: 0, staffCondition: 1 };
const snap2 = { day: 2, index: 1.1, debt: 10, contract: null, extraFee: 0, staffCondition: 0.9 };
const hold = { hedge: 'hold', staffing: 'work', marketing: { sample: false, sponsor: false } };
const contract = { hedge: 'contract', staffing: 'work', marketing: { sample: false, sponsor: false } };
const TOK = 'a'.repeat(64), TOK2 = 'b'.repeat(64);

{
  const b1 = await H(D, 'begin', { tokenHash: sha(TOK), seed: 7 });
  const b2 = await H(D, 'begin', { tokenHash: sha(TOK), seed: 7 });
  check(b1.ok && b2.ok && b1.campaignId === b2.campaignId, 'begin retry with same token returns same campaign');
  const camp = tbl('campaigns').get(b1.campaignId);
  check(camp && camp.day === 0 && tbl('regulars').size > 0, 'begin seeds campaign + regulars');

  const badDay = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: { ...snap1, day: 3 }, plan: hold });
  check(badDay.ok === false, 'prepare on the wrong day rejected');
  const badSnap = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: { ...snap1, index: 9 }, plan: hold });
  check(badSnap.ok === false, 'prepare with invalid snapshot rejected');

  const p1 = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: snap1, plan: hold });
  check(p1.ok && p1.decisionId && p1.status === 'pending', 'prepare day1 creates pending decision');
  const p1b = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: snap1, plan: hold });
  check(p1b.ok && p1b.decisionId === p1.decisionId, 'prepare retry same snapshot idempotent');
  const pConf = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: { ...snap1, index: 1.4 }, plan: hold });
  check(pConf.ok === false && pConf.why === 'conflicting snapshot', 'conflicting snapshot retry rejected');

  const noAuth = await H(D, 'authorizeDecision', { tokenHash: sha(TOK2), decisionId: p1.decisionId });
  check(noAuth === null, 'wrong token cannot read a decision');
  const auth = await H(D, 'authorizeDecision', { tokenHash: sha(TOK), decisionId: p1.decisionId });
  check(auth && auth.day === 1 && auth.plan.hedge === 'hold', 'right token authorizes the pending decision');

  const s1 = await H(D, 'stage', { tokenHash: sha(TOK), day: 1, plan: contract });
  check(s1.ok && s1.status === 'pending', 'stage updates the pending plan');
  const s2 = await H(D, 'stage', { tokenHash: sha(TOK), day: 1, plan: hold });
  check(s2.ok && tbl('dayDecisions').get(p1.decisionId).plan.hedge === 'hold', 'stage is reversible');
  const badStage = await H(D, 'stage', { tokenHash: sha(TOK), day: 1, plan: { ...hold, hedge: 'bogus' } });
  check(badStage.ok === false, 'stage validates the plan');

  const c1 = await H(D, 'commit', { tokenHash: sha(TOK), day: 1, plan: hold });
  check(c1.ok && c1.result.ok && c1.source === 'browser' && c1.duplicate === false, 'browser commit wins day1');
  const c1b = await H(D, 'commit', { tokenHash: sha(TOK), day: 1, plan: contract });
  check(c1b.ok && c1b.duplicate === true && c1b.source === 'browser' && c1b.result.plan.hedge === 'hold',
    'lost-response retry returns the same committed result');
  const fin1 = await H(D, 'finish', { tokenHash: sha(TOK), day: 1, state: { index: 1.1, debt: 10, contract: null, till: 40, rep: 62, matchaPrice: 4.8 } });
  check(fin1.ok && fin1.phase === 'review', 'finish closes the day into review');
  const fin1b = await H(D, 'finish', { tokenHash: sha(TOK), day: 1, state: { index: 1.1, debt: 10, contract: null, till: 40, rep: 62, matchaPrice: 4.8 } });
  check(fin1b.ok && fin1b.phase === 'review', 'finish retry is idempotent');
  check(tbl('campaigns').get(b1.campaignId).day === 1 && tbl('campaigns').get(b1.campaignId).debt === 10, 'finish mirrors closing state, day advances');

  const p2 = await H(D, 'prepare', { tokenHash: sha(TOK), snapshot: snap2, plan: hold });
  check(p2.ok && p2.day === 2, 'prepare day2 after finish');
  const stale = await H(D, 'commit', { tokenHash: sha(TOK), day: 1, plan: hold });
  check(stale.ok === false && stale.why === 'stale decision', 'stale day commit rejected');

  await H(A, 'recordOutbound', { campaignId: b1.campaignId, decisionId: p2.decisionId, day: 2, to: 'Patron@Example.com', threadId: 'th-1', subject: 'day 2 plan', body: 'posted' });
  const wrongFrom = await H(A, 'resolveThread', { threadId: 'th-1', from: 'intruder@example.com' });
  check(wrongFrom === null, 'wrong recipient cannot resolve the thread');
  const rightFrom = await H(A, 'resolveThread', { threadId: 'th-1', from: 'Patron <patron@example.com>' });
  check(rightFrom && rightFrom.decisionId === p2.decisionId && rightFrom.day === 2, 'right recipient resolves thread + decision');

  const quoted = await H(A, 'handleInbound', { campaignId: b1.campaignId, decisionId: p2.decisionId, day: 2, subject: 'contract', body: '> contract\nOn Tue, someone wrote:', from: 'patron@example.com', deliveryId: 'del-q' });
  check(quoted.ok === false, 'subject and quoted lines never parse as commands');

  const e1 = await H(A, 'handleInbound', { campaignId: b1.campaignId, decisionId: p2.decisionId, day: 2, subject: 're: plan', body: 'contract\n\nthanks', from: 'patron@example.com', deliveryId: 'del-1' });
  check(e1.ok && e1.action === 'contract' && e1.source === 'email' && e1.duplicate === false, 'email-first commit wins day2');
  const e2 = await H(A, 'handleInbound', { campaignId: b1.campaignId, decisionId: p2.decisionId, day: 2, subject: 're: plan', body: 'settle', from: 'patron@example.com', deliveryId: 'del-2' });
  check(e2.ok && e2.duplicate === true && e2.source === 'email', 'second email does not override the committed plan');
  const eDup = await H(A, 'handleInbound', { campaignId: b1.campaignId, decisionId: p2.decisionId, day: 2, subject: 're: plan', body: 'contract', from: 'patron@example.com', deliveryId: 'del-1' });
  check(eDup.ok && eDup.duplicate === true, 'duplicate webhook delivery deduped');
  const archived = [...tbl('letters').values()].filter(l => l.deliveryId === 'del-1' && l.dir === 'in');
  check(archived.length === 1, 'inbound delivery archived exactly once');

  const c2 = await H(D, 'commit', { tokenHash: sha(TOK), day: 2, plan: hold });
  check(c2.ok && c2.duplicate === true && c2.source === 'email' && c2.result.plan.hedge === 'contract',
    'browser commit after email returns the recorded email plan');
  const camp2 = tbl('campaigns').get(b1.campaignId);
  check(camp2.debt === c2.result.debt && camp2.contractUnits === c2.result.contract.units, 'email result patched once: debt+contract on campaign');
  const debtAfter = tbl('campaigns').get(b1.campaignId).debt;
  await H(D, 'commit', { tokenHash: sha(TOK), day: 2, plan: hold });
  check(tbl('campaigns').get(b1.campaignId).debt === debtAfter, 'interest/fee applied once — repeat commit adds nothing');

  await assert.rejects(() => H(X, 'openDay', { campaignId: b1.campaignId }), /managed campaign/, 'managed openDay rejected');
  await assert.rejects(() => H(X, 'contractBeans', { campaignId: b1.campaignId }), /managed campaign/, 'managed contractBeans rejected');
  await assert.rejects(() => H(X, 'mirrorState', { campaignId: b1.campaignId, debt: 999 }), /managed campaign/, 'managed mirrorState rejected');
  await assert.rejects(() => H(X, 'settleDebt', { campaignId: b1.campaignId, amount: 1 }), /managed campaign/, 'managed settleDebt rejected');

  const ab = await H(D, 'abandon', { tokenHash: sha(TOK) });
  check(ab.ok, 'abandon succeeds');
  const afterAb = await H(D, 'commit', { tokenHash: sha(TOK), day: 2, plan: hold });
  check(afterAb.ok === false, 'abandoned session cannot commit');

  const b3 = await H(D, 'begin', { tokenHash: sha(TOK2), seed: 7 });
  const sess3 = [...tbl('planSessions').values()].find(s => s.campaignId === b3.campaignId);
  sess3.expiresAt = 1;
  const exp = await H(D, 'prepare', { tokenHash: sha(TOK2), snapshot: snap1, plan: hold });
  check(exp.ok === false, 'expired session rejected');
  const mal = await H(A, 'handleInbound', { campaignId: 'campaigns:999', decisionId: 'dayDecisions:999', day: 1, subject: 'x', body: 'hold' });
  check(mal.ok === false, 'malformed ids rejected');
}
console.log('HANDLERS begin/prepare/stage/commit/finish/abandon + email arbitration verified on the real wrappers');

{
  const TOK3 = 'd'.repeat(64);
  const campCount = tbl('campaigns').size;
  const bAb = await H(D, 'begin', { tokenHash: sha(TOK), seed: 9 });
  check(bAb.ok === false && /expired or abandoned/.test(bAb.why || ''), 'abandoned token cannot begin again');
  check(tbl('campaigns').size === campCount, 'abandoned token begin creates no new campaign');
  const bExp = await H(D, 'begin', { tokenHash: sha(TOK2), seed: 9 });
  check(bExp.ok === false && /expired or abandoned/.test(bExp.why || ''), 'expired token cannot begin again');
  check((await H(D, 'begin', { tokenHash: 'zz', seed: 1 })).ok === false, 'malformed tokenHash rejected in begin');
  check((await H(D, 'begin', { tokenHash: sha('e'.repeat(64)), seed: 1.5 })).ok === false, 'non-integer seed rejected in begin');

  const b4 = await H(D, 'begin', { tokenHash: sha(TOK3), seed: 3 });
  check(b4.ok, 'fresh run begins');
  const posted = { hedge: 'hold', staffing: 'work', marketing: { sample: true, sponsor: false } };
  const pA = await H(D, 'prepare', { tokenHash: sha(TOK3), snapshot: snap1, plan: posted });
  await H(A, 'recordOutbound', { campaignId: b4.campaignId, decisionId: pA.decisionId, day: 1, to: 'pat@x.com', threadId: 'th-9', subject: 'plan', body: 'x', postedPlan: posted });
  await H(D, 'stage', { tokenHash: sha(TOK3), day: 1, plan: hold });
  const map = await H(A, 'resolveThread', { threadId: 'th-9', from: 'pat@x.com' });
  check(map && map.postedPlan && map.postedPlan.marketing.sample === true, 'thread mapping returns the frozen postedPlan');
  const eIn = await H(A, 'handleInbound', { campaignId: b4.campaignId, decisionId: pA.decisionId, day: 1, subject: 're', body: 'hold', from: 'pat@x.com', deliveryId: 'del-9', postedPlan: map.postedPlan });
  check(eIn.ok && eIn.duplicate === false && eIn.source === 'email', 'inbound reply commits through the frozen posted plan');
  check(tbl('dayDecisions').get(pA.decisionId).plan.marketing.sample === true, 'committed plan is the posted plan, not the drifted draft');
  const pRetr = await H(D, 'prepare', { tokenHash: sha(TOK3), snapshot: snap1, plan: hold });
  check(pRetr.ok && pRetr.decisionId === pA.decisionId
    && tbl('dayDecisions').get(pA.decisionId).plan.marketing.sample === true,
    'idempotent prepare during trading retrieves the record without rewriting the plan');

  const st1 = { index: 1.05, debt: 0, contract: null, till: 55, rep: 60, matchaPrice: 4.8 };
  const f1 = await H(D, 'finish', { tokenHash: sha(TOK3), day: 1, state: st1, ownerName: 'tester' });
  check(f1.ok && f1.phase === 'review', 'finish day1 ok with owner');
  const stands1 = [...tbl('stands').values()].filter(s => s.campaignId === b4.campaignId);
  check(stands1.length === 1 && stands1[0].ownerName === 'tester' && stands1[0].till === 55, 'finish upserts the managed stand row');
  const f1b = await H(D, 'finish', { tokenHash: sha(TOK3), day: 1, state: st1, ownerName: 'tester' });
  check(f1b.ok && [...tbl('stands').values()].filter(s => s.campaignId === b4.campaignId).length === 1, 'finish retry never duplicates the stand row');
  check((await H(D, 'finish', { tokenHash: sha(TOK3), day: 1, state: { ...st1, till: 999 } })).ok === false, 'conflicting closing state rejected');
  check((await H(D, 'finish', { tokenHash: sha(TOK3), day: 1, state: { ...st1, index: 9 } })).ok === false, 'out-of-range closing state rejected');
  const S = registry.stands.namespace;
  await assert.rejects(() => H(S, 'recordStand', { campaignId: b4.campaignId, ownerName: 'x', till: 1, reputation: 1 }), /managed campaign/, 'managed recordStand rejected');

  const TOK5 = '9'.repeat(64);
  const bM = await H(D, 'begin', { tokenHash: sha(TOK5), seed: 4 });
  const stWalk = { index: 1, debt: 0, contract: null, till: 10, rep: 50, matchaPrice: 4.8 };
  for (const d of [1, 2]) {
    await H(D, 'prepare', { tokenHash: sha(TOK5), snapshot: { day: d, index: 1, debt: 0, contract: null, extraFee: 0, staffCondition: 1 }, plan: hold });
    await H(D, 'commit', { tokenHash: sha(TOK5), day: d, plan: hold });
    await H(D, 'finish', { tokenHash: sha(TOK5), day: d, state: stWalk });
  }
  const snap3 = { day: 3, index: 1.2, debt: 0, contract: null, extraFee: 0, staffCondition: 0.3 };
  const mailPlan = { hedge: 'hold', staffing: 'apprentice', marketing: { sample: true, sponsor: true } };
  const pM = await H(D, 'prepare', { tokenHash: sha(TOK5), snapshot: snap3, plan: mailPlan });
  check(pM.ok, 'day-3 prepare ok for mail quote');
  await H(D, 'stage', { tokenHash: sha(TOK5), day: 3, plan: mailPlan });
  const { quoteDayPlan } = await import('../js/economy.js');
  const { modifiersForDay } = await import('../js/gentrification.js');
  const qMail = quoteDayPlan({ day: 3, hedge: 'hold', staffing: 'apprentice', marketing: { sample: true, sponsor: true }, debt: 0, extraFee: 0, modifiers: modifiersForDay(3) });
  const qNoMod = quoteDayPlan({ day: 3, hedge: 'hold', staffing: 'apprentice', marketing: { sample: true, sponsor: true }, debt: 0, extraFee: 0, modifiers: {} });
  check(Math.abs(qMail.fixedMinimum - (qNoMod.fixedMinimum + 20)) < 1e-9, 'day-3 pitch revaluation lifts the fixed floor by £20');
  let mailText = '';
  const prevCtxFetch = context.fetch;
  process.env.AGENTMAIL_API_KEY = 'test-key'; process.env.AGENTMAIL_INBOX_ID = 'inbox1';
  context.fetch = async (u, o) => { mailText = JSON.parse(o.body).text; return { ok: true, json: async () => ({ thread_id: 'th-mail' }) }; };
  let mailErr = null, mailed = null;
  try { mailed = await H(A, 'sendPlanMail', { tokenHash: sha(TOK5), decisionId: pM.decisionId, to: 'buyer@x.com' }); } catch (e) { mailErr = e; }
  context.fetch = prevCtxFetch;
  check(mailed && mailed.ok === true && mailed.threadId === 'th-mail', `sendPlanMail posts through AgentMail: ${JSON.stringify(mailed) || mailErr && mailErr.message}`);
  check(mailText.includes(`fixed subtotal ${qMail.fixedMinimum.toFixed(2)}`), 'mailed quote carries the modifier-adjusted fixed subtotal');
  check(mailText.includes(`committed minimum ${(qMail.fixedMinimum + qMail.contractFee + qMail.interest).toFixed(2)}`), 'committed minimum is fixed + fee + interest');
  check(mailText.includes(`training ${qMail.training.toFixed(2)}`) && qMail.training > 0, 'mailed quote lists apprentice training');
  check(mailText.includes(`sampling ${qMail.sampling.toFixed(2)}`) && qMail.sampling > 0, 'mailed quote lists sampling');
  check(mailText.includes(`sponsor ${qMail.marketing.toFixed(2)}`) && qMail.marketing > 0, 'mailed quote lists sponsorship');

  const TOK4 = 'f'.repeat(64);
  const b5 = await H(D, 'begin', { tokenHash: sha(TOK4), seed: 5 });
  for (let d = 1; d <= 5; d++) {
    const sp = { day: d, index: 1, debt: 0, contract: null, extraFee: 0, staffCondition: 1 };
    const pp = await H(D, 'prepare', { tokenHash: sha(TOK4), snapshot: sp, plan: hold });
    check(pp.ok, `day${d} prepare ok`);
    const cc = await H(D, 'commit', { tokenHash: sha(TOK4), day: d, plan: hold });
    check(cc.ok, `day${d} commit ok`);
    const ff = await H(D, 'finish', { tokenHash: sha(TOK4), day: d, state: { index: 1, debt: 0, contract: null, till: 10, rep: 50, matchaPrice: 4.8 } });
    check(ff.ok && ff.phase === (d < 5 ? 'review' : 'done'), `day${d} finish → ${ff.phase}`);
    check((await H(D, 'finish', { tokenHash: sha(TOK4), day: d, state: { index: 1, debt: 0, contract: null, till: 10, rep: 50, matchaPrice: 4.8 } })).ok, `day${d} finish idempotent`);
  }
  const campsBefore = tbl('campaigns').size;
  const bDone = await H(D, 'begin', { tokenHash: sha(TOK4), seed: 1 });
  check(tbl('campaigns').size === campsBefore && (!bDone.ok || bDone.campaignId === b5.campaignId),
    'done session begin never creates a new campaign');
  check(tbl('campaigns').get(b5.campaignId).day === 5, 'campaign day reached 5');
}
console.log('LIFECYCLE token rebinding, frozen postedPlan, closing-state idempotence, managed stand, day5 done verified');

{
  const httpCtx = { ...ctx, request: null };
  const find = (path, method) => httpRoutes.find(r => r.path === path && r.method === method).handler;
  const planH = find('/sync/plan', 'POST');
  const post = (h, body, headers = {}) => h(httpCtx, new Request('http://x', { method: 'POST', body, headers }));
  const badTok = await post(planH, JSON.stringify({ op: 'begin', token: 'zz', seed: 1 }));
  check(badTok.status === 400, 'sync/plan rejects malformed token');
  check((await post(planH, 'null')).status === 400, 'sync/plan rejects null body');
  check((await post(planH, '[]')).status === 400, 'sync/plan rejects array body');
  check((await post(planH, JSON.stringify({ op: 'commit', token: 'g'.repeat(64) }))).status === 400, 'sync/plan rejects missing day/plan');

  const mailH = find('/agentmail/letter', 'POST');
  const badTo = await post(mailH, JSON.stringify({ to: 42, decisionId: 'x', token: 'g'.repeat(64) }));
  check(badTo.status === 400, 'mailLetter rejects non-string recipient');

  const hook = find('/agentmail/webhook', 'POST');
  process.env.AGENTMAIL_WEBHOOK_SECRET = 'whsec_' + btoa('test-secret-key');
  const whBody = JSON.stringify({ type: 'message.received', data: { thread_id: 'th-x', message_id: 'm1', subject: 're', body: 'hold', from: 'p@x.com', id: 'del-x' } });
  const sigFor = (id, ts, body) => {
    const keyBytes = Uint8Array.from(atob(process.env.AGENTMAIL_WEBHOOK_SECRET.slice(6)), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${body}`)))
      .then(out => 'v1,' + btoa(String.fromCharCode(...new Uint8Array(out))));
  };
  const hdrs = async (id, ts, body) => ({ 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': await sigFor(id, ts, body) });
  const now = Math.floor(Date.now() / 1000);
  check((await post(hook, whBody, { 'svix-id': 'i1', 'svix-timestamp': 'garbage', 'svix-signature': 'v1,x' })).status === 401,
    'webhook rejects non-numeric timestamp');
  check((await post(hook, whBody, await hdrs('i1', now - 4000, whBody))).status === 401, 'webhook rejects stale timestamp');
  check((await post(hook, whBody, { 'svix-id': 'i1', 'svix-timestamp': String(now), 'svix-signature': 'v1,bogus' })).status === 401,
    'webhook rejects bad signature');
  const good = await post(hook, whBody, await hdrs('i1', now, whBody));
  check(good.status === 200, 'webhook accepts a valid signed delivery');

  const TOKH = 'e7'.repeat(32);
  const pj = r => r.json();
  check((await pj(await post(planH, JSON.stringify({ op: 'begin', token: TOKH, seed: 3 })))).ok, 'HTTP begin accepted');
  const hPlan = { hedge: 'hold', staffing: 'work', marketing: { sample: false, sponsor: false } };
  const hSnap = { day: 1, index: 1, debt: 0, contract: null, extraFee: 0, staffCondition: 1 };
  check((await pj(await post(planH, JSON.stringify({ op: 'prepare', token: TOKH, snapshot: hSnap, plan: hPlan })))).ok, 'HTTP prepare accepted');
  check((await pj(await post(planH, JSON.stringify({ op: 'commit', token: TOKH, day: 1, plan: hPlan })))).ok, 'HTTP commit accepted');
  const hState = { index: 1, debt: 0, contract: null, till: 42, rep: 60, matchaPrice: 4.8 };
  const fHttp = await pj(await post(planH, JSON.stringify({ op: 'finish', token: TOKH, day: 1, state: hState, ownerName: '  Http Owner  ' })));
  check(fHttp.ok === true, 'HTTP finish accepted end-to-end');
  const httpStand = [...tbl('stands').values()].filter(s => s.ownerName === 'Http Owner');
  check(httpStand.length === 1 && httpStand[0].till === 42, 'HTTP finish upserts the stand row under the normalized ownerName');
}
console.log('HTTP /sync/plan, /agentmail/letter and Svix verification verified through the real handlers');

function matchTok(el, tok) {
  if (!el || !el.tagName) return false;
  if (tok.startsWith('#')) return el.id === tok.slice(1);
  if (tok.startsWith('.')) return !!(el.classList && el.classList.contains(tok.slice(1)));
  const m = tok.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (m) return el.hasAttribute ? (m[2] === undefined ? el.hasAttribute(m[1]) : el.getAttribute(m[1]) === m[2]) : false;
  return el.tagName === tok.toUpperCase();
}
function chainOk(el, toks) {
  if (toks.length === 1) return true;
  let a = el.parentElement;
  for (let i = toks.length - 2; i >= 0 && a; i--) {
    while (a && !matchTok(a, toks[i])) a = a.parentElement;
    if (!a) return false;
    a = a.parentElement;
  }
  return true;
}
function collect(el, pred, out = []) {
  for (const c of el.children || []) { if (pred(c)) out.push(c); collect(c, pred, out); }
  return out;
}
function makeDoc() {
  const doc = { activeElement: null, defaultView: null };
  function el(tag = 'div', id = '') {
    const e = {
      tagName: String(tag).toUpperCase(), id, children: [], _parent: null, attrs: {},
      style: {}, dataset: {}, disabled: false, hidden: false, inert: false,
      isConnected: true, textContent: '', onclick: null, value: '',
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { e.attrs[k] = String(v); },
      getAttribute(k) { return e.attrs[k]; },
      hasAttribute(k) { return k in e.attrs; },
      removeAttribute(k) { delete e.attrs[k]; },
      appendChild(c) { c._parent = e; e.children.push(c); return c; },
      append(...cs) { for (const c of cs) e.appendChild(c); },
      prepend(...cs) { for (const c of cs) { c._parent = e; e.children.unshift(c); } },
      remove() { e.isConnected = false; const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
      focus() { doc.activeElement = e; },
      click() { if (!e.disabled && e.onclick) e.onclick({ preventDefault() {} }); },
      matches(sel) { return sel.split(',').some(s => matchTok(e, s.trim())); },
      querySelector(sel) { return e.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const parts = sel.split(',').map(s => s.trim().split(/\s+/));
        const out = [];
        collect(e, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out);
        return out;
      },
      get parentElement() { return e._parent; },
      get isContentEditable() { let a = e; while (a) { if (a.attrs && a.attrs.contenteditable !== undefined && a.attrs.contenteditable !== 'false') return true; a = a._parent; } return false; },
      closest(sel) { let a = e; while (a) { if (a.matches && a.matches(sel)) return a; a = a._parent; } return null; },
      get lastChild() { return e.children[e.children.length - 1]; },
    };
    return e;
  }
  doc.createElement = el;
  doc.body = el('body');
  const byId = new Map();
  doc.getElementById = id => byId.get(id) || null;
  doc.register = (id, e) => { e.id = id; byId.set(id, e); return e; };
  return doc;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

{
  const schedule = JSON.parse(read('out/wave_schedule.json'));
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
      if (k === 'then') return undefined;
      return anyProxy();
    },
    set: () => true, apply: () => anyProxy(),
  });
  const doc = makeDoc();
  const registry2 = new Map();
  const mk = (tag, id) => {
    const e = doc.createElement(tag); e.id = id;
    e.getContext = () => anyProxy();
    e.querySelectorAll = sel => { const parts = sel.split(',').map(s => s.trim().split(/\s+/)); const out = []; collect(e, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out); return out; };
    e.querySelector = sel => { const r = e.querySelectorAll(sel)[0]; if (r) return r; return e.appendChild(mk('div', '')); };
    return e;
  };
  const MODAL_IDS = new Set(['brief', 'offer', 'letter', 'licence', 'paywall', 'desk', 'receipt', 'tutorial', 'title']);
  const CHILD_PARENT = {
    'review-last': 'brief', 'desklink': 'letter', 'open': 'title', 'shareWeek': 'receipt',
    'review-continue': 'receipt', 'review-letter': 'receipt',
    tbody: 'tutorial', ttitle: 'tutorial', tstep: 'tutorial', tnext: 'tutorial', tskip: 'tutorial', tclose: 'tutorial', again: 'receipt',
  };
  const PREFIX_PARENT = { brief: 'brief', offer: 'offer', letter: 'letter', lic: 'licence', licence: 'licence', pw: 'paywall', paywall: 'paywall', desk: 'desk', r: 'receipt', receipt: 'receipt' };
  const getEl = id => {
    if (!registry2.has(id)) {
      const e = mk('div', id); registry2.set(id, e);
      const par = MODAL_IDS.has(id) ? doc.body : (CHILD_PARENT[id] ? getEl(CHILD_PARENT[id]) : (PREFIX_PARENT[id.split('-')[0]] ? getEl(PREFIX_PARENT[id.split('-')[0]]) : doc.body));
      par.appendChild(e);
    }
    return registry2.get(id);
  };
  globalThis.document = {
    getElementById: getEl,
    createElement: t => t === 'canvas' ? { width: 480, height: 72, getContext: () => anyProxy(), style: {}, addEventListener() {} } : mk(t, ''),
    createElementNS: () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} }),
    querySelectorAll: sel => {
      const parts = sel.split(',').map(s => s.trim().split(/\s+/));
      const out = [];
      collect(doc.body, c => parts.some(toks => matchTok(c, toks[toks.length - 1]) && chainOk(c, toks)), out);
      return out;
    },
    body: doc.body,
    get activeElement() { return doc.activeElement; },
  };
  globalThis.window = globalThis;
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  globalThis.devicePixelRatio = 1;
  globalThis.location = { search: '?speed=1200&convex=http://x', hostname: 'localhost', origin: 'http://x' };
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = () => {};
  let failPlan = false, holdCommit = null, holdBegin = null, holdStage = null, loseCommit = false, inboxLetter = null, mailCalls = 0;
  const reqLog = [];
  globalThis.fetch = (u, opts = {}) => {
    const s = String(u);
    if (s.includes('/sync/plan')) {
      const b = JSON.parse(opts.body);
      reqLog.push({ op: b.op, token: b.token });
      const respond = async () => { const d = await dispatch(ctx, b); return { ok: true, status: 200, json: async () => d }; };
      if (failPlan) return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: 'down' }) });
      if (b.op === 'commit' && loseCommit) { const d = dispatch(ctx, b); return d.then(() => ({ ok: false, status: 503, json: async () => ({ error: 'lost' }) })); }
      if (b.op === 'commit' && holdCommit) return new Promise(res => holdCommit.push(res)).then(() => respond());
      if (b.op === 'stage' && holdStage) return new Promise(res => holdStage.push(res)).then(() => respond());
      if (b.op === 'begin' && holdBegin) return new Promise(res => holdBegin.push(res)).then(() => respond());
      return respond();
    }
    if (s.includes('/agentmail/letter')) { mailCalls++; return Promise.resolve({ ok: false, status: 503, json: async () => ({ ok: false, why: 'no mail' }) }); }
    if (s.includes('/agentmail/inbox')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ letter: inboxLetter }) });
    if (s.includes('/ai/research')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ fallback: true }) });
    if (s.includes('/sync/')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ stands: [] }) });
    return Promise.resolve({ ok: true, status: 200, json: async () => schedule });
  };
  class AC { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
    createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
    resume() {} }
  globalThis.AudioContext = AC;
  globalThis.__headless = true;
  let _rs = 777;
  Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
  const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };

  await import('../js/main.js');
  await sleep(60);
  const G = globalThis.__grunds;
  check(G.sync.managed() === true, 'connected run is managed');
  globalThis.document.getElementById('open').click();
  await sleep(30);
  check(G.phase === 'planning', `connected prepare leaves phase planning, got ${G.phase}`);
  for (let i = 0; i < 40 && ![...tbl('dayDecisions').values()].some(d => d.status); i++) await sleep(10);
  const prepared = [...tbl('dayDecisions').values()].find(d => d.day === 1);
  check(!!prepared, 'preparePlan posted a pending decision for day1');

  const c = await G.commitDayPlan();
  check(c && c.ok === true && G.phase === 'trading', `connected commit resolves and opens the day, got ${G.phase}`);
  check(tbl('dayDecisions').get(prepared._id).status === 'committed', 'server decision committed by browser');

  G.reset();
  await sleep(40);
  check(G.phase === 'planning', `reset re-enters planning on a fresh run (phase=${G.phase})`);
  G.renderBrief();
  check(G.modals.top() === 'brief', 'brief opens on the fresh run');
  const runs = [...tbl('planSessions').values()];
  check(runs.filter(s => s.phase === 'abandoned').length >= 1, 'reset abandoned the previous session');

  holdCommit = [];
  const pend = G.commitDayPlan();
  check(typeof pend.then === 'function', 'connected commit returns a promise');
  await sleep(10);
  check(registry2.get('brief-offline').style.display === 'none', 'saving status never offers the local-only fallback');
  G.reset();
  check(registry2.get('brief-open').disabled === false, 'reset re-enables OPEN during an in-flight commit');
  await sleep(40);
  check(holdCommit.length === 1, 'the old commit request is still in flight');
  holdCommit.forEach(r => r()); holdCommit = null;
  const late = await pend;
  check(late && late.ok === false && late.why === 'run reset', `delayed commit after reset is discarded: ${late && late.why}`);
  check(G.phase === 'planning' && G.stats().debt === 0, 'stale connected result never applied after reset');

  failPlan = true;
  const denied = await G.commitDayPlan();
  check(denied && denied.ok === false && G.phase === 'planning', 'unreachable commit stays planning, never falls back locally');
  check(/Could not save the plan/.test(registry2.get('brief-error').textContent), 'readable brief-error shown');
  check(G.sync.managed() === true, 'managed mode not silently disabled');
  failPlan = false;

  inboxLetter = { head: 'RE: plan', body: 'Inbound reply (contract): contract', action: 'contract', day: 1, createdAt: Date.now() };
  const letter = await G.sync.inbox(0);
  const debtNow = G.stats().debt;
  check(letter && letter.action === 'contract' && G.stats().debt === debtNow, 'inbox mirror never re-applies finance');
  inboxLetter = null;

  registry2.get('brief-offline').click();
  await sleep(40);
  check(G.sync.managed() === false, 'brief-offline explicitly disables managed sync');
  check(G.phase === 'planning', 'local-only week re-enters planning');
  const local = G.commitDayPlan();
  check(local && local.ok === true && typeof local.then !== 'function' && G.phase === 'trading', 'local-only commit resolves synchronously');
  const mailRes = await G.sync.sendPlanMail('p@x.com', null);
  check(mailRes.ok === false, 'managed mail disabled in local-only mode');

  reqLog.length = 0;
  await sleep(30);
  check(!reqLog.some(r => r.op !== 'abandon'), 'local-only week performs no managed writes');

  holdBegin = [];
  const heldBegin = G.sync.beginRun(11);
  await sleep(5);
  const heldPrepare = G.sync.preparePlan(snap1, hold);
  const heldStage = G.sync.stagePlan(contract, 1);
  const oldTok = reqLog.find(r => r.op === 'begin').token;
  reqLog.length = 0;
  G.reset();
  await sleep(20);
  const newTok = reqLog.find(r => r.op === 'begin') && reqLog.find(r => r.op === 'begin').token;
  check(newTok && newTok !== oldTok, 'reset rotates to a fresh run token');
  holdBegin.forEach(r => r()); holdBegin = null;
  const hb = await heldBegin.catch(e => ({ ok: false, why: e.message }));
  const hp = await heldPrepare.catch(e => ({ ok: false, why: e.message }));
  const hs = await heldStage.catch(e => ({ ok: false, why: e.message }));
  check(hb && hb.ok === false && hb.why === 'run reset', 'delayed old begin resolves as run reset');
  check(hp.ok === false && hs.ok === false, 'queued old prepare/stage reject after reset');
  check(reqLog.some(r => r.op === 'abandon' && r.token === oldTok), 'reset posts the single best-effort abandon for the old token');
  check(!reqLog.some(r => r.token === oldTok && r.op !== 'abandon'), 'old queued ops never post under the old token after reset');
  await sleep(40);
  check(G.sync.managed() === true && /^campaigns:/.test(G.sync.campaignId || ''), 'new run owns its own campaign, old results cannot overwrite it');

  loseCommit = true;
  const lost1 = await G.commitDayPlan().catch(e => ({ ok: false, why: e.message }));
  loseCommit = false;
  check(lost1 && lost1.ok === false, 'lost commit response surfaces as an error');
  const lost2 = await G.commitDayPlan();
  check(lost2 && lost2.ok === true && G.phase === 'trading', 'commit retry returns the committed result and opens the day');
  check([...tbl('dayDecisions').values()].filter(d => d.day === 1 && d.status === 'committed' && d.campaignId === G.sync.campaignId).length === 1,
    'the retried commit never creates a second decision');

  const stOk = { index: 1, debt: 0, contract: null, till: 10, rep: 50, matchaPrice: 4.8 };
  failPlan = true;
  const fFail = await G.sync.finishDay(1, stOk).catch(e => ({ ok: false, why: e.message }));
  failPlan = false;
  check(fFail && fFail.ok === false, 'finish transport failure surfaces');
  reqLog.length = 0;
  const prep2 = await G.sync.preparePlan({ ...snap1, day: 2 }, hold);
  check(prep2 && prep2.ok === true, 'next-day prepare recovers after a failed finish');
  const ops = reqLog.map(r => r.op);
  check(ops[0] === 'finish' && ops.filter(o => o === 'finish').length === 1 && ops.includes('prepare'),
    'pending finish flushed exactly once before the next-day prepare');
  check([...tbl('dayDecisions').values()].filter(d => d.day === 2 && d.status === 'pending').length === 1,
    'exactly one next-day record prepared');

  G.sync.abandonRun();
  failPlan = true;
  const bFail = await G.sync.beginRun(13).catch(e => ({ ok: false, why: e.message }));
  failPlan = false;
  check(bFail && bFail.ok === false, 'begin transport failure surfaces');
  const bOk = await G.sync.beginRun(13);
  check(bOk && bOk.ok === true && G.sync.managed() === true, 'begin retry succeeds on the same run token');

  await G.sync.preparePlan(snap1, hold);
  holdStage = [];
  const mailPend = G.sync.sendPlanMail('p@x.com', contract, 1).catch(e => ({ ok: false, why: e.message }));
  await sleep(10);
  G.reset();
  await sleep(20);
  holdStage.forEach(r => r()); holdStage = null;
  const mailRes2 = await mailPend;
  check(mailRes2 && mailRes2.ok === false, 'queued mail send rejects after reset');
  check(mailCalls === 0, 'no /agentmail/letter request fired for the stale run');
}
console.log('INTEGRATION connected commit/reset/fallback/local-only/inbox verified headless');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — resolveDecision purity, decision handlers (browser/email arbitration, dedupe, expiry, managed guards), and connected client lifecycle verified against the real wrappers with a mock Convex DB');
process.exit(0);
