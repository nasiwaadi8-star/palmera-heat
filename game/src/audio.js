// Palmera Heat — round 2 recorded rewrite: every sound below is synthesised live, so the
// game ships no audio files at all.
// Synthesised sound with WebAudio only: no audio files, nothing loads over the network.
// Short noise/oscillator blips for shots, pickups and sirens, a low engine hum while
// driving, and little arpeggios for mission success and failure. Everything is created
// lazily on the first user gesture, and M (or a failed AudioContext) silences it for good.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenPhase = 0;

  function ensure() {
    if (context !== null || muted) return context;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      context = null;
      muted = true;
    }
    return context;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, low) {
    const ctx = ensure();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  return {
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume(); },
    toggleMute() { muted = !muted; if (muted) { this.setEngine(0); this.setSiren(false, 0); } return muted; },
    get muted() { return muted; },
    shot() { noise(0.09, 0.25, 1800); tone(140, 0.07, 'square', 0.08, 60); },
    punch() { noise(0.06, 0.18, 700); },
    hit() { tone(90, 0.12, 'sawtooth', 0.12, 50); },
    pickup() { tone(880, 0.08, 'sine', 0.14); setTimeout(() => tone(1320, 0.1, 'sine', 0.12), 60); },
    cash() { tone(1180, 0.06, 'triangle', 0.14); setTimeout(() => tone(1560, 0.09, 'triangle', 0.12), 50); },
    door() { tone(220, 0.06, 'square', 0.08, 160); noise(0.04, 0.06, 900); },
    crash(intensity) { noise(0.18, Math.min(0.4, 0.12 + intensity * 0.05), 500); },
    success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.14), i * 90)); },
    fail() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12), i * 100)); },
    levelWanted() { tone(660, 0.09, 'square', 0.1); setTimeout(() => tone(660, 0.09, 'square', 0.1), 120); },
    setEngine(speedRatio) {
      const ctx = ensure();
      if (!ctx) return;
      if (engineOsc === null) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speedRatio * 130;
      engineGain.gain.value = muted ? 0 : 0.028 + speedRatio * 0.03;
    },
    setSiren(active, dt) {
      const ctx = ensure();
      if (!ctx) return;
      if (sirenOsc === null) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(ctx.destination);
        sirenOsc.start();
      }
      sirenPhase += dt * 2.4;
      sirenOsc.frequency.value = 700 + Math.sin(sirenPhase * Math.PI) * 260;
      sirenGain.gain.value = !muted && active ? 0.018 : 0;
    },
  };
}
