import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteModuleSpecifiers } from '../../tools/stage-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.error('FAIL', name); } };

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'grunds-stage-'));
execSync(`node tools/stage-site.mjs --out ${JSON.stringify(out)}`, { cwd: root, stdio: 'pipe' });

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8'));
const VERSION = manifest.version;
ok(!!VERSION && VERSION.length > 0, 'release.json has version');
ok(typeof manifest['source commit'] === 'string', 'release.json source commit');
ok(['out/wave_schedule.json', 'dist/api/schedule.json'].includes(manifest.scheduleSource), 'scheduleSource reported');

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
ok(html.includes(`./js/main.js?v=${VERSION}`), 'index script src versioned');

const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name))]);
const jsFiles = walk(out).filter(f => f.endsWith('.js') && (f.startsWith('js' + path.sep) || f.startsWith('vendor' + path.sep)));
ok(jsFiles.length > 0, 'js files staged');
const SPEC = /(from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+?\.js)(\?[^'"]*)?\2/g;
let badSpec = null, missing = null;
for (const rel of jsFiles) {
  const src = fs.readFileSync(path.join(out, rel), 'utf8');
  for (const m of src.matchAll(SPEC)) {
    const q = m[4] || '';
    if (!q.includes(`v=${VERSION}`)) badSpec = `${rel}: ${m[3]}`;
    const target = path.normalize(path.join(path.dirname(rel), m[3])).split(path.sep).join('/');
    if (!fs.existsSync(path.join(out, target))) missing = `${rel}: ${m[3]}`;
  }
}
ok(!badSpec, `every relative .js specifier carries ?v=${VERSION} (bad: ${badSpec})`);
ok(!missing, `every rewritten target exists (missing: ${missing})`);

ok(!fs.existsSync(path.join(out, 'test')), 'web/test absent');
ok(fs.existsSync(path.join(out, 'api', 'schedule.json')), 'schedule present');
ok(Object.keys(manifest.files).length === walk(out).filter(f => f !== 'release.json').length, 'release.json files cover artifact');

const once = rewriteModuleSpecifiers("import {\n a\n} from '../three.module.js'\nexport { a } from './b.js'\nconst p = import('./x.js')\nimport './side.js'", 'V123');
ok(once.includes(`from '../three.module.js?v=V123'`), 'multi-line from rewritten');
ok(once.includes(`export { a } from './b.js?v=V123'`), 'export-from rewritten');
ok(once.includes(`import('./x.js?v=V123')`), 'dynamic import rewritten');
ok(once.includes(`import './side.js?v=V123'`), 'bare import rewritten');
const twice = rewriteModuleSpecifiers(once, 'V123');
ok(twice === once, 'rewrite idempotent');

let refused = false;
try { execSync(`node tools/stage-site.mjs --out ${JSON.stringify(path.join(root, 'tmp-stage-out'))}`, { cwd: root, stdio: 'pipe' }); }
catch { refused = true; }
ok(refused, 'refuses out dir inside repo');

console.log(`stage-site: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
