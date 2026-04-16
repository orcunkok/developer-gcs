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
let remoteUdpPort = UDP_SEND_PORT;
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
  remoteUdpPort = UDP_SEND_PORT;

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

    // SITL can emit from a source UDP port different than 14555.
    // Keep outbound port aligned with latest inbound sender.
    const udpSocket = port?.socket;
    if (udpSocket?.on) {
      udpSocket.on("message", (_buffer, metadata) => {
        if (!metadata?.port || metadata.port === remoteUdpPort) return;
        remoteUdpPort = metadata.port;
        port.sendPort = metadata.port;
        console.log(
          `[mavlink] uplink port updated to ${metadata.port} from incoming traffic`,
        );
      });
    }

    // Send GCS heartbeat at 1 Hz
    heartbeatInterval = setInterval(() => {
      port.send(buildGcsHeartbeat()).catch(() => {});
    }, 1000);
  } catch (err) {
    console.error("[mavlink] start failed:", err.message);
    port = null;
  }
}

// NOTE: stopMavlink kills the MAVLink connection for ALL connected WS clients.
// This is intentional for single-user dev, but needs a ref-count or ownership
// model if we ever support multiple concurrent sessions.
async function stopMavlink() {
  clearInterval(heartbeatInterval);
  clearTimeout(dataTimeoutTimer);
  heartbeatInterval = null;
  dataTimeoutTimer = null;
  remoteUdpPort = UDP_SEND_PORT;
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
    if (port?.sendPort !== remoteUdpPort) port.sendPort = remoteUdpPort;
    msg.targetSystem = msg.targetSystem || 1;
    msg.targetComponent = msg.targetComponent || 1;
    port.send(msg).catch((err) => {
      console.error("[mavlink] send error:", err.message);
    });
  }
}

function parseEnvelope(raw) {
  if (typeof raw === "string") return JSON.parse(raw);
  if (raw instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(raw)));
  }
  if (ArrayBuffer.isView(raw)) {
    return JSON.parse(new TextDecoder().decode(raw));
  }
  return null;
}

// ── WebSocket Server ─────────────────────────────────────────────────────────

Bun.serve({
  port: WS_PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/api/ai") {
      return req
        .json()
        .then((body) => {
          const message = typeof body?.message === "string" ? body.message.trim() : "";
          return Response.json({
            ok: true,
            reply: message
              ? `Stub reply: received "${message}". Hook an LLM here later.`
              : "Stub reply: no message provided.",
          });
        })
        .catch(() =>
          Response.json(
            { ok: false, reply: "Invalid JSON body." },
            { status: 400 },
          ),
        );
    }
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
        const envelope = parseEnvelope(raw);
        if (!envelope) return;
        if (envelope.type === "command") {
          handleCommand(envelope.command);
        } else if (envelope.type === "connect") {
          startMavlink();
        } else if (envelope.type === "disconnect") {
          stopMavlink();
        }
      } catch (err) {
        // for debugging only
        console.warn("[ws] invalid envelope", err?.message || err);
      }
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
