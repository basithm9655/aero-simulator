import { checkObstacleCollision } from './obstacles.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const G0 = 9.80665;
const RHO0 = 1.225;
const KT_TO_MS = 1 / 1.943844;
const MS_TO_KT = 1.943844;
const MS_TO_FPM = 196.8504;
const M_TO_FT = 3.28084;

const clamp = (v, a, b) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
};

export const qFromEuler = (roll, pitch, yaw) => {
  const cr = Math.cos(roll * DEG / 2), sr = Math.sin(roll * DEG / 2);
  const cp = Math.cos(pitch * DEG / 2), sp = Math.sin(pitch * DEG / 2);
  const cy = Math.cos(yaw * DEG / 2), sy = Math.sin(yaw * DEG / 2);
  const n = Math.hypot(
    cr * cp * cy + sr * sp * sy,
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy
  ) || 1;
  return {
    w: (cr * cp * cy + sr * sp * sy) / n,
    x: (sr * cp * cy - cr * sp * sy) / n,
    y: (cr * sp * cy + sr * cp * sy) / n,
    z: (cr * cp * sy - sr * sp * cy) / n
  };
};

export const eulerFromQ = q => {
  const roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
  const pitch = Math.asin(clamp(2 * (q.w * q.y - q.z * q.x), -1, 1));
  const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
  return { roll: roll * RAD, pitch: pitch * RAD, yaw: (yaw * RAD + 360) % 360 };
};

// International Standard Atmosphere (ISA) density, temperature & speed of sound
export function isaAtmosphere(altM) {
  const h = clamp(altM, 0, 20000);
  let tempK;
  let rho;
  if (h <= 11000) {
    tempK = 288.15 - 0.0065 * h;
    rho = RHO0 * Math.pow(tempK / 288.15, 4.25588);
  } else {
    tempK = 216.65;
    rho = 0.36391 * Math.exp(-(h - 11000) / 6341.62);
  }
  const speedOfSound = Math.sqrt(1.4 * 287.05 * tempK);
  return {
    tempK,
    tempC: tempK - 273.15,
    rho,
    sigma: rho / RHO0,
    speedOfSound
  };
}

// Weather presets defining wind direction, speed (kt), gusts, and turbulence intensity
export const WEATHER_PRESETS = {
  clear: {
    id: 'clear',
    label: 'Clear Day',
    windDirDeg: 50,
    windKt: 6,
    gustKt: 2,
    turbulence: 0.08,
    timeOfDay: 'day'
  },
  sunset: {
    id: 'sunset',
    label: 'Golden Hour',
    windDirDeg: 75,
    windKt: 9,
    gustKt: 3,
    turbulence: 0.14,
    timeOfDay: 'sunset'
  },
  night: {
    id: 'night',
    label: 'Night Ops',
    windDirDeg: 30,
    windKt: 7,
    gustKt: 2,
    turbulence: 0.10,
    timeOfDay: 'night'
  },
  crosswind: {
    id: 'crosswind',
    label: 'Crosswind 18kt',
    windDirDeg: 140,
    windKt: 18,
    gustKt: 7,
    turbulence: 0.38,
    timeOfDay: 'day'
  },
  storm: {
    id: 'storm',
    label: 'Storm Gusts',
    windDirDeg: 165,
    windKt: 26,
    gustKt: 12,
    turbulence: 0.72,
    timeOfDay: 'storm'
  }
};

// High-Fidelity Real-World 6-DOF Aerodynamic Flight Dynamics Model
export class FlightModel {
  constructor() {
    this.controls = {
      aileron: 0,
      elevator: 0,
      rudder: 0,
      throttle: 0.85,
      engine: 0.85, // actual spooled N1 (0..1)
      airbrake: 0,
      wheelBrake: 0,
      parkingBrake: false,
      reverseThrust: false,
      flapsTarget: 0, // 0, 1, 2, 3 (0°, 10°, 20°, 30°)
      gearTarget: 1,  // 1 = DOWN, 0 = UP
      pitchTrim: 0.0  // -1..+1 (-8°..+8° trim bias)
    };

    // Animated mechanical actuator states
    this.flapsPos = 0;   // 0..1
    this.gearPos = 1;    // 0..1 (1 = fully extended & locked)
    this.spoilerPos = 0; // 0..1

    // Angular rates (deg/s)
    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;

    // Flight path / vertical velocity state
    this.vz = 0;        // vertical velocity (m/s)
    this.gammaDeg = 0;  // flight path angle (deg)
    this.aoaDeg = 0;    // angle of attack (deg)
    this.slipDeg = 0;   // sideslip angle (deg)

    // Aircraft physical parameters (defaults = A380, updated via setSpecs)
    this.specs = {
      id: 'a380',
      mass: 420000,
      wingArea: 845,
      wingspan: 79.75,
      thrustToWeight: 0.30,
      afterburnerMult: 1.0,
      hasAfterburner: false,
      hasReversers: true,
      cruiseKnots: 485,
      maxKnots: 550,
      vmoKnots: 355,
      mmo: 0.89,
      vfeKnots: 225,
      stallKnots: 128,
      v1Knots: 138,
      vrKnots: 146,
      vrefKnots: 136,
      dragFactor: 0.82,
      rollMaxRate: 30,
      pitchMaxRate: 20,
      spoolRate: 1.4
    };

    // Weather state
    this.weather = WEATHER_PRESETS.clear;
    this.simTime = 0;

    // Callout / event latches so discrete audio callouts trigger once per crossing
    this.callouts = {
      v80: false,
      v1: false,
      vr: false,
      posRate: false,
      prevMach: 0,
      lastGpwsFt: 99999,
      lastWarnTime: 0,
      lastLandingGrade: null
    };

    this.crashReason = '';
    this.fuelPct = 100;
    this.reset();
  }

