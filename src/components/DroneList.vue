<script setup>
import { computed } from 'vue'
import { TrendingUp, RotateCw, Battery, Gauge } from 'lucide-vue-next'
import { useTelemetryStore } from '../stores/useTelemetry.js'

const telemetry = useTelemetryStore()
const vehicles = computed(() => Object.values(telemetry.id))

const DEGREES = 180 / Math.PI
const NO_DATA = '--'

// the four numbers shown on each box, as icon, name (tooltip) and text; NO_DATA until the vehicle sends it
function readouts(v) {
    const remaining = v.battery?.remaining
    return [
        [TrendingUp, 'Pitch', `${Math.round(v.attitude.pitch * DEGREES)}°`],
        [RotateCw, 'Roll', `${Math.round(v.attitude.roll * DEGREES)}°`],
        [Battery, 'Battery', remaining == null ? NO_DATA : `${Math.round(remaining)}%`],
        [Gauge, 'Ground speed (m/s)', v.velocity.groundspeed.toFixed(1)],
    ]
}
</script>

<template>
    <!-- the list ignores the pointer, so the map stays draggable between boxes; scrolling works over the boxes -->
    <div v-if="vehicles.length" class="drone-list" @contextmenu.prevent>
        <button v-for="vehicle in vehicles" :key="vehicle.id" class="drone">
            <span class="name">{{ vehicle.name }}</span>
            <span class="data">
                <span v-for="[icon, label, text] in readouts(vehicle)" :key="label" class="readout" :title="label">
                    <component :is="icon" />{{ text }}
                </span>
            </span>
        </button>
    </div>
</template>

<style scoped>
/* two boxes per row; sizes and gaps scale with the screen; the same gap surrounds the list and sits between boxes */
.drone-list {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    padding: var(--drone-gap);
    display: grid;
    grid-template-columns: repeat(2, var(--drone-width));
    grid-auto-rows: var(--drone-height);
    align-content: start;
    gap: var(--drone-gap);
    overflow-y: auto;
    scrollbar-width: none;
    pointer-events: none;
}

.drone {
    padding: var(--drone-padding);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border: none;
    border-radius: var(--icon-btn-radius);
    background: var(--glass-fill);
    box-shadow: 0 2px 8px var(--glass-shadow);
    color: var(--glass-text);
    font-family: var(--font-mono);
    font-size: var(--font-size-label-sm);
    font-weight: bold;
    cursor: pointer;
    pointer-events: auto;
}

.name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.data {
    margin-top: auto;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--drone-readout-gap);
    color: var(--glass-text-dim);
    font-size: var(--drone-font-size);
    font-weight: normal;
    text-align: left;
}

.readout {
    display: flex;
    align-items: center;
    gap: var(--drone-readout-gap);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
}

.readout svg {
    flex: none;
    width: var(--drone-icon-size);
    height: var(--drone-icon-size);
}
</style>
