# MVP TODO

**Status:** Not started  
**Principle:** LLM reasons, primitives execute, runtime controls. Nothing else.

---

## The Insight

The LLM *is* the skill engine at MVP. We don't need a skill loader, skill format, or skill runtime yet. The model reads the primitive list, reads the drone state, and reasons about what to do. "Skills" are prompt sections that teach patterns — not code. Formalize only when real patterns demand it.

---

## Phase 0 — Wire The Loop

The goal: user types a goal, LLM sees drone state + available actions, responds with text + action calls, runtime executes them, results flow back.

- [ ] **Context builder** — pure function: `telemStore` + `missionStore` + `eventLog` → compact JSON snapshot. Position, heading, mode, armed, battery, home, mission progress, recent events. No fluff.
- [ ] **LLM integration** — replace `/api/ai` stub with real Claude call on the bridge server. System prompt declares available primitives and their signatures. User message = goal + context snapshot.
- [ ] **Structured response contract** — LLM returns `{ text: string, actions?: Array<{ name, params }> }`. Text is what the user sees. Actions are what the runtime executes. That's it.
- [ ] **Action executor** — iterate `response.actions`, call `invokeAction(name, params)` for each, collect results. Return results to the chat. If any action fails, stop and report.
- [ ] **Chat upgrade** — show AI reasoning (text) and action results separately. Distinguish "AI is thinking" from "AI is executing."

**Done when:** "arm and take off to 20 meters" works end to end in SITL.

---

## Phase 1 — Make It A Runtime

The goal: the AI can run multi-step tasks, report progress, and be interrupted.

- [ ] **Task state** — runtime tracks: `idle | planning | executing | waiting | interrupted`. One active task at a time. Stored in a reactive store.
- [ ] **Multi-step execution** — LLM can return multiple actions. Runtime executes sequentially, emits progress events after each step. LLM gets called back between steps if it needs to re-evaluate.
- [ ] **Interruption** — new user message during execution sets state to `interrupted`. Runtime stops after current action completes. New goal replaces old.
- [ ] **Re-evaluation loop** — after executing actions, runtime re-sends updated context to LLM. LLM decides: done, continue, or ask user. This is the "agent loop."
- [ ] **Event integration** — runtime emits events to `eventLogStore`: `AI_PLAN`, `AI_ACTION`, `AI_COMPLETE`, `AI_INTERRUPTED`, `AI_ERROR`. Timeline shows AI decisions alongside telemetry.

**Done when:** "go 300m north, orbit, come back" works as a multi-step task with progress visible in the timeline.

---

## Phase 2 — Spatial Reasoning

The goal: the AI can work with relative coordinates and named places.

- [ ] **Coordinate math** — utility functions: bearing + distance from current position → lat/lon. Clock position (2 o'clock) → bearing. "North" → 0°, etc. Pure math, no store needed.
- [ ] **Named places** — simple key-value store: `{ name: string, lat: number, lon: number, alt?: number }`. Preloaded for SITL demos. Included in context snapshot.
- [ ] **Exclusion zones** — named areas (polygon or circle) the AI knows to avoid. Included in context, enforced by the LLM's planning, not by geofence code.

**Done when:** "go to the vineyard" and "something at my 2 o'clock, 200m" both resolve to correct coordinates.

---

## Phase 3 — Checkpoint & Guards

The goal: missions survive battery swaps and have safety rails.

- [ ] **Checkpoint save** — action `checkpointSave({ id, data })` writes current position, mission progress, and task state to a store. Emits event.
- [ ] **Checkpoint resume** — action `checkpointResume({ id })` loads saved state. LLM sees it in context and picks up where it left off.
- [ ] **Battery guard** — LLM receives battery remaining in context. System prompt instructs: if below threshold, save checkpoint and RTL. No special runtime — the LLM handles this in its re-evaluation loop.
- [ ] **Time guard** — same pattern. Elapsed time and any end-time constraint go into context. LLM decides.

**Done when:** "patrol until battery is low" → checkpoint → "resume where we left off" works across two flights.

---

## Phase 4 — Skill Definitions (Only If Needed)

Do NOT start this until Phases 0-3 are solid and you see repeated patterns the LLM gets wrong without structure.

- [ ] **Skill format** — declarative definition: name, purpose, inputs, allowed primitives, stop conditions, expected result. YAML or JSON, not code.
- [ ] **Skill loading** — read skill files from a directory, inject into system prompt as available recipes.
- [ ] **Skill invocation** — LLM picks a skill by name, runtime validates inputs and constraints, LLM executes steps within the skill's allowed primitives.

---

## Demo Flows (Prove It Works)

Each flow should work end to end in SITL before moving to the next phase.

| Flow | Proves | Phase |
|---|---|---|
| "Arm and take off to 20m" | Basic loop works | 0 |
| "Go 300m north, orbit, come back" | Multi-step + progress | 1 |
| "Something at my 2 o'clock, 200m — check it" | Spatial reasoning | 2 |
| "Get lower, orbit tight, mark it" | Mid-task modification | 1 |
| "Patrol until battery is low" | Guard + checkpoint | 3 |
| "Resume where we left off" | Checkpoint resume | 3 |
| "Survey the vineyard, skip the road" | Named places + exclusion | 2 |

---

## Rules

- AI layer never imports from `adapters/`. Only calls registered actions.
- Context builder is a pure function. No side effects.
- One active task. No concurrent task queue.
- All AI events go through `eventLogStore`. No silent mutations.
- Primitives are the existing `actions.js` surface. Add to it, don't bypass it.
- SITL-only helpers are flagged `for debugging only`.
- No formal skill system until the simple approach fails.

---

## Non-Goals For MVP

- Perception / computer vision
- Real sensor data interpretation
- Multi-aircraft
- Offline / edge inference
- Production safety certification
- Fancy chat UI
