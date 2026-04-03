import { createApp } from "vue";
import { createPinia } from "pinia";
import "maptalks/dist/maptalks.css";
import "./style.css";
import App from "./App.vue";
import { createMavlinkAdapter } from "./adapters/mavlink/MavlinkAdapter.js";
import { useTelemStore } from "./stores/telemStore.js";
import { useMissionStore } from "./stores/missionStore.js";
import { useEventLogStore } from "./stores/eventLogStore.js";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");

// Start adapter and wire to state store, HMR-safe
if (window.__adapter) window.__adapter.disconnect(); // for debugging only
const adapter = createMavlinkAdapter();
const telem = useTelemStore();
const mission = useMissionStore();
mission.bindAdapter(adapter);
adapter.onMessage((msg) => { telem.ingest(msg); mission.ingest(msg); });
adapter.onStatusChange((status) => telem.updateConnection(status));
adapter.connect();
window.__adapter = adapter; // for debugging only
window.__eventLog = useEventLogStore(); // for debugging only
