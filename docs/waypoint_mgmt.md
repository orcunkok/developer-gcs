# Waypoint Management

**Status:** Implemented (MVP — download, upload, clear, reactive sync)

**Date:** April 2026

---

## Overview

Waypoint management uses the MAVLink Mission Protocol to download, upload, and track mission items between the GCS and the autopilot. The protocol is transactional (all-or-nothing), request-driven (GCS always initiates), and stateless on the wire (no persistent session).

The autopilot never pushes its mission to the GCS. The GCS must explicitly request it.

---

## Design: Reactive Sync via Free Telemetry

No polling. No background sync. No explicit "download on connect" step. The trigger is data we're already receiving.

**Core insight:** `MISSION_CURRENT` is already streaming as part of normal telemetry. It tells us the active waypoint seq and total count. We use it as both a presence signal and a staleness detector.

### Sync logic (runs on every `MISSION_CURRENT` message)

```
MISSION_CURRENT arrives (seq, total)
  |
  ├── No local mission?
  |     → auto-download
  |
  ├── seq out of local range? (e.g. local has 5 items, seq=8)
  |     → mission changed externally, auto-download
  |
  ├── total changed? (e.g. local has 5 items, total now says 8)
  |     → mission changed externally, auto-download
  |
  └── seq in range, total matches?
        → just update active waypoint, zero network cost
```

### Design principles

1. **Reactive, not proactive** — we never request the mission on a schedule or on connect. We request it when free telemetry tells us we need to.
2. **Trust local copy when telemetry confirms it** — if `MISSION_CURRENT` seq and total match our local state, no action needed.
3. **Auto-detect external changes** — if seq or total don't match our local copy, we know we're stale and re-download without the user asking. This is free — the data was already in the stream.
4. **Upload is user-initiated only** — never push a mission unless the user explicitly says "Write to vehicle".
5. **`MISSION_ITEM_REACHED` is free** — already broadcast by autopilot, tells us when a waypoint is completed. Just consume it.
6. **Download is debounced** — if we're already downloading, ignore further triggers until the current transfer completes. Error state does NOT block retries — next `MISSION_CURRENT` will re-trigger.

Zero extra bandwidth. The trigger is data we're already receiving. If there's no mission on the vehicle, `MISSION_CURRENT` won't carry meaningful data, so we never request needlessly.

---

## Protocol: Download (Vehicle -> GCS)

```
GCS                              Autopilot
 |                                  |
 |  MISSION_REQUEST_LIST ---------> |
 | <--------- MISSION_COUNT (N)     |
 |                                  |
 |  MISSION_REQUEST_INT (seq=0) --> |
 | <--------- MISSION_ITEM_INT (0)  |
 |  ...                             |
 |  MISSION_REQUEST_INT (seq=N-1)-> |
 | <--------- MISSION_ITEM_INT(N-1) |
 |                                  |
 |  MISSION_ACK (ACCEPTED) -------> |
```

- Sequential, one item at a time. Each item validated by seq before accepting.
- 3s timeout per item, 3 retries per item, then abort entire transfer.
- No partial missions. Either you have all items or none.

## Protocol: Upload (GCS -> Vehicle)

```
GCS                              Autopilot
 |                                  |
 |  MISSION_COUNT (N) ------------> |
 | <-- MISSION_REQUEST_INT (seq=0)  |
 |  MISSION_ITEM_INT (0) --------> |
 |  ...                             |
 | <-- MISSION_REQUEST_INT (seq=N-1)|
 |  MISSION_ITEM_INT (N-1) ------> |
 | <--------- MISSION_ACK (result)  |
```

- The autopilot drives the request sequence. The GCS responds.
- `MISSION_ACK` result can be `ACCEPTED`, `NO_SPACE`, `INVALID_PARAM`, `INVALID_SEQUENCE`, etc.

---

## Architecture

Protocol-specific handshake logic lives in the adapter. The store is protocol-agnostic.

```
missionStore (protocol-agnostic)     MavlinkAdapter (protocol-specific)
────────────────────────────────     ──────────────────────────────────
mission.fetch()  ──────────────→     fetchMission()
                                       REQUEST_LIST → MISSION_COUNT
                                       REQUEST_INT × N → MISSION_ITEM_INT × N
                                       MISSION_ACK
                 ←──────────────     returns normalized items[]

mission.upload(items) ─────────→     uploadMission(items)
                                       MISSION_COUNT → REQUEST_INT × N
                                       MISSION_ITEM_INT × N → MISSION_ACK
                 ←──────────────     returns { ok, error? }

mission.clear()  ──────────────→     clearMission()
                                       MISSION_CLEAR_ALL → MISSION_ACK
                 ←──────────────     returns { ok, error? }
```

### File structure

