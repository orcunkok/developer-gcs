<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as maptalks from "maptalks";
import { useTelemStore } from "../stores/telemStore.js";

const telem = useTelemStore();
const container = ref(null);
let map = null;
let planeMarker = null;

onMounted(() => {
    map = new maptalks.Map(container.value, {
        center: [0, 0],
        zoom: 3,
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

    // for debugging only — static SITL default home (Canberra)
    const home = new maptalks.Coordinate(149.16523, -35.363261);
    map.setCenterAndZoom(home, 16);
    const homeMarker = new maptalks.Marker(home);
    homeMarker.updateSymbol({ markerOpacity: 1, markerFill: "#bbb" });
    new maptalks.VectorLayer("home", [homeMarker]).addTo(map);

    // for debugging only — plane marker driven by telem store
    planeMarker = new maptalks.Marker(home, {
        symbol: {
            markerType: "triangle",
            markerFill: "#FFAA33",
            markerFillOpacity: 1,
            markerLineColor: "#fff",
            markerLineWidth: 2,
            markerWidth: 22,
            markerHeight: 32,
            markerRotation: 0,
        },
    });
    new maptalks.VectorLayer("plane", [planeMarker]).addTo(map);
    console.log("[map] for debugging only — plane marker created at home", home.toArray()); // for debugging only
});

watch(
    () => [telem.lat, telem.lon, telem.heading],
    ([lat, lon, hdg]) => {
        if (!planeMarker || (lat === 0 && lon === 0)) return;
        const latDeg = lat / 1e7;
        const lonDeg = lon / 1e7;
        const hdgDeg = hdg / 100;
        const coord = new maptalks.Coordinate(lonDeg, latDeg);
        planeMarker.setCoordinates(coord);
        planeMarker.updateSymbol({ markerRotation: -hdgDeg });
        //console.log("[map] for debugging only — marker:", { latDeg, lonDeg, hdgDeg }); // for debugging only
    },
);

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
        planeMarker = null;
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
