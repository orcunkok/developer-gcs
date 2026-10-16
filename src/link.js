/** @typedef {(key: string, name: string | null, fields?: object) => void} Listener name is null when the vehicle is removed */

export const messages = {}
const listeners = new Set()
let link = null

export function ingest(key, name, fields) {
  (messages[key] ??= {})[name] = fields
  for (const fn of listeners) fn(key, name, fields)
}

export function onMessage(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setLink(l) {
  link = l
}

export function send(key, name, fields) {
  link?.send(key, name, fields)
}

export function remove(key) {
  delete messages[key]
  for (const fn of listeners) fn(key, null)
}
