<script setup>
defineProps({
  name: { type: String, default: "" },
});
</script>

<template>
  <div class="mfd-cross">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100" y2="100" />
      <line x1="100" y1="0" x2="0" y2="100" />
    </svg>
    <span v-if="name" class="mfd-name">{{ name }}</span>
  </div>
</template>

<style scoped>
.mfd-cross {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--color-mfd-cross-bg);
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
line {
  stroke: var(--color-mfd-cross);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.mfd-name {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-mfd-cross-bg);
  font-family: var(--font-mono);
  font-size: var(--font-size-view-label);
  font-weight: bold;
  color: var(--color-mfd-cross);
  text-transform: uppercase;
}
</style>
