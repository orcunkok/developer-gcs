<template>
  <aside class="right-pane">
    <span class="right-pane__label">ai & data</span>
  </aside>
</template>

<style scoped>
.right-pane {
  grid-area: right;
  width: var(--right-pane-width);
  background: #b0e0e6;
  border-left: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.right-pane__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
