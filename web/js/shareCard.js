// shareCard.js — the stamped-print share card (Feature 4).
//
// Everything draws onto a caller-supplied 2D context, so the whole
// composition is node-testable with a recording stub — no DOM, no GL.
// The look is the rent-sign paper (textures.js) shrunk to a postcard:
// cream stock, brown double rule, brass corners — then a red rubber
// stamp so the card reads DISPATCHED, not screenshotted.

import { BASE_URL } from './share.js';

export const CARD_W = 1280;
export const CARD_H = 720;

export function cardLayout(w = CARD_W, h = CARD_H) {
  const pad = Math.round(w * 0.02);
  const band = Math.round(h * 0.17);
  const inset = pad + 10;
  return {
    pad, band, inset,
    frame: { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 },
    inner: { x: pad + 7, y: pad + 7, w: w - (pad + 7) * 2, h: h - (pad + 7) * 2 },
    snap: { x: inset, y: inset, w: w - inset * 2, h: h - band - inset },
    bandRect: { x: pad, y: h - band, w: w - pad * 2, h: band - pad },
    stamp: { cx: w - pad - 150, cy: h - band / 2, w: 236, h: 64, rot: -0.11 },
    corners: [[pad + 4, pad + 4], [w - pad - 4, pad + 4], [pad + 4, h - pad - 4], [w - pad - 4, h - pad - 4]],
  };
}

export function captionLine({ day = 1, seed = 7, stats = {}, badge = null } = {}) {
  const s = stats;
  const money = (v) => '£' + Math.round(v ?? 0);
  const parts = [`Day ${day}/5`, `till ${money(s.till)}`, `rep ${Math.round(s.rep ?? 0)}/100`,
    `${s.served ?? 0} served`, `${s.balked ?? 0} walked`, `seed ${seed}`];
  const head = badge ? `${badge.icon} ${badge.title} — ` : '';
  return head + parts.join(' · ');
}

// ctx: a CanvasRenderingContext2D (or any recording stub).
// opts: { snapshot, badge, seed, stats, day }
export function buildShareCard(ctx, { snapshot, badge = null, seed = 7, stats = {}, day = 1, rng = Math.random }) {
  const L = cardLayout(ctx.canvas.width, ctx.canvas.height);
  // cream stock + linen grain (rentSign 'let' idiom)
  ctx.fillStyle = '#efe6d3';
  ctx.fillRect(0, 0, L.frame.w + L.pad * 2, L.frame.h + L.pad * 2);
  ctx.fillStyle = 'rgba(0,0,0,.035)';
  for (let i = 0; i < 1600; i++) ctx.fillRect(rng() * ctx.canvas.width, rng() * ctx.canvas.height, 1, 1);
  // double rule + brass corners
  ctx.strokeStyle = 'rgba(74,52,35,.55)'; ctx.lineWidth = 6;
  ctx.strokeRect(L.frame.x, L.frame.y, L.frame.w, L.frame.h);
  ctx.strokeStyle = 'rgba(74,52,35,.18)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(L.inner.x, L.inner.y, L.inner.w, L.inner.h);
  for (const [cx, cy] of L.corners) {
    ctx.fillStyle = 'rgba(201,162,39,.62)';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(cx - 1.5, cy - 1.5, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // the street, inset — cover-fit crop so no aspect distortion ever shows
  const sw = snapshot.width || 16, sh = snapshot.height || 9;
  const fit = Math.max(L.snap.w / sw, L.snap.h / sh);
  const dw = sw * fit, dh = sh * fit;
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.snap.x, L.snap.y, L.snap.w, L.snap.h);
  ctx.clip();
  ctx.drawImage(snapshot, L.snap.x + (L.snap.w - dw) / 2, L.snap.y + (L.snap.h - dh) / 2, dw, dh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,26,22,.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(L.snap.x, L.snap.y, L.snap.w, L.snap.h);
  // caption band — ink on paper
  ctx.fillStyle = 'rgba(23,19,16,.86)';
  ctx.fillRect(L.bandRect.x, L.bandRect.y, L.bandRect.w, L.bandRect.h);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(239,230,211,.6)'; ctx.font = '600 17px Georgia, serif';
  ctx.fillText('GRUNDS — THE DISTRICT', L.bandRect.x + 20, L.stamp.cy - 22);
  ctx.fillStyle = '#efe6d3'; ctx.font = '22px Georgia, serif';
  ctx.fillText(captionLine({ day, seed, stats, badge }), L.bandRect.x + 20, L.stamp.cy + 8);
  ctx.fillStyle = 'rgba(239,230,211,.45)'; ctx.font = '13px ui-monospace, monospace';
  ctx.fillText(BASE_URL + '?seed=' + seed, L.bandRect.x + 20, L.stamp.cy + 32);
  // the rubber stamp — SOLD idiom, dispatched not screenshotted
  ctx.save();
  ctx.translate(L.stamp.cx, L.stamp.cy);
  ctx.rotate(L.stamp.rot);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-L.stamp.w / 2 + 4, -L.stamp.h / 2 + 4, L.stamp.w, L.stamp.h);
  ctx.fillStyle = 'rgba(208,64,58,.92)'; ctx.fillRect(-L.stamp.w / 2, -L.stamp.h / 2, L.stamp.w, L.stamp.h);
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  ctx.strokeRect(-L.stamp.w / 2 + 6, -L.stamp.h / 2 + 6, L.stamp.w - 12, L.stamp.h - 12);
  ctx.strokeStyle = 'rgba(208,64,58,1)'; ctx.lineWidth = 4;
  ctx.strokeRect(-L.stamp.w / 2, -L.stamp.h / 2, L.stamp.w, L.stamp.h);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '700 27px Georgia, serif';
  ctx.fillText('GRUNDS · SEED ' + seed, 0, -4);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '11px ui-monospace, monospace';
  ctx.fillText('—  DISTRICT OFFICE  —', 0, 18);
  ctx.restore();
}
