// Who sits in the chairs that are already on the floor.
//
// The count follows patrons actually inside the café. Nobody inside means
// no one is seated — a quiet room stays an empty room. A busy room seats
// a few of them so the floor reads as occupied from the play camera.
// Real post-serve sits keep their own chairs and count toward the cap.

export const FLOOR_SEAT_CAP = 5;

const INSIDE = new Set(['inQueue', 'browse', 'inRegisterQ', 'sit', 'toSeat']);

export function isInsidePatron(p, bounds = {}) {
  if (!p || !p.active || !INSIDE.has(p.state)) return false;
  const doorZ = bounds.doorZ ?? 6;
  const minZ = bounds.minZ ?? -8.2;
  const minX = bounds.minX ?? -12.2;
  const maxX = bounds.maxX ?? 12.2;
  const x = p.pos && p.pos.x;
  const z = p.pos && p.pos.z;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (z >= doorZ - 0.15) return false;
  if (z < minZ || x < minX || x > maxX) return false;
  return true;
}

// Extra chairs to fill, on top of patrons already in a sit state.
// Real sitters consume the cap. A room with nobody else to seat returns 0.
export function floorSeatBudget(inside, cap = FLOOR_SEAT_CAP) {
  if (!Array.isArray(inside) || inside.length === 0) return 0;
  let sitters = 0;
  let others = 0;
  for (const p of inside) {
    if (!p) continue;
    if (p.state === 'sit' || p.state === 'toSeat') sitters++;
    else others++;
  }
  if (others <= 0) return 0;
  const limit = Number.isFinite(cap) ? cap : FLOOR_SEAT_CAP;
  return Math.max(0, Math.min(limit - sitters, others));
}

// Stable visual seating. `prev` patrons keep their chair while they are
// still inside and the budget still has room. New chairs go to people at
// the back of a long line so the head of the queue stays at the bar.
export function planVisualSitters(prev, inside, budget) {
  const n = Math.max(0, budget | 0);
  if (!n || !Array.isArray(inside)) return [];
  const pool = inside.filter(p => p && p.state !== 'sit' && p.state !== 'toSeat');
  const poolSet = new Set(pool);
  const kept = [];
  for (const p of prev || []) if (poolSet.has(p)) kept.push(p);
  const chosen = kept.slice(0, n);
  if (chosen.length >= n) return chosen;
  const have = new Set(chosen);
  const lineHeads = pool.filter(p => p.state === 'inQueue').length >= 6;
  const rest = pool.filter(p => !have.has(p));
  rest.sort((a, b) => {
    const aHead = lineHeads && a.state === 'inQueue' && (a.slotI ?? 99) < 3 ? 1 : 0;
    const bHead = lineHeads && b.state === 'inQueue' && (b.slotI ?? 99) < 3 ? 1 : 0;
    if (aHead !== bHead) return aHead - bHead;
    return ((b.slotI ?? -1) - (a.slotI ?? -1)) || ((a.idx ?? 0) - (b.idx ?? 0));
  });
  for (const p of rest) {
    if (chosen.length >= n) break;
    chosen.push(p);
  }
  return chosen;
}

// One chair per table before a second chair at the same table.
export function spreadSeats(seats, n) {
  const want = Math.max(0, n | 0);
  if (!want || !Array.isArray(seats) || !seats.length) return [];
  const groups = [];
  const seen = new Map();
  for (const s of seats) {
    if (!s) continue;
    const key = s.table || s;
    let g = seen.get(key);
    if (!g) { g = []; seen.set(key, g); groups.push(g); }
    g.push(s);
  }
  const out = [];
  let guard = 0;
  while (out.length < want && guard++ < seats.length + 2) {
    let progressed = false;
    for (const g of groups) {
      if (!g.length) continue;
      out.push(g.shift());
      progressed = true;
      if (out.length >= want) break;
    }
    if (!progressed) break;
  }
  return out;
}
