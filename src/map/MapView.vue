<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as maptalks from "maptalks";
import { useTelemStore } from "../stores/telemStore.js";
import { action } from "../actions.js";
import { useMapActions } from "./mapActions.js";

const telem = useTelemStore();
const container = ref(null);
const wrapper = ref(null);
const ctxMenu = ref({ show: false, x: 0, y: 0, coord: null });

function closeMenu() {
    ctxMenu.value.show = false;
}

function onRightClick(e) {
    if (!map || !wrapper.value) return;
    const rect = wrapper.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coord = map.containerPointToCoordinate(new maptalks.Point(x, y));
    const menuW = 160,
        menuH = 130;
    const clampedX = Math.min(x, rect.width - menuW);
    const clampedY = Math.min(y, rect.height - menuH);
    ctxMenu.value = { show: true, x: clampedX, y: clampedY, coord };
    requestAnimationFrame(() =>
        document.addEventListener("pointerdown", closeMenu, { once: true }),
    );
}

function ctxAction(actionName) {
    const { coord } = ctxMenu.value;
    if (!coord) {
        closeMenu();
        return;
    }

    if (actionName === "goto") {
        action.goto({ lat: coord.y, lon: coord.x, alt: telem.altAGL / 1000 });
    } else if (actionName === "add-waypoint") {
        addWaypoint(coord);
    } else if (actionName === "drop-marker") {
        dropMarker(coord);
    } else if (actionName === "measure") {
        startMeasure(coord);
    }
    closeMenu();
}
let map = null;
let planePoly = null;
let stemMarker = null;
let addWaypoint = null;
let dropMarker = null;
let startMeasure = null;

const DEG2RAD = Math.PI / 180;
const M_PER_DEG_LAT = 111320;
const PLANE_SIZE = 30; // meters

function triangleCoords(lon, lat, hdg, alt) {
    const mLon = M_PER_DEG_LAT * Math.cos(lat * DEG2RAD);
    const local = [
        [0, PLANE_SIZE],
        [-PLANE_SIZE * 0.5, -PLANE_SIZE * 0.6],
        [0, -PLANE_SIZE * 0.2],
        [PLANE_SIZE * 0.5, -PLANE_SIZE * 0.6],
    ];
    const c = Math.cos(hdg * DEG2RAD);
    const s = Math.sin(hdg * DEG2RAD);
    return local.map(([e, n]) => [
        lon + (e * c + n * s) / mLon,
        lat + (-e * s + n * c) / M_PER_DEG_LAT,
        alt,
    ]);
}

onMounted(() => {
    // for debugging only — static SITL default home (Canberra)
    const home = [149.16523, -35.363261];

    map = new maptalks.Map(container.value, {
        center: home,
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

    // for debugging only — home marker
    const homeMarker = new maptalks.Marker(home);
    homeMarker.updateSymbol({ markerOpacity: 1, markerFill: "#bbb" });
    new maptalks.VectorLayer("home", [homeMarker]).addTo(map);

    stemMarker = new maptalks.Marker([home[0], home[1], 0], {
        symbol: { markerWidth: 0, markerHeight: 0 },
    });
    new maptalks.VectorLayer("stem", {
        enableAltitude: true,
        drawAltitude: { lineWidth: 1.5, lineColor: "#000" },
    })
        .addGeometry(stemMarker)
        .addTo(map);

    planePoly = new maptalks.Polygon([triangleCoords(home[0], home[1], 0, 0)], {
        symbol: {
            lineColor: "#fff",
            lineWidth: 1.5,
            polygonFill: "#22c55e",
            polygonOpacity: 1,
        },
    });
    new maptalks.VectorLayer("plane", { enableAltitude: true })
        .addGeometry(planePoly)
        .addTo(map);

    ({ addWaypoint, dropMarker, startMeasure } = useMapActions(map));
});

watch(
    () => [telem.lat, telem.lon, telem.heading, telem.altAGL],
    ([lat, lon, hdg, alt]) => {
        if (!planePoly || (lat === 0 && lon === 0)) return;
        const lonDeg = lon / 1e7;
        const latDeg = lat / 1e7;
        const altM = alt / 1000;
        planePoly.setCoordinates([
            triangleCoords(lonDeg, latDeg, hdg / 100, altM),
        ]);
        stemMarker.setCoordinates([lonDeg, latDeg, altM]);
    },
);

onUnmounted(() => {
    document.removeEventListener("pointerdown", closeMenu);
    if (map) {
        map.remove();
        map = null;
        planePoly = null;
        stemMarker = null;
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
            <button @click="ctxAction('goto')">Goto</button>
            <button @click="ctxAction('add-waypoint')">Add Waypoint</button>
            <button @click="ctxAction('drop-marker')">Drop Marker</button>
            <button @click="ctxAction('measure')">Measure Distance</button>
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
