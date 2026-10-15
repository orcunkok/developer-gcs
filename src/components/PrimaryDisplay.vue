<script setup>
import { defineAsyncComponent } from 'vue'
import MfdCross from './MfdCross.vue'
import CameraView from '../views/camera/CameraView.vue'
import TelemetryView from '../views/telemetry/TelemetryView.vue'

// map code (maplibre, ~1 MB) and three.js (~0.5 MB) load in their own chunks so the layout paints first
const MapView = defineAsyncComponent(() => import('../views/map/MapView.vue'))
const Scene3DView = defineAsyncComponent(() => import('../views/scene3d/Scene3DView.vue'))

defineProps({
  layout: String,
  cells: Array,
  editing: Boolean
})

defineEmits(['assign-view'])

const views = { map: MapView, camera: CameraView, telemetry: TelemetryView, scene3d: Scene3DView }
const viewIds = Object.keys(views)
</script>

<template>
  <!-- cells fill the grid in order; keyed by view id so moving a view to another cell keeps its instance (map/three.js are never remounted) -->
  <main class="primary-display" :class="`layout-${layout}`">
    <div v-for="(id, i) in cells" :key="id ?? `empty-${i}`" class="primary-display__cell">
      <component :is="id ? views[id] : MfdCross" />
      <div v-if="editing" class="primary-display__overlay" @contextmenu.prevent @wheel.prevent>
        <div class="primary-display__picker">
          <button
            v-for="vid in viewIds"
            :key="vid"
            class="primary-display__box"
            :class="{ active: vid === id }"
            @click="$emit('assign-view', i, vid)"
          >
            {{ vid }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.primary-display {
  position: absolute;
  top: var(--topbar-height);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  background: var(--bg);
  overflow: hidden;
  display: grid;
}

.layout-1x1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.layout-1x2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

.layout-2x2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.primary-display__cell {
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.primary-display__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-display__picker {
  display: grid;
  grid-template-columns: repeat(2, var(--picker-box-size));
}

.primary-display__box {
  width: var(--picker-box-size);
  height: var(--picker-box-size);
  margin: 0;
  padding: 0;
  border: none;
  background: var(--color-picker-bg);
  color: var(--text);
  font-family: var(--font-mono, monospace);
  cursor: pointer;
}

.primary-display__box.active {
  background: var(--color-select-active);
}
</style>
