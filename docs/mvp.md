# AI Commander MVP

**Status:** Draft  
**Target:** SITL-first

## Promise

Give the drone a goal in plain English. The system turns that goal into a small plan, runs it through reusable skills, executes through deterministic primitives, and explains what it is doing. This is not a chatbot on top of MAVLink. It is a runtime for goals, skills, and actions.

The value is immediate: less waypoint clicking, less manual replanning, less mental battery math, more "say what you want, adjust as you go." If this works, a drone developer should instantly see how they could build their own workflows on top.

The easiest mental model is this: it behaves like a coding agent, but applied to drones. The user gives a goal in natural language, the runtime decides whether to answer directly, call a primitive, or use a higher-level skill, then it executes, reports progress, and adapts when the user changes direction.

## Core Philosophy

Keep the center small and the edge open. `actions.js` is the primitive surface. It contains the stable verbs: go, orbit, hold, mark, rtl, land, change altitude, load mission, and similar actions. Skills are built on top of that surface. A skill is just a reusable recipe: a name, a purpose, some inputs, allowed primitives, stop conditions, and a result. The runtime injects context, picks a primitive or skill, runs it, tracks progress, supports interruption and resume, and returns clear status.

We do not hardcode agriculture mode, SAR mode, or inspection mode into the product. We build the runtime and primitive layer; users build domain skills on top, just like skill files in coding agents. Small core, open edge.

## Model

```text
User goal
  -> Runtime
     -> primitive from actions.js
     -> or skill built on primitives
  -> progress / interrupt / resume
  -> clear status back to user
```

The AI never touches protocol details directly. It only sees approved primitives and approved skills.

## Primitives And Skills

Primitives are the stable verbs from `actions.js`. Skills are reusable compositions over those verbs. Good first skills are things like `grid_search(area, spacing, alt)`, `inspect_point(point, inspect_alt, orbit_radius)`, `resume_checkpoint(id)`, `battery_guard(min_return_pct)`, `time_window(end_time)`, `location_alert(region)`, and `patrol_loop(route, exit_condition)`. Bigger behaviors should come from composing small skills, not from adding giant special-case modes.

This is the key framework idea: LLM for reasoning, primitives for execution, runtime for control.

## Built-In Abilities

The runtime should expose a few strong abilities from day one: checkpoint save and resume, checkpoint-triggered behaviors, time-based skills like cron-style jobs or end-time rules, space-aware behavior using named places, relative movement and coordinates , time-aware behavior using mission progress,battery and payloads and event-driven reactions like location alerts or "if nothing is there, search nearby." These are not separate product modes. They are reusable capabilities that skills can use.

## What The MVP Should Prove

The MVP should prove a few things well. A user can say "survey this field in a 20m grid and skip the road," "go 300m north, orbit, then come back," "patrol until battery is low," "resume where we left off," or "if nothing is there, search nearby." That is enough to show planning, spatial reasoning, mid-flight edits, checkpoint/resume, and composable skills without pretending perception is solved.

For SITL, we can preload named places and inject simple events when needed. That is fine. The MVP is proving the interface and framework, not claiming full real-world autonomy.

## Example Flows

### Simple inspect

```text
User: "Go 300 meters north and check it out"
AI:   Flying 300m north, orbiting briefly, then returning home.
```

### Relative investigation

```text
User: "Something at my 2 o'clock, 200m. Check it."
AI:   Flying to 2 o'clock, 200m.
      [goto_relative(200, 60)]

      On station. What should I look for?

User: "Get lower, orbit tight"
AI:   Descending to 15m.
      [set_altitude(15)]
      [orbit(20, 2)]

User: "Mark it"
AI:   Marked: poi_1
      [mark("poi_1")]
```

### Survey with edit

```text
User: "Spray the vineyard. Heavier on south rows,
       they had mildew. Skip the access road."
AI:   Planning:
      - 2.4 hectares, 24 rows
      - South rows: 150% rate
      - North rows: 100% rate
      - Road excluded
      - Tank usage: ~85%

      [grid_search(vineyard, 8, 40, rate_map={south:1.5, north:1.0})]

User: "Make south 200%"
AI:   Updated. Tank usage now 92%.

[mid-flight]
User: "Wind's up"
AI:   Wind 12kt (was 8). Drift increasing.
      Recommend: finish this row, hold for conditions.

User: "Finish south section, come back"
AI:   Completing row 10, then RTL.
      [checkpoint_save("vineyard_r11")]
      [rtl()]
```

### Checkpoint and resume

```text
User: "Patrol until battery is low"
AI:   Starting patrol. I will save a checkpoint before RTL.

[later]
User: "Resume where we left off"
AI:   Resuming from the saved checkpoint.
```

### Skill-based investigation

```text
User: "If nothing is there, search nearby"
AI:   Understood. I will inspect the target point first, then expand the search if needed.
```

## Rules

Skills stay small. Missions must be interruptible and resumable. The runtime owns state, context, progress, and logging. The AI only sees approved primitives and approved skills. That is what keeps the system scalable, understandable, and easy for users to extend.

Skills later, only if needed, when you see the LLM botching a repeated pattern, that pattern becomes a skill definition. 

## Success

This MVP wins if a developer watches it and thinks: "This is faster than QGC for real work, and I could build my own skill pack on top of it." That is enough.
