<template>
  <aside class="left-pane">
    <span class="left-pane__label">instrument strip</span>
  </aside>
</template>

<style scoped>
.left-pane {
  grid-area: left;
  width: var(--left-pane-width);
  background: #f5fffa;
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.left-pane__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
