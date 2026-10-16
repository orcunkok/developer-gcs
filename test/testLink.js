// test link: simulated FPV drones behind src/link.js, driven by window.gcs and the dev server terminal
import { ingest, setLink, send, remove, messages } from "../src/link.js"
import { create, step } from "./testFPV.js"
import { useLayoutStore } from "../src/stores/layout.js"

const DT = 0.02 // 50 Hz telemetry
const HEARTBEAT_EVERY = 50 // ticks, 1 Hz like a real autopilot
const RTL_ALT = 15 // m, like ArduPilot's RTL_ALT default
const drones = new Map() // key -> { state, hb }
let count = 0
let tick = 0
let demoTimer = 0
let members = [] // swarm selection

function heartbeat(key, d) {
  d.hb.base_mode = d.state.armed ? 128 : 0
  ingest(key, "HEARTBEAT", d.hb)
}

setInterval(() => {
  const beat = ++tick % HEARTBEAT_EVERY === 0
  for (const [key, d] of drones) {
    step(d.state, DT)
    if (beat) heartbeat(key, d)
    ingest(key, "LOCAL_POSITION_NED", d.state.pos)
    ingest(key, "ATTITUDE", d.state.att)
  }
}, DT * 1000)

setLink({
  send(key, name, f) {
    const v = drones.get(key)?.state
    if (!v) return
    const { pos, target } = v
    if (name === "SET_POSITION_TARGET_LOCAL_NED") {
      Object.assign(target, { x: f.x, y: f.y, z: f.z })
      v.landing = v.rtl = false
      return
    }
    if (name !== "COMMAND_LONG") return
    let ok = true
    if (f.command === 400) {
      // arm / disarm
      v.armed = f.param1 === 1
      target.z = pos.z
    } else if (f.command === 22) {
      // takeoff to param7 metres
      ok = v.armed
      if (ok) Object.assign(target, { x: pos.x, y: pos.y, z: -f.param7 })
      v.landing = v.rtl = false
    } else if (f.command === 21) {
      // land
      Object.assign(target, { x: pos.x, y: pos.y, z: 0 })
      v.landing = true
      v.rtl = false
    } else if (f.command === 20) {
      // return to launch: home at RTL_ALT (or higher if already above), then land
      ok = v.armed
      if (ok) Object.assign(target, { x: v.home.x, y: v.home.y, z: Math.min(pos.z, -RTL_ALT) })
      v.rtl = ok
      v.landing = false
    }
    ingest(key, "COMMAND_ACK", { command: f.command, result: ok ? 0 : 4 })
  },
})

// accepts a key or its number: 1 -> "test:1"
const keyOf = (id) => (typeof id === "number" ? `test:${id}` : id)
const posOf = (key) => messages[keyOf(key)]?.LOCAL_POSITION_NED
const cmd = (key, command, param1 = 0, param7 = 0) =>
  send(keyOf(key), "COMMAND_LONG", { command, param1, param7 })
const rand = (a, b) => a + Math.random() * (b - a)

const gcs = {
  spawn(n = 1) {
    const keys = []
    for (let i = 0; i < n; i++) {
      const key = `test:${++count}`
      const d = { state: create(count * 3, (count % 2) * 3), hb: { type: 2, base_mode: 0 } }
      drones.set(key, d)
      heartbeat(key, d) // first, so the vehicle type is known before any position
      ingest(key, "LOCAL_POSITION_NED", d.state.pos)
      ingest(key, "ATTITUDE", d.state.att)
      keys.push(key)
    }
    return keys
  },
  arm: (key) => cmd(key, 400, 1),
  disarm: (key) => cmd(key, 400, 0),
  takeoff: (key, alt = 5) => cmd(key, 22, 0, alt),
  land: (key) => cmd(key, 21),
  rtl: (key) => cmd(key, 20),
  goto: (key, north, east, alt) =>
    send(keyOf(key), "SET_POSITION_TARGET_LOCAL_NED", { x: north, y: east, z: -alt }),
  // climb or descend to alt at the current position
  alt(key, alt) {
    const p = posOf(key)
    if (p) gcs.goto(key, p.x, p.y, alt)
  },
  // hover in place; without a key also ends the demo and stops every drone
  stop(key) {
    if (key === undefined) {
      clearInterval(demoTimer)
      for (const k of drones.keys()) gcs.stop(k)
      return
    }
    const p = posOf(key)
    if (p) gcs.goto(key, p.x, p.y, -p.z)
  },
  // remove every drone; numbering starts from 1 again
  reset() {
    clearInterval(demoTimer)
    for (const k of drones.keys()) remove(k)
    drones.clear()
    members = []
    count = 0
    useLayoutStore().follow = []
  },
  demo(n = 4) {
    const keys = gcs.spawn(n)
    for (const k of keys) {
      gcs.arm(k)
      gcs.takeoff(k)
    }
    clearInterval(demoTimer)
    demoTimer = setInterval(() => {
      for (const k of keys) gcs.goto(k, rand(-20, 20), rand(-20, 20), rand(3, 10))
    }, 3000)
    return keys
  },
  // 3D camera follows these drones, or the swarm for "swarm" (all drones if none selected); no ids frees the camera
  watch(...ids) {
    const swarmKeys = members.length ? members : [...drones.keys()]
    const keys = (ids[0] === "swarm" ? swarmKeys : ids.map(keyOf)).filter((k) => drones.has(k))
    useLayoutStore().follow = keys
    return keys.length ? keys : "free camera"
  },
  unwatch: () => gcs.watch(),
  swarm,
}

// selects drones (all when no ids); swarm.<command> sends the same command to every member
function swarm(...ids) {
  members = ids.length ? ids.map(keyOf).filter((k) => drones.has(k)) : [...drones.keys()]
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
