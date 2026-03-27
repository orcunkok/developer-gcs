# SITL TODO

Get ArduPilot SITL running locally and reachable over UDP so the GCS protocol adapter has a real MAVLink stream to consume. Everything else (protocol adapter, state store, UI) depends on this being up first.

---

## 1. Install ArduPilot SITL

- [x] Clone ArduPilot: `git clone https://github.com/ArduPilot/ardupilot.git`
- [X] Install dependencies: `Tools/environment_install/install-prereqs-ubuntu.sh -y` (Ubuntu) or follow the macOS guide
- [X] Reload shell: `. ~/.profile`
- [X] `sim_vehicle.py` is not on PATH by default. Run it via full path or add it:
  ```bash
  # Option A: full path (no setup needed)
  cd ardupilot
  python3 Tools/autotest/sim_vehicle.py -v ArduPlane --console

  # Option B: add to PATH permanently
  echo 'export PATH=$PATH:$HOME/ardupilot/Tools/autotest' >> ~/.bashrc
  source ~/.bashrc
  sim_vehicle.py -v ArduPlane --console
  ```
- [x] Verify it launches: SITL console appears and heartbeat starts streaming

**Reference:** https://ardupilot.org/dev/docs/setting-up-sitl-on-linux.html

---

## 2. Verify MAVLink UDP Stream

- [x] Launch SITL with ArduPlane (fixed-wing matches the project domain):
  ```bash
  cd ardupilot
  . ~/.profile && sim_vehicle.py -v ArduPlane --console --map
  ```
- [x] Confirm SITL broadcasts MAVLink on `udp://127.0.0.1:14550` by default
- [x] Verify stream with `. ~/.profile &&  mavproxy.py --master=udp:127.0.0.1:14550` — should show heartbeat + telemetry
- [x] Note the port; configure it in the GCS connection settings

---

## 3. Confirm Minimum Sensor Outputs

SITL must emit these MAVLink messages for the GCS protocol adapter to consume:

| Message | Fields needed |
|---------|--------------|
| `HEARTBEAT` | base mode, custom mode (flight mode), system status |
| `ATTITUDE` | roll, pitch, yaw, rollspeed, pitchspeed, yawspeed |
| `VFR_HUD` | airspeed, groundspeed, heading, throttle, alt, climb |
| `GPS_RAW_INT` | lat, lon, alt, satellites visible, fix type |
| `SYS_STATUS` | battery voltage, current, remaining % |
| `GLOBAL_POSITION_INT` | lat, lon, alt, relative alt, vx/vy/vz, hdg |
| `RC_CHANNELS` | channel values (for aileron deflection correlation in FLY workspace) |

- [x] Confirm each message appears in mavproxy output or via `--console` in SITL

---

## 4. Load a Repeatable Test Mission

- [x] Write a plain YAML mission that maps to MAVLink waypoint format:
  ```
  takeoff → cruise to 3 waypoints → return to launch → land
  ```
  File: `sitl/test_mission.yaml`
- [x] Convert to `.waypoints` format (QGC-compatible) for loading into SITL
  File: `sitl/test_mission.waypoints`
- [x] Load via mavproxy: `wp load sitl/test_mission.waypoints`
- [x] Verify aircraft executes the full sequence in AUTO mode
- [x] Save the `.waypoints` file at `sitl/test_mission.waypoints` in the repo

---

## 5. Failure Injection Tests

SITL supports failure simulation via `param set` and MAVLink commands. Verify each:

- [x] **GPS dropout:** `param set SIM_GPS1_ENABLE 0` → observe `GPS_RAW_INT` fix_type drops
- [x] **GPS noise:** `param set SIM_GPS1_NOISE 5` → position jitter visible
- [ ] **Sensor noise (IMU):** `param set SIM_ACC1_BIAS_X 0.5` → attitude drift visible
- [ ] Document the param names and reset values in a table at the bottom of this file

---

## 6. JSBSim Upgrade (Nice to Have)

