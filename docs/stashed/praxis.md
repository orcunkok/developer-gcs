# Praxis

Praxis automates the GCS operator, not the drone. How the drone flies from A to B is its own problem. It has an autopilot, maybe a companion computer, maybe a whole autonomy stack on the onboard computer. Praxis is what the AI writes to act as the operator: dispatch a mission, supervise it, decide what happens next when something does.

Each statement tells the drone to do one thing, and the next statement waits until that thing actually happened. Not when the command was sent. When it was done. That single rule replaces callbacks, promises, and async machinery. Every action is implicitly awaited. No `await`, no `async`, no `.then()`.

The AI writes missions. Humans read them. The runtime executes them.

This is a standalone language spec. The drone GCS is the first system that runs it.

---

## Mantras

- **Simple before clever.** If a primitive can be expressed by combining others, it gets cut. Every rule is a token tax on the AI.
- **Lean into the AI's training.** `break` exits loops, `return` exits functions, `#` is a comment, `{ }` groups a block. Don't invent a pattern when an existing one fits. Muscle memory from Python, C, Go, and JS is a free correctness gradient.
- **Supervise, don't fly.** The autopilot and onboard autonomy are black boxes. The operator says do this, waits, reads the report, says what comes next.
- **The feedback loop is the point.** `on`, `every`, `watch`, `return` exist to declare when the AI re-engages. Nothing more.
- **No hidden control flow.** Missions read top to bottom. Supervision is declared at the top, not scattered. Every `state.*` read is greppable with one regex.
- **The grammar never grows.** New capability comes through actions, tools, state keys, and skills, not new syntax.
- **React-and-continue is not a pattern. Observe-and-continue is.** If it needs a physical action, end the mission and consult the AI. If it is just a note, use `watch`.

---

## How it fits together

```
┌─────────────────────────────────────────────┐
│                 AI WRAPPER                  │
│  calls AI → gets Praxis → runs it → repeats │
├─────────────────────────────────────────────┤
│           PRAXIS + INTERPRETER              │
│  pure logic, no AI awareness                │
└─────────────────────────────────────────────┘
```

The loop:

```
AI writes mission script
    ↓
Interpreter runs it
    ↓
Mission exits (completed, failed, exception)
    ↓
Wrapper sends AI: exit report + state + history
    ↓
AI writes next mission
    ↓
repeat
```

Same interpreter in human mode. The human reads the exit report and decides what to run. The language does not know who is driving.

### Exit report

```json
{
  "status": "completed | failed | exception",
  "reason": "natural_exit | on_triggered | action_timeout | action_rejected | unhandled_exception",
  "last_statement": "goto(target)",
  "return_value": null,
  "error": null,
  "flags": [],
  "state": { "battery": 0.61, "position": {}, "altitude": 30 },
  "log": [ "takeoff(30)", "goto(A) ✓", "scan() → null", "goto(B) ✗ timeout" ]
}
```

`error` is null unless something went wrong. `flags[]` holds named events: `every` drops, `watch` firings, skill notes. `log[]` is bounded; the interpreter truncates past a wrapper-configured cap.

### Wrapper contract

**Input to AI:**

```json
{
  "trigger": "mission_exit",
  "mission": "the Praxis script that just ran",
  "exit": { "...exit report..." : null },
  "state": { "...full current state..." : null },
  "history": [ "...previous exit reports, most recent first..." ],
  "skills": [ "fertilization", "survey_grid", "guarded_survey" ]
}
```

`skills` is names only. File contents are never sent unless the AI asks.

**Output from AI:** free text with optional fenced blocks.

````
survey_grid doesn't exist yet. Creating it, then running the mission.

```skill survey_grid(area, overlap)
for point in grid(area, overlap) { goto(point); scan() }
return null
```

```px
takeoff(30)
survey_grid(field_a, 0.8)
```
````

