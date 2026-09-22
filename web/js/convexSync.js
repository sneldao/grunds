// Convex live-sync bridge — optional, offline-first.
// Precedence: ?convex= param > auto-detect (hosted on *.convex.site, mirror
// to self) > localStorage `grunds.convexUrl`. Each dawn POSTs a snapshot to
// /sync/snapshot and the HUD badge flips to LIVE. No bundler, no CDN, no
// client lib — plain fetch against the http.ts bridge, fire-and-forget so
// the game never blocks.

export function baseUrl() {
  try {
    const q = new URLSearchParams(location.search).get('convex');
    if (q) { try { localStorage.setItem('grunds.convexUrl', q); } catch { /* private mode */ } return q; }
    if (typeof location !== 'undefined' && /\.convex\.site$/.test(location.hostname)) return location.origin;
    return localStorage.getItem('grunds.convexUrl');
  } catch {
    return null;
  }
}

function ownerName() {
  try {
    const q = new URLSearchParams(location.search).get('stand');
    if (q) { try { localStorage.setItem('grunds.owner', q); } catch { /* private mode */ } return q; }
    const saved = localStorage.getItem('grunds.owner');
    if (saved) return saved;
    const gen = 'stand-' + Math.random().toString(36).slice(2, 7);
    try { localStorage.setItem('grunds.owner', gen); } catch { /* ignore */ }
    return gen;
  } catch {
    return 'house-stand';
  }
}

