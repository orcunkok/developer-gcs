import { invokeAction } from "../actions.js";
import { useTelemStore } from "../stores/telemStore.js";
import { useEventLogStore } from "../stores/eventLogStore.js";
import { RENDERED_PRIMITIVES, ackCommandFor } from "./primitives.js";
import { RENDERED_SKILLS } from "./skills.js";
import { RENDERED_TOOLS, runTool, isRegisteredTool } from "./tools.js";
import { setRunner, activeSchedules } from "./scheduler.js";

const SYSTEM_PROMPT = `You are the AI commander for an ArduPilot aircraft.

Reply with pure JSON, no prose outside the JSON:
{ "text": "<one or two sentences for the pilot>",
  "let":  { "<name>": { "tool": "...", "args": {...} } },   // optional
  "actions": [ { "name": "...", "params": {...} } ] }

The runtime runs every entry in "let" first (in order), then executes the actions in order, waiting for autopilot ACKs. Reference computed values in action params with the string "$<name>.<field>" — e.g. "$p.lat". There is no follow-up turn — issue everything now.

Primitives (mutate the aircraft):
${RENDERED_PRIMITIVES}

${RENDERED_TOOLS}

${RENDERED_SKILLS}

Rules:
- Vehicle is ArduPlane (fixed-wing). For takeoff, follow the takeoff skill exactly — there is no takeoff primitive on purpose.
- Only emit actions when the pilot asks you to *do* something. Questions ("what is...", "can you reach...", "are we...", "hi") are answered from State with actions: [].
- Pass numeric params as numbers, never strings: { value: 20 } not { value: "20" }. lat/lon are decimal degrees.
- If the request is impossible with these primitives, return text only with actions: [].
- Keep text short. No markdown.`;

const ACK_TIMEOUT_MS = 1500;

// MAVLink raw units → SI/human at the AI boundary.
// Raw values are kept in stores per project rule; convert only at the consumer.
function snapshot() {
  const t = useTelemStore();
  const now = Date.now();
  return {
    armed: t.armed,
    mode: t.mode,
    position: { lat: t.lat * 1e-7, lon: t.lon * 1e-7, altMSL_m: t.altMSL * 1e-3, altAGL_m: t.altAGL * 1e-3 },
    heading_deg: t.heading * 1e-2,
    groundSpeed_mps: t.groundSpeed,
    battery: { voltage_v: t.voltage * 1e-3, remaining_pct: t.remaining },
    home: t.homeLat == null ? null
      : { lat: t.homeLat * 1e-7, lon: t.homeLon * 1e-7, alt_m: t.homeAlt * 1e-3 },
    mission: { current: t.currentWaypoint, total: t.missionTotal },
    activeSchedules: activeSchedules(),
    recentEvents: useEventLogStore().recentEvents(15_000)
      .filter((ev) => !ev.type.startsWith("AI_"))
      .map((ev) => ({ tAgo: now - ev.t, type: ev.type, data: ev.data })),
  };
}

function waitForAck(ackCommand, sentAt) {
  if (!ackCommand) return Promise.resolve(null);
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

async function callLLM(goal, context) {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  const model = import.meta.env.VITE_LLM_MODEL || "openai/gpt-oss-120b";
  if (!key) throw new Error("VITE_GROQ_API_KEY is not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Goal: ${goal}\n\nState:\n${JSON.stringify(context)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const { choices } = await res.json();
  return JSON.parse(choices[0].message.content);
}

// Resolve "$name.field" strings inside params using the let-bindings.
function resolve(v, b) {
  if (typeof v === "string" && v[0] === "$") {
    const [name, ...path] = v.slice(1).split(".");
    return path.reduce((x, k) => x?.[k], b[name]);
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, b));
  if (v && typeof v === "object") {
    const out = {};
    for (const k in v) out[k] = resolve(v[k], b);
    return out;
  }
  return v;
}

/** Inline "$a.b.c" inside natural-language strings (schedule goals, etc.). */
function resolveGoalTemplate(str, b) {
  if (typeof str !== "string") return str;
  return str.replace(/\$([a-zA-Z_]\w*)((?:\.[a-zA-Z_]\w*)*)/g, (full, name, dotPath) => {
    const path = dotPath ? dotPath.slice(1).split(".").filter(Boolean) : [];
    let x = b[name];
    for (const k of path) x = x?.[k];
    if (x === undefined || x === null) return full;
    if (typeof x === "object") return JSON.stringify(x);
    return String(x);
  });
}

function argsForTool(tool, args, bindings) {
  let a = resolve(args, bindings);
  if (tool === "schedule" && typeof a.goal === "string")
    a = { ...a, goal: resolveGoalTemplate(a.goal, bindings) };
  return a;
}

const runListeners = new Set();
export function onRun(fn) { runListeners.add(fn); return () => runListeners.delete(fn); }
function emit(payload) { for (const fn of runListeners) fn(payload); }

export async function runCommander(goal, source = "user") {
  const e = useEventLogStore();
  let ctx, plan;
  try {
    ctx = snapshot();
    plan = await callLLM(goal, ctx);
  } catch (err) {
    emit({ goal, source, text: "", tools: [], results: [], error: err?.message || String(err) });
    return;
  }

  const tools = [];
  const bindings = {};
  for (const [name, { tool, args = {} }] of Object.entries(plan.let ?? {})) {
    try {
      const resolvedArgs = argsForTool(tool, args, bindings);
      const result = runTool(tool, resolvedArgs, ctx);
      bindings[name] = result;
      tools.push({ name, tool, args: resolvedArgs, result });
      e.addEvent("AI_TOOL", { name, tool, args: resolvedArgs, result });
    } catch (err) {
      e.addEvent("AI_ERROR", { tool, error: err.message });
      emit({ goal, source, text: plan.text || "", tools, results: [], error: err.message });
      return;
    }
  }

  const actions = (plan.actions ?? []).map((a) => ({
    name: a.name,
    params: resolve(a.params ?? {}, bindings),
  }));
  e.addEvent("AI_PLAN", { goal, text: plan.text, bindings, actions });

  const results = [];
  for (const a of actions) {
    if (isRegisteredTool(a.name)) {
      try {
        const resolvedArgs = argsForTool(a.name, a.params, bindings);
        const result = runTool(a.name, resolvedArgs, ctx);
        tools.push({ name: a.name, tool: a.name, args: resolvedArgs, result });
        e.addEvent("AI_TOOL", { name: a.name, tool: a.name, args: resolvedArgs, result });
      } catch (err) {
        e.addEvent("AI_ERROR", { tool: a.name, error: err.message });
        emit({ goal, source, text: plan.text || "", tools, results: [], error: err.message });
        return;
      }
      continue;
    }
    const sentAt = Date.now();
    let { ok, error } = invokeAction(a.name, a.params);
    if (ok) {
      const ack = await waitForAck(ackCommandFor(a.name), sentAt);
      if (ack && ack.result !== "ACCEPTED") { ok = false; error = `${ack.command} ${ack.result}`; }
    }
    const r = { name: a.name, params: a.params, ok, error };
    results.push(r);
    e.addEvent("AI_ACTION", r);
    if (!ok) { e.addEvent("AI_ERROR", { name: a.name, error }); break; }
  }

  emit({ goal, source, text: plan.text || "", tools, results });
}

setRunner(runCommander);
