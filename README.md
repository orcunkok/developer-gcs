# Developer GCS for 2026 
Version 0.2 · March 2026 · Working Document

*Authored by: **Orcun Kok***

--- 

QGC was designed around human control, this is designed around human understanding. Slacker Index must be eleminated, momentum should be preserved. 

> Build a tool where the aircraft tells you what it's doing, the AI tells you what it's thinking, and your only job is to make both of them smarter.


## 1 WHAT/HOW/WHY
An agentic AI ground control station built for autonomous aircraft development. Every system state is queryable, every action is invokable by AI, and every flight is fully replayable, programmatically.

An AI agent should be able to fly, debug, and analyze a mission using the same interface a human developer uses. Not a separate API bolted on the side;  same state store,  same action registry, same event bus.

QGroundControl, Mission Planner, and their peers were built for a different era, a different developer, and a different kind of aircraft. The result is interfaces that look like Windows XP control panels, because they essentially are. Built on Qt, designed for 1024×768, with no concept of responsive layout, real-time streaming visualization, modern state management or co-GCS like a Google Docs. They are also just ugly.

A developer expects VS Code, Vercel, Opencode etc. They switch between them fluidly not because they are perfect but because devs already used to. They expect keyboard-first, beautiful, fast, and opinionated softwares. QGC was not built for this developer. This GCS needs to feel like it belongs in 2026.

This GCS is designed agent-first. The developer is the second user. Time to boil the Ocean.

## 2 The Problem With QGC

QGroundControl and Mission Planner were built when:

- CPU was precious → minimal rendering, flat Qt widgets
- Screens were small and low-res → information density over layout
- Users were RC hobbyists or researchers → zero UX investment
- Network was unreliable → everything polled, nothing streamed
- The developer, operator, and pilot were the same person → no role separation

A solo developer building an autonomous plane needs a GCS that works like a modern developer tool, not a 2003 Qt widget panel. During active flight testing, the developer needs simultaneous access to:

- **Spatial context** — where is the aircraft
- **Sensory ground truth** — what is it seeing
- **3D attitude** — what is it doing physically
- **Live telemetry** — how is it performing
- **AI reasoning** — why is it deciding things

No existing GCS supports this combination. QGroundControl and Mission Planner were built before smartphones existed, when CPU was precious and network was limited. The developer is simultaneously the operator, the debugger, and the autonomy engineer. The GCS must serve all three roles without forcing a context switch between them.

---

## 3 The Five Developer Jobs

QGC tries to mash five fundamentally different jobs into one cluttered window. These are genuinely distinct enough to warrant separate surfaces:

| Workspace | Job | Primary Question |
|-----------|-----|-----------------|
| **CONNECT** | System bringup | Is my hardware alive? Are all sensors talking? |
| **FLY** | Flight testing | What is the aircraft doing right now? |
| **THINK** | Autonomy development | What did the AI see, decide, and why? _(This does not even exist!)_ |
| **PLAN** | Mission design | What will the aircraft do on the next flight? |
| **REPLAY** | Post-flight analysis | What exactly happened, and why? _(This does not even exist!)_ | 


## 4 Colabration and Communication

While I personally hate Mavlink, it is a industry standard. I have developed numerous custom protocols and beleive me it is not that hard in this day and age. However, this GCS will support Mavlink as first, you are welcome to use any existing protocol, your custom one, API or raw UDP. Your machine your rules.

I have crumbled enough to a 13 inch screen with 5 other people having different jobs and priorities; operator, developer, GNC engineer, GCS engineer, product lead... That is why this GCS will be a shared workspace, a co-GCS just like google drive. You can tether multiple platforms, to observe, highlight and command the same or multiple autonomous aircrafts. 

You will be welcomed to use your trusted map, AI or anyother service provider API. Every developer is opiniated, so you do you.

## 5 Cross-Cutting Design Decisions

### 5.1 Keyboard First

