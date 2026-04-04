import * as maptalks from "maptalks";
import { watch, onUnmounted } from "vue";
import { useMissionStore } from "../stores/missionStore.js";
import { registerAction } from "../actions.js";

const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3;
const MAV_CMD_NAV_WAYPOINT = 16;
const DEFAULT_ALT = 20; // meters AGL

function haversineMeters(a, b) {
  const toRad = Math.PI / 180;
  const lat1 = a.y * toRad;
  const lat2 = b.y * toRad;
  const dLat = (b.y - a.y) * toRad;
  const dLon = (b.x - a.x) * toRad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function formatDistance(meters) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${meters.toFixed(1)} m`;
}

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
  const measureLayer = new maptalks.VectorLayer("measure").addTo(map);

  let _markerSeq = 0;
  let _measureStart = null;
  let _finishMeasureHandler = null;

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
        seq: current.length + 1,
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
    if (!coord) return;
    _measureStart = coord;
    measureLayer.clear();

    if (_finishMeasureHandler) {
      map.off("click", _finishMeasureHandler);
      _finishMeasureHandler = null;
    }

    measureLayer.addGeometry(
      new maptalks.Marker(coord, {
        symbol: pinSymbol("#1bbc9b", "A"),
      }),
    );

    _finishMeasureHandler = (e) => {
      if (e?.domEvent?.button !== undefined && e.domEvent.button !== 0) return;
      if (!_measureStart || !e?.coordinate) return;

      const end = e.coordinate;
      const distanceM = haversineMeters(_measureStart, end);
      const mid = new maptalks.Coordinate(
        (_measureStart.x + end.x) / 2,
        (_measureStart.y + end.y) / 2,
      );

      measureLayer.clear();
      measureLayer.addGeometry([
        new maptalks.LineString([_measureStart, end], {
          symbol: {
            lineColor: "#34495e",
            lineWidth: 2,
          },
        }),
        new maptalks.Marker(_measureStart, {
          symbol: pinSymbol("#1bbc9b", "A"),
        }),
        new maptalks.Marker(end, {
          symbol: pinSymbol("#1bbc9b", "B"),
        }),
        new maptalks.Label(formatDistance(distanceM), mid, {
          boxStyle: {
            padding: [6, 2],
            symbol: {
              markerType: "square",
              markerFill: "#000",
              markerFillOpacity: 0.9,
              markerLineColor: "#b4b3b3",
            },
          },
          textSymbol: {
            textFaceName: "monospace",
            textFill: "#fff",
          },
        }),
      ]);

      map.off("click", _finishMeasureHandler);
      _finishMeasureHandler = null;
      _measureStart = null;
    };

    map.on("click", _finishMeasureHandler);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  function clearMapActions() {
    mission.items = [];
    waypointLayer.clear();
    markerLayer.clear();
    measureLayer.clear();
    _markerSeq = 0;
    _measureStart = null;
    if (_finishMeasureHandler) {
      map.off("click", _finishMeasureHandler);
      _finishMeasureHandler = null;
    }
  }

  registerAction("clearMapActions", () => clearMapActions());

  onUnmounted(() => {
    if (_finishMeasureHandler) {
      map.off("click", _finishMeasureHandler);
      _finishMeasureHandler = null;
    }
    _stopWatch();
    map.removeLayer(waypointLayer);
    map.removeLayer(markerLayer);
    map.removeLayer(measureLayer);
  });

  return { addWaypoint, dropMarker, startMeasure, clearMapActions };
}
