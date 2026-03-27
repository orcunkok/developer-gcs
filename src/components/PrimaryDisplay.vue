<template>
  <main class="primary-display">
    <span class="primary-display__label">primary display</span>
  </main>
</template>

<style scoped>
.primary-display {
  grid-area: primary;
  background: #ffdab9;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.primary-display__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
