// The demo board lists a street only when an in-game still exists.
// A seed with no capture is trimmed, so the page is not a column of
// "capture pending". Run: node web/test/asset-board.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const src = readFileSync(join(ROOT, 'tools', 'build-asset-board.mjs'), 'utf8');
ok(src.includes('5, 7, 11, 13, 17, 19, 21, 23, 27, 31, 42, 99'), 'board defaults left the grown streets off');
ok(src.includes('trimmed — no in-game capture'), 'uncaptured seeds are not dropped');
ok(existsSync(join(ROOT, 'tools', 'capture-board-shots.mjs')), 'capture script missing');
ok(existsSync(join(ROOT, 'web', 'assets', 'board', 'seed-7.jpg')), 'seed 7 still has no street still');

const dir = mkdtempSync(join(tmpdir(), 'asset-board-'));
const out = join(dir, 'asset-board.html');
const run = spawnSync(process.execPath, [
  join(ROOT, 'tools', 'build-asset-board.mjs'),
  '7', '404',
  '--offline', '--out', out,
], { encoding: 'utf8' });
ok(run.status === 0, run.stderr || run.stdout || 'builder failed');
const html = existsSync(out) ? readFileSync(out, 'utf8') : '';
const board = html.split('<div id="board">')[1]?.split('</div>')[0] || '';
ok(board.includes('District seed 7'), 'a captured street was dropped');
ok(board.includes('seed-7'), 'seed 7 still has no in-game image');
ok(!board.includes('District seed 404'), 'a seed with no still was listed');
ok(!board.includes('capture pending'), 'a listed row is still waiting on a capture');
ok((run.stdout || '').includes('seed 404 trimmed'), run.stdout);
rmSync(dir, { recursive: true, force: true });

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('ASSET BOARD captured streets stay; uncaptured seeds are trimmed');
