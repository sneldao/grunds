import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mainSrc = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
const htmlSrc = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const sourcesSrc = readFileSync(fileURLToPath(new URL('../assets/SOURCES.md', import.meta.url)), 'utf8');
const iconsDir = new URL('../assets/icons/', import.meta.url);

function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = src.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, `${name} has a next-function boundary`);
  return src.slice(start, end);
}

test('icon SVGs exist, are well-formed static SVG, and fit the budget', () => {
  let total = 0;
  for (const n of ['coffee-beans', 'croissant', 'coins', 'coffee-cup', 'milk-carton']) {
    const p = fileURLToPath(new URL(`${n}.svg`, iconsDir));
    const s = readFileSync(p, 'utf8');
    assert.ok(s.includes('xmlns="http://www.w3.org/2000/svg"'), n);
    assert.ok(s.includes('viewBox='), n);
    assert.ok(s.includes('<path'), n);
    assert.ok(!/<script|foreignObject|javascript:/i.test(s), n);
    assert.ok(!/\son[a-z]+\s*=/i.test(s), `${n} no event handlers`);
    assert.ok(!/\bhref\s*=|xlink:href/i.test(s), `${n} no external refs`);
    total += statSync(p).size;
  }
  assert.ok(total < 35 * 1024, `icons budget: ${total} bytes`);
});

test('renderPlanQuote labels the closing-bill summary with the coins icon', () => {
  const body = fnBody(mainSrc, 'renderPlanQuote');
  assert.ok(body.includes(`'brief-icon-label brief-icon-coins'`));
  assert.ok(body.includes('bills counted at closing'));
});

test('renderPastryCut labels the pastry section with the croissant icon', () => {
  const body = fnBody(mainSrc, 'renderPastryCut');
  assert.ok(body.includes(`'brief-icon-label brief-icon-pastry'`));
  assert.ok(body.includes('tomorrow’s croissant case'));
});

test('renderLotSection labels the lot summary with the coffee icon', () => {
  const body = fnBody(mainSrc, 'renderLotSection');
  assert.ok(body.includes(`'brief-icon-label brief-icon-coffee'`));
  assert.ok(body.includes('· change ›'));
});

test('icon labels are exact className assignments with no markup injection', () => {
  for (const [fn, cls] of [['renderPlanQuote', 'brief-icon-coins'], ['renderPastryCut', 'brief-icon-pastry'], ['renderLotSection', 'brief-icon-coffee']]) {
    const body = fnBody(mainSrc, fn);
    assert.ok(body.includes(`.className = 'brief-icon-label ${cls}'`), fn);
    assert.ok(!body.includes('innerHTML'), `${fn} no markup injection`);
    assert.ok(!/<svg|<img/i.test(body), `${fn} no inline svg/img`);
  }
});

test('CSS masks the glyph through currentColor with both mask properties', () => {
  const m = htmlSrc.match(/\.brief-icon-label::before\s*\{([^}]*)\}/);
  assert.ok(m, 'rule exists');
  const r = m[1];
  assert.ok(r.includes('content:'));
  assert.ok(r.includes('display: inline-block') || r.includes('display:inline-block'));
  assert.ok(r.includes('background-color: currentColor') || r.includes('background-color:currentColor'));
  assert.ok(r.includes('-webkit-mask'), 'webkit mask');
  assert.ok(/(^|;|\s)mask\s*:/.test(r), 'standard mask');
  assert.ok(r.includes('var(--brief-icon)'));
  assert.ok(r.includes('no-repeat'));
  for (const [cls, name] of [['brief-icon-coffee', 'coffee-beans'], ['brief-icon-pastry', 'croissant'], ['brief-icon-coins', 'coins']]) {
    const v = htmlSrc.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
    assert.ok(v, cls);
    assert.ok(v[1].includes(`--brief-icon: url('./assets/icons/${name}.svg')`), `${cls} relative url`);
  }
});

