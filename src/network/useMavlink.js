import { useTelemetryStore } from '../stores/useTelemetry.js'
import { useCommandsStore } from '../stores/useCommands.js'

// MAVLink v1/v2 link: everything MAVLink lives here; the stores only see app fields and commands in app units
// app local frame is NEU (x north, y east, z up); MAVLink's is NED, so z and vz flip sign here, both ways

const GCS_SYSTEM = 255
const GCS_COMPONENT = 190 // MAV_COMP_ID_MISSIONPLANNER
const AUTOPILOT_COMPONENT = 1 // MAV_COMP_ID_AUTOPILOT1; other components (gimbal, companion) are ignored for now
const ARMED = 128 // MAV_MODE_FLAG_SAFETY_ARMED
const POSITION_ONLY = 0b110111111000 // SET_POSITION_TARGET type_mask: ignore velocity, acceleration, yaw, yaw rate
const MAV_FRAME_LOCAL_NED = 1
const UINT16_MAX = 0xffff
const TYPES = {
    1: 'plane',
    2: 'quadrotor',
    4: 'helicopter',
    13: 'hexarotor',
    14: 'octorotor',
    15: 'tricopter',
    19: 'vtol',
    20: 'vtol',
    21: 'vtol',
    22: 'vtol',
} // MAV_TYPE
const EMPTY = new Uint8Array(0)

// v * scale, or null when v is the protocol's "unknown" value
const known = (v, unknown, scale) => (v === unknown ? null : v * scale)

// message id -> CRC extra, payload length and the app fields it fills; decode(view) reads fields in wire order (largest type first)
const MESSAGES = {
    0: {
        crc: 50,
        len: 9,
        fields: {
            // HEARTBEAT
            type: (d) => TYPES[d.getUint8(4)] ?? 'unknown',
            arm: (d) => (d.getUint8(6) & ARMED) !== 0,
        },
    },
    1: {
        crc: 124,
        len: 31,
        fields: {
            // SYS_STATUS
            battery: (d) => ({
                voltage: known(d.getUint16(14, true), UINT16_MAX, 1e-3),
                current: known(d.getInt16(16, true), -1, 1e-2),
                remaining: known(d.getInt8(30), -1, 1),
            }),
            status: (d) => ({ load: d.getUint16(12, true) / 10, dropRate: d.getUint16(18, true) / 100 }),
        },
    },
    24: {
        crc: 24,
        len: 30,
        fields: {
            // GPS_RAW_INT
            gps: (d) => ({
                fixType: d.getUint8(28),
                satellites: d.getUint8(29),
                hdop: known(d.getUint16(20, true), UINT16_MAX, 1e-2),
                vdop: known(d.getUint16(22, true), UINT16_MAX, 1e-2),
            }),
        },
    },
    30: {
        crc: 39,
        len: 28,
        fields: {
            // ATTITUDE
            attitude: (d) => ({ roll: d.getFloat32(4, true), pitch: d.getFloat32(8, true), yaw: d.getFloat32(12, true) }),
        },
    },
    32: {
        crc: 185,
        len: 28,
        fields: {
            // LOCAL_POSITION_NED, to NEU
            local: (d) => ({
                x: d.getFloat32(4, true),
                y: d.getFloat32(8, true),
                z: -d.getFloat32(12, true),
                vx: d.getFloat32(16, true),
                vy: d.getFloat32(20, true),
                vz: -d.getFloat32(24, true),
            }),
        },
    },
    33: {
        crc: 104,
        len: 28,
        fields: {
            // GLOBAL_POSITION_INT
            global: (d) => ({ lat: d.getInt32(4, true) / 1e7, lon: d.getInt32(8, true) / 1e7, alt: d.getInt32(12, true) / 1e3 }), // alt MSL
        },
    },
    74: {
        crc: 20,
        len: 20,
        fields: {
            // VFR_HUD
            velocity: (d) => ({ airspeed: d.getFloat32(0, true), groundspeed: d.getFloat32(4, true), climb: d.getFloat32(12, true) }),
        },
    },
    109: {
        crc: 185,
        len: 9,
        fields: {
            // RADIO_STATUS
            link: (d) => ({
                rxErrors: d.getUint16(0, true),
                rssi: d.getUint8(4),
                remRssi: d.getUint8(5),
                noise: d.getUint8(7),
                remNoise: d.getUint8(8),
            }),
        },
    },
}
for (const m of Object.values(MESSAGES)) m.fields = Object.entries(m.fields) // plain loop per frame

// COMMAND_LONG to the autopilot of system sys; params fill param1..param7 in order
function commandLong(sys, command, ...params) {
    const p = new DataView(new ArrayBuffer(33))
    for (let i = 0; i < params.length; i++) p.setFloat32(i * 4, params[i], true)
    p.setUint16(28, command, true)
    p.setUint8(30, sys)
    p.setUint8(31, AUTOPILOT_COMPONENT)
    return [76, 152, p]
}

