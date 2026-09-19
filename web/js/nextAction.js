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
    mailPending = false,
  } = s;
  // between days, once a letter is posted: the box is the only move that matters
  if (mailPending) {
    return { id: 'mail', target: 'mailbox', text: '<b>Idris replied — take it from the box</b>' };
  }
  // once the player has acted (or the rush owns the floor): nothing left to
  // prep — run the bar. The strip shows live status around this.
  if (prebatched || repriced || dayMin >= 840) {
    const acts = [prebatched ? 'batched ' + batchUnits : 'not batched', repriced ? 'price cut' : 'full price'].join(' · ');
    return { id: 'status', target: 'street', text: acts };
  }
  // reactive directive, pre-rush
  if (queue >= 6) {
    return { id: 'batch', target: 'chalk', text: '<b>queue’s building — 1 to batch</b>' };
  }
  if (queue >= 3) {
    return { id: 'watch', target: 'street', text: 'watch the queue · <b>1</b> batches before the rush' };
  }
  return { id: 'hold', target: 'street', text: 'keep the <b>queue under 5</b>' };
}

// monotonic priority proof used by the tests: which id wins
export const NEXT_ACTION_PRIORITY = ['mail', 'status', 'batch', 'watch', 'hold'];
