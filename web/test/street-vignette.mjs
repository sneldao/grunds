// web/test/street-vignette.mjs — streetLife vignette machinery:
//   1. tick() can form a vignette group (busker+crowd or chat pair)
//   2. members are ordinary walk->dwell->walk agents sharing the cap
//   3. only one live group at a time (_vgAnchor gate)
//   4. anchor despawn releases the gate and the spot hold
//   5. vignettes stay off lite mode
import { test } from 'node:test';
import assert from 'node:assert';
import * as THREE from '../vendor/three.module.js';
import { StreetLife, VIGNETTE_SPOTS, STREET_CAP } from '../js/streetLife.js';

function mkStreet() {
  const s = new StreetLife(new THREE.Group(), { lite: false });
  s.live = true;
  s._since = 0;
  return s;
}

test('vignette groups form with members on dwell routes', () => {
  const s = mkStreet();
  let vg = null;
  for (let i = 0; i < 400 && !vg; i++) {
    s.tick();
    const found = s.agents.filter(a => a.vg);
    if (found.length) vg = found;
  }
  assert.ok(vg, 'no vignette formed in 400 cadence ticks');
  const anchor = s._vgAnchor;
  assert.ok(anchor && anchor.vg === 'busker' || vg.every(a => a.vg === 'chat'), 'anchor should be the busker or a chat member');
  for (const m of vg) {
    assert.equal(m.kind, 'vignette');
    assert.ok(m.path.length || m.state === 'dwell', 'member has a route or is dwelling');
    assert.equal(m.economic, false);
  }
});

test('one live group at a time; despawn releases the gate', () => {
  const s = mkStreet();
  for (let i = 0; i < 400 && !s._vgAnchor; i++) s.tick();
  assert.ok(s._vgAnchor, 'no vignette formed');
  const anchor = s._vgAnchor;
  s._despawn(anchor);
  assert.equal(s._vgAnchor, null, 'gate should release when the anchor despawns');
  assert.ok(![...s.holds].some(h => h.startsWith('vg:')), 'spot hold released');
});

test('vignettes stay off lite mode', () => {
  const s = new StreetLife(new THREE.Group(), { lite: true });
  s.live = true;
  for (let i = 0; i < 200; i++) s.tick();
  assert.ok(!s._vgAnchor && !s.agents.some(a => a.vg), 'lite mode spawned a vignette');
});

test('vignette spots are clear of cafe door and queue', () => {
  for (const sp of VIGNETTE_SPOTS) {
    assert.ok(sp.z >= 6 && sp.z < 9.6, `spot ${sp.x},${sp.z} should sit on the pavement band`);
    assert.ok(Math.abs(sp.x - (-5)) > 2, `spot ${sp.x} too near the door`);
  }
  assert.ok(STREET_CAP.full >= 10, 'cap should leave room for a vignette plus ambient');
});
