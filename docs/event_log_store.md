# Event Log Store

Replaces a traditional event bus. Pinia reactivity already handles pub/sub — components watch refs, Vue triggers re-renders. What was missing: **bounded temporal history** for timeline, sparklines, replay, and AI context.

Single Pinia store (`src/stores/eventLogStore.js`).

## Why Not a Separate Event Bus?

Pinia + Vue reactivity IS the event bus. Adding a second pub/sub layer would duplicate subscriptions without adding value. The event log is the missing piece: an append-only, queryable record of what happened and when.

## Architecture

```
telemStore.ingest(msg)
  ├─ updates flat refs (current state)
  ├─ eventLog.addSample(channel, value, t)   ← high-frequency telemetry
  ├─ eventLog.addEvent(type, data, t)        ← state transitions only
  └─ eventLog.notifySeries()                 ← throttled to ~10Hz

Components read:
  - telemStore refs     → current values (reactive)
  - eventLog.events     → discrete event history (reactive via shallowRef)
  - eventLog.recentSamples() → ring buffer data (poll via seriesVersion)
```

## Two Separate Structures

Telemetry samples and discrete events have fundamentally different characteristics. Mixing them would force wrong eviction policies on one or the other.

### Discrete Events

ARM, DISARM, MODE_CHANGE, LINK_CONNECTED, LINK_DISCONNECTED, LINK_RECONNECTING. More types added as action registry and skills land.

- **Storage:** `shallowRef([])`, capped at 10,000 entries
- **Append:** mutate-in-place + `triggerRef()` (no array copy per push)
- **Query:** `recentEvents(ms)` with binary search (array is time-sorted)
- **Memory:** ~1 MB max at cap

### Telemetry Ring Buffers

Per-channel circular buffers for sparkline history and AI context.

- **Storage:** Plain `RingBuffer` class (not reactive), one per channel
- **Capacity:** 1,200 slots per channel (~120s at 10Hz)
- **Notification:** `seriesVersion` shallowRef bumped at ~10Hz (throttled in `telemStore.ingest`), not per sample
- **Query:** `recentSamples(channel, n)` returns last n entries oldest→newest

Channels currently recorded: `roll`, `pitch`, `yaw`, `rollRate`, `pitchRate`, `yawRate`, `altMSL`, `altAGL`, `heading`, `groundSpeed`, `airspeed`, `climb`, `throttle`, `voltage`, `remaining`

## Memory Budget (2-hour flight)

| Structure | Entries | Memory |
|-----------|---------|--------|
| Discrete events (10k cap) | 10,000 x ~100B | ~1 MB |
| Ring buffers (15 channels x 1,200) | 18,000 objects | ~600 KB |
| **Total** | | **~1.6 MB** |

Bounded. No growth after buffers fill.

## API

### Write (called from telemStore or future action registry)

| Method | Purpose |
|--------|---------|
| `addEvent(type, data?, timestamp?)` | Push a discrete event |
| `addSample(channel, value, timestamp?)` | Push to channel ring buffer |
| `notifySeries()` | Bump version counter for sparkline watchers |

### Read (called from UI components, AI skills, export)

| Method | Purpose |
|--------|---------|
| `recentEvents(ms)` | Events in last N milliseconds (binary search) |
| `recentSamples(channel, n?)` | Last n samples from a channel |
| `channels()` | List all recorded channel names |
| `exportSession()` | Full dump: events + all series |
| `clear()` | Reset everything (new session) |

### Reactive State

| Ref | Purpose |
|-----|---------|
| `events` | shallowRef — watch for discrete event list changes |
| `seriesVersion` | shallowRef counter — watch to know when ring buffers have new data |

## Usage in Components

### Sparkline (watches ring buffer)

```vue
<script setup>
import { computed } from 'vue'
import { useEventLogStore } from '@/stores/eventLogStore.js'
const log = useEventLogStore()

const rollData = computed(() => {
  log.seriesVersion // dependency trigger
  return log.recentSamples('roll', 300)
})
</script>
```

### Timeline (watches discrete events)

```vue
<script setup>
import { computed } from 'vue'
import { useEventLogStore } from '@/stores/eventLogStore.js'
const log = useEventLogStore()

const timelineEvents = computed(() => log.events)
</script>
```

## State Transition Detection

telemStore handlers compare before/after values and emit discrete events only on actual changes:

- **heartbeat:** `armed` changed → `ARM` / `DISARM`; `mode` changed → `MODE_CHANGE`
- **updateConnection:** `connState` changed → `LINK_CONNECTED` / `LINK_DISCONNECTED` / `LINK_RECONNECTING`

Future event types (added with action registry and skills): `COMMAND_SENT`, `COMMAND_ACK`, `COMMAND_FAILED`, `ALERT`, `AI_DECISION`, `WAYPOINT_REACHED`, `TAKEOFF`, `LAND`

## What This Does NOT Do (Doors Open)

- **IndexedDB persistence** — `exportSession()` is the hook. Periodic flush can be added without changing any consumer code.
- **Replay engine** — the log is the source of truth. A replay module would feed stored data back through `addEvent`/`addSample`.
- **Full-text search** — `recentEvents()` is enough for now. Filtering by type can layer on top.
- **Web Worker offload** — not needed at <50Hz. If telemetry goes to 200Hz+, move ring buffers to SharedArrayBuffer.
