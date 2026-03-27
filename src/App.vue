<script setup>
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'
</script>

<template>
  <div class="app-shell">
    <StatusBar />
    <LeftPane />
    <PrimaryDisplay />
    <RightPane />
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
</style>
