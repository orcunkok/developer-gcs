import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import { useEventLogStore } from "./eventLogStore.js";
import { registerAction } from "../actions.js";

export const useMissionStore = defineStore("mission", () => {
  const eventLog = useEventLogStore();

  const items = shallowRef([]);
  const activeSeq = ref(0);
  const syncState = ref("idle"); // idle | fetching | uploading | error
  const syncError = ref(null);

  let _adapter = null;
  let _lastTotal = 0;

  function bindAdapter(adapter) { _adapter = adapter; }

  async function _run(state, fn, event) {
    if (!_adapter) return;
    syncState.value = state;
    syncError.value = null;
    try {
      await fn();
      syncState.value = "idle";
      eventLog.addEvent(event, { count: items.value.length });
    } catch (err) {
      syncError.value = err.message;
      syncState.value = "error";
      eventLog.addEvent(event + "_FAILED", { error: err.message });
    }
  }

  function fetch() {
    return _run("fetching", async () => {
      items.value = await _adapter.fetchMission();
    }, "MISSION_DOWNLOADED");
  }

  function upload(newItems) {
    return _run("uploading", async () => {
      const r = await _adapter.uploadMission(newItems);
      if (!r.ok) throw new Error(r.error);
      items.value = newItems;
    }, "MISSION_UPLOADED");
  }

  function clear() {
    return _run("idle", async () => {
      const r = await _adapter.clearMission();
      if (!r.ok) throw new Error(r.error);
      items.value = [];
      _lastTotal = 0;
    }, "MISSION_CLEARED");
  }

  function ingest(msg) {
    if (msg.type === "mission") {
      const { seq, total } = msg.payload;
      activeSeq.value = seq;
      const stale = total > 0 && (items.value.length === 0 || total !== _lastTotal || seq >= items.value.length);
      _lastTotal = total;
      if (stale && syncState.value !== "fetching") fetch();
    }
    if (msg.type === "missionItemReached") {
      eventLog.addEvent("WAYPOINT_REACHED", { seq: msg.payload.seq }, msg.timestamp);
    }
  }

  registerAction("fetchMission", () => fetch());
  registerAction("uploadMission", (p) => upload(p.items));
  registerAction("clearMission", () => clear());

  // for debugging only
  if (typeof window !== "undefined") window.__mission = { items, activeSeq, syncState };

  return { items, activeSeq, syncState, syncError, bindAdapter, ingest, fetch, upload, clear };
});