  setSpecs(specs = {}) {
    this.specs = {
      ...this.specs,
      ...specs,
      id: specs.id || this.specs.id,
      mass: specs.mass || this.specs.mass,
      wingArea: specs.wingArea || (specs.id === 'f16' ? 27.87 : specs.id === 'phenom' ? 18.8 : 845),
      wingspan: specs.wingspan || (specs.id === 'f16' ? 9.96 : specs.id === 'phenom' ? 12.3 : 79.75),
      thrustToWeight: specs.thrustToWeight || (specs.id === 'f16' ? 0.72 : specs.id === 'phenom' ? 0.35 : 0.30),
      afterburnerMult: specs.hasAfterburner ? 1.62 : 1.0,
      hasAfterburner: !!specs.hasAfterburner || specs.id === 'f16',
      hasReversers: specs.hasReversers !== undefined ? specs.hasReversers : (specs.id !== 'f16'),
      cruiseKnots: specs.cruiseKnots || 450,
      maxKnots: specs.maxKnots || 540,
      vmoKnots: specs.vmoKnots || (specs.id === 'f16' ? 780 : specs.id === 'phenom' ? 285 : 355),
      mmo: specs.mmo || (specs.id === 'f16' ? 2.0 : specs.id === 'phenom' ? 0.72 : 0.89),
      vfeKnots: specs.vfeKnots || (specs.id === 'f16' ? 260 : specs.id === 'phenom' ? 185 : 225),
      stallKnots: specs.stallKnots || 120,
      v1Knots: specs.v1Knots || Math.round((specs.stallKnots || 120) * 1.06),
      vrKnots: specs.vrKnots || Math.round((specs.stallKnots || 120) * 1.14),
      vrefKnots: specs.vrefKnots || Math.round((specs.stallKnots || 120) * 1.08),
      rollMaxRate: specs.rollMaxRate || (specs.id === 'f16' ? 135 : specs.id === 'phenom' ? 68 : 32),
      pitchMaxRate: specs.pitchMaxRate || (specs.id === 'f16' ? 42 : specs.id === 'phenom' ? 28 : 20),
      spoolRate: specs.spoolRate || (specs.id === 'f16' ? 3.2 : specs.id === 'phenom' ? 2.2 : 1.45)
    };
  }

  setWeather(weatherKey) {
    this.weather = WEATHER_PRESETS[weatherKey] || WEATHER_PRESETS.clear;
  }

