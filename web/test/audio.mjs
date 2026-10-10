import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AudioEngine } from '../js/audio.js';

function param(v = 0) {
  return {
    value: v, calls: [],
    setValueAtTime(x, t) { this.calls.push(['setValueAtTime', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.calls.push(['linearRampToValueAtTime', x, t]); },
    exponentialRampToValueAtTime(x, t) { this.calls.push(['exponentialRampToValueAtTime', x, t]); },
    setTargetAtTime(x, t, c) { this.calls.push(['setTargetAtTime', x, t, c]); this.value = x; },
  };
}
function node() {
  return { connections: [], disconnects: 0, connect(n) { this.connections.push(n); }, disconnect() { this.disconnects++; } };
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100;
    this.destination = { name: 'destination' };
    this.sources = []; this.oscillators = []; this.resumes = 0;
    this.decoded = [];
  }
  resume() { this.resumes++; this.state = 'running'; }
  createGain() { const n = node(); n.gain = param(0); return n; }
  createOscillator() { const n = node(); n.type = ''; n.frequency = param(0); n.detune = param(0);
    n.starts = 0; n.stops = 0; n.start = () => n.starts++; n.stop = () => n.stops++;
    this.oscillators.push(n); return n; }
  createBiquadFilter() { const n = node(); n.type = ''; n.frequency = param(0); n.Q = param(0); return n; }
  createDynamicsCompressor() { const n = node();
    n.threshold = param(0); n.knee = param(0); n.ratio = param(0); n.attack = param(0); n.release = param(0); return n; }
  createBufferSource() { const n = node(); n.buffer = null; n.loop = false;
    n.playbackRate = param(1); n.starts = []; n.stops = []; n.onended = null;
    n.start = (...a) => n.starts.push(a); n.stop = (...a) => n.stops.push(a);
    this.sources.push(n); return n; }
  createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
  decodeAudioData(buf) {
    if (String(buf).startsWith('decode-fail:')) return Promise.reject(new Error('decode failed'));
    this.decoded.push(buf);
    return Promise.resolve({ duration: 1, tag: buf });
  }
}
function recordingFetch(overrides = {}) {
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    const name = String(url).match(/audio\/(\w+)\.mp3/)?.[1] || 'unknown';
    const o = overrides[name];
    if (o?.reject) throw new Error('network down');
    if (o?.status) return { ok: false, status: o.status };
    if (o?.decodeError) return { ok: true, status: 200, arrayBuffer: async () => `decode-fail:${name}` };
    return { ok: true, status: 200, arrayBuffer: async () => `bytes:${name}` };
  };
  return { fetch, calls };
}
function engineWith(fetch) {
  globalThis.window = { AudioContext: FakeAudioContext };
  return new AudioEngine({ fetch });
}

test('start without sample support behaves exactly as before', async () => {
  class NoDecode extends FakeAudioContext { }
  NoDecode.prototype.decodeAudioData = undefined;
  globalThis.window = { AudioContext: NoDecode };
  const { fetch, calls } = recordingFetch();
  const a = new AudioEngine({ fetch });
  a.start();
  assert.equal(calls.length, 0);
  assert.ok(a.master && a.padGain && a.murmurGain && a.hissGain);
  a.ctx.currentTime = 1;
  const oscBefore = a.ctx.oscillators.length;
  a.clink();
  assert.equal(a.ctx.oscillators.length, oscBefore + 1);
});

test('null fetch disables samples entirely', async () => {
  const a = engineWith(null);
  assert.equal(a._fetch, null);
  a.start();
  await a._samplesReady;
  assert.deepEqual(a.buffers, {});
  a.ctx.currentTime = 1;
  const oscBefore = a.ctx.oscillators.length;
  a.clink();
  assert.equal(a.ctx.oscillators.length, oscBefore + 1);
  const srcBefore = a.ctx.sources.length;
  a.grinder();
  const src = a.ctx.sources.at(-1);
  assert.equal(a.ctx.sources.length, srcBefore + 1);
  assert.equal(src.buffer, a.noiseBuf);
  assert.equal(src.connections[0].type, 'bandpass');
  assert.ok(src.stops.length === 1);
});

