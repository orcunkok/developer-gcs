import { useEventLogStore } from "./stores/eventLogStore.js";

// Action registry: single entry point for outbound commands.
// Adapters register handlers; UI/AI/console invokes via `action.<name>(params)`.

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
    const knownActions = Array.from(handlers.keys());
    if (eventLog) {
      eventLog.addEvent("COMMAND_FAILED", {
        action: name,
        params,
        error: "unknown action",
      });
    }
    // for debugging only
    if (typeof window !== "undefined") {
      console.error(`[action] unknown action "${name}"`, { knownActions });
    }
    return;
  }

  // Registry logs every command invocation.
  const eventLog = getEventLogStoreSafe();
  if (eventLog) eventLog.addEvent("COMMAND_SENT", { action: name, params });

  try {
    // for debugging only
    if (typeof window !== "undefined") console.log(`[action] invoking "${name}"`, { params });
    return handler(params);
  } catch (err) {
    if (eventLog) {
      eventLog.addEvent("COMMAND_FAILED", {
        action: name,
        params,
        error: err?.message ? String(err.message) : String(err),
      });
    }
    throw err;
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

// for debugging only — inspect registered actions: `window.__actions`
if (typeof window !== "undefined") {
  window.__actions = action;
  window.__actionNames = () => Array.from(handlers.keys());
}

