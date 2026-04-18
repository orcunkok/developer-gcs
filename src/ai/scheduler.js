/**
 * Scheduler — fires `runner(goal, "schedule#<id>")` after a delay,
 * optionally repeating. Strict guardrails keep token usage sane.
 *
 *   setRunner(fn)           — inject the function each timer should call
 *   schedule({ ... })       — { id, delaySec, periodSec }
 *   cancelSchedule({ id })  — { ok }
 *   activeSchedules()       — [{ id, goal, periodSec }]
 *
 * Constraints (hard, not LLM-trusted):
 *   - delaySec / periodSec floored to MIN_DELAY_SEC.
 *   - At most MAX_TIMERS active schedules.
 */

const MIN_DELAY_SEC = 10;
const MAX_TIMERS = 5;

const timers = new Map();
let nextId = 1;
let runner = null;

export function setRunner(fn) {
  runner = fn;
}

export function schedule({ goal, delaySec, periodSec }) {
  if (!runner) throw new Error("scheduler runner not set");
  if (!goal || typeof delaySec !== "number")
    throw new Error("schedule: { goal, delaySec, periodSec? }");
  if (timers.size >= MAX_TIMERS)
    throw new Error(`max ${MAX_TIMERS} active schedules`);
  const dly = Math.max(MIN_DELAY_SEC, delaySec);
  const per = periodSec == null ? null : Math.max(MIN_DELAY_SEC, periodSec);
  const id = nextId++;
  const fire = () => runner(goal, `schedule#${id}`);
  const entry = { goal, periodSec: per };
  entry.h = setTimeout(() => {
    fire();
    if (per) entry.h = setInterval(fire, per * 1000);
    else timers.delete(id);
  }, dly * 1000);
  timers.set(id, entry);
  return { id, delaySec: dly, periodSec: per };
}

export function cancelSchedule({ id }) {
  const t = timers.get(id);
  if (!t) return { ok: false, error: `no schedule ${id}` };
  clearTimeout(t.h);
  clearInterval(t.h);
  timers.delete(id);
  return { ok: true };
}

export function activeSchedules() {
  return Array.from(timers.entries(), ([id, t]) => ({
    id,
    goal: t.goal,
    periodSec: t.periodSec,
  }));
}
