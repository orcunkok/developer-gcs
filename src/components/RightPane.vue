<script setup>
import { ref } from "vue";
import { Wrench, Send, Check, X } from "lucide-vue-next";
import { runCommander } from "../ai/commander.js";

const input = ref("");
const busy = ref(false);
const messages = ref([{ role: "system", text: "AI commander ready." }]);

async function submit() {
    const goal = input.value.trim();
    if (!goal || busy.value) return;

    messages.value.push({ role: "user", text: goal });
    input.value = "";
    busy.value = true;

    try {
        const { text, tools, results } = await runCommander(goal);
        messages.value.push({ role: "assistant", text, tools, results });
    } catch (err) {
        messages.value.push({ role: "error", text: err?.message || String(err) });
    } finally {
        busy.value = false;
    }
}

function onKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
    }
}
</script>

<template>
    <aside class="right-pane">
        <div class="right-pane__header">ai commander</div>
        <div class="right-pane__messages">
            <div
                v-for="(m, i) in messages"
                :key="i"
                class="msg"
                :data-role="m.role"
            >
                <div v-if="m.text">{{ m.text }}</div>
                <ul v-if="m.tools?.length || m.results?.length" class="msg__steps">
                    <li v-for="(t, j) in m.tools" :key="`t${j}`" class="step step--tool" :title="JSON.stringify({ args: t.args, result: t.result })">
                        <Wrench :size="12" /> {{ t.tool }}
                    </li>
                    <li v-for="(r, j) in m.results" :key="`a${j}`" class="step step--action" :data-ok="r.ok" :title="JSON.stringify(r.params)">
                        <Send :size="12" /> {{ r.name }}
                        <Check v-if="r.ok" :size="12" />
                        <X v-else :size="12" />
                    </li>
                </ul>
            </div>
            <div v-if="busy" class="msg" data-role="thinking">thinking…</div>
        </div>
        <textarea
            v-model="input"
            class="right-pane__input"
            placeholder="Tell the drone what to do. Enter to send."
            :disabled="busy"
            @keydown="onKeydown"
        />
    </aside>
</template>

<style scoped>
.right-pane {
    grid-area: right;
    width: var(--right-pane-width);
    border-left: 1px solid var(--border);
    background: #b0e0e6;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 8px;
    gap: 8px;
}

.right-pane__header {
    font-size: 13px;
    font-family: var(--font-sans);
}

.right-pane__messages {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--border);
    padding: 6px;
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    white-space: pre-wrap;
}

.msg + .msg { margin-top: 8px; }
.msg[data-role="user"] { font-weight: bold; }
.msg[data-role="error"] { color: #b00020; }
.msg[data-role="thinking"] { opacity: 0.6; font-style: italic; }

.msg__steps {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
}
.step {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 6px;
}
.step--tool { color: #5a3a99; }
.step--action[data-ok="true"] { color: #1f6f3a; }
.step--action[data-ok="false"] { color: #b00020; }

.right-pane__input {
    min-height: 80px;
    resize: none;
    border: 1px solid var(--border);
    padding: 6px;
    font: inherit;
}
</style>
