// Grunds — The District. Main loop: the three nested clocks meet the floor.
//   THE GAMBLE (days)    — the Exchange: a pity-timer event deck + the bean market
//   THE READ (hours)    — the wave schedule + the Roaster's Notebook
//   THE SCRAMBLE (sec)  — the queue: pre-batch, reprice, or lose them to GLASSHOUSE
import * as THREE from '../vendor/three.module.js';
import { ECON, CHAPTERS, COPY, LAYOUT, CAMPAIGN, VERDICTS, REGULAR_ROSTER, EVENTS } from './config.js';
import { buildWorld } from './world.js';
import { buildSky } from './sky.js';
import { buildPostFX } from './postfx.js';
import { PatronSystem } from './patrons.js';
import { FX } from './fx.js';
import { CameraRig } from './camera.js';
import { AudioEngine } from './audio.js';
import { Exchange } from './exchange.js';
import { Regulars } from './regulars.js';
import { composeLetter } from './letter.js';
import { applyExpectation, priceForDay } from './gentrification.js';
import { initSync } from './convexSync.js';
import { calculateCampaignBadge, openShareToX } from './share.js';
import { createAnalytics } from './analytics.js';
import { billing } from './billing.js';
import { initDesk, wireHint } from './desk.js';

const urlParams = new URLSearchParams(location.search);
const _liteFlag = urlParams.has('lite');
const headless = typeof window !== 'undefined' && !!window.__headless;
const urlSpeed = +urlParams.get('speed');
// auto-lite: low cores or low memory → skip postFX/shadows without asking
const _autoLite = !_liteFlag && !headless && typeof navigator !== 'undefined'
  && ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
const lite = _liteFlag || _autoLite;
const $ = id => document.getElementById(id);

// ---- three.js core -----------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const world = buildWorld(scene, renderer, lite);
const sky = buildSky(scene);                          // shader sky dome owns the backdrop
world.useSky = true; scene.background = null;
const postfx = buildPostFX(renderer, scene, camera, { lite: lite || headless });
const rig = new CameraRig(camera, renderer.domElement);
const audio = new AudioEngine();

// ---- the connected campaign: the Gamble + the Regulars -----------------------
const exchange = new Exchange(urlParams.get('seed') ? +urlParams.get('seed') : 7);
const regulars = new Regulars();
// Optional Convex mirror: offline-first, fire-and-forget. Configure with
// ?convex=https://<deploy>.convex.site — the floor never blocks on it.
const sync = initSync();
const SEED = urlParams.get('seed') ? +urlParams.get('seed') : 7;
// Linkup market intel: fetched once per session (server-cached 6h). Tilts the
// dawn deck via exchange.openDay(bias) and is cited in the roaster's letter.
let marketIntel = null;
if (sync.live && sync.intel) sync.intel().then(r => {
  marketIntel = r;
  if (r && $('wirebtn')) $('wirebtn').style.display = '';
});

const fx = new FX(scene, null, lite);   // patrons wired in just below
const patrons = new PatronSystem(scene, world, regulars, exchange, fx);
fx.patrons = patrons;
const analytics = createAnalytics();
// expose playtest script on boot — QA can copy/paste from console
try { console.log(analytics.playtestScript()); } catch {}
// District Insider Pass: the research desk gates on the entitlement; the
// stand owner doubles as the RevenueCat appUserId so a pass travels with it.
const desk = initDesk({ billing, analytics });
billing.configure(sync.owner);

// ---- game state ---------------------------------------------------------------
const DAY_START = 360, DAY_END = 1260;
let schedule = null, waveIdx = 0, chapterIdx = 0;
let day = 0, dayMin = DAY_START, speed = [60, 300, 1200].includes(urlSpeed) ? urlSpeed : 60, started = false, closed = false, paused = false;
// calm-open state: first 12 sim-min are thinned + tutorial gates the clock
let tutorialActive = false, tutStep = 0;
let batchPulseUntil = 0;
const wantTutorial = !headless && !urlParams.has('skipTutorial') && !urlParams.has('notutorial');
// the pitch licence precedes the tutorial — ?skipTutorial/?notutorial/?skipLicence
// or headless all bypass it (the district assigns defaults: Sam, THE CORNER CUP)
const skipLicence = headless || urlParams.has('skipLicence') || !wantTutorial;
let till = 0, cogs = 0, balked = 0, served = 0, servedRetail = 0, defections = 0, rivalServed = 0;
let prebatched = false, repriced = false, batchUnits = 0;
let peakQueue = 0, waveBalked = 0, waveServed = 0, prebatchHelped = false;
let coached = false;   // day-1 lever hint, once per campaign
// just-in-time nudges: each fires once per campaign, only when its
// condition is on screen — teach at the moment of need, not at boot
let nudgedQueue = false, nudgedBalk = false, nudgedPrice = false;
let waveDebriefShown = false;  // 14:00 wave payoff card, once per day
let forecastShown = false;     // day-2 forecast tease, once per campaign (day 1 evening)
let pendingGossip = null;      // a named regular's Nebius take on the market, one per day
let tapePrev = 1.0;            // yesterday's bean-index close — the tape's delta
// a regular's ask: one mid-day offer per day, yes/no with a real cost
let offerShown = false, offerWaveMul = 1, officeRunAt = 0, oluPayoutAt = 0, estherCard = false, offerWasPaused = false;
let incidentShown = false, activeBeat = null, cashOnly = 0, cashOnlyToast = false, contractFeeExtra = 0, solicitorAt = 0;
// Morning Brief — the Drug Wars turn: paused at 06:00, read then commit
let briefChoice = null;
let lastDayStats = null;   // yesterday's counters — the Brief's letter reads them at dawn
// Ruth — your barista. One hidden condition stat; the fiction carries it.
// Worked days drain (harder on brutal floors), sent-home days recover.
let baristaCondition = 1.0, baristaHomeToday = false, baristaRested = false, baristaStaged = false, baristaCrisis = false;
// the pitch licence — who you are, signed before the first dawn. Identity
// threads the letter, the receipt, the district board; the background pick
// carries one small mechanical perk (not a class — the arc is one role).
let playerName = 'Sam', standName = 'THE CORNER CUP', playerRole = 'the new owner', perkBg = null;
let perkStaffMul = 1, perkCostMul = 1;   // ex-barista pace / ex-accountant trim
// campaign accumulators (persist across the 5 days)
let cRev = 0, cCost = 0, cBalked = 0, cServed = 0, cDef = 0, settledPaid = 0, campaignDone = false;
let cOps = 0;   // the cost sheet — staff, supplies, pitch, fees across the campaign
const ctx = { prebatched: false, repriced: false, batchUnits: 0 };
const WALK_MUL = { 60: 1, 300: 3, 1200: 6 };
// settle window: day 1, first 12 sim-min feel uncrowded even after the sim starts
const CALM_UNTIL_MIN = DAY_START + 12;

// ---- the day ------------------------------------------------------------------
function tick() {
  if (dayMin >= DAY_END) { closeDay(); return; }
  dayMin++;
  // spawn the wave — day-1 mornings are half-demand so newcomers can read the floor
  while (waveIdx < schedule.waves.length && schedule.waves[waveIdx].t < dayMin) {
    const w = schedule.waves[waveIdx++];
    const morningCalm = (day === 1 && w.t < 600) ? 0.52 : 1;
    const settleThin = (day === 1 && dayMin < CALM_UNTIL_MIN) ? 0.5 : 1;
    const mul = (exchange.event?.demand || 1) * regulars.footfallMul * morningCalm * settleThin * (w.t >= 840 ? offerWaveMul : 1);
    for (const s of w.spawns) {
      const n = Math.max(1, Math.round(s.q * ECON.spawnScale * mul));
      for (let i = 0; i < n; i++) patrons.spawn(s.c, s.z, speed > 60);
    }
  }
  // run the floor
  const events = patrons.tick(dayMin, ctx);
  // deliver the wire's gossip once the named regular is actually on the
  // floor — routed through the friend graph so it lands as word-of-mouth
  if (pendingGossip?.text) {
    const src = patrons.patrons.find(p =>
      p.regularName === pendingGossip.name && (p.state === 'sit' || p.state === 'inQueue'));
    if (src) { fx.gossipBubbles(src, pendingGossip.text, 'good'); pendingGossip = null; }
  }
  let sales = 0, balks = 0;
  for (const e of events) {
    if (e.type === 'served') {
      // cash-only day: a share of sales die at the till — no card, no sale
      if (cashOnly && Math.random() < cashOnly) {
        balked++; balks++;
        if (dayMin >= 840 && dayMin <= 1020) waveBalked++;
        if (!cashOnlyToast) { cashOnlyToast = true; fx.toast('no card, no sale — they leave the cup on the counter', 'warn'); }
        continue;
      }
      till += e.price; cogs += exchange.costPerCup; sales++;
      if (e.viaRegister) servedRetail++; else served++;
      if (dayMin >= 840 && dayMin <= 1020) waveServed++;
      audio.clink();
    } else if (e.type === 'balked') {
      balked++; balks++;
      if (dayMin >= 840 && dayMin <= 1020) { waveBalked++; if (prebatched) prebatchHelped = false; }
      audio.balk();
      fx.huff(e.p.pos.x, 1.5, e.p.pos.z);
      try { if (navigator.vibrate) navigator.vibrate(35); } catch {}
      // analytics: every balk is a teaching moment — day-1 balks are the signal
      try {
        const payload = { day, dayMin, queue: patrons.queueLength, wave: dayMin >= 840 && dayMin <= 1020 ? 1 : 0 };
        analytics.track(day === 1 ? 'day1_balk' : 'balk', payload);
      } catch {}

      // gossip is throttled early: settled openings are unreadable when everyone talks
      const calmWindow = day === 1 && dayMin < CALM_UNTIL_MIN;
      const gossipChance = calmWindow ? 0.10 : (speed >= 1200 ? 0.14 : 0.35);
      if (Math.random() < gossipChance) fx.bubble(e.p, COPY.gossipBad[(Math.random() * COPY.gossipBad.length) | 0], 'bad');
      // first walk-out names the remedy, not just the failure
      if (!nudgedBalk) {
        nudgedBalk = true;
        fx.toast('they walked — the queue’s the enemy · 1 batches, 2 cuts the price', 'warn');
      }
    } else if (e.type === 'defect') {
      defections++;
      if (defections === 1) fx.toast('they’re crossing the road to ' + COPY.rivalName + '…', 'bad');
      if (defections === 1 && speed <= 300) rig.queueFocus(world.focus.rival, 13, 4, 12, Math.PI);
      if (defections === 5) {
        const taunt = COPY.rivalTaunts ? COPY.rivalTaunts[(Math.random() * COPY.rivalTaunts.length) | 0] : null;
        if (taunt) fx.toast(taunt, 'bad');
        try { world.jeerRival(); } catch {}
      }
      if (defections === 12) fx.toast(COPY.rivalName + '’s line is out the door.', 'bad');
    } else if (e.type === 'rivalServed') { rivalServed++; fx.coinBurst(LAYOUT.rival.x, 1.7, 15.2, 3); }
  }
  if (sales) {
    audio.sale(sales);
    fx.coinBurst(LAYOUT.register.x, 1.5, -5.2, Math.min(10, 3 + sales));
    $('till').classList.add('pulse'); setTimeout(() => $('till').classList.remove('pulse'), 300);
    try { world.popTillDrawer(); } catch {}
    // at 1× the clock is felt — one soft tick per served minute, throttled inside audio
    try { if (speed === 60) audio.tick(true); } catch {}
  }
  if (prebatched && ctx.batchUnits <= 0) {
    prebatched = false; ctx.prebatched = false;
    fx.toast('batch exhausted — made-to-order until you top up (1)', 'warn');
  }
  peakQueue = Math.max(peakQueue, patrons.queueLength);
  beats();
  updateHUD();
}

