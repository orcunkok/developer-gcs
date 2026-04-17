<script setup>
import { ref } from "vue";
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
        const { text, results } = await runCommander(goal);
        messages.value.push({ role: "assistant", text, results });
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
                <ul v-if="m.results?.length" class="msg__actions">
                    <li v-for="(r, j) in m.results" :key="j" :data-ok="r.ok">
                        → {{ r.name }} {{ JSON.stringify(r.params ?? {}) }}
                        — {{ r.ok ? "ok" : `fail: ${r.error}` }}
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

.msg__actions {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
}
.msg__actions li[data-ok="false"] { color: #b00020; }

.right-pane__input {
    min-height: 80px;
    resize: none;
    border: 1px solid var(--border);
    padding: 6px;
    font: inherit;
}
</style>
