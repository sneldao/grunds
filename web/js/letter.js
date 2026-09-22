// The Roaster's Letter — the inbox. Each close, the roaster writes in character
// from the day's performance and the market's mood. You reply by command:
// contract beans, ride the spot, or pay the debt. The reply mutates the exchange
// — the Gamble clock turns. No LLM; every line templated from state.
import { LETTER, CAMPAIGN } from './config.js';
import { hedgeTerms, debtInterestFor } from './economy.js';

const gbp = n => '£' + Math.max(0, n).toFixed(2);

function trendPhrase(rose) {
  if (rose > 0.18) return 'up hard';
  if (rose > 0.04) return 'up warily';
  if (rose < -0.05) return 'easing';
  return 'flat';
}
function performance(s) {
  // The Morning Brief reads yesterday's counters — on day 1 there are none.
  if (s.sold == null) return 'Opening day. The kettle’s cold and the street doesn’t know your name — a few will try you on a whim. Work the street and they find you tomorrow.';
  const ratio = s.balked / Math.max(1, s.sold);
  if (ratio < 0.05) return `You held the floor. ${s.sold} cups out the door, ${s.balked} walked. The regulars saw it.`;
  if (ratio < 0.15) return `A workable day — ${s.sold} served, ${s.balked} balked. ${s.defections} crossed to the chain.`;
  if (ratio < 0.3) return `A rough one. ${s.balked} balked, ${s.defections} crossed the road. They're talking.`;
  return `The wave broke you. ${s.balked} balked, ${s.defections} to the chain. Word travels.`;
}
function debtLine(s) {
  if (s.debt <= 0) return 'You owe me nothing. Rare sight.';
  const cap = CAMPAIGN.creditLimit;
  const rate = Math.round(CAMPAIGN.debtInterestRate * 1000) / 10;
  if (s.debt >= cap * 0.6)
    return `You're carrying ${gbp(s.debt)} of my ${gbp(cap)} tab — I'm patient, not a bank. Past the limit I stop extending, and a stand that owes more than it's worth is done.`;
  return `You're carrying ${gbp(s.debt)} of my ${gbp(cap)} tab. ${rate}% a day until you settle.`;
}
function rumourLine(s) {
  // Yesterday's rumour tilts today's deck (exchange.lastEventId → ×3 frost/
  // drought weight). Say it plainly the morning after — the signal is worth
  // acting on only if the player knows it exists.
  if ((s.mode || 'planning') !== 'planning' || s.event?.id !== 'rumour_frost') return '';
  return 'That rumour hasn’t gone away — today’s deck leans cold. A contract is cheap insurance while it’s still talk.';
}
function reputationLine(s) {
  if (s.reputation >= 80) return 'The regulars are telling their friends. Word of mouth is doing my job for me.';
  if (s.reputation >= 65) return 'The regulars are steady. Steady won’t survive a bad bean year alone.';
  if (s.reputation >= 45) return 'The regulars are cool. A cold market and a cool room is a bad combination.';
  return 'The regulars have given up on you. I’d move fast.';
}
function driftLine(s) {
  // The district is gentrifying. The board creeps regardless of today's
  // event — sign-aware, so a harvest-led dip reads "down", never "up -6%".
  if (s.day <= 1) return '';
  const pct = Math.round((s.index - 1) * 100);
  const dir = pct >= 0 ? `up ${pct}%` : `down ${-pct}%`;
  if (s.day === 2) return `The district is moving. The board is ${dir} on Monday. Hold or hedge — your call.`;
  if (pct >= 10) return `Costs are up ${pct}% on opening day. The list knows — they’re already at the door.`;
  if (pct >= 5)  return `Costs are creeping. ${pct}% up on day one. The elders are watching the chalkboard.`;
  if (pct <= -5) return `Costs eased ${-pct}% on day one. Enjoy it — the street never stays cheap.`;
  return '';
}
function neighborhoodLine(s) {
  // The Roaster's Letter: the verbal beat for the day-4 / day-5 visual
  // changes. driftLine handles the bean-index creep; neighborhoodLine
  // handles the *physical* building changes the player can see (the rent
  // sign on day 3, the two scaffolds on day 5). Inserted after
  // reputationLine so the player reads the market mood, then their own
  // performance, then the district's.
  if (s.day === 4) return `Two of the storefronts across the road have a For Lease sign up. The street's moving.`;
  if (s.day >= 5) return `Both storefronts are scaffolded now. The street is being remade — for or against you, that's the question.`;
  return '';
}
function intelLine(s) {
  // Linkup deep research — the roaster cites the wire when it answered.
  // s.intel = { sources: [{title, url}], marketShift: [...] } from the live
  // fetch; absent offline, so the line simply doesn't print.
  const src = s.intel && s.intel.sources && s.intel.sources[0];
  if (!src || !src.title) return '';
  let host = '';
  try { host = new URL(src.url).hostname.replace(/^www\./, ''); } catch { host = ''; }
  return `Off the wire — ${String(src.title).slice(0, 90)}${host ? ` (${host})` : ''}.`;
}
function tapeLine(s) {
  // The tape: yesterday's close → today's close, and what a move usually
  // means for tomorrow. This is the Drug Wars beat — information → plan.
  // Day 1 has no yesterday (tapePrev is just the 1.0 initializer), so a
  // phantom "Spot closed up N%" would read as history that never happened.
  if (s.day <= 1 || s.indexPrev == null) return '';
  const pct = Math.round((s.index - s.indexPrev) * 100);
  if (!pct) return 'Spot held flat through the day.';
  const carry = pct > 0
    ? 'Moves like that have carried before; whether this one does, the dawn card decides.'
    : 'Dips have held a day before — no promise the board agrees twice.';
  return `Spot closed ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% today. ${carry}`;
}
function greeting(e) {
  const t = e?.tier || 'calm';
  if (t === 'cata') return 'I’m writing before the market and I’m already sorry.';
  if (t === 'bad')  return 'Bad news off the belt this morning.';
  if (t === 'good') return 'Good morning. I bring you a break for once.';
  if (t === 'warn') return 'A quiet morning — too quiet. Listen to this.';
  return 'Morning. Quiet on the board.';
}

