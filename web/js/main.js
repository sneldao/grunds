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

const fx = new FX(scene, null, lite);   // patrons wired in just below
const patrons = new PatronSystem(scene, world, regulars, exchange, fx);
fx.patrons = patrons;

// ---- game state ---------------------------------------------------------------
const DAY_START = 360, DAY_END = 1260;
let schedule = null, waveIdx = 0, chapterIdx = 0;
let day = 0, dayMin = DAY_START, speed = [60, 300, 1200].includes(urlSpeed) ? urlSpeed : 300, started = false, closed = false;
let till = 0, cogs = 0, balked = 0, served = 0, servedRetail = 0, defections = 0, rivalServed = 0;
let prebatched = false, repriced = false, batchUnits = 0;
let peakQueue = 0, waveBalked = 0, waveServed = 0, prebatchHelped = false;
// campaign accumulators (persist across the 5 days)
let cRev = 0, cCost = 0, cBalked = 0, cServed = 0, cDef = 0, settledPaid = 0, campaignDone = false;
const ctx = { prebatched: false, repriced: false, batchUnits: 0 };
const WALK_MUL = { 60: 1, 300: 4, 1200: 7 };

// ---- the day ------------------------------------------------------------------
function tick() {
  if (dayMin >= DAY_END) { closeDay(); return; }
  dayMin++;
  // spawn the wave
  while (waveIdx < schedule.waves.length && schedule.waves[waveIdx].t < dayMin) {
    const w = schedule.waves[waveIdx++];
    // the Gamble feeds the floor: a hype event pulls demand; reputation pulls footfall
    const mul = (exchange.event?.demand || 1) * regulars.footfallMul;
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
      if (Math.random() < 0.35) fx.bubble(e.p, COPY.gossipBad[(Math.random() * COPY.gossipBad.length) | 0], 'bad');
    } else if (e.type === 'defect') {
      defections++;
      if (defections === 1) fx.toast('they’re crossing the road to ' + COPY.rivalName + '…', 'bad');
      if (defections === 12) fx.toast(COPY.rivalName + '’s line is out the door.', 'bad');
    } else if (e.type === 'rivalServed') rivalServed++;
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
    if (ch.beat) rig.focus(world.focus[ch.beat] || world.focus.wide, ch.beat === 'wide' ? 26 : 13, 5);
    if (ch.notebook) fx.notebook(true);
    if (ch.wave) {
      rig.shake(0.3);
      if (prebatched) { fx.toast('the wave hits a warm till — 40 units ready', 'good'); prebatchHelped = true; }
      else fx.toast('the wave hits a cold bar — 4 minutes a cup', 'bad');
    }
  }
  if (dayMin >= 840) fx.notebook(prebatched ? false : dayMin < 900);
}

function closeDay() {
  if (closed) return;
  closed = true;
  audio.closing();
  if ($('again')) $('again').style.display = 'none';   // mid-campaign: the letter drives the next day, not this button
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
  fx.receipt({
    lines: [
      ['revenue', fmt(till)], ['bean cost', fmt(cogs)], ['debt', fmt(exchange.debt)],
      ['peak queue', peakQueue + ' deep'], ['walked to ' + COPY.rivalName, defections], ['—', '—'],
      ['NET TODAY', fmt(net)],
    ],
    verdict,
  });
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
  patrons.reset(); fx.reset();
  waveIdx = 0; chapterIdx = 0; dayMin = DAY_START;
  till = 0; cogs = 0; balked = 0; served = 0; servedRetail = 0; defections = 0; rivalServed = 0;
  prebatched = false; repriced = false; ctx.prebatched = false; ctx.repriced = false; ctx.batchUnits = 0; patrons.repriced = false;
  peakQueue = 0; waveBalked = 0; waveServed = 0; prebatchHelped = false; closed = false;
  world.setMatchaPrice('4.80', false);
  fx.receipt(null); fx.notebook(false);
  const ev = exchange.openDay();             // drift first, then roll the market + the event
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
  fx.receipt({
    lines: [
      ['revenue (5 days)', fmt(cRev)], ['bean cost', fmt(cCost)], ['final debt', fmt(exchange.debt)], ['—', '—'],
      ['cups poured', cServed], ['walked to ' + COPY.rivalName, cDef], ['—', '—'],
      ['NET WORTH', fmt(net)],
    ],
    verdict: v,
  });
  if ($('again')) { $('again').style.display = ''; $('again').textContent = '↺ run another week'; }
  rig.focus(world.focus.wide, 27, 9999);
}