Every action has a keyboard shortcut. A developer should never need to reach for the mouse for navigation.

| Key | Action |
|-----|--------|
| `Cmd+1` to `Cmd+5` | Switch workspace |
| `/` | Open command palette |
| `Cmd+\` | Toggle split mode |
| `Cmd+M` | Toggle map fullscreen |
| `Cmd+K` | Focus command input |
| `M` | Drop annotation marker (FLY, REPLAY) |
| `F` | Toggle focus mode |
| `L` | Toggle log drawer |
| `R` | Return to LIVE from REPLAY |
| `Space` | Play/pause in REPLAY |
| `Esc` | Exit fullscreen / collapse expanded pane |

**Command palette (`/`):** Accepts natural language and structured commands.
```
/ show roll rate vs aileron deflection
/ arm motors
/ load mission cargo_run_003
/ compare last 3 flights fuel
/ inject GPS failure
/ set PID_ROLL_P 0.15
```
This removes approximately 40% of menu navigation.

### 5.2 Visual Language

- Light theme first. I have had enough screen glares while testing in the field.
- Purposeful accent colors only where they carry meaning.
- **Color semantics:** green = nominal, amber = watch/degraded, red = action required/failure, blue = informational/auto mode, purple = AI activity
- Color is never decorative. Every use of color encodes state.
- Monospace for all telemetry values and log text. Variable-width for labels and narrative.
- Density slider (comfortable → dense) saved per workspace.

### 5.3 Probabilistic Displays

Where applicable, display ranges rather than point values when the AI provides confidence intervals:

```
ETA: 14:28–14:38  (82% confidence)
Obstacle clearance: 180–220m  (91%)
```

More honest. Better calibrates developer trust in the autonomy stack.

### 5.4 Architecture Properties

**Connection agnostic.** Serial, UDP, TCP, WebSocket, custom protocol; configured once in Connections, abstracted completely everywhere else. The developer never thinks about transport while debugging AI behavior.

**Shared workspace.** I have crambled in 13 inch screen with five other people all having different roles and prioroties in the field enough. You can just tether to the network and view, command, edit from different devices. 

**Version control everything.** Mission scripts, parameter configs, panel layouts, plugin code, all plain text files. 

**Self-documenting.** Hover any telemetry field → tooltip shows description, units, expected range, protocol source (ex. MAVLink message + field name). No more guess games.

**Pre-built test workflows.** CONNECT workspace ships with one-click test scripts: motor spin test, GPS accuracy test, IMU calibration, sensor health check. Common development tasks should not require writing scripts.

**Failure injection.** Artificially fail any sensor or AI subsystem to test autonomy response, without touching hardware. Available in CONNECT and THINK.

**Session recording.** Every developer GCS session is silently recorded as a REPLAY-able session. Not just flight data, but which panels were open, what parameters were examined, what was annotated. You can replay your own investigation later.

**Plugin/extension system.** Every workspace supports custom panels written in sandboxed JS or Python, loaded at runtime. Custom telemetry fields, custom AI outputs, custom visualizations.

## 6 Layout Architecture


```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ =  ● LIVE  N-TEST-01  ARMED  AUTO  LNK:-64dB   GPS:14  BAT:87%  AI:91%   [/] [SPLIT]│    TOPBAR
├──────────────┬─────────────────────────────────────────────────┬────────────────────┤
│              │                                                 │                    │
│  MINI-FLY    │                                                 │ ┌ COMMAND ──────┐  │
│  ──────────  │         PRIMARY DISPLAY                         │ │ chatbot /     │  │
│  Roll  Pitch │         (camera · map · 3D)                     │ │ GCS commands  │  │
│  Yaw   IAS   │         tileable 2/3/4-up                       │ ├ DATA ─────────┤  │
│  VS    ALT   │                                                 │ │ sparklines    │  │
│  ⚠ ALARMS    │         navbar pushes:                          │ │ quick glance  │  │
│              │         PLAN · CONNECT · DATA                   │ ├ THINK ────────┤  │
│  MINI-THINK  │         THINK · REPLAY                          │ │ decision log  │  │
│  ──────────  │                                                 │ │ scrollable    │  │
│  conf bars   │                                                 │ └───────────────┘  │
│  next action │                                                 │ ← collapsible      │
│  model v2.1  │                                                 │                    │
│              │                                                 │                    │
│  MISSION     │                                                 │                    │
│  ──────────  │                                                 │                    │
│  CRUISE      │                                                 │                    │
│  WP 4/7      │                                                 │                    │
│  ETA 14:41   │                                                 │                    │
│  ███░░ 67%   │                                                 │                    │
├──────────────┴──────────────────────────────────────┴───────────────────────────────┤
│  14:18────────14:20────────[ARM]────[T/OFF]──[!]──[AI↻]──────────▶ LIVE             │  TIMELINE
│  ` key → expand console                                    [L] log                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 7 The Chrome

### 7.1 Workspaces
Four persistent elements that never go away regardless of workspace:

#### 7.1.1 **Status Bar** (top)
Single line, Minimal, Aircraft state only.

```
☰ ● LIVE  N-TEST-01  ARMED  AUTO  LNK:📶   GPS:14  BAT:87%  AI:91%                [/] [SPLIT].
```

Contains: live/replay indicator, aircraft ID, arm state, flight mode, link quality, GPS count, battery, AI confidence. 

Also contains: FOCUS button, command palette trigger (`/`), settings.

Everything else is below the fold.

#### 7.1.2 **Instrument Strip** (left pane)
Stable, Does not scroll with content. This is the one place a developer looks to verify aircraft state at a glance without reading a chart. Basically mini-fly, mini-think and mini-plan, showing the current status and/or next action item. Only for information.

Spatial memory preserved, depth on demand. You know where `mini-think` lives. Double-click it and the full THINK canvas opens in the primary display — without losing your place. You can collapse it back just as fast. The keyboard shortcut still works even when the widget is minimized.

Design rules for the strip:
- Monospace font throughout
- Color only carries meaning: green = nominal, amber = watch, red = action required, purple = AI
- No sparklines, no mini-charts — that's what FLY workspace is for
- Values animate live at ~30Hz — fast enough to show it's live, slow enough to deal with streaming data.

#### 7.1.3 **Time River** (bottom)
The connective tissue of the entire system. A unified temporal strip.

```
14:18──────14:20──────[ARM]──[T/OFF]──[!]──[AI↻]──────────────────▶ LIVE
──[GROUND]──────────────────[CRUISE]────────────────────────────────────
```

- Mode bands as colored horizontal bars (green = armed/flying, blue = auto, amber = degraded)
- Event pills: ARM, T/OFF, mode changes, AI decisions, anomalies
- Playhead at right edge in LIVE mode (green, labeled LIVE)
- Playhead draggable across full flight in REPLAY mode (amber, labeled timestamp)

Raw log text is accessible via `L` key — pulls up as a drawer from the Time River. It is supplementary, not primary.

#### 7.1.4 **AI and Data Manager** (Right Pane)

Three independently resizable segments. Collapses to a thin strip when not needed. Width can be dragged.

**Segment 1: COMMAND**

Natural language interface to the entire stack. It's a conversational interface to the GCS itself. *"Show me roll rate from the last 5 minutes." "What's been the AI confidence trend since takeoff?" "Why did the aircraft deviate at 14:22?"* This doesn't exist in any GCS. 

```
> goto waypoint 4
  ✓ Commanding aircraft to WP4 (2.1nm, ETA +3:20)

