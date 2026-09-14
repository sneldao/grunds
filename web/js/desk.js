// The Wire — the District Insider research desk. Free players see *that* the
// market moved; subscribers see *why*: every cited Linkup source, the deck
// tilt, and the reasoning behind tomorrow's roll. Gated by the
// commodity_insider entitlement (RevenueCat Web Billing); the Web Test Store
// keeps the whole flow demoable before production keys land.

import { EVENTS } from './config.js';

const EVENT_LABEL = {
  frost_minas: 'Minas Gerais frost',
  drought_ea: 'East Africa drought',
  harvest_good: 'record harvest',
  hype_matcha: 'matcha demand surge',
  rumour_frost: 'supply-chain frost rumour',
  stable: 'calm board',
};

// Vague scent of the top deck tilt for free players at the decision point —
// direction without detail. Insiders get the sources and multipliers.
export function wireHint(intel) {
  const s = intel?.marketShift?.[0];
  if (!s) return null;
  if (s.weightMul <= 1) return 'reads quiet';
  return {
    frost_minas: 'smells like frost',
    rumour_frost: 'smells like frost',
    drought_ea: 'smells like drought',
    harvest_good: 'smells like a glut',
    hype_matcha: 'smells like a craze',
    stable: 'reads quiet',
  }[s.eventId] ?? 'stirs';
}

export function initDesk({ billing, analytics } = {}) {
  const $ = (id) => document.getElementById(id);
  const track = (name, payload) => {
    try {
      analytics && analytics.track(name, payload);
    } catch {
      /* analytics is optional */
    }
  };
  let lastIntel = null;

  function host(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function renderDesk(intel, subscribed) {
    const body = $('desk-body');
    body.textContent = '';
    const sum = document.createElement('p');
    sum.className = 'd-sum';
    sum.textContent = intel.summary || 'Market intelligence briefing.';
    body.appendChild(sum);
    const shifts = intel.marketShift || [];
    const srcs = intel.sources || [];
    // headlines — always free (the education)
    if (srcs.length) {
      const h = document.createElement('h5');
      h.textContent = 'on the wire — headlines';
      body.appendChild(h);
      for (const s of srcs) {
        const row = document.createElement('div');
        row.className = srcs.length <= 2 ? 'd-src' : 'd-row';
        const a = document.createElement('a');
        a.textContent = s.title || 'untitled';
        a.href = s.url || '#';
        a.target = '_blank'; a.rel = 'noopener';
        a.style.color = '#1d4a48'; a.style.textDecoration = 'underline';
        if (s.snippet) a.title = s.snippet;
        const b = document.createElement('span');
        b.className = 'd-why';
        b.textContent = host(s.url) + (s.origin ? ' · ' + s.origin : '');
        row.append(a, b);
        body.appendChild(row);
      }
      // one-line why-this-matters for the lead story (still free)
      if (shifts[0] && shifts[0].reason) {
        const why = document.createElement('div');
        why.className = 'd-card';
        why.textContent = 'why this matters · ' + String(shifts[0].reason).slice(0, 160);
        body.appendChild(why);
      }
    }
    // deck tilt — the insider edge (multipliers + per-card reasoning)
    if (shifts.length) {
      const h = document.createElement('h5');
      h.textContent = subscribed ? 'deck tilt — tomorrow’s odds (insider)' : 'deck tilt — insider edge';
      body.appendChild(h);
      if (!subscribed) {
        const blur = document.createElement('div');
        blur.className = 'd-card';
        blur.textContent = 'The quantitative tilt (× weights + reasoning per card) is District Insider. Headlines above are yours.';
        body.appendChild(blur);
      } else {
        for (const s of shifts) {
          const row = document.createElement('div');
          row.className = 'd-row';
          const a = document.createElement('span');
          a.textContent = `${EVENT_LABEL[s.eventId] || s.eventId}  ×${s.weightMul}`;
          const b = document.createElement('span');
          b.className = 'd-why';
          b.textContent = s.reason || '';
          row.append(a, b);
          body.appendChild(row);
          const card = EVENTS[s.eventId]?.head;
          if (card) {
            const c = document.createElement('div');
            c.className = 'd-card';
            c.textContent = 'card in the deck · ' + card;
            body.appendChild(c);
          }
        }
      }
    }
    if (!srcs.length && !shifts.length) {
      const p = document.createElement('div'); p.className = 'd-card'; p.textContent = 'The wire is quiet today.'; body.appendChild(p);
    }
  }

  // Free commodity education: every player gets the headlines + summary.
  // Insiders get the quantitative deck tilt (weightMul + reasoning) and the
  // roaster's private note — the edge, not the access. This is the
  // "invert the wire" fix (P0): the USP (real-world commodity → your till)
  // is never behind a paywall.
  function open(intel) {
    if (!intel) return;
    lastIntel = intel;
    const subscribed = billing.isSubscribed();
    renderDesk(intel, subscribed);
    $('paywall').classList.remove('show');
    $('desk').classList.add('show');
    track(subscribed ? 'desk_opened' : 'desk_opened_free', {
      shifts: (intel.marketShift || []).length,
      sources: (intel.sources || []).length,
      mode: billing.mode,
    });
    // free players still see the paywall's insider edge as a small footer
    // inside the desk (not a blocking modal) — invite, don't block.
    const edge = $('desk-edge');
    if (edge) {
      if (subscribed) edge.style.display = 'none';
      else {
        edge.style.display = '';
        edge.textContent = 'District Insider sharpens this — deck tilt multipliers + the roaster\'s private note. ';
        const a = document.createElement('a');
        a.href = '#'; a.textContent = 'peek the edge →';
        a.onclick = (e) => { e.preventDefault(); $('desk').classList.remove('show'); $('paywall').classList.add('show');
          const mode = $('pw-mode');
          if (mode) mode.textContent = billing.mode === 'web billing' ? 'via RevenueCat Web Billing' : billing.mode === 'test store · live SDK' ? 'RevenueCat SDK · Test Store checkout' : 'demo checkout · RevenueCat Web Test Store';
          billing.priceLabel().then((p) => { if (buy && !buy.disabled) buy.textContent = `subscribe · ${p}`; });
          track('paywall_shown', { mode: billing.mode });
        };
        // avoid duplicating the link on re-open
        if (!edge.querySelector('a')) edge.appendChild(a);
      }
    }
  }

  function close() {
    $('desk').classList.remove('show');
    $('paywall').classList.remove('show');
  }

  const buy = $('pw-buy');
  if (buy)
    buy.onclick = async () => {
      buy.disabled = true;
      buy.textContent = 'contacting the roaster…';
      const r = await billing.purchasePass();
      buy.disabled = false;
      buy.textContent = 'subscribe · ' + (await billing.priceLabel());
      if (r.success) {
        track('purchase_success', { mode: billing.mode });
        if (lastIntel) open(lastIntel);
        else close();
      } else if (!r.cancelled) {
        const note = $('pw-note');
        if (note) note.textContent = 'checkout didn’t complete — try again';
      }
    };

  const restore = $('pw-restore');
  if (restore)
    restore.onclick = async (e) => {
      e.preventDefault();
      await billing.restorePass();
      if (lastIntel) open(lastIntel);
    };

  const pwClose = $('pw-close');
  if (pwClose)
    pwClose.onclick = (e) => {
      e.preventDefault();
      close();
    };
  const deskClose = $('desk-close');
  if (deskClose) deskClose.onclick = close;

  return { open, close };
}
