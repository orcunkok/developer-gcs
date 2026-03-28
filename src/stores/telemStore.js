import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useTelemStore = defineStore('telem', () => {
  // -- connection --
  const connState = ref('disconnected')
  const latencyMs = ref(null)
  const lastSeen = ref(null)

  // -- attitude --
  const roll = ref(0)
  const pitch = ref(0)
  const yaw = ref(0)
  const rollRate = ref(0)
  const pitchRate = ref(0)
  const yawRate = ref(0)

  // -- position --
  const lat = ref(0)
  const lon = ref(0)
  const altMSL = ref(0)
  const altAGL = ref(0)
  const heading = ref(0)

  // -- velocity --
  const vx = ref(0)
  const vy = ref(0)
  const vz = ref(0)
  const groundSpeed = ref(0)
  const airspeed = ref(0)
  const climb = ref(0)
  const throttle = ref(0)

  // -- battery --
  const voltage = ref(0)
  const current = ref(0)
  const remaining = ref(0)

  // -- gps --
  const fixType = ref(0)
  const satellites = ref(0)
  const hdop = ref(0)
  const vdop = ref(0)

  // -- heartbeat --
  const armed = ref(false)
  const mode = ref('')
  const systemStatus = ref('')

  // -- mission --
  const missionSeq = ref(0)
  const missionTotal = ref(0)
  const currentWaypoint = ref(0)

  // -- link quality --
  const rxErrors = ref(0)
  const rxDropped = ref(0)
  const txBuffer = ref(0)

  // -- collections (shallowRef avoids deep proxy) --
  const params = shallowRef({})
  const statusMessages = shallowRef([])
  const lastAck = shallowRef(null)

  // -- meta --
  const lastTimestamp = ref(0)

  // ---- INGEST: one handler per message type, O(1) lookup ----
  const HANDLERS = {
    attitude(p, t) {
      roll.value = p.roll; pitch.value = p.pitch; yaw.value = p.yaw
      rollRate.value = p.rollRate; pitchRate.value = p.pitchRate; yawRate.value = p.yawRate
      lastTimestamp.value = t
    },
    position(p, t) {
      lat.value = p.lat; lon.value = p.lon
      altMSL.value = p.altMSL; altAGL.value = p.altAGL; heading.value = p.heading
      lastTimestamp.value = t
    },
    velocity(p, t) {
      if (p.vx !== undefined) { vx.value = p.vx; vy.value = p.vy; vz.value = p.vz }
      if (p.groundSpeed !== undefined) { groundSpeed.value = p.groundSpeed; airspeed.value = p.airspeed; climb.value = p.climb; throttle.value = p.throttle }
      lastTimestamp.value = t
    },
    battery(p, t) {
      voltage.value = p.voltage; current.value = p.current; remaining.value = p.remaining
      lastTimestamp.value = t
    },
    gps(p, t) {
      fixType.value = p.fixType; satellites.value = p.satellites
      hdop.value = p.hdop; vdop.value = p.vdop
      lastTimestamp.value = t
    },
    heartbeat(p, t) {
      armed.value = p.armed; mode.value = p.mode; systemStatus.value = p.systemStatus
      lastTimestamp.value = t
    },
    mission(p, t) {
      missionSeq.value = p.seq; missionTotal.value = p.total
      currentWaypoint.value = p.currentWaypoint
      lastTimestamp.value = t
    },
    linkQuality(p, t) {
      rxErrors.value = p.rxErrors; rxDropped.value = p.rxDropped; txBuffer.value = p.txBuffer
      lastTimestamp.value = t
    },
    param(p) {
      params.value = { ...params.value, [p.id]: p.value }
    },
    statusText(p, t) {
      const msgs = statusMessages.value.length >= 50
        ? statusMessages.value.slice(-49)
        : [...statusMessages.value]
      msgs.push({ ...p, timestamp: t })
      statusMessages.value = msgs
    },
    commandAck(p) {
      lastAck.value = p
    },
  }

  function ingest(msg) {
    const h = HANDLERS[msg.type]
    if (h) h(msg.payload, msg.timestamp)
  }

  function updateConnection(status) {
    connState.value = status.state
    latencyMs.value = status.latencyMs
    lastSeen.value = status.lastSeen
  }

  return {
    // connection
    connState, latencyMs, lastSeen,
    // attitude
    roll, pitch, yaw, rollRate, pitchRate, yawRate,
    // position
    lat, lon, altMSL, altAGL, heading,
    // velocity
    vx, vy, vz, groundSpeed, airspeed, climb, throttle,
    // battery
    voltage, current, remaining,
    // gps
    fixType, satellites, hdop, vdop,
    // heartbeat
    armed, mode, systemStatus,
    // mission
    missionSeq, missionTotal, currentWaypoint,
    // link quality
    rxErrors, rxDropped, txBuffer,
    // collections
    params, statusMessages, lastAck,
    // meta
    lastTimestamp,
    // methods (bridge only)
    ingest, updateConnection,
  }
})
