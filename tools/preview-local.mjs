import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WEB = join(ROOT, 'web');
const argPort = process.argv.find(a => /^\d+$/.test(a));
const PORT = Number(process.env.PORT || argPort || 8766);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.map': 'application/json; charset=utf-8',
};

async function scheduleSource() {
  const fromOut = join(ROOT, 'out', 'wave_schedule.json');
  const fromDist = join(ROOT, 'dist', 'api', 'schedule.json');
  try { const s = await stat(fromOut); if (s.isFile()) return { path: fromOut, label: 'out/wave_schedule.json (fresh build)' }; } catch {}
  try { const s = await stat(fromDist); if (s.isFile()) return { path: fromDist, label: 'dist/api/schedule.json (stale snapshot)' }; } catch {}
  return null;
}

const sched = await scheduleSource();
if (!sched) {
  console.error('preview:local — no wave schedule found.');
  console.error('  looked for: out/wave_schedule.json  (then)  dist/api/schedule.json');
  console.error('  build data first: python3 -m grunds spatial  (writes out/wave_schedule.json)');
  process.exit(1);
}
console.log(`preview:local — schedule from ${sched.label}`);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end('method not allowed'); return;
    }
    if (url.pathname === '/api/schedule.json') {
      const body = await readFile(sched.path);
      res.writeHead(200, { 'content-type': MIME['.json'], 'content-length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    const file = resolve(WEB, rel);
    if (file !== WEB && !file.startsWith(WEB + sep)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    let target = file;
    let st = await stat(target).catch(() => null);
    if (st && st.isDirectory()) { target = join(target, 'index.html'); st = await stat(target).catch(() => null); }
    if (!st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream', 'content-length': st.size });
    if (req.method === 'HEAD') res.end(); else createReadStream(target).pipe(res);
  } catch (err) {
    res.writeHead(500); res.end('server error');
  }
});
server.listen(PORT, HOST, () => {
  console.log(`preview:local — serving web/ at http://${HOST}:${PORT}/`);
});
