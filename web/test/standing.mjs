// Held and insolvency are explained in words. The gates themselves do not move.
// Run: node web/test/standing.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { campaignVerdict, weekStanding, standingNudge, VERDICT_GATES } from '../js/economy.js';
import { composeLetter } from '../js/letter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const held = VERDICT_GATES.held;
ok(held.netAbove === 4500 && held.repAtLeast === 50, 'held gate drifted');
ok(campaignVerdict(4500, 50) === 'scarped', '£4,500 exactly is not held');
ok(campaignVerdict(4500.01, 50) === 'held', 'cash just over £4,500 with rep 50 is held');
ok(campaignVerdict(5000, 49) === 'scarped', 'cash without reputation is not held');
ok(campaignVerdict(5000, 45) === 'scarped', 'rep 45 misses held');
ok(campaignVerdict(9000, 70) === 'star' && campaignVerdict(6000, 60) === 'good', 'star and good gates drifted');
ok(campaignVerdict(100, 80) === 'scarped' && campaignVerdict(0, 90) === 'lost' && campaignVerdict(-1, 90) === 'lost', 'scraped and lost stay on cash');

const opening = weekStanding({ net: 0, rep: 62, day: 1, asOf: 'opening' });
ok(opening.tone === 'ok' && !opening.insolvent, 'day 1 with nothing closed is not a bust warning');
ok(opening.lines.join(' ').includes('more than £4,500') && opening.lines.join(' ').includes('regulars at 50'), 'opening copy names the held bar');
ok(opening.cashLine.includes('Below £0'), 'opening copy names the tab');
ok(!opening.cashLine.includes('£0.00'), 'opening copy does not treat an empty book as a position');

const cool = weekStanding({ net: 3000, rep: 45, day: 3, asOf: 'close', nut: 2800 });
ok(cool.tone === 'warn' && cool.repShort && !cool.insolvent, 'rep 45 warns without calling the tab');
ok(cool.repLine.includes('45/100') && cool.repLine.includes('5 short') && /walk-outs/i.test(cool.repLine), cool.repLine);
ok(cool.heldLine.includes('£4,500') && cool.heldLine.includes('50'), cool.heldLine);
ok(standingNudge(cool, 3)?.tone === 'warn', 'a short room is said out loud');

const thin = weekStanding({ net: 400, rep: 62, day: 2, asOf: 'last-close', nut: 2900 });
ok(thin.tone === 'warn' && thin.underNut && !thin.insolvent, 'under today’s bills warns, it does not end the week');
ok(thin.cashLine.includes('£400.00') && thin.cashLine.includes('£2,900.00') && thin.cashLine.includes('Below £0'), thin.cashLine);
ok(thin.cashLine.includes('3 mornings'), thin.cashLine);
const briefDay = weekStanding({ net: 400, rep: 62, day: 2, asOf: 'last-close', nut: 2900, countToday: true });
ok(briefDay.cashLine.includes('4 mornings'), briefDay.cashLine);
ok(standingNudge(thin, 2) === null, 'day 2 under the nut stays on the brief');
ok(standingNudge(thin, 3)?.text === thin.cashLine, 'from day 3 the thin week is repeated');

const bust = weekStanding({ net: -120.5, rep: 48, day: 3, asOf: 'close' });
ok(bust.tone === 'bad' && bust.insolvent && campaignVerdict(-120.5, 48) === 'lost', 'below £0 is still lost');
ok(bust.cashLine.includes('−£120.50') && bust.cashLine.includes('calls the tab'), bust.cashLine);
ok(standingNudge(bust, 3)?.tone === 'bad', 'insolvency nudges before the morning');

const safe = weekStanding({ net: 5000, rep: 55, day: 4, asOf: 'close', nut: 2000 });
ok(safe.tone === 'ok' && campaignVerdict(5000, 55) === 'held', 'a held week does not wear a warning');
ok(safe.repLine.includes('you’re there'), safe.repLine);
ok(!safe.sliding && safe.slideLine == null, 'a quiet week has no slide line');