| Block | What the wrapper does |
|---|---|
| ` ```px ` | Run as a mission |
| ` ```skill name(params) ` | Save as `name.px` |
| Text only | Show to human, drone holds safe |

### Safe hold

While waiting on the AI (typically one to five seconds), the drone keeps doing whatever the current script said. If the script has ended, the wrapper can run a configured safe-hold action like `loiter()` or `hover()`. Runtime config, not language.

---

## Primitives

| Primitive | Syntax | Purpose |
|---|---|---|
| Action call | `name(args)` | Dispatch, wait for physical completion |
| Branch | `if c { } else { }` | Decide |
| Loop | `loop { }` or `loop N { }` | Repeat |
| Iteration | `for x in list { }` | Walk a collection |
| Recovery | `try { } else { }` | Handle action failure or timeout |
| Abort | `on c -> action` | End the mission when `c` becomes true |
| Tick | `every D -> action` | Run an action periodically in background |
| Observer | `watch c -> action` | Run a non-flight action when `c` becomes true, mission continues |

Seven structural and feedback primitives. `return` and `break` are exit moves, not statements in their own right.

---

## Full syntax

```python
# supervision goes first, before any other statement

on state.battery < 15 -> rtl()         # abort: mission ends
on state.signal_lost -> hover()

every 30s -> log_telemetry()           # tick: periodic background
every 2m -> snapshot()

watch state.detection -> tag()         # observer: fires, mission continues
watch state.waypoint_passed -> mark()

# action call
takeoff(10)
goto(37.7, -122.4)
goto(lat=37.7, lng=-122.4)

# capture
result = scan()
target = find_person()

# branch
if state.battery < 20 { rtl() }

if target != null {
    approach(target)
} else {
    continue_patrol()
}

# loop and iterate
loop { patrol() }
loop 3 { scan() }
for point in [A, B, C] { goto(point); scan() }

# recover
try { goto(target) } else { rtl() }

# skill call (identical to any action call)
found = search_grid(sector_4, 30)

# exit
return value       # exit skill with value, or exit mission
break              # exit nearest loop (parse error if no loop)
```

### Rules

Whitespace is not significant. Blocks use `{ }`. Statement boundaries come from the grammar: `)` ends a call, `}` ends a block. Semicolons are optional separators.

Keywords are case-insensitive. Trailing commas are fine. Comments start with `#`. Positional args precede named args. Duplicate, unknown, or missing named params are parse errors.

```python
# all three parse the same
takeoff(10) goto(A) scan() land()
takeoff(10); goto(A); scan(); land()
takeoff(10)
goto(A)
scan()
land()
```

### Value types

| Type | Examples |
|---|---|
| Number | `10`, `3.14`, `-5` |
| String | `"hello"` |
| Boolean | `true`, `false` |
| Null | `null` |
| List | `[A, B, C]`, `[1, 2, 3]` |
| Duration | `30s`, `5m`, `1h`, `500ms` |
| State | `state.battery`, `state.position.lat` |

Action and skill return values are opaque. Pass them, do not introspect. The only place with dotted access is `state`. If an action needs to expose multiple named values, it writes them to `state.*` through the adapter.

### Variable scope

`x = expr` declares a local in the enclosing block. Locals can be reassigned. `state.x` is the only global namespace. Locals cannot shadow state names.

---

## Execution semantics

Use `try/else` for commands that might fail. Use `on` for conditions that should end the mission. Use `watch` for conditions worth noting without ending the mission.

**1. Sequential by default.** B starts only after A's done predicate holds.

**2. Actions await their done predicate.** Every action declares `done_when`, `timeout`, and `failure_when` in the registry. Scripts never reference these.

```
arm()       returns when state.armed == true
takeoff(10) returns when state.altitude >= 10
goto(A)     returns when distance(state.position, A) < 2
```

