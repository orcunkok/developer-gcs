import * as maptalks from "maptalks";
import { watch, onUnmounted } from "vue";
import { useMissionStore } from "../stores/missionStore.js";

const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3;
const MAV_CMD_NAV_WAYPOINT = 16;
const DEFAULT_ALT = 20; // meters AGL

/**
 * Returns a Maptalks marker symbol with optional text label.
 * @param {string} color  hex fill color
 * @param {string} [label]
 */
function pinSymbol(color, label) {
  return {
    markerType: "ellipse",
    markerFill: color,
    markerFillOpacity: 1,
    markerLineColor: "#fff",
    markerLineWidth: 1.5,
    markerWidth: 12,
    markerHeight: 12,
    textName: label ?? "",
    textSize: 11,
    textFill: "#fff",
    textHaloFill: color,
    textHaloRadius: 2,
    textDy: -14,
  };
}

/**
 * Map right-click action composable. Must be called inside onMounted.
 * @param {maptalks.Map} map
 */
export function useMapActions(map) {
  const mission = useMissionStore();

  const waypointLayer = new maptalks.VectorLayer("waypoints").addTo(map);
  const markerLayer = new maptalks.VectorLayer("markers").addTo(map);

  let _markerSeq = 0;

  // ── Waypoints ──────────────────────────────────────────────────────────────

  function _redrawWaypoints(items) {
    waypointLayer.clear();
    if (!items.length) return;
    waypointLayer.addGeometry(
      items.map(
        (it) =>
          new maptalks.Marker(new maptalks.Coordinate(it.lon, it.lat), {
            symbol: pinSymbol("#3b82f6", String(it.seq)),
          }),
      ),
    );
  }

  const _stopWatch = watch(() => mission.items, _redrawWaypoints, {
    immediate: true,
  });

  /**
   * Appends a NAV_WAYPOINT to missionStore and triggers redraw.
   * @param {maptalks.Coordinate} coord
   */
  function addWaypoint(coord) {
    const current = mission.items;
    mission.items = [
      ...current,
      {
        seq: current.length,
        frame: MAV_FRAME_GLOBAL_RELATIVE_ALT,
        command: MAV_CMD_NAV_WAYPOINT,
        lat: coord.y,
        lon: coord.x,
        alt: DEFAULT_ALT,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        autocontinue: 1,
      },
    ];
  }

  // ── Drop Marker ────────────────────────────────────────────────────────────

  /**
   * Places a labeled session-only marker. Right-click to remove.
   * @param {maptalks.Coordinate} coord
   */
  function dropMarker(coord) {
    const label = String.fromCharCode(65 + (_markerSeq++ % 26));
    const marker = new maptalks.Marker(coord, {
      symbol: pinSymbol("#ef4444", label),
    });
    marker.on("contextmenu", () => markerLayer.removeGeometry(marker));
    markerLayer.addGeometry(marker);
  }

  // ── Measure Distance ───────────────────────────────────────────────────────

  function startMeasure(coord) {
    console.log("add measure", coord); // for debugging only
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  onUnmounted(() => {
    _stopWatch();
    map.removeLayer(waypointLayer);
    map.removeLayer(markerLayer);
  });

  return { addWaypoint, dropMarker, startMeasure };
}
