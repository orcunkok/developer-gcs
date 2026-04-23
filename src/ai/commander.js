import { useTelemStore } from "../stores/telemStore.js";
import { useEventLogStore } from "../stores/eventLogStore.js";
import { RENDERED_PRIMITIVES, primitiveFor } from "./primitives.js";
import { RENDERED_SKILLS } from "./skills.js";
import { RENDERED_TOOLS, runTool, setRunner, activeCrons } from "./tools.js";
import { runSequence } from "./sequencer.js";

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
- Tools go in "let", never in "actions". Actions are aircraft primitives only.
- Only emit actions when the pilot asks you to *do* something. Questions ("what is...", "can you reach...", "are we...", "hi") are answered from State with actions: [].
- Pass numeric params as numbers, never strings: { value: 20 } not { value: "20" }. lat/lon are decimal degrees.
- If the request is impossible with these primitives, return text only with actions: [].
- Keep text short. No markdown.`;

// MAVLink raw units → SI/human at the AI boundary.
// Raw values are kept in stores per project rule; convert only at the consumer.
function snapshot() {
  const t = useTelemStore();
  if (t.connState !== "connected") return { link: t.connState };
  const now = Date.now();
  return {
    link: "connected",
    armed: t.armed,
    mode: t.mode,
    position: { lat: t.lat * 1e-7, lon: t.lon * 1e-7, altMSL_m: t.altMSL * 1e-3, altAGL_m: t.altAGL * 1e-3 },
    heading_deg: t.heading * 1e-2,
    groundSpeed_mps: t.groundSpeed,
    battery: { voltage_v: t.voltage * 1e-3, remaining_pct: t.remaining },
    home: t.homeLat == null ? null
      : { lat: t.homeLat * 1e-7, lon: t.homeLon * 1e-7, alt_m: t.homeAlt * 1e-3 },
    mission: { current: t.currentWaypoint, total: t.missionTotal },
    activeCrons: activeCrons(),
    recentEvents: useEventLogStore().recentEvents(15_000)
      .filter((ev) => !ev.type.startsWith("AI_"))
      .map((ev) => ({ tAgo: now - ev.t, type: ev.type, data: ev.data })),
  };
}

// Lightweight telem read for done() polling — no event log scanning.
function liveState() {
  const t = useTelemStore();
  return {
    armed: t.armed,
    mode: t.mode,
    position: t.lat == null ? null : { lat: t.lat * 1e-7, lon: t.lon * 1e-7, altAGL_m: t.altAGL * 1e-3 },
  };
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
  const raw = choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw);
  return { model, raw, parsed };
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

/** Inline "$a.b.c" inside natural-language strings (cron goals, etc.). */
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

const runListeners = new Set();
export function onRun(fn) { runListeners.add(fn); return () => runListeners.delete(fn); }
function emit(payload) { for (const fn of runListeners) fn(payload); }

let runId = 0;

export async function runCommander(goal, source = "user") {
  const id = ++runId;
  const e = useEventLogStore();
  let ctx, plan;
  try {
    ctx = snapshot();
    const llm = await callLLM(goal, ctx);
    plan = llm.parsed;
    console.log("[ai] response", { id, source, goal, model: llm.model, raw: llm.raw, plan }); // for debugging only
  } catch (err) {
    console.error("[ai] response error", { id, source, goal, error: err?.message || String(err) }); // for debugging only
    emit({ id, goal, source, text: "", tools: [], results: [], error: err?.message || String(err) });
    return;
  }

  const tools = [];
  const bindings = {};
  for (const [name, { tool, args = {} }] of Object.entries(plan.let && typeof plan.let === "object" ? plan.let : {})) {
    let resolvedArgs;
    try {
      resolvedArgs = resolve(args, bindings);
      if (tool === "cron" && typeof resolvedArgs.goal === "string")
        resolvedArgs = { ...resolvedArgs, goal: resolveGoalTemplate(resolvedArgs.goal, bindings) };
      const result = runTool(tool, resolvedArgs, ctx);
      bindings[name] = result;
      tools.push({ name, tool, args: resolvedArgs, result });
      e.addEvent("AI_TOOL", { name, tool, args: resolvedArgs, result });
    } catch (err) {
      const msg = `${tool}(${JSON.stringify(resolvedArgs ?? args)}): ${err.message}`;
      tools.push({ name, tool, args: resolvedArgs ?? args, error: err.message });
      e.addEvent("AI_ERROR", { tool, args: resolvedArgs ?? args, error: err.message });
      emit({ id, goal, source, text: plan.text || "", tools, results: [], error: msg });
      return;
    }
  }

  const actions = (plan.actions ?? []).map((a) => ({
    name: a.name,
    params: resolve(a.params ?? {}, bindings),
  }));
  e.addEvent("AI_PLAN", { goal, text: plan.text, bindings, actions });

  // Emit immediately after LLM responds — actions shown as pending (ok: null).
  const pending = actions.map((a) => ({ name: a.name, params: a.params, ok: null }));
  emit({ id, goal, source, text: plan.text || "", tools, results: pending });

  const steps = actions.map((a) => {
    const prim = primitiveFor(a.name) ?? {};
    return { name: a.name, params: a.params, ackCommand: prim.ackCommand, done: prim.done, doneTimeoutSec: prim.doneTimeoutSec };
  });
  const results = await runSequence(steps, liveState);

  // Emit again with results so chat can update the same message.
  emit({ id, goal, source, text: plan.text || "", tools, results });
}

setRunner(runCommander);
