// worldSpec — `?world=` words become the district's character. Pins the
// snapshot contract: synchronous resolve (cache or seeded classifier),
// strict validation with bands, cache round-trip, background LLM refresh,
// and the main.js seams (climate, deck bias, demand lean, save/resume).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EVENTS } from '../js/config.js';
import {
  WORLD_SPEC_KEY, worldSpecHash, classifyWorld, validateWorldSpec,
  resolveWorldSpec, cacheWorldSpec, loadCachedWorldSpec, refreshWorldSpec,
} from '../js/worldSpec.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const convexWs = readFileSync(join(ROOT, 'convex/worldSpec.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const idxHtml = readFileSync(join(ROOT, 'web/index.html'), 'utf8');

const fails = [];
const check = (n, c, d) => { if (!c) fails.push(`${n}: ${d || 'failed'}`); else console.log('  PASS', n); };
const EVENT_IDS = Object.keys(EVENTS);
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

// ---- hash + classifier ---------------------------------------------------------
check('hash is deterministic', worldSpecHash('a rainy neon district') === worldSpecHash('a rainy neon district'));
check('hash differs by words', worldSpecHash('rainy') !== worldSpecHash('sunny'));
check('empty prompt → null world', classifyWorld('') === null && classifyWorld('   ') === null);
const rain = classifyWorld('a rainy neon night market');
check('rain words → rain climate', rain.climate === 'rain');
check('rain words boost rain_soak', rain.bias.rain_soak > 1);
check('neon words lift demand', rain.demandMul > 1);
check('cold words → crisp + frost bias', (() => { const w = classifyWorld('a frosty winter street'); return w.climate === 'crisp' && w.bias.frost_minas > 1; })());
check('quiet words damp demand', classifyWorld('a quiet empty street').demandMul < 1);
check('colombia words hint the origin', classifyWorld('a colombia coffee street').origin === 'colombia');
check('rival name parses "against X"', classifyWorld('a busy street against GLASS TEA').rivalName === 'GLASS TEA');

// ---- validator ------------------------------------------------------------------
const raw = validateWorldSpec({
  name: 'the monsoon row', line: 'rain on neon.', climate: 'rain',
  bias: { rain_soak: 1.9, bogus_event: 5, frost_minas: 99 },
  demandMul: 3, rivalName: 'NOODLE HOUSE', origin: 'colombia', junk: 'drop me',
}, EVENT_IDS);
check('validator keeps the good fields', raw.name === 'the monsoon row' && raw.climate === 'rain' && raw.origin === 'colombia');
check('validator drops unknown event ids', !('bogus_event' in raw.bias));
check('validator clamps bias band', raw.bias.frost_minas === 2.5);
check('validator clamps demandMul band', raw.demandMul === 1.15);
check('validator drops junk fields', !('junk' in raw));
check('validator uppercases rivalName', raw.rivalName === 'NOODLE HOUSE');
check('empty spec → null', validateWorldSpec({}) === null && validateWorldSpec(null) === null && validateWorldSpec('rain') === null);
check('bad climate → null climate', validateWorldSpec({ name: 'x', climate: 'snow' }).climate === null);
check('seeded classifier output validates', !!validateWorldSpec(classifyWorld('a rainy street'), EVENT_IDS));
check('validator preserves model provenance', validateWorldSpec({ name: 'x', model: 'gpt-4o-mini' }).model === 'gpt-4o-mini');
check('validator drops non-string model', validateWorldSpec({ name: 'x', model: 42 }).model === null);

