// franchise.js — the player's words become stands on The Row (Tripothon S1,
// Tier B). Three vacant storefronts unlock across the campaign; each one the
// player describes (words, or a pasted photo link → image-to-model) becomes a
// real Tripo generation that cross-fades in and pays rent at each open.
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
import { baseUrl } from './convexSync.js';

const MAX_POLLS = 8; // ~4 min while trading — a fresh build finishes inside one day

export function initFranchise({ scene, seed, classic, loader, onArrived, onStatus }) {
  const state = {
    seed,
    live: false,        // a status read has landed at least once
    classic: !!classic,
    day: 0,             // last day the floor told us about
    lots: {},           // lotId → { status, prompt, describedDay, placed, placedDay, purpose }
    onStatus,           // optional: fired when a status read lands (brief re-render)
    onArrived,          // optional: fired when a stand lands mid-session (toast)
  };
  const lotState = (id) => state.lots[id] || (state.lots[id] = {
    status: 'missing', prompt: null, describedDay: null, placed: false, placedDay: 0, mine: false, purpose: null, byline: null,
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
      unscaffold(id);
      ls.placedDay = dayNow || state.day || 0; // pre-existing stands pay from day 1
      // announce=false on the hydration read — a stand that was always
      // there didn't "arrive"; only transitions witnessed live get a toast.
      if (announce && state.onArrived) state.onArrived(inst, def, ls);
    } catch {
      ls.placed = false; // network blip — next poll tries again
    }
  }

  async function poll(attempt) {
    if (dead || !base) return;
    try {
      const r = await fetch(`${base}/franchise/status?seed=${seed}`);
      if (!r.ok) return;
      const d = await r.json();
      const firstRead = !state.live;
      state.live = true;
      let anyProcessing = false;
      for (const l of d.lots || []) {
        const ls = lotState(l.lot);
        ls.status = l.status || 'missing';
        ls.prompt = l.prompt ?? ls.prompt;
        ls.describedDay = l.day ?? ls.describedDay;
        ls.purpose = l.purpose ?? null; // status is authoritative — never keep a stale local one
        ls.byline = l.byline ?? null;   // the builder's signature, same rule
        if (ls.status === 'success' && l.modelUrl && !ls.placed) await place(l.lot, l.modelUrl, state.day, !firstRead);
        if (ls.status === 'processing') { anyProcessing = true; scaffold(l.lot); }
        // The worksite survives a failed GLB load — place() removes it only
        // after a real stand lands; anything that isn't buildable loses it.
        else if (ls.status !== 'success' || ls.placed) unscaffold(l.lot);
      }
      if (state.onStatus) { try { state.onStatus(d); } catch {} }
      if (anyProcessing && attempt < MAX_POLLS) setTimeout(() => poll(attempt + 1), 30000);
    } catch { /* street carries on without it */ }
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
    if (needsPoll) poll(1);
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
  state.describe = async (lotId, text, dayNow, purpose, byline) => {
    if (dead || !base) return { status: 'error', error: 'the builders could not be reached' };
    try {
      const r = await fetch(
        `${base}/franchise/describe?seed=${seed}&lot=${encodeURIComponent(lotId)}&day=${dayNow || state.day || 0}&prompt=${encodeURIComponent(text)}` +
        (purpose ? `&purpose=${encodeURIComponent(purpose)}` : '') +
        (byline ? `&byline=${encodeURIComponent(byline)}` : ''),
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
        if (d.claimed) ls.mine = true;   // claimed=false: somebody else got here first
        if (d.status === 'processing') { scaffold(lotId); setTimeout(() => poll(1), 30000); }
        // place() owns the worksite — it comes down only after a real GLB lands.
        else if (d.modelUrl) place(lotId, d.modelUrl, state.day);
      }
      return d;
    } catch {
      return { status: 'error', error: 'the builders could not be reached' };
    }
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

  state.refresh(0);
  return state;
}