| File | Role |
|------|------|
| `src/adapters/mavlink/mappings.js` | MAVLink ↔ normalized conversions (5 inbound regs, 6 outbound commands) |
| `src/adapters/mavlink/MavlinkAdapter.js` | `fetchMission()`, `uploadMission()`, `clearMission()` — MAVLink handshake |
| `src/stores/missionStore.js` | Reactive state, sync logic, actions. No protocol knowledge |
| `src/main.js` | Wires `mission.ingest()` into adapter message pipeline |

### missionStore state

| Field | Type | Description |
|-------|------|-------------|
| `items` | `shallowRef([])` | Normalized mission items `{ seq, frame, command, lat, lon, alt, param1-4, autocontinue }` |
| `activeSeq` | `ref(0)` | Currently active waypoint from `MISSION_CURRENT` |
| `syncState` | `ref('idle')` | `idle` / `fetching` / `uploading` / `error` |
| `syncError` | `ref(null)` | Error message when `syncState` is `error` |

### Adapter mission commands (registered as actions)

| action | params | MAVLink mapping |
|--------|--------|-----------------|
| `requestMissionList` | missionType? | `MISSION_REQUEST_LIST` |
| `requestMissionItem` | seq, missionType? | `MISSION_REQUEST_INT` |
| `sendMissionCount` | count, missionType? | `MISSION_COUNT` |
| `sendMissionItem` | seq, frame, command, param1-4, x, y, z, missionType? | `MISSION_ITEM_INT` |
| `sendMissionAck` | result, missionType? | `MISSION_ACK` |
| `clearMission` | missionType? | `MISSION_CLEAR_ALL` |

### Inbound message types

| type | payload | MAVLink source |
|------|---------|---------------|
| `missionCount` | count, missionType | `MISSION_COUNT` |
| `missionItemInt` | seq, frame, command, param1-4, x, y, z, current, autocontinue, missionType | `MISSION_ITEM_INT` |
| `missionAck` | result, missionType | `MISSION_ACK` |
| `missionRequestInt` | seq, missionType | `MISSION_REQUEST_INT` |
| `missionItemReached` | seq | `MISSION_ITEM_REACHED` |

### User-level actions (console / command palette)

```js
action.fetchMission()                    // re-download from vehicle
action.uploadMission({ items: [...] })   // write to vehicle
action.clearMission()                    // clear vehicle mission
```

### Debug (browser console)

```js
__adapter.fetchMission().then(console.log)   // raw fetch
__mission.items.value                        // current local copy
__mission.syncState.value                    // sync status
```

---

## Edge Cases & Failure Modes

### 1. Download interrupted mid-sequence

Connection drops after receiving items 0-5 of 12.

**Decision:** Discard partial list, retry from scratch on reconnect. MAVLink spec mandates this. No partial missions in the store, ever. The `fetchMission()` promise rejects, store stays at previous state.

### 2. Upload rejected

Autopilot sends `MISSION_ACK` with a non-ACCEPTED result (e.g. `NO_SPACE`, `INVALID_PARAM`).

**Decision:** Surface the error via `syncError`. The local copy remains unchanged — the user can fix and retry.

### 3. Two writers (race condition)

Another GCS or companion computer uploads a mission while we're uploading.

**Decision:** MAVLink has no locking. Last writer wins. If our upload gets a non-ACCEPTED ack or items come back in unexpected order, abort and notify the user.

### 4. MISSION_CURRENT points to unknown seq

We receive `MISSION_CURRENT seq=5` before we've downloaded the mission.

**Decision:** Store the active seq immediately. Triggers auto-download. Once download completes, UI can resolve it to a location.

### 5. Mission changed externally

Another tool uploads a new mission while we're displaying ours.

**Decision:** Auto-detected via `MISSION_CURRENT`. If total count changes or active seq falls outside local range, sync logic triggers re-download. Edge case: same item count with different contents won't be detected — same as QGC/Mission Planner.

### 6. Item 0 is home (ArduPilot-specific)

In ArduPilot, mission item 0 is always the home position, not a real waypoint.

**Decision:** Store item 0 but render it differently. Do not let the user delete or reorder it.

### 7. Items arrive out of order

**Decision:** `waitFor("missionItemInt", p => p.seq === seq)` validates seq before accepting. Wrong seq is ignored, correct seq is retried.

### 8. Empty mission

`MISSION_COUNT` returns 0.

**Decision:** `fetchMission()` returns `[]`. Valid state, not an error.

### 9. Timeout per item

**Decision:** 3s timeout, 3 retries per item. After 3 failures, abort entire transfer. `syncState` goes to `error`, next `MISSION_CURRENT` will re-trigger.

### 10. Fence and rally points

**Decision:** Deferred. Only `MISSION` type implemented. All outbound commands default `missionType` to `MavMissionType.MISSION` but accept it as a parameter for future use.

---

## Open Questions

See `docs/open_questions.md` — waypoint-related items #1–3.
