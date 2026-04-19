/**
 * Cron — fires `runner(goal, "cron#<id>")` after a delay,
 * optionally repeating. Strict guardrails keep token usage sane.
 *
 *   setRunner(fn)        — inject the function each timer should call
 *   cron({ ... })        — { id, delaySec, periodSec }
 *   cancelCron({ id })   — { ok }
 *   activeCrons()        — [{ id, goal, periodSec }]
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

export function cron({ goal, delaySec, periodSec }) {
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
  return { id, delaySec: dly, periodSec: per };
}

export function cancelCron({ id }) {
  const t = timers.get(id);
  if (!t) return { ok: false, error: `no cron ${id}` };
  clearTimeout(t.h);
  clearInterval(t.h);
  timers.delete(id);
  return { ok: true };
}

export function activeCrons() {
  return Array.from(timers.entries(), ([id, t]) => ({
    id,
    goal: t.goal,
    periodSec: t.periodSec,
  }));
}
