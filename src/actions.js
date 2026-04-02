import { useEventLogStore } from "./stores/eventLogStore.js";

// Action registry: single entry point for outbound commands.
// Adapters register handlers; UI/AI/console invokes via `action.<name>(params)`.
//
// Result contract — invokeAction() never leaves the caller blind:
//   { ok: true, value?: any }
//   { ok: false, code: "UNKNOWN_ACTION" | "HANDLER_ERROR", error: string }

const REGISTRY_KEY = "__developerGcsActionRegistry";
const registry =
  globalThis[REGISTRY_KEY] ??
  (globalThis[REGISTRY_KEY] = { handlers: new Map() });
const handlers = registry.handlers;

export function registerAction(name, handler) {
  if (typeof name !== "string" || !name) {
    throw new Error("registerAction: name must be a non-empty string");
  }
  if (typeof handler !== "function") {
    throw new Error("registerAction: handler must be a function");
  }
  handlers.set(name, handler);
}

export function listActions() {
  return Array.from(handlers.keys());
}

export function hasAction(name) {
  return handlers.has(name);
}

function getEventLogStoreSafe() {
  // Important: do not touch Pinia at import time.
  try {
    return useEventLogStore();
  } catch {
    return null;
  }
}

export function invokeAction(name, params = {}) {
  const handler = handlers.get(name);
  if (!handler) {
    const eventLog = getEventLogStoreSafe();
    if (eventLog) {
      eventLog.addEvent("COMMAND_FAILED", {
        action: name,
        params,
        error: "unknown action",
      });
    }
    return { ok: false, code: "UNKNOWN_ACTION", error: `unknown action: ${name}` };
  }

  const eventLog = getEventLogStoreSafe();
  if (eventLog) eventLog.addEvent("COMMAND_SENT", { action: name, params });

  try {
    const value = handler(params);
    return { ok: true, value };
  } catch (err) {
    const error = err?.message ? String(err.message) : String(err);
    if (eventLog) {
      eventLog.addEvent("COMMAND_FAILED", {
        action: name,
        params,
        error,
      });
    }
    return { ok: false, code: "HANDLER_ERROR", error };
  }
}

// Proxy API: call actions by name from anywhere.
export const action = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop === "then") return undefined; // avoid Promise-like confusion
      return (params = {}) => invokeAction(prop, params);
    },
  },
);

