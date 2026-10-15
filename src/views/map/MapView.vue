<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import baseStyle from "./outdoors-style.json";
import { withTerrain } from "./terrain.js";

const container = ref(null);
let map = null;

// MapLibre's built-in right-drag rotate keeps spinning after release; its inertia can only be turned off
// with reduceMotion, which also kills pan inertia and all camera animations, so rotation is handled here.
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

// Browsers already deliver pointermove once per frame, so camera updates need no extra throttling.
// Left-drag pan and its grab/grabbing cursor are MapLibre's own.
function enableSlowRightDragRotate(el) {
    let startX, startY, startBearing, startPitch;

    const onMove = (e) =>
        map.jumpTo({
            bearing: startBearing + (e.clientX - startX) * BEARING_DEG_PER_PX,
            pitch: startPitch - (e.clientY - startY) * PITCH_DEG_PER_PX,
        });

    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 2) return;
        el.setPointerCapture(e.pointerId); // captured pointer takes its cursor from el
        startX = e.clientX;
        startY = e.clientY;
        startBearing = map.getBearing();
        startPitch = map.getPitch();
        el.style.cursor = "grabbing";
        el.addEventListener("pointermove", onMove);
    });
    // fires on release and on cancel
    el.addEventListener("lostpointercapture", () => {
        el.style.cursor = "";
        el.removeEventListener("pointermove", onMove);
    });
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
</style>
