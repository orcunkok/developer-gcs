<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as maptalks from "maptalks";

const container = ref(null);
let map = null;

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
    const marker = new maptalks.Marker(home);
    marker.updateSymbol({ markerOpacity: 1, markerFill: "#bbb" });
    new maptalks.VectorLayer("home", [marker]).addTo(map);
});

onUnmounted(() => {
    if (map) {
        map.remove();
        map = null;
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
