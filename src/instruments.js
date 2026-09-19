// Lightweight, high-performance Canvas Flight Instruments (GeoFS 3.9 Six-Pack Avionics)
export class FlightInstruments {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.imgs = {};
    this.loadAssets();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  loadAssets() {
    const assets = {
      bg: '/instruments/background.png',
      airspeed: '/instruments/airspeed-raw.png',
      airspeedHand: '/instruments/airspeed-hand.png',
      attitude: '/instruments/attitude.png',
      attitudeHand: '/instruments/attitude-hand.png',
      attitudePointer: '/instruments/attitude-pointer.png',
      altitude: '/instruments/altitude.png',
      compassGrad: '/instruments/compass-grad.png',
      compassHand: '/instruments/compass-hand.png'
    };
    Object.entries(assets).forEach(([k, url]) => {
      const img = new Image();
      img.src = url;
      img.onload = () => { this.imgs[k] = img; };
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 420;
    this.height = rect.height || 140;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  draw({ ias = 0, altFt = 0, pitch = 0, roll = 0, hdg = 0, vs = 0, thr = 0.5, g = 1.0 }) {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // 3 Gauge Cluster: [ SPEEDOMETER ]  [ ATTITUDE HORIZON ]  [ ALTIMETER / COMPASS ]
    const gaugeRadius = Math.min(56, (this.height - 18) / 2);
    const cy = this.height / 2;

    // 1. Airspeed Indicator (Speedometer)
    const cxSpeed = gaugeRadius + 14;
    this.drawSpeedometer(ctx, cxSpeed, cy, gaugeRadius, ias);

    // 2. Primary Attitude Indicator (Artificial Horizon)
    const cxAtt = this.width / 2;
    this.drawAttitude(ctx, cxAtt, cy, gaugeRadius, pitch, roll);

    // 3. Altimeter / Heading
    const cxAlt = this.width - gaugeRadius - 14;
    this.drawAltimeter(ctx, cxAlt, cy, gaugeRadius, altFt, vs);

    ctx.restore();
  }

  // --- 1. AIRSPEED INDICATOR (SPEEDOMETER) ---
  drawSpeedometer(ctx, cx, cy, r, ias) {
    ctx.save();
    ctx.translate(cx, cy);

    // Outer bezel or GeoFS raw texture
    if (this.imgs.airspeed) {
      ctx.drawImage(this.imgs.airspeed, -r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#06121f';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e3a5f';
      ctx.stroke();

      // Colored speed arcs (0 - 450 kt)
      // 0 kt at -140 deg, 450 kt at +140 deg (total 280 deg span)
      const speedToAngle = s => {
        const frac = Math.max(0, Math.min(450, s)) / 450;
        return (-140 + frac * 280) * (Math.PI / 180);
      };

      // White flap arc (45 - 120 kt)
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, speedToAngle(45), speedToAngle(120));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Green normal arc (80 - 320 kt)
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, speedToAngle(80), speedToAngle(320));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#22c55e';
      ctx.stroke();

      // Yellow caution arc (320 - 420 kt)
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, speedToAngle(320), speedToAngle(420));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#eab308';
      ctx.stroke();

      // Redline Vne (420 - 450 kt)
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, speedToAngle(420), speedToAngle(450));
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();

      // Dial Ticks & Markings
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let s = 0; s <= 400; s += 50) {
        const ang = speedToAngle(s);
        const x1 = Math.cos(ang) * (r - 10);
        const y1 = Math.sin(ang) * (r - 10);
        const x2 = Math.cos(ang) * (r - 4);
        const y2 = Math.sin(ang) * (r - 4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        const tx = Math.cos(ang) * (r - 18);
        const ty = Math.sin(ang) * (r - 18);
        ctx.fillText(String(s), tx, ty);
      }
    }

    const speedToAngle = s => {
      const frac = Math.max(0, Math.min(450, s)) / 450;
      return (-140 + frac * 280) * (Math.PI / 180);
    };

    // Needle
    const needleAng = speedToAngle(ias);
    ctx.save();
    ctx.rotate(needleAng);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(r - 8, 0);
    ctx.lineTo(-2, -2);
    ctx.closePath();
    ctx.fillStyle = '#6ee7ff';
    ctx.shadowColor = '#6ee7ff';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();

    // Center Cap & Digital IAS
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title & Digital Speed
    ctx.fillStyle = '#6ee7ff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${Math.round(ias)} KT`, 0, r / 2.2);

    ctx.fillStyle = '#64748b';
    ctx.font = '7px monospace';
    ctx.fillText('AIRSPEED', 0, -r / 2.5);

    ctx.restore();
  }

