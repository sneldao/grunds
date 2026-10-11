// Opening-minute cues. New players get three short beats — what to price,
// the pastry case, the morning wire — once the floor is actually open.
// Nothing here changes a price, a bake, or a shock. Skip and veterans
// (skipTutorial, or a week that already introduced every tool) never start.
import { ECON } from './config.js';
import { DRINKS } from './menu.js';

export const CUE_MS = 16000;
export const CUE_STEP_CAP = 500;

export const FLOOR_CUES = [
  {
    id: 'price',
    kicker: 'What to price',
    look: 'board',
    lookLabel: 'show the board',
    spot: 'reprice',
    floor: 'The chalkboard is the price. Press 2 to cut matcha — people wait longer, and each cup pays less.',
  },
  {
    id: 'pastry',
    kicker: 'The pastry case',
    look: 'case',
    lookLabel: 'show the case',
    spot: 'case',
    floor: 'The glass case by the bar holds the croissants. When it’s empty, one in four leave.',
  },
  {
    id: 'wire',
    kicker: 'The morning wire',
    look: 'ticker',
    lookLabel: 'show the ticker',
    spot: 'tape',
    theta: -0.85,
    floor: 'The ticker on the street is the morning wire. A frost or a drought changes what a cup costs you.',
  },
];

export function shouldTeachOpening({ wantTutorial = false, unlockAll = false, veteran = false } = {}) {
  return !!wantTutorial && !unlockAll && !veteran;
}

export function cueIndex(elapsedMs, cueMs = CUE_MS) {
  const ms = Number(elapsedMs);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / cueMs);
}

export function cueSchedule(elapsedMs, cueMs = CUE_MS) {
  const index = cueIndex(elapsedMs, cueMs);
  if (index >= FLOOR_CUES.length) return { index, cue: null, done: true };
  return { index, cue: FLOOR_CUES[index], done: false };
}

export function advanceElapsed(elapsedMs, cueMs = CUE_MS) {
  const ms = Number(elapsedMs);
  const base = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return (Math.floor(base / cueMs) + 1) * cueMs;
}

export function priceCueBrief() {
  const d = DRINKS;
  return `Matcha £${d.matcha.base.toFixed(2)} on the board, £${ECON.matchaDeal.toFixed(2)} on the deal. Menu prices move in 20p steps — dear drinks send people to cheaper ones.`;
}

export function pastryCueBrief(onOrder) {
  const today = pastryTodayLine(onOrder);
  const plan = 'Set tomorrow: full, half, or skip. Empty case, one in four leaves.';
  return today ? `${today} ${plan}` : plan;
}

export function wireCueBrief({ beanIndex = null, eventHead = '' } = {}) {
  const head = String(eventHead || '').trim();
  const n = Number(beanIndex);
  const beans = Number.isFinite(n) ? `Beans ${n.toFixed(2)}. ` : '';
  const ev = head ? `${head}. ` : '';
  return `${ev}${beans}Frost or drought moves the cup cost. Cover after the market warns.`;
}

export function wireTapeLine({ beanIndex = null, eventHead = '' } = {}) {
  const n = Number(beanIndex);
  const beans = Number.isFinite(n) ? n.toFixed(2) : '—';
  const head = String(eventHead || '').trim();
  return `morning wire · beans ${beans}${head ? ' · ' + head : ''}`;
}

export function briefCueCopy(ctx = {}) {
  return [
    { id: 'price', kicker: 'What to price', text: priceCueBrief() },
    { id: 'pastry', kicker: 'The pastry case', text: pastryCueBrief(ctx.onOrder) },
    { id: 'wire', kicker: 'The morning wire', text: wireCueBrief(ctx) },
  ];
}

export function pastryTodayLine(onOrder) {
  const n = onOrder | 0;
  if (n <= 0) return '';
  return `Today’s case is ${n} croissants, already in the cabinet.`;
}
