import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST_PROFILES, walkinProfile, profileView } from '../js/cast.js';
import { makeIdentity, recordVisit } from '../js/identity.js';
import { REGULAR_ROSTER } from '../js/config.js';

test('cast · every roster name has a bio and a want', () => {
  assert.equal(REGULAR_ROSTER.length, 8);
  for (const r of REGULAR_ROSTER) {
    const p = CAST_PROFILES[r.name];
    assert.ok(p && p.bio.length > 10, `${r.name} bio`);
    assert.ok(p.wants.length > 10, `${r.name} wants`);
  }
});

test('cast · cast heading is REGULAR, profile copy is theirs', () => {
  const ident = makeIdentity({ pid: 'x', name: 'Mara', cohort: 'commuters', drink: 'flat white', visits: 5, stage: 'regular' });
  const v = profileView(ident, { op: 0.3, isCast: true, friends: ['Dev', 'Olu'] });
  assert.equal(v.heading, 'REGULAR');
  assert.equal(v.name, 'Mara');
  assert.match(v.bio, /8:10/);
  assert.match(v.wants, /short line/);
  assert.equal(v.usual, 'flat white');
  assert.equal(v.feeling, 'warming to you');
  assert.match(v.friends, /Dev, Olu/);
});

test('cast · feeling is words only — never a number', () => {
  const ident = makeIdentity({ pid: 'x', name: 'T', cohort: 'students', drink: 'matcha', visits: 2 });
  for (const [op, want] of [[0.9, 'warming to you'], [-0.9, 'unhappy with you'], [0, 'still making up their mind']]) {
    const v = profileView(ident, { op });
    assert.equal(v.feeling, want);
    assert.ok(!/\d/.test(v.feeling), 'feeling carries no digits');
  }
});

test('cast · lastBetween covers served / balked / defected / never met', () => {
  const mk = () => makeIdentity({ pid: 'x', name: 'Pip', cohort: 'students', drink: 'matcha' });
  assert.equal(profileView(mk(), {}).lastBetween, 'You haven’t met properly yet.');
  let i = mk(); recordVisit(i, { day: 1, outcome: 'served', stayed: true });
  assert.equal(profileView(i, {}).lastBetween, 'Last time: had a matcha and stayed a while');
  i = mk(); recordVisit(i, { day: 1, outcome: 'balked' });
  assert.equal(profileView(i, {}).lastBetween, 'Last time: walked out of a long line');
  i = mk(); recordVisit(i, { day: 1, outcome: 'defected' });
  assert.equal(profileView(i, {}).lastBetween, 'Last time: crossed the road to Glasshouse');
});

test('cast · history holds up to 4 older events, newest first', () => {
  const ident = makeIdentity({ pid: 'x', name: 'Olu', cohort: 'elders', drink: 'tea' });
  for (let d = 1; d <= 7; d++) recordVisit(ident, { day: d, outcome: 'served' });
  const v = profileView(ident, {});
  assert.ok(v.history.length <= 4);
  assert.match(v.history[0], /day 6 — served tea/);
  const mixed = makeIdentity({ pid: 'x', name: 'M', cohort: 'commuters', drink: 'filter' });
  recordVisit(mixed, { day: 1, outcome: 'served' });
  recordVisit(mixed, { day: 2, outcome: 'served', drink: 'Espresso' });
  assert.equal(profileView(mixed, {}).lastBetween, 'Last time: had an espresso');
  assert.match(profileView(mixed, {}).history[0], /served filter/);
  assert.ok(!v.history.some(l => /day 7/.test(l)), 'most recent event is the lastBetween line, not history');
});

test('cast · walk-in copy by stage and cohort', () => {
  const fresh = makeIdentity({ pid: 'w1', name: 'Ash', cohort: 'tourists', drink: 'flat white', visits: 0 });
  assert.match(walkinProfile(fresh).bio, /first time through your door/);
  assert.match(walkinProfile(fresh).wants, /worth remembering/);
  const warming = makeIdentity({ pid: 'w2', name: 'Bo', cohort: 'students', drink: 'matcha', visits: 3, op: 0 });
  assert.equal(walkinProfile(warming).bio, 'Has been in a few times now.');
  assert.equal(walkinProfile(warming).wants, 'Matcha and a fair price.');
  const reg = makeIdentity({ pid: 'w3', name: 'Cy', cohort: 'elders', drink: 'tea', visits: 6, op: 0.4 });
  assert.equal(walkinProfile(reg).bio, 'One of your new regulars.');
  assert.equal(walkinProfile(reg).wants, 'A calm room and things done properly.');
});

test('cast · usual is the most frequent served drink, ties most recent', () => {
  const mara = makeIdentity({ pid: 'x', name: 'Mara', cohort: 'commuters', drink: 'flat white', visits: 5, stage: 'regular' });
  assert.equal(profileView(mara, { isCast: true }).usual, 'flat white');
  recordVisit(mara, { day: 1, outcome: 'served', drink: 'Espresso' });
  recordVisit(mara, { day: 2, outcome: 'served', drink: 'Espresso' });
  recordVisit(mara, { day: 3, outcome: 'served', drink: 'Flat white' });
  assert.equal(profileView(mara, { isCast: true }).usual, 'espresso');
});

test('cast · walk-in headings — new face until established', () => {
  const fresh = makeIdentity({ pid: 'w1', name: 'Ash', cohort: 'commuters', drink: 'filter', visits: 0 });
  assert.equal(profileView(fresh, { isCast: false }).heading, 'A NEW FACE');
  const reg = makeIdentity({ pid: 'w3', name: 'Cy', cohort: 'elders', drink: 'tea', visits: 6, op: 0.4 });
  assert.equal(profileView(reg, { isCast: false }).heading, 'REGULAR');
});
