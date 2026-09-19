// kitArrival.js — "the block got its kit": the arrival celebration that
// plays when the Generative District finishes growing DURING play (main.js
// owns that policy via district.grown / onGrown). A cart rolls in and takes
// its mark, the street's lights strike one by one like gas lamps on a hand,
// then the toast + fanfare land it.
//
// No tween library in this codebase: everything here is per-frame lerps and
// time math, and the light pulses run as a director layer — strictly AFTER
// world.updateTimeOfDay rewrites the absolute intensities each frame.

export function buildKitBeat({ world, audio, fx, director, reducedMotion = false, headless = false }) {
  let active = false;
  let t0 = 0, seed = 0;
  let cart = null, cartFinal = null;   // {x, y}
  let lit = false;                     // toast/fanfare landed
  let count = 5;

  function land() {
    if (lit) return;
    lit = true;
    try {
      fx.toast('the block got its kit — grown from seed ' + seed, 'good');
      audio.waveFanfare(reducedMotion ? 2 : 6);
    } catch {}
  }

  // light-strike layer: slot i flashes from i*0.6s, decaying over 1.2s
  function glowLayer(ctx) {
    const e = (ctx.now - t0) / 1000 - 0.8;   // the striking starts as the cart settles
    if (e < 0) return;
    const W = world;
    for (let i = 0; i < count; i++) {
      const d = e - i * 0.6;
      if (d < 0 || d > 1.2) continue;
      const pulse = (1 - d / 1.2) * (0.55 + 0.45 * Math.sin(d * 22));
      for (const p of W.lights.pendants) p.intensity += pulse * 3;
      for (const bm of W.bulbMats) bm.emissiveIntensity += pulse;
      for (const lm of W.lampMats) lm.emissiveIntensity += pulse;
      for (const sm of W.lampGlows) sm.opacity = Math.min(1, sm.opacity + pulse * 0.25);
    }
  }

  return {
    get isActive() { return active; },
    start(grownSlots, atSeed) {
      if (headless || active) return;
      seed = atSeed;
      const slots = grownSlots || [];
      count = Math.max(3, slots.length);
      const cartSlot = slots.find((s) => s.slot === 'cart');
      if (reducedMotion) {
        land();                       // the moment, without the motion
        return;
      }
      if (cartSlot?.inst) {
        cart = cartSlot.inst;
        cartFinal = { x: cart.position.x, y: cart.position.y };
        cart.position.x += 14;        // it comes DOWN the street, it doesn't appear
      }
      t0 = performance.now();
      lit = false;
      active = true;
      director.add('kitGlow', glowLayer);
    },
    update(dt, now) {
      if (!active) return;
      const e = (now - t0) / 1000;
      if (cart && cartFinal) {
        cart.position.x += (cartFinal.x - cart.position.x) * Math.min(1, dt * 3);
        const near = Math.abs(cart.position.x - cartFinal.x);
        cart.position.y = cartFinal.y + (near > 0.08 ? Math.abs(Math.sin(now * 0.02)) * 0.02 : 0);
        if (near <= 0.08 && !lit) land();
      } else if (!lit && e > 1.2) {
        land();
      }
      if (e > 0.8 + count * 0.6 + 1.4) {   // last flash has decayed
        director.remove('kitGlow');
        if (cart && cartFinal) { cart.position.x = cartFinal.x; cart.position.y = cartFinal.y; }
        active = false;
      }
    },
  };
}