// ---- story beats ----------------------------------------------------------------
function beats() {
  while (chapterIdx < CHAPTERS.length && dayMin >= CHAPTERS[chapterIdx].t) {
    const ch = CHAPTERS[chapterIdx++];
    fx.card(ch.k, ch.sub); audio.card();
    // Beat push-ins only at readable speeds — at 20× the chapters fly by and
    // the camera would whip around every few seconds. Cards still show.
    if (ch.beat && speed <= 300) rig.focus(world.focus[ch.beat] || world.focus.wide, ch.beat === 'wide' ? 26 : 13, 5);
    if (ch.notebook) fx.notebook(true);
    if (ch.wave) {
      rig.shake(0.3);
      if (prebatched) { fx.toast('the wave hits a warm till — 40 units ready', 'good'); prebatchHelped = true; }
      else fx.toast('the wave hits a cold bar — 4 minutes a cup', 'bad');
    }
  }
  if (dayMin >= 840) fx.notebook(prebatched ? false : dayMin < 900);
  // notebook: pinned open from the first minute of day 1, so newcomers
  // meet the read before the rush. Beats still re-open it at noon.
  if (day === 1 && dayMin === DAY_START + 1) fx.notebook(true);
  // Day-2 forecast tease: ~17:30 day 1, once per campaign. Gives a reason to replay.
  if (day === 1 && !forecastShown && dayMin >= 1050 && !closed) {
    forecastShown = true;
    const nextPrice = (priceForDay(2) ?? 0).toFixed(2);
    const nextIdx = (1 + CAMPAIGN.drift.perDay * 2).toFixed(2);
    const fore = exchange.event?.id === 'rumour_frost' || exchange.event?.id === 'frost_minas'
      ? 'Forecast Day 2: cold front building — bean ' + nextIdx + ' · matcha £' + nextPrice + '. Contract now? (you\'ll choose at closing)'
      : 'Forecast Day 2: costs up to ' + nextIdx + ' · matcha £' + nextPrice + '. Lock the price before closing?';
    fx.toast(fore, 'warn');
    try { analytics.track('forecast_shown', { day, dayMin, event: exchange.event?.id || null, nextPrice, nextIdx }); } catch {}
  }
  // Idris mid-day quips at 60/80 rep checkpoints (once/day)
  if (dayMin === 600 && regulars.reputation >= 80) {
    const line = COPY.idrisQuips?.praise ? COPY.idrisQuips.praise[(Math.random() * COPY.idrisQuips.praise.length) | 0] : null;
    if (line) fx.toast(line, 'good');
  } else if (dayMin === 720 && regulars.reputation < 62) {
    const line = COPY.idrisQuips?.warn ? COPY.idrisQuips.warn[(Math.random() * COPY.idrisQuips.warn.length) | 0] : null;
    if (line) fx.toast(line, 'warn');
  }
  // cat once/day around 09:30
  if (dayMin === 570) { try { world.spawnCat(); } catch {} }
  // 14:00 wave debrief: 5s card at 17:00 — teaches causality for Day 2
  if (!waveDebriefShown && dayMin >= 1020 && !closed) {
    waveDebriefShown = true;
    const estBalkNoBatchWave = Math.max(0, Math.round(waveBalked + (prebatched || repriced ? 12 : 0)));
    const saved = Math.max(0, estBalkNoBatchWave - waveBalked);
    const savedTill = saved * (repriced ? ECON.matchaDeal : ECON.matchaFull);
    const verdict = prebatched || repriced
      ? (waveBalked <= 6 ? 'You held the line.' : waveBalked <= 14 ? 'The notebook paid off.' : 'Tough wave — batch earlier tomorrow.')
      : 'No batch, no deal — the wave ate you. Try 1 before noon tomorrow.';
    const estLine = prebatched || repriced
      ? `With your prep: balk ${waveBalked} · served ${waveServed}`
      : `No prep: balk ${waveBalked} · served ${waveServed}`;
    const counterfactual = prebatched || repriced
      ? `Without it: ~${estBalkNoBatchWave} would have walked · saved ~${fmt(savedTill)}`
      : `With a 40-unit batch: ~${Math.max(1, Math.round(waveServed * 0.7))} more served`;
    fx.debriefCard({
      k: '14:00 — THE WAVE',
      sub: verdict,
      lines: [estLine, counterfactual],
    });
    if (saved > 0) fx.toast(`Wave debrief: saved ${saved} cups · ~${fmt(savedTill)} not lost to GLASSHOUSE`, saved >= 6 ? 'good' : 'warn');
    // delight: fanfare + coin rain + crane on a real save; rain on a flop
    if (saved >= 1) {
      const win = saved >= 6;
      try {
        if (win) audio.waveFanfare(saved); else audio.waveRain(saved);
        if (win && !headless && speed <= 300) rig.focus(world.focus.counter, 11, 3.5);
        if (win) { fx.coinRain(LAYOUT.register.x, 1.5, -5.2, Math.min(22, 10 + saved * 2)); }
        if (win) fx.victoryBurst(saved);
        if (navigator.vibrate) navigator.vibrate(win ? [20, 30, 50] : 35);
        if (win) world.setPlantHealth(Math.max(0, patrons.queueLength - 2));
      } catch {}
    }
    try { analytics.track('wave_debrief_shown', { day, dayMin, waveBalked, waveServed, saved, savedTill, prebatched, repriced, verdict }); } catch {}
  }
  // Day-1 coach: moves earlier (12:00) — halfway between noon reading
  // and 14:00 action. Only if the player hasn't acted yet, once per campaign.
  if (day === 1 && !coached && dayMin >= 720 && !prebatched && !repriced) {
    coached = true;
    fx.toast('students land at 14:00 — batch matcha (1) or cut the price (2)', 'warn');
    audio.card();
    $('prebatch').classList.add('attention');
    $('reprice').classList.add('attention');
  }
  // contextual nudges — bound to the state on screen, any day, once each
  if (!nudgedQueue && patrons.queueLength >= 4 && !prebatched && dayMin < 840) {
    nudgedQueue = true;
    fx.toast('the queue’s building — 1 to batch before they walk', 'warn');
    $('prebatch').classList.add('attention');
  }
  if (!nudgedPrice && dayMin >= 800 && dayMin < 840 && !repriced) {
    nudgedPrice = true;
    fx.toast('the wave lands at 14:00 — 2 drops matcha to £4.20', 'warn');
    $('reprice').classList.add('attention');
  }
  // a regular's ask — once per day at 11:00, pauses the floor for a yes/no
  if (!headless && !offerShown && dayMin >= 660 && dayMin < 840) { offerShown = true; showOffer(); }
  // the floor bites back — one incident per day from day 2, post-wave
  // (14:55+), when the rush is done and the mess lands. Same pause/yes-no.
  if (!headless && day >= 2 && !incidentShown && dayMin >= 895 && dayMin < 1015 &&
      !$('offer').classList.contains('show')) { incidentShown = true; showIncident(); }
  // deferred offer consequences
  if (oluPayoutAt && dayMin >= oluPayoutAt) {
    oluPayoutAt = 0; till += 9;
    for (let i = 0; i < 4; i++) patrons.spawn('elders', 'counter');
    fx.toast('Olu’s bridge club lands — +£9, four more in your line', 'good');
  }
  if (officeRunAt && dayMin >= officeRunAt) {
    officeRunAt = 0;
    if (patrons.queueLength <= 6) { till += 28; fx.toast('the office run lands clean — +£28', 'good'); }
    else fx.toast('the office saw your line — they went to ' + COPY.rivalName, 'bad');
  }
  // the scald claim resolves at 16:30 — contesting was a coin toss
  if (solicitorAt && dayMin >= solicitorAt) {
    solicitorAt = 0;
    if (Math.random() < 0.5) {
      till -= 140 * perkCostMul; regulars.adjustOpinions(-0.1);
      fx.toast('the scald claim stuck — −£140 and the story did the rounds', 'bad');
    } else fx.toast('the scald claim went away — their solicitor stopped calling', 'good');
  }
  // Ruth breaks — pushed under a fifth of her condition and worked anyway,
  // she fails on the floor: asleep at the counter or sharp with a regular.
  if (!headless && day >= 2 && !baristaCrisis && !baristaHomeToday && baristaCondition < 0.2 && dayMin >= 900 && dayMin < 1030) {
    baristaCrisis = true;
    if (Math.random() < 0.5) { patrons.staffMul = 0.5; fx.toast('Ruth’s gone quiet — she’s asleep on the back counter. The bar crawls.', 'bad'); }
    else { regulars.adjustOpinions(-0.2); fx.toast('Ruth snapped at a regular — the room went cold.', 'bad'); }
    try { analytics.track('staff_crisis', { day, condition: Math.round(baristaCondition * 100) / 100 }); } catch {}
  }
}

