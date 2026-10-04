// The bar figure: Ruth, the apprentice, or nobody — behind the counter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../js/config.js';
import { avatarSpec } from '../js/portrait.js';
import { barPose } from '../js/poses.js';
import { barStaffSpec, barStand, buildBarStaff } from '../js/barstaff.js';

const POUR_HALF = 2.6 * 0.5;

test('barPose rests at the ends and peaks mid-pour', () => {
  const rest = barPose(0);
  const end = barPose(1);
  const mid = barPose(0.5);
  assert.ok(Math.abs(rest.armR) < 1e-9 && Math.abs(end.armR) < 1e-9, 'pour rests at the loop ends');
  assert.ok(Math.abs(rest.lean) < 1e-9 && rest.legSwing === 0, 'feet stay planted at rest');
  assert.ok(mid.armR > 1 && mid.lean > 0 && mid.headDip > 0, 'mid-pour reaches over the bar');
  assert.deepEqual(barPose(0.25), barPose(1.25), 'cycle wraps');
  assert.deepEqual(barPose(0.3), barPose(0.3), 'deterministic');
});

test('bar staff look follows the portrait seeds', () => {
  const ruth = barStaffSpec('work');
  const apprentice = barStaffSpec('apprentice');
  assert.deepEqual(
    { skin: ruth.skin, hairStyle: ruth.hairStyle, hairColor: ruth.hairColor, accessory: ruth.accessory, clothing: ruth.clothing },
    avatarSpec('ruth', 'commuters'),
    'Ruth matches her portrait',
  );
  assert.equal(ruth.accessory, 'hat');
  assert.notEqual(apprentice.clothing, ruth.clothing, 'apprentice wears a different colour');
  assert.notEqual(apprentice.accessory, 'hat', 'apprentice is not Ruth in a hat');
  assert.equal(barStaffSpec('home'), null);
  assert.equal(barStaffSpec('robot'), null);
});

test('the stand is behind the counter, not in the queue', () => {
  const C = LAYOUT.counter;
  const stand = barStand();
  const backEdge = C.z - C.d / 2;
  assert.ok(stand.z < backEdge, `z ${stand.z} should be behind the bar at ${backEdge}`);
  assert.ok(stand.z > -7.7, 'still in front of the back wall');
  assert.ok(Math.abs(stand.x - C.x) < C.w / 2, 'along the bar, not off to the side');
  assert.ok(stand.z < -4, 'not in the customer queue');
});

test('work shows Ruth, apprentice swaps the figure, home clears the spot', () => {
  const staff = buildBarStaff({ add() {} });
  assert.equal(staff.mode, 'work');
  assert.equal(staff.root.visible, true);
  assert.equal(staff.parts.hat.visible, true);
  assert.equal('#' + staff.parts.torso.material.color.getHexString(), avatarSpec('ruth', 'commuters').clothing);
  assert.equal('#' + staff.parts.head.material.color.getHexString(), avatarSpec('ruth', 'commuters').skin);

  staff.update(POUR_HALF, false);
  assert.ok(staff.phase > 0.4 && staff.phase < 0.6, 'pour advances');
  assert.ok(staff.parts.armR.rotation.x < -1, 'right arm reaches on the pour');

  staff.update(0.2, true);
  assert.equal(staff.phase, 0, 'reduced motion drops the loop');
  assert.ok(Math.abs(staff.parts.armR.rotation.x) < 1e-9, 'reduced motion holds the rest pose');

  staff.setMode('apprentice');
  assert.equal(staff.root.visible, true);
  assert.equal(staff.parts.hat.visible, false);
  assert.equal('#' + staff.parts.torso.material.color.getHexString(), avatarSpec('apprentice', 'students').clothing);
  assert.notEqual(
    staff.parts.torso.material.color.getHexString(),
    avatarSpec('ruth', 'commuters').clothing.slice(1),
  );

  staff.setMode('home');
  assert.equal(staff.mode, 'home');
  assert.equal(staff.root.visible, false);
  staff.update(1, false);
  assert.equal(staff.root.visible, false, 'home stays empty');
});
