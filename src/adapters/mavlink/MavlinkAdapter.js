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

const BRIDGE_URL = "ws://localhost:3001";
const RECONNECT_MS = 500;

// ── Telemetry console logger (1 Hz) ─────────────────────────────────────────

function createTelemLogger() {
  const latest = {};
  const deg = (r) => ((r * 180) / Math.PI).toFixed(1);

  const _interval = setInterval(() => {
    const pos = latest.position;
    const vel = latest.velocity;
    const att = latest.attitude;
    const hb = latest.heartbeat;
    const bat = latest.battery;
    const gps = latest.gps;
    if (!pos) return;

   /*console.log(
      `[telem] %c${hb?.mode || "---"} ${hb?.armed ? "ARMED" : "DISARMED"}` +
        ` %c| lat=${pos.lat.toFixed(7)} lon=${pos.lon.toFixed(7)} alt=${pos.altAGL.toFixed(1)}m MSL=${pos.altMSL.toFixed(1)}m hdg=${pos.heading.toFixed(0)}°` +
        ` | gs=${vel?.groundSpeed?.toFixed(1) ?? "?"}m/s as=${vel?.airspeed?.toFixed(1) ?? "?"}m/s climb=${vel?.climb?.toFixed(1) ?? "?"}m/s` +
        ` | R=${att ? deg(att.roll) : "?"}° P=${att ? deg(att.pitch) : "?"}° Y=${att ? deg(att.yaw) : "?"}°` +
        ` | bat=${bat?.voltage?.toFixed(1) ?? "?"}V ${bat?.remaining != null ? (bat.remaining * 100).toFixed(0) + "%" : "?"}` +
        ` | gps=${gps?.fixType ?? "?"} sat=${gps?.satellites ?? "?"}`,
      "color: #22c55e; font-weight: bold",
      "color: inherit",
    );*/
  }, 1000);

  function stop() { clearInterval(_interval); }

  function log(type, payload) {
    latest[type] = payload;
    if (type === "commandAck") {
      const ok = payload.result === "ACCEPTED";
      console.log(
        `[ack] %c${payload.command} → ${payload.result}`,
        `color: ${ok ? "#22c55e" : "#ef4444"}; font-weight: bold`,
      );
    }
  }

  return { log, stop };
}

export function createMavlinkAdapter() {
  let ws = null;
  let reconnectTimer = null;
  let destroyed = false;

  const msgListeners = new Set();
  const statusListeners = new Set();
  const telem = createTelemLogger();

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
          telem.log(msg.type, msg.payload);
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

  return {
    get status() {
      return _status;
    },

    connect(config) {
      destroyed = false;
      openWs();
    },

    disconnect() {
      destroyed = true;
      clearTimeout(reconnectTimer);
      telem.stop();
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "disconnect" }));
      }
      ws?.close();
      ws = null;
      setStatus({ state: "disconnected" });
    },

    send(command) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "command", command }));
      }
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