function closeDay() {
  if (closed) return;
  closed = true;
  audio.closing();
  if ($('again')) $('again').style.display = 'none';   // mid-campaign: the letter drives the next day, not this button
  if ($('shareWeek')) $('shareWeek').style.display = 'none';
  cRev += till; cCost += cogs; cBalked += balked; cServed += served + servedRetail; cDef += defections;
  lastDayStats = { sold: served + servedRetail, balked, defections };   // the Brief reads these at dawn
  // Ruth's ledger — a worked day drains (harder on a brutal floor), a
  // sent-home day recovers. The cost is real: her wage is saved but the
  // bar runs a third slower while she's off.
  const ruthWasHome = baristaHomeToday;
  if (ruthWasHome) { baristaCondition = Math.min(1, baristaCondition + 0.45); baristaRested = true; }
  else baristaCondition = Math.max(0, baristaCondition - 0.14 - (peakQueue > 50 ? 0.08 : 0) - (balked > 60 ? 0.06 : 0));
  baristaHomeToday = false;
  // the cost sheet — a real stand pays more than beans. Labour, milk+cups,
  // turnover-linked pitch rent, card fees, sundries: the day's true P&L.
  const servedN = served + servedRetail;
  const ops = {
    staff: (ruthWasHome ? 0 : CAMPAIGN.staffDayRate) + servedN * CAMPAIGN.staffPerCup,
    supplies: servedN * CAMPAIGN.suppliesPerCup,
    pitch: Math.max(CAMPAIGN.pitchMin, till * CAMPAIGN.pitchPct),
    fees: till * CAMPAIGN.cardFeePct * perkCostMul,
    sundries: CAMPAIGN.sundries,
  };
  ops.total = ops.staff + ops.supplies + ops.pitch + ops.fees + ops.sundries;
  cOps += ops.total;
  const net = till - cogs - ops.total;        // today's take-home — debt is a *campaign* figure below
  rig.focus(world.focus.wide, 27, 6);
  const total = served + servedRetail + balked;
  const ratio = total ? balked / total : 0;
  let verdict;
  if (balked <= 2 && served > 0) verdict = 'Not one cup lost. The street is yours.';
  else if (ratio < 0.05) verdict = 'A good day on the floor.';
  else if (ratio < 0.12) verdict = 'Held the line when it mattered.';
  else if (ratio < 0.2) verdict = 'You fed the chain across the road.';
  else verdict = 'The wave ate you alive.';
  if (prebatchHelped && waveBalked < 80) verdict += ' The notebook paid off.';
  // Day-1 receipt gets the Day-2 forecast stripe — the preview that makes you replay.
  let forecast = null;
  if (day === 1 && day < CAMPAIGN.days) {
    const np = priceForDay(2).toFixed(2);
    const ni = (1 + CAMPAIGN.drift.perDay * 2).toFixed(2);
    forecast = `Day 2 forecast: rumour of frost · board ${ni} · matcha £${np} — you'll choose contract at closing`;
  }
  // causal trace — name the contract payoff on the receipt's forecast line
  if (exchange.contract) {
    const savedPerCup = (exchange.beanIndex - exchange.contract.price) * CAMPAIGN.beanBaseCost;
    const estServed = served + servedRetail;
    const savedEst = Math.round(Math.min(exchange.contract.units + estServed, estServed * 1.1) * Math.abs(savedPerCup) * 10) / 10;
    if (savedPerCup > 0.02) forecast = `Contract at ${exchange.contract.price.toFixed(2)} saved ~£${savedEst.toFixed(2)} today vs riding the spot (${exchange.beanIndex.toFixed(2)}).`;
    else if (savedPerCup < -0.02) forecast = `Spot (${exchange.beanIndex.toFixed(2)}) undercut your contract (${exchange.contract.price.toFixed(2)}) today — the spot ride paid off.`;
    else forecast = forecast || `Contract at ${exchange.contract.price.toFixed(2)} — the board held near your lock (${exchange.beanIndex.toFixed(2)}).`;
  }
  // when market intel tilted the deck, cite the link in the debrief for click-through
  if (marketIntel?.sources?.[0] && marketIntel?.marketShift?.[0]) {
    const s = marketIntel.sources[0];
    let host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
    const cite = host ? `${s.title ? s.title.slice(0, 44) : 'on the wire'} (${host})` : (s.title ? s.title.slice(0, 52) : 'on the wire');
    const line = `Wire: ${cite}`;
    forecast = forecast ? forecast + ' \n' + line : line;
  }
  fx.receipt({
    lines: [
      [standName, playerName],
      ['revenue', fmt(till)], ['bean cost', fmt(cogs)],
      ['staff', fmt(ops.staff)], ['milk + cups', fmt(ops.supplies)],
      ['pitch rent', fmt(ops.pitch)], ['card fees', fmt(ops.fees)], ['sundries', fmt(ops.sundries)],
      ['debt', fmt(exchange.debt)],
      ['peak queue', peakQueue + ' deep'], ['walked to ' + COPY.rivalName, defections], ['—', '—'],
      ['NET TODAY', fmt(net)],
    ],
    verdict,
    forecast,
  });
  refreshStands();
  // the between-days phase: the roaster writes. The mailbox flag goes up.
  setTimeout(showLetter, 4200);
}

// ---- the Roaster's Letter (reply-to-command) ---------------------------------
function showLetter() {
  if (day >= CAMPAIGN.days) { campaignClose(); return; }
  world.setMail(true);
  const snap = {
    day: day + 1,                            // the letter speaks to the day ahead
    event: exchange.event,
    index: exchange.beanIndex,
    cost: exchange.costPerCup,
    sold: served + servedRetail, balked, defections,
    reputation: regulars.reputation,
    debt: exchange.debt,
    contract: exchange.contract ? exchange.contract.price : null,
    indexPrev: tapePrev, player: playerName,
    intel: marketIntel,
  };
  const L = composeLetter(snap);
  $('letter-head').textContent = L.head;
  $('letter-body').textContent = L.body;
  $('letter-sign').textContent = L.sign;
  const btns = $('letter-actions'); btns.innerHTML = '';
  L.actions.forEach(act => {
    const b = document.createElement('button');
    b.textContent = act.label + (act.explain ? '  ·  ' + act.explain : '');
    b.disabled = !!act.disabled;
    b.onclick = () => applyReply(act.id);
    btns.appendChild(b);
  });
  $('receipt').classList.remove('show');
  $('letter').classList.add('show');
  // Nebius polish: the templated letter is the source of truth; if the live
  // backend answers, Idris's rewrite lands over it. Fire-and-forget.
  if (sync.live) {
    const head = L.head;
    fetch(sync.url + '/ai/letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: L.body }),
    }).then(r => (r.ok ? r.json() : null)).then(data => {
      if (!data || data.fallback || !data.text) return;
      if (!$('letter').classList.contains('show')) return;
      if ($('letter-head').textContent !== head) return;   // a newer letter opened
      $('letter-body').textContent = data.text;
      $('letter-sign').textContent =
        '— Idris · ' + String(data.model).split('/').pop() +
        (data.latencyMs ? ' · ' + data.latencyMs + 'ms' : ' · cached');
    }).catch(() => {});
  }
  // the wire: free education (headlines) always; tilt is the edge (insider)
  const dl = $('desklink');
  if (dl) {
    if (marketIntel) {
      dl.style.display = '';
      const hint = wireHint(marketIntel);
      const base = hint ? `the wire ${hint}` : 'the wire stirs';
      dl.textContent = billing.isSubscribed()
        ? `⚡ ${base} — open the desk`
        : `⚡ ${base} — headlines free; the tilt is insider`;
      dl.onclick = () => desk.open(marketIntel);
    } else {
      dl.style.display = 'none';
    }
  }
  // the letter by post — AgentMail carries the same body to a real inbox;
  // a reply of contract/hold/settle plays the same move through the webhook.
  const lm = $('letter-mail');
  if (lm) {
    lm.style.display = sync.live ? '' : 'none';
    const addr = $('letter-mail-addr'), mb = $('letter-mail-btn');
    if (addr && !addr.value) { try { addr.value = localStorage.getItem('grunds.mail') || ''; } catch {} }
    if (mb) mb.onclick = () => {
      const to = (addr?.value || '').trim();
      if (!to || !to.includes('@')) { fx.toast('an address first — where does the post go?', 'warn'); return; }
      mb.disabled = true; mb.textContent = 'posting…';
      fetch(sync.url + '/agentmail/letter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, subject: $('letter-head').textContent || 'A note from your roaster',
          body: $('letter-body').textContent + '\n\n— Idris\n(reply: contract · hold · settle)',
          campaignId: sync.campaignId,
        }),
      }).then(r => (r.ok ? r.json() : null)).then(d => {
        if (d && d.ok) {
          try { localStorage.setItem('grunds.mail', to); } catch {}
          mb.textContent = 'posted ✓';
          fx.toast(`the letter is in the post — reply to play from your inbox`, 'good');
          try { analytics.track('letter_mailed', { day }); } catch {}
        } else { mb.disabled = false; mb.textContent = 'post it'; }
      }).catch(() => { mb.disabled = false; mb.textContent = 'post it'; });
    };
  }
}

function applyReply(id) {
  if (day >= CAMPAIGN.days) { campaignClose(); return; }   // the roaster's last letter is the verdict
  if ($('brief') && $('brief').classList.contains('show')) {
    briefChoice = id;
    // rebuild brief choice row highlight
    try {
      for (const b of [...document.querySelectorAll('#brief-actions button')]) {
        const on = b.dataset.id === id;
        b.style.borderColor = on ? 'var(--brass)' : '';
        b.style.background = on ? 'rgba(201,162,39,.16)' : '';
      }
      const open = $('brief-open');
      if (open) {
        const label = id === 'hold' ? 'OPEN — ride the spot →' : id === 'settle' ? 'OPEN — settle + ride the spot →' : `OPEN — ${String(id).toUpperCase()} at ${exchange.beanIndex.toFixed(2)} →`;
        open.textContent = label;
      }
    } catch {}
    return;
  }
  let msg = '';
  if (id === 'contract_light' || id === 'contract' || id === 'contract_heavy') {
    const heavy = id === 'contract_heavy', light = id === 'contract_light';
    const units = heavy ? CAMPAIGN.contractUnits * 2 : light ? CAMPAIGN.contractUnits / 2 : CAMPAIGN.contractUnits;
    const baseFee = heavy ? CAMPAIGN.contractFee * 2 : light ? CAMPAIGN.contractFee / 2 : CAMPAIGN.contractFee;
    const fee = baseFee + contractFeeExtra;      // a COD incident rides on the next contract
    const r = exchange.contractBeans(units, fee);
    if (r.ok) contractFeeExtra = 0;
    const tag = heavy ? 'heavy' : light ? 'light' : 'standard';
    msg = r.ok ? `CONTRACTED ${tag} at ${exchange.beanIndex.toFixed(2)} — ~${units} cups · ${fmt(fee)}` : r.why;
  }
  else if (id === 'hold') msg = 'HOLDING — you ride the spot price';
  else if (id === 'settle') { const r = exchange.settle(exchange.debt); settledPaid += r.paid; msg = 'DEBT cleared' + (r.paid ? ' (' + fmt(r.paid) + ')' : ''); }
  fx.toast(msg, id.startsWith('contract') ? 'good' : '');
  $('letter').classList.remove('show');
  // gentrification pressure first: cohort expectations drift by `day * delta`.
  // Then resolveDay folds in the day's outcome and runs the friendship
  // contagion, so the network sees the drift through the social layer.
  applyExpectation(regulars, day);
  regulars.resolveDay({ served: served + servedRetail, balked, defections, priced: repriced });
  openDay(day + 1);
}

