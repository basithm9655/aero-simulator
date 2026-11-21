// Pro-Grade Electronic Flight Instruments (4-Gauge PFD + HSI + ILS + PAPI)
// Plus Collimated First-Person Cockpit Windshield HUD (Pitch Ladder, FPM, Speed/Alt/Hdg Tapes, ILS)

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FlightInstruments {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 450;
    this.height = rect.height || 106;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(data) {
    const ctx = this.ctx;
    if (!ctx) return;

    const {
      ias = 0,
      mach = 0,
      altFt = 0,
      aglFt = 0,
      pitch = 0,
      roll = 0,
      hdg = 0,
      vs = 0,
      gamma = 0,
      slip = 0,
      stallKt = 115,
      vmoKt = 360,
      ils = null,
      wpBearing = null,
      windDir = 50,
      windKt = 6
    } = data;

    ctx.clearRect(0, 0, this.width, this.height);

    // 4-Instrument Pro Avionics Layout: [ AIRSPEED ]  [ ADI + ILS ]  [ ALT + VSI + PAPI ]  [ HSI COMPASS ]
    const r = Math.min(44, (this.height - 14) / 2);
    const cy = this.height / 2;
    const step = this.width / 4;

    this.drawAirspeed(ctx, step * 0.5, cy, r, ias, mach, stallKt, vmoKt);
    this.drawAttitude(ctx, step * 1.5, cy, r, pitch, roll, gamma, slip, ils);
    this.drawAltimeter(ctx, step * 2.5, cy, r, altFt, aglFt, vs, ils);
    this.drawHSI(ctx, step * 3.5, cy, r, hdg, wpBearing, ils, windDir, windKt);
  }

  drawBezel(ctx, r, accent = '#334155') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#060d18';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r - 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.stroke();
  }

  // 1. AIRSPEED & MACH INDICATOR
  drawAirspeed(ctx, cx, cy, r, ias, mach, stallKt, vmoKt) {
    ctx.save();
    ctx.translate(cx, cy);
    this.drawBezel(ctx, r, '#1e3a5f');

    const maxScale = Math.max(450, Math.ceil(vmoKt / 100) * 100 + 50);
    const toAng = s => (-140 + (clamp(s, 0, maxScale) / maxScale) * 280) * DEG;

    // Stall red arc
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, toAng(0), toAng(stallKt));
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    // Flap white arc
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, toAng(stallKt * 0.8), toAng(Math.min(230, vmoKt * 0.6)));
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    // Normal green arc
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, toAng(stallKt), toAng(vmoKt * 0.88));
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#22c55e';
    ctx.stroke();

    // Caution amber + VMO redline
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, toAng(vmoKt * 0.88), toAng(vmoKt));
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r - 5, toAng(vmoKt), toAng(maxScale));
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    // Ticks
    const tickStep = maxScale > 600 ? 100 : 50;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let s = 0; s <= maxScale; s += tickStep) {
      const ang = toAng(s);
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * (r - 10), Math.sin(ang) * (r - 10));
      ctx.lineTo(Math.cos(ang) * (r - 4), Math.sin(ang) * (r - 4));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
      if (s % (tickStep * 2) === 0 || maxScale <= 500) {
        ctx.fillText(String(s), Math.cos(ang) * (r - 16), Math.sin(ang) * (r - 16));
      }
    }

    // Needle
    ctx.save();
    ctx.rotate(toAng(ias));
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(r - 8, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.round(ias)} KT`, 0, r * 0.44);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillText(`M ${mach.toFixed(2)}`, 0, -r * 0.38);

    ctx.restore();
  }

  // 2. ATTITUDE DIRECTOR INDICATOR (ADI) + FLIGHT PATH VECTOR + ILS DIAMONDS
  drawAttitude(ctx, cx, cy, r, pitch, roll, gamma, slip, ils) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Horizon sky & ground
    ctx.save();
    ctx.rotate(-roll * DEG);
    const pitchPx = (pitch / 45) * (r * 0.95);
    ctx.translate(0, pitchPx);

    const skyGrad = ctx.createLinearGradient(0, -r * 2.5, 0, 0);
    skyGrad.addColorStop(0, '#0c4a6e');
    skyGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-r * 2.5, -r * 3, r * 5, r * 3);

    const gndGrad = ctx.createLinearGradient(0, 0, 0, r * 2.5);
    gndGrad.addColorStop(0, '#78350f');
    gndGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = gndGrad;
    ctx.fillRect(-r * 2.5, 0, r * 5, r * 3);

    ctx.beginPath();
    ctx.moveTo(-r * 2.5, 0);
    ctx.lineTo(r * 2.5, 0);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Pitch ladder
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = -30; deg <= 30; deg += 10) {
      if (deg === 0) continue;
      const y = -(deg / 45) * (r * 0.95);
      const w = Math.abs(deg) % 20 === 0 ? 15 : 8;
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.lineTo(w, y);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.restore();

    // Bank angle arc at top
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    [-45, -30, -20, -10, 0, 10, 20, 30, 45].forEach(deg => {
      const a = (-90 + deg) * DEG;
      const inner = deg === 0 || Math.abs(deg) === 30 ? r - 8 : r - 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
      ctx.stroke();
    });

    // Flight Path Vector (velocity vector / birdie)
    const fpvY = clamp(((pitch - gamma) / 45) * (r * 0.95), -r * 0.65, r * 0.65);
    const fpvX = clamp(slip * 1.4, -r * 0.5, r * 0.5);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(fpvX, fpvY, 3.2, 0, Math.PI * 2);
    ctx.moveTo(fpvX - 7, fpvY);
    ctx.lineTo(fpvX - 3.2, fpvY);
    ctx.moveTo(fpvX + 3.2, fpvY);
    ctx.lineTo(fpvX + 7, fpvY);
    ctx.moveTo(fpvX, fpvY - 3.2);
    ctx.lineTo(fpvX, fpvY - 6.5);
    ctx.stroke();

    // Fixed amber aircraft wing symbol
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.52, 0);
    ctx.lineTo(-r * 0.18, 0);
    ctx.lineTo(-r * 0.18, 4.5);
    ctx.moveTo(r * 0.52, 0);
    ctx.lineTo(r * 0.18, 0);
    ctx.lineTo(r * 0.18, 4.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // ILS Localizer & Glideslope Magenta Diamonds (when tuned)
    if (ils && ils.active && ils.dmeKm < 25) {
      // Localizer bottom scale
      const locY = r - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-r * 0.52, locY - 3, r * 1.04, 6);
      const locX = clamp(-ils.locDev, -1, 1) * (r * 0.44);
      ctx.fillStyle = '#e879f9';
      ctx.beginPath();
      ctx.moveTo(locX, locY - 3.5);
      ctx.lineTo(locX + 3.5, locY);
      ctx.lineTo(locX, locY + 3.5);
      ctx.lineTo(locX - 3.5, locY);
      ctx.closePath();
      ctx.fill();

      // Glideslope right scale
      const gsX = r - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(gsX - 3, -r * 0.48, 6, r * 0.96);
      const gsY = clamp(ils.gsDev, -1, 1) * (r * 0.42);
      ctx.fillStyle = '#e879f9';
      ctx.beginPath();
      ctx.moveTo(gsX, gsY - 3.5);
      ctx.lineTo(gsX + 3.5, gsY);
      ctx.lineTo(gsX, gsY + 3.5);
      ctx.lineTo(gsX - 3.5, gsY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Outer bezel
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e3a5f';
    ctx.stroke();

    ctx.restore();
  }

  // 3. ALTIMETER, VSI & PAPI LIGHTS
  drawAltimeter(ctx, cx, cy, r, altFt, aglFt, vs, ils) {
    ctx.save();
    ctx.translate(cx, cy);
    this.drawBezel(ctx, r, '#1e3a5f');

    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let n = 0; n < 10; n++) {
      const ang = (-90 + n * 36) * DEG;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * (r - 8), Math.sin(ang) * (r - 8));
      ctx.lineTo(Math.cos(ang) * (r - 3.5), Math.sin(ang) * (r - 3.5));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
      ctx.fillText(String(n), Math.cos(ang) * (r - 14.5), Math.sin(ang) * (r - 14.5));
    }

    // 1000-ft short thick needle
    const thousandsAng = (-90 + ((altFt % 10000) / 1000) * 36) * DEG;
    ctx.save();
    ctx.rotate(thousandsAng);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(r * 0.52, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
    ctx.restore();

    // 100-ft long green needle
    const hundredsAng = (-90 + (altFt % 1000) * 0.36) * DEG;
    ctx.save();
    ctx.rotate(hundredsAng);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(r - 7, 0);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#4ade80';
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Digital Altitude & Radar AGL / VSI
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.round(altFt)}`, 0, -r * 0.36);

    const vsColor = vs < -900 ? '#f87171' : vs > 150 ? '#4ade80' : '#94a3b8';
    ctx.fillStyle = vsColor;
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillText(`${vs >= 0 ? '+' : ''}${Math.round(vs / 10) * 10}`, 0, r * 0.32);

    // PAPI 4-Light Visual Glideslope Indicator when below 2500ft AGL near runway
    if (ils && ils.active && aglFt < 2500 && ils.dmeKm < 12) {
      const papiW = ils.papiWhite;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-9 + i * 6, r * 0.58, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = i < papiW ? '#f8fafc' : '#ef4444';
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '6.5px "JetBrains Mono", monospace';
      ctx.fillText(`AGL ${Math.round(aglFt)}`, 0, r * 0.58);
    }

    ctx.restore();
  }

  // 4. HSI COMPASS ROSE + WAYPOINT / RUNWAY COURSE BUG + WIND
  drawHSI(ctx, cx, cy, r, hdg, wpBearing, ils, windDir, windKt) {
    ctx.save();
    ctx.translate(cx, cy);
    this.drawBezel(ctx, r, '#1e3a5f');

    // Rotating compass rose
    ctx.save();
    ctx.rotate(-hdg * DEG);
    const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = 0; deg < 360; deg += 15) {
      const a = (deg - 90) * DEG;
      const major = deg % 30 === 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - (major ? 8 : 5)), Math.sin(a) * (r - (major ? 8 : 5)));
      ctx.lineTo(Math.cos(a) * (r - 2.5), Math.sin(a) * (r - 2.5));
      ctx.lineWidth = major ? 1.3 : 0.8;
      ctx.strokeStyle = deg === 0 ? '#38bdf8' : '#cbd5e1';
      ctx.stroke();

      if (cardinals[deg]) {
        ctx.fillStyle = deg === 0 ? '#38bdf8' : '#e2e8f0';
        ctx.fillText(cardinals[deg], Math.cos(a) * (r - 14), Math.sin(a) * (r - 14));
      }
    }

    // Active Waypoint Bearing Bug (Cyan arrow)
    if (wpBearing !== null && wpBearing !== undefined) {
      const wb = (wpBearing - 90) * DEG;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(wb) * (r - 20), Math.sin(wb) * (r - 20));
      ctx.lineTo(Math.cos(wb) * (r - 7), Math.sin(wb) * (r - 7));
      ctx.stroke();
    }

    // ILS Runway Course Needle (Magenta dashed line)
    if (ils && ils.active) {
      const rc = (ils.runway.heading - 90) * DEG;
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rc) * (r - 12), Math.sin(rc) * (r - 12));
      ctx.lineTo(-Math.cos(rc) * (r - 12), -Math.sin(rc) * (r - 12));
      ctx.stroke();
    }
    ctx.restore();

    // Top lubber triangle
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, -r + 1);
    ctx.lineTo(-3.5, -r - 4);
    ctx.lineTo(3.5, -r - 4);
    ctx.closePath();
    ctx.fill();

    // Miniature aircraft center silhouette
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -1);
    ctx.moveTo(-3.5, 5);
    ctx.lineTo(3.5, 5);
    ctx.stroke();

    // Digital Heading + Wind
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round((hdg + 360) % 360)).padStart(3, '0')}°`, 0, r * 0.45);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '6px "JetBrains Mono", monospace';
    ctx.fillText(`W ${String(Math.round(windDir)).padStart(3, '0')}/${Math.round(windKt)}`, 0, -r * 0.42);

    ctx.restore();
  }
}

// ==================== COLLIMATED COCKPIT WINDSHIELD HUD ====================
export class CockpitHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(a, altFt, ils) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const att = a.euler;
    const hudGreen = '#4ade80';
    const hudWarn = '#f87171';
    const hudColor = (a.stall || a.gpwsAlert) ? '#fbbf24' : hudGreen;

    ctx.save();
    ctx.strokeStyle = hudColor;
    ctx.fillStyle = hudColor;
    ctx.lineWidth = 1.6;
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;

    // 1. Central Pitch Ladder & Horizon Line (clipped to windshield center)
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 190, cy - 155, 380, 310);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-att.roll * DEG);
    const pxPerDeg = 9.5;
    ctx.translate(0, att.pitch * pxPerDeg);

    // Artificial Horizon Line (with center gap)
    ctx.beginPath();
    ctx.moveTo(-175, 0);
    ctx.lineTo(-34, 0);
    ctx.moveTo(34, 0);
    ctx.lineTo(175, 0);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pitch rungs every 5 degrees
    ctx.lineWidth = 1.4;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let deg = -40; deg <= 40; deg += 5) {
      if (deg === 0) continue;
      const y = -deg * pxPerDeg;
      const isNeg = deg < 0;
      const inner = 26;
      const outer = deg % 10 === 0 ? 74 : 52;
      const tick = isNeg ? -7 : 7;

      ctx.setLineDash(isNeg ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(-outer, y);
      ctx.lineTo(-inner, y);
      ctx.lineTo(-inner, y + tick);
      ctx.moveTo(outer, y);
      ctx.lineTo(inner, y);
      ctx.lineTo(inner, y + tick);
      ctx.stroke();

      if (deg % 10 === 0) {
        ctx.setLineDash([]);
        ctx.textAlign = 'right';
        ctx.fillText(String(Math.abs(deg)), -outer - 6, y);
        ctx.textAlign = 'left';
        ctx.fillText(String(Math.abs(deg)), outer + 6, y);
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Boresight Watermark & Flight Path Marker (Velocity Vector)
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.stroke();

    const fpmY = clamp(cy + (att.pitch - a.gamma) * pxPerDeg, cy - 140, cy + 140);
    const fpmX = clamp(cx + (a.slip || 0) * 6, cx - 150, cx + 150);
    ctx.beginPath();
    ctx.arc(fpmX, fpmY, 7, 0, Math.PI * 2);
    ctx.moveTo(fpmX - 18, fpmY);
    ctx.lineTo(fpmX - 7, fpmY);
    ctx.moveTo(fpmX + 7, fpmY);
    ctx.lineTo(fpmX + 18, fpmY);
    ctx.moveTo(fpmX, fpmY - 7);
    ctx.lineTo(fpmX, fpmY - 14);
    ctx.stroke();

    // 3. Left Airspeed Box & Tape
    const spdX = cx - 225;
    ctx.strokeRect(spdX - 58, cy - 16, 56, 32);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(String(Math.round(a.ias)).padStart(3, '0'), spdX - 8, cy);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`M ${a.mach.toFixed(2)}`, spdX - 6, cy + 28);
    ctx.fillText(`G ${a.g.toFixed(1)}`, spdX - 6, cy + 44);
    ctx.fillText(`AOA ${a.aoa.toFixed(1)}°`, spdX - 6, cy + 60);

    // 4. Right Altitude Box & Radar AGL / VSI
    const altX = cx + 225;
    ctx.strokeRect(altX + 2, cy - 16, 68, 32);
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(String(Math.round(altFt)).padStart(4, '0'), altX + 8, cy);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`RALT ${Math.round(a.aglFt)} FT`, altX + 4, cy + 28);
    ctx.fillText(`VS ${a.vs >= 0 ? '+' : ''}${a.vs}`, altX + 4, cy + 44);

    // Gear & Flaps status on HUD
    const gearText = a.gearPos > 0.95 ? 'GEAR DN' : a.gearPos < 0.05 ? 'GEAR UP' : 'GEAR TRN';
    const flapDeg = Math.round(a.flapsPos * 30);
    ctx.fillText(`${gearText} · FLP ${flapDeg}°`, altX + 4, cy + 60);

    // 5. Top Heading Tape
    const hdgY = cy - 176;
    ctx.strokeRect(cx - 26, hdgY - 12, 52, 22);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(String(Math.round((att.yaw + 360) % 360)).padStart(3, '0'), cx, hdgY - 1);

    // 6. ILS Guidance Cross on Windshield when approaching runway
    if (ils && ils.active && ils.dmeKm < 20) {
      ctx.strokeStyle = '#e879f9';
      ctx.fillStyle = '#e879f9';
      const ilsX = cx + clamp(-ils.locDev, -1, 1) * 90;
      const ilsY = cy + clamp(ils.gsDev, -1, 1) * 70;
      ctx.beginPath();
      ctx.moveTo(ilsX - 10, ilsY);
      ctx.lineTo(ilsX + 10, ilsY);
      ctx.moveTo(ilsX, ilsY - 10);
      ctx.lineTo(ilsX, ilsY + 10);
      ctx.stroke();
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`ILS ${ils.runway.icao} RWY ${ils.runway.rwy} · ${ils.dmeNm.toFixed(1)} NM`, cx, cy + 168);
    }

    // 7. Urgent GPWS / Stall / Overspeed Warning Banner
    const alertMsg = a.gpwsAlert || (a.stall ? 'STALL — NOSE DOWN / MAX POWER' : a.overspeed ? 'OVERSPEED — REDUCE THROTTLE' : '');
    if (alertMsg) {
      ctx.fillStyle = hudWarn;
      ctx.strokeStyle = hudWarn;
      ctx.font = 'bold 16px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(alertMsg, cx, cy - 115);
    }

    ctx.restore();
  }
}
