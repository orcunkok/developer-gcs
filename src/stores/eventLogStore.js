import { defineStore } from "pinia";
import { shallowRef, triggerRef } from "vue";

// ── Ring Buffer (plain, not reactive) ───────────────────────────
class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buf = new Array(capacity);
    this.head = 0;
    this.count = 0;
  }

  push(timestamp, value) {
    this.buf[this.head] = { t: timestamp, v: value };
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Returns ordered array oldest→newest, last n entries */
  slice(n) {
    const len = Math.min(n, this.count);
    const start = (this.head - len + this.capacity) % this.capacity;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.buf[(start + i) % this.capacity];
    }
    return result;
  }

  toArray() {
    return this.slice(this.count);
  }
}

// ── Store ───────────────────────────────────────────────────────
const EVENT_CAP = 10_000;
const SERIES_CAP = 1_200; // 120s at 10Hz

export const useEventLogStore = defineStore("eventLog", () => {
  // -- Discrete events (ARM, MODE_CHANGE, alerts, AI decisions) --
  const events = shallowRef([]);

  // -- Telemetry series (sparklines) --
  const series = {};
  const seriesVersion = shallowRef(0);

  // -- Session --
  const sessionStart = Date.now();

  // ---- Write API ----

  function addEvent(type, data = {}, timestamp = Date.now()) {
    const arr = events.value;
    if (arr.length >= EVENT_CAP) arr.shift();
    arr.push({ t: timestamp, type, data });
    triggerRef(events);
  }

  function addSample(channel, value, timestamp = Date.now()) {
    if (!series[channel]) series[channel] = new RingBuffer(SERIES_CAP);
    series[channel].push(timestamp, value);
  }

  function notifySeries() {
    seriesVersion.value++;
  }

  // ---- Read API ----

  function recentEvents(ms) {
    const cutoff = Date.now() - ms;
    const arr = events.value;
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid].t < cutoff) lo = mid + 1;
      else hi = mid;
    }
    return arr.slice(lo);
  }

  function recentSamples(channel, n = 120) {
    return series[channel]?.slice(n) ?? [];
  }

  function channels() {
    return Object.keys(series);
  }

  function exportSession() {
    return {
      sessionStart,
      events: [...events.value],
      series: Object.fromEntries(
        Object.entries(series).map(([k, rb]) => [k, rb.toArray()]),
      ),
    };
  }

  function clear() {
    events.value = [];
    triggerRef(events);
    for (const k of Object.keys(series)) delete series[k];
    seriesVersion.value++;
  }

  return {
    events,
    seriesVersion,
    addEvent,
    addSample,
    notifySeries,
    recentEvents,
    recentSamples,
    channels,
    exportSession,
    clear,
  };
});
