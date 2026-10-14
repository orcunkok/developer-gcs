import { addProtocol } from "maplibre-gl";
import mlcontour from "maplibre-contour";

// Free open elevation tiles (AWS Open Data, Terrarium encoding), no token.
const DEM_URL =
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_MAX_ZOOM = 15; // hillshade + contours use the fine tiles
const TERRAIN_MAX_ZOOM = 14; // 3D mesh detail vs. CPU/memory
const DEM_CACHE_TILES = 40; // decoded DEM tiles kept in the worker (library default 100)

const CONTOUR_COLOR = "hsl(40, 36%, 25%)";

let demSource = null;

/**
 * Adds DEM-driven terrain, hillshade and contour lines to the base style.
 * Hillshade colors and contour widths/labels are ported from Mapbox Outdoors.
 * @param {object} base MapLibre style (OpenMapTiles schema)
 * @returns {object} new style
 */
export function withTerrain(base) {
    if (!demSource) {
        demSource = new mlcontour.DemSource({
            url: DEM_URL,
            encoding: "terrarium",
            maxzoom: DEM_MAX_ZOOM,
            cacheSize: DEM_CACHE_TILES,
            worker: true,
        });
        demSource.setupMaplibre({ addProtocol });
    }

    const dem = {
        type: "raster-dem",
        encoding: "terrarium",
        tiles: [demSource.sharedDemProtocolUrl],
        tileSize: 256,
    };

    // [layer, id of the base layer it goes in front of]
    const extra = [
        [
            {
                id: "hillshade",
                type: "hillshade",
                source: "dem-hillshade",
                paint: {
                    "hillshade-method": "standard",
                    "hillshade-exaggeration": [
                        "interpolate", ["linear"], ["zoom"], 0, 0.2, 10, 0.55, 15, 0.8,
                    ],
                    "hillshade-shadow-color": "hsla(70, 45%, 18%, 0.75)",
                    "hillshade-accent-color": "hsla(60, 25%, 35%, 0.25)",
                    "hillshade-highlight-color": "hsla(60, 40%, 100%, 0.4)",
                    "hillshade-illumination-direction": 335,
                    "hillshade-illumination-anchor": "map",
                },
            },
            "water",
        ],
        [
            {
                id: "contour",
                type: "line",
                source: "contours",
                "source-layer": "contours",
                minzoom: 10,
                paint: {
                    "line-color": "hsla(40, 36%, 25%, 0.65)",
                    "line-opacity": [
                        "interpolate", ["linear"], ["zoom"], 9.5, 0, 11.5, 1,
                    ],
                    "line-width": ["case", [">", ["get", "level"], 0], 0.9, 0.4],
                },
            },
            "building-3d",
        ],
        [
            {
                id: "contour-label",
                type: "symbol",
                source: "contours",
                "source-layer": "contours",
                minzoom: 11,
                filter: [">", ["get", "level"], 0],
                layout: {
                    "symbol-placement": "line",
                    "symbol-spacing": 300,
                    "text-field": ["to-string", ["get", "ele"]],
                    "text-font": ["Noto Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 12, 8, 18, 13],
                },
                paint: {
                    "text-color": CONTOUR_COLOR,
                    "text-halo-color": "hsla(20, 20%, 100%, 0.6)",
                    "text-halo-width": 1,
                    "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12, 1],
                },
            },
            "road-label",
        ],
    ];

    const layers = [...base.layers];
    for (const [layer, before] of extra) {
        layers.splice(layers.findIndex((l) => l.id === before), 0, layer);
    }

    return {
        ...base,
        sources: {
            ...base.sources,
            dem: { ...dem, maxzoom: TERRAIN_MAX_ZOOM },
            // MapLibre recommends separate sources for hillshade and terrain
            "dem-hillshade": { ...dem, maxzoom: DEM_MAX_ZOOM },
            contours: {
                type: "vector",
                maxzoom: DEM_MAX_ZOOM,
                tiles: [
                    demSource.contourProtocolUrl({
                        thresholds: {
                            10: [100, 500],
                            11: [50, 250],
                            12: [40, 200],
                            13: [20, 100],
                            14: [10, 50],
                            15: [10, 50],
                        },
                    }),
                ],
            },
        },
        layers,
        terrain: { source: "dem", exaggeration: 1.2 },
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
