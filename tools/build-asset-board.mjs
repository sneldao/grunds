#!/usr/bin/env node
// tools/build-asset-board.mjs — the Tripothon asset board (submission link).
//
// One row per district slot: slot · provider · status · the exact prompt ·
// provider preview (links to the GLB) · in-game screenshot. Data comes from
// the LIVE public `/district/kit` route (no Convex auth needed), falling back
// to out/district-manifest.json per seed. The page is self-contained (inline
// CSS/JS, data baked in) and, when served from the deployment origin, also
// refreshes itself from `/district/kit` — so it fills in as Tripo grows seeds.
//
// In-game screenshots: drop `web/assets/board/seed-<N>-<slot>.(png|jpg)` or a
// whole-street `seed-<N>.(png|jpg)`; the board picks them up (see
// tools/capture-board-shots.mjs). Missing → "capture pending" placeholder.
//
// Usage: node tools/build-asset-board.mjs [seeds…] [--out file] [--base url]
//        [--offline] [--inline]     (defaults: 7 13 19 11 23 → dist/asset-board.html)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLOTS = ['lantern', 'planter', 'stall', 'sign', 'cart', 'fountain'];

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const flagVals = new Set(['--out', '--base'].map((f) => opt(f)).filter(Boolean));
const OUT = resolve(opt('--out', join(ROOT, 'dist', 'asset-board.html')));
const BASE = opt('--base', 'https://striped-anaconda-746.convex.site').replace(/\/$/, '');
const OFFLINE = argv.includes('--offline');
const INLINE = argv.includes('--inline');
const seeds = argv.filter((a) => !a.startsWith('--') && !flagVals.has(a)).map(Number);
if (seeds.some((s) => !Number.isFinite(s))) { console.error('seeds must be numbers'); process.exit(2); }
if (!seeds.length) seeds.push(7, 13, 19, 11, 23);

function manifestSeed(seed) {
  try {
    const m = JSON.parse(readFileSync(join(ROOT, 'out', 'district-manifest.json'), 'utf8'));
    return (m.seeds || []).find((s) => s.seed === seed && s.slots) || null;
  } catch { return null; }
}