> show roll rate last 5 minutes  
  ✓ Opening roll_rate chart in DATA panel

> why did the AI deviate at 14:22
  ✓ At 14:22:09, obstacle detection confidence peaked
    at 94% for object at bearing 247° / 340m. AI 
    replanned route +200m east. Resolved at 14:23:01.

> compare this flight to yesterday
  ✓ Loading flight_20260316 overlay...

> switch to nav-v2.2-experimental
  ⚠ Confirm switch while armed? [Yes] [Cancel]
```

The chatbot can: execute aircraft commands, pull up data views, query the AI decision log, compare flights, load missions, explain what happened. It is a conversational interface to the entire GCS stack.

**Segment 2: DATA**

AI and algo is cool but only if you can realiably fly. So DATA pane is right up there. This is the always-visible quick reference.

User-configurable, drag any telemetry field here from a field picker. Tap any sparkline to open that field full-size in primary display.

Default fields:
```
roll_rate    ~~~~~~~~~~~
ias          ~~~~~~~~~~~
ai_conf      ~~~~~~~~~~~
vs           ~~~~~~~~~~~
```

**Segment 3: THINK**

Full AI decision log, scrollable. Same source as mini-think on the left, but untruncated and searchable.

```
14:23:01  NOMINAL    Resumed planned route
14:23:04  CONF LOW   GPS confidence dropped 82%→61%
                     reacquisition started
