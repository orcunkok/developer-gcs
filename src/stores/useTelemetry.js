import { shallowRef, shallowReactive } from 'vue'
import { defineStore } from 'pinia'

// every telemetry field a vehicle can have -> its values and their units; links (e.g. network/useMavlink.js) convert their protocol into these
// adding a field: list it here, then fill it in each link that can provide it; a value is null when the vehicle reports it as unknown
export const FIELDS = Object.freeze({
  state: { type: '', armed: '' }, // type 'quadrotor', 'plane', … 'unknown'; armed bool
  attitude: { roll: 'rad', pitch: 'rad', yaw: 'rad', rollSpeed: 'rad/s', pitchSpeed: 'rad/s', yawSpeed: 'rad/s' },
  localPosition: { x: 'm', y: 'm', z: 'm', vx: 'm/s', vy: 'm/s', vz: 'm/s' }, // NED
  globalPosition: { lat: 'deg', lon: 'deg', alt: 'm', relativeAlt: 'm', vx: 'm/s', vy: 'm/s', vz: 'm/s', heading: 'deg' }, // alt MSL, relativeAlt above home, v NED
  velocity: { airspeed: 'm/s', groundspeed: 'm/s', climb: 'm/s' },
  battery: { voltage: 'V', current: 'A', remaining: '%' },
  gps: { fixType: '', satellites: '', hdop: '', vdop: '' }, // fixType 0-1 no fix, 2 2D, 3 3D, 4 DGPS, 5 RTK float, 6 RTK fixed
  status: { load: '%', dropRate: '%' }, // CPU load, packets lost
  link: { rssi: '', remRssi: '', noise: '', remNoise: '', rxErrors: '' }, // signal values 0-254
})

// one tracked property per field, null until first written: a write wakes only readers of that vehicle's field
function createVehicle() {
  const vehicle = {}
  for (const field in FIELDS) vehicle[field] = null
  return shallowReactive(vehicle)
}

// true when b holds the same values as a (flat objects from links)
function same(a, b) {
  if (!a) return false
  for (const k in b) if (a[k] !== b[k]) return false
  return true
}

// shared telemetry for every vehicle: links add and write, everything else reads, e.g. id[1].battery?.voltage
// vehicle ids are the app's own, never a protocol's: each link maps its vehicles to the id add() gives it
export const useTelemetryStore = defineStore('telemetry', () => {
  const id = shallowRef({}) // vehicle id -> vehicle; replaced only when a vehicle is added or removed

  // new vehicle under the smallest free id (1, 2, …), so ids stay short and restart at 1 once all are gone
  function add() {
    let n = 1
    while (id.value[n]) n++
    id.value = { ...id.value, [n]: createVehicle() }
    return n
  }

  // value must be a new object: changing one already written does not notify readers; repeated values wake no one
  function write(n, field, value) {
    const vehicle = id.value[n]
    if (!same(vehicle[field], value)) vehicle[field] = value
  }

  function remove(n) {
    if (!id.value[n]) return
    const { [n]: _, ...rest } = id.value
    id.value = rest
  }

  return { id, add, write, remove }
})
