<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as maptalks from "maptalks";
import { useTelemStore } from "../stores/telemStore.js";

const telem = useTelemStore();
const container = ref(null);
let map = null;
let planePoly = null;
let stemMarker = null;

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
    if (map) {
        map.remove();
        map = null;
        planePoly = null;
        stemMarker = null;
    }
});
</script>

<template>
    <div ref="container" class="map-container"></div>
</template>

<style scoped>
.map-container {
    width: 100%;
    height: 100%;
}
</style>
