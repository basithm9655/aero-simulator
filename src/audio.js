// Multi-Layered Real-World Procedural Aviation Sound Engine (Web Audio API + GPWS Callouts)
// Synthesizes aircraft-specific turbofan/fighter engines, afterburner crackle, reverse thrust roar,
// aerodynamic slipstream & buffet, runway tire roll & joint bumps, touchdown tire chirp + strut thump,
// hydraulic gear & flap motors, sonic boom shockwave, overspeed clacker, stall stick-shaker, and GPWS voice callouts.

export class FlightAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.cabinFilter = null;
    this.muted = false;
    this.initialized = false;
    this.aircraftProfile = 'a380';
    this.lastRunwayBumpTime = 0;
    this.lastClackerTime = 0;
    this.lastWarningTime = 0;
    this.voiceEnabled = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();

      // Master bus with soft-knee compressor to preserve punch without distortion
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime);

      // Cabin insulation filter (slightly warmer in cockpit view, full spectrum outside)
      this.cabinFilter = this.ctx.createBiquadFilter();
      this.cabinFilter.type = 'lowpass';
      this.cabinFilter.frequency.setValueAtTime(14000, this.ctx.currentTime);

      this.cabinFilter.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared procedural noise buffers (Brown noise for deep roar + Pink/White noise for rush & afterburner)
      const sr = this.ctx.sampleRate;
      const len = sr * 3;
      this.brownBuffer = this.ctx.createBuffer(1, len, sr);
      const bData = this.brownBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.024 * w) / 1.024;
        bData[i] = Math.max(-1, Math.min(1, lastOut * 3.8));
      }

      this.whiteBuffer = this.ctx.createBuffer(1, len, sr);
      const wData = this.whiteBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        wData[i] = Math.random() * 2 - 1;
      }

      // 1. JET COMBUSTION CORE ROAR (Low-end brown noise)
      this.engineNoise = this.ctx.createBufferSource();
      this.engineNoise.buffer = this.brownBuffer;
      this.engineNoise.loop = true;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.engineNoise.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.cabinFilter);
      this.engineNoise.start(0);

      // 2. TURBOFAN FAN BLADE BUZZ & COMPRESSOR WHINE (Dual detuned oscillators)
      this.fanOsc = this.ctx.createOscillator();
      this.fanOsc.type = 'sawtooth';
      this.fanOsc.frequency.setValueAtTime(95, this.ctx.currentTime);

      this.fanOsc2 = this.ctx.createOscillator();
      this.fanOsc2.type = 'triangle';
      this.fanOsc2.frequency.setValueAtTime(192, this.ctx.currentTime);

      this.fanFilter = this.ctx.createBiquadFilter();
      this.fanFilter.type = 'bandpass';
      this.fanFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
      this.fanFilter.Q.setValueAtTime(3.2, this.ctx.currentTime);

      this.fanGain = this.ctx.createGain();
      this.fanGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      this.fanOsc.connect(this.fanFilter);
      this.fanOsc2.connect(this.fanFilter);
      this.fanFilter.connect(this.fanGain);
      this.fanGain.connect(this.cabinFilter);
      this.fanOsc.start(0);
      this.fanOsc2.start(0);

      // 3. HIGH-FREQUENCY TURBINE SPOOL WHISTLE
      this.turbineOsc = this.ctx.createOscillator();
      this.turbineOsc.type = 'sine';
      this.turbineOsc.frequency.setValueAtTime(640, this.ctx.currentTime);

      this.turbineGain = this.ctx.createGain();
      this.turbineGain.gain.setValueAtTime(0.008, this.ctx.currentTime);

      this.turbineOsc.connect(this.turbineGain);
      this.turbineGain.connect(this.cabinFilter);
      this.turbineOsc.start(0);

      // 4. AFTERBURNER / REVERSE THRUST CRACKLE ROAR
      this.abNoise = this.ctx.createBufferSource();
      this.abNoise.buffer = this.whiteBuffer;
      this.abNoise.loop = true;

      this.abFilter = this.ctx.createBiquadFilter();
      this.abFilter.type = 'bandpass';
      this.abFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.abFilter.Q.setValueAtTime(0.85, this.ctx.currentTime);

      this.abGain = this.ctx.createGain();
      this.abGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.abNoise.connect(this.abFilter);
      this.abFilter.connect(this.abGain);
      this.abGain.connect(this.cabinFilter);
      this.abNoise.start(0);

      // 5. AERODYNAMIC SLIPSTREAM WIND & SPOILER BUFFET
      this.airNoise = this.ctx.createBufferSource();
      this.airNoise.buffer = this.whiteBuffer;
      this.airNoise.loop = true;

      this.airFilter = this.ctx.createBiquadFilter();
      this.airFilter.type = 'bandpass';
      this.airFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.airFilter.Q.setValueAtTime(0.9, this.ctx.currentTime);

      this.airGain = this.ctx.createGain();
      this.airGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.airNoise.connect(this.airFilter);
      this.airFilter.connect(this.airGain);
      this.airGain.connect(this.cabinFilter);
      this.airNoise.start(0);

      // 6. HIGH-G / STALL BUFFET & RUNWAY TARMAC TIRE ROLL (Sub-bass rumble)
      this.rumbleNoise = this.ctx.createBufferSource();
      this.rumbleNoise.buffer = this.brownBuffer;
      this.rumbleNoise.loop = true;

      this.rumbleFilter = this.ctx.createBiquadFilter();
      this.rumbleFilter.type = 'lowpass';
      this.rumbleFilter.frequency.setValueAtTime(95, this.ctx.currentTime);

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rumbleNoise.connect(this.rumbleFilter);
      this.rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.compressor); // bypass cabin filter so cockpit feels tactile rumble
      this.rumbleNoise.start(0);

      // 7. STALL WARNING HORN + STICK SHAKER
      this.stallOsc = this.ctx.createOscillator();
      this.stallOsc.type = 'sawtooth';
      this.stallOsc.frequency.setValueAtTime(820, this.ctx.currentTime);

      this.stallGain = this.ctx.createGain();
      this.stallGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.stallOsc.connect(this.stallGain);
      this.stallGain.connect(this.compressor);
      this.stallOsc.start(0);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio initialization note:', e);
    }
  }

  setAircraftProfile(id) {
    this.aircraftProfile = id || 'a380';
  }

  update({
    throttle = 0.5,
    speedKt = 120,
    stall = false,
    overspeed = false,
    airbrake = false,
    onGround = false,
    afterburner = false,
    reverseThrust = false,
    gLoad = 1.0,
    cameraMode = 'follow',
    wheelBrake = false,
    transonic = false
  }) {
    if (!this.initialized || !this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const thr = Math.max(0, Math.min(1, throttle));
    const spd = Math.max(0, Math.min(900, speedKt));
    const isCockpit = cameraMode === 'cockpit';

    // Cabin acoustic dampening vs exterior crispness
    this.cabinFilter.frequency.setTargetAtTime(isCockpit ? 2600 : 14000, t, 0.12);

    // Aircraft-specific acoustic signature tuning
    const isFighter = this.aircraftProfile === 'f16';
    const isBizjet = this.aircraftProfile === 'phenom';

    const baseFanHz = isFighter ? 155 : isBizjet ? 128 : 74;
    const fanSpanHz = isFighter ? 460 : isBizjet ? 360 : 210;
    const whistleBase = isFighter ? 950 : isBizjet ? 880 : 540;
    const whistleSpan = isFighter ? 2200 : isBizjet ? 1800 : 1250;

    // 1. Core jet combustion roar
    const coreFreq = (isFighter ? 230 : 150) + thr * (isFighter ? 820 : 520) + spd * 0.35;
    this.engineFilter.frequency.setTargetAtTime(coreFreq, t, 0.08);
    const coreVol = (0.08 + thr * 0.38) * (isCockpit ? 0.72 : 1.0);
    this.engineGain.gain.setTargetAtTime(coreVol, t, 0.08);

    // 2. High-bypass fan buzz
    const fanFreq = baseFanHz + thr * fanSpanHz;
    this.fanOsc.frequency.setTargetAtTime(fanFreq, t, 0.1);
    this.fanOsc2.frequency.setTargetAtTime(fanFreq * 2.015, t, 0.1);
    this.fanFilter.frequency.setTargetAtTime(fanFreq * 2.1, t, 0.1);
    const fanVol = (0.015 + Math.pow(thr, 1.2) * (isFighter ? 0.095 : 0.075)) * (isCockpit ? 0.8 : 1.0);
    this.fanGain.gain.setTargetAtTime(fanVol, t, 0.09);

    // 3. Compressor turbine whistle (prominent during spool-up and approach)
    const whistleFreq = whistleBase + thr * whistleSpan;
    this.turbineOsc.frequency.setTargetAtTime(whistleFreq, t, 0.12);
    const whistleVol = (0.005 + Math.sin(Math.min(1, thr) * Math.PI * 0.85) * 0.022) * (isCockpit ? 0.65 : 1.0);
    this.turbineGain.gain.setTargetAtTime(whistleVol, t, 0.12);

    // 4. Afterburner crackle OR Reverse Thrust roar
    if (afterburner) {
      const abFlutter = 0.24 + 0.07 * Math.sin(t * 48) * Math.cos(t * 23);
      this.abFilter.frequency.setTargetAtTime(420 + (thr - 0.85) * 2400, t, 0.04);
      this.abGain.gain.setTargetAtTime(abFlutter * (isCockpit ? 0.68 : 1.0), t, 0.05);
    } else if (reverseThrust && onGround) {
      this.abFilter.frequency.setTargetAtTime(210 + thr * 280, t, 0.06);
      this.abGain.gain.setTargetAtTime(0.28 * thr, t, 0.07);
    } else {
      this.abGain.gain.setTargetAtTime(0, t, 0.09);
    }

    // 5. Aerodynamic wind rush + spoiler deployment rumble
    const windGain = Math.min(0.24, Math.pow(spd / 320, 1.5) * 0.14) + (airbrake && spd > 50 ? 0.13 : 0);
    this.airGain.gain.setTargetAtTime(windGain * (isCockpit ? 1.15 : 0.85), t, 0.08);
    this.airFilter.frequency.setTargetAtTime(
      airbrake ? 720 + spd * 0.9 : 360 + spd * 1.4,
      t,
      0.08
    );

    // 6. Tactile rumble: Runway tire roll OR High-G / Stall / Transonic buffet
    let rumbleTarget = 0;
    let rumbleFreq = 95;
    if (onGround && spd > 4) {
      rumbleTarget = Math.min(0.34, (spd / 120) * 0.28) + (wheelBrake ? 0.09 : 0);
      rumbleFreq = 70 + Math.min(160, spd * 0.85);
      // Periodic tarmac concrete slab seam thump!
      const bumpIntervalMs = Math.max(85, 650 - spd * 3.4);
      const nowMs = performance.now();
      if (nowMs - this.lastRunwayBumpTime > bumpIntervalMs) {
        this.lastRunwayBumpTime = nowMs;
        this._playTarmacSeam(Math.min(1, spd / 110));
      }
    } else {
      const highGBuffet = Math.max(0, (Math.abs(gLoad) - 2.6) * 0.065);
      const stallBuffet = stall ? 0.24 : 0;
      const transonicBuffet = transonic ? 0.14 : 0;
      rumbleTarget = Math.min(0.32, highGBuffet + stallBuffet + transonicBuffet);
      rumbleFreq = stall ? 65 : 110;
    }
    this.rumbleFilter.frequency.setTargetAtTime(rumbleFreq, t, 0.06);
    this.rumbleGain.gain.setTargetAtTime(rumbleTarget, t, 0.06);

    // 7. Stall warning horn (pulsing aviation klaxon)
    if (stall) {
      const pulse = (Math.sin(performance.now() / 68) > 0) ? 0.15 : 0;
      this.stallOsc.frequency.setTargetAtTime(840 + (Math.sin(performance.now() / 34) * 35), t, 0.01);
      this.stallGain.gain.setTargetAtTime(pulse, t, 0.015);
    } else {
      this.stallGain.gain.setTargetAtTime(0, t, 0.04);
    }

    // 8. Overspeed Clacker (authentic Boeing/Airbus rapid woody clicker)
    if (overspeed && !onGround) {
      const nowMs = performance.now();
      if (nowMs - this.lastClackerTime > 115) {
        this.lastClackerTime = nowMs;
        this._playClackerTick();
      }
    }
  }

  _playTarmacSeam(intensity = 0.5) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.045);
      gain.gain.setValueAtTime(0.11 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch (_) {}
  }

  _playClackerTick() {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1650, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.024);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (_) {}
  }

  playClick(heavy = false) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = heavy ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(heavy ? 480 : 920, now);
      osc.frequency.exponentialRampToValueAtTime(heavy ? 110 : 210, now + (heavy ? 0.06 : 0.035));
      gain.gain.setValueAtTime(heavy ? 0.24 : 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.065 : 0.04));
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch (_) {}
  }

  // Hydraulic Landing Gear Transit Motor + Heavy Lock Clunk
  playGearTransit(extending = true) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 2.2;

      // Hydraulic whine
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(extending ? 185 : 230, now);
      osc.frequency.linearRampToValueAtTime(extending ? 245 : 175, now + dur);

      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(420, now);
      filt.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.085, now + 0.15);
      gain.gain.setValueAtTime(0.08, now + dur - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + dur + 0.05);

      // Heavy mechanical lock clunk at end of transit
      const clunkTime = now + dur - 0.08;
      const clunk = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      clunk.type = 'sine';
      clunk.frequency.setValueAtTime(115, clunkTime);
      clunk.frequency.exponentialRampToValueAtTime(36, clunkTime + 0.16);
      cGain.gain.setValueAtTime(0.32, clunkTime);
      cGain.gain.exponentialRampToValueAtTime(0.001, clunkTime + 0.18);
      clunk.connect(cGain);
      cGain.connect(this.compressor);
      clunk.start(clunkTime);
      clunk.stop(clunkTime + 0.2);
    } catch (_) {}
  }

  // Electric / Hydraulic Flap Screwjack Actuator Motor
  playFlapsMotor() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 1.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.linearRampToValueAtTime(340, now + dur);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.08);
      gain.gain.setValueAtTime(0.06, now + dur - 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + dur + 0.04);
    } catch (_) {}
  }

  // Realistic Multi-Layer Runway Touchdown: Rubber Tire Chirp + Heavy Oleo Strut Impact Thump
  playTouchdown(sinkRateFpm = -180, speedKt = 135) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const impact = Math.max(0.35, Math.min(1.4, Math.abs(sinkRateFpm) / 320));
      const spdFactor = Math.max(0.4, Math.min(1.2, speedKt / 130));

      // 1. Oleo Strut & Fuselage Low Thump
      const thump = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(98, now);
      thump.frequency.exponentialRampToValueAtTime(28, now + 0.24);
      tGain.gain.setValueAtTime(0.48 * impact, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      thump.connect(tGain);
      tGain.connect(this.compressor);
      thump.start(now);
      thump.stop(now + 0.3);

      // 2. Dual Rubber Tire Screech on Asphalt (Main Left/Right staggered by 45ms)
      [0, 0.048].forEach((delay, idx) => {
        const chirp = this.ctx.createBufferSource();
        chirp.buffer = this.whiteBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime((idx === 0 ? 2350 : 2100) * spdFactor, now + delay);
        bp.frequency.exponentialRampToValueAtTime(1100, now + delay + 0.22);
        bp.Q.setValueAtTime(6.5, now + delay);

        const cGain = this.ctx.createGain();
        cGain.gain.setValueAtTime(0.001, now + delay);
        cGain.gain.linearRampToValueAtTime(0.30 * impact * spdFactor, now + delay + 0.025);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.24);

        chirp.connect(bp);
        bp.connect(cGain);
        cGain.connect(this.compressor);
        chirp.start(now + delay);
        chirp.stop(now + delay + 0.26);
      });
    } catch (_) {}
  }

  // Supersonic Mach 1.0 Double N-Wave Sonic Boom
  playSonicBoom() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      [0, 0.11].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 150 : 120, now + offset);
        osc.frequency.exponentialRampToValueAtTime(24, now + offset + 0.65);
        g.gain.setValueAtTime(idx === 0 ? 0.65 : 0.45, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.7);
        osc.connect(g);
        g.connect(this.compressor);
        osc.start(now + offset);
        osc.stop(now + offset + 0.72);
      });

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.whiteBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, now);
      lp.frequency.exponentialRampToValueAtTime(90, now + 0.85);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.55, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      noise.connect(lp);
      lp.connect(nGain);
      nGain.connect(this.compressor);
      noise.start(now);
      noise.stop(now + 0.95);
    } catch (_) {}
  }

  // Authentic GPWS Dual-Tone "Whoop-Whoop" Master Warning
  playMasterWarning() {
    if (!this.initialized || !this.ctx || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastWarningTime < 900) return;
    this.lastWarningTime = nowMs;
    try {
      const now = this.ctx.currentTime;
      [0, 0.24].forEach(offset => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, now + offset);
        osc.frequency.exponentialRampToValueAtTime(1420, now + offset + 0.19);
        g.gain.setValueAtTime(0.16, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.21);
        osc.connect(g);
        g.connect(this.compressor);
        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
    } catch (_) {}
  }

  // Autopilot Disconnect Classic Dual-Tone Chime
  playAutopilotChime(engaged = true) {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = engaged ? [660, 880] : [880, 587, 880, 587];
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.11);
        g.gain.setValueAtTime(0.16, now + idx * 0.11);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.1);
        osc.connect(g);
        g.connect(this.compressor);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.11);
      });
    } catch (_) {}
  }

  // Avionics Waypoint Acquired Chime
  playWaypointChime() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      [784, 1046.5].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        g.gain.setValueAtTime(0.14, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.24);
        osc.connect(g);
        g.connect(this.compressor);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch (_) {}
  }

  // Crisp Synthesized Cockpit Voice Callout (V1, Rotate, 500, 100, 50, 30, 10, Retard, Pull Up)
  speakCallout(text, urgent = false) {
    if (this.muted || !this.voiceEnabled) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (urgent) synth.cancel();
      else if (synth.speaking) return; // Don't stack altitude callouts over each other
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = urgent ? 1.25 : 1.15;
      utter.pitch = urgent ? 0.85 : 0.92;
      utter.volume = 0.72;
      synth.speak(utter);
    } catch (_) {}
  }

  // Cinematic Multi-Stage Crash Explosion
  playExplosion() {
    if (!this.initialized || !this.ctx || this.muted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;

      // 1. Sub-bass Shockwave Blast
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(145, now);
      subOsc.frequency.exponentialRampToValueAtTime(22, now + 1.4);
      subGain.gain.setValueAtTime(0.9, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      subOsc.connect(subGain);
      subGain.connect(this.compressor);
      subOsc.start(now);
      subOsc.stop(now + 2.1);

      // 2. Fiery Blast & Ripping Airframe Metal
      const bufferSize = Math.floor(this.ctx.sampleRate * 2.5);
      const blastBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = blastBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.48));
      }
      const blastSource = this.ctx.createBufferSource();
      blastSource.buffer = blastBuffer;

      const blastFilter = this.ctx.createBiquadFilter();
      blastFilter.type = 'lowpass';
      blastFilter.frequency.setValueAtTime(2800, now);
      blastFilter.frequency.exponentialRampToValueAtTime(140, now + 1.9);

      const blastGain = this.ctx.createGain();
      blastGain.gain.setValueAtTime(0.95, now);
      blastGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      blastSource.connect(blastFilter);
      blastFilter.connect(blastGain);
      blastGain.connect(this.compressor);
      blastSource.start(now);
      blastSource.stop(now + 2.5);
    } catch (_) {}
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    if (this.muted && this.voiceEnabled) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    return this.muted;
  }
}
