# Developer GCS

Vue 3 + Vite + maptalks ground control station for swarm development.

Build incrementally with the developer. Prioritize reliability, fast interaction, low CPU/memory usage, and clear human–machine interaction. Planned capabilities include simulation, logs, debugging, and settings; implement them only when requested.

## Scope and Collaboration

- Questions are read-only. Do not edit files unless the user explicitly requests implementation or changes.
- Implement only the requested scope. Context informs decisions; it does not authorize additional work.
- Briefly flag likely bottlenecks, tradeoffs, or future refactoring needs. Do not expand scope to address them.
- Explicit user instructions override these project defaults, including temporary exceptions.

## Design Principles

Apply in order:

1. **Question:** Identify the actual problem; challenge assumptions regardless of source.
2. **Delete:** Remove unnecessary code, features, dependencies, and abstractions within the requested scope.
3. **Simplify:** Build the smallest correct solution. Follow YAGNI; preserve clear extension paths without speculative architecture.
4. **Accelerate:** Shorten build–test–feedback cycles. Optimize measured bottlenecks.
5. **Automate:** Automate only necessary, simplified, proven workflows.

## Core Constraints

- Support multiple aircraft from day one; never assume a single active or connected aircraft.
- Start with keyboard and mouse. Every action must work with the mouse; add keyboard access where useful.
- Keep layouts and interactions compatible with future touch/tablet support.

## Technical Rules

- Use `lucide-vue-next` for icons.
- Minimize CPU usage, memory consumption, and unnecessary rendering.
- Define all colors, typography, and layout dimensions as global CSS variables in `src/style.css`; never hardcode them elsewhere.
- No CSS animations or transitions unless explicitly requested.
- Keep JSDoc typedefs in their owning files; no standalone type files.
- Mark all placeholders and temporary code with the exact phrase `for debugging only`.

## Current State

Bare layout shell; features are being rebuilt from scratch.

- Layout: top Status Bar, Left Pane, center Primary Display (map), Right Pane, Bottom Strip.
- NavBar overlay opens from the status bar menu button.
- Panes are empty placeholders; the map has a right-click menu.
- Pane toggle shortcuts live in `src/App.vue`; see README.
