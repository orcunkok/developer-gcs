// Test link: simulated drones that use our stores exactly like a real link.
// The physics are NED like a real autopilot; like useMavlink.js, z and vz flip sign here so the stores only see NEU.
// Telemetry goes into the telemetry store; commands come from the commands store.
// Drive it from the browser console (gcs, swarm) or the dev server terminal (npm run dev:test).
import { create, step } from "./MockFPV.js"
import { useLayoutStore } from "../src/stores/layout.js"
import { useTelemetryStore } from "../src/stores/useTelemetry.js"
import { useCommandsStore } from "../src/stores/useCommands.js"

const TICK_SECONDS = 0.02 // 50 Hz physics and position telemetry
const TICKS_PER_HEARTBEAT = 50 // 1 Hz heartbeat, like a real autopilot
const RTL_ALTITUDE = 15 // m, like ArduPilot's RTL_ALT default
const SWARM = 1 // the swarm group that "swarm 1 2 3" picks and swarm commands go to

const telemetry = useTelemetryStore()
const command = useCommandsStore()

const drones = new Map() // vehicle id -> simulated drone (see MockFPV.js)
let tickCount = 0
let demoTimer = 0

// --- Simulation -> telemetry store -------------------------------------------

function sendHeartbeat(id, drone) {
  telemetry.write(id, "type", "quadrotor")
  telemetry.write(id, "is_armed", drone.armed)
}

function sendPose(id, drone) {
  const { pos, vel, att } = drone
  telemetry.write(id, "local", { x: pos.x, y: pos.y, z: -pos.z, vx: vel.x, vy: vel.y, vz: -vel.z })
  telemetry.write(id, "attitude", { roll: att.roll, pitch: att.pitch, yaw: att.yaw })
}

setInterval(() => {
  tickCount++
  for (const [id, drone] of drones) {
    step(drone, TICK_SECONDS)
    if (tickCount % TICKS_PER_HEARTBEAT === 0) sendHeartbeat(id, drone)
    sendPose(id, drone)
  }
}, TICK_SECONDS * 1000)

// --- Commands store -> simulation --------------------------------------------

// Every command the store accepts, like a real link (see src/network/useMavlink.js).
// A swarm command arrives once per member. `true` keeps the listener for the whole session.
command.$onAction(({ name, args, after }) => {
  after((accepted) => {
    const [id, ...params] = args
    const drone = drones.get(id)
    if (accepted && drone) applyCommand(drone, name, params)
  })
}, true)

// Simulation positions are NED metres: x north, y east, z down (z = -10 is 10 m up); commands arrive in NEU.
function applyCommand(drone, name, params) {
  const { pos, home, target } = drone
  switch (name) {
    case "arm":
    case "disarm":
      drone.armed = name === "arm"
      target.z = pos.z // hold the current height
      break
    case "takeoff":
      if (!drone.armed) return
      flyTo(drone, pos.x, pos.y, -params[0])
      break
    case "goto":
      flyTo(drone, params[0], params[1], -params[2])
      break
    case "land":
      flyTo(drone, pos.x, pos.y, 0)
      drone.landing = true // MockFPV disarms it on touchdown
      break
    case "rtl":
      if (!drone.armed) return
      flyTo(drone, home.x, home.y, Math.min(pos.z, -RTL_ALTITUDE)) // stays higher if already above RTL_ALTITUDE
      drone.rtl = true // MockFPV lands it once home
      break
  }
}

// New target; cancels any landing or return home in progress.
function flyTo(drone, x, y, z) {
  drone.target.x = x
  drone.target.y = y
  drone.target.z = z
  drone.landing = false
  drone.rtl = false
}

// --- Console and terminal controls -------------------------------------------

const randomBetween = (min, max) => min + Math.random() * (max - min)

