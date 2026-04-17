/**
 * Skills — named, reusable patterns rendered into the system prompt.
 *
 * Per docs/TODO-mvp.md Phase 4: only formalize a skill once you observe
 * the LLM repeatedly botching a pattern. Each entry below becomes a hint
 * the LLM can follow — no runtime code.
 *
 * Shape:
 *   { name: "skill_name",
 *     purpose: "what it accomplishes",
 *     steps: ["step 1", "step 2", ...] }   // optional
 */
export const SKILLS = [
  {
    name: "takeoff",
    purpose: "Get an ArduPlane airborne.",
    steps: [
      "There is no takeoff primitive — NAV_TAKEOFF is rejected on plane without a loaded mission.",
      "Step 1: setMode { mode: 'TAKEOFF' }.",
      "Step 2: arm — once armed in TAKEOFF mode, the autopilot performs the climbout automatically using the configured TKOFF_ALT parameter.",
      "Confirm by checking that altAGL_m is rising on subsequent state reads. After climbout, setMode GUIDED to enable goto.",
    ],
  },
];

export function renderSkills() {
  if (!SKILLS.length) return "";
  const lines = SKILLS.map((s) => {
    const steps = s.steps?.length ? "\n    " + s.steps.join("\n    ") : "";
    return `- ${s.name} — ${s.purpose}${steps}`;
  });
  return "Skills (named recipes you may follow):\n" + lines.join("\n");
}
