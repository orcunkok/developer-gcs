<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import NavBar from './components/NavBar.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/rightPane/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'

const leftPaneOpen = ref(false)
const rightPaneOpen = ref(false)
const bottomStripOpen = ref(false)
const navbarOpen = ref(false)

const LAYOUT_CELLS = { '1x1': 1, '1x2': 2, '2x2': 4 }
const layout = ref('1x1')
const cells = ref(['map'])
const layoutEditing = ref(false)

function selectLayout(l) {
  if (l === layout.value && layoutEditing.value) {
    layoutEditing.value = false
    return
  }
  layout.value = l
  const n = LAYOUT_CELLS[l]
  const next = cells.value.slice(0, n)
  while (next.length < n) next.push(null)
  cells.value = next
}

function assignView(i, id) {
  const next = cells.value.slice()
  const j = next.indexOf(id)
  if (j !== -1 && j !== i) next[j] = next[i]
  next[i] = id
  cells.value = next
}

function handleKeydown(e) {
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    leftPaneOpen.value = !leftPaneOpen.value
  }
  if (e.ctrlKey && e.key === '.') {
    e.preventDefault()
    bottomStripOpen.value = !bottomStripOpen.value
  }
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault()
    rightPaneOpen.value = !rightPaneOpen.value
  }
  if (e.key === 'Escape') {
    if (navbarOpen.value) navbarOpen.value = false
    if (layoutEditing.value) layoutEditing.value = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <PrimaryDisplay :layout="layout" :cells="cells" :editing="layoutEditing" @assign-view="assignView" />
  <div
    class="app-shell"
    :class="{ 'left-collapsed': !leftPaneOpen, 'right-collapsed': !rightPaneOpen, 'bottom-collapsed': !bottomStripOpen }"
  >
    <StatusBar
      :navbarOpen="navbarOpen"
      :layout="layout"
      :layoutEditing="layoutEditing"
      @toggle-navbar="navbarOpen = !navbarOpen"
      @toggle-layout-edit="layoutEditing = !layoutEditing"
      @select-layout="selectLayout"
    />
    <LeftPane v-if="leftPaneOpen" />
    <NavBar :open="navbarOpen" @close="navbarOpen = false" />
    <RightPane v-if="rightPaneOpen" />
    <BottomStrip v-if="bottomStripOpen" />
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
