<template>
  <footer class="bottom-strip">
    <span class="bottom-strip__label">time river</span>
  </footer>
</template>

<style scoped>
.bottom-strip {
  grid-area: bottom;
  height: var(--bottom-strip-height);
  background: #fffacd;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-strip__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
