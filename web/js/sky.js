// sky.js — cinematic day/night sky dome. Core-Three only, no assets, no DOM.
// An inverted sphere painted by a fragment shader: a zenith/horizon/nadir gradient
// interpolated across time keyframes, a soft warm sun glow tracking a parametric
// day arc, and procedural hash-scattered stars that fade in at night. The view
// direction is derived in-shader from the world vertex minus the built-in
// `cameraPosition`, so parallax is correct without ever moving the dome.
import * as THREE from '../vendor/three.module.js';

// ---- time keyframes (t = minutes since midnight). Color triples = display sRGB hex. ----
// Matched to the world.js day arc; Colors are auto-converted to linear working space,
// lerped in linear, then re-encoded on output — consistent with every scene material.
const KF = [
  { t:  360, z: 0x1a2440, h: 0xd9a06b, n: 0x2a2230 }, // 06:00 pre-dawn
  { t:  450, z: 0x4a6a9a, h: 0xffc27d, n: 0x5a4a3a }, // 07:30 golden
  { t:  600, z: 0x6a90c0, h: 0xcfe0e8, n: 0x8a9a92 }, // 10:00 morning
  { t:  780, z: 0x6a9fd0, h: 0xe8f0f2, n: 0xaabfbf }, // 13:00 midday
  { t: 1020, z: 0x5a86c0, h: 0xe8c8a0, n: 0x9a8a7a }, // 17:00 afternoon
  { t: 1140, z: 0x3a4a80, h: 0xff8a52, n: 0x5a3a4a }, // 19:00 sunset
  { t: 1230, z: 0x1c2440, h: 0x4a3a5a, n: 0x1a1428 }, // 20:30 dusk
  { t: 1260, z: 0x0c1430, h: 0x1a1f30, n: 0x080a14 }, // 21:00 night
].map(k => ({ t: k.t, z: new THREE.Color(k.z), h: new THREE.Color(k.h), n: new THREE.Color(k.n) }));

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

// Sun follows a sine-elevation arc: rises ~06:00, peaks ~13:00, sets ~19:00, dips below after.
function sunArc(t, out) {
  const d = (t - 360) / 780;                         // 0 sunrise . 0.5 noon . 1 sunset . >1 below
  const ang = d * Math.PI;
  const elev = Math.sin(ang) * 65 * Math.PI / 180;   // peak ~65° at noon, negative at night
  const azim = (d - 0.5) * Math.PI * 0.8;            // east(-) -> south -> west(+)
  const ce = Math.cos(elev), se = Math.sin(elev), ca = Math.cos(azim), sa = Math.sin(azim);
  out.set(sa * ce, se, -ca * ce).normalize();        // unit sun direction (sun stays south)
  return out;
}

const VERT = `varying vec3 vWorldPos;
void main(){
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `varying vec3 vWorldPos;
uniform vec3 uZen, uHor, uNad;
uniform vec3 uSunDir;
uniform float uSunInt, uStars, uTwinkle;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// sparse, jittered star: only cells clearing a density threshold get one, at a hashed offset
// (no uniform grid), with a per-star brightness and a time-driven twinkle.
float starLayer(vec2 uv, float dens, float seed){
  vec2 c = floor(uv);
  vec2 f = fract(uv);
  vec2 pos = vec2(hash21(c + seed), hash21(c + seed + 31.7));
  float keep = step(dens, hash21(c + seed + 91.1)); // ~ (1 - dens) of cells are lit
  float d = length((f - pos) * vec2(1.5, 1.0));      // squash to tame azimuth stretch at poles
  float pt = smoothstep(0.10, 0.0, d);
  float b = hash21(c + seed + 17.3);                 // 0..1 brightness
  float tw = 0.55 + 0.45 * sin(uTwinkle * 2.3 + b * 12.0);
  return pt * (0.2 + 0.6 * b) * tw * keep;
}