test('repeated start resumes, fetches each asset once, never re-loops espresso', async () => {
  const { fetch, calls } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.start(); a.start();
  assert.equal(a.ctx.resumes, 2);
  assert.equal(calls.length, 4);
  for (const n of ['espresso', 'grinder', 'cup', 'street']) {
    assert.equal(calls.filter(u => String(u).includes(`/audio/${n}.mp3`)).length, 1);
    assert.ok(a.buffers[n]);
  }
  assert.equal(a.ctx.sources.filter(s => s.buffer === a.buffers.espresso).length, 1);
  assert.equal(a.ctx.sources.filter(s => s.buffer === a.buffers.street).length, 1);
});

test('asset URLs resolve from the module path, including a site subpath', async () => {
  assert.equal(
    new URL('../assets/audio/cup.mp3', 'http://h/site/js/audio.js').href,
    'http://h/site/assets/audio/cup.mp3');
  const { fetch, calls } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.ok(calls.every(u => String(u).includes('/assets/audio/')));
  assert.ok(String(calls[0]).startsWith('file://'));
});

test('decoded cup plays the recording through master and disconnects on end', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  const srcBefore = a.ctx.sources.length;
  const oscBefore = a.ctx.oscillators.length;
  a.clink();
  const src = a.ctx.sources.at(-1);
  assert.equal(a.ctx.sources.length, srcBefore + 1);
  assert.equal(src.buffer, a.buffers.cup);
  assert.equal(a.ctx.oscillators.length, oscBefore);
  const g = src.connections[0];
  assert.ok(g.gain.value <= 0.06);
  assert.ok(g.connections.includes(a.master));
  src.onended();
  assert.ok(src.disconnects >= 1 && g.disconnects >= 1);
});

test('recorded clink caps at 2 overlapping and throttles at 0.35s', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.ctx.currentTime = 1;
  let n = 0;
  for (let i = 0; i < 5; i++) { const c = a.ctx.sources.length; a.clink(); if (a.ctx.sources.length > c) n++; a.ctx.currentTime += 0.4; }
  assert.equal(n, 2);
  a.ctx.sources.at(-1).onended(); a.ctx.sources.at(-2).onended();
  a.ctx.currentTime = 1.55;
  const c = a.ctx.sources.length; a.clink();
  assert.equal(a.ctx.sources.length, c);
  a.ctx.currentTime += 0.3;
  a.clink();
  assert.equal(a.ctx.sources.length, c + 1);
});

test('fetch reject, non-ok, decode error each fall back independently', async () => {
  const { fetch } = recordingFetch({
    espresso: { reject: true }, grinder: { status: 404 }, cup: { decodeError: true }, street: { status: 404 },
  });
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.deepEqual(a.buffers, {});
  a.ctx.currentTime = 1;
  const oscBefore = a.ctx.oscillators.length;
  a.clink();
  assert.equal(a.ctx.oscillators.length, oscBefore + 1);
});

test('one failed asset does not block the others', async () => {
  const { fetch } = recordingFetch({ grinder: { status: 500 } });
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.ok(a.buffers.espresso && a.buffers.cup && a.buffers.street);
  assert.equal(a.buffers.grinder, undefined);
});

test('pending load: clink is procedural until the cup lands', async () => {
  const pending = [];
  const fetch = url => new Promise(res => pending.push(() => {
    const name = String(url).match(/audio\/(\w+)\.mp3/)[1];
    res({ ok: true, status: 200, arrayBuffer: async () => `bytes:${name}` });
  }));
  const a = engineWith(fetch);
  a.start();
  a.ctx.currentTime = 1;
  const oscBefore = a.ctx.oscillators.length;
  a.clink();
  assert.equal(a.ctx.oscillators.length, oscBefore + 1);
  assert.deepEqual(a.buffers, {});
  for (const resolve of pending.splice(0)) resolve();
  await a._samplesReady;
  a.ctx.currentTime += 1;
  a.clink();
  assert.equal(a.ctx.sources.at(-1).buffer, a.buffers.cup);
  assert.equal(a.ctx.oscillators.length, oscBefore + 1);
});

