// render-asset.mjs — render a vendored GLB to a reference PNG for
// image-to-3D generation (tools/vendor-meshy.mjs --image).
//
//   node tools/render-asset.mjs <asset-path-under-web/assets> <out.png> [view]
//   node tools/render-asset.mjs assets/cup-coffee.glb /tmp/refs/cup.png front
//   node tools/render-asset.mjs assets/mug.glb /tmp/refs/mug.png side
//
// Views: front (default), side, top, iso. Neutral studio lighting so the
// reference reads as shape+material, not scene mood.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8775;
const [asset, out, view = 'front'] = process.argv.slice(2);
if (!asset || !out) { console.error('usage: render-asset.mjs <asset> <out.png> [front|side|top|iso]'); process.exit(2); }
mkdirSync(dirname(out), { recursive: true });

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});

const VIEWS = {
  front: { pos: [0, 0.35, 1], look: [0, 0, 0] },
  side:  { pos: [1, 0.35, 0], look: [0, 0, 0] },
  top:   { pos: [0, 1, 0.001], look: [0, 0, 0] },
  iso:   { pos: [0.8, 0.6, 0.8], look: [0, 0, 0] },
};

const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  const dataUrl = await page.evaluate(async ([url, viewName]) => {
    const THREE = await import('/vendor/three.module.js');
    const { GLTFLoader } = await import('/vendor/loaders/GLTFLoader.js');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2ede4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e0, 2.2); key.position.set(2, 3, 2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7); fill.position.set(-2, 1, -1); scene.add(fill);
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene || gltf.scenes[0];
    scene.add(model);
    const bb = new THREE.Box3().setFromObject(model);
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const v = { front: [0, 0.35, 1], side: [1, 0.35, 0], top: [0, 1, 0.001], iso: [0.8, 0.6, 0.8] }[viewName] || [0, 0.35, 1];
    cam.position.set(v[0] * maxDim * 1.6, v[1] * maxDim * 1.6 + center.y * 0, v[2] * maxDim * 1.6);
    cam.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(512, 512);
    renderer.render(scene, cam);
    return renderer.domElement.toDataURL('image/png');
  }, [`/${asset}`, view]);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`${asset} [${view}] -> ${out}`);
} finally {
  await browser.close();
  server.kill();
}
