// Grunds — The District. Main loop: the three nested clocks meet the floor.
//   THE GAMBLE (days)    — the Exchange: a pity-timer event deck + the bean market
//   THE READ (hours)    — the wave schedule + the Roaster's Notebook
//   THE SCRAMBLE (sec)  — the queue: pre-batch, reprice, or lose them to GLASSHOUSE
import * as THREE from '../vendor/three.module.js';
import { ECON, CHAPTERS, COPY, LAYOUT, CAMPAIGN, VERDICTS } from './config.js';
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

const urlParams = new URLSearchParams(location.search);
const lite = urlParams.has('lite');
const headless = typeof window !== 'undefined' && !!window.__headless;
const urlSpeed = +urlParams.get('speed');
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
if (sync.live && sync.intel) sync.intel().then(r => { marketIntel = r; });

const fx = new FX(scene, null, lite);   // patrons wired in just below
const patrons = new PatronSystem(scene, world, regulars, exchange, fx);
fx.patrons = patrons;
const analytics = createAnalytics();
// expose playtest script on boot — QA can copy/paste from console
try { console.log(analytics.playtestScript()); } catch {}

// ---- game state ---------------------------------------------------------------
const DAY_START = 360, DAY_END = 1260;
let schedule = null, waveIdx = 0, chapterIdx = 0;
let day = 0, dayMin = DAY_START, speed = [60, 300, 1200].includes(urlSpeed) ? urlSpeed : 60, started = false, closed = false, paused = false;
// calm-open state: first 12 sim-min are thinned + tutorial gates the clock
let tutorialActive = false, tutStep = 0;
let batchPulseUntil = 0;
const wantTutorial = !headless && !urlParams.has('skipTutorial') && !urlParams.has('notutorial');
let till = 0, cogs = 0, balked = 0, served = 0, servedRetail = 0, defections = 0, rivalServed = 0;
let prebatched = false, repriced = false, batchUnits = 0;
let peakQueue = 0, waveBalked = 0, waveServed = 0, prebatchHelped = false;
let coached = false;   // day-1 lever hint, once per campaign
let waveDebriefShown = false;  // 14:00 wave payoff card, once per day
let forecastShown = false;     // day-2 forecast tease, once per campaign (day 1 evening)
// campaign accumulators (persist across the 5 days)
let cRev = 0, cCost = 0, cBalked = 0, cServed = 0, cDef = 0, settledPaid = 0, campaignDone = false;
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
    const mul = (exchange.event?.demand || 1) * regulars.footfallMul * morningCalm * settleThin;
    for (const s of w.spawns) {
      const n = Math.max(1, Math.round(s.q * ECON.spawnScale * mul));
      for (let i = 0; i < n; i++) patrons.spawn(s.c, s.z, speed > 60);
    }
  }
  // run the floor
  const events = patrons.tick(dayMin, ctx);
  let sales = 0, balks = 0;
  for (const e of events) {
    if (e.type === 'served') {
      till += e.price; cogs += exchange.costPerCup; sales++;
      if (e.viaRegister) servedRetail++; else served++;
      if (dayMin >= 840 && dayMin <= 1020) waveServed++;
      audio.clink();
    } else if (e.type === 'balked') {
      balked++; balks++;
      if (dayMin >= 840 && dayMin <= 1020) { waveBalked++; if (prebatched) prebatchHelped = false; }
      audio.balk();
      fx.huff(e.p.pos.x, 1.5, e.p.pos.z);
      // analytics: every balk is a teaching moment — day-1 balks are the signal
      try {
        const payload = { day, dayMin, queue: patrons.queueLength, wave: dayMin >= 840 && dayMin <= 1020 ? 1 : 0 };
        analytics.track(day === 1 ? 'day1_balk' : 'balk', payload);
      } catch {}

      // gossip is throttled early: settled openings are unreadable when everyone talks
      const calmWindow = day === 1 && dayMin < CALM_UNTIL_MIN;
      const gossipChance = calmWindow ? 0.10 : (speed >= 1200 ? 0.14 : 0.35);
      if (Math.random() < gossipChance) fx.bubble(e.p, COPY.gossipBad[(Math.random() * COPY.gossipBad.length) | 0], 'bad');
    } else if (e.type === 'defect') {
      defections++;
      if (defections === 1) fx.toast('they’re crossing the road to ' + COPY.rivalName + '…', 'bad');
      if (defections === 1 && speed <= 300) rig.queueFocus(world.focus.rival, 13, 4, 12, Math.PI);   // swing road-side: show the enemy scoring, once the camera is free
      if (defections === 12) fx.toast(COPY.rivalName + '’s line is out the door.', 'bad');
    } else if (e.type === 'rivalServed') { rivalServed++; fx.coinBurst(LAYOUT.rival.x, 1.7, 15.2, 3); }
  }
  if (sales) {
    audio.sale(sales);
    fx.coinBurst(LAYOUT.register.x, 1.5, -5.2, Math.min(10, 3 + sales));
    $('till').classList.add('pulse'); setTimeout(() => $('till').classList.remove('pulse'), 300);
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
}

