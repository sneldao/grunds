// analytics.js — lightweight local analytics for Grunds playtest validation
// Offline-first: accumulates events in memory + localStorage, console.debugs,
// and exposes a summary for the HUD/boot. No network required; if Convex
// is live, the 15s stand poll can piggyback a fire-and-forget beacon.
//
// Required events (per review):
//   tutorial_step   {step, title}  — each Next
//   tutorial_skip   {fromStep}     — Skip / Esc
//   tutorial_complete {steps}      — finished 3/3
//   first_lever_at_min {lever, day, min} — first 1 or 2, wall-clock + sim-min
//   lever_batch / lever_reprice — every press with queue + till snapshot
//   day1_balk {min, queue, wave}  — every balk (day 1 filtered in summary)
//   wave_debrief_shown / forecast_shown — payoff legibility

const KEY = 'grunds.analytics.v1';
const MAX = 400;

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function save(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); } catch {}
}

export function createAnalytics() {
  const events = load();
  let firstLeverAt = null; // {lever, dayMin, wallMs}

  function track(name, props = {}) {
    const ev = { name, t: Date.now(), ...props };
    events.push(ev);
    if (events.length > MAX) events.splice(0, events.length - MAX);
    save(events);
    // debug line is the playtest script's source of truth — grep the console.
    // Balk is high-frequency (hundreds/day) — throttle its console noise so
    // the useful signals (tutorial, levers, debrief, forecast) stay visible.
    const noisy = name === 'day1_balk' || name === 'balk';
    const shouldLog = !noisy || (events.length % 25 === 0) || props.wave === 1;
    if (shouldLog) { try { console.debug('[grunds:analytics]', name, props); } catch {} }
    // lightweight global for manual QA: window.__grunds.analytics.summary()
    return ev;
  }

  function summary() {
    const steps = events.filter(e => e.name === 'tutorial_step').length;
    const skips = events.filter(e => e.name === 'tutorial_skip').length;
    const completes = events.filter(e => e.name === 'tutorial_complete').length;
    const first = events.find(e => e.name === 'first_lever_at_min') || null;
    const day1Balks = events.filter(e => e.name === 'day1_balk').length;
    const balks = events.filter(e => e.name === 'balk' || e.name === 'day1_balk').length;
    const debriefs = events.filter(e => e.name === 'wave_debrief_shown').length;
    return {
      total: events.length,
      tutorial: { steps, skips, completes, skipRate: completes + skips ? (skips / (skips + completes)) : null },
      firstLever: first,
      balks: { total: balks, day1: day1Balks },
      debriefs,
      events: events.slice(-20),
    };
  }

  // 5-question playtest script (console helper — copy/paste to QA)
  function playtestScript() {
    return [
      'GRUNDS — first-day playtest (ask after the receipt, before Day 2):',
      'Run from a fresh local session. Do not explain the controls or recommend a strategy. Record any help the player requests.',
      '1. In your own words, what are you trying to accomplish over the five days?',
      '2. Which morning approach did you choose, and what did you expect it to change?',
      '3. What happened at 14:00? What could you still do, and why do you think customers stayed or walked?',
      '4. Which person do you remember, and what happened between you?',
      '5. What would you do differently tomorrow? Would you choose to play another day? Why?',
      '— Record answers and observed actions separately. Automated checks do not establish understanding or engagement.'
    ].join('\n');
  }

  return {
    track,
    summary,
    playtestScript,
    get events() { return events.slice(); },
    get firstLeverAt() { return firstLeverAt; },
    set firstLeverAt(v) { firstLeverAt = v; },
  };
}