// ---- Morning Brief: the Drug Wars turn — paused at 06:00 -----------------------
// Build a tiny 5-day bean sparkline on a HUD canvas. Distilled from
// world.ticker's 512×320 board so the Brief has its own chart at dawn.
function drawBriefSparkline(hist, curIdx) {
  const c = $('brief-canvas'); if (!c) return;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#0c0f14'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,.012)'; for (let i = 0; i < 600; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 1, 1);
  const vals = (hist && hist.length ? hist.map(h => h.index).concat(curIdx) : [1, curIdx]);
  const up = curIdx >= (hist.length ? hist[hist.length - 1].index : 1);
  const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
  const span = Math.max(0.08, hi - lo);
  const x0 = 28, w = c.width - 40, y0 = 14, h = 34;
  g.fillStyle = 'rgba(239,230,211,.06)'; g.fillRect(x0, y0, w, h);
  g.strokeStyle = 'rgba(201,162,39,.22)'; g.lineWidth = 0.8; g.strokeRect(x0, y0, w, h);
  g.strokeStyle = up ? '#9ad89a' : '#e07a7a'; g.lineWidth = 1.4; g.beginPath();
  vals.forEach((v, i) => {
    const x = x0 + (i / Math.max(1, vals.length - 1)) * w;
    const y = y0 + h - ((v - lo) / span) * h;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  });
  g.stroke();
  vals.forEach((v, i) => {
    const x = x0 + (i / Math.max(1, vals.length - 1)) * w;
    const y = y0 + h - ((v - lo) / span) * h;
    g.fillStyle = i === vals.length - 1 ? '#efe6d3' : 'rgba(239,230,211,.55)';
    g.beginPath(); g.arc(x, y, i === vals.length - 1 ? 2.4 : 1.2, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = 'rgba(239,230,211,.55)'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'left';
  g.fillText(vals[0].toFixed(2), x0 + 2, y0 + 10);
  g.textAlign = 'right'; g.fillText(vals[vals.length - 1].toFixed(2), x0 + w - 2, y0 + 10);
  g.fillStyle = 'rgba(239,230,211,.5)'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center';
  g.fillText('beans — 5-day', c.width / 2, y0 + h + 12);
}

function showMorningBrief() {
  const el = $('brief'); if (!el) return;
  const snap = {
    day, event: exchange.event, index: exchange.beanIndex, cost: exchange.costPerCup,
    sold: lastDayStats ? lastDayStats.sold : null, balked: lastDayStats ? lastDayStats.balked : 0,
    defections: lastDayStats ? lastDayStats.defections : 0, reputation: regulars.reputation,
    debt: exchange.debt, contract: exchange.contract ? exchange.contract.price : null,
    indexPrev: tapePrev, intel: marketIntel, player: playerName,
  };
  // MakeReadable: if the player hasn't seen headlines yet, the Brief is the
  // first place the wire's strongest tilt is explained — not just hinted.
  const L = composeLetter(snap);
  const head = $('brief-kicker');
  try {
    const tilt = marketIntel?.marketShift?.[0];
    const hint = tilt ? wireHint(marketIntel) : null;
    // highlight the bean tape when a tilt is active
    const tape = $('tape');
    if (tape && tilt) tape.style.color = (EVENTS[tilt.eventId]?.tier === 'good' ? '#9ad89a' : '#e07a7a');
    head.textContent = hint ? `06:00 · day ${day}/${CAMPAIGN.days} — the wire ${hint} · · · tap the wire for sources` : `06:00 · day ${day}/${CAMPAIGN.days} — the street is still · read, then commit`;
  } catch { if (head) head.textContent = `06:00 · day ${day}/${CAMPAIGN.days} — the street is still · read, then commit`; }
  const body = $('brief-letter');
  if (body) body.textContent = L.body;
  // wire block: clickable source links + why-this-matters
  const wire = $('brief-wire');
  if (wire) {
    wire.textContent = '';
    wire.style.display = '';
    const srcs = (marketIntel && marketIntel.sources) || [];
    const shift = marketIntel?.marketShift?.[0];
    if (srcs.length) {
      const h = document.createElement('div'); h.style.fontSize = '10px'; h.style.letterSpacing = '.18em';
      h.style.textTransform = 'uppercase'; h.style.opacity = '.55'; h.textContent = 'on the wire — headlines (free)';
      wire.appendChild(h);
      for (const s of srcs.slice(0, 2)) {
        const row = document.createElement('div'); row.style.marginTop = '6px';
        const a = document.createElement('a'); a.textContent = s.title || 'untitled';
        a.href = s.url || '#'; a.target = '_blank'; a.rel = 'noopener'; if (s.snippet) a.title = s.snippet;
        let host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
        const b = document.createElement('span'); b.style.opacity = '.5'; b.style.fontSize = '10px';
        b.textContent = (host ? ' · ' + host : '') + (s.origin ? ' · ' + s.origin : '');
        row.append(a, b); wire.appendChild(row);
      }
      if (shift && shift.reason) {
        const why = document.createElement('div'); why.style.marginTop = '8px'; why.style.fontSize = '10.5px';
        why.style.opacity = '.72'; why.textContent = 'why this matters · ' + String(shift.why || shift.reason).slice(0, 160);
        wire.appendChild(why);
      }
      // insider tilt callout
      const edge = document.createElement('div'); edge.style.marginTop = '8px'; edge.style.fontSize = '10px';
      edge.style.letterSpacing = '.12em'; edge.style.textTransform = 'uppercase'; edge.style.opacity = '.45';
      if (billing.isSubscribed() && shift) {
        edge.textContent = 'insider tilt — ' + (shift.eventId || 'deck') + ' ×' + shift.weightMul;
      } else if (shift) {
        edge.textContent = 'the quantitative tilt (×) is District Insider · headlines above are yours';
      } else edge.textContent = 'headlines free · the wire lives inside the brief and the desk';
      wire.appendChild(edge);
      // a market regular hears the direction without the multiplier — the
      // whisper is qualitative, the × stays insider
      if (perkBg === 'circuit' && shift) {
        const tier = EVENTS[shift.eventId]?.tier;
        const lean = tier === 'good' ? 'kind' : tier === 'cata' || tier === 'bad' ? 'against you' : tier === 'warn' ? 'nervous' : 'flat';
        const w = document.createElement('div');
        w.style.cssText = 'margin-top:6px;font-size:10.5px;opacity:.78;font-style:italic';
        w.textContent = `the circuit whispers — the board leans ${lean}`;
        wire.appendChild(w);
      }
    } else {
      wire.textContent = 'The wire is quiet today — no headlines tilted the deck.';
    }
  }
  // Ruth — the one staffing call the week can carry. When she's fading the
  // Brief offers a choice: send her home (slow bar, saved wage, she recovers)
  // or push on (full pace now, she drains further — and below a fifth, she breaks).
  const staffRow = $('brief-staff');
  if (staffRow) {
    staffRow.textContent = '';
    baristaStaged = false;
    if (day >= 2 && baristaCondition < 0.55) {
      staffRow.style.display = '';
      const t = document.createElement('div');
      t.style.cssText = 'font-size:10.5px;opacity:.78;margin-bottom:5px;font-style:italic';
      t.textContent = baristaCondition < 0.25
        ? 'Ruth hasn’t had a day off all week — she’s dead on her feet.'
        : 'Ruth’s dragging this morning — too many shifts back to back.';
      const home = document.createElement('button'); home.id = 'brief-staff-home';
      home.textContent = 'send her home · bar −30% today, wage saved, fresh tomorrow';
      const push = document.createElement('button'); push.id = 'brief-staff-push';
      push.textContent = 'push on · she’ll manage — probably';
      const sel = on => {
        baristaStaged = on;
        home.style.borderColor = on ? 'var(--brass)' : ''; home.style.background = on ? 'rgba(201,162,39,.16)' : '';
        push.style.borderColor = on ? '' : 'var(--brass)'; push.style.background = on ? '' : 'rgba(201,162,39,.16)';
      };
      sel(false);
      home.onclick = () => sel(true); push.onclick = () => sel(false);
      staffRow.append(t, home, push);
    } else staffRow.style.display = 'none';
  }
  // choice row: sizing is the position — header says what this means in one line
  // Brief offers the hedge only (light/std/heavy/hold); settle stays on the night Letter
  const actions = $('brief-actions'); if (actions) {
    actions.textContent = '';
    const hint = document.createElement('div');
    hint.style.fontSize = '10.5px'; hint.style.opacity = '.6'; hint.style.marginBottom = '4px';
    hint.textContent = 'Sizing is the position — light wastes less, heavy covers tomorrow, spot pays no fee.';
    actions.appendChild(hint);
    for (const act of L.actions.filter(a => a.id !== 'settle')) {
      const b = document.createElement('button');
      b.dataset.id = act.id;
      b.textContent = act.label + (act.explain ? '  \u00b7  ' + act.explain : '');
      b.disabled = !!act.disabled;
      b.onclick = () => applyReply(act.id);
      actions.appendChild(b);
    }
  }
  briefChoice = null;
  const open = $('brief-open');
  if (open) open.textContent = 'OPEN FOR DAY →';
  const desklink = $('brief-desklink');
  if (desklink) {
    if (marketIntel) {
      desklink.style.display = '';
      desklink.textContent = billing.isSubscribed() ? '\u26a1 open the full wire desk' : '\u26a1 headlines free — open the desk for the tilt';
      desklink.onclick = () => desk.open(marketIntel);
    } else desklink.style.display = 'none';
  }
  drawBriefSparkline(exchange.history, exchange.beanIndex);
  // pause the floor — the Brief owns the clock until OPEN
  paused = true; if ($('pause')) $('pause').textContent = 'resume';
  el.classList.add('show');
  try { analytics.track('brief_shown', { day, event: exchange.event ? exchange.event.id : null, index: exchange.beanIndex, hasWire: !!marketIntel }); } catch {}
}

function dismissBriefAndStartDay() {
  const el = $('brief'); if (!el) return;
  let id = briefChoice;
  // default: hold (free) — the Brief never forces a debt, but it forces a choice
  if (!id) id = 'hold';
  // resolve the choice through the letter's mutation path so the contract/debt
  // + reputation + expectation all land through the single gate
  let msg = '';
  if (id === 'contract_light' || id === 'contract' || id === 'contract_heavy') {
    const heavy = id === 'contract_heavy', light = id === 'contract_light';
    const units = heavy ? CAMPAIGN.contractUnits * 2 : light ? CAMPAIGN.contractUnits / 2 : CAMPAIGN.contractUnits;
    const baseFee = heavy ? CAMPAIGN.contractFee * 2 : light ? CAMPAIGN.contractFee / 2 : CAMPAIGN.contractFee;
    const fee = baseFee + contractFeeExtra;
    const r = exchange.contractBeans(units, fee);
    if (r.ok) contractFeeExtra = 0;
    const tag = heavy ? 'heavy' : light ? 'light' : 'standard';
    msg = r.ok ? `CONTRACTED ${tag} at ${exchange.beanIndex.toFixed(2)} — ~${units} cups \u00b7 ${fmt(fee)}` : r.why;
  } else if (id === 'hold') msg = 'HOLDING — you ride the spot price';
  else if (id === 'settle') { const r = exchange.settle(exchange.debt); settledPaid += r.paid; msg = 'DEBT cleared' + (r.paid ? ' (' + fmt(r.paid) + ')' : ''); }
  fx.toast(msg, id.startsWith('contract') ? 'good' : '');
  // Ruth's shift lands here — staged in the Brief, committed with the hedge.
  // Sent home: bar −30% today, her wage saved tonight, she recovers at close.
  baristaHomeToday = baristaStaged; baristaStaged = false;
  if (baristaHomeToday) { patrons.staffMul = 0.7; fx.toast('Ruth’s off — you’re solo on the bar today', 'warn'); }
  if (day >= 2 && baristaCondition < 0.55) try { analytics.track(baristaHomeToday ? 'staff_sent_home' : 'staff_pushed', { day, condition: Math.round(baristaCondition * 100) / 100 }); } catch {}
  // expectation already landed via the Letter's applyReply between days;
  // Brief commits the hedge for *today*, not the next day's drift
  // resolveDay needs "some balls in the air" — use a neutral claim for dawn
  // so opinion only moves on the brief's drift, not a fabricated day outcome
  // (real served/balk fold in at closeDay → next showLetter cycle).
  // We intentionally DO NOT call openDay here — the day is already open.
  el.classList.remove('show');
  briefChoice = null;
  paused = false; if ($('pause')) $('pause').textContent = 'pause';
  // wire highlight fades once committed
  try { const t = $('tape'); if (t) t.style.color = ''; } catch {}
  try { analytics.track('brief_committed', { day, choice: id, debt: exchange.debt, index: exchange.beanIndex }); } catch {}
  updateHUD();
}

if ($('brief-open')) $('brief-open').onclick = () => dismissBriefAndStartDay();
if ($('brief-desklink')) $('brief-desklink').onclick = () => { if (marketIntel) desk.open(marketIntel); };

// ---- dawns -------------------------------------------------------------------
function openDay(d) {
  day = d;
  coached = d !== 1;   // the lever hint only coaches day 1, once per campaign
  patrons.reset(); fx.reset();
  waveIdx = 0; chapterIdx = 0; dayMin = DAY_START;
  till = 0; cogs = 0; balked = 0; served = 0; servedRetail = 0; defections = 0; rivalServed = 0;
  prebatched = false; repriced = false; ctx.prebatched = false; ctx.repriced = false; ctx.batchUnits = 0; patrons.repriced = false;
  peakQueue = 0; waveBalked = 0; waveServed = 0; prebatchHelped = false; waveDebriefShown = false; closed = false;
  baristaCrisis = false;
  if (d === 1) { forecastShown = false; nudgedQueue = nudgedBalk = nudgedPrice = false; }
  if (baristaRested) { baristaRested = false; fx.toast('Ruth’s back — rested. The bar hums.', 'good'); }
  world.setMatchaPrice('4.80', false);
  fx.receipt(null); fx.notebook(false);
  // the wire tilts the deck: live Linkup research multiplies event weights
  // (clamped inside roll), never replaces the seeded draw
  const intelBias = marketIntel && Array.isArray(marketIntel.marketShift)
    ? Object.fromEntries(marketIntel.marketShift.map(s => [s.eventId, s.weightMul]))
    : null;
  tapePrev = exchange.history.length ? exchange.history[exchange.history.length - 1].index : 1.0;
  offerShown = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0;
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; solicitorAt = 0;
  // Ruth's pace at dawn — exhausted legs move slower until she's rested or sent home
  patrons.staffMul = (baristaCondition < 0.35 ? 0.8 : 1) * perkStaffMul; patrons.balkMul = 1;
  const ev = exchange.openDay(intelBias);    // drift first, then roll the market + the event
  if (d === 1 && marketIntel && marketIntel.marketShift && marketIntel.marketShift.length) {
    fx.toast('market intel · ' + String(marketIntel.marketShift[0].reason).slice(0, 90), 'warn');
  }
  // the district talks: one named regular's take on today's market via
  // Nebius — cached by (name|cohort|context), so every stand on this seed
  // shares the pull. Delivered as a friend-graph bubble once they're here.
  pendingGossip = null;
  if (sync.live && !headless) {
    const reg = REGULAR_ROSTER[(d - 1) % REGULAR_ROSTER.length];
    const context = (`${ev.head}: ${ev.line}` +
      (marketIntel?.marketShift?.[0] ? ' — ' + marketIntel.marketShift[0].reason : '')).slice(0, 500);
    fetch(sync.url + '/ai/gossip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: reg.name, cohort: reg.coh, context }),
    }).then(r => (r.ok ? r.json() : null)).then(data => {
      if (data && !data.fallback && data.text)
        pendingGossip = { name: reg.name, text: `${reg.name}: ${data.text}` };
    }).catch(() => {});
  }
  // chalkboard: matcha day-price reflects the gentrification curve (4.80 → 5.40)
  if (exchange.matchaPrice) world.setMatchaPrice(exchange.matchaPrice.toFixed(2), repriced);
  if (d > 1 && exchange.debt > 0) exchange.debt += CAMPAIGN.debtInterest;   // the debt clock ticks at dawn
  if (estherCard) { till -= 2; fx.toast('esther’s stamp card: −£2', ''); }  // her cup's on the house
  world.setMail(false);
  world.setMist(ev.tier === 'cata' ? 1 : ev.tier === 'bad' ? 0.4 : 0);
  // weather as mood: tie sky/mist/god-rays/motes to the event tier
  try {
    const frosty = ev.tier === 'cata' || ev.id === 'rumour_frost';
    const harvest = ev.tier === 'good';
    const shaft = frosty ? 0.22 : harvest ? 0.14 : 0;
    world.setGodRay(shaft);
    if (world.setMotes) world.setMotes(shaft);
    world.mistMat.color.setHex(frosty ? 0xc2c9d1 : harvest ? 0xffe9a8 : 0x9a9ea6);
  } catch {}
  world.setRentPressure(d);          // the gentrification sign: 'let' → 'lease' → 'sold'
  world.setConstruction(d);          // the day-5 scaffold + tarp: the building is being remade
  world.setConstructionLeft(d);      // the day-5 mirror scaffold on the left: the whole district is turning over
  world.setConstructionRight(d);      // the day-5 back-row scaffold: gentrification reaches the further blocks
  const constructionOn = d >= 5;     // matches dayHasConstruction in world.js
  fx.constructionActive = constructionOn;   // drifting dust between the scaffolds
  audio.constructionSaw(constructionOn);    // a low procedural saw fading in/out
  audio.constructionHammer(constructionOn); // a jittered wooden tock + metal click
  // Per-regular `seen` is now flipped on individually in patrons.spawn() via
  // regulars.markSeen(cohort). No more blanket "everyone was here" — opinion
  // moves only for regulars who actually showed up today.
  rig.resetView();
  updateTicker();
  // Mirror the dawn to Convex when configured (fire-and-forget, never blocks).
  sync.mirror({ seed: SEED, day: d, beanIndex: exchange.beanIndex, matchaPrice: exchange.matchaPrice, till: cRev + till, reputation: regulars.reputation, debt: exchange.debt }).then(refreshStands);
  fx.toast('DAY ' + day + '/' + CAMPAIGN.days + ' — ' + (ev.head || 'a new day'), ev.tier === 'cata' ? 'bad' : ev.tier === 'good' ? 'good' : '');
  fx.card('DAY ' + day, ev.line || (ev.head || 'the district stirs'));
  try { world._onCatMeow = () => { try { audio.meow(); } catch {} }; } catch {}
  // gesha persists: Gwen's request lingers as a brass forecast stripe next day
  if (exchange.geshaUnlocked && day > 1) {
    fx.toast('Gwen\'s still asking about the gesha — GRUNDS unlocked', 'warn');
  }
  updateHUD();
  // Morning Brief — the Drug Wars turn: at 06:00 the floor pauses so the
  // player reads commodity → price → choice, then commits with OPEN.
  // Headless and tutorial-driven opens skip it (they own their own clock).
  if (!headless && !tutorialActive) {
    // open the Brief on the next microtask so the DOM/HUD is painted first
    setTimeout(() => showMorningBrief(), 120);
  }
}

function updateTicker() {
  // The day's matcha price is set by applyDrift() at dawn. ECON.matchaFull
  // stays the static 4.80 baseline; the live `matchaPrice` reads from the
  // gentrification curve.
  const dayPrice = exchange.matchaPrice ?? priceForDay(day);
  const tillPrice = repriced ? ECON.matchaDeal : dayPrice;
  // the wire's strongest tilt, as price pressure: a boosted bad card glows
  // red (beans dearer), a boosted good card glows green (relief).
  const topShift = marketIntel?.marketShift?.[0];
  const bias = topShift
    ? (EVENTS[topShift.eventId]?.tier === 'good' ? 2 - topShift.weightMul : topShift.weightMul)
    : null;
  world.ticker.draw({
    prev: exchange.history.length > 1 ? exchange.history[exchange.history.length - 2].index : exchange.beanIndex,
    index: exchange.beanIndex, cost: exchange.costPerCup,
    locked: exchange.contract ? exchange.contract.price * CAMPAIGN.beanBaseCost : null,
    margin: exchange.margin(tillPrice),
    day, total: CAMPAIGN.days, rep: regulars.reputation,
    history: exchange.history.map(h => h.index).concat(exchange.beanIndex),
    bias,
  });
}

function campaignClose() {
  closed = true;
  campaignDone = true;
  audio.closing();
  const net = cRev - cCost - cOps - settledPaid - exchange.debt;   // the week, after the whole cost sheet
  const rep = regulars.reputation;
  let v;
  if (net > 2400 && rep >= 78) v = VERDICTS.star;
  else if (net > 1400 && rep >= 62) v = VERDICTS.good;
  else if (net > 600) v = VERDICTS.held;
  else if (net > 0) v = VERDICTS.scarped;
  else v = VERDICTS.lost;
  const lines = [
    [standName, playerName + ' — ' + playerRole],
    ['revenue (5 days)', fmt(cRev)], ['bean cost', fmt(cCost)], ['operating costs', fmt(cOps)],
    ['final debt', fmt(exchange.debt)], ['—', '—'],
    ['cups poured', cServed], ['walked to ' + COPY.rivalName, cDef], ['—', '—'],
    ['NET WORTH', fmt(net)],
  ];
  // Finale: the street turns over on camera before the verdict lands. The
  // camera visits the sold storefronts, the card names it, then the receipt.
  rig.focus(world.focus.newbuild, 17, 7, Math.PI);
  fx.card('SOLD', 'a new tenant opens across the road');
  fx.toast('opening soon — for or against you, that\'s the question', 'warn');
  setTimeout(() => {
    fx.receipt({ lines, verdict: v });
    refreshStands();
    if ($('again')) { $('again').style.display = ''; $('again').textContent = '↺ run another week'; }
    // Challenge link: the week was a seed — share it so a friend plays the
    // same market, same waves, same regulars.
    if ($('shareWeek')) {
      $('shareWeek').style.display = '';
      $('shareWeek').onclick = () => openShareToX({
        day: CAMPAIGN.days, maxDays: CAMPAIGN.days, till: net, reputation: rep,
        verdict: v, seed: SEED,
        served: cServed, balked: cBalked,
        beatGlasshouse: cDef < cServed * 0.12,
        badge: calculateCampaignBadge({ netWorth: net, reputation: rep, served: cServed, balked: cBalked, debt: exchange.debt }),
      });
    }
  }, 5200);
}

// ---- HUD -----------------------------------------------------------------------
const fmt = n => '£' + n.toFixed(2);
const ordinal = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th');

// District leaderboard — every mirrored stand races the same week on Convex.
// Paints a compact HUD line during play and a standings block on the receipt.
function refreshStands() {
  if (!sync.live || !sync.stands) return;
  sync.stands().then(rows => {
    if (!rows || !rows.length) return;
    const me = sync.owner;
    const rank = rows.findIndex(r => r.ownerName === me) + 1;
    const d = $('district');
    d.textContent = '';
    const b = document.createElement('b');
    b.textContent = '1st ' + rows[0].ownerName + ' ' + fmt(rows[0].till);
    d.append('district · ', b,
      rank ? ' · you ' + ordinal(rank) + ' of ' + rows.length
           : ' · ' + rows.length + ' stands racing');
    const box = $('r-stands');
    box.textContent = '';
    const h = document.createElement('h4');
    h.textContent = 'district standings · live on convex';
    box.appendChild(h);
    rows.slice(0, 5).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rl' + (r.ownerName === me ? ' me' : '');
      const s1 = document.createElement('span'); s1.textContent = (i + 1) + '. ' + r.ownerName;
      const s2 = document.createElement('span'); s2.textContent = fmt(r.till);
      row.append(s1, s2);
      box.appendChild(row);
    });
    box.classList.add('show');
  }).catch(() => {});
}

