import { shallowRef, shallowReactive } from 'vue'
import { defineStore } from 'pinia'

// one container per vehicle, everything it has in app units; each property is tracked on its own,
// so a change wakes only readers of that vehicle's property
// adding telemetry: add it here, then fill it in each link (e.g. network/useMavlink.js); zeros or null until the vehicle sends it
function createVehicle(id) {
  return shallowReactive({
    id, //unique drone id
    name: `Drone ${id}`, //name, if not set automatically filled.
    state: null, // last command accepted for it ('arm', 'takeoff', …), null before the first
    swarm: null, // swarm group number, null when in none
    type: null, // ('quadrotor', 'plane', … 'unknown')
    is_armed: null, // (bool)

    attitude: {
      roll: 0,
      pitch: 0,
      yaw: 0,
    }, // rad
    local: {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0
    }, // m, m/s (NEU: x north, y east, z up)
    global: {
      lat: 0,
      lon: 0,
      alt: 0
    }, // deg, m MSL
    velocity: {
      airspeed: 0,
      groundspeed: 0,
      climb: 0
    }, // m/s
    battery: null, // voltage (V), current (A), remaining (%)
    gps: null, // fixType (0-1 no fix, 2 2D, 3 3D, 4 DGPS, 5 RTK float, 6 RTK fixed), satellites, hdop, vdop
    status: null, // load (% CPU), dropRate (% packets lost)
    link: null, // rssi, remRssi, noise, remNoise (0-254), rxErrors
  })
}

// vehicle properties owned by the app; links cannot write them
const APP_FIELDS = new Set(['id', 'name', 'state', 'swarm'])

// true when b holds the same value as a: equal plain values, or flat objects with equal values
function same(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null) return false
  for (const k in b) if (a[k] !== b[k]) return false
  return true
}

// every vehicle and its data; data only, no links or routing (that is the network's job)
// mission critical: nothing here throws; invalid calls are ignored and return false
// links add() vehicles and write() telemetry; components read, e.g. id[1].attitude.roll, id[1].battery?.voltage
// vehicle ids are the app's own, never a protocol's: each link maps its vehicles to the id add() gives it
export const useTelemetryStore = defineStore('telemetry', () => {
  const id = shallowRef({}) // vehicle id -> vehicle; replaced only when a vehicle is added or removed

  // the vehicle with id n, or undefined; whole-number ids only, so '1' or 'constructor' find nothing
  function get(n) {
    return Number.isInteger(n) && Object.hasOwn(id.value, n) ? id.value[n] : undefined
  }

  // new vehicle under the smallest free id (1, 2, …), so ids stay short and restart at 1 once all are gone
  function add() {
    let n = 1
    while (Object.hasOwn(id.value, n)) n++
    id.value = { ...id.value, [n]: createVehicle(n) }
    return n
  }

  // value is a plain value (type, arm) or a new object: changing one already written does not notify readers
  // repeated values wake no one; null, undefined and functions are refused
  function write(n, field, value) {
    const vehicle = get(n)
    if (!vehicle || APP_FIELDS.has(field) || !Object.hasOwn(vehicle, field) || value == null || typeof value === 'function') return false
    if (!same(vehicle[field], value)) vehicle[field] = value
    return true
  }

  function remove(n) {
    if (!get(n)) return false
    const { [n]: _, ...rest } = id.value
    id.value = rest
    return true
  }

  return { id, get, add, write, remove }
})
