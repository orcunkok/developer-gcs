# ArduPilot SITL Cheatsheet

Quick reference for launching, flying, and testing ArduPilot SITL via mavproxy.

---

## Launch

```bash
# From inside ardupilot/
python3 Tools/autotest/sim_vehicle.py -v ArduPlane --console --map

# With JSBSim physics backend (more realistic aerodynamics)
python3 Tools/autotest/sim_vehicle.py -v ArduPlane --sim=jsbsim --model=Rascal110-JSBSim --console --map

# Headless (no map/console window, just MAVLink stream)
python3 Tools/autotest/sim_vehicle.py -v ArduPlane --out=udp:127.0.0.1:14550

# Speed up simulation (useful for long missions)
python3 Tools/autotest/sim_vehicle.py -v ArduPlane --speedup=5
```

MAVLink stream available at `udp://127.0.0.1:14550` by default.

---

## Connect with MAVProxy

```bash
mavproxy.py --master=udp:127.0.0.1:14550

# With map and console
mavproxy.py --master=udp:127.0.0.1:14550 --console --map
```

---

## Arming and Takeoff

```bash
# Standard (pre-arm checks must pass)
arm throttle

# Force arm (bypass pre-arm checks)
arm throttle force

# Disarm
disarm

# Disable arming checks entirely
param set ARMING_CHECK 0

# Takeoff — ArduPlane specific
mode takeoff          # dedicated takeoff mode, plane accelerates and pitches up
arm throttle force

# Takeoff via GUIDED (unreliable for fixed-wing, use mode takeoff instead)
mode guided
arm throttle force
takeoff 100           # may return NAV_TAKEOFF: FAILED on fixed-wing

# Takeoff via mission (most reliable)
wp load missions/test_mission.waypoints
mode auto
arm throttle force
```

---

## Flight Modes

```bash
mode manual       # raw RC passthrough
mode fbwa         # fly-by-wire A, stabilized
mode fbwb         # fly-by-wire B, speed/altitude hold
mode guided       # fly to commanded positions
mode auto         # execute loaded mission
mode loiter       # circle current position
mode rtl          # return to launch
mode land         # land at current position
mode takeoff      # automated takeoff (ArduPlane)
```

---

## Waypoints and Missions

```bash
wp list                            # show loaded waypoints
wp load path/to/mission.waypoints  # load a mission file
wp save path/to/mission.waypoints  # save current mission to file
wp editor                          # interactive waypoint editor
wp clear                           # clear all waypoints

# Fly to a specific waypoint index
guided <lat> <lon> <alt>           # fly to coordinates in GUIDED mode
```

---

## Parameters

```bash
param show <name>           # show a parameter value
param set <name> <value>    # set a parameter
param save                  # save params to file
param load <file>           # load params from file

# Common params
param show ARMING_CHECK
param set ARMING_CHECK 0       # disable arming checks
param set SIM_SPEEDUP 5        # speed up simulation
param set TKOFF_ALT 100        # takeoff target altitude (meters)
param set CRUISE_SPEED 20      # cruise airspeed m/s
param set CRUISE_ALT 100       # cruise altitude meters
```

---

## Telemetry / Status

```bash
status                  # show all current system status
status EKF_STATUS_REPORT
rc                      # show RC input values
bat                     # battery status
gps                     # GPS status
attitude                # roll, pitch, yaw live
```

---

## Failure Injection

```bash
# GPS
param set SIM_GPS_DISABLE 1     # cut GPS entirely
param set SIM_GPS_DISABLE 0     # restore GPS
param set SIM_GPS_NOISE 5       # add position noise
param set SIM_GPS_DELAY 2       # add GPS latency (frames)

# IMU / Accelerometer
param set SIM_ACC_BIAS_X 0.5    # accel bias on X axis
param set SIM_GYR_RND 5         # gyro noise

# Barometer
param set SIM_BARO_RND 5        # baro noise

# Airspeed
param set SIM_ARSPD_RND 5       # airspeed sensor noise
param set SIM_ARSPD_FAIL 1      # fail airspeed sensor

# Battery
param set SIM_BATT_DRAIN 5      # drain rate multiplier

# Link degradation (mavproxy flag at launch)
mavproxy.py --master=udp:127.0.0.1:14550 --loss=20   # 20% packet loss

# Reset all SIM params to nominal
param set SIM_GPS_DISABLE 0
param set SIM_GPS_NOISE 0
param set SIM_ACC_BIAS_X 0
param set SIM_GYR_RND 0
param set SIM_BARO_RND 0
param set SIM_ARSPD_RND 0
param set SIM_ARSPD_FAIL 0
param set SIM_BATT_DRAIN 0
```

---

## Scripting / Automation (Mavproxy)

```bash
# Run a script of mavproxy commands
mavproxy.py --master=udp:127.0.0.1:14550 --script=scripts/test_takeoff.scr

# Example script file (test_takeoff.scr)
param set ARMING_CHECK 0
mode takeoff
arm throttle force
watch attitude        # live attitude display
```

---

## Useful Mavproxy Commands

```bash
watch <message>         # live display of a MAVLink message
graph <field>           # plot a telemetry field live
module load map         # load map module if not already loaded
map sethome <lat> <lon> # set home position on map
exit                    # quit mavproxy
```

---

## GCS Connection (for Developer GCS)

```bash
# SITL outputs on 14550 by default
# Add a second output for the GCS while mavproxy is running:
output add udp:127.0.0.1:14551

# Or launch with multiple outputs:
python3 Tools/autotest/sim_vehicle.py -v ArduPlane \
  --out=udp:127.0.0.1:14550 \
  --out=udp:127.0.0.1:14551
```

Connect the GCS to `udp://127.0.0.1:14551` while mavproxy uses 14550.

---

## Quick Test Sequence (Sanity Check)

```bash
param set ARMING_CHECK 0
mode takeoff
arm throttle force
# plane should accelerate and climb
# once airborne:
mode loiter       # hold position
mode rtl          # return and land
```
