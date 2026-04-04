<script setup>
import { ref, watch } from "vue";
import { Trash2 } from "lucide-vue-next";
import { action } from "../actions.js";
import { useTelemStore } from "../stores/telemStore.js";
import { useMissionStore } from "../stores/missionStore.js";
const t = useTelemStore();
const mission = useMissionStore();

const PLANE_MODES = [
  "MANUAL",
  "CIRCLE",
  "STABILIZE",
  "TRAINING",
  "ACRO",
  "FBWA",
  "FBWB",
  "CRUISE",
  "AUTOTUNE",
  "AUTO",
  "RTL",
  "LOITER",
  "TAKEOFF",
  "AVOID_ADSB",
  "GUIDED",
  "THERMAL",
];

const selectedMode = ref("");

watch(
  () => t.mode,
  (mode) => {
    selectedMode.value = PLANE_MODES.includes(mode) ? mode : "";
  },
  { immediate: true },
);

function setSelectedMode() {
  if (!selectedMode.value) return;
  action.setMode({ mode: selectedMode.value });
}

function loadWaypoints() {
  action.uploadMission({ items: mission.items });
}

function clearMapActions() {
  action.clearMapActions();
}
</script>

<template>
    <aside class="left-pane">
        <div>
            <label for="mode-select">Mode</label>
            <select id="mode-select" v-model="selectedMode" @change="setSelectedMode">
                <option value="" disabled>Select mode</option>
                <option v-for="modeName in PLANE_MODES" :key="modeName" :value="modeName">
                    {{ modeName }}
                </option>
            </select>
        </div>
        <div class="telem-list">
            <div>Roll {{ t.roll.toFixed(1) }}°</div>
            <div>Pitch {{ t.pitch.toFixed(1) }}°</div>
            <div>Hdg {{ (t.heading / 100).toFixed(0) }}°</div>
            <div>Alt {{ (t.altMSL / 1000).toFixed(1) }} m MSL</div>
            <div>AGL {{ (t.altAGL / 1000).toFixed(1) }} m</div>
            <div>TAS {{ t.airspeed.toFixed(1) }} m/s</div>
        </div>
        <div class="map-actions-buttons">
            <button @click="loadWaypoints">Load Waypoints</button>
            <button @click="clearMapActions" aria-label="Clear map actions">
                <Trash2 :size="16" />
            </button>
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
    display: flex;
    flex-direction: column;
}

.telem-list {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: #1a1a1a;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.map-actions-buttons {
    margin-top: auto;
}
</style>
