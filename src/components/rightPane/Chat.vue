<script setup>
import { ref, markRaw, nextTick, useTemplateRef, onMounted, onUnmounted } from "vue";
import { Wrench, Send } from "lucide-vue-next";
import { runCommander, onRun } from "../../ai/commander.js";

const input = ref("");
const messages = ref([]);
const scroller = useTemplateRef("scroller");
const byRunId = new Map();
const now = ref(Date.now());
let tickHandle;

function cronRemaining(firesAt) {
  return Math.max(0, Math.ceil((firesAt - now.value) / 1000));
}

let nextMsgId = 0;
function push(msg) {
  msg.id = nextMsgId++;
  if (msg.tools) for (const t of msg.tools) t._title = JSON.stringify({ args: t.args, result: t.result });
  if (msg.results) for (const r of msg.results) r._title = JSON.stringify(r.params);
  messages.value.push(markRaw(msg));
  nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight; });
}
push({ role: "system", text: "AI commander ready." });

function submit() {
  const goal = input.value.trim();
  if (!goal) return;
  push({ role: "user", text: goal });
  input.value = "";
  runCommander(goal);
}

function onKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
}

let unsub;
onMounted(() => {
  tickHandle = setInterval(() => { now.value = Date.now(); }, 500);
  unsub = onRun(({ id, source, text, tools, results, error }) => {
    const role = "assistant";

    if (error) { push({ role: "error", text: error, tools, results }); return; }

    const existing = byRunId.get(id);
    if (!existing) {
      // First emit — plan arrived, show immediately (results pending).
      const actionNames = results?.length ? results.map((r) => r.name).join(" ") : "";
      const msgText = source === "user" ? (text || "") : `${source} ${actionNames}`.trim();
      const msg = { role, text: msgText, tools, results };
      push(msg);
      byRunId.set(id, msg);
    } else {
      // Second emit — sequencer done, update results.
      if (results) for (const r of results) r._title = JSON.stringify(r.params);
      const idx = messages.value.indexOf(existing);
      if (idx !== -1) messages.value[idx] = markRaw({ ...existing, results });
      byRunId.delete(id);
    }
  });
});
onUnmounted(() => { unsub?.(); clearInterval(tickHandle); });
</script>

<template>
  <section class="chat">
    <div class="chat__header">ai commander</div>
    <div ref="scroller" class="chat__messages">
      <div v-for="m in messages" :key="m.id" class="msg" :data-role="m.role">
        <div v-if="m.text">{{ m.text }}</div>
        <ul v-if="m.tools?.length || m.results?.length" class="msg__steps">
          <li v-for="(t, j) in m.tools" :key="`t${j}`" class="step step--tool"
              :class="{ 'step--pending': t.tool === 'cron' && t.result?.firesAt > now, 'step--error': !!t.error }"
              :title="t._title">
            <component v-if="t.tool !== 'cron'" :is="Wrench" :size="12" />
            {{ t.tool === 'cron' && t.result?.firesAt ? `${cronRemaining(t.result.firesAt)}s cron` : t.tool }}
          </li>
          <li v-for="(r, j) in m.results" :key="`a${j}`" class="step step--action"
              :class="{ 'step--pending': r.ok == null, 'step--ok': r.ok === true, 'step--error': r.ok === false }"
              :title="r._title">
            <Send :size="12" /> {{ r.name }}
          </li>
        </ul>
      </div>
    </div>
    <textarea v-model="input" class="chat__input"
              placeholder="Tell the drone what to do. Enter to send."
              @keydown="onKeydown" />
  </section>
</template>

<style scoped>
.chat { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.chat__header { font-size: 13px; font-family: var(--font-sans); }
.chat__messages {
  flex: 1; overflow: auto; border: 1px solid var(--border); padding: 6px;
  font: 12px var(--font-mono, monospace); white-space: pre-wrap;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg[data-role="user"] {
  align-self: flex-end;
  width: fit-content;
  max-width: min(92%, 100%);
  text-align: right;
  font-weight: bold;
}
.msg[data-role="error"] { color: var(--color-action); }
.msg__steps { list-style: none; margin: 4px 0 0; padding: 0; }
.step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 6px;
  color: var(--text-secondary);
}
.step--ok { color: var(--color-nominal); }
.step--error { color: var(--color-action); }
.step--pending { color: var(--text-secondary); }
.chat__input { min-height: 80px; resize: none; border: 1px solid var(--border); padding: 6px; font: inherit; }
</style>
