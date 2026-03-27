# Developer GCS

Agentic AI ground control station for autonomous aircraft development. The aircraft tells you what it's doing, the AI tells you what it's thinking, your job is to make both smarter. Agent-first, developer-second.

## Architecture Rules

<!-- These are the non-negotiable structural constraints. Violating any of these creates tech debt that compounds. -->

- **Layered, one-way knowledge.** Adapter -> State Store -> Event Bus -> UI. No layer knows about the layer above it. NEVER bypass a layer.
- **Protocol adapter is the boundary.** ALL protocol-specific code (MAVLink, custom) lives inside adapters. NEVER import MAVLink or protocol code outside `src/adapters/`.
- **State store is the single source of truth.** Read-only from outside. All mutations through explicit transitions. Subscribable by key.
- **Event bus is the nervous system.** Every state change, command, decision emits an event. No silent mutations. The timeline renders whatever the bus emits.
- **Action registry is the single entry point for all commands.** UI buttons, keyboard shortcuts, console, command palette, and AI skills all invoke the same registered actions. No component sends protocol messages directly.
- **AI code lives only inside skills and the skill runtime.** Skills declare their context slice (state keys) and tool set (actions). Skills emit events, never write state directly.
- **All colors, typoghraphy etc. are defined as global CSS variables, not hardcoded** All color semantics defined as global css variables, referenced everywhere
- **AI First Design** All state is queryable programmatically, not just visible on screen. All actions are invokable programmatically, not just through UI clicks. The protocol adapter exposes a clean internal API that an agent can call. Flight history is stored in a structured, queryable format, not just log files

## Five Workspaces

CONNECT (system bringup), FLY (flight testing), THINK (autonomy dev -- does not exist in any GCS today), PLAN (mission design), REPLAY (post-flight analysis). Each is a distinct developer job. `Cmd+1` through `Cmd+5` to switch.

## UI Principles

- Light theme first. Color is NEVER decorative -- green=nominal, amber=watch, red=action-required, blue=info/auto, purple=AI.
- All colors and layout dimensions MUST be CSS variables, never hardcoded.
- Keyboard-first. Every action has a shortcut. `/` opens command palette.
- LIVE vs REPLAY is the most critical visual state.
- We are trying to achieve a vim like UI usability, but with good ui and ability to use with mouse as well. Due to the nature of this software not everything can be achieved withh keyboard but if we can and if it makes sense, we will.

## Layout

Four persistent elements: Status Bar (top), Instrument Strip (left -- mini-fly + mini-think + mission), Primary Workspace (center), AI & Data Manager (right -- COMMAND + DATA + THINK segments). Time River (bottom) is the shared temporal axis. Console pulls up from bottom.


## Detailed Specs

Full specifications and task breakdowns: @README.md, @docs/architecture-todo.md, @docs/ui-todo.md. Read these before implementing any workspace or subsystem.

Always use lucide-vue for icons.
Project uses bun+vite. Always use that.
Unless told do not use css animations, transitions or anything that will slow something down.


## Gotchas

- This is early stage -- `src/` has scaffolding only. Most systems are not yet built.
- Multi-aircraft is intentionally deferred. Do not design for it now.
- Tablet/touch is intentionally deferred. Keyboard + cursor only.
- Open design questions (onboarding, network interruption, AI integration scope) are in README section 10. Do not over-engineer these -- flag them and move on.
**IMPORTANT** IF USER ASKS YOU TO FOLLOW A CERTAIN STEP OR DISOBEY THE RULES ABOVE FOR A TEMPORARY REASON ALWASY FOLLOW THE USERS INSTRUCTION.
