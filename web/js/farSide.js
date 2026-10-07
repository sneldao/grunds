// Far-side massing. Glasshouse, the park, and the Row stay the opposite
// street. The day-5 scaffolds were written against three facade blocks
// that never got a mesh; these are those blocks. The Row fronts are vacant
// shells from the first morning — a claimed lot hides its own shell.
import { FRANCHISE, LAYOUT } from './config.js';

// Where world.js plants the day-5 scaffolds, on the café side of each block.
export const SCAFFOLD_AT = {
  right: { x: 11, z: 16.4 },
  left: { x: -10, z: 15.9 },
  backRight: { x: 17, z: 18 },
};

// Comment sizes: right (11, 19.5, 8×11×6), left (-10, 19, 7×9×6),
// back-right (17, 20.5, 6×8×5). The back-right centre is 1.15m east of
// x=17 so its volume sits beside the right block (x 7–15) instead of
// inside it. The scaffold at x=17 is still on this face, and the near
// face stays at z = 20.5 − 2.5 = 18.
export const BACKDROP_FACADES = [
  { id: 'right', x: 11, z: 19.5, w: 8, h: 11, d: 6 },
  { id: 'left', x: -10, z: 19, w: 7, h: 9, d: 6 },
  { id: 'backRight', x: 18.15, z: 20.5, w: 6, h: 8, d: 5 },
];

export function blockAabb(b) {
  return {
    id: b.id,
    x0: b.x - b.w / 2,
    x1: b.x + b.w / 2,
    z0: b.z - b.d / 2,
    z1: b.z + b.d / 2,
    h: b.h,
  };
}

export function aabbOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

// Shallow vacant units on the far pavement (the strip centred at z=15.2).
// Clear of Row visitors (lot.z − 1.2) and of the scaffold posts.
export function vacantRowFronts(lots = FRANCHISE.lots) {
  return lots.map((lot) => ({
    id: String(lot.id),
    name: lot.name,
    x: lot.position[0],
    z: lot.position[2] - 0.7,
    w: 2.35,
    h: 2.85,
    d: 0.7,
    unlockDay: lot.unlockDay,
  }));
}

export function glasshouseAabb() {
  // world.js rival shell: 4.6 wide, 2.1 deep, centred on LAYOUT.rival.
  const { x, z } = LAYOUT.rival;
  return { id: 'glasshouse', x0: x - 2.3, x1: x + 2.3, z0: z - 1.05, z1: z + 1.05, h: 2.5 };
}
