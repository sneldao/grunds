// Procedural canvas textures — the demo never touches the network.
import * as THREE from '../vendor/three.module.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

export function woodFloor() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#6b4e33'; g.fillRect(0, 0, 512, 512);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = r * 64, off = (r % 2) * 128;
    for (let x = -1; x < 5; x++) {
      const w = 170 + ((x * 37 + r * 91) % 60);
      const shade = 96 + ((x * 53 + r * 29) % 28);
      g.fillStyle = `rgb(${shade + 20},${shade - 8},${shade - 42})`;
      g.fillRect(x * 170 + off, y + 2, w - 4, 60);
      g.strokeStyle = 'rgba(40,24,12,.5)'; g.lineWidth = 2;
      g.strokeRect(x * 170 + off, y + 2, w - 4, 60);
      g.strokeStyle = 'rgba(60,38,20,.25)';
      for (let gline = 0; gline < 3; gline++) {
        const gy = y + 12 + gline * 18 + ((x * 13 + r * 7) % 8);
        g.beginPath(); g.moveTo(x * 170 + off + 6, gy); g.bezierCurveTo(x * 170 + off + 60, gy + 3, x * 170 + off + 110, gy - 3, x * 170 + off + w - 12, gy); g.stroke();
      }
    }
  }
  return tex(c, [3, 2]);
}

export function pavement() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6f6a60'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${30 + Math.random() * 40 | 0},${30 + Math.random() * 36 | 0},${26 + Math.random() * 30 | 0},${0.12 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(40,38,34,.6)'; g.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  return tex(c, [10, 2]);
}

export function road() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 34 + Math.random() * 22 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
  }
  g.fillStyle = 'rgba(220,210,170,.75)';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 124, 34, 6);   // dashed centre line
  return tex(c, [8, 1]);
}

export function awning(stripeA = '#2f4f43', stripeB = '#e8dfc9') {
  const [c, g] = canvas(256, 128);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? stripeA : stripeB; g.fillRect(i * 32, 0, 32, 128); }
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,.14)'); grd.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  return tex(c, [3, 1]);
}

// The chalkboard menu — redrawn in-world when the player reprices matcha.
export function menuBoard() {
  const [c, g] = canvas(512, 384);
  function draw(matchaPrice, struck) {
    g.fillStyle = '#20261f'; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = '#8a6f3f'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 370);
    g.strokeStyle = 'rgba(240,235,220,.16)'; g.lineWidth = 1;
    for (let i = 0; i < 260; i++) g.strokeRect(Math.random() * 512, Math.random() * 384, 1, 1);
    g.textAlign = 'center'; g.fillStyle = '#efe6d3';
    g.font = '600 34px Georgia, serif'; g.fillText('— TODAY AT GRUNDS —', 256, 62);
    g.font = '26px Georgia, serif'; g.textAlign = 'left';
    const rows = [['filter coffee', '3.20'], ['cappuccino', '3.80'], ['miso banana loaf', '2.90'], ['mochi donut', '2.40']];
    let y = 118;
    for (const [item, price] of rows) { g.fillText(item, 60, y); g.textAlign = 'right'; g.fillText(price, 452, y); g.textAlign = 'left'; y += 44; }
    // matcha — the star of the board
    g.fillStyle = '#a8c48a'; g.font = 'italic 600 30px Georgia, serif';
    g.fillText('matcha latte', 60, y + 6);
    g.textAlign = 'right';
    if (struck) {
      g.fillStyle = 'rgba(239,230,211,.45)'; g.fillText('4.80', 452, y + 6);
      g.strokeStyle = '#d0603b'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(382, y - 2); g.lineTo(458, y + 2); g.stroke();
      g.fillStyle = '#a8c48a'; g.font = 'italic 600 34px Georgia, serif';
      g.fillText(matchaPrice, 452, y + 42);
      g.font = 'italic 20px Georgia, serif'; g.fillText('← today only', 340, y + 42);
    } else {
      g.font = 'italic 600 34px Georgia, serif'; g.fillText(matchaPrice, 452, y + 6);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  return { draw, canvas: c };
}

// Soft radial sprite for particles (steam, coins, dust, huffs).
export function softSprite() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function shopSign(text, fg = '#efe6d3', bg = '#1d2a24', font = '600 44px Georgia, serif') {
  const [c, g] = canvas(512, 96);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = 'rgba(201,162,39,.8)'; g.lineWidth = 4; g.strokeRect(4, 4, 504, 88);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// The rent-pressure sign — the gentrification drift made physical.
// Three states:
//   'let'   — day 1-2: faint cream "TO LET" (the storefront's been there a while)
//   'lease' — day 3-4: red banner "FOR LEASE" (district is turning over)
//   'sold'  — day 5: diagonal red "SOLD" stamp (turnover complete)
//
// Re-baked in-world by W.setRentPressure(day). The texture object stays
// the same across bakes; only the canvas pixels change, so the world only
// pays for one material.
export function rentSign() {
  const [c, g] = canvas(512, 384);
  function draw(state) {
    g.clearRect(0, 0, 512, 384);
    if (state === 'let') {
      // cream background, faint walnut "TO LET", brass corner detail
      g.fillStyle = '#efe6d3'; g.fillRect(0, 0, 512, 384);
      g.strokeStyle = 'rgba(74,52,35,.6)'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 368);
      g.fillStyle = 'rgba(201,162,39,.6)';   // brass corners
      for (const [x, y] of [[18, 18], [478, 18], [18, 350], [478, 350]]) {
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#4a3423'; g.font = 'italic 600 84px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TO LET', 256, 170);
      g.font = '24px Georgia, serif';
      g.fillText('enquiries next door', 256, 230);
    } else if (state === 'lease') {
      // white background, thick red banner across the top
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 512, 384);
      g.fillStyle = '#d0403a'; g.fillRect(0, 0, 512, 96);
      g.fillStyle = '#fff'; g.font = '700 56px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('FOR LEASE', 256, 48);
      g.fillStyle = '#2a2a2a'; g.font = '600 38px Georgia, serif';
      g.fillText('RENTS UP 12%', 256, 180);
      g.font = 'italic 24px Georgia, serif';
      g.fillText('district turnover · apply within', 256, 226);
    } else if (state === 'sold') {
      // white background, large diagonal red SOLD stamp
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 512, 384);
      g.fillStyle = '#2a2a2a'; g.font = '600 38px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('NEW TENANT', 256, 100);
      g.font = 'italic 22px Georgia, serif';
      g.fillText('opening sept 15', 256, 138);
      // the stamp — a tilted red box with white text
      g.save();
      g.translate(256, 256);
      g.rotate(-Math.PI / 8);
      g.fillStyle = 'rgba(208,64,58,.88)'; g.fillRect(-180, -52, 360, 104);
      g.strokeStyle = 'rgba(208,64,58,1)'; g.lineWidth = 4; g.strokeRect(-180, -52, 360, 104);
      g.fillStyle = '#fff'; g.font = '700 96px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SOLD', 0, 4);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  return { draw, canvas: c };
}

// State ladder for the rent sign. Exposed for tests.
export function stateForDay(d) {
  if (d <= 2) return 'let';
  if (d <= 4) return 'lease';
  return 'sold';
}
