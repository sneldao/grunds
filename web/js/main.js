// Grunds — The District. Main loop: the three nested clocks meet the floor.
//   THE GAMBLE (days)    — the Exchange: a pity-timer event deck + the bean market
//   THE READ (hours)    — the wave schedule + the Roaster's Notebook
//   THE SCRAMBLE (sec)  — the queue: pre-batch, reprice, or lose them to GLASSHOUSE
import * as THREE from '../vendor/three.module.js';
import { ECON, CHAPTERS, COPY, LAYOUT, CAMPAIGN, VERDICTS, REGULAR_ROSTER, EVENTS, FRANCHISE } from './config.js';
import { buildWorld, chalkPopScale } from './world.js';
import { initDistrictGen, districtOptOut } from './districtGen.js';
import { initFranchise, morningFranchiseLines } from './franchise.js';
import { buildSky } from './sky.js';
import { buildPostFX } from './postfx.js';
import { buildDirector } from './director.js';
import { buildVitality } from './vitality.js';
import { computeNextAction } from './nextAction.js';
import { leverState } from './nextAction.js';
import { buildHalo, shouldHalo } from './halo.js';
import { buildKitBeat } from './kitArrival.js';
import { PatronSystem } from './patrons.js';
import { StreetLife } from './streetLife.js';
import { buildBarStaff } from './barstaff.js';
import { FX } from './fx.js';
import { CameraRig } from './camera.js';
import { createImpact } from './impact.js';
import { AudioEngine } from './audio.js';
import { Exchange, seeded } from './exchange.js';
import { salePrice, operatingCosts, hedgeTerms, quoteDayPlan, campaignVerdict, weekStanding, standingNudge, VERDICT_GATES } from './economy.js';
import { Regulars } from './regulars.js';
import { WalkinPool, womReturnees, dossierLines, stageFor, stageLabel, feeling, CANON_DRINKS } from './identity.js';
import { profileView, CAST_PROFILES } from './cast.js';
import { planAttendance, incidentCost, ABSENCE_WORD, rivalCrossNotice } from './consequences.js';
import { isQuiet, QUIET_MUL } from './pace.js';
import { rushSpeed } from './paceNotice.js';
import { touchPrimary } from './gestures.js';
import { saveWeek, loadWeek, clearWeek, resumeLabel } from './weekSave.js';
import { portraitCanvas } from './portrait.js';
import { LotsState, LOT_CATALOG, LOT_IDS, lotSpot, serveNudge, isStale, STALE_LINES, restockQty, ROAST_IDEAL, roastQuality, cupQuality, SCORCH_LINE, COMPOST_AFTER } from './lots.js';
import { DRINKS, DRINK_IDS, basePrices, clampPrice, menuPrice, deliveryQty, waveMilkEstimate, ticketLevel, pastryPar, PASTRY, EMPTY_CASE_MOOD, starredDelivery } from './menu.js';
import { Demand, DEMAND_ACTIONS, marketingReach, priceElasticity } from './demand.js';
import { COUNTERABLE, resolveShock, applyInventory, repToOpinion, shockKnobs, counterForMenu, shockOnDay, demandShockRead, dawnDemandMult } from './shocks.js';
import { composeLetter } from './letter.js';
import { applyExpectation, priceForDay, modifiersForDay, wavesForDay, getMacroShockForDay, calculateNonLinearDrift, MACRO_SHOCKS } from './gentrification.js';
import { strategyForDay } from './rival.js';
import { canChooseStaffing, canHaveStaffCrisis, earnedRestDay, canStageHire, sickMorningCover, isMaintenanceMorning, robotPace, visitLands, tipForgone, quietOpinionDrag, HIRE_ROBOT } from './staffing.js';
import { resolveDecision } from './decision.js';
import { firstMorningCopy, economicsLesson } from './orientation.js';
import { planTools, TOOL_IDS, toolCopy, essentialNote } from './curriculum.js';
import { initSync } from './convexSync.js';
import { buildMailTheater } from './mailTheater.js';
import { calculateCampaignBadge, openShareToX, formatShareText } from './share.js';
import { buildShareCard, CARD_W, CARD_H } from './shareCard.js';
import { createAnalytics } from './analytics.js';
import { billing } from './billing.js';
import { initDesk, wireHint } from './desk.js';
import { createModalController } from './modals.js';
import { buildAutopsy, turningPoint } from './autopsy.js';
import { buildVitals, renderVitals } from './vitals.js';
import { planOutage, outageStatus, wifiCardLoss } from './utilities.js';
import { MorningLoan, loanAmount, caseRevenue, quoteClose, CASE_COST } from './stockLoan.js';

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
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  try { globalThis.grundsBootFail && globalThis.grundsBootFail('This browser couldn’t draw the street. Reload to try again.'); } catch { /* title script owns the message */ }
  throw err;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio, 2));
renderer.domElement.id = 'view';
document.body.appendChild(renderer.domElement);
function paintLoad(done, total) {
  const b = document.getElementById('open');
  if (!b || !b.disabled) return;
  b.textContent = total ? `loading the street… ${done}/${total}` : 'loading the street…';
}
globalThis.__grundsLoadProgress = paintLoad;

const world = buildWorld(scene, renderer, lite);
const sky = buildSky(scene);                          // shader sky dome owns the backdrop
world.useSky = true; scene.background = null;
const postfx = buildPostFX(renderer, scene, camera, { lite: lite || headless });
const rig = new CameraRig(camera, renderer.domElement);
// Chalkboard press: the existing shake helper, a short nudge. The board
// scale lives in impact.js; this only kicks the camera.
world._chalkNudge = () => { if (!reducedMotion) rig.shake(0.85); };
const impact = createImpact({ reduced: reducedMotion, holdClock: !headless });
const audio = new AudioEngine();

