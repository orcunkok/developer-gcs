<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Map as MapLibreMap } from "maplibre-gl";
import { Navigation2 } from "lucide-vue-next";
import "maplibre-gl/dist/maplibre-gl.css";
import baseStyle from "./outdoors-style.json";
import { withTerrain, TERRAIN } from "./terrain.js";

const container = ref(null);
let map = null;

const MAX_PITCH = 89; // 5° above the horizon, street-view style
const PITCH_3D = 60; // tilt when switching to 3D
const SWITCH_MS = 1000;
const is3d = ref(true);

// 2D is a top view that keeps the bearing: max pitch 0 blocks tilt from every input and the 3D mesh is off
function toggleView() {
    is3d.value = !is3d.value;
    if (is3d.value) {
        map.setMaxPitch(MAX_PITCH).setTerrain(TERRAIN);
        map.easeTo({ pitch: PITCH_3D, duration: SWITCH_MS });
    } else {
        map.easeTo({ pitch: 0, duration: SWITCH_MS });
        // lock once flat; an interrupted ease also fires moveend, so skip if switched back to 3D meanwhile
        map.once("moveend", () => !is3d.value && map.setMaxPitch(0).setTerrain(null));
    }
}

// written straight to the icon on every rotate frame; a reactive ref would re-render Vue each frame
const compass = ref(null);
const pointNorth = () => (compass.value.firstElementChild.style.transform = `rotate(${-map.getBearing()}deg)`);
const resetNorth = () => map.resetNorth();

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
        maxPitch: MAX_PITCH,
        minZoom: 2,
        maxZoom: 19,
        pixelRatio: Math.min(devicePixelRatio, 1.5), // HiDPI at 2x draws 4x the pixels
        validateStyle: false, // bundled, trusted style
        attributionControl: false,
        dragRotate: false,
    });
    enableSlowRightDragRotate(container.value);
    hideStreetNamesWhenTilted();
    map.on("rotate", pointNorth);
    pointNorth(); // the initial bearing fires no rotate event
});

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <div class="map-view">
        <div ref="container" class="map-container" @contextmenu.prevent></div>
        <button
            class="map-control"
            :aria-pressed="is3d"
            :title="is3d ? 'Switch to 2D top view' : 'Switch to 3D view'"
            @click="toggleView"
        >
            {{ is3d ? "3D" : "2D" }}
        </button>
        <button ref="compass" class="map-control map-compass" title="Reset to north" @click="resetNorth">
            <Navigation2 />
        </button>
    </div>
</template>

<style scoped>
.map-view {
    /* glass look without backdrop-filter: a blur would be recomputed on every map frame */
    --map-glass-fill: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25));
    --map-glass-shadow: rgba(0, 0, 0, 0.25);
    --map-glass-text: #1a1a1a;

    position: relative;
    width: 100%;
    height: 100%;
}

.map-container {
    width: 100%;
    height: 100%;
}

.map-control {
    position: absolute;
    top: var(--icon-btn-inset);
    right: var(--icon-btn-inset);
    width: var(--icon-btn-size);
    height: var(--icon-btn-size);
    border: none;
    border-radius: var(--icon-btn-radius);
    background: var(--map-glass-fill);
    box-shadow: 0 2px 8px var(--map-glass-shadow);
    color: var(--map-glass-text);
    font-family: var(--font-mono);
    font-size: var(--font-size-label-sm);
    font-weight: bold;
    cursor: pointer;
}

.map-compass {
    top: calc(2 * var(--icon-btn-inset) + var(--icon-btn-size));
    display: flex;
    align-items: center;
    justify-content: center;
}

.map-compass svg {
    width: 60%;
    height: 60%;
}
</style>
