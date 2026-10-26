<script setup>
import { defineAsyncComponent } from 'vue'
import { useLayoutStore } from '../stores/layout.js'
import CameraView from '../views/camera/CameraView.vue'
import TelemetryView from '../views/telemetry/TelemetryView.vue'
import DroneList from './DroneList.vue'
import PlaceholderView from '../views/PlaceholderView.vue'

// map code (maplibre, ~1 MB) and three.js (~0.5 MB) load in their own chunks so the layout paints first
const MapView = defineAsyncComponent(() => import('../views/map/MapView.vue'))
const Scene3DView = defineAsyncComponent(() => import('../views/scene3d/Scene3DView.vue'))

const layout = useLayoutStore()

const views = { map: MapView, camera: CameraView, telemetry: TelemetryView, scene3d: Scene3DView }
const viewIds = Object.keys(views)
</script>

<template>
    <!-- cells fill the grid in order; keyed by view id so moving a view to another cell keeps its instance (map/three.js are never remounted) -->
    <main class="primary-display" :class="`grid-${layout.grid}`">
        <div v-for="(id, i) in layout.cells" :key="id ?? `empty-${i}`" class="cell">
            <component :is="id ? views[id] : PlaceholderView" />
            <div v-if="layout.editing" class="overlay" @contextmenu.prevent @wheel.prevent>
                <div class="picker">
                    <button
                        v-for="vid in viewIds"
                        :key="vid"
                        class="item"
                        :class="{ active: vid === id }"
                        @click="layout.assignView(i, vid)"
                    >
                        {{ vid }}
                    </button>
                </div>
            </div>
        </div>
        <DroneList />
    </main>
</template>

<style scoped>
.primary-display {
    position: absolute;
    inset: var(--topbar-height) 0 0 0;
    z-index: 0;
    background: var(--bg);
    overflow: hidden;
    display: grid;
    grid-template: 1fr / 1fr;
}

.grid-1x2 {
    grid-template-columns: 1fr 1fr;
}

.grid-2x2 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
}

.cell {
    position: relative;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
}

.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.picker {
    width: var(--list-width);
    display: flex;
    flex-direction: column;
    background: var(--color-view-picker-bg);
}

.item {
    height: var(--list-row-height);
    padding: 0 var(--pane-padding);
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.item:hover {
    background: var(--color-select-hover);
}

.item.active {
    background: var(--color-select-active);
}
</style>
