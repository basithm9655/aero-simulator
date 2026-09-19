import { checkObstacleCollision } from './obstacles.js';

const DEG = Math.PI / 180, RAD = 180 / Math.PI;
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

// High-fidelity Aerodynamic Driving Model
export class FlightModel {
  constructor() {
    this.controls = {
      aileron: 0,
      elevator: 0,
      rudder: 0,
      throttle: 0.85,
      engine: 0.85,
      airbrake: 0,
      pitchTrim: 0.05
    };
    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;
    this.mass = 20000;
    this.cruiseSpeed = 135; // m/s (~260 kt)
    this.stallSpeed = 55; // m/s (~108 kt)
    this.dragFactor = 0.65;
    this.crashReason = '';
    this.reset();
  }

  setSpecs(specs = {}) {
    if (specs.mass) this.mass = specs.mass;
    if (specs.cruiseKnots) this.cruiseSpeed = specs.cruiseKnots / 1.943844;
    if (specs.stallKnots) this.stallSpeed = specs.stallKnots / 1.943844;
    if (specs.dragFactor) this.dragFactor = specs.dragFactor;
  }

  reset(startAlt = 404, startHdg = 50, onRunway = true, groundElev = 404, initialSpeed = 0, initialThrottle = null) {
    this.groundElev = Number.isFinite(groundElev) ? groundElev : 404;
    this.onGround = !!onRunway;
    this.crashed = false;
    this.crashReason = '';
    this.touchdownEvent = false;
    this.liftoffEvent = false;
    this.airborneTime = onRunway ? 0 : 10.0;

    // Runway Takeoff: start with rolling thrust so the aircraft accelerates realistically down the runway
    const startSpeed = onRunway ? (initialSpeed ? initialSpeed / 1.943844 : 10) : (initialSpeed ? initialSpeed / 1.943844 : 85);
    this.s = {
      alt: onRunway ? this.groundElev : startAlt,
      speed: startSpeed,
      pos: { x: 0, y: 0, z: -(onRunway ? this.groundElev : startAlt) },
      q: qFromEuler(0, onRunway ? 0 : 1.8, startHdg)
    };
    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;
    this.controls.throttle = (initialThrottle !== null) ? initialThrottle : (onRunway ? 0.85 : 0.60);
    this.controls.engine = this.controls.throttle;
    this.controls.elevator = 0;
    this.controls.aileron = 0;
    this.controls.rudder = 0;
    this.controls.airbrake = 0;
    this.last = {
      ias: startSpeed * 1.943844,
      vs: 0,
      euler: { roll: 0, pitch: onRunway ? 0 : 1.8, yaw: startHdg },
      aoa: 0,
      g: 1.0,
      mach: 0,
      stall: false,
      crashed: false,
      crashReason: '',
      onGround: this.onGround
    };
  }

