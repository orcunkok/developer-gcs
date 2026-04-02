<script setup>
import MapView from '../map/MapView.vue'
</script>

<template>
  <main class="primary-display">
    <MapView />
  </main>
</template>

<style scoped>
.primary-display {
  grid-area: primary;
  background: var(--bg);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
