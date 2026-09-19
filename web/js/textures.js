// Procedural canvas textures — the demo never touches the network.
// All bakes run once at startup; canvases are 512–1024 and tiled via
// RepeatWrapping. Every texture reads authored at 1× before any filter.
import * as THREE from '../vendor/three.module.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

// ——— AAA wood — honey oak, knots, bevel, grain ribbons ———————————————
export function woodFloor() {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#5a3d24'; g.fillRect(0, 0, 1024, 1024);
  const rows = 8, rowH = 128;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH, off = (r % 2) * 256;
    for (let x = -1; x < 6; x++) {
      const w = 340 + ((x * 37 + r * 91) % 90);
      const base = 96 + ((x * 53 + r * 29) % 28);
      const px = x * 340 + off;
      // plank body with vertical gradient (face vs edge)
      const grad = g.createLinearGradient(px, y, px, y + rowH);
      grad.addColorStop(0, `rgb(${base + 22},${base + 6},${base - 28})`);
      grad.addColorStop(0.5, `rgb(${base + 14},${base - 2},${base - 36})`);
      grad.addColorStop(1, `rgb(${base + 4},${base - 10},${base - 42})`);
      g.fillStyle = grad; g.fillRect(px + 3, y + 3, w - 6, rowH - 6);
      // edge bevel — highlight top, shadow bottom
      g.fillStyle = 'rgba(255,235,200,.09)'; g.fillRect(px + 3, y + 3, w - 6, 3);
      g.fillStyle = 'rgba(18,10,6,.22)'; g.fillRect(px + 3, y + rowH - 6, w - 6, 4);
      g.strokeStyle = 'rgba(30,16,8,.55)'; g.lineWidth = 2.5; g.strokeRect(px + 3, y + 3, w - 6, rowH - 6);
      // grain ribbons — 5 per plank, varying amplitude
      g.strokeStyle = 'rgba(42,22,10,.26)'; g.lineWidth = 1.2;
      for (let gl = 0; gl < 5; gl++) {
        const gy = y + 18 + gl * 20 + ((x * 13 + r * 7 + gl * 17) % 10);
        const amp = 2 + (gl % 2) * 2;
        g.beginPath();
        g.moveTo(px + 10, gy);
        g.bezierCurveTo(px + 90, gy + amp, px + 210, gy - amp, px + w - 14, gy + (gl % 3 - 1));
        g.stroke();
      }
      // tighter grain
      g.strokeStyle = 'rgba(60,38,20,.18)'; g.lineWidth = 0.9;
      for (let gl = 0; gl < 3; gl++) {
        const gy = y + 28 + gl * 34 + ((x * 19 + r * 11) % 7);
        g.beginPath(); g.moveTo(px + 22, gy); g.bezierCurveTo(px + 130, gy + 2, px + 220, gy - 2, px + w - 22, gy); g.stroke();
      }
      // occasional knot
      const knotChance = ((x * 997 + r * 431) % 100) / 100;
      if (knotChance < 0.18) {
        const kx = px + 80 + ((x * 67 + r * 23) % (w - 160));
        const ky = y + 38 + ((x * 41 + r * 59) % 52);
        const rx = 10 + ((x * 13 + r * 7) % 7), ry = 7 + ((x * 17) % 5);
        g.fillStyle = `rgba(${base - 18},${base - 28},${base - 42},.55)`;
        g.beginPath(); g.ellipse(kx, ky, rx, ry, ((x * 0.7) % 1) * Math.PI, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(20,10,6,.45)'; g.lineWidth = 1; g.stroke();
        // knot rings
        g.strokeStyle = 'rgba(30,16,8,.22)'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(kx, ky, rx * 0.55, ry * 0.6, 0, 0, Math.PI * 2); g.stroke();
      }
      // end-grain dark line on right edge of plank
      g.fillStyle = 'rgba(28,14,8,.18)'; g.fillRect(px + w - 9, y + 6, 3, rowH - 12);
    }
  }
  // overall varnish sheen — very subtle diagonal
  const sheen = g.createLinearGradient(0, 0, 1024, 1024);
  sheen.addColorStop(0, 'rgba(255,245,220,0)'); sheen.addColorStop(0.45, 'rgba(255,245,220,.06)');
  sheen.addColorStop(0.55, 'rgba(255,245,220,0)'); sheen.addColorStop(1, 'rgba(0,0,0,.04)');
  g.fillStyle = sheen; g.fillRect(0, 0, 1024, 1024);
  // micro dust
  g.fillStyle = 'rgba(0,0,0,.025)'; for (let i = 0; i < 2200; i++) g.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 1);
  return tex(c, [2.2, 1.6]);
}

