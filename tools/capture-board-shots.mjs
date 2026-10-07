#!/usr/bin/env node
// In-game street stills for the asset board (tools/build-asset-board.mjs).
// One whole-street shot per already-grown seed → web/assets/board/seed-<N>.jpg.
// Uses the system Chrome over the devtools protocol. Loading a seed the
// deployment has not grown would call /district/ensure — only pass seeds
// whose kit is already success.
//
// Usage: node tools/capture-board-shots.mjs [seeds…] [--base url] [--force]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'web', 'assets', 'board');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const BASE = opt('--base', 'https://grunds.trustfall.xyz').replace(/\/$/, '');
const FORCE = argv.includes('--force');
const flagVals = new Set([opt('--base')].filter(Boolean));
const seeds = argv.filter((a) => !a.startsWith('--') && !flagVals.has(a)).map(Number);
if (!seeds.length) seeds.push(5, 11, 17, 21, 23, 27, 31, 42, 99);
if (seeds.some((s) => !Number.isFinite(s))) { console.error('seeds must be numbers'); process.exit(2); }

mkdirSync(OUT, { recursive: true });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result || {});
    });
  }
  send(method, params = {}, timeoutMs = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error(`timeout ${method}`)); }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(t); resolve(v); },
        reject: (e) => { clearTimeout(t); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function launchChrome() {
  const dir = join(tmpdir(), `board-chrome-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const port = 9334;
  const proc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    '--window-size=1600,900',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stderr.on('data', (b) => { log += b.toString(); });
  proc.stdout.on('data', (b) => { log += b.toString(); });
  const deadline = Date.now() + 15000;
  let version = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) { version = await r.json(); break; }
    } catch { /* chrome still starting */ }
    await sleep(200);
  }
  if (!version) {
    proc.kill('SIGKILL');
    throw new Error('chrome did not open a devtools port\n' + log.slice(-500));
  }
  return { proc, port, dir, version };
}

async function shoot(cdp, seed) {
  const url = `${BASE}/?seed=${seed}`;
  await cdp.send('Page.navigate', { url }, 30000);
  await cdp.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const btn = document.querySelector('#open:not([disabled])');
        if (btn) resolve('ready');
        else if (Date.now() - start > 90000) resolve('timeout');
        else setTimeout(tick, 400);
      };
      tick();
    })`,
    awaitPromise: true,
    returnByValue: true,
  }, 100000);
  // District cross-fade lands after Open enables. Then lift the title card
  // so the still is the street, not the boot modal.
  await sleep(8000);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.getElementById('title');
      if (title) title.style.display = 'none';
      return document.querySelector('#open') ? 'hid' : 'no-open';
    })()`,
    returnByValue: true,
  });
  await sleep(1500);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, 20000);
  const buf = Buffer.from(shot.data, 'base64');
  if (buf.length < 8000) throw new Error(`shot too small (${buf.length} bytes) — page likely blank`);
  const file = join(OUT, `seed-${seed}.jpg`);
  writeFileSync(file, buf);
  console.log(`seed ${seed} → ${file} (${buf.length} bytes)`);
}

const chrome = await launchChrome();
let failed = 0;
try {
  const list = await fetch(`http://127.0.0.1:${chrome.port}/json/list`).then((r) => r.json());
  const page = list.find((t) => t.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('devtools websocket failed')));
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  for (const seed of seeds) {
    const file = join(OUT, `seed-${seed}.jpg`);
    if (!FORCE && existsSync(file)) { console.log(`seed ${seed} exists — skip`); continue; }
    try { await shoot(cdp, seed); }
    catch (e) { failed++; console.error(`seed ${seed}: ${e.message.split('\n')[0]}`); }
  }
  ws.close();
} finally {
  try { chrome.proc.kill('SIGKILL'); } catch { /* already gone */ }
  await sleep(400);
  try { rmSync(chrome.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (e) { console.error('left the chrome profile in place:', e.message); }
}
if (failed) process.exit(1);
