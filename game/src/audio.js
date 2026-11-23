// audio.js — every sound in Palmera Heat is synthesized with WebAudio:
// UI blips, punches, crashes, pickup chimes, a puttering engine hum and a
// two-tone police siren. No audio files, nothing loaded.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null; // { osc, gain }
    this.siren = null; // { osc, gain, lfo }
  }

  /** Create the context on the first user gesture; safe to call often. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  tone({ freq = 440, freqEnd = null, dur = 0.12, type = 'square', vol = 0.16, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio is decoration; never break the game */ }
  }

  noise({ dur = 0.1, vol = 0.2, delay = 0, low = 400, high = 2400 }) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = (low + high) / 2;
      filter.Q.value = 0.7;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0);
    } catch { /* see tone() */ }
  }

  blip() { this.tone({ freq: 660, freqEnd: 880, dur: 0.07, type: 'square', vol: 0.1 }); }
  pickup() {
    this.tone({ freq: 740, dur: 0.09, type: 'triangle', vol: 0.2 });
    this.tone({ freq: 1108, dur: 0.14, type: 'triangle', vol: 0.2, delay: 0.08 });
  }
  cash() {
    this.tone({ freq: 988, dur: 0.08, type: 'square', vol: 0.12 });
    this.tone({ freq: 1319, dur: 0.16, type: 'square', vol: 0.12, delay: 0.07 });
  }
  punch() { this.noise({ dur: 0.08, vol: 0.3, low: 200, high: 900 }); }
  crash(strength = 1) {
    this.noise({ dur: 0.22, vol: 0.25 * strength, low: 100, high: 1400 });
    this.tone({ freq: 120, freqEnd: 45, dur: 0.2, type: 'sawtooth', vol: 0.12 * strength });
  }
  door() { this.tone({ freq: 190, freqEnd: 120, dur: 0.09, type: 'triangle', vol: 0.18 }); }
  horn() {
    // A proper two-tone car horn: short, loud, faintly rude.
    this.tone({ freq: 370, dur: 0.22, type: 'square', vol: 0.11 });
    this.tone({ freq: 466, dur: 0.22, type: 'square', vol: 0.11 });
  }
  sting(win = true) {
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((freq, i) => this.tone({ freq, dur: 0.16, type: 'triangle', vol: 0.18, delay: i * 0.1 }));
  }

  /** Continuous engine hum while the player drives; speed01 is 0..1. */
  setEngine(on, speed01 = 0) {
    if (!this.ctx) return;
    try {
      if (on && !this.engine) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        gain.gain.value = 0.0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        osc.connect(filter).connect(gain).connect(this.master);
        osc.start();
        this.engine = { osc, gain };
      }
      if (this.engine) {
        const t = this.ctx.currentTime;
        this.engine.osc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
        this.engine.gain.gain.setTargetAtTime(on && !this.muted ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
        if (!on) {
          const eng = this.engine;
          this.engine = null;
          setTimeout(() => { try { eng.osc.stop(); } catch { /* already stopped */ } }, 350);
        }
      }
    } catch { /* see tone() */ }
  }

  /** Two-tone siren while police are close and the player is wanted. */
  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.siren) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 840;
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.value = 0.0;
        osc.connect(gain).connect(this.master);
        osc.start();
        lfo.start();
        this.siren = { osc, gain, lfo };
      }
      if (this.siren) {
        const t = this.ctx.currentTime;
        this.siren.gain.gain.setTargetAtTime(on && !this.muted ? 0.028 : 0, t, 0.15);
        if (!on) {
          const s = this.siren;
          this.siren = null;
          setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch { /* already stopped */ } }, 400);
        }
      }
    } catch { /* see tone() */ }
  }
}
