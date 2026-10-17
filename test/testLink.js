// test link: simulated FPV drones writing to the telemetry store like a real link, driven by window.gcs and the dev server terminal
import { create, step } from "./testFPV.js"
import { useLayoutStore } from "../src/stores/layout.js"
import { useTelemetryStore } from "../src/stores/useTelemetry.js"
import { useCommandsStore } from "../src/stores/useCommands.js"

const DT = 0.02 // 50 Hz telemetry
const STATE_EVERY = 50 // ticks, 1 Hz like a real autopilot heartbeat
const RTL_ALT = 15 // m, like ArduPilot's RTL_ALT default
const telemetry = useTelemetryStore()
const commands = useCommandsStore()
const drones = new Map() // vehicle id -> FPV state
let tick = 0
let demoTimer = 0
let members = [] // swarm selection

function state(id, v) {
  telemetry.write(id, "state", { type: "quadrotor", armed: v.armed })
}

function pose(id, { pos, vel, att }) {
  telemetry.write(id, "localPosition", { x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z })
  telemetry.write(id, "attitude", { roll: att.roll, pitch: att.pitch, yaw: att.yaw })
}

setInterval(() => {
  const beat = ++tick % STATE_EVERY === 0
  for (const [id, v] of drones) {
    step(v, DT)
    if (beat) state(id, v)
    pose(id, v)
  }
}, DT * 1000)

// commands arriving from the GCS (see src/stores/useCommands.js)
function receive(id, command, args) {
  const v = drones.get(id)
  const { pos, target } = v
  if (command === "goto") {
    const [x, y, z] = args
    Object.assign(target, { x, y, z })
    v.landing = v.rtl = false
  } else if (command === "arm" || command === "disarm") {
    v.armed = command === "arm"
    target.z = pos.z
  } else if (command === "takeoff") {
    if (!v.armed) return
    Object.assign(target, { x: pos.x, y: pos.y, z: -args[0] })
    v.landing = v.rtl = false
  } else if (command === "land") {
    Object.assign(target, { x: pos.x, y: pos.y, z: 0 })
    v.landing = true
    v.rtl = false
  } else if (command === "rtl") {
    // home at RTL_ALT (or higher if already above), then land
    if (!v.armed) return
    Object.assign(target, { x: v.home.x, y: v.home.y, z: Math.min(pos.z, -RTL_ALT) })
    v.rtl = true
    v.landing = false
  }
}

const posOf = (id) => drones.get(id)?.pos
const rand = (a, b) => a + Math.random() * (b - a)

const gcs = {
  spawn(n = 1) {
    const ids = []
    for (let i = 0; i < n; i++) {
      const id = telemetry.add()
      const v = create(id * 3, (id % 2) * 3)
      drones.set(id, v)
      commands.connect(id, (command, args) => receive(id, command, args))
      state(id, v)
      pose(id, v)
      ids.push(id)
    }
    return ids
  },
  arm: (id) => commands.send(id, "arm"),
  disarm: (id) => commands.send(id, "disarm"),
  takeoff: (id, alt = 5) => commands.send(id, "takeoff", alt),
  land: (id) => commands.send(id, "land"),
  rtl: (id) => commands.send(id, "rtl"),
  goto: (id, north, east, alt) => commands.send(id, "goto", north, east, -alt),
  // climb or descend to alt at the current position
  alt(id, alt) {
    const p = posOf(id)
    if (p) gcs.goto(id, p.x, p.y, alt)
  },
  // hover in place; without an id also ends the demo and stops every drone
  stop(id) {
    if (id === undefined) {
      clearInterval(demoTimer)
      for (const k of drones.keys()) gcs.stop(k)
      return
    }
    const p = posOf(id)
    if (p) gcs.goto(id, p.x, p.y, -p.z)
  },
  // remove every drone; numbering starts from 1 again
  reset() {
    clearInterval(demoTimer)
    for (const k of drones.keys()) {
      commands.disconnect(k)
      telemetry.remove(k)
    }
    drones.clear()
    members = []
    useLayoutStore().follow = []
  },
  demo(n = 4) {
    const ids = gcs.spawn(n)
    for (const k of ids) {
      gcs.arm(k)
      gcs.takeoff(k)
    }
    clearInterval(demoTimer)
    demoTimer = setInterval(() => {
      for (const k of ids) gcs.goto(k, rand(-20, 20), rand(-20, 20), rand(3, 10))
    }, 3000)
    return ids
  },
  // 3D camera follows these drones, or the swarm for "swarm" (all drones if none selected); no ids frees the camera
  watch(...ids) {
    const swarmIds = members.length ? members : [...drones.keys()]
    const follow = (ids[0] === "swarm" ? swarmIds : ids).filter((k) => drones.has(k))
    useLayoutStore().follow = follow
    return follow.length ? follow : "free camera"
  },
  unwatch: () => gcs.watch(),
  swarm,
}

// selects drones (all when no ids); swarm.<command> sends the same command to every member
function swarm(...ids) {
  members = ids.length ? ids.filter((k) => drones.has(k)) : [...drones.keys()]
  return members
}
for (const name of ["arm", "disarm", "takeoff", "land", "rtl", "alt", "stop"])
  swarm[name] = (...args) => members.forEach((k) => gcs[name](k, ...args))

// test only: there is no collision avoidance yet, so swarm.goto moves the swarm's centre to the point
// and each drone keeps its offset from that centre instead of all converging on one spot
swarm.goto = (north, east, alt) => {
  const ps = members.map(posOf)
  const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length
  const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length
  members.forEach((k, i) => gcs.goto(k, north + ps[i].x - cx, east + ps[i].y - cy, alt))
}

window.gcs = gcs
window.swarm = swarm

// commands typed in the dev server terminal (test/testTerminal.js); dotted names reach swarm, e.g. "swarm.alt"
import.meta.hot?.on("gcs:cmd", ({ name, args }) => {
  let fn = name.split(".").reduce((o, k) => o?.[k], gcs)
  if (fn && Object.hasOwn(fn, args[0]) && typeof fn[args[0]] === "function") fn = fn[args.shift()] // "swarm goto ..." works like "swarm.goto ..."
  let out
  try {
    out =
      typeof fn === "function"
        ? (fn(...args.map((a) => (isNaN(a) ? a : +a))) ?? "ok")
        : `unknown command "${name}", try: ${Object.keys(gcs).join(", ")}, swarm.<command>`
  } catch (e) {
    out = e.message
  }
  import.meta.hot.send("gcs:out", String(out))
})