14:23:09  AI REPLAN  Obstacle detected bearing 247°
                     route offset +200m east
14:22:51  NOMINAL    Crosswind correction +3.2° heading
14:22:34  BARO ALT   Altitude discrepancy 12ft
                     GPS set as primary
```

Each entry expandable to show full decision tree: input state, model output, alternative options scored, confidence, execution result. No more unreadable error messages.


---

### 7.2 The Nav Drawer

The hamburger (☰) in the top-left of the status bar slides the nav drawer over the instrument strip. Same real estate, two modes — no layout shift.

```
N-TEST-01  ·  MAVLink 2.0 · UDP
────────────────────────────────
✈  Aircraft config
◫  Missions
≡  Parameters
⊘  Connections
◳  Logs

────────────────────────────────
OPEN IN PRIMARY DISPLAY:
  [ CONNECT   ]
  [ PLAN      ]
  [ FLY       ]
  [ DATA      ]
  [ THINK     ]
  [ REPLAY    ]
────────────────────────────────

⊕  Plugins
⚙  Preferences
```


The drawer contains:
- **[CONNECT]** Aircraft identity + connection details
- **[PLAN]**    Aircraft · Missions · Parameters
- **[FLY]**     Map · 3D · Camera 
- **[DATA]**    Live Data charts, Telemetery view, raw data view
- **[THINK]**   AI Version Control · Autonomoy development · AI skills
- **[REPLAY]**  Logs · Replay Mode

Clicking anywhere outside the drawer closes it. The instrument strip reappears.

---

### 7.3 The Primary Workspace

Full width between instrument strip and right edge. Full height between Status Bar and Time River.

**Split Mode** (`Cmd+\` or SPLIT button): divides the primary workspace into two independent panes. Available in FLY and THINK. Both panes share the same Time River. A second tab row appears inside the split to select the right pane's workspace independently. `Cmd+1-5` Keys to swtich between  CONNECT, PLAN, FLY, REPLAY, THINK easily

---

### 7.4 Focus Mode

One keypress (`F` or FOCUS button). Collapses:
- Instrument strip (width → 0, opacity → 0)
- Time River (height → 0, opacity → 0)

The primary workspace fills the full available area. No modal, no animation drama — just the content. Press `F` again to restore. The status bar stays always visible.

Used when reading a dense chart or reviewing a replay without distraction.

---

### 7.5 Live vs Replay 
This is a safety-critical distinction. **LIVE vs REPLAY is the most critical visual state in the system.** When in replay, the topbar accent color shifts to amber across all status elements. Developers must never be uncertain which mode they're in.

**LIVE mode:**
- Status bar: `● LIVE` in green
- Playhead at right edge of Time River, labeled LIVE in green
- Charts stream data rightward in real time

**REPLAY mode:**
- Status bar: `◈ REPLAY` in amber
- Entire status bar gets a subtle amber tint
- Time River expands to full scrubber — playhead is large, draggable, shows timestamp
- All charts lock to playhead position
- A persistent amber banner: `◈ REPLAY MODE — flight_20260317_1`

Switching back to live: `Esc` or `R`. Playhead snaps to right edge. Everything returns to green.



### 7.6 Console (resizable)

- **Default**: collapsed to bottom left
- **Drag top edge** of bottom pane to resize up to ~50% screen height
- **Super+T ``Cmd+T``** toggles fullscreen console (covers everything, `Esc` to dismiss)

Console contains:
- Raw MAVLink/Custom message inspector (filterable by system/component/message type)
- Direct command input: any MAVLink command, any custom test command for faster testing
- Scrollable history
- Filter bar: by message type, by timestamp, by source

The console is the escape hatch. When the UI doesn't have a button for something yet, you type it here.

---

## 8 **The Five Workspaces** Interior Design

### 8.1 **CONNECT** System Bringup

**Primary surface:** System topology diagram.

Not a map. Not a parameter list. A network graph of the aircraft's systems — visual, spatial, immediately readable.

```
[IMU ●] ──── [AHRS ●] ──────────────────────────────┐
[GPS ●] ──── [NAV  ●] ──── [AUTOPILOT ●] ──── [COMMS ●] ──── GCS
[BARO ●] ────┘               │
[LIDAR ○] ── TIMEOUT         [ESCs ●●●●]
[CAM  ●] ── [CV ⚠] ─ ─ ─   [SERVOS ●●●●●●]
```

Node states:
- `●` green: healthy, talking at expected rate
- `⚠` amber: degraded (high latency, intermittent, partial)
- `✕` red: failed or silent
- `○` gray: not expected / not configured

**Interaction:** Click any node → split activates. Right pane shows that subsystem's detail: raw message stream, health metrics, message rate, last value, error log. You can also use your beloved connection method, TCP, UDP, IP, module etc. to configure here. This is the only CONNECT interaction, everything else is read-only.

**Underneath:** Packet inspector drawer (pull up from Time River). Raw MAVLink or custom protocol messages, filterable by system / component / message type. Chrome DevTools Network tab, but for avionics.

**Time River behavior in CONNECT:** Minimized to thin event strip. We are reading states, no need for time

---

### 8.2 **FLY** Flight Testing

**Primary surface:** Multi-panel telemetry canvas.

Not a fixed dashboard. A configurable grid of chart panels, each streaming live data. Each panel is independently bound to any telemetry field via a dropdown selector.

Chart types per panel: line, gauge, bar, state timeline, heatmap.

**The key design decision that separates this from Grafana:** All panels are time-synchronized. Scrubbing the Time River scrubs all panels simultaneously. When you land and want to know what happened at T+04:23, every chart moves to that moment together. You can lock a chart to prevent this or compare same charts at different times as well as you wish.

**Panel features:**
- Resize by dragging panel borders
- Add/remove panels via `+` button
- Bind any telemetry field to any panel instantly
- Overlay reference lines: any writable parameter (PID gain, Kalman covariance) shown as horizontal line on any chart. Edit the value → see effect immediately.
- Annotation markers: press `M` → drop a labeled marker across all panels at current timestamp

**Map panel:** Available as one panel among equals. Not the hero. In developer mode, `roll_rate` vs `aileron_deflection` is __mostly__ more informative than GPS position.

**Camera panel:** Available as a panel. Shows live feed with optional CV overlay (bounding boxes, detection labels, confidence scores).

**Mode and event timeline:** The Time River at the bottom is essentially the shared x-axis for all FLY panels. Mode bands, event pills, and AI decisions align with chart data above.

**In split mode (data/map/camera):** Left pane holds charts. Right pane holds map on top, camera feed on bottom. or any configuration you want.

---

### 8.3 **THINK** Autonomy Development

The workspace that does not exist in any GCS today. The most important one for this project.

When the AI is flying the aircraft, the developer needs to see what it is thinking — not just what the aircraft is doing.

**Confidence Panel:**
Live confidence score bars for each AI subsystem:
- Localisation
- Obstacle detection
- Route validation
- Sensor fusion
- Path planning

Color: green above 80%, amber 60–80%, red below 60%. Or adjust as you wish. Any bar dropping below threshold triggers an amber pulse. This xis the fastest way to see where the AI is uncertain.

**Decision Log Panel:**
Streaming log of every AI decision, reverse-chronological:
```
14:23:09  AI REPLAN   Obstacle detected · route offset +200m east
14:23:04  CONF LOW    GPS confidence dropped · reacquisition started
14:23:01  NOMINAL     Resumed planned route after deviation
```

Each entry: timestamp, decision type (color-coded), plain English description.

Click any entry → expands to show:
- **Input state:** sensor readings at that moment
- **Model output:** decision made + alternative options with their scores
- **Confidence:** certainty level at decision time
- **Execution result:** did the physical system respond as commanded

**Counterfactual Explorer:**
Select any decision → modify any input parameter → re-run the decision model with the modified inputs → see what the AI would have done differently.

This is the primary tool for AI edge case analysis and tuning. It does not exist in any current GCS.

**Perception view (toggle in right pane):**
Switch the right pane between Decision Log and Perception View:
- Camera feed with CV bounding boxes
- LiDAR point cloud (simplified 2D projection)
- Sensor fusion state visualization
- Active model list with version labels

**AI model version switcher:**
Dropdown in the workspace header. Select two model versions → both run simultaneously → decision log color-codes which version made each decision → divergences become visible immediately.

---

### 8.4 **PLAN** Mission Design

**Primary metaphor: code editor, not map editor.**

A mission plan is a program. It has conditionals, states, parameters, execution logic, and error handling. Treating it as a drag-and-drop waypoint exercise is the wrong abstraction for an autonomous system.

**Split pane — always on by default in PLAN:**

Left pane: mission script editor.
- Monospace font, syntax highlighting
- YAML-like structure, human-readable
- Version-controllable plain text
- Git-friendly by design

```yaml
mission: cargo_run_001
aircraft: N-TEST-01

