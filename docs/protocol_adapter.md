# Protocol Adapter

**Status:** Implemented (MVP)

**Date:** March 2026

---

## Overview

The protocol adapter is the boundary between the aircraft and the GCS. Everything protocol-specific lives inside it. Nothing above it knows what protocol is being spoken.

```
Aircraft  <-- UDP -->  [ Bun Bridge Server ]  <-- WebSocket -->  [ Browser Adapter ]  -->  State Store
```

The system is split across two processes:

1. **Bridge server** (`server/index.js`) — Bun process. Owns the raw UDP socket, parses MAVLink, normalizes to JSON, serves a WebSocket on port 3001. This is the only process that touches `node-mavlink` or MAVLink message classes.

2. **Browser adapter** (`src/adapters/mavlink/MavlinkAdapter.js`) — Runs in the browser. Connects to the bridge server via WebSocket, receives normalized JSON, distributes to subscribers. Zero protocol knowledge.

---

## Why UDP + WebSocket Bridge

Browsers cannot open raw UDP sockets. Two options exist:

1. **Bun UDP server + local WebSocket bridge** — sub-millisecond localhost WS hop, minimal code
2. **Electron wrapper** — direct UDP from main process via IPC, heavier setup

We chose option 1 for MVP speed. The adapter contract is identical either way — swapping to Electron later requires no changes above the adapter layer. The `MavlinkAdapter.js` SWAP comments document the Electron IPC mapping.

---

## Network Architecture

```
ArduPilot SITL          Bun Bridge Server          Browser
─────────────          ──────────────────          ───────
  UDP :14550  -------->  MavEsp8266 (recv)
              <--------  GCS Heartbeat (1 Hz)
                         │
                         ├── parse MAVLink frame
                         ├── lookup MESSAGE_MAP by msg_id
                         ├── deserialize payload → MAVLink class
                         ├── convert → normalized {type, payload}
                         ├── wrap in envelope {type: "message", message}
                         │
                         WebSocket :3001  -------->  MavlinkAdapter
                                         <--------  {type: "command", command}
                                                     │
                                                     ├── onMessage(cb) subscribers
                                                     └── onStatusChange(cb) subscribers
```

### Ports

| Port  | Protocol  | Direction          | Purpose                        |
|-------|-----------|--------------------|--------------------------------|
| 14550 | UDP       | Aircraft → Server  | MAVLink telemetry reception    |
| 14555 | UDP       | Server → Aircraft  | MAVLink commands + GCS heartbeat |
| 3001  | WebSocket | Server ↔ Browser   | Normalized JSON bridge         |

### WebSocket Envelope Format

All messages between server and browser are JSON envelopes:

```
// Server → Browser: telemetry
{ "type": "message", "message": { type, timestamp, source, payload } }

// Server → Browser: connection status change
{ "type": "status", "status": { state, lastSeen, latencyMs, info } }

// Browser → Server: send a command
{ "type": "command", "command": { action, params } }

// Browser → Server: lifecycle
{ "type": "connect" }
{ "type": "disconnect" }
```

---

## Adapter Interface

Every adapter implements this contract. The rest of the system only sees this surface.

```
Adapter
  connect(config)          → void          // open connection, begin receiving
  disconnect()             → void          // close connection, clean up
  send(command)            → void          // send a normalized command to the aircraft
  onMessage(callback)      → unsubscribe   // subscribe to normalized inbound messages
  onStatusChange(callback) → unsubscribe   // subscribe to connection status changes
  status                   → ConnectionStatus
```

No other surface. The state store, event bus, and UI interact only through these methods.

---

## Normalized Message (Inbound)

Every message the adapter emits has this shape:

```
NormalizedMessage
  type        : string       // message category (see table below)
  timestamp   : number       // ms since epoch, server applies on receipt
  source      : string       // adapter identifier, e.g. "mavlink-udp"
  payload     : object       // type-specific key-value data
```

### Message Types

