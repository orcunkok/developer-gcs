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
  MissionCurrent, MissionCount, MissionItemInt, MissionRequestInt,
  MissionAck, MissionItemReached, MissionRequestList, MissionClearAll,
  VfrHud, BatteryStatus, StatusText, ParamValue,
  CommandAck, CommandLong, ParamSet, ParamRequestRead,
  MavCmd, MavResult, MavSeverity, MavMissionResult, MavMissionType, MavFrame,
  HomePosition,
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
      lat: d.lat, lon: d.lon,
      altMSL: d.alt, altAGL: d.relativeAlt,
      heading: d.hdg,
    },
  },
  {
    type: 'velocity',
    payload: { vx: d.vx, vy: d.vy, vz: d.vz },
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
      voltage: d.voltageBattery,
      current: d.currentBattery,
      remaining: d.batteryRemaining,
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
    hdop: d.eph,
    vdop: d.epv,
  },
}])

reg(ScaledImu, d => [{
  type: 'imu',
  payload: {
    ax: d.xacc, ay: d.yacc, az: d.zacc,
    gx: d.xgyro, gy: d.ygyro, gz: d.zgyro,
    mx: d.xmag, my: d.ymag, mz: d.zmag,
  },
}])

reg(ScaledPressure, d => [{
  type: 'pressure',
  payload: {
    absPress: d.pressAbs,
    diffPress: d.pressDiff,
    temperature: d.temperature,
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

reg(MissionCount, d => [{
  type: 'missionCount',
  payload: { count: d.count, missionType: d.missionType },
}])

reg(MissionItemInt, d => [{
  type: 'missionItemInt',
  payload: {
    seq: d.seq, frame: d.frame, command: d.command,
    current: d.current, autocontinue: d.autocontinue,
    param1: d.param1, param2: d.param2, param3: d.param3, param4: d.param4,
    x: d.x, y: d.y, z: d.z, missionType: d.missionType,
  },
}])

reg(MissionAck, d => [{
  type: 'missionAck',
  payload: {
    result: MavMissionResult[d.type] || String(d.type),
    missionType: d.missionType,
  },
}])

reg(MissionItemReached, d => [{
  type: 'missionItemReached',
  payload: { seq: d.seq },
}])

reg(MissionRequestInt, d => [{
  type: 'missionRequestInt',
  payload: { seq: d.seq, missionType: d.missionType },
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

reg(HomePosition, d => [{
  type: 'homePosition',
  payload: {
    lat: d.latitude,
    lon: d.longitude,
    alt: d.altitude,
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
      const modeNum = Object.entries(PLANE_MODES).find(([, v]) => v === params.mode)?.[0]
      if (modeNum === undefined) {
        console.warn(`[mavlink] setMode: unknown mode "${params.mode}"`)
        return null
      }
      const msg = new CommandLong()
      msg.command = MavCmd.DO_SET_MODE
      msg._param1 = 1 // MAV_MODE_FLAG_CUSTOM
      msg._param2 = Number(modeNum)
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
      // ArduPlane guided goto: MISSION_ITEM_INT with current=2 (guided waypoint)
      const msg = new MissionItemInt()
      msg.targetSystem = 1
      msg.targetComponent = 1
      msg.seq = 0
      msg.frame = MavFrame.GLOBAL_RELATIVE_ALT_INT
      msg.command = MavCmd.NAV_WAYPOINT
      msg.current = 2  // 2 = guided-mode waypoint flag for ArduPlane
      msg.autocontinue = 0
      msg.param1 = 0
      msg.param2 = 0
      msg.param3 = 0
      msg.param4 = 0
      msg.x = Math.round((params.lat || 0) * 1e7)
      msg.y = Math.round((params.lon || 0) * 1e7)
      msg.z = params.alt || 0
      msg.missionType = MavMissionType.MISSION
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
    case 'requestMissionList': {
      const msg = new MissionRequestList()
      msg.missionType = params.missionType ?? MavMissionType.MISSION
      return msg
    }
    case 'requestMissionItem': {
      const msg = new MissionRequestInt()
      msg.seq = params.seq || 0
      msg.missionType = params.missionType ?? MavMissionType.MISSION
      return msg
    }
    case 'sendMissionCount': {
      const msg = new MissionCount()
      msg.count = params.count || 0
      msg.missionType = params.missionType ?? MavMissionType.MISSION
      return msg
    }
    case 'sendMissionItem': {
      const msg = new MissionItemInt()
      msg.seq = params.seq || 0
      msg.frame = params.frame ?? MavFrame.GLOBAL_RELATIVE_ALT_INT
      msg.command = params.command ?? MavCmd.NAV_WAYPOINT
      msg.current = params.current || 0
      msg.autocontinue = params.autocontinue ?? 1
      msg.param1 = params.param1 || 0
      msg.param2 = params.param2 || 0
      msg.param3 = params.param3 || 0
      msg.param4 = params.param4 || 0
      msg.x = params.x || 0
      msg.y = params.y || 0
      msg.z = params.z || 0
      msg.missionType = params.missionType ?? MavMissionType.MISSION
      return msg
    }
    case 'sendMissionAck': {
      const msg = new MissionAck()
      msg.type = params.result ?? MavMissionResult.ACCEPTED
      msg.missionType = params.missionType ?? MavMissionType.MISSION
      return msg
    }
    case 'clearMission': {
      const msg = new MissionClearAll()
      msg.missionType = params.missionType ?? MavMissionType.MISSION
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
