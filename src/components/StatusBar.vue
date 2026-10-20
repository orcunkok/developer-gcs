<script setup>
import { Menu, PanelsLeftBottom, Square, Columns2, Grid2x2 } from 'lucide-vue-next'
import { useLayoutStore } from '../stores/layout.js'
import { useTelemetryStore } from '../stores/useTelemetry.js'
import { useCommandsStore } from '../stores/useCommands.js'

const layout = useLayoutStore()
const telemetry = useTelemetryStore()
const commands = useCommandsStore()

// IMPORTANT: fix later. Sends the command to every vehicle one by one, for debugging only.
// It should be one swarm command, but the commands store has no "all vehicles" swarm yet,
// and putting everyone in one group would overwrite the swarm groups the user picked.
function all(name) {
    for (const vehicle of Object.values(telemetry.id)) commands[name](vehicle.id)
}

const grids = [
    { id: '1x1', icon: Square },
    { id: '1x2', icon: Columns2 },
    { id: '2x2', icon: Grid2x2 },
]
</script>

<template>
    <header class="status-bar">
        <button class="menu" :class="{ active: layout.navbarOpen }" @click="layout.navbarOpen = !layout.navbarOpen">
            <Menu :size="16" />
        </button>
        <!-- label for debugging only -->
        <span class="label">status bar</span>
        <button class="arm" @click="all('arm')">ARM</button>
        <button class="disarm" @click="all('disarm')">DISARM</button>
        <button class="edit" :class="{ active: layout.editing }" @click="layout.editing = !layout.editing">
            <PanelsLeftBottom :size="16" />
        </button>
        <div v-if="layout.editing" class="grids">
            <button v-for="g in grids" :key="g.id" class="grid" :class="{ active: g.id === layout.grid }" @click="layout.selectGrid(g.id)">
                <component :is="g.icon" :size="16" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.status-bar {
    grid-area: topbar;
    height: var(--topbar-height);
    background: var(--color-status-bar-bg);
    display: flex;
    position: relative;
}

button {
    border: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
}

.menu,
.edit,
.grid {
    width: var(--topbar-height);
    height: var(--topbar-height);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* equal-width ends keep the middle group centred */
.menu {
    margin-right: auto;
    background: var(--color-menu-bg);
}

.edit {
    margin-left: auto;
    background: var(--color-edit-bg);
}

.label {
    align-self: center;
    padding: 0 var(--pane-padding);
}

.arm,
.disarm {
    padding: 0 var(--pane-padding);
}

.arm {
    background: var(--color-arm-bg);
}

.disarm {
    background: var(--color-disarm-bg);
}

.grids {
    position: absolute;
    top: var(--topbar-height);
    right: 0;
    display: flex;
}

.grid {
    background: var(--color-grid-picker-bg);
}

.active {
    background: var(--color-select-active);
}
</style>