**3. `on c -> action` is a one-shot mission abort.** When `c` transitions false to true, the main script halts, any in-flight action is cancelled, nothing after it runs. The abort action dispatches and awaits its done predicate. On success the mission exits with `status: completed` and `reason: on_triggered(<c>)`. On failure, `status: failed` with the action's failure reason. The RHS is a single action or skill call. If `c` is already true when `on` is installed, it does not fire. If multiple `on`s transition together, the first in source order wins.

**4. `every D -> action` runs the action periodically in the background.** The main thread is unaffected. If a tick fires while the previous run is still going, it is dropped and `"every_skipped(<interval>)"` goes into `flags[]`.

**5. `watch c -> action` runs a non-flight action when `c` becomes true, in the background.** Mission continues. Fires on every false-to-true transition, not just the first. If a new firing arrives while the previous run is still going, it is dropped and `"watch_skipped(<c>)"` goes into `flags[]`. The action must be registered with `kind: observation`. A flight action in a `watch` is a parse error. This is the primitive for logging, tagging, and flagging without ending the mission.

**6. Supervision is scoped to mission or skill.** `on`, `every`, and `watch` appear only at the top of a mission or skill, before any other statement. A mission-level supervisor lives for the whole mission. A skill-level one lives only while the skill runs. Scope controls when the watcher is active, not what happens when it fires. An `on` firing ends the mission regardless of where it was declared, including from a skill mid-run. For graceful skill failure, use `try/else` and `return null`.

**7. `try { } else { }` catches action failure and timeout only.** Hardware rejection, action timeout, adapter disconnect. It does not catch world state changes (use `on`) or parse and interpreter errors.

**8. Skills and actions are identical at the call site.** The caller cannot tell whether `patrol(...)` is a compiled action or a `.px` file.

**9. `state.*` is read-only from scripts.** Writes are the adapter's job. Scripts use locals for intermediate values and `return` for results.

**10. Return values are opaque.** Pass them to other calls, do not introspect.

**11. `break` exits the nearest enclosing loop.** Parse error if there is no loop. Use `return` to exit a skill or mission.

**12. `return` exits a skill or mission.** Inside a skill, returns a value to the caller. At mission top, exits and sets `return_value`. `return` with no value returns null.

**13. Hardware failsafes are outside Praxis scope.** Motor failure, GPS loss, geofence breach: FC's job.

**14. Evaluation is event driven.** State is subscribable by key. Actions subscribe to their done-predicate keys when they start. `on` and `watch` subscribe to their condition keys while scoped. `every` uses a timer. No polling.

---

## Grammar (semi-formal)

```
program     := supervisor* statement*
             // supervisors, if any, come before other statements

supervisor  := on_stmt | every_stmt | watch_stmt

statement   := action_call | assignment | if_stmt | loop_stmt
             | for_stmt | try_stmt | return_stmt | break_stmt

on_stmt     := 'on' expr '->' action_call
every_stmt  := 'every' duration '->' action_call
watch_stmt  := 'watch' expr '->' action_call

action_call := identifier '(' arg_list? ')'
assignment  := identifier '=' expr
if_stmt     := 'if' expr block ('else' block)?
loop_stmt   := 'loop' number? block
for_stmt    := 'for' identifier 'in' expr block
try_stmt    := 'try' block 'else' block
return_stmt := 'return' expr?
break_stmt  := 'break'

skill_file  := 'skill' identifier '(' param_list? ')' supervisor* statement*
             // skill files only

block       := '{' statement* '}'
state_ref   := 'state' '.' identifier ('.' identifier)*

expr        := literal | identifier | state_ref | action_call
             | expr op expr | 'not' expr | '(' expr ')'

op          := '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '>' | '<=' | '>=' | 'and' | 'or'

arg_list    := (arg ',')* arg ','?
arg         := expr | identifier '=' expr
             // positional args precede named args
param_list  := (identifier ',')* identifier ','?

literal     := number | string | boolean | null | list | duration
list        := '[' (expr ',')* expr? ','? ']'
duration    := number ('s' | 'ms' | 'm' | 'h')
```

