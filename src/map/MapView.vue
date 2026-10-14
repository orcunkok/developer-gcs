<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import baseStyle from "./outdoors-style.json";
import { withTerrain } from "./terrain.js";

const container = ref(null);
let map = null;

// MapLibre's built-in right-drag rotate is fixed at 0.8°/px bearing and 0.5°/px pitch (too twitchy)
// and keeps spinning after release (inertia, not configurable), so rotation is handled here.
const BEARING_DEG_PER_PX = 0.25;
const PITCH_DEG_PER_PX = 0.15;

// MapLibre has no pitch expression, so street names are toggled from the pitch event
const STREET_NAMES_MAX_PITCH = 75;

function hideStreetNamesWhenTilted() {
    let hidden = false;
    const update = () => {
        const tilted = map.getPitch() > STREET_NAMES_MAX_PITCH;
        if (tilted === hidden || !map.isStyleLoaded()) return;
        hidden = tilted;
        map.setLayoutProperty("road-label", "visibility", tilted ? "none" : "visible");
    };
    map.on("pitch", update);
    map.once("load", update); // the initial pitch fires no pitch event
}

function enableSlowRightDragRotate(el) {
    let startX, startY, startBearing, startPitch; // pointer + camera at drag start
    let lastX, lastY; // latest pointer position, applied at most once per frame
    let dragging = false;
    let frame = 0;

    const apply = () => {
        frame = 0;
        if (!map || !dragging) return;
        map.jumpTo({
            bearing: startBearing + (lastX - startX) * BEARING_DEG_PER_PX,
            pitch: startPitch - (lastY - startY) * PITCH_DEG_PER_PX,
        });
    };
    const onMove = (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
        frame ||= requestAnimationFrame(apply);
    };
    const end = () => {
        if (frame) {
            cancelAnimationFrame(frame);
            apply();
        }
        dragging = false;
        el.removeEventListener("pointermove", onMove);
    };

    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 2) return;
        el.setPointerCapture(e.pointerId);
        startX = lastX = e.clientX;
        startY = lastY = e.clientY;
        startBearing = map.getBearing();
        startPitch = map.getPitch();
        dragging = true;
        el.addEventListener("pointermove", onMove);
    });
    el.addEventListener("pointerup", (e) => e.button === 2 && end());
    el.addEventListener("pointercancel", end);
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
        pixelRatio: Math.min(devicePixelRatio, 1.5), // HiDPI at 2x draws 4x the pixels
        validateStyle: false, // bundled, trusted style
        attributionControl: false,
        dragRotate: false,
    });
    enableSlowRightDragRotate(container.value);
    hideStreetNamesWhenTilted();
});

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <div ref="container" class="map-container" @contextmenu.prevent></div>
</template>

<style scoped>
.map-container {
    width: 100%;
    height: 100%;
}

.map-container :deep(.maplibregl-canvas-container) {
    cursor: crosshair !important;
}
</style>
