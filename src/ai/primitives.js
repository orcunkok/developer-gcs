/**
 * Primitive catalog — the AI commander's tool surface.
 *
 * Add a primitive here AND register a handler in an adapter
 * (currently src/adapters/mavlink/MavlinkAdapter.js).
 *
 * Fields:
 *   name        — action name; matches the registered handler
 *   purpose     — short description shown to the LLM
 *   params      — { paramName: "type or hint" }; informational
 *   ackCommand  — MAVLink command name expected on COMMAND_ACK; omit if no ACK
 */
export const PRIMITIVES = [
  {
    name: "arm",
    purpose: "Arm the motors. Pre-arm checks and the current flight mode must allow it.",
    params: {},
    ackCommand: "COMPONENT_ARM_DISARM",
  },
  {
    name: "disarm",
    purpose: "Disarm the motors. Ground only.",
    params: {},
    ackCommand: "COMPONENT_ARM_DISARM",
  },
  {
    name: "setMode",
    purpose: "Change the autopilot flight mode.",
    params: {
      mode: "GUIDED|RTL|LOITER|AUTO|TAKEOFF|QHOVER|QLOITER|QLAND|QRTL|MANUAL|STABILIZE|FBWA|FBWB|CRUISE",
    },
    ackCommand: "DO_SET_MODE",
  },
  {
    name: "land",
    purpose: "Land at the current position.",
    params: {},
    ackCommand: "NAV_LAND",
  },
  {
    name: "goto",
    purpose: "Fly to a coordinate. Requires armed + GUIDED.",
    params: { lat: "degrees", lon: "degrees", alt: "meters AGL" },
    // goto issues MISSION_ITEM_INT in guided mode — no COMMAND_ACK.
  },
];

const BY_NAME = new Map(PRIMITIVES.map((p) => [p.name, p]));
export const ackCommandFor = (name) => BY_NAME.get(name)?.ackCommand;

export const RENDERED_PRIMITIVES = PRIMITIVES
  .map((p) => `- ${p.name}${Object.keys(p.params).length ? " " + JSON.stringify(p.params) : ""} — ${p.purpose}`)
  .join("\n");