let lastHudText = 0;
function updateHUD() {
  // Cheap per-tick state: progress bar + lever availability + queue bar +
  // batch countdown stay live so inputs never feel stale, even at 20×.
  $('progress').style.width = ((dayMin - DAY_START) / (DAY_END - DAY_START) * 100) + '%';
  $('prebatch').disabled = (prebatched && ctx.batchUnits > 0) || dayMin >= 960 || closed;
  $('reprice').disabled = repriced || closed;
  // queue health bar: under 5 = ok → 5–10 = warm → 10+ = hot
  const qq = patrons.queueLength;
  const qHeat = qq > 10 ? 'hot' : qq > 5 ? 'warm' : 'ok';
  const qPct = Math.min(100, Math.round(qq / 12 * 100));
  if ($('queuefill')) {
    $('queuefill').style.width = qPct + '%';
    const hb = qq > 10 ? ' hot heartbeat' : qq <= 5 ? ' ok purr' : '';
    $('queuefill').className = qHeat + hb;
  }
  if ($('qlabel')) $('qlabel').textContent = `queue ${qq} / 12 ` + (qq <= 5 ? '— calm' : qq <= 10 ? '— watch it' : '— they\u2019ll walk');
  try { world.setPlantHealth(qq); audio.purr(qq <= 5 && patrons.count > 2); } catch {}
  // the tape: the bean board as a visible object — yesterday's close →
  // today, the event that moved it, click-through to the wire
  if ($('tape')) {
    if (started && day >= 1) {
      const pct = Math.round((exchange.beanIndex - tapePrev) * 100);
      $('tape').style.display = '';
      $('tape').innerHTML = `beans <b>${exchange.beanIndex.toFixed(2)}</b> ${pct > 0 ? '↑' : pct < 0 ? '↓' : '→'} <b>${pct > 0 ? '+' : ''}${pct}%</b>` +
        (exchange.event ? ` · <span class="dim">${String(exchange.event.head).toLowerCase()}</span>` : '') +
        (marketIntel ? ' <span class="dim">· wire ↗</span>' : '');
    } else $('tape').style.display = 'none';
  }
  // batch countdown: big number when batched, — otherwise
  if ($('batchcount')) {
    const bc = ctx.prebatched ? String(ctx.batchUnits) : '—';
    const el = $('batchcount');
    if (el.textContent !== bc) {
      el.textContent = bc;
      if (ctx.prebatched) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    } else if (!ctx.prebatched) { el.textContent = '—'; }
  }
  // lever attention: pulse until first use on day 1
  if (day === 1) {
    if (!prebatched) $('prebatch').classList.add('attention'); else $('prebatch').classList.remove('attention');
    if (!repriced) $('reprice').classList.add('attention'); else $('reprice').classList.remove('attention');
  } else {
    $('prebatch').classList.remove('attention');
    $('reprice').classList.remove('attention');
  }
  // goal strip: swap from instruction to live status once the player acts
  if ($('goal')) {
    if (prebatched || repriced || dayMin >= 840) {
      const acts = [prebatched ? 'batched ' + ctx.batchUnits : 'not batched', repriced ? 'price cut' : 'full price'];
      $('goal').innerHTML = `Day ${day}/${CAMPAIGN.days} — <b>${qq} in line</b> · ${acts.join(' · ')} <span class="dim">— 14:00 rush at ${qq <= 5 ? 'safe' : 'danger'}</span>`;
    } else {
      // reactive directive: the strip answers "what should I do right now?"
      const now = qq >= 6
        ? `<b>queue’s building — 1 to batch</b>`
        : qq >= 3
          ? `watch the queue · <b>1</b> batches before the rush`
          : `keep the <b>queue under 5</b>`;
      $('goal').innerHTML = `☕ ${now} · next: <b>14:00 rush</b> <span class="dim">— walk-outs feed GLASSHOUSE</span>`;
    }
  }
  // Text + ticker redraws are the bottleneck at high speed (66 DOM writes/s
  // at 20×), so they run at ~5Hz wall-clock in the browser. Headless tests
  // bypass the throttle — they read DOM text as sim assertions.
  if (!headless) {
    const nowMs = performance.now();
    if (nowMs - lastHudText < 200) return;
    lastHudText = nowMs;
  }
  const h = String(Math.floor(dayMin / 60)).padStart(2, '0'), m = String(dayMin % 60).padStart(2, '0');
  $('clock').textContent = (paused ? '❚❚ ' : '') + `${h}:${m}`;
  world.setRivalHeat(patrons.rivalQ.length);   // their sign burns as their line grows
  if ($('daytag')) $('daytag').textContent = 'DAY ' + day + '/' + CAMPAIGN.days + '  ·  REP ' + regulars.reputation;
  $('till').textContent = fmt(till);
  $('balk').textContent = balked;
  const q = patrons.queueLength;
  const heat = q > 10 ? 'hot' : q > 5 ? 'warm' : 'ok';
  $('status').innerHTML =
    `queue <b class="${heat}">${q}</b> · matcha <b>${ctx.prebatched ? ctx.batchUnits : '—'}</b> · poured <b>${served}</b>` +
    (defections ? ` · <b class="hot">${defections} → ${COPY.rivalName.toLowerCase()}</b>` : '');
  // pressure dial: the gentrification drift. beanIndex creep since the
  // start of the campaign (1.00 → drift.maxIndex), and the day's matcha
  // till price. Always visible — even day 1, so the player can see the
  // clock at 0% and feel the clock ticking.
  if ($('pressure')) {
    const driftPct = Math.round((exchange.beanIndex - 1.0) * 100);
    const driftTxt = (driftPct >= 0 ? '+' : '') + driftPct + '%';
    const dayPrice = exchange.matchaPrice ?? priceForDay(day);
    $('pressure').innerHTML = `costs <b>${driftTxt}</b> · matcha <b>£${dayPrice.toFixed(2)}</b> · day <b>${day}/${CAMPAIGN.days}</b>`;
  }
  if (!closed) updateTicker();
}