async function liveKit(seed) {
  if (OFFLINE) return null;
  try {
    const r = await fetch(`${BASE}/district/kit?seed=${seed}`, { signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function liveFranchise(seed) {
  if (OFFLINE) return null;
  try {
    const r = await fetch(`${BASE}/franchise/status?seed=${seed}`, { signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function shot(name) {
  for (const ext of ['.png', '.jpg', '.webp']) {
    for (const dir of [join(dirname(OUT), 'assets', 'board'), join(ROOT, 'web', 'assets', 'board')]) {
      const f = join(dir, name + ext);
      if (!existsSync(f)) continue;
      if (INLINE) return `data:${MIME[extname(f)]};base64,${readFileSync(f).toString('base64')}`;
      return relative(dirname(OUT), f).split('\\').join('/');
    }
  }
  return null;
}

// Exact prompts from the one source of truth (convex/district.ts
// kitSpecForSeed) — so the board is right even against a deployment that
// predates /district/kit reporting prompts. Imports are stubbed; only the
// pure prompt code runs. Falls back to whatever the kit route reports.
async function loadKitSpec() {
  try {
    const ts = (await import('typescript')).default;
    const src = readFileSync(join(ROOT, 'convex', 'district.ts'), 'utf8');
    const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
    const stubs = 'const action=(d)=>d,query=(d)=>d,api={},mintKey=()=>"",assetKey=()=>"";const v=new Proxy(function(){},{get:()=>v,apply:()=>v});\n';
    const code = stubs + outputText.replace(/^import[^;]*;$/gm, '');
    return (await import('data:text/javascript,' + encodeURIComponent(code))).kitSpecForSeed;
  } catch { return null; }
}
const kitSpecForSeed = await loadKitSpec();

// Pre-routing deployments don't report provider; the CDN host does.
const inferProvider = (s) => s.provider || (s.modelUrl ? (/mint\.gg/.test(s.modelUrl) ? 'mint' : 'tripo') : null);

const data = { generatedAt: new Date().toISOString(), base: BASE, seeds: [] };
for (const seed of seeds) {
  const live = await liveKit(seed);
  const franchise = await liveFranchise(seed);
  const src = live?.slots ? { from: 'live', slots: live.slots } : manifestSeed(seed) ? { from: 'manifest', slots: manifestSeed(seed).slots } : { from: 'none', slots: {} };
  data.seeds.push({
    seed,
    from: src.from,
    street: shot(`seed-${seed}`),
    franchiseShot: shot(`seed-${seed}-franchise`),
    franchise: franchise && franchise.status !== 'missing' ? franchise : null,
    slots: SLOTS.map((slot) => {
      const s = src.slots[slot] || { status: 'missing' };
      return {
        slot,
        status: s.status || 'missing',
        provider: inferProvider(s),
        prompt: s.prompt || (kitSpecForSeed ? kitSpecForSeed(seed)[slot].prompt : null),
        modelUrl: s.modelUrl || null,
        previewUrl: s.previewUrl || null,
        shot: shot(`seed-${seed}-${slot}`),
      };
    }),
  });
  console.log(`  seed ${seed} (${src.from}): ${data.seeds.at(-1).slots.map((s) => `${s.slot}=${s.status}${s.provider ? `(${s.provider})` : ''}`).join(' ')}`);
}

// Shared by Node (static render) and the browser (live refresh).
function renderBoard(d) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const all = d.seeds.flatMap((s) => s.slots);
  const n = (f) => all.filter(f).length;
  const summary = `<p class="sum"><b>${n((s) => s.status === 'success')}</b> grown of ${all.length} slots · <span class="p tripo">tripo</span> ${n((s) => s.provider === 'tripo' && s.status === 'success')} · <span class="p mint">mint</span> ${n((s) => s.provider === 'mint' && s.status === 'success')} · processing ${n((s) => s.status === 'processing')}</p>`;
  const img = (src, alt, href) => src ? `<a href="${esc(href || src)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(src)}" alt="${esc(alt)}"></a>` : '';
  const seeds = d.seeds.map((s) => {
    let rows = s.slots.map((r) => `<tr>
      <td class="slot">${esc(r.slot)}</td>
      <td>${r.provider ? `<span class="p ${esc(r.provider)}">${esc(r.provider)}</span>` : '—'}</td>
      <td><span class="st ${esc(r.status)}">${esc(r.status)}</span></td>
      <td class="prompt">${r.prompt ? esc(r.prompt) : '<i>prompt reported by /district/kit after deploy</i>'}</td>
      <td class="img">${img(r.previewUrl, `${r.slot} preview`, r.modelUrl) || '<span class="ph">no preview yet</span>'}${r.modelUrl ? `<br><a class="glb" href="${esc(r.modelUrl)}" target="_blank" rel="noopener">GLB ↗</a>` : ''}</td>
      <td class="img">${img(r.shot || s.street, `${r.slot} in game`) || '<span class="ph">in-game capture pending</span>'}</td>
    </tr>`).join('');
    const f = s.franchise;
    if (f) rows += `<tr class="fr">
      <td class="slot">★ franchise <small>player-built</small></td>
      <td><span class="p tripo">tripo</span></td>
      <td><span class="st ${esc(f.status)}">${esc(f.status)}</span></td>
      <td class="prompt">${f.prompt ? esc(`“${f.prompt}” — described by a player, day ${f.day}`) : ''}</td>
      <td class="img">${img(f.previewUrl, 'franchise preview', f.modelUrl) || '<span class="ph">no preview yet</span>'}${f.modelUrl ? `<br><a class="glb" href="${esc(f.modelUrl)}" target="_blank" rel="noopener">GLB ↗</a>` : ''}</td>
      <td class="img">${img(s.franchiseShot || s.street, 'franchise in game') || '<span class="ph">in-game capture pending</span>'}</td>
    </tr>`;
    return `<section><h2>District seed ${esc(s.seed)} <a href="${esc(d.base)}/?seed=${esc(s.seed)}" target="_blank" rel="noopener">play ↗</a> <small>${esc(s.from)}</small></h2>
      ${s.street ? `<img class="street" src="${esc(s.street)}" alt="seed ${esc(s.seed)} street in game">` : ''}
      <table><thead><tr><th>Slot</th><th>Provider</th><th>Status</th><th>Exact prompt</th><th>Provider preview</th><th>In game</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  return summary + seeds + `<p class="foot">Snapshot ${esc(d.generatedAt)} · source ${esc(d.base)}/district/kit</p>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grunds — Generative District asset board</title>
<style>
  :root{--bg:#f6f1e7;--ink:#2a2118;--mute:#7a6a58;--line:#e2d6c3;--card:#fffaf1}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
  main{max-width:1200px;margin:0 auto;padding:28px 18px 60px}
  h1{margin:0 0 4px;font-size:26px}h2{font-size:18px;margin:28px 0 10px}h2 a{font-size:13px;font-weight:500;margin-left:8px;color:#9a5b1e}
  h2 small{font-weight:400;color:var(--mute);font-size:12px;margin-left:6px}
  .lede{color:var(--mute);margin:0 0 6px;max-width:820px}.sum{margin:12px 0}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute)}
  td.slot{font-weight:600;text-transform:capitalize}td.prompt{font:12.5px/1.45 ui-monospace,Menlo,monospace;max-width:420px}
  td.img img{width:160px;height:120px;object-fit:contain;background:#efe6d6;border-radius:6px;display:block}
  img.street{width:100%;max-height:420px;object-fit:cover;border-radius:10px;margin:0 0 10px;border:1px solid var(--line)}
  .p{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600}.p.tripo{background:#1f6f5c;color:#fff}.p.mint{background:#d9cbb4;color:#3a2e22}
  .st{font-size:12px}.st.success{color:#1f6f5c}.st.processing{color:#9a5b1e}.st.failed{color:#a12d2d}.st.missing{color:var(--mute)}
  .ph{display:inline-block;width:160px;height:120px;line-height:120px;text-align:center;font-size:12px;color:var(--mute);background:#efe6d6;border-radius:6px}
  .glb{font-size:12px;color:#9a5b1e}.foot{color:var(--mute);font-size:12px;margin-top:24px}
  @media (max-width:760px){td.prompt{max-width:none}td.img img,.ph{width:110px;height:84px;line-height:84px}}
</style></head><body><main>
<h1>Grunds — The Generative District · asset board</h1>
<p class="lede">Every street-furniture slot is grown from a District Seed: seed → six deterministic prompts → Tripo text-to-model (P1, hero slot on P2; per-slot <code>model_seed</code>/<code>texture_seed</code> derived from the seed) with Mint as the fallback provider → cached once, shared by every player on that seed. The ★ franchise row is a stand a player described in words.</p>
<div id="board">${renderBoard(data)}</div>
</main>
<script id="board-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
${renderBoard.toString()}
(async () => {
  if (!/\\.convex\\.site$/.test(location.hostname)) return; // static snapshot elsewhere
  const d = JSON.parse(document.getElementById('board-data').textContent);
  d.base = location.origin;
  let changed = false;
  for (const s of d.seeds) {
    try {
      const r = await fetch('/district/kit?seed=' + s.seed);
      if (!r.ok) continue;
      const k = await r.json();
      for (const row of s.slots) {
        const v = k.slots && k.slots[row.slot];
        if (!v) continue;
        Object.assign(row, { status: v.status, provider: v.provider || row.provider, prompt: v.prompt || row.prompt, modelUrl: v.modelUrl, previewUrl: v.previewUrl });
        changed = true;
      }
      const fr = await fetch('/franchise/status?seed=' + s.seed).then((r) => r.ok ? r.json() : null).catch(() => null);
      if (fr && fr.status !== 'missing') { s.franchise = fr; changed = true; }
      s.from = 'live';
    } catch {}
  }
  if (changed) { d.generatedAt = new Date().toISOString(); document.getElementById('board').innerHTML = renderBoard(d); }
})();
</script>
</body></html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`asset board → ${relative(ROOT, OUT) || OUT}`);