void main(){
  vec3 vDir = normalize(vWorldPos - cameraPosition);  // built-in uniform -> view direction
  float hgt = vDir.y;
  // gradient: horizon band -> zenith looking up, horizon band -> nadir looking down
  float up = smoothstep(0.02, 0.42, hgt);
  float dn = 1.0 - smoothstep(-0.18, 0.02, hgt);
  vec3 col = mix(uHor, uZen, up);
  col = mix(col, uNad, dn);
  // sun: warm disc + broad halo, tint deepens near the horizon, all fades out below it
  vec3 sd = normalize(uSunDir);
  float m = max(dot(vDir, sd), 0.0);
  float high = smoothstep(0.0, 0.5, sd.y);
  vec3 sunCol = mix(vec3(1.0, 0.40, 0.14), vec3(1.0, 0.93, 0.80), high);
  col += sunCol * (smoothstep(0.9974, 0.9998, m) + pow(m, 8.0) * 0.45) * uSunInt;
  // stars: two jittered sparse layers, fading in above the horizon with uStars
  vec2 suv = vec2(atan(vDir.z, vDir.x), asin(clamp(vDir.y, -1.0, 1.0)));
  float s = starLayer(suv * 9.0, 0.915, 0.0) + starLayer(suv * 16.0, 0.955, 11.3);
  s *= smoothstep(0.0, 0.28, hgt) * uStars;
  col += vec3(0.80, 0.86, 1.0) * s;
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky(scene) {
  let mesh = null, geo = null, mat = null;
  const u = {
    uZen:    { value: new THREE.Color(0x1a2440) },
    uHor:    { value: new THREE.Color(0xd9a06b) },
    uNad:    { value: new THREE.Color(0x2a2230) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunInt: { value: 0 },
    uStars:  { value: 0 },
    uTwinkle:{ value: 0 },
  };
  try {
    geo = new THREE.SphereGeometry(90, 64, 32);
    mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;        // draw first as the backdrop
    mesh.frustumCulled = false;   // dome always fills the view; never cull
    scene.add(mesh);
  } catch (e) {
    // headless / no-GL: free anything partially built and degrade to a no-op dome.
    if (geo) { try { geo.dispose(); } catch (_) {} }
    if (mat) { try { mat.dispose(); } catch (_) {} }
    mesh = geo = mat = null;
  }

  function update(t, sunDir) {
    if (!mat) return;
    t = clamp(t, 360, 1260);
    // bracket the keyframes and smoothstep the fraction for smooth color ramps
    let i = 0;
    while (i < KF.length - 2 && KF[i + 1].t <= t) i++;
    const a = KF[i], b = KF[i + 1];
    const f = ss(a.t, b.t, t);
    u.uZen.value.copy(a.z).lerp(b.z, f);
    u.uHor.value.copy(a.h).lerp(b.h, f);
    u.uNad.value.copy(a.n).lerp(b.n, f);
    // caller may drive the sun with the scene's light direction; else use the arc
    const sd = u.uSunDir.value;
    let directed = false;
    if (sunDir && typeof sunDir.x === 'number' && typeof sunDir.y === 'number' && typeof sunDir.z === 'number') {
      sd.set(sunDir.x, sunDir.y, sunDir.z);
      if (sd.lengthSq() > 1e-8) { sd.normalize(); directed = true; }
    }
    if (!directed) sunArc(t, sd);                  // fallback also for a zero-length vector
    const y = sd.y;
    u.uSunInt.value = y > 0 ? clamp(Math.pow(y, 0.6), 0, 1) : 0;   // 0 below horizon, peak near noon
    u.uStars.value = ss(1140, 1230, t);            // stars rise from ~19:00 to ~20:30
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    u.uTwinkle.value = now ? now * 0.001 : t * 0.05;
  }

  function dispose() {
    if (mesh) { try { scene.remove(mesh); } catch (_) {} }
    if (mat) { try { mat.dispose(); } catch (_) {} }
    if (geo) { try { geo.dispose(); } catch (_) {} }
    mesh = geo = mat = null;
  }

  return { update, dispose };
}