---

## AST

```
Program     { on: OnStmt[], every: EveryStmt[], watch: WatchStmt[], statements: Statement[] }

ActionCall  { name: string, args: Expr[], kwargs: Record<string, Expr> }
Assignment  { name: string, value: Expr }
IfStmt      { condition: Expr, then: Block, else: Block | null }
LoopStmt    { count: Expr | null, body: Block }
ForStmt     { variable: string, iterable: Expr, body: Block }
OnStmt      { condition: Expr, action: ActionCall }
EveryStmt   { interval: DurationLit, action: ActionCall }
WatchStmt   { condition: Expr, action: ActionCall }
TryStmt     { body: Block, else: Block }
ReturnStmt  { value: Expr | null }
BreakStmt   { }

Block       { statements: Statement[] }
StateRef    { path: string[] }
Literal     { value: number | string | boolean | null }
DurationLit { value: number, unit: 's' | 'ms' | 'm' | 'h' }
ListExpr    { elements: Expr[] }
Identifier  { name: string }
BinaryOp    { op: string, left: Expr, right: Expr }
UnaryOp     { op: 'not', operand: Expr }

// skill files parse to: { name, params, on: [...], every: [...], watch: [...], body: [...] }
```

---

## Skills

A skill is a `.px` file. `fertilization(field_a, 0.8)` loads `fertilization.px`, binds params, runs the body inline. Prompt injection with variables. No registry, no compilation, just files.

```
skills/
  fertilization.px
  survey_grid.px
  guarded_survey.px
```

```python
# guarded_survey.px
skill guarded_survey(area, altitude)

on state.signal_lost -> rtl()

takeoff(altitude)
for point in grid(area, overlap=0.8) {
    try { goto(point) } else { hover(); wait_clear(); goto(point) }
    result = scan()
    if result != null { return result }
}
return null
```

```python
found = guarded_survey(sector_4, 30)
```

The caller cannot tell whether `guarded_survey` is compiled or a file. If the skill's `on` fires mid-skill, the whole mission ends (rule 6). Skills declare fatal conditions; they do not handle them. For graceful failure that lets the caller continue, use `try/else` and `return null`.

Rules:
- Files load from a configured skills directory at call time.
- Params bind positionally in declaration order. Named args are also allowed (`guarded_survey(area=sector_4, altitude=30)`).
- Supervisors in a skill come before any other statement, same as at mission top.
- Max call depth is 16.
- Return value is null if `return` is never reached.
- Files parse fresh every call. Editing a skill takes effect on the next call.
- Extract reusable logic into skills. Repeated inline logic costs tokens every feedback iteration. A skill in the index costs nothing until called.

---

## State

`state.*` is the global namespace, a live world model written continuously by the adapter. Read anywhere, never write.

```python
state.battery          # 0.0 to 1.0
state.altitude         # meters
state.position.lat
state.position.lng
state.mode             # GUIDED, LOITER, RTL, etc.
state.armed            # boolean
```

Any `state.*` read is greppable with one regex. Intermediate values go in locals. Results go out through `return`. Derived values (elapsed time, distance, etc.) come from tools, not state.

---

## Actions and tools

Every callable is registered. **Actions** dispatch physical work and have a done predicate. **Tools** compute or emit and return immediately. At the call site they look the same: `name(args)`.

An action entry:

| Field | Description |
|---|---|
| `name` | What you write |
| `params` | Parameter schema |
| `kind` | `flight` or `observation` |
| `done_when` | State predicate that signals completion |
| `timeout` | Seconds before failure |
| `failure_when` | Conditions that trigger the `try` else branch |

