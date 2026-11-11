// franchise.js — the player's words become stands on The Row (Tripothon S1,
// Tier B). Three vacant storefronts unlock across the campaign; each one the
// player describes (words, or a pasted photo link → image-to-model) becomes a
// real generation — Rodin first, Tripo fallback — that cross-fades in and
// pays rent at each open.
//
// Same completeness posture as districtGen: headless/no-GL/no-Convex all
// no-op, a failed or missing generation never blocks play, and one
// franchise per (seed, lot) is remembered server-side — every later player
// on the seed inherits what the first built. The street outlives any
// single campaign; that's the gift.

import * as THREE from '../vendor/three.module.js';
import { FRANCHISE } from './config.js';
import { GLBLoader } from './loader.js';
import { fitToSlot } from './districtGen.js';
import { loadPF } from './polyfork.js';
import { seeded } from './exchange.js';
import { baseUrl } from './convexSync.js';
import { fmt } from './city.js';
import { specForLot, specLine } from './standSpec.js';
import { addContactShadow } from './contactShadow.js';
// specForLot falls back to the seeded classifier over ls.prompt, so the
// polyfork path needs no spec plumbing of its own — the card is derived.

// A fresh stand is usually ready in about two minutes. Look immediately, then
// every 10s for six minutes, and keep looking through a failed read or a GLB
// that is not fetchable yet. Stopping early used to leave the kiosk until the
// next dawn — most of a day of play, about eight minutes on the clock.
export const FRANCHISE_POLL_MS = 10000;
export const FRANCHISE_MAX_POLLS = 36;

