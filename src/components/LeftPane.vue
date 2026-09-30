<template>
  <aside class="left-pane">
    <span>left pane</span>
  </aside>
</template>

<style scoped>
.left-pane {
  grid-area: left;
  width: var(--left-pane-width);
  background: #f5fffa;
  border-right: 1px solid var(--border);
  overflow: hidden;
  padding: 8px;
}
</style>
