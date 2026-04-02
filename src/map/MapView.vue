<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as maptalks from "maptalks";
import { useTelemStore } from "../stores/telemStore.js";

const telem = useTelemStore();
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

    // if home is already known, center immediately
    if (telem.homeLat != null && telem.homeLon != null) {
        map.setCenterAndZoom(
            new maptalks.Coordinate(telem.homeLon, telem.homeLat),
            16,
        );
    }
});

// center on home when it arrives
const stopWatch = watch(
    () => [telem.homeLat, telem.homeLon],
    ([lat, lon]) => {
        if (map && lat != null && lon != null) {
            map.setCenterAndZoom(new maptalks.Coordinate(lon, lat), 16);
        }
    },
);

onUnmounted(() => {
    stopWatch();
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
