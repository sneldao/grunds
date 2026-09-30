// nextAction.js — ONE source of truth for "what should I do right now?".
// The goal strip (updateHUD) and the idle-time halo (halo.js) both read this,
// so the game's words and its visual pointer can never disagree.
// Pure: snapshot in, answer out — no DOM, no THREE, node-testable.
//
// id      — what the answer means: 'mail' | 'batch' | 'watch' | 'hold' | 'status'
// target  — where the halo points: 'mailbox' | 'chalk' | 'street' | null
// text    — the directive for the strip (HTML, as #goal renders it today)
import { ECON } from './config.js';

export function leverState(s = {}) {
  const dayMin = s.dayMin ?? 0;
  const closed = !!s.closed;
  const trading = (s.phase ?? 'trading') === 'trading';
  const repriced = !!s.repriced, prebatched = !!s.prebatched;
  const units = s.batchUnits ?? 0;
  const inWave = dayMin >= 840 && dayMin < 960;
  const topupCap = inWave ? 8 : 0;
  const changesPlan = !!(s.leversTimeLocked && dayMin >= 720 && !prebatched);

  const batch = { available: false, cost: ECON.batchCost, changesPlan: false, reason: '' };
  if (!trading) batch.reason = 'the day hasn’t opened';
  else if (closed) batch.reason = 'the day is done';
  else if (dayMin >= 960) batch.reason = 'too late to prep today';
  else if (repriced) batch.reason = 'you cut the price — prep is locked for today';
  else if (prebatched && units > topupCap) batch.reason = inWave ? `${units} cups still ready` : `${units} cups reserved for 14:00`;
  else {
    batch.available = true;
    batch.changesPlan = changesPlan;
    batch.cost = ECON.batchCost + (changesPlan ? 4.20 : 0);
  }

  const reprice = { available: false, cost: 0, changesPlan: false, reason: '' };
  const repriceChangesPlan = !!(s.leversTimeLocked && dayMin >= 720);
  if (!trading) reprice.reason = 'the day hasn’t opened';
  else if (closed) reprice.reason = 'the day is done';
  else if (dayMin >= 960) reprice.reason = 'too late today';
  else if (repriced) reprice.reason = 'the price is already cut';
  else if (prebatched || units > 0) reprice.reason = 'pre-batch locks the price for today';
  else {
    reprice.available = true;
    reprice.changesPlan = repriceChangesPlan;
    reprice.cost = repriceChangesPlan ? 4.20 : 0;
  }

  return { batch, reprice };
}

export function computeNextAction(s = {}) {
  const dayMin = s.dayMin ?? 0, queue = s.queue ?? 0;
  const closed = s.closed ?? dayMin >= 1260;
  const trading = (s.phase ?? 'trading') === 'trading';
  const inWave = dayMin >= 840 && dayMin < 960;
  const batchUnits = s.batchUnits ?? 0;
  const lv = leverState(s);

  // the evening call has been made: the rest of the day resolves itself
  if (s.eveningFast) return { id: 'status', text: 'the evening’s running — the receipt is next', target: 'street' };
  // lever is locked and the morning is skipping forward to 14:00
  if (s.rushFast) return { id: 'status', text: 'skipping to the rush', target: 'street' };
  // between days, once a letter is posted: the box is the only move that matters
  if (s.mailPending) return { id: 'mail', text: '<b>Idris replied — take it from the box</b>', target: 'mailbox' };
  if (closed) return { id: 'status', text: 'the day is done — the receipt is next', target: 'street' };
  if (!trading) return { id: 'status', text: 'the morning brief has the plan — open the day to start', target: 'street' };
  // 16:00: levers lock and the evening call takes the floor
  if (dayMin >= 960) return { id: 'status', text: 'the rush is over — one call, then the day ends', target: 'street' };

  if (s.repriced) {
    return { id: 'status', text: `the deal holds — <b>${fmtMoney(ECON.matchaDeal)}</b> buys patience, not faster service; prep locked today` + (queue > 5 ? ` · ${queue} waiting; lower walk-out risk` : ''), target: 'street' };
  }
  if (s.prebatched && !inWave && batchUnits > 0) {
    return { id: 'status', text: `${batchUnits} cups reserved for <b>14:00</b> — matcha full price, line moves made-to-order`, target: 'street' };
  }
  // 14:00–16:00: the stock is the decision. Low cups are a second press.
  if (inWave) {
    if (s.prebatched && batchUnits > 0) {
      return batchUnits <= 8
        ? { id: 'batch', target: 'chalk', text: `only ${batchUnits} cups left — press <b>1</b> to top up the batch (${fmtMoney(ECON.batchCost)})` }
        : { id: 'status', target: 'street', text: `${batchUnits} cups left — the till stays warm` };
    }
    if (lv.batch.available) return { id: 'batch', target: 'chalk', text: `the wave is on — press <b>1</b> to prep ${ECON.batchUnits} cups (${fmtMoney(lv.batch.cost)}${lv.batch.changesPlan ? ' · +£4.20 late switch, regulars lose warmth' : ''})` };
    return { id: 'status', text: 'the wave is on — hold the line, the rush passes by 16:00', target: 'street' };
  }
  if (queue > 5 && lv.reprice.available) {
    return { id: 'watch', target: 'street', text: `the line is long — <b>2</b> cuts matcha to <b>${fmtMoney(ECON.matchaDeal)}</b>: more patience, lower income${lv.reprice.changesPlan ? ' · +£4.20 late switch, regulars lose warmth' : ''} · a batch bought now only reserves for 14:00 (${fmtMoney(lv.batch.cost)}${lv.batch.changesPlan ? ' · +£4.20 late switch, regulars lose warmth' : ''})` };
  }
  // a failing line with no cups beats the calendar
  if (queue > 5) return { id: 'watch', target: 'street', text: 'the line is long — ride it out · a batch bought now only reserves for <b>14:00</b>' };
  // morning beat: the regular at 11:00
  if (!s.offerShown && dayMin < 660) {
    if (queue > 0) return { id: 'watch', target: 'street', text: 'line’s building — hold it under <b>5</b> for the <b>11:00</b> ask' };
    return { id: 'hold', target: 'street', text: 'keep the line under <b>5</b> — a regular asks at <b>11:00</b>' };
  }
  // between the ask and the wave: the read — one lever, not both
  if (queue > 0) return { id: 'watch', target: 'street', text: `line at <b>${queue}</b> — the wave lands at <b>14:00</b> · <b>1</b> reserves ${ECON.batchUnits} cups for it (${fmtMoney(lv.batch.cost)}${lv.batch.changesPlan ? ' · +£4.20 late switch, regulars lose warmth' : ''}) or <b>2</b> cuts the price` };
  return { id: 'hold', target: 'chalk', text: `students at <b>14:00</b> — <b>1</b> buys cups (${fmtMoney(lv.batch.cost)}${lv.batch.changesPlan ? ' · +£4.20 late switch, regulars lose warmth' : ''}) or <b>2</b> cuts the price` };
}
function fmtMoney(n) { return `£${n.toFixed(2)}`; }

// monotonic priority proof used by the tests: which id wins
export const NEXT_ACTION_PRIORITY = ['mail', 'status', 'batch', 'watch', 'hold'];