export function pavement() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#7a756e'; g.fillRect(0, 0, 512, 512);
  // large slab grid — 64×128, with per-slab shade
  const cols = 8, rows = 4, cw = 64, rh = 128;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x = cx * cw, y = cy * rh;
    const v = ((cx * 37 + cy * 71) % 18) - 9;
    const r = 122 + v, gr = 118 + v, b = 112 + v;
    g.fillStyle = `rgb(${r},${gr},${b})`; g.fillRect(x + 1, y + 1, cw - 2, rh - 2);
    // grout chamfer
    g.strokeStyle = 'rgba(38,34,30,.55)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, cw - 2, rh - 2);
    g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(x + 1, y + 1, cw - 2, 2);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 1, y + rh - 3, cw - 2, 2);
    // aggregate specks per slab
    for (let i = 0; i < 22; i++) {
      const sx = x + 6 + Math.random() * (cw - 12), sy = y + 6 + Math.random() * (rh - 12);
      const vv = 20 + Math.random() * 40 | 0;
      g.fillStyle = `rgba(${vv},${vv - 2},${vv - 6},${0.10 + Math.random() * 0.16})`;
      g.fillRect(sx, sy, 2, 2);
    }
    // occasional hairline crack
    if (((cx * 13 + cy * 29) % 100) < 9) {
      g.strokeStyle = 'rgba(32,28,26,.22)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + 10 + Math.random() * 20, y + 14);
      g.bezierCurveTo(x + cw * 0.4, y + rh * 0.45, x + cw * 0.6, y + rh * 0.55, x + cw - 12, y + rh - 18); g.stroke();
    }
    // coffee-ring stain — rare
    if (((cx * 53 + cy * 17) % 100) < 5) {
      const sx = x + cw * 0.5, sy = y + rh * 0.5;
      g.fillStyle = 'rgba(58,38,22,.09)'; g.beginPath(); g.ellipse(sx, sy, 14, 9, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(58,38,22,.14)'; g.lineWidth = 1; g.stroke();
    }
  }
  // AO at slab intersections — tiny dark dots
  g.fillStyle = 'rgba(28,24,20,.18)';
  for (let cy = 1; cy < rows; cy++) for (let cx = 1; cx < cols; cx++) {
    g.beginPath(); g.arc(cx * cw, cy * rh, 2.2, 0, Math.PI * 2); g.fill();
  }
  // leaf decal — one or two
  g.fillStyle = 'rgba(86,72,42,.10)';
  g.beginPath(); g.ellipse(410, 118, 9, 5, 0.7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(422, 124, 7, 4, -0.4, 0, Math.PI * 2); g.fill();
  return tex(c, [8, 1.6]);
}

export function road() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 512, 512);
  // asphalt aggregate — two layers, coarse + fine
  for (let i = 0; i < 1800; i++) {
    const v = 38 + Math.random() * 26 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.34)`;
    const s = Math.random() < 0.15 ? 2.2 : 1.3; g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  for (let i = 0; i < 900; i++) {
    const v = 52 + Math.random() * 18 | 0; g.fillStyle = `rgba(${v},${v},${v + 2},.18)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  // oil stain
  g.fillStyle = 'rgba(18,16,18,.22)'; g.beginPath(); g.ellipse(184, 188, 44, 22, 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.ellipse(176, 182, 18, 8, 0.2, 0, Math.PI * 2); g.fill();
  // patch — slightly different asphalt
  g.fillStyle = 'rgba(42,44,48,.85)'; g.fillRect(320, 54, 96, 68);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; g.strokeRect(320, 54, 96, 68);
  for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(60,62,66,.35)'; g.fillRect(322 + Math.random() * 92, 56 + Math.random() * 64, 1.2, 1.2); }
  // manhole
  g.fillStyle = '#1e2024'; g.beginPath(); g.arc(402, 384, 22, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.06)'; for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
    const x = 402 + Math.cos(a) * 10, y = 384 + Math.sin(a) * 10;
    g.beginPath(); g.arc(x, y, 1.2, 0, Math.PI * 2); g.fill();
  }
  // dashed centre line — with wear gaps
  g.fillStyle = 'rgba(232,220,170,.82)';
  for (let x = 0; x < 512; x += 64) {
    const w = 36 + ((x / 64 | 0) % 2 ? -4 : 0); // every other dash slightly short — wear
    g.fillRect(x, 246, w, 7);
    // edge wear
    g.fillStyle = 'rgba(232,220,170,.22)'; g.fillRect(x + w, 246, 4, 7); g.fillStyle = 'rgba(232,220,170,.82)';
  }
  // curb lines — faint
  g.fillStyle = 'rgba(200,198,190,.14)'; g.fillRect(0, 16, 512, 2); g.fillRect(0, 494, 512, 2);
  // tyre tracks — very subtle
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 18;
  g.beginPath(); g.moveTo(0, 96); g.bezierCurveTo(180, 98, 340, 92, 512, 100); g.stroke();
  g.beginPath(); g.moveTo(0, 412); g.bezierCurveTo(160, 414, 320, 408, 512, 416); g.stroke();
  return tex(c, [6, 1]);
}

