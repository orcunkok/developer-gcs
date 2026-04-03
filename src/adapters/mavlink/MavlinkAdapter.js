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
  if (type === "commandAck") {
    const ok = payload.result === "ACCEPTED";
    console.log(
      `[ack] %c${payload.command} → ${payload.result}`,
      `color: ${ok ? "#22c55e" : "#ef4444"}; font-weight: bold`,
    );
  } else if (type === "missionAck") {
    const ok = payload.result === "ACCEPTED";
    console.log(
      `[mission ack] %c${payload.result}`,
      `color: ${ok ? "#22c55e" : "#ef4444"}; font-weight: bold`,
    );
  }
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

  // ── Mission protocol ─────────────────────────────────────────────────

  function cmd(action, params = {}) { sendNormalizedCommand({ action, params }); }

  function waitFor(type, match, ms = 3000) {
    return new Promise((resolve, reject) => {
      let unsub;
      const timer = setTimeout(() => { unsub(); reject(new Error(`timeout waiting for ${type}`)); }, ms);
      unsub = subscribe((msg) => {
        if (msg.type === type && (!match || match(msg.payload))) {
          clearTimeout(timer); unsub(); resolve(msg.payload);
        }
      });
    });
  }

  function subscribe(cb) { msgListeners.add(cb); return () => msgListeners.delete(cb); }

  async function fetchMission() {
    cmd("requestMissionList");
    const { count } = await waitFor("missionCount");
    if (count === 0) return [];

    const items = [];
    for (let seq = 0; seq < count; seq++) {
      let item = null;
      for (let try_ = 0; try_ < 3 && !item; try_++) {
        cmd("requestMissionItem", { seq });
        try { item = await waitFor("missionItemInt", p => p.seq === seq); }
        catch { /* retry */ }
      }
      if (!item) throw new Error(`failed to download item ${seq}`);
      items.push({
        seq: item.seq, frame: item.frame, command: item.command,
        lat: item.x / 1e7, lon: item.y / 1e7, alt: item.z,
        param1: item.param1, param2: item.param2, param3: item.param3, param4: item.param4,
        autocontinue: item.autocontinue,
      });
    }
    cmd("sendMissionAck", { result: 0 });
    return items;
  }

  async function uploadMission(items) {
    cmd("sendMissionCount", { count: items.length });
    for (let i = 0; i < items.length; i++) {
      const { seq } = await waitFor("missionRequestInt");
      const it = items[seq];
      if (!it) throw new Error(`autopilot requested unknown seq ${seq}`);
      cmd("sendMissionItem", {
        seq, frame: it.frame, command: it.command,
        current: seq === 0 ? 1 : 0, autocontinue: it.autocontinue ?? 1,
        param1: it.param1 || 0, param2: it.param2 || 0,
        param3: it.param3 || 0, param4: it.param4 || 0,
        x: Math.round(it.lat * 1e7), y: Math.round(it.lon * 1e7), z: it.alt || 0,
      });
    }
    const ack = await waitFor("missionAck");
    return ack.result === "ACCEPTED" ? { ok: true } : { ok: false, error: ack.result };
  }

  async function clearMission() {
    cmd("clearMission");
    const ack = await waitFor("missionAck");
    return ack.result === "ACCEPTED" ? { ok: true } : { ok: false, error: ack.result };
  }

  // ── Action registration ────────────────────────────────────────────────

  const SUPPORTED_ACTIONS = [
    "arm", "disarm", "setMode", "goto", "takeoff",
    "land", "setParam", "getParam", "setMessageRate",
    "requestMissionList", "requestMissionItem", "sendMissionCount",
    "sendMissionItem", "sendMissionAck", "clearMission",
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

    fetchMission,
    uploadMission,
    clearMission,
  };
}
