#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SPEC_RE = /(from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+?\.js)(\?[^'"]*)?\2/g;

export function rewriteModuleSpecifiers(src, version) {
  return src.replace(SPEC_RE, (m, head, q, spec, query) =>
    query && query.includes('v=') ? m : `${head}${q}${spec}?v=${version}${q}`);
}

export function remainingUnversioned(src) {
  const out = [];
  for (const m of src.matchAll(SPEC_RE)) {
    const query = m[4] || '';
    if (!query.includes('v=')) out.push(m[3]);
  }
  return out;
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function collect(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p, base));
    else if (e.isFile()) out.push(path.relative(base, p));
  }
  return out;
}

function copyTree(src, dst, skip = () => false) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(src, e.name);
    const rel = path.relative(ROOT, p);
    if (skip(rel)) continue;
    const t = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(t, { recursive: true }); copyTree(p, t, skip); }
    else if (e.isFile()) fs.copyFileSync(p, t);
  }
}

export function stageSite({ outDir, root = ROOT } = {}) {
  if (!outDir) throw new Error('--out <dir> is required');
  const out = path.resolve(outDir);
  if (out === root || out.startsWith(root + path.sep)) throw new Error(`refusing to stage inside the repo: ${out}`);
  if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error(`out dir exists and is not empty: ${out}`);
  fs.mkdirSync(out, { recursive: true });

  const web = path.join(root, 'web');
  copyTree(path.join(web, 'js'), path.join(out, 'js'));
  copyTree(path.join(web, 'vendor'), path.join(out, 'vendor'));
  if (fs.existsSync(path.join(web, 'assets'))) copyTree(path.join(web, 'assets'), path.join(out, 'assets'));
  fs.copyFileSync(path.join(web, 'index.html'), path.join(out, 'index.html'));
  for (const extra of ['favicon.ico', 'favicon.svg', 'manifest.json']) {
    const p = path.join(web, extra);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, extra));
  }

  const schedOut = path.join(root, 'out', 'wave_schedule.json');
  const schedDist = path.join(root, 'dist', 'api', 'schedule.json');
  const scheduleSource = fs.existsSync(schedOut) ? 'out/wave_schedule.json' : 'dist/api/schedule.json';
  const schedSrc = fs.existsSync(schedOut) ? schedOut : schedDist;
  if (!fs.existsSync(schedSrc)) throw new Error('no schedule source found');
  fs.mkdirSync(path.join(out, 'api'), { recursive: true });
  fs.copyFileSync(schedSrc, path.join(out, 'api', 'schedule.json'));

  const git = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  const head = git('git rev-parse --short HEAD');
  const dirty = git('git status --porcelain -- web') !== '';
  const files = {};
  for (const rel of collect(out)) files[rel.split(path.sep).join('/')] = sha256(fs.readFileSync(path.join(out, rel)));
  const sourceHash = sha256(Object.keys(files).sort().map(f => files[f]).join('\n'));
  const version = head + (dirty ? `-dirty-${sourceHash.slice(0, 8)}` : '');

  const jsFiles = Object.keys(files).filter(f => f.endsWith('.js') && (f.startsWith('js/') || f.startsWith('vendor/')));
  const problems = [];
  for (const rel of jsFiles) {
    const p = path.join(out, rel);
    const src = fs.readFileSync(p, 'utf8');
    const next = rewriteModuleSpecifiers(src, version);
    if (next !== src) fs.writeFileSync(p, next);
  }
  for (const rel of jsFiles) {
    const src = fs.readFileSync(path.join(out, rel), 'utf8');
    for (const spec of remainingUnversioned(src)) problems.push(`${rel}: unversioned ${spec}`);
    for (const m of src.matchAll(SPEC_RE)) {
      const target = path.normalize(path.join(path.dirname(rel), m[3]));
      if (!files[target] && !fs.existsSync(path.join(out, target))) problems.push(`${rel}: missing target ${m[3]}`);
    }
  }
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const htmlNext = html.replace(/(src\s*=\s*["'])(\.\/js\/main\.js)(\?[^"']*)?(["'])/, (m, a, s, q, c) => (q && q.includes('v=') ? m : `${a}${s}?v=${version}${c}`));
  if (htmlNext !== html) fs.writeFileSync(path.join(out, 'index.html'), htmlNext);
  else if (!html.includes('js/main.js')) problems.push('index.html: main.js script tag not found');

  const finalFiles = {};
  for (const rel of collect(out)) finalFiles[rel.split(path.sep).join('/')] = sha256(fs.readFileSync(path.join(out, rel)));

  if (problems.length) {
    for (const p of problems) console.error('stage-site: ' + p);
    throw new Error(`${problems.length} problem(s) in staged artifact`);
  }

  const manifest = { version, 'source commit': head, scheduleSource, files: finalFiles };
  fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  try {
    if (outIdx < 0 || !args[outIdx + 1]) throw new Error('usage: node tools/stage-site.mjs --out <dir>');
    const manifest = stageSite({ outDir: args[outIdx + 1] });
    const n = Object.keys(manifest.files).length;
    console.log(`staged ${n} files · version ${manifest.version} · schedule ${manifest.scheduleSource}`);
    console.log(`out: ${path.resolve(args[outIdx + 1])}`);
  } catch (e) {
    console.error('stage-site: ' + e.message);
    process.exit(1);
  }
}
