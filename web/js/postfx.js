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
uniform float uCine, uCA, uBars;
uniform float uSharp, uDof;
uniform vec2 uTexel;
uniform vec3 uWarm;
void main(){
  vec3 scene;
  if (uCA > 0.0001) {                                    // cine: radial chromatic aberration
    vec2 dir = (vUv - 0.5) * 1.41421356;
    float ca = uCA * dot(dir, dir);
    scene = vec3(
      texture2D(tScene, vUv + dir * ca).r,
      texture2D(tScene, vUv).g,
      texture2D(tScene, vUv - dir * ca).b);
  } else {
    scene = texture2D(tScene, vUv).rgb;
  }
  // tilt-shift DOF: cheap 4-tap cross blur masked to the top/bottom of the
  // frame — the street stays sharp at the lens plane, edges melt like a
  // tilt-shift photo. uDof is cine-gated so gameplay stays readable.
  if (uDof > 0.001) {
    float coc = uDof * smoothstep(0.10, 0.46, abs(vUv.y - 0.5));
    vec2 o = uTexel * 2.2 * coc;
    vec3 b = texture2D(tScene, vUv + vec2(o.x, 0.0)).rgb
           + texture2D(tScene, vUv - vec2(o.x, 0.0)).rgb
           + texture2D(tScene, vUv + vec2(0.0, o.y)).rgb
           + texture2D(tScene, vUv - vec2(0.0, o.y)).rgb;
    scene = mix(scene, b * 0.25, coc);
  }
  // unsharp mask: restores the micro-contrast bloom + grain eat — one extra
  // tap ring, subtle enough to read as "crisper" not "haloed".
  if (uSharp > 0.001) {
    vec3 nb = texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb
            + texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb
            + texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb
            + texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb;
    scene += (scene - nb * 0.25) * uSharp;
  }
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomInt * uWarm;                 // additive bloom, warm at night
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.0 + 0.14 * uCine);                  // cine: gentle saturation lift
  // split-tone: teal into the shadows, warm into the highlights
  col += vec3(-0.012, 0.004, 0.030) * (1.0 - smoothstep(0.0, 0.5, l)) * uCine;
  col += vec3(0.045, 0.018, -0.012) * smoothstep(0.5, 1.0, l) * uCine;
  float d = length((vUv - 0.5) * 1.41421356);                  // 0 center -> ~0.707 corner
  col *= mix(1.0, 1.0 - smoothstep(0.38, 0.78, d), uVignette * (1.0 + 0.9 * uCine));
  float g = fract(sin(dot(floor(gl_FragCoord.xy), vec2(127.1, 311.7)) + uTime) * 43758.5453);
  col += (g - 0.5) * 2.0 * uGrain * (1.0 + 0.6 * uCine);        // animated hash film grain
  if (uBars > 0.0001 && (vUv.y < uBars || vUv.y > 1.0 - uBars)) // cine: letterbox bars
    col = vec3(0.0);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);               // floor to avoid NaN in sRGB pow
  gl_FragColor = linearToOutputTexel(gl_FragColor);            // single linear -> sRGB encode
}`;

// Best-effort direct render used by the lite path and every failure fallback.
function safeRender(renderer, scene, camera) {
  try { renderer.setRenderTarget(null); renderer.render(scene, camera); } catch (_) { /* ignore */ }
}

function makeRT(w, h, depth, samples = 0) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: !!depth, stencilBuffer: false, generateMipmaps: false,
    samples,   // MSAA: the composite path renders the scene into this RT, so
               // without samples the shipped frame is aliased even though
               // the canvas context asked for antialias.
  });
}

export function buildPostFX(renderer, scene, camera, opts) {
  const lite = !!(opts && opts.lite);
  const api = {
    render() { safeRender(renderer, scene, camera); },   // lite default; replaced when built
    resize() {},
    setNight() {},
    setCine() {},
    dispose() {},
  };
  if (lite) return api;                                   // core-only: plain render, no RTs

  let ok = true;
  let rtScene, rtB0, rtB1, brightMat, blurMat, compMat, quad, postScene, postCam;
  let texelX = 0, texelY = 0, cur = 0, tgt = 0;          // night params (current/target)
  let cCur = 0, cTgt = 0;                                // cine grade params

  try {
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    const w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0);
    const wB = Math.max(1, w >> 1), hB = Math.max(1, h >> 1);
    texelX = 1 / wB; texelY = 1 / hB;

    rtScene = makeRT(w, h, true, 4);   // 4x MSAA — WebGL2 render-target AA
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
      uCine: { value: 0 }, uCA: { value: 0 }, uBars: { value: 0 },
      uSharp: { value: 0.16 }, uDof: { value: 0 }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
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
      cCur += (cTgt - cCur) * 0.06;                      // smooth grade-in for captures
      const n = cur, c = cCur;
      brightMat.uniforms.uThreshold.value = 0.85 - 0.23 * n;     // 0.85 day -> 0.62 night
      compMat.uniforms.uBloomInt.value = 0.55 + 0.55 * n + 0.12 * c;
      compMat.uniforms.uWarm.value.set(1 + 0.18 * n, 1 - 0.07 * n, 1 - 0.34 * n);
      compMat.uniforms.uTime.value = (t * 0.001) % 100000;
      compMat.uniforms.uCine.value = c;
      compMat.uniforms.uCA.value = 0.016 * c;                    // ~1.6% radial CA at corners
      compMat.uniforms.uBars.value = 0.085 * c;                  // letterbox ~8.5% top/bottom
      compMat.uniforms.uDof.value = 0.85 * c;                    // tilt-shift, capture-grade only
      compMat.uniforms.uSharp.value = 0.16 + 0.10 * c;           // micro-contrast, always on

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
      compMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      const wB = Math.max(1, W >> 1), hB = Math.max(1, H >> 1);
      rtB0.setSize(wB, hB); rtB1.setSize(wB, hB);
      texelX = 1 / wB; texelY = 1 / hB;
      renderer.setRenderTarget(null);
    } catch (e) { ok = false; }
  };

  api.setNight = function (b) { tgt = b ? 1 : 0; };      // lerp toward target in render
  api.setCine = function (b, snap) {                     // capture-grade grade (?cine=1)
    cTgt = b ? 1 : 0;
    if (snap) { cCur = cTgt; }
  };

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
