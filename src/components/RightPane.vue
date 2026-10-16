<template>
  <aside class="right-pane">
    <span>right pane</span>
  </aside>
</template>

<style scoped>
.right-pane {
  grid-area: right;
  width: var(--right-pane-width);
  border-left: var(--border-width) solid var(--border);
  background: var(--color-right-pane-bg);
  overflow: hidden;
  padding: var(--pane-padding);
}
</style>
