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

  function renderDesk(intel) {
    const body = $('desk-body');
    body.textContent = '';
    const sum = document.createElement('p');
    sum.className = 'd-sum';
    sum.textContent = intel.summary || 'Market intelligence briefing.';
    body.appendChild(sum);
    const shifts = intel.marketShift || [];
    if (shifts.length) {
      const h = document.createElement('h5');
      h.textContent = 'deck tilt — tomorrow’s odds';
      body.appendChild(h);
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
    const srcs = intel.sources || [];
    if (srcs.length) {
      const h = document.createElement('h5');
      h.textContent = 'on the wire — cited sources';
      body.appendChild(h);
      for (const s of srcs) {
        const row = document.createElement('div');
        row.className = 'd-src';
        const a = document.createElement('span');
        a.textContent = s.title || 'untitled';
        const b = document.createElement('span');
        b.className = 'd-why';
        b.textContent = host(s.url);
        row.append(a, b);
        body.appendChild(row);
      }
    }
  }

  function open(intel) {
    if (!intel) return;
    lastIntel = intel;
    if (billing.isSubscribed()) {
      renderDesk(intel);
      $('paywall').classList.remove('show');
      $('desk').classList.add('show');
      track('desk_opened', {
        shifts: (intel.marketShift || []).length,
        sources: (intel.sources || []).length,
        mode: billing.mode,
      });
    } else {
      const mode = $('pw-mode');
      if (mode)
        mode.textContent =
          billing.mode === 'web billing'
            ? 'via RevenueCat Web Billing'
            : billing.mode === 'test store · live SDK'
              ? 'RevenueCat SDK · Test Store checkout'
              : 'demo checkout · RevenueCat Web Test Store';
      billing.priceLabel().then((p) => {
        if (buy && !buy.disabled) buy.textContent = `subscribe · ${p}`;
      });
      $('paywall').classList.add('show');
      track('paywall_shown', { mode: billing.mode });
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
