// In-game screenshots for the asset board (tools/build-asset-board.mjs).
// One whole-street shot per seed → web/assets/board/seed-<N>.jpg, taken once
// the floor has placed its GLBs (#open enabled) plus a settle for the
// district cross-fade.  Usage: node scripts/board-shots.mjs [seeds…] [--base url]
// NOTE: the live client POSTs /district/ensure for any missing slot, so only
// shoot seeds that are already grown (or you'll start a generation).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = bi >= 0 ? argv[bi + 1] : 'https://striped-anaconda-746.convex.site';
const seeds = argv.filter((a, i) => !a.startsWith('--') && (bi < 0 || i !== bi + 1)).map(Number);
if (!seeds.length) seeds.push(7); // only already-grown seeds: loading an un-grown seed fires /district/ensure
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'web', 'assets', 'board');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'] });
for (const seed of seeds) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await page.goto(`${BASE}/?seed=${seed}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#open:not([disabled])', { timeout: 120000 });
    await page.waitForTimeout(8000); // district cross-fade + first frames
    // Lift the title card (and its backdrop blur) without starting the day.
    await page.evaluate(() => {
      let el = document.getElementById('open');
      while (el && el !== document.body && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
      if (el && el !== document.body) el.style.display = 'none';
    });
    await page.waitForTimeout(1500);
    const file = join(OUT, `seed-${seed}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    console.log(`seed ${seed} → ${file}`);
  } catch (e) {
    console.error(`seed ${seed}: ${e.message.split('\n')[0]}`);
  }
  await page.close();
}
await browser.close();
