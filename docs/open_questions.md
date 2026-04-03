# Open Questions

**Last Change:** April 02, 2026

Unresolved design decisions. Do not over-engineer these — flag and move on.

---

## Waypoint Management

1. **Local-only editing model.** User edits waypoints in the UI. Changes are local until "Write to vehicle." Do we need undo/redo? Diff view showing local vs vehicle state?

2. **Mission item command types.** MAVLink has ~200 `MAV_CMD_*` types. Which subset do we support initially? Recommendation: start with `NAV_WAYPOINT` only, render everything else as "unsupported item" with raw data visible.

3. **Altitude reference frames.** Mission items have a frame field (absolute, relative to home, relative to terrain). This changes what "alt" means. Must display the frame and convert for map rendering.

## General

4. **Onboarding flow.** First-time connection experience. See README section 10.

5. **Network interruption handling.** What happens when link drops mid-flight? See README section 10.

6. **AI integration scope.** How much autonomy do AI skills get? See README section 10.
