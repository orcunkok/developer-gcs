import { addProtocol } from "maplibre-gl";
import mlcontour from "maplibre-contour";

// Free open elevation tiles (AWS Open Data, Terrarium encoding), no token.
const DEM_URL =
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_MAX_ZOOM = 15; // contours use the fine tiles
const TERRAIN_MAX_ZOOM = 14; // 3D mesh + hillshade detail vs. CPU/memory
const DEM_CACHE_TILES = 40; // decoded DEM tiles kept in the worker (library default 100)

const demSource = new mlcontour.DemSource({
    url: DEM_URL,
    encoding: "terrarium",
    maxzoom: DEM_MAX_ZOOM,
    cacheSize: DEM_CACHE_TILES,
    worker: true,
});
demSource.setupMaplibre({ addProtocol });

/** 3D terrain mesh; turned off in the 2D top view, where hillshade and contours keep using the `dem` source */
export const TERRAIN = { source: "dem", exaggeration: 1.2 };

/**
 * Adds the DEM sources, 3D terrain and sky to the base style.
 * The hillshade and contour layers live in the base style and use the `dem` and `contours` sources.
 * @param {object} base MapLibre style (OpenMapTiles schema)
 * @returns {object} new style
 */
export function withTerrain(base) {
    return {
        ...base,
        sources: {
            ...base.sources,
            // one source for terrain and hillshade: half the DEM memory, softer hillshade above z14
            dem: {
                type: "raster-dem",
                encoding: "terrarium",
                tiles: [demSource.sharedDemProtocolUrl],
                tileSize: 256,
                maxzoom: TERRAIN_MAX_ZOOM,
            },
            contours: {
                type: "vector",
                maxzoom: DEM_MAX_ZOOM,
                tiles: [
                    demSource.contourProtocolUrl({
                        // each zoom uses the nearest lower key
                        thresholds: {
                            10: [100, 500],
                            11: [50, 250],
                            12: [40, 200],
                            13: [20, 100],
                            14: [10, 50],
                        },
                    }),
                ],
            },
        },
        terrain: TERRAIN,
        // haze + sky so distant terrain fades out instead of ending at a hard edge
        sky: {
            "sky-color": "hsl(210, 90%, 72%)",
            "horizon-color": "hsl(205, 40%, 92%)",
            "fog-color": "hsl(200, 30%, 90%)",
            "sky-horizon-blend": 0.6,
            "horizon-fog-blend": 0.6,
            "fog-ground-blend": 0.6,
        },
    };
}
