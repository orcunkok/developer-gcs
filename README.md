# developer-gcs

Vue 3 + Vite + maplibre-gl. Uses [bun](https://bun.sh).

## Install

```sh
bun install
```

## Run

```sh
bun run dev      # dev server
bun run dev:test # dev server with fake FPV drones (see Test mode)
bun run build    # production build to dist/
bun run preview  # serve the production build
```

## Test mode

`bun run dev:test` runs the app with simulated FPV drones, so features can be developed and checked without hardware. Open the 3D view to see them fly.

Type commands in the same terminal where `bun run dev:test` runs; results print back as `gcs: ...`. A browser tab must be open, since the drones are simulated in the page. Keep a single tab open: every tab runs its own drones and receives each command. Drones are numbered `1`, `2`, … (key `test:1`, …).

```
demo
stop
reset
spawn 3
swarm 1 2 3
swarm.arm
swarm.takeoff 10
swarm.alt 100
watch swarm
goto 2 15 -5 8
land 1
```

| Command | Action |
|---|---|
| `spawn n` | Add n drones near the origin (default 1) |
| `arm id` / `disarm id` | Arm / disarm |
| `takeoff id alt` | Take off to alt metres (default 5, must be armed) |
| `goto id north east alt` | Fly to a local position in metres |
| `alt id alt` | Climb or descend to alt metres at the current position |
| `land id` | Land at the current position, then disarm |
| `rtl id` | Return to launch: fly to its spawn point at 15 m (or higher if already above), then land |
| `stop id` | Hover in place; `stop` alone also ends `demo` and stops every drone |
| `reset` | Remove every drone; numbering starts from 1 again |
| `demo n` | Spawn n drones (default 4), take off, then random gotos every 3 s |
| `swarm 1 2 3` | Select drones for swarm commands (`swarm` alone selects all) |
| `watch id ...` / `watch swarm` | 3D camera follows those drones / the swarm (all drones if no swarm is selected) |
| `unwatch` | Free the camera (same as `watch` alone) |
| `swarm.<command> ...` | Send the same command to every selected drone, e.g. `swarm.arm`, `swarm.takeoff 10`, `swarm.alt 100`, `swarm.stop` |

Console style works too: `swarm(1,2,3)`, `swarm.alt(100)`. **Test only:** there is no swarm collision avoidance yet, so `swarm.goto north east alt` moves the swarm's centre to that point and each drone keeps its offset from the centre; the other swarm commands are sent to each member as-is. Unknown commands print the list. Single-letter lines (`r`, `u`, `o`, `c`, `q`, `h`) stay Vite's own shortcuts. The same commands work in the browser console as `gcs.takeoff(1, 10)` and `swarm.alt(100)`.

How it fits together:

- `src/link.js`: the link seam. Links push raw MAVLink messages in with `ingest()` and drop vehicles with `remove()`; commands go out with `send()`. Real links will plug in here.
- `test/testLink.js`: the simulated link. 50 Hz `LOCAL_POSITION_NED` and `ATTITUDE`, 1 Hz `HEARTBEAT`; handles arm/takeoff/land (`COMMAND_LONG`) and goto (`SET_POSITION_TARGET_LOCAL_NED`).
- `test/testFPV.js`: simple FPV quad physics (tilt-driven, visual wobble). VTOL and plane models go next to it later (`testVTOL.js`, `testPlane.js`).
- `test/testTerminal.js`: Vite plugin, loaded only in test mode, that forwards terminal lines to the browser.

`/test` is never part of production builds.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Toggle left pane |
| `Ctrl+.` | Toggle bottom strip |
| `Ctrl+/` | Toggle right pane |
| `Esc` | Close navbar / exit layout edit mode |

The navbar is opened with the menu button in the status bar. The layout button (right of the status bar) splits the display into 1x1/1x2/2x2 and assigns a view to each cell.

## Map

Right-drag rotates and tilts the map (custom handler in `src/views/map/MapView.vue`, no inertia). Map style, terrain and map CSS live in `src/views/map/`.
