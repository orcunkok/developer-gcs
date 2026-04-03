# UI TODO

Build order: get to a flying, logging, rendering state as fast as possible. Hardware-in-the-loop items first, polish after.

---
## Chrome Scaffold

- [X] Application shell renders with correct proportions: topbar, left pane, primary area, right pane, bottom strip
- [X] All panes are empty placeholders. No content, just layout and borders
- [X] Topbar exists as a single fixed-height bar across the full width
- [X] Left pane is fixed width, does not scroll, does not collapse yet
- [X] Right pane exists at correct width, collapsible to a thin strip
- [X] Bottom strip exists at correct height, collapsible to a thin strip
- [X] Primary area fills all remaining space
- [X] Window resize handled gracefully, no layout breaks
- [X] Light theme and fonts applied globally
- [X] Monospace font loaded and applied to telemetry zones
- [X] Color token system in place: green, amber, red, purple, blue semantics defined as CSS variables, not hardcoded anywhere
- [X] Navbar can collapse and open
- [X] Navbar has clickable elements
---
## Left Pane: Mini-Fly

- [x] Connects to SITL via the protocol adapter
- [x] Displays live: roll, pitch, yaw, IAS, vertical speed, altitude MSL, altitude AGL, GPS satellite count, link quality, battery percentage and voltage
- [ ] Values update at ~30Hz display rate regardless of incoming message rate
- [ ] Emergency and warning status creates a visual distinction
- [ ] Color rules applied: values go amber or red based on thresholds
- [ ] Double-click target area defined on the mini-fly header (handler stubbed, not implemented yet)
- [ ] Section is visually separated from mini-think below it
---
## Left Pane: Mini-Think

- [ ] Mini-think section renders below mini-fly in the left pane
- [ ] Confidence bars for: AI decision making, AI voice-to-text, computer vision, route validation, sensor fusion, path planning etc.
- [ ] Bars hardcoded to test values initially. Live AI data wired in when the autonomy stack provides it
- [ ] Double-click target area defined on mini-think header (handler stubbed)

**Not immediate, Nice to have**
  - [ ] Color rules: green above 80%, amber 60-80%, red below 60%
  - [ ] Next planned action field: single plain-English line, sourced from autonomy stack output
  - [ ] Current model name and version displayed
  - [ ] Model switcher dropdown exists. Selecting a different model while armed shows an inline confirmation bar before executing
---
## Bottom Console

- [ ] Console drawer exists as single line, collapsed by default to the bottom strip
- [ ] Console is visually distinct from the rest of the UI: monospace, dense
- [ ] Command input field at the bottom of the console
- [ ] Commands send the correct MAVLink messages via the adapter
- [ ] \ key toggles it open to a fixed height
- [ ] Drag-to-resize works up to ~50% screen height
- [ ] Raw message stream displays in the console, scrollable
- [ ] Command history navigable with up/down arrow keys
- [ ] Prevent unset/unhandled commands to be sent
- [ ] Command palette parser handles: `/arm, /disarm, /goto WP[n], /mode [mode]`
---
## Map Tile

- [x] MapTalks integrated into the primary area as a tile
- [x] Aircraft position marker renders and moves in real time from SITL data
- [x] Right-click context menu on map: Goto, Add Waypoint, Drop Marker, Measure Distance
- [x] Waypoints rendered as clickable markers
- [ ] Map does not use any hardcoded tile provider. Tile source is configurable
- [ ] Map tile can occupy full primary area or share it with other tiles

**Not immediate, Nice to have**
  - [ ] Planned route overlaid as a line
  - [ ] Actual flown path trails behind the aircraft as a separate line
---
## 3D Attitude Tile

- [ ] Three.js scene renders a simplified aircraft model in a primary area tile
- [ ] Aircraft roll, pitch, yaw applied in real time from SITL data
- [ ] Ground reference plane visible at AGL zero
- [ ] Scene is readable at tile size
- [ ] 3D tile can coexist with map and camera tiles in primary area

**Not immediate, Nice to have**
  - [ ] MiniMap, showing plane, home and north
---
## Right Pane: COMMAND Segment

- [ ] Right pane renders with three segments: COMMAND, DATA, THINK
- [ ] Segments are independently drag-resizable vertically
- [ ] COMMAND segment has a text input and a scrollable response history
- [ ] GCS text commands wired: eg. `show [field], goto [waypoint], arm, disarm, load mission [name], compare flight [date]`
- [ ] Responses are plain text, structured, not conversational filler
- [ ] Command history navigable with up/down
- [ ] Right pane collapses to a thin strip when not needed, expands on click
---
## AI Commander

- [ ] Natural language input wired to aircraft commands
- [ ] Supports: goto, orbit, change altitude, change speed, abort, return to home
- [ ] Each command requires a plain-English confirmation before sending
- [ ] Confirmation shows what command will be sent before execution
- [ ] Refusals are plain and specific: "cannot arm while pre-flight checks are incomplete"
- [ ] AI Commander is a thin layer over the same adapter as the console. Same commands, different interface
---
## AI GCS

- [ ] Natural language queries answered about GCS state and flight data
    - "Why did the AI deviate at [time]" pulls from decision log, returns plain English
    - "Show me roll rate from the last 5 minutes" opens that field in primary display
    - "Compare this flight to yesterday" loads previous flight overlay
    - "What is the AI confidence trend since takeoff" renders trend in right pane DATA