test('suspended context: update makes no gain changes', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.ctx.state = 'suspended';
  const nodes = [a.murmurGain, a.hissGain, a.padGain, a.espGain, a.streetGain, a.streetFBGain].filter(Boolean);
  const before = nodes.map(g => g.gain.calls.length);
  a.setRush(true);
  a.update(0.016);
  const after = nodes.map(g => g.gain.calls.length);
  assert.deepEqual(after, before);
});

test('rush fades recorded espresso up and hiss down; clears on rush false', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.ok(a.espGain);
  const espSrc = a.ctx.sources.find(s => s.buffer === a.buffers.espresso);
  assert.equal(espSrc.loop, true);
  assert.ok(a.espGain.connections.includes(a.master));
  a.setRush(true); a.update(0.016);
  assert.ok(a.espGain.gain.calls.some(c => c[0] === 'setTargetAtTime' && c[1] === 0.035));
  const hiss = a.hissGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.equal(hiss[1], 0);
  a.setRush(false); a.update(0.016);
  assert.equal(a.espGain.gain.calls.at(-1)[1], 0);
  a.setRush(true); a.update(0.016);
  assert.equal(a.ctx.sources.filter(s => s.buffer === a.buffers.espresso).length, 1);
});

test('hiss still serves rushes when espresso never decoded', async () => {
  const a = engineWith(null);
  a.start();
  await a._samplesReady;
  a.setRush(true); a.update(0.016);
  const hiss = a.hissGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.equal(hiss[1], 0.035);
});

test('mute pulls the master the samples route through', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.toggleMute();
  const m = a.master.gain.calls.at(-1);
  assert.equal(m[0], 'setTargetAtTime');
  assert.equal(m[1], 0);
  a.clink(); a.grinder();
  const cup = a.ctx.sources.at(-1);
  assert.ok(cup.connections[0].connections.includes(a.master));
});

test('grinder: no-op without ctx, once per 3s, max one active, disconnects', async () => {
  const silent = new AudioEngine({ fetch: null });
  silent.grinder();
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.ctx.currentTime = 10;
  a.grinder();
  const src = a.ctx.sources.at(-1);
  assert.equal(src.buffer, a.buffers.grinder);
  const g = src.connections[0];
  assert.ok(g.gain.value <= 0.045);
  const c = a.ctx.sources.length;
  a.grinder(); a.grinder();
  assert.equal(a.ctx.sources.length, c);
  src.onended();
  assert.ok(src.disconnects >= 1 && g.disconnects >= 1);
  a.ctx.currentTime += 3.1;
  a.grinder();
  assert.equal(a.ctx.sources.length, c + 1);
});

test('grinder fallback burst disconnects onended', async () => {
  const a = engineWith(null);
  a.start();
  await a._samplesReady;
  a.grinder();
  const src = a.ctx.sources.at(-1);
  const bp = src.connections[0];
  const g = bp.connections[0];
  src.onended();
  assert.ok(src.disconnects >= 1 && bp.disconnects >= 1 && g.disconnects >= 1);
});

test('street loop fades in only while active; fallback covers a missing sample', async () => {
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.ok(a.streetGain);
  const src = a.ctx.sources.find(s => s.buffer === a.buffers.street);
  assert.equal(src.loop, true);
  assert.ok(a.streetGain.connections.includes(a.master));
  a.setStreetActive(true); a.update(0.016);
  const s = a.streetGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.ok(Math.abs(s[1] - 0.022 * (0.55 + 0.45 * a.mood)) < 1e-9);
  assert.equal(s[3], 1.2);
  const fb = a.streetFBGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.equal(fb[1], 0);
  a.setStreetActive(false); a.update(0.016);
  assert.equal(a.streetGain.gain.calls.at(-1)[1], 0);
  a.setStreetActive(true); a.update(0.016);
  assert.equal(a.ctx.sources.filter(x => x.buffer === a.buffers.street).length, 1);
});