```
arm()
  kind:         flight
  done_when:    state.armed == true
  timeout:      10s
  failure_when: state.mode == ERROR

takeoff(altitude)
  kind:         flight
  done_when:    state.altitude >= altitude
  timeout:      30s

goto(lat, lng, alt?)
  kind:         flight
  done_when:    distance(state.position, (lat, lng)) < 2
  timeout:      300s
  failure_when: state.mode == FAILSAFE

tag(label)
  kind:         observation
  done_when:    immediate
```

`kind` matters for `watch`: a `watch` handler must be `observation`. A flight action in a `watch` is a parse error.

A tool entry is shorter:

```
distance(a, b)           # meters between two positions
elapsed()                # seconds since mission start
grid(area, overlap)      # list of waypoints covering area
now()                    # wall clock, ISO string
```

Tools have no `done_when` because they return immediately. Anyone building the GCS can add tools at will; they are registry entries, not grammar.

---

## Adding capability

Grammar never changes. Everything else is pluggable:

- New physical capability: register an action with a done predicate and `kind: flight`.
- New observation: register an action with `kind: observation`.
- New helper: register a tool.
- New world data: the adapter emits a `state.x` key.
- New reusable behavior: write a `.px` skill.

---

## Deliberately not here

| Not included | Why |
|---|---|
| `parallel { A; B }` | Author-level parallelism makes races. FC handles concurrent physical work. |
| `wait(N)` / `sleep` | Register an action with `done_when: elapsed >= N`. |
| `until c { body }` | `loop { body; if c { break } }` is already obvious. |
| `after(D)` | `on elapsed() > D -> action` covers it. |
| `on` with a block body | Wrap multi-step aborts in a skill. |
| Field access on returns | Opaque. Structured data lives in `state.*`. |
| Classes, modules, imports | Skills are the composition unit. |
| First-class functions | Skills cover every reuse case. |
| Exceptions / throw | `try/else` is enough. |

---

## Examples

### Patrol with abort
```python
on state.battery < 15 -> rtl()

loop {
    for point in [A, B, C, D] {
        if state.battery < 25 { break }
        goto(point)
        scan()
    }
    if state.battery < 25 { break }
}

rtl()
```

### Search with observation
```python
on state.battery < 20 -> rtl()
on elapsed() > 15m -> rtl()
watch state.detection -> tag()

loop {
    target = find_person()
    if target != null {
        approach(target)
        return target
    }
}
```

### Using a skill
```python
# guarded_survey.px carries its own supervision
found = guarded_survey(sector_4, 30)

if found != null {
    approach(found)
    alert(found)
} else {
    rtl()
}
```

### Three supervisors together
```python
on state.battery < 15 -> rtl()
every 60s -> log_snapshot()
watch state.waypoint_passed -> mark()

takeoff(30)
for p in [A, B, C, D] {
    goto(p)
    scan()
}
land()
```

---
# For Claude and Codex
## Build order

Each step is independently testable. Do not skip ahead.

1. **Tokenizer.** Keywords, identifiers, literals, operators, brackets, comments, duration tokens.
2. **Parser.** Grammar to AST, clear errors on failure.
3. **Interpreter sequential core.** Walk AST, dispatch actions to a stub registry.
4. **State layer.** `state.*` read-only, subscribable by key.
5. **`loop` / `for`.** Iteration, bounded and unbounded.
6. **Action and tool registry.** Actions with done predicate, timeout, failure, `kind`. Tools immediate.
7. **`try/else`.** Wrap action dispatch in failure and timeout catching.
8. **`on`.** Install at mission or skill top, false-to-true detection, end mission on fire, first in source order wins.
9. **`every`.** Interval timer, skip-if-still-running with flag, teardown on scope end.
10. **`watch`.** Same machinery as `every`, state-triggered, parse-rejects flight actions.
11. **Skill loader.** Resolve name to `.px`, parse fresh, bind params, scoped supervisors, depth guard at 16.

---

*Supersedes `docs/stashed/Drone DSL.md` and `docs/stashed/primitives.md`.*