// ---- cache + resolve ---------------------------------------------------------------
const storage = mem();
check('resolve with no cache → seeded spec', resolveWorldSpec(storage, 'a rainy neon district', EVENT_IDS)?.source === 'seeded');
check('resolve is null without a prompt', resolveWorldSpec(storage, '', EVENT_IDS) === null);
const liveSpec = { name: 'the glass monsoon', line: 'neon rain.', climate: 'rain', bias: { rain_soak: 2 }, demandMul: 1.1, rivalName: 'STEAM', origin: 'eastAfrica' };
cacheWorldSpec(storage, 'a rainy neon district', liveSpec);
const resolved = resolveWorldSpec(storage, 'a rainy neon district', EVENT_IDS);
check('cached LLM card wins over seeded', resolved.source === 'live' && resolved.spec.name === 'the glass monsoon');
check('cache is keyed by prompt hash', loadCachedWorldSpec(storage, 'different words', EVENT_IDS) === null);
check('resolveWorldSpec round-trips through storage', resolveWorldSpec(mem(), 'a rainy neon district', EVENT_IDS).source === 'seeded');

// ---- background refresh ---------------------------------------------------------------
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ fallback: false, cached: false, spec: { ...liveSpec, name: `llm:${body.prompt.slice(0, 10)}` } }) };
};
const s2 = mem();
const got = await refreshWorldSpec(s2, 'http://x', 'a foggy harbourside street', EVENT_IDS);
check('refresh returns the validated spec', got && got.name.startsWith('llm:'));
check('refresh caches for next campaign', loadCachedWorldSpec(s2, 'a foggy harbourside street', EVENT_IDS)?.name.startsWith('llm:'));
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
check('refresh failure → null, never throws', (await refreshWorldSpec(mem(), 'http://x', 'whatever street', EVENT_IDS)) === null);
globalThis.fetch = async () => ({ ok: true, json: async () => ({ fallback: true, spec: null }) });
check('fallback response → null', (await refreshWorldSpec(mem(), 'http://x', 'whatever street', EVENT_IDS)) === null);

// ---- main.js seams ----------------------------------------------------------------------
check('?world= param parsed', main.includes("urlParams.get('world')"));
check('?prompt= + ?hackathon=1 parsed', main.includes("urlParams.get('prompt')") && main.includes("urlParams.has('hackathon')"));
check('hackathon mode forces the real provider path', main.includes('districtPolyforkOpt(location.search) && !hackathonMode'));
check('auto prompt only fires on the sandbox lot', main.includes('lot.sandbox !== true') && main.includes('maybeAutoPrompt()'));
check('world spec resolved at boot', main.includes('resolveWorldSpec(localStorage, worldPrompt'));
check('climate prefers live weather, then the described street, then seeded', /resolveClimate\(weatherAnchor, \(\) => \{[\s\S]{0,300}worldSpec\?\.spec\?\.climate[\s\S]{0,200}pickClimate/.test(main));
check('deck bias merges world bias under wire intel', main.includes('worldSpec?.spec?.bias') && main.includes('out[id] = (out[id] ?? 1) * mul'));
check('demand lean rides the wave multiplier', main.includes('worldSpec?.spec?.demandMul'));
check('world spec rides the week save', main.includes('world: worldSpec') && main.includes('save.world && save.world.spec'));
check('licence has a street field that re-seats with ?world=', idxHtml.includes('id="lic-world"') && main.includes("u.searchParams.set('world', typedWorld)"));
check('brief names the described street', main.includes('Your street: ${worldSpec.spec.name'));
check('brief credits the model on live world specs', main.includes("worldSpec.source === 'live'") && main.includes("shaped by ${worldSpec.spec.model || 'AI'}"));
check('origin hint is a suggestion not a pick', main.includes('the described street leans'));

// ---- backend ------------------------------------------------------------------------------
check('worldSpec action exists + cached', convexWs.includes('export const expand') && convexWs.includes('worldspec:v1:') && convexWs.includes('cachePut'));
check('expand stamps the provider model on the card', convexWs.includes('spec.model = model'));
check('worldSpec sanitizes against the real deck ids', convexWs.includes('EVENT_IDS') && convexWs.includes('sanitizeWorldSpec'));
check('http: /ai/worldspec POST route', http.includes('path: "/ai/worldspec"') && http.includes('method: "POST"'));
check('http handler validates the prompt', /aiWorldSpec[\s\S]{0,600}prompt required/.test(http));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — world specs: words → validated street config, cached, bounded, saved');
process.exit(fails.length ? 1 : 0);
