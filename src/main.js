import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { createMavlinkAdapter } from './adapters/mavlink/MavlinkAdapter.js'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// Start adapter — telemetry logs to browser console at 1 Hz
const adapter = createMavlinkAdapter()
adapter.connect()
window.__adapter = adapter
