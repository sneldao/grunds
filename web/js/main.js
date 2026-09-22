// Grunds — The District. Main loop: the three nested clocks meet the floor.
//   THE GAMBLE (days)    — the Exchange: a pity-timer event deck + the bean market
//   THE READ (hours)    — the wave schedule + the Roaster's Notebook
//   THE SCRAMBLE (sec)  — the queue: pre-batch, reprice, or lose them to GLASSHOUSE
import * as THREE from '../vendor/three.module.js';
import { ECON, CHAPTERS, COPY, LAYOUT, CAMPAIGN, VERDICTS, REGULAR_ROSTER, EVENTS } from './config.js';
import { buildWorld } from './world.js';
import { initDistrictGen, districtOptOut } from './districtGen.js';
import { buildSky } from './sky.js';
import { buildPostFX } from './postfx.js';
import { buildDirector } from './director.js';
import { buildVitality } from './vitality.js';
import { computeNextAction } from './nextAction.js';
import { buildHalo, shouldHalo } from './halo.js';
import { buildKitBeat } from './kitArrival.js';
import { PatronSystem } from './patrons.js';
import { FX } from './fx.js';
import { CameraRig } from './camera.js';
import { AudioEngine } from './audio.js';
import { Exchange, seeded } from './exchange.js';
import { salePrice, operatingCosts, hedgeTerms, quoteDayPlan, campaignVerdict } from './economy.js';
import { Regulars } from './regulars.js';
import { Demand, DEMAND_ACTIONS } from './demand.js';
import { composeLetter } from './letter.js';
import { applyExpectation, priceForDay, modifiersForDay, wavesForDay, getMacroShockForDay, calculateNonLinearDrift, MACRO_SHOCKS } from './gentrification.js';
import { strategyForDay } from './rival.js';
import { canChooseStaffing, canHaveStaffCrisis } from './staffing.js';
import { resolveDecision } from './decision.js';
import { initSync } from './convexSync.js';
import { buildMailTheater } from './mailTheater.js';
import { calculateCampaignBadge, openShareToX, formatShareText } from './share.js';
import { buildShareCard, CARD_W, CARD_H } from './shareCard.js';
import { createAnalytics } from './analytics.js';
import { billing } from './billing.js';
import { initDesk, wireHint } from './desk.js';
import { createModalController } from './modals.js';

const urlParams = new URLSearchParams(location.search);
const _liteFlag = urlParams.has('lite');
const headless = typeof window !== 'undefined' && !!window.__headless;
const urlSpeed = +urlParams.get('speed');
// auto-lite: low cores or low memory → skip postFX/shadows without asking
const _autoLite = !_liteFlag && !headless && typeof navigator !== 'undefined'
  && ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
const lite = _liteFlag || _autoLite;
const reducedMotion = !headless && typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
const demand = new Demand();   // awareness brings them, loyalty brings them back
let marketingSpend = 0;        // dawn-staged sponsor cost, folded into the closeDay ops sheet
// ---- vitality + director -----------------------------------------------------------
// The street's numbers, worn as weather: awareness + reputation drive a 0..1
// vitality that dims lanterns, thins the pad and shows the stars (see
// vitality.js). Layers run strictly AFTER updateTimeOfDay/sky.update rewrite
// their absolute values each frame — read-modify-write, never cached.
const director = buildDirector();
const vitality = buildVitality({ demand, regulars });
vitality.recompute();
director.add('vitalityGlow', (ctx) => {
  const v = ctx.vitality;
  const warm = 0.75 + 0.5 * v;    // café pendants + bulbs
  const street = 0.6 + 0.8 * v;   // street lamps, glows, windows, sign
  for (const p of world.lights.pendants) p.intensity *= warm;
  for (const bm of world.bulbMats) bm.emissiveIntensity *= warm;
  for (const lm of world.lampMats) lm.emissiveIntensity *= street;
  for (const sm of world.lampGlows) sm.opacity *= street;
  for (const wm of world.winMats) wm.emissiveIntensity *= street;
  world.signMat.emissiveIntensity *= street;
});
// Optional Convex mirror: offline-first, fire-and-forget. Configure with
// ?convex=https://<deploy>.convex.site — the floor never blocks on it.
const sync = initSync();
const SEED = urlParams.get('seed') ? +urlParams.get('seed') : 7;
// Generative District (Tripothon S1): street furniture grown from the seed
// via the Convex bridge — fire-and-forget cross-fade on arrival; the classic
// procedural district is the fallback. No-ops when headless / no-GL / no Convex.
// ?classicDistrict forces the procedural street (completeness escape hatch).
const district = initDistrictGen({ scene, seed: SEED, classic: districtOptOut(location.search) });
// Linkup market intel: fetched once per session (server-cached 6h). Tilts the
// dawn deck via exchange.openDay(bias) and is cited in the roaster's letter.
let marketIntel = null;
if (sync.live && sync.intel) sync.intel().then(r => {
  marketIntel = r;
  if (r && $('wirebtn')) $('wirebtn').style.display = '';
});
if (sync.managed && sync.managed()) sync.beginRun(SEED).catch(() => {});

