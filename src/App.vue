<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import NavBar from './components/NavBar.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/rightPane/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'
import { useLayoutStore } from './stores/layout.js'

const ui = useLayoutStore()
const navbarOpen = ref(false)

function handleKeydown(e) {
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    ui.leftPaneOpen = !ui.leftPaneOpen
  }
  if (e.ctrlKey && e.key === '.') {
    e.preventDefault()
    ui.bottomStripOpen = !ui.bottomStripOpen
  }
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault()
    ui.rightPaneOpen = !ui.rightPaneOpen
  }
  if (e.key === 'Escape') {
    if (navbarOpen.value) navbarOpen.value = false
    if (ui.editing) ui.editing = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <PrimaryDisplay :layout="ui.layout" :cells="ui.cells" :editing="ui.editing" @assign-view="ui.assignView" />
  <div
    class="app-shell"
    :class="{ 'left-collapsed': !ui.leftPaneOpen, 'right-collapsed': !ui.rightPaneOpen, 'bottom-collapsed': !ui.bottomStripOpen }"
  >
    <StatusBar
      :navbarOpen="navbarOpen"
      :layout="ui.layout"
      :layoutEditing="ui.editing"
      @toggle-navbar="navbarOpen = !navbarOpen"
      @toggle-layout-edit="ui.editing = !ui.editing"
      @select-layout="ui.selectLayout"
    />
    <LeftPane v-if="ui.leftPaneOpen" />
    <NavBar :open="navbarOpen" @close="navbarOpen = false" />
    <RightPane v-if="ui.rightPaneOpen" />
    <BottomStrip v-if="ui.bottomStripOpen" />
  </div>
</template>

<style scoped>
/* Overlay above the map layer; empty middle cell passes pointer events to the map. */
.app-shell {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  grid-template-areas:
    "topbar topbar topbar"
    "left   .      right"
    "bottom bottom bottom";
  grid-template-columns: var(--left-pane-width) 1fr var(--right-pane-width);
  grid-template-rows: var(--topbar-height) 1fr var(--bottom-strip-height);
  overflow: hidden;
  pointer-events: none;
}

.app-shell > * {
  pointer-events: auto;
}

.app-shell.left-collapsed {
  grid-template-columns: 0 1fr var(--right-pane-width);
}

.app-shell.right-collapsed {
  grid-template-columns: var(--left-pane-width) 1fr 0;
}

.app-shell.left-collapsed.right-collapsed {
  grid-template-columns: 0 1fr 0;
}

.app-shell.bottom-collapsed {
  grid-template-rows: var(--topbar-height) 1fr 0;
}
</style>