| type | payload keys | units / notes |
|------|-------------|---------------|
| `attitude` | roll, pitch, yaw, rollRate, pitchRate, yawRate | radians, rad/s |
| `position` | lat, lon, altMSL, altAGL, heading | deg, meters, deg |
| `velocity` | vx, vy, vz, groundSpeed, airspeed, climb, throttle | m/s (vx/vy/vz from GlobalPositionInt, rest from VfrHud) |
| `battery` | voltage, current, remaining | V, A, 0-1 fraction |
| `gps` | fixType, satellites, hdop, vdop | integer, float |
| `imu` | ax, ay, az, gx, gy, gz, mx, my, mz | m/s^2, rad/s, gauss |
| `pressure` | absPress, diffPress, temperature | hPa, hPa, degC |
| `rcChannels` | channels[] | normalized 0-1 per channel |
| `servo` | outputs[] | PWM us |
| `heartbeat` | armed, mode, systemStatus | boolean, string, string |
| `mission` | seq, total, currentWaypoint | integers |
| `statusText` | severity, text | string, string |
| `param` | id, value, type | string, number, string |
| `linkQuality` | rxErrors, rxDropped, txBuffer | integers |
| `commandAck` | command, result | string (MavCmd name), string (MavResult name) |

New types can be added by extending the table and adding a `reg()` call in `mappings.js`.

---

## Normalized Command (Outbound)

Commands sent through the adapter:

```
NormalizedCommand
  action      : string       // what to do
  params      : object       // action-specific parameters
```

### Command Types

| action | params | MAVLink mapping |
|--------|--------|-----------------|
| `arm` | | CommandLong → COMPONENT_ARM_DISARM, param1=1 |
| `disarm` | | CommandLong → COMPONENT_ARM_DISARM, param1=0 |
| `setMode` | mode: string | CommandLong → DO_SET_MODE, param2=ArduPilot mode number |
| `goto` | lat, lon, alt | CommandLong → DO_REPOSITION |
| `takeoff` | alt | CommandLong → NAV_TAKEOFF, param7=alt |
| `land` | | CommandLong → NAV_LAND |
| `setParam` | id, value, type | ParamSet message |
| `getParam` | id | ParamRequestRead, response arrives as `param` message |
| `setMessageRate` | messageId, rateHz | CommandLong → SET_MESSAGE_INTERVAL |

---

## Connection Status

```
ConnectionStatus
  state       : "disconnected" | "connecting" | "connected" | "reconnecting"
  lastSeen    : number | null    // timestamp of last received message
  latencyMs   : number | null    // round-trip if measurable
  info        : string | null    // e.g. "udp://127.0.0.1:14550"
```

The browser adapter handles WebSocket reconnection with capped exponential backoff (1s → 2s → 4s → 8s → 16s). The bridge server handles UDP lifecycle independently.

---

## Connection Config

```
ConnectionConfig
  type        : "udp" | "tcp" | "serial" | "websocket"
  host        : string
  port        : number
  baudRate    : number           // serial only
  path        : string           // serial device path
```

Currently only UDP is implemented. The bridge server listens on 14550 (receive) and sends to 14555 (send) by default.

---

## MAVLink Message Mappings

The `mappings.js` file contains all MAVLink ↔ normalized conversions. It is a pure data transformation module — no I/O, no side effects. Only imported by the bridge server.

### Inbound (MAVLink → Normalized)

| MAVLink Class | MSG_ID | Normalized type(s) | Key conversions |
|---|---|---|---|
| Heartbeat | 0 | `heartbeat` | baseMode & SAFETY_ARMED → armed, customMode → ArduPilot mode name |
| Attitude | 30 | `attitude` | Direct mapping, rollspeed → rollRate etc. |
| GlobalPositionInt | 33 | `position`, `velocity` | lat/lon ÷ 1e7, alt ÷ 1000, vx/vy/vz ÷ 100 |
| VfrHud | 74 | `velocity` | groundSpeed, airspeed, climb, throttle |
| SysStatus | 1 | `battery`, `linkQuality` | voltageBattery ÷ 1000, currentBattery ÷ 100, batteryRemaining ÷ 100 |
| GpsRawInt | 24 | `gps` | eph/epv ÷ 100 → hdop/vdop |
| ScaledImu | 26 | `imu` | All fields ÷ 1000 |
| ScaledPressure | 29 | `pressure` | temperature ÷ 100 |
| RcChannels | 65 | `rcChannels` | chan*Raw 1000-2000us → 0-1 normalized |
| ServoOutputRaw | 36 | `servo` | servo*Raw direct (PWM us) |
| MissionCurrent | 42 | `mission` | seq, total |
| StatusText | 253 | `statusText` | MavSeverity enum → string, null-terminated text cleanup |
| ParamValue | 22 | `param` | paramId null-terminated cleanup |
| CommandAck | 77 | `commandAck` | MavCmd enum → command name, MavResult enum → result name |

