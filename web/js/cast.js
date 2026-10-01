import { stageLabel, feeling, dossierLines } from './identity.js';
import { ABSENCE_WORD } from './consequences.js';

export const CAST_PROFILES = {
  Mara:   { bio: 'Catches the 8:10 into the city. Knows your name before you know hers.', wants: 'A short line in the morning. She won’t wait for anyone.' },
  Tomas:  { bio: 'Illustrator. Draws the street from the window seat.', wants: 'One pour-over and a table he can stay at.' },
  Pip:    { bio: 'Second-year student who brings the study group.', wants: 'Matcha at 14:00, at a price students can manage.' },
  Olu:    { bio: 'Retired postman. Has watched three cafés open on this corner.', wants: 'Things done properly. He notices when they aren’t.' },
  Gwen:   { bio: 'Visiting from Leeds; follows every café list going.', wants: 'Something worth writing about. Tips well when she finds it.' },
  Yuki:   { bio: 'Ceramicist from the studio upstairs.', wants: 'Single-origin coffee, made with care.' },
  Dev:    { bio: 'Works at the bank on the corner; always in a rush.', wants: 'To see the queue moving. He counts it out loud.' },
  Esther: { bio: 'Comes every morning after her walk with Olu.', wants: 'Her tea, her stamp card, and a friendly word.' },
};

const WALKIN_WANTS = {
  commuters: 'A quick cup and a short line.',
  creatives: 'A good cup and somewhere to sit.',
  students: 'Matcha and a fair price.',
  elders: 'A calm room and things done properly.',
  tourists: 'Something worth remembering.',
};

export function walkinProfile(head) {
  const label = stageLabel(head || {});
  const established = head && ['regular', 'friend', 'evangelist'].includes(head.stage);
  const bio = established ? 'One of your new regulars.'
    : label === 'visitor' || ((head?.visits || 0) <= 1) ? 'New to the street — first time through your door.'
    : 'Has been in a few times now.';
  return { bio, wants: WALKIN_WANTS[head?.cohort] || WALKIN_WANTS.commuters };
}

const drinkLc = d => (d || '').toLowerCase();
const drinkArticle = d => { const l = drinkLc(d); return `${/^[aeiou]/.test(l) ? 'an' : 'a'} ${l}`; };

export function profileView(ident, { op = null, friends = [], quirk = null, isCast = false, greetedToday = false, absence = null } = {}) {
  const cast = isCast ? CAST_PROFILES[ident.name] : null;
  const walk = cast ? null : walkinProfile(ident);
  const bio = cast ? cast.bio : walk.bio;
  const wants = cast ? cast.wants : walk.wants;
  const established = isCast || ['regular', 'friend', 'evangelist'].includes(ident.stage);
  const feel = ABSENCE_WORD[absence] || (op == null ? null
    : feeling(op) === 'warming' ? 'warming to you'
    : feeling(op) === 'unhappy' ? 'unhappy with you'
    : 'still making up their mind');
  const last = ident.events && ident.events.length ? ident.events[ident.events.length - 1] : null;
  const lastBetween = !last ? 'You haven’t met properly yet.'
    : last.outcome === 'served' ? `Last time: had ${drinkArticle(last.drink || ident.drink)}${last.stayed ? ' and stayed a while' : ''}`
    : last.outcome === 'balked' ? 'Last time: walked out of a long line'
    : last.outcome === 'defected' ? 'Last time: crossed the road to Glasshouse'
    : 'You haven’t met properly yet.';
  const counts = new Map();
  const seen = new Map();
  for (const e of ident.events || []) {
    if (e.outcome !== 'served' || !e.drink) continue;
    const d = drinkLc(e.drink);
    counts.set(d, (counts.get(d) || 0) + 1);
    seen.set(d, e.day);
  }
  let usual = drinkLc(ident.drink);
  let best = -1, bestDay = -1;
  for (const [d, n] of counts) {
    if (n > best || (n === best && seen.get(d) > bestDay)) { best = n; bestDay = seen.get(d); usual = d; }
  }
  const older = ident.events && ident.events.length > 1 ? { ...ident, events: ident.events.slice(0, -1) } : null;
  const history = older ? dossierLines(older, {}).filter(l => /^(day \d+|soft opening) — /.test(l)).slice(0, 4)
    .map(l => l.replace(/served (.+?)(, stayed a while)?$/, (m, d, s) => `served ${drinkLc(d)}${s || ''}`)) : [];
  return {
    heading: established ? 'REGULAR' : 'A NEW FACE',
    name: ident.name,
    stage: stageLabel(ident),
    bio, wants, usual, feeling: feel, lastBetween,
    friends: friends.length ? `friends here: ${friends.slice(0, 3).join(', ')}` : null,
    history,
    quirk, greetedToday, absence,
  };
}
