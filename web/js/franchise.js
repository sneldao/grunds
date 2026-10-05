// franchise.js — the player's words become a stand on The Row (Tripothon S1,
// Tier B). The brief's describe line POSTs /franchise/describe; this module
// polls /franchise/status and, on success, cross-fades the grown stand in
// front of the far-row facades — live mid-day if the builders are fast,
// else at the next dawn. Once placed, the stand pays a rent line at open.
//
// Same completeness posture as districtGen: headless/no-GL/no-Convex all
// no-op, a failed or missing generation never blocks play, and the one
// franchise per seed is remembered server-side so the street outlives
// any single campaign.

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
    status: 'missing',  // missing | invalid | processing | success | failed
    prompt: null,       // the player's words, once described
    describedDay: null,
    placed: false,      // GLB is in the scene
    placedDay: 0,       // campaign day it arrived (rent starts next dawn)
    day: 0,             // last day the floor told us about
  };
  // Dead-mode: classic opt-out, headless, no GL, or no Convex bridge. The
  // methods still exist so the floor can call them unconditionally — they
  // just never reach the network.
  const dead = !!classic
    || (typeof globalThis !== 'undefined' && (globalThis.__headless || globalThis.__noGLB))
    || !scene;
  const base = (baseUrl() || '').replace(/\/$/, '');
  const glb = loader || GLBLoader();

  async function place(modelUrl, dayNow) {
    if (state.placed) return;
    state.placed = true; // once only — a bad GLB shows the empty lot, not a retry loop
    try {
      const inst = await glb.loadGLB(modelUrl, {
        position: FRANCHISE.position.slice(),
        rotationY: FRANCHISE.rotationY,
      });
      if (inst?.userData?.placeholder) { state.placed = false; return; }
      fitToSlot(inst, FRANCHISE.height);
      scene.add(inst);
      state.placedDay = dayNow || state.day || 0; // pre-existing stands pay from day 1
      if (state.onArrived) state.onArrived(inst);
    } catch {
      state.placed = false; // network blip — next poll tries again
    }
  }

  async function poll(attempt) {
    if (dead || !base) return;
    try {
      const r = await fetch(`${base}/franchise/status?seed=${seed}`);
      if (!r.ok) return;
      const d = await r.json();
      state.status = d.status || 'missing';
      state.prompt = d.prompt ?? state.prompt;
      state.describedDay = d.day ?? state.describedDay;
      state.live = true;
      if (state.status === 'success' && d.modelUrl && !state.placed) {
        await place(d.modelUrl, state.day);
      } else if (state.status === 'processing' && attempt < MAX_POLLS) {
        setTimeout(() => poll(attempt + 1), 30000);
      }
    } catch { /* street carries on without it */ }
  }

  // The floor calls this at each dawn (and once at boot): refresh the read,
  // note the day, and restart the poll loop while a build is in flight.
  state.refresh = (dayNow) => {
    state.day = dayNow || state.day;
    if (state.status !== 'success' || !state.placed) poll(1);
    else state.live = true;
  };

  // The brief's describe button. Returns the server's verdict so the caller
  // can flip the line to "sent" or surface the invalid-prompt hint.
  state.describe = async (text, dayNow) => {
    if (dead || !base) return { status: 'error', error: 'the builders could not be reached' };
    try {
      const r = await fetch(
        `${base}/franchise/describe?seed=${seed}&day=${dayNow || state.day || 0}&prompt=${encodeURIComponent(text)}`,
        { method: 'POST' },
      );
      const d = await r.json().catch(() => ({}));
      if (d.status === 'invalid') { state.status = 'invalid'; return d; }
      if (d.status === 'processing' || d.status === 'success') {
        state.status = d.status;
        state.prompt = d.prompt ?? text;
        state.describedDay = dayNow || state.day;
        if (d.status === 'processing') setTimeout(() => poll(1), 30000);
        else if (d.modelUrl) place(d.modelUrl, state.day);
      }
      return d;
    } catch {
      return { status: 'error', error: 'the builders could not be reached' };
    }
  };

  // Rent: the stand pays at each open once it stands on the street.
  // placedDay guards the first morning — it can't owe rent before it exists.
  state.rentDue = (dayNow) => state.placed && dayNow > 0 && dayNow > state.placedDay ? FRANCHISE.rent : 0;

  state.refresh(0);
  return state;
}