The default ArduPilot built-in physics model is sufficient for GCS/adapter development. Switch to JSBSim when you need realistic fixed-wing aerodynamics — e.g. testing AI path planning against real flight dynamics.

- [ ] Install JSBSim: `sudo apt install jsbsim` or build from source (`https://github.com/JSBSim-Team/jsbsim`)
- [ ] Verify JSBSim binary is on PATH: `JSBSim --version`
- [ ] Launch SITL with JSBSim backend:
  ```bash
  sim_vehicle.py -v ArduPlane --sim=jsbsim --model=Rascal110-JSBSim
  ```
- [ ] Confirm MAVLink stream still appears on UDP 14550 (same port, nothing changes for the adapter)
- [ ] Re-run the §8 handoff checklist against the JSBSim-backed instance to confirm all messages still present
- [ ] Note: JSBSim models live in `ardupilot/Tools/autotest/models/` — swap `--model` to match your airframe when available

> The protocol adapter is unaware of which physics backend is running. Switching to JSBSim requires zero GCS code changes.

---

## 8. Camera Feed for SITL (Nice to Have)

- [ ] Use a looping video file as a fake camera feed (RTSP or local file)
- [ ] Confirm the GCS camera tile can consume it independent of SITL
- [ ] ArduPilot SITL can output a simulated camera view via `--camera` flag — evaluate if useful

---

## 9. Containerize (Nice to Have)

- [ ] Write a `Dockerfile` that installs ArduPilot + deps and runs `sim_vehicle.py -v ArduPlane`
- [ ] Expose UDP port 14550
- [ ] Add a `docker-compose.yml` that starts SITL alongside the GCS dev server
- [ ] Verify GCS connects to SITL container over `udp://localhost:14550`
- [ ] Add a one-liner to `README.md`: `docker compose up` → SITL + GCS running

---

## 10. SITL Handoff Checklist (Gate Before Protocol Adapter Work)

Before starting the protocol adapter, confirm all of these:

- [ ] `sim_vehicle.py -v ArduPlane` starts without error
- [ ] MAVLink heartbeat visible on UDP 14550
- [ ] All 7 message types from §3 confirmed present
- [ ] Test mission runs to completion in AUTO mode
- [ ] At least 2 failure injection modes verified (GPS disable + link loss)
- [ ] Port and connection params documented for GCS adapter config

---

## Failure Injection Parameter Reference

| Failure | ArduPilot Param | Value to Inject | Reset Value |
|---------|----------------|-----------------|-------------|
| GPS disable | `SIM_GPS1_ENABLE` | 0 | 1 |
| GPS noise | `SIM_GPS1_NOISE` | 3–10 | 0 |
| GPS delay | `SIM_GPS1_LAG_MS` | 500 | 100 |
| GPS satellite count | `SIM_GPS1_NUMSATS` | 3 | 10 |
| GPS position glitch | `SIM_GPS1_GLTCH_X/Y` | 10 | 0 |
| GPS jamming | `SIM_GPS1_JAM` | 1 | 0 |
| GPS altitude offset | `SIM_GPS1_ALT_OFS` | 50 | 0 |
| Baro noise | check `param show SIM_BARO*` | varies | 0 |
| Airspeed noise | `SIM_ARSPD_RND` | 5 | 0 |
| Airspeed fail | `SIM_ARSPD_FAIL` | 1 | 0 |
| IMU accel bias | `SIM_ACC1_BIAS_X/Y/Z` | 0.5 | 0 |
| IMU accel noise | `SIM_ACC1_RND` | 5 | 0 |
| IMU accel fail | `SIM_ACCEL1_FAIL` | 1 | 0 |
| IMU gyro bias | `SIM_GYR1_BIAS_X/Y/Z` | 0.5 | 0 |
| IMU gyro noise | `SIM_GYR1_RND` | 5 | 0 |
| IMU gyro fail | `SIM_GYR_FAIL_MSK` | 1 | 0 |
| Battery voltage | `SIM_BATT_VOLTAGE` | 10.0 | 12.6 |

---

*Next step after this gate: Protocol Adapter — see `docs/architecture-todo.md`*
