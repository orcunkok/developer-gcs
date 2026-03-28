import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import { createMavlinkAdapter } from "./adapters/mavlink/MavlinkAdapter.js";
import { useTelemStore } from "./stores/telemStore.js";
import { useEventLogStore } from "./stores/eventLogStore.js";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");

// Start adapter and wire to state store
const adapter = createMavlinkAdapter();
const telem = useTelemStore();
adapter.onMessage((msg) => telem.ingest(msg));
adapter.onStatusChange((status) => telem.updateConnection(status));
adapter.connect();
window.__adapter = adapter; // for debugging only
window.__eventLog = useEventLogStore(); // for debugging only