// ---- HUD -----------------------------------------------------------------------
const fmt = n => '£' + n.toFixed(2);
function updateHUD() {
  const h = String(Math.floor(dayMin / 60)).padStart(2, '0'), m = String(dayMin % 60).padStart(2, '0');
  $('clock').textContent = `${h}:${m}`;
  if ($('daytag')) $('daytag').textContent = 'DAY ' + day + '/' + CAMPAIGN.days + '  ·  REP ' + regulars.reputation;
  $('till').textContent = fmt(till);
  $('balk').textContent = balked;
  const q = patrons.queueLength;
  const heat = q > 10 ? 'hot' : q > 5 ? 'warm' : 'ok';
  $('status').innerHTML =
    `queue <b class="${heat}">${q}</b> · matcha <b>${ctx.prebatched ? ctx.batchUnits : '—'}</b> · poured <b>${served}</b>` +
    (defections ? ` · <b class="hot">${defections} → ${COPY.rivalName.toLowerCase()}</b>` : '');
  $('progress').style.width = ((dayMin - DAY_START) / (DAY_END - DAY_START) * 100) + '%';
  $('prebatch').disabled = (prebatched && ctx.batchUnits > 0) || dayMin >= 960 || closed;
  $('reprice').disabled = repriced || closed;
  // pressure dial: the gentrification drift. beanIndex creep since the
  // start of the campaign (1.00 → drift.maxIndex), and the day's matcha
  // till price. Always visible — even day 1, so the player can see the
  // clock at 0% and feel the clock ticking.
  if ($('pressure')) {
    const driftPct = Math.round((exchange.beanIndex - 1.0) * 100);
    const dayPrice = exchange.matchaPrice ?? priceForDay(day);
    $('pressure').innerHTML = `costs <b>+${driftPct}%</b> · matcha <b>£${dayPrice.toFixed(2)}</b> · day <b>${day}/${CAMPAIGN.days}</b>`;
  }
  if (!closed) updateTicker();
}

// ---- levers ----------------------------------------------------------------------
function doPrebatch() {
  if (closed || dayMin >= 960) return;
  if (prebatched && ctx.batchUnits > 0) return;          // already warming
  const topUp = prebatched || ctx.batchUnits > 0;
  prebatched = true; ctx.prebatched = true; ctx.batchUnits = ECON.batchUnits;
  till -= ECON.batchCost;
  fx.notebook(false);
  fx.toast(topUp ? `PRE-BATCH topped up: ${ECON.batchUnits} units (−${fmt(ECON.batchCost)})` : `PRE-BATCH: ${ECON.batchUnits} matcha units ready (−${fmt(ECON.batchCost)})`, 'good');
  audio.clink(); updateHUD();
}
function doReprice() {
  if (repriced || closed) return;
  repriced = true; ctx.repriced = true; patrons.repriced = true;
  world.setMatchaPrice('4.20', true);   // the chalkboard changes in-world
  fx.toast('the chalkboard changes — matcha £4.20 today', 'good');
  audio.clink(); updateHUD();
}
function reset() {
  // full campaign restart: the market and the regulars rewind to their start state
  exchange.beanIndex = 1.0; exchange.day = 0; exchange.contract = null; exchange.debt = 0; exchange.event = null; exchange.history = [];
  for (const r of regulars.regulars) { r.op = 0.15; r.seen = false; r.served = 0; r.balked = 0; }
  cRev = cCost = cBalked = cServed = cDef = settledPaid = 0; campaignDone = false;
  $('receipt').classList.remove('show'); $('letter').classList.remove('show');
  openDay(1);
}
$('prebatch').onclick = doPrebatch;
$('reprice').onclick = doReprice;
$('reset').onclick = reset;
$('again').onclick = reset;
$('mute').onclick = () => { $('mute').textContent = audio.toggleMute() ? 'sound off' : 'sound on'; };
$('camreset').onclick = () => rig.resetView();
document.querySelectorAll('#speeds button').forEach(b => {
  if (+b.dataset.s === 300) b.classList.add('on');
  b.onclick = () => {
    speed = +b.dataset.s;
    document.querySelectorAll('#speeds button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  };
});
addEventListener('keydown', e => {
  if (e.key === '1') doPrebatch();
  else if (e.key === '2') doReprice();
  else if (e.key === 'r' || e.key === 'R') reset();
  else if (e.key === 'm' || e.key === 'M') $('mute').click();
  else if (e.key === 'c' || e.key === 'C') rig.resetView();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); postfx.resize(innerWidth, innerHeight);
});

// ---- boot -------------------------------------------------------------------------
fetch('/api/schedule').then(r => r.json()).then(s => {
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
$('open').onclick = () => {
  if (!schedule) return;
  started = true;
  $('title').classList.add('gone');
  audio.start();
  openDay(1); rig.crane();
  setTimeout(() => $('title').remove(), 1400);
};

// ---- loop ---------------------------------------------------------------------------
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (started && !closed && schedule) {
    acc += dt * 1000;
    const msPerMin = 300 / (speed / 60);
    while (acc > msPerMin) { acc -= msPerMin; tick(); }
  }
  world.updateTimeOfDay(dayMin);
  sky.update(dayMin);
  postfx.setNight((world.night || 0) > 0.35 || dayMin < 420 || dayMin > 1180);
  patrons.update(dt, WALK_MUL[speed] || 2, now);
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
  exc: exchange, reg: regulars,
  openDay, applyReply, reset,
};
updateHUD();
requestAnimationFrame(loop);

