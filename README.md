# developer-gcs

Vue 3 + Vite + maplibre-gl. Uses [bun](https://bun.sh).

## Install

```sh
bun install
```

## Run

```sh
bun run dev      # dev server
bun run build    # production build to dist/
bun run preview  # serve the production build
```

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Toggle left pane |
| `Ctrl+.` | Toggle bottom strip |
| `Ctrl+/` | Toggle right pane |
| `Esc` | Close navbar |

The navbar is opened with the menu button in the status bar.

## Map

The right-click context menu (Add Waypoint, Drop Marker, Measure Distance; placeholders) is disabled for now. The code is still in `src/map/MapView.vue`; see the comment above the wrapper to re-enable it.
