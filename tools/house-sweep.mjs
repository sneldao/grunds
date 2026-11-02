// House-origin balance sweep. Runs the headless campaign harness
// (web/test/balance-policies.mjs --single) for every house × policy × seed
// and reports net-worth deltas against the open table on the SAME seeds.
//   node tools/house-sweep.mjs [seedCount=20]
// `informed` = the forecaster plus the Brief's house read; `scout` adds the
// rival tells (signals add: house+tell → heavy cover, one → light, a
// negative signal → ride the spot).
//   node tools/house-sweep.mjs 20 forecaster,informed,scout [colombia,eastAfrica,brazil]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HARNESS = fileURLToPath(new URL('../web/test/balance-policies.mjs', import.meta.url));
const N = Number(process.argv[2]) || 20;
const seeds = Array.from({ length: N }, (_, i) => 7 + i * 37);
const houses = ['', ...(process.argv[4] || 'colombia,eastAfrica,brazil').split(',')];
const policies = (process.argv[3] || 'passive,forecaster,informed,scout').split(',');
const jobs = [];
for (const house of houses) for (const policy of policies) for (const seed of seeds) jobs.push({ house, policy, seed });
const out = new Map();
let next = 0;
const run = (j) => new Promise((res, rej) => {
  const c = spawn(process.execPath, [HARNESS, '--single', String(j.seed), j.policy], { env: { ...process.env, GRUNDS_HOUSE: j.house } });
  let buf = ''; c.stdout.on('data', d => buf += d); c.on('close', code => { try { res(JSON.parse(buf)); } catch { rej(new Error(`${j.house}/${j.policy}/${j.seed} exit ${code}`)); } });
});
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++];
    const r = await run(j);
    out.set(`${j.house}|${j.policy}|${j.seed}`, r);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
console.log(`seeds=${N}; delta = house net worth − open table, same seed (£)\n`);
console.log('house        policy       Δmean   Δsd   win%  worst   verdicts(scarped/held/good/star/…)');
for (const house of houses.slice(1)) for (const policy of policies) {
  const d = seeds.map(s => out.get(`${house}|${policy}|${s}`).netWorth - out.get(`|${policy}|${s}`).netWorth);
  const v = {}; for (const s of seeds) { const k = out.get(`${house}|${policy}|${s}`).verdict; v[k] = (v[k] || 0) + 1; }
  console.log(`${house.padEnd(12)} ${policy.padEnd(11)} ${mean(d).toFixed(0).padStart(6)} ${sd(d).toFixed(0).padStart(5)} ${(100 * d.filter(x => x > 0).length / N).toFixed(0).padStart(5)} ${Math.min(...d).toFixed(0).padStart(6)}   ${JSON.stringify(v)}`);
}
console.log('\nopen-table baseline mean net worth:');
for (const policy of policies) console.log(' ', policy.padEnd(11), mean(seeds.map(s => out.get(`|${policy}|${s}`).netWorth)).toFixed(0));
