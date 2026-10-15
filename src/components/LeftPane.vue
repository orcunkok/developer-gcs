<template>
  <aside class="left-pane">
    <span>left pane</span>
  </aside>
</template>

<style scoped>
.left-pane {
  grid-area: left;
  width: var(--left-pane-width);
  background: var(--color-left-pane-bg);
  border-right: var(--border-width) solid var(--border);
  overflow: hidden;
  padding: var(--pane-padding);
}
</style>
