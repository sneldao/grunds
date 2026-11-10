// prompt-entry — the described stand is the front door. Pins the first-visit
// overlay's seams (element on the title screen, gated to fresh browsers,
// deep-links via ?prompt= / ?lite=1) and that ?lite stays a real mode:
// GLB humanoids skipped, shadows off, vignettes gated, licence offers it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FRANCHISE } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8');
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
const street = readFileSync(join(ROOT, 'web/js/streetLife.js'), 'utf8');

const fails = [];
const check = (n, c, d) => { if (!c) fails.push(`${n}: ${d || 'failed'}`); else console.log('  PASS', n); };

// ---- the overlay --------------------------------------------------------------
check('title carries the prompt intro', html.includes('id="prompt-intro"') && html.includes('id="prompt-intro-input"'));
check('intro ships a pre-filled example', /id="prompt-intro-input"[^>]*value="a tiny late-night ramen counter"/.test(html));
check('go + lite links exist', html.includes('id="prompt-intro-go"') && html.includes('id="prompt-intro-lite"'));
check('intro hidden by default', /<div id="prompt-intro" hidden>/.test(html));
check('input caps at the prompt max', html.includes(`maxlength="${FRANCHISE.promptMax}"`));

// ---- gates ----------------------------------------------------------------------
check('intro only shows without a saved week', main.includes('!loadWeek(localStorage)') && main.includes('pi.hidden = !fresh'));
check('intro suppressed on deep links + scripted runs', main.includes('!headless && !demoMode && !autoPrompt'));
check('go navigates with ?prompt=', main.includes("u.searchParams.set('prompt', v)"));
check('lite link adds ?lite=1', main.includes("u.searchParams.set('lite', '1')"));
check('blank go just plays the default district', main.includes('pi.hidden = true;'));

// ---- lite stays a real mode -------------------------------------------------------
check('?lite flag parsed', main.includes("urlParams.has('lite')"));
check('lite skips GLB humanoids', main.includes('if (!lite) try { street.loadChars'));
check('lite drops shadows', world.includes('renderer.shadowMap.enabled = !lite'));
check('vignettes gated on lite', street.includes('!this.lite && !this._vgAnchor'));
check('licence offers lite mode', html.includes('id="lic-lite"') && main.includes("$('lic-lite')"));
check('typed street survives the lite reload', main.includes("u.searchParams.set('world', w)"));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — prompt entry: the described stand is the front door');
process.exit(fails.length ? 1 : 0);