export function awning(stripeA = '#2f4f43', stripeB = '#e8dfc9') {
  const [c, g] = canvas(512, 256);
  const stripes = 16, sw = 32;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? stripeA : stripeB; g.fillRect(i * sw, 0, sw, 220); }
  // fabric weave — tiny dots
  g.fillStyle = 'rgba(0,0,0,.045)';
  for (let y = 0; y < 220; y += 4) for (let x = 0; x < 512; x += 4) if ((x + y) % 8 === 0) g.fillRect(x, y, 1, 1);
  g.fillStyle = 'rgba(255,255,255,.035)';
  for (let y = 1; y < 220; y += 4) for (let x = 1; x < 512; x += 4) if ((x + y) % 8 === 1) g.fillRect(x, y, 1, 1);
  // stitch lines
  g.strokeStyle = 'rgba(18,14,10,.22)'; g.lineWidth = 0.9; g.setLineDash([6, 6]);
  for (let i = 1; i < stripes; i++) { g.beginPath(); g.moveTo(i * sw, 0); g.lineTo(i * sw, 220); g.stroke(); }
  g.setLineDash([]);
  // scalloped bottom edge — 16 scallops, shadow + highlight
  g.fillStyle = stripeA; // placeholder, will clip
  // cut scallops as transparent — instead draw them as filled arcs with fabric colour
  // base already fills to 220; extend scallops to 256
  for (let i = 0; i < stripes; i++) {
    const cx = i * sw + sw / 2, col = i % 2 ? stripeA : stripeB;
    g.fillStyle = col;
    g.beginPath(); g.arc(cx, 220, sw / 2 + 0.5, 0, Math.PI, false); g.fill();
    // brass eyelet at valley
    if (i < stripes - 1) {
      const vx = (i + 1) * sw;
      g.fillStyle = '#c9a227'; g.beginPath(); g.arc(vx, 220, 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a5a12'; g.beginPath(); g.arc(vx, 220, 1.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(vx - 0.7, 219.2, 0.9, 0, Math.PI * 2); g.fill();
    }
  }
  // top AO and bottom shadow
  const topGrad = g.createLinearGradient(0, 0, 0, 26);
  topGrad.addColorStop(0, 'rgba(0,0,0,.22)'); topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = topGrad; g.fillRect(0, 0, 512, 26);
  const botGrad = g.createLinearGradient(0, 198, 0, 256);
  botGrad.addColorStop(0, 'rgba(0,0,0,0)'); botGrad.addColorStop(0.7, 'rgba(0,0,0,.18)'); botGrad.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = botGrad; g.fillRect(0, 198, 512, 58);
  // highlight ridge down centre of each stripe
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
  for (let i = 0; i < stripes; i++) {
    const cx = i * sw + sw / 2;
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 210); g.stroke();
  }
  return tex(c, [2.2, 1]);
}

