import { defineStore } from 'pinia'

// every command the app can send -> its params and their units, in argument order; every argument is a finite number
// links (e.g. network/useMavlink.js) encode the ones they support; adding a command: list it here, then encode it in each link
export const COMMANDS = Object.freeze({
  arm: {},
  disarm: {},
  takeoff: { alt: 'm' }, // above home
  land: {},
  rtl: {},
  goto: { x: 'm', y: 'm', z: 'm' }, // local NED
})

// shared command path to every vehicle: links connect the vehicles they own, everything else sends
// every command goes through send, so store.$onAction sees them all
export const useCommandsStore = defineStore('commands', () => {
  const links = new Map() // vehicle id -> (command, args) => void

  function connect(id, deliver) {
    links.set(id, deliver)
  }

  function disconnect(id) {
    links.delete(id)
  }

  function send(id, command, ...args) {
    const params = Object.hasOwn(COMMANDS, command) && Object.keys(COMMANDS[command])
    if (!params) throw new Error(`unknown command ${command}`)
    if (args.length !== params.length || !args.every(Number.isFinite))
      throw new Error(`${command} takes ${params.length ? params.join(', ') + ' (numbers)' : 'no arguments'}`)
    const deliver = links.get(id)
    if (!deliver) throw new Error(`no link to vehicle ${id}`)
    deliver(command, args)
  }

  return { connect, disconnect, send }
})
