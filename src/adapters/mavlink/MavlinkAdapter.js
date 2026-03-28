/**
 * MAVLink Adapter — Browser side
 *
 * Connects to the Bun bridge server via WebSocket.
 * Receives normalized JSON messages, forwards commands.
 * The public interface matches the adapter contract in docs/protocol_adapter.md.
 */

const BRIDGE_URL = 'ws://localhost:3001'
const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000]

// ── Telemetry console logger (1 Hz) ─────────────────────────────────────────

function createTelemLogger() {
  const latest = {}
  const deg = (r) => (r * 180 / Math.PI).toFixed(1)

  setInterval(() => {
    const pos = latest.position
    const vel = latest.velocity
    const att = latest.attitude
    const hb  = latest.heartbeat
    const bat = latest.battery
    const gps = latest.gps
    if (!pos) return

    console.log(
      `[telem] %c${hb?.mode || '---'} ${hb?.armed ? 'ARMED' : 'DISARMED'}` +
      ` %c| lat=${pos.lat.toFixed(7)} lon=${pos.lon.toFixed(7)} alt=${pos.altAGL.toFixed(1)}m MSL=${pos.altMSL.toFixed(1)}m hdg=${pos.heading.toFixed(0)}°` +
      ` | gs=${vel?.groundSpeed?.toFixed(1) ?? '?'}m/s as=${vel?.airspeed?.toFixed(1) ?? '?'}m/s climb=${vel?.climb?.toFixed(1) ?? '?'}m/s` +
      ` | R=${att ? deg(att.roll) : '?'}° P=${att ? deg(att.pitch) : '?'}° Y=${att ? deg(att.yaw) : '?'}°` +
      ` | bat=${bat?.voltage?.toFixed(1) ?? '?'}V ${bat?.remaining != null ? (bat.remaining * 100).toFixed(0) + '%' : '?'}` +
      ` | gps=${gps?.fixType ?? '?'} sat=${gps?.satellites ?? '?'}`,
      'color: #22c55e; font-weight: bold',
      'color: inherit'
    )
  }, 1000)

  return (type, payload) => { latest[type] = payload }
}

export function createMavlinkAdapter() {
  let ws             = null
  let reconnectTimer = null
  let attempt        = 0
  let destroyed      = false

  const msgListeners    = new Set()
  const statusListeners = new Set()
  const trackTelem      = createTelemLogger()

  let _status = {
    state:     'disconnected',
    lastSeen:  null,
    latencyMs: null,
    info:      BRIDGE_URL,
  }

  function setStatus(patch) {
    _status = { ..._status, ...patch }
    for (const cb of statusListeners) cb(_status)
  }

  function openWs() {
    if (destroyed) return
    setStatus({ state: 'connecting' })

    ws = new WebSocket(BRIDGE_URL)

    ws.onopen = () => {
      attempt = 0
      setStatus({ state: 'connected' })
    }

    ws.onclose = () => {
      ws = null
      if (destroyed) return
      scheduleReconnect()
    }

    ws.onerror = () => {}

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data)

        if (envelope.type === 'message') {
          const msg = envelope.message
          _status.lastSeen = msg.timestamp
          trackTelem(msg.type, msg.payload)
          for (const cb of msgListeners) cb(msg)
        } else if (envelope.type === 'status') {
          setStatus(envelope.status)
        }
      } catch {}
    }
  }

  function scheduleReconnect() {
    setStatus({ state: 'reconnecting' })
    const delay = RECONNECT_DELAY_MS[Math.min(attempt, RECONNECT_DELAY_MS.length - 1)]
    attempt++
    reconnectTimer = setTimeout(openWs, delay)
  }

  return {
    get status() {
      return _status
    },

    connect(config) {
      destroyed = false
      openWs()
    },

    disconnect() {
      destroyed = true
      clearTimeout(reconnectTimer)
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnect' }))
      }
      ws?.close()
      ws = null
      setStatus({ state: 'disconnected' })
    },

    send(command) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'command', command }))
      }
    },

    onMessage(callback) {
      msgListeners.add(callback)
      return () => msgListeners.delete(callback)
    },

    onStatusChange(callback) {
      statusListeners.add(callback)
      return () => statusListeners.delete(callback)
    },
  }
}
