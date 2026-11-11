// tools/hyper3d-place.mjs — placement test for Rodin-vendored GLBs.
// Loads web/assets/hyper3d/*.glb into the LIVE scene at authored spots
// (no game-code changes), grounds bbox min.y, reports size/scale/load ms,
// plays the walk clip once, and screenshots each at insert distance.
// Usage: node tools/hyper3d-place.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8776;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = '/tmp/hyper3d-place';
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});
console.log('preview up');

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?skipTutorial&seed=7&district=polyfork`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // Headless swiftshader boots slowly under machine load; allow up to 5 min.
  await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, null, { timeout: 300000, polling: 2000 });
  await page.$eval('#open', el => el.click());
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => (window.__grunds?.modals?.top?.() || null));
    if (st === 'brief') break;
    if (st === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
    else if (st === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
    else if (st === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 60000 });
  await page.evaluate(() => window.__grunds.togglePause());
  await page.waitForTimeout(2000);

  // Place each asset: [id, url, targetXZ, groundY, targetHeight, playClip]
  const placements = [
    ['stand', '/assets/hyper3d/stand-rodin-low.glb', [2.5, 13.5], 0, 2.4, false],
    ['espresso', '/assets/hyper3d/espresso-rodin-low-v2.glb', [0.0, 12.8], 0, 0.7, false],
    ['barista', '/assets/hyper3d/barista-rodin-walk.glb', [5.0, 12.5], 0, 1.7, true],
  ];
  const report = await page.evaluate(async (placements) => {
    const THREE = await import('/vendor/three.module.js');
    const { GLTFLoader } = await import('/vendor/loaders/GLTFLoader.js');
    const g = window.__grunds;
    const loader = new GLTFLoader();
    const rows = [];
    for (const [id, url, [x, z], groundY, targetH, playClip] of placements) {
      const t0 = performance.now();
      const gltf = await loader.loadAsync(url);
      const ms = Math.round(performance.now() - t0);
      const model = gltf.scene || gltf.scenes[0];
      model.name = 'H3_' + id;
      g.scene.add(model);
      let bb = new THREE.Box3().setFromObject(model);
      const size = bb.getSize(new THREE.Vector3());
      const s = targetH / size.y;
      model.scale.setScalar(s);
      bb = new THREE.Box3().setFromObject(model);
      const sz = bb.getSize(new THREE.Vector3());
      model.position.set(x, groundY - bb.min.y, z);
      let clip = null;
      if (playClip && gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        mixer.setTime(0.5); // mid-stride still
        g.scene.userData[`mixer:${id}`] = mixer;
        clip = { name: gltf.animations[0].name, duration: gltf.animations[0].duration, tracks: gltf.animations[0].tracks.length };
      }
      rows.push({
        id, loadMs: ms, scale: +s.toFixed(2),
        size: sz.toArray().map(v => +v.toFixed(2)),
        groundY, clips: (gltf.animations || []).length, clip,
      });
    }
    return rows;
  }, placements);
  console.log(JSON.stringify(report, null, 1));

  const shots = [
    // shot, model, target [x,y,z], r, theta, phi
    ['h3-group', 'stand', [1.5, 1.0, 13.0], 12, 0.4, 1.3],
    ['h3-stand', 'stand', [2.5, 1.0, 13.5], 11, 0.6, 1.3],
    ['h3-espresso', 'espresso', [0.0, 0.4, 12.8], 7, 0.9, 1.25],
    ['h3-barista', 'barista', [5.0, 0.9, 12.5], 7, -0.6, 1.3],
  ];
  for (const [name, mid, target, r, theta, phi] of shots) {
    await page.evaluate(([target, r, theta, phi]) => {
      const g = window.__grunds;
      g.rig.beat = null;
      g.rig.target.set(target[0], target[1], target[2]);
      g.rig.r = r; g.rig.theta = theta; g.rig.phi = phi;
    }, [target, r, theta, phi]);
    await page.waitForTimeout(1400);
    // Rig eases toward the orbit state; re-pin and settle so the projection
    // matches the frame actually captured.
    await page.evaluate(([target, r, theta, phi]) => {
      const g = window.__grunds;
      g.rig.target.set(target[0], target[1], target[2]);
      g.rig.r = r; g.rig.theta = theta; g.rig.phi = phi;
    }, [target, r, theta, phi]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const rect = await page.evaluate(async (mid) => {
      const THREE = await import('/vendor/three.module.js');
      const g = window.__grunds;
      const obj = g.scene.getObjectByName('H3_' + mid);
      if (!obj) return { error: 'missing ' + mid };
      const cam = g.rig?.cam;
      if (!cam) return { error: 'no camera' };
      const bb = new THREE.Box3().setFromObject(obj);
      const pts = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const v = new THREE.Vector3(x, y, z).project(cam);
        pts.push(v);
      }
      const xs = pts.map(p => (p.x * 0.5 + 0.5) * 1400);
      const ys = pts.map(p => (-p.y * 0.5 + 0.5) * 900);
      const behind = pts.some(p => p.z > 1);
      return {
        x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)),
        x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)),
        behind, visible: obj.visible,
      };
    }, mid);
    console.log('shot', name, JSON.stringify(rect));
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