// ---- levers ----------------------------------------------------------------------
function doPrebatch() {
  if (closed || dayMin >= 960) return;
  if (prebatched && ctx.batchUnits > 0) return;          // already warming
  const topUp = prebatched || ctx.batchUnits > 0;
  const queueBefore = patrons.queueLength;
  const priceBefore = repriced ? ECON.matchaDeal : (exchange.matchaPrice ?? priceForDay(day));
  prebatched = true; ctx.prebatched = true; ctx.batchUnits = ECON.batchUnits;
  till -= ECON.batchCost;
  fx.notebook(false);
  fx.toast(topUp ? `PRE-BATCH topped up: ${ECON.batchUnits} units (−${fmt(ECON.batchCost)})` : `PRE-BATCH: ${ECON.batchUnits} matcha units ready (−${fmt(ECON.batchCost)})`, 'good');
  audio.clink();
  world.setMatchaPrice(exchange.matchaPrice ? exchange.matchaPrice.toFixed(2) : '4.80', repriced);
  world.flashChalk('batch');
  try { audio.clink(); } catch {}
  // prediction: queue drain preview — lifts the goal bar from instruction to live status
  if (queueBefore > 3) {
    const estAfter = Math.max(0, Math.round(queueBefore * 0.52));
    fx.toast(`Chalkboard: ${queueBefore} in line → ~${estAfter} by 14:00 with 40 warm cups`, 'good');
    $('goal').innerHTML = `Day ${day}/${CAMPAIGN.days} — <b>${queueBefore} in line → ~${estAfter} at 14:00</b> · batched ${ctx.batchUnits} <span class="dim">— they’ll sit, not walk</span>`;
  }
  batchPulseUntil = performance.now() + 650;
  $('prebatch').classList.remove('attention'); $('reprice').classList.remove('attention');
  // analytics: lever attribution
  try {
    const payload = { day, dayMin, queue: queueBefore, till, price: priceBefore, topUp };
    const isFirst = !analytics.firstLeverAt;
    if (isFirst) { analytics.firstLeverAt = { lever: 'batch', day, dayMin, wallMs: Date.now() }; analytics.track('first_lever_at_min', { lever: 'batch', day, dayMin, wallMs: Date.now(), queue: queueBefore }); }
    analytics.track('lever_batch', { day, dayMin, queue: queueBefore, ...payload });
  } catch {}
  updateHUD();
}
function doReprice() {
  if (repriced || closed) return;
  const queueBefore = patrons.queueLength;
  repriced = true; ctx.repriced = true; patrons.repriced = true;
  world.setMatchaPrice('4.20', true);
  world.flashChalk('reprice');
  try { fx.chalkDust(-5.5, 2.75, -7.95); audio.chalkScreech(); } catch {}
  fx.toast('the chalkboard changes — matcha £4.20 today', 'good');
  if (queueBefore > 2) fx.toast(`New price holds the line — fewer walks at 14:00`, 'good');
  audio.clink();
  $('prebatch').classList.remove('attention'); $('reprice').classList.remove('attention');
  try {
    const isFirst = !analytics.firstLeverAt;
    if (isFirst) { analytics.firstLeverAt = { lever: 'reprice', day, dayMin, wallMs: Date.now() }; analytics.track('first_lever_at_min', { lever: 'reprice', day, dayMin, wallMs: Date.now(), queue: queueBefore }); }
    analytics.track('lever_reprice', { day, dayMin, queue: queueBefore, till });
  } catch {}
  updateHUD();
}
// ---- a regular's ask -----------------------------------------------------------
// One offer per day at 11:00 — a named regular, a real trade, a yes/no that
// pauses the floor. The Drug Wars beat mid-day: an offer lands, you weigh it,
// you answer. Consequences land deferred (12:30 payout, 15:00 queue check,
// dawn charge) so the deal has a tail.
const OFFERS = [
  { who: 'Pip',    line: '“Mind if the study group lands at 14:00? Twenty of us — all matcha.”',
    effect: 'say yes → the wave runs ~20% bigger — louder room, bigger till', yes: 'say yes',
    accept() { offerWaveMul = 1.22; } },
  { who: 'Esther', line: '“A stamp card for the week — £15 today, and my cup’s on the house from tomorrow.”',
    effect: 'say yes → +£15 now · her cup’s free at every dawn after', yes: 'take the £15',
    accept() { till += 15; estherCard = true; } },
  { who: 'Olu',    line: '“Bridge club wants the corner at half twelve. We nurse our cups — but we pay up front.”',
    effect: 'say yes → +£9 at 12:30 · and four more in your line', yes: 'book them in',
    accept() { oluPayoutAt = 750; } },
  { who: 'Gwen',   line: '“My matcha plug can do twenty units for £6.40 — today only, cash.”',
    effect: 'say yes → −£6.40 · 20 units warming now', yes: 'take the units',
    accept() { till -= 6.4; ctx.batchUnits += 20; ctx.prebatched = true; prebatched = true; } },
  { who: 'Mara',   line: '“Office run — ten flat whites at 15:00. £28, but only if the line’s under six when we land.”',
    effect: 'say yes → queue under 6 at 15:00 pays +£28 · miss it and they cross the road', yes: 'tell her yes',
    accept() { officeRunAt = 900; } },
];

function showOffer() {
  presentBeat(OFFERS[(day - 1) % OFFERS.length], 'a regular asks · y / n', false);
}
// The floor bites back — operational incidents, days 2+, post-wave. Each is
// a real cost or a real trade, not flavor: slow bar, lost sales, rep hits,
// deferred risk. Seed-offset so different seeds see different weeks.
const INCIDENTS = [
  { who: 'the plumber', line: '“Bathroom’s backed up. Emergency callout’s forty-five quid, cash.”',
    effect: 'pay £45 · or the floor loses patience — walk-outs run hotter today',
    yes: 'pay the £45', no: 'they can hold it',
    accept() { till -= 45 * perkCostMul; },
    decline() { patrons.balkMul = 1.6; } },
  { who: 'Ruth, your barista', line: '“So sorry — I’ve woken up with no voice. I can’t make it in.”',
    effect: '£55 agency cover · or solo shift — the bar runs ~40% slower',
    yes: 'book the cover', no: 'work it solo',
    accept() { till -= 55 * perkCostMul; },
    decline() { patrons.staffMul = 0.6; } },
  { who: 'the card machine', line: 'The reader’s dead. Cash only until a 4G dongle lands.',
    effect: '£25 for the dongle · or a fifth of today’s sales die at the till',
    yes: 'order the dongle', no: 'cash only today',
    accept() { till -= 25 * perkCostMul; },
    decline() { cashOnly = 0.2; } },
  { who: 'the inspector', line: '“Council. Routine check — that milk needs a dated fridge log.”',
    effect: '£30 compliance fix now · or −6 reputation when the report lands',
    yes: 'pay the £30', no: 'take the report',
    accept() { till -= 30 * perkCostMul; },
    decline() { regulars.adjustOpinions(-0.16); } },
  { who: 'a solicitor’s letter', line: 'Someone claims a scalded wrist. “Settle for sixty and it goes away.”',
    effect: 'pay £60 nuisance settlement · or contest — it lands at 16:30, half the time it sticks for £140',
    yes: 'settle the £60', no: 'contest it',
    accept() { till -= 60 * perkCostMul; },
    decline() { solicitorAt = 990; } },
  { who: 'the supplier', line: '“Milk van’s here — account’s overdue, it’s cash on delivery today.”',
    effect: '£40 cash now · or your next contract carries a +£18 fee',
    yes: 'pay the £40', no: 'put it on the account',
    accept() { till -= 40 * perkCostMul; },
    decline() { contractFeeExtra += 18; } },
];

