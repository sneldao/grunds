// ui-audit.mjs — UI density harness: plays day 1 headlessly at desktop and
// phone sizes, screenshots every modal + the HUD, and prints box/word/control
// measurements for each. Usage: UI_OUT=/tmp/ui-audit node tools/ui-audit.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = 8791, BASE = `http://127.0.0.1:${PORT}`, OUT = process.env.UI_OUT || '/tmp/ui-audit';
mkdirSync(OUT, { recursive: true });
const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: process.cwd() });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ headless: true, channel: 'chromium',
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

const measure = (page) => page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const top = window.__grunds?.modals?.top?.() || null;
  const out = { top, phase: window.__grunds?.phase, vw: innerWidth, vh: innerHeight };
  const box = sel => { const el = document.querySelector(sel); if (!el || !vis(el)) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      words: (el.innerText || '').trim().split(/\s+/).filter(Boolean).length,
      buttons: [...el.querySelectorAll('button,a,input,summary')].filter(vis).length }; };
  const chrome = ['#hud', '#levers', '#sys', '#notebook', '#vitals', '#feed', '#coach', '#moment', '#floorcue'];
  for (const s of chrome) out[s] = box(s);
  if (!top) {
    // share of the viewport covered by HUD chrome (union, 8px grid)
    const rects = chrome.map(s => out[s]).filter(Boolean);
    let hit = 0, n = 0;
    for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) {
      n++; if (rects.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) hit++;
    }
    out.chromeShare = +(hit / n).toFixed(3);
    out.goalText = document.querySelector('#goal')?.innerText || '';
  }
  if (top) {
    const m = document.getElementById(top);
    const body = m.querySelector('.modal-body');
    const textEls = [...m.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    out.modal = { panel: box(`#${top} .modal-panel`), header: box(`#${top} .modal-header`), footer: box(`#${top} .modal-footer`),
      scrollH: body?.scrollHeight, clientH: body?.clientHeight,
      sections: [...(body?.querySelectorAll(':scope > *, #brief-tools > *') || [])].filter(vis)
        .map(e => { const r = e.getBoundingClientRect(), b = body.getBoundingClientRect();
          return `${e.id || e.className}@${Math.round(r.top - b.top + body.scrollTop)}:${Math.round(r.height)}px/${(e.innerText || '').trim().split(/\s+/).filter(Boolean).length}w`; }),
      fontSizes: [...new Set(textEls.map(e => getComputedStyle(e).fontSize))].sort((a, b) => parseFloat(a) - parseFloat(b)) };
  }
  return out;
});

async function run(tag, viewport, query) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
    console.log(`\n== ${tag}-${name}`, JSON.stringify(await measure(page)));
  };
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, undefined, { timeout: 120000, polling: 500 });
  await page.$eval('#open', el => el.click());
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    let st = null;
    try { st = await page.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase })); }
    catch { await page.waitForTimeout(1500); continue; }
    if (st.top && !seen.has(st.top)) { seen.add(st.top); await page.waitForTimeout(900); await shot(st.top); }
    if (st.top === 'brief' || st.phase === 'trading') break;
    if (st.top === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
    else if (st.top === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
    else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => { const b = document.querySelector('#brief .modal-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-brief-bottom.png` });
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', undefined, { timeout: 60000, polling: 500 });
  await page.waitForTimeout(6000);
  await shot('hud-early');
  await page.evaluate(() => document.querySelector('#speeds button[data-s="1200"]')?.click());
  for (let i = 0; i < 160; i++) {
    const s = await page.evaluate(() => ({ clock: document.querySelector('#clock')?.textContent, top: window.__grunds?.modals?.top?.() || null }));
    if (s.top) { await page.waitForTimeout(800); await shot(s.top + '-midday'); break; }
    if (/^1[3-5]:/.test(s.clock) && !seen.has('rush')) { seen.add('rush'); await shot('hud-rush'); }
    await page.waitForTimeout(1500);
  }
  await page.keyboard.press('2').catch(() => {});
  for (let i = 0; i < 60; i++) {
    const top = await page.evaluate(() => window.__grunds?.modals?.top?.() || null);
    if (top === 'receipt') { await page.waitForTimeout(1200); await shot('receipt'); break; }
    await page.waitForTimeout(1500);
  }
  console.log(`${tag} pageerrors:`, errs.length ? errs : 'none');
  await page.close();
}

try {
  await run('desk-first', { width: 1440, height: 900 }, 'seed=7');
  await run('desk-vet', { width: 1440, height: 900 }, 'seed=7&skipTutorial');
  await run('phone', { width: 390, height: 844 }, 'seed=7&skipTutorial');
} catch (e) { console.error('ERR', e); process.exitCode = 1; }
finally { await browser.close(); server.kill(); }