export function initFranchise({ scene, seed, classic, loader, onArrived, onStatus, onPlaced, polyfork, builder }) {
  // Builder escape hatch (?builder=tripo): skip the Rodin attempt server-
  // side. Absent means Rodin first with Tripo fallback — the default.
  const state = {
    seed,
    live: false,        // a status read has landed at least once
    classic: !!classic,
    day: 0,             // last day the floor told us about
    lots: {},           // lotId → { status, prompt, describedDay, placed, placedDay, purpose }
    onStatus,           // optional: fired when a status read lands (brief re-render)
    onArrived,          // optional: fired when a stand lands mid-session (toast)
    onPlaced,
  };
  const lotState = (id) => state.lots[id] || (state.lots[id] = {
    status: 'missing', prompt: null, describedDay: null, placed: false, placedDay: 0, mine: false, purpose: null, byline: null,
    spec: null, standName: null,
  });
  const lotDef = (id) => FRANCHISE.lots.find((l) => l.id === id);

  // A described lot is a worksite until the GLB lands: four posts, two
  // planks, brass-timber tones — quiet enough to live on the street, and
  // never in dead/classic mode. Idempotent across polls; gone the moment
  // the stand arrives or the build fails.
  const worksite = (def) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a, transparent: true, opacity: 0.55 });
    const h = FRANCHISE.height * 0.8, w = 2.2, d = 0.8;
    const post = new THREE.BoxGeometry(0.08, h, 0.08);
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const p = new THREE.Mesh(post, mat);
      p.position.set(x, h / 2, z);
      g.add(p);
    }
    const bar = new THREE.BoxGeometry(w + 0.1, 0.08, 0.08);
    const b1 = new THREE.Mesh(bar, mat); b1.position.set(0, h * 0.45, -d / 2);
    const b2 = new THREE.Mesh(bar, mat); b2.position.set(0, h * 0.45, d / 2);
    g.add(b1, b2);
    g.position.set(def.position[0], def.position[1], def.position[2]);
    g.rotationY = def.rotationY;
    return g;
  };
  const scaffold = (id) => {
    const ls = lotState(id), def = lotDef(id);
    if (!def || ls.marker || ls.placed || dead || !scene) return;
    ls.marker = worksite(def);
    scene.add(ls.marker);
  };
  const unscaffold = (id) => {
    const ls = lotState(id);
    if (!ls.marker) return;
    scene.remove(ls.marker);
    ls.marker.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    ls.marker = null;
  };

  // Dead-mode: classic opt-out, headless, no GL, or no Convex bridge. The
  // methods still exist so the floor can call them unconditionally — they
  // just never reach the network.
  const dead = !!classic
    || (typeof globalThis !== 'undefined' && (globalThis.__headless || globalThis.__noGLB))
    || !scene;
  const base = (baseUrl() || '').replace(/\/$/, '');
  const glb = loader || GLBLoader();

  async function place(id, modelUrl, dayNow, announce = true) {
    const ls = lotState(id), def = lotDef(id);
    if (!def || ls.placed) return;
    ls.placed = true; // cleared on a failed load so the next read retries
    try {
      const inst = await glb.loadGLB(modelUrl, {
        position: def.position.slice(),
        rotationY: def.rotationY,
      });
      if (inst?.userData?.placeholder) { ls.placed = false; return; }
      fitToSlot(inst, FRANCHISE.height);
      scene.add(inst);
      addContactShadow(scene, def.position[0], def.position[2], 2.6, 1.9, 0.32);
      // The spec's name goes on a little sign beside the stand — the words
      // the player typed, readable in the street. Best-effort: a canvas or
      // GL hiccup must never cost the stand itself.
      try {
        const sign = standSign(specForLot(ls)?.name || ls.standName, def);
        if (sign) scene.add(sign);
      } catch {}
      unscaffold(id);
      ls.placedDay = dayNow || state.day || 0; // pre-existing stands pay from day 1
      state.onPlaced?.(inst, def, ls);
      // announce=false on the hydration read — a stand that was always
      // there didn't "arrive"; only transitions witnessed live get a toast.
      if (announce && state.onArrived) state.onArrived(inst, def, ls);
    } catch {
      ls.placed = false; // network blip — next poll tries again
    }
  }

  let pollGen = 0;
  let pollTimer = 0;
  function continuePoll(attempt, gen) {
    if (gen !== pollGen || !(attempt < FRANCHISE_MAX_POLLS)) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => { if (gen === pollGen) poll(attempt + 1, gen); }, FRANCHISE_POLL_MS);
  }
  function armPoll() {
    const gen = ++pollGen;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = 0; }
    poll(1, gen);
  }
  async function poll(attempt, gen) {
    if (dead || !base || gen !== pollGen) return;
    let waiting = false;
    try {
      const r = await fetch(`${base}/franchise/status?seed=${seed}`);
      if (gen !== pollGen) return;
      if (!r.ok) { continuePoll(attempt, gen); return; }
      const d = await r.json();
      const firstRead = !state.live;
      state.live = true;
      for (const l of d.lots || []) {
        const ls = lotState(l.lot);
        ls.status = l.status || 'missing';
        ls.prompt = l.prompt ?? ls.prompt;
        ls.describedDay = l.day ?? ls.describedDay;
        ls.purpose = l.purpose ?? null; // status is authoritative — never keep a stale local one
        ls.byline = l.byline ?? null;   // the builder's signature, same rule
        ls.spec = l.spec ?? null;       // the character card — absent on legacy rows
        ls.standName = l.standName ?? null;
        if (ls.status === 'success' && l.modelUrl && !ls.placed) await place(l.lot, l.modelUrl, state.day, !firstRead);
        if (gen !== pollGen) return;
        if (ls.status === 'processing') { waiting = true; scaffold(l.lot); }
        else if (ls.status === 'success' && !ls.placed) waiting = true; // GLB not in the street yet — try again
        // The worksite survives a failed GLB load — place() removes it only
        // after a real stand lands; anything that isn't buildable loses it.
        else if (ls.status !== 'success' || ls.placed) unscaffold(l.lot);
      }
      if (state.onStatus) { try { state.onStatus(d); } catch {} }
    } catch { waiting = true; /* one blip must not wait until dawn */ }
    if (waiting) continuePoll(attempt, gen);
  }

  // The floor calls this at each dawn (and once at boot): refresh the read,
  // note the day, and restart the poll loop while any build is in flight.
  // The first read always goes out — "nothing built" is only known once it
  // lands, so un-read seeds must poll to discover inherited stands.
  state.refresh = (dayNow) => {
    state.day = dayNow || state.day;
    const needsPoll = !state.live || FRANCHISE.lots.some((l) => {
      const s = lotState(l.id);
      return s.status === 'processing' || (s.status === 'success' && !s.placed);
    });
    if (needsPoll) armPoll();
  };

  // The next storefront the brief can offer: first unlocked lot nobody is
  // building on. Builds run in parallel — a described lot just can't be
  // re-offered while it resolves.
  state.nextVacant = (dayNow) => {
    const day = dayNow ?? state.day;
    return FRANCHISE.lots.find((l) => {
      if (day < l.unlockDay) return false;
      const s = lotState(l.id).status;
      return s !== 'success' && s !== 'processing';
    }) || null;
  };

  // The brief's describe button. Returns the server's verdict so the caller
  // can flip the line to "sent" or surface the invalid-prompt hint.
  // ?district=polyfork: the player's words map to a curated stand archetype
  // (vendored Polyfork GLB) and land instantly — no provider call. Keywords
  // first, seeded pick over generic stands as the fallback.
  const PF_STANDS = [
    [/coffee|espresso|caf[eé]|barista|flat white|brew/, 'coffee-kiosk-406d3e'],
    [/campus|student|uni/, 'campus-coffee-kiosk-ec2395'],
    [/juice|lemonade|smoothie|refresh|drink/, 'refreshment-kiosk-406f65'],
    [/container|snack/, 'container-snack-kiosk-7036e5'],
    [/ramen|noodle|yatai|soup/, 'ramen-yatai-stall-53974b'],
    [/mercado|mexic|taco/, 'mercado-stall-6e6ba3'],
    [/elote|corn/, 'elote-cart-a8fb49'],
    [/hot.?dog|sausage|frank/, 'hot-dog-cart-115192'],
    [/ice.?cream|gelato|sorbet|popsicle|sundae/, 'ice-cream-kiosk-on-40a568'],
    [/sopaipilla|empanada|fried|chile/, 'sopaipilla-cart-712632'],
    [/news|paper|magazine|book/, 'newsstand-6dfd65'],
    [/market|farm|fruit|veg|produce|flower/, 'market-stall-94937d'],
  ];
  function pfStandId(text, lotId) {
    const w = String(text || '').toLowerCase();
    for (const [re, id] of PF_STANDS) if (re.test(w)) return id;
    let h = 0; for (const c of String(lotId)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    const rng = seeded((seed >>> 0) + h + 31);
    return ['market-stall-94937d', 'mercado-stall-6e6ba3', 'newsstand-6dfd65'][Math.floor(rng() * 3)];
  }
  async function pfDescribe(lotId, text, dayNow, purpose, byline) {
    const ls = lotState(lotId), def = lotDef(lotId);
    if (!def || ls.placed) return { status: 'locked' };
    const id = pfStandId(text, lotId);
    const inst = await loadPF(glb, id, {
      position: def.position.slice(), rotationY: def.rotationY,
      height: FRANCHISE.height, night: 'street',
    });
    if (inst?.userData?.placeholder) { ls.status = 'missing'; return { status: 'error', error: 'stand asset missing' }; }
    ls.status = 'success'; ls.prompt = text;
    ls.describedDay = dayNow || state.day;
    ls.purpose = purpose ?? null; ls.byline = byline ?? null; ls.mine = true;
    ls.placed = true;
    scene.add(inst); unscaffold(lotId);
    addContactShadow(scene, def.position[0], def.position[2], 2.6, 1.9, 0.32);
    try { const sign = standSign(specForLot(ls)?.name, def); if (sign) scene.add(sign); } catch {}
    ls.placedDay = dayNow || state.day || 0;
    pfRemember(lotId, id, ls);
    state.onPlaced?.(inst, def, ls);
    if (state.onArrived) state.onArrived(inst, def, ls);
    return { status: 'success', prompt: text, purpose, byline, claimed: true };
  }

  // Local hydration marker: polyfork stands are client-side, so a reload
  // re-places them from localStorage keyed to this seed — no server needed.
  const PF_LS_KEY = `grunds-pf-stands-${seed}`;
  function pfRemember(lotId, pfId, ls) {
    try {
      const all = JSON.parse(localStorage.getItem(PF_LS_KEY) || '{}');
      all[lotId] = { pfId, prompt: ls.prompt, day: ls.placedDay, purpose: ls.purpose, byline: ls.byline };
      localStorage.setItem(PF_LS_KEY, JSON.stringify(all));
    } catch {}
  }
  async function pfHydrate() {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(PF_LS_KEY) || '{}'); } catch {}
    for (const [lotId, s] of Object.entries(all)) {
      const ls = lotState(lotId), def = lotDef(lotId);
      if (!def || ls.placed || !s?.pfId) continue;
      const inst = await loadPF(glb, s.pfId, {
        position: def.position.slice(), rotationY: def.rotationY,
        height: FRANCHISE.height, night: 'street',
      });
      if (inst?.userData?.placeholder) continue;
      Object.assign(ls, { status: 'success', prompt: s.prompt, describedDay: s.day, purpose: s.purpose ?? null, byline: s.byline ?? null, mine: true, placed: true, placedDay: s.day || 0 });
      scene.add(inst); unscaffold(lotId);
      addContactShadow(scene, def.position[0], def.position[2], 2.6, 1.9, 0.32);
      try { const sign = standSign(specForLot(ls)?.name, def); if (sign) scene.add(sign); } catch {}
      state.onPlaced?.(inst, def, ls);
    }
    state.live = true;
    // Defer: initFranchise runs before main.js finishes declaring `phase`,
    // so a synchronous onStatus would throw in TDZ.
    queueMicrotask(() => { try { state.onStatus && state.onStatus(); } catch {} });
  }

  state.describe = async (lotId, text, dayNow, purpose, byline) => {
    if (dead) return { status: 'error', error: 'the builders could not be reached' };
    // Vendored-only sessions (explicit ?district=polyfork) and sessions with
    // no Convex bridge take the instant archetype path; everyone else asks
    // the builders first — LLM spec + real generation — and falls back to
    // the same instant path when the builders can't answer, so a described
    // lot is never left empty. Fallback stands are session-only: pfHydrate
    // stays gated on polyfork, so they do not re-place on reload.
    if (polyfork || !base) return pfDescribe(lotId, text, dayNow, purpose, byline);
    try {
      const r = await fetch(
        `${base}/franchise/describe?seed=${seed}&lot=${encodeURIComponent(lotId)}&day=${dayNow || state.day || 0}&prompt=${encodeURIComponent(text)}` +
        (purpose ? `&purpose=${encodeURIComponent(purpose)}` : '') +
        (byline ? `&byline=${encodeURIComponent(byline)}` : '') +
        (builder === 'tripo' ? '&builder=tripo' : ''),
        { method: 'POST' },
      );
      const d = await r.json().catch(() => ({}));
      const ls = lotState(lotId);
      if (d.status === 'invalid' || d.status === 'locked') { ls.status = 'invalid'; unscaffold(lotId); return d; }
      if (d.status === 'processing' || d.status === 'success') {
        ls.status = d.status;
        ls.prompt = d.prompt ?? text;
        ls.describedDay = dayNow || state.day;
        // The server's purpose and signature are authoritative — a live
        // franchise answers with the builder's own; never keep ours.
        ls.purpose = d.purpose ?? null;
        ls.byline = d.byline ?? null;
        ls.spec = d.spec ?? null;
        ls.standName = d.standName ?? null;
        if (d.claimed) ls.mine = true;   // claimed=false: somebody else got here first
        if (d.status === 'processing') { scaffold(lotId); armPoll(); }
        // place() owns the worksite — it comes down only after a real GLB lands.
        else if (d.modelUrl) place(lotId, d.modelUrl, state.day);
        return d;
      }
    } catch {}
    return pfDescribe(lotId, text, dayNow, purpose, byline);
  };

  // Rent: every standing stand pays at each open. placedDay guards the
  // first morning — a stand can't owe rent before it exists. A tenant
  // purpose pays the commercial lease on top of the peppercorn base;
  // legacy purpose-less stands just pay the base.
  state.rentDue = (dayNow) => FRANCHISE.lots.reduce((sum, l) => {
    const s = lotState(l.id);
    if (!s.placed || !(dayNow > 0) || !(dayNow > s.placedDay)) return sum;
    return sum + l.rent + (s.purpose === 'rent' ? FRANCHISE.purposes.rent.rentBonus : 0);
  }, 0);

  // The purpose bonuses a placed stand owes the street — counted at each
  // close for stands already standing before the day began (arrival day
  // itself earns nothing; day N+1 does). Stands still building, failed,
  // or purpose-less (legacy rows) contribute nothing. rentBonus rides
  // along purely so the receipt can split the tenant uplift out of the
  // dawn's rent line — same eligibility window as rentDue.
  state.effectsDue = (dayNow) => {
    const P = FRANCHISE.purposes;
    const out = { awareness: 0, returnees: 0, rentBonus: 0 };
    for (const l of FRANCHISE.lots) {
      const s = lotState(l.id);
      if (!s.placed || !s.purpose || !(dayNow > s.placedDay)) continue;
      if (s.purpose === 'draw') out.awareness += P.draw.awareness;
      else if (s.purpose === 'community') out.returnees += P.community.returnees;
      else if (s.purpose === 'rent') out.rentBonus += P.rent.rentBonus;
    }
    return out;
  };

  // A stand somebody else built is still yours to inherit — the gift.
  // Returns a built lot this client never described (first-come authorship
  // is server-side, so the day on the row is the builder's, not ours).
  state.inherited = () => {
    for (const l of FRANCHISE.lots) {
      const s = lotState(l.id);
      if (s.status === 'success' && !s.mine) return l;
    }
    return null;
  };

  if (polyfork) pfHydrate();
  state.refresh(0);
  return state;
}

