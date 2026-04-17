import { invokeAction } from "../actions.js";
import { useTelemStore } from "../stores/telemStore.js";
import { useEventLogStore } from "../stores/eventLogStore.js";
import { renderPrimitives, ackCommandFor } from "./primitives.js";
import { renderSkills } from "./skills.js";

const SYSTEM_PROMPT = [
  `You are the AI commander for an ArduPilot aircraft.`,
  ``,
  `Reply with pure JSON, no prose outside the JSON:`,
  `{ "text": "<one or two sentences for the pilot>",`,
  `  "actions": [ { "name": "...", "params": {...} } ] }`,
  ``,
  `The runtime executes the actions in order, waits for autopilot ACKs, and reports results back to the pilot. There is no follow-up turn — issue every action you need now.`,
  ``,
  `Primitives:`,
  renderPrimitives(),
  ``,
  renderSkills(),
  ``,
  `Rules:`,
  `- Vehicle is ArduPlane (fixed-wing). For takeoff, follow the takeoff skill exactly — there is no takeoff primitive on purpose.`,
  `- Pass numeric params as numbers, never strings: { value: 20 } not { value: "20" }. lat/lon are decimal degrees.`,
  `- If the request is impossible with these primitives, return text only with actions: [].`,
  `- Keep text short. No markdown.`,
]
  .filter((line) => line !== "")
  .join("\n");

const ACK_TIMEOUT_MS = 1500;

// MAVLink raw units → SI/human at the AI boundary.
// Raw values are kept in stores per project rule; convert only at the consumer.
function snapshot() {
  const t = useTelemStore();
  const e = useEventLogStore();
  const now = Date.now();
  return {
    armed: t.armed,
    mode: t.mode,
    position: {
      lat: t.lat * 1e-7,
      lon: t.lon * 1e-7,
      altMSL_m: t.altMSL * 1e-3,
      altAGL_m: t.altAGL * 1e-3,
    },
    heading_deg: t.heading * 1e-2,
    groundSpeed_mps: t.groundSpeed,
    battery: { voltage_v: t.voltage * 1e-3, remaining_pct: t.remaining },
    home: t.homeLat != null
      ? { lat: t.homeLat * 1e-7, lon: t.homeLon * 1e-7, alt_m: t.homeAlt * 1e-3 }
      : null,
    mission: { current: t.currentWaypoint, total: t.missionTotal },
    recentEvents: e
      .recentEvents(15_000)
      .filter((ev) => !ev.type.startsWith("AI_"))
      .map((ev) => ({ tAgo: now - ev.t, type: ev.type, data: ev.data })),
  };
}

function waitForAck(ackCommand, sentAt) {
  if (!ackCommand) return Promise.resolve(null); // primitive doesn't ACK
  const e = useEventLogStore();
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const events = e.recentEvents(ACK_TIMEOUT_MS + 500);
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.t < sentAt) break;
        if (ev.type === "COMMAND_ACK" && ev.data?.command === ackCommand) {
          return resolve(ev.data);
        }
      }
      if (Date.now() - start >= ACK_TIMEOUT_MS) return resolve(null);
      setTimeout(tick, 50);
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

export async function runCommander(goal) {
  const e = useEventLogStore();
  const plan = await callLLM(goal, snapshot());
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  e.addEvent("AI_PLAN", { goal, text: plan.text, actions });

  const results = [];
  for (const a of actions) {
    const sentAt = Date.now();
    const r = invokeAction(a.name, a.params ?? {});
    let ok = r.ok;
    let error = r.error;
    if (ok) {
      const ack = await waitForAck(ackCommandFor(a.name), sentAt);
      if (ack && ack.result !== "ACCEPTED") {
        ok = false;
        error = `${ack.command} ${ack.result}`;
      }
    }
    const result = { name: a.name, params: a.params, ok, error };
    results.push(result);
    e.addEvent("AI_ACTION", result);
    if (!ok) {
      e.addEvent("AI_ERROR", { name: a.name, error });
      break;
    }
  }

  return { text: plan.text || "", results };
}