// Flight commands are the commands store's own; goto is NEU: gcs.goto(1, 10, 5, 8) is 10 m north, 5 m east, 8 m up.
const gcs = {
  arm: command.arm,
  disarm: command.disarm,
  takeoff: command.takeoff,
  land: command.land,
  rtl: command.rtl,
  goto: command.goto,

  // Adds drones on the ground and returns their ids.
  spawn(count = 1) {
    const ids = []
    for (let i = 0; i < count; i++) {
      const id = telemetry.add()
      const drone = create(id * 3, (id % 2) * 3) // spread out so they don't overlap
      drones.set(id, drone)
      sendHeartbeat(id, drone)
      sendPose(id, drone)
      ids.push(id)
    }
    return ids
  },

  // Climbs or descends to `altitude` metres (up is positive) where it is.
  alt(id, altitude) {
    const drone = drones.get(id)
    return drone ? command.goto(id, drone.pos.x, drone.pos.y, altitude) : false
  },

  // Hovers where it is. Without an id: ends the demo and stops every drone.
  stop(id) {
    if (id === undefined) {
      clearInterval(demoTimer)
      for (const droneId of drones.keys()) gcs.stop(droneId)
      return
    }
    const drone = drones.get(id)
    return drone ? command.goto(id, drone.pos.x, drone.pos.y, -drone.pos.z) : false
  },

  // Removes every drone; ids start from 1 again.
  reset() {
    clearInterval(demoTimer)
    for (const id of drones.keys()) telemetry.remove(id)
    drones.clear()
    useLayoutStore().follow = []
  },

  // Spawns drones as the swarm, arms and takes them off, then sends each to a random point every 3 s.
  demo(count = 4) {
    const ids = gcs.spawn(count)
    swarm(...ids)
    swarm.arm()
    swarm.takeoff(5)
    clearInterval(demoTimer)
    demoTimer = setInterval(() => {
      for (const id of ids) command.goto(id, randomBetween(-20, 20), randomBetween(-20, 20), randomBetween(3, 10))
    }, 3000)
    return ids
  },

  // 3D camera: watch(1, 2) follows drones 1 and 2, watch("swarm") the swarm (every drone if none picked),
  // watch() frees the camera.
  watch(...ids) {
    if (ids[0] === "swarm") {
      const members = swarm.members()
      ids = members.length > 0 ? members : [...drones.keys()]
    }
    const follow = ids.filter((id) => drones.has(id))
    useLayoutStore().follow = follow
    return follow.length > 0 ? follow : "free camera"
  },

  unwatch: () => gcs.watch(),
}

// "swarm 1 2 3" puts drones 1, 2, 3 in the SWARM group and everyone else out (no ids: every drone).
function swarm(...ids) {
  if (ids.length === 0) ids = [...drones.keys()]
  for (const id of drones.keys()) command.swarm.remove(id)
  for (const id of ids) command.swarm.add(id, SWARM)
  return command.swarm.members(SWARM)
}

// "swarm takeoff 5" sends the store's swarm command to the SWARM group.
swarm.arm = () => command.swarm.arm(SWARM)
swarm.disarm = () => command.swarm.disarm(SWARM)
swarm.takeoff = (altitude) => command.swarm.takeoff(SWARM, altitude)
swarm.land = () => command.swarm.land(SWARM)
swarm.rtl = () => command.swarm.rtl(SWARM)
swarm.goto = (x, y, z) => command.swarm.goto(SWARM, x, y, z) // every member flies to the same point
swarm.alt = (altitude) => command.swarm.members(SWARM).map((id) => gcs.alt(id, altitude))
swarm.stop = () => command.swarm.members(SWARM).map((id) => gcs.stop(id))
swarm.members = () => command.swarm.members(SWARM)

gcs.swarm = swarm
window.gcs = gcs
window.swarm = swarm

// --- Dev server terminal (see test/testTerminal.js) --------------------------

// "swarm takeoff 5" and "swarm.takeoff 5" both find gcs.swarm.takeoff; a used second word leaves args.
function findCommand(name, args) {
  let found = gcs
  for (const part of name.split(".")) found = found?.[part]
  if (typeof found?.[args[0]] === "function" && Object.hasOwn(found, args[0])) found = found[args.shift()]
  return found
}

import.meta.hot?.on("gcs:cmd", ({ name, args }) => {
  const fn = findCommand(name, args)
  let result
  if (typeof fn !== "function") {
    result = `unknown command "${name}", try: ${Object.keys(gcs).join(", ")}, swarm.<command>`
  } else {
    try {
      result = fn(...args.map((text) => (isNaN(text) ? text : Number(text)))) ?? "ok"
    } catch (error) {
      result = error.message
    }
  }
  import.meta.hot.send("gcs:out", String(result))
})
