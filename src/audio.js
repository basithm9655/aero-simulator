// Procedural Web Audio Sound Engine for Flight Simulation
export class FlightAudio {
  constructor() {
    this.ctx = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.turbineOsc = null;
    this.turbineGain = null;
    this.airGain = null;
    this.airFilter = null;
    this.stallOsc = null;
    this.stallGain = null;
    this.stallInterval = null;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- Jet Engine Combustion (Brown Noise Buffer) ---
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.noiseSource.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.noiseSource.start(0);

      // --- Turbine Whine (Oscillator) ---
      this.turbineOsc = this.ctx.createOscillator();
      this.turbineOsc.type = 'sawtooth';
      this.turbineOsc.frequency.setValueAtTime(140, this.ctx.currentTime);

      const turbineFilter = this.ctx.createBiquadFilter();
      turbineFilter.type = 'bandpass';
      turbineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      turbineFilter.Q.setValueAtTime(5.0, this.ctx.currentTime);

      this.turbineGain = this.ctx.createGain();
      this.turbineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.turbineOsc.connect(turbineFilter);
      turbineFilter.connect(this.turbineGain);
      this.turbineGain.connect(this.masterGain);
      this.turbineOsc.start(0);

      // --- Airflow / Wind Rush ---
      const airNoise = this.ctx.createBufferSource();
      airNoise.buffer = noiseBuffer;
      airNoise.loop = true;

      this.airFilter = this.ctx.createBiquadFilter();
      this.airFilter.type = 'bandpass';
      this.airFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
      this.airFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.airGain = this.ctx.createGain();
      this.airGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      airNoise.connect(this.airFilter);
      this.airFilter.connect(this.airGain);
      this.airGain.connect(this.masterGain);
      airNoise.start(0);

      // --- Stall Horn Generator ---
      this.stallOsc = this.ctx.createOscillator();
      this.stallOsc.type = 'square';
      this.stallOsc.frequency.setValueAtTime(740, this.ctx.currentTime);

      this.stallGain = this.ctx.createGain();
      this.stallGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.stallOsc.connect(this.stallGain);
      this.stallGain.connect(this.masterGain);
      this.stallOsc.start(0);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not allowed or failed:', e);
    }
  }

  update({ throttle = 0.5, speedKt = 120, stall = false, airbrake = false }) {
    if (!this.initialized || !this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const thr = Math.max(0, Math.min(1, throttle));
    const spd = Math.max(0, Math.min(600, speedKt));

    // Engine combustion pitch & volume (boosted when afterburner ignites)
    const isAfterburner = thr > 0.85;
    const abBoost = isAfterburner ? (thr - 0.85) * 550 : 0;
    const filterFreq = 180 + thr * 650 + spd * 0.4 + abBoost;
    this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.08);
    const engVol = 0.15 + thr * 0.45 + (isAfterburner ? 0.22 : 0);
    this.engineGain.gain.setTargetAtTime(engVol, t, 0.08);

    // Turbine whine
    const turbineFreq = 120 + thr * 380;
    this.turbineOsc.frequency.setTargetAtTime(turbineFreq, t, 0.1);
    this.turbineGain.gain.setTargetAtTime(0.02 + thr * 0.08, t, 0.1);

    // Airflow noise
    const airVol = (spd / 400) * 0.15 + (airbrake ? 0.18 : 0);
    this.airGain.gain.setTargetAtTime(airVol, t, 0.08);
    if (airbrake) {
      this.airFilter.frequency.setTargetAtTime(900, t, 0.08);
    } else {
      this.airFilter.frequency.setTargetAtTime(450 + spd * 0.8, t, 0.08);
    }

    // Stall warning horn (pulsing beep when stall = true)
    if (stall) {
      const pulse = (Math.sin(Date.now() / 80) > 0) ? 0.22 : 0;
      this.stallGain.gain.setTargetAtTime(pulse, t, 0.02);
    } else {
      this.stallGain.gain.setTargetAtTime(0, t, 0.04);
    }
  }

  playClick() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (_) {}
  }

  playExplosion() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;

      // 1. Heavy Sub-bass Impact Blast
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(130, now);
      subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.2);
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 1.8);

      // 2. High-energy Fiery Blast & Ripping Metal Noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 2.2);
      const blastBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = blastBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.42));
      }
      const blastSource = this.ctx.createBufferSource();
      blastSource.buffer = blastBuffer;

      const blastFilter = this.ctx.createBiquadFilter();
      blastFilter.type = 'lowpass';
      blastFilter.frequency.setValueAtTime(2400, now);
      blastFilter.frequency.exponentialRampToValueAtTime(160, now + 1.6);

      const blastGain = this.ctx.createGain();
      blastGain.gain.setValueAtTime(0.95, now);
      blastGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      blastSource.connect(blastFilter);
      blastFilter.connect(blastGain);
      blastGain.connect(this.masterGain);
      blastSource.start(now);
      blastSource.stop(now + 2.2);
    } catch (_) {}
  }

  playTouchdown() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // High-pitched tire chirp on tarmac
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }
}
