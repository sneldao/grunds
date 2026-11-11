// Headless test for the Rodin describe path (convex/rodin.ts +
// franchise.describe branch + client opt-out). Player words grow through
// Rodin first with Tripo fallback; photo prompts stay on Tripo; the shared
// tripoAssets spine means status/record/streets/mirror need no changes.
// Contract checks are plain substring pins (no regex) so they cannot
// silently diverge from the source they quote.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

const rodin = readFileSync(join(ROOT, 'convex/rodin.ts'), 'utf8');
const convexFr = readFileSync(join(ROOT, 'convex/franchise.ts'), 'utf8');
const convexTripo = readFileSync(join(ROOT, 'convex/tripo.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const crons = readFileSync(join(ROOT, 'convex/crons.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'convex/schema.ts'), 'utf8');
const frJs = readFileSync(join(ROOT, 'web/js/franchise.js'), 'utf8');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8');

// ============================================================
// 1) convex/rodin.ts — the provider module
// ============================================================
check('rodin keys are namespaced off the tripo space', rodin.includes('return `rodin:${hashKey(fingerprint)}`'));
check('spec carries the workhorse tier + Raw + face target', rodin.includes('RODIN_MODEL = "Gen-2.5-Low"') && rodin.includes('RODIN_MESH_MODE = "Raw"') && rodin.includes('RODIN_FACE_TARGET = 10000'));
check('submit posts multipart to /rodin with the proof settings', rodin.includes('`${BASE}/rodin`') && rodin.includes('new FormData()') && rodin.includes('quality_override') && rodin.includes('geometry_file_format'));
check('submit checks the body error, not just the status', rodin.includes('data.error'));
check('status polls subscription_key, download takes task_uuid', rodin.includes('"/status"') && rodin.includes('subscription_key') && rodin.includes('"/download"') && rodin.includes('task_uuid'));
check('download picks the .glb before any query string', rodin.includes('.glb(\\?|$)'));
check('429 is a retry-next-tick, not a failure', rodin.includes('status === 429'));
check('seeds mod down to the Rodin 0-65535 range', rodin.includes('% 65536'));
check('generate reuses live rows before spending', rodin.includes('existing.provider === "rodin"'));
check('missing key degrades to fallback, never throws', rodin.includes('RODIN_API_KEY') && rodin.includes('fallback: true'));
check('daily spend guard refunds unstarted tasks', rodin.includes('claimDaily') && rodin.includes('refundDaily') && rodin.includes('rodin-generate'));
check('pollTask + reaper entry points exist', rodin.includes('export const pollTask') && rodin.includes('export const reaper'));
check('reaper shares the tripo thresholds', rodin.includes('REAPER_DEAD_MS') && rodin.includes('REAPER_STUCK_MS') && rodin.includes('NUDGE_MS'));
check('rows reuse the tripoAssets spine (no new table)', rodin.includes('internal.tripo.markProcessing') && rodin.includes('internal.tripo.applyResult') && rodin.includes('internal.tripo.staleProcessing'));
check('no Rodin table in the schema', !schema.includes('rodinAssets'));

// ============================================================
// 2) convex/franchise.ts — Rodin first, Tripo fallback
// ============================================================
check('rodinSpec frames words with the same house frame', convexFr.includes('rodinSpec') && convexFr.includes('prompt: `${prompt}${FRANCHISE_FRAME}`'));
check('rodin key contract mirrors the tripo one', convexFr.includes('rodinFranchiseKey') && convexFr.includes('return rodinKey(rodinSpec(seed, lot, prompt))'));
check('describe takes the builder escape hatch', convexFr.includes('builder: v.optional(v.string())'));
check('text prompts try Rodin before Tripo', convexFr.includes('if (!isImageInput(prompt) && args.builder !== "tripo")') && convexFr.indexOf('api.rodin.generate') < convexFr.indexOf('api.tripo.generate'));
check('a Rodin miss falls through to Tripo (never throws, never empty)', convexFr.includes('if (!r.fallback)'));
check('a Rodin success records under the rodin key', convexFr.includes('rodinFranchiseKey(args.seed, args.lot, prompt)'));
check('image inputs skip Rodin entirely', convexFr.includes('isImageInput(prompt)'));
check('persist copies Rodin outputs into storage too', convexTripo.includes('row.provider === "tripo" || row.provider === "rodin"'));
check('nudge dispatches on the row provider', convexFr.includes('t.provider === "rodin"') && convexFr.includes('internal.rodin.pollTask') && convexFr.includes('internal.tripo.pollTask'));

// ============================================================
// 3) wiring — http, crons, client, env
// ============================================================
check('http passes builder through to describe', http.includes('p.get("builder")') && http.includes('byline, builder'));
check('hourly rodin reaper is scheduled', crons.includes('"rodin-task-reaper"') && crons.includes('internal.rodin.reaper'));
check('client sends the builder opt-out', frJs.includes('&builder=tripo'));
check('main wires ?builder=tripo through', main.includes('builder=tripo'));
check('env documents the key + daily budget', envExample.includes('RODIN_API_KEY=') && envExample.includes('RODIN_DAILY_BUDGET=10'));

console.log(fails.length ? `\nFAIL (${fails.length}):\n - ${fails.join('\n - ')}` : '\nPASS — the Rodin describe path: words → Rodin first · photos stay Tripo · Rodin → Tripo → instant archetype');
process.exit(fails.length ? 1 : 0);