// ---- the connected campaign: the Gamble + the Regulars -----------------------
const campaignSeed = urlParams.get('seed') ? +urlParams.get('seed') : 7;
const exchange = new Exchange(campaignSeed);
const regulars = new Regulars();
const walkins = new WalkinPool(campaignSeed);  // Phase 1 — the day's strangers; dawn ensures the day
const lotState = new LotsState();              // Phase 2 — the cellar; stocks persist across days
exchange.lots = lotState;                      // pour routing for non-matcha cups
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
  const street = 0.6 + 0.8 * v;   // street lamps, glows, pools, windows, sign
  for (const p of world.lights.pendants) p.intensity *= warm;
  for (const bm of world.bulbMats) bm.emissiveIntensity *= warm;
  for (const lm of world.lampMats) lm.emissiveIntensity *= street;
  for (const sm of world.lampGlows) sm.opacity *= street;
  for (const ll of world.lampLights) ll.intensity *= street;
  for (const pm of world.lampPoolMats) pm.opacity *= street;
  for (const wl of world.windowLights) wl.intensity *= street;
  for (const wm of world.winMats) wm.emissiveIntensity *= street;
  world.signMat.emissiveIntensity *= street;
});
// Optional Convex mirror: offline-first, fire-and-forget. Configure with
// ?convex=https://<deploy>.convex.site — the floor never blocks on it.
const sync = initSync();
const SEED = urlParams.get('seed') ? +urlParams.get('seed') : 7;
// PR-4b — founder replay can swap the seed at runtime. reset() seeds the
// exchange from this variable, so updates flow through the next reset.
let SEED_OVERRIDE = null;
const seedNow = () => SEED_OVERRIDE != null ? SEED_OVERRIDE : SEED;
// Generative District (Tripothon S1): street furniture grown from the seed
// via the Convex bridge — fire-and-forget cross-fade on arrival; the classic
// procedural district is the fallback. No-ops when headless / no-GL / no Convex.
// ?classicDistrict forces the procedural street (completeness escape hatch).
const district = initDistrictGen({ scene, seed: SEED, classic: districtOptOut(location.search) });
// The Franchise (Tripothon S1 — Tier B): the player's words become stands
// on The Row — three storefronts unlock across the campaign. Same posture
// as the district — fire-and-forget, the classic street is the floor.
const franchise = initFranchise({
  scene, seed: SEED, classic: districtOptOut(location.search),
  onArrived: (inst, def, ls) => fx.toast(ls && ls.mine
    ? `the builders finished — ${def.name} is open`
    : `${def.name} is open — ${ls && ls.byline ? `built by ${ls.byline}` : 'a previous owner built it'}; the rent is yours`, 'good'),
  onStatus: () => {
    if (phase === 'planning') renderFranchiseRow();
    applyConstruction(day);   // a claimed lot drops its generic scaffold prop
  },
});
// The day-5 gentrification props share the facades the Row builds on:
// a claimed lot shows its own worksite/stand instead of the generic
// scaffold. Right prop overlaps lot 18, left overlaps lot 11; the back-row
// prop has no lot — it always dresses the turnover.
function rowClaimed(id) {
  const s = franchise.lots[id]?.status;
  return s === 'success' || s === 'processing';
}
function applyConstruction(d) {
  world.setConstruction(d, rowClaimed('18'));
  world.setConstructionLeft(d, rowClaimed('11'));
  world.setConstructionRight(d);
  // Vacant Row shells stay up from day 1 until a lot is actually claimed.
  if (world.setRowFront) {
    for (const lot of FRANCHISE.lots) world.setRowFront(lot.id, !rowClaimed(lot.id));
  }
}
// The Row's real state for the letter — built stands, claimed (built or
// in the builders' hands), and leases open but unsigned as of day d.
function rowSummary(d) {
  // null until a live read lands — dead/classic mode and the pre-poll
  // window fall back to the letter's legacy lines rather than assert
  // Row state we don't actually know.
  if (!franchise.live) return null;
  const lots = franchise.lots || {};
  let built = 0, claimed = 0;
  for (const l of FRANCHISE.lots) {
    const s = lots[l.id]?.status;
    if (s === 'success') built++;
    if (s === 'success' || s === 'processing') claimed++;
  }
  const unsigned = FRANCHISE.lots.filter(l => d >= l.unlockDay && lots[l.id]?.status !== 'success' && lots[l.id]?.status !== 'processing').length;
  return { built, claimed, unsigned };
}
// Linkup market intel: fetched once per session (server-cached 6h). Tilts the
// dawn deck via exchange.openDay(bias) and is cited in the roaster's letter.
let marketIntel = null;
if (sync.live && sync.intel) sync.intel().then(r => {
  marketIntel = r;
  if (r && $('wirebtn') && day >= 2) $('wirebtn').style.display = '';
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

// PR-5 — charge the post-commit override. £4.20 from till + a small opinion
// hit on every regular. Returns false if the till can't cover it (the caller
// should refuse the lever press entirely).
function chargeLeverOverride(leverName) {
  if (till < LEVER_OVERRIDE_PRICE) {
    fx.toast(`override costs ${fmt(LEVER_OVERRIDE_PRICE)} — not in the till`, 'warn');
    return false;
  }
  till -= LEVER_OVERRIDE_PRICE;
  batchSpend += LEVER_OVERRIDE_PRICE;
  leverOverrideCount++;
  // Gossip: small opinion hit on every named regular who's heard. Keeps the
  // rumor alive without breaking the day.
  try {
    const roster = (regulars && Array.isArray(regulars.regulars)) ? regulars.regulars : [];
    for (const r of roster) if (r && typeof r.op === 'number') r.op = Math.max(0, r.op - LEVER_OVERRIDE_GOSSIP);
  } catch {}
  fx.toast(`${leverName} override — paid ${fmt(LEVER_OVERRIDE_PRICE)}, the line heard you change your mind`, 'warn');
  try { analytics.track('lever_override', { day, dayMin, lever: leverName, till, count: leverOverrideCount }); } catch {}
  return true;
}
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
function leverSnapshot() {
  return { dayMin, closed, phase, repriced, prebatched, batchUnits: ctx.batchUnits, leversTimeLocked };
}
function currentAction() {
  return computeNextAction({ day, guidedOpening, dayMin, queue: patrons.queueLength, prebatched, repriced, batchUnits: ctx.batchUnits, mailPending, offerShown, eveningFast, rushFast, closed, phase, leversTimeLocked });
}
const patrons = new PatronSystem(scene, world, regulars, exchange, fx);
patrons.walkins = walkins;   // Phase 1 — walk-in identity draws from the day pool
// Cosmetic street life. Own meshes, own random stream — never a café wave.
const street = new StreetLife(scene, { lite });
patrons.onCosmeticCross = (from) => street.mirrorCrossing(from);
fx.patrons = patrons;
const barStaff = buildBarStaff(scene);
function syncBarStaff(mode) {
  const m = onRobotHire() ? 'robot'
    : mode ?? (baristaHomeToday ? 'home' : apprenticeHiredToday ? 'apprentice' : (planDraft && planDraft.staffing) || 'work');
  barStaff.setMode(m);
}
const analytics = createAnalytics();
// expose playtest script on boot — QA can copy/paste from console
try { console.log(analytics.playtestScript()); } catch {}
let deskHeldPause = false;
const modals = createModalController({
  onEscape: (t) => {
    if (t === 'desk') desk.close();
    else if (t === 'paywall') modals.close('paywall');
    else if (t === 'regulars' || t === 'dossier') modals.close(t);
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
      if (day === 1 && e.key >= '1' && e.key <= '3') {
        const prep = ['batch', 'reprice', 'hold'][+e.key - 1];
        const b = document.querySelector(`#brief-prep button[data-prep="${prep}"]`);
        if (b && !b.disabled) {
          b.click();
          const nb = document.querySelector(`#brief-prep button[data-prep="${prep}"]`);
          if (nb && nb.focus) nb.focus();
        }
      } else if (day !== 1 && e.key >= '1' && e.key <= '5') {
        const b = [...document.querySelectorAll('#brief-actions button')][+e.key - 1];
        if (b && !b.disabled) b.click();
      } else if (e.key === 'Enter') {
        const o = $('brief-open'); if (o && !o.disabled) o.click();
      }
    } else if (t === 'offer') {
      // a regular's ask answers to y/n while it's open
      if (e.key === 'y' || e.key === 'Y') resolveOffer(true);
      else if (e.key === 'n' || e.key === 'N') resolveOffer(false);
    } else if (t === 'tutorial') {
      if (e.key === 'Enter') { const n = $('tnext'); if (n) n.click(); }
    } else if (t === 'softintro') {
      if (e.key === 'Enter') { const p = $('softintro-primary'); if (p && !p.disabled) p.click(); }
    } else if (t === 'licence') {
      if (e.key === 'Enter') { const b = licPrimary(); if (b && !b.disabled) b.click(); }
    }
  },
  allowNumericShortcut: (t, target, key) => t === 'brief' && day === 1 && /^[1-3]$/.test(key) && !!(target && target.dataset && target.dataset.prep),
  onActiveChange: (t) => {
    if (t === 'desk' || t === 'paywall' || t === 'regulars' || t === 'dossier') {
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
rig.blocked = () => { try { return !!modals.top(); } catch { return false; } };
// District Insider Pass: the research desk gates on the entitlement; the
// stand owner doubles as the RevenueCat appUserId so a pass travels with it.
const desk = initDesk({ billing, analytics, modals });
billing.configure(sync.owner).then(() => { try { applyPaywallPlacements(); } catch {} });

// ---- game state ---------------------------------------------------------------
const DAY_START = 360, DAY_END = 1260;
let schedule = null, waveIdx = 0, chapterIdx = 0;
let day = 0, dayMin = DAY_START, speed = [60, 300, 1200].includes(urlSpeed) ? urlSpeed : 60, started = false, closed = false, paused = false;
let chosenSpeed = speed;
let hudPressAt = 0;
function noteHudPress() { hudPressAt = typeof performance !== 'undefined' ? performance.now() : 0; }
function handsFree() { return headless || (typeof performance === 'undefined') || (performance.now() - hudPressAt) > 420; }
function whenHandsFree(fn) {
  if (handsFree()) { fn(); return; }
  setTimeout(() => whenHandsFree(fn), 70);
}
function bindPress(el, fn) {
  if (!el) return;
  // -Infinity so a click in the first moments after load still counts.
  // A following click (the pointerdown's partner) inside 350ms does not.
  let at = -Infinity;
  const go = (e) => {
    if (el.disabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - at < 350) return;
    at = now;
    noteHudPress();
    fn(e);
  };
  el.onclick = go;
  if (el.addEventListener) el.addEventListener('pointerdown', (e) => {
    if (el.disabled) return;
    if (e && e.button != null && e.button !== 0) return;
    if (e && e.stopPropagation) e.stopPropagation();
    go(e);
    if (e && e.preventDefault) e.preventDefault();
  });
}
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
// PR-2 — showfloor autoplay (?demo=1). Bypasses licence + tutorial and
// resolves every modal + lever for the player so the floor tells its own
// story for screen-recording / judge demo. A keypress flips it off.
const demoMode = !headless && urlParams.has('demo');
let wantTutorial = !headless && !demoMode && !urlParams.has('skipTutorial') && !urlParams.has('notutorial');
// the pitch licence precedes the tutorial — ?skipTutorial/?notutorial/?skipLicence/?demo
// or headless all bypass it (the district assigns defaults: Sam, THE CORNER CUP)
const skipLicence = headless || demoMode || urlParams.has('skipLicence') || !wantTutorial;
// PR-2 — autoplay tick: each frame, if a modal is on top and we're in
// demoMode, click the same button a player would. 1.5s grace per modal so
// the UI animates in. The first keypress the player lands flips autoplay
// off (returns control).
let _demoLastModal = '', _demoLastActionAt = 0, _demoDisabled = false, _demoPhotoFired = false;
function autoplayTick(now) {
  if (!demoMode || _demoDisabled || headless) return;
  const top = (() => { try { return modals && modals.top && modals.top(); } catch { return null; } })();
  if (!top) { _demoLastModal = ''; return; }
  if (top === _demoLastModal && now - _demoLastActionAt < 1500) return;
  let btn = null;
  if (top === 'brief')          btn = $('brief-open');     // commit → trading (default hedge = hold)
  else if (top === 'offer')     btn = $('offer-no');       // 11:00 / incident: decline as a default
  else if (top === 'evening')   btn = $('evening-hold');   // 17:00: don't top up, ride what's left
  else if (top === 'letter')    btn = $('letter-close');   // close Idris, go to the receipt
  else if (top === 'paywall')   btn = $('pw-close');       // skip the upsell — demo is free
  else if (top === 'desk')      btn = $('desk-close');     // free player closes the desk
  else if (top === 'licence')   btn = $('lic-sign');       // sign with defaults — Sam, THE CORNER CUP
  if (btn && !btn.disabled && typeof btn.click === 'function') {
    try { btn.click(); } catch {}
    _demoLastModal = top;
    _demoLastActionAt = now;
  }
  // PR-2 — auto-photo at golden hour. One shot per day 1; the rest of the
  // week is the player's show (or stays still — judge demos rarely run 5 days).
  if (!_demoPhotoFired && dayMin >= 1080 && dayMin < 1110 && phase === 'trading') {
    _demoPhotoFired = true;
    try { doPhoto(); } catch {}
  }
}
// PR-2 — keypresses return the floor to the player
window.addEventListener('keydown', (e) => {
  if (!demoMode || _demoDisabled) return;
  // ignore edits inside the licence / brief fields
  try {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  } catch {}
  _demoDisabled = true;
  try { fx.toast('demo off — keys are yours', ''); } catch {}
}, true);
let till = 0, cogs = 0, balked = 0, served = 0, servedRetail = 0, defections = 0, rivalServed = 0;
let evangelistServes = 0;   // Phase 1 — evangelist serves become tomorrow's crowd via womReturnees
let womPids = new Set();
// Phase 2 — cellar ledger: staged lot choice + top-up (committed with OPEN),
// the day's bean outlay (dawn sacks ride the tab; per-cup emergency charges
// are cash), yesterday's pour (adaptive restock), per-day toast guards, and
// the dawn board index (top-ups price pre-roll).
// beanSpend is the receipt-only tally of the day's bean outlay; emergencySpend
// is its cash half (billed from the till per cup) and sackSpend its tab half
// (dawn sacks on Idris's credit). The Idris Gesha hold is cash too but rides
// beanSpend alone — never sackSpend — so the two halves don't sum to the whole.
let selectedLot = 'huila', topUpCups = 0, beanSpend = 0, emergencySpend = 0, sackSpend = 0;
// Morning stock loan — a lump beside the tab, not a replacement for it.
const loan = new MorningLoan();
let stagedLoan = 0, stagedCases = 0, caseUnits = 0, caseRevenueToday = 0, franchiseRentToday = 0;
let franchiseFxToday = { awareness: 0, returnees: 0, rentBonus: 0 };   // the Row's purpose bonuses landed at last close
let franchiseCarry = { awareness: 0, returnees: 0, rentBonus: 0 };     // that close, still owed to this morning's brief
let loanLotCover = 0, loanSponsorCover = 0, loanCashCap = null, closeTillOverride = null;
let loanClaim = null, menuHeld = null, salesTillForOps = null;
let pouredOther = 0, lastPour = 0, dawnIndex = 1.0;
let pouredByLotToday = {}, servedByDrinkToday = {};
let companionsYesterday = [];
let emergencyToast = false, emergencyCups = 0;
let staleNoted = new Set();
// Phase 3 — menu + roast + milk + skill: committed prices/offered board,
// staged copies for the Brief, staged roast for the selected lot, the day's
// milk delivery/stock, compost count, and Ruth's cumulative skill.
let menuPrices = basePrices();
let menuOffered = Object.fromEntries(DRINK_IDS.map(id => [id, true]));
let stagedMenu = null, stagedRoast = 3;
let milkDelivery = 0, lastMilky = 0, milkTipped = 0, milkToastDone = false, milkBalked = 0;
let shockCounter = null, stagedCounterable = null, shockDemandMul = 1, shockPulledFlat = false;
let demandStreetWord = '';
const DEMAND_CARD_MS = 1100;
let compostToday = 0;
let trainingTotal = 0, ruthSkill = 0;
// first-timers = walk-ins the Regulars graph doesn't know (regularIdx < 0).
// The new-shop arc lives on these numbers: tried, walked, told a friend.
let firstServed = 0, firstWalked = 0, firstServedToast = 0, firstWalkedToast = 0;
let prebatched = false, repriced = false;
// PR-A1 — Brief-staged prep. The Morning Brief lets the player lock in
// pre-batch / reprice before commit; if staged, the lever auto-fires at
// commit time and mid-day presses are free (the decision was already made).
let stagedPrep = { batch: false, reprice: false };
let guidedOpening = wantTutorial, firstPrepChosen = false;
let curriculumUnlockAll = headless || demoMode || !wantTutorial;
let curriculumMemory = null, curriculumPersist = null, toolsIntroducedToday = [];
function introducedSet() {
  if (curriculumMemory) return curriculumMemory;
  if (!curriculumPersist) {
    curriculumPersist = new Set();
    try { for (const t of JSON.parse(localStorage.getItem('grunds.curriculum') || '[]')) if (TOOL_IDS.includes(t)) curriculumPersist.add(t); } catch {}
  }
  return curriculumPersist;
}
function persistIntroduced() {
  if (curriculumMemory) return;
  try { localStorage.setItem('grunds.curriculum', JSON.stringify([...curriculumPersist])); } catch {}
}
const WARN_TIERS = new Set(['warn', 'bad', 'cata']);
function briefTools() {
  const houseNow = lotState.entry(selectedLot);
  return planTools({
    day, introduced: introducedSet(),
    houseStock: houseNow ? houseNow.stock : 0, lastPour,
    debt: exchange.debt, contract: !!(exchange.contract && exchange.contract.units > 0),
    threatToday: WARN_TIERS.has(exchange.event?.tier), threatYesterday: WARN_TIERS.has(exchange.lastTier),
    unlockAll: curriculumUnlockAll,
  });
}
let toolsToday = null;
let prepHintOpen = false;
let peakQueue = 0, waveBalked = 0, waveServed = 0, prebatchHelped = false;
let waveBatchServed = 0, waveStockoutAt = 0;
let turnaways = 0, turnawayToastDone = false;
let coach = null, coachHold = false;
let coached = false;   // day-1 lever hint, once per campaign
// just-in-time nudges: each fires once per campaign, only when its
// condition is on screen — teach at the moment of need, not at boot
let nudgedQueue = false, nudgedBalk = false, nudgedPrice = false, nudgedStanding = false;

let eveningCallShown = false, eveningFast = false, rushFast = false;
let paceTest = false, momentsTest = false, moveTickTest = false;
let momentPending = [], momentActive = null;
const momentDone = new Set(), momentSeen = new Set();
let offerResolved = false;   // the 11:00 ask has been answered — skip may jump to 14:00
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
let pastryWaste = 0; // dawn case still in the cabinet at close
let pastryWasteCost = 0; // close charge: unsold × PASTRY.cogs. Not prepaid at dawn.
let pastrySpend = 0; // wholesale of croissants that left the case at the register
let pastryOnOrder = 0;
let pastryMissDrinks = 0; // empty case, they still bought the drink
let pastryMissWalks = 0;  // empty case, the one-in-four who left
let pastryMissNoted = false;
let lastRetail = 0; // yesterday's register, sizes tomorrow's case
let softDay = false, softWeekDone = false, coachedOpening = false, softTest = null, softRng = null;
const SOFT_MUL = 0.005, SOFT_CAST = new Set(['Mara', 'Pip', 'Olu']), SOFT_EARLY = new Set(['Mara', 'Olu']);
const wantsSoftDay = () => wantTutorial && !TOOL_IDS.every(t => introducedSet().has(t));
let incidentShown = false, activeBeat = null, cashOnly = 0, cashOnlyToast = false, contractFeeExtra = 0, solicitorAt = 0;
// Utilities — the day's seeded wifi outage ({ start, end, tethered, announced,
// restored }) or null. Planned at dawn; while it's down the card reader fails
// a share of sales until the player tethers (Running the Stand panel).
let wifiOutage = null;
// Morning Brief — the Drug Wars turn: paused at 06:00, read then commit
let briefChoice = null;
let lastDayStats = null;   // yesterday's counters — the Brief's letter reads them at dawn
// Ruth — your barista. One hidden condition stat; the fiction carries it.
// Worked days drain (harder on brutal floors), sent-home days recover.
let baristaCondition = 1.0, baristaHomeToday = false, baristaRested = false, baristaStaged = false, baristaCrisis = false;
// Phase 4 — Ruth's arc: hinted condition → asked cause → promised rest → a
// friend walks in. noticed/asked/restDay/returned persist across days (the
// arc is the week); all reset on campaign restart.
let ruthNoticed = false, ruthAsked = false, ruthRestDay = 0, ruthReturned = false, ruthRestOffer = 0;
let starCarry = false; // a starred week; reset does not clear it — day 1 of the next week spends it
// Week hire. Day 1 of the real week chooses Ruth (default) or the robot.
// It locks at open. quietCarry is the room that lease leaves behind: reset
// does not clear it, and dawn does not either.
let weekHire = 'ruth', hireLocked = false, quietCarry = 0;
let maintenanceBill = 0, tipsForgoneToday = 0;
let pastryCut = 0;     // staged share of tomorrow's case to skip, 0..1
const RUTH_CAUSES = {
  rush: 'It’s the lunch rush, every day — the line never ends and I’m the whole bar.',
  opens: 'Four 5ams in a row. The opens are killing me — I don’t sleep, I just close my eyes at the counter.',
};
let apprenticeHiredToday = false, rivalStrategy = 'DEFAULT', dayMods = {};
// PR-B2 — reactive AI: the rival notices the player's moves during the day
// and ripples back. Toast-only by default; some reactions mutate game state.
// rivalReacted.cut counts how many times the player repriced today; rivalReacted.prep
// counts how many times they pre-batched. rivalReactLog is the per-day timeline
// the Brief can replay tomorrow if you want a longer arc.
let rivalReacted = { cut: 0, prep: 0 };   // per-day counters
let rivalReactLog = [];   // [{move, ts, msg}] — per-day
// Phase 4 — Sam's season: grudges accumulate all week (never reset
// mid-campaign), the truce is offered once (day 3), the finale remembers.
let samGrudge = { cuts: 0, preps: 0, snubs: 0 };
let samTruce = false, truceShown = false;
// Phase 4 — Idris's arc: the roaster remembers. Contracts taken, tabs
// settled, advice ignored — quoted back in his letters. Loyalty (2+ covers)
// buys early alpha on frost aftermath. Reset on campaign restart.
let contractsTaken = 0, settledCount = 0, ignoredAdvice = 0, idrisHeldSack = false;
let lastHedge = 'hold';   // yesterday's hedge id, for Idris's vindication lines
// the pitch licence — who you are, signed before the first dawn. Identity
// threads the letter, the receipt, the district board; the background pick
// carries one small mechanical perk (not a class — the arc is one role).
let playerName = 'Sam', standName = 'THE CORNER CUP', playerRole = 'the new owner', perkBg = null;
let perkStaffMul = 1, perkCostMul = 1;   // ex-barista pace / ex-accountant trim
// PR-4d — Web Customer Center. A footer link inside #paywall opens the
// center; route handlers use the existing billing API. On Capacitor this
// gets replaced by RevenueCat's native Customer Center UI.
function openCustomerCenter() {
  const tier = document.getElementById('cc-tier');
  const mode = document.getElementById('cc-mode');
  const mode2 = document.getElementById('cc-mode-2');
  const testCancel = document.getElementById('cc-test-cancel');
  try {
    let label = '— free play —';
    if (billing.isFounder())    label = '★ DISTRICT FOUNDER';
    else if (billing.isInsider()) label = '⚡ INSIDER PASS';
    if (tier) tier.textContent = label;
    const m = billing.mode || 'test store';
    if (mode)  mode.textContent = m;
    if (mode2) mode2.textContent = m;
    if (testCancel) testCancel.style.display = billing.testKey || !billing.purchases ? '' : 'none';
  } catch {}
  modals.open('customer-center');
}
function wireCustomerCenter() {
  const close = document.getElementById('cc-close');
  if (close) close.onclick = (e) => { e.preventDefault(); try { modals.close('customer-center'); } catch {} };
  const restore = document.getElementById('cc-restore');
  if (restore) restore.onclick = async (e) => {
    e.preventDefault();
    restore.disabled = true;
    const r = await billing.restorePass();
    restore.disabled = false;
    if (r && r.success) {
      try { applyPaywallPlacements(); } catch {}
      openCustomerCenter();   // re-render the active tier
      try { fx.toast('purchases restored', 'good'); } catch {}
    } else try { fx.toast('nothing to restore', ''); } catch {}
  };
  const cancelBtn = document.getElementById('cc-test-cancel');
  if (cancelBtn) cancelBtn.onclick = (e) => {
    e.preventDefault();
    billing.cancelPass();
    try { applyPaywallPlacements(); } catch {}
    openCustomerCenter();
    try { fx.toast('test subscription cancelled — back to free play', ''); } catch {}
  };
  const portal = document.getElementById('cc-portal');
  if (portal) portal.onclick = (e) => {
    e.preventDefault();
    // RevenueCat hasn't shipped a hosted web customer-portal URL yet; this
    // link is the surface that flips to one if/when they do. For now, open
    // a polite explanation and route to restore.
    try { fx.toast('cancellation runs on your platform\'s subscription page — restore works cross-device here', ''); } catch {}
  };
  // Paywall → Customer Center link
  const manage = document.getElementById('pw-manage');
  if (manage) manage.onclick = (e) => {
    e.preventDefault();
    try { modals.close('paywall'); } catch {}
    openCustomerCenter();
  };
}

// PR-4c — multi-placement paywall. Each upsell lives in the markup and is
// toggled on demand: shown to non-insiders at the right beat, replaced by
// the founder-replay CTA or the founder share frame for insiders/founders.
// The four surfaces are:
const PAYWALL_PLACEMENTS = {
  brief:    { id: 'brief-insider-upsell',  isFounderOnly: false, openPaywall: true },
  offer:    { id: 'offer-insider-upsell',  isFounderOnly: false, openPaywall: false },   // shows the regulars' take
  verdict:  { id: 'verdict-upsell',        isFounderOnly: false, openPaywall: true },    // upsell for non-founders
  share:    { id: 'pc-founder-upsell',     isFounderOnly: true,  openPaywall: true },    // founder stamp upgrade
};
function applyPaywallPlacements() {
  let isInsider = false, isFounder = false;
  try { isInsider = billing.isInsider(); isFounder = billing.isFounder(); } catch {}
  // The verdict CTA is founder-only on the inside, free upsell on the outside.
  for (const [, p] of Object.entries(PAYWALL_PLACEMENTS)) {
    const el = document.getElementById(p.id); if (el) el.style.display = 'none';
  }
  try {
    const founderBtn = document.getElementById('founder-replay');
    const upsellBtn  = document.getElementById('verdict-upsell');
    if (founderBtn) founderBtn.style.display = isFounder ? '' : 'none';
    if (upsellBtn)  upsellBtn.style.display  = 'none';
  } catch {}
}
// Run on every billing change so the surfaces reflect the live state
billing.onChange(() => { try { applyPaywallPlacements(); } catch {} });
// PR-4d — wire the Customer Center modal once on boot
try { wireCustomerCenter(); } catch {}
// also extend the OWNED list in modals.js? No — modals already accepts any
// string; OWNED is the allow-list. The customer-center must be added so
// the focus-trap + z-index bookkeeping recognise it as a top-level modal.
// It's easiest to register it lazily — modals.closeAll() will safely no-op
// on unknown ids, and only this function ever opens it.
// PR-4c — wire each upsell button to open the existing paywall modal
const _upsellHandlers = [
  ['brief-insider-btn',   () => modals.open('paywall')],
  ['verdict-upsell',      () => modals.open('paywall')],
  ['pc-founder-upsell',   () => modals.open('paywall')],
];
for (const [id, fn] of _upsellHandlers) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', (e) => { e.preventDefault(); try { fn(); } catch {} });
}

// PR-4c — cached Nebius "regulars' take" — fetched once per day at offer time
let _offerTakeCache = { day: 0, lines: [] };
async function fetchOfferTake() {
  if (_offerTakeCache.day === day) return _offerTakeCache.lines;
  _offerTakeCache = { day, lines: [] };
  try {
    if (sync && sync.live && sync.fetchIntel) {
      const intel = await sync.fetchIntel();
      if (intel && Array.isArray(intel.gossip)) _offerTakeCache.lines = intel.gossip.slice(0, 2);
    }
  } catch {}
  if (!_offerTakeCache.lines.length) {
    // templated fallback quotes — varied by cohort so the line feels real
    const quotes = [
      '"worth hearing both sides before you say no."',
      '"the regulars are watching — say yes, but ask why."',
      '"my friend said they handled this well last time."',
      '"I\'ve seen GlASHHOUSE try this — they almost always say yes."',
      '"you don\'t need to be the cheapest on the street."',
    ];
    _offerTakeCache.lines = [quotes[day % quotes.length]];
  }
  return _offerTakeCache.lines;
}

// Phase 6 — week autopsy: per-day cause records accumulate here; campaignClose
// renders them via buildAutopsy() so a lost week names its causes.
let campaignDays = [];
let weekOpStart = null; // dawn-day-1 opinion baseline, for week-span drops
let staleByLotToday = {}; // lotId → stale/scorched cups poured today
// campaign accumulators (persist across the 5 days)
let cRev = 0, cCost = 0, cBalked = 0, cServed = 0, cDef = 0, settledPaid = 0, campaignDone = false;
let cRivalServed = 0, cRivalChoices = 0;   // PR-B1 — rival's week tally so the verdict reads side-by-side
let cOps = 0;   // the cost sheet — staff, supplies, pitch, fees across the campaign
// PR-3 — Per-beat "powered by" captions. Each entry maps a beat to a
// sponsor string. The brief/offer/verdict captions are set when their modal
// opens; the 14:00 wave caption floats for ~7s in the HUD.
const BEAT_POWERED = {
  brief: 'Synced via Convex · managed plan queue',
  offer: 'Idris replied by AgentMail',
  wave:  'Live wire: Linkup · Firecrawl · OpenAI  →  the wave',
  evening: 'District leaderboard live on Convex · your row ↗',
  verdict: 'Replay your week · RevenueCat District Insider',
};
// One setter for the inline captions (brief/offer/verdict).
function setBeatPower(id, text) {
  const el = document.getElementById(id + '-powered');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
  // If the offer is the incident variant, swap copy — incidents are 'the
  // floor bites back', not AgentMail replies.
}
// The wave HUD caption is the only floating one — it rises with the wave and
// clears a few seconds later, like a sponsor watermark on the moment.
function showWavePowered(ttlMs = 7000) {
  const el = $('wave-powered'); if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}
const ctx = { prebatched: false, repriced: false, batchUnits: 0, batchReservedUntil: 0, milkStock: 0, milky: 0, milkOut: false, menuPrices, priceMult: 1 };
const WALK_MUL = { 60: 1, 300: 3, 1200: 6 };
// settle window: day 1, first 12 sim-min feel uncrowded even after the sim starts
const CALM_UNTIL_MIN = DAY_START + 12;

// PR-5 — Time-locked levers. Once commitDayPlan fires, the prep / reprice
// levers lock for the rest of the day. Pressing them anyway charges £4.20
// (per press) plus a small opinion hit on every regular who's heard of the
// change of heart. The intent is to give the morning brief real prep weight.
const LEVER_OVERRIDE_PRICE = 4.20;
const LEVER_OVERRIDE_GOSSIP = 0.06;
let leversTimeLocked = false;
let leverOverrideCount = 0;

// ---- the day ------------------------------------------------------------------
function tick() {
  if (phase !== 'trading' || paused || closed) return;
  if (dayMin >= (softDay ? 1020 : DAY_END)) { closeDay(); return; }
  dayMin++;
  // Drop 20× when the rush starts — the cup countdown has to be readable.
  // The chosen speed comes back at 17:00. The 20× button stays clickable
  // so a press explains the wait instead of looking dead.
  {
    const cap = rushSpeed(dayMin, chosenSpeed, headless);
    if (cap.notice && (dayMin === 840 || dayMin === 1020)) {
      speed = cap.speed;
      document.querySelectorAll('#speeds button').forEach(x => {
        x.classList.toggle('on', x.dataset.s === String(speed));
      });
      fx.toast(cap.notice, cap.dropped ? 'warn' : '');
    }
    if (!headless) {
      document.querySelectorAll('#speeds button').forEach(x => {
        if (x.dataset.s === '1200') {
          const blocked = cap.blocked;
          x.classList.toggle('wait', blocked);
          x.title = blocked ? '20× returns after 17:00 — the rush stays readable at 5×' : '';
        }
      });
    }
  }
  // spawn the wave — day-1 mornings are half-demand so newcomers can read the floor.
  // Reach enlarges the street and, on the patron, weights the rival split.
  // Price elasticity grows or shrinks the pool from the level of both cafes.
  const ourStreetPrice = salePrice(exchange, repriced) * (ctx.priceMult || 1);
  const rivalStreetPrice = (CAMPAIGN.rivalStrategies[rivalStrategy] || CAMPAIGN.rivalStrategies.DEFAULT).price;
  const elasticity = priceElasticity(ourStreetPrice, rivalStreetPrice);
  const reach = marketingReach(demand.staged) * (shockDemandMul || 1);
  patrons.reach = reach;
  patrons.cupQuality = currentCupQuality();
  while (waveIdx < dayWaves.length && dayWaves[waveIdx].t < dayMin) {
    const w = dayWaves[waveIdx++];
    const morningCalm = (day === 1 && w.t < 600) ? 0.52 : 1;
    const settleThin = (day === 1 && dayMin < CALM_UNTIL_MIN) ? 0.5 : 1;
    const mul = (exchange.event?.demand || 1) * regulars.footfallMul * demand.spawnMul() * morningCalm * settleThin * (w.t >= 840 ? offerWaveMul : 1) * (samTruce && day === 5 ? 0.92 : 1) * elasticity * reach;
    // loyalty made visible: yesterday's served × return rate reappear,
    // spread evenly so the wave keeps its shape and just runs deeper
    const returnBonus = demand.todayReturnees > 0 && dayWaves.length
      ? Math.round(demand.todayReturnees / dayWaves.length) : 0;
    let firstSpawn = true;
    patrons.party = party;
    patrons.partyActive = softDay ? false : (dayMin >= 840 && dayMin <= 1020);
    for (const s of w.spawns) {
      let n;
      if (softDay) {
        const expected = s.q * ECON.spawnScale * SOFT_MUL;
        n = Math.floor(expected) + (softRng() < expected - Math.floor(expected) ? 1 : 0);
      } else {
        n = Math.max(1, Math.round(s.q * ECON.spawnScale * mul)) + (firstSpawn ? returnBonus : 0);
      }
      firstSpawn = false;
      for (let i = 0; i < n; i++) patrons.spawn(s.c, s.z, speed > 60);
    }
  }
  if (softDay) {
    patrons.markSeenOnly = dayMin < 840 ? SOFT_EARLY : SOFT_CAST;
    if (dayMin === 490) patrons.spawn('commuters', 'counter', speed > 60);
    if (dayMin === 750) patrons.spawn('elders', 'counter', speed > 60);
    if (party && !party.declined && dayMin >= 840 && dayMin < 852) {
      patrons.party = party;
      patrons.partyActive = true;
      for (let i = 0; i < 2 && (party._landed || 0) < 24; i++) {
        if (patrons.spawn('students', 'counter', speed > 60)) party._landed = (party._landed || 0) + 1;
      }
      patrons.partyActive = false;
    }
  }
  coachTick();
  if (paused) { updateHUD(); return; }
  // run the floor
  const events = patrons.tick(dayMin, ctx);
  street.syncFranchise(franchise, day);
  street.setRivalHeat(patrons.rivalQ.length);
  street.noteQueue(patrons.queueLength);
  street.tick();
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
      // A croissant that left the case pays its wholesale now. The unsold
      // remainder is not in this debit — close bills that at PASTRY.cogs.
      if (e.pastry) {
        const unit = Math.round(PASTRY.cogs * 100) / 100;
        till -= unit;
        pastrySpend = Math.round((pastrySpend + unit) * 100) / 100;
      }
      // cash-only day: a share of sales die at the till — no card, no sale
      // the dead-reader incident and a wifi drop share one cash-only path
      const cardLoss = Math.max(cashOnly, wifiCardLoss(wifiOutage, dayMin));
      if (cardLoss && Math.random() < cardLoss) {
        cogs += e.lotId ? 0 : e.beanCost ?? 0;   // Phase 2 cash-basis (see below)
        if (e.hedged) { hedgedCups++; realizedHedgeSavings += e.spotCost - e.beanCost; }
        balked++; balks++;
        if (dayMin >= 840 && dayMin <= 1020) waveBalked++;
        if (!cashOnlyToast) { cashOnlyToast = true; fx.toast('no card, no sale — they leave the cup on the counter', 'warn'); }
        continue;
      }
      till += e.price; cogs += e.lotId ? 0 : e.beanCost ?? 0; sales++;   // Phase 2 cash-basis: lot cups were expensed at the dawn top-up
      if (e.pastryMiss) { pastryMissDrinks++; noteEmptyCase(); }
      // The gratuity rides inside the ticket. A warm Ruth week forgoes
      // none of it. A robot week, and the quieter room it leaves, keeps less.
      const forgone = tipForgone(e.price, regulars.tipMul, { robot: onRobotHire(), quiet: quietCarry });
      if (forgone) { till -= forgone; tipsForgoneToday += forgone; }
      if (e.hedged) { hedgedCups++; realizedHedgeSavings += e.spotCost - e.beanCost; }
      if (e.viaRegister) servedRetail++; else served++;
      // Phase 2 — the cup tells its story: emergency sacks bill the till at
      // pour time, silent stock switches get one honest toast, and stale or
      // loved lots move roster opinions with a reason the room can taste.
      // Emergency bills EVERY cup from the till (not just the first): the
      // bone-dry cellar pours at 1.5× spot, so a dry week hurts per cup or
      // the same-cheap-lot-all-week line never breaks. Receipt-only
      // beanSpend here — the till hit already lands in the ledger via cRev.
      if (e.emergency) {
        till -= e.spotCost; beanSpend += e.spotCost; emergencySpend += e.spotCost; emergencyCups++;
        if (!emergencyToast) {
          emergencyToast = true;
          fx.toast('cellar’s dry — called Idris for an emergency sack (1.5× spot)', 'warn');
        }
      }
      if (e.switched && e.lotId) {
        const entry = LOT_CATALOG[e.lotId];
        fx.toast(`${lotState.house === e.lotId ? 'pouring' : 'onto'} ${entry ? entry.name : e.lotId} — the house sack ran dry`, 'warn');
      }
      if (e.p && e.p.regularIdx >= 0 && !e.isMatcha && e.lotId) {
        // Phase 3 — roast-aware palate: off-ideal roast scales the warmth,
        // scorch reads as stale, and Ruth (skill 1+) cups the sour shots.
        const lot = lotState.entry(e.lotId);
        const age = lotState.age(e.lotId, day);
        const roastMul = roastQuality(e.lotId, lot?.roast ?? 3);
        const scorched = !!lot?.scorched;
        let nudge = serveNudge(e.lotId, e.p.cohort, age, roastMul, scorched);
        if (ruthSkill >= 1 && nudge < 0) nudge /= 2;
        if (nudge) {
          const r = regulars.regulars[e.p.regularIdx];
          if (r) r.op = Math.max(-1, Math.min(1, r.op + nudge));
        }
        if ((scorched || isStale(age))) {
          // Phase 6 — autopsy counts every stale/scorched cup by lot; the
          // once-per-cohort toast stays as-is below.
          staleByLotToday[e.lotId] = (staleByLotToday[e.lotId] || 0) + 1;
        }
        if ((scorched || isStale(age)) && !staleNoted.has(e.p.cohort)) {
          staleNoted.add(e.p.cohort);
          const named = e.p.regularName ? ` — ${e.p.regularName} switched to tea` : '';
          fx.toast(`${scorched ? SCORCH_LINE : (STALE_LINES[e.p.cohort] || 'the room tastes yesterday’s roast')}${named}`, 'warn');
        }
      }
      if (!e.isMatcha && !e.emergency) { pouredOther++; if (e.lotId) pouredByLotToday[e.lotId] = (pouredByLotToday[e.lotId] || 0) + 1; }
      servedByDrinkToday[e.drinkId || (e.isMatcha ? 'matcha' : 'flatwhite')] = (servedByDrinkToday[e.drinkId || (e.isMatcha ? 'matcha' : 'flatwhite')] || 0) + 1;
      // Phase 1 — a serve is a visit. Canon regulars append session history
      // (visits count days-seen in resolveDay, both sides); walk-ins
      // accumulate in the day pool; evangelist serves seed tomorrow's crowd.
      if (e.p) {
        const drinkName = e.p.drink && DRINKS[e.p.drink] ? DRINKS[e.p.drink].name : e.p.drink;
        const womKey = e.p.pid || `roster-${e.p.regularIdx}`;
        if (e.p.regularIdx >= 0) {
          const stage = regulars.noteVisit(e.p.regularIdx, { day, drink: drinkName });
          if (stage) e.p.stage = stage;
          if (e.p.stage === 'evangelist' && !womPids.has(womKey)) { womPids.add(womKey); evangelistServes++; }
        } else if (e.p.pid && visitLands(served, { robot: onRobotHire(), quiet: quietCarry })) {
          const head = walkins.recordVisit(e.p.pid, { day, drink: drinkName, outcome: 'served' });
          if (head) { e.p.stage = head.stage; e.p.visits = head.visits;
            if (head.stage === 'evangelist' && !womPids.has(womKey)) { womPids.add(womKey); evangelistServes++; } }
        }
      }
      if (e.p && e.p.regularIdx < 0) {
        firstServed++;
        if (firstServedToast < 2) { firstServedToast++; fx.toast('a first-timer — the street’s trying you', 'good'); }
      }
      if (e.p && e.p.partyMember && party && !party.declined) party.served++;
      if (dayMin >= 840 && dayMin <= 1020) { waveServed++; if (e.fromBatch) waveBatchServed++; }
      audio.clink();
      if (e.p) feel({ patron: e.p, part: 'cup' });
    } else if (e.type === 'balked') {
      balked++; balks++;
      // Board turnaways read the 86'd drink and leave with a named reason —
      // they never queued, never met Ruth, never earned an opinion. The
      // receipt names the drink so the cause is legible tomorrow.
      if (e.turnaway) {
        turnaways++;
        if (!turnawayToastDone) {
          turnawayToastDone = true;
          fx.toast(`no ${DRINKS[e.turnaway]?.name || e.turnaway} today — they read the board and left`, 'warn');
        }
      } else {
        if (e.pastry) { pastryMissWalks++; noteEmptyCase(); }
        if (e.milkOut) milkBalked++;
        // Phase 1 — a walk-out sours a walk-in (roster balks already flow
        // through resolveDay's served/balked counters).
        if (e.p && e.p.pid && e.p.regularIdx < 0) walkins.recordVisit(e.p.pid, { day, outcome: 'balked' });
        if (e.p && e.p.regularIdx >= 0) regulars.noteWalkout(e.p.regularIdx, { day, outcome: 'balked' });
        if (e.p && e.p.regularIdx < 0) {
          firstWalked++;
          if (firstWalkedToast < 2) { firstWalkedToast++; fx.toast('a first-timer walked — first impressions travel', 'warn'); }
        }
        if (e.p && e.p.partyMember && party && !party.declined) party.walked++;
        if (dayMin >= 840 && dayMin <= 1020) { waveBalked++; if (prebatched) prebatchHelped = false; }
        audio.balk();
        if (e.p) feel({ patron: e.p, part: 'torso' });
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
        if (!e.pastry && !nudgedBalk) {
          nudgedBalk = true;
          fx.toast('they walked — press 1 to prep cups, or 2 to cut the price', 'warn');
        }
      }
    } else if (e.type === 'defect') {
      defections++;
      // Phase 1 — crossing to Glasshouse burns a walk-in (roster defectors
      // are unsee'd in patrons.js and never earned the day).
      if (e.p && e.p.pid && e.p.regularIdx < 0) walkins.recordVisit(e.p.pid, { day, outcome: 'defected' });
      const widx = e.p ? (e.p.defectedFrom ?? e.p.regularIdx) : -1;
      const named = widx >= 0 ? regulars.regulars[widx] : null;
      if (widx >= 0) regulars.noteWalkout(widx, { day, outcome: 'defected' });
      if (named) momentEnqueue('sam', `sam:${named.name}`, { name: named.name });
      const crossNote = rivalCrossNotice({
        name: named?.name || e.p?.regularName || null,
        defections,
        rivalName: COPY.rivalName,
      });
      if (crossNote) fx.toast(crossNote, 'bad');
      if (defections === 1 && speed <= 300) rig.queueFocus(world.focus.rival, 13, 4, 12, Math.PI);
      if (defections === 5) {
        const taunt = COPY.rivalTaunts ? COPY.rivalTaunts[(Math.random() * COPY.rivalTaunts.length) | 0] : null;
        if (taunt) fx.toast(taunt, 'bad');
        try { world.jeerRival(); } catch {}
      }
      if (defections === 12) fx.toast(COPY.rivalName + '’s line is out the door.', 'bad');
    } else if (e.type === 'rivalServed') { rivalServed++; fx.coinBurst(LAYOUT.rival.x, 1.7, 15.2, 3); }
  }
  // Phase 3 — the milk ran dry mid-day: one honest toast, then the balks
  // speak for themselves.
  if (ctx.milkOut && !milkToastDone) {
    milkToastDone = true;
    fx.toast('milk’s out — milky cups are walking', 'warn');
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
    if (dayMin >= 840 && dayMin <= 1020 && !waveStockoutAt) waveStockoutAt = dayMin;
    fx.toast('batch exhausted — made-to-order until you top up (1)', 'warn');
  }
  peakQueue = Math.max(peakQueue, patrons.queueLength);
  beats();
  coachTick();
  updateHUD();
}

// Books the player can read: yesterday until the receipt, then the close.
// `nut` is today's pre-cup bill when a plan exists — not a new cash rule.
// `recent` is each closed day's take-home, so a mid-week slide can be said
// without inventing a second cash gate.
function recentTakeHome() {
  return (campaignDays || []).map((d) => d.netToday).filter((n) => typeof n === 'number' && Number.isFinite(n));
}
function standingSnapshot() {
  if (softDay) return null;
  const asOf = (phase === 'review' || phase === 'finale') ? 'close' : (day > 1 ? 'last-close' : 'opening');
  const net = cRev - cCost - cOps - settledPaid - exchange.debt;
  let nut = null;
  try {
    const q = quoteDayPlan({
      day,
      hedge: planDraft?.hedge || 'hold',
      staffing: onRobotHire() ? 'robot' : (planDraft?.staffing || 'work'),
      marketing: planDraft?.marketing || {},
      debt: exchange.debt,
      extraFee: contractFeeExtra,
      perkCostMul,
      modifiers: modifiersForDay(day),
    });
    nut = q.fixedMinimum;
  } catch { nut = null; }
  return weekStanding({ net, rep: regulars.reputation, day, days: CAMPAIGN.days, asOf, nut, countToday: phase === 'planning', recent: recentTakeHome() });
}

function renderWeekStanding() {
  const el = $('brief-standing');
  if (!el) return;
  const stand = standingSnapshot();
  clearEl(el);
  if (!stand) { el.hidden = true; return; }
  el.hidden = false;
  el.className = 'bs-' + stand.tone;
  for (const line of stand.lines) {
    const p = document.createElement('p');
    p.textContent = line;
    el.appendChild(p);
  }
}

// ---- story beats ----------------------------------------------------------------
function beats() {
  while (chapterIdx < CHAPTERS.length && dayMin >= CHAPTERS[chapterIdx].t) {
    const ch = CHAPTERS[chapterIdx++];
    if (eveningFast || (rushFast && ch.t < 840)) continue;
    fx.card(ch.k, ch.sub); audio.card();
    // Beat push-ins only at readable speeds — at 20× the chapters fly by and
    // the camera would whip around every few seconds. Cards still show.
    if (ch.beat && speed <= 300) rig.focus(world.focus[ch.beat] || world.focus.wide, ch.beat === 'wide' ? 26 : 13, 5);
    if (ch.notebook) fx.notebook(true);
    if (ch.wave) {
      rig.shake(0.3);
      if (prebatched) { fx.toast(`the wave hits a warm till — ${ctx.batchUnits} cups reserved`, 'good'); prebatchHelped = true; }
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
  // Once the morning is underway, say the held / tab miss out loud if the
  // brief's numbers are easy to play past. Day 2 under the nut stays quiet.
  if (!nudgedStanding && !softDay && dayMin >= 600 && !closed) {
    nudgedStanding = true;
    const nudge = standingNudge(standingSnapshot(), day);
    if (nudge && !headless) fx.toast(nudge.text, nudge.tone);
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
  if (!rushFast && !nudgedPrice && dayMin >= 800 && dayMin < 840 && !repriced) {
    nudgedPrice = true;
    fx.toast(`14:00 is close — 2 sells matcha at ${fmt(ECON.matchaDeal)}`, 'warn');
    $('reprice').classList.add('attention');
  }
  // a regular's ask — once per day at 11:00, pauses the floor for a yes/no
  if (!offerShown && dayMin >= 660 && dayMin < 840) { offerShown = true; showOffer(); }
  // the floor bites back — one incident per day from day 2, post-wave
  // (the offer modal doubles as the incident card — same pause path)
  if (day >= 2 && !incidentShown && dayMin >= 895 && dayMin < 1015 &&
      !$('offer').classList.contains('show')) { incidentShown = true; showIncident(); }
  wifiBeats();
  // Phase 4 — the truce: day 3, pre-wave, Sam comes over himself. Split
  // Saturday (guaranteed mediocrity: no bleeding, no feast) or play on.
  if (day === 3 && !truceShown && dayMin >= 600 && dayMin < 1000 &&
      !$('offer').classList.contains('show')) {
    truceShown = true;
    presentBeat({
      who: COPY.rivalBarista + ', across the road',
      line: '“Saturday. You don’t bleed, I don’t feast. We split the street and both survive it.” He doesn’t offer his hand. He waits.',
      effect: 'ceasefire Saturday: no defections either way, both rooms run ~8% quieter · or play on and he’ll remember the snub',
      yes: 'split Saturday', no: 'play on',
      accept() { samTruce = true; fx.toast('Saturday ceasefire — no bleeding, no feast', 'good'); },
      decline() { samGrudge.snubs += 1; fx.toast('Sam nods slowly. He’ll remember that.', 'warn'); },
    }, 'an offer · y / n', false);
  }
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
      till -= solicitorCharge * perkCostMul; regulars.adjustOpinions(-0.1);
      fx.toast(`the scald claim stuck — −£${solicitorCharge} and the story did the rounds`, 'bad');
    } else fx.toast('the scald claim went away — their solicitor stopped calling', 'good');
  }
  // Ruth breaks — pushed under a fifth of her condition and worked anyway,
  // she fails on the floor: asleep at the counter or sharp with a regular.
  if (canHaveStaffCrisis({ day, staffing: onRobotHire() ? 'robot' : baristaHomeToday ? 'home' : apprenticeHiredToday ? 'apprentice' : 'work', condition: baristaCondition, crisis: baristaCrisis, dayMin })) {
    baristaCrisis = true;
    if (Math.random() < 0.5) { patrons.staffMul = 0.5; fx.toast('Ruth’s gone quiet — she’s asleep on the back counter. The bar crawls.', 'bad'); }
    else { regulars.adjustOpinions(-0.2); fx.toast('Ruth snapped at a regular — the room went cold.', 'bad'); }
    try { analytics.track('staff_crisis', { day, condition: Math.round(baristaCondition * 100) / 100 }); } catch {}
  }
  momentScan();
  momentPump();
  // 17:00: the rush, the incident, and any deferred ask have landed.
  // One call, then the evening resolves itself. Headless holds and keeps
  // ticking so a full day still closes at 21:00.
  if (!eveningCallShown && dayMin >= 1020 && !closed) {
    if (!headless && modals.top()) return;
    eveningCallShown = true;
    const read = waveRead();
    const waveN = read.waveServed + read.waveBalked;
    if (waveN > 0 && !headless) { fx.toast(`the wave: ${read.waveServed} served · ${read.waveBalked} walked`, read.ratio <= 0.15 ? 'good' : 'warn'); showWavePowered(7000); }
    if (waveN > 0 && !headless) {
      const win = read.waveServed >= 30 && read.ratio <= 0.15;
      try {
        feel({ object: win ? world.tillDrawer : world._chalkPlane, always: true });
        if (win) audio.waveFanfare(read.waveServed); else audio.waveRain(read.waveBalked);
        if (win && speed <= 300) rig.focus(world.focus.counter, 11, 3.5);
        if (win) { fx.coinRain(LAYOUT.register.x, 1.5, -5.2, Math.min(22, 10 + Math.round(read.waveServed / 10))); }
        if (win) fx.victoryBurst(read.waveServed);
        if (navigator.vibrate) navigator.vibrate(win ? [20, 30, 50] : [40, 50, 80]);
        if (win) world.setPlantHealth(Math.max(0, patrons.queueLength - 2));
        else {
          // Harder than the 14:00 wave-start shake (0.3). The counter hold
          // matches the win crane, and only at a readable speed. 12 sits in
          // the plant's brown band (queue > 10). This tick's HUD then paints
          // the plant from the live line, and the evening paper pauses
          // before another paint, so the wilt lands after that one.
          rig.shake(0.55);
          if (speed <= 300) rig.focus(world.focus.counter, 11, 3.5);
          world.setPlantHealth(12);
          queueMicrotask(() => { try { world.setPlantHealth(12); } catch {} });
        }
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
  const sub = !lever
    ? (!waveBalked
      ? 'The wave passed quietly.'
      : ratio <= 0.06
        ? 'The raw bar held — nobody staged, nobody needed it.'
        : ratio <= 0.15
          ? 'The wave cost a few — a batch would have kept them.'
          : 'No pre-batch — the wave ate you.')
    : lever === 'deal'
      ? (ratio <= 0.06 ? 'You held the line.' : ratio <= 0.15 ? 'The call paid off.' : 'Tough wave — the deal bought patience, not speed.')
      : (ratio <= 0.06 ? 'You held the line.' : ratio <= 0.15 ? 'The call paid off.' : 'Tough wave — top up earlier tomorrow.');
  const why = lever === 'prep'
    ? `${waveBatchServed} batch cups poured${waveStockoutAt ? ` · the batch ran dry around ${Math.floor(waveStockoutAt / 60)}:${String(waveStockoutAt % 60).padStart(2, '0')}` : ` · ${ctx.batchUnits} left on the bar`}`
    : lever === 'deal'
      ? `the ${fmt(ECON.matchaDeal)} deal cut queue-abandonment odds to a quarter — milk or card incidents can still lose orders`
      : 'every matcha poured made-to-order — four minutes a cup';
  const tomorrow = lever === 'prep'
    ? 'tomorrow — prep again; top up in the wave once cups hit 8'
    : lever === 'deal'
      ? 'tomorrow — the deal trades speed for patience; pre-batch is the faster route'
      : 'tomorrow — prep before 14:00 buys speed · a price cut buys patience';
  const lines = [
    `what happened — ${waveServed} served · ${waveBalked} walked`,
    `why — ${why}`,
    tomorrow,
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
  // PR-3 — debrief beat: the leaderboard line surfaces the district standings
  setBeatPower('evening', BEAT_POWERED.evening);
  const body = $('evening-read');
  const partyLine = partyLineText();
  const stand = softDay ? null : standingSnapshot();
  if (body) {
    const chunks = [read.sub, ...read.lines];
    if (partyLine) chunks.push('', partyLine);
    if (stand) chunks.push('', ...stand.lines);
    body.textContent = chunks.join('\n');
  }
  const residual = residualEveningCups();
  const left = $('evening-left');
  if (left) {
    const q = patrons.queueLength;
    let txt = ctx.batchUnits > 0
      ? ctx.batchUnits + ' cups still ready — leftovers spoil at close'
      : (prebatched ? 'no cups left on the bar' : 'no cups ready');
    if (residual > 0) {
      if (q <= 5 && residual < ECON.batchUnits / 2)
        txt += ` · evening usually brings ~${residual} people — hold is enough`;
      else
        txt += ` · evening usually brings ~${residual} people`;
    } else if (q <= 5) {
      txt += ' — hold is enough';
    }
    left.textContent = txt;
  }
  // The stake rides the buttons: closing forfeits the evening's footfall.
  const holdSmall = $('evening-hold')?.querySelector?.('small');
  const closeSmall = $('evening-close')?.querySelector?.('small');
  if (holdSmall) holdSmall.textContent = residual > 0
    ? `keep trading · ~${residual} still coming`
    : 'keep what’s left · then the receipt';
  if (closeSmall) closeSmall.textContent = residual > 0
    ? `close now · forfeit ~${residual}`
    : 'close now · no evening trade';
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
  return party.name + '’s group: ' + party.served + ' stayed · ' + party.walked + ' walked';
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

// Case revenue lands, then the lender is paid from the till, then pitch
// is quoted on what remains. The tab is not drawn ahead of the loan.
function settleStockLoanAtClose() {
  if (closeTillOverride != null) {
    till = closeTillOverride;
    closeTillOverride = null;
  }
  if (caseUnits > 0 && !loan.seized) {
    caseRevenueToday = caseRevenue(caseUnits * CASE_COST);
    till += caseRevenueToday;
    caseUnits = 0;
  } else caseRevenueToday = 0;
  const realTill = Math.max(0, till);
  const offer = loanCashCap == null ? realTill : Math.min(realTill, Math.max(0, loanCashCap));
  loanCashCap = null;
  loanClaim = quoteClose({
    till: realTill,
    cash: offer,
    balance: loan.balance,
    pitchMin: CAMPAIGN.pitchMin + (dayMods.pitchMinDelta || 0),
    pitchPct: CAMPAIGN.pitchPct + (dayMods.pitchPctDelta || 0),
  });
  loan.settle(offer, { weekEnd: day >= CAMPAIGN.days });
  // A skipped morning (nothing paid) must leave the till bit-for-bit.
  if (loanClaim.loanPaid > 0) till = loanClaim.tillAfterLoan;
  salesTillForOps = realTill;
}

function closeDay() {
  if (closed || phase !== 'trading') return;
  closed = true;
  phase = 'review';
  coachTick();
  audio.closing();
  if ($('again')) $('again').style.display = 'none';   // mid-campaign: the letter drives the next day, not this button
  if ($('shareWeek')) $('shareWeek').style.display = 'none';
  // Unsold croissants were never in the dawn debit. The close charge is
  // the leftover count times the croissant wholesale (PASTRY.cogs, £0.70).
  // Sold units already paid that same wholesale at the register, so this
  // bill is only the case that did not sell. Booked before takings so the
  // day's result carries the loss once.
  pastryWaste = Math.max(0, ctx.pastryStock | 0);
  pastryWasteCost = Math.round(pastryWaste * PASTRY.cogs * 100) / 100;
  if (pastryWasteCost) till -= pastryWasteCost;
  // The case sells through into the till, then the lender is paid, and only
  // then is the day's revenue booked. Pitch (below) sees the till after that.
  settleStockLoanAtClose();
  cRev += till; cBalked += balked; cServed += served + servedRetail; cDef += defections;
  cRivalServed += rivalServed; cRivalChoices += patrons.rivalChoices;   // PR-B1 — accumulate rival week tally
  lastDayStats = { sold: served + servedRetail, balked, defections, rivalServed, rivalChoices: patrons.rivalChoices };   // the Brief reads these at dawn — PR-B1 adds rival data
  // Ruth's ledger — a worked day drains (harder on a brutal floor), a
  // sent-home day recovers. The cost is real: her wage is saved but the
  // bar runs a third slower while she's off. Apprentice gives partial rest.
  const ruthWasHome = baristaHomeToday;
  const hiredApprentice = apprenticeHiredToday;
  const robotShift = onRobotHire();
  if (robotShift) {
    // Ruth is off the rota for the stretch. She doesn't drain, and the
    // robot doesn't rest its way into her condition.
    quietCarry = Math.min(1, Math.round((quietCarry + (CAMPAIGN.staff.quietStep || 0)) * 1000) / 1000);
  } else if (ruthWasHome) { baristaCondition = Math.min(1, baristaCondition + 0.45); baristaRested = true; }
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
  // awareness, and today's served × loyalty become tomorrow's returnees.
  // Phase 1: evangelist serves preach — each brings +2 back (womReturnees).
  // Phase 2: today's non-matcha pour sizes tomorrow's restock button.
  lastPour = pouredOther;
  // Phase 4 — advice ignored: the rumour warned, the player rode naked.
  if (exchange.event?.id === 'rumour_frost' && !exchange.contract) ignoredAdvice++;
  // The Row's purposes land at close: a hub stand brings returnees
  // tomorrow, a draw stand nudges street awareness (applied after
  // resolveDay's own clamp, clamped once more) — values in FRANCHISE.purposes.
  const rowFx = franchise.effectsDue(day);
  const dtrace = demand.resolveDay({
    served: servedN, reputation: regulars.reputation, eventTier: exchange.event?.tier,
    extraReturnees: womReturnees(evangelistServes) + rowFx.returnees,
    priceLevel: ticketLevel(menuPrices, salePrice(exchange, repriced) * (ctx.priceMult || 1)),
    cupQuality: currentCupQuality(),
    queueBalks: Math.max(0, balked - milkBalked),
    milkBalks: milkBalked,
    attracted: servedN + balked,
  });
  if (rowFx.awareness) { demand.awareness = Math.min(1, Math.max(0, demand.awareness + rowFx.awareness)); dtrace.after = demand.awareness; }
  franchiseFxToday = rowFx;   // receipt names what the neighbours add
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
  const roomQuiet = robotShift || quietCarry > 0;
  regulars.resolveDay({
    served: servedN, balked, defections, priced: repriced,
    warmth: roomQuiet ? CAMPAIGN.staff.robotWarmth : 1,
    landVisit: (i) => visitLands(i + day, { robot: robotShift, quiet: quietCarry }),
  });
  if (robotShift) regulars.adjustOpinions(quietOpinionDrag(CAMPAIGN.staff.quietStep || 0));
  const offer = earnedRestDay(day, { reputation: regulars.reputation, served: servedN, balked, campaignDays: CAMPAIGN.days });
  if (offer) ruthRestOffer = offer;
  batchWaste = Math.max(0, ctx.batchUnits | 0);
  const wasteCost = batchWaste * (ECON.batchCupCost || 1);
  // pastryWasteCost was billed at the top of close, before takings. The
  // cabinet can empty now; the charge already left the till.
  lastRetail = servedRetail;
  ctx.pastryStock = 0;
  // Phase 6 — autopsy record: one cause row per day (stale cups by lot,
  // waste, compost, balks, defections, take-home, opinion deltas vs dawn).
  // weekOpStart doubles as the per-day baseline and is refreshed at close.
  try {
    const opDrops = [];
    for (const r of regulars.regulars) {
      const from = weekOpStart?.get(r.name);
      if (Number.isFinite(from) && Number.isFinite(r.op) && r.op < from - 0.05) {
        opDrops.push({ name: r.name, from, to: r.op });
      }
    }
    campaignDays.push({
      day, staleCupsByLot: { ...staleByLotToday },
      batchWaste, pastryWaste, compost: compostToday, pastryWasteCost, balked, defections, netToday: null, opDrops,
      turnaways,
      emergencyCups, emergencySpend, interest: interestToday, event: exchange.event?.id || null, covered: hedgedCups > 0 || !!exchange.contract,
    });
    weekOpStart = new Map(regulars.regulars.map((r) => [r.name, r.op]));
  } catch {}
  // Phase 3 — milk + skill close: leftover milk tips (tomorrow's delivery
  // adapts), training compounds into Ruth's skill (+1 bar point per level,
  // max 2 — level-ups toast once).
  lastMilky = ctx.milky || 0;
  milkTipped = Math.max(0, ctx.milkStock || 0);
  trainingTotal += trainingSpend;
  const newSkill = Math.min(2, Math.floor(trainingTotal / 36));
  if (newSkill > ruthSkill) {
    ruthSkill = newSkill;
    fx.toast(`Ruth’s levelling up — +${ruthSkill} bar point${ruthSkill > 1 ? 's' : ''}, and she cups the sour shots`, 'good');
  }
  const ops = operatingCosts({
    till: salesTillForOps == null ? till : salesTillForOps, served: servedN,
    staffing: robotShift ? 'robot' : ruthWasHome ? 'home' : hiredApprentice ? 'apprentice' : 'work',
    marketing: marketingSpend,   // the sponsor invoice arrives with the milk bill
    training: trainingSpend, sampling: sampleSpend,
    maintenance: maintenanceBill,
    perkCostMul, modifiers: dayMods,
  });
  // Loan repayment left the till first, so the pitch floor (and the turnover
  // top-up) are worked out on what remains. Card fees stay on the sales.
  if (loanClaim && loanClaim.loanPaid > 0) {
    ops.total += loanClaim.pitch - ops.pitch;
    ops.pitch = loanClaim.pitch;
  }
  lastOps = ops;
  marketingSpend = 0;
  cOps += ops.total;
  // Ledger model, three funds, no double-count: (1) the till — today's
  // takings, already NET of per-cup emergency charges (the serve loop bills
  // e.spotCost against it); (2) the tab — dawn sacks + fees/interest ride
  // exchange.debt, which the verdict nets once; (3) cash P&L — cCost carries
  // matcha cogs ONLY. beanCostToday is therefore cogs alone; beanSpend (the
  // day's bean outlay: sacks on tab + emergency cash) is a receipt-only
  // display tally, and emergencySpend its cash half.
  const beanCostToday = cogs;
  cCost += beanCostToday;
  const operatingNet = till - beanCostToday - ops.total;
  const netToday = operatingNet - feeToday - interestToday;   // today's take-home — settlement rides the balance sheet, not the P&L
  // Phase 6 — stamp take-home onto today's autopsy row (pushed above).
  try {
    const row = campaignDays[campaignDays.length - 1];
    if (row && row.day === day) row.netToday = netToday;
  } catch {}
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
  // committed costs — the supplier calls it at zero. Held is a second bar
  // (cash and regulars); the standing lines name both.
  const worthNow = cRev - cCost - cOps - settledPaid - exchange.debt;
  const stand = softDay ? null : weekStanding({
    net: worthNow, rep: regulars.reputation, day, days: CAMPAIGN.days, asOf: 'close',
    recent: recentTakeHome(),
  });
  if (stand && stand.insolvent) verdict += ' ' + stand.cashLine;
  else if (worthNow < ops.total) verdict += ` The week so far is ${fmt(worthNow)} — today’s operating costs were ${fmt(ops.total)}.`;
  if (stand && stand.repShort) verdict += ' ' + stand.repLine;
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
  const lessons = [];
  if (day === 1 && !softDay) {
    lessons.push(`Running the café today cost ${fmt(ops.total)} — ${(ops.marketing || ops.training || ops.sampling) ? 'including ' : ''}staff, pitch rent, milk and cups, card fees, power, wifi and insurance — paid at closing.`);
  }
  if (stand) lessons.unshift(...stand.lines);
  const menuVisible = introducedSet().has('menu') || toolsIntroducedToday.includes('menu');
  const menuServedLine = () => {
    const off = DRINK_IDS.filter(id => menuOffered[id] === false);
    return `Served: ${DRINK_IDS.map(id => `${DRINKS[id].name} ${servedByDrinkToday[id] || 0}`).join(' · ')}${off.length ? ` · off the menu: ${off.map(id => DRINKS[id].name).join(', ')}` : ''}`;
  };
  const menuNeedsLine = DRINK_IDS.some(id => menuOffered[id] === false) && menuVisible;
  for (const t of toolsIntroducedToday) {
    if (t === 'coffee') {
      const h = lotState.entry(lotState.house);
      const nm = LOT_CATALOG[lotState.house]?.name || lotState.house;
      const stale = staleByLotToday[lotState.house] || 0;
      lessons.push(`${nm}: ${pouredByLotToday[lotState.house] || 0} cups poured · ${h ? h.stock : 0} left${stale ? ` · ${stale} tasted stale` : ''}`);
    } else if (t === 'menu') lessons.push(menuServedLine());
    else if (t === 'street') {
      const stagedLabels = DEMAND_ACTIONS.filter(a => dtrace.staged && dtrace.staged[a])
        .map(a => a === 'sample' ? 'sampling' : a === 'sponsor' ? 'sponsoring' : a).join(' · ');
      if (stagedLabels) lessons.push(`Street work: ${stagedLabels} · ~${dtrace.returnees} expected back tomorrow`);
    } else if (t === 'tab' && settleToday > 0) lessons.push(`Tab settled: ${fmt(settleToday)}`);
  }
  if (menuNeedsLine && !toolsIntroducedToday.includes('menu')) lessons.push(menuServedLine());
  // Board cause-and-effect: name the turnaway drink so gutting the menu reads
  // as a decision with a consequence, not a silent slowdown.
  if (turnaways > 0) {
    const off = DRINK_IDS.filter(id => menuOffered[id] === false).map(id => DRINKS[id].name);
    lessons.push(`${turnaways} read the board and left${off.length ? ` — off the menu: ${off.join(', ')}` : ''}. Put it back on tomorrow.`);
  }
  for (const r of regulars.regulars) {
    for (const ev2 of r.events) {
      if (ev2.day === day && ev2.outcome === 'balked') lessons.push(`${r.name} walked out of the line.`);
      else if (ev2.day === day && ev2.outcome === 'defected') lessons.push(`${r.name} crossed to Glasshouse.`);
    }
  }
  for (const c of (patrons.companionsToday || [])) lessons.push(`${c.name} brought ${c.friend}.`);
  if (pastryMissDrinks + pastryMissWalks > 0) lessons.push('The case sold out. Most still bought a drink. One in four left, and the room noticed.');
  if ($('receipt-heading')) $('receipt-heading').textContent = softDay ? 'SOFT OPENING' : 'GRUNDS';
  if ($('receipt-sub')) $('receipt-sub').textContent = softDay ? 'soft opening · practice ledger' : 'end of day · Z-read';
  const receiptData = softDay ? {
    lessons: ['Practice money — today’s takings don’t count toward the week.', ...lessons],
    lines: [
      [standName, playerName],
      ['served', served + servedRetail],
      ['walked', balked],
      ['takings', fmt(till + batchSpend)],
      ...(batchSpend > 0 ? [['matcha batch bought', `−${fmt(batchSpend)}`]] : []),
      ...(batchWaste > 0 ? [['matcha wasted', `${batchWaste} · ${fmt(wasteCost)}`]] : []),
      ...(pastryWasteCost > 0 ? [['unsold croissants', `${pastryWaste} · ${fmt(pastryWasteCost)}`]] : []),
      ...(pastryMissDrinks + pastryMissWalks > 0 ? [['the case sold out', `${pastryMissDrinks} took a drink · ${pastryMissWalks} left · the room noticed`]] : []),
      ...(party && !party.declined ? [[party.name + '’s group', `${party.served} stayed · ${party.walked} walked`]] : []),
      ...(party && party.declined ? [[party.name, 'stayed away']] : []),
    ],
    verdict: 'Soft opening',
    forecast: null,
    summary: 'a quiet day — the week starts from a clean sheet',
    netToday: till, operatingNet: till, ops: { total: 0 }, hedgeSavings: 0, fees: 0,
  } : {
    lessons,
    lines: [
      [standName, playerName],
      // Till is already net of emergency cups (billed at serve); lot sacks
      // never touched it (they ride the tab). Only batch prep grosses back.
      ['revenue', fmt(till + batchSpend - franchiseRentToday)],
      // The rent line splits a tenant's commercial lease out of the
      // peppercorn base — the player's purpose choice is visible on paper,
      // not folded silently into one number.
      ...(franchiseRentToday - (franchiseFxToday.rentBonus || 0) > 0 ? [['The Row · stand rent', `+${fmt(franchiseRentToday - franchiseFxToday.rentBonus)}`]] : []),
      ...(franchiseFxToday.rentBonus > 0 ? [['The Row · a tenant’s lease', `+${fmt(franchiseFxToday.rentBonus)}`]] : []),
      // Purpose bonuses settled at close: not money, so no £ — the draw
      // lifted awareness into tomorrow, the hub sent returnees home happy.
      ...(franchiseFxToday.awareness > 0 ? [['The Row · a draw', `+${franchiseFxToday.awareness.toFixed(2)} awareness carried into tomorrow`]] : []),
      ...(franchiseFxToday.returnees > 0 ? [['The Row · a hub', `+${franchiseFxToday.returnees} returnees tomorrow`]] : []),
      ['bean cost', fmt(beanCostToday)],
      ...(batchSpend > 0 ? [['matcha batch bought', `−${fmt(batchSpend)}`]] : []),
      ...(batchWaste > 0 ? [['matcha wasted', `${batchWaste} · ${fmt(wasteCost)}`]] : []),
      ...(pastryWasteCost > 0 ? [['unsold croissants', `${pastryWaste} · ${fmt(pastryWasteCost)}`]] : []),
      ...(pastryMissDrinks + pastryMissWalks > 0 ? [['the case sold out', `${pastryMissDrinks} took a drink · ${pastryMissWalks} left · the room noticed`]] : []),
      ...(beanSpend > 0 ? [['beans stocked', `−${fmt(beanSpend)}${sackSpend > 0 ? ` (${fmt(sackSpend)} on the tab)` : ''}`]] : []),
      ...(compostToday > 0 ? [['stale composted', `${compostToday} cups`]] : []),
      ...(milkTipped > 0 ? [['milk tipped', `${milkTipped} units`]] : []),
      ...(hedgedCups > 0 ? [['hedge benefit (before fees)', fmt(realizedHedgeSavings)],
                            ...(feeToday > 0 ? [['hedge net of the fee', fmt(realizedHedgeSavings - feeToday)]] : [])] : []),
      ['staff', fmt(ops.staff)],
      ...(ops.maintenance > 0 ? [['call-out', fmt(ops.maintenance)]] : []),
      ['milk + cups' + (dayMods.suppliesDelta ? ' (incl. oat surcharge)' : ''), fmt(ops.supplies)],
      ...(loanClaim && loanClaim.due > 0
        ? [[loanClaim.loanUnpaid > 0 ? 'loan unpaid' : 'loan due', fmt(loanClaim.loanUnpaid > 0 ? loanClaim.loanUnpaid : loanClaim.due)]]
        : []),
      ['pitch rent' + (dayMods.pitchMinDelta ? ' (incl. reval)' : ''), fmt(ops.pitch)], ['card fees', fmt(ops.fees)],
      ['electricity', fmt(ops.power)], ['wifi', fmt(ops.wifi)],
      ...(wifiOutage && wifiOutage.tethered ? [['phone hotspot (outage)', `−${fmt(wifiOutage.tetherCost)} from the till`]] : []),
      ['insurance & cleaning', fmt(ops.sundries)],
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
      ['chose ' + COPY.rivalName, patrons.rivalChoices],
      ...(turnaways > 0 ? [['left at the board', turnaways + ` (no ${DRINK_IDS.filter(id => menuOffered[id] === false).map(id => DRINKS[id].name).join(' / ') || '—'} today)`]] : []),
      ['—', '—'],
      ['you vs ' + COPY.rivalBarista, `you ${served + servedRetail} · ${COPY.rivalBarista} ${rivalServed + patrons.rivalChoices}`],   // PR-B1 — side-by-side
      ['NET TODAY', fmt(netToday)],
      ...(settleToday > 0 ? [['debt settled (balance payment)', fmt(settleToday)]] : []),
    ],
    verdict,
    forecast,
    summary: `net today ${fmt(netToday)} · ${served + servedRetail} served · ${balked} walked · ${
      (() => { const h = lotState.entry(selectedLot); return h && h.stock <= 0 ? 'Tomorrow: choose/restock house coffee; supplier tab funds supplies · ' : ''; })()}${
      prebatched ? 'tomorrow: prep again — top up when cups hit 8'
      : repriced ? 'tomorrow: a pre-batch serves faster than the deal'
      : 'tomorrow: prep before 14:00 — or cut the price for patience'}`,
    netToday, operatingNet, ops, hedgeSavings: realizedHedgeSavings, fees: ops.fees,
  };
  lastDayReceipt = { ...receiptData, day };
  fx.receipt(receiptData);
  if ($('review-continue')) {
    $('review-continue').style.display = '';
    $('review-continue').textContent = softDay ? 'open the week →'
      : worthNow < 0 ? 'the supplier calls the tab →'
      : day >= CAMPAIGN.days ? 'the week’s verdict →'
      : 'open day ' + (day + 1) + ' →';
  }
  if ($('review-letter')) $('review-letter').style.display = softDay ? 'none' : '';
  if ($('receipt-back')) $('receipt-back').style.display = 'none';
  refreshStands();
  if (!softDay && sync.managed && sync.managed()) {
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

// Phase 4 — Idris's memory, assembled for the letter. Quotes real state:
// yesterday's hedge vs the board move, settled tabs, ignored rumours, the
// house roast pour, and the most-visited regular. Loyal = 2+ covers taken.
function buildIdrisMemory(snap) {
  let top = null;
  try {
    for (const r of regulars.regulars) {
      if (!top || r.visits > top.visits) top = r;
    }
  } catch {}
  const houseEntry = lotState.entry(lotState.house);
  return {
    contractsTaken, settledCount, ignoredAdvice,
    loyal: contractsTaken >= 2,
    lastHedge: snap.lastHedge ?? null,
    boardMoved: snap.indexPrev != null ? snap.index - snap.indexPrev : 0,
    houseLot: LOT_CATALOG[lotState.house]?.name || lotState.house,
    houseRoast: houseEntry?.roast ?? 3,
    houseAge: lotState.age(lotState.house, snap.day),
    topRegular: top && top.visits > 5 ? { name: top.name, visits: top.visits } : null,
  };
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
    lastHedge,
  };
  snap.idris = buildIdrisMemory(snap);
  snap.row = rowSummary(snap.day);   // the letter speaks to the day ahead
  const L = composeLetter(snap);
  $('letter-head').textContent = L.head;
  $('letter-body').textContent = L.body;
  $('letter-sign').textContent = L.sign;
  const btns = $('letter-actions'); btns.innerHTML = '';
  // Phase 4 — Idris asks (the letter modal's only buttons): when the Gesha
  // window is open and no sack is held, he offers to hold 60 cups. Local
  // answer, local effect — never through the hedge protocol.
  renderIdrisAsk();
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

// Phase 4 — Idris asks: when the Gesha window is open and no sack is held,
// he offers to hold 60 cups at the board. Local answer, local effect.
function renderIdrisAsk() {
  const box = $('letter-actions'); if (!box) return;
  const g = lotState.entry('gesha');
  if (!g || !g.unlocked || idrisHeldSack) return;
  const price = lotSpot('gesha', exchange.beanIndex, g.priceMul);
  const cost = 60 * price;
  if (till < cost) return;   // no insulting offers
  const row = document.createElement('div');
  row.style.cssText = 'margin-top:10px;font-size:11.5px';
  const q = document.createElement('div');
  q.style.cssText = 'font-style:italic;opacity:.8;margin-bottom:6px';
  q.textContent = `“Panama gesha in — sixty cups, going fast. Want me to hold you a sack at ${fmt(cost)}?” — Idris`;
  const hold = document.createElement('button');
  hold.id = 'idris-hold';
  hold.textContent = `hold one · ${fmt(cost)}`;
  hold.onclick = () => {
    const r = lotState.buy('gesha', 60, price, day, {});
    if (!r.cups) { fx.toast('the sack slipped away — window closed', 'warn'); return; }
    till -= r.cost; beanSpend += r.cost; idrisHeldSack = true;
    fx.toast(`Idris held the Gesha — ${r.cups} cups in the cellar`, 'good');
    renderIdrisAsk();
  };
  const pass = document.createElement('button');
  pass.id = 'idris-pass';
  pass.textContent = 'pass';
  pass.style.cssText = 'margin-left:6px';
  pass.onclick = () => { try { row.remove(); } catch {} };
  row.appendChild(q); row.appendChild(hold); row.appendChild(pass);
  box.appendChild(row);
}

function markBriefChoice(id) {
  briefChoice = id;
  // rebuild brief choice row highlight
  try {
    for (const b of [...document.querySelectorAll('#brief-actions button')]) {
      const on = b.dataset.id === id;
      b.style.borderColor = on ? 'var(--brass)' : '';
      b.style.background = on ? 'rgba(201,162,39,.3)' : '';
      b.style.color = on ? '#2a241c' : '';
      b.style.fontWeight = on ? '700' : '';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const selTxt = $('brief-sel');
    if (selTxt) {
      selTxt.textContent = !id ? ''
        : id === 'hold' ? 'riding the spot'
        : id === 'settle' ? `settling ${fmt(exchange.debt)}`
        : `${String(id).replace('contract_', '')} cover · ~${(hedgeTerms(id, contractFeeExtra)?.units || 0).toFixed(0)} cups`;
      selTxt.style.display = selTxt.textContent ? '' : 'none';
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
    // The robot replaced both of them. Home and the apprentice are Ruth's.
    if (hireLocked && weekHire === HIRE_ROBOT && patch.staffing !== 'work') return false;
    if (patch.staffing !== 'work' && !canChooseStaffing(day, baristaCondition) && ruthRestOffer !== day) return false;
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
  syncBarStaff(cand.staffing);
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
    staffCondition: ruthRestOffer === day ? Math.min(baristaCondition, 0.54) : baristaCondition,
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
  // The decision's debt is the pre-bean tab (contract fee + interest ±
  // settlement). The dawn top-up + emergency cups accrue into it below —
  // applyLots and the serve loop own the bean side of the tab.
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
  // Phase 4 — Idris keeps score: covers taken, tabs settled.
  if (hedge && hedge.startsWith('contract')) contractsTaken++;
  if (hedge === 'settle') settledCount++;
  lastHedge = hedge || 'hold';
  // Ruth's shift lands here — staged in the Brief, committed with the hedge.
  // Sent home: bar −30% today, her wage saved tonight, she recovers at close.
  // Apprentice: hire temp barista, Ruth half-day rest, extra speed.
  // Day 1 of the real week locks the hire. The robot replaces both of them.
  if (!softDay && day === 1) hireLocked = true;
  if (onRobotHire()) {
    baristaHomeToday = false;
    apprenticeHiredToday = false;
  } else {
    baristaHomeToday = res.plan.staffing === 'home';
    apprenticeHiredToday = res.plan.staffing === 'apprentice';
  }
  baristaStaged = false;
  // Street work lands here too — staged at dawn, paid today, felt tomorrow.
  // Sampling burns cups out of today's COGS; sponsoring invoices the ops sheet.
  fundMorningLoan(res.plan);
  if (res.plan.marketing.sample) { sampleSpend += CAMPAIGN.demand.sampleCost; fx.toast(`Sampling today — ${fmt(CAMPAIGN.demand.sampleCost)} in cups for the street`, ''); }
  if (res.plan.marketing.sponsor) { marketingSpend += Math.max(0, CAMPAIGN.demand.sponsorCost - loanSponsorCover); fx.toast(`Stall sponsored — ${fmt(CAMPAIGN.demand.sponsorCost)} on the sheet, the street hears`, 'good'); }
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
  // PR-A1 — fire any prep levers the player staged in the Brief.
  applyStagedPrep();
  // Phase 2 — set the house lot and execute the staged top-up.
  applyLots();
  // Phase 3 — commit staged menu prices + 86 board.
  applyMenu();
  applyDawnShock();
  try { modals.close('brief'); } catch {}
  applySeizureBoard();
  {
    const toolsNow = toolsToday || briefTools();
    for (const t of [toolsNow.newToday, ...(toolsNow.essentialNew || [])].filter(Boolean)) {
      if (!introducedSet().has(t)) { introducedSet().add(t); toolsIntroducedToday.push(t); }
    }
    persistIntroduced();
  }
  if (day === 1 && guidedOpening && !coach && !coachedOpening) coachBegin(true);
  briefSyncError('');
  return { ok: true };
}

function commitDayPlan() {
  if (phase !== 'planning' || !planDraft) return { ok: false, why: 'not planning' };
  const plan = normalizePlan(planDraft);
  leversTimeLocked = true;
  if (!softDay && sync.managed && sync.managed()) {
    phase = 'committing';
    const gen = runGen;
    briefSyncError('saving the plan…');
    const ob = $('brief-open'), mb = $('letter-mail-btn');
    if (ob) ob.disabled = true; if (mb) mb.disabled = true;
    const fail = (why) => {
      phase = 'planning';
      briefSyncError('Could not save the plan. Retry or start a local-only week.', true);
      try { fx.toast('Could not save the plan. Retry or start a local-only week.', 'warn'); } catch {}
      try { if (!modals.top()) modals.open('brief'); } catch {}
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
  if (softDay) { beginWeek(); return true; }
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

function clearEl(el) {
  if (!el) return;
  el.textContent = '';
  for (const c of [...(el.children || [])]) c.remove?.();
}

// Brief drawers remember the player's last toggle across mornings — a stored
// preference beats the auto-open heuristics once the drawer has been touched.
const DRAWER_KEY = id => `grunds:drawer:${id}`;
function drawerOpen(id, autoOpen) {
  try { const v = localStorage.getItem(DRAWER_KEY(id)); return v === null ? autoOpen : v === '1'; }
  catch { return autoOpen; }
}
function watchDrawer(det, id) {
  det.addEventListener?.('toggle', () => { try { localStorage.setItem(DRAWER_KEY(id), det.open ? '1' : '0'); } catch {} });
}

function renderPlanQuote() {
  const nutEl = $('brief-nut'); if (!nutEl || !planDraft) return;
  const q = quoteDayPlan({
    day, hedge: planDraft.hedge, staffing: onRobotHire() ? 'robot' : planDraft.staffing, marketing: planDraft.marketing,
    debt: exchange.debt, extraFee: contractFeeExtra, perkCostMul, modifiers: modifiersForDay(day),
  });
  // The cellar stages at dawn prices: show the restock's tab impact in the
  // quote so OPEN prices the sack before it lands.
  const stQ = lotState.entry(selectedLot);
  const cellarBit = (() => {
    if (!stQ || stQ.unlocked === false || topUpCups <= 0) return null;
    const res = resolveDecision(planSnapshot(), normalizePlan(planDraft));
    if (!res.ok) return `cellar — this plan can't land: ${res.why}`;
    const unitPrice = res.contract && res.contract.units > 0
      ? res.contract.price * 1.3
      : lotSpot(selectedLot, dawnIndex, stQ.priceMul);
    const cups = Math.max(0, Math.floor(topUpCups));
    const name = LOT_CATALOG[selectedLot]?.name || selectedLot;
    if (!(unitPrice > 0)) return `cellar — ~${cups} ${name} cups, price pending the dawn board`;
    const funded = fundedRestock(selectedLot, cups, { debt: res.debt, contract: res.contract }).cups;
    const est = `cellar — up to ${funded} of the ${cups} ${name} cups on the tab at ~${fmt(unitPrice)} each (dawn board may move)`;
    return funded >= cups ? est : `${est} · the rest stays unbought — a dry cellar pays 1.5× spot per cup`;
  })();
  const netPos = cRev - cCost - cOps - settledPaid - exchange.debt;
  const pos = `campaign net position ${netPos < 0 ? '−' : ''}${fmt(Math.abs(netPos))}`;
  const committed = q.fixedMinimum + q.contractFee + q.interest;
  const bits = [
    'This is deducted at closing, not an opening payment. Ingredients and card fees vary with orders.',
    `the nut ${fmt(q.fixedMinimum)} — the daily bill before a cup pours · wage ${fmt(q.wage)} · pitch floor ${fmt(q.ops.pitch)} · bills ${fmt(q.ops.sundries + q.ops.power + q.ops.wifi)}${q.training ? ` · training ${fmt(q.training)}` : ''}${q.sampling ? ` · samples ${fmt(q.sampling)}` : ''}${q.marketing ? ` · street ${fmt(q.marketing)}` : ''}`,
    `each cup — labour + supplies + power ${fmt(q.perCup)} · pitch takes ${(q.pitchPct * 100).toFixed(0)}% above the floor · cards ${(q.cardFeePct * 100).toFixed(1)}%`,
    exchange.contract
      ? `beans — contracted at ${exchange.contract.price.toFixed(2)} (${exchange.contract.units} cups left)`
      : `beans — board ${exchange.beanIndex.toFixed(2)} spot${q.contractFee ? ` · insure for ${fmt(q.contractFee)} on the tab` : ''}`,
    ...(cellarBit ? [cellarBit] : []),
    ...(stagedPrep.batch ? [`morning prep — ${ECON.batchUnits} cups batched −${fmt(ECON.batchCost)} from the till at open, not the tab`] : []),
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
  const wasOpen = !!nutEl.querySelector?.('details')?.open;
  clearEl(nutEl);
  const det = document.createElement('details');
  det.id = 'brief-nut-details';
  if (drawerOpen('brief-nut-details', wasOpen || q.contractFee > 0 || q.interest > 0 || q.settlement || q.training || q.sampling || q.marketing)) det.open = true;
  watchDrawer(det, 'brief-nut-details');
  const sum = document.createElement('summary');
  sum.textContent = `bills counted at closing · ${fmt(q.fixedMinimum)} before per-cup costs · change ›`;
  const body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  body.textContent = full;
  det.append(sum, body);
  nutEl.appendChild(det);
  const sumEl = $('brief-summary');
  if (sumEl) {
    sumEl.textContent = `closing bills ${fmt(committed)}${q.settlement ? ` · settle ${fmt(q.settlement)}` : ''}${showPos ? ` · ${pos}` : ''}`;
    sumEl.title = full;
  }
  renderWeekStanding();
  if (day === 1) updateBriefFooter();
}

// PR-A1 — Brief-staged prep (radio picker). The Morning Brief lets the
// player lock in ONE morning lever (hold / pre-batch / cut-to-£4.20) BEFORE
// commit. Staging means the decision is already made — the lever auto-fires
// at commit time and a mid-day press of the same lever is free. If the player
// DIDN'T stage the lever, a mid-day press costs £4.20 + a small opinion hit
// on every named regular (the chargeLeverOverride mechanic from PR-5).
//
// Three mutually exclusive pills. The stagedPrep object keeps both keys for
// backward compat with applyStagedPrep (only one is ever true at a time).
function renderPrepSection() {
  const wrap = $('brief-prep'); if (!wrap) return;
  clearEl(wrap);
  wrap.style.display = '';
  if (day === 1) { renderFirstDayChoices(wrap); renderPastryCut(wrap); renderShockCounter(wrap); appendLoanLine(wrap); return; }

  const lab = document.createElement('div');
  lab.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:4px';
  lab.textContent = 'this morning';
  const qbtn = document.createElement('button');
  qbtn.textContent = '?';
  qbtn.style.cssText = 'font-size:10px;opacity:.5;background:none;border:none;cursor:pointer;padding:0 4px';
  qbtn.setAttribute('aria-label', 'what happens if I press 1 or 2 without staging');
  lab.appendChild(qbtn);
  wrap.appendChild(lab);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:10.5px;opacity:.6;margin-bottom:6px;font-style:italic';
  hint.textContent = 'change your plan freely before opening · after noon the first switch costs £4.20 (a late batch adds £40 stock); a routine batch top-up is £40 with no opinion hit';
  hint.style.display = prepHintOpen ? '' : 'none';
  qbtn.onclick = () => { prepHintOpen = !prepHintOpen; hint.style.display = prepHintOpen ? '' : 'none'; };
  wrap.appendChild(hint);

  const pillRow = document.createElement('div');
  pillRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px';

  // Radio state: hold = neither staged, batch = pre-batch only, reprice = cut only.
  const isSelected = (key) => {
    if (key === 'hold') return !stagedPrep.batch && !stagedPrep.reprice;
    if (key === 'batch') return stagedPrep.batch && !stagedPrep.reprice;
    if (key === 'reprice') return stagedPrep.reprice && !stagedPrep.batch;
    return false;
  };

  const makePill = (id, def) => {
    const b = document.createElement('button');
    b.id = id;
    b.dataset.prep = def.key;
    const sel = isSelected(def.key);
    b.innerHTML = `${sel ? '✓ ' : ''}${def.label}${def.cost ? ` · −${fmt(def.cost)}` : ''}` +
      `<br><span style="font-size:10px;font-weight:400;opacity:.72">${def.desc}</span>`;
    b.style.cssText = 'font-size:11px;padding:7px 11px;flex:1;min-width:0;text-align:left;line-height:1.35';
    if (sel) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; b.style.color = '#2a241c'; }
    else if (def.key === 'hold') { b.style.opacity = '0.7'; }
    b.title = 'change your plan freely before opening · after noon the first switch costs £4.20 (a late batch adds £40 stock)';
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    b.onclick = () => {
      // Radio behaviour — clicking sets stagedPrep atomically.
      // Mutually exclusive: hold | batch | reprice.
      if (def.key === 'hold') { stagedPrep.batch = false; stagedPrep.reprice = false; }
      else if (def.key === 'batch') { stagedPrep.batch = true; stagedPrep.reprice = false; }
      else if (def.key === 'reprice') { stagedPrep.batch = false; stagedPrep.reprice = true; }
      renderPrepSection();
      renderMenuSection();
      renderPlanQuote();
    };
    return b;
  };

  pillRow.appendChild(makePill('brief-prep-hold', {
    key: 'hold',
    label: 'hold steady',
    cost: null,
    desc: 'no upfront spend · made-to-order all day · you can still buy in later — £40 + £4.20 late switch',
  }));
  pillRow.appendChild(makePill('brief-prep-batch', {
    key: 'batch',
    label: `pre-batch ${ECON.batchUnits} cups`,
    cost: ECON.batchCost,
    desc: 'speed at full price · 40 reserved until 14:00 · leftovers waste',
  }));
  pillRow.appendChild(makePill('brief-prep-reprice', {
    key: 'reprice',
    label: `cut matcha to ${fmt(ECON.matchaDeal)}`,
    cost: null,
    desc: 'slower service, more patience, lower income · no prep today',
  }));
  wrap.appendChild(pillRow);
  renderPastryCut(wrap);
  renderShockCounter(wrap);
  appendLoanLine(wrap);
}

// One line in the prep block: borrow a step, or skip. Not a new panel.
function appendLoanLine(wrap) {
  if (!wrap || softDay) return;
  const line = document.createElement('div');
  line.id = 'brief-loan';
  line.textContent = stagedLoan > 0 ? `borrow £${stagedLoan} or skip` : 'borrow or skip';
  line.style.cssText = 'font-size:11px;margin-top:6px;cursor:pointer';
  line.onclick = () => {
    if (phase !== 'planning') return;
    const steps = [0, 400, 800, 1200, 1600];
    const i = Math.max(0, steps.indexOf(stagedLoan));
    stagedLoan = steps[(i + 1) % steps.length];
    renderPrepSection();
  };
  wrap.appendChild(line);
}

// The Row lease card — a dedicated brief section above the morning prep.
// Days 1–2 get a one-line teaser; day 3+ the next vacant lot's lease:
// pick a purpose (what the stand does for the street), describe it in
// words or a photo link, and send it to the builders. They work while
// you trade — the stand may arrive later that day or the next dawn. A
// row already spoken for says who built it and offers a fresh street
// instead of a dead end: a stand somebody else described still pays you
// rent. That's the gift.
const ROW_PURPOSES = [
  { id: 'draw',      label: 'a draw',    benefit: `+${FRANCHISE.purposes.draw.awareness.toFixed(2)} awareness at close` },
  { id: 'community', label: 'a hub',     benefit: `+${FRANCHISE.purposes.community.returnees} returnees tomorrow` },
  { id: 'rent',      label: 'a tenant',  benefit: `+£${FRANCHISE.purposes.rent.rentBonus} rent per dawn` },
];
const ROW_EXAMPLES = ['a tiny ramen counter', 'a vinyl listening bar', 'a flower stall'];
// Draft state survives re-renders for the SAME lot (a mid-entry status
// read or a failed send must not eat the typing); a new day or a new lot
// on offer starts it clean.
let rowPurpose = null, rowSending = false, rowError = null, rowDraft = '', rowFor = '';
// The signature is the player, not the lot — it pre-fills from the
// licence and isn't cleared when the day/lot draft resets.
let rowByline = null;

function rowPurposeLabel(purpose) {
  const p = ROW_PURPOSES.find(x => x.id === purpose);
  return p ? ` · ${p.label} (${p.benefit})` : '';
}

// A fresh district: random seed across the whole 32-bit range, keeping
// the link's other params.
function newStreetUrl() {
  const u = new URL(location.href);
  let n = 0;
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); n = a[0]; }
  catch { n = Math.floor(Math.random() * 0xffffffff); }
  u.searchParams.set('seed', String(1 + (n % 4294967295)));
  return u.toString();
}

function renderFranchiseRow() {
  const host = $('brief-row'); if (!host) return;
  if (softDay || phase !== 'planning' || day < 1) { host.style.display = 'none'; return; }
  const vacant = franchise.nextVacant(day);
  const ls = (id) => franchise.lots[id] || {};
  const building = FRANCHISE.lots.filter(l => ls(l.id).status === 'processing');
  const built = FRANCHISE.lots.filter(l => ls(l.id).status === 'success');
  const vacantStatus = vacant ? (ls(vacant.id).status || 'missing') : '';
  // A new day or a different lot on offer retires the old draft — the card
  // never carries yesterday's words into someone else's lease.
  const forNow = `${day}:${vacant ? vacant.id : 'full'}`;
  if (forNow !== rowFor) { rowFor = forNow; rowPurpose = null; rowSending = false; rowError = null; rowDraft = ''; }
  // Rebuild only when the state the card shows actually changes — every
  // lot's status + purpose feeds the key so a status read that resolves a
  // build (or fills the row) redraws, while one that changes nothing
  // leaves the draft untouched.
  const bonusLines = morningFranchiseLines(franchise, day, franchiseCarry);
  const key = [forNow, FRANCHISE.lots.map(l => `${ls(l.id).status || ''}:${ls(l.id).purpose || ''}`).join('+'),
    rowSending, rowError || '', bonusLines.join('~')].join('|');
  if (host.dataset.rowKey === key) return;
  host.dataset.rowKey = key;
  clearEl(host);
  host.style.display = '';

  if (bonusLines.length) {
    const box = document.createElement('div');
    box.id = 'brief-row-bonus';
    box.className = 'row-bonus';
    for (const line of bonusLines) {
      const p = document.createElement('div');
      p.textContent = line;
      box.appendChild(p);
    }
    host.appendChild(box);
  }

  if (building.length) {
    const note = document.createElement('div');
    note.className = 'row-teaser';
    note.textContent = `the builders are working on ${building.map(l => l.name).join(' and ')} — keep playing; the stand may arrive later today or at the next dawn`;
    host.appendChild(note);
  }

  // The standing-Row block: full occupation says who built it and offers
  // a way out; a partial row names what's standing and when the rest of
  // the leases open — never a premature "spoken for".
  const doneBlock = (withFresh) => {
    const done = document.createElement('div');
    done.id = 'brief-franchise';
    done.className = 'row-done';
    const inh = franchise.inherited && franchise.inherited();
    const builtList = built.map(l =>
      `${l.name}${rowPurposeLabel(ls(l.id).purpose)}${ls(l.id).byline ? ` · by ${ls(l.id).byline}` : ''}`).join(', ');
    const waiting = FRANCHISE.lots.filter(l => ls(l.id).status !== 'success');
    let text;
    if (!built.length) {
      text = 'every lease on the Row is under scaffolding — nothing to sign today';
    } else if (built.length === FRANCHISE.lots.length) {
      text = inh
        ? `the Row is spoken for — ${inh.name} was built by a previous owner and still pays you rent · built: ${builtList}`
        : `the Row is spoken for — built: ${builtList}`;
    } else {
      const rest = waiting.map(l => ls(l.id).status === 'processing'
        ? `${l.name} is under scaffolding`
        : `${l.name} opens day ${l.unlockDay}`).join(' · ');
      text = `${builtList} already ${built.length > 1 ? 'stand' : 'stands'} on the Row` +
        `${inh ? ' — built by a previous owner, still paying you rent' : ''} · ${rest}`;
    }
    done.textContent = text;
    if (withFresh) {
      const fresh = document.createElement('button');
      fresh.id = 'brief-row-fresh';
      fresh.textContent = 'open a fresh district →';
      fresh.onclick = () => { openAway(newStreetUrl()); };
      done.appendChild(fresh);
    }
    host.appendChild(done);
  };

  if (day < FRANCHISE.lots[0].unlockDay) {
    // An inherited seed (e.g. 99) shows the standing Row before day 3 —
    // the teaser only runs when nothing is built or building yet.
    if (built.length) { doneBlock(false); return; }
    if (!building.length) {
      const t = document.createElement('div');
      t.className = 'row-teaser';
      t.textContent = 'across the road, three storefronts stand empty — the first lease opens day 3';
      host.appendChild(t);
    }
    return;
  }

  if (!vacant) { doneBlock(true); return; }

  const card = document.createElement('div');
  card.id = 'brief-franchise';
  card.className = 'row-card';

  const kick = document.createElement('div');
  kick.className = 'row-kicker';
  kick.textContent = 'the row · a lease on the counter';
  const title = document.createElement('div');
  title.className = 'row-title';
  title.textContent = `${vacant.name} is vacant`;
  const why = document.createElement('p');
  why.className = 'row-why';
  why.textContent = 'describe the stand you want there and the builders grow it — £15 ground rent each dawn, plus whatever its purpose brings the street. first, tell them what the stand is for:';
  card.append(kick, title, why);

  const statusEl = document.createElement('div');
  statusEl.className = 'row-status';
  statusEl.id = 'brief-row-status';
  statusEl.setAttribute('aria-live', 'polite');
  if (rowError) statusEl.textContent = rowError;
  else if (vacantStatus === 'invalid') statusEl.textContent = 'the builders need three words or more';

  const purposes = document.createElement('div');
  purposes.className = 'row-purposes';
  purposes.setAttribute('role', 'group');
  purposes.setAttribute('aria-label', 'what the stand is for');
  const purposeBtns = {};
  for (const p of ROW_PURPOSES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'row-purpose';
    b.id = `brief-row-purpose-${p.id}`;
    b.setAttribute('aria-pressed', rowPurpose === p.id ? 'true' : 'false');
    b.innerHTML = `${p.label}<small>${p.benefit}</small>`;
    b.onclick = () => {
      rowPurpose = p.id;
      for (const q of ROW_PURPOSES) purposeBtns[q.id].setAttribute('aria-pressed', q.id === p.id ? 'true' : 'false');
      statusEl.textContent = `${p.label} — ${p.benefit} · on top of the £15 ground rent, from its first full day on the street`;
    };
    purposeBtns[p.id] = b;
    purposes.appendChild(b);
  }
  card.appendChild(purposes);

  const examples = document.createElement('div');
  examples.className = 'row-examples';
  const input = document.createElement('input');
  input.id = 'brief-row-input';
  input.type = 'text'; input.maxLength = FRANCHISE.promptMax;
  input.placeholder = 'a tiny ramen counter… or a photo link https://';
  input.setAttribute('aria-label', `describe the stand for ${vacant.name}`);
  input.value = rowDraft;
  input.addEventListener('input', () => { rowDraft = input.value; });
  for (const ex of ROW_EXAMPLES) {
    const e = document.createElement('button');
    e.type = 'button';
    e.textContent = `“${ex}”`;
    e.onclick = () => { input.value = ex; rowDraft = ex; input.focus(); };
    examples.appendChild(e);
  }
  card.appendChild(examples);

  const send = document.createElement('div');
  send.className = 'row-send';
  const btn = document.createElement('button');
  btn.id = 'brief-row-send';
  btn.textContent = 'send to the builders'; btn.style.fontSize = '10px';
  send.append(input, btn);
  card.appendChild(send);

  // The deeds line: optional signature, pre-filled from the licence.
  // Whoever claims the lot first keeps it — later players inherit the name.
  const signRow = document.createElement('div');
  signRow.className = 'row-send row-sign';
  const sign = document.createElement('input');
  sign.id = 'brief-row-byline';
  sign.type = 'text'; sign.maxLength = 24;
  if (rowByline === null) rowByline = playerName !== 'Sam' ? playerName : '';
  sign.value = rowByline;
  sign.placeholder = 'sign it — a name for the deeds (optional)';
  sign.setAttribute('aria-label', 'a name for the deeds (optional)');
  sign.addEventListener('input', () => { rowByline = sign.value; });
  signRow.appendChild(sign);
  card.appendChild(signRow);
  card.appendChild(statusEl);

  btn.onclick = () => {
    if (phase !== 'planning' || rowSending) return;
    const text = (input.value || '').trim();
    if (!rowPurpose) { statusEl.textContent = 'pick what the stand is for — a draw, a hub, or a tenant'; return; }
    if (!text) { statusEl.textContent = 'describe the stand — words, or a photo link'; return; }
    rowSending = true; rowError = null; rowDraft = text;
    btn.disabled = true; btn.textContent = 'sent — the builders are working';
    statusEl.textContent = `sent to the builders — ${vacant.name} · ${rowPurposeLabel(rowPurpose).slice(3)}`;
    franchise.describe(vacant.id, text, day, rowPurpose, (sign.value || '').trim() || undefined).then(d => {
      rowSending = false;
      if (d && (d.status === 'invalid' || d.status === 'locked')) {
        rowError = d.error || 'the builders need three words or more';
      } else if (d && d.status === 'error') {
        rowError = d.error || 'the builders could not be reached — try again';
      } else if (d && (d.status === 'processing' || d.status === 'success')) {
        rowError = null; rowPurpose = null; rowDraft = '';
      }
      renderFranchiseRow();
    });
  };
  host.appendChild(card);
}

function stageLoan(amount) {
  if (phase !== 'planning') return false;
  const n = loanAmount(amount);
  if (n == null) return false;
  stagedLoan = n;
  return true;
}

function stageCase(n) {
  if (phase !== 'planning' || loan.seized) return false;
  const cases = Math.floor(n);
  if (!Number.isFinite(cases) || cases < 0) return false;
  const cost = cases * CASE_COST;
  if (cost > 1600) return false;
  stagedCases = cases;
  return true;
}

function fundMorningLoan(plan) {
  if (stagedLoan > 0) loan.borrow(stagedLoan);
  else loan.skip();
  caseUnits = 0;
  if (stagedCases > 0) {
    const got = loan.spend('case', stagedCases * CASE_COST);
    caseUnits = Math.floor((got.spent || 0) / CASE_COST);
  }
  loanLotCover = 0;
  if (topUpCups > 0) {
    const fr = fundedRestock(selectedLot, topUpCups);
    loanLotCover = loan.spend('lot', fr.cost).spent || 0;
  }
  loanSponsorCover = 0;
  if (plan && plan.marketing && plan.marketing.sponsor) {
    loanSponsorCover = loan.spend('sponsor', CAMPAIGN.demand.sponsorCost).spent || 0;
  }
  loan.open();
  stagedLoan = 0;
  stagedCases = 0;
}

// While the supplier is holding the next delivery: no milk van, no case,
// and the board is beans and water until the lump is cleared.
function applySeizureBoard() {
  if (!loan.seized) {
    if (menuHeld) {
      Object.assign(menuOffered, menuHeld);
      menuHeld = null;
      patrons.menuOffered = menuOffered;
      if (stagedMenu) stagedMenu.offered = { ...menuOffered };
    }
    return;
  }
  if (!menuHeld) menuHeld = { ...menuOffered };
  for (const id of DRINK_IDS) menuOffered[id] = DRINKS[id].milk === false;
  patrons.menuOffered = menuOffered;
  if (stagedMenu) {
    for (const id of DRINK_IDS) stagedMenu.offered[id] = menuOffered[id];
  }
  milkDelivery = 0;
  ctx.milkStock = 0;
  pastryOnOrder = 0;
  ctx.pastryStock = null;
}

function renderFirstDayChoices(wrap) {
  const FM = firstMorningCopy();
  const title = document.createElement('div');
  title.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55';
  title.textContent = FM.planTitle;
  const fc = document.createElement('div');
  fc.id = 'brief-prep-forecast';
  fc.style.cssText = 'font-family:var(--serif);font-size:14px;font-style:italic;margin:4px 0 8px';
  fc.textContent = FM.forecast;
  wrap.append(title, fc);
  const pick = (key) => {
    if (key === 'hold') { stagedPrep.batch = false; stagedPrep.reprice = false; }
    else if (key === 'batch') { stagedPrep.batch = true; stagedPrep.reprice = false; }
    else if (key === 'reprice') { stagedPrep.batch = false; stagedPrep.reprice = true; }
    firstPrepChosen = true;
    const ob = $('brief-open'); if (ob) ob.disabled = false;
    const hadFocus = typeof document !== 'undefined' && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.prep === key;
    renderPrepSection();
    renderMenuSection();
    renderPlanQuote();
    updateBriefFooter();
    if (hadFocus) {
      const nb = document.querySelector(`#brief-prep button[data-prep="${key}"]`);
      if (nb && nb.focus) nb.focus();
    }
  };
  for (const def of FM.choices) {
    const b = document.createElement('button');
    b.id = def.id;
    b.dataset.prep = def.key;
    b.className = 'prep-choice';
    const sel = (!guidedOpening || firstPrepChosen) &&
      (def.key === 'hold' ? !stagedPrep.batch && !stagedPrep.reprice
        : def.key === 'batch' ? stagedPrep.batch : stagedPrep.reprice);
    if (sel) b.classList.add('picked');
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    const lab = document.createElement('div');
    lab.className = 'pc-label';
    const nm = document.createElement('span');
    nm.textContent = def.label;
    const tag = document.createElement('span');
    tag.className = 'pc-tag';
    tag.textContent = guidedOpening ? def.tag : '';
    lab.append(nm, tag);
    const line = document.createElement('div');
    line.className = 'pc-desc';
    line.textContent = def.line;
    b.append(lab, line);
    b.onclick = () => pick(def.key);
    wrap.appendChild(b);
  }
  const note = document.createElement('details');
  note.className = 'prep-note';
  const nsum = document.createElement('summary');
  nsum.textContent = 'what’s the difference?';
  const nbody = document.createElement('div');
  nbody.textContent = `${FM.diff} ${FM.lateNote}`;
  note.append(nsum, nbody);
  wrap.appendChild(note);
}

// Tomorrow's croissant case, staged on the brief the same way the morning
// pills are: a click stores the share, the next dawn's pastryPar reads it.
// Not its own panel — it sits in the prep block that is already the plan.
function renderPastryCut(wrap) {
  const row = document.createElement('div');
  row.id = 'brief-pastry';
  row.style.cssText = 'margin-top:8px';
  const lab = document.createElement('div');
  lab.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:4px';
  lab.textContent = 'tomorrow’s croissant case';
  row.appendChild(lab);
  const rule = document.createElement('div');
  rule.style.cssText = 'font-size:11px;line-height:1.35;margin-bottom:4px';
  rule.textContent = 'An empty case still sells the drink. One in four leaves, and the room notices.';
  row.appendChild(rule);
  if (day >= CAMPAIGN.days) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:10px;opacity:.55;font-style:italic';
    note.textContent = 'the week ends tonight — no case tomorrow';
    row.appendChild(note);
    wrap.appendChild(row);
    return;
  }
  const choices = [
    { id: 'brief-pastry-full', share: 0, label: 'bake the full case' },
    { id: 'brief-pastry-half', share: 0.5, label: 'bake half' },
    { id: 'brief-pastry-none', share: 1, label: 'skip tomorrow’s case' },
  ];
  for (const def of choices) {
    const b = document.createElement('button');
    b.id = def.id;
    const sel = pastryCut === def.share;
    b.textContent = (sel ? '✓ ' : '') + def.label;
    b.style.cssText = 'display:block;width:100%;margin-top:4px;font-size:11px;text-align:left;padding:6px 9px';
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    if (sel) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; b.style.color = '#2a241c'; }
    b.onclick = () => { stagePastryCut(def.share); renderPrepSection(); };
    row.appendChild(b);
  }
  wrap.appendChild(row);
}

function renderShockCounter(wrap) {
  const id = shockOnDay(day);
  if (!id) return;
  const hit = COUNTERABLE[id];
  if (!hit) return;
  const row = document.createElement('div');
  row.id = 'brief-shock';
  row.style.cssText = 'margin-top:8px';
  const lab = document.createElement('div');
  lab.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:4px';
  lab.textContent = { machine_breaks: 'the machine is limping', dairy_crunch: 'the oat milk is short', health_inspector: 'the inspector is in' }[id] || 'today’s complication';
  row.appendChild(lab);
  const staged = stagedCounterable && stagedCounterable.id === id ? stagedCounterable.counter : null;
  const opts = [
    { key: null, label: 'leave it as it is', cost: 0 },
    ...Object.keys(hit.counters).map(key => ({ key, label: key, cost: hit.counters[key].cost || 0 })),
  ];
  for (const def of opts) {
    const b = document.createElement('button');
    b.id = def.key == null ? 'brief-shock-leave' : `brief-shock-${def.key}`;
    b.dataset.counter = def.key == null ? '' : def.key;
    const sel = staged === def.key;
    b.textContent = (sel ? '✓ ' : '') + def.label + (def.cost ? ` · −${fmt(def.cost)}` : '');
    b.style.cssText = 'display:block;width:100%;margin-top:4px;font-size:11px;text-align:left;padding:6px 9px';
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    if (sel) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; b.style.color = '#2a241c'; }
    b.onclick = () => { stageCounterable(id, def.key); renderPrepSection(); };
    row.appendChild(b);
  }
  wrap.appendChild(row);
}

function updateBriefFooter() {
  const sumEl = $('brief-summary'); if (!sumEl || day !== 1) return;
  const FM = firstMorningCopy();
  let lead;
  if (guidedOpening && !firstPrepChosen) lead = FM.choosePrompt;
  else if (stagedPrep.batch) lead = `plan — starter batch, −${fmt(ECON.batchCost)} at opening`;
  else if (stagedPrep.reprice) lead = `plan — matcha deal at ${fmt(ECON.matchaDeal)}, no prep spend`;
  else lead = 'plan — no prep spend at opening';
  const extras = [];
  if (planDraft) {
    const q = quoteDayPlan({
      day, hedge: planDraft.hedge, staffing: planDraft.staffing, marketing: planDraft.marketing,
      debt: exchange.debt, extraFee: contractFeeExtra, perkCostMul, modifiers: modifiersForDay(day),
    });
    if (q.contractFee) extras.push(`+ bean cover ${fmt(q.contractFee)} on the tab`);
    if (q.settlement) extras.push(`+ settle the tab ${fmt(q.settlement)}`);
    const stQ = lotState.entry(selectedLot);
    if (stQ && stQ.unlocked !== false && topUpCups > 0) {
      const res = resolveDecision(planSnapshot(), normalizePlan(planDraft));
      if (res.ok) {
        const fr = fundedRestock(selectedLot, topUpCups, { debt: res.debt, contract: res.contract });
        extras.push(`+ ~${fr.cups} ${LOT_CATALOG[selectedLot]?.name || 'cellar'} cups ≈ ${fmt(fr.cost)} on the tab`);
      }
    }
    sumEl.title = `the nut ${fmt(q.fixedMinimum)} — deducted at closing, not an opening payment`;
  } else sumEl.title = '';
  extras.push('bills and ingredients are counted at closing');
  sumEl.textContent = lead + (extras.length ? ' · ' + extras.join(' · ') : '');
}

// Apply the staged prep at commit. Called from applyCommittedPlan. Radio
// design: only one lever is ever staged, so each block just fires it.
function applyStagedPrep() {
  if (stagedPrep.batch) doPrebatch({ asPlanned: true });
  if (stagedPrep.reprice) doReprice({ asPlanned: true });
}

// Phase 2 — the cellar in the Brief. House-lot pills (price at the dawn
// board, stock, roast age) plus adaptive top-up: restock to yesterday's
// pour +25%, double it, or skip. Staged into selectedLot/topUpCups,
// executed at commit by applyLots (till-checked, contract-aware).
function renderLotSection() {
  const wrap = $('brief-lots'); if (!wrap) return;
  const TT = toolsToday || briefTools();
  const wasOpen = !!wrap.querySelector?.('details')?.open;
  clearEl(wrap);
  if (!TT.visible.has('coffee')) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  {
    const houseNow = lotState.entry(selectedLot);
    const suggest = restockQty(lastPour, houseNow?.stock ?? 0);
    if (suggest > 0 && topUpCups === 0) {
      const call = document.createElement('button');
      call.id = 'brief-restock';
      call.type = 'button';
      const nm = LOT_CATALOG[selectedLot]?.name || 'the house coffee';
      call.textContent = `Restock the cellar — ${suggest} cups of ${nm}`;
      call.title = 'Tops the sack up to yesterday’s pour plus a little extra, minus what’s already on hand. The tab pays for it at dawn.';
      bindPress(call, () => { topUpCups = suggest; renderLotSection(); renderPlanQuote(); fx.toast(`restock staged — ${suggest} cups on the morning tab`, ''); });
      wrap.appendChild(call);
    } else if (topUpCups > 0) {
      const call = document.createElement('div');
      call.id = 'brief-restock';
      call.className = 'bn-note';
      call.textContent = `Restocking ${topUpCups} cups — on the tab when you open.`;
      wrap.appendChild(call);
    }
  }
  if (TT.essentialNew.includes('coffee')) {
    const note = document.createElement('div');
    note.className = 'bn-note';
    note.textContent = 'New · ' + essentialNote('coffee');
    wrap.appendChild(note);
  }

  const house = lotState.entry(selectedLot);
  const name = LOT_CATALOG[selectedLot]?.name || selectedLot;
  const age = lotState.age(selectedLot, day);
  const stale = house && isStale(age);
  const det = document.createElement('details');
  det.id = 'brief-lot-details';
  const houseEmpty = !!house && house.stock <= 0;
  const houseLow = !!house && lastPour > 0 && house.stock < lastPour;
  const cellarDry = LOT_IDS.every(id => (lotState.entry(id)?.stock ?? 0) <= 0);
  if (houseEmpty || houseLow || TT.newToday === 'coffee' || drawerOpen('brief-lot-details', wasOpen || topUpCups > 0 || stale || (lotState.pending && lotState.pending.length))) det.open = true;
  watchDrawer(det, 'brief-lot-details');
  const sum = document.createElement('summary');
  sum.textContent = `pouring ${name}${house ? ` · ${house.stock} left` : ''}${topUpCups > 0 ? ' · restocking' : ''} · change ›`;
  det.appendChild(sum);
  if (houseEmpty) {
    const warn = document.createElement('div');
    warn.style.cssText = 'font-size:11px;color:#8a4a2a;margin:4px 0 6px';
    warn.textContent = cellarDry
      ? 'cellar’s dry — every cup today bills an emergency sack at 1.5× spot'
      : 'house lot empty — choose another lot or restock; a completely dry cellar bills 1.5× spot';
    det.appendChild(warn);
  }
  wrap.appendChild(det);

  const pillRow = document.createElement('div');
  pillRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px';
  for (const id of LOT_IDS) {
    const entry = LOT_CATALOG[id];
    const st = lotState.entry(id);
    if (!st || st.unlocked === false) continue;
    const age = lotState.age(id, day);
    const price = lotSpot(id, dawnIndex, st.priceMul);
    const b = document.createElement('button');
    b.id = `brief-lot-${id}`;
    b.dataset.lot = id;
    const sel = selectedLot === id;
    const fresh = age <= 1 ? '● fresh' : isStale(age) ? '● STALE' : '● day ' + age;
    b.textContent = `${sel ? '✓ ' : ''}${entry.name} · ${fmt(price)}/cup · ${st.stock} in sack · ${fresh}`;
    b.title = entry.blurb;
    b.style.cssText = 'font-size:11px;padding:7px 11px;flex:1;min-width:0;text-align:left;line-height:1.35';
    if (sel) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; b.style.color = '#2a241c'; }
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    b.onclick = () => { selectedLot = id; topUpCups = 0; stagedRoast = lotState.entry(id)?.roast ?? 3; renderLotSection(); renderPlanQuote(); };
    pillRow.appendChild(b);
  }
  det.appendChild(pillRow);

  // Top-up row for the selected lot.
  const st = lotState.entry(selectedLot);
  if (st) {
    const price = lotSpot(selectedLot, dawnIndex, st.priceMul);
    const qty = restockQty(lastPour, st.stock);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px';
    const mkTop = (id, label, cups) => {
      const b = document.createElement('button');
      b.id = id;
      const sel = topUpCups === cups && cups > 0;
      b.textContent = `${sel ? '✓ ' : ''}${label}`;
      b.style.cssText = 'font-size:11px;padding:6px 10px;flex:1;min-width:0';
      if (sel) { b.style.borderColor = 'var(--brass)'; b.style.background = 'rgba(201,162,39,.18)'; b.style.color = '#2a241c'; }
      b.onclick = () => { topUpCups = (topUpCups === cups) ? 0 : cups; renderLotSection(); renderPlanQuote(); };
      return b;
    };
    const underContract = !!(exchange.contract && exchange.contract.units > 0);
    const fundedNote = (cups) => {
      const res = resolveDecision(planSnapshot(), normalizePlan(planDraft));
      if (!res.ok) return '';
      const fr = fundedRestock(selectedLot, cups, { debt: res.debt, contract: res.contract });
      return fr.cups < cups ? ` · tab covers ~${fr.cups} (${fmt(fr.cost)})` : '';
    };
    row.appendChild(mkTop('brief-top-rest', qty > 0 ? `restock ${qty} cups · ${fmt(qty * price)}${underContract ? ' (contract)' : ''}${fundedNote(qty)}` : 'cellar’s full enough — skip', qty));
    if (qty > 0) row.appendChild(mkTop('brief-top-double', `double it · ${qty * 2} cups${fundedNote(qty * 2)}`, qty * 2));
    det.appendChild(row);
  }

  const notes = [];
  for (const p of lotState.pending) {
    const entry = LOT_CATALOG[p.lot];
    notes.push(`${entry ? entry.name : p.lot} moves in ${Math.max(0, p.landDay - day)}d`);
  }
  if (notes.length) {
    const status = document.createElement('div');
    status.style.cssText = 'font-size:10px;letter-spacing:.04em;opacity:.55;font-style:italic';
    status.textContent = notes.join(' · ');
    det.appendChild(status);
  }

  // Phase 3 — roast stepper for the selected lot. Ideal in brackets;
  // distance costs quality, committed with OPEN.
  const roastRow = document.createElement('div');
  roastRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;font-size:11px';
  const roastLab = document.createElement('span');
  roastLab.style.cssText = 'opacity:.65';
  const ideal = ROAST_IDEAL[selectedLot] ?? 3;
  roastLab.textContent = `${name} roast (ideal ${ideal})`;
  const rMinus = document.createElement('button');
  rMinus.id = 'brief-roast-minus'; rMinus.textContent = '−'; rMinus.style.cssText = 'padding:4px 10px';
  rMinus.onclick = () => { stagedRoast = Math.max(1, stagedRoast - 1); renderLotSection(); };
  const rVal = document.createElement('span');
  rVal.textContent = `${stagedRoast} · Q ${roastQuality(selectedLot, stagedRoast).toFixed(2)}`;
  rVal.style.cssText = 'min-width:76px;text-align:center';
  const rPlus = document.createElement('button');
  rPlus.id = 'brief-roast-plus'; rPlus.textContent = '+'; rPlus.style.cssText = 'padding:4px 10px';
  rPlus.onclick = () => { stagedRoast = Math.min(5, stagedRoast + 1); renderLotSection(); };
  roastRow.appendChild(roastLab); roastRow.appendChild(rMinus); roastRow.appendChild(rVal); roastRow.appendChild(rPlus);
  det.appendChild(roastRow);
  if (TT.newToday === 'coffee') {
    const hint = document.createElement('div');
    hint.className = 'bn-note';
    hint.textContent = `Each coffee has a sweet spot: ideal roast ${ROAST_IDEAL[selectedLot]} for ${name}.`;
    det.appendChild(hint);
  }
}

// Headless-only cellar control for policy probes (break-it pass).
// The Brief owns lot choice in the browser; this lets the headless policy
// harness stage the same two decisions the pills make: which lot pours
// (selectedLot) and how much to top up ('restock' → yesterday+25%,
// 'double' → ×2, 'skip'/0 → nothing). Rejects unknown lots and locked
// microlots; unlocked lots always stage. No DOM, no rendering.
function stageCellar({ lot, topup } = {}) {
  if (lot !== undefined) {
    if (!LOT_IDS.includes(lot)) return false;
    if (lotState.entry(lot)?.unlocked === false) return false;
    selectedLot = lot;
    stagedRoast = lotState.entry(lot)?.roast ?? 3;
  }
  if (topup !== undefined) {
    if (topup === 'restock') topUpCups = restockQty(lastPour, lotState.entry(selectedLot)?.stock);
    else if (topup === 'double') topUpCups = restockQty(lastPour, lotState.entry(selectedLot)?.stock) * 2;
    else if (topup === 'skip' || topup === 0) topUpCups = 0;
    else if (Number.isFinite(+topup) && +topup > 0) topUpCups = Math.floor(+topup);
    else return false;
  }
  return true;
}
// Execute the staged cellar at commit. Sets the house lot, buys the top-up
// (till-checked; contract cover flows through when held), and resets the
// staging. Called from applyCommittedPlan after applyStagedPrep.
function fundedRestock(lotId, cups, { debt = exchange.debt, contract = exchange.contract } = {}) {
  const st = lotState.entry(lotId);
  if (!st || st.unlocked === false) return { cups: 0, cost: 0, unitPrice: 0, room: 0 };
  const unitPrice = contract && contract.units > 0 ? contract.price * 1.3 : lotSpot(lotId, dawnIndex, st.priceMul);
  const cap = LOT_CATALOG[lotId].stockCap;
  const room = cap ? Math.min(Math.max(0, Math.floor(cups)), Math.max(0, cap - st.stock)) : Math.max(0, Math.floor(cups));
  const headroom = Math.max(0, CAMPAIGN.creditLimit - debt);
  const n = unitPrice > 0 ? Math.min(room, Math.floor(headroom / unitPrice)) : room;
  return { cups: n, cost: n * unitPrice, unitPrice, room };
}

function applyLots() {
  lotState.house = selectedLot;
  const entry = lotState.entry(selectedLot);
  if (entry) entry.roast = Math.min(5, Math.max(1, Math.round(stagedRoast)));
  topUpCups = Math.max(0, Math.floor(topUpCups));
  // The tab buys the beans: at dawn the till is empty (it fills cup by cup
  // today), so the sack rides the supplier tab — Idris's credit line up to
  // £1,500. The headroom clamps the sack size; past it the bar pours from
  // remaining stock, cascades, then the bone-dry emergency sack at 1.5×
  // spot per cup (till-paid, the teeth). Broke weeks bleed per cup.
  const st = lotState.entry(selectedLot);
  if (!st || st.unlocked === false) {
    topUpCups = 0;
    if (loanLotCover > 0) loan.refund(loanLotCover);
    loanLotCover = 0;
    return;
  }
  let hedgedUnits = 0;
  if (exchange.contract && exchange.contract.units > 0) {
    hedgedUnits = Math.min(topUpCups, exchange.contract.units);
  }
  // Pre-clamp to the microlot cap so the tab check prices what can land.
  // NOTE (reconcile): the sack accrues into exchange.debt, which the verdict
  // nets once, so cCost must NOT also carry it (beanCostToday stays
  // matcha-only). beanSpend is receipt-only.
  const fr = fundedRestock(selectedLot, topUpCups);
  const unitPrice = fr.unitPrice;
  if (fr.room <= 0) {
    topUpCups = 0;
    if (loanLotCover > 0) loan.refund(loanLotCover);
    loanLotCover = 0;
    return;
  }
  if (fr.cups < fr.room) {
    topUpCups = fr.cups;
    if (topUpCups <= 0) {
      if (loanLotCover > 0) loan.refund(loanLotCover);
      loanLotCover = 0;
      fx.toast('tab’s maxed — no sack today. The bar pours what’s left.', 'warn');
      return;
    }
    fx.toast(`tab’s tight — Idris carries ${topUpCups} cups, no more`, 'warn');
  }
  const { cost, cups } = lotState.buy(selectedLot, topUpCups, unitPrice, day, { hedgedUnits });
  const cover = Math.min(loanLotCover, cost);
  if (loanLotCover - cover > 0.001) loan.refund(loanLotCover - cover);
  const onTab = cost - cover;
  loanLotCover = 0;
  exchange.debt += onTab;
  beanSpend += cost; sackSpend += onTab;
  // Consume only the cover actually poured into the sack.
  if (hedgedUnits > 0 && exchange.contract) {
    exchange.contract.units -= Math.min(cups, hedgedUnits);
    if (exchange.contract.units <= 0) exchange.contract = null;
  }
  const funded = cover > 0
    ? (onTab > 0 ? `${fmt(cover)} from the morning loan, ${fmt(onTab)} on the tab` : `${fmt(cost)} from the morning loan`)
    : `${fmt(cost)} on the tab`;
  fx.toast(`stocked ${cups} ${LOT_CATALOG[selectedLot].name} · ${funded}${hedgedUnits > 0 ? ' (contract cover)' : ''}`, 'good');
  topUpCups = 0;
}

// Phase 3 — the menu in the Brief. Price each drink within ±£1 (20p steps),
// 86 anything but matcha (the batch prep assumes it). Filter is slow (3 bar
// points) — 86ing it speeds the rush but loses its loyalists. Staged, then
// committed with OPEN (applyMenu).
function renderMenuSection() {
  const wrap = $('brief-menu'); if (!wrap) return;
  const TT = toolsToday || briefTools();
  const wasOpen = !!wrap.querySelector?.('details')?.open;
  clearEl(wrap);
  if (!TT.visible.has('menu')) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  if (!stagedMenu) stagedMenu = { prices: { ...menuPrices }, offered: { ...menuOffered } };
  stagedMenu.prices.matcha = stagedPrep.reprice ? ECON.matchaDeal : priceForDay(day);

  const bases = basePrices();
  const off = DRINK_IDS.filter(id => id !== 'matcha' && stagedMenu.offered[id] === false);
  const repriced = DRINK_IDS.filter(id => id !== 'matcha' && stagedMenu.prices[id] !== bases[id]);
  const changed = wasOpen || off.length > 0 || stagedPrep.reprice || DRINK_IDS.some(id => id !== 'matcha' && stagedMenu.prices[id] !== bases[id]);
  const det = document.createElement('details');
  det.id = 'brief-menu-details';
  if (TT.newToday === 'menu' || drawerOpen('brief-menu-details', changed)) det.open = true;
  watchDrawer(det, 'brief-menu-details');
  const sum = document.createElement('summary');
  sum.textContent = (off.length
    ? `menu · ${off.map(id => DRINKS[id].name).join(', ')} off`
    : `menu · matcha ${fmt(stagedMenu.prices.matcha)}${repriced.length ? ` · ${repriced.length} repriced` : ''}`) + ' · change ›';
  det.appendChild(sum);
  wrap.appendChild(det);

  for (const id of DRINK_IDS) {
    const def = DRINKS[id];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:11px';
    const nm = document.createElement('span');
    nm.style.cssText = 'flex:1;min-width:0';
    nm.textContent = `${def.name} · ${def.points}pt${def.milk ? ' · milk' : ''}`;
    nm.title = def.blurb;
    const minus = document.createElement('button');
    minus.textContent = '−'; minus.style.cssText = 'padding:4px 9px';
    minus.onclick = () => { stagedMenu.prices[id] = clampPrice(id, stagedMenu.prices[id] - 0.20); renderMenuSection(); };
    const val = document.createElement('span');
    val.textContent = fmt(stagedMenu.prices[id]);
    val.style.cssText = 'min-width:52px;text-align:center';
    const plus = document.createElement('button');
    plus.textContent = '+'; plus.style.cssText = 'padding:4px 9px';
    plus.onclick = () => { stagedMenu.prices[id] = clampPrice(id, stagedMenu.prices[id] + 0.20); renderMenuSection(); };
    if (id === 'matcha') {
      row.appendChild(nm); row.appendChild(val);
      const byPlan = document.createElement('span');
      byPlan.textContent = 'set by the plan';
      byPlan.style.cssText = 'opacity:.55;font-size:10px;padding:4px 2px';
      row.appendChild(byPlan);
    } else {
      row.appendChild(nm); row.appendChild(minus); row.appendChild(val); row.appendChild(plus);
    }
    if (id !== 'matcha') {
      const off = stagedMenu.offered[id] === false;
      const b86 = document.createElement('button');
      b86.id = `brief-86-${id}`;
      b86.textContent = off ? '86’d — off' : '86 it';
      b86.style.cssText = 'padding:4px 9px' + (off ? ';opacity:.55' : '');
      b86.setAttribute('aria-pressed', off ? 'true' : 'false');
      b86.onclick = () => { stagedMenu.offered[id] = off ? true : false; renderMenuSection(); };
      row.appendChild(b86);
    } else {
      const always = document.createElement('span');
      always.textContent = 'always on';
      always.style.cssText = 'opacity:.5;font-size:10px;padding:4px 2px';
      row.appendChild(always);
    }
    det.appendChild(row);
  }

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:10px;letter-spacing:.04em;opacity:.55;font-style:italic';
  hint.textContent = 'slow brews cost the rush — 86 with intent';
  det.appendChild(hint);
}

// Commit staged menu prices + 86 board. In-place assignment keeps the live
// ctx/patrons references fresh (module re-imports share the objects).
function applyMenu() {
  if (!stagedMenu) return;
  Object.assign(menuPrices, stagedMenu.prices);
  Object.assign(menuOffered, stagedMenu.offered);
  ctx.menuPrices = menuPrices;
  patrons.menuOffered = menuOffered;
  patrons.menuPrices = menuPrices;
  world.setMenu({
    prices: { ...menuPrices, matcha: Number(salePrice(exchange, repriced)) },
    offered: { ...menuOffered },
    matchaStruck: !!repriced,
  });
  stagedMenu = null;
}

function currentCupQuality() {
  const id = lotState.house;
  const e = lotState.entry(id);
  if (!e) return 1;
  return cupQuality(lotState.age(id, day), roastQuality(id, e.roast ?? 3), !!e.scorched);
}

// One counter merges with the day's baseline before anyone reads the milk.
// Capacity, extra hands, and price/reach multipliers land on their own knobs.
// Ruth's condition is only echoed so a shock cannot overwrite it.
function applyDawnShock() {
  const staged = stagedCounterable;
  const id = staged?.id || shockOnDay(day);
  let counter = staged ? staged.counter : shockCounter;
  if (!counter && id === 'dairy_crunch' && counterForMenu(menuOffered)) counter = 'shrink';
  stagedCounterable = null;
  shockCounter = null;
  const effect = id ? resolveShock(id, counter) : {};
  const knobs = shockKnobs(effect, baristaCondition);
  if (id) ctx.milkStock = applyInventory(ctx.milkStock, effect);
  if (knobs.shrinkMilky && menuOffered.flatwhite !== false) {
    menuOffered.flatwhite = false;
    shockPulledFlat = true;
    patrons.menuOffered = menuOffered;
    try {
      world.setMenu?.({
        prices: { ...menuPrices, matcha: Number(salePrice(exchange, false)) },
        offered: { ...menuOffered },
        matchaStruck: !!repriced,
      });
    } catch {}
  }
  patrons.capacityMult = knobs.capacityMult;
  patrons.shockStaff = knobs.shockStaff;
  patrons.priceMult = knobs.priceMult;
  ctx.priceMult = knobs.priceMult;
  shockDemandMul = knobs.demandMult;
  if (knobs.cost) till -= knobs.cost;
  if (knobs.rep) regulars.adjustOpinions(repToOpinion(knobs.rep));
}

function stageShockCounter(id) {
  if (id != null && id !== 'replace' && id !== 'shrink') return false;
  return stageCounterable('dairy_crunch', id || null);
}

function stageCounterable(id, counter = null) {
  if (phase !== 'planning') return false;
  const hit = COUNTERABLE[id];
  if (!hit || id !== shockOnDay(day)) return false;
  if (counter != null && !hit.counters[counter]) return false;
  stagedCounterable = { id, counter };
  return true;
}

function stagePastryCut(share) {
  const n = Number(share);
  if (!Number.isFinite(n) || n < 0 || n > 1) return false;
  pastryCut = n;
  return true;
}

// Once, the first time today's case is found empty. The croissant sale is
// already lost; this is the room noticing.
function noteEmptyCase() {
  if (pastryMissNoted) return;
  pastryMissNoted = true;
  regulars.adjustOpinions(EMPTY_CASE_MOOD);
  fx.toast('the case is empty — most still buy a drink; one in four leaves, and the room notices', 'warn');
}

// PR-B2 — Sam's reactive answer to a player move. Toast + nudge.
// Player pre-batch → rival speeds up (credit boost). Player reprice → rival
// undercuts visibly (£0.10 off their chalkboard price). Reacting twice in a
// row is allowed and stacks, capped so the rival never goes below £3.50 or
// above the day-one display.
function rivalReact(playerMove) {
  if (headless) return;
  const stratDef = CAMPAIGN.rivalStrategies[rivalStrategy];
  if (!stratDef) return;
  if (playerMove === 'prebatch') {
    rivalReacted.prep += 1;
    samGrudge.preps += 1;   // Phase 4 — Sam counts prep-days all week
    // Sam clocks the prep and speeds up — credit boost (the rival serves faster).
    if (patrons && typeof patrons.rivalCredit === 'number') patrons.rivalCredit = Math.min(1, patrons.rivalCredit + 1.5);
    const msg = `${COPY.rivalBarista} clocks your prep — grinding harder`;
    rivalReactLog.push({ move: 'prebatch', msg, ts: dayMin });
    fx.toast(msg, 'warn');
  } else if (playerMove === 'reprice') {
    rivalReacted.cut += 1;
    samGrudge.cuts += 1;   // Phase 4 — Sam counts cuts all week
    // Sam undercuts by £0.10 per player cut (visible on their chalkboard).
    const basePrice = stratDef.price;
    const newPrice = Math.max(3.5, Math.round((basePrice - 0.10) * 100) / 100);
    stratDef.price = newPrice;
    const msg = `${COPY.rivalBarista} undercuts to ${fmt(newPrice)} — they're not letting this go`;
    rivalReactLog.push({ move: 'reprice', msg, ts: dayMin });
    try { world.setRivalStrategy(rivalStrategy, newPrice.toFixed(2)); } catch {}
    fx.toast(msg, 'warn');
    // PR-B4 — Sam's reactive cameo. The chalkboard now reads the new price;
    // Sam walks to his door and flips it on camera. ~1.9s of animation
    // inside world.js, plus a brief camera focus and chapter card.
    try {
      if (world.cueRivalReact) world.cueRivalReact();
      if (world.focus && world.focus.rival && rig.focus) rig.focus(world.focus.rival, 13, 3.5);
      fx.card('BOARD FLIPPED', `${COPY.rivalBarista}'s chalkboard now reads ${fmt(newPrice)}`);
    } catch {}
  }
}

function renderRivalLine() {
  const slot = $('brief-rival'); if (!slot) return;
  const y = lastDayStats;
  if (!y) { slot.style.display = 'none'; slot.textContent = ''; return; }
  slot.style.display = '';
  const wasOpen = !!slot.querySelector?.('details')?.open;
  const you = y ? y.sold : null;
  const them = y ? (y.rivalServed || 0) : null;
  const youDef = y ? y.defections || 0 : 0;
  const themChose = y ? (y.rivalChoices || 0) : 0;
  const strat = CAMPAIGN.rivalStrategies[rivalStrategy];
  const stratName = strat ? strat.name.toLowerCase() : '—';
  const stratPrice = strat ? '£' + strat.price.toFixed(2) : '—';
  // PR-B2 — yesterday's reactivity log gets surfaced in today's brief so the
  // player sees Sam's moves being reactive, not just static.
  const reacts = (rivalReactLog || []).slice(0, 3).map(e => `· ${e.msg}`).join('<br>');
  const reactLine = reacts ? `<br><span class="dim">yesterday across the street:<br>${reacts}</span>` : '';
  // Phase 4 — the season tally: Sam counts cuts, prep-days, and snubbed
  // handshakes across the whole week. The chalkboard keeps score.
  let samLine = '';
  const sCut = samGrudge.cuts, sPrep = samGrudge.preps, sSnub = samGrudge.snubs;
  if (sCut + sPrep + sSnub >= 2) {
    const bits = [];
    if (sCut >= 2) bits.push(`${sCut} cuts`);
    else if (sCut === 1) bits.push('1 cut');
    if (sPrep >= 2) bits.push(`${sPrep} prep-days`);
    else if (sPrep === 1) bits.push('1 prep-day');
    if (sSnub > 0) bits.push(`${sSnub} snub${sSnub > 1 ? 's' : ''}`);
    samLine = `<br><span class="dim">${COPY.rivalBarista} counts ${bits.join(' · ')} — the chalkboard says TRY HARDER</span>`;
  }
  const delta = (you != null && them != null) ? (you - them) : 0;
  const lead = delta >= 0 ? `you lead by <b>${delta}</b>` : `Sam leads by <b>${-delta}</b>`;
  const weekYou = cServed;
  const weekSam = (cRivalServed || 0) + (cRivalChoices || 0);
  const weekDelta = weekYou - weekSam;
  const weekLead = day >= 2 && Math.abs(weekDelta) > 0
    ? `<br><b>week so far:</b> you ${weekYou} · ${COPY.rivalBarista} ${weekSam} · ${weekDelta >= 0 ? `you lead by <b>${weekDelta}</b>` : `${COPY.rivalBarista} leads by <b>${-weekDelta}</b>`}`
    : '';
  const body = `yesterday · <b>you served ${you}</b> · <b>Sam served ${them}</b> · ${lead}<br>`
    + `<span class="dim">${youDef} walked to ${COPY.rivalName} · ${themChose} skipped the queue and went straight across</span>`
    + reactLine
    + samLine
    + weekLead
    + `<br>today · Sam moves with <b>${stratName}</b> at ${stratPrice}`;
  // the row folds: the summary carries the scoreline, the drawer holds the
  // breakdown — sprung open while the player trails Sam
  const det = document.createElement('details');
  det.id = 'brief-rival-details';
  if (drawerOpen('brief-rival-details', wasOpen || delta < 0)) det.open = true;
  watchDrawer(det, 'brief-rival-details');
  const sum = document.createElement('summary');
  sum.textContent = `across the street — ${delta >= 0 ? `you lead by ${delta}` : `Sam leads by ${-delta}`} · week ${weekYou}–${weekSam} · change ›`;
  det.appendChild(sum);
  const row = document.createElement('div');
  row.className = 'brief-row';
  row.innerHTML = `<span class="brief-row-val">${body}</span>`;
  det.appendChild(row);
  clearEl(slot);
  slot.appendChild(det);
  slot.style.display = '';
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
    lastHedge,
  };
  snap.idris = buildIdrisMemory(snap);
  snap.row = rowSummary(day);
  // MakeReadable: if the player hasn't seen headlines yet, the Brief is the
  // first place the wire's strongest tilt is explained — not just hinted.
  const L = composeLetter(snap);
  const head = $('brief-kicker');
  const firstDay = day === 1;
  toolsToday = briefTools();
  el.classList.toggle('first-morning', firstDay);
  { const sk = $('brief-softskip'); if (sk) sk.style.display = softDay ? '' : 'none'; }
  try {
    const tilt = marketIntel?.marketShift?.[0];
    // highlight the bean tape when a tilt is active
    const tape = $('tape');
    if (tape && tilt) tape.style.color = (EVENTS[tilt.eventId]?.tier === 'good' ? '#9ad89a' : '#e07a7a');
    if (head) head.textContent = softDay ? 'Soft opening · before the street knows you'
      : firstDay && softWeekDone ? 'Day 1 of 5 · the street knows you’re open'
      : firstDay ? 'Day 1 of 5 · before opening' : `Day ${day}/${CAMPAIGN.days} · plan before opening`;
    const heading = $('brief-heading');
    if (heading) heading.textContent = firstDay ? (softWeekDone ? 'OPENING WEEK' : firstMorningCopy().heading) : 'THE MORNING BRIEF';
    const obj = $('brief-objective');
    if (obj) {
      if (firstDay) {
        obj.textContent = '';
        obj.style.display = 'none';
        if (!softDay) renderHireLine();
      }
      else {
        obj.textContent = 'Keep the café going through Saturday. Cash, regulars, and what held needs are under this.';
        obj.style.display = '';
      }
    }
  } catch { if (head) head.textContent = `Day ${day}/${CAMPAIGN.days} · plan before opening`; }
  const intro = $('brief-intro');
  if (intro) {
    if (firstDay && softWeekDone) {
      intro.style.display = '';
      intro.textContent = '';
      const p = document.createElement('p');
      p.textContent = 'The soft opening is behind you. Today the whole street can find you — same choices, many more people.';
      intro.appendChild(p);
    } else if (firstDay) {
      const FM = firstMorningCopy();
      intro.style.display = '';
      intro.textContent = '';
      const stand = document.createElement('div');
      stand.className = 'fm-stand';
      stand.textContent = standName;
      const welcome = document.createElement('p');
      welcome.textContent = softDay ? 'Before your first full week, a quiet soft opening. Only neighbours and a few early regulars know you’re here.' : FM.welcome;
      const rival = document.createElement('p');
      rival.textContent = FM.rival;
      const aim = document.createElement('p');
      aim.style.fontStyle = 'italic';
      aim.textContent = softDay ? 'Today: meet your first regulars and try your plan on a small afternoon rush.' : FM.aim;
      const mkRole = (seed, cohort, name, line) => {
        const row = document.createElement('div');
        row.className = 'fm-role';
        try { row.appendChild(portraitCanvas(seed, cohort, 48)); } catch {}
        const txt = document.createElement('div');
        const nm = document.createElement('div');
        nm.className = 'fm-name';
        nm.textContent = name;
        const ln = document.createElement('div');
        ln.className = 'fm-line';
        ln.textContent = line;
        txt.append(nm, ln);
        row.appendChild(txt);
        return row;
      };
      intro.append(stand,
        mkRole('idris', 'creatives', 'Idris · your roaster', FM.idrisQuote),
        welcome,
        mkRole('ruth', 'commuters', 'Ruth · on the bar', FM.ruthRole),
        rival, aim);
      const houseNow = lotState.entry(selectedLot);
      if (houseNow && houseNow.stock > 0) {
        const st = document.createElement('p');
        st.style.cssText = 'opacity:.75;font-size:12.5px';
        st.textContent = FM.stocked;
        intro.appendChild(st);
      }
    } else {
      intro.textContent = '';
      intro.style.display = 'none';
    }
  }
  const learning = $('brief-learning');
  let lessonUrgent = false;
  if (learning) {
    if (firstDay) { learning.textContent = ''; learning.style.display = 'none'; }
    else {
      const houseNow = lotState.entry(selectedLot);
      const ls = economicsLesson({
        houseStock: houseNow ? houseNow.stock : 0,
        houseName: LOT_CATALOG[selectedLot]?.name || selectedLot,
        lastPour,
        debt: exchange.debt,
        staffCanChoose: canChooseStaffing(day, baristaCondition),
        prevTier: exchange.lastTier,
      });
      const lsTool = ls.tool === 'market' ? 'insurance' : ls.tool;
      const dupCard = !!lsTool && (toolsToday.newToday === lsTool || toolsToday.essentialNew.includes(lsTool));
      const buried = !!toolsToday.newToday && !ls.urgent;
      if (!ls.text || dupCard || buried) { learning.textContent = ''; learning.style.display = 'none'; lessonUrgent = false; }
      else { learning.textContent = ls.text; learning.style.display = ''; lessonUrgent = ls.urgent; }
    }
  }
  const people = $('brief-people');
  if (people) {
    const pl = [];
    if (day >= 2) {
      for (const r of regulars.regulars) {
        if (r.justLost) pl.push(`${r.name} has started going to Glasshouse.`);
        else if (r.absence === 'away') pl.push(`${r.name} isn’t coming in today — ${r.absentReason}.`);
        else if (r.absence === 'returning') pl.push(`${r.name} is giving you another chance today. Say hello if you see them.`);
      }
      for (const c of companionsYesterday) pl.push(`${c.name} brought ${c.friend} in yesterday.`);
      const pct = Math.round((regulars.footfallMul - 1) * 100);
      if (pct >= 3) pl.push(`Word is getting around — about ${pct}% more people are expected because of how your regulars feel.`);
      else if (pct <= -3) pl.push(`Word is getting around — about ${Math.abs(pct)}% fewer people are expected because of how your regulars feel.`);
    }
    clearEl(people);
    if (pl.length) {
      const h = document.createElement('div');
      h.className = 'l-kicker';
      h.textContent = 'Who’s coming in';
      people.appendChild(h);
      for (const l of pl) {
        const d = document.createElement('div');
        d.className = 'd-line';
        d.textContent = l;
        people.appendChild(d);
      }
      people.style.display = '';
    } else people.style.display = 'none';
  }
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
  const ctxEl = $('brief-context');
  if (ctxEl) {
    ctxEl.style.display = toolsToday.visible.has('insurance') ? '' : 'none';
    const signal = !!(marketIntel?.marketShift?.length || exchange.event);
    const csum = ctxEl.querySelector && ctxEl.querySelector('summary');
    if (csum) csum.textContent = signal ? 'the wire — a warning in it' : 'the wire';
    ctxEl.open = drawerOpen('brief-context', signal);
  }
  // wire block: the signal is flat now — why it matters, the insider edge,
  // the whisper. The cited sources themselves live in the wire desk.
  const wire = $('brief-wire');
  if (wire) {
    wire.textContent = '';
    wire.style.display = '';
    const srcs = (marketIntel && marketIntel.sources) || [];
    const shift = marketIntel?.marketShift?.[0];
    if (srcs.length || shift) {
      if (head) {
        head.style.cursor = 'pointer';
        head.title = 'tap to open the wire';
        head.onclick = () => {
          const c = $('brief-context'); if (c) c.open = true;
          try { analytics.track('wire_opened', { day }); } catch {}
        };
      }
      if (shift && (shift.why || shift.reason)) {
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
        edge.textContent = 'the quantitative tilt (×) is District Insider · sources live in the desk';
      } else edge.textContent = 'the wire lives in the desk — sources and the tilt';
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
      if (head) { head.onclick = null; head.style.cursor = ''; head.title = ''; }
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
    const wasOpen = !!demandRow.querySelector?.('details')?.open;
    demandRow.textContent = '';
    const TT = toolsToday || briefTools();
    if (!TT.visible.has('street')) { demandRow.style.display = 'none'; return; }
    demandRow.style.display = '';
    const D = CAMPAIGN.demand;
    const stagedLabels = DEMAND_ACTIONS.filter(a => demand.staged[a])
      .map(a => a === 'sample' ? 'sampling' : a === 'sponsor' ? 'sponsoring' : a).join(' · ');
    let host = demandRow;
    if (TT.newToday !== 'street') {
      const det = document.createElement('details');
      det.id = 'brief-demand-details';
      if (drawerOpen('brief-demand-details', wasOpen || stagedLabels !== '' || day === D.sponsorDay)) det.open = true;
      watchDrawer(det, 'brief-demand-details');
      const sum = document.createElement('summary');
      sum.textContent = `the street · awareness ${demand.pips()}${stagedLabels ? ' · ' + stagedLabels : ''} · change ›`;
      det.appendChild(sum);
      demandRow.appendChild(det);
      host = det;
    } else {
      const t = document.createElement('div');
      t.style.cssText = 'font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55';
      t.textContent = `work the street — awareness ${demand.pips()}`;
      demandRow.appendChild(t);
      // first appearance gets its reason: yesterday's balked cups are the
      // problem these levers solve.
      if (lastDayStats) {
        const intro = document.createElement('div');
        intro.id = 'brief-demand-intro';
        intro.style.cssText = 'font-size:10.5px;opacity:.7;font-style:italic;margin:2px 0 5px';
        intro.textContent = `new lever — the street forgets overnight. Yesterday ${lastDayStats.balked} walked; this buys tomorrow’s crowd.`;
        demandRow.appendChild(intro);
      }
    }
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
      host.appendChild(note);
    }
    for (const def of defs) {
      const b = document.createElement('button');
      b.id = 'brief-demand-' + def.id;
      b.textContent = (demand.staged[def.id] ? '✓ ' : '') + def.label;
      b.disabled = !demand.canStage(def.id, day);
      b.setAttribute('aria-pressed', demand.staged[def.id] ? 'true' : 'false');
      if (demand.staged[def.id]) { b.style.borderColor = 'var(--matcha)'; b.style.background = 'rgba(134,168,96,.16)'; b.style.color = '#2a241c'; }
      b.onclick = () => { stageDayPlan({ marketing: { [def.id]: !planDraft.marketing[def.id] } }); renderDemandRow(); };
      host.appendChild(b);
    }
  }
  };
  renderDemandRow();
  // The nut — the fixed daily bill, shown before a cup is poured. Consequence
  // made legible: wage + pitch floor + sundries, against what's in hand.
  const nutEl = $('brief-nut');
  if (nutEl) {
    nutEl.style.display = day >= 2 ? '' : 'none';
    if (day >= 2) renderPlanQuote(); else { clearEl(nutEl); updateBriefFooter(); }
  }
  // The Row lease card — sits above the prep controls, its own section.
  renderFranchiseRow();
  // PR-A1 — Stage your prep. Two pills, both optional: pre-batch the cups
  // (paid now, fast bar at the rush) or cut the price (cheap till, slower
  // wave). Staging either commits the decision — the lever auto-fires at
  // commit and a mid-day press costs £4.20 + gossip only when the player
  // DIDN'T stage it. Defaults to "play it live" — neither pill pressed.
  renderPrepSection();
  // Phase 2 — the cellar: pick which coffee pours today and top up the
  // sack. Both stage here, execute at commit (applyLots).
  renderLotSection();
  // Phase 3 — the menu: price each drink, 86 the slow ones. Stages here,
  // commits with OPEN (applyMenu).
  renderMenuSection();
  const newEl = $('brief-new');
  if (newEl) {
    clearEl(newEl);
    const copy = toolsToday.newToday ? toolCopy(toolsToday.newToday, {
      threat: WARN_TIERS.has(exchange.event?.tier), day,
      lots: Object.fromEntries(LOT_IDS.filter(id => lotState.entry(id) && lotState.entry(id).unlocked !== false).map(id => [id, LOT_CATALOG[id]])),
    }) : null;
    if (copy) {
      newEl.style.display = '';
      const kick = document.createElement('div'); kick.className = 'bn-kicker'; kick.textContent = 'New today';
      const ttl = document.createElement('div'); ttl.className = 'bn-title'; ttl.textContent = copy.title;
      const voice = document.createElement('p'); voice.className = 'bn-voice'; voice.textContent = copy.voice;
      const why = document.createElement('p'); why.className = 'bn-why'; why.textContent = copy.why;
      newEl.append(kick, ttl, voice, why);
      if (toolsToday.newToday === 'coffee') {
        const hs = lotState.entry(selectedLot);
        if (hs && (hs.stock <= 0 || (lastPour > 0 && hs.stock < lastPour))) {
          const need = document.createElement('div');
          need.className = 'bn-note';
          need.textContent = essentialNote('coffee');
          newEl.appendChild(need);
        }
      }
      for (const lotLine of copy.lots || []) {
        const ll = document.createElement('div'); ll.className = 'bn-lot'; ll.textContent = lotLine;
        newEl.appendChild(ll);
      }
    } else newEl.style.display = 'none';
  }
  // PR-B1 — yesterday's rivalry. Day 1 has no yesterday, so the row stays shut;
  // the one-line price compare in the risk row carries the street.
  renderRivalLine();
  const risk = $('brief-risk');
  if (risk) {
    risk.style.display = day >= 2 ? '' : 'none';
    if (day >= 2) {
    const mods = modifiersForDay(day);
    const lines = [];
    if (mods.commuterDelayMinutes || mods.dwellBonus)
      lines.push(`${MACRO_SHOCKS.transit_delay.name} — ${MACRO_SHOCKS.transit_delay.desc} · new today`);
    if (mods.pitchPctDelta || mods.pitchMinDelta)
      lines.push(`${MACRO_SHOCKS.pitch_reval.name} — ${MACRO_SHOCKS.pitch_reval.desc} · ${day === MACRO_SHOCKS.pitch_reval.day ? 'new today' : 'still active'}`);
    if (mods.suppliesDelta)
      lines.push(`${MACRO_SHOCKS.dairy_crunch.name} — ${MACRO_SHOCKS.dairy_crunch.desc} · ${day === MACRO_SHOCKS.dairy_crunch.day ? 'new today' : 'still active'}`);
    const strat = CAMPAIGN.rivalStrategies[rivalStrategy];
    const priceLine = `matcha £${priceForDay(day).toFixed(2)} · ${COPY.rivalName} £${strat ? strat.price.toFixed(2) : '—'}`;
    if (!lines.length) risk.textContent = priceLine;
    else {
      lines.push(priceLine);
      risk.textContent = lines.join('\n');
      risk.style.whiteSpace = 'pre-wrap';
    }
    } else clearEl(risk);
  }
  // Ruth — the one staffing call the week can carry. When she's fading the
  // Brief offers a choice: send her home (slow bar, saved wage, she recovers)
  // or push on (full pace now, she drains further — and below a fifth, she breaks).
  const staffRow = $('brief-staff');
  if (staffRow) {
    staffRow.textContent = '';
    baristaStaged = false;
    const earnedRest = ruthRestOffer === day;
    // The lease is one line on day 1, not this row. Once it locks, the
    // robot cannot be sent home and the apprentice is not on the rota.
    if (hireLocked && weekHire === HIRE_ROBOT) staffRow.style.display = 'none';
    else if (canChooseStaffing(day, baristaCondition) || earnedRest) {
      staffRow.style.display = '';
      const t = document.createElement('div');
      t.style.cssText = 'font-size:10.5px;opacity:.78;margin-bottom:5px;font-style:italic';
      t.textContent = earnedRest && !(baristaCondition < 0.55)
        ? 'The week earned Ruth a rest — send her home this morning, or keep her on.'
        : baristaCondition < 0.25
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
        home.style.borderColor = mode === 'home' ? 'var(--brass)' : ''; home.style.background = mode === 'home' ? 'rgba(201,162,39,.16)' : ''; home.style.color = mode === 'home' ? '#2a241c' : '';
        apprentice.style.borderColor = mode === 'apprentice' ? 'var(--brass)' : ''; apprentice.style.background = mode === 'apprentice' ? 'rgba(201,162,39,.16)' : ''; apprentice.style.color = mode === 'apprentice' ? '#2a241c' : '';
        push.style.borderColor = mode === 'push' ? 'var(--brass)' : ''; push.style.background = mode === 'push' ? 'rgba(201,162,39,.16)' : ''; push.style.color = mode === 'push' ? '#2a241c' : '';
        home.setAttribute('aria-pressed', mode === 'home' ? 'true' : 'false');
        apprentice.setAttribute('aria-pressed', mode === 'apprentice' ? 'true' : 'false');
        push.setAttribute('aria-pressed', mode === 'push' ? 'true' : 'false');
      };
      sel(planDraft && planDraft.staffing !== 'work' ? planDraft.staffing : 'push', false);
      home.onclick = () => sel('home', true);
      apprentice.onclick = () => sel('apprentice', true);
      push.onclick = () => sel('push', true);
      staffRow.append(t, home, apprentice, push);
      // Phase 4 — Ruth's arc, played in the staffing row. A promised rest
      // day forces home (no choice to make); otherwise, once she's fading,
      // the player can ask what's wrong, then promise her tomorrow off —
      // locking tomorrow's staffing for a friend who becomes a regular.
      if (ruthRestDay === day) {
        const note = document.createElement('div');
        note.style.cssText = 'font-size:11px;margin-top:6px;font-style:italic';
        note.textContent = 'Ruth’s day off — promised. Solo bar today; she’ll be back.';
        staffRow.append(note);
        if (planDraft) planDraft.staffing = 'home';
      } else if (baristaCondition < 0.55 && !ruthAsked) {
        const ask = document.createElement('button');
        ask.id = 'brief-ruth-ask';
        ask.textContent = 'ask her what’s wrong';
        ask.style.cssText = 'margin-top:6px';
        ask.onclick = () => {
          ruthAsked = true;
          // the cause reads yesterday: drowned floor → the rush; else the opens.
          const cause = (lastDayStats?.balked || 0) > 50 ? RUTH_CAUSES.rush : RUTH_CAUSES.opens;
          const line = document.createElement('div');
          line.style.cssText = 'font-size:11px;margin-top:6px;font-style:italic';
          line.textContent = `Ruth, quietly: “${cause}”`;
          ask.replaceWith(line);
          if (day < CAMPAIGN.days) {
            const prom = document.createElement('button');
            prom.id = 'brief-ruth-promise';
            prom.textContent = 'promise her tomorrow off — she’ll bring a friend';
            prom.style.cssText = 'margin-top:6px';
            prom.onclick = () => {
              ruthRestDay = Math.min(day + 1, CAMPAIGN.days);
              fx.toast(`promised — Ruth rests day ${ruthRestDay}. Tomorrow’s staffing is locked.`, 'good');
              prom.disabled = true;
            };
            staffRow.append(prom);
          }
        };
        staffRow.append(ask);
      } else if (ruthAsked && ruthRestDay > 0 && ruthRestDay >= day) {
        const note = document.createElement('div');
        note.style.cssText = 'font-size:11px;margin-top:6px;font-style:italic';
        note.textContent = `promised: Ruth rests day ${ruthRestDay} — and she’ll bring someone.`;
        staffRow.append(note);
      }
    } else staffRow.style.display = 'none';
  }
  // choice row: sizing is the position — header says what this means in one line
  const actions = $('brief-actions'); if (actions) {
    actions.textContent = '';
    const showIns = toolsToday.visible.has('insurance');
    const showTab = toolsToday.visible.has('tab');
    actions.style.display = (showIns || showTab) ? '' : 'none';
    if (showIns || showTab) {
    if (showTab && toolsToday.essentialNew.includes('tab')) {
      const note = document.createElement('div');
      note.className = 'bn-note';
      note.textContent = 'New · ' + essentialNote('tab', { debt: exchange.debt, rate: CAMPAIGN.debtInterestRate });
      actions.appendChild(note);
    }
    const lab = document.createElement('div');
    lab.style.fontSize = '10px'; lab.style.letterSpacing = '.18em';
    lab.style.textTransform = 'uppercase'; lab.style.opacity = '.55';
    lab.textContent = showIns ? 'beans' : 'supplier tab';
    actions.appendChild(lab);
    const hint = document.createElement('div');
    hint.id = 'brief-sel';
    hint.style.fontSize = '10.5px'; hint.style.opacity = '.6'; hint.style.marginBottom = '4px';
    hint.textContent = '';
    actions.appendChild(hint);
    for (const act of L.actions) {
      // a dead settle pill is noise — "nothing to settle" only appears once
      // a tab exists; until then the move doesn't.
      if (act.id === 'settle' && (!showTab || act.disabled)) continue;
      if (act.id.startsWith('contract') && !showIns) continue;
      const b = document.createElement('button');
      b.dataset.id = act.id;
      b.textContent = act.label + (act.id !== 'hold' && act.explain ? '   ·  ' + act.explain : '');
      b.disabled = !!act.disabled;
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => { if (applyReply(act.id)) markBriefChoice(act.id); };
      actions.appendChild(b);
    }
    }
  }
  briefChoice = planDraft ? planDraft.hedge : null;
  markBriefChoice(briefChoice);
  const open = $('brief-open');
  if (open) {
    open.textContent = firstDay ? 'OPEN THE CAFÉ →' : 'OPEN FOR DAY →';
    open.disabled = firstDay && guidedOpening && !firstPrepChosen;
  }
  const rl = $('review-last');
  if (rl) rl.style.display = lastDayReceipt ? '' : 'none';
  const desklink = $('brief-desklink');
  if (desklink) {
    // The desk holds the sources — this button inside the context drawer is
    // the one door, shown whenever the wire has anything to say.
    if (marketIntel) {
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
  // PR-3 — Convex caption fires every dawn the Brief opens
  setBeatPower('brief', BEAT_POWERED.brief);
  renderWeekStanding();
  modals.open('brief');
  try { analytics.track('brief_shown', { day, event: exchange.event ? exchange.event.id : null, index: exchange.beanIndex, hasWire: !!marketIntel }); } catch {}
}

function onRobotHire() {
  return !softDay && weekHire === HIRE_ROBOT;
}

// One line on the existing brief. Day 1 of the real week, locked at open.
function renderHireLine() {
  const obj = $('brief-objective');
  if (!obj || day !== 1 || softDay) return;
  obj.style.display = '';
  obj.textContent = '';
  for (const c of [...(obj.children || [])]) c.remove?.();
  const ruth = document.createElement('span');
  ruth.id = 'brief-hire-ruth';
  ruth.textContent = 'Keep Ruth';
  ruth.onclick = () => stageWeekHire('ruth');
  const or = document.createElement('span');
  or.textContent = ' or ';
  const bot = document.createElement('span');
  bot.id = 'brief-hire-robot';
  bot.textContent = 'lease the robot.';
  bot.onclick = () => stageWeekHire(HIRE_ROBOT);
  obj.append(ruth, or, bot);
}

function stageWeekHire(which) {
  if (!canStageHire(day, { softDay, locked: hireLocked })) return false;
  if (which !== 'ruth' && which !== HIRE_ROBOT) return false;
  weekHire = which;
  renderHireLine();
  renderPlanQuote();
  return true;
}

function showSoftIntro() {
  const el = $('softintro'); if (!el) return;
  const wrap = $('softintro-step');
  const head = $('softintro-heading'), port = $('softintro-portrait');
  const line = $('softintro-line'), prim = $('softintro-primary'), skip = $('softintro-skip');
  const dots = $('softintro-dots');
  if (dots) [...dots.children].forEach((d, i) => d.classList.toggle('on', i === 0));
  head.textContent = standName;
  port.style.display = '';
  clearEl(port);
  try { port.appendChild(portraitCanvas('ruth', 'commuters', 72)); } catch {}
  line.textContent = 'Your café — before anyone knows it’s here. Ruth makes every drink. You watch the room and make the calls.';
  prim.disabled = false;
  prim.textContent = 'Open the doors';
  prim.onclick = () => {
    prim.disabled = true;
    prim.textContent = 'opening…';
    try { modals.close('softintro'); } catch {}
    stagedPrep.batch = false; stagedPrep.reprice = false;
    firstPrepChosen = true;
    Promise.resolve(commitDayPlan()).then(res => { if (res && res.ok) updateHUD(); }).catch(() => {});
  };
  skip.style.display = '';
  skip.onclick = () => { try { modals.close('softintro'); } catch {} beginWeek(); };
  if (wrap) { wrap.classList.remove('si-in'); void wrap.offsetWidth; wrap.classList.add('si-in'); }
  modals.open('softintro');
}

function dismissBriefAndStartDay() {
  const el = $('brief'); if (!el) return;
  if (day === 1 && guidedOpening && !firstPrepChosen) return;
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
if ($('brief-context')) watchDrawer($('brief-context'), 'brief-context');
if ($('brief-offline')) $('brief-offline').onclick = () => { if (sync.disableRun) sync.disableRun(); reset(); };
if ($('brief-softskip')) $('brief-softskip').onclick = () => beginWeek();

// ---- dawns -------------------------------------------------------------------
function capturePreDawn(enteringDay) {
  if (headless) return;
  try {
    saveWeek(localStorage, {
      seed: seedNow(),
      day: enteringDay,
      playerName, standName, playerRole, perkBg,
      softWeekDone: !!softWeekDone,
      rngState: exchange.rng && exchange.rng.state ? exchange.rng.state() : null,
      exchange: {
        beanIndex: exchange.beanIndex, day: exchange.day, debt: exchange.debt,
        contract: exchange.contract, event: exchange.event, history: exchange.history,
        matchaPrice: exchange.matchaPrice, lastTier: exchange.lastTier, lastEventId: exchange.lastEventId,
      },
      regulars: regulars.regulars.map(r => ({
        name: r.name, op: r.op, visits: r.visits, stage: r.stage, drink: r.drink,
        events: r.events, absence: r.absence, absentReason: r.absentReason,
        seen: r.seen, served: r.served, balked: r.balked,
      })),
      walkins: (walkins.heads || []).map(h => ({ ...h })),
      lots: { lots: lotState.lots, house: lotState.house, pending: lotState.pending },
      awareness: demand.awareness, satisfaction: demand.satisfaction,
      lastMilky, lastPour, lastRetail, pastryCut,
      campaign: { cRev, cCost, cOps, cBalked, cServed, cDef, cRivalServed, cRivalChoices, settledPaid },
      staff: {
        baristaCondition, weekHire, hireLocked, ruthSkill, samTruce, quietCarry,
        ruthNoticed, ruthAsked, ruthRestDay, ruthReturned,
        contractsTaken, settledCount, ignoredAdvice,
      },
    });
  } catch { /* private mode — the week still plays */ }
}
function applySavedWeek(save) {
  if (save.playerName) playerName = save.playerName;
  if (save.standName) standName = save.standName;
  if (save.playerRole) playerRole = save.playerRole;
  if (save.perkBg) perkBg = save.perkBg;
  try { applyPerk(); } catch {}
  if (save.seed != null) SEED_OVERRIDE = save.seed;
  const ex = save.exchange || {};
  exchange.beanIndex = ex.beanIndex ?? 1;
  exchange.day = ex.day ?? Math.max(0, save.day - 1);
  exchange.debt = ex.debt || 0;
  exchange.contract = ex.contract || null;
  exchange.event = ex.event || null;
  exchange.history = Array.isArray(ex.history) ? ex.history : [];
  if (ex.matchaPrice != null) exchange.matchaPrice = ex.matchaPrice;
  exchange.lastTier = ex.lastTier ?? null;
  exchange.lastEventId = ex.lastEventId ?? null;
  if (save.rngState != null) exchange.rng = seeded(save.seed || seedNow(), save.rngState);
  if (Array.isArray(save.regulars)) {
    for (const r of regulars.regulars) {
      const k = save.regulars.find(x => x.name === r.name);
      if (!k) continue;
      r.op = k.op; r.visits = k.visits; r.stage = k.stage; r.drink = k.drink;
      r.events = k.events || []; r.absence = k.absence || 'present';
      r.absentReason = k.absentReason || null; r.seen = !!k.seen;
      r.served = k.served || 0; r.balked = k.balked || 0;
    }
  }
  if (save.lots && save.lots.lots) {
    lotState.lots = save.lots.lots;
    lotState.house = save.lots.house || lotState.house;
    lotState.pending = save.lots.pending || [];
  }
  if (save.awareness != null) demand.awareness = save.awareness;
  if (save.satisfaction != null) demand.satisfaction = save.satisfaction;
  if (save.lastMilky != null) lastMilky = save.lastMilky;
  if (save.lastPour != null) lastPour = save.lastPour;
  if (save.lastRetail != null) lastRetail = save.lastRetail;
  if (save.pastryCut != null) pastryCut = save.pastryCut;
  const c = save.campaign || {};
  cRev = c.cRev || 0; cCost = c.cCost || 0; cOps = c.cOps || 0;
  cBalked = c.cBalked || 0; cServed = c.cServed || 0; cDef = c.cDef || 0;
  cRivalServed = c.cRivalServed || 0; cRivalChoices = c.cRivalChoices || 0;
  settledPaid = c.settledPaid || 0;
  const st = save.staff || {};
  if (st.baristaCondition != null) baristaCondition = st.baristaCondition;
  if (st.weekHire) weekHire = st.weekHire;
  hireLocked = !!st.hireLocked;
  if (st.ruthSkill != null) ruthSkill = st.ruthSkill;
  samTruce = !!st.samTruce;
  if (st.quietCarry != null) quietCarry = st.quietCarry;
  ruthNoticed = !!st.ruthNoticed; ruthAsked = !!st.ruthAsked;
  ruthRestDay = st.ruthRestDay || 0; ruthReturned = !!st.ruthReturned;
  contractsTaken = st.contractsTaken || 0; settledCount = st.settledCount || 0;
  ignoredAdvice = st.ignoredAdvice || 0;
  softWeekDone = !!save.softWeekDone;
  if (Array.isArray(save.walkins) && save.walkins.length && walkins) {
    walkins.heads = save.walkins;
    if (walkins.byPid && walkins.byPid.clear) {
      walkins.byPid.clear();
      for (const h of save.walkins) if (h && h.pid) walkins.byPid.set(h.pid, h);
    }
  }
}
function resumeWeek() {
  const save = loadWeek(localStorage);
  if (!save || !schedule) return false;
  started = true;
  try { audio.start(); } catch {}
  try { modals.close('title'); } catch {}
  try { $('title').classList.add('gone'); } catch {}
  applySavedWeek(save);
  phase = (save.day === 1 && !save.softWeekDone) ? 'onboarding' : 'review';
  if (exchange.day !== save.day - 1) exchange.day = Math.max(0, save.day - 1);
  const ok = prepareDay(save.day);
  if (!ok) {
    try { fx.toast('couldn’t resume that morning — starting day 1', 'warn'); } catch {}
    reset(false);
    return false;
  }
  try { rig.crane(); } catch {}
  return true;
}
function paintResume() {
  const b = $('resume'); if (!b) return;
  const save = headless ? null : loadWeek(localStorage);
  if (!save) { b.hidden = true; return; }
  b.hidden = false;
  b.textContent = resumeLabel(save);
}

function prepareDay(d) {
  if (phase !== 'onboarding' && phase !== 'review') return false;
  if (d === 1 && phase === 'onboarding' && !softWeekDone) softDay = softTest !== null ? softTest : wantsSoftDay();
  if (d !== exchange.day + 1 || d < 1 || d > CAMPAIGN.days) return false;
  capturePreDawn(d);
  phase = 'planning';
  day = d;
  if (shockPulledFlat) { menuOffered.flatwhite = true; shockPulledFlat = false; patrons.menuOffered = menuOffered; }
  shockCounter = null;
  stagedCounterable = null;
  shockDemandMul = 1;
  ctx.priceMult = 1;
  demandStreetWord = '';
  street.setDemandRead(null);
  try { world.setDemandHeat(0); world.setTickerEnergy(0); } catch {}
  milkBalked = 0;
  // default: hold (free) — the Brief never forces a debt, but it forces a choice
  planDraft = { day: d, hedge: 'hold', staffing: 'work', marketing: {} };
  if (d === 1) kitPendingAtOpen = !district.grown;   // the kit is an event only if it grows during play
  coached = d !== 1;   // the lever hint only coaches day 1, once per campaign
  companionsYesterday = patrons.companionsToday || [];
  patrons.reset(); fx.reset(); street.reset();
  street.setTruce(samTruce && d === 5);
  greetedToday.clear();
  momentPending = []; momentActive = null; momentDone.clear(); momentSeen.clear();
  { const me = $('moment'); if (me) me.hidden = true; }
  if (d >= 2) planAttendance(regulars.regulars, { day: d });
  walkins.ensureDay(d); evangelistServes = 0; womPids.clear();   // Phase 1 — fresh strangers (yesterday's known faces carry), WOM counter reset
  // Phase 4 — ceasefire Saturday: no crossings when the truce holds.
  patrons.truceCeasefire = samTruce && d === 5;
  // Phase 4 — Ruth's arc ticks at dawn: notice her fading (once), honor a
  // promised rest day (forced home), and welcome the friend she brings back.
  if (!ruthNoticed && d > 1 && baristaCondition < 0.45) {
    ruthNoticed = true;
    fx.toast('Ruth’s moving slow this morning — is she alright?', 'warn');
  }
  if (ruthRestDay === d) {
    if (planDraft) planDraft.staffing = 'home';
    if (weekHire === HIRE_ROBOT) { if (planDraft) planDraft.staffing = 'work'; }
    else fx.toast('Ruth’s day off — as promised. The bar is yours alone.', '');
  }
  syncBarStaff(planDraft && planDraft.staffing);
  if (ruthRestDay > 0 && d === ruthRestDay + 1 && !ruthReturned) {
    ruthReturned = true;
    const cand = walkins.heads.find(h => h.visits === 0) || walkins.heads[0];
    if (cand) {
      cand.visits = 5; cand._op = 0.5; cand.stage = stageFor(5, 0.5);
      fx.toast(`Ruth brought ${cand.name} — she’s a regular now`, 'good');
    }
  }
  // Phase 2 — the cellar persists across days (stocks roast and age); only
  // the daily counters reset. dawnIndex freezes the pre-roll board for top-ups.
  dawnIndex = exchange.beanIndex;
  pouredOther = 0; beanSpend = 0; emergencySpend = 0; sackSpend = 0; emergencyToast = false; emergencyCups = 0; staleNoted = new Set();
  pouredByLotToday = {}; servedByDrinkToday = {}; toolsIntroducedToday = [];
  staleByLotToday = {};   // Phase 6 — fresh stale-cup count for the autopsy
  // Phase 6 — week opinion baseline: snapshot roster ops at dawn day 1 so the
  // autopsy can name week-span coolers even without per-day deltas.
  if (d === 1) {
    try { weekOpStart = new Map(regulars.regulars.map((r) => [r.name, r.op])); }
    catch { weekOpStart = null; }
  }
  // Phase 3 — morning clean-out + fresh milk + skill: compost stale sacks
  // (Ruth nurses beans a day longer at skill 2), deliver adaptive milk,
  // wire skill points and the live menu into the bar.
  const compost = lotState.compost(d, COMPOST_AFTER + (ruthSkill >= 2 ? 1 : 0));
  compostToday = compost.cups;
  if (compost.cups > 0) fx.toast(`morning clean-out — tipped ${compost.cups} stale cups (${compost.names.join(', ')})`, 'warn');
  milkDelivery = deliveryQty(lastMilky);
  ctx.milkStock = milkDelivery; ctx.milky = 0; ctx.milkOut = false; milkToastDone = false;
  milkTipped = 0;
  waveIdx = 0; chapterIdx = 0; dayMin = DAY_START; acc = 0;
  till = 0; cogs = 0; balked = 0; served = 0; servedRetail = 0; defections = 0; rivalServed = 0;
  realizedHedgeSavings = 0; hedgedCups = 0; preparedCups = 0;
  marketingSpend = 0; trainingSpend = 0; sampleSpend = 0; lastOps = null;
  feeToday = 0; interestToday = 0; settleToday = 0;
  maintenanceBill = 0; tipsForgoneToday = 0;
  loan.beginMorning();
  stagedLoan = 0; stagedCases = 0; caseRevenueToday = 0;
  franchiseRentToday = 0; franchise.refresh(d);
  franchiseCarry = {
    awareness: franchiseFxToday.awareness || 0,
    returnees: franchiseFxToday.returnees || 0,
    rentBonus: franchiseFxToday.rentBonus || 0,
  };
  franchiseFxToday = { awareness: 0, returnees: 0, rentBonus: 0 };
  loanLotCover = 0; loanSponsorCover = 0; salesTillForOps = null;
  firstServed = firstWalked = firstServedToast = firstWalkedToast = 0;
  demand.staged.sample = false; demand.staged.sponsor = false;
  dayMods = modifiersForDay(d);
  dayWaves = wavesForDay(schedule.waves, d);
  // Phase 3 — milk sized after the sheet lands: day 1 has no history, so
  // size from today's waves; later days adapt from yesterday's milky pour.
  // Skill + live menu wire in here too (post-waves, pre-trading). Staged menu
  // edits (stageMenu headless / Brief section) land here — prepareDay owns
  // the live board, so a reset between stage and commit can't drop them.
  if (stagedMenu) applyMenu();
  milkDelivery = d <= 1
    ? waveMilkEstimate(dayWaves, ECON.spawnScale, demand.spawnMul())
    : deliveryQty(lastMilky);
  if (d === 1 && starCarry) {
    milkDelivery = starredDelivery(milkDelivery, true);
    starCarry = false;
  }
  ctx.milkStock = milkDelivery; ctx.milky = 0; ctx.milkOut = false; milkToastDone = false;
  // One pastry case for today's retail wave. The cabinet is filled here.
  // Each croissant pays wholesale when it sells. Unsold units are billed
  // at close, at the same wholesale, so they are not prepaid and not
  // billed twice. Soft opening uses the practice rate. A cut staged on
  // the previous brief shrinks this case, then clears.
  pastryOnOrder = pastryPar(dayWaves, ECON.spawnScale, softDay ? SOFT_MUL : demand.spawnMul(), lastRetail, pastryCut);
  pastryCut = 0;
  ctx.pastryStock = null;
  pastrySpend = 0;
  pastryWaste = 0;
  pastryWasteCost = 0;
  pastryMissDrinks = 0;
  pastryMissWalks = 0;
  pastryMissNoted = false;
  applySeizureBoard();
  patrons.skillPts = ruthSkill;
  patrons.menuOffered = menuOffered;
  patrons.menuPrices = menuPrices;
  ctx.menuPrices = menuPrices;
  stagedRoast = lotState.entry(selectedLot)?.roast ?? 3;
  patrons.dwellMul = 1 + (dayMods.dwellBonus || 0);
  rivalStrategy = strategyForDay(d, exchange.event?.tier);
  try { world.setRivalStrategy(rivalStrategy, CAMPAIGN.rivalStrategies[rivalStrategy].price.toFixed(2)); } catch {}
  prebatched = false; repriced = false; ctx.prebatched = false; ctx.repriced = false; ctx.batchUnits = 0; ctx.batchReservedUntil = 0; patrons.repriced = false;
  peakQueue = 0; waveBalked = 0; waveServed = 0; prebatchHelped = false; eveningCallShown = false; eveningFast = false; rushFast = false; closed = false;
  nudgedStanding = false;
  turnaways = 0; turnawayToastDone = false;
  leversTimeLocked = false; leverOverrideCount = 0;
  waveBatchServed = 0; waveStockoutAt = 0;
  coach = null; coachHold = false; coachHide();
  stagedPrep = { batch: false, reprice: false };
  firstPrepChosen = !(d === 1 && guidedOpening);
  baristaCrisis = false;
  if (d === 1) { forecastShown = false; nudgedQueue = nudgedBalk = nudgedPrice = false; }
  if (baristaRested) { baristaRested = false; fx.toast('Ruth’s back — rested. The bar hums.', 'good'); }
  pendingGossip = null;
  offerShown = false; offerResolved = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0;
  party = null; batchWaste = 0; batchSpend = 0; patrons.party = null; patrons.partyActive = false;
  patrons.markSeenOnly = softDay ? SOFT_CAST : null;
  if (softDay && d === 1) softRng = seeded(seedNow() + 101);
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; solicitorAt = 0;
  wifiOutage = softDay ? null : planOutage(seedNow(), d);
  briefChoice = null;
  world.setMatchaPrice(priceForDay(d).toFixed(2), false);
  updateTicker();
  fx.receipt(null); fx.notebook(false);
  try { modals.close('letter'); modals.close('receipt'); } catch {}
  paused = true; if ($('pause')) $('pause').textContent = 'resume';
  updateHUD();
  if (!softDay && sync.managed && sync.managed()) {
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
    scheduleRun(() => { if (phase === 'planning') { if (softDay) showSoftIntro(0); else showMorningBrief(); } }, 120);
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
  if (onRobotHire()) {
    const maint = isMaintenanceMorning(seedNow(), d);
    maintenanceBill = maint ? CAMPAIGN.staff.maintenanceCallout : 0;
    patrons.staffMul = robotPace(maint) * perkStaffMul;
    patrons.balkMul = CAMPAIGN.staff.robotBalkMul;
  } else if (baristaHomeToday) patrons.staffMul = 0.7;
  else if (apprenticeHiredToday) patrons.staffMul = (CAMPAIGN.staff?.apprenticeStaffMul || 1.05) * perkStaffMul;
  syncBarStaff();
  const ev = exchange.openDay(intelBias);    // drift first, then roll the market + the event
  // Phase 2 — wire → shelf: schedule this event's lot moves, land what's due.
  // The Brief (pre-roll) stages from yesterday's cellar; landed moves toast
  // here, at trading start, when the new prices bite.
  for (const note of lotState.applyWireEvent(ev.id, d)) fx.toast(`wire → shelf: ${note}`, '');
  for (const line of lotState.resolveDawn(d)) fx.toast(line, 'warn');
  if (exchange.geshaUnlocked) {
    const g = lotState.entry('gesha');
    if (g && !g.unlocked) {
      g.unlocked = true;
      g.unlockUntil = Math.max(g.unlockUntil, 5);
      fx.toast('Idris heard about the code — Panama Gesha on offer (60 cups)', 'good');
    }
  }
  // Phase 4 — loyalty alpha: 2+ covers taken and Idris calls the frost a
  // day early — Gesha opens now, not when the move lands.
  if (ev.id === 'frost_minas' && contractsTaken >= 2) {
    const g = lotState.entry('gesha');
    if (g && !g.unlocked) {
      g.unlocked = true;
      g.unlockUntil = Math.max(g.unlockUntil, d + 2);
      fx.toast('Idris called it early — Gesha open for loyalty', 'good');
    }
  }
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
  // Phase 5 — the board behind the bar shows the whole menu: live prices,
  // 86'd rows struck, the reprice cut chalked through.
  try {
    world.setMenu?.({
      prices: { ...menuPrices, matcha: Number(salePrice(exchange, false)) },
      offered: { ...menuOffered },
      matchaStruck: !!repriced,
    });
  } catch {}

  // Dynamic rival strategy:
  patrons.rivalStrategy = rivalStrategy;
  if (d >= 2 && rivalStrategy !== 'DEFAULT' && !headless) {
    const stratDef = CAMPAIGN.rivalStrategies[rivalStrategy];
    if (stratDef) fx.toast(`${COPY.rivalBarista} moves: ${stratDef.name} (£${stratDef.price.toFixed(2)}) — ${COPY.rivalName}'s chalkboard changed`, 'warn');   // PR-B1 — name Sam personally
  }
  if (estherCard) { till -= 2; fx.toast('esther’s stamp card: −£2', ''); }  // her cup's on the house
  { const fr = franchise.rentDue(d); if (fr) { till += fr; franchiseRentToday = fr; } }  // 14 The Row pays at open
  ctx.pastryStock = pastryOnOrder;
  pastryOnOrder = 0;
  world.setMail(false);
  mailT.disarm();                 // the wait for a reply never crosses into a live floor
  mailPending = false;
  world.setMist(ev.tier === 'cata' ? 1 : ev.tier === 'bad' ? 0.4 : 0);
  // Phase 5 — rain day: grey soak on the street, shafts off, lease board dry.
  // Demand already carries ev.demand (0.82×); the room reads it in the air.
  if (ev.id === 'rain_soak') {
    try {
      world.setRain?.(0.9);
      world.setMist(0.9);
      world.setGodRay?.(0.05);
      world.setMotes?.(0.05);
      world.mistMat.color.setHex(0x8a9aa8);
    } catch {}
    fx.toast('rain on the Row — thin footfall, long stays', '');
  } else {
    try { world.setRain?.(0); } catch {}
  }
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
  applyConstruction(d);
  const constructionOn = d >= 5;     // matches dayHasConstruction in world.js
  fx.constructionActive = constructionOn;   // drifting dust between the scaffolds
  audio.constructionSaw(constructionOn);    // a low procedural saw fading in/out
  audio.constructionHammer(constructionOn); // a jittered wooden tock + metal click
  // Per-regular `seen` is now flipped on individually in patrons.spawn() via
  // regulars.markSeen(cohort). No more blanket "everyone was here" — opinion
  // moves only for regulars who actually showed up today.
  rig.resetView();
  // Street picture only. tick() still multiplies the wave by event.demand
  // and shockDemandMul — this read does not change who pays.
  const read = demandShockRead(ev.demand, dawnDemandMult({
    day: d, staged: stagedCounterable, counter: shockCounter, menuOffered,
  }));
  demandStreetWord = read.word;
  try { world.setDemandHeat(read.heat); world.setTickerEnergy(read.energy); } catch {}
  street.setDemandRead(read);
  street.setTruce(samTruce && d === 5);
  street.beginDay(d, seedNow());
  street.syncFranchise(franchise, d);
  updateTicker();
  // Managed runs mirror through sync.finishDay at close; unmanaged/local runs
  // never write — the leaderboard is still refreshed read-only.
  refreshStands();
  try { world._onCatMeow = () => { try { audio.meow(); } catch {} }; } catch {}
  // gesha persists: Gwen's request lingers as a brass forecast stripe next day
  if (exchange.geshaUnlocked && day > 1) {
    fx.toast('Gwen\'s still asking about the gesha — GRUNDS unlocked', 'warn');
  }
  vitality.recompute();   // dawn re-skins the block with the fresh numbers
  phase = 'trading';
  closed = false;
  paused = false; if ($('pause')) $('pause').textContent = 'pause';
  const headline = ev.head || 'a new day';
  const line = ev.line || (ev.head || 'the district stirs');
  const tone = ev.tier === 'cata' ? 'bad' : ev.tier === 'good' ? 'good' : '';
  const sayDay = () => {
    fx.toast('DAY ' + day + '/' + CAMPAIGN.days + ' — ' + headline, tone);
    fx.card('DAY ' + day, line);
  };
  // The line, the Glasshouse glow, and the ticker are already up.
  // The headline follows, without the multiplier.
  if (!headless && read.kind !== 'flat') scheduleRun(sayDay, DEMAND_CARD_MS);
  else sayDay();
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
    street: demandStreetWord,
  });
}

function campaignClose(insolvent = false) {
  if (campaignDone || phase !== 'review') return;
  if (!insolvent && (day < CAMPAIGN.days || exchange.day < CAMPAIGN.days)) return;
  closed = true;
  campaignDone = true;
  try { clearWeek(localStorage); } catch {}
  for (const t of TOOL_IDS) introducedSet().add(t);
  persistIntroduced();
  phase = 'finale';
  if ($('review-continue')) $('review-continue').style.display = 'none';
  if ($('review-letter')) $('review-letter').style.display = 'none';
  if ($('receipt-back')) $('receipt-back').style.display = 'none';
  // PR-4b — founder replay CTA (only when the entitlement is active)
  try { if (billing.isFounder()) $('founder-replay').style.display = ''; } catch {}
  // PR-3 — verdict caption: the day-5 "Replay your week" line is the
  // placement for the District Insider upsell.
  setBeatPower('verdict', BEAT_POWERED.verdict);
  audio.closing();
  const net = cRev - cCost - cOps - settledPaid - exchange.debt;   // the week, after the whole cost sheet
  const rep = regulars.reputation;
  const verdictId = campaignVerdict(net, rep);
  starCarry = verdictId === 'star';
  const stand = weekStanding({ net, rep, day: Math.min(day, CAMPAIGN.days), days: CAMPAIGN.days, asOf: 'close' });
  const v = (verdictId === 'star' || verdictId === 'good' || verdictId === 'held')
    ? VERDICTS[verdictId]
    : `${VERDICTS[verdictId]} ${stand.heldLine} ${stand.cashLine} ${stand.repLine}`;
  // PR-B3 — the weekly winner is who served more cups this week
  const yourWeekTotal = cServed;
  const samWeekTotal = (cRivalServed || 0) + (cRivalChoices || 0);
  const weekDelta = yourWeekTotal - samWeekTotal;
  // Phase 4 — a snubbed Sam wants it more: he breaks DEUCE ties.
  let wkWin = weekDelta > 0 ? 'you' : (weekDelta < 0 ? COPY.rivalBarista : 'tie');
  if (wkWin === 'tie' && samGrudge.snubs > 0) wkWin = COPY.rivalBarista;
  const wkMargin = Math.abs(weekDelta);
  const lines = [
    [standName, playerName + ' — ' + playerRole],
    [`revenue (${Math.min(day, CAMPAIGN.days)} days)`, fmt(cRev)], ['bean cost', fmt(cCost)], ['operating costs', fmt(cOps)],
    ['final debt', fmt(exchange.debt)],
    ['the week', net >= 0 ? 'viable — the stand is still yours' : 'insolvent — the tab came due'], ['—', '—'],
    ['cups poured', cServed], ['walked to ' + COPY.rivalName, cDef], ['—', '—'],
    ['you vs ' + COPY.rivalBarista, `you ${cServed} · ${COPY.rivalBarista} ${cRivalServed + cRivalChoices}`],   // PR-B1 — final week tally
    ['WEEK WINNER', wkWin === 'tie' ? 'DEUCE — neither side blinks' : `${wkWin} won by ${wkMargin} cups`],   // PR-B3 — the week resolves
    // Phase 4 — the season on the receipt: what Sam counts, and whether
    // Saturday held.
    [`${COPY.rivalBarista} remembers`, `${samGrudge.cuts} cuts · ${samGrudge.preps} prep-days · ${samGrudge.snubs} snubs`],
    ...(samTruce ? [['Saturday ceasefire', 'held — no bleeding, no feast']] : []),
    ['regulars', `${rep}/100 · held needs ${VERDICT_GATES.held.repAtLeast}`],
    ['held needs', `over ${fmt(VERDICT_GATES.held.netAbove)} · rep ${VERDICT_GATES.held.repAtLeast}`],
    ['NET WORTH', fmt(net)],
    // Phase 6 — week autopsy: traceable failure reads as fair, not cruel.
    // The week's cause rows render under "lost because:" + continuation lines.
    ...(() => {
      try {
        const snap = regulars.regulars.map((r) => ({ name: r.name, op: r.op }));
        const causes = buildAutopsy(campaignDays, snap);
        const turn = turningPoint(campaignDays);
        return [...(turn ? [['the turning point', turn]] : []), ...causes.map((c, i) => [i === 0 ? 'lost because' : '…', c])];
      } catch { return []; }
    })(),
  ];
  // Finale: the street turns over on camera before the verdict lands. The
  // camera visits the sold storefronts, the card names it, then the receipt.
  // Phase 5 — written camera grammar + the lease sign as a physical object.
  try { rig.shot?.('newbuild', world); } catch {}
  if (!rig.shot) rig.focus(world.focus.newbuild, 17, 7, Math.PI);
  try { world.setLeaseFinale?.(wkWin === 'you' ? 'you' : wkWin === 'tie' ? 'tie' : 'sam'); } catch {}
  // PR-B3 — SOLD card adapts to who won the week. Player wins → Sam's spot
  // reads FOR LEASE on camera. Rival wins → SOLD-TO-WIN narrative (Sam
  // absorbs the lot). Tie → a deuce card.
  if (wkWin === 'you') {
    fx.card('FOR LEASE', `Sam's window — you took the week by ${wkMargin} cups`);
    fx.toast(`you won the week by ${wkMargin} cups — Sam's board reads FOR LEASE`, 'good');
  } else if (wkWin === COPY.rivalBarista) {
    fx.card('SOLD', `Sam's lot — ${COPY.rivalBarista} took the week by ${wkMargin} cups; a new tenant opens against you`);
    fx.toast(`Sam won the week by ${wkMargin} cups — the chalkboard stays theirs`, 'warn');
  } else {
    fx.card('DEUCE', 'neither side blinks — the week is a draw');
    fx.toast('DEUCE — both chalkboards hold; the street stays split', 'warn');
  }
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
  const inPlay = phase === 'trading' && !closed;
  document.body?.classList.toggle('in-play', inPlay);
  // Cheap per-tick state: progress bar + lever availability + queue bar +
  // batch countdown stay live so inputs never feel stale, even at 20×.
  $('progress').style.width = ((dayMin - DAY_START) / (DAY_END - DAY_START) * 100) + '%';
  // Morning prep is one press. During the rush the button opens again
  // once the cups run down to 8, so topping up is a second decision.
  // Prep and the price cut lock each other out for the day.
  const lv = leverState(leverSnapshot());
  $('prebatch').disabled = !lv.batch.available;
  $('reprice').disabled = !lv.reprice.available;
  // queue health bar: under 5 = ok → 5–10 = warm → 10+ = hot
  const qq = patrons.queueLength;
  const qHeat = qq > 10 ? 'hot' : qq > 5 ? 'warm' : 'ok';
  const qPct = Math.min(100, Math.round(qq / 5 * 100));
  if ($('queuefill')) {
    $('queuefill').style.width = qPct + '%';
    const hb = qq > 10 ? ' hot heartbeat' : qq <= 5 ? ' ok purr' : '';
    $('queuefill').className = qHeat + hb;
  }
  if ($('qlabel')) $('qlabel').textContent = `${qq} in line — ` + (qq > 5 ? 'they may leave' : 'holding');
  try { world.setPlantHealth(qq); audio.purr(qq <= 5 && patrons.count > 2); } catch {}
  // the tape: the bean board as a visible object — yesterday's close →
  // today, the event that moved it, click-through to the wire
  if ($('batchline')) {
    $('batchline').hidden = day < 2 && !(prebatched || ctx.batchUnits > 0);
    if ($('batchword')) $('batchword').textContent =
      (prebatched && ctx.batchUnits > 0 && ctx.batchReservedUntil > dayMin)
        ? 'reserved for 14:00' : (dayMin >= 840 && dayMin < 1020 ? 'cups left' : 'cups ready');
  }
  if ($('skiprush')) $('skiprush').hidden = !canSkipToRush();
  if ($('wirebtn')) $('wirebtn').style.display = (day >= 2 && marketIntel) ? '' : 'none';
  if ($('floorstats')) $('floorstats').hidden = day < 2;
  if ($('syncbadge')) $('syncbadge').hidden = day < 2;
  if ($('district')) $('district').hidden = day < 2;
  if ($('pressure')) $('pressure').hidden = day < 2 && !repriced;
  if ($('status') && day < 2) $('status').hidden = true;
  if ($('tape')) {
    if (started && day >= 2) {
      const pct = Math.round((exchange.beanIndex - tapePrev) * 100);
      $('tape').style.display = '';
      $('tape').innerHTML = `beans <b>${exchange.beanIndex.toFixed(2)}</b> ${pct > 0 ? '↑' : pct < 0 ? '↓' : '→'}` +
        (exchange.event ? ` · <span class="dim">${String(exchange.event.head).toLowerCase()}</span>` : '') +
        ` · <span class="dim" title="street awareness — work it at dawn">street ${demand.pips()}</span>` +
        (marketIntel ? ' <span class="dim">· wire ↗</span>' : '');
    } else $('tape').style.display = 'none';
    // Inline display beats body.in-play #tape, so clear it while the day is open.
    if (inPlay) $('tape').style.display = '';
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
  }
  // lever attention: pulse until first use on day 1
  const cutSmall = $('reprice') && $('reprice').querySelector('small');
  if (cutSmall) {
    if (repriced) cutSmall.textContent = `matcha is ${fmt(ECON.matchaDeal)} today`;
    else if (!lv.reprice.available) cutSmall.textContent = lv.reprice.reason || 'locked';
    else if (lv.reprice.changesPlan) {
      const board = salePrice(exchange, false);
      cutSmall.textContent = `down from £${board.toFixed(2)} · ${fmt(LEVER_OVERRIDE_PRICE)} late switch + the room hears it`;
    } else {
      const board = salePrice(exchange, false);
      cutSmall.textContent = `down from £${board.toFixed(2)} · locks prep for today`;
    }
  }
  const pb = $('prebatch');
  if (pb && pb.querySelector) {
    const inWave = dayMin >= 840 && dayMin < 960;
    const nodes = pb.childNodes || [];
    const label = nodes[0];
    if (label && label.nodeType === 3) label.textContent = (inWave && prebatched ? `Top up ${ECON.batchUnits} cups ` : `Buy ${ECON.batchUnits} cups `);
    const sub = pb.querySelector('small');
    if (sub) {
      if (!lv.batch.available) sub.textContent = lv.batch.reason || 'locked';
      else if (lv.batch.changesPlan) sub.textContent = `${fmt(lv.batch.cost)} — £40 stock + £4.20 late switch · the room hears it`;
      else if (prebatched && ctx.batchUnits > 0) sub.textContent = `${ctx.batchUnits} ready · pay ${fmt(ECON.batchCost)} to top up`;
      else if (inWave) sub.textContent = `pay ${fmt(ECON.batchCost)} · leftovers spoil at close`;
      else sub.textContent = `pay ${fmt(ECON.batchCost)} · reserved for 14:00 · leftovers spoil`;
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
      html += `<br><span class="dim"><b>${party.name}</b> · ${party.served} stayed · ${party.walked} walked</span>`;
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
    layoutMobile();
  }
  const h = String(Math.floor(dayMin / 60)).padStart(2, '0'), m = String(dayMin % 60).padStart(2, '0');
  $('clock').textContent = (paused ? '❚❚ ' : '') + `${h}:${m}`;
  world.setRivalHeat(patrons.rivalQ.length);   // their sign burns as their line grows
  if ($('daytag')) {
    const heldRep = VERDICT_GATES.held.repAtLeast;
    const repNow = regulars.reputation;
    const repBit = repNow < heldRep ? `regulars ${repNow} · held needs ${heldRep}` : `regulars ${repNow}`;
    const full = softDay ? 'SOFT OPENING · regulars ' + repNow
      : 'DAY ' + day + '/' + CAMPAIGN.days + '  ·  ' + repBit;
    const live = (inPlay && !softDay)
      ? ('DAY ' + day + '/' + CAMPAIGN.days + (repNow < heldRep ? ` · ${repBit}` : ''))
      : full;
    $('daytag').textContent = live;
    $('daytag').title = full;
  }
  $('till').textContent = fmt(till);
  if ($('tillhint')) {
    const stockCost = till < 0 && (batchSpend > 0 || prebatched);
    $('tillhint').hidden = !stockCost;
    $('tillhint').textContent = stockCost ? ' · cup stock, paid back as they sell' : '';
  }
  $('balk').textContent = balked;
  if ($('poured')) $('poured').textContent = String(served + servedRetail);
  if (day >= 2 && defections) {
    $('status').hidden = false;
    $('status').innerHTML = `<b class="hot">${defections}</b> crossed to ${COPY.rivalName}`;
  } else {
    $('status').hidden = true;
    $('status').textContent = '';
  }
  // Day 1 shows the price only after the cut. From day 2 the cost drift
  // sits on this line again.
  if ($('pressure')) {
    if (day >= 2 || repriced) {
      const driftPct = Math.round((exchange.beanIndex - 1.0) * 100);
      const driftTxt = (driftPct >= 0 ? '+' : '') + driftPct + '%';
      const dayPrice = salePrice(exchange, repriced);
      const costBit = day >= 2 ? `costs <b>${driftTxt}</b> · ` : '';
      $('pressure').innerHTML = `${costBit}matcha <b>£${dayPrice.toFixed(2)}</b>` +
        (exchange.debt > 0 ? ` · tab <b>${fmt(exchange.debt)}</b>/${fmt(CAMPAIGN.creditLimit)}` : '');
    }
  }
  if (!closed) updateTicker();
  updateVitals();
}

// ---- utilities: the wifi drop -------------------------------------------------------
// Non-modal on purpose: the floor already pauses for the offer, incident and
// evening call. The drop is announced once, lives on the vitals panel (with
// the tether button), and costs whatever the player lets slip at the till.
function wifiBeats() {
  const st = outageStatus(wifiOutage, dayMin);
  if (st === 'down' && !wifiOutage.announced) {
    wifiOutage.announced = true;
    fx.toast(`wifi’s down — the card reader can’t connect. Tether a phone (${fmt(CAMPAIGN.utilities.outage.tetherCost)}) on the panel, or lose card sales`, 'bad');
    try { analytics.track('wifi_outage', { day, start: wifiOutage.start, end: wifiOutage.end }); } catch {}
  }
  if (st === 'restored' && !wifiOutage.restored) {
    wifiOutage.restored = true;
    if (wifiOutage.tethered) patrons.staffMul /= CAMPAIGN.utilities.outage.tetherStaffMul;
    if (wifiOutage.announced) fx.toast('wifi’s back — the reader’s taking cards again', 'good');
  }
}
function tetherWifi() {
  if (phase !== 'trading' || outageStatus(wifiOutage, dayMin) !== 'down') return false;
  const o = CAMPAIGN.utilities.outage;
  const cost = o.tetherCost * perkCostMul;
  wifiOutage.tethered = true;
  wifiOutage.tetherCost = cost;
  till -= cost;
  patrons.staffMul *= o.tetherStaffMul;
  markIntent();
  fx.toast(`on Ruth’s phone hotspot (−${fmt(cost)}) — cards work, the reader lags`, 'good');
  try { audio.clink(); } catch {}
  try { analytics.track('wifi_tether', { day, at: dayMin }); } catch {}
  lastHudText = 0;
  return true;
}

// ---- running the stand (right-hand vitals) ----------------------------------------
// Read-only view over state the sim already owns. Staffing reads the live flags
// while trading and the staged plan at dawn, so the panel previews the choice.
function vitalsSnapshot() {
  const trading = phase === 'trading';
  const staffing = onRobotHire() ? 'robot'
    : trading ? (baristaHomeToday ? 'home' : apprenticeHiredToday ? 'apprentice' : 'work')
    : (planDraft ? planDraft.staffing : 'work');
  const house = lotState.house;
  const he = lotState.entry(house);
  const cellarStock = LOT_IDS.reduce((n, id) => {
    const e = lotState.entry(id);
    return n + (e && e.unlocked !== false ? e.stock : 0);
  }, 0);
  const ops = operatingCosts({
    till, served: served + servedRetail, staffing,
    marketing: marketingSpend, training: trainingSpend, sampling: sampleSpend,
    perkCostMul, modifiers: dayMods,
  });
  return {
    phase, day, dayMin, staffing, staffCondition: baristaCondition, crisis: baristaCrisis,
    houseLot: house, houseStock: he ? he.stock : 0, houseAge: lotState.age(house, day), housePriceMul: he ? he.priceMul : 1,
    cellarStock, emergency: emergencyCups > 0,
    milkDelivery, milkStock: ctx.milkStock, milkOut: ctx.milkOut,
    batchUnits: ctx.batchUnits, prebatched,
    beanIndex: exchange.beanIndex, matchaBean: exchange.costPerCup,
    flatwhitePrice: menuPrice('flatwhite', menuPrices), matchaPrice: salePrice(exchange, repriced),
    perkCostMul, ops, till, cogs, debt: exchange.debt,
    wifi: outageStatus(wifiOutage, dayMin), wifiBack: wifiOutage ? wifiOutage.end : 0,
  };
}
// The panel's own buttons (the tether) — one delegated listener.
$('vitals')?.addEventListener?.('click', e => {
  const act = e.target?.closest?.('[data-act]')?.dataset.act;
  if (act === 'tether') { tetherWifi(); updateVitals(); }
});
function updateVitals() {
  const panel = $('vitals');
  if (!panel) return;
  const show = phase === 'trading' || phase === 'planning' || phase === 'review';
  panel.hidden = !show;
  document.body?.classList.toggle('vitals-on', show);
  if (!show) return;
  renderVitals($('vitals-list'), buildVitals(vitalsSnapshot()));
}

// ---- levers ----------------------------------------------------------------------
let _lastNudge = { t: 0, r: '' };
function nudgeToast(reason) {
  const n = performance.now();
  if (n - _lastNudge.t < 1500 && _lastNudge.r === reason) return;
  _lastNudge = { t: n, r: reason };
  fx.toast(reason, 'warn');
}
function doPrebatch(opts = {}) {
  const lv = leverState(leverSnapshot()).batch;
  if (!lv.available) { if (lv.reason && !opts.asPlanned) nudgeToast(lv.reason); return; }
  // PR-5 — after commit, pressing the lever costs £4.20 + a small opinion hit.
  // PR-A1 — except when the player staged it in the Brief; that decision was
  // already made and auto-fired at commit time, so the press is free.
  if (lv.changesPlan && !opts.asPlanned && !chargeLeverOverride('pre-batch')) return;
  markIntent();
  // morning is one prep; the rush reopens under 8 cups
  const topUp = prebatched || ctx.batchUnits > 0;
  const queueBefore = patrons.queueLength;
  const priceBefore = repriced ? ECON.matchaDeal : (exchange.matchaPrice ?? priceForDay(day));
  prebatched = true; ctx.prebatched = true;
  ctx.batchUnits = topUp ? ctx.batchUnits + ECON.batchUnits : ECON.batchUnits;
  if (dayMin < 840) ctx.batchReservedUntil = 840;
  till -= ECON.batchCost; batchSpend += ECON.batchCost;
  fx.notebook(false);
  fx.toast((topUp
    ? `topped up — ${ECON.batchUnits} more cups (−${fmt(ECON.batchCost)}; leftovers spoil)`
    : `${ECON.batchUnits} cups bought (−${fmt(ECON.batchCost)}) — ${dayMin < 840 ? 'reserved for the 14:00 wave' : 'fast bar, full price'}; leftovers spoil`)
    + (opts.asPlanned ? ' · as planned in the brief' : ''), 'good');
  audio.clink();
  world.setMatchaPrice(exchange.matchaPrice ? exchange.matchaPrice.toFixed(2) : '4.80', repriced);
  world.flashChalk('batch');
  try { fx.chalkDust(-5.5, 2.75, -6.48); audio.chalkScreech(); } catch {}
  feel({ object: world._chalkPlane, always: true });
  rivalReact('prebatch');   // PR-B2 — Sam clocks the prep
  try { audio.clink(); } catch {}
  batchPulseUntil = performance.now() + 650;
  $('prebatch').classList.remove('attention'); $('reprice').classList.remove('attention');
  // analytics: lever attribution
  try {
    const payload = { day, dayMin, queue: queueBefore, till, price: priceBefore, topUp };
    const isFirst = !analytics.firstLeverAt;
    if (isFirst) { analytics.firstLeverAt = { lever: 'batch', day, dayMin, wallMs: Date.now() }; analytics.track('first_lever_at_min', { lever: 'batch', day, dayMin, wallMs: Date.now(), queue: queueBefore }); }
    analytics.track('lever_batch', { day, dayMin, queue: queueBefore, ...payload });
  } catch {}
  lastHudText = 0;
  updateHUD();
}

function canSkipToRush() {
  return phase === 'trading' && !closed && !rushFast && dayMin < 840
    && (prebatched || repriced) && offerResolved;
}

function skipToRush() {
  if (!canSkipToRush()) return false;
  rushFast = true;
  lastHudText = 0;
  updateHUD();
  return true;
}

function doReprice(opts = {}) {
  const lv = leverState(leverSnapshot()).reprice;
  if (!lv.available) { if (lv.reason && !opts.asPlanned) nudgeToast(lv.reason); return; }
  // PR-5 — after commit, pressing the lever costs £4.20 + a small opinion hit.
  // PR-A1 — except when the player staged it in the Brief.
  if (lv.changesPlan && !opts.asPlanned && !chargeLeverOverride('reprice')) return;
  markIntent();
  const queueBefore = patrons.queueLength;
  repriced = true; ctx.repriced = true; patrons.repriced = true;
  world.setMatchaPrice(ECON.matchaDeal.toFixed(2), true);
  world.flashChalk('reprice');
  feel({ object: world._chalkPlane, always: true });
  try { fx.chalkDust(-5.5, 2.75, -6.48); audio.chalkScreech(); } catch {}
  fx.notebook(false);
  fx.toast(`matcha is ${fmt(ECON.matchaDeal)} for the rest of today — prep is locked` + (opts.asPlanned ? ' · as planned in the brief' : ''), 'good');
  audio.clink();
  rivalReact('reprice');   // PR-B2 — Sam undercuts visibly
  $('prebatch').classList.remove('attention'); $('reprice').classList.remove('attention');
  try {
    const isFirst = !analytics.firstLeverAt;
    if (isFirst) { analytics.firstLeverAt = { lever: 'reprice', day, dayMin, wallMs: Date.now() }; analytics.track('first_lever_at_min', { lever: 'reprice', day, dayMin, wallMs: Date.now(), queue: queueBefore }); }
    analytics.track('lever_reprice', { day, dayMin, queue: queueBefore, till });
  } catch {}
  lastHudText = 0;
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
  const o = softDay ? { ...OFFERS[0],
    line: '“Mind if the study group lands at 14:00? Twenty-four of us — all matcha.”',
    effect: 'say yes → twenty-four students arrive at 14:00 for matcha — Pip’s group is counted on the evening card',
    accept() { party = { name: 'Pip', cohort: 'students', left: 24, served: 0, walked: 0 }; momentEnqueue('plan', 'plan', { expiresAt: 840 }); },
  } : OFFERS[(day - 1) % OFFERS.length];
  presentBeat(o, 'a regular asks · y / n', false);
}
// The floor bites back — operational incidents, days 2+, post-wave. Each is
// a real cost or a real trade, not flavor: slow bar, lost sales, rep hits,
// deferred risk. Seed-offset so different seeds see different weeks.
const INCIDENTS = [
  { who: 'the plumber', base: 45, share: 0.05, line: c => `“Bathroom’s backed up. Emergency callout’s £${c}, cash.”`,
    effect: c => `pay £${c} · or the floor loses patience — walk-outs run hotter today`,
    yes: c => `pay the £${c}`, no: 'they can hold it',
    accept() { till -= this._cost * perkCostMul; },
    decline() { patrons.balkMul = 1.6; } },
  { who: 'Ruth, your barista', base: 55, share: 0.06, line: '“So sorry — I’ve woken up with no voice. I can’t make it in.”',
    effect: c => `£${c} agency cover · or solo shift — the bar runs ~40% slower`,
    yes: 'book the cover', no: 'work it solo',
    accept() {
      till -= this._cost * perkCostMul;
      // The cover is the apprentice. A robot stretch never takes this call.
      if (sickMorningCover(weekHire) === 'apprentice') {
        apprenticeHiredToday = true;
        patrons.apprenticeActive = true;
        patrons.staffMul = (CAMPAIGN.staff?.apprenticeStaffMul || 1.05) * perkStaffMul;
        syncBarStaff();
      }
    },
    decline() { patrons.staffMul = 0.6; } },
  { who: 'the card machine', base: 25, share: 0.03, line: 'The reader’s dead. Cash only until a 4G dongle lands.',
    effect: c => `£${c} for the dongle · or a fifth of today’s sales die at the till`,
    yes: 'order the dongle', no: 'cash only today',
    accept() { till -= this._cost * perkCostMul; },
    decline() { cashOnly = 0.2; } },
  { who: 'the inspector', base: 30, share: 0.04, line: '“Council. Routine check — that milk needs a dated fridge log.”',
    effect: c => `£${c} compliance fix now · or −6 reputation when the report lands`,
    yes: c => `pay the £${c}`, no: 'take the report',
    accept() { till -= this._cost * perkCostMul; },
    decline() { regulars.adjustOpinions(-0.16); } },
  { who: 'a solicitor’s letter', base: 60, share: 0.06, contestShare: 0.14, contestBase: 140,
    line: 'Someone claims a scalded wrist. “Settle and it goes away.”',
    effect: (c, c2) => `pay £${c} nuisance settlement · or contest — it lands at 16:30, half the time it sticks for £${c2}`,
    yes: c => `settle the £${c}`, no: 'contest it',
    accept() { till -= this._cost * perkCostMul; },
    decline() { solicitorAt = 990; solicitorCharge = this._contest; } },
  { who: 'the supplier', base: 40, share: 0.04, line: '“Milk van’s here — account’s overdue, it’s cash on delivery today.”',
    effect: c => `£${c} cash now · or your next contract carries a +£18 fee`,
    yes: c => `pay the £${c}`, no: 'put it on the account',
    accept() { till -= this._cost * perkCostMul; },
    decline() { contractFeeExtra += 18; } },
  // Phase 3 — the roast can scorch: re-roast fresh for £18 (roast clock
  // resets) or serve it dark and let the room taste it all day.
  { who: 'the roast', base: 18, share: 0.02, line: '“Left the house lot on too long — it’s scorched.” Ruth won’t serve it proud.',
    effect: c => `£${c} emergency re-roast, fresh clock · or serve it dark — every roast-sensitive cup sours`,
    yes: c => `re-roast (£${c})`, no: 'serve it dark',
    accept() { till -= this._cost * perkCostMul; const e = lotState.entry(lotState.house); if (e) { e.roastedOn = day; e.scorched = false; } },
    decline() { const e = lotState.entry(lotState.house); if (e) e.scorched = true; } },
];

let solicitorCharge = 140;

function showIncident() {
  const idx = (day - 2 + ((SEED * 7) | 0)) % INCIDENTS.length;
  let o = INCIDENTS[idx];
  // Ruth can't call in sick on a day you already sent her home — and when
  // she's on fumes the call isn't a sick day, it's a warning shot.
  if (o.who === 'Ruth, your barista') {
    if (baristaHomeToday || apprenticeHiredToday || weekHire === HIRE_ROBOT) o = INCIDENTS[(idx + 1) % INCIDENTS.length];
    else if (baristaCondition < 0.4) o = { ...o,
      line: '“I can’t do another one like yesterday.” Ruth’s voice is flat — she’s on fumes.',
      effect: c => `£${c} agency cover · or she pushes on — the bar runs ~60% slower`,
      decline() { patrons.staffMul = 0.4; } };
  }
  o = { ...o };
  o._cost = incidentCost(o.base, o.share, till);
  o._contest = o.contestShare ? incidentCost(o.contestBase, o.contestShare, till) : 0;
  if (typeof o.line === 'function') o.line = o.line(o._cost);
  if (typeof o.effect === 'function') o.effect = o.effect(o._cost, o._contest);
  if (typeof o.yes === 'function') o.yes = o.yes(o._cost);
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
  // PR-3 — per-beat caption: offers carry the AgentMail reply, incidents are
  // an on-floor operating cost paid live.
  setBeatPower('offer', incident ? 'Operating cost paid · live ledger' : BEAT_POWERED.offer);
  // PR-4c — the regulars' take surfaces for non-insiders at the offer beat
  if (!incident) {
    const upEl = $('offer-insider-upsell');
    const txEl = $('offer-insider-text');
    if (upEl && txEl) {
      fetchOfferTake().then((lines) => {
        txEl.textContent = lines[0] || '"worth hearing both sides before you say no."';
        try { applyPaywallPlacements(); } catch {}
      }).catch(() => {});
    }
  }
  whenHandsFree(() => {
    if (activeBeat !== o) return;
    offerWasPaused = paused; paused = true;
    if ($('pause')) $('pause').textContent = 'answer y / n';
    if (!headless) fx.toast('a question is open — answer Y or N. Space won’t skip it.', '');
    try { audio.card(); } catch {}
    modals.open('offer');
  });
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
  if (!wasIncident) offerResolved = true;
}
$('offer-yes').onclick = () => resolveOffer(true);
$('offer-no').onclick = () => resolveOffer(false);
if ($('evening-topup')) $('evening-topup').onclick = () => resolveEvening('topup');
if ($('evening-hold')) $('evening-hold').onclick = () => resolveEvening('hold');
if ($('evening-close')) $('evening-close').onclick = () => resolveEvening('close');
if ($('skiprush')) $('skiprush').onclick = () => skipToRush();
$('tape').onclick = () => { if (marketIntel) desk.open(marketIntel); };

function reset(coreOnly = false) {
  // full campaign restart: the market and the regulars rewind to their start state.
  // Only an explicit `true` skips the new day — a click event used to land
  // here and bail out after abandoning the run, leaving the floor dead.
  const wasFinale = campaignDone;   // restarting from the verdict gets a send-off
  try { clearWeek(localStorage); } catch {}
  runGen++;
  guidedOpening = wantTutorial; firstPrepChosen = false;
  softWeekDone = false; coachedOpening = false;
  exchange.rng = seeded(seedNow());
  exchange.beanIndex = 1.0; exchange.day = 0; exchange.contract = null; exchange.debt = 0; exchange.event = null; exchange.history = []; exchange.matchaPrice = undefined;
  exchange.lastTier = null; exchange.lastEventId = null;
  tapePrev = 1.0; offerShown = false; offerResolved = false; offerWaveMul = 1; officeRunAt = 0; oluPayoutAt = 0; estherCard = false;
  rushFast = false;
  party = null; batchWaste = 0; batchSpend = 0; pastryWaste = 0; pastryWasteCost = 0; pastrySpend = 0; pastryOnOrder = 0; pastryMissDrinks = 0; pastryMissWalks = 0; pastryMissNoted = false; lastRetail = 0; ctx.pastryStock = null;
  incidentShown = false; activeBeat = null; cashOnly = 0; cashOnlyToast = false; contractFeeExtra = 0; solicitorAt = 0; solicitorCharge = 140; cOps = 0;
  wifiOutage = null;
  rivalReacted = { cut: 0, prep: 0 }; rivalReactLog = [];   // PR-B2 — reset reactive counters/log each day
  briefChoice = null; lastDayStats = null; planDraft = null; lastDayReceipt = null;
  greetedToday.clear();
  realizedHedgeSavings = 0; hedgedCups = 0;
  // Phase 4 — Ruth's arc rewinds with the campaign.
  ruthNoticed = false; ruthAsked = false; ruthRestDay = 0; ruthReturned = false;
  ruthRestOffer = 0; pastryCut = 0;
  // Phase 4 — Idris's ledger rewinds too.
  contractsTaken = 0; settledCount = 0; ignoredAdvice = 0; idrisHeldSack = false;
  lastHedge = 'hold';
  // Phase 4 — Sam's season rewinds: grudges, truce, offer flag.
  samGrudge = { cuts: 0, preps: 0, snubs: 0 }; samTruce = false; truceShown = false;
  // Phase 2 — the cellar rewinds with the campaign (fresh starter sacks).
  lotState.reset(); selectedLot = 'huila'; topUpCups = 0; beanSpend = 0; emergencySpend = 0; sackSpend = 0;
  loan.reset(); stagedLoan = 0; stagedCases = 0; caseUnits = 0; caseRevenueToday = 0; franchiseRentToday = 0;
  franchiseFxToday = { awareness: 0, returnees: 0, rentBonus: 0 };
  franchiseCarry = { awareness: 0, returnees: 0, rentBonus: 0 };
  loanLotCover = 0; loanSponsorCover = 0; loanCashCap = null; closeTillOverride = null;
  loanClaim = null; menuHeld = null; salesTillForOps = null;
  pouredOther = 0; lastPour = 0; emergencyToast = false; emergencyCups = 0; staleNoted = new Set();
  pouredByLotToday = {}; servedByDrinkToday = {}; toolsIntroducedToday = [];
  // Phase 3 — menu, milk, skill rewind too.
  menuPrices = basePrices(); ctx.menuPrices = menuPrices;
  menuOffered = Object.fromEntries(DRINK_IDS.map(id => [id, true]));
  patrons.menuOffered = menuOffered;
  patrons.menuPrices = menuPrices;
  patrons.priceMult = 1;
  stagedMenu = null; stagedRoast = 3;
  toolsToday = null;
  milkDelivery = 0; lastMilky = 0; milkTipped = 0; milkToastDone = false; milkBalked = 0;
  shockCounter = null; stagedCounterable = null; shockDemandMul = 1; shockPulledFlat = false; ctx.priceMult = 1;
  demandStreetWord = '';
  compostToday = 0; trainingTotal = 0; ruthSkill = 0;
  phase = 'onboarding';
  coach = null; coachHold = false; coachHide(); tutorialActive = false;
  demand.reset(); marketingSpend = 0;
  baristaCondition = 1.0; baristaHomeToday = false; baristaRested = false; baristaStaged = false; baristaCrisis = false;
  apprenticeHiredToday = false; rivalStrategy = 'DEFAULT'; rivalReacted = { cut: 0, prep: 0 }; rivalReactLog = [];
  weekHire = 'ruth'; hireLocked = false; maintenanceBill = 0; tipsForgoneToday = 0;
  syncBarStaff('work');
  try { modals.closeAll(); } catch {}
  deskHeldPause = false;
  mailPending = false;
  try { mailT.disarm(); } catch {}
  briefSyncError('');
  { const ob = $('brief-open'), mb = $('letter-mail-btn'); if (ob) ob.disabled = false; if (mb) mb.disabled = false; }
  if (sync.abandonRun) { sync.abandonRun(); if (sync.live && !sync.runDisabled) sync.beginRun(SEED).catch(() => {}); }
  const newOpWarm = (PERK_VALUES[perkBg] || {}).opWarm;
  for (const r of regulars.regulars) { r.op = newOpWarm != null ? Math.max(r.op, newOpWarm) : 0.15; r.visits = 5; r.stage = 'regular'; r.drink = CANON_DRINKS[r.name] || 'filter'; r.events = []; r.seen = false; r._spawned = false; r.served = 0; r.balked = 0; r.absence = 'present'; r.absentReason = null; r.justLost = false; r._defectShown = false; r._lastWalkoutDay = undefined; r._lastOutcomeDay = undefined; }
  // The quieter room survives the new week. Dawn does not clear it either.
  if (quietCarry > 0) regulars.adjustOpinions(quietOpinionDrag(quietCarry));
  walkins.reset();
  street.reset();
  street.setDemandRead(null);
  try { world.setDemandHeat(0); world.setTickerEnergy(0); } catch {}
  cRev = cCost = cBalked = cServed = cDef = cRivalServed = cRivalChoices = settledPaid = 0;
  campaignDone = false; paused = false;
  campaignDays = []; weekOpStart = null; staleByLotToday = {};   // Phase 6 — autopsy rewinds
  firstServed = firstWalked = firstServedToast = firstWalkedToast = 0;
  companionsYesterday = [];
  if ($('pause')) $('pause').textContent = 'pause';
  if (coreOnly === true) return wasFinale;
  prepareDay(1);
  if (wasFinale) {
    rig.crane();   // swoop home from the sold street into the new week
    fx.toast('a new week on the floor — same street, new regulars', '');
  }
}

function beginWeek() {
  if (!softDay) return false;
  const kept = regulars.regulars.map(r => ({
    name: r.name, op: r.op, visits: r.visits, stage: r.stage, drink: r.drink,
    events: r.events.map(e => ({ ...e, day: 0 })),
  }));
  const keptHeads = walkins.heads.map(h => ({
    ...h, pid: h.pid.replace(/^d\d+-/, 'd0-'),
    events: (h.events || []).map(e => ({ ...e, day: 0 })), _lastOutcomeDay: undefined,
  }));
  reset(true);
  for (const r of regulars.regulars) {
    const k = kept.find(x => x.name === r.name);
    if (!k) continue;
    r.op = k.op; r.visits = k.visits; r.stage = k.stage; r.drink = k.drink; r.events = k.events;
    delete r._lastOutcomeDay; delete r._lastWalkoutDay;
  }
  walkins.heads = keptHeads;
  walkins.byPid = new Map(keptHeads.map(h => [h.pid, h]));
  walkins.drawn = new Set();
  walkins.day = 0;
  softDay = false; softWeekDone = true; coachedOpening = true; guidedOpening = false;
  prepareDay(1);
  if (!headless) showMorningBrief();
  return true;
}

// PR-4b — Founder's replay. Replays the entire 5-day campaign with a fresh
// seed: a brand-new market, a brand-new district kit, brand-new gossip
// chains. Founders get this instead of the closure. Non-founders never see
// the button (gated in campaignClose()).
const founderReplay = () => {
  if (!billing || !billing.isFounder()) return false;
  // pick a fresh seed: current SECONDS-since-midnight, kept deterministic
  // per replay (the share card will print it).
  const fresh = Math.floor((Date.now() / 1000) % 99991) + 7;
  try {
    // mirror reset() but swap the seed first
    SEED_OVERRIDE = fresh;
    const url = new URL(location.href);
    url.searchParams.set('seed', String(fresh));
    try { history.replaceState(null, '', url.toString()); } catch {}
  } catch {}
  reset();
  fx.toast('founder\'s replay — new seed, new market, new week', 'good');
  return true;
};
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
  const name = p.regularName || p.pname || p.cohort;
  const quirk = p.regularName ? (regulars.regulars[p.regularIdx]?.quirk || '') : '';
  const op = p.regularIdx >= 0 ? regulars.regulars[p.regularIdx]?.op : (p.pid ? walkins.get(p.pid)?._op : null);
  const ident = p.regularIdx >= 0 ? regulars.regulars[p.regularIdx]
    : p.pid ? walkins.get(p.pid) : null;
  const view = ident ? profileView(
    p.regularIdx >= 0 ? { name: ident.name, stage: ident.stage, visits: ident.visits, drink: ident.drink, events: ident.events } : ident,
    { op, friends: p.regularIdx >= 0 ? (ident.friends || []) : (p.regularFriends ? [...p.regularFriends] : []), isCast: p.regularIdx >= 0 },
  ) : null;
  const feel = view ? view.feeling : (op != null ? feeling(op) : null);
  const friends = view && view.friends ? view.friends.replace(/^friends here: /, '') : '';
  // Mouse: "click to meet them". Touch: "tap to meet them".
  const verb = touchPrimary() ? 'tap' : 'click';
  el.innerHTML = `<b>${name}</b>${view ? ` · ${view.stage}` : ''}${quirk ? ` — ${quirk}` : ''}${feel ? `<br>${feel}` : ''}${friends ? `<br><span style="opacity:.7">friends: ${friends}</span>` : ''}<br><span style="opacity:.6">${view ? `${verb} to meet them` : `${verb} to wave`}</span>`;
  el.style.left = Math.min(innerWidth - 230, x + 14) + 'px';
  el.style.top = Math.min(innerHeight - 80, y + 14) + 'px';
  el.classList.add('show');
}
function hideHover() { const el = $('hovercard'); if (el) el.classList.remove('show'); }
function showPremiseHover(p, x, y) {
  const el = $('hovercard'); if (!el || !p) return;
  const verb = touchPrimary() ? 'tap' : 'click';
  const open = p.open > 0.5;
  el.innerHTML = `<b>${p.name}</b><br>${p.line}<br><span style="opacity:.6">${open ? 'roof open' : `${verb} to look inside`}</span>`;
  el.style.left = Math.min(innerWidth - 240, x + 14) + 'px';
  el.style.top = Math.min(innerHeight - 96, y + 14) + 'px';
  el.classList.add('show');
}
renderer.domElement.addEventListener('pointermove', e => {
  if (_hoverRaf) return;
  _hoverRaf = requestAnimationFrame(() => {
    _hoverRaf = 0;
    const p = nearestPatronAt(e.clientX, e.clientY);
    if (p) { showHover(p, e.clientX, e.clientY); return; }
    const shop = world.pickPremise?.(e.clientX, e.clientY, camera, innerWidth, innerHeight);
    if (shop) showPremiseHover(shop, e.clientX, e.clientY); else hideHover();
  });
});
renderer.domElement.addEventListener('pointerleave', hideHover);
let controlsHintShown = false;
renderer.domElement.addEventListener('click', e => {
  if (rig.suppressClick) { rig.suppressClick = false; return; }
  const p = nearestPatronAt(e.clientX, e.clientY);
  if (!p) {
    const shop = world.pickPremise?.(e.clientX, e.clientY, camera, innerWidth, innerHeight);
    if (shop) {
      world.peekPremise(shop.id);
      fx.toast(`${shop.name} — ${shop.line}`, '');
      return;
    }
    if (!controlsHintShown) {
      controlsHintShown = true;
      fx.toast('drag to look around · scroll or pinch to zoom', '');
    } else fx.toast('the pavement — drag to look around', '');
    return;
  }
  if (p.regularIdx >= 0 || p.pid) { openDossier(p); return; }
  fx.bubble(p, 'hey — welcome', 'good');
  try { if (navigator.vibrate) navigator.vibrate(20); } catch {}
});

const greetedToday = new Set();
function greetKey(isCast, ident) { return isCast ? `cast:${ident.name}` : `pid:${ident.pid}`; }
function greet(ident, isCast, patron) {
  const k = greetKey(isCast, ident);
  if (greetedToday.has(k)) return;
  greetedToday.add(k);
  if (isCast) {
    const r = regulars.regulars.find(x => x.name === ident.name);
    if (r) r.op = Math.min(1, r.op + 0.06);
  } else {
    const head = walkins.get(ident.pid);
    if (head) head._op = Math.min(1, (head._op ?? 0) + 0.06);
  }
  if (patron) fx.bubble(patron, isCast ? `hey ${ident.name} — welcome back` : 'hey — welcome', 'good');
}

// Phase 1 — dossier: click a sitter, meet them. Portrait + stage + history,
// assembled from the roster entry (canon) or the day-pool head (walk-ins).
function openDossier(p) {
  if (p.regularIdx >= 0) {
    const r = regulars.regulars[p.regularIdx];
    if (!r) return;
    openProfile({ name: r.name, stage: r.stage, visits: r.visits, drink: r.drink, events: r.events },
      { op: r.op, friends: r.friends || [], faceSeed: r.name, cohort: r.coh, isCast: true, quirk: r.quirk, patron: p, pid: null, absence: r.absence });
  } else if (p.pid) {
    const head = walkins.get(p.pid);
    if (!head) return;
    openProfile(head, { op: head._op, friends: p.regularFriends ? [...p.regularFriends] : [], faceSeed: head.faceSeed, cohort: head.cohort, isCast: false, patron: p, pid: p.pid });
  }
}

function openProfile(ident, { op = null, friends = [], faceSeed = 'stranger', cohort = 'commuters', isCast = false, quirk = null, patron = null, pid = null, absence = null } = {}) {
  const view = profileView(ident, { op, friends, quirk, isCast, greetedToday: greetedToday.has(greetKey(isCast, ident)), absence });
  const box = $('dossier-portrait'); if (box) {
    box.textContent = '';
    try {
      const mood = op > 0.2 ? 'warm' : op < -0.2 ? 'sour' : 'flat';
      box.appendChild(portraitCanvas(faceSeed, cohort, 96, mood));
    } catch {}
  }
  const head = $('dossier-heading');
  if (head) head.textContent = view.heading;
  const nm = $('dossier-name');
  if (nm) nm.textContent = `${view.name} — ${view.stage}`;
  const set = (id, txt) => { const el = $(id); if (el) { el.textContent = txt || ''; el.style.display = txt ? '' : 'none'; } };
  set('dossier-bio', view.bio);
  set('dossier-wants', view.wants ? `Wants: ${view.wants}` : null);
  set('dossier-usual', view.usual ? `Usual: ${view.usual}` : null);
  set('dossier-feeling', view.feeling);
  set('dossier-last', view.lastBetween);
  set('dossier-friends', view.friends);
  const lines = $('dossier-lines');
  if (lines) { lines.textContent = ''; for (const l of view.history) { const d = document.createElement('div'); d.textContent = l; lines.appendChild(d); } }
  const hello = $('dossier-hello');
  if (hello) {
    if (absence === 'away' || absence === 'lost') { hello.disabled = true; hello.textContent = 'Not in today.'; }
    else if (view.greetedToday) { hello.disabled = true; hello.textContent = 'You said hello today.'; }
    else {
      hello.disabled = false; hello.textContent = 'Say hello';
      hello.onclick = () => {
        greet(ident, isCast, patron);
        hello.disabled = true; hello.textContent = 'You said hello today.';
      };
    }
  }
  modals.open('dossier');
}

// Phase 1 — the regulars board: the cast (canon roster) plus graduated
// walk-ins ("new faces"). Rendered fresh on every open.
function boardRow({ name, stage, visits, drink, op, friends, faceSeed, cohort, events, absence }, onOpen) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'b-row';
  if (onOpen) row.onclick = onOpen;
  const mood = op > 0.2 ? 'warm' : op < -0.2 ? 'sour' : 'flat';
  try { const c = portraitCanvas(faceSeed, cohort, 40, mood); c.className = 'b-face'; row.appendChild(c); } catch {}
  const t = document.createElement('div');
  const last = events && events.length ? events[events.length - 1] : null;
  const when = last && last.day === 0 ? 'soft opening' : `day ${last ? last.day : ''}`;
  const lastLine = !last ? null
    : last.outcome === 'served' ? `${when} — served ${last.drink}${last.stayed ? ', stayed a while' : ''}`
    : last.outcome === 'balked' ? `${when} — walked out (the line)`
    : last.outcome === 'defected' ? `${when} — crossed to Glasshouse`
    : null;
  t.innerHTML = `<b>${name}</b> <span class="b-stage">${stageLabel({ stage, visits })}</span><br><span style="opacity:.65">${visits} visit${visits === 1 ? '' : 's'} · ${drink} · ${ABSENCE_WORD[absence] || feeling(op)}</span>${lastLine ? `<br><span style="opacity:.5">${lastLine}</span>` : ''}${friends && friends.length ? `<br><span style="opacity:.5">friends: ${friends.slice(0, 3).join(', ')}</span>` : ''}`;
  row.appendChild(t);
  return row;
}
function renderBoard() {
  const cast = $('board-cast');
  if (cast) {
    cast.textContent = '';
    for (const r of regulars.regulars) {
      cast.appendChild(boardRow({ name: r.name, stage: r.stage, visits: r.visits, drink: r.drink, op: r.op, friends: r.friends, faceSeed: r.name, cohort: r.coh, events: r.events, absence: r.absence },
        () => openProfile({ name: r.name, stage: r.stage, visits: r.visits, drink: r.drink, events: r.events },
          { op: r.op, friends: r.friends || [], faceSeed: r.name, cohort: r.coh, isCast: true, quirk: r.quirk, absence: r.absence })));
    }
  }
  const grads = walkins.graduated();
  const nh = $('board-newhead');
  if (nh) nh.style.display = grads.length ? '' : 'none';
  const nf = $('board-new');
  if (nf) {
    nf.textContent = '';
    for (const h of grads) {
      nf.appendChild(boardRow({ name: h.name, stage: h.stage, visits: h.visits, drink: h.drink, op: h._op, friends: [], faceSeed: h.faceSeed, cohort: h.cohort, events: h.events },
        () => openProfile(h, { op: h._op, friends: [], faceSeed: h.faceSeed, cohort: h.cohort, isCast: false, pid: h.pid })));
    }
  }
  modals.open('regulars');
}
// Space pauses the floor mid-day (rendering + camera keep breathing; the
// sim clock stops). The letter/receipt phases are already still.
function togglePause() {
  if (!started || closed || campaignDone || phase !== 'trading') return paused;
  markIntent();
  coachHold = false;
  paused = !paused;
  if ($('pause')) $('pause').textContent = paused ? 'resume' : 'pause';
  fx.toast(paused ? 'paused — space to resume' : 'back on the floor', '');
  lastHudText = 0;   // force the ❚❚ marker through the text throttle
  updateHUD();
  return paused;
}
function askRestart() {
  const box = $('restart-ask');
  if (!box) { reset(false); return; }
  box.hidden = false;
  box.classList.add('show');
}
function closeRestart() {
  const box = $('restart-ask');
  if (!box) return;
  box.hidden = true;
  box.classList.remove('show');
}
bindPress($('prebatch'), () => doPrebatch());
bindPress($('reprice'), () => doReprice());
// Phase 1 — dossiers close, the board opens fresh every time.
$('dossier-close').onclick = () => modals.close('dossier');
$('board-close').onclick = () => modals.close('regulars');
$('regularsbtn').onclick = () => renderBoard();
bindPress($('pause'), () => togglePause());
bindPress($('reset'), () => askRestart());
bindPress($('again'), () => askRestart());
bindPress($('restart-yes'), () => { closeRestart(); reset(false); });
bindPress($('restart-no'), () => closeRestart());
// PR-4b — founder replay: a fresh-seed restart, gated on the founder entitlement
const fReplayBtn = $('founder-replay');
if (fReplayBtn) fReplayBtn.onclick = () => { try { founderReplay(); } catch {} };
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
  if (phase === 'planning' && !headless && !tutorialActive) { setBeatPower('brief', BEAT_POWERED.brief); modals.open('brief'); }
};
$('mute').onclick = () => { $('mute').textContent = audio.toggleMute() ? 'sound off' : 'sound on'; };
$('wirebtn').onclick = () => desk.open(marketIntel);
$('camreset').onclick = () => rig.resetView();
if ($('photoBtn')) $('photoBtn').onclick = () => { try { doPhoto(); } catch {} };
const defaultSpeedBtn = headless ? '300' : '60';
document.querySelectorAll('#speeds button').forEach(b => {
  if (b.dataset.s === defaultSpeedBtn) b.classList.add('on');
  bindPress(b, () => {
    const want = +b.dataset.s;
    // 20× skips the cup countdown — keep it out of the rush (headless exempt).
    if (!headless && want >= 1200 && dayMin >= 840 && dayMin < 1020 && phase === 'trading') {
      fx.toast('20× waits until 17:00 — the rush stays at 5× so the cups stay readable', 'warn');
      return;
    }
    chosenSpeed = want;
    speed = want;
    document.querySelectorAll('#speeds button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    if (!headless) fx.toast(want >= 1200 ? '20× — quiet stretches still run faster' : want >= 300 ? '5×' : '1×', '');
  });
});
addEventListener('keydown', e => {
  if ($('restart-ask') && $('restart-ask').classList.contains('show')) {
    if (e.key === 'Escape') { e.preventDefault(); closeRestart(); return; }
    if (e.key === 'Enter') { e.preventDefault(); closeRestart(); reset(false); return; }
  }
  if (modals.top() === 'evening') {
    const pick = { '1': 'topup', '2': 'hold', '3': 'close' }[e.key];
    if (pick) { e.preventDefault(); resolveEvening(pick); return; }
  }
  if (e.key === 'Enter' && modals.top() === 'licence') {
    const t = e.target;
    if (t && t.tagName === 'INPUT') { e.preventDefault(); const p = licPrimary(); if (p && !p.disabled) p.click(); return; }
  }
  if (e.key === ' ' && started && !closed && !campaignDone && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) {
    const top = modals.top();
    if (top === 'offer' || top === 'evening' || top === 'brief' || top === 'softintro' || top === 'licence') {
      e.preventDefault();
      const say = top === 'offer' ? 'a question is open — answer Y or N'
        : top === 'evening' ? 'the evening call is open — pick 1, 2, or 3'
        : top === 'brief' ? 'the morning brief is open — commit it, or close it'
        : 'finish this card first';
      fx.toast(say, 'warn');
      if ($('pause')) $('pause').textContent = top === 'offer' ? 'answer y / n' : 'paused';
      return;
    }
  }
  if (modals.handleKey(e)) return;
  // typing belongs to the field — never let an email fire game keys
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  markIntent();   // any game key is intent: the idle halo retires
  if (e.key === '1') doPrebatch();
  else if (e.key === '2') doReprice();
  else if (e.key === ' ' && started && !closed) { e.preventDefault(); togglePause(); }
  else if ((e.key === 'r' || e.key === 'R') && !$('restart-ask')?.classList.contains('show')) askRestart();
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
      snapshot: snap, badge, seed: seedNow(), day: day + 1,
      stats: { till, rep: regulars.reputation, served: served + servedRetail, balked },
      founder: !!(billing && billing.isFounder && billing.isFounder()),
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
  layoutMobile();
});

const sysBar = $('sys');
if (sysBar) {
  const moreBtn = document.createElement('button');
  moreBtn.id = 'sys-more';
  moreBtn.textContent = 'more';
  moreBtn.title = 'more controls';
  moreBtn.onclick = () => { sysBar.classList.toggle('more-open'); layoutMobile(); };
  sysBar.appendChild(moreBtn);
}
const roofBtn = $('roofpeek');
const ROOF_KEY = 'grunds.roofs';
function readRoofPref() {
  const q = urlParams.get('roofs');
  if (q === '1' || q === 'open') return 'open';
  if (q === '0' || q === 'shut' || q === 'off') return 'shut';
  try { return localStorage.getItem(ROOF_KEY); } catch { return null; }
}
function applyRoofPref(pref) {
  const open = pref === 'open';
  try { world.setNeighborRoofs(open, pref === 'shut'); } catch {}
  // Headless day stubs return a button-shaped object with no DOM methods.
  if (!roofBtn || typeof roofBtn.setAttribute !== 'function') return;
  roofBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
  roofBtn.textContent = open ? 'roofs open' : 'see inside';
  roofBtn.title = open
    ? 'Neighbour roofs are open. Press again to close them.'
    : 'Open the neighbour roofs and look inside. Click a shop to peek at just that one.';
}
applyRoofPref(readRoofPref());
if (roofBtn && typeof roofBtn.setAttribute === 'function') roofBtn.onclick = () => {
  const open = roofBtn.getAttribute('aria-pressed') === 'true';
  const next = open ? 'shut' : 'open';
  try { localStorage.setItem(ROOF_KEY, next); } catch {}
  applyRoofPref(next);
  fx.toast(next === 'open'
    ? 'roofs open — The Quill, Hearth & Rye, Bell & Brass, Marrow Lane'
    : 'roofs closed', '');
};
function layoutMobile() {
  if (innerWidth > 640 || !document.documentElement) return;
  const root = document.documentElement.style;
  const levH = $('levers')?.offsetHeight || 0;
  const sysH = sysBar ? sysBar.offsetHeight : 0;
  const stackH = Math.round(levH + sysH + 24);
  root.setProperty('--lever-h', `${levH}px`);
  root.setProperty('--sys-h', `${sysH}px`);
  root.setProperty('--stack-h', `${stackH}px`);
  const hudB = $('hud') ? $('hud').getBoundingClientRect().bottom : 130;
  root.setProperty('--hud-b', `${Math.round(hudB)}px`);
  const cap = Math.max(90, Math.floor(innerHeight - hudB - stackH - 24));
  root.setProperty('--coach-cap', `${cap}px`);
}
layoutMobile();

// ---- boot -------------------------------------------------------------------------
// Slow GPUs stall the main thread; a 12s cap aborted the schedule before the
// street could finish drawing. 30s, then one more try, then a real failure.
const SCHEDULE_LOAD_MS = 30000;
function loadSchedule(attempt = 0) {
  const signal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(SCHEDULE_LOAD_MS) : undefined;
  fetch('./api/schedule.json', { signal }).then(r => {
    if (r && r.ok === false) throw new Error('schedule');
    return r.json();
  }).then(s => {
    schedule = s;
    // Wait for the Kenney GLBs to be placed before enabling Open. If a GLB
    // fails, the loader's graceful fallback returns a placeholder so the user
    // still sees a floor — they just don't see it half-loaded.
    Promise.resolve(world.ready).then(() => {
      $('open').disabled = false;
      $('open').textContent = COPY.open;
      paintResume();
    });
  }).catch(() => {
    if (attempt < 1) { loadSchedule(attempt + 1); return; }
    try { globalThis.grundsBootFail && globalThis.grundsBootFail('Couldn’t load today’s street. Reload to try again.'); }
    catch { $('open').textContent = 'Couldn’t load today’s street. Reload to try again.'; }
  });
}
loadSchedule();
addEventListener('beforeunload', e => {
  if (headless || !started || campaignDone) return;
  if (phase === 'planning' || phase === 'trading' || phase === 'review' || phase === 'committing') {
    e.preventDefault();
    e.returnValue = '';
  }
});
// ---- the pitch licence: sign yourself into the week ---------------------------
const LIC_ROLES = ['the new owner', 'the manager', 'the name on the lease'];
const LIC_BGS = [
  { id: 'ex-barista',    label: 'an ex-barista',    perk: 'the wrist remembers — the bar runs ~8% faster' },
  { id: 'ex-accountant', label: 'an ex-accountant', perk: 'you read invoices — fees & payouts −10%' },
  { id: 'newcomer',      label: 'new to the trade', perk: 'a fresh face — the regulars warm quicker' },
  { id: 'circuit',       label: 'a market regular', perk: 'you know the circuit — the wire names its lean' },
];
let licRole = 0, licBg = 0;
function licPrimary() { return $('lic-sign'); }
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
  if (nameEl) nameEl.value = playerName || 'Sam';
  if (standEl) standEl.value = standName || 'THE CORNER CUP';
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
  const wrap = $('lic-step');
  if (wrap) { wrap.classList.remove('si-in'); void wrap.offsetWidth; wrap.classList.add('si-in'); }
  modals.open('licence');
  setTimeout(() => { try { (nameEl.value ? standEl : nameEl).focus(); } catch {} }, 350);
  try { analytics.track('licence_shown'); } catch {}
}
// PR-1 — Perk balance. The strongest perks (ex-accountant 15% off + every
// incident payout; newcomer rep head start compounding 5 days) tilted the
// diagnostic. Slight nerfs to keep the perk identity without making the
// background choice the dominant lever.
const PERK_VALUES = {
  'ex-barista':    { staffMul: 1.08, costMul: 1.00, opWarm: null },     // the wrist paces the bar
  'ex-accountant': { staffMul: 1.00, costMul: 0.90, opWarm: null },     // reads invoices (was 0.85 — too dominant when stacked with incidents)
  'newcomer':      { staffMul: 1.00, costMul: 1.00, opWarm: 0.18 },     // the fresh face (was 0.25 — kept warming on day 5)
  'circuit':       { staffMul: 1.00, costMul: 1.00, opWarm: null },     // the market regular — qualitative wire lean
};
function applyPerk() {
  const p = PERK_VALUES[perkBg] || PERK_VALUES['ex-barista'];
  perkStaffMul = p.staffMul;
  perkCostMul = p.costMul;
  if (p.opWarm != null) for (const r of regulars.regulars) r.op = Math.max(r.op, p.opWarm);
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
  try { applyPaywallPlacements(); } catch {}
  modals.close('licence');
  try { analytics.track('licence_signed', { role: playerRole, bg: perkBg, defaults: playerName === 'Sam' && standName === 'THE CORNER CUP' }); } catch {}
  fx.toast('licence signed — ' + standName + ' opens Monday', 'good');
  if (wantTutorial) openTutorial();
  else { started = true; audio.start(); openDay(1); rig.crane(); }
}
// Two ways onto the street: visit a Row another owner already filled
// (seed 99), or roll a fresh district where the leases are still yours
// to take. Both keep the link's other params; neither touches the seed
// the player arrived on until they choose.
function openAway(url) {
  try {
    const w = window.open(url, '_blank', 'noopener');
    if (w) return;
  } catch { /* popup blocked — stay on the week */ }
  fx.toast('the street link is ready in a new tab — allow popups if it didn’t open', '');
}
if ($('lic-see-street')) $('lic-see-street').onclick = () => {
  const u = new URL(location.href);
  u.searchParams.set('seed', '99');
  openAway(u.toString());
};
if ($('lic-new-street')) $('lic-new-street').onclick = () => { openAway(newStreetUrl()); };
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
  tutorialActive = false;
  started = true;
  paused = true;
  if ($('pause')) $('pause').textContent = 'resume';
  audio.start();
  openDay(1);
  rig.crane();
  fx.card(softDay ? 'SOFT OPENING' : 'DAY 1', 'Ruth has the bar — watch the room settle');
  coachBegin();
}
function coachShow(html, actions) {
  const card = $('coach'); if (!card) return;
  const body = $('coach-body'); if (body) body.innerHTML = html;
  const row = $('coach-actions');
  if (row) {
    clearEl(row);
    for (const [label, fn] of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      bindPress(b, fn);
      row.appendChild(b);
    }
    const sk = document.createElement('button');
    sk.type = 'button';
    sk.className = 'dim';
    sk.textContent = 'skip guidance';
    bindPress(sk, coachSkip);
    row.appendChild(sk);
  }
  card.hidden = false;
  document.body?.classList.add('coach-live');
  layoutMobile();
}
function coachHide() { const c = $('coach'); if (c) c.hidden = true; document.body?.classList.remove('coach-live'); layoutMobile(); }
function coachPause() {
  coachHold = true; paused = true;
  if ($('pause')) $('pause').textContent = 'paused — space';
  if (!headless) fx.toast('paused for the rush — space resumes', '');
  lastHudText = 0; updateHUD();
}
function coachResume() {
  if (coachHold && !modals.top()) { coachHold = false; paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
  else coachHold = false;
  coachHide();
}
function coachSkip() {
  if (coach) coach.skipped = true;
  coachResume();
  try { analytics.track('coach_skip', { day, dayMin }); } catch {}
}
function coachBegin(force = false) {
  if ((headless || !wantTutorial) && !force) return;
  if (day !== 1 || coachedOpening) return;
  coach = { skipped: false, wave: false, observed: false, lowStock: false, intro: false, craftObserved: false };
  try { analytics.track('coach_start', { day }); } catch {}
}
function coachIntro() {
  coach.intro = true;
  coachShow(
    softDay
      ? `<b>Ruth has the bar.</b> Watch the first orders and notice who comes in.`
      : `<b>Ruth has the bar.</b> Watch the first orders, look around the café, and notice who comes back. Your afternoon plan is already set.`,
    [
      ['Watch Ruth work', () => { try { rig.focus(world.focus.counter, 18, 4); } catch {} coachHide(); }],
      ['Meet the regulars', () => { try { renderBoard(); } catch {} }],
      ['got it', coachHide],
    ]
  );
}
function showCoachWave() {
  coachPause();
  try { analytics.track('coach_wave', { day, dayMin, lever: prebatched ? 'batch' : repriced ? 'deal' : 'hold' }); } catch {}
  if (prebatched) {
    coachShow(`<b>14:00 — they’re here.</b> Your ${ctx.batchUnits} reserved cups are live — a batch cup uses less bar time than a made-to-order pour.`, [['watch my plan', coachResume]]);
  } else if (repriced) {
    coachShow(`<b>14:00 — they’re here.</b> The ${fmt(ECON.matchaDeal)} deal lowers queue-abandonment odds — it doesn’t speed the bar, and it can’t stop every walk.`, [['watch my plan', coachResume]]);
  } else {
    coachShow(`<b>14:00 — they’re here.</b> Made-to-order is four minutes a cup — you can still buy in at the late-switch price.`, [
      [`buy ${ECON.batchUnits} cups · ${fmt(ECON.batchCost + LEVER_OVERRIDE_PRICE)}`, () => { const u = ctx.batchUnits; doPrebatch(); if (ctx.batchUnits > u) coachResume(); }],
      [`cut to ${fmt(ECON.matchaDeal)} · ${fmt(LEVER_OVERRIDE_PRICE)} + the room hears it`, () => { doReprice(); if (repriced) coachResume(); }],
      ['ride it out', coachResume],
    ]);
  }
}
function coachTick() {
  if (!coach) return;
  if (day !== 1 || closed || dayMin >= 960) {
    const held = coachHold;
    coach = null; coachHold = false; coachHide();
    if (held && !modals.top() && phase === 'trading' && !closed) { paused = false; if ($('pause')) $('pause').textContent = 'pause'; }
    return;
  }
  if (coach.skipped || phase !== 'trading' || modals.top()) return;
  if (!coach.intro) { coachIntro(); return; }
  if (!coach.craftObserved && dayMin < 660 && served >= 5) {
    coach.craftObserved = true;
    const head = (walkins.heads || []).find(h => (h.events || []).some(e => e.day === day && e.outcome === 'served'));
    const ev = head ? (head.events || []).find(e => e.day === day && e.outcome === 'served') : null;
    const named = head ? ` ${head.name} stopped in for a ${(ev && ev.drink) || head.drink || 'coffee'}.` : '';
    coachShow(
      `<b>Ruth has served ${served} drinks automatically.</b>${named} Watch the counter, then the tables — the room tells you how the morning is going.`,
      [
        ['watch the counter', () => { try { rig.focus(world.focus.counter, 18, 4); } catch {} coachHide(); }],
        ['got it', coachHide],
      ]
    );
    return;
  }
  if (!coach.wave && dayMin >= 840) {
    coach.wave = true;
    whenHandsFree(() => {
      if (!coach || coach.skipped) return;
      showCoachWave();
    });
    return;
  }
  if (coach.wave && !coach.lowStock && prebatched && dayMin >= 840 && dayMin < 960 && ctx.batchUnits <= 8) {
    coach.lowStock = true;
    coachPause();
    try { analytics.track('coach_lowstock', { day, dayMin, batchUnits: ctx.batchUnits }); } catch {}
    coachShow(`<b>cups are low.</b> Top up now or the rest of the wave goes made-to-order.`, [
      [`top up ${ECON.batchUnits} cups · ${fmt(ECON.batchCost)}`, () => { const u = ctx.batchUnits; doPrebatch(); if (ctx.batchUnits > u) coachResume(); }],
      ['ride it out', coachResume],
    ]);
    return;
  }
  if (coach.wave && !coach.observed && dayMin >= 840 && waveServed >= 5) {
    coach.observed = true;
    const seen = prebatched
      ? `${waveBatchServed} batch cups poured${waveBalked ? ` · ${waveBalked} walked` : ' · none walked yet'} — a batch cup uses less bar time`
      : repriced
        ? `${waveServed} served · ${waveBalked} walked — the deal lowers queue-abandonment odds, it doesn’t prevent every walk`
        : `${waveServed} served · ${waveBalked} walked — made-to-order is four minutes a cup`;
    coachShow(`<b>the wave read</b> — what the 14:00 rush did. ${seen}. The evening card at 17:00 sums it up.`, [['got it', coachHide]]);
    return;
  }
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
  fx.card(softDay ? 'SOFT OPENING' : 'DAY 1', 'Ruth has the bar — watch the room settle');
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

bindPress($('open'), () => {
  if (!schedule) return;
  try { clearWeek(localStorage); } catch {}
  modals.close('title');
  $('title').classList.add('gone');
  setTimeout(() => { try { if ($('title')) $('title').remove(); } catch {} }, 1400);
  // the licence is the first beat: who you are, signed before the tutorial.
  // headless / ?skipTutorial / ?skipLicence → defaults, straight in.
  if (!skipLicence) { showLicence(); return; }
  if (wantTutorial) openTutorial();
  else { started = true; audio.start(); openDay(1); rig.crane(); }
});
bindPress($('resume'), () => resumeWeek());

const MOMENT_TTL = 45;
const MOMENT_PRIO = { plan: -1, returning: 0, sam: 1, line: 2, counter: 3 };
const momentsOn = () => !headless || momentsTest;
function momentEnqueue(type, key, data = {}) {
  if (!momentsOn() || momentDone.has(key)) return;
  momentDone.add(key);
  momentPending.push({ type, key, at: dayMin, ...data });
}
function momentBtn(label, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  bindPress(b, fn);
  return b;
}
function momentAct(m) {
  try { analytics.track('moment_action', { type: m.type, day, dayMin }); } catch {}
  momentHide();
}
function momentHide() {
  const el = $('moment'); if (el) el.hidden = true;
  momentActive = null;
}
function momentShow(m) {
  const el = $('moment'), body = $('moment-body'), row = $('moment-actions');
  if (!el || !body || !row) return false;
  clearEl(body); clearEl(row);
  const b = document.createElement('b');
  if (m.type === 'returning') {
    b.textContent = `${m.name} is back.`;
    body.append(b, ` Giving you another chance after ${m.why}.`);
    if (!greetedToday.has(`cast:${m.name}`))
      row.appendChild(momentBtn('Say hello', () => { greet({ name: m.name }, true, m.patron); momentAct(m); }));
    row.appendChild(momentBtn('Leave it', () => momentAct(m)));
  } else if (m.type === 'counter') {
    b.textContent = `${m.name} is at the counter.`;
    body.append(b, ` ${CAST_PROFILES[m.name] ? CAST_PROFILES[m.name].wants : ''}`);
    if (!greetedToday.has(`cast:${m.name}`))
      row.appendChild(momentBtn('Say hello', () => { greet({ name: m.name }, true, m.patron); momentAct(m); }));
    row.appendChild(momentBtn(`Meet ${m.name}`, () => {
      const r = regulars.regulars[m.idx];
      if (r) openProfile({ name: r.name, stage: r.stage, visits: r.visits, drink: r.drink, events: r.events },
        { op: r.op, friends: r.friends || [], faceSeed: r.name, cohort: r.coh, isCast: true, quirk: r.quirk, patron: m.patron, absence: r.absence });
      momentAct(m);
    }));
    row.appendChild(momentBtn('Leave it', () => momentAct(m)));
  } else if (m.type === 'line') {
    b.textContent = 'The line is getting long.';
    body.append(b, ` ${m.queue} waiting — people may leave once it passes five.`);
    const lv = leverState(leverSnapshot()).reprice;
    if (lv.available)
      row.appendChild(momentBtn(`Cut matcha to ${fmt(ECON.matchaDeal)}${lv.cost > 0 ? ` · ${fmt(lv.cost)} + regulars lose warmth` : ''}`, () => { doReprice(); momentAct(m); }));
    row.appendChild(momentBtn('Ride it out', () => momentAct(m)));
  } else if (m.type === 'plan') {
    b.textContent = '24 students at 14:00.';
    body.append(b, ' How will you get ready?');
    const lv = leverState(leverSnapshot());
    if (lv.batch.available)
      row.appendChild(momentBtn(`Starter batch · ${fmt(lv.batch.cost)} · 40 cups ready, served faster`, () => { doPrebatch(); momentAct(m); }));
    if (lv.reprice.available)
      row.appendChild(momentBtn(`Matcha deal · ${fmt(ECON.matchaDeal)} a cup · they’ll wait longer${lv.reprice.cost > 0 ? ` · ${fmt(lv.reprice.cost)} extra` : ''}`, () => { doReprice(); momentAct(m); }));
    row.appendChild(momentBtn('Wait and see · every cup made to order', () => momentAct(m)));
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'what’s the difference?';
    const db = document.createElement('div');
    db.textContent = firstMorningCopy().diff;
    det.append(sum, db);
    row.appendChild(det);
  } else if (m.type === 'sam') {
    b.textContent = `${m.name} crossed to Glasshouse.`;
    body.append(b, ' Sam’s line was shorter.');
    row.appendChild(momentBtn('Got it', () => momentAct(m)));
  } else return false;
  momentActive = { ...m, shownAt: dayMin };
  el.hidden = false;
  try { analytics.track('moment_shown', { type: m.type, day, dayMin }); } catch {}
  return true;
}
function momentPump() {
  if (!momentsOn()) return;
  if (momentActive && (momentActive.expiresAt != null ? dayMin >= momentActive.expiresAt : dayMin - momentActive.shownAt >= MOMENT_TTL)) momentHide();
  if (momentActive) return;
  momentPending = momentPending.filter(m => m.expiresAt != null ? dayMin < m.expiresAt : dayMin - m.at < MOMENT_TTL);
  if (!momentPending.length) return;
  const coachCard = $('coach');
  if (coachCard && !coachCard.hidden) return;
  momentPending.sort((a, b) => MOMENT_PRIO[a.type] - MOMENT_PRIO[b.type]);
  momentShow(momentPending.shift());
}
function momentScan() {
  if (!momentsOn() || phase !== 'trading') return;
  for (const p of patrons.counterQ) {
    if (p.regularIdx == null || p.regularIdx < 0 || momentSeen.has(p)) continue;
    momentSeen.add(p);
    const r = regulars.regulars[p.regularIdx];
    if (!r) continue;
    if (r.absence === 'returning') {
      const last = (r.events || []).length ? r.events[r.events.length - 1] : null;
      const why = last && last.outcome === 'balked' ? 'walking out yesterday'
        : last && last.outcome === 'defected' ? 'trying Glasshouse' : 'a rough patch';
      momentEnqueue('returning', `ret:${r.name}`, { name: r.name, why, patron: p, idx: p.regularIdx });
    } else if (r.absence !== 'away' && r.absence !== 'lost' && dayMin < 630 && !greetedToday.has(`cast:${r.name}`)) {
      momentEnqueue(softDay ? 'counter:' + r.name : 'counter', 'counter', { name: r.name, idx: p.regularIdx, patron: p });
    }
  }
  if (dayMin < 840 && patrons.queueLength >= 6) momentEnqueue('line', 'line', { queue: patrons.queueLength });
}

// ---- loop ---------------------------------------------------------------------------
let acc = 0, last = performance.now();
let frameNow = 0;
let roofAmbientNoted = false;
let _slowFrames = 0, _liteSwitched = false;
// Serves and balks squash the cup or torso only — they never hold the
// clock or punch FOV. Chalkboard presses and the wave verdict opt in
// with always: one beat, not every service minute.
// Reduced motion is inside impact.
function feel(opts = {}) {
  const clock = !!opts.always;
  const chalk = opts.object === world._chalkPlane;
  impact.strike((headless ? frameNow : performance.now()) / 1000, {
    object: opts.object || null,
    patron: opts.patron || null,
    part: opts.part || null,
    sample: chalk ? t => { const s = chalkPopScale(t / 0.32); return { x: s, y: s, z: s }; } : null,
    duration: chalk ? 0.32 : undefined,
    stop: clock,
    fov: clock,
  });
}
function loop(now) {
  // re-arm first so a nested RAF inside the frame (loader fade) never steals the slot
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frameNow = now;
  const nowSec = now / 1000;
  // dynamic lite fallback: 3 slow frames (>32ms) → kill shadows/bloom
  if (!headless && !_liteSwitched && !lite && dt > 0.032) {
    _slowFrames++;
    if (_slowFrames >= 3) {
      _liteSwitched = true;
      try { renderer.shadowMap.enabled = false; postfx.dispose(); world.setLite(true); street.setLite(true); } catch {}
    }
  }
  // shadow budget: at peak queue shadows are noise — save the fill rate
  try { renderer.shadowMap.enabled = (lite || _liteSwitched) ? false : (patrons.queueLength <= 40); } catch {}
  // numbers snap to RAF, not tick: jank-free even at 20× (see updateHUD throttle)
  const quietNow = (!headless || paceTest) && isQuiet({
    phase, paused, closed, modalOpen: !!modals.top(), cardVisible: !!momentActive,
    momentPending: momentPending.length > 0, dayMin, day, offerResolved,
    incidentPending: day >= 2 && !incidentShown && dayMin < 1015,
    settled: day >= 2 || !coach || coach.skipped || coach.craftObserved || dayMin >= 540,
  });
  const pf = $('paceflag'); if (pf) pf.hidden = !quietNow;
  const effSpeed = quietNow ? Math.min(1200, speed * QUIET_MUL) : speed;
  const movePerTick = quietNow || (headless && moveTickTest);
  let ticked = 0;
  if (started && !closed && !paused && !tutorialActive && schedule && phase === 'trading') {
    acc += dt * 1000 * impact.dtScale(nowSec);
    const msPerMin = 300 / (effSpeed / 60);
    while (acc > msPerMin && phase === 'trading' && !paused && !closed && impact.dtScale(nowSec) > 0) {
      acc -= msPerMin;
      if (movePerTick) {
        const step = 300 / (speed / 60) / 1000;
        const mul = WALK_MUL[speed] || 2;
        patrons.update(step, mul, now, reducedMotion);
        street.update(step, mul, reducedMotion);
      }
      tick(); ticked++;
    }
    // After the evening call the rest of the day resolves in a short burst
    // instead of another stretch of watching.
    if (eveningFast && impact.dtScale(nowSec) > 0) {
      let burst = 10;
      while (burst-- && phase === 'trading' && !paused && !closed) tick();
    }
    if (rushFast && impact.dtScale(nowSec) > 0) {
      let burst = 12;
      while (burst-- && phase === 'trading' && !paused && !closed && dayMin < 840) tick();
      if (dayMin >= 840) rushFast = false;
    }
  }
  vitality.tick();
  try { world.setRivalHeat(patrons.rivalQ.length); } catch {}
  world.updateTimeOfDay(dayMin);
  sky.update(dayMin, null, vitality.current);
  director.update({ dt, now, dayMin, night: world.night || 0, vitality: vitality.current });
  kitBeat.update(dt, now);
  mailT.update(dt, now);
  try { world.manageCutaway?.(camera.position, document.body.classList.contains('photo') ? 'photo' : rig.mode); } catch {}
  try {
    if (modals.top()) rig.release();
    else {
      const view = renderer.domElement;
      if (view && (view.inert || (view.hasAttribute && view.hasAttribute('inert')))) {
        view.inert = false;
        if (view.removeAttribute) view.removeAttribute('inert');
      }
    }
  } catch {}
  try {
    const ambient = started && phase === 'trading' && !paused && !tutorialActive && !modals.top()
      && !lite && !_liteSwitched && rig.mode !== 'title';
    const peeked = world.updateNeighborPeeks(dt, now, { ambient });
    if (world.openPremiseIds) street.setOpenShops(world.openPremiseIds());
    if (peeked && !roofAmbientNoted) {
      roofAmbientNoted = true;
      fx.toast(`${peeked.name} — ${peeked.line}`, '');
    }
  } catch {}
  postfx.setNight((world.night || 0) > 0.35 || dayMin < 420 || dayMin > 1180);
  if (impact.dtScale(nowSec) === 0) {
    patrons.update(0, WALK_MUL[speed] || 2, now, reducedMotion);
    street.update(0, WALK_MUL[speed] || 2, reducedMotion);
  } else if (!(movePerTick && ticked)) {
    patrons.update(dt, WALK_MUL[speed] || 2, now, reducedMotion);
    street.update(dt, WALK_MUL[speed] || 2, reducedMotion);
  }
  barStaff.update(dt, reducedMotion);
  world.updateRival(dt, now);
  try { world.updateCat(dt, patrons.queueLength); world._updateDelight(now, dt); } catch {}
  fx.steamFrom(dt);
  fx.update(dt, camera, now);
  impact.update(nowSec);
  rig.update(dt, now);
  rig.setFovOffset(impact.fovDelta(nowSec));
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
  // PR-2 — showfloor autoplay. Polls the modal stack and fires the same
  // button the player would. 1.5s grace per modal so the UI animates in
  // before the click. A keyboard intent flips autoplay off (below).
  autoplayTick(now);
  if (!headless) postfx.render(now);   // headless harness skips GL
}
  window.__grunds = {
  stats: () => ({ day, dayMin, till, cogs, balked, served, servedRetail, defections, rivalServed, peakQueue, waveBalked, waveServed, net: till - cogs - exchange.debt, queue: patrons.queueLength, count: patrons.count, phase, hedgedCups, hedgeSavings: realizedHedgeSavings, batchUnits: ctx.batchUnits, batchSpend, batchWaste,
    turnaways, rivalTurnaways: patrons.turnaways || 0,
    emergencyCups, beanSpend, emergencySpend, sackSpend, houseLot: lotState.house, houseStock: lotState.entry(lotState.house)?.stock ?? 0,
    caseRevenue: caseRevenueToday, caseUnits,
    loan: { balance: loan.balance, missedCloses: loan.missedCloses, seized: loan.seized, returned: loan.returnedToday, due: loan.dueToday, paid: loan.paidToday, unpaid: loan.unpaidToday, purse: loan.purse },
    board: loan.seized ? 'beans and water' : 'menu',
    index: exchange.beanIndex, cost: exchange.costPerCup, debt: exchange.debt, settledPaid, campaignDone, cRev, cCost, cOps, netWorth: cRev - cCost - cOps - settledPaid - exchange.debt, rep: regulars.reputation, vitality: Math.round(vitality.current * 100) / 100, event: exchange.event ? exchange.event.id : null, contract: exchange.contract ? exchange.contract.price : null, rushFast, eveningFast,
    staffCondition: baristaCondition, staffing: onRobotHire() ? 'robot' : (planDraft ? planDraft.staffing : 'work'), rivalChoices: patrons.rivalChoices, preparedCups, baristaCrisis,
    weekHire, hireLocked, quietCarry, apprentice: apprenticeHiredToday, maintenance: maintenanceBill, tipsForgone: tipsForgoneToday, staffMul: patrons.staffMul, tipMul: regulars.tipMul,
    trainingSpend, sampleSpend, feeToday, interestToday, settleToday, marketingSpend,
    milkDelivery, milkStock: ctx.milkStock, milky: ctx.milky, milkOut: ctx.milkOut, milkBalked,
    satisfaction: demand ? demand.satisfaction : 62,
    waveBatchServed, waveStockoutAt, batchReservedUntil: ctx.batchReservedUntil,
    pastryStock: ctx.pastryStock, pastrySpend, pastryWaste, pastryWasteCost, pastryCut,
    awareness: demand ? demand.awareness : 0, ops: lastOps, demand, repriced, prebatched }),
  vitals: () => buildVitals(vitalsSnapshot()),
  tetherWifi,
  get wifiOutage() { return wifiOutage ? { ...wifiOutage, status: outageStatus(wifiOutage, dayMin) } : null; },
  states: () => patrons.patrons.reduce((m, p) => ((m[p.state] = (m[p.state] || 0) + 1), m), {}),
  exc: exchange, reg: regulars, sync, world, rig, analytics,
  vitality, director, district, kitBeat, mailT, impact,
  openDay, applyReply, reset, togglePause, resolveEvening, skipToRush,
  prepareDay, stageDayPlan, stageWeekHire, commitDayPlan, continueFromReview,
  stageShockCounter, stageCounterable, stagePastryCut,
  doPrebatch, doReprice,
  // Headless lever: stage menu prices + 86 board without DOM (mirrors the
  // Brief's menu section: stagedMenu → applyMenu at commit). NOTE: commit
  // order matters — commitDayPlan() calls applyMenu() only inside
  // startTradingDay()'s commit path; a throw between commit and apply
  // (e.g. a failed sync) would drop the staging, so stageMenu is
  // best-effort: it also writes through to the live board immediately.
  // The Brief's own commit overwrites with the same values — no conflict.
  stageMenu({ prices, offered } = {}) {
    if (phase !== 'planning') return false;
    if (prices) {
      for (const [id, v] of Object.entries(prices)) {
        if (!DRINK_IDS.includes(id) || !Number.isFinite(+v)) return false;
      }
    }
    if (offered) {
      for (const id of Object.keys(offered)) {
        if (!DRINK_IDS.includes(id) || id === 'matcha') return false;
      }
    }
    if (!stagedMenu) stagedMenu = { prices: { ...menuPrices }, offered: { ...menuOffered } };
    if (prices) {
      for (const [id, v] of Object.entries(prices)) {
        stagedMenu.prices[id] = clampPrice(id, +v);
        menuPrices[id] = stagedMenu.prices[id];
      }
    }
    if (offered) {
      for (const [id, on] of Object.entries(offered)) {
        stagedMenu.offered[id] = !!on;
        menuOffered[id] = stagedMenu.offered[id];
      }
    }
    ctx.menuPrices = menuPrices;
    patrons.menuOffered = menuOffered;
    patrons.menuPrices = menuPrices;
    return true;
  },
  coach: { state: () => coach, begin: coachBegin, tick: coachTick, resume: coachResume, skip: coachSkip, hide: coachHide },
  moment: { active: () => momentActive ? momentActive.type : null, pending: () => momentPending.map(m => ({ type: m.type, at: m.at })), done: () => [...momentDone], block: key => momentDone.add(key), unblock: key => momentDone.delete(key), enqueue: (t, k, d = {}) => momentEnqueue(t, k, d) },
  stageCellar, stageLoan, stageCase,
  patrons, barStaff, modals, openDossier, showIncident, showLicence,
  franchise,
  renderBrief() { if (phase === 'planning') { if (softDay) showSoftIntro(0); else showMorningBrief(); } },
  get phase() { return phase; },
  get party() { return party; },
  get softDay() { return softDay; },
  get softWeekDone() { return softWeekDone; },
  get coachedOpening() { return coachedOpening; },
  beginWeek,
  get plan() { return planDraft ? { ...planDraft, marketing: { ...demand.staged } } : null; },
  get weekHire() { return weekHire; },
  get hireLocked() { return hireLocked; },
  get quietCarry() { return quietCarry; },
  get lastDayReceipt() { return lastDayReceipt; },
  get quote() {
    return planDraft ? quoteDayPlan({
      day, hedge: planDraft.hedge, staffing: onRobotHire() ? 'robot' : planDraft.staffing, marketing: planDraft.marketing,
      debt: exchange.debt, extraFee: contractFeeExtra, perkCostMul, modifiers: modifiersForDay(day),
    }) : null;
  },
  get paused() { return paused; },
  ...(headless ? { testState: ({ baristaCondition: c, openingGuidance: og, curriculum: cu, curriculumIntroduced: ci, pace: pc, moments: mo, moveTick: mt, softOpening: so, tutorial: tu, quietCarry: qc, loanCash: lc, closeTill: ct } = {}) => {
    if (typeof c === 'number') baristaCondition = c;
    if (typeof qc === 'number') quietCarry = qc;
    if (tu !== undefined) wantTutorial = !!tu;
    if (so !== undefined) { softTest = so === null ? null : !!so; if (phase === 'planning' && day === 1 && !softWeekDone) { softDay = softTest !== null ? softTest : wantsSoftDay(); patrons.markSeenOnly = softDay ? SOFT_CAST : null; if (softDay && !softRng) softRng = seeded(seedNow() + 101); } }
    if (pc !== undefined) paceTest = !!pc;
    if (mo !== undefined) momentsTest = !!mo;
    if (mt !== undefined) moveTickTest = !!mt;
    if (og !== undefined) { guidedOpening = !!og; firstPrepChosen = !(og && day === 1); }
    if (cu !== undefined) {
      curriculumUnlockAll = !cu;
      if (cu && !curriculumMemory) curriculumMemory = new Set();
    }
    if (Array.isArray(ci)) { curriculumMemory = new Set(ci); }
    if (ci === null) curriculumMemory = new Set();
    if (lc !== undefined) loanCashCap = lc === null ? null : lc;
    if (ct !== undefined) closeTillOverride = ct === null ? null : ct;
  } } : {}),
  get curriculum() {
    return {
      unlockAll: curriculumUnlockAll,
      introduced: [...introducedSet()],
      toolsToday,
      toolsIntroducedToday,
      pouredByLotToday,
      servedByDrinkToday,
    };
  },
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

