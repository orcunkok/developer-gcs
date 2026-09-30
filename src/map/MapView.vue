<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as maptalks from "maptalks";

const container = ref(null);
const wrapper = ref(null);
const ctxMenu = ref({ show: false, x: 0, y: 0 });
let map = null;

// for debugging only — menu items are placeholders, they only close the menu
function closeMenu() {
    ctxMenu.value.show = false;
}

function onRightClick(e) {
    if (!map || !wrapper.value) return;
    const rect = wrapper.value.getBoundingClientRect();
    const menuW = 160,
        menuH = 100;
    const x = Math.min(e.clientX - rect.left, rect.width - menuW);
    const y = Math.min(e.clientY - rect.top, rect.height - menuH);
    ctxMenu.value = { show: true, x, y };
    requestAnimationFrame(() =>
        document.addEventListener("pointerdown", closeMenu, { once: true }),
    );
}

onMounted(() => {
    map = new maptalks.Map(container.value, {
        center: [149.16523, -35.363261], // for debugging only
        zoom: 16,
        pitch: 45,
        minZoom: 2,
        maxZoom: 19,
        zoomControl: false,
        attribution: false,
        baseLayer: new maptalks.TileLayer("osm", {
            urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        }),
    });
});

onUnmounted(() => {
    document.removeEventListener("pointerdown", closeMenu);
    if (map) {
        map.remove();
        map = null;
    }
});
</script>

<template>
    <div ref="wrapper" class="map-wrapper" @contextmenu.prevent="onRightClick">
        <div ref="container" class="map-container"></div>
        <div
            v-if="ctxMenu.show"
            class="ctx-menu"
            :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
            @pointerdown.stop
        >
            <button @click="closeMenu">Add Waypoint</button>
            <button @click="closeMenu">Drop Marker</button>
            <button @click="closeMenu">Measure Distance</button>
        </div>
    </div>
</template>

<style scoped>
.map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

.map-container {
    width: 100%;
    height: 100%;
    cursor: crosshair !important;
}

.map-container :deep(*) {
    cursor: crosshair !important;
}

.ctx-menu {
    position: absolute;
    z-index: 999;
    background: var(--bg, #fff);
    border: 1px solid var(--border, #ccc);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    min-width: 160px;
}

.ctx-menu button {
    all: unset;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    font-family: var(--font-mono, monospace);
}

.ctx-menu button:hover {
    background: var(--accent-bg, #f0f0f0);
}
</style>
