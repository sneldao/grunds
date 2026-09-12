// Convex live-sync bridge — optional, offline-first.
// Precedence: ?convex= param > auto-detect (hosted on *.convex.site, mirror
// to self) > localStorage `grunds.convexUrl`. Each dawn POSTs a snapshot to
// /sync/snapshot and the HUD badge flips to LIVE. No bundler, no CDN, no
// client lib — plain fetch against the http.ts bridge, fire-and-forget so
// the game never blocks.

function baseUrl() {
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
  const paint = (txt) => { if (badge) { badge.textContent = txt; badge.classList.toggle('live', live); } };
  paint(live ? '● LIVE · convex mirror' : '○ local');
  let campaignId = null;
  try { campaignId = localStorage.getItem('grunds.campaignId'); } catch { /* ignore */ }

  async function mirror(state) {
    if (!live) return { live: false };
    try {
      const r = await fetch(url + '/sync/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, seed: state.seed ?? 7, owner, ...state }),
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
    if (!live || !campaignId) return null;
    try {
      const r = await fetch(url + '/sync/state?campaignId=' + encodeURIComponent(campaignId));
      const data = await r.json();
      if (data && data.campaign && typeof data.campaign.day === 'number') {
        paint(`● LIVE · day ${data.campaign.day}/5 · ${owner}`);
      }
      return data;
    } catch {
      return null;
    }
  }
  if (live && typeof setInterval !== 'undefined') setInterval(poll, 15000);

  return { live, url, owner, mirror, poll, get campaignId() { return campaignId; } };
}