function closeDay() {
  if (closed) return;
  closed = true;
  audio.closing();
  if ($('again')) $('again').style.display = 'none';   // mid-campaign: the letter drives the next day, not this button
  if ($('shareWeek')) $('shareWeek').style.display = 'none';
  cRev += till; cCost += cogs; cBalked += balked; cServed += served + servedRetail; cDef += defections;
  const net = till - cogs;                   // today's operating profit — debt is a *campaign* figure below
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
  fx.receipt({
    lines: [
      ['revenue', fmt(till)], ['bean cost', fmt(cogs)], ['debt', fmt(exchange.debt)],
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
}

function applyReply(id) {
  if (day >= CAMPAIGN.days) { campaignClose(); return; }   // the roaster's last letter is the verdict
  let msg = '';
  if (id === 'contract') { const r = exchange.contractBeans(); msg = r.ok ? 'CONTRACTED at ' + exchange.beanIndex.toFixed(2) + ' — cost locked' : r.why; }
  else if (id === 'hold') msg = 'HOLDING — you ride the spot price';
  else if (id === 'settle') { const r = exchange.settle(exchange.debt); settledPaid += r.paid; msg = 'DEBT cleared' + (r.paid ? ' (' + fmt(r.paid) + ')' : ''); }
  fx.toast(msg, id === 'contract' ? 'good' : '');
  $('letter').classList.remove('show');
  // gentrification pressure first: cohort expectations drift by `day * delta`.
  // Then resolveDay folds in the day's outcome and runs the friendship
  // contagion, so the network sees the drift through the social layer.
  applyExpectation(regulars, day);
  regulars.resolveDay({ served: served + servedRetail, balked, defections, priced: repriced });
  openDay(day + 1);
}

// ---- dawns -------------------------------------------------------------------
function openDay(d) {
  day = d;
  coached = d !== 1;   // the lever hint only coaches day 1, once per campaign
  patrons.reset(); fx.reset();
  waveIdx = 0; chapterIdx = 0; dayMin = DAY_START;
  till = 0; cogs = 0; balked = 0; served = 0; servedRetail = 0; defections = 0; rivalServed = 0;
  prebatched = false; repriced = false; ctx.prebatched = false; ctx.repriced = false; ctx.batchUnits = 0; patrons.repriced = false;
  peakQueue = 0; waveBalked = 0; waveServed = 0; prebatchHelped = false; waveDebriefShown = false; closed = false;
  if (d === 1) forecastShown = false;
  world.setMatchaPrice('4.80', false);
  fx.receipt(null); fx.notebook(false);
  // the wire tilts the deck: live Linkup research multiplies event weights
  // (clamped inside roll), never replaces the seeded draw
  const intelBias = marketIntel && Array.isArray(marketIntel.marketShift)
    ? Object.fromEntries(marketIntel.marketShift.map(s => [s.eventId, s.weightMul]))
    : null;
  const ev = exchange.openDay(intelBias);    // drift first, then roll the market + the event
  if (d === 1 && marketIntel && marketIntel.marketShift && marketIntel.marketShift.length) {
    fx.toast('market intel · ' + String(marketIntel.marketShift[0].reason).slice(0, 90), 'warn');
  }
  // chalkboard: matcha day-price reflects the gentrification curve (4.80 → 5.40)
  if (exchange.matchaPrice) world.setMatchaPrice(exchange.matchaPrice.toFixed(2), repriced);
  if (d > 1 && exchange.debt > 0) exchange.debt += CAMPAIGN.debtInterest;   // the debt clock ticks at dawn
  world.setMail(false);
  world.setMist(ev.tier === 'cata' ? 1 : ev.tier === 'bad' ? 0.4 : 0);
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
  updateHUD();
}

function updateTicker() {
  // The day's matcha price is set by applyDrift() at dawn. ECON.matchaFull
  // stays the static 4.80 baseline; the live `matchaPrice` reads from the
  // gentrification curve.
  const dayPrice = exchange.matchaPrice ?? priceForDay(day);
  const tillPrice = repriced ? ECON.matchaDeal : dayPrice;
  world.ticker.draw({
    prev: exchange.history.length > 1 ? exchange.history[exchange.history.length - 2].index : exchange.beanIndex,
    index: exchange.beanIndex, cost: exchange.costPerCup,
    locked: exchange.contract ? exchange.contract.price * CAMPAIGN.beanBaseCost : null,
    margin: exchange.margin(tillPrice),
    day, total: CAMPAIGN.days, rep: regulars.reputation,
  });
}

function campaignClose() {
  closed = true;
  campaignDone = true;
  audio.closing();
  const net = cRev - cCost - settledPaid - exchange.debt;   // cash — what you settled — minus the debt that remains
  const rep = regulars.reputation;
  let v;
  if (net > 2400 && rep >= 78) v = VERDICTS.star;
  else if (net > 1400 && rep >= 62) v = VERDICTS.good;
  else if (net > 600) v = VERDICTS.held;
  else if (net > 0) v = VERDICTS.scarped;
  else v = VERDICTS.lost;
  const lines = [
    ['revenue (5 days)', fmt(cRev)], ['bean cost', fmt(cCost)], ['final debt', fmt(exchange.debt)], ['—', '—'],
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
  if ($('queuefill')) { $('queuefill').style.width = qPct + '%'; $('queuefill').className = qHeat; }
  if ($('qlabel')) $('qlabel').textContent = `queue ${qq} / 12 ` + (qq <= 5 ? '— calm' : qq <= 10 ? '— watch it' : '— they\u2019ll walk');
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
      $('goal').innerHTML = `☕ Keep the <b>queue under 5</b> · 14:00 the student rush hits. <b>Hit 1 to batch before noon</b> or watch them walk to <b>GLASSHOUSE</b>.`;
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
  world.setMatchaPrice('4.20', true);   // the chalkboard changes in-world
  world.flashChalk('reprice');
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
function reset() {
  // full campaign restart: the market and the regulars rewind to their start state
  const wasFinale = campaignDone;   // restarting from the verdict gets a send-off
  exchange.beanIndex = 1.0; exchange.day = 0; exchange.contract = null; exchange.debt = 0; exchange.event = null; exchange.history = [];
  for (const r of regulars.regulars) { r.op = 0.15; r.seen = false; r.served = 0; r.balked = 0; }
  cRev = cCost = cBalked = cServed = cDef = settledPaid = 0; campaignDone = false; paused = false;
  if ($('pause')) $('pause').textContent = 'pause';
  $('receipt').classList.remove('show'); $('letter').classList.remove('show');
  openDay(1);
  if (wasFinale) {
    rig.crane();   // swoop home from the sold street into the new week
    fx.toast('a new week on the floor — same street, new regulars', '');
  }
}
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
$('camreset').onclick = () => rig.resetView();
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
  // the letter answers to 1/2/3 (skipping disabled actions) while it's open
  if ($('letter').classList.contains('show')) {
    if (e.key === '1' || e.key === '2' || e.key === '3') {
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
// ---- tutorial: 3 steps, then the floor runs. Headless + ?skipTutorial bypass it.
const TUT_STEPS = [
  { k: '1 of 3 — THE READ', t: 'WATCH THE CLOCK', b: 'At <b>14:00 every day</b> students flood in for matcha. 139 &rarr; 683 a week — the fastest item on the floor. Made to order, a matcha takes <b>4 minutes</b>.' },
  { k: '2 of 3 — THE LEVER', t: 'BE READY', b: 'Before noon, hit <b>1 to pre-batch 40 cups (&pound;4.20)</b> or <b>2 to cut matcha to &pound;4.20</b>. The chalkboard changes. The queue doesn&apos;t.' },
  { k: '3 of 3 — THE PAYOFF', t: 'KEEP FIVE', b: 'Keep the queue <b>under 5</b>. Over that, they walk to <b>GLASSHOUSE</b> across the road. Under, they sit — and your till sings.' },
];
function showTutStep(n) {
  tutStep = n;
  $('tstep').textContent = TUT_STEPS[n].k;
  $('ttitle').textContent = TUT_STEPS[n].t;
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
  // unpause into the calm open after the crane settles
  setTimeout(() => { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }, 3400);
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
  if (headless || !wantTutorial) {
    started = true;
    audio.start();
    openDay(1); rig.crane();
  } else {
    // open the 3-step tutorial over the diorama; it owns the first 3.5s
    openTutorial();
  }
};

// ---- loop ---------------------------------------------------------------------------
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (started && !closed && !paused && !tutorialActive && schedule) {
    acc += dt * 1000;
    const msPerMin = 300 / (speed / 60);
    while (acc > msPerMin) { acc -= msPerMin; tick(); }
  }
  world.updateTimeOfDay(dayMin);
  sky.update(dayMin);
  postfx.setNight((world.night || 0) > 0.35 || dayMin < 420 || dayMin > 1180);
  patrons.update(dt, WALK_MUL[speed] || 2, now);
  world.updateRival(dt, now);   // their staff keeps moving behind the glass
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
    index: exchange.beanIndex, cost: exchange.costPerCup, debt: exchange.debt, settledPaid, campaignDone, netWorth: cRev - cCost - settledPaid - exchange.debt, rep: regulars.reputation, event: exchange.event ? exchange.event.id : null, contract: exchange.contract ? exchange.contract.price : null }),
  states: () => patrons.patrons.reduce((m, p) => ((m[p.state] = (m[p.state] || 0) + 1), m), {}),
  exc: exchange, reg: regulars, sync, world, rig, analytics,
  openDay, applyReply, reset, togglePause,
  get paused() { return paused; },
};
// Playtest helper — paste __grunds.analytics.summary() after Day 1 in console
try { window.__grunds.analytics = analytics; } catch {}

updateHUD();
requestAnimationFrame(loop);

