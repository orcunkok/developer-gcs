# Networking

How vehicle data gets into the app, and how commands get out.

## Compartments

The app is split into compartments that only meet through the stores. Each can change or fail without breaking the others.

```
 vehicle ──bytes──▶ network ──telemetry.write()──▶ stores ──▶ components
 vehicle ◀─bytes─── network ◀──$onAction────────── stores ◀── command.takeoff(1, 10)
```

| Compartment | Files | Job |
|---|---|---|
| Stores | `src/stores/useTelemetry.js`, `src/stores/useCommands.js` | Hold and validate app data. Never throw. Know nothing about links or protocols. |
| Network | `src/network/` | Links, transports, protocols (MAVLink), routing commands to the right link. |
| On top (later) | — | Link management. |

Components only ever touch the stores.

## Vehicles

Every vehicle is one flat object in `telemetry.id`, keyed by an id the app hands out (1, 2, 3, …). The full list of properties is `createVehicle` in `src/stores/useTelemetry.js`:

```js
telemetry.id[1] = {
  id: 1, name: 'Drone 1', state: 'takeoff', swarm: null,
  type: 'quadrotor', arm: true,
  attitude: { roll, pitch, yaw },
  local: { x, y, z, vx, vy, vz },
  global: { lat, lon, alt },
  velocity: { airspeed, groundspeed, climb },
  battery, gps, status, link,   // null until the vehicle sends them (so are type and arm)
}
```

## Reading telemetry

```vue
<script setup>
import { useTelemetryStore } from '../stores/useTelemetry.js'
const telemetry = useTelemetryStore()
</script>

<template>
  <div v-for="vehicle in telemetry.id" :key="vehicle.id">
    {{ vehicle.name }} {{ vehicle.attitude.roll }} {{ vehicle.battery?.voltage }}
  </div>
</template>
```

- Use `?.` on fields that start as `null` and on `telemetry.id[n]` when the vehicle may not exist yet.
- Outside templates, watch with a getter: `watch(() => vehicle.attitude, (a) => …)`.
- Only what you read wakes you up: a new attitude for drone 1 re-runs only code reading drone 1's attitude. Repeated identical values wake no one.

## Sending commands

```js
import { useCommandsStore } from '../stores/useCommands.js'
const command = useCommandsStore()

command.arm(1)
command.takeoff(1, 10)
command.goto(2, 10, 5, -8)

// swarm: membership and the same commands to every member
const { swarm } = command
swarm.add(1, 1)          // drone 1 joins swarm 1
swarm.add(2, 1)
swarm.takeoff(1, 10)     // every drone in swarm 1
swarm.members(1)         // [1, 2]
swarm.remove(1)          // drone 1 leaves its swarm
```

Every command returns `true` when accepted and `false` when the vehicle or swarm does not exist or an argument is invalid. Nothing throws. An accepted command becomes the vehicle's `state`.

A swarm command reaches every member or none: bad arguments are refused before anything is sent.

Accepted means the store took it; delivering it is the network's job. A vehicle with no working link still accepts commands.

## Store API

Nothing here throws; every call returns `true`/`false` (or the value) and ignores invalid input.

| Call | Does |
|---|---|
| `telemetry.get(id)` | The vehicle, or `undefined` |
| `telemetry.add()` | New vehicle, returns its id (network only) |
| `telemetry.write(id, field, value)` | New value for an existing telemetry field: a plain value (`type`, `arm`) or a new object (network only) |
| `telemetry.remove(id)` | Vehicle leaves (network only) |
| `command.<name>(id, …values)` | Command to one vehicle |
| `command.swarm.add(id, group)` / `.remove(id)` | Swarm membership; group is a whole number from 1 |
| `command.swarm.members(group)` | Ids in that swarm |
| `command.swarm.<name>(group, …values)` | Command to every member |

`write` refuses unknown fields, the app's own fields (`id`, `name`, `state`, `swarm`), `null`, `undefined` and functions.

## Adding things

**A telemetry field:** add it to `createVehicle`, then decode it in each link that can provide it (`MESSAGES` in `src/network/useMavlink.js`).

**A command:** add one line to `commands` in `src/stores/useCommands.js`:

```js
hover: (n, seconds) => accept(n, 'hover', finite(seconds)),
```

It is now `command.hover(id, s)` and `swarm.hover(group, s)`. Then encode it in each link that can carry it (`COMMANDS` in `src/network/useMavlink.js`).

**A protocol:** write one adapter in `src/network/`. It talks to the stores only through:

- `telemetry.add()` when a vehicle appears, `telemetry.write(…)` for its data, `telemetry.remove(id)` when it is gone;
- `command.$onAction(({ name, args, after }) => after((accepted) => …), true)` to send accepted commands for its own vehicles (`args[0]` is the vehicle id). Catch its own errors, so a failed send never reaches the component that issued the command.

The adapter keeps its own map from its protocol's vehicle identity to the app id. Nothing outside the adapter ever sees protocol ids.

## Connecting a vehicle

Transports and the adapter are plugged together by hand (there is no connect UI yet):

```js
import { useMavlink } from '../network/useMavlink.js'
import { useUDP } from '../network/useUDP.js'

// UDP: listen on 14550 and reply to whoever sent last
let peer
const udp = useUDP({ port: 14550 }, (bytes, host, port) => {
  peer = { host, port }
  mavlink.receive(bytes)
}, () => mavlink.close())
const mavlink = useMavlink((bytes) => peer && udp.send(bytes, peer.host, peer.port))
```

```js
import { useMavlink } from '../network/useMavlink.js'
import { useTCP } from '../network/useTCP.js'

// TCP, e.g. SITL on 5760
const tcp = useTCP({ host: '127.0.0.1', port: 5760 }, (bytes) => mavlink.receive(bytes), () => mavlink.close())
const mavlink = useMavlink(tcp.send)
```

Vehicles appear in `telemetry.id` with their first message and leave when the connection closes.

**Why a bridge:** browsers cannot open UDP/TCP sockets. `src/network/bridge.js` runs inside the Vite dev server and holds the real sockets; the page talks to it over a WebSocket. So UDP/TCP only work under `bun run dev` for now.

## Test mode

`bun run dev:test` loads `test/MockSimulation.js`: simulated FPV drones (`test/MockFPV.js`) that use the same store calls as a real link (`add`, `write`, `$onAction`). The rest of the app sees them exactly like real vehicles. Commands are in the README.

## Rules

- Stores hold data and never throw; links, protocols and routing live in the network.
- No protocol names, ids, units or enums outside the network.
- Components read the stores; only the network calls `add`, `write` and `remove`.
- Always write a new object (or a plain value); changing a written object in place notifies no one.
- Code that reads fast fields from every drone (centroids, big tables) wakes on every drone's update: batch it to once per frame.
