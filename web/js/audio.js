// Procedural WebAudio — café murmur, espresso hiss, till chime, lo-fi pad.
// Zero assets; the graph is built on the title-screen gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false;
    this.crowd = 0; this.rush = false;
    this._lastTill = 0; this._lastClink = 0; this._lastBalk = 0;
    this._chordI = 0; this._chordT = 0;
    this._hammerOn = false; this._hammerT = 0; this._hammerNext = 0.7;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    // Mix bus glue: a gentle compressor so the till + murmur + saw stack
    // never clips on a busy day-5, and quiet details stay audible.
    // Guarded — older WebAudio implementations skip straight to destination.
    if (ctx.createDynamicsCompressor) {
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18; this.comp.knee.value = 12;
      this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.24;
      this.master.connect(this.comp); this.comp.connect(ctx.destination);
    } else {
      this.master.connect(ctx.destination);
    }

    // --- lo-fi pad: three triangles gliding through a slow progression ---
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.0;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 820;
    this.padGain.connect(padFilter); padFilter.connect(this.master);
    this.padOsc = [0, 1, 2].map(i => {
      const o = ctx.createOscillator(); o.type = 'triangle';
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.3;
      o.detune.value = (i - 1) * 6;
      o.connect(g); g.connect(this.padGain); o.start(); return o;
    });
    this.chords = [
      [146.83, 220.0, 349.23],   // Dm9
      [116.54, 174.61, 293.66],  // Bb maj7
      [130.81, 196.0, 329.63],   // C add9
      [98.0, 164.81, 246.94],    // G m-ish
    ];
    this._applyChord(0, 0);
    this.padGain.gain.setTargetAtTime(0.055, ctx.currentTime, 4);

    // --- café murmur: brown noise bed + syllable blips scheduled in update ---
    const brown = this._noiseBuffer(true);
    this.murmurSrc = ctx.createBufferSource(); this.murmurSrc.buffer = brown; this.murmurSrc.loop = true;
    const murmurBP = ctx.createBiquadFilter(); murmurBP.type = 'bandpass'; murmurBP.frequency.value = 520; murmurBP.Q.value = 0.6;
    this.murmurGain = ctx.createGain(); this.murmurGain.gain.value = 0;
    this.murmurSrc.connect(murmurBP); murmurBP.connect(this.murmurGain); this.murmurGain.connect(this.master);
    this.murmurSrc.start();

    // --- espresso hiss for rushes ---
    const white = this._noiseBuffer(false);
    this.hissSrc = ctx.createBufferSource(); this.hissSrc.buffer = white; this.hissSrc.loop = true;
    const hissBP = ctx.createBiquadFilter(); hissBP.type = 'bandpass'; hissBP.frequency.value = 2700; hissBP.Q.value = 0.7;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    this.hissSrc.connect(hissBP); hissBP.connect(this.hissGain); this.hissGain.connect(this.master);
    this.hissSrc.start();
    this.noiseBuf = white;
  }

  _noiseBuffer(brown) {
    const ctx = this.ctx, len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  _applyChord(i, glide = 1.6) {
    const t = this.ctx.currentTime;
    this.chords[i].forEach((f, j) => this.padOsc[j].frequency.setTargetAtTime(f, t, glide));
  }

  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const target = Math.min(0.16, 0.011 * Math.sqrt(this.crowd));
    this.murmurGain.gain.setTargetAtTime(target, t, 0.6);
    this.hissGain.gain.setTargetAtTime(this.rush ? 0.035 : 0, t, 0.8);
    // muffled syllables when it's busy
    if (this.crowd > 6 && Math.random() < dt * this.crowd * 0.05) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 300 + Math.random() * 900; bp.Q.value = 2.5;
      const g = this.ctx.createGain(); const v = 0.012 + Math.random() * 0.02;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + Math.random() * 0.08);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 1.5, 0.25); src.stop(t + 0.3);
    }
    this._chordT += dt;
    if (this._chordT > 5.5) { this._chordT = 0; this._chordI = (this._chordI + 1) % this.chords.length; this._applyChord(this._chordI); }
    // day-5 hammer: jittered 0.6-0.9s rhythm; each tick plays a wooden
    // tock + a metal click. Idle when _hammerOn is false.
    if (this._hammerOn) {
      this._hammerT += dt;
      if (this._hammerT >= this._hammerNext) {
        this._hammerT = 0;
        this._hammerNext = 0.6 + Math.random() * 0.3;
        this._hammerTap();
      }
    }
  }

  _env(g, t, peak, decay) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }
  sale(n = 1) {  // the till — ka-ching, throttled
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this._lastTill < 0.09) return; this._lastTill = t;
    const v = Math.min(0.14, 0.06 + n * 0.012);
    for (const f of [1567.98, 2093.0]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); this._env(g, t, v, 0.5);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.55);
    }
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const g = this.ctx.createGain(); this._env(g, t, v * 0.7, 0.05);
    src.connect(hp); hp.connect(g); g.connect(this.master); src.start(t, 0.2, 0.06);
  }
  clink() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this._lastClink < 0.06) return; this._lastClink = t;
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 2400 + Math.random() * 500;
    const g = this.ctx.createGain(); this._env(g, t, 0.035, 0.09);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.12);
  }
  balk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this._lastBalk < 0.25) return; this._lastBalk = t;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 150;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = this.ctx.createGain(); this._env(g, t, 0.05, 0.14);
    o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.16);
  }
  card() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(65, t + 0.55);
    const g = this.ctx.createGain(); this._env(g, t, 0.09, 0.7);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.75);
  }
  closing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 659.25].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = this.ctx.createGain(); this._env(g, t + i * 0.35, 0.08, 0.9);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.35); o.stop(t + i * 0.35 + 1);
    });
  }
  setCrowd(n) { this.crowd = n; }
  setRush(b) { this.rush = b; }
  // Day-5 construction noise — a low, slightly detuned sawtooth through a
  // narrow bandpass, ramped in/out over ~1.5s. The result is a distant
  // "nrrrr" rather than a literal saw. The oscillator + filter are
  // created on first call to on=true and re-used; on=false ramps the
  // gain to zero but leaves the graph intact (cheap; no rebuild).
  constructionSaw(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on) {
      if (!this._saw) {
        const ctx = this.ctx;
        const sawGain = ctx.createGain(); sawGain.gain.value = 0;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 220; bp.Q.value = 1.4;
        const sawOsc = ctx.createOscillator(); sawOsc.type = 'sawtooth';
        sawOsc.frequency.value = 78;                       // low G-ish
        sawOsc.detune.value = -8;                          // slight detune for grit
        const oscGain = ctx.createGain(); oscGain.gain.value = 0.6;
        sawOsc.connect(oscGain); oscGain.connect(bp); bp.connect(sawGain);
        sawGain.connect(this.master);
        sawOsc.start();
        this._saw = { sawGain, bp, sawOsc };
      }
      this._saw.sawGain.gain.setTargetAtTime(0.04, t, 0.5);
    } else if (this._saw) {
      this._saw.sawGain.gain.setTargetAtTime(0, t, 0.5);
    }
  }
  // Day-5 hammering — rhythmic "tock" pulses (a wooden strike + a higher
  // metal click) every 0.6-0.9s, jittered so the rhythm feels like a
  // worker, not a metronome. The saw provides the drone; the hammer
  // provides the rhythm. update() drives the scheduler.
  constructionHammer(on) {
    this._hammerOn = !!on;
    if (!this._hammerOn) {
      this._hammerT = 0;
      this._hammerNext = 0.6 + Math.random() * 0.3;
    }
  }
  _hammerTap() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    // wooden tock: low bandpassed noise burst, ~80ms
    const src1 = this.ctx.createBufferSource(); src1.buffer = this.noiseBuf;
    src1.playbackRate.value = 0.6 + Math.random() * 0.3;
    const bp1 = this.ctx.createBiquadFilter(); bp1.type = 'bandpass';
    bp1.frequency.value = 80 + Math.random() * 40; bp1.Q.value = 2.5;
    const g1 = this.ctx.createGain();
    const v1 = 0.04 + Math.random() * 0.02;
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(v1, t + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src1.connect(bp1); bp1.connect(g1); g1.connect(this.master);
    src1.start(t); src1.stop(t + 0.12);
    // metal click: high bandpassed noise, ~30ms — the hammer-on-nail top
    const src2 = this.ctx.createBufferSource(); src2.buffer = this.noiseBuf;
    src2.playbackRate.value = 1.4 + Math.random() * 0.4;
    const bp2 = this.ctx.createBiquadFilter(); bp2.type = 'bandpass';
    bp2.frequency.value = 1800 + Math.random() * 400; bp2.Q.value = 4;
    const g2 = this.ctx.createGain();
    const v2 = 0.012 + Math.random() * 0.006;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(v2, t + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src2.connect(bp2); bp2.connect(g2); g2.connect(this.master);
    src2.start(t); src2.stop(t + 0.06);
  }
  toggleMute() {
    if (!this.ctx) return this.muted;   // pre-start: report, don't flip the label
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
    return this.muted;
  }
}

