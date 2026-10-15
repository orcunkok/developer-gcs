<script setup>
defineProps({
  open: Boolean
})

defineEmits(['close'])
</script>

<template>
    <div v-if="open" class="navbar-backdrop" @click="$emit('close')">
      <nav class="navbar" @click.stop>
        <span class="navbar__label">navbar</span>
      </nav>
    </div>
</template>

<style scoped>
.navbar-backdrop {
  position: fixed;
  inset: 0;
  top: var(--topbar-height);
  z-index: 99;
}

.navbar {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--left-pane-width);
  height: 100%;
  background: var(--color-navbar-bg);
  border-right: var(--border-width) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.navbar__label {
  color: var(--text-inverse);
  font-family: var(--font-sans);
  font-size: var(--font-size-label);
  letter-spacing: var(--letter-spacing-label);
}

</style>
