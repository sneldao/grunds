// web/test/neighbor-boards.mjs — attention street pillar 4 (VISION.md):
// the four neighbour buildings ARE the roster shops (door ids = shop ids),
// and each puts its market posture on an A-frame board at dawn. The board
// copy is boardLine() in street.js — a pure function of the streetForDay
// row, so the pavement can never disagree with the morning Brief.
// Run: node --test web/test/neighbor-boards.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STREET, streetForDay, boardLine } from '../js/street.js';
import { NEIGHBOR_DOORS } from '../js/streetLife.js';
import { EVENTS } from '../js/config.js';

const row = (rows, id) => rows.find(r => r.id === id);
const ev = (id) => ({ ...EVENTS[id], id });

test('door ids and roster ids are one thing', () => {
  const doorIds = NEIGHBOR_DOORS.map(d => d.id).sort();
  assert.deepEqual(doorIds, ['bell', 'hearth', 'marrow', 'quill']);
  const shopIds = STREET.map(s => s.id);
  for (const id of doorIds) assert.ok(shopIds.includes(id), `door ${id} missing from the roster`);
});

test('an origin event paints the shop it hits', () => {
  const rows = streetForDay(ev('frost_minas'), 0);
  const hearth = boardLine(row(rows, 'hearth'), ev('frost_minas'));
  assert.equal(hearth.tone, 'dark');
  assert.match(hearth.title, /PLATEAU FROZE/);
  // The frost is Hearth & Rye's frost — nobody else wears it.
  for (const id of ['quill', 'bell', 'marrow']) {
    const b = boardLine(row(rows, id), ev('frost_minas'));
    assert.notEqual(b.tone, 'dark', `${id} should not wear a Brazil frost`);
  }
  const rumour = streetForDay(ev('rumour_frost'), 0);
  assert.equal(boardLine(row(rumour, 'hearth'), ev('rumour_frost')).tone, 'bracing');
  const rains = streetForDay(ev('drought_ea'), 0);
  assert.equal(boardLine(row(rains, 'quill'), ev('drought_ea')).tone, 'dark');
  const harvest = streetForDay(ev('harvest_good'), 0);
  assert.equal(boardLine(row(harvest, 'bell'), ev('harvest_good')).tone, 'bright');
});

test('specialists post their early read on quiet-market days', () => {
  const stable = ev('stable');
  const up = streetForDay(stable, 0.033);
  const bellUp = boardLine(row(up, 'bell'), stable);
  assert.equal(bellUp.tone, 'bracing');
  assert.match(bellUp.title, /BUYING AHEAD/);
  const down = streetForDay(stable, -0.02);
  assert.equal(boardLine(row(down, 'bell'), stable).tone, 'bright');
  // Flat drift: no read, standing copy.
  const flat = streetForDay(stable, 0);
  assert.equal(boardLine(row(flat, 'bell'), stable).tone, 'flat');
});

test('quiet days get standing copy; hybrids never read; chains keep their own board', () => {
  const stable = ev('stable');
  const rows = streetForDay(stable, 0);
  for (const id of ['quill', 'hearth', 'bell', 'marrow']) {
    const b = boardLine(row(rows, id), stable);
    assert.equal(b.tone, 'flat', `${id} standing copy on a quiet day`);
    assert.ok(b.title && b.sub);
  }
  assert.match(boardLine(row(rows, 'marrow'), stable).sub, /cocoa/i, 'the hybrid says what it is');
  assert.equal(boardLine(row(rows, 'glasshouse'), stable), null, 'Glasshouse keeps its strategy board');
  assert.equal(boardLine(row(rows, 'player'), ev('frost_minas')), null, 'the player stand keeps its own chalkboard');
});

test('board copy is a pure function of the street row', () => {
  const frost = ev('frost_minas');
  const a = JSON.stringify(streetForDay(frost, 0.01).map(r => boardLine(r, frost)));
  const b = JSON.stringify(streetForDay(frost, 0.01).map(r => boardLine(r, frost)));
  assert.equal(a, b);
});

test('world.js builds one A-frame per door and main.js paints them at dawn', () => {
  const world = readFileSync(new URL('../js/world.js', import.meta.url), 'utf8');
  assert.ok(world.includes('W.setNeighborBoards'), 'world exposes the board painter');
  for (const d of NEIGHBOR_DOORS) {
    assert.ok(world.includes(`id: '${d.id}'`), `board frame for ${d.id}`);
  }
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('world.setNeighborBoards(streetBoards)'), 'dawn paints the boards from streetForDay');
  assert.ok(main.includes('street.setNeighborQueues(neighborQueues(streetBoards, seedNow(), d))'),
    'dawn sets the apron queues from the same board tones');
  assert.ok(main.includes('boardLine'), 'dawn uses boardLine for the copy');
});
