/**
 * Primitive catalog — the AI commander's tool surface.
 *
 * Fields:
 *   name            — action name; matches the registered handler
 *   purpose         — short description shown to the LLM
 *   params          — { paramName: "type or hint" }; informational
 *   ackCommand      — MAVLink command name expected on COMMAND_ACK; omit if no ACK
 *   done(s, p)      — returns true when the vehicle has physically completed the action
 *   doneTimeoutSec  — max seconds to wait for done(); default 30
 */

const R = 6371000, D = Math.PI / 180;

export const PRIMITIVES = [
  {
    name: "arm",
    purpose: "Arm the motors. Pre-arm checks and the current flight mode must allow it.",
    params: {},
    ackCommand: "COMPONENT_ARM_DISARM",
    done: (s) => s.armed === true,
    doneTimeoutSec: 10,
  },
  {
    name: "disarm",
    purpose: "Disarm the motors. Ground only.",
    params: {},
    ackCommand: "COMPONENT_ARM_DISARM",
    done: (s) => s.armed === false,
    doneTimeoutSec: 10,
  },
  {
    name: "setMode",
    purpose: "Change the autopilot flight mode.",
    params: {
      mode: "GUIDED|RTL|LOITER|AUTO|TAKEOFF|QHOVER|QLOITER|QLAND|QRTL|MANUAL|STABILIZE|FBWA|FBWB|CRUISE",
    },
    ackCommand: "DO_SET_MODE",
    done: (s, p) => s.mode === p.mode,
    doneTimeoutSec: 5,
  },
  {
    name: "land",
    purpose: "Land at the current position.",
    params: {},
    ackCommand: "NAV_LAND",
    done: (s) => s.armed === false, // ArduPilot disarms on touchdown
    doneTimeoutSec: 120,
  },
  {
    name: "goto",
    purpose: "Fly to a coordinate. Requires armed + GUIDED.",
    params: { lat: "degrees", lon: "degrees", alt: "meters AGL" },
    // goto issues MISSION_ITEM_INT in guided mode — no COMMAND_ACK
    // ArduPlane loiters at ~60m radius — consider done when within loiter radius
    done: (s, p) => {
      if (s.position?.lat == null) return false;
      const φ1 = s.position.lat * D, φ2 = p.lat * D, Δλ = (p.lon - s.position.lon) * D;
      const h = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h)) < 80;
    },
    doneTimeoutSec: 120,
  },
];

const BY_NAME = new Map(PRIMITIVES.map((p) => [p.name, p]));
export const primitiveFor = (name) => BY_NAME.get(name);

export const RENDERED_PRIMITIVES = PRIMITIVES
  .map((p) => `- ${p.name}${Object.keys(p.params).length ? " " + JSON.stringify(p.params) : ""} — ${p.purpose}`)
  .join("\n");
