/**
 * Shared type definitions for the protocol adapter interface.
 * These shapes are used by both the adapter and its consumers (state store, action registry).
 *
 * @typedef {'disconnected'|'connecting'|'connected'|'reconnecting'} ConnectionState
 *
 * @typedef {Object} ConnectionStatus
 * @property {ConnectionState} state
 * @property {number|null}     lastSeen   - ms since epoch of last received message
 * @property {number|null}     latencyMs  - round-trip if measurable
 * @property {string|null}     info       - human-readable detail, e.g. "udp://127.0.0.1:14550"
 *
 * @typedef {Object} NormalizedMessage
 * @property {string} type       - message category (heartbeat, attitude, position, ...)
 * @property {number} timestamp  - ms since epoch, set by adapter on receipt
 * @property {string} source     - adapter identifier, e.g. "mavlink-udp"
 * @property {Object} payload    - type-specific key-value data
 *
 * @typedef {Object} NormalizedCommand
 * @property {string} action  - what to do (arm, disarm, setMode, goto, ...)
 * @property {Object} params  - action-specific parameters
 */

export {}  // make this a module
