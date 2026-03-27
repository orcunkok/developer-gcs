<script setup>
import { Menu } from 'lucide-vue-next'

defineProps({
  open: Boolean
})

defineEmits(['close'])
</script>

<template>
  <Transition name="navbar">
    <div v-if="open" class="navbar-backdrop" @click="$emit('close')">
      <nav class="navbar" @click.stop>
        <span class="navbar__label">navbar</span>
      </nav>
    </div>
  </Transition>
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
  background: #2a2a3a;
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.navbar__label {
  color: #f0f0f0;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.navbar-enter-active,
.navbar-leave-active {
  transition: opacity 0.15s ease;
}

.navbar-enter-from,
.navbar-leave-to {
  opacity: 0;
}
</style>
