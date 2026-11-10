// standSpec — the described stand's working logic. Pins the contract the
// sim relies on: same words → same card, junk never becomes config, the
// pull is bounded and hour-gated, and a stand without a spec changes
// nothing (every pre-spec replay stays bit-identical).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ARCHETYPES, ARCHETYPE_IDS, SPEC_PULL_CAP, SPEC_PULL_MAX,
  archetypeFor, specFromPrompt, normalizeSpec, specForLot, specPull, specPullSum, specLine,
} from '../js/standSpec.js';
import { FRANCHISE } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const frJs = readFileSync(join(ROOT, 'web/js/franchise.js'), 'utf8');
const convexSpec = readFileSync(join(ROOT, 'convex/standSpec.ts'), 'utf8');
const convexFr = readFileSync(join(ROOT, 'convex/franchise.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'convex/schema.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');

const fails = [];
const check = (n, c, d) => { if (!c) fails.push(`${n}: ${d || 'failed'}`); else console.log('  PASS', n); };

// ---- the seeded classifier --------------------------------------------------
check('ramen words → nightEats', archetypeFor('a tiny late-night ramen counter') === 'nightEats');
check('vinyl words → singleOrigin', archetypeFor('a vinyl listening bar') === 'singleOrigin');
check('commuter words → grabAndGo', archetypeFor('a commuter sandwich kiosk') === 'grabAndGo');
check('unknown words still get a card', archetypeFor('something nice') === 'thirdPlace');
check('specFromPrompt is deterministic', JSON.stringify(specFromPrompt('a ramen bar')) === JSON.stringify(specFromPrompt('a ramen bar')));
check('specFromPrompt names the stand', specFromPrompt('a ramen bar').name.length > 3);
check('every archetype has cohort+daypart+pull', ARCHETYPE_IDS.every(id => {
  const a = ARCHETYPES[id];
  return a.cohort && Array.isArray(a.daypart) && a.pull > 0 && a.pull <= SPEC_PULL_MAX;
}));
check('empty prompt → null spec', specFromPrompt('') === null && specFromPrompt(null) === null);

// ---- the validator -----------------------------------------------------------
const good = normalizeSpec({
  name: 'The Ramen Counter', cuisine: 'ramen', archetype: 'nightEats',
  cohort: 'students', daypart: [1080, 1260], pull: 0.24, priceTier: 'cheap',
  signature: 'miso ramen', quirk: 'opens at midnight', source: 'llm',
});
check('a good LLM card survives intact', good && good.name === 'The Ramen Counter' && good.cohort === 'students' && good.pull === 0.24);
check('junk cohort drops to null', normalizeSpec({ cohort: 'aliens', pull: 0.2 }).cohort === null);
check('pull clamps to SPEC_PULL_MAX', normalizeSpec({ pull: 9 }).pull === SPEC_PULL_MAX);
check('pull floors at 0', normalizeSpec({ pull: -3 }).pull === 0);
check('daypart must be a rising pair', normalizeSpec({ daypart: [1200, 600] }).daypart === null);
check('daypart clamps into the day', JSON.stringify(normalizeSpec({ daypart: [-50, 2000] }).daypart) === JSON.stringify([0, 1440]));
check('unknown priceTier drops', normalizeSpec({ priceTier: 'gold' }).priceTier === null);
check('non-object → null', normalizeSpec('ramen') === null && normalizeSpec(null) === null);
check('archetype fills gaps', (() => { const s = normalizeSpec({ archetype: 'nightEats' }); return s.cohort === 'students' && s.pull > 0 && s.daypart; })());
check('a card with nothing useful → still a named stand but pulls nothing', (() => {
  const s = normalizeSpec({ name: 'X', cohort: 'aliens', pull: 0 });
  return s && s.name === 'X' && s.pull === 0 && s.cohort === null;
})());

// ---- the pull -----------------------------------------------------------------
const ramen = specFromPrompt('a late-night ramen counter');
check('specPull hits inside cohort+hours', Math.abs(specPull(ramen, 'students', 1140) - ramen.pull) < 1e-9);
check('specPull misses outside the daypart', specPull(ramen, 'students', 700) === 0);
check('specPull misses the wrong cohort', specPull(ramen, 'commuters', 1140) === 0);
check('specPull misses at the window edge', specPull(ramen, 'students', 1260) === 0);
const allDay = normalizeSpec({ cohort: 'tourists', pull: 0.2, daypart: null });
check('null daypart pulls all day', specPull(allDay, 'tourists', 100) === 0.2);
check('no spec pulls nothing', specPull(null, 'students', 1140) === 0 && specPullSum([null], 'students', 1140) === 1);
check('pull sums then caps', (() => {
  const loud = { cohort: 'students', daypart: null, pull: SPEC_PULL_MAX };
  const sum = specPullSum([loud, loud, loud, loud], 'students', 600);
  return Math.abs(sum - (1 + SPEC_PULL_CAP)) < 1e-9;
})());
check('specForLot prefers the stored card', specForLot({ spec: good, prompt: 'ramen' }).name === 'The Ramen Counter');
check('specForLot falls back to the prompt', specForLot({ prompt: 'a vinyl bar' }).archetype === 'singleOrigin');
check('specForLot tolerates junk spec + no prompt', specForLot({ spec: 'garbage' }) === null);
check('specLine names who and when', /students/.test(specLine(ramen)) && /18:00/.test(specLine(ramen)));

// ---- LLM attribution ------------------------------------------------------------
check('validator preserves model provenance', normalizeSpec({ name: 'X', model: 'gpt-4o-mini' }).model === 'gpt-4o-mini');
check('validator drops junk model', normalizeSpec({ name: 'X', model: 42 }).model === null);
const llmRamen = normalizeSpec({ name: 'R', cohort: 'students', pull: 0.2, source: 'llm', model: 'gpt-4o-mini' });
check('specLine credits the model on LLM cards', specLine(llmRamen).includes(' · via gpt-4o-mini'));
check('specLine falls back to shaped-by-AI without a model', specLine(normalizeSpec({ name: 'R', source: 'llm' })).includes(' · shaped by AI'));
check('seeded cards carry no attribution', !/via |shaped by AI/.test(specLine(ramen)));

// ---- client wiring --------------------------------------------------------------
check('main imports the spec module', main.includes("from './standSpec.js'"));
check('wave loop multiplies by standWaveMul', (main.match(/standWaveMul\(s\.c, w\.t\)/g) || []).length >= 2);
check('standWaveMul only counts placed success stands', /s\.status !== 'success' \|\| !s\.placed\) continue/.test(main));
check('franchise stores the server spec on describe + read', frJs.includes('ls.spec = d.spec ?? null') && frJs.includes('ls.spec = l.spec ?? null'));
check('franchise exposes specForLot to the sign', frJs.includes('specForLot(ls)?.name'));
check('morning brief names each stand\'s pull', frJs.includes('specLine(specForLot(s))'));

// ---- backend wiring ---------------------------------------------------------------
check('schema: franchises.spec column (optional, legacy rows null)', schema.includes('spec: v.optional(v.string())'));
check('describe expands the spec via standSpec.expand', convexFr.includes('api.standSpec.expand') && convexFr.includes('specJson'));
check('record persists the spec', (convexFr.match(/spec: args\.spec/g) || []).length >= 2);
check('status returns the parsed spec + stand name', convexFr.includes('spec: sp.spec') && convexFr.includes('standName: sp.standName'));
check('standSpec action exists and is cached', convexSpec.includes('export const expand') && convexSpec.includes('cachePut') && convexSpec.includes('spec:v1:'));
check('standSpec sanitizes cohort/pull/daypart', convexSpec.includes('sanitizeStandSpec') && convexSpec.includes('COHORTS.includes'));
check('image prompts skip the spec call', convexFr.includes('isImageInput(prompt)\n      ? null'));
check('expand stamps the provider model on the card', convexSpec.includes('spec.model = model'));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — stand specs: words → card → bounded cohort/daypart pull');
process.exit(fails.length ? 1 : 0);