export function composeLetter(s) {
  const e = s.event || {};
  const rose = (s.index - 1);
  const contract = s.contract;
  const mode = s.mode || 'planning';
  const extraFee = s.extraFee || 0;
  const cover = id => hedgeTerms(id, extraFee);
  const sizing = `A contract locks the board price for the cups it covers — no shortage, no waste; what it doesn’t cover you buy at the spot. Light ${cover('contract_light').units} cups, standard ${cover('contract').units}, heavy ${cover('contract_heavy').units}. Fees ride on your tab until you settle.`;
  const boardLine = mode === 'planning'
    ? `Previous close: ${s.index.toFixed(2)} — ${trendPhrase(rose)} on the spot. The opening market has not been drawn; a hedge locks this quoted board before it moves.`
    : `The board's at ${s.index.toFixed(2)} — ${trendPhrase(rose)} on the spot.`;
  const coverage = contract != null && s.units != null
    ? `Your contract still covers ${s.units} cups at ${Number(contract).toFixed(2)}.`
    : '';
  const explain = id => {
    const t = cover(id);
    return `lock ${s.index.toFixed(2)} · ${t.units} cups · ${gbp(t.fee)} credit` + (extraFee > 0 ? ` (incl. ${gbp(extraFee)} COD)` : '');
  };
  // The supplier's tab has a ceiling — projecting fee + today's interest against
  // it mirrors what resolveDecision will enforce at commit.
  const overTab = id => {
    const t = cover(id);
    const interest = s.day > 1 ? debtInterestFor(s.debt || 0) : 0;
    return (s.debt || 0) + interest + t.fee > CAMPAIGN.creditLimit;
  };
  return {
    from: LETTER.from,
    sign: LETTER.sign,
    head: e.head || 'A NOTE FROM YOUR ROASTER',
    body: [
      s.player ? `Dear ${s.player},` : '',
      mode === 'review' ? `Day ${s.day} closed.` : `Day ${s.day} of ${CAMPAIGN.days}. ${greeting(e)}`,
      mode === 'planning' && e.head ? `Previous close: ${e.head}` : (e.line || ''),
      '',
      boardLine,
      tapeLine(s),
      mode === 'planning' ? sizing : '',
      coverage,
      extraFee > 0 ? `The COD invoice rides along — +${gbp(extraFee)} on the next contract fee.` : '',
      performance(s),
      debtLine(s),
      driftLine(s),
      rumourLine(s),
      intelLine(s),
      neighborhoodLine(s),
      reputationLine(s),
      '',
      mode === 'planning'
        ? (s.player ? `What do you want to do, ${s.player}?` : 'What do you want to do?')
        : 'That’s the day on paper. Tomorrow’s board lands at dawn.',
    ].join('\n'),
    actions: mode === 'planning' ? [
      { ...LETTER.actions[0], disabled: !!contract || overTab('contract_light'), explain: contract ? 'already contracted' : overTab('contract_light') ? 'tab limit — settle first' : explain('contract_light') },
      { ...LETTER.actions[1], disabled: !!contract || overTab('contract'), explain: contract ? 'already contracted' : overTab('contract') ? 'tab limit — settle first' : explain('contract') },
      { ...LETTER.actions[2], disabled: !!contract || overTab('contract_heavy'), explain: contract ? 'already contracted' : overTab('contract_heavy') ? 'tab limit — settle first' : explain('contract_heavy') },
      { ...LETTER.actions[3], disabled: false, explain: `ride ${s.index.toFixed(2)} · free · no cover` },
      { ...LETTER.actions[4], disabled: s.debt <= 0, explain: s.debt <= 0 ? 'nothing to settle' : `pay ${gbp(s.debt)}` },
    ] : [],
  };
}
