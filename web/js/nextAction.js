// nextAction.js — ONE source of truth for "what should I do right now?".
// The goal strip (updateHUD) and the idle-time halo (halo.js) both read this,
// so the game's words and its visual pointer can never disagree.
// Pure: snapshot in, answer out — no DOM, no THREE, node-testable.
//
// id      — what the answer means: 'mail' | 'batch' | 'watch' | 'hold' | 'status'
// target  — where the halo points: 'mailbox' | 'chalk' | 'street' | null
// text    — the directive for the strip (HTML, as #goal renders it today)

export function computeNextAction(s = {}) {
  const {
    dayMin = 0, queue = 0,
    prebatched = false, repriced = false, batchUnits = 0,
    mailPending = false, offerShown = false, eveningFast = false, rushFast = false,
  } = s;
  const price = repriced ? 'matcha £4.20' : 'matcha full price';
  // between days, once a letter is posted: the box is the only move that matters
  if (mailPending) {
    return { id: 'mail', target: 'mailbox', text: '<b>Idris replied — take it from the box</b>' };
  }
  // the evening call has been made: the rest of the day resolves itself
  if (eveningFast) {
    return { id: 'status', target: 'street', text: 'the evening’s running — the receipt is next' };
  }
  // lever is locked and the morning is skipping forward to 14:00
  if (rushFast) {
    return { id: 'status', target: 'street', text: 'skipping to the rush' };
  }
  // 14:00–16:00: the stock is the decision. Low cups are a second press.
  if (dayMin >= 840 && dayMin < 960) {
    if (batchUnits <= 8) {
      return {
        id: 'batch', target: 'chalk',
        text: batchUnits > 0
          ? `<b>${batchUnits}</b> cups left — press <b>1</b> to top up`
          : 'cups are gone — press <b>1</b> to top up, or the line walks',
      };
    }
    return { id: 'status', target: 'street', text: batchUnits + ' cups left · ' + price };
  }
  // 16:00: levers lock and the evening call takes the floor
  if (dayMin >= 960) {
    return { id: 'status', target: 'street', text: 'the rush is over — one call, then the day ends' };
  }
  // a failing line with no cups beats the calendar
  if (!prebatched && queue >= 6) {
    return { id: 'batch', target: 'chalk', text: 'line’s past <b>5</b> — press <b>1</b> to prep cups, or they walk' };
  }
  if (prebatched && batchUnits > 0) {
    return { id: 'status', target: 'street', text: batchUnits + ' cups ready · ' + price };
  }
  if (repriced && queue < 6) {
    return { id: 'status', target: 'street', text: 'no cups prepped · matcha £4.20' };
  }
  // morning beat: the regular at 11:00
  if (!offerShown && dayMin < 660) {
    if (queue >= 3) {
      return { id: 'watch', target: 'street', text: 'line’s building — hold it under <b>5</b> for the <b>11:00</b> ask' };
    }
    return { id: 'hold', target: 'street', text: 'keep the line under <b>5</b> — a regular asks at <b>11:00</b>' };
  }
  // between the ask and the wave: the read — one lever, not both
  if (queue >= 3) {
    return { id: 'watch', target: 'street', text: 'line’s building — <b>1</b> buys cups or <b>2</b> cuts the price' };
  }
  return { id: 'hold', target: 'chalk', text: 'students at <b>14:00</b> — <b>1</b> buys cups (£40) or <b>2</b> cuts the price' };
}

// monotonic priority proof used by the tests: which id wins
export const NEXT_ACTION_PRIORITY = ['mail', 'status', 'batch', 'watch', 'hold'];