- [ ] Queries that cannot be answered state why. No hallucination
- [ ] GCS AI and AI Commander share context but are distinct interfaces
---
## Right Pane: DATA Segment (Sparklines)

- [ ] DATA segment renders user-configurable sparklines
- [ ] Field picker lets user drag any telemetry field into the segment
- [ ] Default fields: roll rate, IAS, AI confidence, vertical speed
- [ ] Tapping any sparkline opens that field full-size in the primary area
- [ ] Sparklines are time-synchronized to the timeline
---
## Camera Tile

- [ ] Camera feed renders in a tile in the primary area
- [ ] Source is configurable (RTSP, local device, file loop for SITL)
- [ ] Feed displays at native aspect ratio, no stretching
- [ ] CV overlay toggle exists in the tile header. Off by default, does nothing yet
- [ ] Camera tile can coexist with map tile in the primary area
---
## Double-Click Expand

- [ ] Double-clicking mini-fly header opens full DATA canvas in primary area
- [ ] Double-clicking mini-think header opens full THINK canvas in primary area
- [ ] Expanded canvas shows a minimize button. Clicking it restores previous primary layout
- [ ] Keyboard shortcuts `Cmd+1` and `Cmd+2` do the same thing
- [ ] Shortcuts work even when the mini-tiles are not visible (focus mode)
---
## Timeline Strip

- [ ] Timeline renders across the full bottom width above the console
- [ ] Flight time axis scrolls rightward in live mode, playhead pinned to right edge
- [ ] Event pills render on the timeline: ARM, DISARM, mode changes, anomalies
- [ ] Mode bands render as colored horizontal bars below the event pills
- [ ] All events sourced from global store
- [ ] LIVE indicator (colored dot + label) renders at the playhead
- [ ] L key toggles the raw log drawer from the timeline
---
## Tiling System

- [ ] Primary area supports 1x1, 2x1, 2x2 tile layouts
- [ ] Available tiles: Map, Camera, 3D View, DATA, THINK, CONNECT, PLAN, REPLAY
- [ ] Layout is drag-to-resize between tiles
- [ ] Named layouts can be saved and restored
- [ ] Last used layout restores on launch
- [ ] Split mode `(Cmd+\)` divides primary into two independently controlled panes
---
## CONNECT Workspace

- [ ] System topology diagram renders as a node graph: IMU, GPS, BARO, LIDAR, CAM, CV engine, AHRS, NAV, AUTOPILOT, COMMS, ESCs, SERVOS
- [ ] Network connections and protocols shown: GCS, plane, other GCS, mesh nodes, routers
- [ ] Node health state sourced from heartbeat and sensor health messages via adapter
- [ ] Node states: healthy, degraded, failed, not configured
- [ ] Clicking a node opens its subsystem detail in a split pane: message stream, health metrics, message rate, last value, error log
- [ ] Pre-built one-click test workflows: motor spin test, GPS accuracy test, IMU calibration, sensor health check
- [ ] Failure injection: any node can be artificially failed to test autonomy response
- [ ] Time River minimized in CONNECT, thin event strip only
---
## PLAN Workspace

- [ ] Split pane: mission script editor on the left, map on the right
- [ ] Script editor: monospace font, YAML syntax highlighting, line numbers
- [ ] Map updates in real time as script is edited
- [ ] Clicking a waypoint on the map jumps cursor to the relevant script line
- [ ] Diff view: change any parameter, see previous vs new simulated flight paths overlaid on map
- [ ] Mission scripts are plain text files, git-friendly
- [ ] Time River minimized in PLAN
---
## REPLAY Workspace

- [ ] Flight log selector on first open, lists recorded flights
- [ ] Time River expands to ~25% screen height in REPLAY, playhead large and draggable
- [ ] All panels lock to playhead position
- [ ] Playback speed: 0.1x to 10x
- [ ] Entire status bar shifts to amber tint in REPLAY, persistent banner: `"REPLAY MODE"`
- [ ] Jump to annotated events (markers set during live flight)
- [ ] Anomaly detection overlay: highlights moments where sensor deviation, confidence drop, or commanded vs actual divergence exceeded threshold
- [ ] Flight comparison: load a second flight, overlay as ghost traces on all charts, toggle with one key
- [ ] Export: selected time window to CSV, JSON, Parquet, or auto-generated PDF flight report
- [ ] `R` or `Esc` returns to LIVE mode
---
## Cross-Cutting Rules

- No layer knows about the layer above it. Adapter does not know about state store, state store does not know about UI
- No layer is bypassed for any reason including shipping speed
- Every action that can be taken in the UI can be taken through the action registry programmatically
- Every piece of state visible in the UI is readable through the internal API
- Every event that causes a UI update is on the event bus
- Protocol-specific code exists only inside protocol adapters
- No MAVLink imported outside the protocol adapter
- README kept current with whatever step is complete
- Each completed step produces a screenshot or screen recording worth sharing
- AI-specific code exists only inside skills and the skill runtime
- All layout dimensions defined as CSS variables, not hardcoded
- All color semantics defined as global css variables, referenced everywhere
- No MAVLink imported outside the protocol adapter

## AI First Design
-All state is queryable programmatically, not just visible on screen
-All actions are invokable programmatically, not just through UI clicks
-The protocol adapter exposes a clean internal API that an agent can call
-Flight history is stored in a structured, queryable format, not just log files
