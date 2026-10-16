/* =========================================================================
   audio.js — procedural Web Audio engine (no asset files)
   Provides SFX (click, ding, coin, error, levelup, chime, unlock) and a
   gentle lo-fi background music loop. Exposes window.CAFE.audio
   ========================================================================= */
(function (CAFE) {
  "use strict";

  let ctx = null;
  let master = null;       // master gain
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let volume = 0.7;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    return ctx;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // Generic tone
  function tone(freq, dur, type, when, gain, dest) {
    if (!ctx) return;
    const t0 = (when || ctx.currentTime);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(dest || sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // Noise burst (for steam / errors)
  function noise(dur, when, gain, lp) {
    if (!ctx) return;
    const t0 = when || ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain || 0.15;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1800;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const SFX = {
    click() { tone(420, 0.06, 'triangle', 0, 0.12); },
    tap() { tone(600, 0.04, 'square', 0, 0.08); },
    order() { tone(660, 0.07, 'sine'); tone(880, 0.09, 'sine', ctx ? ctx.currentTime + 0.07 : 0, 0.12); },
    brew() { noise(0.5, 0, 0.05, 2600); tone(180, 0.4, 'sawtooth', 0, 0.05); },
    ding() { tone(880, 0.12, 'sine'); tone(1320, 0.16, 'sine', ctx ? ctx.currentTime + 0.08 : 0, 0.12); },
    coin() { tone(988, 0.07, 'square', 0, 0.13); tone(1319, 0.1, 'square', ctx ? ctx.currentTime + 0.06 : 0, 0.12); },
    error() { tone(200, 0.18, 'sawtooth', 0, 0.16); tone(150, 0.22, 'sawtooth', ctx ? ctx.currentTime + 0.06 : 0, 0.14); },
    perfect() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', ctx ? ctx.currentTime + i * 0.06 : 0, 0.13)); },
    levelup() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', ctx ? ctx.currentTime + i * 0.09 : 0, 0.16)); },
    unlock() { [523, 784, 1047].forEach((f, i) => tone(f, 0.2, 'sine', ctx ? ctx.currentTime + i * 0.12 : 0, 0.14)); },
    bell() { tone(740, 0.4, 'sine', 0, 0.1); tone(740, 0.4, 'sine', ctx ? ctx.currentTime + 0.5 : 0, 0.06); },
    trash() { noise(0.25, 0, 0.12, 900); },
    hire() { [440, 554, 659].forEach((f, i) => tone(f, 0.16, 'triangle', ctx ? ctx.currentTime + i * 0.08 : 0, 0.14)); },
    warn() { tone(330, 0.18, 'square', 0, 0.12); tone(247, 0.22, 'square', ctx ? ctx.currentTime + 0.12 : 0, 0.12); },
    rain() { noise(1.2, 0, 0.06, 1400); }
  };

  // ---- Lo-fi music loop (soft chords + arpeggio) ----
  const CHORDS = [
    [220.00, 277.18, 329.63], // Am
    [196.00, 246.94, 293.66], // G
    [174.61, 220.00, 261.63], // F
    [196.00, 246.94, 329.63]  // G/Em-ish
  ];
  const ARP = [0, 1, 2, 1];

  function musicTick() {
    if (!ctx || !musicOn) return;
    const t = ctx.currentTime;
    const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
    // soft pad on each chord change
    if (musicStep % 4 === 0) {
      chord.forEach(f => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 2);
      });
    }
    // arpeggio pluck
    const note = chord[ARP[musicStep % 4]] * 2;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = note;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.55);
    // soft hat
    if (musicStep % 2 === 1) noise(0.05, t, 0.01, 6000);
    musicStep++;
  }

  function startMusic() {
    if (!ensure()) return;
    resume();
    if (musicOn) return;
    musicOn = true;
    musicStep = 0;
    const bpm = 84, beat = 60 / bpm / 2; // eighth notes
    musicTimer = setInterval(musicTick, beat * 1000);
  }
  function stopMusic() {
    musicOn = false;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  const audio = {
    init() { return ensure(); },
    resume,
    play(name, opts) {
      if (!ensure()) return;
      resume();
      const fn = SFX[name];
      if (fn) try { fn(opts); } catch (e) {}
    },
    startMusic, stopMusic,
    isMusicOn: () => musicOn,
    setVolume(v) {
      volume = util_clamp(v, 0, 1);
      if (master) master.gain.value = muted ? 0 : volume;
    },
    getVolume: () => volume,
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : volume;
    },
    toggleMute() { this.setMuted(!muted); return muted; },
    isMuted: () => muted
  };

  function util_clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  CAFE.audio = audio;
})(window.CAFE = window.CAFE || {});
