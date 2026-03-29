/**
 * GCS Bridge Server
 *
 * UDP (MAVLink) <-> WebSocket (normalized JSON) bridge.
 * Runs under Bun. The browser connects via WS on port 3001.
 */

import { MavEsp8266, MavLinkProtocolV2 } from "node-mavlink";
import {
  MESSAGE_MAP,
  buildCommand,
  buildGcsHeartbeat,
} from "../src/adapters/mavlink/mappings.js";

const WS_PORT = 3001;
const UDP_RECV_PORT = 14550;
const UDP_SEND_PORT = 14555;
const SOURCE = "mavlink-udp";

// ── State ────────────────────────────────────────────────────────────────────

const DATA_TIMEOUT_MS = 1500; // no data for 1.5s → disconnected

let port = null;
let heartbeatInterval = null;
let dataTimeoutTimer = null;
const protocol = new MavLinkProtocolV2();
const wsClients = new Set();

let status = {
  state: "disconnected",
  lastSeen: null,
  latencyMs: null,
  info: `udp://0.0.0.0:${UDP_RECV_PORT}`,
};

// ── Broadcast to all WS clients ─────────────────────────────────────────────

function broadcast(envelope) {
  const json = JSON.stringify(envelope);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(json);
  }
}

function setStatus(patch) {
  status = { ...status, ...patch };
  broadcast({ type: "status", status });
}
// ── MAVLink UDP ──────────────────────────────────────────────────────────────

function resetDataTimeout() {
  clearTimeout(dataTimeoutTimer);
  dataTimeoutTimer = setTimeout(() => {
    if (status.state === "connected") {
      setStatus({ state: "disconnected" });
      console.log("[mavlink] data timeout — no packets received");
    }
  }, DATA_TIMEOUT_MS);
}

async function startMavlink() {
  if (port) return;

  port = new MavEsp8266();

  port.on("data", (packet) => {
    const entry = MESSAGE_MAP.get(packet.header.msgid);
    if (!entry) return;

    try {
      const data = protocol.data(packet.payload, entry.clazz);
      const now = Date.now();

      status.lastSeen = now;
      if (status.state !== "connected") {
        setStatus({ state: "connected" });
      }
      resetDataTimeout();

      for (const { type, payload } of entry.convert(data)) {
        broadcast({
          type: "message",
          message: { type, timestamp: now, source: SOURCE, payload },
        });
      }
    } catch {
      // malformed packet, skip
    }
  });

  try {
    const info = await port.start(UDP_RECV_PORT, UDP_SEND_PORT);
    console.log(
      `[mavlink] listening on ${info.ip}, recv=${info.receivePort} send=${info.sendPort}`,
    );
    setStatus({ info: `udp://${info.ip}:${info.receivePort}` });

    // Send GCS heartbeat at 1 Hz
    heartbeatInterval = setInterval(() => {
      port.send(buildGcsHeartbeat()).catch(() => {});
    }, 1000);
  } catch (err) {
    console.error("[mavlink] start failed:", err.message);
    port = null;
  }
}

async function stopMavlink() {
  clearInterval(heartbeatInterval);
  clearTimeout(dataTimeoutTimer);
  heartbeatInterval = null;
  dataTimeoutTimer = null;
  if (port) {
    try {
      await port.close();
    } catch {}
    port = null;
  }
  setStatus({ state: "disconnected" });
}

function handleCommand(command) {
  if (!port) return;
  const msg = buildCommand(command);
  if (msg) {
    msg.targetSystem = msg.targetSystem || 1;
    msg.targetComponent = msg.targetComponent || 1;
    port.send(msg).catch((err) => {
      console.error("[mavlink] send error:", err.message);
    });
  }
}

// ── WebSocket Server ─────────────────────────────────────────────────────────

const bun_server = Bun.serve({
  port: WS_PORT,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("GCS Bridge", { status: 200 });
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
      // Send current status to newly connected client
      ws.send(JSON.stringify({ type: "status", status }));
      console.log(`[ws] client connected (${wsClients.size} total)`);
    },
    message(ws, raw) {
      try {
        const envelope = JSON.parse(raw);
        if (envelope.type === "command") {
          handleCommand(envelope.command);
        } else if (envelope.type === "connect") {
          startMavlink();
        } else if (envelope.type === "disconnect") {
          stopMavlink();
        }
      } catch {}
    },
    close(ws) {
      wsClients.delete(ws);
      console.log(`[ws] client disconnected (${wsClients.size} total)`);
    },
  },
});

console.log(`[bridge] WebSocket server on ws://localhost:${WS_PORT}`);

// Auto-start MAVLink listener
startMavlink();
