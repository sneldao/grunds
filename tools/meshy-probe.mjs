// Probe: report world-space bounds of every loaded meshy/* GLB instance.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8774;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/?skipTutorial&seed=7`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, null, { timeout: 120000, polling: 1000 });
  await page.$eval('#open', el => el.click());
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null }));
    if (st.top === 'brief') break;
    if (st.top === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
    else if (st.top === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
    else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 60000 });
  await page.waitForTimeout(6000); // async GLB loads
  const report = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.module.js');
    const g = window.__grunds;
    const scene = g?.scene;
    if (!scene) return { error: 'no scene handle', keys: Object.keys(g || {}) };
    const rows = [];
    scene.traverse((o) => {
      const src = o.userData?.source || '';
      if (!src.includes('meshy/')) return;
      const bb = new THREE.Box3().setFromObject(o);
      const s = bb.getSize(new THREE.Vector3());
      rows.push({
        src: src.replace(/^.*meshy\//, 'meshy/'),
        placeholder: !!o.userData.placeholder,
        pos: o.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)),
        size: s.toArray().map(v => +v.toFixed(2)),
        minY: +bb.min.y.toFixed(2),
      });
    });
    return rows;
  });
  console.log(JSON.stringify(report, null, 1));
  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
