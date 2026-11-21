// stand-shots.mjs — eyeball the 'street' material grade: renders a
// generated stand GLB ungraded | graded | a Polyfork storefront
// reference, one frame, so the pass can be judged before shipping.
//
//   node tools/stand-shots.mjs <glb-url-or-asset-path> [out.png] [--ref <polyfork glb>]
//   node tools/stand-shots.mjs https://api.grove.storage/<hash> /tmp/stand.png
//   node tools/stand-shots.mjs assets/meshy/a-board.glb /tmp/stand.png
//
// Loads through the real GLBLoader — the grade runs the same code the
// floor does (gradeStreet in loader.js). Neutral studio lighting so the
// comparison reads as material, not scene mood.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8776;
const argv = process.argv.slice(2);
const asset = argv[0];
const out = argv[1] || '/tmp/stand-shots.png';
const refi = argv.indexOf('--ref');
const ref = (refi >= 0 ? argv[refi + 1] : null) || 'polyfork/campus-coffee-kiosk-ec2395.glb';
if (!asset) { console.error('usage: stand-shots.mjs <glb-url-or-asset> [out.png] [--ref glb]'); process.exit(2); }
mkdirSync(dirname(out), { recursive: true });

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});

// The loader owns the 'assets/' prefix — local files pass relative paths
// ('polyfork/x.glb'), remote URLs pass through untouched.
const url = asset.startsWith('http') || asset.startsWith('blob:') ? asset : asset.replace(/^\/?assets\//, '');
const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 460 } });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  const dataUrl = await page.evaluate(async ([url, ref]) => {
    const THREE = await import('/vendor/three.module.js');
    const { GLBLoader } = await import('/js/loader.js');
    const glb = GLBLoader({ cacheLimit: 8 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9aa0a4);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: 0x7d8287, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e0, 2.2); key.position.set(2, 3, 2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7); fill.position.set(-2, 1, -1); scene.add(fill);

    const errs = [];
    const place = async (u, x, grade) => {
      const inst = await glb.loadGLB(u, grade ? { grade } : {}).catch((e) => { errs.push(`${grade ?? 'raw'}:${e.message}`); return null; });
      if (!inst) return;
      const bb = new THREE.Box3().setFromObject(inst);
      const size = bb.getSize(new THREE.Vector3());
      const s = 1.2 / Math.max(size.x, size.y, size.z);
      inst.scale.setScalar(s);
      const bb2 = new THREE.Box3().setFromObject(inst);
      const c = bb2.getCenter(new THREE.Vector3());
      inst.position.set(x - c.x, -bb2.min.y, -c.z);
      scene.add(inst);
      errs.push(`${grade ?? u.split('/').pop()}:${inst.userData?.placeholder ? 'PLACEHOLDER:' + (inst.userData.error || '?') : 'ok size=' + size.toArray().map(n => n.toFixed(2)).join('x') + ' pos=' + inst.position.toArray().map(n => n.toFixed(2)).join(',')}`);
      return inst;
    };
    await place(url, -1.5, null);
    await place(url, 0, 'street');
    await place(ref, 1.5, null);
    const cam = new THREE.PerspectiveCamera(32, 1200 / 460, 0.01, 100);
    cam.position.set(0, 1.5, 3.4);
    cam.lookAt(0, 0.45, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1200, 460);
    // loadGLB cross-fades instances in over RAF — let the fade finish
    // before the capture (each render also drives shader compile).
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      renderer.render(scene, cam);
    }
    return { png: renderer.domElement.toDataURL('image/png'), errs, kids: scene.children.length };
  }, [url, ref]);
  writeFileSync(out, Buffer.from(dataUrl.png.split(',')[1], 'base64'));
  if (dataUrl.errs?.length) console.error('load errors:', dataUrl.errs.join(' | '));
  console.log(`[ungraded | street grade | polyfork] (${dataUrl.kids} scene children) -> ${out}`);
} finally {
  await browser.close();
  server.kill();
}