// The chalkboard menu — redrawn in-world when the player reprices matcha.
export function menuBoard() {
  const [c, g] = canvas(1024, 768);
  function draw(matchaPrice, struck) {
    // slate with subtle paper grain
    g.fillStyle = '#1e2520'; g.fillRect(0, 0, 1024, 768);
    for (let i = 0; i < 2200; i++) {
      const a = Math.random() * 0.045; g.fillStyle = `rgba(${230 + Math.random() * 20 | 0},${232 + Math.random() * 16 | 0},${220 + Math.random() * 14 | 0},${a})`;
      g.fillRect(Math.random() * 1024, Math.random() * 768, 1.2, 1.2);
    }
    // outer brass frame
    g.strokeStyle = '#8a6f3f'; g.lineWidth = 18; g.strokeRect(10, 10, 1004, 748);
    g.strokeStyle = 'rgba(201,162,39,.35)'; g.lineWidth = 2; g.strokeRect(22, 22, 980, 724);
    // inner chalk dust specks
    g.strokeStyle = 'rgba(240,235,220,.13)'; g.lineWidth = 1;
    for (let i = 0; i < 420; i++) g.strokeRect(Math.random() * 1024, Math.random() * 768, 1, 1);
    // header with double rule
    g.textAlign = 'center'; g.fillStyle = '#efe6d3';
    g.font = '600 56px Georgia, serif'; g.fillText('— TODAY AT GRUNDS —', 512, 118);
    g.strokeStyle = 'rgba(201,162,39,.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(120, 138); g.lineTo(904, 138); g.stroke();
    g.beginPath(); g.moveTo(180, 142); g.lineTo(844, 142); g.stroke();
    g.font = '26px Georgia, serif'; g.textAlign = 'left';
    const rows = [['filter coffee', '3.20'], ['cappuccino', '3.80'], ['miso banana loaf', '2.90'], ['mochi donut', '2.40']];
    let y = 210;
    for (const [item, price] of rows) {
      // faint chalk underline per row
      g.strokeStyle = 'rgba(239,230,211,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(110, y + 10); g.lineTo(914, y + 10); g.stroke();
      g.fillStyle = '#efe6d3'; g.textAlign = 'left'; g.fillText(item, 118, y);
      g.textAlign = 'right'; g.fillText(price, 906, y); y += 88;
    }
    y += 8;
    // matcha — the star
    g.fillStyle = '#a8c48a'; g.font = 'italic 600 54px Georgia, serif'; g.textAlign = 'left';
    g.fillText('matcha latte', 118, y + 12);
    // little leaf glyph
    g.fillStyle = 'rgba(168,196,138,.55)'; g.font = '28px serif'; g.fillText('❧', 118 + g.measureText('matcha latte').width + 12, y + 8);
    g.textAlign = 'right';
    if (struck) {
      g.fillStyle = 'rgba(239,230,211,.42)'; g.font = 'italic 600 54px Georgia, serif'; g.fillText('4.80', 906, y + 12);
      g.strokeStyle = '#d0603b'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(770, y - 4); g.lineTo(920, y + 6); g.stroke();
      // chalk dust either side of strike
      g.fillStyle = 'rgba(208,96,59,.18)'; g.beginPath(); g.arc(764, y - 6, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a8c48a'; g.font = 'italic 600 58px Georgia, serif'; g.fillText(String(matchaPrice), 906, y + 86);
      g.font = 'italic 28px Georgia, serif'; g.fillStyle = 'rgba(168,196,138,.85)'; g.fillText('← today only', 680, y + 84);
      // price tag underline
      g.strokeStyle = 'rgba(168,196,138,.30)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(760, y + 96); g.lineTo(912, y + 96); g.stroke();
    } else {
      g.fillStyle = '#a8c48a'; g.font = 'italic 600 58px Georgia, serif'; g.fillText(String(matchaPrice), 906, y + 12);
    }
    // footer — tiny chalk
    g.fillStyle = 'rgba(239,230,211,.32)'; g.font = '16px ui-monospace, monospace'; g.textAlign = 'center';
    g.fillText('oat · soy · coconut  ·  +0.40', 512, 730);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
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

// Envelope sprite for the letter-arrival beat — cream paper, flap crease,
// wax dot. Small bake; it only ever shows at arm's length near the mailbox.
export function letterSprite() {
  const [c, g] = canvas(128, 96);
  g.fillStyle = '#efe4c8'; g.fillRect(6, 10, 116, 76);
  g.strokeStyle = 'rgba(90,70,40,.7)'; g.lineWidth = 3; g.strokeRect(6, 10, 116, 76);
  g.strokeStyle = 'rgba(90,70,40,.45)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(8, 12); g.lineTo(64, 52); g.lineTo(120, 12); g.stroke();   // flap
  g.beginPath(); g.moveTo(8, 84); g.lineTo(52, 48); g.moveTo(120, 84); g.lineTo(76, 48); g.stroke();
  g.fillStyle = '#8c2b26';                                                                             // wax seal
  g.beginPath(); g.arc(64, 54, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)';
  g.beginPath(); g.arc(61, 51, 3, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function shopSign(text, fg = '#efe6d3', bg = '#1d2a24', font = '600 44px Georgia, serif') {
  const [c, g] = canvas(1024, 192);
  // deep green with subtle linen weave
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
  for (let y = 0; y < 192; y += 3) { g.beginPath(); g.moveTo(0, y + (y % 6 === 0 ? 0.5 : 0)); g.lineTo(1024, y); g.stroke(); }
  for (let x = 0; x < 1024; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 192); g.stroke(); }
  // brass border — double rule with rivets
  g.strokeStyle = 'rgba(201,162,39,.88)'; g.lineWidth = 5; g.strokeRect(7, 7, 1010, 178);
  g.strokeStyle = 'rgba(201,162,39,.28)'; g.lineWidth = 1.5; g.strokeRect(14, 14, 996, 164);
  for (const x of [22, 1002]) for (const y of [22, 170]) {
    g.fillStyle = '#c9a227'; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a5a12'; g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - 1, y - 1, 1.1, 0, Math.PI * 2); g.fill();
  }
  // text with subtle brass inlay shadow
  g.fillStyle = 'rgba(0,0,0,.35)'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512 + 2, 98 + 2);
  g.fillStyle = fg; g.fillText(text, 512, 98);
  // hairline highlight top edge
  g.fillStyle = 'rgba(255,245,220,.14)'; g.fillRect(12, 12, 1000, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// The rent-pressure sign — the gentrification drift made physical.
export function rentSign() {
  const [c, g] = canvas(1024, 768);
  function draw(state) {
    g.clearRect(0, 0, 1024, 768);
    if (state === 'let') {
      g.fillStyle = '#efe6d3'; g.fillRect(0, 0, 1024, 768);
      // linen paper
      g.fillStyle = 'rgba(0,0,0,.035)'; for (let i = 0; i < 1800; i++) g.fillRect(Math.random() * 1024, Math.random() * 768, 1, 1);
      g.strokeStyle = 'rgba(74,52,35,.55)'; g.lineWidth = 7; g.strokeRect(14, 14, 996, 740);
      g.strokeStyle = 'rgba(74,52,35,.18)'; g.lineWidth = 1.5; g.strokeRect(22, 22, 980, 724);
      g.fillStyle = 'rgba(201,162,39,.62)';
      for (const [x, y] of [[30, 30], [994, 30], [30, 738], [994, 738]]) {
        g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(201,162,39,.62)';
      }
      g.fillStyle = '#4a3423'; g.font = 'italic 600 128px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TO LET', 512, 338);
      g.fillStyle = 'rgba(74,52,35,.55)'; g.font = '32px Georgia, serif'; g.fillText('enquiries next door', 512, 452);
      g.fillStyle = 'rgba(74,52,35,.32)'; g.font = '18px ui-monospace, monospace'; g.fillText('—  Grund\'s  ·  The District  —', 512, 492);
    } else if (state === 'lease') {
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 1024, 768);
      g.fillStyle = 'rgba(0,0,0,.025)'; for (let i = 0; i < 1600; i++) g.fillRect(Math.random() * 1024, Math.random() * 768, 1, 1);
      g.fillStyle = '#d0403a'; g.fillRect(0, 0, 1024, 192);
      // banner sheen
      const sheen = g.createLinearGradient(0, 0, 0, 192);
      sheen.addColorStop(0, 'rgba(255,255,255,.14)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,.12)');
      g.fillStyle = sheen; g.fillRect(0, 0, 1024, 192);
      g.fillStyle = '#fff'; g.font = '700 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('FOR LEASE', 512, 96);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '18px ui-monospace, monospace'; g.fillText('—  district turnover  —', 512, 132);
      g.fillStyle = '#1e1a16'; g.font = '700 56px Georgia, serif'; g.fillText('RENTS UP 12%', 512, 358);
      g.fillStyle = 'rgba(30,26,22,.55)'; g.font = 'italic 30px Georgia, serif'; g.fillText('district turnover · apply within', 512, 452);
      // hairline rule
      g.strokeStyle = 'rgba(30,26,22,.14)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(280, 400); g.lineTo(744, 400); g.stroke();
    } else if (state === 'sold') {
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 1024, 768);
      g.fillStyle = 'rgba(0,0,0,.025)'; for (let i = 0; i < 1600; i++) g.fillRect(Math.random() * 1024, Math.random() * 768, 1, 1);
      g.fillStyle = '#1e1a16'; g.font = '600 52px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('NEW TENANT', 512, 198);
      g.fillStyle = 'rgba(30,26,22,.55)'; g.font = 'italic 28px Georgia, serif'; g.fillText('opening sept 15', 512, 252);
      g.save(); g.translate(512, 512); g.rotate(-Math.PI / 8);
      // stamp shadow
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-356, -100, 712, 208);
      g.fillStyle = 'rgba(208,64,58,.92)'; g.fillRect(-360, -104, 720, 208);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(-346, -90, 692, 180);
      g.strokeStyle = 'rgba(208,64,58,1)'; g.lineWidth = 5; g.strokeRect(-360, -104, 720, 208);
      g.fillStyle = '#fff'; g.font = '700 148px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SOLD', 0, 8);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '16px ui-monospace, monospace'; g.fillText('—  DISTRICT  —', 0, 62);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  return { draw, canvas: c };
}

export function stateForDay(d) {
  if (d <= 2) return 'let';
  if (d <= 4) return 'lease';
  return 'sold';
}

export function tarp() {
  const [c, g] = canvas(1024, 1024);
  function draw() {
    g.clearRect(0, 0, 1024, 1024);
    g.fillStyle = '#f4ead4'; g.fillRect(0, 0, 1024, 1024);
    // canvas weave — crosshatch 2px
    g.strokeStyle = 'rgba(0,0,0,.035)'; g.lineWidth = 1;
    for (let y = 0; y < 1024; y += 3) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(1024, y + 0.5); g.stroke(); }
    for (let x = 0; x < 1024; x += 3) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 1024); g.stroke(); }
    // hazard stripes top/bottom — with stitch
    g.save();
    for (const yBand of [[0, 128], [896, 1024]]) {
      g.beginPath(); g.rect(0, yBand[0], 1024, yBand[1] - yBand[0]); g.clip();
      g.translate(0, yBand[0]);
      for (let x = -128; x < 1024 + 128; x += 64) {
        g.fillStyle = (x / 64) % 2 < 1 ? '#d0403a' : '#f4ead4';
        g.save(); g.translate(x, 0); g.rotate(-Math.PI / 4); g.fillRect(0, -32, 64, 192); g.restore();
      }
      // stitch over hazard
      g.strokeStyle = 'rgba(30,16,10,.18)'; g.lineWidth = 1; g.setLineDash([10, 8]);
      g.beginPath(); g.moveTo(0, 64); g.lineTo(1024, 64); g.stroke();
      g.setLineDash([]);
      g.translate(0, -yBand[0]);
    }
    g.restore();
    // grommets every 128px along top/bottom hazard edge
    g.fillStyle = '#9a9ea6';
    for (const y of [64, 960]) for (let x = 64; x < 1024; x += 128) {
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1e24'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9a9ea6';
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(x - 1.2, y - 1.2, 1.4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9a9ea6';
    }
    // main copy with drop + emboss
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 96px Arial, sans-serif';
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillText('UNDER', 512 + 4, 392 + 4);
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillText('CONSTRUCTION', 512 + 4, 536 + 4);
    g.fillStyle = '#1d2a24'; g.fillText('UNDER', 512, 392);
    g.fillStyle = '#1d2a24'; g.fillText('CONSTRUCTION', 512, 536);
    // highlight top edge of letters
    g.fillStyle = 'rgba(255,255,255,.14)'; g.font = '900 96px Arial, sans-serif';
    g.fillText('UNDER', 512, 390); g.fillText('CONSTRUCTION', 512, 534);
    g.font = '700 44px Arial, sans-serif';
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillText('·  SEPT 15  ·', 512 + 2, 700 + 2);
    g.fillStyle = '#1d2a24'; g.fillText('·  SEPT 15  ·', 512, 700);
    // edge AO
    const edge = g.createLinearGradient(0, 0, 0, 1024);
    edge.addColorStop(0, 'rgba(0,0,0,.14)'); edge.addColorStop(0.06, 'rgba(0,0,0,0)');
    edge.addColorStop(0.94, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.14)');
    g.fillStyle = edge; g.fillRect(0, 0, 1024, 1024);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  return { draw, canvas: c };
}

export function dayHasConstruction(d) { return d >= 5; }
