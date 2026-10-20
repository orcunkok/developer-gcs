import { defineStore } from 'pinia'
import { useTelemetryStore } from './useTelemetry.js'

// commands to one vehicle, e.g. command.takeoff(1, 10), and to a swarm, e.g. command.swarm.takeoff(1, 10)
// positions are local NEU metres (x north, y east, z up), like telemetry local: goto(1, 10, 5, 8) is 8 m up
// data only, no links or routing (that is the network's job)
// mission critical: nothing here throws; each returns true when accepted, false when the vehicle or swarm is unknown or an argument is invalid
// links act on accepted commands with command.$onAction(({ name, args, after }) => after((accepted) => …))
// adding a command: add it to commands below (swarm gets it too), then handle it in each link (e.g. network/useMavlink.js)
export const useCommandsStore = defineStore('commands', () => {
    const telemetry = useTelemetryStore()

    // records the command as the vehicle's state when the vehicle exists and the arguments are valid
    function accept(n, name, valid = true) {
        const vehicle = telemetry.get(n)
        if (!vehicle || !valid) return false
        vehicle.state = name
        return true
    }

    const finite = (...values) => values.every(Number.isFinite)

    const commands = {
        arm: (n) => accept(n, 'arm'),
        disarm: (n) => accept(n, 'disarm'),
        takeoff: (n, alt) => accept(n, 'takeoff', finite(alt)),
        land: (n) => accept(n, 'land'),
        rtl: (n) => accept(n, 'rtl'),
        goto: (n, x, y, z) => accept(n, 'goto', finite(x, y, z)),
    }

    // ids of the vehicles in swarm group
    const members = (group) =>
        Object.values(telemetry.id)
            .filter((v) => v.swarm === group)
            .map((v) => v.id)

    // swarm groups are whole numbers from 1
    const swarm = {
        add(n, group) {
            const vehicle = telemetry.get(n)
            if (!vehicle || !Number.isInteger(group) || group < 1) return false
            vehicle.swarm = group
            return true
        },
        remove(n) {
            const vehicle = telemetry.get(n)
            if (!vehicle) return false
            vehicle.swarm = null
            return true
        },
        members,
    }

    // every command is also a swarm command: sent to each member through the store, so links see it
    // the first member checks the arguments, so a swarm command reaches every member or none
    for (const name in commands)
        swarm[name] = (group, ...args) => {
            const ids = members(group)
            for (const n of ids) if (!useCommandsStore()[name](n, ...args)) return false
            return ids.length > 0
        }

    // frozen, so swarm stays a plain object and cannot be changed
    return { ...commands, swarm: Object.freeze(swarm) }
})
