// Phase 5 — Readable place: live menu board, Sam's chalkboard, lease
// finale, rain day, written camera grammar. DOM-free shape + pure imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EVENTS } from '../js/config.js';
import { SHOTS } from '../js/camera.js';
import { strategyCopy } from '../js/rival.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const world = readFileSync(resolve(root, 'web/js/world.js'), 'utf8');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const textures = readFileSync(resolve(root, 'web/js/textures.js'), 'utf8');

test('Phase 5 · live menu board renders prices + 86', () => {
  assert.ok(textures.includes('drawMenu'), 'textures must define drawMenu');
  assert.ok(world.includes('W.setMenu'), 'world must define setMenu');
  assert.ok(world.includes('setMatchaPrice'), 'setMatchaPrice wrapper kept');
  assert.ok(main.includes('world.setMenu'), 'prepareDay paints the live menu');
});

test('Phase 5 · Sam chalkboard renders the actual strategy', () => {
  const c = strategyCopy('PRICE_WAR');
  assert.equal(c.title, 'PRICE WAR');
  assert.ok(c.price > 0, 'copy carries the price');
  const d = strategyCopy('DEFAULT');
  assert.equal(d.title, 'BALANCED');
  assert.ok(world.includes('stratLine'), 'board maps keys to titles');
  assert.ok(main.includes('setRivalStrategy'), 'rival path still paints the board');
});

test('Phase 5 · lease sign is a physical finale object', () => {
  assert.ok(world.includes('W.setLeaseFinale'), 'world must define setLeaseFinale');
  assert.ok(textures.includes('forlease'), 'rentSign draws FOR LEASE');
  assert.ok(textures.includes('deuce'), 'rentSign draws DEUCE');
  assert.ok(main.includes('setLeaseFinale'), 'campaignClose re-bakes the sign');
});

test('Phase 5 · rain day is event + visuals + demand', () => {
  assert.equal(EVENTS.rain_soak.tier, 'rain');
  assert.equal(EVENTS.rain_soak.demand, 0.82);
  assert.ok(world.includes('W.setRain'), 'world must define setRain');
  assert.ok(main.includes('rain_soak'), 'prepareDay branches on rain');
  assert.ok(main.includes("world.setRain"), 'rain drives the street layer');
});

test('Phase 5 · camera grammar names every shot', () => {
  for (const k of ['verdict', 'lease', 'debrief', 'rivalReact', 'newbuild']) {
    assert.ok(SHOTS[k], `SHOTS must define ${k}`);
    assert.ok(Number.isFinite(SHOTS[k].r), `${k} carries a distance`);
  }
  assert.equal(SHOTS.debrief.r, 11);
  assert.equal(SHOTS.debrief.secs, 3.5);
  assert.ok(world.includes("shot(") || main.includes("rig.shot"), 'shots fire through the grammar');
  const camera = readFileSync(resolve(root, 'web/js/camera.js'), 'utf8');
  assert.match(camera, /const HOME = \{[^}]*r: 24/, 'idle/home radius should sit closer than 32');
  assert.match(camera, /r: Math\.max\(18, r\)/, 'scripted focus still clamps inside the home radius');
});