  reset(
    startAlt = 404,
    startHdg = 50,
    onRunway = true,
    groundElev = 404,
    initialSpeedKt = 0,
    initialThrottle = null,
    options = {}
  ) {
    this.groundElev = Number.isFinite(groundElev) ? groundElev : 404;
    this.onGround = !!onRunway;
    this.crashed = false;
    this.crashReason = '';
    this.airborneTime = onRunway ? 0 : 12.0;

    const isApproach = !!options.isApproach;
    const defaultSpeedKt = onRunway
      ? 0
      : (isApproach ? (this.specs.vrefKnots + 12) : Math.min(this.specs.cruiseKnots * 0.65, 230));
    const speedKt = (initialSpeedKt !== null && initialSpeedKt !== undefined && initialSpeedKt > 0)
      ? initialSpeedKt
      : defaultSpeedKt;
    const startSpeedMs = speedKt * KT_TO_MS;

    const startPitch = onRunway ? 0 : (isApproach ? 1.5 : 2.0);
    const startVz = onRunway ? 0 : (isApproach ? -Math.tan(3.0 * DEG) * startSpeedMs : 0);

    this.s = {
      alt: onRunway ? this.groundElev : startAlt,
      speed: startSpeedMs,
      pos: { x: 0, y: 0, z: -(onRunway ? this.groundElev : startAlt) },
      q: qFromEuler(0, startPitch, startHdg)
    };

    this.vz = startVz;
    this.gammaDeg = startSpeedMs > 5 ? Math.asin(clamp(startVz / startSpeedMs, -1, 1)) * RAD : 0;
    this.aoaDeg = startPitch - this.gammaDeg;
    this.slipDeg = 0;

    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;

    // Configure realistic initial gear / flaps / throttle per flight phase
    const defaultThr = onRunway ? 0.0 : (isApproach ? 0.36 : 0.68);
    this.controls.throttle = (initialThrottle !== null) ? clamp(initialThrottle, 0, 1) : defaultThr;
    this.controls.engine = this.controls.throttle;
    this.controls.elevator = 0;
    this.controls.aileron = 0;
    this.controls.rudder = 0;
    this.controls.airbrake = 0;
    this.controls.wheelBrake = 0;
    this.controls.parkingBrake = false;
    this.controls.reverseThrust = false;
    this.controls.pitchTrim = 0;

    if (onRunway) {
      this.controls.gearTarget = 1;
      this.gearPos = 1;
      this.controls.flapsTarget = 1; // Takeoff flaps (10°)
      this.flapsPos = 1 / 3;
    } else if (isApproach) {
      this.controls.gearTarget = 1;
      this.gearPos = 1;
      this.controls.flapsTarget = 2; // Approach flaps (20°)
      this.flapsPos = 2 / 3;
    } else {
      this.controls.gearTarget = 0;
      this.gearPos = 0;
      this.controls.flapsTarget = 0;
      this.flapsPos = 0;
    }
    this.spoilerPos = 0;

    this.callouts = {
      v80: !onRunway,
      v1: !onRunway,
      vr: !onRunway,
      posRate: !onRunway,
      prevMach: 0,
      lastGpwsFt: Math.max(0, (this.s.alt - this.groundElev) * M_TO_FT),
      lastWarnTime: 0,
      lastLandingGrade: null
    };

    this.last = {
      ias: speedKt,
      tas: speedKt,
      gs: speedKt,
      vs: Math.round(startVz * MS_TO_FPM),
      aglFt: Math.max(0, (this.s.alt - this.groundElev) * M_TO_FT),
      euler: { roll: 0, pitch: startPitch, yaw: startHdg },
      gamma: this.gammaDeg,
      aoa: this.aoaDeg,
      slip: 0,
      g: 1.0,
      mach: 0,
      oatC: 15,
      stall: false,
      overspeed: false,
      flapOverspeed: false,
      gearWarn: false,
      gpwsAlert: '',
      crashed: false,
      crashReason: '',
      onGround: this.onGround,
      gearPos: this.gearPos,
      flapsPos: this.flapsPos,
      spoilerPos: this.spoilerPos,
      reverseThrust: false,
      afterburner: false,
      transonic: false,
      windDir: this.weather.windDirDeg,
      windKt: this.weather.windKt,
      events: {}
    };
  }

