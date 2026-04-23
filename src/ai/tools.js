/**
 * Tools — helpers the LLM calls in `let` to compute values or arrange
 * follow-up runs. Most are pure (geo); some have side effects (cron).
 *
 * Each tool: { name, purpose, params, fn(args, ctx) }.
 * `ctx` is the snapshot the LLM saw, so tools resolve "currentPosition" / "home".
 *
 * Cron — fires `runner(goal, "cron#<id>")` after a delay, optionally repeating.
 *   setRunner(fn)   — inject the function each timer should call
 *   activeCrons()   — [{ id, goal, periodSec }]
 *
 * Constraints (hard, not LLM-trusted):
 *   - delaySec / periodSec floored to MIN_DELAY_SEC.
 *   - At most MAX_TIMERS active cron jobs.
 */

const MIN_DELAY_SEC = 10;
const MAX_TIMERS = 5;

const timers = new Map();
let nextId = 1;
let runner = null;

export function setRunner(fn) {
  runner = fn;
}

export function activeCrons() {
  return Array.from(timers.entries(), ([id, t]) => ({
    id,
    goal: t.goal,
    periodSec: t.periodSec,
  }));
}

function cronSchedule({ goal, delaySec, periodSec }) {
  if (!runner) throw new Error("cron runner not set");
  if (!goal || typeof delaySec !== "number")
    throw new Error("cron: { goal, delaySec, periodSec? }");
  if (timers.size >= MAX_TIMERS)
    throw new Error(`max ${MAX_TIMERS} active cron jobs`);
  const dly = Math.max(MIN_DELAY_SEC, delaySec);
  const per = periodSec == null ? null : Math.max(MIN_DELAY_SEC, periodSec);
  const id = nextId++;
  const fire = () => runner(goal, `cron#${id}`);
  const entry = { goal, periodSec: per };
  entry.h = setTimeout(() => {
    fire();
    if (per) entry.h = setInterval(fire, per * 1000);
    else timers.delete(id);
  }, dly * 1000);
  timers.set(id, entry);
  return { id, delaySec: dly, periodSec: per, firesAt: Date.now() + dly * 1000 };
}

function cronCancel({ id }) {
  const t = timers.get(id);
  if (!t) return { ok: false, error: `no cron ${id}` };
  clearTimeout(t.h);
  clearInterval(t.h);
  timers.delete(id);
  return { ok: true };
}

const R = 6371000;
const D = Math.PI / 180;

function ref(r, ctx) {
  if (r?.lat != null && r?.lon != null) return r;
  if (r === "currentPosition" || r === "current") {
    if (!ctx.position || ctx.position.lat == null) throw new Error("no currentPosition in state");
    return ctx.position;
  }
  if (r === "home") {
    if (!ctx.home) throw new Error("home is not set");
    return ctx.home;
  }
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
    name: "cron",
    purpose: "Run a follow-up goal after `delaySec` (>=10s). With `periodSec` (>=10s) it repeats. Use sparingly — each fire is a full LLM call. Returns { id }.",
    params: { goal: "natural-language goal for the next run", delaySec: "seconds", periodSec: "seconds (optional, repeating)" },
    fn: cronSchedule,
  },
  {
    name: "cancelCron",
    purpose: "Cancel an active cron job by id (see activeCrons in state).",
    params: { id: "number" },
    fn: cronCancel,
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function runTool(name, args, ctx) {
  const t = BY_NAME.get(name);
  if (!t) throw new Error(`unknown tool: ${name}`);
  return t.fn(args, ctx);
}

export const RENDERED_TOOLS =
  "Tools (call via let, then reference results in action params with $name.field):\n" +
  TOOLS.map((t) => `- ${t.name} ${JSON.stringify(t.params)} — ${t.purpose}`).join("\n");