// Still solvent, still over today’s bills, but one more day like the last
// close would cross £0. Copy only — the verdict and the tab do not move.
const slide = weekStanding({ net: 900, rep: 62, day: 3, asOf: 'last-close', nut: 400, recent: [220, -1100] });
ok(slide.sliding && slide.tone === 'warn' && !slide.insolvent && !slide.underNut, 'a mid-week slide warns without calling the tab');
ok(campaignVerdict(900, 62) === 'scarped', 'the slide does not change the verdict');
ok(slide.cashLine.includes('Solvent') && slide.slideLine.includes('−£1,100.00') && slide.slideLine.includes('crosses £0') && slide.slideLine.includes('Not there yet'), slide.slideLine);
ok(slide.lines.includes(slide.slideLine), 'the brief carries the slide');
ok(standingNudge(slide, 3)?.text === slide.slideLine, 'the mid-morning tip is the slide');
const early = weekStanding({ net: 900, rep: 62, day: 2, asOf: 'last-close', nut: 400, recent: [-1100] });
ok(!early.sliding && standingNudge(early, 2) === null, 'day 2 does not nag about a slide');
const cushion = weekStanding({ net: 3000, rep: 62, day: 4, asOf: 'close', nut: 400, recent: [-200] });
ok(!cushion.sliding && cushion.tone === 'ok', 'a loss the books can absorb is not a slide');
const streak = weekStanding({ net: 400, rep: 55, day: 4, asOf: 'close', recent: [80, -300, -500] });
ok(streak.slideLine.includes('2 closes running') && streak.slideLine.includes('today −£500.00'), streak.slideLine);
const both = weekStanding({ net: 300, rep: 40, day: 3, asOf: 'last-close', nut: 200, recent: [-400] });
ok(both.repShort && both.sliding && standingNudge(both, 3)?.text === both.slideLine, 'when cash is sliding, the toast says that before the room');
const bustSlide = weekStanding({ net: -40, rep: 55, day: 3, asOf: 'close', recent: [-400] });
ok(bustSlide.insolvent && !bustSlide.sliding && bustSlide.slideLine == null, 'below £0 keeps the hard line');
const finale = weekStanding({ net: 400, rep: 55, day: 5, asOf: 'close', days: 5, recent: [-500] });
ok(!finale.sliding && finale.slideLine == null, 'Saturday’s close does not promise another morning');
const lastMorning = weekStanding({ net: 400, rep: 55, day: 5, asOf: 'last-close', days: 5, recent: [-500] });
ok(lastMorning.sliding && lastMorning.slideLine.includes('last close'), 'the last morning can still hear the slide');

// The ledger strip is the everyday surface — one line of numbers. The rule
// sentences are taught once, then only spoken while their condition is live.
const led = weekStanding({ net: 5000, rep: 55, day: 4, asOf: 'close', nut: 2000 });
ok(led.chip.includes('week +£5,000.00') && led.chip.includes('bills £2,000.00') && led.chip.includes('regulars 55 (needs 50)'), led.chip);
ok(led.warns.length === 0 && led.teaches.length === 3, 'a quiet week teaches, it does not warn');
ok(led.teaches.some(l => l.includes('£4,500')) && led.teaches.some(l => l.includes('Below £0')), 'the teach block still names both rules');
const ledOpen = weekStanding({ net: 0, rep: 62, day: 1, asOf: 'opening' });
ok(ledOpen.chip.includes('no closes yet'), ledOpen.chip);
ok(slide.warns.includes(slide.slideLine) && !slide.warns.includes(slide.heldLine), 'a sliding week says the slide, not the syllabus');
ok(bust.warns.includes(bust.cashLine) && !bust.warns.includes(bust.heldLine), 'insolvency is a warn, not a lecture');
ok(cool.warns.includes(cool.repLine), 'a short room is a warn');
ok(safe.warns.length === 0 && safe.teaches.length === 3, 'a held week has nothing to warn');

const letter = composeLetter({
  day: 3, index: 1, indexPrev: 1, cost: 1.3, sold: 40, balked: 20, defections: 4,
  reputation: 45, debt: 0, contract: null, mode: 'planning', event: { tier: 'calm', head: 'Quiet', line: '' },
});
ok(letter.body.includes('at 45') && letter.body.includes('needs 50') && /walk-outs/i.test(letter.body), 'Idris names the held reputation bar');
const warm = composeLetter({
  day: 3, index: 1, indexPrev: 1, cost: 1.3, sold: 40, balked: 2, defections: 0,
  reputation: 70, debt: 0, contract: null, mode: 'planning', event: { tier: 'calm', head: 'Quiet', line: '' },
});
ok(warm.body.includes('The regulars are steady'), 'a steady room keeps Idris’s old line');

const html = read('web/index.html');
const main = read('web/js/main.js');
ok(!html.includes('<pre id="evening-read"'), 'evening read is still a non-wrapping pre');
ok(html.includes('id="evening-read"') && html.includes('id="brief-standing"'), 'standing and evening read are in the page');
ok(/#evening-read[\s\S]*white-space:\s*pre-wrap/.test(html), 'evening read wraps');
ok(/#evening\.modal\s*\{\s*overflow-x:\s*hidden/.test(html), 'evening overlay does not scroll sideways');
ok(/#evening \.l-actions button \{[^}]*width:\s*100%[^}]*min-width:\s*0/.test(html), 'evening actions shrink and wrap instead of overflowing');
ok(main.includes('standingNudge(standingSnapshot()') && main.includes('renderWeekStanding'), 'brief and mid-morning use the standing');
ok(main.includes('stand.chip') && main.includes('stand.warns') && main.includes('stand.teaches') && main.includes('rulesTaught'), 'the brief renders the ledger strip and one-time rules');
ok(main.includes('brief-people-more'), 'the people list caps named lines behind a drawer');
ok(html.includes('class="brief-call"'), 'the brief marks decision sections');
ok(html.includes('.bs-chip'), 'the ledger strip has its own style');
ok(main.includes('recent: recentTakeHome()'), 'closed-day take-home is what the slide reads');
ok(main.includes("the supplier calls the tab →"), 'an insolvent receipt does not offer another morning');
ok(main.includes('...stand.lines'), 'evening card carries the standing lines');

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('STANDING held gate unchanged; insolvency and reputation are said in words; evening card wraps');