  // --- 2. ATTITUDE INDICATOR (ARTIFICIAL HORIZON) ---
  drawAttitude(ctx, cx, cy, r, pitch, roll) {
    ctx.save();
    ctx.translate(cx, cy);

    // Circular mask
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    // Sky & Ground rotation based on pitch & roll
    ctx.save();
    ctx.rotate(-roll * (Math.PI / 180));
    const pitchOffset = (pitch / 90) * (r * 1.8);
    ctx.translate(0, pitchOffset);

    // Blue Sky
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-r * 2, -r * 3, r * 4, r * 3);

    // Brown Earth
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-r * 2, 0, r * 4, r * 3);

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(-r * 2, 0);
    ctx.lineTo(r * 2, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Pitch Ladder (-30 to +30 deg)
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = -30; deg <= 30; deg += 10) {
      if (deg === 0) continue;
      const y = -(deg / 90) * (r * 1.8);
      const barW = Math.abs(deg) % 20 === 0 ? 24 : 14;
      ctx.beginPath();
      ctx.moveTo(-barW, y);
      ctx.lineTo(barW, y);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (Math.abs(deg) % 20 === 0) {
        ctx.fillText(String(Math.abs(deg)), -barW - 8, y);
        ctx.fillText(String(Math.abs(deg)), barW + 8, y);
      }
    }
    ctx.restore();

    // Fixed Aircraft Reference Symbol (Wings & Dot) or GeoFS attitude pointer
    if (this.imgs.attitudePointer) {
      ctx.drawImage(this.imgs.attitudePointer, -r, -r, r * 2, r * 2);
    } else {
      ctx.strokeStyle = '#f59e0b';
      ctx.fillStyle = '#f59e0b';
      ctx.lineWidth = 3;

      // Left wing
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.2, 0);
      ctx.lineTo(-r * 0.2, 6);
      ctx.stroke();

      // Right wing
      ctx.beginPath();
      ctx.moveTo(r * 0.55, 0);
      ctx.lineTo(r * 0.2, 0);
      ctx.lineTo(r * 0.2, 6);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bezel ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e3a5f';
    ctx.stroke();

    ctx.restore();
  }

  // --- 3. ALTIMETER & VERTICAL SPEED ---
  drawAltimeter(ctx, cx, cy, r, altFt, vs) {
    ctx.save();
    ctx.translate(cx, cy);

    // Bezel or GeoFS altitude dial texture
    if (this.imgs.altitude) {
      ctx.drawImage(this.imgs.altitude, -r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#06121f';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e3a5f';
      ctx.stroke();

      // Numbers 0 to 9 (hundreds of feet)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let n = 0; n < 10; n++) {
        const ang = (-90 + n * 36) * (Math.PI / 180);
        const x1 = Math.cos(ang) * (r - 8);
        const y1 = Math.sin(ang) * (r - 8);
        const x2 = Math.cos(ang) * (r - 4);
        const y2 = Math.sin(ang) * (r - 4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        const tx = Math.cos(ang) * (r - 16);
        const ty = Math.sin(ang) * (r - 16);
        ctx.fillText(String(n), tx, ty);
      }
    }

    // Needle 1: Hundreds needle (completes 1 turn every 1,000 ft)
    const hundredsAng = (-90 + (altFt % 1000) * 0.36) * (Math.PI / 180);
    ctx.save();
    ctx.rotate(hundredsAng);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(r - 8, 0);
    ctx.lineTo(-2, -2);
    ctx.closePath();
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();

    // Center Cap & Digital Readout
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Digital Altitude
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${Math.round(altFt)} FT`, 0, r / 2.2);

    ctx.fillStyle = '#64748b';
    ctx.font = '7px monospace';
    ctx.fillText('ALTITUDE', 0, -r / 2.5);

    ctx.restore();
  }
}
