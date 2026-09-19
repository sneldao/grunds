// director.js — per-frame layered modulation for the world's light/sound.
// world.updateTimeOfDay / sky.update / audio.update write ABSOLUTE values
// every frame, so anything that wants to colour those values (vitality glow,
// a celebration pulse) must run strictly after them as a read-modify-write
// layer. Layers are idempotent per frame: re-running a frame never accumulates.
//
// layer.apply(ctx) with ctx = { dt, now, dayMin, night, vitality }.
// add(id, fn) replaces by id, keeps insertion order. A throwing layer can
// never take the frame down with it.

export function buildDirector() {
  const layers = [];
  return {
    add(id, apply) {
      const existing = layers.find((l) => l.id === id);
      if (existing) existing.apply = apply;
      else layers.push({ id, apply });
    },
    remove(id) {
      const i = layers.findIndex((l) => l.id === id);
      if (i >= 0) layers.splice(i, 1);
    },
    has(id) {
      return layers.some((l) => l.id === id);
    },
    update(ctx) {
      for (const l of layers) {
        try { l.apply(ctx); } catch { /* a layer never breaks the frame */ }
      }
    },
    get size() { return layers.length; },
  };
}
