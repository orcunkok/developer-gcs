<script setup>
import { defineAsyncComponent } from 'vue'

// map code (maplibre, ~1 MB) loads in its own chunk so the layout paints first
const MapView = defineAsyncComponent(() => import('../map/MapView.vue'))
</script>

<template>
  <main class="primary-display">
    <MapView />
  </main>
</template>

<style scoped>
.primary-display {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--bg);
  overflow: hidden;
}
</style>
