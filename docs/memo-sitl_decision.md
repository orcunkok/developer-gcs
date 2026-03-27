# SITL Simulation Stack Decision Memo

**Date:** March 2026
**Status:** Decision made — JSBSim + ArduPilot SITL for MVP

---

## The Question

What simulation backend do we use for SITL testing and the THINK workspace? Requirements:
- Aerodynamically correct (not a toy model)
- Headless — no rendering dependency, runs in CI
- Deep programmatic control — every state variable readable, every input writable
- Autopilot-swappable — we can't lock ourselves to ArduPilot or PX4 permanently
- Fast enough for MVP without a lot of custom integration work

---

## What We Looked At

### JSBSim

Open-source 6DOF FDM written in C++. NASA heritage, in active development since 1996, v1.2.4 released February 2026. Used by ArduPilot, PX4, FlightGear, and several DARPA programs.

The aerodynamic model is nonlinear coefficient buildup; full lookup tables for lift, drag, moments as functions of AoA, Mach, sideslip. *JSB Sim is not a linearized approximation*. It supports stall, compressibility, ground effects, and all six degrees of freedom. NASA ran verification checks against seven FDM tools in 2015 and JSBSim matched across all published cases.

It is headless by design. There is no rendering, no GUI, no display dependency. You can run it as a Python library (`pip install jsbsim`) or a standalone binary. A 3-hour simulated flight runs in about 43 seconds on a normal CPU, roughly 250x real-time. Single-threaded, minimal CPU overhead.

Everything is accessible through a property system. You read `position/lat-gc-deg`, you write `fcs/aileron-cmd-norm`. Every aerodynamic coefficient, every state variable, every force and moment is a named property. You can modify stability derivatives while the sim is running. This is exactly what we need for the AI training loops in THINK.

Aircraft models are XML. A large library of real aircraft is included (C172, F-16, A320, etc.), and custom models can be generated from basic parameters using the Aeromatic tool. For a novel airframe you need aero data, but for getting started the C172 model is well-validated and a reasonable stand-in.

One hard constraint: the integrator requires a fixed timestep. Variable dt will produce wrong results. Not a problem in practice but I will leave it there just in case.

### Alternatives Considered

**ArduPilot SITL (built-in physics):** Uses a simplified linear model, not suitable for aero research. Good for autopilot logic testing but not for flight dynamics work.

**jMAVSim:** Lightweight Java sim, PX4's default. Very simple rigid body physics. Fast to get running, but the fidelity is too low for anything beyond basic autopilot testing.

**Gazebo (Harmonic):** Good for multi-robot scenarios, ROS integration, and camera/sensor simulation. Physics fidelity is plugin-dependent and not aero-focused. Heavy to set up, barely runs faster than real-time. Not the right tool for pure flight dynamics.

**FlightGear:** Can run headless in theory, but headless mode is described in its own docs as "limited" and "could be improved." Internally uses JSBSim or YASim as the FDM anyway. Adds a large dependency for no benefit over using JSBSim directly.

**AirSim:** Deprecated by Microsoft in 2022. Project AirSim exists as a successor but has limited public availability. Depends on Unreal Engine. Not viable.

**gym-pybullet-drones:** Python, good for RL quadrotor research with simplified physics. I have previously used it for RL but it is quadrotor-only unfortunetly. Not suitable as a general FDM.

---

## The Autopilot Boundary

The key architectural decision is where the autopilot boundary sits. The answer already exists and is widely used:

ArduPilot's JSON SITL interface defines a clean UDP socket protocol:
- FDM sends: position, attitude, velocities, accelerations, airspeed — the full sensor picture
- Autopilot sends back: servo/actuator outputs

That's it. The FDM doesn't know or care what autopilot is on the other side. The autopilot doesn't know or care what FDM is running. This is the swap point.

PX4 uses a similar pattern via MAVLink HIL messages (`HIL_SENSOR` in, `HIL_ACTUATOR_CONTROLS` out) over TCP, implemented in the Auterion px4-jsbsim-bridge.

For a custom autopilot, you implement the same JSON interface. The GCS adapter never changes because it only sees MAVLink upstream.

The same JSBSim instance supports both SITL and HITL — the interface is identical, you just swap which end is the autopilot.

---

## Decision

**MVP:** JSBSim via ArduPilot SITL

```
JSBSim (physics)  <-socket->  ArduPilot SITL  <-MAVLink UDP->  GCS MAVLink Adapter
```

One command to start:
```
sim_vehicle.py -v ArduPlane -f jsbsim --console
```

This gives us correct 6DOF physics, full MAVLink telemetry, and zero custom bridge code. The GCS adapter talks to it identically to real hardware.

**Later:** When we need to swap autopilots (PX4, custom), we replace the ArduPilot SITL box. The FDM stays. The GCS adapter stays. We implement the JSON interface for whatever autopilot is on the other side.

**For AI training in THINK:** Talk directly to JSBSim via Python bindings. The Python API exposes the full property system. We can run at 250x real-time, modify aero coefficients on the fly, and build Gymnasium environments against real physics.

---

## Web Integration

JSBSim doesn't speak MAVLink natively,but ArduPilot SITL outputs MAVLink over UDP 14550 by default. The GCS MAVLink adapter connects to that port directly, parses frames, and bridges to the frontend over WebSocket/UDP/TCP. No additional bridge layer needed.

State sync pattern: sim runs internally at 100Hz+, we decimate to 20-50Hz at the adapter layer. The browser gets binary  frames at render rate. At 50Hz with 20 doubles of flight state, that's 8KB/s. So that's not a concern, but I/O is.

For the Time River replay feature, we keep a ring buffer of events at full telemetry rate. The event bus already emits everything; it's just a matter of what we persist.

---

## What This Doesn't Solve

- **Custom airframe models:** For a novel aircraft, we need aero data. Aeromatic can generate a rough model from basic geometry, but it will need validation against real flight data.
- **Sensor noise models:** JSBSim outputs truth data. ArduPilot SITL adds GPS noise, IMU bias, magnetometer errors. If we go direct-to-JSBSim for the AI path, we need to add noise ourselves. But on the other hand I have never seen Ardupilot sitl work relaibly so...
- **Multi-vehicle:** One JSBSim instance per aircraft. Fine for now — multi-vehicle is explicitly deferred.
- **Rotorcraft:** JSBSim's fixed-wing model is strong. Helicopter/multicopter support exists but is less mature.
