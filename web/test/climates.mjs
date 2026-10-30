import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { CLIMATES, CLIMATE_IDS, pickClimate, climateBrief, climateRain } from '../js/climates.js';
import { buildSky } from '../js/sky.js';
import { StreetLife, STREET_CAP, STREET_POOL_CAP } from '../js/streetLife.js';
import { LAYOUT } from '../js/config.js';

const scene = { add() {} };

const climateScene = () => {
  const s = { kids: [], add(o) { this.kids.push(o); } };
  const sky = buildSky(s);
  const mesh = s.kids.find(k => k.material && k.material.isShaderMaterial);
  return { sky, mesh, uniforms: mesh ? mesh.material.uniforms : null };
};

test('same seed and city pick the same climate twice', () => {
  for (const [seed, city] of [[7, null], [7, 'Lisbon'], [42, null], [13, 'Oslo']]) {
    assert.equal(pickClimate(seed, city).id, pickClimate(seed, city).id);
    assert.ok(CLIMATE_IDS.includes(pickClimate(seed, city).id));
  }
});

test('the brief names the week and carries no demand promise', () => {
  for (const id of CLIMATE_IDS) {
    const c = CLIMATES[id];
    const text = climateBrief(c);
    assert.ok(text.startsWith(c.label), `${id}: brief should open with the label`);
    assert.ok(text.includes(c.cue), `${id}: brief should carry the cue`);
    assert.ok(text.includes('street scene only'), `${id}: brief must say it is scene-only`);
    assert.ok(text.includes('daily events can still affect demand'), `${id}: brief must not promise demand`);
  }
});

test('a rain_soak event beats the climate; a fair day resets the street dry', () => {
  assert.equal(climateRain(CLIMATES.rain, 'rain_soak'), 0.9);
  assert.equal(climateRain(CLIMATES.rain, 'stable'), 0.55);
  assert.equal(climateRain(CLIMATES.fair, 'rain_soak'), 0.9);
  assert.equal(climateRain(CLIMATES.fair, null), 0);
  assert.equal(climateRain(null, 'rain_soak'), 0.9);
  assert.equal(climateRain(null, null), 0);
});

const fillStreet = (climate) => {
  const s = new StreetLife(scene);
  s.climate = climate;
  s.live = true;
  const mk = () => s._activate({
    kind: 'pavement', lotId: null, hold: null, doorId: null,
    points: [{ x: 0, z: LAYOUT.pavementZ, dwell: 30 }, { x: LAYOUT.spawnR.x, z: LAYOUT.pavementZ }],
  });
  let n = 0;
  while (mk()) n++;
  return { s, n };
};

test('heat crowds the street to the pool cap and no further', () => {
  const { s, n } = fillStreet(CLIMATES.heat);
  assert.equal(s.cap, Math.round(STREET_CAP.full * CLIMATES.heat.streetMul));
  assert.equal(n, s.cap, 'activation should fill exactly to the climate cap');
  assert.equal(STREET_POOL_CAP, 33, 'pool must cover the heat cap');
  assert.equal(s.count, s.cap);
});

test('rain caps the street low and vignettes cannot overflow it', () => {
  const { s, n } = fillStreet(CLIMATES.rain);
  assert.equal(s.cap, Math.round(STREET_CAP.full * CLIMATES.rain.streetMul));
  assert.equal(n, s.cap);
  assert.equal(s._spawnVignette(), null, 'vignette must not breach the rainy cap');
  assert.equal(s.count, s.cap);
});

test('lite mode keeps its own smaller pool', () => {
  const s = new StreetLife(scene, { lite: true });
  s.climate = CLIMATES.heat;
  s.live = true;
  let n = 0;
  while (s._activate({ kind: 'pavement', lotId: null, hold: null, doorId: null, points: [{ x: 0, z: LAYOUT.pavementZ, dwell: 30 }, { x: LAYOUT.spawnR.x, z: LAYOUT.pavementZ }] })) n++;
  assert.equal(n, Math.round(STREET_CAP.lite * CLIMATES.heat.streetMul));
});

const at = (u) => ({ zen: u.uZen.value.getHex(), hor: u.uHor.value.getHex(), sun: u.uSunInt.value, stars: u.uStars.value });

test('sky: rain flattens the sun and tints the dome; fair restores it', () => {
  const { sky, mesh, uniforms } = climateScene();
  assert.ok(mesh, 'sky mesh should exist');
  const t = 780;
  sky.update(t, null, 1, CLIMATES.fair);
  const fair = at(uniforms);
  sky.update(t, null, 1, CLIMATES.rain);
  const rain = at(uniforms);
  assert.ok(rain.sun < fair.sun, 'rain should flatten the sun');
  assert.notEqual(rain.zen, fair.zen, 'rain should tint the zenith');
  assert.notEqual(rain.hor, fair.hor, 'rain should tint the horizon');
  sky.update(t, null, 1, CLIMATES.rain);
  assert.deepEqual(at(uniforms), rain, 'repeated rain updates must not accumulate tint');
  sky.update(t, null, 1, CLIMATES.fair);
  assert.deepEqual(at(uniforms), fair, 'fair should restore the baseline exactly');
  sky.dispose();
});

test('brief-climate sits inside the fixed brief header, exactly once', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const briefAt = html.indexOf('id="brief"');
  const headerAt = html.indexOf('<header class="modal-header">', briefAt);
  const headerEnd = html.indexOf('</header>', headerAt);
  const climateAt = html.indexOf('id="brief-climate"');
  assert.ok(briefAt >= 0 && headerAt > briefAt && headerEnd > headerAt, 'brief header found');
  assert.ok(climateAt > headerAt && climateAt < headerEnd, 'brief-climate must live inside the header');
  assert.equal(html.split('id="brief-climate"').length - 1, 1, 'brief-climate appears exactly once');
});

test('sky: the climate tint is gone by night', () => {
  const { sky, uniforms } = climateScene();
  const t = 1250;
  sky.update(t, null, 1, CLIMATES.fair);
  const fair = at(uniforms);
  sky.update(t, null, 1, CLIMATES.rain);
  const rain = at(uniforms);
  assert.equal(rain.zen, fair.zen, 'the night zenith carries no climate tint');
  assert.equal(rain.hor, fair.hor, 'the night horizon carries no climate tint');
  sky.dispose();
});
