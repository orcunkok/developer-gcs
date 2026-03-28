/**
 * MAVLink <-> Normalized message mappings.
 * Runs server-side only (Bun/Node). Never imported by the browser.
 */

import {
  Heartbeat, MavState, MavModeFlag,
} from 'mavlink-mappings/dist/lib/minimal.js'

import {
  Attitude, GlobalPositionInt, SysStatus, GpsRawInt,
  ScaledImu, ScaledPressure, RcChannels, ServoOutputRaw,
  MissionCurrent, VfrHud, BatteryStatus, StatusText, ParamValue,
  CommandAck, CommandLong, ParamSet, ParamRequestRead, MavCmd, MavResult, MavSeverity,
} from 'mavlink-mappings/dist/lib/common.js'

// ── ArduPilot plane flight modes (customMode field) ──────────────────────────

const PLANE_MODES = {
  0: 'MANUAL', 1: 'CIRCLE', 2: 'STABILIZE', 3: 'TRAINING',
  4: 'ACRO', 5: 'FBWA', 6: 'FBWB', 7: 'CRUISE',
  8: 'AUTOTUNE', 10: 'AUTO', 11: 'RTL', 12: 'LOITER',
  13: 'TAKEOFF', 14: 'AVOID_ADSB', 15: 'GUIDED',
  17: 'QSTABILIZE', 18: 'QHOVER', 19: 'QLOITER', 20: 'QLAND',
  21: 'QRTL', 22: 'QAUTOTUNE', 23: 'QACRO', 24: 'THERMAL',
  25: 'LOITER_ALT_QLAND',
}

// ── Inbound: MAVLink packet -> normalized messages ───────────────────────────

/**
 * Map of MAVLink MSG_ID -> { clazz, convert(data) -> [{type, payload}] }
 * convert returns an array because one MAVLink message can produce multiple normalized messages.
 */
export const MESSAGE_MAP = new Map()

function reg(clazz, convert) {
  MESSAGE_MAP.set(clazz.MSG_ID, { clazz, convert })
}

reg(Heartbeat, d => [{
  type: 'heartbeat',
  payload: {
    armed: !!(d.baseMode & MavModeFlag.SAFETY_ARMED),
    mode: PLANE_MODES[d.customMode] || `MODE_${d.customMode}`,
    systemStatus: MavState[d.systemStatus] || String(d.systemStatus),
  },
}])

reg(Attitude, d => [{
  type: 'attitude',
  payload: {
    roll: d.roll, pitch: d.pitch, yaw: d.yaw,
    rollRate: d.rollspeed, pitchRate: d.pitchspeed, yawRate: d.yawspeed,
  },
}])

reg(GlobalPositionInt, d => [
  {
    type: 'position',
    payload: {
      lat: d.lat / 1e7, lon: d.lon / 1e7,
      altMSL: d.alt / 1000, altAGL: d.relativeAlt / 1000,
      heading: d.hdg / 100,
    },
  },
  {
    type: 'velocity',
    payload: { vx: d.vx / 100, vy: d.vy / 100, vz: d.vz / 100 },
  },
])

reg(VfrHud, d => [{
  type: 'velocity',
  payload: {
    groundSpeed: d.groundspeed, airspeed: d.airspeed,
    climb: d.climb, throttle: d.throttle,
  },
}])

reg(SysStatus, d => [
  {
    type: 'battery',
    payload: {
      voltage: d.voltageBattery / 1000,
      current: d.currentBattery / 100,
      remaining: d.batteryRemaining / 100,
    },
  },
  {
    type: 'linkQuality',
    payload: {
      rxErrors: d.errorsComm,
      rxDropped: d.dropRateComm,
      txBuffer: 0,
    },
  },
])

reg(GpsRawInt, d => [{
  type: 'gps',
  payload: {
    fixType: d.fixType,
    satellites: d.satellitesVisible,
    hdop: d.eph / 100,
    vdop: d.epv / 100,
  },
}])

reg(ScaledImu, d => [{
  type: 'imu',
  payload: {
    ax: d.xacc / 1000, ay: d.yacc / 1000, az: d.zacc / 1000,
    gx: d.xgyro / 1000, gy: d.ygyro / 1000, gz: d.zgyro / 1000,
    mx: d.xmag / 1000, my: d.ymag / 1000, mz: d.zmag / 1000,
  },
}])