  step(dt, curLat = null, curLng = null, onRunwaySurface = false) {
    dt = clamp(dt, 0.005, 0.04);
    this.simTime += dt;

    if (this.crashed) {
      this.last.events = {};
      return this.last;
    }

    const c = this.controls;
    const sp = this.specs;
    const att = eulerFromQ(this.s.q);
    const events = {};

    // 1. Mechanical Actuator Transitions (Gear, Flaps, Spoilers)
    const flapTargetNorm = clamp(c.flapsTarget, 0, 3) / 3;
    if (this.flapsPos < flapTargetNorm) {
      this.flapsPos = Math.min(flapTargetNorm, this.flapsPos + dt * 0.28);
    } else if (this.flapsPos > flapTargetNorm) {
      this.flapsPos = Math.max(flapTargetNorm, this.flapsPos - dt * 0.28);
    }

    const gearTargetNorm = c.gearTarget ? 1 : 0;
    if (this.gearPos < gearTargetNorm) {
      this.gearPos = Math.min(1, this.gearPos + dt * 0.38);
      if (this.gearPos === 1) events.gearLocked = 'DOWN';
    } else if (this.gearPos > gearTargetNorm) {
      this.gearPos = Math.max(0, this.gearPos - dt * 0.38);
      if (this.gearPos === 0) events.gearLocked = 'UP';
    }

    const spoilerTarget = c.airbrake ? 1 : 0;
    this.spoilerPos += (spoilerTarget - this.spoilerPos) * Math.min(1, dt * 4.5);

    // Reverse thrust only valid on ground & on aircraft equipped with reversers
    if (!this.onGround || !sp.hasReversers) {
      c.reverseThrust = false;
    }

    // 2. ISA Atmosphere & Local Wind Vector
    const atm = isaAtmosphere(this.s.alt);
    const aglM = Math.max(0, this.s.alt - this.groundElev);
    const aglFt = aglM * M_TO_FT;

    // Gusting wind + turbulence (smooth multi-frequency noise)
    const gustPhase = Math.sin(this.simTime * 0.7) * 0.6 + Math.sin(this.simTime * 1.9 + 1.3) * 0.4;
    const windKt = Math.max(0, this.weather.windKt + gustPhase * this.weather.gustKt);
    const windMs = windKt * KT_TO_MS;
    // Wind direction is meteorological "FROM" direction -> blows TOWARD (windDir + 180)
    const windToRad = ((this.weather.windDirDeg + 180) % 360) * DEG;
    const windNorth = Math.cos(windToRad) * windMs;
    const windEast = Math.sin(windToRad) * windMs;

    // Turbulence angular perturbation (reduced on ground)
    const turbScale = this.onGround ? 0.06 : this.weather.turbulence;
    const turbRoll = (Math.sin(this.simTime * 2.3) + 0.5 * Math.cos(this.simTime * 5.7)) * turbScale * 6.5;
    const turbPitch = (Math.cos(this.simTime * 1.9) + 0.5 * Math.sin(this.simTime * 4.3)) * turbScale * 2.8;

    // 3. Engine N1 Spool & Fuel Burn
    const desiredN1 = c.reverseThrust ? Math.max(0.75, c.throttle) : c.throttle;
    c.engine += (desiredN1 - c.engine) * Math.min(1, dt * sp.spoolRate);
    this.fuelPct = Math.max(1, this.fuelPct - dt * (0.004 + c.engine * 0.015));

    // 4. Airspeed & Aerodynamic Forces
    const V = Math.max(0, this.s.speed); // True Airspeed (m/s)
    const tasKt = V * MS_TO_KT;
    const iasKt = tasKt * Math.sqrt(atm.sigma);
    const mach = V / atm.speedOfSound;
    const isAfterburner = sp.hasAfterburner && c.engine > 0.85 && !c.reverseThrust;
    const transonic = mach >= 0.94 && mach <= 1.06;

    // Sonic boom crossing event
    if (this.callouts.prevMach < 1.0 && mach >= 1.0) {
      events.sonicBoom = true;
    }
    this.callouts.prevMach = mach;

    // Dynamic pressure q = 0.5 * rho * V^2
    const qBar = 0.5 * atm.rho * V * V;
    const weightN = sp.mass * G0;

    // Calibrate clean CL_max directly from real aircraft stall speed
    const vStallCleanMs = sp.stallKnots * KT_TO_MS;
    const clMaxClean = (2 * weightN) / (RHO0 * vStallCleanMs * vStallCleanMs * sp.wingArea);
    const effectiveStallKt = sp.stallKnots / Math.sqrt(1 + 0.72 * this.flapsPos);

    // Thrust computation with altitude density lapse and afterburner boost
    const maxDryThrustN = weightN * sp.thrustToWeight;
    const altThrustFactor = Math.pow(atm.sigma, 0.62);
    const abFactor = isAfterburner
      ? 1 + ((c.engine - 0.85) / 0.15) * (sp.afterburnerMult - 1.0)
      : 1.0;
    const rawThrustN = maxDryThrustN * altThrustFactor * Math.pow(c.engine, 1.35) * abFactor;
    const netThrustN = c.reverseThrust ? (-maxDryThrustN * 0.48 * c.engine) : rawThrustN;

    // Ground Effect (increases lift & reduces induced drag within 0.6 wingspans of ground)
    const geRatio = clamp(aglM / Math.max(6, sp.wingspan * 0.6), 0, 1);
    const groundEffectLift = 1 + 0.16 * Math.pow(1 - geRatio, 2);
    const groundEffectDrag = 1 - 0.25 * Math.pow(1 - geRatio, 2);

    // Drag calibration so aircraft naturally achieves real maxKnots at full throttle
    const vMaxMs = sp.maxKnots * KT_TO_MS;
    const baseCd0 = (maxDryThrustN * sp.afterburnerMult * 0.86) / (0.5 * RHO0 * vMaxMs * vMaxMs * sp.wingArea);
    const waveDrag = (mach > 0.84 && !sp.hasAfterburner) ? Math.pow((mach - 0.84) * 5, 2) * 0.06 : (transonic ? 0.018 : 0);
    const flapDrag = 0.055 * this.flapsPos * this.flapsPos;
    const gearDrag = 0.026 * this.gearPos;
    const spoilerDrag = 0.11 * this.spoilerPos;

    // Angle of attack & Lift Coefficient
    const alpha0 = -2.2 - 3.2 * this.flapsPos;
    const alphaCrit = 16.0 - 1.5 * this.flapsPos;
    const clSlopePerDeg = clMaxClean / (16.0 - (-2.2));
    const currentAoA = this.onGround ? att.pitch : (att.pitch - this.gammaDeg);

    let cl;
    if (currentAoA <= alphaCrit) {
      cl = (currentAoA - alpha0) * clSlopePerDeg * (1 + 0.35 * this.flapsPos);
    } else {
      // Smooth post-stall lift decay
      const over = currentAoA - alphaCrit;
      const peakCl = (alphaCrit - alpha0) * clSlopePerDeg * (1 + 0.35 * this.flapsPos);
      cl = Math.max(0.25, peakCl * Math.exp(-over * 0.09));
    }
    cl = clamp(cl, -0.8, clMaxClean * 1.85);

    const inducedK = (1 / (Math.PI * 7.5 * 0.82)) * groundEffectDrag;
    const cd = Math.max(0.014, baseCd0 + inducedK * cl * cl + flapDrag + gearDrag + spoilerDrag + waveDrag);

    const liftN = qBar * sp.wingArea * cl * groundEffectLift * (1 - 0.18 * this.spoilerPos);
    const dragN = qBar * sp.wingArea * cd;

    // Dynamic control effectiveness factor
    const qDyn = clamp(iasKt / Math.max(55, effectiveStallKt * 0.85), 0.18, 1.35);

    // Warnings
    const isStall = !this.onGround && aglFt > 25 && (iasKt < effectiveStallKt * 0.96 || currentAoA > alphaCrit + 1.2);
    const isOverspeed = iasKt > sp.vmoKnots || mach > sp.mmo;
    const isFlapOverspeed = this.flapsPos > 0.08 && iasKt > sp.vfeKnots;
    const isGearWarn = !this.onGround && aglFt < 520 && this.vz < -1.2 && this.gearPos < 0.85 && c.throttle < 0.65;

    let nextRoll = att.roll;
    let nextPitch = att.pitch;
    let nextYaw = att.yaw;
    let nextV = V;
    let nextVz = this.vz;
    let nextAlt = this.s.alt;
    let crashed = false;

    if (this.onGround) {
      // ==================== GROUND ROLL, TAKEOFF & TAXI ====================
      // Wings smoothly level on landing gear struts
      nextRoll = att.roll * Math.exp(-10 * dt);
      this.rollRate = 0;

      // Weight on wheels (decreases as wing generates lift -> realistic brake grip & rotation)
      const normalForceN = Math.max(0, weightN - liftN);
      const surfaceMu = onRunwaySurface ? 0.018 : 0.055;
      const brakingActive = c.wheelBrake > 0.05 || c.parkingBrake;
      const brakeMu = c.parkingBrake ? 0.55 : (c.wheelBrake * 0.46);
      const rollingDragN = normalForceN * (surfaceMu + brakeMu);

      // Longitudinal ground acceleration
      let accelGround = (netThrustN - dragN - rollingDragN) / sp.mass;
      if (V < 0.5 && c.parkingBrake && c.throttle < 0.55) {
        accelGround = 0;
        nextV = 0;
      } else {
        nextV = Math.max(0, V + accelGround * dt);
      }

      // Nosewheel steering (high authority at taxi speeds, gentle & steady at high takeoff roll speeds)
      const steerAuth = nextV > 0.5 ? clamp(nextV / 8, 0.15, 1.0) * clamp(1.3 - iasKt / 180, 0.32, 1.0) : 0;
      const groundYawRate = (c.rudder * 34 + c.aileron * 14) * steerAuth;
      nextYaw = (att.yaw + groundYawRate * dt + 360) % 360;
      this.yawRate = groundYawRate;

      // Takeoff callouts (80 kt, V1, Rotate) when accelerating with takeoff thrust
      if (c.throttle > 0.6 && !c.reverseThrust) {
        if (!this.callouts.v80 && iasKt >= 80) {
          this.callouts.v80 = true;
          events.v80 = true;
        }
        if (!this.callouts.v1 && iasKt >= sp.v1Knots) {
          this.callouts.v1 = true;
          events.v1 = true;
        }
        if (!this.callouts.vr && iasKt >= sp.vrKnots) {
          this.callouts.vr = true;
          events.vr = true;
        }
      }

      // Elevator pitch rotation on runway (nosewheel lifts smoothly as elevator authority builds)
      const elevAuth = clamp((iasKt - sp.vrKnots * 0.52) / (sp.vrKnots * 0.48), 0, 1);
      const targetPitchRate = c.elevator > 0
        ? (c.elevator * 11.5 * elevAuth)
        : (att.pitch > 0.1 ? -Math.max(4.5, Math.abs(c.elevator) * 14) : 0);
      // Gravity gently lowers nosewheel if speed drops or elevator released
      const noseDrop = (Math.abs(c.elevator) < 0.05 && att.pitch > 0) ? -att.pitch * 2.2 : 0;
      this.pitchRate += ((targetPitchRate + noseDrop) - this.pitchRate) * Math.min(1, dt * 7.0);
      nextPitch = clamp(att.pitch + this.pitchRate * dt, 0, 13.5);

      // Pure aerodynamic liftoff check!
      // Lifts off when wings generate sufficient lift (> weight) with positive pitch OR manual rotation past VR
      const liftRatio = liftN / weightN;
      const canLiftoff = (iasKt >= sp.vrKnots * 0.92 && nextPitch >= 3.2 && liftRatio >= 0.88)
        || (iasKt >= sp.vrKnots * 1.18 && nextPitch >= 2.0);

      if (canLiftoff && !brakingActive && !c.reverseThrust) {
        this.onGround = false;
        this.airborneTime = 0;
        events.liftoff = true;
        nextVz = Math.max(2.0, Math.sin(nextPitch * DEG) * nextV * 0.65);
        nextAlt = this.groundElev + 0.35;
        this.callouts.posRate = false;
      } else {
        nextVz = 0;
        nextAlt = this.groundElev;
      }

      this.gammaDeg = 0;
      this.aoaDeg = nextPitch;
      this.slipDeg = 0;
    } else {
      // ==================== AIRBORNE 6-DOF FLIGHT ====================
      this.airborneTime += dt;

      // Positive rate climbout callout (~35 ft AGL after liftoff)
      if (!this.callouts.posRate && this.airborneTime > 1.5 && aglFt > 35 && this.vz > 2.2) {
        this.callouts.posRate = true;
        events.positiveRate = true;
      }

      // Roll dynamics: crisp command + gentle dihedral stability + stall wing-drop buffet
      const rollDamp = Math.abs(c.aileron) < 0.04 ? (-att.roll * 0.22) : 0;
      const stallWingDrop = isStall ? (Math.sin(this.simTime * 4.5) * 18) : 0;
      const targetRollRate = (c.aileron * sp.rollMaxRate + rollDamp) * clamp(qDyn, 0.3, 1.15) + turbRoll + stallWingDrop;
      this.rollRate += (targetRollRate - this.rollRate) * Math.min(1, dt * 7.5);
      nextRoll = clamp(att.roll + this.rollRate * dt, -82, 82);

      // Pitch dynamics: elevator + pilot pitch trim + speed stability + stall nose drop
      const trimPitchTarget = 1.6 + c.pitchTrim * 9.0 + this.flapsPos * 1.2;
      const autoStability = Math.abs(c.elevator) < 0.04 ? ((trimPitchTarget - att.pitch) * 0.42) : 0;
      const stallPitchBreak = isStall ? -15.5 : 0;
      const targetPitchRate = (c.elevator * sp.pitchMaxRate + autoStability - this.pitchRate * 0.35) * clamp(qDyn, 0.32, 1.15)
        + stallPitchBreak + turbPitch;
      this.pitchRate += (targetPitchRate - this.pitchRate) * Math.min(1, dt * 6.0);
      nextPitch = clamp(att.pitch + this.pitchRate * dt, -60, 60);

      // Coordinated Turn & Adverse Yaw / Rudder Sideslip
      const coordinatedTurnDegS = (Math.tan(clamp(nextRoll, -75, 75) * DEG) * G0 / Math.max(22, V)) * RAD;
      const rudderDegS = c.rudder * 28 * clamp(qDyn, 0.3, 1.1);
      this.yawRate += ((coordinatedTurnDegS + rudderDegS) - this.yawRate) * Math.min(1, dt * 7.0);
      nextYaw = (att.yaw + this.yawRate * dt + 360) % 360;
      this.slipDeg += ((c.rudder * 10 - this.slipDeg) * Math.min(1, dt * 5));

      // True Aerodynamic Vertical & Forward Energy Equations
      const bankCos = Math.cos(nextRoll * DEG);
      // Target flight path vertical speed combining wing lift/weight balance and pitch trajectory
      const idealLiftRatio = clamp(liftN / weightN, 0.25, 2.4);
      const pitchVz = Math.sin(nextPitch * DEG) * V * Math.abs(bankCos);
      // Energy-aware climb/sink: insufficient lift (too slow or banked steeply without pull) causes real sink!
      const liftDeficitVz = (idealLiftRatio * Math.abs(bankCos) - 1.0) * 14.5;
      const stallSinkVz = isStall ? -14.0 : 0;
      const flapSinkCue = -this.flapsPos * 1.4; // slight drag-induced glide sink when idle
      const desiredVz = pitchVz + liftDeficitVz + stallSinkVz + flapSinkCue + (turbPitch * 0.35);

      nextVz = this.vz + (desiredVz - this.vz) * Math.min(1, dt * 3.8);
      nextVz = clamp(nextVz, -65, 65);

      const newGammaRad = Math.asin(clamp(nextVz / Math.max(15, V), -0.95, 0.95));
      this.gammaDeg = newGammaRad * RAD;
      this.aoaDeg = clamp(nextPitch - this.gammaDeg, -20, 32);

      // Forward Airspeed Energy Equation: T - D - mg sin(gamma)
      // Climbing naturally bleeds airspeed; diving accelerates; airbrakes/flaps/gear slow you down!
      const accelMs2 = (netThrustN - dragN) / sp.mass - G0 * Math.sin(newGammaRad);
      // Smooth aerodynamic speed cap near structural limits
      nextV = clamp(V + accelMs2 * dt, 18, vMaxMs * 1.15);

      // Altitude integration
      nextAlt = this.s.alt + nextVz * dt;

      // GPWS Radio Altimeter Callouts on Descent (500, 400, 300, 200, 100, 50, 40, 30, 20, 10, RETARD)
      const newAglFt = Math.max(0, (nextAlt - this.groundElev) * M_TO_FT);
      if (nextVz < -0.5 && this.airborneTime > 3.0) {
        const thresholds = [500, 400, 300, 200, 100, 50, 40, 30, 20, 10];
        for (const ft of thresholds) {
          if (this.callouts.lastGpwsFt > ft && newAglFt <= ft) {
            events.gpwsAlt = ft;
            break;
          }
        }
        if (this.callouts.lastGpwsFt > 22 && newAglFt <= 22 && c.throttle > 0.12 && sp.id !== 'f16') {
          events.retard = true;
        }
      }
      this.callouts.lastGpwsFt = newAglFt;

      // GPWS Hazard Alerts
      const vsFpmNow = nextVz * MS_TO_FPM;
      let gpwsAlert = '';
      if (newAglFt < 260 && vsFpmNow < -1600) gpwsAlert = 'PULL UP';
      else if (newAglFt < 480 && vsFpmNow < -1100) gpwsAlert = 'SINK RATE';
      else if (isGearWarn) gpwsAlert = 'TOO LOW, GEAR';
      else if (Math.abs(nextRoll) > 48 && newAglFt < 300) gpwsAlert = 'BANK ANGLE';
      if (gpwsAlert && (this.simTime - this.callouts.lastWarnTime) > 2.4) {
        this.callouts.lastWarnTime = this.simTime;
        events.gpwsAlert = gpwsAlert;
      }

      // ==================== GROUND CONTACT, TOUCHDOWN & BOUNCE ====================
      if (this.airborneTime > 0.65 && nextAlt <= this.groundElev + 0.18 && nextVz <= 0.1) {
        const touchFpm = Math.round(nextVz * MS_TO_FPM);
        const gearReady = this.gearPos >= 0.82;

        if (!gearReady) {
          // Gear-up impact!
          crashed = true;
          nextAlt = this.groundElev;
          this.crashReason = 'LANDING GEAR RETRACTED — BELLY IMPACT';
          nextV = 0;
          nextVz = 0;
        } else if (touchFpm >= -520 && Math.abs(nextRoll) <= 15 && nextPitch >= -4.5 && nextPitch <= 19) {
          // SAFE LANDING TOUCHDOWN!
          nextAlt = this.groundElev;
          this.onGround = true;
          this.airborneTime = 0;

          // Grade landing quality like real airline Flight Operations Quality Assurance (FOQA)
          let grade = 'FIRM LANDING';
          let stars = 2;
          if (touchFpm >= -120) { grade = 'BUTTER LANDING'; stars = 5; }
          else if (touchFpm >= -220) { grade = 'SMOOTH LANDING'; stars = 4; }
          else if (touchFpm >= -350) { grade = 'GOOD LANDING'; stars = 3; }

          const touchG = Number((1.0 + Math.abs(nextVz) * 0.28).toFixed(2));
          const summary = {
            fpm: touchFpm,
            iasKt: Math.round(iasKt),
            pitch: Number(nextPitch.toFixed(1)),
            roll: Number(nextRoll.toFixed(1)),
            g: touchG,
            grade,
            stars,
            onRunway: !!onRunwaySurface
          };
          this.callouts.lastLandingGrade = summary;
          events.touchdown = summary;

          // Reset takeoff callouts so pilot can roll to stop or perform a touch-and-go
          this.callouts.v80 = false;
          this.callouts.v1 = false;
          this.callouts.vr = false;

          nextVz = 0;
          nextRoll = 0;
          nextPitch = Math.max(0, nextPitch * 0.45);
          this.pitchRate = 0;
          this.rollRate = 0;
        } else if (touchFpm >= -760 && Math.abs(nextRoll) <= 20 && nextPitch >= -6 && nextPitch <= 22) {
          // HARD TOUCHDOWN -> REALISTIC OLEO STRUT BOUNCE (recoverable!)
          nextAlt = this.groundElev + 0.45;
          nextVz = Math.min(4.2, Math.abs(nextVz) * 0.36);
          nextPitch = clamp(nextPitch + 1.5, 0, 12);
          events.bounce = { fpm: touchFpm, iasKt: Math.round(iasKt) };
        } else {
          // CATASTROPHIC IMPACT
          crashed = true;
          nextAlt = this.groundElev;
          this.crashReason = touchFpm < -760
            ? `EXCESSIVE SINK RATE (${touchFpm} FPM)`
            : Math.abs(nextRoll) > 20
              ? 'WINGTIP STRIKE / UNSTABILIZED ROLL'
              : 'NOSE-DOWN HARD GROUND IMPACT';
          nextV = 0;
          nextVz = 0;
        }
      } else if (nextAlt < this.groundElev) {
        nextAlt = this.groundElev;
      }
    }

    // 5. 3D Obstacle & Mountain Collision Detection
    if (!crashed && curLat !== null && curLng !== null) {
      const obsHit = checkObstacleCollision(curLat, curLng, nextAlt, iasKt, this.onGround, this.groundElev);
      if (obsHit.hit) {
        crashed = true;
        this.crashReason = obsHit.name || '3D OBSTACLE COLLISION';
        nextV = 0;
        nextVz = 0;
        this.pitchRate = 0;
        this.rollRate = 0;
        this.yawRate = 0;
      }
    }

    // 6. Commit State & Ground Track Integration (Airspeed + Wind Vector)
    this.s.speed = nextV;
    this.vz = nextVz;
    this.s.alt = clamp(nextAlt, this.groundElev, 18000);
    this.s.pos.z = -this.s.alt;
    this.s.q = qFromEuler(nextRoll, nextPitch, nextYaw);
    this.crashed = crashed;

    const horizAirSpeed = Math.cos(this.gammaDeg * DEG) * nextV;
    const yr = nextYaw * DEG;
    const windEffect = this.onGround ? 0.08 : 1.0;
    const vNorth = Math.cos(yr) * horizAirSpeed + windNorth * windEffect;
    const vEast = Math.sin(yr) * horizAirSpeed + windEast * windEffect;
    const groundSpeedMs = Math.hypot(vNorth, vEast);

    if (!crashed) {
      this.s.pos.x += vNorth * dt; // North (m)
      this.s.pos.y += vEast * dt;  // East (m)
    }

    // 7. G-Force Calculation
    const bankCos = Math.cos(nextRoll * DEG);
    const pitchG = (this.pitchRate * DEG * Math.max(15, nextV)) / G0;
    const gVal = this.onGround
      ? 1.0
      : clamp(1 / Math.max(0.18, Math.abs(bankCos)) + pitchG, -2.5, sp.id === 'f16' ? 9.0 : 3.8);

    const finalAglFt = Math.max(0, (this.s.alt - this.groundElev) * M_TO_FT);
    const vsFpm = Math.round(nextVz * MS_TO_FPM);
    let activeGpws = '';
    if (!this.onGround && !crashed) {
      if (finalAglFt < 260 && vsFpm < -1600) activeGpws = 'PULL UP';
      else if (finalAglFt < 480 && vsFpm < -1100) activeGpws = 'SINK RATE';
      else if (isGearWarn) activeGpws = 'TOO LOW, GEAR';
      else if (Math.abs(nextRoll) > 48 && finalAglFt < 300) activeGpws = 'BANK ANGLE';
    }

    this.last = {
      ias: Math.max(0, nextV * MS_TO_KT * Math.sqrt(atm.sigma)),
      tas: Math.max(0, nextV * MS_TO_KT),
      gs: Math.max(0, groundSpeedMs * MS_TO_KT),
      vs: vsFpm,
      aglFt: finalAglFt,
      euler: { roll: nextRoll, pitch: nextPitch, yaw: nextYaw },
      gamma: this.gammaDeg,
      aoa: Math.round(this.aoaDeg * 10) / 10,
      slip: Math.round(this.slipDeg * 10) / 10,
      g: Math.round(gVal * 100) / 100,
      mach: Math.round((nextV / atm.speedOfSound) * 100) / 100,
      oatC: Math.round(atm.tempC),
      stall: isStall,
      overspeed: isOverspeed,
      flapOverspeed: isFlapOverspeed,
      gearWarn: isGearWarn,
      gpwsAlert: activeGpws,
      crashed,
      crashReason: this.crashReason || '',
      onGround: this.onGround,
      gearPos: this.gearPos,
      flapsPos: this.flapsPos,
      spoilerPos: this.spoilerPos,
      reverseThrust: c.reverseThrust,
      afterburner: isAfterburner,
      transonic,
      fuelPct: Math.round(this.fuelPct),
      windDir: this.weather.windDirDeg,
      windKt: Math.round(windKt),
      events
    };

    return this.last;
  }

  get attitude() {
    return eulerFromQ(this.s.q);
  }
  get ias() {
    return this.last.ias;
  }
  get vs() {
    return this.last.vs;
  }
}
