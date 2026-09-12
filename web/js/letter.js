// The Roaster's Letter — the inbox. Each close, the roaster writes in character
// from the day's performance and the market's mood. You reply by command:
// contract beans, ride the spot, or pay the debt. The reply mutates the exchange
// — the Gamble clock turns. No LLM; every line templated from state.
import { LETTER, CAMPAIGN } from './config.js';

const gbp = n => '£' + Math.max(0, n).toFixed(2);

function trendPhrase(rose) {
  if (rose > 0.18) return 'up hard';
  if (rose > 0.04) return 'up warily';
  if (rose < -0.05) return 'easing';
  return 'flat';
}
function performance(s) {
  const ratio = s.balked / Math.max(1, s.sold);
  if (ratio < 0.05) return `You held the floor. ${s.sold} cups out the door, ${s.balked} walked. The regulars saw it.`;
  if (ratio < 0.15) return `A workable day — ${s.sold} served, ${s.balked} balked. ${s.defections} crossed to the chain.`;
  if (ratio < 0.3) return `A rough one. ${s.balked} balked, ${s.defections} crossed the road. They're talking.`;
  return `The wave broke you. ${s.balked} balked, ${s.defections} to the chain. Word travels.`;
}
function debtLine(s) {
  if (s.debt <= 0) return 'You owe me nothing. Rare sight.';
  return `You're carrying ${gbp(s.debt)} in credit. It rolls on at closing unless you settle.`;
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
  return {
    from: LETTER.from,
    sign: LETTER.sign,
    head: e.head || 'A NOTE FROM YOUR ROASTER',
    body: [
      `Day ${s.day} of ${CAMPAIGN.days}. ${greeting(e)}`,
      e.line || '',
      '',
      `The board's at ${s.index.toFixed(2)} — ${trendPhrase(rose)} on the spot.`,
      `At this price you're laying down a forty-run for ${gbp(s.cost * 40)}.`,
      performance(s),
      debtLine(s),
      driftLine(s),
      neighborhoodLine(s),
      reputationLine(s),
      '',
      'What do you want to do?',
    ].join('\n'),
    actions: [
      { ...LETTER.actions[0], disabled: !!s.contract, explain: s.contract ? 'already contracted this run' : `lock ${s.index.toFixed(2)} · ${gbp(CAMPAIGN.contractFee)} credit` },
      { ...LETTER.actions[1], disabled: false, explain: `ride ${s.index.toFixed(2)}` },
      { ...LETTER.actions[2], disabled: s.debt <= 0, explain: s.debt <= 0 ? 'nothing to settle' : `pay ${gbp(s.debt)}` },
    ],
  };
}
