<script setup>
import { useTelemStore } from "../stores/telemStore.js";
const t = useTelemStore();
</script>

<template>
    <aside class="left-pane">
        <div class="telem-list">
            <div>Roll {{ t.roll.toFixed(1) }}°</div>
            <div>Pitch {{ t.pitch.toFixed(1) }}°</div>
            <div>Hdg {{ (t.heading / 100).toFixed(0) }}°</div>
            <div>Alt {{ t.altMSL.toFixed(1) }} m MSL</div>
            <div>AGL {{ t.altAGL.toFixed(1) }} m</div>
            <div>TAS {{ t.airspeed.toFixed(1) }} m/s</div>
            <div>Batt {{ t.remaining.toFixed(0) }}%</div>
            <div>Link {{ t.connState }}</div>
        </div>
    </aside>
</template>

<style scoped>
.left-pane {
    grid-area: left;
    width: var(--left-pane-width);
    background: #f5fffa;
    border-right: 1px solid var(--border);
    overflow: hidden;
    padding: 8px;
}

.telem-list {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: #1a1a1a;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
</style>
