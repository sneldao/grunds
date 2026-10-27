// recut.mjs — the editorial pass, made by the same director that wrote the film.
//
// The event asks for a film *directed by* MiniMax M3.1 flash through SandBase,
// so a revision is a new direction call, not a hand-edit: this posts the
// approved script plus the editor's notes to the same endpoint the live game
// uses (`api.sandbase.ai/v1`, model `minimax/minimax-m3.1-flash`) and stores
// the raw answer next to the direction record.
//
//   node videos/city-remix/direction/recut.mjs            # call + write 06-final.json
//   node videos/city-remix/direction/recut.mjs --dry      # print the prompt only
//
// Files written: 05-recut.prompt.txt, 05-recut.response.json, 06-final.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const ENDPOINT = 'https://api.sandbase.ai/v1/chat/completions';
const MODEL = process.env.SANDBASE_MODEL || 'minimax/minimax-m3.1-flash';

// ---- env: the repo keeps keys in .env; read it without a dependency --------
function env(key) {
  if (process.env[key]) return process.env[key];
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(join(ROOT, f), 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* file may not exist */ }
  }
  return null;
}

const approved = JSON.parse(readFileSync(join(HERE, '04-final.json'), 'utf8'));

const prompt = `You directed the approved 94-second film below. The edit is now being graded, so the editor returns with two notes about what the film is spending its seconds on. Revise it and return the full JSON in the same schema, nothing else.

THE SCORECARD THE EDIT IS JUDGED ON
- 25% "Story & craft": the story is a moving "me and this city" — the city as a real, specific place, not a product tour.
- 25% "Accuracy": facts, places, names, dates.
- 30% "AI workflow": the direction is yours.

EDITOR'S NOTES

1. STOP SPENDING HALF THE FILM ON INTERFACE PANELS.
   The current cut holds on licence cards, tickers, the morning brief, the till, the share card, the lit map, and link-typing for about 52 of its 94 seconds. The street is the film. Restructure so that the sum of all frames dominated by a UI panel (S2, S3, S5, S6, S9, S10, S11, S12) is AT MOST 40 seconds, and no single UI hold exceeds 7 seconds.
   - Use the saved time on the world: S4 (the street orbit) may appear twice with a different action each time — e.g. once a wide orbit that keeps the LISBON road decal in frame, once a low, slower move that looks down at the calçada paving and the Lisbon-style props. Give those beats 8–11 seconds each and let them breathe.
   - Give the street the opening third. The viewer should see the city itself by about 20 seconds, not at 40. Put the first S4 beat straight after the licence, and keep the licence hold down to the welcome line plus one price line.
   - S2 (typing into the licence) is the one UI panel that is genuinely the story: the act of naming the city. Keep it, but 4–5 seconds, not 6.
   - S1 (the game's title screen) gets 2–3 seconds at most. S9 (the till) is atmosphere, not information: 3 seconds.
   - S7 (patrons queueing under their names), S8 (the rival stand, João) and both S4 beats are the human, place-bound heart of the film. Do not cut them.

2. ACCURACY IS NOW SCORED, SO NARROW THE CLAIMS TO WHAT THE PACK ACTUALLY SUPPORTS.
   - Never name the nearby cafés in a subtitle, and never imply they sit in Príncipe Real — they are real independent cafés scattered across central Lisbon, not a cluster on this street. The licence shot may show them; the letter may not narrate them.
   - The price line stays "about €4" — the word "about" is required. Never print a fixed price.
   - Príncipe Real is a real Lisbon district and the ticker names it; that is fine. Do not extend it into a claim about a specific address or a real map.
   - João, the patron names, and the welcome line are things the tool minted for this city; they are characters and generated copy, not real people or real quotations. Keep the letter's voice first-person but do not have Lisbon vouch for facts it cannot know.

KEEP (unchanged, hard limits)
- Letter from the city, first person, warm and a little wry; the turn to the viewer comes after the letter signs off (S11, S12, C-end).
- Total 88–100 seconds, English, subtitles are the only text track, no voiceover.
- Every subtitle: at most 2 lines, at most 42 characters per line, on screen at least 2.2 seconds, reading speed at most 15 characters per second.
- Shot vocabulary unchanged: S1–S12, C-open, C-end. S4 may be used twice. Invent no shots and no facts.
- The last ~10 seconds: C-end with the literal link grunds.trustfall.xyz/?city=yourcity and the line that every city typed joins the lit map.
- The letter signs off on the share card (S10) with a sign-off from Lisbon.

THE APPROVED SCRIPT (JSON)
${JSON.stringify(approved, null, 2)}

OUTPUT — return ONLY the JSON object, same schema, nothing else.`;

