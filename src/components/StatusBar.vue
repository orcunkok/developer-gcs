<script setup>
import { Menu } from 'lucide-vue-next'

defineProps({
  navbarOpen: Boolean
})

defineEmits(['toggle-navbar'])
</script>

<template>
  <header class="status-bar">
    <button class="status-bar__menu-btn" @click="$emit('toggle-navbar')" :class="{ active: navbarOpen }">
      <Menu :size="16" />
    </button>
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
  position: relative;
}

.status-bar__menu-btn {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  color: #1a1a1a;
  border-radius: 4px;
  padding: 0;
}

.status-bar__menu-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.status-bar__menu-btn.active {
  background: rgba(0, 0, 0, 0.12);
}

.status-bar__label {
  color: #1a1a1a;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
