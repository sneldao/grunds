// postfx.js — core-Three-only cinematic post-processing: bloom + vignette + film grain.
// No example modules, no external assets. Pipeline:
//   scene  ->  ACES-tonemapped full-res RT (the isXRRenderTarget flag makes the renderer
//              apply its existing tone mapping into a non-null target)        [renderTargetA]
//   -> half-res bright-extract (max(channel) > threshold, soft knee)
//   -> separable Gaussian blur, ping-pong (5-tap) — horizontal then vertical
//   -> additive composite: scene + bloom (warmer/stronger at night) + radial vignette
//      + animated hash film grain, written to the default framebuffer with toneMapped=false.
// Exactly one tonemap (scene pass) and one sRGB encode (composite pass) — never double tonemapped.
import * as THREE from '../vendor/three.module.js';

// ---- fullscreen-quad shaders. ShaderMaterial auto-injects position/uv/matrix decls. ----
const VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`;   // ignore camera matrices

const BRIGHT_FRAG = `varying vec2 vUv;
uniform sampler2D tScene; uniform float uThreshold;
void main(){
  vec4 c = texture2D(tScene, vUv);
  float m = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.2, m);        // soft knee, no hard edge
  gl_FragColor = vec4(c.rgb * k, 1.0);
  gl_FragColor = linearToOutputTexel(gl_FragColor);            // identity on linear RTs
}`;

const BLUR_FRAG = `varying vec2 vUv;
uniform sampler2D uTex; uniform vec2 uTexelOffset;               // = (1/wB,0) or (0,1/hB)
void main(){
  vec4 s = texture2D(uTex, vUv) * 0.2270270270;
  s += texture2D(uTex, vUv + uTexelOffset * 1.3846153846) * 0.3162162162;
  s += texture2D(uTex, vUv - uTexelOffset * 1.3846153846) * 0.3162162162;
  s += texture2D(uTex, vUv + uTexelOffset * 3.2307692308) * 0.0702702703;
  s += texture2D(uTex, vUv - uTexelOffset * 3.2307692308) * 0.0702702703;
  gl_FragColor = s;
  gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

const COMPOSITE_FRAG = `varying vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloomInt, uVignette, uGrain, uTime;
uniform vec3 uWarm;
void main(){
  vec3 scene = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomInt * uWarm;                 // additive bloom, warm at night
  float d = length((vUv - 0.5) * 1.41421356);                  // 0 center -> ~0.707 corner
  col *= mix(1.0, 1.0 - smoothstep(0.38, 0.78, d), uVignette);  // soft radial vignette
  float g = fract(sin(dot(floor(gl_FragCoord.xy), vec2(127.1, 311.7)) + uTime) * 43758.5453);
  col += (g - 0.5) * 2.0 * uGrain;                             // animated hash film grain
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);               // floor to avoid NaN in sRGB pow
  gl_FragColor = linearToOutputTexel(gl_FragColor);            // single linear -> sRGB encode
}`;

// Best-effort direct render used by the lite path and every failure fallback.
function safeRender(renderer, scene, camera) {
  try { renderer.setRenderTarget(null); renderer.render(scene, camera); } catch (_) { /* ignore */ }
}

function makeRT(w, h, depth) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: !!depth, stencilBuffer: false, generateMipmaps: false,
  });
}

