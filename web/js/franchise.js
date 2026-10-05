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

import { FRANCHISE } from './config.js';
import { GLBLoader } from './loader.js';
import { fitToSlot } from './districtGen.js';
import { baseUrl } from './convexSync.js';

const MAX_POLLS = 8; // ~4 min while trading — a fresh build finishes inside one day

export function initFranchise({ scene, seed, classic, loader, onArrived }) {
  const state = {
    seed,
    live: false,        // a status read has landed at least once
    classic: !!classic,
    day: 0,             // last day the floor told us about
    lots: {},           // lotId → { status, prompt, describedDay, placed, placedDay }
  };
  const lotState = (id) => state.lots[id] || (state.lots[id] = {
    status: 'missing', prompt: null, describedDay: null, placed: false, placedDay: 0, mine: false,
  });
  const lotDef = (id) => FRANCHISE.lots.find((l) => l.id === id);

  // Dead-mode: classic opt-out, headless, no GL, or no Convex bridge. The
  // methods still exist so the floor can call them unconditionally — they
  // just never reach the network.
  const dead = !!classic
    || (typeof globalThis !== 'undefined' && (globalThis.__headless || globalThis.__noGLB))
    || !scene;
  const base = (baseUrl() || '').replace(/\/$/, '');
  const glb = loader || GLBLoader();

  async function place(id, modelUrl, dayNow) {
    const ls = lotState(id), def = lotDef(id);
    if (!def || ls.placed) return;
    ls.placed = true; // once only — a bad GLB shows the empty lot, not a retry loop
    try {
      const inst = await glb.loadGLB(modelUrl, {
        position: def.position.slice(),
        rotationY: def.rotationY,
      });
      if (inst?.userData?.placeholder) { ls.placed = false; return; }
      fitToSlot(inst, FRANCHISE.height);
      scene.add(inst);
      ls.placedDay = dayNow || state.day || 0; // pre-existing stands pay from day 1
      if (state.onArrived) state.onArrived(inst, def, ls);
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
      state.live = true;
      let anyProcessing = false;
      for (const l of d.lots || []) {
        const ls = lotState(l.lot);
        ls.status = l.status || 'missing';
        ls.prompt = l.prompt ?? ls.prompt;
        ls.describedDay = l.day ?? ls.describedDay;
        if (ls.status === 'success' && l.modelUrl && !ls.placed) await place(l.lot, l.modelUrl, state.day);
        if (ls.status === 'processing') anyProcessing = true;
      }
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
  // building on. The builders take one job at a time — a described lot
  // hides the line until it resolves.
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
  state.describe = async (lotId, text, dayNow) => {
    if (dead || !base) return { status: 'error', error: 'the builders could not be reached' };
    try {
      const r = await fetch(
        `${base}/franchise/describe?seed=${seed}&lot=${encodeURIComponent(lotId)}&day=${dayNow || state.day || 0}&prompt=${encodeURIComponent(text)}`,
        { method: 'POST' },
      );
      const d = await r.json().catch(() => ({}));
      const ls = lotState(lotId);
      if (d.status === 'invalid' || d.status === 'locked') { ls.status = 'invalid'; return d; }
      if (d.status === 'processing' || d.status === 'success') {
        ls.status = d.status;
        ls.prompt = d.prompt ?? text;
        ls.describedDay = dayNow || state.day;
        ls.mine = true;
        if (d.status === 'processing') setTimeout(() => poll(1), 30000);
        else if (d.modelUrl) place(lotId, d.modelUrl, state.day);
      }
      return d;
    } catch {
      return { status: 'error', error: 'the builders could not be reached' };
    }
  };

  // Rent: every standing stand pays at each open. placedDay guards the
  // first morning — a stand can't owe rent before it exists.
  state.rentDue = (dayNow) => FRANCHISE.lots.reduce((sum, l) => {
    const s = lotState(l.id);
    return sum + (s.placed && dayNow > 0 && dayNow > s.placedDay ? l.rent : 0);
  }, 0);

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
