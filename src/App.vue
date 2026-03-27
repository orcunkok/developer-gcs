<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'

const rightPaneOpen = ref(true)
const bottomStripOpen = ref(true)

function handleKeydown(e) {
  if (e.ctrlKey && e.key === '.') {
    e.preventDefault()
    rightPaneOpen.value = !rightPaneOpen.value
  }
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    bottomStripOpen.value = !bottomStripOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="app-shell" :class="{ 'right-collapsed': !rightPaneOpen, 'bottom-collapsed': !bottomStripOpen }">
    <StatusBar />
    <LeftPane />
    <PrimaryDisplay />
    <RightPane v-if="rightPaneOpen" />
    <BottomStrip v-if="bottomStripOpen" />
  </div>
</template>

<style scoped>
.app-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-areas:
    "topbar  topbar   topbar"
    "left    primary  right"
    "bottom  bottom   bottom";
  grid-template-columns: var(--left-pane-width) 1fr var(--right-pane-width);
  grid-template-rows: var(--topbar-height) 1fr var(--bottom-strip-height);
  overflow: hidden;
}

.app-shell.right-collapsed {
  grid-template-areas:
    "topbar  topbar"
    "left    primary"
    "bottom  bottom";
  grid-template-columns: var(--left-pane-width) 1fr;
}

.app-shell.bottom-collapsed {
  grid-template-areas:
    "topbar  topbar   topbar"
    "left    primary  right";
  grid-template-rows: var(--topbar-height) 1fr;
}

.app-shell.right-collapsed.bottom-collapsed {
  grid-template-areas:
    "topbar  topbar"
    "left    primary";
  grid-template-columns: var(--left-pane-width) 1fr;
  grid-template-rows: var(--topbar-height) 1fr;
}
</style>
