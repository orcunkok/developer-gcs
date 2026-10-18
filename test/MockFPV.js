// simple FPV quad physics, close enough to look real; testVTOL.js and testPlane.js would sit next to this later
// the controller picks a tilt, the tilt moves at a limited rate, and only the actual tilt accelerates the drone (minus drag),
// so it leans before it moves, leans into cruise, and flares to stop, like a real quad
const MAX_SPEED = 12 // m/s horizontal
const CLIMB_SPEED = 5 // m/s
const DESCENT_SPEED = 3 // m/s
const VERTICAL_ACCEL = 6 // m/s²
const MAX_TILT = (35 * Math.PI) / 180
const TILT_RATE = 3 // rad/s
const YAW_RATE = 3 // rad/s
const DRAG = 0.3 // 1/s, linear; cruise at 12 m/s needs ~20° of lean
const G = 9.81
// position -> velocity -> acceleration P gains
const KP = 0.8 // 1/s
const KV = 2.5 // 1/s
// visual only: a small wobble added to the reported roll/pitch, never to the physics, so paths and formations are unchanged;
// it decays back to zero (never accumulates) and fades out at hover so a hovering drone goes still
const WOBBLE = (1.5 * Math.PI) / 180 // rad, typical wobble at speed
const WOBBLE_TIME = 0.4 // s, how long one wobble lasts
const WOBBLE_FULL_SPEED = 4 // m/s, wobble fades in up to this speed

// roughly normal, mean 0, std 1
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2

const clamp = (x, m) => Math.max(-m, Math.min(m, x))

/**
 * pos, vel and att are NED / radians, like LOCAL_POSITION_NED and ATTITUDE
 * @typedef {Object} Fpv
 * @property {{x: number, y: number, z: number}} pos NED metres, z = 0 on the floor
 * @property {{x: number, y: number, z: number}} vel
 * @property {{x: number, y: number, z: number}} target
 * @property {{roll: number, pitch: number, yaw: number}} att radians, reported (tilt plus wobble)
 * @property {{roll: number, pitch: number}} tilt radians, the physical tilt that drives the motion
 * @property {boolean} armed
 * @property {boolean} landing disarms on touchdown
 * @property {{x: number, y: number}} home spawn point, where RTL returns
 * @property {boolean} rtl flying home; lands once there
 * @property {{roll: number, pitch: number}} wobble unit-scale wobble state, decays to 0
 */

/** @returns {Fpv} */
export function create(north, east) {
  return {
    pos: { x: north, y: east, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    target: { x: north, y: east, z: 0 },
    att: { roll: 0, pitch: 0, yaw: 0 },
    tilt: { roll: 0, pitch: 0 },
    armed: false,
    landing: false,
    home: { x: north, y: east },
    rtl: false,
    wobble: { roll: 0, pitch: 0 },
  }
}

/** @param {Fpv} v */
export function step(v, dt) {
  const { pos, vel, target, att, tilt, wobble } = v
  if (!v.armed) {
    // motors off: falls if airborne, rests on the floor otherwise
    vel.x = vel.y = 0
    vel.z = pos.z < 0 ? vel.z + G * dt : 0
    pos.z = Math.min(0, pos.z + vel.z * dt)
    if (pos.z === 0) att.roll = att.pitch = tilt.roll = tilt.pitch = 0
    return
  }
  const c = Math.cos(att.yaw)
  const s = Math.sin(att.yaw)

  // horizontal: desired velocity, then the acceleration (plus drag feedforward) it needs, as a tilt
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const k = KP * Math.min(1, MAX_SPEED / (KP * Math.hypot(dx, dy) || 1))
  const ax = KV * (dx * k - vel.x) + DRAG * vel.x
  const ay = KV * (dy * k - vel.y) + DRAG * vel.y
  const pitch = clamp(-Math.atan((ax * c + ay * s) / G), MAX_TILT)
  const roll = clamp(Math.atan((ay * c - ax * s) / G), MAX_TILT)
  tilt.pitch += clamp(pitch - tilt.pitch, TILT_RATE * dt)
  tilt.roll += clamp(roll - tilt.roll, TILT_RATE * dt)

  // the actual tilt is what accelerates it
  const fwd = -G * Math.tan(tilt.pitch)
  const right = G * Math.tan(tilt.roll)
  vel.x += (fwd * c - right * s - DRAG * vel.x) * dt
  vel.y += (fwd * s + right * c - DRAG * vel.y) * dt

  // vertical: separate climb and descent limits, like an autopilot
  const vz = Math.max(-CLIMB_SPEED, Math.min(DESCENT_SPEED, KP * 2 * (target.z - pos.z)))
  vel.z += clamp(KV * 2 * (vz - vel.z), VERTICAL_ACCEL) * dt

  pos.x += vel.x * dt
  pos.y += vel.y * dt
  pos.z = Math.min(0, pos.z + vel.z * dt)

  // nose turns toward the direction of travel
  if (Math.hypot(vel.x, vel.y) > 2) {
    const d = Math.atan2(vel.y, vel.x) - att.yaw
    att.yaw += clamp(Math.atan2(Math.sin(d), Math.cos(d)), YAW_RATE * dt)
  }

  // reported attitude: wobble decays toward 0 with a random kick each tick, so it never builds up
  const decay = dt / WOBBLE_TIME
  const kick = Math.sqrt(2 * decay)
  wobble.pitch += kick * gauss() - wobble.pitch * decay
  wobble.roll += kick * gauss() - wobble.roll * decay
  const amount = WOBBLE * Math.min(1, Math.hypot(vel.x, vel.y, vel.z) / WOBBLE_FULL_SPEED)
  att.pitch = tilt.pitch + amount * wobble.pitch
  att.roll = tilt.roll + amount * wobble.roll

  if (v.rtl && Math.hypot(dx, dy) < 0.3) {
    target.z = 0
    v.rtl = false
    v.landing = true
  }

  if (v.landing && pos.z > -0.05) {
    pos.z = vel.z = 0
    v.armed = v.landing = false
  }
}
