// Presentation-only randomness: audio noise and jitter, canvas grain, camera
// shake, ambient particle layouts. These draws never feed served / balked /
// till / defections, so they stay on true platform entropy rather than a
// per-run seed. The platform RNG is bound once at import: sim code must not
// call Math.random at all (the V0 replay test makes it throw mid-day), and
// this is the one sanctioned door for draws that are visual or audible only.
const platformRandom = Math.random;
export const cosmeticRandom = () => platformRandom();