test('street fallback bed runs when the sample never decoded', async () => {
  const a = engineWith(null);
  a.start();
  await a._samplesReady;
  assert.equal(a.streetGain, undefined);
  a.setStreetActive(true); a.update(0.016);
  const fb = a.streetFBGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.ok(Math.abs(fb[1] - 0.006 * (0.55 + 0.45 * a.mood)) < 1e-9);
  a.setStreetActive(false); a.update(0.016);
  assert.equal(a.streetFBGain.gain.calls.at(-1)[1], 0);
});

test('street 404 alone still leaves the other samples ready', async () => {
  const { fetch } = recordingFetch({ street: { status: 404 } });
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  assert.equal(a.buffers.street, undefined);
  assert.ok(a.buffers.espresso && a.buffers.cup && a.buffers.grinder);
  assert.equal(a.streetGain, undefined);
  a.setStreetActive(true); a.update(0.016);
  const fb = a.streetFBGain.gain.calls.filter(c => c[0] === 'setTargetAtTime').at(-1);
  assert.ok(fb[1] > 0);
});

test('main gates street and rush on trading, unpaused, visible floor', () => {
  const src = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  assert.ok(src.includes('audio.setStreetActive(started && phase === \'trading\' && !closed && !paused && !document.hidden)'));
  assert.ok(src.includes('audio.setRush(started && phase === \'trading\' && !closed && !paused && !document.hidden && patrons.queueLength > 8)'));
});

test('a once-registered visibilitychange handler ducks street and rush when hidden', async () => {
  const src = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  assert.equal(src.split("'visibilitychange'").length - 1, 1, 'registered once');
  const m = src.match(/document\.addEventListener\?\.\('visibilitychange'[\s\S]*?\}\);/);
  assert.ok(m);
  assert.ok(m[0].includes('if (!document.hidden) return'));
  assert.ok(m[0].includes('audio.setStreetActive(false)'));
  assert.ok(m[0].includes('audio.setRush(false)'));
  assert.ok(m[0].includes('audio.update(0)'));
  const { fetch } = recordingFetch();
  const a = engineWith(fetch);
  a.start();
  await a._samplesReady;
  a.setStreetActive(true); a.setRush(true); a.update(0.016);
  a.setStreetActive(false); a.setRush(false); a.update(0);
  assert.equal(a.streetGain.gain.calls.at(-1)[1], 0);
  assert.equal(a.espGain.gain.calls.at(-1)[1], 0);
  a.update(0.016);
  assert.equal(a.streetGain.gain.calls.at(-1)[1], 0);
  const cold = engineWith(fetch);
  cold.setStreetActive(false); cold.setRush(false); cold.update(0);
  assert.equal(cold.ctx, null);
});

test('doPrebatch emits exactly one grinder after its guards', () => {
  const src = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
  const start = src.indexOf('function doPrebatch');
  const end = src.indexOf('\nfunction canSkipToRush');
  assert.ok(start >= 0 && end > start);
  const body = src.slice(start, end);
  const grIdx = body.indexOf('audio.grinder()');
  const availIdx = body.indexOf('!lv.available');
  const overrideIdx = body.indexOf('chargeLeverOverride');
  assert.ok(grIdx > -1);
  assert.ok(availIdx >= 0 && availIdx < grIdx);
  assert.ok(overrideIdx >= 0 && overrideIdx < grIdx);
  assert.equal(body.split('audio.grinder()').length - 1, 1);
  assert.equal(src.split('audio.grinder').length - 1, 1);
});

test('audio assets exist, are MP3, and fit the size budget', () => {
  const dir = new URL('../assets/audio/', import.meta.url);
  let base = 0, total = 0;
  for (const n of ['espresso', 'grinder', 'cup', 'street']) {
    const p = fileURLToPath(new URL(`${n}.mp3`, dir));
    const buf = readFileSync(p);
    assert.ok(buf.length > 500);
    const id3 = buf.subarray(0, 3).toString('latin1') === 'ID3';
    const sync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
    assert.ok(id3 || sync);
    const size = statSync(p).size;
    total += size;
    if (n !== 'street') base += size; else assert.ok(size < 110 * 1024, `street.mp3 ${size}`);
  }
  assert.ok(base < 150 * 1024, `original three: ${base}`);
  assert.ok(total < 250 * 1024, `all four: ${total}`);
});
