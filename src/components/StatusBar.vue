<template>
  <header class="status-bar">
    <span class="status-bar__label">status bar</span>
  </header>
</template>

<style scoped>
.status-bar {
  grid-area: topbar;
  height: var(--topbar-height);
  background: #e6e6fa;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-bar__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
