# Architecture TODO
---
## SITL Environment

- [x] ArduPilot or PX4 SITL configured and runnable locally
- [x] Simulated GPS, IMU, barometer, airspeed sensor outputs
- [x] MAVLink stream reachable over sockets(udp/tcp/websockets etc.) from the GCS
- [x] Repeatable test mission script (takeoff, cruise waypoints, land)
- [x] Simulated failure injection (GPS dropout, sensor noise, link degradation)

**Not immediate, Nice to have**

- [ ] Containerize the SITL for easy deployment
- [ ] Simulated camera feed (video file loop acceptable for now)
- [ ] SITL documented so anyone can clone and run it in one command

---
## Protocol Adapter

- [x] Define the adapter interface contract: what it accepts, what it emits, what it guarantees => input:raw bytes or connection → output: normalized telemetry message objects (see docs/protocol_adapter.md)
- [x] Implement MAVLink 2.0 as the reference adapter behind that interface
- [x] Connection types: UDP, TCP, serial, WebSocket
- [x] Reconnection and dropout behavior handled at the adapter level, not above it
- [x] Incoming messages normalized into a common message format before leaving the adapter
- [x] Outgoing commands accepted in the common format, translated to protocol-specific wire format by the adapter
- [x] Adapter is swappable. A second adapter can be registered without touching anything above it
- [x] SITL adapter verified working before any UI work begins
---
## State Store

- [x] State store defined as the single source of truth for all system state
- [x] Schema defined for: telemetry values, sensor health, GPS state, link quality, battery, flight mode, arm state, current mission phase, active waypoint, parameter values => see docs/state_store.md (AI confidence scores, alerts, model versions deferred to skill/event bus layers)
- [x] State is read-only from outside. Nothing mutates state directly
- [x] All state updates flow through explicit state transitions (ingest() and updateConnection() are the only mutation paths)
- [x] State is queryable by key. Any consumer can request any slice
- [x] State is subscribable. Consumers can watch specific keys for changes (Pinia refs — Vue reactivity handles this)
- [ ] Historical state accessible for the last N seconds (needed for sparklines and AI context)
- [x] State store has no knowledge of MAVLink or any protocol. It receives normalized data only from the adapter
---
## Event Bus

- [ ] Event bus defined as the nervous system. Everything that happens emits an event
- [ ] Event schema defined: type, timestamp, source (hardware / AI / user)
- [ ] Core event types defined: telemetry updated, sensor health changed, mode changed, arm state changed, command sent, command acknowledged, command failed, alert triggered, alert cleared, AI decision made, confidence changed, link dropped, link restored, session started, session ended, annotation dropped
- [ ] Any part of the system can publish to the bus
- [ ] Any part of the system can subscribe to any event type
- [ ] Events are immutable once emitted
- [ ] Event history persisted for the session duration and saved (raw material for REPLAY)
- [ ] Event history queryable by type, time range, source
- [ ] The timeline is a subscriber. It renders whatever the bus emits
- [ ] No silent state changes anywhere. If it happened, it's on the bus
---
## Action Registry

- [ ] Action registry defined as the single point of entry for all system actions
- [ ] Every user-facing and AI-facing capability registered here. Nothing bypasses it
- [ ] Each action declares: name, plain-English description, required inputs with types, optional inputs, preconditions, expected output, expected side effects
- [ ] Registry validates inputs before execution
- [ ] Registry evaluates preconditions before execution, rejects with a reason if not met
- [ ] Registry emits a command event on the bus for every action invoked, whether it succeeds or fails
- [ ] First action set defined and registered: arm, disarm, goto waypoint, set flight mode, set parameter, load mission, cancel mission, inject failure, clear failure
- [ ] Action can be invoked identically by UI button, keyboard shortcut, console command, command palette, or AI skill (same code path, same validation, same preconditions)
- [ ] No UI component sends a command message directly. It calls a registered action
---
## Skill Interface

- [ ] Skill interface defined before any AI feature is built
- [ ] A skill declares: name, description, context slice (which state keys it can read), tool set (which actions it can invoke), trigger (event, user request, or schedule)
- [ ] Skill runtime resolves context at invocation time. Assembles the relevant state slice and passes it to the AI
- [ ] Skill runtime enforces tool set. Skill cannot invoke actions outside its declared set
- [ ] Skill result is always an event on the bus. Skills do not write to state directly
- [ ] First skill defined as a stub (pre-flight check) to validate the interface works end to end before building real AI features
- [ ] Adding a new skill requires no changes to state store, event bus, or action registry
---
## Internal API

- [ ] Internal API layer wraps state store and action registry behind a clean programmatic interface
- [ ] State readable through the API without knowing the store's internal structure
- [ ] Actions invokable through the API without knowing the registry's internal structure
- [ ] This is the layer the skill runtime uses
- [ ] No direct store or registry access from outside this layer
---
## Session and Persistence

- [ ] Session starts when a connection is established, ends when it is closed
- [ ] Full event stream persisted for every session (REPLAY source)
- [ ] State snapshots persisted at configurable intervals within a session
- [ ] Mission scripts persisted as plain text files, git-friendly
- [ ] Parameter configs persisted as plain text files
- [ ] Panel layouts persisted as plain text files
- [ ] Flight summaries auto-generated on session end: duration, events, anomalies, AI decisions
- [ ] Persistent flight memory layer: patterns queryable across sessions
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
---
## AI First Design
-All state is queryable programmatically, not just visible on screen
-All actions are invokable programmatically, not just through UI clicks
-The protocol adapter exposes a clean internal API that an agent can call
-Flight history is stored in a structured, queryable format, not just log files