### Outbound (Normalized → MAVLink)

Uses `buildCommand({ action, params })` which returns a MAVLink message instance. The bridge server sends it via `MavEsp8266.send()`.

### GCS Heartbeat

The bridge server sends a MAVLink Heartbeat at 1 Hz with `type=MAV_TYPE_GCS`, `autopilot=MAV_AUTOPILOT_INVALID`. This is required — ArduPilot may stop sending certain telemetry if it doesn't receive a GCS heartbeat.

---

## Adapter Guarantees

1. **No protocol leakage.** The browser never sees MAVLink message IDs, framing, or classes. If it crosses the WebSocket, it's normalized JSON.
2. **Timestamp on receipt.** The bridge server timestamps every message on arrival. Protocol-internal timestamps are not exposed.
3. **Connection lifecycle is self-contained.** The bridge server manages UDP. The browser adapter manages WebSocket reconnection. Consumers subscribe to status changes — they don't drive connections.
4. **Stateless from the consumer's perspective.** No buffering or aggregation. Each normalized message is emitted as it arrives.
5. **Swappable.** A different adapter (different protocol, Electron IPC, mock data) implements the same interface. No changes above the adapter layer.

---

## What the Adapter Does NOT Do

- **No state.** Does not track "current altitude" or "armed state." That's the state store.
- **No events.** Does not emit to the event bus. The state store does that when state changes.
- **No command validation.** Precondition checks (e.g. "can't arm without GPS fix") are the action registry's job.
- **No decimation.** Emits everything. The consumer decides what to keep.

---

## File Structure

```
server/
  index.js                  // Bun bridge server — UDP ↔ MAVLink ↔ WS

src/adapters/
  types.js                  // NormalizedMessage, NormalizedCommand, ConnectionConfig, ConnectionStatus
  mavlink/
    MavlinkAdapter.js       // Browser-side adapter — WS client, adapter contract
    mappings.js             // MAVLink ↔ normalized conversions (server-side only)
```

---

## Dev Console

The browser adapter logs a 1 Hz telemetry summary to the browser DevTools console:

```
[telem] GUIDED ARMED | lat=-35.3632621 lon=149.1652372 alt=10.2m MSL=594.2m hdg=352°
        | gs=0.5m/s as=1.2m/s climb=0.1m/s | R=-0.1° P=-0.1° Y=-7.8°
        | bat=12.6V 99% | gps=6 sat=10

[ack]   DO_SET_MODE → ACCEPTED          (green)
[ack]   COMPONENT_ARM_DISARM → DENIED   (red)
```

For dev testing, the adapter is exposed on `window.__adapter`:

```js
__adapter.send({ action: 'arm' })
__adapter.send({ action: 'setMode', params: { mode: 'GUIDED' } })
__adapter.send({ action: 'takeoff', params: { alt: 20 } })
__adapter.status  // → { state: 'connected', lastSeen: ..., info: 'ws://localhost:3001' }
```

---

## Future: Electron Swap

The `MavlinkAdapter.js` is designed for a clean Electron swap:

- Replace `new WebSocket(BRIDGE_URL)` with `ipcRenderer` calls
- Replace `ws.onmessage` with `ipcRenderer.on('adapter:message', ...)`
- Move `server/index.js` logic into Electron main process
- The public interface (`connect`, `disconnect`, `send`, `onMessage`, `onStatusChange`, `status`) does not change
- Nothing above the adapter layer is affected