export function initSync() {
  const url = (baseUrl() || '').replace(/\/$/, '');
  const live = !!url;
  const owner = live ? ownerName() : null;
  const badge = typeof document !== 'undefined' && document.getElementById('syncbadge');
  const paint = (txt, on) => { if (badge) { badge.textContent = txt; badge.classList.toggle('live', !!on); } };
  paint(live ? '● LIVE · convex mirror' : '○ local', live);
  let campaignId = null;

  async function mirror(state) {
    if (!live || runDisabled) return { live: false };
    try {
      const r = await fetch(url + '/sync/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ownerName() reads localStorage live — the pitch licence can rename
        // the stand mid-session and the board picks it up at the next dawn
        body: JSON.stringify({ campaignId, seed: state.seed ?? 7, owner: ownerName(), ...state }),
      });
      const data = await r.json();
      if (data && data.campaignId && data.campaignId !== campaignId) {
        campaignId = data.campaignId;
        try { localStorage.setItem('grunds.campaignId', campaignId); } catch { /* ignore */ }
      }
      return { live: true, ...data };
    } catch {
      return { live: true, mirrored: false };
    }
  }

  // Poll server state so the badge shows the mirrored day, and a second tab
  // watching the same campaign sees it advance. Fire-and-forget, 15s.
  async function poll() {
    if (!live || runDisabled || !campaignId) return null;
    try {
      const r = await fetch(url + '/sync/state?campaignId=' + encodeURIComponent(campaignId));
      const data = await r.json();
      if (data && data.campaign && typeof data.campaign.day === 'number') {
        paint(`● LIVE · ${ownerName()}`);
      }
      return data;
    } catch {
      return null;
    }
  }
  if (live && typeof setInterval !== 'undefined') setInterval(poll, 15000);

  // District leaderboard: every mirrored stand races the same week. Fetched
  // on demand (dawn, day close, finale) — the 15s poll stays badge-cheap.
  async function stands() {
    if (!live || runDisabled || !campaignId) return null;
    try {
      const r = await fetch(url + '/sync/stands?campaignId=' + encodeURIComponent(campaignId));
      const data = await r.json();
      return data && Array.isArray(data.stands) ? data.stands : null;
    } catch {
      return null;
    }
  }

  // Linkup deep research: one fetch per session, server-cached 6h. Returns
  // { summary, sources, marketShift } or null — the deck stays seeded without it.
  async function intel() {
    if (!live) return null;
    try {
      const r = await fetch(url + '/ai/research');
      const data = await r.json();
      return data && !data.fallback ? data : null;
    } catch {
      return null;
    }
  }

  // Idris's inbox: newest inbound reply after a cursor (ms timestamp of the
  // last letter seen). Null offline or on any failure — the mailbox simply
  // stays shut. Read-only mirror; the backend already applied the command.
  async function inbox(after) {
    if (!live || runDisabled || !campaignId) return null;
    try {
      const r = await fetch(url + '/agentmail/inbox?campaignId=' + encodeURIComponent(campaignId)
        + '&after=' + encodeURIComponent(String(after || 0)));
      if (!r.ok) return null;
      const data = await r.json();
      return data && data.letter !== undefined ? data.letter : null;
    } catch {
      return null;
    }
  }

  let activeRun = null, runDisabled = false;
  function randomHex32() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function newRun(seed) {
    return { token: randomHex32(), seed, cancelled: false, queue: Promise.resolve(), begun: false,
      campaignId: null, targetDay: null, dayPlans: new Map(), prepared: new Map(), pendingFinish: new Map() };
  }
  const managed = () => live && !runDisabled;
  const clone = o => JSON.parse(JSON.stringify(o));
  function enqueue(run, fn) {
    const p = run.queue.then(async () => {
      if (run !== activeRun || run.cancelled) throw new Error('run reset');
      return fn(run);
    });
    run.queue = p.catch(() => {});
    return p;
  }
  async function post(run, op, body) {
    if (run !== activeRun || run.cancelled) throw new Error('run reset');
    const r = await fetch(url + '/sync/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, token: run.token, ...body }),
    });
    if (run !== activeRun || run.cancelled) throw new Error('run reset');
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) throw new Error((data && data.error) || 'sync failed');
    return data;
  }
  async function ensureBegin(run) {
    if (run.begun) return { ok: true };
    const d = await post(run, 'begin', { seed: run.seed });
    if (!d || !d.ok) throw new Error((d && d.why) || 'begin failed');
    if (run !== activeRun) throw new Error('run reset');
    run.begun = true;
    run.campaignId = d.campaignId;
    campaignId = d.campaignId;
    try { localStorage.setItem('grunds.campaignId', campaignId); } catch { /* private mode */ }
    return { ok: true };
  }
  async function flushFinishes(run) {
    for (const day of [...run.pendingFinish.keys()].sort((a, b) => a - b)) {
      const f = run.pendingFinish.get(day);
      const d = await post(run, 'finish', { day, state: clone(f.state), ownerName: f.ownerName });
      if (!d || !d.ok) throw new Error((d && d.why) || 'finish failed');
      run.pendingFinish.delete(day);
    }
  }
  async function ensurePrepared(run, day) {
    if (run.prepared.has(day)) return run.prepared.get(day);
    const dp = run.dayPlans.get(day);
    if (!dp) throw new Error('not prepared');
    const d = await post(run, 'prepare', { snapshot: clone(dp.snapshot), plan: clone(dp.plan) });
    if (!d || !d.ok) throw new Error((d && d.why) || 'prepare failed');
    if (run !== activeRun) throw new Error('run reset');
    if (d.decisionId) run.prepared.set(day, d.decisionId);
    return run.prepared.get(day) || null;
  }
  function beginRun(seed) {
    if (!live) return Promise.resolve({ ok: false, why: 'offline' });
    runDisabled = false;
    if (activeRun && !activeRun.cancelled) return enqueue(activeRun, r => ensureBegin(r));
    const run = newRun(seed);
    activeRun = run;
    return enqueue(run, r => ensureBegin(r));
  }
  function preparePlan(snapshot, plan) {
    if (!managed()) return Promise.resolve({ ok: false, why: 'offline' });
    if (!activeRun) activeRun = newRun(undefined);
    const run = activeRun;
    const snap = clone(snapshot), pl = clone(plan);
    run.targetDay = snap.day;
    run.dayPlans.set(snap.day, { snapshot: snap, plan: pl });
    return enqueue(run, async () => {
      await ensureBegin(run);
      await flushFinishes(run);
      const d = await post(run, 'prepare', { snapshot: snap, plan: pl });
      if (!d || !d.ok) throw new Error((d && d.why) || 'prepare failed');
      if (run !== activeRun) throw new Error('run reset');
      if (d.decisionId) run.prepared.set(snap.day, d.decisionId);
      return d;
    });
  }
  function stagePlan(plan, day) {
    if (!managed()) return Promise.resolve({ ok: false, why: 'offline' });
    const run = activeRun;
    if (!run) return Promise.resolve({ ok: false, why: 'no run' });
    const d0 = day ?? run.targetDay, pl = clone(plan);
    const dp = run.dayPlans.get(d0);
    if (dp) dp.plan = pl;
    return enqueue(run, async () => {
      await ensureBegin(run);
      await flushFinishes(run);
      await ensurePrepared(run, d0);
      const d = await post(run, 'stage', { day: d0, plan: pl });
      if (!d || !d.ok) throw new Error((d && d.why) || 'stage failed');
      return d;
    });
  }
  function commitPlan(plan, day) {
    if (!managed()) return Promise.resolve({ ok: false, why: 'offline' });
    const run = activeRun;
    if (!run) return Promise.resolve({ ok: false, why: 'no run' });
    const d0 = day ?? run.targetDay, pl = clone(plan);
    return enqueue(run, async () => {
      await ensureBegin(run);
      await flushFinishes(run);
      await ensurePrepared(run, d0);
      const d = await post(run, 'commit', { day: d0, plan: pl });
      if (!d || !d.ok) throw new Error((d && d.why) || 'commit failed');
      return d;
    });
  }
  function finishDay(day, state, owner) {
    if (!managed()) return Promise.resolve({ ok: false, why: 'offline' });
    const run = activeRun;
    if (!run) return Promise.resolve({ ok: false, why: 'no run' });
    const st = clone(state), own = owner || ownerName();
    run.pendingFinish.set(day, { state: st, ownerName: own });
    return enqueue(run, async () => {
      await ensureBegin(run);
      const d = await post(run, 'finish', { day, state: st, ownerName: own });
      if (!d || !d.ok) throw new Error((d && d.why) || 'finish failed');
      run.pendingFinish.delete(day);
      return d;
    });
  }
  function sendPlanMail(to, plan, day) {
    if (!managed()) return Promise.resolve({ ok: false, why: 'offline' });
    const run = activeRun;
    if (!run) return Promise.resolve({ ok: false, why: 'no run' });
    const d0 = day ?? run.targetDay, pl = plan ? clone(plan) : null, addr = String(to);
    return enqueue(run, async () => {
      await ensureBegin(run);
      await flushFinishes(run);
      await ensurePrepared(run, d0);
      if (pl) {
        const s = await post(run, 'stage', { day: d0, plan: pl });
        if (!s || !s.ok) throw new Error((s && s.why) || 'stage failed');
      }
      if (run !== activeRun || run.cancelled) throw new Error('run reset');
      const decisionId = run.prepared.get(d0);
      const r = await fetch(url + '/agentmail/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: addr, token: run.token, decisionId }),
      });
      if (run !== activeRun || run.cancelled) throw new Error('run reset');
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || !data.ok) throw new Error((data && data.why) || 'send failed');
      return data;
    });
  }
  function abandonRun() {
    const old = activeRun;
    activeRun = null;
    campaignId = null;
    try { localStorage.removeItem('grunds.campaignId'); } catch { /* private mode */ }
    if (!live || !old) return;
    old.cancelled = true;
    fetch(url + '/sync/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'abandon', token: old.token }),
    }).catch(() => {});
  }
  function disableRun() {
    runDisabled = true;
    abandonRun();
    paint('○ local', false);
  }

  return { live, url, owner, mirror, poll, stands, intel, inbox,
    managed, beginRun, preparePlan, stagePlan, commitPlan, finishDay, sendPlanMail, abandonRun, disableRun,
    get runDisabled() { return runDisabled; },
    get campaignId() { return campaignId; },
    get decisionId() { return activeRun && activeRun.targetDay != null ? activeRun.prepared.get(activeRun.targetDay) || null : null; } };
}