export function buildPostFX(renderer, scene, camera, opts) {
  const lite = !!(opts && opts.lite);
  const api = {
    render() { safeRender(renderer, scene, camera); },   // lite default; replaced when built
    resize() {},
    setNight() {},
    dispose() {},
  };
  if (lite) return api;                                   // core-only: plain render, no RTs

  let ok = true;
  let rtScene, rtB0, rtB1, brightMat, blurMat, compMat, quad, postScene, postCam;
  let texelX = 0, texelY = 0, cur = 0, tgt = 0;          // night params (current/target)

  try {
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    const w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0);
    const wB = Math.max(1, w >> 1), hB = Math.max(1, h >> 1);
    texelX = 1 / wB; texelY = 1 / hB;

    rtScene = makeRT(w, h, true);
    rtScene.isXRRenderTarget = true;                       // force tonemap-into-RT (three r160)
    rtScene.texture.colorSpace = THREE.LinearSRGBColorSpace; // linear ACES stored, no sRGB encode
    rtB0 = makeRT(wB, hB, false); rtB0.texture.colorSpace = THREE.LinearSRGBColorSpace;
    rtB1 = makeRT(wB, hB, false); rtB1.texture.colorSpace = THREE.LinearSRGBColorSpace;

    const sh = (frag, uni) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, uniforms: uni,
      toneMapped: false, depthTest: false, depthWrite: false,
    });
    brightMat = sh(BRIGHT_FRAG, { tScene: { value: rtScene.texture }, uThreshold: { value: 0.85 } });
    blurMat = sh(BLUR_FRAG, { uTex: { value: rtScene.texture }, uTexelOffset: { value: new THREE.Vector2() } });
    compMat = sh(COMPOSITE_FRAG, {
      tScene: { value: rtScene.texture }, tBloom: { value: rtB0.texture },
      uBloomInt: { value: 0.55 }, uWarm: { value: new THREE.Vector3(1, 1, 1) },
      uVignette: { value: 0.34 }, uGrain: { value: 0.04 }, uTime: { value: 0 },
    });

    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brightMat);
    quad.frustumCulled = false;
    postScene.add(quad);
  } catch (e) { ok = false; }

  api.render = function (timeMs) {
    if (!ok) { safeRender(renderer, scene, camera); return; }
    try {
      const t = (typeof timeMs === 'number' && isFinite(timeMs)) ? timeMs : 0;
      cur += (tgt - cur) * 0.06;                         // smooth day -> night transition
      const n = cur;
      brightMat.uniforms.uThreshold.value = 0.85 - 0.23 * n;     // 0.85 day -> 0.62 night
      compMat.uniforms.uBloomInt.value = 0.55 + 0.55 * n;       // 0.55 day -> 1.10 night
      compMat.uniforms.uWarm.value.set(1 + 0.18 * n, 1 - 0.07 * n, 1 - 0.34 * n);
      compMat.uniforms.uTime.value = (t * 0.001) % 100000;

      renderer.setRenderTarget(rtScene); renderer.render(scene, camera);  // 1. scene (tonemapped)

      quad.material = brightMat; renderer.setRenderTarget(rtB0);          // 2. bright extract
      renderer.render(postScene, postCam);

      blurMat.uniforms.uTex.value = rtB0.texture;                        // 3. H blur -> rtB1
      blurMat.uniforms.uTexelOffset.value.set(texelX, 0);
      quad.material = blurMat; renderer.setRenderTarget(rtB1);
      renderer.render(postScene, postCam);

      blurMat.uniforms.uTex.value = rtB1.texture;                        // 4. V blur -> rtB0
      blurMat.uniforms.uTexelOffset.value.set(0, texelY);
      quad.material = blurMat; renderer.setRenderTarget(rtB0);
      renderer.render(postScene, postCam);

      quad.material = compMat; renderer.setRenderTarget(null);           // 5. composite -> screen
      renderer.render(postScene, postCam);
    } catch (e) { ok = false; safeRender(renderer, scene, camera); }
  };

  api.resize = function (w, h) {
    if (!ok || w < 1 || h < 1) return;                   // guard zero sizes
    try {
      const W = w | 0, H = h | 0;
      rtScene.setSize(W, H);
      const wB = Math.max(1, W >> 1), hB = Math.max(1, H >> 1);
      rtB0.setSize(wB, hB); rtB1.setSize(wB, hB);
      texelX = 1 / wB; texelY = 1 / hB;
      renderer.setRenderTarget(null);
    } catch (e) { ok = false; }
  };

  api.setNight = function (b) { tgt = b ? 1 : 0; };      // lerp toward target in render

  api.dispose = function () {
    try {
      rtScene.dispose(); rtB0.dispose(); rtB1.dispose();
      quad.geometry.dispose();
      brightMat.dispose(); blurMat.dispose(); compMat.dispose();
    } catch (_) {}
    ok = false;
  };

  return api;
}
