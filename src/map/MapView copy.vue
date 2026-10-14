<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import baseStyle from "./outdoors-style.json";
import { withTerrain } from "./terrain.js";

const container = ref(null);
const wrapper = ref(null);
const ctxMenu = ref({ show: false, x: 0, y: 0 });
let map = null;

// MapLibre's built-in right-drag rotate is fixed at 0.8°/px bearing and 0.5°/px pitch (too twitchy),
// so rotation is handled here with adjustable sensitivity.
const BEARING_DEG_PER_PX = 0.25;
const PITCH_DEG_PER_PX = 0.15;

// MapLibre has no pitch expression, so street names are toggled from the pitch event
const STREET_NAMES_MAX_PITCH = 75;

function hideStreetNamesWhenTilted() {
    let hidden = false;
    map.on("pitch", () => {
        const tilted = map.getPitch() > STREET_NAMES_MAX_PITCH;
        if (tilted === hidden || !map.isStyleLoaded()) return;
        hidden = tilted;
        map.setLayoutProperty("road-label", "visibility", tilted ? "none" : "visible");
    });
}

function enableSlowRightDragRotate(el) {
    let start = null; // pointer + camera at drag start
    let last = null; // latest pointer position, applied at most once per frame
    let frame = 0;

    const apply = () => {
        frame = 0;
        if (!map || !start) return;
        map.jumpTo({
            bearing: start.bearing + (last.x - start.x) * BEARING_DEG_PER_PX,
            pitch: start.pitch - (last.y - start.y) * PITCH_DEG_PER_PX,
        });
    };
    const onMove = (e) => {
        last = { x: e.clientX, y: e.clientY };
        frame ||= requestAnimationFrame(apply);
    };
    const end = () => {
        if (frame) {
            cancelAnimationFrame(frame);
            apply();
        }
        start = null;
        el.removeEventListener("pointermove", onMove);
    };

    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 2) return;
        el.setPointerCapture(e.pointerId);
        start = { x: e.clientX, y: e.clientY, bearing: map.getBearing(), pitch: map.getPitch() };
        last = start;
        el.addEventListener("pointermove", onMove);
    });
    el.addEventListener("pointerup", (e) => e.button === 2 && end());
    el.addEventListener("pointercancel", end);
}

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
    map = new MapLibreMap({
        container: container.value,
        style: withTerrain(baseStyle),
        center: [-121.6815865, 37.1730398], // SCCMAS (ArduPilot locations.txt), for debugging only
        zoom: 15,
        pitch: 75,
        bearing: 270,
        maxPitch: 89, // 5° above the horizon, street-view style
        minZoom: 2,
        maxZoom: 19,
        attributionControl: false,
        dragRotate: false,
    });
    enableSlowRightDragRotate(container.value);
    hideStreetNamesWhenTilted();
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
    <!-- right-click menu disabled for now: re-add @contextmenu.prevent="onRightClick" here -->
    <div ref="wrapper" class="map-wrapper" @contextmenu.prevent>
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

.map-container :deep(.maplibregl-canvas-container),
.map-container :deep(.maplibregl-canvas) {
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