phases:
  - id: climb
    type: spiral_climb
    params:
      target_alt: 3000ft
      rate: 800fpm
    on_anomaly: abort_to_home

  - id: cruise
    type: waypoint_sequence
    waypoints: [WP1, WP2, WP3]
    params:
      speed: 120kts
      alt: 8500ft
    ai_override: allowed  # AI can replan within bounds

  - id: approach
    type: ai_managed
    params:
      landing_site: HOME
      wind_compensation: true
```

Right pane: map visualization, auto-generated from the script. Edit the script → map updates in real time. Click a waypoint on the map → cursor jumps to the relevant script line. **Or just go ahead and use map for planning, you still need map.**

**Diff view:**
Change any mission parameter → side-by-side diff of previous vs new:
- Simulated flight paths overlaid on the map (old: gray, new: blue)
- Telemetry envelope comparison (charts showing predicted range)
- AI decision delta (decisions that would change between versions)

Like `git diff`, but for flight plans.

**Time River behavior in PLAN:** Minimized. You are designing the future, not analyzing the past.

---

### 8.5 **REPLAY** Post-flight Analysis

**Primary metaphor: time machine.**

Every flight is fully reconstructable. Not just telemetry — everything the system saw, thought, and did.

**Time River is the hero in REPLAY.** It expands to ~25% of screen height. The playhead is large and draggable. All other content is locked to the playhead. I like Marvel Rivals replay system.

**Available panels (configurable like FLY):**
- All telemetry charts (synchronized to playhead)
- Map with flight path and aircraft position marker
- AI decision log (scrolls to decisions at current time)
- Camera feed (if recorded)
- Sensor fusion state
- Raw log stream

**Playback controls:**
- Speed: 0.1× to 10×
- Jump to annotated events (bookmarks set during the flight in FLY workspace)
- Jump to anomaly highlights automatically

**Anomaly detection overlay:**
The system automatically scans the flight and highlights moments where:
- Sensor values deviated from expected envelope
- AI confidence dropped significantly
- Commanded vs actual output diverged beyond threshold
- Any error was logged

These appear as colored bands on the Time River. Jump to interesting moments — never scroll through nominal data looking for the problem.

**Flight comparison:**
Load a second flight → its data overlays as ghost traces in a contrasting color on all charts. Toggle on/off with one key. Critical for: "why did this flight behave differently from last Tuesday?"

**Export:**
Select any time window → export as:
- CSV / JSON / Parquet (raw data)
- Auto-generated flight report (PDF) — charts, events, AI decisions, plain English summary



## 9 Stack

- Vue 3
- Vite
- Pinia
- MapTalks (map)
- Three.js (3D attitude)
- MAVLink 2.0 (reference protocol, swappable)

## 10 What Has Not Been Solved Yet

These are open design questions, documented honestly:

**Onboarding / first launch.** When a developer connects hardware for the first time, CONNECT shows an empty topology with everything gray. This state needs to be instructive — it should guide the developer toward configuring their system, not present a blank diagram. Undecided.

**Network interruption states.** The link drops mid-flight. The status bar reflects it immediately. But what happens to streaming charts? Does the Time River mark the gap visually? Does it freeze? Degraded comms behavior needs explicit design, not discovered behavior.

**Multi-aircraft.** Intentionally deferred. The instrument strip left column label is reserved real estate for an aircraft selector when this becomes relevant. Do not design for it now.

**Tablet / touch.** Intentionally deferred. This is a keyboard-first, cursor-first tool for now. Touch considerations are a future phase.

**AI integration** Whjat processes to waht extend needs AI integration. I am not looking to build a AI slop, this needs to be considered carefully.

## 11 Design References

| Reference | What We Borrow |
|-----------|---------------|
| VS Code | Workspace separation, command palette, extensibility model, keyboard shortcuts |
| Grafana | Configurable telemetry panels, time-synchronized charts |
| Linear | Information density without clutter |
| Vercel dashboard | Status monitoring, calm when nominal, clear when not, keyboard shortcuts |
| Opencode/ZED | Modern, fast, developer-respecting terminal aesthetic |
| Chrome DevTools | Packet inspector, developer-first inspection model |
| Oscilloscope UIs | Honest, functional, data-forward instrument design |


## TODO

Full molecular task breakdowns live under `docs/`. This is the high-level sequence.

### Architecture

- [ ] SITL up and reachable over UDP
- [ ] Protocol adapter (MAVLink 2.0, swappable)
- [ ] State store
- [ ] Event bus
- [ ] Action registry
- [ ] Skill interface
- [ ] Internal API
- [ ] Session persistence

### UI

- [ ] Chrome scaffold
- [ ] Design tokens and global CSS
- [ ] Left pane: mini-fly + mini-think
- [ ] Bottom console
- [ ] Map tile
- [ ] 3D attitude tile
- [ ] Right Pane Chatbot Segment
- [ ] AI Commander
- [ ] AI GCS
- [ ] Right pane sparklines
- [ ] Camera tile
- [ ] Double-Click expand
- [ ] Timeline strip
- [ ] Tiling system and split/focus modes
- [ ] CONNECT workspace
- [ ] PLAN workspace
- [ ] REPLAY workspace


**Ad Astra**


*End of memo v0.2 — next revision when CONNECT and FLY workspace designs are finalized*
*Apache License 2.0* 