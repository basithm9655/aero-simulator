# CBR VFR-06 · God's Eye Flight Stack

This build adapts the map architecture used by `bilawalsidhu/gods-eye-view` for a Coimbatore flight simulator.

## What was adopted

- CesiumJS viewer instead of Google Maps `gmp-map-3d`.
- Direct Google Photorealistic 3D Tiles when `GOOGLE_MAPS_API_KEY` is configured.
- Cesium ion's hosted Google asset as a second route when `CESIUM_ION_TOKEN` is configured.
- OpenStreetMap imagery fallback when photorealistic 3D is unavailable.
- Cesium camera/earth coordinates for aircraft-following flight views.
- A local GLB aircraft model.
- Existing CBR VFR-style keyboard/gamepad/ESP32 input concepts and a quaternion/RK4 flight foundation.

The Google/ion selection/fallback logic is derived from the public God's Eye View map stack design. See `ATTRIBUTION.md` and the upstream repository.

## Run

1. Install Node.js 24.x.
2. Copy `.env.example` to `.env`.
3. Add a restricted `GOOGLE_MAPS_API_KEY` for photorealistic 3D, or `CESIUM_ION_TOKEN` for the ion route.
4. Run:

```bash
npm install
npm run dev:all   # Runs both Vite on :4173 and WebSocket relay on :3001
```

5. Open `http://localhost:4173`.
6. (Optional) For phone gyro control, open `http://<YOUR_LOCAL_IP>:4173/controller.html` on your mobile phone on the same Wi-Fi.

## Controls & Features

- **W / S**: Pitch down / up (Elevator)
- **A / D**: Roll left / right (Ailerons)
- **Q / E**: Rudder left / right
- **SHIFT / CTRL** or **Mouse Wheel**: Increase / decrease throttle
- **M** or **LAPTOP STICK button**: Toggle interactive on-screen Laptop Flight Stick HUD (drag with mouse/trackpad to fly)
- **V**: Toggle Camera (Cockpit HUD view with banked horizon ⟷ 3rd-person Chase camera)
- **P**: Switch Aircraft (F-16 Thunderbirds ⟷ Airbus A350 Delta)
- **Laptop Controller Web App**: Open `http://localhost:4173/controller.html` to fly using the full-screen interactive artificial horizon flight stick or keyboard
- **Web Serial**: Connect MPU6050 ESP32 IMU via USB
- **Phone Gyro**: Connect mobile device over WebSocket for 60Hz orientation flight control

## VFR route

PSG College of Technology → CODISSIA → Singanallur → CJB Airport → Gandhipuram → Railway Station.

## Hardware

The included `esp32_mpu6050.ino` is compatible with JSON-line serial output at 115200 baud (`{"pitch":..,"roll":..,"yaw":..}`). Chrome/Edge on localhost or HTTPS is recommended for Web Serial.

## Upstream

`https://github.com/bilawalsidhu/gods-eye-view`

God's Eye View is MIT licensed. This project is an independent adaptation; it is not affiliated with the upstream project.
