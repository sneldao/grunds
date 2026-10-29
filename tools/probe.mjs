import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('node', ['tools/preview-local.mjs', '8774'], { cwd: '/Users/udingethe/Dev/grunds' });
await new Promise(r => server.stdout.on('data', d => String(d).includes('serving web/') && r()));
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=swiftshader'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PE: ' + String(e.stack || e).slice(0, 400)));
p.on('console', m => { if (m.type() === 'error') errs.push('CE: ' + m.text().slice(0, 200)); });
p.on('framenavigated', f => { if (f === p.mainFrame()) console.log('NAV →', f.url()); });
await p.goto('http://127.0.0.1:8774/?skipTutorial&seed=7&district=polyfork', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#open:not([disabled])', { timeout: 60000 }).catch(e => errs.push('no #open: ' + e.message));
await p.$eval('#open', el => el.click()).catch(() => errs.push('open click failed'));
for (let i = 0; i < 15; i++) {
  const s = await p.evaluate(() => ({ url: location.href, top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase })).catch(e => ({ dead: e.message }));
  console.log(i, JSON.stringify(s));
  if (s.phase === 'trading' || s.top === 'brief') break;
  await p.waitForTimeout(1000);
}
console.log('ERRS:', errs);
await b.close(); server.kill();
