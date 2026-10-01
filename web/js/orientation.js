import { ECON } from './config.js';

export function firstMorningCopy() {
  return {
    heading: 'YOUR FIRST MORNING',
    kicker: 'Day 1 of 5 · before opening',
    idrisQuote: 'A good café starts with people, not a price board.',
    welcome: 'These are your first five days on the street. Keep the café in business and make it a place people want to return to.',
    ruthRole: 'Ruth brews and serves automatically. You choose how to prepare, watch the room, and step in when your plan needs attention.',
    rival: 'Across the road is Glasshouse, run by Sam. His café is your rival — but today is about learning your own.',
    aim: 'Today: handle the afternoon matcha rush and learn what your choice changes.',
    stocked: 'Your opening coffee supplies are already stocked.',
    planTitle: 'ONE PLAN FOR THE AFTERNOON',
    forecast: 'Students arrive at 14:00 for matcha. How would you like to prepare?',
    openLabel: 'OPEN THE CAFÉ →',
    choosePrompt: 'Choose your afternoon plan, then open the café.',
    lateNote:
      'You can change this plan until opening. After noon, choosing your first batch costs ' +
      `£${(ECON.batchCost + 4.20).toFixed(2)}` +
      ' (£40 stock + £4.20 change-of-plan fee); choosing a late deal costs £4.20. ' +
      'Either late change lowers regulars’ warmth. Refilling an existing batch costs £40 without that penalty.',
    diff:
      'A batch is made ahead, so the rush moves faster — leftovers spoil. ' +
      'A deal doesn’t speed Ruth up, but people wait longer before leaving. ' +
      'Waiting keeps your options open; after noon, a first change of plan costs a little extra.',
    choices: [
      {
        key: 'batch',
        id: 'brief-prep-batch',
        label: 'Starter batch',
        tag: 'Recommended for your first day',
        line: `£${ECON.batchCost.toFixed(2)} now · 40 cups ready at 14:00, served faster`,
      },
      {
        key: 'reprice',
        id: 'brief-prep-reprice',
        label: 'Matcha deal',
        tag: '',
        line: `£${ECON.matchaDeal.toFixed(2)} a cup · they’ll wait longer`,
      },
      {
        key: 'hold',
        id: 'brief-prep-hold',
        label: 'Wait and see',
        tag: '',
        line: 'Every cup made to order — decide later',
      },
    ],
  };
}

export function economicsLesson(s = {}) {
  const houseStock = s.houseStock ?? 1;
  const lastPour = s.lastPour ?? 0;
  const house = s.houseName || 'your house coffee';
  if (houseStock <= 0 || houseStock < lastPour) {
    const left = houseStock <= 0 ? 'is empty' : `has ${houseStock} cups left`;
    return {
      urgent: true, tool: 'coffee',
      text: `Your house coffee needs attention — ${house} ${left}${lastPour > 0 ? ` and yesterday poured ${lastPour}` : ''}. ` +
        'Choose the coffee you want to serve, then restock it. Supplies use Idris’s tab; a completely dry cellar costs extra.',
    };
  }
  if ((s.debt || 0) > 0) {
    return {
      urgent: true, tool: 'tab',
      text: `Your supplier tab is £${(s.debt).toFixed(2)}. Settling it frees credit for your next delivery; insurance locks a price, not stock.`,
    };
  }
  if (s.staffCanChoose) {
      return { urgent: false, tool: 'staff', text: 'Ruth is tiring. Today’s staffing choice changes how much the bar can handle.' };
  }
  if (s.prevTier === 'warn' || s.prevTier === 'bad' || s.prevTier === 'cata') {
      return { urgent: false, tool: 'market', text: 'Yesterday’s market left a warning. Read Idris’s note before deciding whether to cover the price.' };
  }
  return {
    urgent: false, tool: null,
    text: 'You’ve seen one day on the floor. Keep the coffee fresh and the room welcoming; the tools below are yours whenever you want more control.',
  };
}