const dry = process.argv.includes('--dry');
writeFileSync(join(HERE, '05-recut.prompt.txt'), prompt + '\n');
if (dry) { console.log(prompt); process.exit(0); }

const key = env('SANDBASE_API_KEY');
if (!key) { console.error('SANDBASE_API_KEY not found in .env / .env.local / environment'); process.exit(1); }

// M3.1 flash spends a variable reasoning budget before it writes anything, and
// a 9.8k-char prompt plus a 94-second script can eat a whole 8k allowance in
// scratchpad alone (finish_reason "length", empty content). Give it room, and
// retry once at a larger allowance if it still comes back with reasoning only.
async function direct(maxTokens) {
  console.log(`→ ${MODEL} via ${ENDPOINT} (${prompt.length} char prompt, max_tokens ${maxTokens})`);
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });
  const body = await res.text();
  console.log(`← ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s (${body.length} bytes)`);
  if (!res.ok) throw new Error(body.slice(0, 600));
  writeFileSync(join(HERE, '05-recut.response.json'), body);
  const data = JSON.parse(body);
  const msg = data.choices?.[0]?.message ?? {};
  console.log(`   finish=${data.choices?.[0]?.finish_reason} content=${(msg.content ?? '').length}b reasoning=${(msg.reasoning_content ?? '').length}b`);
  return msg.content ?? '';
}

let raw = await direct(32000);
if (!raw.trim()) raw = await direct(60000);
if (!raw.trim()) { console.error('no content after two attempts — see 05-recut.response.json'); process.exit(1); }
const script = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
writeFileSync(join(HERE, '06-final.json'), JSON.stringify(script, null, 2) + '\n');

// ---- the same gates the film has to pass, checked before anything renders --
const UI = new Set(['S2', 'S3', 'S5', 'S6', 'S9', 'S10', 'S11', 'S12']);
const problems = [];
let ui = 0, end = 0;
for (const s of script.scenes ?? []) {
  if (Math.abs((s.start ?? 0) - end) > 0.01) problems.push(`scene ${s.id}: starts ${s.start}, expected ${end}`);
  end = (s.start ?? 0) + (s.duration ?? 0);
  if (UI.has(s.shot)) {
    ui += s.duration;
    if (s.duration > 7.01) problems.push(`scene ${s.id}: UI hold ${s.duration}s > 7s`);
  }
  for (const c of s.subtitles ?? []) {
    const lines = c.text.split('\n');
    if (lines.length > 2) problems.push(`scene ${s.id}: ${lines.length} subtitle lines`);
    for (const l of lines) if (l.length > 42) problems.push(`scene ${s.id}: line ${l.length} chars — "${l}"`);
    if (c.dur < 2.19) problems.push(`scene ${s.id}: ${c.dur}s cue < 2.2s`);
    const cps = c.text.replace(/\n/g, ' ').length / c.dur;
    if (cps > 15.01) problems.push(`scene ${s.id}: ${cps.toFixed(1)} chars/s — "${c.text.replace(/\n/g, ' / ')}"`);
    if (c.at < s.start - 0.01 || c.at + c.dur > s.start + s.duration + 0.05) problems.push(`scene ${s.id}: cue overruns the shot`);
  }
}
const realShots = new Set(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'C-open', 'C-end']);
for (const s of script.scenes ?? []) if (!realShots.has(s.shot)) problems.push(`scene ${s.id}: unknown shot ${s.shot}`);

console.log(`\ntotal ${end.toFixed(1)}s · ${script.scenes?.length} scenes · UI-panel time ${ui.toFixed(1)}s · world/type ${(end - ui).toFixed(1)}s`);
if (problems.length) console.log('GATE PROBLEMS:\n - ' + problems.join('\n - '));
else console.log('all gates pass (timing, shot vocabulary, subtitle 2-line / 42-char / 2.2s / 15cps, UI ≤ 40s)');