// app command (a commands store action) -> (sys, ...args) => [message id, CRC extra, payload DataView]
const COMMANDS = {
    arm: (sys) => commandLong(sys, 400, 1), // MAV_CMD_COMPONENT_ARM_DISARM
    disarm: (sys) => commandLong(sys, 400, 0),
    takeoff: (sys, alt) => commandLong(sys, 22, 0, 0, 0, 0, 0, 0, alt), // MAV_CMD_NAV_TAKEOFF
    land: (sys) => commandLong(sys, 21), // MAV_CMD_NAV_LAND
    rtl: (sys) => commandLong(sys, 20), // MAV_CMD_NAV_RETURN_TO_LAUNCH
    goto: (sys, x, y, z) => {
        const p = new DataView(new ArrayBuffer(53)) // SET_POSITION_TARGET_LOCAL_NED, from NEU
        p.setFloat32(4, x, true)
        p.setFloat32(8, y, true)
        p.setFloat32(12, -z, true)
        p.setUint16(48, POSITION_ONLY, true)
        p.setUint8(50, sys)
        p.setUint8(51, AUTOPILOT_COMPONENT)
        p.setUint8(52, MAV_FRAME_LOCAL_NED)
        return [84, 143, p]
    },
}

// CRC-16/MCRF4XX (X.25) over buf[start, end), then the message's CRC extra
function crc(buf, start, end, extra) {
    let c = 0xffff
    for (let i = start; i <= end; i++) {
        let t = (i < end ? buf[i] : extra) ^ (c & 0xff)
        t = (t ^ (t << 4)) & 0xff
        c = ((c >> 8) ^ (t << 8) ^ (t << 3) ^ (t >> 4)) & 0xffff
    }
    return c
}

// one MAVLink connection: transmit writes bytes to it, receive takes any chunk of the incoming byte stream
// each MAVLink system id is mapped to an app vehicle id; nothing outside this file sees system ids
export function useMavlink(transmit) {
    const telemetry = useTelemetryStore()
    const commands = useCommandsStore()
    const ids = new Map() // MAVLink system id -> app vehicle id
    const systems = new Map() // app vehicle id -> MAVLink system id
    const payload = new Uint8Array(255) // reused; MAVLink 2 trims trailing zero bytes, so short payloads are zero-filled here
    const view = new DataView(payload.buffer)
    let pending = EMPTY // bytes of an incomplete frame from the last chunk
    let seq = 0

    function transmitFrame([msgid, extra, p]) {
        const len = p.byteLength
        const frame = new Uint8Array(12 + len)
        frame.set([0xfd, len, 0, 0, seq++ & 0xff, GCS_SYSTEM, GCS_COMPONENT, msgid & 0xff, (msgid >> 8) & 0xff, msgid >> 16])
        frame.set(new Uint8Array(p.buffer), 10)
        const c = crc(frame, 1, 10 + len, extra)
        frame[10 + len] = c & 0xff
        frame[11 + len] = c >> 8
        transmit(frame)
    }

    // first message from a vehicle: it appears in telemetry and its commands are sent from here on
    function connect(sys) {
        const id = telemetry.add()
        ids.set(sys, id)
        systems.set(id, sys)
        return id
    }

    // commands the store accepted for this connection's vehicles; detached: lives until close(), not a component
    const unsubscribe = commands.$onAction(({ name, args, after }) => {
        after((accepted) => {
            const sys = systems.get(args[0])
            const encode = COMMANDS[name]
            if (!accepted || sys === undefined || !encode) return
            try {
                transmitFrame(encode(sys, ...args.slice(1)))
            } catch (e) {
                console.error(`MAVLink: ${name} to vehicle ${args[0]} not sent`, e) // never reaches the caller
            }
        })
    }, true)

    function receive(bytes) {
        let buf = bytes
        if (pending.length) {
            buf = new Uint8Array(pending.length + bytes.length)
            buf.set(pending)
            buf.set(bytes, pending.length)
        }
        let i = 0
        while (i < buf.length) {
            const v2 = buf[i] === 0xfd
            if (!v2 && buf[i] !== 0xfe) {
                i++
                continue
            } // not a frame start
            const header = v2 ? 10 : 6
            if (buf.length - i < header) break
            const len = buf[i + 1]
            const size = header + len + 2 + (v2 && buf[i + 2] & 1 ? 13 : 0) // signed frames carry a 13 byte signature
            if (buf.length - i < size) break
            const message = MESSAGES[v2 ? buf[i + 7] | (buf[i + 8] << 8) | (buf[i + 9] << 16) : buf[i + 5]]
            if (!message) {
                i += size
                continue
            } // not decoded here
            const end = i + header + len
            if (crc(buf, i + 1, end, message.crc) !== (buf[end] | (buf[end + 1] << 8))) {
                i++
                continue
            } // corrupt or a false start: resync
            if (buf[i + (v2 ? 6 : 4)] === AUTOPILOT_COMPONENT) {
                const sys = buf[i + (v2 ? 5 : 3)]
                const id = ids.get(sys) ?? connect(sys)
                payload.set(buf.subarray(i + header, end))
                payload.fill(0, len, message.len)
                const fields = message.fields
                for (let j = 0; j < fields.length; j++) telemetry.write(id, fields[j][0], fields[j][1](view))
            }
            i += size
        }
        pending = i < buf.length ? buf.slice(i) : EMPTY
    }

    // the connection is gone: its vehicles leave telemetry and no more commands are sent
    function close() {
        unsubscribe()
        for (const id of ids.values()) telemetry.remove(id)
        ids.clear()
        systems.clear()
    }

    return { receive, close }
}
