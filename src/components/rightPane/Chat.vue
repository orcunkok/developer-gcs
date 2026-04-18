<script setup>
import { ref, markRaw, nextTick, useTemplateRef } from "vue";
import { Wrench, Send, Check, X } from "lucide-vue-next";
import { runCommander } from "../../ai/commander.js";

const input = ref("");
const busy = ref(false);
const messages = ref([]);
const scroller = useTemplateRef("scroller");

let nextId = 0;
function push(msg) {
  msg.id = nextId++;
  if (msg.tools) for (const t of msg.tools) t._title = JSON.stringify({ args: t.args, result: t.result });
  if (msg.results) for (const r of msg.results) r._title = JSON.stringify(r.params);
  messages.value.push(markRaw(msg));
  nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight; });
}
push({ role: "system", text: "AI commander ready." });

async function submit() {
  const goal = input.value.trim();
  if (!goal || busy.value) return;
  push({ role: "user", text: goal });
  input.value = "";
  busy.value = true;
  try {
    const { text, tools, results } = await runCommander(goal);
    push({ role: "assistant", text, tools, results });
  } catch (err) {
    push({ role: "error", text: err?.message || String(err) });
  } finally {
    busy.value = false;
  }
}

function onKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
}
</script>

<template>
  <section class="chat">
    <div class="chat__header">ai commander</div>
    <div ref="scroller" class="chat__messages">
      <div v-for="m in messages" :key="m.id" class="msg" :data-role="m.role">
        <div v-if="m.text">{{ m.text }}</div>
        <ul v-if="m.tools?.length || m.results?.length" class="msg__steps">
          <li v-for="(t, j) in m.tools" :key="`t${j}`" class="step step--tool" :title="t._title">
            <Wrench :size="12" /> {{ t.tool }}
          </li>
          <li v-for="(r, j) in m.results" :key="`a${j}`" class="step step--action"
              :data-ok="r.ok" :title="r._title">
            <Send :size="12" /> {{ r.name }}
            <component :is="r.ok ? Check : X" :size="12" />
          </li>
        </ul>
      </div>
      <div v-if="busy" class="msg" data-role="thinking">thinking…</div>
    </div>
    <textarea v-model="input" class="chat__input" :disabled="busy"
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
}
.msg + .msg { margin-top: 8px; }
.msg[data-role="user"] { font-weight: bold; }
.msg[data-role="error"] { color: #b00020; }
.msg[data-role="thinking"] { opacity: 0.6; font-style: italic; }
.msg__steps { list-style: none; margin: 4px 0 0; padding: 0; }
.step { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; }
.step--tool { color: #5a3a99; }
.step--action[data-ok="true"] { color: #1f6f3a; }
.step--action[data-ok="false"] { color: #b00020; }
.chat__input { min-height: 80px; resize: none; border: 1px solid var(--border); padding: 6px; font: inherit; }
</style>
