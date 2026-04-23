/**
 * Sequencer — runs primitive actions one at a time.
 * For each step: fire → await ACK → await physical done → next.
 * Aborts on first failure.
 */

import { invokeAction } from "../actions.js";
import { useEventLogStore } from "../stores/eventLogStore.js";

const ACK_TIMEOUT_MS = 1500;
const DONE_POLL_MS = 200;

function waitForAck(ackCommand, sentAt) {
  const e = useEventLogStore();
  const deadline = sentAt + ACK_TIMEOUT_MS;
  return new Promise((resolve) => {
    const tick = () => {
      const events = e.recentEvents(Date.now() - sentAt + 100);
      for (let i = events.length - 1; i >= 0 && events[i].t >= sentAt; i--) {
        const ev = events[i];
        if (ev.type === "COMMAND_ACK" && ev.data?.command === ackCommand) return resolve(ev.data);
      }
      Date.now() >= deadline ? resolve(null) : setTimeout(tick, 50);
    };
    tick();
  });
}

function waitForDone(done, params, getState, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  return new Promise((resolve) => {
    const tick = () => {
      try {
        if (done(getState(), params)) return resolve(true);
      } catch { return resolve(false); }
      Date.now() >= deadline ? resolve(false) : setTimeout(tick, DONE_POLL_MS);
    };
    tick();
  });
}

/**
 * @param {Array<{name, params, ackCommand?, done?, doneTimeoutSec?}>} steps
 * @param {() => object} getState  live unit-converted telem (no event log)
 * @returns {Promise<Array<{name, params, ok, error?}>>}
 */
export async function runSequence(steps, getState) {
  const e = useEventLogStore();
  const results = [];

  for (const step of steps) {
    const sentAt = Date.now();
    let { ok, error } = invokeAction(step.name, step.params);

    if (ok && step.ackCommand) {
      const ack = await waitForAck(step.ackCommand, sentAt);
      if (ack && ack.result !== "ACCEPTED") {
        ok = false;
        error = `${ack.command} ${ack.result}`;
      }
    }

    if (ok && step.done) {
      const timeoutSec = step.doneTimeoutSec ?? 30;
      const completed = await waitForDone(step.done, step.params, getState, timeoutSec);
      if (!completed) { ok = false; error = `${step.name} did not complete within ${timeoutSec}s`; }
    }

    const r = { name: step.name, params: step.params, ok, error };
    results.push(r);
    e.addEvent("AI_ACTION", r);
    if (!ok) { e.addEvent("AI_ERROR", { name: step.name, error }); break; }
  }

  return results;
}
