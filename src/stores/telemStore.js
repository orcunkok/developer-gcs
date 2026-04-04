import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import { useEventLogStore } from "./eventLogStore.js";

export const useTelemStore = defineStore("telem", () => {
  const eventLog = useEventLogStore();

  // -- connection --
  const connState = ref("disconnected");
  const latencyMs = ref(null);
  const lastSeen = ref(null);

  // -- attitude --
  const roll = ref(0);
  const pitch = ref(0);
  const yaw = ref(0);
  const rollRate = ref(0);
  const pitchRate = ref(0);
  const yawRate = ref(0);

  // -- position --
  const lat = ref(0);
  const lon = ref(0);
  const altMSL = ref(0);
  const altAGL = ref(0);
  const heading = ref(0);

  // -- velocity --
  const vx = ref(0);
  const vy = ref(0);
  const vz = ref(0);
  const groundSpeed = ref(0);
  const airspeed = ref(0);
  const climb = ref(0);
  const throttle = ref(0);

  // -- battery --
  const voltage = ref(0);
  const current = ref(0);
  const remaining = ref(0);

  // -- gps --
  const fixType = ref(0);
  const satellites = ref(0);
  const hdop = ref(0);
  const vdop = ref(0);

  // -- heartbeat --
  const armed = ref(false);
  const mode = ref("");
  const systemStatus = ref("");

  // -- home --
  const homeLat = ref(null);
  const homeLon = ref(null);
  const homeAlt = ref(null);

  // -- mission --
  const missionSeq = ref(0);
  const missionTotal = ref(0);
  const currentWaypoint = ref(0);

  // -- link quality --
  const rxErrors = ref(0);
  const rxDropped = ref(0);
  const txBuffer = ref(0);

  // -- collections (shallowRef avoids deep proxy) --
  const params = shallowRef({});
  const statusMessages = shallowRef([]);
  const lastAck = shallowRef(null);

  // -- meta --
  const lastTimestamp = ref(0);

  // ---- INGEST: one handler per message type, O(1) lookup ----
  const HANDLERS = {
    attitude(p, t) {
      roll.value = p.roll;
      pitch.value = p.pitch;
      yaw.value = p.yaw;
      rollRate.value = p.rollRate;
      pitchRate.value = p.pitchRate;
      yawRate.value = p.yawRate;
      lastTimestamp.value = t;
      eventLog.addSample("roll", p.roll, t);
      eventLog.addSample("pitch", p.pitch, t);
      eventLog.addSample("yaw", p.yaw, t);
      eventLog.addSample("rollRate", p.rollRate, t);
      eventLog.addSample("pitchRate", p.pitchRate, t);
      eventLog.addSample("yawRate", p.yawRate, t);
    },
    position(p, t) {
      lat.value = p.lat;
      lon.value = p.lon;
      altMSL.value = p.altMSL;
      altAGL.value = p.altAGL;
      heading.value = p.heading;
      lastTimestamp.value = t;
      eventLog.addSample("altMSL", p.altMSL, t);
      eventLog.addSample("altAGL", p.altAGL, t);
      eventLog.addSample("heading", p.heading, t);
    },
    velocity(p, t) {
      if (p.vx !== undefined) {
        vx.value = p.vx;
        vy.value = p.vy;
        vz.value = p.vz;
      }
      if (p.groundSpeed !== undefined) {
        groundSpeed.value = p.groundSpeed;
        airspeed.value = p.airspeed;
        climb.value = p.climb;
        throttle.value = p.throttle;
      }
      lastTimestamp.value = t;
      if (p.groundSpeed !== undefined) {
        eventLog.addSample("groundSpeed", p.groundSpeed, t);
        eventLog.addSample("airspeed", p.airspeed, t);
        eventLog.addSample("climb", p.climb, t);
        eventLog.addSample("throttle", p.throttle, t);
      }
    },
    battery(p, t) {
      voltage.value = p.voltage;
      current.value = p.current;
      remaining.value = p.remaining;
      lastTimestamp.value = t;
      eventLog.addSample("voltage", p.voltage, t);
      eventLog.addSample("remaining", p.remaining, t);
    },
    gps(p, t) {
      fixType.value = p.fixType;
      satellites.value = p.satellites;
      hdop.value = p.hdop;
      vdop.value = p.vdop;
      lastTimestamp.value = t;
    },
    heartbeat(p, t) {
      const wasArmed = armed.value;
      const oldMode = mode.value;
      armed.value = p.armed;
      mode.value = p.mode;
      systemStatus.value = p.systemStatus;
      lastTimestamp.value = t;
      if (p.armed !== wasArmed)
        eventLog.addEvent(p.armed ? "ARM" : "DISARM", {}, t);
      if (p.mode !== oldMode && oldMode !== "")
        eventLog.addEvent("MODE_CHANGE", { from: oldMode, to: p.mode }, t);
    },
    homePosition(p) {
      homeLat.value = p.lat;
      homeLon.value = p.lon;
      homeAlt.value = p.alt;
    },
    mission(p, t) {
      missionSeq.value = p.seq;
      missionTotal.value = p.total;
      currentWaypoint.value = p.currentWaypoint;
      lastTimestamp.value = t;
    },
    linkQuality(p, t) {
      rxErrors.value = p.rxErrors;
      rxDropped.value = p.rxDropped;
      txBuffer.value = p.txBuffer;
      lastTimestamp.value = t;
    },
    param(p) {
      params.value = { ...params.value, [p.id]: p.value };
    },
    statusText(p, t) {
      const msgs =
        statusMessages.value.length >= 50
          ? statusMessages.value.slice(-49)
          : [...statusMessages.value];
      msgs.push({ ...p, timestamp: t });
      statusMessages.value = msgs;
    },
    commandAck(p) {
      lastAck.value = p;
      eventLog.addEvent("COMMAND_ACK", p);
    },
  };

  let _lastNotify = 0;
  function ingest(msg) {
    const h = HANDLERS[msg.type];
    if (h) h(msg.payload, msg.timestamp);
    const now = Date.now();
    if (now - _lastNotify > 100) {
      eventLog.notifySeries();
      _lastNotify = now;
    }
  }

  function updateConnection(status) {
    const oldState = connState.value;
    connState.value = status.state;
    latencyMs.value = status.latencyMs;
    lastSeen.value = status.lastSeen;
    if (status.state !== oldState) {
      eventLog.addEvent("LINK_" + status.state.toUpperCase(), {
        from: oldState,
      });
    }
  }

  // for debugging only — access telem from browser console: window.telem
  if (typeof window !== "undefined") window.telem = { homeLat, homeLon, homeAlt, lat, lon, altMSL, armed, mode, params };

  return {
    // connection
    connState,
    latencyMs,
    lastSeen,
    // attitude
    roll,
    pitch,
    yaw,
    rollRate,
    pitchRate,
    yawRate,
    // position
    lat,
    lon,
    altMSL,
    altAGL,
    heading,
    // velocity
    vx,
    vy,
    vz,
    groundSpeed,
    airspeed,
    climb,
    throttle,
    // battery
    voltage,
    current,
    remaining,
    // gps
    fixType,
    satellites,
    hdop,
    vdop,
    // heartbeat
    armed,
    mode,
    systemStatus,
    // home
    homeLat,
    homeLon,
    homeAlt,
    // mission
    missionSeq,
    missionTotal,
    currentWaypoint,
    // link quality
    rxErrors,
    rxDropped,
    txBuffer,
    // collections
    params,
    statusMessages,
    lastAck,
    // meta
    lastTimestamp,
    // methods (bridge only)
    ingest,
    updateConnection,
  };
});
