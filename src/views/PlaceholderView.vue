<script setup>
// MFD-style "no signal" X: empty cells (no name) and placeholder views (with name)
defineProps({ name: String });
</script>

<template>
  <div class="placeholder-view">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100" y2="100" />
      <line x1="100" y1="0" x2="0" y2="100" />
    </svg>
    <span v-if="name" class="placeholder-view__name">{{ name }}</span>
  </div>
</template>

<style scoped>
.placeholder-view {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--color-placeholder-bg);
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
line {
  stroke: var(--color-placeholder-line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.placeholder-view__name {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-placeholder-bg);
  font-family: var(--font-mono);
  font-size: var(--font-size-view-label);
  font-weight: bold;
  color: var(--color-placeholder-line);
  text-transform: uppercase;
}
</style>
