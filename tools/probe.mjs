import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('node', ['tools/preview-local.mjs', '8774'], { cwd: '/Users/udingethe/Dev/grunds' });
await new Promise(r => server.stdout.on('data', d => String(d).includes('serving web/') && r()));
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PE: ' + String(e.stack || e).slice(0, 700)));
await p.goto('http://127.0.0.1:8774/?skipTutorial&seed=7&district=polyfork', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#open:not([disabled])', { timeout: 60000 });
await p.$eval('#open', el => el.click());
for (let i = 0; i < 40; i++) {
  const st = await p.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase }));
  if (st.top === 'brief' || st.phase === 'trading') break;
  await p.waitForTimeout(1000);
}
await p.$eval('#brief-open', el => el.click()).catch(() => {});
await p.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 60000 });
await p.evaluate(() => window.__grunds.togglePause());
await p.waitForTimeout(2000);
await p.evaluate(() => {
  const g = window.__grunds;
  g.rig.shot('espressoIns', g.world);
});
await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/pf-shots/espresso-ins.png' });
console.log('ERRS:', errs);
await b.close(); server.kill();
