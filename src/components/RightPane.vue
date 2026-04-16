<script setup>
import { ref } from "vue";

const input = ref("");
const loading = ref(false);
const messages = ref([{ role: "assistant", content: "AI endpoint ready." }]);

async function submit() {
    const text = input.value.trim();
    if (!text || loading.value) return;

    messages.value.push({ role: "user", content: text });
    input.value = "";
    loading.value = true;

    try {
        const response = await fetch("http://localhost:3001/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
        });

        const data = await response.json();
        messages.value.push({
            role: "assistant",
            content: data.reply ?? "No response.",
        });
    } catch (err) {
        messages.value.push({
            role: "assistant",
            content: `Request failed: ${err?.message || err}`,
        });
    } finally {
        loading.value = false;
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
        <div class="right-pane__header">ai & data</div>
        <div class="right-pane__messages">
            <div
                v-for="(message, index) in messages"
                :key="index"
                class="right-pane__message"
                :data-role="message.role"
            >
                <strong>{{ message.role }}:</strong> {{ message.content }}
            </div>
        </div>
        <textarea
            v-model="input"
            class="right-pane__input"
            placeholder="Type a command and press Enter"
            :disabled="loading"
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

.right-pane__message + .right-pane__message {
    margin-top: 8px;
}

.right-pane__input {
    min-height: 80px;
    resize: none;
    border: 1px solid var(--border);
    padding: 6px;
    font: inherit;
}
</style>