  step(dt, curLat = null, curLng = null) {
    dt = clamp(dt, 0.005, 0.04);
    const c = this.controls;
    const att = eulerFromQ(this.s.q);
    this.touchdownEvent = false;
    this.liftoffEvent = false;

    // Engine spool physics
    c.engine += (c.throttle - c.engine) * Math.min(1, dt * 2.5);

    // Speed target: On runway ground roll vs Airborne flight
    const airbrakeDrag = c.airbrake ? 0.35 : 0;
    const maxSpeed = this.cruiseSpeed * 1.20;
    const idleSpeed = this.onGround ? 0 : this.stallSpeed * 0.80;
    const targetSpeed = Math.max(
      0,
      (idleSpeed + c.engine * (maxSpeed - idleSpeed)) * (1 - airbrakeDrag) - Math.sin(att.pitch * DEG) * 20
    );

    // Inertial acceleration based on aircraft mass
    const accelRate = clamp(1.8 * Math.pow(15000 / this.mass, 0.45), 0.4, 2.5);
    this.s.speed += (targetSpeed - this.s.speed) * Math.min(1, dt * accelRate);

    // Wheel braking and rolling friction on ground
    if (this.onGround && c.airbrake) {
      this.s.speed = Math.max(0, this.s.speed - dt * 15.0);
    }
    const V = Math.max(0, this.s.speed);
    const iasKt = V * 1.943844;

    // Dynamic pressure
    const qDyn = clamp(iasKt / 90, 0.2, 1.25);
    const isStall = !this.onGround && (iasKt < (this.stallSpeed * 1.943844 * 0.75) || att.pitch > 32);

    let nextRoll = att.roll;
    let nextPitch = att.pitch;
    let nextYaw = att.yaw;
    let climbSpeed = 0;

    if (this.onGround) {
      // --- RUNWAY GROUND ROLL & NOSEWHEEL STEERING ---
      // Wings stay level on tarmac / ground
      nextRoll = 0;
      this.rollRate = 0;

      // Nosewheel steering on ground via rudder + aileron
      const steerFactor = clamp(iasKt / 12, 0.15, 1.0);
      const groundYawRate = (c.rudder * 30 + c.aileron * 12) * steerFactor;
      nextYaw = (att.yaw + groundYawRate * dt + 360) % 360;

      // Elevator pitch rotation on ground
      const rotationSpeedKt = this.stallSpeed * 1.943844 * 1.08;
      const rotTorque = clamp(c.elevator * 12.0 * qDyn, 0, 12);
      this.pitchRate += (rotTorque - this.pitchRate) * Math.min(1, dt * 6.0);
      nextPitch = clamp(att.pitch + this.pitchRate * dt, 0, 12);

      // Natural aerodynamic lift rotation at high runway speed (prevents overshooting runway)
      const autoRotateSpeedKt = rotationSpeedKt * 1.20;
      if (iasKt >= autoRotateSpeedKt && nextPitch < 3.5) {
        this.pitchRate += (4.0 - nextPitch) * Math.min(1, dt * 3.0);
        nextPitch = clamp(att.pitch + this.pitchRate * dt, 0, 10);
      }

      // Liftoff Condition: Airspeed reaches rotation threshold AND positive pitch rotation (> 2.8°)
      if ((iasKt >= rotationSpeedKt && nextPitch >= 2.8) || iasKt >= autoRotateSpeedKt) {
        this.onGround = false;
        this.liftoffEvent = true;
        this.airborneTime = 0;
        climbSpeed = Math.max(1.8, Math.sin(Math.max(0.04, nextPitch * DEG)) * V);
      } else {
        climbSpeed = 0;
      }
    } else {
      this.airborneTime = (this.airborneTime || 0) + dt;
      // --- AIRBORNE AERODYNAMICS & STABILITY ---
      const maxRollRate = this.mass > 100000 ? 25 : (this.mass > 10000 ? 65 : 45);
      const rollSelfLevel = (Math.abs(c.aileron) < 0.05) ? (-att.roll * 0.45) : 0;
      const targetRollRate = (c.aileron * maxRollRate + rollSelfLevel) * qDyn;
      this.rollRate += (targetRollRate - this.rollRate) * Math.min(1, dt * 6.5);
      nextRoll = clamp(att.roll + this.rollRate * dt, -65, 65);

      // Natural longitudinal stability (neutral elevator restores to cruise trim + pitch damping)
      const cruiseTrimPitch = 1.8;
      const pitchSelfTrim = (Math.abs(c.elevator) < 0.05) ? ((cruiseTrimPitch - att.pitch) * 0.55) : 0;
      const pitchDamping = -this.pitchRate * 0.45;
      const stallDrop = isStall ? -14 : 0;
      const targetPitchRate = ((c.elevator * 26 + pitchSelfTrim + pitchDamping) * qDyn + stallDrop);
      this.pitchRate += (targetPitchRate - this.pitchRate) * Math.min(1, dt * 5.0);
      nextPitch = clamp(att.pitch + this.pitchRate * dt, -45, 45);

      // Coordinated banking turn
      const coordinatedTurnRate = (Math.tan(nextRoll * DEG) * 9.80665 / Math.max(15, V)) * RAD;
      const rudderRate = c.rudder * 34 * qDyn;
      this.yawRate += ((coordinatedTurnRate + rudderRate) - this.yawRate) * Math.min(1, dt * 8.0);
      nextYaw = (att.yaw + this.yawRate * dt + 360) % 360;

      // Vertical lift component
      const bankFactor = Math.cos(nextRoll * DEG);
      climbSpeed = (Math.sin(nextPitch * DEG) * V * bankFactor) - ((1 - Math.abs(bankFactor)) * 14) + (isStall ? -22 : 0);
    }

    // Update quaternion attitude
    this.s.q = qFromEuler(nextRoll, nextPitch, nextYaw);

    // Altitude & Ground Contact Detection
    const ground = this.groundElev;
    let crashed = false;
    let nextAlt = this.s.alt + climbSpeed * dt;

    if (!this.onGround) {
      // ONLY trigger touchdown if descending towards the ground (climbSpeed < -0.1)
      // after having been airborne for more than 0.6s (avoids false touchdown during initial takeoff rotation)
      if (this.airborneTime > 0.6 && climbSpeed < -0.1 && nextAlt <= ground + 0.15) {
        nextAlt = ground;
        // SAFE LANDING ROLLOUT ANYWHERE ON EARTH vs CRASH
        const isGentleTouchdown = climbSpeed >= -4.8 && Math.abs(nextPitch) <= 14 && Math.abs(nextRoll) <= 12 && iasKt <= 215;
        if (isGentleTouchdown) {
          this.onGround = true;
          this.touchdownEvent = true;
          this.airborneTime = 0;
          climbSpeed = 0;
          nextRoll = 0;
          nextPitch = Math.max(0, nextPitch * 0.4);
          this.pitchRate = 0;
          this.rollRate = 0;
        } else {
          crashed = true;
          this.crashReason = climbSpeed < -6.5 ? 'HIGH SINK RATE HARD GROUND IMPACT' : 'UNSTABILIZED LANDING';
          this.s.speed = 0;
          this.pitchRate = 0;
          this.rollRate = 0;
          this.yawRate = 0;
        }
      } else if (nextAlt < ground) {
        nextAlt = ground;
        if (this.airborneTime > 0.6) {
          crashed = true;
          this.crashReason = 'TERRAIN IMPACT';
        }
      }
    }

    // 3D OBSTACLE & MOUNTAIN COLLISION DETECTION
    if (!crashed && curLat !== null && curLng !== null) {
      const obsHit = checkObstacleCollision(curLat, curLng, nextAlt, iasKt, this.onGround, ground);
      if (obsHit.hit) {
        crashed = true;
        this.crashReason = obsHit.name || '3D OBJECT COLLISION';
        this.s.speed = 0;
        this.pitchRate = 0;
        this.rollRate = 0;
        this.yawRate = 0;
      }
    }

    this.s.alt = clamp(nextAlt, ground, 12000);
    this.s.pos.z = -this.s.alt;
    this.crashed = crashed;

    // Forward displacement in North/East coordinates
    const forwardSpeed = Math.cos(nextPitch * DEG) * V;
    const yr = nextYaw * DEG;
    this.s.pos.x += Math.cos(yr) * forwardSpeed * dt; // North
    this.s.pos.y += Math.sin(yr) * forwardSpeed * dt; // East

    // G-Force calculation
    const bankFactor = Math.cos(nextRoll * DEG);
    const gVal = this.onGround ? 1.0 : clamp(1 / Math.max(0.2, Math.abs(bankFactor)) + (this.pitchRate * DEG * Math.max(10, V) / 9.80665), 0.3, 5.0);

    this.last = {
      ias: Math.max(0, iasKt),
      vs: Math.round(climbSpeed * 196.85), // ft/min
      euler: { roll: nextRoll, pitch: nextPitch, yaw: nextYaw },
      aoa: Math.round((nextPitch - (Math.asin(clamp(climbSpeed / Math.max(1, V), -1, 1)) * RAD)) * 10) / 10,
      g: Math.round(gVal * 100) / 100,
      mach: Math.round((V / 340) * 100) / 100,
      stall: isStall,
      crashed: crashed,
      crashReason: this.crashReason || '',
      onGround: this.onGround,
      touchdown: this.touchdownEvent,
      liftoff: this.liftoffEvent
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
