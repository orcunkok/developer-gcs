# Mission Primitives

The complete vocabulary for AI-authored missions. Nine primitives, nothing else. Anything richer is built by composing these.

## Design premises (confirmed)

- **Primitives are the product.** Text grammar is one renderer; the AI may also emit structured AST directly. The interpreter runs the AST either way.
- **Safety model:** AST interpreter over a whitelisted primitive set. Not `eval` of a general-purpose language.
- **Every action declares a done-when predicate.** Actions return when they are *done*, not when the command is *accepted*. Sequencing falls out of this for free — no special `then` keyword needed.
- **`state.` is the only namespace.** Everything else is a lexically-scoped identifier (skill params, locals, action returns).
- **Writes are explicit.** `set state.x = v` — no silent mutations, matches the event-bus principle.
- **Forgiving parser, one block syntax.** Braces `{ ... }` only. Case-insensitive keywords, optional semicolons, optional trailing commas.

## The nine primitives

### 1. Action call
```
takeoff(10)
goto(target)
x = scan(grid)
```
Awaits the action's done-predicate before the next statement runs. Predicates are declared in the action registry, not at the call site — the script trusts the action's contract.

### 2. Sequencing (`;` or newline)
```
arm(); set_mode(GUIDED); takeoff(10); goto(N, 300)
```
`B` starts when `A`'s done-predicate holds. Works regardless of success or failure (failure handling is `try`'s job).

Solves the current race where `arm → set_mode → goto` fire in parallel and the vehicle isn't ready.

### 3. `if / else`
```
if state.battery < 20 { rtl() }
if state.fertilizer < 0.1 { refill() } else { continue_spray() }
```
Evaluated once at statement time.

### 4. `loop`
```
loop { patrol() }
```
Infinite. Exits via `break`, an enclosing `until`, or an event handler that cancels the enclosing handle.

### 5. `until`
```
until state.battery < 20 {
  goto(A); goto(B); goto(C)
}
```
Checked *between* iterations. Does not interrupt mid-action — use `on` for that.

### 6. `on event -> block`
```
on state.detection > 0.8 -> { hover(); alert() }
on state.anomaly -> { handle_anomaly() }
```
Scoped reactive watcher. Installed when the enclosing block starts, torn down when it exits. Fires on `false → true` transition only (not while-true, or you get a thousand alerts).

`on-event` is the only source of concurrency in the language. Watchers run in the background while the main script is sequential. No user-authored `parallel` — no race conditions in authored code.

### 7. `try / else`
```
try { goto(target) } else { rtl() }
```
Catches **action failure and timeout only**. Does not catch:
- Guard/world-state changes → that's `on-event`'s job
- Parse or interpreter errors → those surface to the developer

### 8. `compose` (skill call)
```
x = scan_area(grid)
patrol([A, B, C])
```
Skills are named, saved DSL snippets. Call them like actions. Skills return values via explicit `return`.

### 9. `state`
Read: `state.battery`, `state.mode`, `state.position`
Write: `set state.last_scan = result`

The only namespace. `state.` reads are greppable — one regex tells you everything a script reads from the world. Writes go through `set` so every mutation is a visible AST node.

## Language-level (not primitives)

- `return expr` — return value from a skill
- Literals: numbers, strings, booleans, lists
- Identifiers (lexically scoped: locals → skill params → nothing)
- Arithmetic and comparison operators
- `break` — exit enclosing loop

## What's deliberately absent

| Not a primitive | Why |
|---|---|
| `wait` / `sleep` | A trivial action (`done_when = elapsed >= Xs`). One less primitive. |
| `parallel { A; B }` | `on-event` covers supervised execution; user-authored concurrency is a footgun. |
| `handles` / `cancel(h)` | Folded into how `on-event` scoping cancels work on block exit. Revisit if a real mission needs manual cancellation. |
| Classes, imports, first-class functions | Out of scope. Skills are the only composition unit. |

## Example: supervised search

The `try(find_person) catch(anomaly)` case that motivated the design — expressed cleanly:

```
on state.anomaly -> { handle_anomaly(); break }
loop {
  target = find_person()
  if target != null { approach(target); return target }
}
```

The watcher runs for the duration of the `loop`. If anomaly fires, it handles and breaks out. No explicit concurrency primitive needed.

## Example: the motivating sequencing bug

Today's broken flow:
```
arm(); set_mode(GUIDED); takeoff(10); goto(N, 300)
```
fires all four commands near-simultaneously and the vehicle isn't armed when `goto` runs.

With done-predicates on each action, the same script sequences correctly:
- `arm` returns when `state.armed == true`
- `set_mode` returns when `state.mode == GUIDED`
- `takeoff` returns when `state.altitude >= 10`
- `goto` returns when `distance(state.pos, target) < 2m`

No `event(...) -> event(...)` chain needed. The DSL just reads top-to-bottom.

## Open questions (next sessions)

- **(a) Done-predicates per action.** Full registry: what predicate, what timeout, what counts as failure. Applied action-by-action.
- **(b) `on-event` scoping rules.** Exact lifecycle: when installed, when torn down, what happens if it fires during its own handler, interaction with `try`.
- **(c) What `try` catches — precise spec.** Failure taxonomy (command rejected, timeout, precondition violation, adapter disconnect), and which of these the `else` branch sees.

These get resolved one at a time before grammar and interpreter work.
