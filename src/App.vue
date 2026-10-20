<script setup>
import { onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import LeftPane from './components/LeftPane.vue'
import NavBar from './components/NavBar.vue'
import PrimaryDisplay from './components/PrimaryDisplay.vue'
import RightPane from './components/RightPane.vue'
import BottomStrip from './components/BottomStrip.vue'
import { useLayoutStore } from './stores/layout.js'

const layout = useLayoutStore()

// ctrl + key toggles a pane
const PANE_KEYS = { ',': 'leftPaneOpen', '.': 'bottomStripOpen', '/': 'rightPaneOpen' }

function onKeydown(e) {
    const pane = e.ctrlKey && PANE_KEYS[e.key]
    if (pane) {
        e.preventDefault()
        layout[pane] = !layout[pane]
    }
    if (e.key === 'Escape') layout.navbarOpen = layout.editing = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
    <PrimaryDisplay />
    <!-- over the map; the empty middle cell lets pointer events through to it -->
    <div class="shell">
        <StatusBar />
        <LeftPane v-if="layout.leftPaneOpen" />
        <NavBar />
        <RightPane v-if="layout.rightPaneOpen" />
        <BottomStrip v-if="layout.bottomStripOpen" />
    </div>
</template>

<style scoped>
/* closed panes are not rendered, so their auto track is 0 */
.shell {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    grid-template-areas:
        'topbar topbar topbar'
        'left   .      right'
        'bottom bottom bottom';
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    pointer-events: none;
}

.shell > * {
    pointer-events: auto;
}
</style>
