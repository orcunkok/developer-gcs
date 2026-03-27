<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'

const rightPaneOpen = ref(true)

function handleKeydown(e) {
  if (e.ctrlKey && e.key === '.') {
    e.preventDefault()
    rightPaneOpen.value = !rightPaneOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="app-shell" :class="{ 'right-collapsed': !rightPaneOpen }">
    <StatusBar />
    <LeftPane />
    <PrimaryDisplay />
    <RightPane v-if="rightPaneOpen" />
    <BottomStrip />
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
</style>
