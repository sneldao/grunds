// vitality.js — the audiovisual skin of the street's numbers.
// awareness (demand.js, 0..1) and reputation (regulars.js, 0..100) already
// move the SIMULATION mechanically via demand.spawnMul() and
// regulars.footfallMul. Vitality never re-injects itself into cadence or
// demand — that would double-count. It only answers: what does THIS block
// look and sound like at this level of life? Lanterns dim, windows thin,
// stars come out, the pad goes quiet as the street forgets you.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function buildVitality({ demand, regulars, weight = 0.65 }) {
  let target = 0.5;
  let current = 0.5;
  return {
    recompute() {
      const a = clamp01(demand.awareness);
      const r = clamp01((regulars.reputation ?? 50) / 100);
      target = clamp01(weight * a + (1 - weight) * r);
    },
    // per-frame glide (postfx.js exponential-lerp idiom): the block never
    // flickers between states, it settles.
    tick() {
      current += (target - current) * 0.02;
    },
    get target() { return target; },
    get current() { return current; },
    set(v) { target = clamp01(v); current = target; },   // tests / QA override
  };
}
