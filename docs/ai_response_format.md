# AI Response Format

The contract between the LLM and the runtime. One turn, one JSON object.

```json
{
  "text": "<one or two sentences for the pilot>",
  "let":  { "<name>": { "tool": "...", "args": {...} } },
  "actions": [ { "name": "...", "params": {...} } ]
}
```

Runtime runs `let` in order, then `actions` in order. `actions` reference `let` results via `"$name.field"`.

## Why this shape

**`let` + `actions` split.** Compute is pure, mutation is not. Separating them matches how the LLM plans ("first figure out where, then go") and how the runtime logs (`AI_TOOL` before `AI_ACTION`). Mixing would mean tool calls fire mid-dispatch — messier events, worse planning.

**Named bindings (`p`, not inline).** A computed value is often used by more than one action, or twice in one action (`lat` and `lon`). Named once, referenced anywhere. Inlining would duplicate calls and double tokens.

**`$ref` strings over object wrappers.** `"$p.lat"` is 6 chars. Any structured alternative (`{ref:"p", field:"lat"}`) costs more tokens for the same information.

**JSON, not YAML/TOML.** Groq's `response_format: json_object` guarantees parseable output. YAML saves ~25% response tokens but loses the guarantee and adds indentation fragility. Response is ~3% of the token budget — not worth the risk.

**Verbose keys (`tool`, `args`).** LLMs are trained on verbose JSON. Shortening to `t`/`a` saves a handful of tokens and measurably hurts reliability.

## Where tokens actually go

| Part | Tokens |
|---|---|
| System prompt (primitives + tools + skills) | ~600 |
| State snapshot | ~300 |
| Response | ~80 |

Optimize the snapshot and prompt before the response shape.

## When to evolve

This format handles linear plans with a few computed values. It strains when you need:

- Conditionals (`if battery < 30 then RTL`)
- Loops (`orbit 3 times`)
- Dependent computation chains

That's the signal to consider code-mode (LLM emits JS, runtime evals against a frozen `{actions, tools, ctx}`). Not before.

## Invariants

- `let` is pure compute (+ `schedule` as a deliberate exception). `actions` mutate the aircraft.
- Every primitive/tool returns `{ok, ...}` or `{ok: false, error}`. No throws across the boundary.
- `snapshot()` field names are a public contract — the LLM will reference them.
- Events are emitted by the runtime wrapper, not inside handlers.
