<template>
  <footer class="bottom-strip">
    <span class="bottom-strip__label">time river</span>
  </footer>
</template>

<style scoped>
.bottom-strip {
  grid-area: bottom;
  height: var(--bottom-strip-height);
  background: var(--color-bottom-strip-bg);
  border-top: var(--border-width) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-strip__label {
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--font-size-label);
  letter-spacing: var(--letter-spacing-label);
}
</style>