function showIncident() {
  const idx = (day - 2 + ((SEED * 7) | 0)) % INCIDENTS.length;
  let o = INCIDENTS[idx];
  // Ruth can't call in sick on a day you already sent her home — and when
  // she's on fumes the call isn't a sick day, it's a warning shot.
  if (o.who === 'Ruth, your barista') {
    if (baristaHomeToday) o = INCIDENTS[(idx + 1) % INCIDENTS.length];
    else if (baristaCondition < 0.4) o = { ...o,
      line: '“I can’t do another one like yesterday.” Ruth’s voice is flat — she’s on fumes.',
      effect: '£55 agency cover · or she pushes on — the bar runs ~60% slower',
      decline() { patrons.staffMul = 0.4; } };
  }
  presentBeat(o, 'the floor bites back · y / n', true);
}

function presentBeat(o, kicker, incident) {
  activeBeat = o;
  $('offer-who').textContent = o.who.toUpperCase();
  $('offer-kicker').textContent = kicker;
  $('offer-line').textContent = o.line;
  $('offer-effect').textContent = o.effect;
  $('offer-yes').textContent = o.yes;
  $('offer-no').textContent = o.no || 'not today';
  $('offer').classList.toggle('incident', !!incident);
  offerWasPaused = paused; paused = true; if ($('pause')) $('pause').textContent = 'resume';
  try { audio.card(); } catch {}
  $('offer').classList.add('show');
}