reg(ScaledPressure, d => [{
  type: 'pressure',
  payload: {
    absPress: d.pressAbs,
    diffPress: d.pressDiff,
    temperature: d.temperature / 100,
  },
}])

reg(RcChannels, d => [{
  type: 'rcChannels',
  payload: {
    channels: Array.from({ length: d.chancount }, (_, i) => {
      const raw = d[`chan${i + 1}Raw`] || 0
      return Math.max(0, Math.min(1, (raw - 1000) / 1000))
    }),
  },
}])

reg(ServoOutputRaw, d => [{
  type: 'servo',
  payload: {
    outputs: Array.from({ length: 16 }, (_, i) => d[`servo${i + 1}Raw`] || 0),
  },
}])

reg(MissionCurrent, d => [{
  type: 'mission',
  payload: {
    seq: d.seq,
    total: d.total || 0,
    currentWaypoint: d.seq,
  },
}])

reg(StatusText, d => [{
  type: 'statusText',
  payload: {
    severity: MavSeverity[d.severity] || String(d.severity),
    text: d.text?.replace(/\0/g, '').trim() || '',
  },
}])

reg(CommandAck, d => [{
  type: 'commandAck',
  payload: {
    command: MavCmd[d.command] || String(d.command),
    result: MavResult[d.result] || String(d.result),
  },
}])

reg(ParamValue, d => [{
  type: 'param',
  payload: {
    id: d.paramId?.replace(/\0/g, '').trim() || '',
    value: d.paramValue,
    type: String(d.paramType),
  },
}])

// ── Outbound: normalized command -> MAVLink message ──────────────────────────

export function buildCommand({ action, params = {} }) {
  switch (action) {
    case 'arm': {
      const msg = new CommandLong()
      msg.command = MavCmd.COMPONENT_ARM_DISARM
      msg._param1 = 1
      return msg
    }
    case 'disarm': {
      const msg = new CommandLong()
      msg.command = MavCmd.COMPONENT_ARM_DISARM
      msg._param1 = 0
      return msg
    }
    case 'setMode': {
      const msg = new CommandLong()
      msg.command = MavCmd.DO_SET_MODE
      msg._param1 = 1 // MAV_MODE_FLAG_CUSTOM
      const modeNum = Object.entries(PLANE_MODES).find(([, v]) => v === params.mode)?.[0]
      msg._param2 = modeNum !== undefined ? Number(modeNum) : 0
      return msg
    }
    case 'takeoff': {
      const msg = new CommandLong()
      msg.command = MavCmd.NAV_TAKEOFF
      msg._param7 = params.alt || 10
      return msg
    }
    case 'land': {
      const msg = new CommandLong()
      msg.command = MavCmd.NAV_LAND
      return msg
    }
    case 'goto': {
      const msg = new CommandLong()
      msg.command = MavCmd.DO_REPOSITION
      msg._param5 = params.lat || 0
      msg._param6 = params.lon || 0
      msg._param7 = params.alt || 0
      return msg
    }
    case 'setParam': {
      const msg = new ParamSet()
      msg.paramId = params.id || ''
      msg.paramValue = params.value || 0
      msg.paramType = Number(params.type) || 0
      msg.targetSystem = 1
      msg.targetComponent = 1
      return msg
    }
    case 'getParam': {
      const msg = new ParamRequestRead()
      msg.paramId = params.id || ''
      msg.paramIndex = -1
      msg.targetSystem = 1
      msg.targetComponent = 1
      return msg
    }
    case 'setMessageRate': {
      const msg = new CommandLong()
      msg.command = MavCmd.SET_MESSAGE_INTERVAL
      msg._param1 = params.messageId || 0
      msg._param2 = params.rateHz ? 1e6 / params.rateHz : 0
      return msg
    }
    default:
      return null
  }
}

// GCS heartbeat to send at 1Hz
export function buildGcsHeartbeat() {
  const msg = new Heartbeat()
  msg.type = 6       // MAV_TYPE_GCS
  msg.autopilot = 8  // MAV_AUTOPILOT_INVALID
  msg.baseMode = 0
  msg.customMode = 0
  msg.systemStatus = 0
  return msg
}