// A tiny name-board on two posts beside the stand. Returns null headless —
// the canvas may not exist in tests, and a missing sign is never fatal.
function standSign(name, def) {
  if (!name || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#1d1712'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#c9a227'; g.lineWidth = 6; g.strokeRect(4, 4, 504, 120);
  g.fillStyle = '#f3e9d2';
  g.font = '600 50px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(name).toUpperCase().slice(0, 26), 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const grp = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.07, 1.5, 0.07);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.9 });
  for (const x of [-0.55, 0.55]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, 0.75, 0);
    grp.add(p);
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.38),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }),
  );
  board.position.y = 1.35;
  grp.add(board);
  grp.position.set(def.position[0] + 1.7, def.position[1], def.position[2]);
  grp.rotationY = def.rotationY;
  return grp;
}
function gbp(n) {
  const v = Math.round(Number(n) * 100) / 100;
  if (!(v > 0)) return '';
  return Number.isInteger(v) ? fmt(v, 0) : fmt(v);
}

// What the morning brief should say about The Row. Eligible stands (placed
// before today) credit rent this morning and name the bonus tonight's close
// will count. `carry` is last night's close — those neighbours and that
// awareness are already in today's street. A stand that arrived this morning
// says when its bonus starts, so the next brief is not silent.
export function morningFranchiseLines(franchise, day, carry = {}) {
  const lines = [];
  if (!franchise || typeof franchise.effectsDue !== 'function') return lines;
  const fx = franchise.effectsDue(day) || {};
  const rent = typeof franchise.rentDue === 'function' ? franchise.rentDue(day) : 0;
  const bonus = fx.rentBonus || 0;
  const base = Math.max(0, rent - bonus);
  const P = FRANCHISE.purposes;
  if ((carry.returnees || 0) > 0) lines.push(`The hub’s ${carry.returnees} neighbours are in today’s crowd.`);
  if ((carry.awareness || 0) > 0) lines.push(`The draw’s awareness carried into today.`);
  const baseTxt = gbp(base);
  if (baseTxt) lines.push(`The Row’s ground rent is in this morning — ${baseTxt}.`);
  const bonusTxt = gbp(bonus);
  if (bonusTxt) lines.push(`The tenant’s lease is in this morning — ${bonusTxt}.`);
  if ((fx.returnees || 0) > 0) lines.push(`The hub on the Row — ${fx.returnees} neighbours come back from tonight, in tomorrow’s crowd.`);
  if ((fx.awareness || 0) > 0) lines.push(`The draw on the Row — +${Number(fx.awareness).toFixed(2)} awareness at tonight’s close.`);
  const lots = franchise.lots || {};
  for (const def of FRANCHISE.lots) {
    const s = lots[def.id];
    if (!s || !s.placed || !s.purpose || day !== s.placedDay) continue;
    if (s.purpose === 'community') lines.push(`${def.name} is open — a hub’s ${P.community.returnees} neighbours start from the next morning.`);
    else if (s.purpose === 'draw') lines.push(`${def.name} is open — the draw’s awareness starts at the next close.`);
    else if (s.purpose === 'rent') lines.push(`${def.name} is open — the tenant’s lease starts next morning.`);
  }
  // Every standing stand says what it IS — the spec card, seeded or LLM.
  // One line each, standing fact like the rent: it doesn't expire.
  for (const def of FRANCHISE.lots) {
    const s = lots[def.id];
    if (!s || !s.placed) continue;
    const line = specLine(specForLot(s));
    if (line) lines.push(`${line}.`);
  }
  return lines;
}
