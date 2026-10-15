<script setup>
import { Menu, PanelsLeftBottom, Square, Columns2, Grid2x2 } from 'lucide-vue-next'

defineProps({
  navbarOpen: Boolean,
  layout: String,
  layoutEditing: Boolean
})

defineEmits(['toggle-navbar', 'toggle-layout-edit', 'select-layout'])

const layouts = [
  { id: '1x1', icon: Square },
  { id: '1x2', icon: Columns2 },
  { id: '2x2', icon: Grid2x2 }
]
</script>

<template>
  <header class="status-bar">
    <button class="status-bar__menu-btn" @click="$emit('toggle-navbar')" :class="{ active: navbarOpen }">
      <Menu :size="16" />
    </button>
    <span class="status-bar__label">status bar</span>
    <button class="status-bar__menu-btn status-bar__layout-btn" @click="$emit('toggle-layout-edit')" :class="{ active: layoutEditing }">
      <PanelsLeftBottom :size="16" />
    </button>
    <div v-if="layoutEditing" class="status-bar__layout-bar">
      <button
        v-for="l in layouts"
        :key="l.id"
        class="status-bar__layout-opt"
        :class="{ active: l.id === layout }"
        @click="$emit('select-layout', l.id)"
      >
        <component :is="l.icon" :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.status-bar {
  grid-area: topbar;
  height: var(--topbar-height);
  background: var(--color-status-bar-bg);
  border-bottom: var(--border-width) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.status-bar__menu-btn {
  position: absolute;
  left: var(--icon-btn-inset);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  border-radius: var(--icon-btn-radius);
  padding: 0;
}

.status-bar__menu-btn:hover {
  background: var(--color-select-hover);
}

.status-bar__menu-btn.active {
  background: var(--color-select-active);
}

.status-bar__layout-btn {
  left: auto;
  right: var(--icon-btn-inset);
}

.status-bar__layout-bar {
  position: absolute;
  top: var(--topbar-height);
  right: 0;
  display: flex;
}

.status-bar__layout-opt {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  background: var(--color-picker-bg);
  color: var(--text);
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
}

.status-bar__layout-opt.active {
  background: var(--color-select-active);
}

.status-bar__label {
  font-family: var(--font-mono);
  font-size: var(--font-size-label-sm);
  color: var(--text);
}
</style>
