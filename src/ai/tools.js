/**
 * Tools — helpers the LLM calls in `let` to compute values or arrange
 * follow-up runs. Most are pure (geo); some have side effects (schedule).
 *
 * Each tool: { name, purpose, params, fn(args, ctx) }.
 * `ctx` is the snapshot the LLM saw, so tools resolve "currentPosition" / "home".
 */

import { schedule, cancelSchedule } from "./scheduler.js";

const R = 6371000;
const D = Math.PI / 180;

function ref(r, ctx) {
  if (r?.lat != null && r?.lon != null) return r;
  if (r === "currentPosition" || r === "current") return ctx.position;
  if (r === "home") return ctx.home;
  throw new Error(`unknown reference: ${JSON.stringify(r)}`);
}

export const TOOLS = [
  {
    name: "geo",
    purpose:
      "Polar geometry on the WGS84 sphere. " +
      "Forward (give from+bearingDeg+distanceM): returns { lat, lon } that many meters along that bearing (0=N, 90=E). " +
      "Inverse (give from+to): returns { distanceM, bearingDeg } between the two points.",
    params: {
      from: "'currentPosition' | 'home' | { lat, lon }",
      to: "(inverse) 'currentPosition' | 'home' | { lat, lon }",
      bearingDeg: "(forward) degrees",
      distanceM: "(forward) meters",
    },
    fn: ({ from, to, bearingDeg, distanceM }, ctx) => {
      const a = ref(from, ctx);
      const φ1 = a.lat * D, λ1 = a.lon * D;
      if (to != null) {
        const b = ref(to, ctx);
        const φ2 = b.lat * D, λ2 = b.lon * D;
        const Δφ = φ2 - φ1, Δλ = λ2 - λ1;
        const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const θ = Math.atan2(
          Math.sin(Δλ) * Math.cos(φ2),
          Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ),
        );
        return { distanceM: 2 * R * Math.asin(Math.sqrt(h)), bearingDeg: ((θ / D) + 360) % 360 };
      }
      const δ = distanceM / R, θ = bearingDeg * D;
      const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
      const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
      return { lat: φ2 / D, lon: λ2 / D };
    },
  },
  {
    name: "schedule",
    purpose: "Run a follow-up goal after `delaySec` (>=10s). With `periodSec` (>=10s) it repeats. Use sparingly — each fire is a full LLM call. Returns { id }.",
    params: { goal: "natural-language goal for the next run", delaySec: "seconds", periodSec: "seconds (optional, repeating)" },
    fn: (args) => schedule(args),
  },
  {
    name: "cancelSchedule",
    purpose: "Cancel an active schedule by id (see activeSchedules in state).",
    params: { id: "number" },
    fn: (args) => cancelSchedule(args),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function runTool(name, args, ctx) {
  const t = BY_NAME.get(name);
  if (!t) throw new Error(`unknown tool: ${name}`);
  return t.fn(args, ctx);
}

export function isRegisteredTool(name) {
  return BY_NAME.has(name);
}

export const RENDERED_TOOLS =
  "Tools (call via let, then reference results in action params with $name.field):\n" +
  TOOLS.map((t) => `- ${t.name} ${JSON.stringify(t.params)} — ${t.purpose}`).join("\n");
