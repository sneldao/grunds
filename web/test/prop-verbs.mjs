// Phase 5 — Prop verbs + unified particles + mood faces (DOM-free shape).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { moodForOp, MOODS } from '../js/portrait.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const fx = readFileSync(resolve(root, 'web/js/fx.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');

test('Phase 5 · unified verbs exist, legacy aliases kept', () => {
  for (const v of ['steam(', 'puff(', 'coin(', 'flash(', 'sparkle(', 'rain(']) {
    assert.ok(fx.includes(v), `fx.js must define ${v}`);
  }
  for (const legacy of ['coinBurst', 'chalkDust', 'coinRain', 'steamFrom', 'constructionDust']) {
    assert.ok(fx.includes(legacy), `fx.js must keep legacy ${legacy}`);
  }
});

test('Phase 5 · lite guards cap every verb', () => {
  assert.ok(fx.includes('_guarded'), 'fx.js must define _guarded');
  assert.ok(fx.includes('this.lite'), 'fx.js must store the lite flag');
  assert.ok(/flash\([\s\S]{0,400}6/.test(fx), 'flash caps lite at 6');
});

test('Phase 5 · floor fires one verb per prop', () => {
  assert.ok(/propKey === 'camera' && sitting/.test(patrons), 'camera flash on sitting tourists');
  assert.ok(/propKey === 'laptop' && sitting/.test(patrons), 'laptop glow on sitting creatives');
  assert.ok(/p\.hasCup/.test(patrons) && /steam\(/.test(patrons), 'cup steam on served cups');
  assert.ok(/propKey === 'cane' && walking/.test(patrons), 'cane tap on walking elders');
  assert.ok(/never breaks the frame/.test(patrons), 'verbs never break the frame');
  const mkCount = (patrons.match(/mkProp\(/g) || []).length;
  assert.equal(mkCount, 7, 'no new prop meshes (7 rigs stay)');
});

test('Phase 5 · moodForOp maps opinion, floor shares the vocabulary', () => {
  assert.deepEqual([...MOODS].sort(), ['flat', 'sour', 'warm']);
  assert.equal(moodForOp(0.21), 'warm');
  assert.equal(moodForOp(-0.21), 'sour');
  assert.equal(moodForOp(0), 'flat');
  assert.equal(moodForOp(NaN), 'flat');
  assert.equal(moodForOp(undefined), 'flat');
  assert.ok(patrons.includes('moodFor(p.op)'), 'floor reads mood from opinion');
  assert.ok(patrons.includes("reactKind = 'serve'"), 'serves trigger reactions');
  assert.ok(patrons.includes("reactKind = 'grumble'"), 'balks trigger reactions');
});
