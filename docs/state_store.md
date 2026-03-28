# State Store

Single Pinia store (`src/stores/telemStore.js`) — the single source of truth for all vehicle telemetry and connection state.

## Architecture

```
Adapter.onMessage() → telem.ingest(msg) → flat ref updates
                                        → eventLog.addSample() (telemetry history)
                                        → eventLog.addEvent()  (state transitions)
Adapter.onStatusChange() → telem.updateConnection(status)
                         → eventLog.addEvent() (link state changes)
```

Wired in `main.js`. Components read refs directly — Vue reactivity handles the rest. Temporal data lives in `eventLogStore` (see `docs/event_log_store.md`).

## Design Decisions

- **One store, one file.** No module sprawl.
- **Flat `ref()` per value.** Vue tracks each independently — a component reading `roll` won't re-render when `voltage` changes.
- **`shallowRef` for collections** (params, statusMessages, lastAck). Avoids deep proxy overhead; replaced wholesale on update.
- **O(1) handler dispatch.** `HANDLERS` object keyed by message type. No switch/if chains.
- **Direct `.value =` assignment.** Fastest possible mutation in Vue.
- **Read-only from outside.** Only `ingest()` and `updateConnection()` mutate. Components just read refs.
- **Unknown message types silently dropped.** Adding new types later is zero-cost.

## State Shape

| Domain | Refs | Source Message |
|--------|------|---------------|
| connection | connState, latencyMs, lastSeen | adapter.onStatusChange |
| attitude | roll, pitch, yaw, rollRate, pitchRate, yawRate | `attitude` |
| position | lat, lon, altMSL, altAGL, heading | `position` |
| velocity | vx, vy, vz, groundSpeed, airspeed, climb, throttle | `velocity` |
| battery | voltage, current, remaining | `battery` |
| gps | fixType, satellites, hdop, vdop | `gps` |
| heartbeat | armed, mode, systemStatus | `heartbeat` |
| mission | missionSeq, missionTotal, currentWaypoint | `mission` |
| link quality | rxErrors, rxDropped, txBuffer | `linkQuality` |
| params | params (shallow map) | `param` |
| status text | statusMessages (last 50, shallow array) | `statusText` |
| command ack | lastAck (shallow) | `commandAck` |
| meta | lastTimestamp | all messages |

## Adding New Telemetry

1. Add `ref()` declarations in `telemStore.js`
2. Add a handler function in the `HANDLERS` object
3. Return the new refs from the setup function

No other files change.

## Usage in Components

```vue
<script setup>
import { useTelemStore } from '@/stores/telemStore.js'
const telem = useTelemStore()
</script>

<template>
  <div>{{ telem.roll.toFixed(2) }}°</div>
</template>
```

## What This Store Does NOT Do

- **No history/ringbuffers** — eventLogStore handles temporal data (ring buffers for sparklines, append-only log for discrete events)
- **No computed aggregates** — add when UI needs them
- **No validation** — adapter already normalizes
- **No commands** — action registry layer handles outbound
- **No IMU/pressure/RC/servo** — add when consumed
