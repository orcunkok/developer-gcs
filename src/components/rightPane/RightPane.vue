<template>
  <aside class="right-pane">
    <span>right pane</span>
  </aside>
</template>

<style scoped>
.right-pane {
  grid-area: right;
  width: var(--right-pane-width);
  border-left: 1px solid var(--border);
  background: #b0e0e6;
  overflow: hidden;
  padding: 8px;
}
</style>