const fx = new FX(scene, null, lite);   // patrons wired in just below
// ---- idle guidance ------------------------------------------------------------
// halo.js points at the SAME answer the goal strip speaks (nextAction.js).
// Any intent — pointer, lever, key — retires it; it only wakes after 4.5s.
const halo = headless ? null : buildHalo(scene);
const HALO_SPOTS = {
  chalk: new THREE.Vector3(-5.5, 0.02, -6.8),     // in front of the menu board
  street: new THREE.Vector3(0, 0.02, 5.6),        // the pavement band the queue walks
  mailbox: new THREE.Vector3(-10.4, 0.02, 6.4),   // world.js mailbox
};
let _lastIntentAt = 0;
function markIntent() { _lastIntentAt = performance.now(); }
let mailPending = false;      // F5: armed when a letter is posted, cleared on arrival
// The reply arrives as theater: flag rises, three knocks, envelope drops.
// Mirror only — convex handleInbound already applied the command; we never
// re-apply it here. Offline/headless never polls; classic beats go on.
const mailT = buildMailTheater({
  world, scene, audio, fx, sync, headless, reducedMotion,
  onArrive: (letter) => {
    mailPending = false;
    if (phase === 'planning') fx.toast('reply recorded — Open uses the recorded plan', 'good');
    const msg = String(letter.body || '').replace(/^Inbound reply \(\w+\)( from [^:]+)?:\s*/, '');
    if ($('letter') && $('letter').classList.contains('show')) {
      const sign = $('letter-sign');
      if (sign) sign.textContent = '✉ Idris replied: “' + msg.slice(0, 110) + (msg.length > 110 ? '…' : '') + '”';
    }
    try { vitality.recompute(); } catch {}
  },
});
// ---- the kit arrival celebration ------------------------------------------------
// A kit that grew at load stays a quiet crossfade; one that finishes DURING
// play is an event: cart rolls in, lights strike, toast lands. The policy
// (pending at open) lives here, not in districtGen — that module stays
// game-state-free.
const kitBeat = buildKitBeat({ world, audio, fx, director, reducedMotion, headless });
let kitPendingAtOpen = false;
district.onGrown = (slots) => {
  if (kitPendingAtOpen) kitBeat.start(slots, SEED);
};
function currentAction() {
  return computeNextAction({ dayMin, queue: patrons.queueLength, prebatched, repriced, batchUnits: ctx.batchUnits, mailPending, offerShown, eveningFast });
}
const patrons = new PatronSystem(scene, world, regulars, exchange, fx);
fx.patrons = patrons;
const analytics = createAnalytics();
// expose playtest script on boot — QA can copy/paste from console
try { console.log(analytics.playtestScript()); } catch {}
let deskHeldPause = false;
const modals = createModalController({
  onEscape: (t) => {
    if (t === 'desk') desk.close();
    else if (t === 'paywall') modals.close('paywall');
    else if (t === 'letter') {
      modals.close('letter');
      if (phase === 'review' && lastDayReceipt) modals.open('receipt');
    } else if (t === 'evening') resolveEvening('hold');
    else if (t === 'receipt') {
      const back = $('receipt-back');
      if (phase === 'planning' && back && back.style.display !== 'none') back.click();
    }
  },
  onShortcut: (t, e) => {
    // Morning Brief answers to 1/2/3/4/5 (commit a choice) then Enter opens
    if (t === 'brief') {
      if (e.key >= '1' && e.key <= '5') {
        const b = [...document.querySelectorAll('#brief-actions button')][+e.key - 1];
        if (b && !b.disabled) b.click();
      } else if (e.key === 'Enter') {
        const o = $('brief-open'); if (o) o.click();
      }
    } else if (t === 'offer') {
      // a regular's ask answers to y/n while it's open
      if (e.key === 'y' || e.key === 'Y') resolveOffer(true);
      else if (e.key === 'n' || e.key === 'N') resolveOffer(false);
    } else if (t === 'tutorial') {
      if (e.key === 'Enter') { const n = $('tnext'); if (n) n.click(); }
    }
  },
  onActiveChange: (t) => {
    if (t === 'desk' || t === 'paywall') {
      if (phase === 'trading' && !paused && !deskHeldPause) {
        deskHeldPause = true;
        paused = true; if ($('pause')) $('pause').textContent = 'resume';
      }
    } else if (deskHeldPause) {
      deskHeldPause = false;
      if (phase === 'trading' && !closed) { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
    }
  },
});
fx.modals = modals;
// District Insider Pass: the research desk gates on the entitlement; the
// stand owner doubles as the RevenueCat appUserId so a pass travels with it.
const desk = initDesk({ billing, analytics, modals });
billing.configure(sync.owner);

// ---- game state ---------------------------------------------------------------
const DAY_START = 360, DAY_END = 1260;
let schedule = null, waveIdx = 0, chapterIdx = 0;
let day = 0, dayMin = DAY_START, speed = [60, 300, 1200].includes(urlSpeed) ? urlSpeed : 60, started = false, closed = false, paused = false;
let phase = 'onboarding';
let runGen = 0;
function scheduleRun(cb, delay) {
  const gen = runGen;
  return setTimeout(() => { if (gen === runGen) cb(); }, delay);
}
let planDraft = null;
let realizedHedgeSavings = 0, hedgedCups = 0;
let lastDayReceipt = null;
let dayWaves = [];
let preparedCups = 0, trainingSpend = 0, sampleSpend = 0;
let feeToday = 0, interestToday = 0, settleToday = 0;
let lastOps = null;
// calm-open state: first 12 sim-min are thinned + tutorial gates the clock
let tutorialActive = false, tutStep = 0;
let batchPulseUntil = 0;
const wantTutorial = !headless && !urlParams.has('skipTutorial') && !urlParams.has('notutorial');
// the pitch licence precedes the tutorial — ?skipTutorial/?notutorial/?skipLicence
// or headless all bypass it (the district assigns defaults: Sam, THE CORNER CUP)
const skipLicence = headless || urlParams.has('skipLicence') || !wantTutorial;
let till = 0, cogs = 0, balked = 0, served = 0, servedRetail = 0, defections = 0, rivalServed = 0;
// first-timers = walk-ins the Regulars graph doesn't know (regularIdx < 0).
// The new-shop arc lives on these numbers: tried, walked, told a friend.
let firstServed = 0, firstWalked = 0, firstServedToast = 0, firstWalkedToast = 0;
let prebatched = false, repriced = false;
let peakQueue = 0, waveBalked = 0, waveServed = 0, prebatchHelped = false;
let coached = false;   // day-1 lever hint, once per campaign
// just-in-time nudges: each fires once per campaign, only when its
// condition is on screen — teach at the moment of need, not at boot
let nudgedQueue = false, nudgedBalk = false, nudgedPrice = false;

let eveningCallShown = false, eveningFast = false;
let forecastShown = false;     // day-2 forecast tease, once per campaign (day 1 evening)
let pendingGossip = null;      // a named regular's Nebius take on the market, one per day
let tapePrev = 1.0;            // yesterday's bean-index close — the tape's delta
// a regular's ask: one mid-day offer per day, yes/no with a real cost
let offerShown = false, offerWaveMul = 1, officeRunAt = 0, oluPayoutAt = 0, estherCard = false, offerWasPaused = false;
// The 11:00 ask can put a named party on the floor. Count them through the
// rush so the evening card and Pip's opinion are about people, not a ratio.
let party = null;   // { name, cohort, left, served, walked, declined? } | null
let batchWaste = 0; // prepaid cups still on the bar at close
let batchSpend = 0; // cash spent on cups up front — the receipt shows it beside revenue
let incidentShown = false, activeBeat = null, cashOnly = 0, cashOnlyToast = false, contractFeeExtra = 0, solicitorAt = 0;
// Morning Brief — the Drug Wars turn: paused at 06:00, read then commit
let briefChoice = null;
let lastDayStats = null;   // yesterday's counters — the Brief's letter reads them at dawn
// Ruth — your barista. One hidden condition stat; the fiction carries it.
// Worked days drain (harder on brutal floors), sent-home days recover.
let baristaCondition = 1.0, baristaHomeToday = false, baristaRested = false, baristaStaged = false, baristaCrisis = false;
let apprenticeHiredToday = false, rivalStrategy = 'DEFAULT', dayMods = {};
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
  if (phase !== 'trading' || paused || closed) return;
  if (dayMin >= DAY_END) { closeDay(); return; }
  dayMin++;
  // Drop 20× when the rush starts — the cup countdown has to be readable.
  if (!headless && speed >= 1200 && dayMin === 840) {
    speed = 300;
    document.querySelectorAll('#speeds button').forEach(x => {
      x.classList.toggle('on', x.dataset.s === '300');
    });
    fx.toast('slowed to 5× for the rush', 'warn');
  }
  if (!headless) {
    document.querySelectorAll('#speeds button').forEach(x => {
      if (x.dataset.s === '1200') x.disabled = phase === 'trading' && dayMin >= 840 && dayMin < 1020;
    });
  }
  // spawn the wave — day-1 mornings are half-demand so newcomers can read the floor
  while (waveIdx < dayWaves.length && dayWaves[waveIdx].t < dayMin) {
    const w = dayWaves[waveIdx++];
    const morningCalm = (day === 1 && w.t < 600) ? 0.52 : 1;
    const settleThin = (day === 1 && dayMin < CALM_UNTIL_MIN) ? 0.5 : 1;
    const mul = (exchange.event?.demand || 1) * regulars.footfallMul * demand.spawnMul() * morningCalm * settleThin * (w.t >= 840 ? offerWaveMul : 1);
    // loyalty made visible: yesterday's served × return rate reappear,
    // spread evenly so the wave keeps its shape and just runs deeper
    const returnBonus = demand.todayReturnees > 0 && dayWaves.length
      ? Math.round(demand.todayReturnees / dayWaves.length) : 0;
    let firstSpawn = true;
    patrons.party = party;
    patrons.partyActive = dayMin >= 840 && dayMin <= 1020;
    for (const s of w.spawns) {
      const n = Math.max(1, Math.round(s.q * ECON.spawnScale * mul)) + (firstSpawn ? returnBonus : 0);
      firstSpawn = false;
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
      preparedCups++;
      // cash-only day: a share of sales die at the till — no card, no sale
      if (cashOnly && Math.random() < cashOnly) {
        cogs += e.beanCost ?? 0;
        if (e.hedged) { hedgedCups++; realizedHedgeSavings += e.spotCost - e.beanCost; }
        balked++; balks++;
        if (dayMin >= 840 && dayMin <= 1020) waveBalked++;
        if (!cashOnlyToast) { cashOnlyToast = true; fx.toast('no card, no sale — they leave the cup on the counter', 'warn'); }
        continue;
      }
      till += e.price; cogs += e.beanCost ?? 0; sales++;
      if (e.hedged) { hedgedCups++; realizedHedgeSavings += e.spotCost - e.beanCost; }
      if (e.viaRegister) servedRetail++; else served++;
      if (e.p && e.p.regularIdx < 0) {
        firstServed++;
        if (firstServedToast < 2) { firstServedToast++; fx.toast('a first-timer — the street’s trying you', 'good'); }
      }
      if (e.p && e.p.partyMember && party && !party.declined) party.served++;
      if (dayMin >= 840 && dayMin <= 1020) waveServed++;
      audio.clink();
    } else if (e.type === 'balked') {
      balked++; balks++;
      if (e.p && e.p.regularIdx < 0) {
        firstWalked++;
        if (firstWalkedToast < 2) { firstWalkedToast++; fx.toast('a first-timer walked — first impressions travel', 'warn'); }
      }
      if (e.p && e.p.partyMember && party && !party.declined) party.walked++;
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
        fx.toast('they walked — press 1 to prep cups, or 2 to cut the price', 'warn');
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
  // Stock ran out — the bar goes cold until a top-up. The day's prep choice
  // still stands (price cut stays locked).
  if (prebatched && ctx.batchUnits <= 0 && ctx.prebatched) {
    ctx.prebatched = false;
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
    if (eveningFast) continue;
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
  // The tutorial owns the rule at open. The notebook comes back at noon
  // and again if the 14:00 wave arrives with a cold bar.
  // Day-2 forecast tease: ~17:30 day 1, once per campaign. Gives a reason to replay.
  if (day === 1 && !forecastShown && dayMin >= 1050 && !closed && !eveningFast) {
    forecastShown = true;
    const nextPrice = priceForDay(2).toFixed(2);
    const nextIdx = (exchange.beanIndex + calculateNonLinearDrift(2)).toFixed(2);
    const fore = exchange.event?.id === 'rumour_frost' || exchange.event?.id === 'frost_minas'
      ? 'Forecast Day 2: the wire mutters frost — the board drifts toward ' + nextIdx + ' before the dawn card · matcha £' + nextPrice + '. The contract choice comes at closing.'
      : 'Forecast Day 2: matcha £' + nextPrice + ' on the curve · the board rolls at dawn — the contract choice comes at closing.';
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
  // Day-1 coach: moves earlier (12:00) — halfway between noon reading
  // and 14:00 action. Only if the player hasn't acted yet, once per campaign.
  if (day === 1 && !coached && dayMin >= 720 && !prebatched && !repriced) {
    coached = true;
    fx.toast(`students at 14:00 — 1 buys cups (${fmt(ECON.batchCost)}) or 2 cuts the price — pick one`, 'warn');
    audio.card();
    $('prebatch').classList.add('attention');
    $('reprice').classList.add('attention');
  }
  // contextual nudges — bound to the state on screen, any day, once each
  if (!nudgedQueue && patrons.queueLength >= 4 && !prebatched && dayMin < 840) {
    nudgedQueue = true;
    fx.toast('line’s past 5 — press 1 to prep cups', 'warn');
    $('prebatch').classList.add('attention');
  }
  if (!nudgedPrice && dayMin >= 800 && dayMin < 840 && !repriced) {
    nudgedPrice = true;
    fx.toast(`14:00 is close — 2 sells matcha at ${fmt(ECON.matchaDeal)}`, 'warn');
    $('reprice').classList.add('attention');
  }
  // a regular's ask — once per day at 11:00, pauses the floor for a yes/no
  if (!offerShown && dayMin >= 660 && dayMin < 840) { offerShown = true; showOffer(); }
  // the floor bites back — one incident per day from day 2, post-wave
  // (14:55+), when the rush is done and the mess lands. Same pause/yes-no.
  if (day >= 2 && !incidentShown && dayMin >= 895 && dayMin < 1015 &&
      !$('offer').classList.contains('show')) { incidentShown = true; showIncident(); }
  // deferred offer consequences
  if (oluPayoutAt && dayMin >= oluPayoutAt) {
    oluPayoutAt = 0; till += 9;
    patrons.party = party;
    patrons.partyActive = true;
    for (let i = 0; i < 4; i++) patrons.spawn('elders', 'counter');
    patrons.partyActive = dayMin >= 840 && dayMin <= 1020;
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
  if (canHaveStaffCrisis({ day, staffing: baristaHomeToday ? 'home' : apprenticeHiredToday ? 'apprentice' : 'work', condition: baristaCondition, crisis: baristaCrisis, dayMin })) {
    baristaCrisis = true;
    if (Math.random() < 0.5) { patrons.staffMul = 0.5; fx.toast('Ruth’s gone quiet — she’s asleep on the back counter. The bar crawls.', 'bad'); }
    else { regulars.adjustOpinions(-0.2); fx.toast('Ruth snapped at a regular — the room went cold.', 'bad'); }
    try { analytics.track('staff_crisis', { day, condition: Math.round(baristaCondition * 100) / 100 }); } catch {}
  }
  // 17:00: the rush, the incident, and any deferred ask have landed.
  // One call, then the evening resolves itself. Headless holds and keeps
  // ticking so a full day still closes at 21:00.
  if (!eveningCallShown && dayMin >= 1020 && !closed) {
    if (!headless && modals.top()) return;
    eveningCallShown = true;
    const read = waveRead();
    const waveN = read.waveServed + read.waveBalked;
    if (waveN > 0 && !headless) fx.toast(`the wave: ${read.waveServed} served · ${read.waveBalked} walked`, read.ratio <= 0.15 ? 'good' : 'warn');
    if (waveN > 0 && !headless) {
      const win = read.waveServed >= 30 && read.ratio <= 0.15;
      try {
        if (win) audio.waveFanfare(read.waveServed); else audio.waveRain(read.waveBalked);
        if (win && speed <= 300) rig.focus(world.focus.counter, 11, 3.5);
        if (win) { fx.coinRain(LAYOUT.register.x, 1.5, -5.2, Math.min(22, 10 + Math.round(read.waveServed / 10))); }
        if (win) fx.victoryBurst(read.waveServed);
        if (navigator.vibrate) navigator.vibrate(win ? [20, 30, 50] : 35);
        if (win) world.setPlantHealth(Math.max(0, patrons.queueLength - 2));
      } catch {}
    }
    try { analytics.track('wave_debrief_shown', { day, dayMin, waveBalked, waveServed, waveRatio: read.ratio, lever: read.lever, verdict: read.sub }); } catch {}
    if (!headless) showEveningCall(read);
  }
}

function waveRead() {
  const waveN = waveServed + waveBalked;
  const ratio = waveN ? waveBalked / waveN : 0;
  const lever = prebatched ? 'prep' : repriced ? 'deal' : null;
  const pace = ECON.prepMatcha / ECON.prepBatched;
  const sub = !lever
    ? (waveBalked ? 'No cups bought — the wave ate you.' : 'The wave passed quietly.')
    : (ratio <= 0.06 ? 'You held the line.' : ratio <= 0.15 ? 'The call paid off.' : 'Tough wave — top up earlier tomorrow.');
  const lines = [
    `the wave: ${waveBalked} walked · ${waveServed} served`,
    lever === 'prep'
      ? `the batch moved matcha at ${pace}× pace — speed was the answer`
      : lever === 'deal'
        ? 'the deal kept them patient — balks ran at a quarter'
        : `a ${ECON.batchUnits}-cup batch moves matcha at ${pace}× pace — a deal keeps them patient`,
  ];
  return { sub, lines, waveServed, waveBalked, ratio, lever };
}

function residualEveningCups() {
  // Rough forecast of how many more people land after the evening call.
  // Scaled the same way as the live spawn loop (no event/rep multipliers —
  // the modal needs a stable number the player can trust).
  let n = 0;
  for (const w of dayWaves) {
    if (w.t < 1020) continue;
    for (const s of w.spawns || []) n += Math.max(0, Math.round((s.q || 0) * ECON.spawnScale));
  }
  return n;
}

function showEveningCall(read) {
  const body = $('evening-read');
  const partyLine = partyLineText();
  if (body) body.textContent = (partyLine ? partyLine + '\n\n' : '') + read.sub + '\n' + read.lines.join('\n');
  const left = $('evening-left');
  if (left) {
    const residual = residualEveningCups();
    const q = patrons.queueLength;
    let txt = ctx.batchUnits > 0
      ? ctx.batchUnits + ' cups still ready — leftovers spoil at close'
      : (prebatched ? 'no cups left on the bar' : 'no cups ready');
    if (residual > 0) {
      if (q <= 5 && residual < ECON.batchUnits / 2)
        txt += ` · evening usually brings ~${residual} — hold is enough`;
      else
        txt += ` · evening usually brings ~${residual}`;
    } else if (q <= 5) {
      txt += ' — hold is enough';
    }
    left.textContent = txt;
  }
  const morrow = $('evening-morrow');
  if (morrow) {
    if (day === 1) {
      forecastShown = true;
      morrow.hidden = false;
      morrow.textContent = 'Tomorrow the board opens near £' + priceForDay(2).toFixed(2) + '.';
    } else { morrow.textContent = ''; morrow.hidden = true; }
  }
  const topup = $('evening-topup');
  if (topup) {
    // Top-up is only for a prep day — a price-cut day holds or closes.
    const canTop = prebatched && !repriced;
    topup.disabled = !canTop;
    topup.style.display = canTop ? '' : 'none';
  }
  paused = true;
  if ($('pause')) $('pause').textContent = 'resume';
  modals.open('evening');
}

function partyLineText() {
  if (!party) return '';
  if (party.declined) return party.name + ' stayed away.';
  return party.name + '’s group: ' + party.served + ' stayed, ' + party.walked + ' walked';
}

function resolveEvening(choice) {
  if (eveningFast || phase !== 'trading' || closed) return;
  if (choice === 'topup') {
    if (!prebatched || repriced) choice = 'hold';
    else {
      till -= ECON.batchCost; batchSpend += ECON.batchCost;
      ctx.batchUnits += ECON.batchUnits;
      ctx.prebatched = true;
      prebatched = true;
    }
  }
  try { modals.close('evening'); } catch {}
  paused = false;
  if ($('pause')) $('pause').textContent = 'pause';
  try { analytics.track('evening_call', { day, choice, batchUnits: ctx.batchUnits, party: party ? { name: party.name, served: party.served, walked: party.walked, declined: !!party.declined } : null }); } catch {}
  if (choice === 'close') {
    fx.card('GOLDEN HOUR', 'you let the evening go — the till is what you kept');
    closeDay();
    return;
  }
  fx.card('GOLDEN HOUR', choice === 'topup'
    ? 'forty more cups — the evening serves itself'
    : 'you hold the line — the evening runs on');
  eveningFast = true;
}

function closeDay() {
  if (closed || phase !== 'trading') return;
  closed = true;
  phase = 'review';
  audio.closing();
  if ($('again')) $('again').style.display = 'none';   // mid-campaign: the letter drives the next day, not this button
  if ($('shareWeek')) $('shareWeek').style.display = 'none';
  cRev += till; cCost += cogs; cBalked += balked; cServed += served + servedRetail; cDef += defections;
  lastDayStats = { sold: served + servedRetail, balked, defections };   // the Brief reads these at dawn
  // Ruth's ledger — a worked day drains (harder on a brutal floor), a
  // sent-home day recovers. The cost is real: her wage is saved but the
  // bar runs a third slower while she's off. Apprentice gives partial rest.
  const ruthWasHome = baristaHomeToday;
  const hiredApprentice = apprenticeHiredToday;
  if (ruthWasHome) { baristaCondition = Math.min(1, baristaCondition + 0.45); baristaRested = true; }
  else if (hiredApprentice) { baristaCondition = Math.min(1, baristaCondition + (CAMPAIGN.staff?.ruthApprenticeRest || 0.25)); baristaRested = true; }
  else baristaCondition = Math.max(0, baristaCondition - 0.14 - (peakQueue > 50 ? 0.08 : 0) - (balked > 60 ? 0.06 : 0));
  baristaHomeToday = false;
  apprenticeHiredToday = false;
  if (patrons) patrons.apprenticeActive = false;
  // the cost sheet — a real stand pays more than beans. Labour, milk+cups,
  // turnover-linked pitch rent, card fees, sundries: the day's true P&L.
  const servedN = served + servedRetail;
  // demand resolves at close: the street forgets a little every day
  // (catastrophes scare extra), dawn-staged street work lands tomorrow's
  // awareness, and today's served × loyalty become tomorrow's returnees
  const dtrace = demand.resolveDay({ served: servedN, reputation: regulars.reputation, eventTier: exchange.event?.tier });
  vitality.recompute();   // the evening settles on the block's true mood
  try { analytics.track('demand_resolved', { day, ...dtrace }); } catch {}
  // gentrification pressure first: cohort expectations drift by `day * delta`.
  // Then resolveDay folds in the day's outcome and runs the friendship
  // contagion, so the network sees the drift through the social layer.
  applyExpectation(regulars, day);
  // The person who asked at 11:00 — their group's stay/walk shifts their
  // opinion before the friend graph spreads it.
  if (party && !party.declined && party.name) {
    const r = regulars.regulars.find(x => x.name === party.name);
    if (r) {
      if (party.served > party.walked) r.op = Math.min(1, r.op + 0.06);
      else if (party.walked > party.served) r.op = Math.max(-1, r.op - 0.12);
    }
  }
  regulars.resolveDay({ served: servedN, balked, defections, priced: repriced });
  batchWaste = Math.max(0, ctx.batchUnits | 0);
  const wasteCost = batchWaste * (ECON.batchCupCost || 1);
  const ops = operatingCosts({
    till, served: servedN,
    staffing: ruthWasHome ? 'home' : hiredApprentice ? 'apprentice' : 'work',
    marketing: marketingSpend,   // the sponsor invoice arrives with the milk bill
    training: trainingSpend, sampling: sampleSpend,
    perkCostMul, modifiers: dayMods,
  });
  lastOps = ops;
  marketingSpend = 0;
  cOps += ops.total;
  const operatingNet = till - cogs - ops.total;
  const netToday = operatingNet - feeToday - interestToday;   // today's take-home — settlement rides the balance sheet, not the P&L
  rig.focus(world.focus.wide, 27, 6);
  const total = served + servedRetail + balked;
  const ratio = total ? balked / total : 0;
  let verdict;
  if (balked <= 2 && served > 0) verdict = 'Not one cup lost. The street is yours.';
  else if (ratio < 0.05) verdict = 'A good day on the floor.';
  else if (ratio < 0.12) verdict = 'Held the line when it mattered.';
  else if (ratio < 0.2) verdict = 'You fed the chain across the road.';
  else verdict = 'The wave ate you alive.';
  if (batchWaste >= 12) verdict += ' You bought matcha the wave didn’t drink.';
  if (netToday < 0) verdict += ' The till went backward — the nut came due anyway.';
  // The tab has a fuse: warn when the week's position can't cover tomorrow's
  // committed costs — the supplier calls it at zero.
  const worthNow = cRev - cCost - cOps - settledPaid - exchange.debt;
  if (worthNow <= 0) verdict += ' You owe more than the week is worth — Idris calls the tab.';
  else if (worthNow < ops.total) verdict += ' Another day like this and Idris calls the tab.';
  if (prebatchHelped && waveBalked < 80) verdict += ' The notebook paid off.';
  // the street talks back: coasting shows up as a sentence, not just a number
  if (dtrace.after < 0.35) verdict += ' The street is forgetting you — work it at dawn.';
  else if (dtrace.gain > 0) verdict += ' Yesterday’s street work brings them in tomorrow.';
  // Day-1 receipt gets the Day-2 forecast stripe — the preview that makes you replay.
  let forecast = null;
  if (day === 1 && day < CAMPAIGN.days) {
    const np = priceForDay(2).toFixed(2);
    const ni = (exchange.beanIndex + calculateNonLinearDrift(2)).toFixed(2);
    forecast = `Day 2: matcha £${np} on the curve · the board drifts toward ${ni} before the dawn card — the contract choice comes at opening`;
  }
  // causal trace — name the contract payoff on the receipt's forecast line
  if (hedgedCups > 0) {
    forecast = realizedHedgeSavings >= 0
      ? `Your contract covered ${hedgedCups} cups — saved ${fmt(realizedHedgeSavings)} vs the spot (${exchange.beanIndex.toFixed(2)}).`
      : `Your contract covered ${hedgedCups} cups — the spot ran ${fmt(-realizedHedgeSavings)} cheaper (${exchange.beanIndex.toFixed(2)}).`;
  }
  // when market intel tilted the deck, cite the link in the debrief for click-through
  if (marketIntel?.sources?.[0] && marketIntel?.marketShift?.[0]) {
    const s = marketIntel.sources[0];
    let host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
    const cite = host ? `${s.title ? s.title.slice(0, 44) : 'on the wire'} (${host})` : (s.title ? s.title.slice(0, 52) : 'on the wire');
    const line = `Wire: ${cite}`;
    forecast = forecast ? forecast + ' \n' + line : line;
  }
  const receiptData = {
    lines: [
      [standName, playerName],
      ['revenue', fmt(till + batchSpend)], ['bean cost', fmt(cogs)],
      ...(batchSpend > 0 ? [['matcha batch bought', `−${fmt(batchSpend)}`]] : []),
      ...(batchWaste > 0 ? [['matcha wasted', `${batchWaste} · ${fmt(wasteCost)}`]] : []),
      ...(hedgedCups > 0 ? [['hedge benefit (before fees)', fmt(realizedHedgeSavings)],
                            ...(feeToday > 0 ? [['hedge net of the fee', fmt(realizedHedgeSavings - feeToday)]] : [])] : []),
      ['staff', fmt(ops.staff)], ['milk + cups' + (dayMods.suppliesDelta ? ' (incl. oat surcharge)' : ''), fmt(ops.supplies)],
      ['pitch rent' + (dayMods.pitchMinDelta ? ' (incl. reval)' : ''), fmt(ops.pitch)], ['card fees', fmt(ops.fees)], ['sundries', fmt(ops.sundries)],
      ...(ops.training > 0 ? [['apprentice training', fmt(ops.training)]] : []),
      ...(ops.sampling > 0 ? [['sample hour', fmt(ops.sampling)]] : []),
      ...(ops.marketing > 0 ? [['street work', fmt(ops.marketing)]] : []),
      ['operations', fmt(ops.total)],
      ...(feeToday > 0 ? [['contract fee', fmt(feeToday)]] : []),
      ...(interestToday > 0 ? [['supplier interest', fmt(interestToday)]] : []),
      ['street awareness', demand.pips()],
      ['the regulars', `rep ${regulars.reputation} · footfall ${regulars.footfallMul >= 1 ? '+' : ''}${Math.round((regulars.footfallMul - 1) * 100)}%`],
      ...(party && !party.declined ? [[party.name + '’s group', `${party.served} stayed · ${party.walked} walked`]] : []),
      ...(party && party.declined ? [[party.name, 'stayed away']] : []),
      ['first-timers', `${firstServed} tried · ${firstWalked} walked out`],
      ['word of mouth', `~${dtrace.returnees} back tomorrow`],
      ['debt', exchange.debt > 0 ? `${fmt(exchange.debt)} of ${fmt(CAMPAIGN.creditLimit)}` : fmt(0)],
      ['peak queue', peakQueue + ' deep'], ['walked to ' + COPY.rivalName, defections],
      ['chose ' + COPY.rivalName, patrons.rivalChoices], ['—', '—'],
      ['NET TODAY', fmt(netToday)],
      ...(settleToday > 0 ? [['debt settled (balance payment)', fmt(settleToday)]] : []),
    ],
    verdict,
    forecast,
    netToday, operatingNet, ops, hedgeSavings: realizedHedgeSavings, fees: ops.fees,
  };
  lastDayReceipt = { ...receiptData, day };
  fx.receipt(receiptData);
  if ($('review-continue')) {
    $('review-continue').style.display = '';
    $('review-continue').textContent = day >= CAMPAIGN.days ? 'the week’s verdict →' : 'open day ' + (day + 1) + ' →';
  }
  if ($('review-letter')) $('review-letter').style.display = '';
  if ($('receipt-back')) $('receipt-back').style.display = 'none';
  refreshStands();
  if (sync.managed && sync.managed()) {
    sync.finishDay(day, {
      index: exchange.beanIndex,
      debt: exchange.debt,
      contract: exchange.contract ? { price: exchange.contract.price, units: exchange.contract.units, fee: exchange.contract.fee } : null,
      till: cRev + till,
      rep: regulars.reputation,
      matchaPrice: exchange.matchaPrice,
    }).catch(() => {});
  }
  // the between-days phase: the roaster writes. The mailbox flag goes up.
}

// ---- the Roaster's Letter (reply-to-command) ---------------------------------
function showLetter() {
  world.setMail(true);
  const snap = {
    day: phase === 'review' ? day : Math.min(day + 1, CAMPAIGN.days),   // the letter speaks to the day ahead
    event: exchange.event,
    index: exchange.beanIndex,
    cost: exchange.costPerCup,
    sold: served + servedRetail, balked, defections,
    reputation: regulars.reputation,
    debt: exchange.debt,
    contract: exchange.contract ? exchange.contract.price : null,
    indexPrev: tapePrev, player: playerName,
    intel: marketIntel,
    extraFee: contractFeeExtra,
    mode: phase === 'review' ? 'review' : 'planning',
    units: exchange.contract ? exchange.contract.units : null,
  };
  const L = composeLetter(snap);
  $('letter-head').textContent = L.head;
  $('letter-body').textContent = L.body;
  $('letter-sign').textContent = L.sign;
  const btns = $('letter-actions'); btns.innerHTML = '';
  modals.close('receipt');
  modals.open('letter');
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
}

function markBriefChoice(id) {
  briefChoice = id;
  // keyboard reply picked a contract? spring the day-1 fold open so the
  // selection is visible, not buried
  try { const f = $('brief-hedge-details'); if (f && id && id.startsWith('contract')) f.open = true; } catch {}
  // rebuild brief choice row highlight
  try {
    for (const b of [...document.querySelectorAll('#brief-actions button')]) {
      const on = b.dataset.id === id;
      b.style.borderColor = on ? 'var(--brass)' : '';
      b.style.background = on ? 'rgba(201,162,39,.3)' : '';
      b.style.fontWeight = on ? '700' : '';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const selTxt = $('brief-sel');
    if (selTxt) {
      selTxt.textContent = id === 'hold' ? 'selected: riding the spot — free, but the dawn draw can still move the board'
        : id === 'settle' ? `selected: settle the tab (${fmt(exchange.debt)}) and ride the spot`
        : id ? `selected: ${String(id).replace('contract_', '')} contract at the board — ~${(hedgeTerms(id, contractFeeExtra)?.units || 0).toFixed(0)} cups, ${fmt(hedgeTerms(id, contractFeeExtra)?.fee || 0)} fee`
        : 'contracts lock the board for their cups · hold rides the spot free · settle pays the tab down.';
    }
  } catch {}
}

function applyReply(id) {
  if (phase !== 'planning') return false;
  return stageDayPlan({ hedge: id });
}

const HEDGE_CHOICES = ['hold', 'settle', 'contract_light', 'contract', 'contract_heavy'];
const STAFFING_CHOICES = ['work', 'home', 'apprentice'];

function stageDayPlan(patch = {}) {
  if (phase !== 'planning' || !planDraft) return false;
  for (const k of Object.keys(patch)) if (k !== 'hedge' && k !== 'staffing' && k !== 'marketing') return false;
  const cand = { hedge: planDraft.hedge, staffing: planDraft.staffing, marketing: { ...planDraft.marketing } };
  if (patch.hedge !== undefined) {
    if (!HEDGE_CHOICES.includes(patch.hedge)) return false;
    cand.hedge = patch.hedge;
  }
  if (patch.staffing !== undefined) {
    if (!STAFFING_CHOICES.includes(patch.staffing)) return false;
    if (patch.staffing !== 'work' && !canChooseStaffing(day, baristaCondition)) return false;
    cand.staffing = patch.staffing;
  }
  if (patch.marketing !== undefined) {
    if (typeof patch.marketing !== 'object' || patch.marketing === null) return false;
    for (const [k, v] of Object.entries(patch.marketing)) {
      if (!DEMAND_ACTIONS.includes(k) || typeof v !== 'boolean') return false;
      if (v && !demand.canStage(k, day)) return false;
      cand.marketing[k] = v;
    }
  }
  planDraft.hedge = cand.hedge;
  planDraft.staffing = cand.staffing;
  planDraft.marketing = cand.marketing;
  demand.staged.sample = !!cand.marketing.sample;
  demand.staged.sponsor = !!cand.marketing.sponsor;
  renderPlanQuote();
  if (sync.managed && sync.managed()) {
    const gen = runGen, dd = day;
    sync.stagePlan(normalizePlan(planDraft), dd).catch(() => {
      if (gen === runGen && day === dd && phase === 'planning') briefSyncError('Plan not saved yet — OPEN will retry.', true);
    });
  }
  return true;
}

function planSnapshot() {
  return {
    day,
    index: exchange.beanIndex,
    debt: exchange.debt,
    contract: exchange.contract ? { price: exchange.contract.price, units: exchange.contract.units, fee: exchange.contract.fee } : null,
    extraFee: contractFeeExtra,
    staffCondition: baristaCondition,
  };
}

function normalizePlan(p) {
  return {
    hedge: p.hedge || 'hold',
    staffing: p.staffing || 'work',
    marketing: { sample: !!(p.marketing && p.marketing.sample), sponsor: !!(p.marketing && p.marketing.sponsor) },
  };
}

function briefSyncError(msg, offerLocal) {
  const el = $('brief-error'); if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  const off = $('brief-offline'); if (off) off.style.display = msg && offerLocal ? '' : 'none';
}

function applyCommittedPlan(res) {
  const d = day;
  phase = 'committing';
  started = true;
  const hedge = res.plan.hedge;
  settledPaid += res.settlement; settleToday = res.settlement;
  interestToday = res.interest; feeToday = res.fee;
  exchange.debt = res.debt;
  exchange.contract = res.contract;
  contractFeeExtra = res.extraFee;
  let msg = '';
  if (hedge === 'settle') {
    msg = 'DEBT cleared' + (res.settlement ? ' (' + fmt(res.settlement) + ')' : '');
  } else if (hedge !== 'hold') {
    const tag = hedge === 'contract_heavy' ? 'heavy' : hedge === 'contract_light' ? 'light' : 'standard';
    msg = `CONTRACTED ${tag} at ${exchange.beanIndex.toFixed(2)} — ~${res.contract ? res.contract.units : 0} cups · ${fmt(res.fee)}`;
  } else msg = 'HOLDING — you ride the spot price';
  if (msg) fx.toast(msg, hedge.startsWith('contract') ? 'good' : '');
  // Ruth's shift lands here — staged in the Brief, committed with the hedge.
  // Sent home: bar −30% today, her wage saved tonight, she recovers at close.
  // Apprentice: hire temp barista, Ruth half-day rest, extra speed.
  baristaHomeToday = res.plan.staffing === 'home';
  apprenticeHiredToday = res.plan.staffing === 'apprentice';
  baristaStaged = false;
  // Street work lands here too — staged at dawn, paid today, felt tomorrow.
  // Sampling burns cups out of today's COGS; sponsoring invoices the ops sheet.
  if (res.plan.marketing.sample) { sampleSpend += CAMPAIGN.demand.sampleCost; fx.toast(`Sampling today — ${fmt(CAMPAIGN.demand.sampleCost)} in cups for the street`, ''); }
  if (res.plan.marketing.sponsor) { marketingSpend += CAMPAIGN.demand.sponsorCost; fx.toast(`Stall sponsored — ${fmt(CAMPAIGN.demand.sponsorCost)} on the sheet, the street hears`, 'good'); }
  if (baristaHomeToday) fx.toast('Ruth’s off — you’re solo on the bar today', 'warn');
  else if (apprenticeHiredToday) {
    trainingSpend += (CAMPAIGN.staff?.apprenticeTrainingFee || 12);
    patrons.apprenticeActive = true;
    fx.toast('Apprentice hired — fast hands, Ruth rests in the back', 'good');
  }
  if (d >= 2 && baristaCondition < 0.55) try { analytics.track(baristaHomeToday ? 'staff_sent_home' : apprenticeHiredToday ? 'staff_apprentice' : 'staff_pushed', { day: d, condition: Math.round(baristaCondition * 100) / 100 }); } catch {}
  try { analytics.track('brief_committed', { day: d, choice: hedge, debt: exchange.debt, index: exchange.beanIndex, streetWork: { ...res.plan.marketing } }); } catch {}
  planDraft = { day: d, hedge: res.plan.hedge, staffing: res.plan.staffing, marketing: { ...res.plan.marketing } };
  demand.staged.sample = res.plan.marketing.sample;
  demand.staged.sponsor = res.plan.marketing.sponsor;
  startTradingDay(d);
  try { modals.close('brief'); } catch {}
  briefSyncError('');
  return { ok: true };
}

function commitDayPlan() {
  if (phase !== 'planning' || !planDraft) return { ok: false, why: 'not planning' };
  const plan = normalizePlan(planDraft);
  if (sync.managed && sync.managed()) {
    phase = 'committing';
    const gen = runGen;
    briefSyncError('saving the plan…');
    const ob = $('brief-open'), mb = $('letter-mail-btn');
    if (ob) ob.disabled = true; if (mb) mb.disabled = true;
    const fail = (why) => {
      phase = 'planning';
      briefSyncError('Could not save the plan. Retry or start a local-only week.', true);
      if (ob) ob.disabled = false; if (mb) mb.disabled = false;
      return { ok: false, why };
    };
    return sync.commitPlan(plan, day).then(res => {
      if (gen !== runGen) return { ok: false, why: 'run reset' };
      if (!res || !res.ok || !res.result || !res.result.ok) return fail((res && res.why) || 'commit failed');
      if (ob) ob.disabled = false; if (mb) mb.disabled = false;
      return applyCommittedPlan(res.result);
    }).catch(() => gen === runGen ? fail('offline') : { ok: false, why: 'run reset' });
  }
  const r = resolveDecision(planSnapshot(), plan);
  if (!r.ok) { fx.toast(r.why, 'warn'); return r; }
  return applyCommittedPlan(r);
}

function continueFromReview() {
  if (phase !== 'review') return false;
  // The supplier calls the tab: a campaign that owes more than it's worth can't
  // open tomorrow. Same net-worth formula as stats()/the verdict.
  if (cRev - cCost - cOps - settledPaid - exchange.debt < 0) {
    fx.toast('the supplier calls the tab — the stand is done', 'warn');
    campaignClose(true);
    return true;
  }
  if (day < CAMPAIGN.days) { prepareDay(day + 1); return true; }
  campaignClose();   // the roaster's last letter is the verdict
  return true;
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

function renderPlanQuote() {
  const nutEl = $('brief-nut'); if (!nutEl || !planDraft) return;
  const q = quoteDayPlan({
    day, hedge: planDraft.hedge, staffing: planDraft.staffing, marketing: planDraft.marketing,
    debt: exchange.debt, extraFee: contractFeeExtra, perkCostMul, modifiers: modifiersForDay(day),
  });
  const netPos = cRev - cCost - cOps - settledPaid - exchange.debt;
  const pos = `campaign net position ${netPos < 0 ? '−' : ''}${fmt(Math.abs(netPos))}`;
  const committed = q.fixedMinimum + q.contractFee + q.interest;
  const bits = [
    `the nut ${fmt(q.fixedMinimum)} — the daily bill before a cup pours · wage ${fmt(q.wage)} · pitch floor ${fmt(q.ops.pitch)} · sundries ${fmt(CAMPAIGN.sundries)}${q.training ? ` · training ${fmt(q.training)}` : ''}${q.sampling ? ` · samples ${fmt(q.sampling)}` : ''}${q.marketing ? ` · street ${fmt(q.marketing)}` : ''}`,
    `each cup — labour + supplies ${fmt(q.perCup)} · pitch takes ${(q.pitchPct * 100).toFixed(0)}% above the floor · cards ${(q.cardFeePct * 100).toFixed(1)}%`,
    exchange.contract
      ? `beans — contracted at ${exchange.contract.price.toFixed(2)} (${exchange.contract.units} cups left)`
      : `beans — board ${exchange.beanIndex.toFixed(2)} spot${q.contractFee ? ` · insure for ${fmt(q.contractFee)} on the tab` : ''}`,
  ];
  // the equation only earns a line when a fee or the tab's interest moves it
  if (q.contractFee > 0 || q.interest > 0)
    bits.push(`committed ${fmt(committed)} = nut ${fmt(q.fixedMinimum)} + fee ${fmt(q.contractFee)} + interest ${fmt(q.interest)}`);
  // The target, not just the cost: cups needed to cover the committed minimum
  // at today's price and last close's bean cost. "~" because the dawn roll
  // can move the bean price after this quote.
  const cupPrice = salePrice(exchange);
  const marginPerCup = cupPrice * (1 - q.cardFeePct) - q.perCup - exchange.costPerCup;
  const breakeven = marginPerCup > 0 ? Math.ceil(committed / marginPerCup) : null;
  bits.push(breakeven != null
    ? `~${breakeven} cups just to cover it${exchange.debt > 0 ? ` · tab ${fmt(exchange.debt)} of ${fmt(CAMPAIGN.creditLimit)}` : ''}`
    : `no cup count covers this plan — the margin is underwater`);
  if (q.settlement) bits.push(`debt payment ${fmt(q.settlement)} — settles the tab, off the P&L`);
  // Net position means something once there's a day behind it — day 1 it's
  // just the float, so it stays quiet until the campaign has a history (or
  // until it goes red, which is never noise).
  const showPos = day > 1 || netPos < 0;
  const full = bits.join('\n') + (showPos ? `\n${pos}` : '');
  nutEl.textContent = full;
  const sum = $('brief-summary');
  if (sum) {
    sum.textContent = `committed ${fmt(committed)}${q.settlement ? ` · settle ${fmt(q.settlement)}` : ''}${showPos ? ` · ${pos}` : ''}`;
    sum.title = full;
  }
}

function showMorningBrief() {
  const el = $('brief'); if (!el) return;
  const snap = {
    day, event: exchange.event, index: exchange.beanIndex, cost: exchange.costPerCup,
    sold: lastDayStats ? lastDayStats.sold : null, balked: lastDayStats ? lastDayStats.balked : 0,
    defections: lastDayStats ? lastDayStats.defections : 0, reputation: regulars.reputation,
    debt: exchange.debt, contract: exchange.contract ? exchange.contract.price : null,
    indexPrev: tapePrev, intel: marketIntel, player: playerName,
    extraFee: contractFeeExtra, mode: 'planning',
    units: exchange.contract ? exchange.contract.units : null,
  };
  // MakeReadable: if the player hasn't seen headlines yet, the Brief is the
  // first place the wire's strongest tilt is explained — not just hinted.
  const L = composeLetter(snap);
  const head = $('brief-kicker');
  try {
    const tilt = marketIntel?.marketShift?.[0];
    // highlight the bean tape when a tilt is active
    const tape = $('tape');
    if (tape && tilt) tape.style.color = (EVENTS[tilt.eventId]?.tier === 'good' ? '#9ad89a' : '#e07a7a');
    if (head) head.textContent = `Day ${day}/${CAMPAIGN.days} · plan before opening`;
  } catch { if (head) head.textContent = `Day ${day}/${CAMPAIGN.days} · plan before opening`; }
  const body = $('brief-letter');
  if (body) {
    // Progressive disclosure (stage 1 = the news only): the sizing explainer
    // paragraph and the wire citation live on as buttons (stage 3) and the
    // collapsed wire (stage 2) — the visible letter stays the news, not the manual.
    body.textContent = L.body.split('\n')
      .filter(ln => !ln.includes('A contract locks the board price')
        && !ln.startsWith('Off the wire — '))
      .join('\n').replace(/\n{3,}/g, '\n\n');
  }
  // wire block: clickable source links + why-this-matters
  const wire = $('brief-wire');
  if (wire) {
    wire.textContent = '';
    wire.style.display = '';
    const srcs = (marketIntel && marketIntel.sources) || [];
    const shift = marketIntel?.marketShift?.[0];
    if (srcs.length) {
      // Progressive disclosure (stage 2 = folded wire): the kicker already
      // promises "tap the wire for sources" — the summary counts the cost
      // (free) and everything inside is one tap away, not ten lines.
      // First tap opens + marks the wire read so the kicker stops shouting.
      const det = document.createElement('details'); det.id = 'brief-wire-details';
      const sum = document.createElement('summary');
      sum.textContent = `on the wire — ${Math.min(srcs.length, 2)} headline${srcs.length > 1 ? 's' : ''} (free) · tap for sources`;
      det.appendChild(sum);
      wire.appendChild(det);
      if (head) {
        head.style.cursor = 'pointer';
        head.title = 'tap to open the wire’s sources';
        head.onclick = () => {
          det.open = true;
          try { analytics.track('wire_opened', { day }); } catch {}
        };
      }
      for (const s of srcs.slice(0, 2)) {
        const row = document.createElement('div'); row.style.marginTop = '6px';
        const a = document.createElement('a'); a.textContent = s.title || 'untitled';
        a.href = s.url || '#'; a.target = '_blank'; a.rel = 'noopener'; if (s.snippet) a.title = s.snippet;
        let host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
        const b = document.createElement('span'); b.style.opacity = '.5'; b.style.fontSize = '10px';
        b.textContent = (host ? ' · ' + host : '') + (s.origin ? ' · ' + s.origin : '');
        row.append(a, b); det.appendChild(row);
      }
      if (shift && shift.reason) {
        const why = document.createElement('div'); why.style.marginTop = '8px'; why.style.fontSize = '10.5px';
        why.style.opacity = '.72'; why.textContent = 'why this matters · ' + String(shift.why || shift.reason).slice(0, 160);
        det.appendChild(why);
      }
      // insider tilt callout
      const edge = document.createElement('div'); edge.style.marginTop = '8px'; edge.style.fontSize = '10px';
      edge.style.letterSpacing = '.12em'; edge.style.textTransform = 'uppercase'; edge.style.opacity = '.45';
      if (billing.isSubscribed() && shift) {
        edge.textContent = 'insider tilt — ' + (shift.eventId || 'deck') + ' ×' + shift.weightMul;
      } else if (shift) {
        edge.textContent = 'the quantitative tilt (×) is District Insider · headlines above are yours';
      } else edge.textContent = 'headlines free · the wire lives inside the brief and the desk';
      det.appendChild(edge);
      // a market regular hears the direction without the multiplier — the
      // whisper is qualitative, the × stays insider
      if (perkBg === 'circuit' && shift) {
        const tier = EVENTS[shift.eventId]?.tier;
        const lean = tier === 'good' ? 'kind' : tier === 'cata' || tier === 'bad' ? 'against you' : tier === 'warn' ? 'nervous' : 'flat';
        const w = document.createElement('div');
        w.style.cssText = 'margin-top:6px;font-size:10.5px;opacity:.78;font-style:italic';
        w.textContent = `the circuit whispers — the board leans ${lean}`;
        det.appendChild(w);
      }
      // the desk lives inside the open wire now — context at the point of
      // curiosity, not a footer under OPEN. The standalone #brief-desklink
      // stays as the quiet-day fallback (no details element those mornings).
      const dl = document.createElement('button');
      dl.className = 'l-desktoggle';
      dl.style.cssText = 'margin:8px 0 0;font-size:11px;text-align:left;opacity:.85';
      dl.textContent = billing.isSubscribed() ? '⚡ open the full wire desk' : '⚡ headlines free — open the desk for the tilt';
      dl.onclick = () => desk.open(marketIntel);
      det.appendChild(dl);
    } else {
      wire.textContent = 'The wire is quiet today — no headlines tilted the deck.';
    }
  }
  // Street work — the demand turn inside the Brief. Awareness decays every
  // close; these three buy it back for tomorrow. Independent toggles (not one
  // choice): chalk is the free daily habit, sampling costs cups at commit,
  // sponsoring costs till at commit and unlocks once you're known (day 3+).
  // Re-render is row-local so toggling never touches the hedge choice.
  const renderDemandRow = () => {
  const demandRow = $('brief-demand');
  if (demandRow) {
    demandRow.textContent = '';
    // Progressive disclosure: the street-work levers appear once the player
    // has a day of demand behind them. Day 1 teaches open/price/serve; the
    // lever arrives day 2 with its reason attached.
    if (day < 2) { demandRow.style.display = 'none'; return; }
    demandRow.style.display = '';
    const t = document.createElement('div');
    t.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55';
    t.textContent = `work the street — awareness ${demand.pips()}`;
    demandRow.appendChild(t);
    // first appearance gets its reason: yesterday's balked cups are the
    // problem these levers solve.
    if (day === 2 && lastDayStats) {
      const intro = document.createElement('div');
      intro.id = 'brief-demand-intro';
      intro.style.cssText = 'font-size:10.5px;opacity:.7;font-style:italic;margin:2px 0 5px';
      intro.textContent = `new lever — the street forgets overnight. Yesterday ${lastDayStats.balked} walked; this buys tomorrow’s crowd.`;
      demandRow.appendChild(intro);
    }
    const D = CAMPAIGN.demand;
    const defs = [
      { id: 'sample', label: `sample hour · ${fmt(D.sampleCost)} in cups · they taste, they return` },
      { id: 'sponsor', label: day >= D.sponsorDay
        ? `sponsor the market stall · ${fmt(D.sponsorCost)} · the whole street hears`
        : `sponsor the market stall · the stall only takes sponsors day ${D.sponsorDay}+` },
    ];
    if (day >= CAMPAIGN.days) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:10px;opacity:.55;font-style:italic';
      note.textContent = 'benefits tomorrow; this is the final day';
      demandRow.appendChild(note);
    }
    for (const def of defs) {
      const b = document.createElement('button');
      b.id = 'brief-demand-' + def.id;
      b.textContent = (demand.staged[def.id] ? '✓ ' : '') + def.label;
      b.disabled = !demand.canStage(def.id, day);
      b.setAttribute('aria-pressed', demand.staged[def.id] ? 'true' : 'false');
      if (demand.staged[def.id]) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; }
      b.onclick = () => { stageDayPlan({ marketing: { [def.id]: !planDraft.marketing[def.id] } }); renderDemandRow(); };
      demandRow.appendChild(b);
    }
  }
  };
  renderDemandRow();
  // The nut — the fixed daily bill, shown before a cup is poured. Consequence
  // made legible: wage + pitch floor + sundries, against what's in hand.
  const nutEl = $('brief-nut');
  if (nutEl) {
    nutEl.style.display = '';
    renderPlanQuote();
  }
  const risk = $('brief-risk');
  if (risk) {
    risk.style.display = '';
    const mods = modifiersForDay(day);
    const lines = [];
    if (mods.commuterDelayMinutes || mods.dwellBonus)
      lines.push(`${MACRO_SHOCKS.transit_delay.name} — ${MACRO_SHOCKS.transit_delay.desc} · new today`);
    if (mods.pitchPctDelta || mods.pitchMinDelta)
      lines.push(`${MACRO_SHOCKS.pitch_reval.name} — ${MACRO_SHOCKS.pitch_reval.desc} · ${day === MACRO_SHOCKS.pitch_reval.day ? 'new today' : 'still active'}`);
    if (mods.suppliesDelta)
      lines.push(`${MACRO_SHOCKS.dairy_crunch.name} — ${MACRO_SHOCKS.dairy_crunch.desc} · ${day === MACRO_SHOCKS.dairy_crunch.day ? 'new today' : 'still active'}`);
    if (!lines.length) lines.push('no district shock today');
    const strat = CAMPAIGN.rivalStrategies[rivalStrategy];
    lines.push(`your matcha £${priceForDay(day).toFixed(2)} · ${COPY.rivalName} — ${strat ? strat.name.toLowerCase() : rivalStrategy} at £${strat ? strat.price.toFixed(2) : '—'}`);
    risk.textContent = lines.join('\n');
    risk.style.whiteSpace = 'pre-wrap';
  }
  // Ruth — the one staffing call the week can carry. When she's fading the
  // Brief offers a choice: send her home (slow bar, saved wage, she recovers)
  // or push on (full pace now, she drains further — and below a fifth, she breaks).
  const staffRow = $('brief-staff');
  if (staffRow) {
    staffRow.textContent = '';
    baristaStaged = false;
    if (canChooseStaffing(day, baristaCondition)) {
      staffRow.style.display = '';
      const t = document.createElement('div');
      t.style.cssText = 'font-size:10.5px;opacity:.78;margin-bottom:5px;font-style:italic';
      t.textContent = baristaCondition < 0.25
        ? 'Ruth hasn’t had a day off all week — she’s dead on her feet.'
        : 'Ruth’s dragging this morning — too many shifts back to back.';
      const home = document.createElement('button'); home.id = 'brief-staff-home';
      home.textContent = `send her home · bar −30% today, ${fmt(CAMPAIGN.staffDayRate)} wage saved, fresh tomorrow`;
      const apprentice = document.createElement('button'); apprentice.id = 'brief-staff-apprentice';
      apprentice.textContent = `hire apprentice · a temp serves while Ruth recuperates off bar · ${fmt(CAMPAIGN.staff.apprenticeDayRate)} + ${fmt(CAMPAIGN.staff.apprenticeTrainingFee)} training, +${Math.round(CAMPAIGN.staff.apprenticeWasteExtra * 100)}p waste a cup`;
      const push = document.createElement('button'); push.id = 'brief-staff-push';
      push.textContent = 'push on · she’ll manage — probably';
      const sel = (mode, stage) => {
        if (stage) stageDayPlan({ staffing: mode === 'push' ? 'work' : mode });
        baristaStaged = mode;
        home.style.borderColor = mode === 'home' ? 'var(--brass)' : ''; home.style.background = mode === 'home' ? 'rgba(201,162,39,.16)' : '';
        apprentice.style.borderColor = mode === 'apprentice' ? 'var(--brass)' : ''; apprentice.style.background = mode === 'apprentice' ? 'rgba(201,162,39,.16)' : '';
        push.style.borderColor = mode === 'push' ? 'var(--brass)' : ''; push.style.background = mode === 'push' ? 'rgba(201,162,39,.16)' : '';
        home.setAttribute('aria-pressed', mode === 'home' ? 'true' : 'false');
        apprentice.setAttribute('aria-pressed', mode === 'apprentice' ? 'true' : 'false');
        push.setAttribute('aria-pressed', mode === 'push' ? 'true' : 'false');
      };
      sel(planDraft && planDraft.staffing !== 'work' ? planDraft.staffing : 'push', false);
      home.onclick = () => sel('home', true);
      apprentice.onclick = () => sel('apprentice', true);
      push.onclick = () => sel('push', true);
      staffRow.append(t, home, apprentice, push);
    } else staffRow.style.display = 'none';
  }
  // choice row: sizing is the position — header says what this means in one line
  const actions = $('brief-actions'); if (actions) {
    actions.textContent = '';
    // Progressive disclosure (stage 3 = the decision): a section label so the
    // sizing row reads as the commit it is, not more paragraphs.
    const lab = document.createElement('div');
    lab.style.fontSize = '10px'; lab.style.letterSpacing = '.18em';
    lab.style.textTransform = 'uppercase'; lab.style.opacity = '.55';
    lab.textContent = 'the morning call';
    actions.appendChild(lab);
    const hint = document.createElement('div');
    hint.id = 'brief-sel';
    hint.style.fontSize = '10.5px'; hint.style.opacity = '.6'; hint.style.marginBottom = '4px';
    hint.textContent = 'Sizing is the position — contracts lock the board for their cups, hold rides the spot, settle pays the tab.';
    actions.appendChild(hint);
    // Progressive disclosure: on a calm opening morning the contract pills
    // fold into one line — the first lesson is open/price/serve, not hedging.
    // Any threat (warn/bad/cata), an open position, or a live tab springs it
    // back open: risk reveals the tool, never hides it.
    const tier = exchange.event?.tier || 'calm';
    const threat = tier === 'warn' || tier === 'bad' || tier === 'cata';
    const foldContracts = day === 1 && !threat && !exchange.contract && !(exchange.debt > 0);
    let fold = null;
    if (foldContracts) {
      fold = document.createElement('details');
      fold.id = 'brief-hedge-details';
      const fs = document.createElement('summary');
      fs.textContent = 'insure the beans? — a contract locks the board price for its cups (optional today)';
      fs.style.cssText = 'font-size:11px;opacity:.75;cursor:pointer';
      fold.appendChild(fs);
      // a staged contract keeps the fold open so the selection stays visible
      if (planDraft && planDraft.hedge && planDraft.hedge.startsWith('contract')) fold.open = true;
    }
    for (const act of L.actions) {
      // a dead settle pill is noise — "nothing to settle" only appears once
      // a tab exists; until then the move doesn't.
      if (act.id === 'settle' && act.disabled) continue;
      const b = document.createElement('button');
      b.dataset.id = act.id;
      b.textContent = act.label + (act.explain ? '   ·  ' + act.explain : '');
      b.disabled = !!act.disabled;
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => { if (applyReply(act.id)) markBriefChoice(act.id); };
      (fold && act.id.startsWith('contract') ? fold : actions).appendChild(b);
    }
    // the live moves (hold/settle) land first; the optional insurance fold
    // sits beneath them, just above OPEN
    if (fold) actions.appendChild(fold);
  }
  briefChoice = planDraft ? planDraft.hedge : null;
  markBriefChoice(briefChoice);
  const open = $('brief-open');
  if (open) open.textContent = 'OPEN FOR DAY →';
  const rl = $('review-last');
  if (rl) rl.style.display = lastDayReceipt ? '' : 'none';
  const desklink = $('brief-desklink');
  if (desklink) {
    // Quiet days have no wire details, so the footer button is the only door
    // to the desk. On wire days the desk entry lives inside the open details
    // (built above) and the footer stays hidden — one door, not two.
    if ($('brief-wire-details')) {
      desklink.style.display = 'none';
    } else if (marketIntel) {
      desklink.style.display = '';
      desklink.textContent = billing.isSubscribed() ? '⚡ open the full wire desk' : '⚡ headlines free — open the desk for the tilt';
      desklink.onclick = () => desk.open(marketIntel);
    } else desklink.style.display = 'none';
  }
  const bm = $('brief-mail');
  if (bm) {
    bm.style.display = sync.managed && sync.managed() ? '' : 'none';
    // the letter by post — AgentMail carries the same body to a real inbox;
    // a reply of contract/hold/settle plays the same move through the webhook.
    const addr = $('letter-mail-addr'), mb = $('letter-mail-btn');
    if (addr && !addr.value) { try { addr.value = localStorage.getItem('grunds.mail') || ''; } catch {} }
    if (mb) {
      mb.disabled = false; mb.textContent = 'post it';
      mb.onclick = () => {
        const to = (addr?.value || '').trim();
        if (!to || !to.includes('@')) { fx.toast('an address first — where does the post go?', 'warn'); return; }
        mb.disabled = true; mb.textContent = 'posting…';
        const gen = runGen, dd = day;
        sync.sendPlanMail(to, planDraft ? normalizePlan(planDraft) : null, dd).then(d => {
          if (gen !== runGen || day !== dd) return;
          if (d && d.ok) {
            try { localStorage.setItem('grunds.mail', to); } catch {}
            mb.textContent = 'posted ✓';
            fx.toast(`the plan is in the post — reply to play from your inbox`, 'good');
            mailPending = true;
            mailT.arm(Date.now());   // await a reply newer than this posting
            try { analytics.track('letter_mailed', { day }); } catch {}
          } else { mb.disabled = false; mb.textContent = 'post it'; briefSyncError('Could not post the plan — try again.', true); }
        }).catch(() => { if (gen === runGen && day === dd) { mb.disabled = false; mb.textContent = 'post it'; briefSyncError('Could not post the plan — try again.', true); } });
      };
    }
  }
  drawBriefSparkline(exchange.history, exchange.beanIndex);
  // pause the floor — the Brief owns the clock until OPEN
  paused = true; if ($('pause')) $('pause').textContent = 'resume';
  modals.open('brief');
  try { analytics.track('brief_shown', { day, event: exchange.event ? exchange.event.id : null, index: exchange.beanIndex, hasWire: !!marketIntel }); } catch {}
}

function dismissBriefAndStartDay() {
  const el = $('brief'); if (!el) return;
  const r = commitDayPlan();
  Promise.resolve(r).then(res => {
    if (!res || !res.ok) return;
    briefChoice = null;
    // wire highlight fades once committed
    try { const t = $('tape'); if (t) t.style.color = ''; } catch {}
    updateHUD();
  }).catch(() => {});
}

if ($('brief-open')) $('brief-open').onclick = () => dismissBriefAndStartDay();
if ($('brief-desklink')) $('brief-desklink').onclick = () => { if (marketIntel) desk.open(marketIntel); };
if ($('brief-offline')) $('brief-offline').onclick = () => { if (sync.disableRun) sync.disableRun(); reset(); };

// ---- dawns -------------------------------------------------------------------
function prepareDay(d) {
  if (phase !== 'onboarding' && phase !== 'review') return false;
  if (d !== exchange.day + 1 || d < 1 || d > CAMPAIGN.days) return false;
  phase = 'planning';
  day = d;
  // default: hold (free) — the Brief never forces a debt, but it forces a choice
  planDraft = { day: d, hedge: 'hold', staffing: 'work', marketing: {} };
  if (d === 1) kitPendingAtOpen = !district.grown;   // the kit is an event only if it grows during play
  coached = d !== 1;   // the lever hint only coaches day 1, once per campaign
  patrons.reset(); fx.reset();
  waveIdx = 0; chapterIdx = 0; dayMin = DAY_START; acc = 0;
  till = 0; cogs = 0; balked = 0; served = 0; servedRetail = 0; defections = 0; rivalServed = 0;
  realizedHedgeSavings = 0; hedgedCups = 0; preparedCups = 0;
  marketingSpend = 0; trainingSpend = 0; sampleSpend = 0; lastOps = null;
  feeToday = 0; interestToday = 0; settleToday = 0;
  firstServed = firstWalked = firstServedToast = firstWalkedToast = 0;
  demand.staged.sample = false; demand.staged.sponsor = false;
  dayMods = modifiersForDay(d);
  dayWaves = wavesForDay(schedule.waves, d);
  patrons.dwellMul = 1 + (dayMods.dwellBonus || 0);
  rivalStrategy = strategyForDay(d, exchange.event?.tier);
  try { world.setRivalStrategy(rivalStrategy, CAMPAIGN.rivalStrategies[rivalStrategy].price.toFixed(2)); } catch {}
  prebatched = false; repriced = false; ctx.prebatched = false; ctx.repriced = false; ctx.batchUnits = 0; patrons.repriced = false;
  peakQueue = 0; waveBalked = 0; waveServed = 0; prebatchHelped = false; eveningCallShown = false; eveningFast = false; closed = false;
  baristaCrisis = false;
  if (d === 1) { forecastShown = false; nudgedQueue = nudgedBalk = nudgedPrice = false; }
  if (baristaRested) { baristaRested = false; fx.toast('Ruth’s back — rested. The bar hums.', 'good'); }
  pendingGossip = null;
  offerShown = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0;
  party = null; batchWaste = 0; batchSpend = 0; patrons.party = null; patrons.partyActive = false;
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; solicitorAt = 0;
  briefChoice = null;
  world.setMatchaPrice(priceForDay(d).toFixed(2), false);
  updateTicker();
  fx.receipt(null); fx.notebook(false);
  try { modals.close('letter'); modals.close('receipt'); } catch {}
  paused = true; if ($('pause')) $('pause').textContent = 'resume';
  updateHUD();
  if (sync.managed && sync.managed()) {
    const gen = runGen, dd = d;
    sync.preparePlan(planSnapshot(), normalizePlan(planDraft)).then(r => {
      if (gen === runGen && day === dd && phase === 'planning' && (!r || !r.ok)) briefSyncError('Could not save the plan. Retry or start a local-only week.', true);
    }).catch(() => { if (gen === runGen && day === dd && phase === 'planning') briefSyncError('Could not save the plan. Retry or start a local-only week.', true); });
  }
  // Morning Brief — the Drug Wars turn: at 06:00 the floor pauses so the
  // player reads commodity → price → choice, then commits with OPEN.
  // Headless and tutorial-driven opens skip it (they own their own clock).
  if (!headless && !tutorialActive) {
    // open the Brief on the next microtask so the DOM/HUD is painted first
    scheduleRun(() => { if (phase === 'planning') showMorningBrief(); }, 120);
  }
  return true;
}
const openDay = prepareDay;

function startTradingDay(d) {
  // the wire tilts the deck: live Linkup research multiplies event weights
  // (clamped inside roll), never replaces the seeded draw
  const intelBias = marketIntel && Array.isArray(marketIntel.marketShift)
    ? Object.fromEntries(marketIntel.marketShift.map(s => [s.eventId, s.weightMul]))
    : null;
  tapePrev = exchange.history.length ? exchange.history[exchange.history.length - 1].index : 1.0;
  // Ruth's pace at dawn — exhausted legs move slower until she's rested or sent home
  patrons.staffMul = (baristaCondition < 0.35 ? 0.8 : 1) * perkStaffMul; patrons.balkMul = 1;
  if (baristaHomeToday) patrons.staffMul = 0.7;
  else if (apprenticeHiredToday) patrons.staffMul = (CAMPAIGN.staff?.apprenticeStaffMul || 1.05) * perkStaffMul;
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

  // Dynamic rival strategy:
  patrons.rivalStrategy = rivalStrategy;
  if (d >= 2 && rivalStrategy !== 'DEFAULT' && !headless) {
    const stratDef = CAMPAIGN.rivalStrategies[rivalStrategy];
    if (stratDef) fx.toast(`${COPY.rivalName} moves: ${stratDef.name} (£${stratDef.price.toFixed(2)})`, 'warn');
  }
  if (estherCard) { till -= 2; fx.toast('esther’s stamp card: −£2', ''); }  // her cup's on the house
  world.setMail(false);
  mailT.disarm();                 // the wait for a reply never crosses into a live floor
  mailPending = false;
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
  // Managed runs mirror through sync.finishDay at close; unmanaged/local runs
  // never write — the leaderboard is still refreshed read-only.
  refreshStands();
  fx.toast('DAY ' + day + '/' + CAMPAIGN.days + ' — ' + (ev.head || 'a new day'), ev.tier === 'cata' ? 'bad' : ev.tier === 'good' ? 'good' : '');
  fx.card('DAY ' + day, ev.line || (ev.head || 'the district stirs'));
  try { world._onCatMeow = () => { try { audio.meow(); } catch {} }; } catch {}
  // gesha persists: Gwen's request lingers as a brass forecast stripe next day
  if (exchange.geshaUnlocked && day > 1) {
    fx.toast('Gwen\'s still asking about the gesha — GRUNDS unlocked', 'warn');
  }
  vitality.recompute();   // dawn re-skins the block with the fresh numbers
  phase = 'trading';
  closed = false;
  paused = false; if ($('pause')) $('pause').textContent = 'pause';
  updateHUD();
}

function updateTicker() {
  // The day's matcha price is set by applyDrift() at dawn. ECON.matchaFull
  // stays the static 4.80 baseline; the live `matchaPrice` reads from the
  // gentrification curve.
  const tillPrice = phase === 'planning' ? priceForDay(day) : salePrice(exchange, repriced);
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

function campaignClose(insolvent = false) {
  if (campaignDone || phase !== 'review') return;
  if (!insolvent && (day < CAMPAIGN.days || exchange.day < CAMPAIGN.days)) return;
  closed = true;
  campaignDone = true;
  phase = 'finale';
  if ($('review-continue')) $('review-continue').style.display = 'none';
  if ($('review-letter')) $('review-letter').style.display = 'none';
  if ($('receipt-back')) $('receipt-back').style.display = 'none';
  audio.closing();
  const net = cRev - cCost - cOps - settledPaid - exchange.debt;   // the week, after the whole cost sheet
  const rep = regulars.reputation;
  const v = VERDICTS[campaignVerdict(net, rep)];
  const lines = [
    [standName, playerName + ' — ' + playerRole],
    [`revenue (${Math.min(day, CAMPAIGN.days)} days)`, fmt(cRev)], ['bean cost', fmt(cCost)], ['operating costs', fmt(cOps)],
    ['final debt', fmt(exchange.debt)], ['—', '—'],
    ['cups poured', cServed], ['walked to ' + COPY.rivalName, cDef], ['—', '—'],
    ['NET WORTH', fmt(net)],
  ];
  // Finale: the street turns over on camera before the verdict lands. The
  // camera visits the sold storefronts, the card names it, then the receipt.
  rig.focus(world.focus.newbuild, 17, 7, Math.PI);
  fx.card('SOLD', 'a new tenant opens across the road');
  fx.toast('opening soon — for or against you, that\'s the question', 'warn');
  scheduleRun(() => {
    fx.receipt({ lines, verdict: v });
    refreshStands();
    if ($('again')) { $('again').style.display = ''; $('again').textContent = '↺ run another week'; }
    // Challenge link: the week was a seed — share it so a friend plays the
    // same market, same waves, same regulars.
    // Challenge link: the week was a seed — share it so a friend plays the
    // same market, same waves, same regulars. The seed is also the street:
    // the Generative District kit is keyed by it, so the link gifts the world.
    const rs = $('r-seed');
    if (rs) {
      rs.style.display = '';
      rs.textContent = 'district seed ' + SEED + ' — ';
      const a = document.createElement('a');
      a.href = '?seed=' + SEED;
      a.textContent = 'this street, for a friend ↗';
      rs.appendChild(a);
    }
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
           : ' · ' + rows.length + ' stands racing',
      ' · seed ' + SEED);
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
  // Morning prep is one press. During the rush the button opens again
  // once the cups run down to 8, so topping up is a second decision.
  // Prep and the price cut lock each other out for the day.
  $('prebatch').disabled = dayMin >= 960 || closed || repriced || (prebatched && ctx.batchUnits > (dayMin >= 840 ? 8 : 0));
  $('reprice').disabled = repriced || closed || prebatched || ctx.batchUnits > 0;
  // queue health bar: under 5 = ok → 5–10 = warm → 10+ = hot
  const qq = patrons.queueLength;
  const qHeat = qq > 10 ? 'hot' : qq > 5 ? 'warm' : 'ok';
  const qPct = Math.min(100, Math.round(qq / 5 * 100));
  if ($('queuefill')) {
    $('queuefill').style.width = qPct + '%';
    const hb = qq > 10 ? ' hot heartbeat' : qq <= 5 ? ' ok purr' : '';
    $('queuefill').className = qHeat + hb;
  }
  if ($('qlabel')) $('qlabel').textContent = `${qq} in line — ` + (qq > 5 ? 'they’ll walk' : 'holding');
  try { world.setPlantHealth(qq); audio.purr(qq <= 5 && patrons.count > 2); } catch {}
  // the tape: the bean board as a visible object — yesterday's close →
  // today, the event that moved it, click-through to the wire
  if ($('tape')) {
    if (started && day >= 2) {
      const pct = Math.round((exchange.beanIndex - tapePrev) * 100);
      $('tape').style.display = '';
      $('tape').innerHTML = `beans <b>${exchange.beanIndex.toFixed(2)}</b> ${pct > 0 ? '↑' : pct < 0 ? '↓' : '→'}` +
        (exchange.event ? ` · <span class="dim">${String(exchange.event.head).toLowerCase()}</span>` : '') +
        ` · <span class="dim" title="street awareness — work it at dawn">street ${demand.pips()}</span>` +
        (marketIntel ? ' <span class="dim">· wire ↗</span>' : '');
    } else $('tape').style.display = 'none';
  }
  // batch countdown: big number when batched, — otherwise
  if ($('batchcount')) {
    const bc = ctx.batchUnits > 0 ? String(ctx.batchUnits) : (dayMin >= 840 ? '0' : 'none');
    const el = $('batchcount');
    if (el.textContent !== bc) {
      el.textContent = bc;
      if (ctx.prebatched) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    } else if (!ctx.batchUnits) { el.textContent = dayMin >= 840 ? '0' : 'none'; }
    el.classList.toggle('low', dayMin >= 840 && dayMin < 1020 && ctx.batchUnits <= 8);
    if ($('batchword')) $('batchword').textContent = dayMin >= 840 && dayMin < 1020 ? 'cups left' : 'cups ready';
  }
  // lever attention: pulse until first use on day 1
  const cutSmall = $('reprice') && $('reprice').querySelector('small');
  if (cutSmall) {
    if (prebatched || ctx.batchUnits > 0) cutSmall.textContent = 'locked — you bought the cups';
    else if (repriced) cutSmall.textContent = `matcha is ${fmt(ECON.matchaDeal)} today`;
    else {
      const board = salePrice(exchange, false);
      cutSmall.textContent = `down from £${board.toFixed(2)} · locks prep for today`;
    }
  }
  const pb = $('prebatch');
  if (pb && pb.querySelector) {
    const inWave = dayMin >= 840 && dayMin < 960;
    const nodes = pb.childNodes || [];
    const label = nodes[0];
    if (label && label.nodeType === 3) label.textContent = (inWave ? `Top up ${ECON.batchUnits} cups ` : `Buy ${ECON.batchUnits} cups `);
    const sub = pb.querySelector('small');
    if (sub) {
      if (repriced) sub.textContent = 'locked — you cut the price';
      else if (inWave) sub.textContent = `pay ${fmt(ECON.batchCost)} · leftovers spoil at close`;
      else sub.textContent = `pay ${fmt(ECON.batchCost)} · fast bar · leftovers spoil`;
    }
  }
  const waveLow = dayMin >= 840 && dayMin < 960 && ctx.batchUnits <= 8 && !repriced;
  if (day === 1 && dayMin < 840 && !prebatched && !repriced) {
    if (!prebatched) $('prebatch').classList.add('attention'); else $('prebatch').classList.remove('attention');
    if (!repriced) $('reprice').classList.add('attention'); else $('reprice').classList.remove('attention');
  } else if (!waveLow) {
    $('prebatch').classList.remove('attention');
    $('reprice').classList.remove('attention');
  }
  if (waveLow && $('prebatch') && !$('prebatch').disabled) $('prebatch').classList.add('attention');
  // goal strip: swap from instruction to live status once the player acts
  if ($('goal')) {
    const na = currentAction();
    let html = na.id === 'mail' ? `📬 ${na.text}` : na.text;
    if (party && !party.declined && dayMin >= 840 && dayMin < 1020) {
      html = `<b>${party.name}</b> · ${party.served} stayed · ${party.walked} walked`;
    }
    $('goal').innerHTML = html;
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
  if ($('daytag')) $('daytag').textContent = 'DAY ' + day + '/' + CAMPAIGN.days + '  ·  regulars ' + regulars.reputation;
  $('till').textContent = fmt(till);
  $('balk').textContent = balked;
  if ($('poured')) $('poured').textContent = String(served + servedRetail);
  if (defections) {
    $('status').hidden = false;
    $('status').innerHTML = `<b class="hot">${defections}</b> crossed to ${COPY.rivalName}`;
  } else {
    $('status').hidden = true;
    $('status').textContent = '';
  }
  // pressure dial: the gentrification drift. beanIndex creep since the
  // start of the campaign (1.00 → drift.maxIndex), and the day's matcha
  // till price. Always visible — even day 1, so the player can see the
  // clock at 0% and feel the clock ticking.
  if ($('pressure')) {
    const driftPct = Math.round((exchange.beanIndex - 1.0) * 100);
    const driftTxt = (driftPct >= 0 ? '+' : '') + driftPct + '%';
    const dayPrice = salePrice(exchange, repriced);
    const costBit = day >= 2 ? `costs <b>${driftTxt}</b> · ` : '';
    $('pressure').innerHTML = `${costBit}matcha <b>£${dayPrice.toFixed(2)}</b>` +
      (exchange.debt > 0 ? ` · tab <b>${fmt(exchange.debt)}</b>/${fmt(CAMPAIGN.creditLimit)}` : '');
  }
  if (!closed) updateTicker();
}

// ---- levers ----------------------------------------------------------------------
function doPrebatch() {
  if (closed || phase !== 'trading' || dayMin >= 960) return;
  if (repriced) { fx.toast('you cut the price — prep is locked for today', 'warn'); return; }
  const cap = dayMin >= 840 ? 8 : 0;
  if (prebatched && ctx.batchUnits > cap) return;          // morning is one prep; the rush reopens under 8 cups
  markIntent();
  const topUp = prebatched || ctx.batchUnits > 0;
  const queueBefore = patrons.queueLength;
  const priceBefore = repriced ? ECON.matchaDeal : (exchange.matchaPrice ?? priceForDay(day));
  prebatched = true; ctx.prebatched = true;
  ctx.batchUnits = topUp ? ctx.batchUnits + ECON.batchUnits : ECON.batchUnits;
  till -= ECON.batchCost; batchSpend += ECON.batchCost;
  fx.notebook(false);
  fx.toast(topUp
    ? `topped up — ${ECON.batchUnits} more cups (−${fmt(ECON.batchCost)}; leftovers spoil)`
    : `${ECON.batchUnits} cups bought (−${fmt(ECON.batchCost)}) — fast bar, full price; leftovers spoil`, 'good');
  audio.clink();
  world.setMatchaPrice(exchange.matchaPrice ? exchange.matchaPrice.toFixed(2) : '4.80', repriced);
  world.flashChalk('batch');
  try { audio.clink(); } catch {}
  if (queueBefore > 3) {
    const estAfter = Math.max(0, Math.round(queueBefore * 0.52));
    fx.toast(`${queueBefore} in line → about ${estAfter} once the cups are ready`, 'good');
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
  if (repriced || closed || phase !== 'trading') return;
  if (prebatched || ctx.batchUnits > 0) { fx.toast('you prepped the cups — the price stays on the board', 'warn'); return; }
  markIntent();
  const queueBefore = patrons.queueLength;
  repriced = true; ctx.repriced = true; patrons.repriced = true;
  world.setMatchaPrice(ECON.matchaDeal.toFixed(2), true);
  world.flashChalk('reprice');
  try { fx.chalkDust(-5.5, 2.75, -7.95); audio.chalkScreech(); } catch {}
  fx.toast(`matcha is ${fmt(ECON.matchaDeal)} for the rest of today — prep is locked`, 'good');
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
    effect: 'say yes → the wave runs ~20% bigger — and Pip’s group is counted on the evening card', yes: 'say yes',
    accept() { offerWaveMul = 1.22; party = { name: 'Pip', cohort: 'students', left: 20, served: 0, walked: 0 }; },
    decline() { party = { name: 'Pip', cohort: 'students', left: 0, served: 0, walked: 0, declined: true }; } },
  { who: 'Esther', line: '“A stamp card for the week — £15 today, and my cup’s on the house from tomorrow.”',
    effect: 'say yes → +£15 now · her cup’s free at every dawn after', yes: 'take the £15',
    accept() { till += 15; estherCard = true; } },
  { who: 'Olu',    line: '“Bridge club wants the corner at half twelve. We nurse our cups — but we pay up front.”',
    effect: 'say yes → +£9 at 12:30 · four elders in your line, counted on the evening card', yes: 'book them in',
    accept() { oluPayoutAt = 750; party = { name: 'Olu', cohort: 'elders', left: 4, served: 0, walked: 0 }; } },
  { who: 'Gwen',   line: '“My matcha plug can do twenty units for £6.40 — today only, cash.”',
    effect: 'say yes → −£6.40 · 20 cups warming now (locks the price cut)', yes: 'take the units',
    accept() { till -= 6.4; batchSpend += 6.4; ctx.batchUnits += 20; ctx.prebatched = true; prebatched = true; } },
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
    if (baristaHomeToday || apprenticeHiredToday) o = INCIDENTS[(idx + 1) % INCIDENTS.length];
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
  modals.open('offer');
}

function resolveOffer(said) {
  const o = activeBeat;
  if (!o || phase !== 'trading' || modals.top() !== 'offer') return;
  const wasIncident = $('offer').classList.contains('incident');
  modals.close('offer'); $('offer').classList.remove('incident');
  if (!offerWasPaused) { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
  if (said) { o.accept(); fx.toast(o.who + ': ' + o.yes, 'good'); }
  else { if (o.decline) o.decline(); fx.toast(wasIncident ? o.who + ' — you take the hit as it comes' : o.who + ' shrugs — maybe tomorrow', wasIncident ? 'warn' : ''); }
  try { analytics.track(said ? (wasIncident ? 'incident_paid' : 'offer_accepted') : (wasIncident ? 'incident_risked' : 'offer_declined'), { day, who: o.who }); } catch {}
  activeBeat = null;
}
$('offer-yes').onclick = () => resolveOffer(true);
$('offer-no').onclick = () => resolveOffer(false);
if ($('evening-topup')) $('evening-topup').onclick = () => resolveEvening('topup');
if ($('evening-hold')) $('evening-hold').onclick = () => resolveEvening('hold');
if ($('evening-close')) $('evening-close').onclick = () => resolveEvening('close');
$('tape').onclick = () => { if (marketIntel) desk.open(marketIntel); };

function reset() {
  // full campaign restart: the market and the regulars rewind to their start state
  const wasFinale = campaignDone;   // restarting from the verdict gets a send-off
  runGen++;
  exchange.rng = seeded(SEED);
  exchange.beanIndex = 1.0; exchange.day = 0; exchange.contract = null; exchange.debt = 0; exchange.event = null; exchange.history = []; exchange.matchaPrice = undefined;
  exchange.lastTier = null; exchange.lastEventId = null;
  tapePrev = 1.0; offerShown = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0; estherCard = false;
  party = null; batchWaste = 0; batchSpend = 0;
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; contractFeeExtra = 0; solicitorAt = 0; cOps = 0;
  briefChoice = null; lastDayStats = null; planDraft = null; lastDayReceipt = null;
  realizedHedgeSavings = 0; hedgedCups = 0;
  phase = 'onboarding';
  demand.reset(); marketingSpend = 0;
  baristaCondition = 1.0; baristaHomeToday = false; baristaRested = false; baristaStaged = false; baristaCrisis = false;
  apprenticeHiredToday = false; rivalStrategy = 'DEFAULT';
  try { modals.closeAll(); } catch {}
  deskHeldPause = false;
  mailPending = false;
  try { mailT.disarm(); } catch {}
  briefSyncError('');
  { const ob = $('brief-open'), mb = $('letter-mail-btn'); if (ob) ob.disabled = false; if (mb) mb.disabled = false; }
  if (sync.abandonRun) { sync.abandonRun(); if (sync.live && !sync.runDisabled) sync.beginRun(SEED).catch(() => {}); }
  for (const r of regulars.regulars) { r.op = perkBg === 'newcomer' ? 0.25 : 0.15; r.seen = false; r.served = 0; r.balked = 0; }
  cRev = cCost = cBalked = cServed = cDef = settledPaid = 0; campaignDone = false; paused = false;
  firstServed = firstWalked = firstServedToast = firstWalkedToast = 0;
  if ($('pause')) $('pause').textContent = 'pause';
  prepareDay(1);
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
  if (!started || closed || campaignDone || phase !== 'trading') return paused;
  markIntent();
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
if ($('review-continue')) $('review-continue').onclick = () => continueFromReview();
if ($('review-letter')) $('review-letter').onclick = () => { if (phase === 'review') showLetter(); };
if ($('letter-close')) $('letter-close').onclick = () => {
  modals.close('letter');
  if (phase === 'review' && lastDayReceipt) modals.open('receipt');
};
if ($('review-last')) $('review-last').onclick = () => {
  if (!lastDayReceipt || phase !== 'planning') return;
  modals.close('brief');
  fx.receipt(lastDayReceipt);
  if ($('receipt-back')) $('receipt-back').style.display = '';
  if ($('review-continue')) $('review-continue').style.display = 'none';
  if ($('review-letter')) $('review-letter').style.display = 'none';
};
if ($('receipt-back')) $('receipt-back').onclick = () => {
  modals.close('receipt');
  $('receipt-back').style.display = 'none';
  if (phase === 'planning' && !headless && !tutorialActive) modals.open('brief');
};
$('mute').onclick = () => { $('mute').textContent = audio.toggleMute() ? 'sound off' : 'sound on'; };
$('wirebtn').onclick = () => desk.open(marketIntel);
$('camreset').onclick = () => rig.resetView();
if ($('photoBtn')) $('photoBtn').onclick = () => { try { doPhoto(); } catch {} };
const defaultSpeedBtn = headless ? '300' : '60';
document.querySelectorAll('#speeds button').forEach(b => {
  if (b.dataset.s === defaultSpeedBtn) b.classList.add('on');
  b.onclick = () => {
    const want = +b.dataset.s;
    // 20× skips the cup countdown — keep it out of the rush (headless exempt).
    if (!headless && want >= 1200 && dayMin >= 840 && dayMin < 1020 && phase === 'trading') {
      fx.toast('20× waits until the evening call', 'warn');
      return;
    }
    speed = want;
    document.querySelectorAll('#speeds button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  };
});
addEventListener('keydown', e => {
  if (modals.top() === 'evening') {
    const pick = { '1': 'topup', '2': 'hold', '3': 'close' }[e.key];
    if (pick) { e.preventDefault(); resolveEvening(pick); return; }
  }
  if (modals.handleKey(e)) return;
  // typing belongs to the field — never let an email fire game keys
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  markIntent();   // any game key is intent: the idle halo retires
  if (e.key === '1') doPrebatch();
  else if (e.key === '2') doReprice();
  else if (e.key === ' ' && started && !closed) { e.preventDefault(); togglePause(); }
  else if (e.key === 'r' || e.key === 'R') reset();
  else if (e.key === 'm' || e.key === 'M') $('mute').click();
  else if (e.key === 'c' || e.key === 'C') rig.resetView();
  else if (e.key === 'p' || e.key === 'P') { try { doPhoto(); } catch {} }
});
// photo mode: freeze at golden hour, print a stamped share card, act on it
function doPhoto() {
  if (phase !== 'trading') return;
  try { audio.shutter(); } catch {}
  const wasPaused = paused; paused = true; if ($('pause')) $('pause').textContent = 'resume';
  const photoMin = Math.max(dayMin, 1080);
  try { world.updateTimeOfDay(photoMin); } catch {}
  try { document.body.classList.add('photo'); } catch {}
  fx.toast('📷 photo — golden hour', 'good');
  const badge = calculateCampaignBadge({
    netWorth: cRev - cCost - cOps - settledPaid - exchange.debt,
    reputation: regulars.reputation, served: served + servedRetail, balked, debt: exchange.debt,
  });
  const shareData = {
    day: day + 1, till, reputation: regulars.reputation, seed: SEED,
    verdict: '', badge, balked, served: served + servedRetail,
  };
  let cardUrl = null;
  try {
    postfx.render(performance.now());   // the print matches the eye: bloom + vignette included
    const src = renderer.domElement;
    const snap = document.createElement('canvas'); snap.width = 1208; snap.height = 562;
    snap.getContext('2d').drawImage(src, 0, 0, snap.width, snap.height);
    const card = document.createElement('canvas'); card.width = CARD_W; card.height = CARD_H;
    buildShareCard(card.getContext('2d'), {
      snapshot: snap, badge, seed: SEED, day: day + 1,
      stats: { till, rep: regulars.reputation, served: served + servedRetail, balked },
    });
    cardUrl = card.toDataURL('image/png');
  } catch { /* a dead card never eats the moment — the row still shows the caption path */ }
  let caption = '';
  try { caption = formatShareText(shareData); } catch { caption = `Grunds — The District · day ${day + 1} · seed ${SEED}`; }
  // the dim holds until an action lands — or 6 s of admire
  const row = $('photo-actions');
  let ended = false;
  const finish = () => {
    if (ended) return; ended = true;
    if (row) row.classList.remove('show');
    try { document.body.classList.remove('photo'); } catch {}
    if (!wasPaused && !closed && phase === 'trading') { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
  };
  const act = (id, fn) => {
    const b = $(id);
    if (b) b.onclick = () => { Promise.resolve().then(fn).catch(() => {}).then(() => setTimeout(finish, 250)); };
  };
  act('pc-save', () => {
    if (!cardUrl) return;
    const a = document.createElement('a');
    a.href = cardUrl; a.download = `grunds-day${day + 1}-seed${SEED}.png`; a.click();
  });
  act('pc-share', async () => {
    if (cardUrl && typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const blob = await (await fetch(cardUrl)).blob();
        const file = new File([blob], `grunds-day${day + 1}-seed${SEED}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text: caption, files: [file] });   // the card rides along
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;   // player closed the sheet — that's an answer
      }
    }
    openShareToX(shareData);   // no files? the X intent carries the text
  });
  act('pc-copy', async () => {
    try { await navigator.clipboard.writeText(caption); fx.toast('caption copied', 'good'); } catch {}
  });
  if (row) row.classList.add('show'); else setTimeout(finish, 900);
  setTimeout(finish, 6000);
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
  modals.open('licence');
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
  modals.close('licence');
  try { analytics.track('licence_signed', { role: playerRole, bg: perkBg, defaults: playerName === 'Sam' && standName === 'THE CORNER CUP' }); } catch {}
  fx.toast('licence signed — ' + standName + ' opens Monday', 'good');
  if (wantTutorial) openTutorial();
  else { started = true; audio.start(); openDay(1); rig.crane(); }
}
if ($('lic-sign')) $('lic-sign').onclick = signLicence;

// ---- tutorial: 3 steps, then the floor runs. Headless + ?skipTutorial bypass it.
const TUT_STEPS = [
  { k: 'BEFORE YOU OPEN', t: 'THE LINE', b: `Students arrive at <b>14:00</b> for matcha. Made to order, each cup takes <b>4 minutes</b>. Buy ${ECON.batchUnits} cups for <b>${fmt(ECON.batchCost)}</b> (leftovers spoil) or cut the price to <b>${fmt(ECON.matchaDeal)}</b> — pick one. They walk once the line passes <b>5</b>.` },
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
  modals.open('tutorial');
}
function closeTutorial() {
  tutorialActive = false;
  modals.close('tutorial');
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
  fx.card('DAY 1', 'keep the line under 5 — 1 buys cups or 2 cuts the price');
  // The Brief owns day 1 too: once the crane settles, Brief pauses at 06:00.
  // (openDay() already queued showMorningBrief; this just unblocks the re-arm.)
  scheduleRun(() => {
    // if the Brief is still open when the crane settles, it owns the pause —
    // unpausing here would run the floor behind the modal
    if (phase !== 'trading') return;
    if (modals.top()) return;
    paused = false; if ($('pause')) $('pause').textContent = 'pause';
  }, 3400);
}
$('tnext').onclick = () => {
  if (tutStep < TUT_STEPS.length - 1) showTutStep(tutStep + 1);
  else dismissTutorialAndStart(false);
};
$('tskip').onclick = () => dismissTutorialAndStart(true);
$('tclose').onclick = () => dismissTutorialAndStart(true);

$('open').onclick = () => {
  if (!schedule) return;
  modals.close('title');
  $('title').classList.add('gone');
  setTimeout(() => { try { if ($('title')) $('title').remove(); } catch {} }, 1400);
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
  if (started && !closed && !paused && !tutorialActive && schedule && phase === 'trading') {
    acc += dt * 1000;
    const msPerMin = 300 / (speed / 60);
    while (acc > msPerMin && phase === 'trading' && !paused && !closed) { acc -= msPerMin; tick(); }
    // After the evening call the rest of the day resolves in a short burst
    // instead of another stretch of watching.
    if (eveningFast) {
      let burst = 10;
      while (burst-- && phase === 'trading' && !paused && !closed) tick();
    }
  }
  vitality.tick();
  world.updateTimeOfDay(dayMin);
  sky.update(dayMin, null, vitality.current);
  director.update({ dt, now, dayMin, night: world.night || 0, vitality: vitality.current });
  kitBeat.update(dt, now);
  mailT.update(dt, now);
  postfx.setNight((world.night || 0) > 0.35 || dayMin < 420 || dayMin > 1180);
  patrons.update(dt, WALK_MUL[speed] || 2, now);
  world.updateRival(dt, now);
  try { world.updateCat(dt, patrons.queueLength); world._updateDelight(now, dt); } catch {}
  fx.steamFrom(dt);
  fx.update(dt, camera, now);
  rig.update(dt, now);
  // idle guidance: after 4.5s of no intent, point at the nextAction target
  if (halo) {
    let show = false;
    const lastIntent = Math.max(rig.lastUser || 0, _lastIntentAt || 0);
    const modalsOpen = !!modals.top();
    if (shouldHalo({ started, closed, paused, photo: document.body.classList.contains('photo'), modalsOpen, headless, busy: kitBeat.isActive, idleMs: now - lastIntent })) {
      const spot = HALO_SPOTS[currentAction().target];
      if (spot) { halo.showAt(spot, now); show = true; }
    }
    if (!show) halo.hide();
    halo.update(dt, now, { reduced: reducedMotion });
  }
  audio.setCrowd(patrons.count);
  audio.setRush(patrons.queueLength > 8);
  audio.setMood(vitality.current);
  audio.update(dt);
  if (!headless) postfx.render(now);   // headless harness skips GL
}
  window.__grunds = {
  stats: () => ({ day, dayMin, till, cogs, balked, served, servedRetail, defections, rivalServed, peakQueue, waveBalked, waveServed, net: till - cogs - exchange.debt, queue: patrons.queueLength, count: patrons.count, phase, hedgedCups, hedgeSavings: realizedHedgeSavings, batchUnits: ctx.batchUnits, batchSpend, batchWaste,
    index: exchange.beanIndex, cost: exchange.costPerCup, debt: exchange.debt, settledPaid, campaignDone, netWorth: cRev - cCost - cOps - settledPaid - exchange.debt, rep: regulars.reputation, vitality: Math.round(vitality.current * 100) / 100, event: exchange.event ? exchange.event.id : null, contract: exchange.contract ? exchange.contract.price : null,
    staffCondition: baristaCondition, staffing: planDraft ? planDraft.staffing : 'work', rivalChoices: patrons.rivalChoices, preparedCups, baristaCrisis,
    trainingSpend, sampleSpend, feeToday, interestToday, settleToday, marketingSpend,
    awareness: demand ? demand.awareness : 0, ops: lastOps, demand }),
  states: () => patrons.patrons.reduce((m, p) => ((m[p.state] = (m[p.state] || 0) + 1), m), {}),
  exc: exchange, reg: regulars, sync, world, rig, analytics,
  vitality, director, district, kitBeat, mailT,
  openDay, applyReply, reset, togglePause, resolveEvening,
  prepareDay, stageDayPlan, commitDayPlan, continueFromReview,
  patrons, modals,
  renderBrief() { if (phase === 'planning') showMorningBrief(); },
  get phase() { return phase; },
  get plan() { return planDraft ? { ...planDraft, marketing: { ...demand.staged } } : null; },
  get lastDayReceipt() { return lastDayReceipt; },
  get quote() {
    return planDraft ? quoteDayPlan({
      day, hedge: planDraft.hedge, staffing: planDraft.staffing, marketing: planDraft.marketing,
      debt: exchange.debt, extraFee: contractFeeExtra, perkCostMul, modifiers: modifiersForDay(day),
    }) : null;
  },
  get paused() { return paused; },
  ...(headless ? { testState: ({ baristaCondition: c } = {}) => { if (typeof c === 'number') baristaCondition = c; } } : {}),
};
// Playtest helper — paste __grunds.analytics.summary() after Day 1 in console
try { window.__grunds.analytics = analytics; } catch {}

function paintStaticCopy() {
  // Keep HTML placeholders in sync with ECON so £40 / £4.20 never drift again.
  const nb = $('notebook-body') || document.querySelector('#notebook p');
  if (nb) nb.textContent = COPY.notebook;
  const tbody = $('tbody');
  if (tbody && TUT_STEPS[0]) tbody.innerHTML = TUT_STEPS[0].b;
  const pb = $('prebatch');
  if (pb) {
    const nodes = pb.childNodes || [];
    if (nodes[0] && nodes[0].nodeType === 3) nodes[0].textContent = `Buy ${ECON.batchUnits} cups `;
    const sub = pb.querySelector && pb.querySelector('small');
    if (sub) sub.textContent = `pay ${fmt(ECON.batchCost)} · fast bar · leftovers spoil`;
  }
  const rp = $('reprice');
  if (rp) {
    const nodes = rp.childNodes || [];
    if (nodes[0] && nodes[0].nodeType === 3) nodes[0].textContent = `Sell matcha at ${fmt(ECON.matchaDeal)} `;
    const sub = rp.querySelector && rp.querySelector('small');
    if (sub) sub.textContent = 'down from the board price · locks prep';
  }
  const top = $('evening-topup');
  if (top) {
    const nodes = top.childNodes || [];
    if (nodes[0] && nodes[0].nodeType === 3) nodes[0].textContent = 'Top up for the evening ';
    const sub = top.querySelector && top.querySelector('small');
    if (sub) sub.textContent = `−${fmt(ECON.batchCost)} · ${ECON.batchUnits} cups · leftovers spoil again`;
  }
}

updateHUD();
try { paintStaticCopy(); } catch {}
try { modals.open('title'); } catch {}
requestAnimationFrame(loop);