function resolveOffer(said) {
  const o = activeBeat || OFFERS[(day - 1) % OFFERS.length];
  const wasIncident = $('offer').classList.contains('incident');
  $('offer').classList.remove('show'); $('offer').classList.remove('incident');
  if (!offerWasPaused) { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
  if (said) { o.accept(); fx.toast(o.who + ': ' + o.yes, 'good'); }
  else { if (o.decline) o.decline(); fx.toast(wasIncident ? o.who + ' — you take the hit as it comes' : o.who + ' shrugs — maybe tomorrow', wasIncident ? 'warn' : ''); }
  try { analytics.track(said ? (wasIncident ? 'incident_paid' : 'offer_accepted') : (wasIncident ? 'incident_risked' : 'offer_declined'), { day, who: o.who }); } catch {}
  activeBeat = null;
}
$('offer-yes').onclick = () => resolveOffer(true);
$('offer-no').onclick = () => resolveOffer(false);
$('tape').onclick = () => { if (marketIntel) desk.open(marketIntel); };

function reset() {
  // full campaign restart: the market and the regulars rewind to their start state
  const wasFinale = campaignDone;   // restarting from the verdict gets a send-off
  exchange.beanIndex = 1.0; exchange.day = 0; exchange.contract = null; exchange.debt = 0; exchange.event = null; exchange.history = [];
  tapePrev = 1.0; offerShown = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0; estherCard = false;
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; contractFeeExtra = 0; solicitorAt = 0; cOps = 0;
  briefChoice = null; lastDayStats = null;
  baristaCondition = 1.0; baristaHomeToday = false; baristaRested = false; baristaStaged = false; baristaCrisis = false;
  try { const b = $('brief'); if (b) b.classList.remove('show'); } catch {}
  $('offer').classList.remove('show');
  for (const r of regulars.regulars) { r.op = perkBg === 'newcomer' ? 0.25 : 0.15; r.seen = false; r.served = 0; r.balked = 0; }
  cRev = cCost = cBalked = cServed = cDef = settledPaid = 0; campaignDone = false; paused = false;
  if ($('pause')) $('pause').textContent = 'pause';
  $('receipt').classList.remove('show'); $('letter').classList.remove('show');
  openDay(1);
  if (wasFinale) {
    rig.crane();   // swoop home from the sold street into the new week
    fx.toast('a new week on the floor — same street, new regulars', '');
  }
}
// hover stories: raycast-ish nearest-patron probe near cursor
let _hoverRaf = 0;
function nearestPatronAt(clientX, clientY) {
  if (!patrons.patrons.length) return null;
  // project each inQueue/sit patron to screen, pick nearest within 36px
  let best = null, bestD = 36;
  for (const p of patrons.patrons) {
    if (p.state !== 'inQueue' && p.state !== 'sit' && p.state !== 'toSeat') continue;
    const v = new THREE.Vector3(p.pos.x, 1.1, p.pos.z); v.project(camera);
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    if (v.z > 1) continue;
    const d = Math.hypot(sx - clientX, sy - clientY);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
function showHover(p, x, y) {
  const el = $('hovercard'); if (!el || !p) return;
  const name = p.regularName || p.cohort;
  const quirk = p.regularName ? (regulars.regulars[p.regularIdx]?.quirk || '') : '';
  const op = p.regularIdx >= 0 ? regulars.regulars[p.regularIdx]?.op : null;
  const friends = p.regularFriends ? [...p.regularFriends].slice(0, 3).join(', ') : '';
  el.innerHTML = `<b>${name}</b>${quirk ? ` — ${quirk}` : ''}${op != null ? `<br>op ${op > 0.2 ? '♥' : op < -0.2 ? '☹' : '—'} ${op.toFixed(2)}` : ''}${friends ? `<br><span style="opacity:.7">friends: ${friends}</span>` : ''}<br><span style="opacity:.6">click to wave</span>`;
  el.style.left = Math.min(innerWidth - 230, x + 14) + 'px';
  el.style.top = Math.min(innerHeight - 80, y + 14) + 'px';
  el.classList.add('show');
}
function hideHover() { const el = $('hovercard'); if (el) el.classList.remove('show'); }
renderer.domElement.addEventListener('pointermove', e => {
  if (_hoverRaf) return;
  _hoverRaf = requestAnimationFrame(() => {
    _hoverRaf = 0;
    const p = nearestPatronAt(e.clientX, e.clientY);
    if (p) showHover(p, e.clientX, e.clientY); else hideHover();
  });
});
renderer.domElement.addEventListener('pointerleave', hideHover);
renderer.domElement.addEventListener('click', e => {
  const p = nearestPatronAt(e.clientX, e.clientY);
  if (!p) return;
  // wave: bubble + tiny heal
  fx.bubble(p, p.regularName ? `hey ${p.regularName} — welcome back` : 'hey — welcome', 'good');
  if (p.regularIdx >= 0) regulars.regulars[p.regularIdx].op = Math.min(1, regulars.regulars[p.regularIdx].op + 0.06);
  try { if (navigator.vibrate) navigator.vibrate(20); } catch {}
});
// Space pauses the floor mid-day (rendering + camera keep breathing; the
// sim clock stops). The letter/receipt phases are already still.
function togglePause() {
  if (!started || closed || campaignDone) return paused;
  paused = !paused;
  if ($('pause')) $('pause').textContent = paused ? 'resume' : 'pause';
  fx.toast(paused ? 'paused — space to resume' : 'back on the floor', '');
  lastHudText = 0;   // force the ❚❚ marker through the text throttle
  updateHUD();
  return paused;
}
$('prebatch').onclick = doPrebatch;
$('reprice').onclick = doReprice;
$('pause').onclick = () => togglePause();
$('reset').onclick = reset;
$('again').onclick = reset;
$('mute').onclick = () => { $('mute').textContent = audio.toggleMute() ? 'sound off' : 'sound on'; };
$('wirebtn').onclick = () => desk.open(marketIntel);
$('camreset').onclick = () => rig.resetView();
if ($('photoBtn')) $('photoBtn').onclick = () => { try { doPhoto(); } catch {} };
const defaultSpeedBtn = headless ? '300' : '60';
document.querySelectorAll('#speeds button').forEach(b => {
  if (b.dataset.s === defaultSpeedBtn) b.classList.add('on');
  b.onclick = () => {
    speed = +b.dataset.s;
    document.querySelectorAll('#speeds button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  };
});
addEventListener('keydown', e => {
  // the licence: typing lives in the inputs; Enter/Escape signs (defaults ok)
  if ($('licence') && $('licence').classList.contains('show')) {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); signLicence(); }
    return;
  }
  // Morning Brief answers to 1/2/3/4/5 (commit a choice) then Enter opens
  if ($('brief') && $('brief').classList.contains('show')) {
    if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4' || e.key === '5') {
      const btns = [...document.querySelectorAll('#brief-actions button')];
      const b = btns[+e.key - 1];
      if (b && !b.disabled) b.click();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = $('brief-open'); if (o) o.click(); return; }
    if (e.key === 'Escape') { e.preventDefault(); const o = $('brief-open'); if (o) o.click(); return; }
  }
  // a regular's ask answers to y/n while it's open
  if ($('offer').classList.contains('show')) {
    if (e.key === 'y' || e.key === 'Y') { resolveOffer(true); return; }
    if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') { resolveOffer(false); return; }
  }
  // the letter answers to 1/2/3/4/5 (skipping disabled actions) while it's open
  if ($('letter').classList.contains('show')) {
    if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4' || e.key === '5') {
      const btns = [...document.querySelectorAll('#letter-actions button')];
      const b = btns[+e.key - 1];
      if (b && !b.disabled) b.click();
      return;
    }
  }
  if (e.key === '1') doPrebatch();
  else if (e.key === '2') doReprice();
  else if (e.key === ' ' && started && !closed) { e.preventDefault(); togglePause(); }
  else if (e.key === 'r' || e.key === 'R') reset();
  else if (e.key === 'm' || e.key === 'M') $('mute').click();
  else if (e.key === 'c' || e.key === 'C') rig.resetView();
  else if (e.key === 'p' || e.key === 'P') { try { doPhoto(); } catch {} }
});
// photo mode: freeze at golden hour, generate share thumbnail
function doPhoto() {
  try { audio.shutter(); } catch {}
  const wasPaused = paused; paused = true; if ($('pause')) $('pause').textContent = 'resume';
  dayMin = Math.max(dayMin, 1080);
  try { world.updateTimeOfDay(dayMin); } catch {}
  try { document.body.classList.add('photo'); } catch {}
  fx.toast('📷 photo — golden hour', 'good');
  try {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas'); c.width = 720; c.height = 405;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, 720, 405);
    g.fillStyle = 'rgba(23,19,16,.78)'; g.fillRect(0, 360, 720, 45);
    g.fillStyle = '#efe6d3'; g.font = '600 16px Georgia, serif'; g.textAlign = 'center';
    const cap = `Held the line — ${served + servedRetail} served · ${balked} walked${defections ? ` · ${defections} to GLASSHOUSE` : ''}`;
    g.fillText(cap, 360, 388);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `grunds-day${day}.png`; a.click();
  } catch {}
  setTimeout(() => {
    try { document.body.classList.remove('photo'); } catch {}
    if (!wasPaused && !closed) { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
  }, 900);
}
// Konami / GRUNDS — hidden regular Gwen gesha
let _konami = '', _geshaUnlocked = false;
addEventListener('keydown', e => {
  if (e.key.length === 1) {
    _konami = (_konami + e.key.toUpperCase()).slice(-12);
    if (_konami.includes('GRUNDS') && !_geshaUnlocked) {
      _geshaUnlocked = true;
      exchange.geshaUnlocked = true;
      fx.toast('Gwen winks — gesha reserve (£7.80) on the board', 'good');
      try { world.setMatchaPrice('7.80', false); setTimeout(() => world.setMatchaPrice(exchange.matchaPrice ? exchange.matchaPrice.toFixed(2) : '4.80', repriced), 4200); } catch {}
    }
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); postfx.resize(innerWidth, innerHeight);
});

// ---- boot -------------------------------------------------------------------------
fetch('./api/schedule.json').then(r => r.json()).then(s => {
  schedule = s;
  // Wait for the Kenney GLBs to be placed before enabling Open. If a GLB
  // fails, the loader's graceful fallback returns a placeholder so the user
  // still sees a floor — they just don't see it half-loaded.
  Promise.resolve(world.ready).then(() => {
    $('open').disabled = false;
    $('open').textContent = COPY.open + ' — a week on the floor';
  });
}).catch(() => {
  $('open').textContent = 'schedule missing — run: python3 -m grunds spatial';
});
// ---- the pitch licence: sign yourself into the week ---------------------------
const LIC_ROLES = ['the new owner', 'the manager', 'the name on the lease'];
const LIC_BGS = [
  { id: 'ex-barista',    label: 'an ex-barista',    perk: 'the wrist remembers — the bar runs ~8% faster' },
  { id: 'ex-accountant', label: 'an ex-accountant', perk: 'you read invoices — fees & payouts −15%' },
  { id: 'newcomer',      label: 'new to the trade', perk: 'a fresh face — the regulars warm quicker' },
  { id: 'circuit',       label: 'a market regular', perk: 'you know the circuit — the wire names its lean' },
];
let licRole = 0, licBg = 0;
function showLicence() {
  const el = $('licence'); if (!el) return;
  // a returning signature pre-fills — the district office remembers
  try {
    const s = JSON.parse(localStorage.getItem('grunds.identity') || 'null');
    if (s) {
      playerName = s.playerName; standName = s.standName;
      licRole = Math.max(0, LIC_ROLES.indexOf(s.playerRole));
      licBg = Math.max(0, LIC_BGS.findIndex(b => b.id === s.perkBg));
    }
  } catch {}
  const nameEl = $('lic-name'), standEl = $('lic-stand');
  if (nameEl) nameEl.value = playerName === 'Sam' ? '' : playerName;
  if (standEl) standEl.value = standName === 'THE CORNER CUP' ? '' : standName;
  const roles = $('lic-roles');
  roles.textContent = '';
  LIC_ROLES.forEach((r, i) => {
    const b = document.createElement('button');
    b.textContent = r; b.className = i === licRole ? 'on' : '';
    b.onclick = () => { licRole = i; [...roles.children].forEach((c, j) => c.className = j === i ? 'on' : ''); };
    roles.appendChild(b);
  });
  const bgs = $('lic-bgs');
  bgs.textContent = '';
  LIC_BGS.forEach((g, i) => {
    const b = document.createElement('button');
    b.innerHTML = g.label + '<small>' + g.perk + '</small>';
    b.className = i === licBg ? 'on' : '';
    b.onclick = () => { licBg = i; [...bgs.children].forEach((c, j) => c.className = j === i ? 'on' : ''); };
    bgs.appendChild(b);
  });
  el.classList.add('show');
  setTimeout(() => { try { (nameEl.value ? standEl : nameEl).focus(); } catch {} }, 350);
  try { analytics.track('licence_shown'); } catch {}
}
function applyPerk() {
  perkStaffMul = perkBg === 'ex-barista' ? 1.08 : 1;
  perkCostMul = perkBg === 'ex-accountant' ? 0.85 : 1;
  if (perkBg === 'newcomer') for (const r of regulars.regulars) r.op = Math.max(r.op, 0.25);
}
function signLicence() {
  playerName = (($('lic-name').value || '').trim() || 'Sam').slice(0, 16);
  standName = ((($('lic-stand').value || '').trim() || 'the corner cup').slice(0, 22)).toUpperCase();
  playerRole = LIC_ROLES[licRole]; perkBg = LIC_BGS[licBg].id;
  try {
    localStorage.setItem('grunds.identity', JSON.stringify({ playerName, standName, playerRole, perkBg }));
    localStorage.setItem('grunds.owner', standName);   // the district board lists the stand, not a hash
  } catch {}
  applyPerk();
  $('licence').classList.remove('show');
  try { analytics.track('licence_signed', { role: playerRole, bg: perkBg, defaults: playerName === 'Sam' && standName === 'THE CORNER CUP' }); } catch {}
  fx.toast('licence signed — ' + standName + ' opens Monday', 'good');
  if (wantTutorial) openTutorial();
  else { started = true; audio.start(); openDay(1); rig.crane(); }
}
if ($('lic-sign')) $('lic-sign').onclick = signLicence;

// ---- tutorial: 3 steps, then the floor runs. Headless + ?skipTutorial bypass it.
const TUT_STEPS = [
  { k: '1 of 3 — THE READ', t: 'WATCH THE CLOCK', b: 'At <b>14:00 every day</b> students flood in for matcha. 139 &rarr; 683 a week — the fastest item on the floor. Made to order, a matcha takes <b>4 minutes</b>.' },
  { k: '2 of 3 — THE LEVER', t: 'BE READY', b: 'Before noon, hit <b>1 to pre-batch 40 cups (&pound;4.20)</b> or <b>2 to cut matcha to &pound;4.20</b>. The chalkboard changes. The queue doesn&apos;t.' },
  { k: '3 of 3 — THE PAYOFF', t: 'KEEP FIVE', b: 'Keep the queue <b>under 5</b>. Over that, they walk to <b>GLASSHOUSE</b> across the road. Under, they sit — and your till sings.' },
];
function showTutStep(n) {
  tutStep = n;
  $('tstep').textContent = TUT_STEPS[n].k;
  $('ttitle').textContent = n === 0 ? TUT_STEPS[n].t + ', ' + playerName.toUpperCase() : TUT_STEPS[n].t;
  $('tbody').innerHTML = TUT_STEPS[n].b;
  $('tnext').textContent = n < TUT_STEPS.length - 1 ? 'Next \u2192' : 'Start the day \u25B6';
  try { analytics.track('tutorial_step', { step: n + 1, total: TUT_STEPS.length, title: TUT_STEPS[n].t }); } catch {}
}
function openTutorial() {
  tutorialActive = true;
  showTutStep(0);
  $('tutorial').classList.add('show');
  $('tutorial').setAttribute('aria-hidden', 'false');
}
function closeTutorial() {
  tutorialActive = false;
  $('tutorial').classList.remove('show');
  $('tutorial').setAttribute('aria-hidden', 'true');
}
function dismissTutorialAndStart(fromSkip = false) {
  const fromStep = tutStep + 1;
  closeTutorial();
  try {
    if (fromSkip) analytics.track('tutorial_skip', { fromStep });
    else if (fromStep === TUT_STEPS.length) analytics.track('tutorial_complete', { steps: TUT_STEPS.length });
    else analytics.track('tutorial_skip', { fromStep });
  } catch {}
  // give the eye time to settle: 3.5s at wall speed before the first tick
  started = true;
  paused = true;
  if ($('pause')) $('pause').textContent = 'resume';
  audio.start();
  openDay(1);
  rig.crane();
  fx.card('DAY 1', 'a quiet street — watch the queue, hit 1 before noon');
  // The Brief owns day 1 too: once the crane settles, Brief pauses at 06:00.
  // (openDay() already queued showMorningBrief; this just unblocks the re-arm.)
  setTimeout(() => {
    // if the Brief is still open when the crane settles, it owns the pause —
    // unpausing here would run the floor behind the modal
    if ($('brief') && $('brief').classList.contains('show')) return;
    paused = false; if ($('pause')) $('pause').textContent = 'pause';
  }, 3400);
}
$('tnext').onclick = () => {
  if (tutStep < TUT_STEPS.length - 1) showTutStep(tutStep + 1);
  else dismissTutorialAndStart(false);
};
$('tskip').onclick = () => dismissTutorialAndStart(true);
$('tclose').onclick = () => dismissTutorialAndStart(true);
addEventListener('keydown', e => {
  if (!tutorialActive) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('tnext').click(); }
  else if (e.key === 'Escape') { e.preventDefault(); dismissTutorialAndStart(true); }
});

$('open').onclick = () => {
  if (!schedule) return;
  $('title').classList.add('gone');
  setTimeout(() => $('title').remove(), 1400);
  // the licence is the first beat: who you are, signed before the tutorial.
  // headless / ?skipTutorial / ?skipLicence → defaults, straight in.
  if (!skipLicence) { showLicence(); return; }
  if (wantTutorial) openTutorial();
  else { started = true; audio.start(); openDay(1); rig.crane(); }
};

// ---- loop ---------------------------------------------------------------------------
let acc = 0, last = performance.now();
let _slowFrames = 0, _liteSwitched = false;
function loop(now) {
  // re-arm first so a nested RAF inside the frame (loader fade) never steals the slot
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // dynamic lite fallback: 3 slow frames (>32ms) → kill shadows/bloom
  if (!headless && !_liteSwitched && !lite && dt > 0.032) {
    _slowFrames++;
    if (_slowFrames >= 3) {
      _liteSwitched = true;
      try { renderer.shadowMap.enabled = false; postfx.dispose(); } catch {}
    }
  }
  // shadow budget: at peak queue shadows are noise — save the fill rate
  try { renderer.shadowMap.enabled = (lite || _liteSwitched) ? false : (patrons.queueLength <= 40); } catch {}
  // numbers snap to RAF, not tick: jank-free even at 20× (see updateHUD throttle)
  if (started && !closed && !paused && !tutorialActive && schedule) {
    acc += dt * 1000;
    const msPerMin = 300 / (speed / 60);
    while (acc > msPerMin) { acc -= msPerMin; tick(); }
  }
  world.updateTimeOfDay(dayMin);
  sky.update(dayMin);
  postfx.setNight((world.night || 0) > 0.35 || dayMin < 420 || dayMin > 1180);
  patrons.update(dt, WALK_MUL[speed] || 2, now);
  world.updateRival(dt, now);
  try { world.updateCat(dt, patrons.queueLength); world._updateDelight(now, dt); } catch {}
  fx.steamFrom(dt);
  fx.update(dt, camera, now);
  rig.update(dt, now);
  audio.setCrowd(patrons.count);
  audio.setRush(patrons.queueLength > 8);
  audio.update(dt);
  if (!headless) postfx.render(now);   // headless harness skips GL
}
  window.__grunds = {
  stats: () => ({ day, dayMin, till, cogs, balked, served, servedRetail, defections, rivalServed, peakQueue, waveBalked, waveServed, net: till - cogs - exchange.debt, queue: patrons.queueLength, count: patrons.count,
    index: exchange.beanIndex, cost: exchange.costPerCup, debt: exchange.debt, settledPaid, campaignDone, netWorth: cRev - cCost - cOps - settledPaid - exchange.debt, rep: regulars.reputation, event: exchange.event ? exchange.event.id : null, contract: exchange.contract ? exchange.contract.price : null }),
  states: () => patrons.patrons.reduce((m, p) => ((m[p.state] = (m[p.state] || 0) + 1), m), {}),
  exc: exchange, reg: regulars, sync, world, rig, analytics,
  openDay, applyReply, reset, togglePause,
  get paused() { return paused; },
};
// Playtest helper — paste __grunds.analytics.summary() after Day 1 in console
try { window.__grunds.analytics = analytics; } catch {}

updateHUD();
requestAnimationFrame(loop);

