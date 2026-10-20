<script setup>
import { useLayoutStore } from '../stores/layout.js'

const layout = useLayoutStore()

// items do nothing yet, for debugging only
const items = ['settings', 'frames', 'logs']
</script>

<template>
    <div v-if="layout.navbarOpen" class="backdrop" @click="layout.navbarOpen = false">
        <nav class="navbar" @click.stop>
            <button v-for="item in items" :key="item" class="item">{{ item }}</button>
        </nav>
    </div>
</template>

<style scoped>
.backdrop {
    position: fixed;
    inset: 0;
    top: var(--topbar-height);
    z-index: 99;
}

.navbar {
    width: var(--left-pane-width);
    display: flex;
    flex-direction: column;
    background: var(--color-navbar-bg);
}

.item {
    height: var(--list-row-height);
    padding: 0 var(--pane-padding);
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.item:hover {
    background: var(--color-select-hover);
}
</style>
