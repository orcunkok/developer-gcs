/**
 * MAVLink Adapter — Browser side
 *
 * Connects to the Bun bridge server via WebSocket.
 * Receives normalized JSON messages, forwards commands.
 * The public interface matches the adapter contract in docs/protocol_adapter.md.
 *
 * @typedef {'disconnected'|'connected'} ConnectionState
 *
 * @typedef {Object} ConnectionStatus
 * @property {ConnectionState} state
 * @property {number|null}     lastSeen   - ms since epoch of last received message
 * @property {number|null}     latencyMs  - round-trip if measurable
 * @property {string|null}     info       - human-readable detail, e.g. "udp://127.0.0.1:14550"
 *
 * @typedef {Object} NormalizedMessage
 * @property {string} type       - message category (heartbeat, attitude, position, ...)
 * @property {number} timestamp  - ms since epoch, set by adapter on receipt
 * @property {string} source     - adapter identifier, e.g. "mavlink-udp"
 * @property {Object} payload    - type-specific key-value data
 *
 * @typedef {Object} NormalizedCommand
 * @property {string} action  - what to do (arm, disarm, setMode, goto, ...)
 * @property {Object} params  - action-specific parameters
 */

import { registerAction } from "../../actions.js";

const BRIDGE_URL = "ws://localhost:3001";
const RECONNECT_MS = 500;

function logAck(type, payload) {
  if (type !== "commandAck") return;
  const ok = payload.result === "ACCEPTED";
  console.log(
    `[ack] %c${payload.command} → ${payload.result}`,
    `color: ${ok ? "#22c55e" : "#ef4444"}; font-weight: bold`,
  );
}

export function createMavlinkAdapter() {
  let ws = null;
  let reconnectTimer = null;
  let destroyed = false;

  const msgListeners = new Set();
  const statusListeners = new Set();

  let _status = {
    state: "disconnected",
    lastSeen: null,
    latencyMs: null,
    info: BRIDGE_URL,
  };

  function setStatus(patch) {
    const prev = _status;
    _status = { ..._status, ...patch };
    if (prev.state !== _status.state || prev.lastSeen !== _status.lastSeen || prev.latencyMs !== _status.latencyMs) {
      for (const cb of statusListeners) cb(_status);
    }
  }

  function openWs() {
    if (destroyed) return;

    ws = new WebSocket(BRIDGE_URL);

    ws.onopen = () => {
      setStatus({ state: "connected" });
    };

    ws.onclose = () => {
      ws = null;
      setStatus({ state: "disconnected" });
      if (destroyed) return;
      reconnectTimer = setTimeout(openWs, RECONNECT_MS);
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);

        if (envelope.type === "message") {
          const msg = envelope.message;
          setStatus({ lastSeen: msg.timestamp });
          logAck(msg.type, msg.payload);
          for (const cb of msgListeners) cb(msg);
        } else if (envelope.type === "status") {
          // Only accept connected/disconnected from bridge, ignore unknown states
          const s = envelope.status;
          if (s.state === "connected" || s.state === "disconnected") {
            setStatus(s);
          }
        }
      } catch {}
    };
  }

  function sendNormalizedCommand(command) {
    if (ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Adapter is not connected");
    }
    ws.send(JSON.stringify({ type: "command", command }));
  }

  // Adapters own the set of supported actions.
  // Registry only needs handlers; this keeps protocol details in the adapter.
  const SUPPORTED_ACTIONS = [
    "arm", "disarm", "setMode", "goto", "takeoff",
    "land", "setParam", "getParam", "setMessageRate",
  ];

  for (const name of SUPPORTED_ACTIONS) {
    registerAction(name, (params = {}) =>
      sendNormalizedCommand({ action: name, params }),
    );
  }

  return {
    get status() {
      return _status;
    },

    connect() {
      destroyed = false;
      openWs();
    },

    disconnect() {
      destroyed = true;
      clearTimeout(reconnectTimer);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "disconnect" }));
      }
      ws?.close();
      ws = null;
      setStatus({ state: "disconnected" });
    },

    send(command) {
      sendNormalizedCommand(command);
    },

    onMessage(callback) {
      msgListeners.add(callback);
      return () => msgListeners.delete(callback);
    },

    onStatusChange(callback) {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
  };
}