test('art credits details sits in the brief modal-body after review-last', () => {
  const rl = htmlSrc.indexOf('id="review-last"');
  const ac = htmlSrc.indexOf('id="asset-credits"');
  const footer = htmlSrc.indexOf('modal-footer', rl);
  assert.ok(rl >= 0 && ac > rl && ac < footer, 'order: review-last → credits → footer');
  const seg = htmlSrc.slice(ac, htmlSrc.indexOf('</details>', ac));
  assert.ok(seg.includes('<summary>art credits</summary>'));
  assert.ok(seg.includes('Delapouite'));
  assert.ok(seg.includes('rihlsul'));
  assert.ok(seg.includes('game-icons.net'));
  assert.ok(seg.includes('creativecommons.org/licenses/by/3.0/'));
  assert.ok(seg.includes('CC BY 3.0'));
  for (const href of ['delapouite.com', 'game-icons.net/1x1/rihlsul/milk-carton.html', 'game-icons.net', 'creativecommons.org/licenses/by/3.0/']) {
    const a = seg.match(new RegExp(`<a href="https?://[^"]*${href.replace(/\./g, '\\.')}[^"]*"[^>]*>`));
    assert.ok(a, href);
    assert.ok(a[0].includes('target="_blank"'), href);
    assert.ok(a[0].includes('rel="noopener noreferrer"'), href);
  }
});

test('SOURCES.md scopes CC0 to GLB/audio and records CC BY 3.0 icons', () => {
  assert.ok(!sourcesSrc.includes('All files CC0'), 'blanket CC0 claim removed');
  assert.ok(/icons.*CC BY 3\.0|CC BY 3\.0.*icons/i.test(sourcesSrc), 'icons called out as CC BY 3.0');
  assert.ok(/CC0/.test(sourcesSrc), 'CC0 retained for prior assets');
  for (const n of ['coffee-beans', 'croissant', 'coins', 'coffee-cup']) {
    assert.ok(sourcesSrc.includes(`delapouite/${n}.svg`), n);
    assert.ok(sourcesSrc.includes(`delapouite/${n}.html`), n);
  }
  assert.ok(sourcesSrc.includes('rihlsul/milk-carton.svg'));
  assert.ok(sourcesSrc.includes('rihlsul/milk-carton.html'));
  assert.ok(sourcesSrc.includes('Delapouite'));
  assert.ok(sourcesSrc.includes('creativecommons.org/licenses/by/3.0/'));
});

test('vital glyphs mask through a dedicated 14px rule, not the brief one', () => {
  const m = htmlSrc.match(/\.vital-icon::before\s*\{([^}]*)\}/);
  assert.ok(m, 'rule exists');
  const r = m[1];
  assert.ok(r.includes('content:'));
  assert.ok(r.includes('width: 14px') && r.includes('height: 14px'), '14px square');
  assert.ok(r.includes('background-color: currentColor'));
  assert.ok(r.includes('-webkit-mask'), 'webkit mask');
  assert.ok(/(^|;|\s)mask\s*:/.test(r), 'standard mask');
  assert.ok(r.includes('var(--vital-icon)'));
  assert.ok(!r.includes('margin'), 'no brief-style offset margin');
  for (const [cls, name] of [['vital-icon-cup', 'coffee-cup'], ['vital-icon-coffee', 'coffee-beans'], ['vital-icon-milk', 'milk-carton'], ['vital-icon-coins', 'coins']]) {
    const v = htmlSrc.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
    assert.ok(v, cls);
    assert.ok(v[1].includes(`--vital-icon: url('./assets/icons/${name}.svg')`), `${cls} relative url`);
  }
  for (const tok of ['--ok-ink: #3d5243', '--warn-ink: #7a5a2a', '--danger-ink: #7a2e1a'])
    assert.ok(htmlSrc.includes(tok), tok);
  assert.ok(htmlSrc.includes('#vitals li.v-bad .vv { color: var(--danger-ink)'));
  assert.ok(htmlSrc.includes('#vitals .vm i { display: block; height: 100%; width: 0; background: var(--ok-ink)'));
});
